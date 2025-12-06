import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext } from './tool-context';
import { appRouter } from '@/server/trpc';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Direct result type without intermediate interface
export type GetProjectProgressResult = ToolResult<{
  projectId: string;
  message: string;
  context: {
    projectStatus: string;
    milestone?: string;
    completedSteps: number;
    totalSteps: number;
    progressPercentage: number;
  };
}>;

export const getProjectProgressTool = tool({
  description: 'Get the current progress of the project including completed steps and milestones. Use when users ask about project status or progress.',
  parameters: z.object({
    projectContext: z.string().optional().describe('Optional context about what aspect of progress to focus on')
  }),
  execute: async ({ }): Promise<GetProjectProgressResult> => {
    try {
      const globalContext = getToolContext();
      if (!globalContext || !globalContext.chatId) {
        return {
          error: {
            code: ToolErrorCode.AUTHENTICATION_REQUIRED,
            details: 'Project progress tool context not available - this tool must be called from authenticated chat route with chatId'
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

      // Get organization project data
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
            { id: 'search_plots', action: 'Search for plots to start your project' },
            { id: 'view_process', action: 'View the acquisition process' }
          ]
        };
      }

      // Get organization steps
      const organizationSteps = await caller.processSteps.getOrganizationSteps({
        organizationId
      });

      // Calculate progress statistics
      const totalSteps = organizationSteps.length;
      const completedSteps = organizationSteps.filter(step => step.status === 'completed').length;
      const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      // Determine current milestone
      const currentStep = organizationSteps.find(step => step.status === 'in_progress') || 
                         organizationSteps.find(step => step.status === 'pending');

      const message = totalSteps > 0
        ? `Project progress: ${completedSteps} of ${totalSteps} steps completed (${progressPercentage}%)`
        : 'Project created. No progress steps set up yet.';

      return {
        data: {
          projectId: projectData.id,
          message,
          context: {
            projectStatus: projectData.status || 'active',
            milestone: currentStep?.title,
            completedSteps,
            totalSteps,
            progressPercentage
          }
        },
        suggestions: [
          { id: 'view_next_step', action: 'View next step' },
          { id: 'update_progress', action: 'Update progress' },
          { id: 'view_timeline', action: 'View project timeline' }
        ]
      };

    } catch (error) {
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'Failed to get project progress'
        },
        suggestions: [
          { id: 'retry', action: 'Try again' },
          { id: 'contact_support', action: 'Contact support' }
        ]
      };
    }
  }
});

 