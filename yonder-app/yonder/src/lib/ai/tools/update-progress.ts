import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext } from './tool-context';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Direct result type without intermediate interface
export type ProgressUpdateResult = ToolResult<{
  completedStep: {
    name: string;
    title: string;
    category: string;
  };
  nextStep?: {
    name: string;
    title: string;
    category: string;
  };
  metadata: {
    confidence: 'high' | 'medium' | 'low';
    evidence: string;
  };
}>;

// Note: Using shared tool context from ./tool-context.ts

export const updateProgressTool = tool({
  description: 'Update project progress when the user indicates they have completed an acquisition milestone. Use this when users mention completing specific steps like getting NIF, signing contracts, getting permits, etc.',
  // Note: Using .nullable() instead of .optional() for OpenAI strict schema compatibility
  parameters: z.object({
    completedStepName: z.string().describe('The name/identifier of the process step that was completed (e.g., "nif", "promissory", "permits")'),
    completedStepTitle: z.string().describe('The human-readable title of the completed step (e.g., "Get Portuguese tax number", "Sign CPCV contract")'),
    evidence: z.string().describe('What the user said that indicates completion (e.g., "I got my NIF number", "We signed the CPCV")'),
    confidence: z.enum(['high', 'medium', 'low']).describe('How confident you are that this step was actually completed based on user input'),
    nextStepName: z.string().nullable().describe('The name of the logical next step if there is one (e.g., "legalcheck" after "nif")'),
    nextStepTitle: z.string().nullable().describe('The title of the next step if specified')
  }),
  execute: async ({ 
    completedStepName, 
    completedStepTitle, 
    evidence, 
    confidence,
    nextStepName,
    nextStepTitle
  }): Promise<ProgressUpdateResult> => {
    try {
      const globalContext = getToolContext();
      if (!globalContext || !globalContext.chatId) {
        return {
          error: {
            code: ToolErrorCode.AUTHENTICATION_REQUIRED,
            details: 'Progress tool context not available - this tool must be called from authenticated chat route with chatId'
          },
          suggestions: [
            { id: 'refresh_chat', action: 'Refresh the chat session' },
            { id: 'try_again', action: 'Try again in a moment' }
          ]
        };
      }

      // Process step mapping for common steps
      const stepMapping: Record<string, { category: string; typical_next?: string }> = {
        'goals': { category: 'planning', typical_next: 'browse' },
        'browse': { category: 'search', typical_next: 'precheck' },
        'precheck': { category: 'legal', typical_next: 'nif' },
        'nif': { category: 'legal', typical_next: 'reserve' },
        'reserve': { category: 'contract', typical_next: 'legalcheck' },
        'legalcheck': { category: 'legal', typical_next: 'promissory' },
        'promissory': { category: 'contract', typical_next: 'pip' },
        'pip': { category: 'planning', typical_next: 'permits' },
        'permits': { category: 'construction', typical_next: 'build' },
        'build': { category: 'construction', typical_next: 'license' },
        'license': { category: 'construction', typical_next: 'ficha' },
        'ficha': { category: 'closing', typical_next: 'deed' },
        'deed': { category: 'closing' }
      };

      const completedStepInfo = stepMapping[completedStepName] || { category: 'unknown' };
      
      // Determine next step
      let nextStep: { name: string; title: string; category: string } | undefined;
      if (nextStepName && nextStepTitle) {
        const nextStepInfo = stepMapping[nextStepName] || { category: 'unknown' };
        nextStep = {
          name: nextStepName,
          title: nextStepTitle,
          category: nextStepInfo.category
        };
      } else if (completedStepInfo.typical_next) {
        // Auto-suggest typical next step
        const typicalNext = completedStepInfo.typical_next;
        const nextStepInfo = stepMapping[typicalNext] || { category: 'unknown' };
        nextStep = {
          name: typicalNext,
          title: getStepTitle(typicalNext),
          category: nextStepInfo.category
        };
      }

      // Generate suggestions based on the step
      const suggestions = generateSuggestions(completedStepName);

      return {
        data: {
          completedStep: {
            name: completedStepName,
            title: completedStepTitle,
            category: completedStepInfo.category
          },
          nextStep,
          metadata: {
            confidence,
            evidence
          }
        },
        suggestions: suggestions.map((suggestion, index) => ({ 
          id: `suggestion_${index}`, 
          action: suggestion 
        }))
      };

    } catch (error) {
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'Failed to process progress update'
        },
        suggestions: [
          { id: 'show_progress', action: 'Show my current progress' },
          { id: 'get_next_step', action: 'Get next step details' },
          { id: 'view_process', action: 'View the full acquisition process' }
        ]
      };
    }
  }
});

// Helper function to get step titles
function getStepTitle(stepName: string): string {
  const titles: Record<string, string> = {
    'goals': 'Define budget & criteria',
    'browse': 'Use Yonder to find listings',
    'precheck': 'Yonder legal preliminary checks',
    'nif': 'Get Portuguese tax number',
    'reserve': 'Make offer & reservation',
    'legalcheck': 'Full due diligence',
    'promissory': 'Sign CPCV contract',
    'pip': 'Planning permission request',
    'permits': 'Construction permits',
    'build': 'Construction/renovation',
    'license': 'Habitation certificate',
    'ficha': 'Technical housing sheet',
    'deed': 'Final ownership transfer'
  };
  return titles[stepName] || stepName;
}

// Helper function to generate contextual suggestions
function generateSuggestions(completedStep: string): string[] {
  const suggestions: Record<string, string[]> = {
    'nif': [
      'Show my current progress',
      'Get next step details',
      'Contact realtors about making offers'
    ],
    'reserve': [
      'Show my current progress', 
      'Get next step details',
      'Learn about legal due diligence'
    ],
    'legalcheck': [
      'Show my current progress',
      'Get next step details', 
      'Learn about CPCV contracts'
    ],
    'promissory': [
      'Show my current progress',
      'Get next step details',
      'Learn about planning permissions'
    ],
    'permits': [
      'Show my current progress',
      'Get next step details',
      'Get construction guidance'
    ],
    'build': [
      'Show my current progress',
      'Get next step details',
      'Learn about final inspections'
    ],
    'deed': [
      'Show my current progress',
      'View the full acquisition process',
      'Search for more properties'
    ]
  };

  return suggestions[completedStep] || [
    'Show my current progress',
    'Get next step details',
    'View the full acquisition process'
  ];
} 