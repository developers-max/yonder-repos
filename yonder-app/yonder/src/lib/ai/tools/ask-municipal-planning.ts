import { tool } from 'ai';
import { z } from 'zod';
import { ToolResult, ToolErrorCode } from './types';
import { queryPdmAnalyzer, type PDMAnalyzerResponse } from '@/lib/utils/remote-clients/yonder-agent-client';
import { db } from '@/lib/db';
import { municipalities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Zod schema for validating PDM Analyzer API responses
const PDMAnalyzerResponseSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty'),
  municipality: z.string(),
  municipality_id: z.number(),
  country: z.string(),
  query: z.string(),
  action: z.string(),
  citations: z.array(z.object({
    section: z.string().optional(),
    article: z.string().optional(),
    text: z.string().optional(),
    page: z.number().optional(),
    relevance: z.number().optional(),
  })),
  confidence: z.number().min(0).max(1).nullable().optional(),
  cached: z.boolean(),
  response_time: z.number().positive(),
  metadata: z.object({
    output_language: z.string().optional().nullable(),
    chunks_processed: z.number().optional().nullable(),
    zone_codes_found: z.array(z.string()).optional().nullable(),
  }).nullable().optional(),
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
 * Queries PDM (Plano Diretor Municipal) documents for specific municipalities
 */
export const askMunicipalPlanningTool = tool({
  description: `Ask questions about building, zoning, planning regulations, and urban development for a specific municipality.
  Uses the PDM Analyzer API to query official PDM (Plano Diretor Municipal) documents.
  
  Use this when you need to query the regulation document about:
  - Specific zone rules and regulations (e.g., "What are the building rules for zone UE1?")
  - Building height or density restrictions for a zone
  - Land use permissions and requirements
  - Construction permits and regulations
  - Protected areas or heritage restrictions
  - Zone codes and their meanings
  - PDM summary or general regulations
  
  **CRITICAL - QUERY FORMAT**:
  The query parameter must be a GENERAL QUESTION about zoning/regulations. 
  ❌ DO NOT include: cadastral references, parcel IDs, plot IDs, coordinates, or property-specific identifiers
  ✅ DO include: zone codes (e.g., "UE1", "URB"), general regulation questions, building rule inquiries
  
  Good examples:
  - "What are the building rules for zone UE1?"
  - "What is the maximum building height in residential zones?"
  - "Summarize the main PDM regulations for this municipality"
  - "What land uses are permitted in urban expansion areas?"
  
  Bad examples (DO NOT USE):
  - "What are the rules for parcel AAA000330134?" ❌
  - "Tell me about plot 82894e30-f4b7..." ❌
  
  **HOW TO GET PARAMETERS**:
  When a plot is in context, FIRST call getPlotDetails to get the plot information, then use:
  - municipalityId: Use municipality.databaseId from getPlotDetails response (e.g., if response shows municipality: {databaseId: 54, name: "Faro"}, use municipalityId: 54). WARNING: Do NOT use CAOP/INE codes from enrichmentData - only use the databaseId field!
  - country: Use municipality.country from getPlotDetails (e.g., 'PT' for Portugal, 'ES' for Spain)
  - query: A GENERAL question about zoning/regulations (see examples above)
  
  Supports Portuguese and Spanish municipalities with processed PDM documents.`,
  
  parameters: z.object({
    municipalityId: z.number().describe('The municipality database ID to query regulations for'),
    country: z.enum(['PT', 'ES']).describe('Country code: PT for Portugal, ES for Spain'),
    query: z.string().describe('Specific question about the regulation document (e.g., "What are the rules for zone UE1?", "Maximum building height in residential areas")'),
  }),
  
  execute: async ({ municipalityId, country, query }): Promise<MunicipalPlanningQAResult> => {
    const startTime = Date.now();
    
    // Input validation and sanitization
    const sanitizedQuestion = query.trim();
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
      // Map country codes to full names for API
      const countryCodeToName: Record<string, string> = {
        'PT': 'Portugal',
        'ES': 'Spain',
      };
      const resolvedCountry = countryCodeToName[country] || 'Portugal';

      console.log('[askMunicipalPlanning] Starting query:', {
        questionLength: sanitizedQuestion.length,
        municipalityId,
        country,
        resolvedCountry,
        timestamp: new Date().toISOString(),
      });

      // Lookup municipality by ID to get name
      const municipality = await db.query.municipalities.findFirst({
        where: eq(municipalities.id, municipalityId),
      });

      if (!municipality) {
        return {
          error: {
            code: ToolErrorCode.INVALID_PARAMETERS,
            details: `Municipality with ID ${municipalityId} not found.`,
          },
          suggestions: [
            { id: 'check_municipality_id', action: 'Verify the municipality ID is correct' },
            { id: 'list_municipalities', action: 'List available municipalities with planning documents' },
          ],
        };
      }

      const resolvedMunicipalityName = municipality.name;

      // Query the PDM Analyzer API with timeout and retry logic
      let pdmResult: PDMAnalyzerResponse;
      try {
        console.log('[askMunicipalPlanning] Querying PDM Analyzer API:', {
          municipality_id: municipalityId,
          municipality_name: resolvedMunicipalityName,
          country: resolvedCountry,
          questionPreview: sanitizedQuestion.substring(0, 50),
        });
        
        pdmResult = await retryWithBackoff(async () => {
          return await withTimeout(
            queryPdmAnalyzer({
              query: sanitizedQuestion,
              municipality_id: municipalityId,
              municipality: resolvedMunicipalityName || undefined,
              country: resolvedCountry,
              action: 'query',
              output_language: 'auto',
            }),
            API_TIMEOUT_MS
          );
        });
        
        // Validate response schema
        const validationResult = PDMAnalyzerResponseSchema.safeParse(pdmResult);
        if (!validationResult.success) {
          console.error('[askMunicipalPlanning] Invalid API response:', validationResult.error);
          throw new Error(`Invalid API response format: ${validationResult.error.message}`);
        }
        
        console.log('[askMunicipalPlanning] Query successful:', {
          citationsCount: pdmResult.citations.length,
          action: pdmResult.action,
          responseTime: pdmResult.response_time,
          cached: pdmResult.cached,
          confidence: pdmResult.confidence,
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
      
      const confidenceInfo = pdmResult.confidence != null
        ? ` Confidence: ${(pdmResult.confidence * 100).toFixed(0)}%.`
        : '';
      
      const cachedInfo = pdmResult.cached ? ' (cached)' : '';
      
      const result: MunicipalPlanningQAResult = {
        data: {
          municipalityId: pdmResult.municipality_id,
          municipalityName: pdmResult.municipality || resolvedMunicipalityName,
          question: pdmResult.query,
          answer: pdmResult.answer,
          sources: pdmResult.citations.map((citation, idx) => ({
            id: `${pdmResult.municipality_id}-citation-${idx}`,
            documentTitle: citation.section || citation.article || 'PDM Document',
            documentId: `${pdmResult.municipality_id}-${idx}`,
            documentUrl: '',
            chunkIndex: citation.page || idx,
            similarity: citation.relevance ?? 0,
            preview: citation.text || '',
          })),
          metadata: {
            assistantMessage: `Retrieved official PDM planning information for ${pdmResult.municipality} (${pdmResult.country}). Answer based on ${pdmResult.citations.length} citation(s). API response: ${pdmResult.response_time.toFixed(2)}s${cachedInfo}, total: ${(totalElapsedMs / 1000).toFixed(2)}s.${confidenceInfo}`,
            hasDocuments: pdmResult.citations.length > 0,
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
        citationsReturned: pdmResult.citations.length,
      });

      return result;
    } catch (error) {
      // Catch-all for unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[askMunicipalPlanning] Unexpected error:', {
        error: errorMessage,
        stack: errorStack,
        municipalityId,
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
