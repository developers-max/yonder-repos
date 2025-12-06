import { tool } from 'ai';
import { z } from 'zod';
import { appRouter } from '@/server/trpc';
import { ToolResult, ToolErrorCode } from './types';
import { queryZoningInfo, type ZoningQueryResponse } from '@/lib/utils/remote-clients/yonder-agent-client';
import { getToolContext } from './tool-context';
import { db } from '@/lib/db';
import { municipalities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Zod schema for validating yonder-agent API responses
const ZoningResponseSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty'),
  municipality: z.string(),
  sources: z.array(z.object({
    document_title: z.string(),
    document_url: z.string().url(),
    chunk_index: z.number().int().nonnegative(),
    similarity_score: z.number().min(0).max(1).optional(),
  })),
  question: z.string(),
  context_chunks_used: z.number().int().nonnegative(),
  response_time: z.number().positive(),
  search_method: z.string(),
  retrieval_calls: z.number().int().nonnegative().nullable().optional(),
  agent_steps: z.number().int().nonnegative().nullable().optional(),
});

// Configuration
const API_TIMEOUT_MS = 300000; // 2 minutes (120 seconds)
const MAX_RETRIES = 1; // Reduced retries since timeout is longer
const RETRY_DELAY_MS = 2000;

// Helper to determine if error is retryable
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors, timeouts, 5xx errors are retryable
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('504')
    );
  }
  return false;
}

// Helper to create timeout promise
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if error is not retryable or if we've exhausted retries
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: delay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[askMunicipalPlanning] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export type MunicipalPlanningQAResult = ToolResult<{
  municipalityId: number;
  municipalityName: string;
  question: string;
  answer: string;
  sources: Array<{
    id: string;
    documentTitle: string;
    documentId: string;
    documentUrl: string;
    chunkIndex: number;
    similarity: number;
    preview: string;
  }>;
  metadata: {
    assistantMessage: string;
    hasDocuments: boolean;
  };
}>;

/**
 * Tool for asking questions about municipal planning regulations and documents
 * Can use plot context or explicit municipality input
 */
