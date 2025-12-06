import { tool } from 'ai';
import { z } from 'zod';
import { appRouter } from '@/server/trpc';
import type { EnrichmentData } from '@/server/trpc/router/plot/plots';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Input schema for generate report tool
const generateReportSchema = z.object({
  plotId: z.string().uuid().describe('The UUID of the plot to generate a report for'),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// Result type
export type GenerateReportResult = ToolResult<{
  plotId: string;
  reportGenerated: boolean;
  quickFacts: {
    price: string;
    size: string;
    location: string;
    zoning: string;
    municipality: string;
  };
  reportSummary: string;
  metadata: {
    assistantMessage: string;
  };
}>;

/**
 * Chat tool for generating property reports
 * Generates a comprehensive AI-powered property report for a specific plot
 */
export const generateReportTool = tool({
  description: `Generate a comprehensive property report for a land plot. 
  
This tool creates a detailed AI-powered report including:
- Property overview (location, size, price)
- Complete cadastral information
- Location analysis with nearby amenities
- Zoning and legal information
- Investment considerations
- Recommendations

Use this when the user asks to generate a report, create documentation, or get detailed information about a specific plot.

Example queries:
- "Generate a report for plot [ID]"
- "Create a property report"
- "I need detailed information about this plot"
- "Can you make a report for the selected plot?"`,

  parameters: generateReportSchema,

  execute: async ({ plotId }: GenerateReportInput): Promise<GenerateReportResult> => {
    try {
      // Fetch plot data to show quick facts
      const caller = appRouter.createCaller({
        session: null,
        user: undefined,
      });
      
      const plot = await caller.plots.getPlot({ id: plotId });
      
      // Extract key information
      const enrichmentData = plot.enrichmentData as EnrichmentData | null;
      const zoningData = enrichmentData?.zoning;
      const cadastralData = enrichmentData?.cadastral;
      
      // Build quick facts
      const lat = Number(plot.latitude);
      const lng = Number(plot.longitude);
      
      const quickFacts = {
        price: `€${plot.price.toLocaleString()}`,
        size: plot.size ? `${plot.size.toLocaleString()}m²` : 'Not available',
        location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        zoning: zoningData?.label || zoningData?.label_en || 'Not available',
        municipality: plot.municipality?.name || cadastralData?.municipality || 'Not available',
      };
      
      // Build report summary
      const reportSections = [
        'Executive Summary',
        'Location Overview',
        'Legal & Cadastral Information',
        'Physical & Environmental Characteristics',
        'Access & Infrastructure',
        'Surrounding Amenities',
        'Risks & Constraints',
        'Development & Investment Potential',
        'Data Sources & References'
      ];
      
      const municipalityName = plot.municipality?.name || cadastralData?.municipality;
      
      const reportSummary = `The comprehensive report will include:\n\n${reportSections.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nThe report generation process includes:\n• Database information retrieval\n• Municipal planning document analysis${municipalityName ? ` for ${municipalityName}` : ''}\n• Web search for additional context\n• AI-powered gap analysis\n• Enhanced report with filled information gaps\n\nThis typically takes 60-120 seconds.`;
      
      // The actual report generation happens on the frontend when the button is clicked
      // This tool just provides the UI and context
      return {
        data: {
          plotId,
          reportGenerated: false,
          quickFacts,
          reportSummary,
          metadata: {
            assistantMessage: `I've prepared the report generation for plot ${plotId.slice(0, 8)}. Here are the quick facts while you wait. Click the button below to start generating the comprehensive PDF report. The generation will take about 60-120 seconds and includes database retrieval, RAG queries, web search enrichment, and gap analysis.`
          }
        },
        suggestions: [
          { id: 'view_details', action: 'View detailed plot information' },
          { id: 'discuss_zoning', action: 'Discuss zoning regulations' },
        ]
      };
    } catch (error) {
      console.error('Error in generateReportTool:', error);
      
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'An unexpected error occurred while preparing the report.',
        },
        suggestions: [
          { id: 'retry', action: 'Try again' }
        ]
      };
    }
  },
});
