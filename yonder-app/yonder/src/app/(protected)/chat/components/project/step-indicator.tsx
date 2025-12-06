'use client';

import { useState } from 'react';
import { CheckCircle, Clock, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import { trpc } from '@/trpc/client';
import { authClient } from '@/lib/auth/auth-client';
import StepsDialog from './steps-dialog';

interface StepIndicatorProps {
  className?: string;
}

export default function StepIndicator({ className }: StepIndicatorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get active organization
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const organizationId = activeOrganization?.id;

  // Get organization steps
  const { data: organizationSteps, isLoading: isStepsLoading } = trpc.processSteps.getOrganizationSteps.useQuery({
    organizationId: organizationId || ""
  }, {
    enabled: !!organizationId
  });

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

  // Don't show anything while loading - wait for real data
  if (!organizationId || isStepsLoading) {
    return (
      <div className="relative inline-flex">
        <Button
          variant="outline"
          disabled
          className={`justify-between h-9 px-2 ${className}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 animate-pulse" />
            <span className="text-xs">...</span>
          </div>
        </Button>
      </div>
    );
  }

  // If no steps exist, show a message
  if (!organizationSteps || organizationSteps.length === 0) {
    return (
      <div className="relative inline-flex">
        <Button
          variant="outline"
          disabled
          className={`justify-between h-9 px-2 ${className}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">0%</span>
          </div>
        </Button>
      </div>
    );
  }

  // Now render the actual 13-step progress UI
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsDialogOpen(true)}
        className={`justify-between h-9 px-2 gap-1 ${className}`}
      >
        <div className="flex items-center gap-1 min-w-0">
          {currentStep ? (
            <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : completedSteps === totalSteps ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-xs font-medium">{progressPercentage}%</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </div>
      </Button>

      <StepsDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        organizationSteps={organizationSteps}
        currentStep={currentStep}
        nextStep={nextStep}
        progressPercentage={progressPercentage}
      />
    </>
  );
} 