export const askMunicipalPlanningTool = tool({
  description: `Ask questions about building, zoning, planning regulations, and urban development that apply to speicific plots or municipalities.
  IMPORTANT: Municipality id is a required field, please always provide it when using this tool.
  
  Use this when users ask about:
  - Zoning regulations for a specific municipality or location of a municipality.
  - Building height or density restrictions for a specific municipality or location of a municipality.
  - Land use permissions and requirements for a specific municipality or location of a municipality.
  - Construction permits and regulations for a specific municipality or location of a municipality.
  - Protected areas or heritage restrictions for a specific municipality or location of a municipality.
  - Specific planning documents (PDM, POUM, etc.)
  
  **AUTOMATIC CONTEXT DETECTION**: 
  - If a plot is in the chat context, the tool automatically extracts and uses its municipality ID
  - No need to specify plotId or municipalityName when plot context is available
  - You can override by explicitly providing municipalityName parameter
  
  Currently supported: Alella (Spain). Other municipalities will return no documents available.`,
  
  parameters: z.object({
    question: z.string().describe('The question about municipal planning regulations'),
    municipalityName: z.string().optional().describe('Municipality name (optional if plot context is available)'),
    plotId: z.string().optional().describe('Plot ID to get municipality from context (optional)'),
  }),
  
  execute: async ({ question, municipalityName, plotId: explicitPlotId }): Promise<MunicipalPlanningQAResult> => {
    const startTime = Date.now();
    
    // Get plotId from context if not explicitly provided
    const context = getToolContext();
    const plotId = explicitPlotId || context?.plotId;
    
    // Input validation and sanitization
    const sanitizedQuestion = question.trim();
    if (!sanitizedQuestion || sanitizedQuestion.length === 0) {
      return {
        error: {
          code: ToolErrorCode.INVALID_PARAMETERS,
          details: 'Question cannot be empty',
        },
        suggestions: [
          { id: 'provide_question', action: 'Provide a valid question about municipal planning' },
        ],
      };
    }
    
    if (sanitizedQuestion.length > 1000) {
      return {
        error: {
          code: ToolErrorCode.INVALID_PARAMETERS,
          details: 'Question is too long (maximum 1000 characters)',
        },
        suggestions: [
          { id: 'shorten_question', action: 'Rephrase the question to be more concise' },
        ],
      };
    }
    
    try {
      console.log('[askMunicipalPlanning] Starting query:', {
        questionLength: sanitizedQuestion.length,
        municipalityName,
        plotId,
        plotIdSource: explicitPlotId ? 'explicit' : (context?.plotId ? 'context' : 'none'),
        timestamp: new Date().toISOString(),
      });
      // Create a tRPC caller
      const caller = appRouter.createCaller({
        session: null,
        user: undefined,
      });

      let municipalityId: number | null = null;
      let resolvedMunicipalityName: string | null = null;

      // Strategy 1: If plotId is provided, get municipality from plot
      if (plotId) {
        try {
          const plot = await caller.plots.getPlot({ id: plotId });
          if (plot.municipality?.id) {
            municipalityId = plot.municipality.id;
            resolvedMunicipalityName = plot.municipality.name;
          }
        } catch (error) {
          console.warn('Failed to get municipality from plot:', error);
        }
      }

      // Strategy 2: If municipality name is provided, lookup in database
      if (!municipalityId && municipalityName) {
        try {
          console.log('[askMunicipalPlanning] Looking up municipality by name:', municipalityName);
          const municipality = await db.query.municipalities.findFirst({
            where: eq(municipalities.name, municipalityName),
          });
          
          if (municipality) {
            municipalityId = municipality.id;
            resolvedMunicipalityName = municipality.name;
            console.log('[askMunicipalPlanning] Municipality found:', { id: municipalityId, name: resolvedMunicipalityName });
          } else {
            console.warn('[askMunicipalPlanning] Municipality not found in database:', municipalityName);
            resolvedMunicipalityName = municipalityName;
          }
        } catch (error) {
          console.error('[askMunicipalPlanning] Failed to lookup municipality:', error);
          resolvedMunicipalityName = municipalityName;
        }
      }

      // If we still don't have a municipality, return error
      if (!municipalityId || !resolvedMunicipalityName) {
        return {
          error: {
            code: ToolErrorCode.INVALID_PARAMETERS,
            details: municipalityName 
              ? `Municipality "${municipalityName}" not found or does not have planning documents available.`
              : 'No municipality context available. Please specify a municipality name or provide a plot ID.',
          },
          suggestions: [
            { id: 'list_municipalities', action: 'List available municipalities with planning documents' },
            { id: 'provide_municipality', action: 'Specify municipality name explicitly' },
            { id: 'use_plot_context', action: 'Ask about a specific plot to get municipality context' },
          ],
        };
      }

      // Query the yonder-agent API with timeout and retry logic
      let ragResult: ZoningQueryResponse;
      try {
        console.log('[askMunicipalPlanning] Querying yonder-agent API:', {
          municipality_id: municipalityId,
          questionPreview: sanitizedQuestion.substring(0, 50),
        });
        
        ragResult = await retryWithBackoff(async () => {
          return await withTimeout(
            queryZoningInfo({
              query: sanitizedQuestion,
              municipality_id: municipalityId,
              plot_id: plotId,
            }),
            API_TIMEOUT_MS
          );
        });
        
        // Validate response schema
        const validationResult = ZoningResponseSchema.safeParse(ragResult);
        if (!validationResult.success) {
          console.error('[askMunicipalPlanning] Invalid API response:', validationResult.error);
          throw new Error(`Invalid API response format: ${validationResult.error.message}`);
        }
        
        console.log('[askMunicipalPlanning] Query successful:', {
          sourcesCount: ragResult.sources.length,
          searchMethod: ragResult.search_method,
          responseTime: ragResult.response_time,
          retrievalCalls: ragResult.retrieval_calls,
          agentSteps: ragResult.agent_steps,
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errorMessage.includes('timeout');
        const isRetryable = isRetryableError(error);
        
        console.error('[askMunicipalPlanning] API query failed:', {
          error: errorMessage,
          isTimeout,
          isRetryable,
          municipalityId,
          elapsedMs: Date.now() - startTime,
        });
        
        return {
          error: {
            code: isTimeout ? ToolErrorCode.RATE_LIMIT_EXCEEDED : ToolErrorCode.EXTERNAL_API_ERROR,
            details: isTimeout 
              ? `Request timed out after ${API_TIMEOUT_MS / 1000}s. The municipality documents may be large or the service is slow.`
              : `Failed to query yonder-agent API: ${errorMessage}`,
          },
          suggestions: isTimeout ? [
            { id: 'try_simpler', action: 'Try a simpler, more specific question' },
            { id: 'retry', action: 'Retry the query' },
            { id: 'check_service', action: 'Check if yonder-agent service is healthy' },
          ] : [
            { id: 'retry', action: 'Try rephrasing the question' },
            { id: 'check_municipality', action: 'Verify the municipality has planning documents' },
            { id: 'check_service', action: 'Verify yonder-agent API is accessible' },
          ],
        };
      }

      // Build successful response with validated data
      const totalElapsedMs = Date.now() - startTime;
      
      const agenticInfo = ragResult.retrieval_calls && ragResult.agent_steps
        ? ` The AI agent made ${ragResult.retrieval_calls} retrieval call(s) across ${ragResult.agent_steps} reasoning step(s).`
        : '';
      
      const result: MunicipalPlanningQAResult = {
        data: {
          municipalityId,
          municipalityName: ragResult.municipality || resolvedMunicipalityName,
          question: ragResult.question,
          answer: ragResult.answer,
          sources: ragResult.sources.map((source, idx) => ({
            id: `${municipalityId}-${source.chunk_index}-${idx}`,
            documentTitle: source.document_title,
            documentId: source.document_url,
            documentUrl: source.document_url,
            chunkIndex: source.chunk_index,
            similarity: source.similarity_score ?? 0,
            preview: '',  // yonder-agent doesn't return chunk text in query response
          })),
          metadata: {
            assistantMessage: `Retrieved official planning information for ${ragResult.municipality} using Agentic RAG v2.0. Answer based on ${ragResult.sources.length} relevant document section(s). API response: ${ragResult.response_time.toFixed(2)}s, total: ${(totalElapsedMs / 1000).toFixed(2)}s.${agenticInfo}`,
            hasDocuments: ragResult.sources.length > 0,
          },
        },
        suggestions: [
          { id: 'ask_followup', action: 'Ask follow-up questions about specific regulations' },
          { id: 'view_sources', action: 'Review source documents cited' },
          { id: 'compare_plot', action: 'Compare with specific plot requirements' },
          { id: 'generate_report', action: 'Generate comprehensive plot report with this information' },
        ],
      };
      
      console.log('[askMunicipalPlanning] Query completed successfully:', {
        totalElapsedMs,
        sourcesReturned: ragResult.sources.length,
      });

      return result;
    } catch (error) {
      // Catch-all for unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[askMunicipalPlanning] Unexpected error:', {
        error: errorMessage,
        stack: errorStack,
        municipalityName,
        plotId,
        elapsedMs: Date.now() - startTime,
      });
      
      const errorResult: MunicipalPlanningQAResult = {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: `Unexpected error: ${errorMessage}`,
        },
        suggestions: [
          { id: 'retry', action: 'Try again with different parameters' },
          { id: 'contact_support', action: 'Contact support if the issue persists' },
        ],
      };

      return errorResult;
    }
  },
});
