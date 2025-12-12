'use client';

import { useEffect, useState } from 'react';
import { MapPin, CheckCircle, AlertCircle, X } from 'lucide-react';
import type { NavigateToLocationResult } from '@/lib/ai/tools/navigate-to-location';

interface NavigateToLocationResultProps {
  result: NavigateToLocationResult;
}

export function NavigateToLocationResultComponent({ result }: NavigateToLocationResultProps) {
  const [hasNavigated, setHasNavigated] = useState(false);
  const isError = !!result.error;
  const data = result.data;
  const isClearAction = data?.action === 'clear';

  // Auto-dispatch navigation event when component mounts
  useEffect(() => {
    if (data && !hasNavigated) {
      if (isClearAction) {
        // Dispatch clear event
        window.dispatchEvent(new CustomEvent('clearMapPin'));
      } else if (data.latitude !== undefined && data.longitude !== undefined) {
        // Dispatch navigate event
        window.dispatchEvent(new CustomEvent('navigateToMapLocation', {
          detail: {
            latitude: data.latitude,
            longitude: data.longitude,
            zoom: data.zoom,
            label: data.label,
          }
        }));
      }
      setHasNavigated(true);
    }
  }, [data, hasNavigated, isClearAction]);

  // Manual re-navigate handler
  const handleNavigate = () => {
    if (data && data.latitude !== undefined && data.longitude !== undefined) {
      window.dispatchEvent(new CustomEvent('navigateToMapLocation', {
        detail: {
          latitude: data.latitude,
          longitude: data.longitude,
          zoom: data.zoom,
          label: data.label,
        }
      }));
    }
  };

  // Get display text for the result
  const getDisplayText = () => {
    if (isError) return String(result.error?.details || 'Unknown error');
    if (isClearAction) return 'Pin cleared from map';
    if (data?.label) return data.label;
    if (data?.latitude !== undefined && data?.longitude !== undefined) {
      return `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;
    }
    return 'Location updated';
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isError ? 'bg-red-100' : isClearAction ? 'bg-gray-100' : 'bg-blue-100'}`}>
            {isError ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : isClearAction ? (
              <X className="w-4 h-4 text-gray-600" />
            ) : (
              <MapPin className="w-4 h-4 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">
              {isError ? 'Navigation Failed' : isClearAction ? 'Pin Cleared' : 'Map Navigation'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {getDisplayText()}
            </p>
          </div>
        </div>

        {/* Error state */}
        {isError && result.suggestions && result.suggestions.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-4">
            <p className="text-xs font-medium text-red-700 mb-2">Suggested actions:</p>
            <ul className="text-xs text-red-600 space-y-1">
              {result.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-red-400 rounded-full mt-2 flex-shrink-0"></span>
                  {suggestion.action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success state - Navigate action */}
        {!isError && data && !isClearAction && data.latitude !== undefined && data.longitude !== undefined && (
          <div className="space-y-3">
            {/* Coordinates display */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-800">Coordinates</p>
                  <p className="text-sm text-blue-700 font-mono">
                    {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Navigated</span>
                </div>
              </div>
            </div>

            {/* Re-navigate button */}
            <button
              onClick={handleNavigate}
              className="w-full text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Navigate Again
            </button>
          </div>
        )}

        {/* Success state - Clear action */}
        {!isError && data && isClearAction && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Pin removed from map</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
