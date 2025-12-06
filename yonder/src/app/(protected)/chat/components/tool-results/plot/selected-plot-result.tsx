'use client';

import { CheckCircle, AlertCircle } from 'lucide-react';
import type { SetSelectedPlotResult } from '@/lib/ai/tools/set-selected-plot';

interface SelectedPlotResultProps {
  result: SetSelectedPlotResult;
}

export function SelectedPlotResultComponent({ result }: SelectedPlotResultProps) {
  const isError = !!result.error;

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isError ? 'bg-red-100' : 'bg-green-100'}`}>
            {isError ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {isError ? 'Failed to Set Selected Plot' : 'Selected Plot Updated'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isError ? String(result.error?.details || 'Unknown error') : 'Your project has been updated'}
            </p>
          </div>
        </div>
        
        {isError ? (
          result.suggestions.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Suggested actions:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                    {suggestion.action}
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : result.data ? (
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="font-medium text-gray-900">Plot ID:</span>
                <span className="text-gray-700 ml-2">{result.data.plotId}</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Project ID:</span>
                <span className="text-gray-700 ml-2">{result.data.projectId}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
} 