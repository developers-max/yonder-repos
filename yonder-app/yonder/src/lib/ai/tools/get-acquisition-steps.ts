import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext } from './tool-context';
import { appRouter } from '@/server/trpc';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Direct result type without intermediate interface
export type GetAcquisitionStepsResult = ToolResult<{
  steps: Array<{
    id: string;
    name: string;
    title: string;
    category: string;
    description: string;
    estimatedTime: string;
    isRequired: boolean;
    orderIndex: number;
  }>;
  totalSteps: number;
  categories: string[];
}>;

export const getAcquisitionStepsTool = tool({
  description: 'Get all acquisition steps in the Portugal land purchase process. Use when users want to understand the complete acquisition workflow.',
  parameters: z.object({
    category: z.string().optional().describe('Optional category filter (e.g., "legal", "planning", "construction")')
  }),
  execute: async ({ category }): Promise<GetAcquisitionStepsResult> => {
    try {
      const globalContext = getToolContext();
      if (!globalContext || !globalContext.chatId) {
        return {
          error: {
            code: ToolErrorCode.AUTHENTICATION_REQUIRED,
            details: 'Acquisition steps tool context not available - this tool must be called from authenticated chat route with chatId'
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

      // Get all process steps
      const processSteps = await caller.processSteps.getProcessSteps();

      // Filter by category if specified
      const filteredSteps = category 
        ? processSteps.filter(step => step.category === category)
        : processSteps;

      // Transform to the expected format
      const steps = filteredSteps.map(step => ({
        id: step.id,
        name: step.name,
        title: step.title,
        category: step.category,
        description: step.detailedDescription,
        estimatedTime: step.estimatedTime,
        isRequired: step.isRequired,
        orderIndex: step.orderIndex
      }));

      // Get unique categories
      const categories = [...new Set(processSteps.map(step => step.category))];

      return {
        data: {
          steps,
          totalSteps: steps.length,
          categories
        },
        suggestions: [
          { id: 'view_next_step', action: 'View next step for your project' },
          { id: 'view_progress', action: 'View progress of your project' }
        ]
      };

    } catch (error) {
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'Failed to get acquisition steps'
        },
        suggestions: [
          { id: 'retry', action: 'Try again' },
          { id: 'contact_support', action: 'Contact support' }
        ]
      };
    }
  }
}); 