'use client';

import { CheckCircle, Clock, Circle, Mail, ArrowRight } from 'lucide-react';
import { Badge } from '@/app/_components/ui/badge';
import { Button } from '@/app/_components/ui/button';
import { Separator } from '@/app/_components/ui/separator';
import { type AppRouter } from '@/server/trpc';
import { type inferRouterOutputs } from '@trpc/server';
import { trpc } from '@/trpc/client';
import { authClient } from '@/lib/auth/auth-client';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OrganizationStep = RouterOutputs['processSteps']['getOrganizationSteps'][0];

interface StepsContentProps {
  organizationSteps: OrganizationStep[];
  currentStep?: OrganizationStep;
  nextStep?: OrganizationStep;
  progressPercentage: number;
  variant?: 'dialog' | 'inline';
  showFooter?: boolean;
  className?: string;
}

export default function StepsContent({ 
  organizationSteps, 
  currentStep, 
  nextStep, 
  progressPercentage,
  variant = 'inline',
  showFooter = false,
  className = ''
}: StepsContentProps) {
  // Get active organization
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const organizationId = activeOrganization?.id;

  // Get utils for invalidating queries
  const utils = trpc.useUtils();

  // Mutation to update step status
  const updateStepMutation = trpc.processSteps.updateOrganizationStepStatus.useMutation({
    onSuccess: () => {
      // Invalidate and refetch organization steps
      utils.processSteps.getOrganizationSteps.invalidate();
    }
  });

  const handleMarkComplete = async () => {
    if (!currentStep || !organizationId) return;

    try {
      await updateStepMutation.mutateAsync({
        organizationId,
        processStepId: currentStep.processStepId,
        status: 'completed'
      });
    } catch (error) {
      console.error('Failed to mark step as complete:', error);
    }
  };

  const getStepIcon = (step: OrganizationStep) => {
    if (step.status === 'completed') {
      return <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-500" />;
    } else if (step.id === currentStep?.id) {
      return <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />;
    } else {
      return <Circle className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />;
    }
  };

  const getStepStatus = (step: OrganizationStep) => {
    if (step.status === 'completed') {
      return <Badge variant="default" className="bg-green-100 text-green-800 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">Completed</Badge>;
    } else if (step.id === currentStep?.id) {
      return <Badge variant="default" className="bg-blue-100 text-blue-800 text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">Current</Badge>;
    } else if (step.id === nextStep?.id) {
      return <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">Next</Badge>;
    } else {
      return <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5">Pending</Badge>;
    }
  };

  // Group steps by category
  const stepsByCategory = organizationSteps.reduce((acc, step) => {
    if (!acc[step.category]) {
      acc[step.category] = [];
    }
    acc[step.category].push(step);
    return acc;
  }, {} as Record<string, OrganizationStep[]>);

  // Sort categories by the earliest step order in each category
  const sortedCategories = Object.keys(stepsByCategory).sort((a, b) => {
    const aMinOrder = Math.min(...stepsByCategory[a].map(s => s.orderIndex));
    const bMinOrder = Math.min(...stepsByCategory[b].map(s => s.orderIndex));
    return aMinOrder - bMinOrder;
  });

  const completedSteps = organizationSteps.filter(step => step.status === 'completed').length;
  const totalSteps = organizationSteps.length;

  return (
    <div className={`space-y-3 md:space-y-4 ${className}`}>
      {/* Main Steps Content */}
      <div className={variant === 'dialog' ? 'space-y-3 md:space-y-4 pb-2' : 'space-y-3 md:space-y-4'}>
        {sortedCategories.map((category, categoryIndex) => {
          const categorySteps = stepsByCategory[category].sort((a, b) => a.orderIndex - b.orderIndex);
          
          return (
            <div key={category} className="space-y-1.5 md:space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm md:text-base text-foreground capitalize">
                  {category.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <Badge variant="outline" className="text-[10px] md:text-xs">
                  {categorySteps.filter(s => s.status === 'completed').length}/{categorySteps.length}
                </Badge>
              </div>
              
              <div className="space-y-1.5 md:space-y-2 pl-2 md:pl-4">
                {categorySteps.map((step, stepIndex) => (
                  <div key={step.id} className="flex gap-2 md:gap-4">
                    <div className="flex flex-col items-center">
                      <div className="mt-0.5 md:mt-1">
                        {getStepIcon(step)}
                      </div>
                      {stepIndex < categorySteps.length - 1 && (
                        <div className="w-px h-6 md:h-8 bg-border mt-1 md:mt-2" />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1 md:space-y-2 pb-1 md:pb-2">
                      <div className="flex items-start justify-between gap-2 md:gap-4">
                        <div className="space-y-0.5 md:space-y-1">
                          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                            <h4 className="font-medium text-xs md:text-sm text-foreground">
                              <span className="text-[10px] md:text-sm text-muted-foreground font-normal mr-1 md:mr-2">
                                {step.orderIndex}.
                              </span>
                              {step.title}
                            </h4>
                            {getStepStatus(step)}
                          </div>
                          {step.detailedDescription && (
                            <p className="text-[11px] md:text-sm text-muted-foreground leading-snug md:leading-relaxed line-clamp-2 md:line-clamp-none">
                              {step.detailedDescription}
                            </p>
                          )}
                          {step.estimatedTime && (
                            <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-muted-foreground">
                              <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              <span>Estimated time: {step.estimatedTime}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Yonder Partner */}
                      {step.yonderPartner && step.partnerEmail && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Yonder Partner Available
                              </p>
                              <p className="text-sm text-foreground">
                                {step.partnerName || 'Yonder Partner'}
                              </p>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              asChild
                            >
                              <a 
                                href={`mailto:${step.partnerEmail}?subject=Yonder Partner Assistance - ${step.title}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                              >
                                <Mail className="w-4 h-4" />
                                Contact
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {categoryIndex < sortedCategories.length - 1 && (
                <Separator className="mt-4" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - only show if requested */}
      {showFooter && (
        <div className="bg-white border-t border-gray-200 p-4">
          {/* Progress bar */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{completedSteps} of {totalSteps} completed</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Current Focus */}
          {currentStep ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="text-sm font-medium text-gray-700">Step {currentStep.orderIndex}</div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{currentStep.title}</h3>
                  {nextStep && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <ArrowRight className="w-3 h-3" />
                      <span>Next: {nextStep.title}</span>
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleMarkComplete}
                  disabled={updateStepMutation.isPending}
                  size="lg"
                >
                  {updateStepMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Mark Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : completedSteps === totalSteps ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Congratulations!</h3>
              <p className="text-sm text-gray-600">You&apos;ve completed all acquisition steps</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-600">No active step</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 