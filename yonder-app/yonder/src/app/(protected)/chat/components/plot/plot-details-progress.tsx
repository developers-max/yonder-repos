'use client';

import { Button } from '@/app/_components/ui/button';
import { TrendingUp, CheckCircle } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { authClient } from '@/lib/auth/auth-client';
import StepsContent from '../project/steps-content';
import ExpertStepsContent from './expert-steps-content';

interface PlotDetailsProgressProps {
  plotId: string;
}

export default function PlotDetailsProgress({ plotId }: PlotDetailsProgressProps) {
  // Get active organization
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const organizationId = activeOrganization?.id;

  // Get organization project data to check if plot is already selected
  const { data: projectData } = trpc.projects.getOrganizationProject.useQuery({ 
    organizationId: organizationId || ""
  }, {
    enabled: !!organizationId
  });

  // Get organization steps
  const { data: organizationSteps, isLoading: isStepsLoading } = trpc.processSteps.getOrganizationSteps.useQuery({
    organizationId: organizationId || ""
  }, {
    enabled: !!organizationId
  });

  // Get tRPC utils for cache invalidation
  const utils = trpc.useUtils();

  const selectPlotMutation = trpc.projects.updateSelectedPlot.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries to update UI immediately
      if (organizationId) {
        utils.projects.getOrganizationProject.invalidate({ organizationId });
        utils.projects.getOrganizationPlots.invalidate({ organizationId });
      }
    },
  });

  const isPlotAlreadySelected = projectData?.selectedPlotId === plotId;

  const handleSelectPlot = async () => {
    if (!organizationId) {
      console.error('No active organization selected');
      return;
    }

    try {
      await selectPlotMutation.mutateAsync({
        organizationId,
        plotId,
      });
    } catch (err) {
      console.error('Failed to select plot:', err);
    }
  };

  // Find current step (first pending or in_progress step)
  const currentStep = organizationSteps?.find(step => 
    step.status === 'pending' || step.status === 'in_progress'
  );
  
  // Find next step (step after current step)
  const currentStepIndex = organizationSteps?.findIndex(step => step.id === currentStep?.id) ?? -1;
  const nextStep = currentStepIndex !== -1 && currentStepIndex < (organizationSteps?.length ?? 0) - 1 
    ? organizationSteps?.[currentStepIndex + 1]
    : undefined;

  // Calculate progress
  const completedSteps = organizationSteps?.filter(step => step.status === 'completed').length ?? 0;
  const totalSteps = organizationSteps?.length ?? 0;
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Check if "unlock_next_steps" is completed
  const unlockNextStepsCompleted = organizationSteps?.some(step => 
    step.name === 'unlock_next_steps' && step.status === 'completed'
  ) ?? false;

  return (
    <div className="space-y-6">
      {/* Select Plot Section */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            {isPlotAlreadySelected ? (
              <>
                <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Plot Selected
                </h3>
                <p className="text-sm text-muted-foreground">
                  This plot is currently selected for your project. Ask me about next steps to acquire it.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-foreground mb-1">Select this plot</h3>
                <p className="text-sm text-muted-foreground">
                  Add this plot to your project to track progress and get next steps
                </p>
              </>
            )}
          </div>
          {!isPlotAlreadySelected && (
            <Button 
              onClick={handleSelectPlot}
              disabled={selectPlotMutation.isPending || !organizationId}
              className="ml-4"
            >
              {selectPlotMutation.isPending ? 'Selecting...' : 'Select Plot'}
            </Button>
          )}
        </div>
        {selectPlotMutation.isError && (
          <p className="text-sm text-destructive mt-2">
            Failed to select plot. Please try again.
          </p>
        )}
        {selectPlotMutation.isSuccess && (
          <p className="text-sm text-green-600 mt-2">
            ✓ Plot selected! Ask me about next steps to acquire this plot.
          </p>
        )}
        {!organizationId && (
          <p className="text-sm text-muted-foreground mt-2">
            Please select a project first.
          </p>
        )}
      </div>

      {/* Progress Tracking Content */}
      {isPlotAlreadySelected && organizationSteps && organizationSteps.length > 0 ? (
        unlockNextStepsCompleted ? (
          // Show expert steps when unlock_next_steps is completed
          <div className="bg-background rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Expert Acquisition Steps
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Professional guidance through the Portugal land acquisition process
              </p>
            </div>
            <div className="p-4">
              <ExpertStepsContent />
            </div>
          </div>
        ) : (
          // Show initial 5 steps before unlock
          <div className="bg-background rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Acquisition Progress
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Track your progress through the Portugal land acquisition process
              </p>
            </div>
            <div className="p-4">
              <StepsContent
                organizationSteps={organizationSteps}
                currentStep={currentStep}
                nextStep={nextStep}
                progressPercentage={progressPercentage}
                variant="inline"
                showFooter={true}
              />
            </div>
          </div>
        )
      ) : isPlotAlreadySelected && isStepsLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Loading progress tracking...</p>
        </div>
      ) : isPlotAlreadySelected ? (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No progress steps found. Contact support if this persists.</p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select this plot to track your acquisition progress</p>
        </div>
      )}
    </div>
  );
} 