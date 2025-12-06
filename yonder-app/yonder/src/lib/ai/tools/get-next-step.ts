import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext } from './tool-context';
import { appRouter } from '@/server/trpc';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Direct result type without intermediate interface
export type GetNextStepResult = ToolResult<{
  currentStep: {
    id: string;
    name: string;
    title: string;
    category: string;
    status: string;
    yonderPartner: boolean;
    yonderPartnerEmail?: string;
  };
  nextStep?: {
    id: string;
    name: string;
    title: string;
    category: string;
    description: string;
    estimatedDuration: string;
    requirements: string[];
  };
  metadata: {
    projectId: string;
    progressPercentage: number;
  };
}>;

// Tool for getting the next step in the acquisition process
export const getNextStepTool = tool({
  description: 'Get the next step in the property acquisition process for the current project. Use when users ask about next steps or what to do next.',
  parameters: z.object({
    projectContext: z.string().optional().describe('Optional context about the current project state')
  }),
  execute: async ({ }): Promise<GetNextStepResult> => {
    try {
      const globalContext = getToolContext();
      if (!globalContext || !globalContext.chatId) {
        return {
          error: {
            code: ToolErrorCode.AUTHENTICATION_REQUIRED,
            details: 'Get next step tool context not available - this tool must be called from authenticated chat route with chatId'
          },
          suggestions: [
            { id: 'refresh_chat', action: 'Refresh the chat session' },
            { id: 'log_in', action: 'Log in to your account' }
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

      // Get project data
      const projectData = await caller.projects.getProjectData({
        chatId: globalContext.chatId
      });

      if (!projectData) {
        return {
          error: {
            code: ToolErrorCode.RESOURCE_NOT_FOUND,
            details: 'No project found for this chat session'
          },
          suggestions: [
            { id: 'search_plots', action: 'Search for plots to start a project' },
            { id: 'initiate_outreach', action: 'Contact realtors about available plots' },
            { id: 'view_process', action: 'View the full acquisition process' }
          ]
        };
      }

      // Get organization steps
      const organizationSteps = await caller.processSteps.getOrganizationSteps({
        organizationId
      });

      // Find current step and next step
      const currentStep = organizationSteps.find(step => step.status === 'pending');
      const currentStepIndex = organizationSteps.findIndex(step => step.id === currentStep?.id);
      const nextStep = currentStepIndex !== -1 && currentStepIndex < organizationSteps.length - 1 
        ? organizationSteps[currentStepIndex + 1]
        : undefined;

      // Calculate progress
      const completedSteps = organizationSteps.filter(step => step.status === 'completed').length;
      const totalSteps = organizationSteps.length;
      const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      if (!currentStep) {
        return {
          error: {
            code: ToolErrorCode.RESOURCE_NOT_FOUND,
            details: 'No current step found for this project'
          },
          suggestions: [
            { id: 'search_plots', action: 'Search for more plots to refine your project' },
            { id: 'initiate_outreach', action: 'Contact realtors about available plots' },
            { id: 'view_process', action: 'View the full acquisition process' }
          ]
        };
      }

      return {
        data: {
          currentStep: {
            id: currentStep.id,
            name: currentStep.name,
            title: currentStep.title,
            category: currentStep.category,
            status: currentStep.status || 'unknown',
            yonderPartner: currentStep.yonderPartner || false,
            yonderPartnerEmail: currentStep.partnerEmail || undefined
          },
          nextStep: nextStep ? {
            id: nextStep.id,
            name: nextStep.name,
            title: nextStep.title,
            category: nextStep.category,
            description: nextStep.detailedDescription || '',
            estimatedDuration: nextStep.estimatedTime || 'Variable',
            requirements: nextStep.docsNeeded || []
          } : undefined,
          metadata: {
            projectId: projectData.id,
            progressPercentage
          }
        },
        suggestions: [
          { id: 'update_progress', action: 'Update progress on current step' },
          { id: 'get_step_details', action: 'Get detailed step information' },
          { id: 'show_progress', action: 'Show my current progress' },
          { id: 'summarize_process', action: 'Summarize the process' }
        ]
      };

    } catch (error) {
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'Failed to get next step information'
        },
        suggestions: [
          { id: 'retry', action: 'Try again' },
          { id: 'contact_support', action: 'Contact support' }
        ]
      };
    }
  }
});

 