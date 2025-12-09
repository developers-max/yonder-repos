'use client';

import { useState, useCallback, useRef } from 'react';
import Map, { Marker, Source, Layer, MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import { 
  Layers, 
  MapPin, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  Crosshair,
  Loader2
} from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import type { GetLayerInfoResult } from '@/lib/ai/tools/get-layer-info';

import 'mapbox-gl/dist/mapbox-gl.css';

interface LayerInfoResultProps {
  result: GetLayerInfoResult;
  onSearchLocation?: (lat: number, lng: number) => void;
}

export function LayerInfoResultComponent({ result, onSearchLocation }: LayerInfoResultProps) {
  const mapRef = useRef<MapRef>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [droppedPin, setDroppedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPinMode, setIsPinMode] = useState(false);
  
  const isError = !!result.error;
  const data = result.data;
  
  // Get coordinates for map center
  const mapCenter = data?.coordinates || { lat: 39.5, lng: -8.5 };
  const polygon = data?.boundingBox ? null : null; // We'll handle polygon display via source/layer
  
  // Handle map click for dropping pin
  const handleMapClick = useCallback((event: MapMouseEvent) => {
    if (!isPinMode) return;
    
    const { lng, lat } = event.lngLat;
    setDroppedPin({ lat, lng });
    setIsPinMode(false);
  }, [isPinMode]);
  
  // Handle search at dropped pin location
  const handleSearchAtPin = useCallback(async () => {
    if (!droppedPin) return;
    
    setIsSearching(true);
    
    // Dispatch custom event to trigger a new chat message
    window.dispatchEvent(new CustomEvent('chatSendMessage', {
      detail: {
        message: `Query layer information at coordinates ${droppedPin.lat.toFixed(6)}, ${droppedPin.lng.toFixed(6)}`
      }
    }));
    
    // Also call the callback if provided
    if (onSearchLocation) {
      onSearchLocation(droppedPin.lat, droppedPin.lng);
    }
    
    setIsSearching(false);
  }, [droppedPin, onSearchLocation]);
  
  // Layer summary counts
  const layersFound = data?.metadata?.layersFound || 0;
  const layersTotal = data?.metadata?.layersTotal || 0;
  const hasAccurateCoords = data?.metadata?.hasAccurateCoordinates ?? true;
  
  // Group layers by status
  const foundLayers = data?.allLayers?.filter(l => l.found) || [];
  const notFoundLayers = data?.allLayers?.filter(l => !l.found && !l.error) || [];
  const errorLayers = data?.allLayers?.filter(l => l.error) || [];
  
  // Check for important findings
  const hasREN = data?.layers?.ren?.found;
  const hasRAN = data?.layers?.ran?.found;

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl mt-3 overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isError ? 'bg-red-100' : 'bg-emerald-100'}`}>
            {isError ? (
              <XCircle className="w-4 h-4 text-red-600" />
            ) : (
              <Layers className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">
              {isError ? 'Layer Query Failed' : 'Layer Information'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isError 
                ? String(result.error?.details || 'Unknown error')
                : `${layersFound} of ${layersTotal} layers found`
              }
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

        {/* Success state with map */}
        {!isError && data && (
          <div className="space-y-4">
            {/* Accuracy warning */}
            {!hasAccurateCoords && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Using approximate listing coordinates with 200m search radius
                </p>
              </div>
            )}

            {/* Important findings (REN/RAN) */}
            {(hasREN || hasRAN) && (
              <div className="flex flex-wrap gap-2">
                {hasREN && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    <span className="text-xs font-medium text-red-700">REN Present</span>
                  </div>
                )}
                {hasRAN && (
                  <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
                    <AlertTriangle className="w-3 h-3 text-orange-600" />
                    <span className="text-xs font-medium text-orange-700">RAN Present</span>
                  </div>
                )}
              </div>
            )}

            {/* Mini Map */}
            <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height: '200px' }}>
              <Map
                ref={mapRef}
                mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                initialViewState={{
                  longitude: mapCenter.lng,
                  latitude: mapCenter.lat,
                  zoom: data.boundingBox ? 14 : 16
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
                onClick={handleMapClick}
                cursor={isPinMode ? 'crosshair' : 'grab'}
                interactive={true}
              >
                {/* Query location marker */}
                <Marker
                  longitude={data.coordinates.lng}
                  latitude={data.coordinates.lat}
                  anchor="center"
                >
                  <div className="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-lg" />
                </Marker>

                {/* Bounding box visualization */}
                {data.boundingBox && (
                  <Source
                    id="bbox"
                    type="geojson"
                    data={{
                      type: 'Feature',
                      properties: {},
                      geometry: {
                        type: 'Polygon',
                        coordinates: [[
                          [data.boundingBox.minLng, data.boundingBox.minLat],
                          [data.boundingBox.maxLng, data.boundingBox.minLat],
                          [data.boundingBox.maxLng, data.boundingBox.maxLat],
                          [data.boundingBox.minLng, data.boundingBox.maxLat],
                          [data.boundingBox.minLng, data.boundingBox.minLat],
                        ]]
                      }
                    }}
                  >
                    <Layer
                      id="bbox-fill"
                      type="fill"
                      paint={{
                        'fill-color': '#10b981',
                        'fill-opacity': 0.1
                      }}
                    />
                    <Layer
                      id="bbox-line"
                      type="line"
                      paint={{
                        'line-color': '#10b981',
                        'line-width': 2,
                        'line-dasharray': [2, 2]
                      }}
                    />
                  </Source>
                )}

                {/* Dropped pin marker */}
                {droppedPin && (
                  <Marker
                    longitude={droppedPin.lng}
                    latitude={droppedPin.lat}
                    anchor="bottom"
                  >
                    <MapPin className="w-6 h-6 text-blue-600 drop-shadow-lg" fill="#3b82f6" />
                  </Marker>
                )}
              </Map>

              {/* Map controls overlay */}
              <div className="absolute top-2 right-2 flex flex-col gap-2">
                <Button
                  size="sm"
                  variant={isPinMode ? "default" : "secondary"}
                  className="h-8 w-8 p-0 shadow-md"
                  onClick={() => setIsPinMode(!isPinMode)}
                  title={isPinMode ? "Cancel pin drop" : "Drop a pin"}
                >
                  <Crosshair className="w-4 h-4" />
                </Button>
              </div>

              {/* Pin mode indicator */}
              {isPinMode && (
                <div className="absolute bottom-2 left-2 right-2 bg-blue-600 text-white text-xs py-2 px-3 rounded-lg text-center shadow-lg">
                  Click on the map to drop a pin
                </div>
              )}
            </div>

            {/* Search at pin button */}
            {droppedPin && (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-700">
                    <span className="font-medium">Pin location:</span>{' '}
                    {droppedPin.lat.toFixed(6)}, {droppedPin.lng.toFixed(6)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleSearchAtPin}
                  disabled={isSearching}
                  className="gap-1.5"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search Here
                </Button>
              </div>
            )}

            {/* Layer summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                </div>
                <p className="text-lg font-semibold text-emerald-700">{foundLayers.length}</p>
                <p className="text-xs text-emerald-600">Found</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle className="w-3 h-3 text-gray-400" />
                </div>
                <p className="text-lg font-semibold text-gray-600">{notFoundLayers.length}</p>
                <p className="text-xs text-gray-500">Not Found</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                </div>
                <p className="text-lg font-semibold text-red-600">{errorLayers.length}</p>
                <p className="text-xs text-red-500">Errors</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Layer details accordion */}
      {!isError && data && (
        <div className="border-t border-gray-100">
          <div
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 text-sm">View layer details</span>
              <ChevronDown 
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                  isDetailsOpen ? 'rotate-180' : ''
                }`} 
              />
            </div>
          </div>
          
          {isDetailsOpen && (
            <div className="px-5 pb-4 space-y-4">
              {/* Found layers */}
              {foundLayers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Data Found</p>
                  <div className="space-y-2">
                    {foundLayers.map((layer, idx) => (
                      <div key={idx} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-800">{layer.layerName}</span>
                        </div>
                        {layer.data && (
                          <pre className="text-xs text-emerald-700 bg-emerald-100/50 rounded p-2 overflow-x-auto mt-2">
                            {JSON.stringify(layer.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Not found layers */}
              {notFoundLayers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">No Data</p>
                  <div className="flex flex-wrap gap-1">
                    {notFoundLayers.map((layer, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {layer.layerName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Error layers */}
              {errorLayers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Errors</p>
                  <div className="space-y-1">
                    {errorLayers.map((layer, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-red-600">
                        <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span><strong>{layer.layerName}:</strong> {layer.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coordinates info */}
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Query Details</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Coordinates:</span>{' '}
                    {data.coordinates.lat.toFixed(6)}, {data.coordinates.lng.toFixed(6)}
                  </div>
                  <div>
                    <span className="font-medium">Country:</span> {data.country}
                  </div>
                  {data.areaM2 && (
                    <div>
                      <span className="font-medium">Area:</span> {data.areaM2.toLocaleString()} m²
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Source:</span> {data.metadata.source}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
