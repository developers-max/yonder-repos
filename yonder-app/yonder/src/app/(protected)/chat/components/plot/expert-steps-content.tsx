'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Mail } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import { Separator } from '@/app/_components/ui/separator';

const EXPERT_STEPS = [
  {
    id: 'legal_check',
    title: 'Legal Check',
    substeps: [
      'Preliminary due diligence (zoning, access, infrastructure)',
      'Verify ownership + registry',
      'Tax number (NIF)',
      'Full legal report'
    ],
    hasContact: true
  },
  {
    id: 'promissory_contract',
    title: 'Promissory Contract (CPCV)',
    substeps: [
      'Make offer',
      'Sign promissory contract (10–30% deposit)'
    ],
    hasContact: true
  },
  {
    id: 'pip_planning',
    title: 'PIP / Planning',
    substeps: [
      'Optional municipal pre-approval (PIP)',
      'Architect prepares permit documentation'
    ],
    hasContact: true
  },
  {
    id: 'purchase_deed',
    title: 'Purchase / Deed',
    substeps: [
      'Sign final deed (Escritura)',
      'Register ownership'
    ],
    hasContact: true
  },
  {
    id: 'full_permits',
    title: 'Full Permits',
    substeps: [
      'Apply for construction license (Licença de Construção)',
      'Get habitation certificate (Licença de Utilização)'
    ],
    hasContact: true
  },
  {
    id: 'prepare_plot',
    title: 'Prepare Plot for Project',
    substeps: [
      'Site prep, utilities, access roads, etc.'
    ],
    hasContact: false
  }
];

export default function ExpertStepsContent() {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(['legal_check']));

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <h3 className="font-semibold text-foreground mb-1">Expert Guidance Unlocked</h3>
        <p className="text-sm text-muted-foreground">
          You&apos;ve completed the initial steps. Our expert team is ready to guide you through the acquisition process.
        </p>
      </div>

      {/* Expert Steps */}
      <div className="space-y-3">
        {EXPERT_STEPS.map((step, index) => (
          <div key={step.id} className="border rounded-lg overflow-hidden">
            {/* Step Header */}
            <button
              onClick={() => toggleStep(step.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {index + 1}
                </div>
                <span className="font-medium text-foreground">{step.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {step.hasContact && (
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`mailto:legal@yonder.com?subject=Assistance with ${step.title}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Contact
                    </a>
                  </Button>
                )}
                {expandedSteps.has(step.id) ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Step Content */}
            {expandedSteps.has(step.id) && (
              <div className="px-4 pb-4 pt-2 bg-muted/20">
                <Separator className="mb-3" />
                <ul className="space-y-2">
                  {step.substeps.map((substep, subIndex) => (
                    <li key={subIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      <span>{substep}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Need help?</strong> Our expert team is available to assist you at every step.
          Click the &quot;Contact&quot; button next to any step to reach out.
        </p>
      </div>
    </div>
  );
}
