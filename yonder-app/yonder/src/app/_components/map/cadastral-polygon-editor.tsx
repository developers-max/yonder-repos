'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Map, { Source, Layer, MapRef, Marker } from 'react-map-gl/mapbox';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { Button } from '@/app/_components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/_components/ui/card';
import { Pencil, Trash2, RotateCcw, Save, MapPin, Square, X, Move } from 'lucide-react';
import DrawControl from './draw-control';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { DEFAULT_ENABLED_LAYERS } from './wms-layers-config';
import { MapLayers } from './map-layers';
import { LayerMenu } from './layer-menu';

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
  
  // State for enabled layers - initialize with defaults
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(() => {
    if (showCadastreLayer) {
      return new Set(DEFAULT_ENABLED_LAYERS[country]);
    }
    return new Set();
  });
  
  // Track if map has loaded (for layer loading priority)
  const [mapInitialized, setMapInitialized] = useState(false);
  
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
  // Only sync when not in marker editing mode to allow user to drag freely
  useEffect(() => {
    if (!isMarkerEditing) {
      setMarkerPosition(center);
    }
  }, [center.latitude, center.longitude, isMarkerEditing]);

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
    setMapInitialized(true);
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
            {/* WMS/Vector/CRUS Layers - using reusable MapLayers component */}
            <MapLayers
              country={country}
              enabledLayers={enabledLayers}
              showCadastreLayer={showCadastreLayer}
              mapRef={mapRef}
              viewState={viewState}
              plotsLoaded={mapInitialized}
              singlePlotMode={true}
            />

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

          {/* Layer Toggle Menu - using reusable LayerMenu component */}
          <div className="absolute bottom-2 right-2 z-10">
            <LayerMenu
              country={country}
              enabledLayers={enabledLayers}
              onToggleLayer={toggleLayer}
              showCadastreLayer={showCadastreLayer}
              position="bottom-right"
            />
          </div>
        </div>
  );

  // Minimal mode - just the map (legend modal now handled by LayerMenu component)
  if (minimal) {
    return mapContent;
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
    </Card>
  );
}
