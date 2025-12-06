'use client';

import { Clock, AlertCircle, Mail } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import type { GetNextStepResult } from '@/lib/ai/tools/get-next-step';

export function StepInfo({ result }: { result: GetNextStepResult }) {
  // Error state
  if (result.error) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Step Information Error</h3>
              <p className="text-xs text-gray-500 mt-0.5">{String(result.error.details || 'Unknown error')}</p>
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

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Next Step Information</h3>
            <p className="text-xs text-gray-500 mt-0.5">Current progress overview</p>
          </div>
        </div>
        
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700">
            {result.data.nextStep 
              ? `You're currently on "${result.data.currentStep.title}". Your next step will be "${result.data.nextStep.title}".`
              : `You're currently on "${result.data.currentStep.title}". This is the final step in the process!`
            }
          </p>
        </div>
        
        {/* Yonder Partner Outreach Button */}
        {result.data.currentStep.yonderPartner && result.data.currentStep.yonderPartnerEmail && (
          <div className="flex items-center justify-between">
            <Button 
              size="sm" 
              variant="outline"
              asChild
            >
              <a 
                href={`mailto:${result.data.currentStep.yonderPartnerEmail}?subject=Yonder Partner Assistance - ${result.data.currentStep.title}`}
                className="flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Contact Yonder Partner
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 