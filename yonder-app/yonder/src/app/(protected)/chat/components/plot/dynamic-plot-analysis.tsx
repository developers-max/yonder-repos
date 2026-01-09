"use client";

import { trpc } from '@/trpc/client';
import { 
  Map, 
  Building2, 
  Ruler, 
  Mountain, 
  Navigation, 
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  TreePine,
  Waves,
  Flame,
  Info,
} from 'lucide-react';
import { useState } from 'react';

interface DynamicPlotAnalysisProps {
  plotId: string;
}

export function DynamicPlotAnalysis({ plotId }: DynamicPlotAnalysisProps) {
  const { data: analysis, isLoading, error } = trpc.plots.analyzePlotData.useQuery(
    { plotId },
    {
      staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    }
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['keyInsights']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">AI Plot Analysis</h3>
              <p className="text-xs text-gray-600 mt-0.5">Intelligent insights from enrichment data</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Sparkles className="w-8 h-8 animate-pulse text-blue-500 mb-3" />
          <span className="text-sm font-medium text-gray-700">Analyzing plot data...</span>
          <span className="text-xs text-gray-500 mt-1">Extracting zoning, regulations, and key insights</span>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 text-sm">Analysis Unavailable</p>
            <p className="text-xs text-amber-700 mt-1">
              {error?.message || 'Unable to analyze plot data at this time.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Insights Section - Always visible */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-base">Key Insights</h3>
            <p className="text-xs text-gray-600 mt-0.5">Most important things you should know</p>
          </div>
        </div>
        {analysis.keyInsights && analysis.keyInsights.length > 0 ? (
          <ul className="space-y-2.5">
            {analysis.keyInsights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-700 bg-white rounded-lg p-3 border border-blue-100">
                <span className="text-blue-500 font-bold mt-0.5 flex-shrink-0">{idx + 1}.</span>
                <span className="leading-relaxed">{insight}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <p className="text-sm text-gray-500 italic">Generating insights from plot data...</p>
          </div>
        )}
      </div>

      {/* Main Analysis Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <Map className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">Plot Analysis</h3>
              <p className="text-xs text-gray-600 mt-0.5">Detailed zoning, regulations, and site characteristics</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Zoning Section */}
          {(analysis.zoning.classification || analysis.zoning.description) && (
            <div>
              <button
                onClick={() => toggleSection('zoning')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-green-100 rounded-md group-hover:bg-green-200 transition-colors">
                    <Map className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-gray-900 text-sm">Zoning Classification</span>
                    {analysis.zoning.classification && (
                      <p className="text-xs text-gray-600 mt-0.5">{analysis.zoning.classification}</p>
                    )}
                  </div>
                </div>
                {expandedSections.has('zoning') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('zoning') && (
                <div className="px-4 pb-4 space-y-3">
                  {analysis.zoning.description && (
                    <div className="ml-11">
                      <p className="text-sm text-gray-700 leading-relaxed bg-green-50 rounded-lg p-3 border border-green-100">
                        {analysis.zoning.description}
                      </p>
                    </div>
                  )}
                  {analysis.zoning.keyRestrictions && analysis.zoning.keyRestrictions.length > 0 && (
                    <div className="ml-11">
                      <p className="text-xs font-medium text-gray-500 mb-2">Key Restrictions:</p>
                      <ul className="space-y-2">
                        {analysis.zoning.keyRestrictions.map((restriction, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-600 mt-1">•</span>
                            <span className="leading-relaxed">{restriction}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Building Regulations Section */}
          {(analysis.buildingRegulations.maxHeight || analysis.buildingRegulations.maxCoverage || analysis.buildingRegulations.maxFloors) && (
            <div>
              <button
                onClick={() => toggleSection('regulations')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-purple-100 rounded-md group-hover:bg-purple-200 transition-colors">
                    <Building2 className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">Building Regulations</span>
                </div>
                {expandedSections.has('regulations') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('regulations') && (
                <div className="px-4 pb-4">
                  <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.buildingRegulations.maxHeight && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs text-gray-500 mb-1">Max Height</p>
                        <p className="text-sm font-semibold text-gray-900">{analysis.buildingRegulations.maxHeight}</p>
                      </div>
                    )}
                    {analysis.buildingRegulations.maxCoverage && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs text-gray-500 mb-1">Max Coverage</p>
                        <p className="text-sm font-semibold text-gray-900">{analysis.buildingRegulations.maxCoverage}</p>
                      </div>
                    )}
                    {analysis.buildingRegulations.maxFloors && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs text-gray-500 mb-1">Max Floors</p>
                        <p className="text-sm font-semibold text-gray-900">{analysis.buildingRegulations.maxFloors}</p>
                      </div>
                    )}
                    {analysis.buildingRegulations.setbacks && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs text-gray-500 mb-1">Setbacks</p>
                        <p className="text-sm font-semibold text-gray-900">{analysis.buildingRegulations.setbacks}</p>
                      </div>
                    )}
                    {analysis.buildingRegulations.buildableArea && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-xs text-gray-500 mb-1">Buildable Area</p>
                        <p className="text-sm font-semibold text-gray-900">{analysis.buildingRegulations.buildableArea}</p>
                      </div>
                    )}
                  </div>
                  {analysis.buildingRegulations.other && analysis.buildingRegulations.other.length > 0 && (
                    <div className="ml-11 mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Other Requirements:</p>
                      <ul className="space-y-1.5">
                        {analysis.buildingRegulations.other.map((req, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-purple-600 mt-1">•</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Elevation Section */}
          {(analysis.elevation.averageElevation || analysis.elevation.slope || analysis.elevation.topography) && (
            <div>
              <button
                onClick={() => toggleSection('elevation')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-orange-100 rounded-md group-hover:bg-orange-200 transition-colors">
                    <Mountain className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">Elevation & Topography</span>
                </div>
                {expandedSections.has('elevation') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('elevation') && (
                <div className="px-4 pb-4">
                  <div className="ml-11 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysis.elevation.averageElevation && (
                        <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                          <p className="text-xs text-gray-500 mb-1">Elevation</p>
                          <p className="text-sm font-semibold text-gray-900">{analysis.elevation.averageElevation}</p>
                        </div>
                      )}
                      {analysis.elevation.slope && (
                        <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                          <p className="text-xs text-gray-500 mb-1">Slope</p>
                          <p className="text-sm font-semibold text-gray-900">{analysis.elevation.slope}</p>
                        </div>
                      )}
                    </div>
                    {analysis.elevation.topography && (
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                        <p className="text-xs text-gray-500 mb-1">Topography</p>
                        <p className="text-sm text-gray-700">{analysis.elevation.topography}</p>
                      </div>
                    )}
                    {analysis.elevation.constraints && analysis.elevation.constraints.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Constraints & Considerations:</p>
                        <ul className="space-y-1.5">
                          {analysis.elevation.constraints.map((constraint, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-orange-600 mt-1">•</span>
                              <span>{constraint}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Accessibility Section */}
          {(analysis.accessibility.roadAccess || analysis.accessibility.distance || analysis.accessibility.publicTransport) && (
            <div>
              <button
                onClick={() => toggleSection('accessibility')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-100 rounded-md group-hover:bg-blue-200 transition-colors">
                    <Navigation className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">Accessibility</span>
                </div>
                {expandedSections.has('accessibility') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('accessibility') && (
                <div className="px-4 pb-4">
                  <div className="ml-11 space-y-2.5">
                    {analysis.accessibility.roadAccess && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-gray-500 min-w-[100px]">Road Access:</span>
                        <span className="text-gray-900 font-medium">{analysis.accessibility.roadAccess}</span>
                      </div>
                    )}
                    {analysis.accessibility.distance && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-gray-500 min-w-[100px]">Distance:</span>
                        <span className="text-gray-900">{analysis.accessibility.distance}</span>
                      </div>
                    )}
                    {analysis.accessibility.publicTransport && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-gray-500 min-w-[100px]">Public Transport:</span>
                        <span className="text-gray-900">{analysis.accessibility.publicTransport}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Environmental Factors Section */}
          {((analysis.environmentalFactors.protectedAreas && analysis.environmentalFactors.protectedAreas.length > 0) ||
            (analysis.environmentalFactors.naturalFeatures && analysis.environmentalFactors.naturalFeatures.length > 0) ||
            (analysis.environmentalFactors.riskZones && analysis.environmentalFactors.riskZones.length > 0)) && (
            <div>
              <button
                onClick={() => toggleSection('environmental')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-emerald-100 rounded-md group-hover:bg-emerald-200 transition-colors">
                    <TreePine className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">Environmental Factors</span>
                </div>
                {expandedSections.has('environmental') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('environmental') && (
                <div className="px-4 pb-4">
                  <div className="ml-11 space-y-3">
                    {analysis.environmentalFactors.naturalFeatures && analysis.environmentalFactors.naturalFeatures.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Waves className="w-4 h-4 text-emerald-600" />
                          <p className="text-xs font-medium text-gray-700">Natural Features:</p>
                        </div>
                        <ul className="space-y-1.5 ml-6">
                          {analysis.environmentalFactors.naturalFeatures.map((feature, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-emerald-600 mt-1">•</span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.environmentalFactors.protectedAreas && analysis.environmentalFactors.protectedAreas.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <p className="text-xs font-medium text-gray-700">Protected Areas:</p>
                        </div>
                        <ul className="space-y-1.5 ml-6">
                          {analysis.environmentalFactors.protectedAreas.map((area, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-amber-600 mt-1">•</span>
                              <span>{area}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.environmentalFactors.riskZones && analysis.environmentalFactors.riskZones.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="w-4 h-4 text-red-600" />
                          <p className="text-xs font-medium text-gray-700">Risk Zones:</p>
                        </div>
                        <ul className="space-y-1.5 ml-6">
                          {analysis.environmentalFactors.riskZones.map((risk, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-red-600 mt-1">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
