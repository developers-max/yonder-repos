'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Map, { Source, Layer, MapRef, Marker } from 'react-map-gl/mapbox';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { Button } from '@/app/_components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Pencil, Trash2, RotateCcw, Save, MapPin, Square, X, Move, Layers, ChevronDown } from 'lucide-react';
import DrawControl from './draw-control';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { PT_WMS_LAYERS, ES_WMS_LAYERS, type WMSLayerConfig, DEFAULT_ENABLED_LAYERS } from './wms-layers-config';

export interface CadastralGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface CadastralPolygonEditorProps {
  /** Initial polygon geometry from cadastral data (GeoJSON Polygon) */
  initialGeometry?: CadastralGeometry | null;
  /** Center point for the map (plot location) */
  center: {
    latitude: number;
    longitude: number;
  };
  /** Callback when polygon is saved */
  onSave?: (geometry: CadastralGeometry) => void;
  /** Callback when polygon changes (for live updates) */
  onChange?: (geometry: CadastralGeometry | null) => void;
  /** Whether marker is currently in edit mode (controlled by parent) */
  isMarkerEditing?: boolean;
  /** Callback when marker position changes during drag (for live display) */
  onMarkerPositionChange?: (center: { latitude: number; longitude: number }) => void;
  /** Read-only mode - just display the polygon */
  readOnly?: boolean;
  /** Map height */
  height?: string;
  /** Show area calculation */
  showArea?: boolean;
  /** Additional cadastral info to display */
  cadastralInfo?: {
    reference?: string;
    label?: string;
    source?: string;
  };
  /** Minimal mode - just show the map without card wrapper, header, or info bar */
  minimal?: boolean;
  /** Show cadastre WMS layer */
  showCadastreLayer?: boolean;
  /** Country code for cadastre layer (ES = Spain, PT = Portugal) */
  country?: 'ES' | 'PT';
}

// Get WMS layers for a country
function getWMSLayers(country: 'PT' | 'ES'): Record<string, WMSLayerConfig> {
  return country === 'PT' ? PT_WMS_LAYERS : ES_WMS_LAYERS;
}

// Custom draw styles for better visibility on satellite imagery
const drawStyles: object[] = [
  // Polygon fill - active
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': '#fbbf24',
      'fill-outline-color': '#fbbf24',
      'fill-opacity': 0.3,
    },
  },
  // Polygon fill - inactive
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': '#3b82f6',
      'fill-outline-color': '#3b82f6',
      'fill-opacity': 0.2,
    },
  },
  // Polygon outline - active
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#fbbf24',
      'line-width': 3,
    },
  },
  // Polygon outline - inactive
  {
    id: 'gl-draw-polygon-stroke-inactive',
    type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 2,
    },
  },
  // Vertex points - active
  {
    id: 'gl-draw-polygon-and-line-vertex-active',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 7,
      'circle-color': '#fbbf24',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  },
  // Midpoint vertices
  {
    id: 'gl-draw-polygon-midpoint',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 5,
      'circle-color': '#fff',
      'circle-stroke-color': '#fbbf24',
      'circle-stroke-width': 2,
    },
  },
  // Line - for drawing
  {
    id: 'gl-draw-line',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#fbbf24',
      'line-dasharray': [0.2, 2],
      'line-width': 2,
    },
  },
  // Point - for drawing
  {
    id: 'gl-draw-point',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': 5,
      'circle-color': '#fbbf24',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  },
];

