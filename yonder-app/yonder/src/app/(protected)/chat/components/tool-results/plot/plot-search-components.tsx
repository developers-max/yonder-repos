import { useState, useEffect } from 'react';
import { Button } from '@/app/_components/ui/button';
import { 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  ChevronDown,
  MapPin,
  Euro,
  Ruler,
  Waves,
  Coffee,
  ShoppingCart,
  Bus,
  BarChart3,
  Loader2
} from 'lucide-react';
import type { SearchPlotsResult } from '@/lib/ai/tools/search-plots';

// Component for rendering tool invocation loading state
export function ToolInvocationSkeleton({ toolName }: { toolName: string }) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-xl mt-3">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        <span className="text-sm font-semibold text-gray-700">
          {toolName === 'searchPlots' ? 'Generating plot filters...' : `Running ${toolName}...`}
        </span>
      </div>
      {/* Pulsating skeleton bars */}
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 rounded-full animate-pulse"></div>
        <div className="h-3 bg-gray-200 rounded-full animate-pulse w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded-full animate-pulse w-1/2"></div>
      </div>
    </div>
  );
}

// Component for rendering plot filter results using flattened ToolResult structure
export function PlotSearchResults({ result }: { result: SearchPlotsResult }) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { filters, summary } = result.data || { filters: {}, summary: '' };

  const handleApplyFilters = () => {
    window.dispatchEvent(new CustomEvent('applyPlotFilters', { 
      detail: filters 
    }));
  };

  // Auto-apply filters when component mounts (deferred to avoid render-time state updates)
  useEffect(() => {
    handleApplyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <Filter className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              Plot Filters Generated
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Filters have been automatically applied</p>
          </div>
        </div>

        {/* Filter summary */}
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">Applied filters:</span> {summary}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <Button
            onClick={handleApplyFilters}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Plot Panel
          </Button>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Auto-applied</span>
          </div>
        </div>
      </div>

      {/* Filter details */}
      <div className="border-t border-gray-100">
        <div
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          className="px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700 text-sm">View filter details</span>
            <ChevronDown 
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isDetailsOpen ? 'rotate-180' : ''
              }`} 
            />
          </div>
        </div>
        {isDetailsOpen && (
          <div className="px-5 pb-4 space-y-2">
            {filters && filters.latitude && filters.longitude && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>Location: {filters.latitude.toFixed(4)}, {filters.longitude.toFixed(4)} ({filters.radiusKm || 50}km radius)</span>
              </div>
            )}
            {filters && (filters.minPrice || filters.maxPrice) && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Euro className="w-4 h-4" />
                <span>Price: €{filters.minPrice?.toLocaleString() || '0'} - €{filters.maxPrice?.toLocaleString() || '∞'}</span>
              </div>
            )}
            {filters && (filters.minSize || filters.maxSize) && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Ruler className="w-4 h-4" />
                <span>Size: {filters.minSize || 0}m² - {filters.maxSize || '∞'}m²</span>
              </div>
            )}
            {filters && filters.maxDistanceToBeach && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Waves className="w-4 h-4" />
                <span>Beach: Max {filters.maxDistanceToBeach}m away</span>
              </div>
            )}
            {filters && filters.maxDistanceToCafe && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Coffee className="w-4 h-4" />
                <span>Café: Max {filters.maxDistanceToCafe}m away</span>
              </div>
            )}
            {filters && filters.maxDistanceToSupermarket && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <ShoppingCart className="w-4 h-4" />
                <span>Supermarket: Max {filters.maxDistanceToSupermarket}m away</span>
              </div>
            )}
            {filters && filters.maxDistanceToPublicTransport && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Bus className="w-4 h-4" />
                <span>Transport: Max {filters.maxDistanceToPublicTransport}m away</span>
              </div>
            )}
            {filters && filters.sortBy && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BarChart3 className="w-4 h-4" />
                <span>Sort: By {filters.sortBy} ({filters.sortOrder || 'asc'})</span>
              </div>
            )}
            {/* Zoning filter details */}
            {filters && (filters.zoningLabelContains || filters.zoningLabelEnContains || filters.zoningTypenameContains || filters.zoningPickedFieldContains || filters.zoningSourceContains || filters.zoningTextContains) && (
              <div className="text-sm text-gray-600">
                <div className="font-medium text-gray-700 mb-1">Zoning filters:</div>
                <div className="space-y-1">
                  {filters.zoningLabelContains && (
                    <div>Label contains: <span className="font-mono">&quot;{filters.zoningLabelContains}&quot;</span></div>
                  )}
                  {filters.zoningLabelEnContains && (
                    <div>English label contains: <span className="font-mono">&quot;{filters.zoningLabelEnContains}&quot;</span></div>
                  )}
                  {filters.zoningTypenameContains && (
                    <div>Typename contains: <span className="font-mono">&quot;{filters.zoningTypenameContains}&quot;</span></div>
                  )}
                  {filters.zoningPickedFieldContains && (
                    <div>Picked field contains: <span className="font-mono">&quot;{filters.zoningPickedFieldContains}&quot;</span></div>
                  )}
                  {filters.zoningSourceContains && (
                    <div>Source contains: <span className="font-mono">&quot;{filters.zoningSourceContains}&quot;</span></div>
                  )}
                  {filters.zoningTextContains && (
                    <div>Text search: <span className="font-mono">&quot;{filters.zoningTextContains}&quot;</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

 