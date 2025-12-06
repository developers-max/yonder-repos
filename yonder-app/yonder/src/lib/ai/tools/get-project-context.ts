import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext } from './tool-context';
import { appRouter } from '@/server/trpc';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Direct result type without intermediate interface
export type GetProjectContextResult = ToolResult<{
  projectId: string;
  chatId: string;
  selectedPlotId?: string;
  currentStage?: string;
  computedStage?: string;
  searchFilters: Record<string, unknown>;
  status: string;
  metadata: {
    hasSelectedPlot: boolean;
    hasActiveProject: boolean;
    currentStageTitle?: string;
  };
}>;

export const getProjectContextTool = tool({
  description: 'Get the current project context including selected plot, current stage, and search filters. Use when you need to understand the current project state.',
  parameters: z.object({
    includeDetails: z.boolean().optional().default(false).describe('Whether to include detailed project information')
  }),
  execute: async ({ }): Promise<GetProjectContextResult> => {
    try {
      const globalContext = getToolContext();
      if (!globalContext || !globalContext.chatId) {
        return {
          error: {
            code: ToolErrorCode.AUTHENTICATION_REQUIRED,
            details: 'Project context tool context not available - this tool must be called from authenticated chat route with chatId'
          },
          suggestions: [
            { id: 'refresh_chat', action: 'Refresh the chat session' },
            { id: 'try_again', action: 'Try again in a moment' }
          ]
        };
      }

      // Create a tRPC caller with the user session
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

      // Get organization project
      const projectData = await caller.projects.getOrganizationProject({
        organizationId
      });

      if (!projectData) {
        return {
          error: {
            code: ToolErrorCode.RESOURCE_NOT_FOUND,
            details: 'No project found for this organization'
          },
          suggestions: [
            { id: 'refresh_chat', action: 'Refresh the chat session' },
            { id: 'contact_support', action: 'Contact support' }
          ]
        };
      }

      // Get current stage details if available
      let currentStageTitle: string | undefined;
      if (projectData.currentStage) {
        // Get all process steps and find the current one
        try {
          const allSteps = await caller.processSteps.getProcessSteps();
          const currentStageDetails = allSteps.find(step => step.id === projectData.currentStage);
          currentStageTitle = currentStageDetails?.title;
        } catch (error) {
          console.log('Could not fetch stage details:', error);
        }
      }

      return {
        data: {
          projectId: projectData.id,
          chatId: globalContext.chatId,
          selectedPlotId: projectData.selectedPlotId || undefined,
          currentStage: projectData.currentStage || undefined,
          computedStage: (projectData as { computedStage?: string } | null)?.computedStage || undefined,
          searchFilters: projectData.searchFilters as Record<string, unknown>,
          status: projectData.status || 'active',
          metadata: {
            hasSelectedPlot: !!projectData.selectedPlotId,
            hasActiveProject: true,
            currentStageTitle
          }
        },
        suggestions: [
          { id: 'view_project_progress', action: 'View project progress' },
          { id: 'get_next_step', action: 'Get next step' },
          { id: 'view_selected_plot', action: 'View selected plot details' }
        ]
      };

    } catch (error) {
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'Failed to get project context'
        },
        suggestions: [
          { id: 'retry', action: 'Try again' },
          { id: 'contact_support', action: 'Contact support' }
        ]
      };
    }
  }
}); 