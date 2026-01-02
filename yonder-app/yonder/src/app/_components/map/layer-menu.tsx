'use client';

import { useState, useMemo } from 'react';
import { Layers, ChevronDown, X } from 'lucide-react';
import { getWMSLayers, type WMSLayerConfig } from './wms-layers-config';

interface LayerMenuProps {
  country: 'PT' | 'ES';
  enabledLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
  showCadastreLayer: boolean;
  position?: 'bottom-left' | 'bottom-right';
}

/**
 * Reusable layer menu component for toggling map layers
 * Used by both the main search map and the cadastral polygon editor
 */
export function LayerMenu({
  country,
  enabledLayers,
  onToggleLayer,
  showCadastreLayer,
  position = 'bottom-left',
}: LayerMenuProps) {
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showLegend, setShowLegend] = useState<string | null>(null);
  const [legendModal, setLegendModal] = useState<{ layerId: string; config: WMSLayerConfig } | null>(null);

  // Get available WMS layers for the country
  const availableLayers = useMemo(() => getWMSLayers(country), [country]);

  if (!showCadastreLayer || Object.keys(availableLayers).length === 0) {
    return null;
  }

  const positionClasses = position === 'bottom-left' ? 'left-0' : 'right-0';

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="bg-white shadow-lg rounded-lg px-2 sm:px-3 py-2 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200"
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">Layers</span>
          <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showLayerMenu ? 'rotate-180' : ''}`} />
        </button>

        {showLayerMenu && (
          <div className={`absolute bottom-full ${positionClasses} mb-2 bg-white rounded-lg shadow-xl border border-gray-200 w-[calc(100vw-2rem)] sm:w-[320px] overflow-hidden`}>
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase">Map Layers</p>
              <span className="text-xs font-medium text-gray-400">
                {country === 'PT' ? '🇵🇹 Portugal' : '🇪🇸 Spain'}
              </span>
            </div>
            <div className="py-1 max-h-[200px] sm:max-h-[300px] overflow-y-auto">
              {Object.entries(availableLayers).map(([layerId, config]) => (
                <div key={layerId} className="px-3 py-2 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    {/* Checkbox */}
                    <button
                      onClick={() => onToggleLayer(layerId)}
                      className="flex-shrink-0"
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          enabledLayers.has(layerId)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {enabledLayers.has(layerId) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {/* Layer name and description - fixed width */}
                    <button
                      onClick={() => onToggleLayer(layerId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-medium text-gray-700 truncate">{config.shortName}</p>
                      <p className="text-xs text-gray-500 truncate">{config.description}</p>
                    </button>
                    {/* Info button - always reserve space */}
                    <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                      {config.legendUrl && (
                        <button
                          onClick={() => setShowLegend(showLegend === layerId ? null : layerId)}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${showLegend === layerId ? 'bg-gray-200' : ''}`}
                          title="Show legend"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Color indicator */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: config.color }}
                    />
                  </div>
                  {/* Legend panel */}
                  {showLegend === layerId && config.legendUrl && (
                    <div
                      className="mt-2 p-2 sm:p-3 bg-white rounded border border-gray-200 max-h-[150px] sm:max-h-[250px] overflow-y-auto shadow-inner cursor-pointer hover:border-blue-300 transition-colors"
                      onClick={() => setLegendModal({ layerId, config })}
                      title="Click to expand legend"
                    >
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-700">Legend</p>
                        <span className="text-xs text-blue-500">Tap to expand</span>
                      </div>
                      <img
                        src={config.legendUrl}
                        alt={`Legend for ${config.shortName}`}
                        className="w-full max-w-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400">Source: {country === 'PT' ? 'DGT' : 'Catastro'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend Modal */}
      {legendModal && legendModal.config.legendUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setLegendModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-lg w-full mx-2 sm:mx-4 max-h-[85vh] sm:max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b bg-gray-50">
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 truncate pr-2">Legend: {legendModal.config.name}</h3>
              <button
                onClick={() => setLegendModal(null)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(85vh-80px)] sm:max-h-[calc(90vh-60px)]">
              <img
                src={legendModal.config.legendUrl}
                alt={`Legend for ${legendModal.config.name}`}
                className="w-full max-w-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="px-3 sm:px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
              Source: {legendModal.config.provider}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
