'use client';

import { useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertCircle, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import { Badge } from '@/app/_components/ui/badge';
import { trpc } from '@/trpc/client';
import type { ProgressUpdateResult } from '@/lib/ai/tools/update-progress';

export function ProgressUpdated({ result, chatId }: { result: ProgressUpdateResult; chatId?: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const utils = trpc.useUtils();

  // Get project data to know which project to update
  const { data: projectData } = trpc.projects.getProjectData.useQuery({ 
    chatId: chatId || '' 
  }, { 
    enabled: !!chatId 
  });

  // Get all process steps to look up the actual step ID by name
  const { data: processSteps } = trpc.processSteps.getProcessSteps.useQuery();

  // Mutations for updating progress
  const updateStepMutation = trpc.processSteps.updateOrganizationStepStatus.useMutation({
    onSuccess: () => {
      // Invalidate project queries to refresh
      if (chatId) {
        utils.projects.getProjectData.invalidate({ chatId });
        utils.processSteps.getOrganizationSteps.invalidate({ organizationId: projectData?.id || '' });
      }
    }
  });

  const updateProjectStageMutation = trpc.projects.updateProjectStatus.useMutation({
    onSuccess: () => {
      // Invalidate project queries to refresh
      if (chatId) {
        utils.projects.getProjectData.invalidate({ chatId });
      }
    }
  });

  const handleConfirmProgress = useCallback(async () => {
    if (!projectData || !processSteps || !result.data) return;

    setIsConfirming(true);
    setConfirmError(null);

    try {
      // Find the actual process step by name
      const completedProcessStep = processSteps.find(step => step.name === result.data?.completedStep.name);
      if (!completedProcessStep) {
        throw new Error(`Process step "${result.data?.completedStep.name}" not found`);
      }

      // Mark the completed step as completed
      await updateStepMutation.mutateAsync({
        organizationId: projectData.id,
        processStepId: completedProcessStep.id,
        status: 'completed'
      });

      // If there's a next step, update project's current stage
      if (result.data?.nextStep) {
        const nextProcessStep = processSteps.find(step => step.name === result.data?.nextStep?.name);
        if (nextProcessStep) {
          await updateProjectStageMutation.mutateAsync({
            organizationId: projectData.id,
            currentStage: nextProcessStep.id
          });
        }
      }

      setIsConfirmed(true);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : 'Failed to update progress');
    } finally {
      setIsConfirming(false);
    }
  }, [projectData, processSteps, result, updateStepMutation, updateProjectStageMutation]);

  // Auto-trigger progress confirmation
  useEffect(() => {
    if (result.data && 
        !autoTriggered && 
        !isConfirming && 
        !isConfirmed &&
        projectData && 
        processSteps) {
      setAutoTriggered(true);
      handleConfirmProgress();
    }
  }, [result, autoTriggered, isConfirming, isConfirmed, projectData, processSteps, handleConfirmProgress]);

  const isError = !!result.error;

  // Error state
  if (isError) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Progress Update Error</h3>
              <p className="text-xs text-gray-500 mt-0.5">{String(result.error?.details || 'Unknown error')}</p>
            </div>
          </div>
          
          {result.suggestions.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Suggestions:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                    {suggestion.action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!result.data) {
    return null;
  }

  // Success state with confirmation UI
  if (isConfirmed) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Progress Updated Successfully</h3>
              <p className="text-xs text-gray-500 mt-0.5">Your project has been updated</p>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-2">
              Your progress has been updated. {result.data.completedStep.title} is now marked as completed.
            </p>
            {result.data.nextStep && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">Next step:</span> {result.data.nextStep.title}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error during confirmation
  if (confirmError) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Confirmation Failed</h3>
              <p className="text-xs text-gray-500 mt-0.5">{confirmError}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Button 
              onClick={handleConfirmProgress}
              size="sm"
              disabled={isConfirming}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Try Again'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main progress update component
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConfirming ? 'bg-yellow-100' : 'bg-blue-100'}`}>
            {isConfirming ? (
              <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
            ) : (
              <TrendingUp className="w-4 h-4 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {isConfirming ? 'Updating Progress...' : 'Progress Detected'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Step completion detected</p>
          </div>
        </div>
        
        {/* Step progression */}
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className="text-xs bg-green-100 text-green-700 border-green-200"
            >
              {result.data.completedStep.title}
            </Badge>
            {result.data.nextStep && (
              <>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                  {result.data.nextStep.title}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Confirmation button */}
        <div className="flex items-center justify-between">
          {!isConfirming && (
            <Button 
              onClick={handleConfirmProgress}
              size="sm"
              variant="outline"
              disabled={!projectData || !processSteps}
            >
              Confirm Progress
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 