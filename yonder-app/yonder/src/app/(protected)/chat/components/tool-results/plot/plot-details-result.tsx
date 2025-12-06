'use client';

import { Square, AlertCircle } from 'lucide-react';
import type { PlotDetailsResult } from '@/lib/ai/tools/get-plot-details';

interface PlotDetailsResultProps {
  result: PlotDetailsResult;
}

export function PlotDetailsResultComponent({ result }: PlotDetailsResultProps) {
  const isError = !!result.error;

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isError ? 'bg-red-100' : 'bg-green-100'}`}>
            {isError ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : (
              <Square className="w-4 h-4 text-green-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {isError ? 'Plot Details Error' : 'Plot Details Retrieved'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isError ? String(result.error?.details || 'Unknown error') : 'Complete plot information'}
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
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-900">Price:</span>
                  <span className="text-gray-700 ml-2">€{result.data.plot.price.toLocaleString()}</span>
                </div>
                {result.data.plot.size && (
                  <div>
                    <span className="font-medium text-gray-900">Size:</span>
                    <span className="text-gray-700 ml-2">{result.data.plot.size.toLocaleString()}m²</span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="font-medium text-gray-900">Location:</span>
                  <span className="text-gray-700 ml-2">{result.data.plot.latitude.toFixed(4)}, {result.data.plot.longitude.toFixed(4)}</span>
                </div>
              </div>
            </div>
            
            {/* Additional analysis details */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-3 text-gray-900">Analysis</h4>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Pricing:</span> {result.data.analysis.pricing.notes}
                {result.data.analysis.pricing.pricePerSqm && (
                  <span className="ml-1">(€{result.data.analysis.pricing.pricePerSqm.toFixed(2)}/m²)</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
} 