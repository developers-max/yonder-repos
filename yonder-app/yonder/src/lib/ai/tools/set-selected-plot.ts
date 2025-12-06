import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext } from './tool-context';
import { appRouter } from '@/server/trpc';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Direct result type without intermediate interface
export type SetSelectedPlotResult = ToolResult<{
  plotId: string;
  projectId: string;
  message: string;
  metadata: {
    plotId: string;
    projectId: string;
  };
}>;

// Tool for setting a selected plot for a project
export const setSelectedPlotTool = tool({
  description: 'Set the selected plot for the current project. Use when users indicate they want to focus on a specific plot or "select" a plot.',
  parameters: z.object({
    plotId: z.string().describe('The unique identifier of the plot to select')
  }),
  execute: async ({ plotId }): Promise<SetSelectedPlotResult> => {
    try {
      const globalContext = getToolContext();
      if (!globalContext || !globalContext.chatId) {
        return {
          error: {
            code: ToolErrorCode.AUTHENTICATION_REQUIRED,
            details: 'Set selected plot tool context not available - this tool must be called from authenticated chat route with chatId'
          },
          suggestions: [
            { id: 'refresh_chat', action: 'Refresh the chat session' },
            { id: 'try_again', action: 'Try again in a moment' }
          ]
        };
      }

      // Create a tRPC caller with the user session (for authenticated calls)
      const caller = appRouter.createCaller({
        session: globalContext.session,
        user: globalContext.user,
      });

      // Get organization ID - try from context first, then from chat
      let organizationId = globalContext.organizationId;
      
      if (!organizationId) {
        // Get organization from chat
        const chat = await caller.chat.getChat({ chatId: globalContext.chatId });
        organizationId = chat.organization?.id;
      }

      if (!organizationId) {
        return {
          error: {
            code: ToolErrorCode.RESOURCE_NOT_FOUND,
            details: 'No organization found for this chat session'
          },
          suggestions: [
            { id: 'refresh_chat', action: 'Refresh the chat session' },
            { id: 'contact_support', action: 'Contact support' }
          ]
        };
      }

      // Set the selected plot for the organization's project
      const result = await caller.projects.selectPlotForOrganization({
        organizationId,
        plotId: plotId
      });

      return {
        data: {
          plotId,
          projectId: result.id,
          message: `Successfully selected plot ${plotId} for your project. This plot is now your primary focus.`,
          metadata: {
            plotId,
            projectId: result.id
          }
        },
        suggestions: [
          { id: 'get_plot_details', action: 'Get detailed plot information' },
          { id: 'analyze_pricing', action: 'Analyze pricing and market value' },
          { id: 'review_amenities', action: 'Review nearby amenities' },
          { id: 'acquisition_steps', action: 'Show acquisition steps' }
        ]
      };

    } catch (error) {
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'Failed to set selected plot'
        },
        suggestions: [
          { id: 'retry', action: 'Try again' },
          { id: 'contact_support', action: 'Contact support' }
        ]
      };
    }
  }
}); 