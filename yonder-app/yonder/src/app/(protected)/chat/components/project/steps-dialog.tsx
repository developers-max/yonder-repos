'use client';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/app/_components/ui/dialog';
import { type AppRouter } from '@/server/trpc';
import { type inferRouterOutputs } from '@trpc/server';
import StepsContent from './steps-content';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OrganizationStep = RouterOutputs['processSteps']['getOrganizationSteps'][0];

interface StepsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSteps: OrganizationStep[];
  currentStep?: OrganizationStep;
  nextStep?: OrganizationStep;
  progressPercentage: number;
}

export default function StepsDialog({ 
  isOpen, 
  onOpenChange, 
  organizationSteps, 
  currentStep, 
  nextStep, 
  progressPercentage 
}: StepsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-4 md:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base md:text-xl">Acquisition Process</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Track your progress through the Portugal land acquisition process
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto relative">
          <StepsContent
            organizationSteps={organizationSteps}
            currentStep={currentStep}
            nextStep={nextStep}
            progressPercentage={progressPercentage}
            variant="dialog"
            showFooter={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 