export default function CadastralPolygonEditor({
  initialGeometry,
  center,
  onSave,
  onChange,
  isMarkerEditing = false,
  onMarkerPositionChange,
  readOnly = false,
  height = '400px',
  showArea = true,
  cadastralInfo,
  minimal = false,
  showCadastreLayer = false,
  country = 'PT',
}: CadastralPolygonEditorProps) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Normalize polygon coordinates to ensure correct format: number[][][]
  const normalizeGeometry = (geom: CadastralGeometry | null | undefined): CadastralGeometry | null => {
    if (!geom || !geom.coordinates) return null;
    
    const coords = geom.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) return null;
    
    // Check if this looks like number[][][] (correct format)
    const firstRing = coords[0];
    if (Array.isArray(firstRing) && firstRing.length > 0) {
      const firstPoint = firstRing[0];
      if (Array.isArray(firstPoint) && typeof firstPoint[0] === 'number') {
        // Already correct format
        return geom;
      }
      // Extra nesting: number[][][][] - unwrap one level
      if (Array.isArray(firstPoint) && Array.isArray(firstPoint[0])) {
        return {
          type: 'Polygon',
          coordinates: firstRing as unknown as number[][][],
        };
      }
    }
    
    return geom;
  };
  
  const [currentGeometry, setCurrentGeometry] = useState<CadastralGeometry | null>(
    normalizeGeometry(initialGeometry)
  );
  const [editingGeometry, setEditingGeometry] = useState<CadastralGeometry | null>(null);
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [markerPosition, setMarkerPosition] = useState(center);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showLegend, setShowLegend] = useState<string | null>(null); // Layer ID whose legend is shown
  const [legendModal, setLegendModal] = useState<{ layerId: string; config: WMSLayerConfig } | null>(null); // Full-screen legend modal
  
  // Get available WMS layers for the country
  const availableLayers = useMemo(() => getWMSLayers(country), [country]);
  
  // State for enabled layers - initialize with defaults
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(() => {
    if (showCadastreLayer) {
      return new Set(DEFAULT_ENABLED_LAYERS[country]);
    }
    return new Set();
  });
  
  // Toggle a layer on/off
  const toggleLayer = useCallback((layerId: string) => {
    setEnabledLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  // Sync marker position when center prop changes (e.g., when editing is cancelled)
  useEffect(() => {
    if (!isDraggingMarker) {
      setMarkerPosition(center);
    }
  }, [center.latitude, center.longitude, isDraggingMarker]);

  // Calculate area when geometry changes
  const displayGeometry = isEditing ? editingGeometry : currentGeometry;
  
  useEffect(() => {
    if (displayGeometry && showArea && displayGeometry.coordinates?.[0]?.length >= 4) {
      try {
        const polygon = turf.polygon(displayGeometry.coordinates);
        const area = turf.area(polygon);
        setCalculatedArea(Math.round(area * 100) / 100);
      } catch (error) {
        console.error('Error calculating area:', error);
        setCalculatedArea(null);
      }
    } else {
      setCalculatedArea(null);
    }
  }, [displayGeometry, showArea]);

  // Calculate initial view to fit polygon
  const initialViewState = useMemo(() => {
    if (initialGeometry && initialGeometry.coordinates?.[0]?.length >= 4) {
      try {
        const polygon = turf.polygon(initialGeometry.coordinates);
        const bbox = turf.bbox(polygon);
        return {
          longitude: (bbox[0] + bbox[2]) / 2,
          latitude: (bbox[1] + bbox[3]) / 2,
          zoom: 17,
        };
      } catch {
        // Fall back to center
      }
    }
    return {
      longitude: center.longitude,
      latitude: center.latitude,
      zoom: 17,
    };
  }, [initialGeometry, center]);

  const [viewState, setViewState] = useState(initialViewState);

  // Fit bounds when map loads - include both polygon and marker
  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (mapRef.current) {
      try {
        // Start with marker position
        let minLng = center.longitude;
        let maxLng = center.longitude;
        let minLat = center.latitude;
        let maxLat = center.latitude;

        // Extend bounds to include polygon if present and valid
        if (initialGeometry && 
            initialGeometry.coordinates?.[0]?.length >= 4) {
          const polygon = turf.polygon(initialGeometry.coordinates);
          const bbox = turf.bbox(polygon);
          minLng = Math.min(minLng, bbox[0]);
          minLat = Math.min(minLat, bbox[1]);
          maxLng = Math.max(maxLng, bbox[2]);
          maxLat = Math.max(maxLat, bbox[3]);
        }

        // Add some buffer around single point if no polygon
        if (!initialGeometry) {
          const buffer = 0.001; // ~100m buffer
          minLng -= buffer;
          maxLng += buffer;
          minLat -= buffer;
          maxLat += buffer;
        }

        mapRef.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 60, duration: 1000, maxZoom: 18 }
        );
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [initialGeometry, center.longitude, center.latitude]);

  // Handle draw events
  const handleDrawCreate = useCallback((evt: { features: GeoJSON.Feature[] }) => {
    if (evt.features.length > 0) {
      const feature = evt.features[0];
      if (feature.geometry.type === 'Polygon') {
        const newGeometry: CadastralGeometry = {
          type: 'Polygon',
          coordinates: feature.geometry.coordinates as number[][][],
        };
        setEditingGeometry(newGeometry);
        setHasChanges(true);
        onChange?.(newGeometry);
      }
    }
  }, [onChange]);

  const handleDrawUpdate = useCallback((evt: { features: GeoJSON.Feature[] }) => {
    if (evt.features.length > 0) {
      const feature = evt.features[0];
      if (feature.geometry.type === 'Polygon') {
        const newGeometry: CadastralGeometry = {
          type: 'Polygon',
          coordinates: feature.geometry.coordinates as number[][][],
        };
        setEditingGeometry(newGeometry);
        setHasChanges(true);
        onChange?.(newGeometry);
      }
    }
  }, [onChange]);

  const handleDrawDelete = useCallback(() => {
    setEditingGeometry(null);
    setHasChanges(true);
    onChange?.(null);
  }, [onChange]);

  // Start editing mode
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditingGeometry(currentGeometry);
    setHasChanges(false);
  }, [currentGeometry]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingGeometry(null);
    setHasChanges(false);
    onChange?.(currentGeometry);
  }, [currentGeometry, onChange]);

  // Save changes
  const handleSave = useCallback(() => {
    if (editingGeometry) {
      // Normalize coordinates to ensure correct format
      const normalizedGeometry = normalizeGeometry(editingGeometry);
      if (normalizedGeometry) {
        setCurrentGeometry(normalizedGeometry);
        onSave?.(normalizedGeometry);
      }
    }
    setIsEditing(false);
    setEditingGeometry(null);
    setHasChanges(false);
  }, [editingGeometry, onSave]);

  // Delete polygon (while editing)
  const handleDelete = useCallback(() => {
    setEditingGeometry(null);
    setHasChanges(true);
    onChange?.(null);
    // Also need to clear the draw control
    if (drawRef.current) {
      drawRef.current.deleteAll();
    }
  }, [onChange]);

  // Reset to original
  const handleReset = useCallback(() => {
    setEditingGeometry(initialGeometry || null);
    setHasChanges(false);
    onChange?.(initialGeometry || null);
  }, [initialGeometry, onChange]);

  // Store draw ref from DrawControl
  const handleDrawControlRef = useCallback((draw: MapboxDraw) => {
    drawRef.current = draw;
    // If we have initial geometry and we're editing, add it to the draw control
    if (isEditing && currentGeometry && draw) {
      const featureIds = draw.add({
        type: 'Feature',
        properties: {},
        geometry: currentGeometry,
      });
      // Select the feature for editing
      if (featureIds.length > 0) {
        draw.changeMode('direct_select', { featureId: featureIds[0] });
      }
    }
  }, [isEditing, currentGeometry]);

  // Map content (reused in both minimal and full mode)
  const mapContent = (
    <div style={{ height }} className={`relative overflow-hidden ${minimal ? 'rounded-lg' : 'rounded-b-lg'}`}>
          <Map
            ref={mapRef}
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            onLoad={handleMapLoad}
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/light-v11"
          >
            {/* WMS/Vector Tile Layers - dynamically render enabled layers */}
            {showCadastreLayer && Object.entries(availableLayers).map(([layerId, config]) => {
              if (!enabledLayers.has(layerId)) return null;
              
              // Handle vector tile layers (e.g., Portuguese cadastre)
              if (config.type === 'vector') {
                return (
                  <Source
                    key={`vector-${layerId}-${country}`}
                    id={`vector-${layerId}`}
                    type="vector"
                    tiles={[config.url]}
                    minzoom={8}
                    maxzoom={22}
                  >
                    <Layer
                      id={`vector-${layerId}-fill`}
                      type="fill"
                      source-layer={config.sourceLayer || layerId}
                      paint={{
                        'fill-color': config.color,
                        'fill-opacity': config.opacity * 0.4
                      }}
                      minzoom={12}
                    />
                    <Layer
                      id={`vector-${layerId}-line`}
                      type="line"
                      source-layer={config.sourceLayer || layerId}
                      paint={{
                        'line-color': config.color,
                        'line-width': 2,
                        'line-opacity': config.opacity
                      }}
                      minzoom={12}
                    />
                  </Source>
                );
              }
              
              // Handle raster WMS layers (default)
              return (
                <Source
                  key={`wms-${layerId}-${country}`}
                  id={`wms-${layerId}`}
                  type="raster"
                  tiles={[config.url]}
                  tileSize={256}
                >
                  <Layer
                    id={`wms-${layerId}-layer`}
                    type="raster"
                    paint={{
                      'raster-opacity': config.opacity
                    }}
                  />
                </Source>
              );
            })}

            {/* Draw control - only shown when editing */}
            {isEditing && mapLoaded && (
              <DrawControl
                position="top-right"
                displayControlsDefault={false}
                controls={{
                  polygon: true,
                  trash: true,
                }}
                defaultMode={currentGeometry ? 'simple_select' : 'draw_polygon'}
                styles={drawStyles}
                onCreate={handleDrawCreate}
                onUpdate={handleDrawUpdate}
                onDelete={handleDrawDelete}
                onDrawRef={(draw) => { drawRef.current = draw; }}
                initialFeatures={currentGeometry ? [{
                  type: 'Feature',
                  properties: {},
                  geometry: currentGeometry,
                }] : undefined}
              />
            )}

            {/* Display polygon when NOT editing */}
            {!isEditing && currentGeometry && (
              <Source
                id="cadastral-polygon"
                type="geojson"
                data={{
                  type: 'Feature',
                  properties: {},
                  geometry: currentGeometry,
                }}
              >
                <Layer
                  id="cadastral-polygon-fill"
                  type="fill"
                  paint={{
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.25,
                  }}
                />
                <Layer
                  id="cadastral-polygon-outline"
                  type="line"
                  paint={{
                    'line-color': '#3b82f6',
                    'line-width': 3,
                  }}
                />
              </Source>
            )}

            {/* Plot center marker - draggable when isMarkerEditing is true (controlled by parent) */}
            <Marker
              longitude={markerPosition.longitude}
              latitude={markerPosition.latitude}
              draggable={isMarkerEditing && !isEditing}
              onDragStart={() => setIsDraggingMarker(true)}
              onDrag={(e) => {
                const newPos = {
                  latitude: e.lngLat.lat,
                  longitude: e.lngLat.lng,
                };
                setMarkerPosition(newPos);
                onMarkerPositionChange?.(newPos);
              }}
              onDragEnd={(e) => {
                setIsDraggingMarker(false);
                const newCenter = {
                  latitude: e.lngLat.lat,
                  longitude: e.lngLat.lng,
                };
                setMarkerPosition(newCenter);
                onMarkerPositionChange?.(newCenter);
              }}
            >
              <div 
                className={`relative ${isMarkerEditing && !isEditing ? 'cursor-move' : ''}`}
                title={isMarkerEditing && !isEditing ? 'Drag to update location' : 'Plot location'}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${
                  isDraggingMarker ? 'bg-amber-500 scale-110' : isMarkerEditing ? 'bg-amber-500' : 'bg-red-500'
                } transition-all`}>
                  {isMarkerEditing && !isEditing ? (
                    <Move className="w-4 h-4 text-white" />
                  ) : (
                    <MapPin className="w-4 h-4 text-white" />
                  )}
                </div>
                {/* Pin pointer */}
                <div className={`absolute left-1/2 -bottom-1 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent -translate-x-1/2 ${
                  isDraggingMarker || isMarkerEditing ? 'border-t-amber-500' : 'border-t-red-500'
                } transition-colors`} />
              </div>
            </Marker>
          </Map>

          {/* Edit mode instructions */}
          {isEditing && (
            <div className="absolute top-2 left-2 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              {editingGeometry 
                ? 'Drag vertices to edit • Click midpoints to add vertices' 
                : 'Click on map to draw polygon vertices • Double-click to finish'}
            </div>
          )}

          {/* Marker editing hint */}
          {isMarkerEditing && !isEditing && (
            <div className="absolute top-2 left-2 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg flex items-center gap-2">
              <Move className="w-3 h-3" />
              Drag the marker to update location • Click Save to confirm
            </div>
          )}

          {/* No geometry hint when not editing */}
          {!isEditing && !currentGeometry && !readOnly && !minimal && (
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg text-center pointer-events-none">
              <p className="text-gray-700 text-sm font-medium">No boundary defined</p>
              <p className="text-xs text-gray-500">Click &quot;Draw Boundary&quot; to create one</p>
            </div>
          )}

          {/* Layer Toggle Menu */}
          {showCadastreLayer && Object.keys(availableLayers).length > 0 && (
            <div className="absolute bottom-2 right-2 z-10">
              <div className="relative">
                <button
                  onClick={() => setShowLayerMenu(!showLayerMenu)}
                  className="bg-white shadow-lg rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200"
                >
                  <Layers className="w-4 h-4" />
                  <span>Layers</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showLayerMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showLayerMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[280px] max-w-[320px] overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Map Layers</p>
                    </div>
                    <div className="py-1 max-h-[200px] sm:max-h-[300px] overflow-y-auto">
                      {Object.entries(availableLayers).map(([layerId, config]) => (
                        <div key={layerId} className="px-3 py-2 hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleLayer(layerId)}
                              className="flex items-center gap-3 flex-1 text-left"
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
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">{config.shortName}</p>
                                <p className="text-xs text-gray-500 truncate">{config.description}</p>
                              </div>
                            </button>
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
            </div>
          )}
        </div>
  );

  // Legend Modal
  const legendModalComponent = legendModal && legendModal.config.legendUrl && (
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
  );

  // Minimal mode - just the map
  if (minimal) {
    return (
      <>
        {mapContent}
        {legendModalComponent}
      </>
    );
  }

  // Full mode with card wrapper
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Cadastral Boundary
          </CardTitle>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={!hasChanges}
                    title="Reset to original"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Delete polygon"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!editingGeometry}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEdit}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  {currentGeometry ? 'Edit Boundary' : 'Draw Boundary'}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Info bar */}
        {(cadastralInfo || showArea) && (
          <div className="px-4 pb-3 flex flex-wrap gap-4 text-sm text-gray-600">
            {cadastralInfo?.reference && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Ref:</span>
                <span>{cadastralInfo.reference}</span>
              </div>
            )}
            {cadastralInfo?.label && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Label:</span>
                <span>{cadastralInfo.label}</span>
              </div>
            )}
            {showArea && calculatedArea !== null && (
              <div className="flex items-center gap-1">
                <Square className="w-4 h-4" />
                <span className="font-medium">Area:</span>
                <span>
                  {calculatedArea >= 10000
                    ? `${(calculatedArea / 10000).toFixed(2)} ha`
                    : `${calculatedArea.toLocaleString()} m²`}
                </span>
              </div>
            )}
            {cadastralInfo?.source && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>Source: {cadastralInfo.source}</span>
              </div>
            )}
          </div>
        )}

        {/* Map */}
        {mapContent}
      </CardContent>
      {legendModalComponent}
    </Card>
  );
}
