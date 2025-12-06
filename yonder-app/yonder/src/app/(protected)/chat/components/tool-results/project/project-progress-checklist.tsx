'use client';

import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { trpc } from '@/trpc/client';
import type { GetProjectProgressResult } from '@/lib/ai/tools/get-project-progress';

interface ProjectProgressChecklistProps {
  data: GetProjectProgressResult;
}

export function ProjectProgressChecklist({ data }: ProjectProgressChecklistProps) {

  // Error state
  if (data.error) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Progress Check Error</h3>
              <p className="text-xs text-gray-500 mt-0.5">{String(data.error.details || 'Unknown error')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data.data) {
    return null;
  }

  // Fetch organization steps using tRPC - the projectId is actually organizationId
  const { data: organizationSteps, isLoading, error } = trpc.processSteps.getOrganizationSteps.useQuery(
    { organizationId: data.data.projectId },
    { enabled: !!data.data.projectId }
  );

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Loading Project Progress...</h3>
              <p className="text-xs text-gray-500 mt-0.5">Getting your project steps...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Error Loading Progress</h3>
              <p className="text-xs text-gray-500 mt-0.5">Unable to load project steps</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Project Progress</h3>
            <p className="text-xs text-gray-500 mt-0.5">Your acquisition checklist</p>
          </div>
        </div>
        
        {/* Simple checklist */}
        <div className="space-y-3">
          {organizationSteps?.map((step) => (
            <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <div className="flex-shrink-0">
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : step.status === 'in_progress' ? (
                  <Clock className="w-4 h-4 text-blue-600" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <span className={`text-sm ${
                step.status === 'completed' 
                  ? 'text-green-700 line-through' 
                  : step.status === 'in_progress'
                  ? 'text-blue-700 font-medium'
                  : 'text-gray-600'
              }`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
        
        {!organizationSteps?.length && (
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
            <p className="text-sm text-gray-600">No steps found for this project.</p>
          </div>
        )}
      </div>
    </div>
  );
} 