'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Map, { Marker, Popup, MapRef, Source, Layer } from 'react-map-gl/mapbox';
import { trpc } from '@/trpc/client';
import { Card, CardContent } from '@/app/_components/ui/card';
import { Badge } from '@/app/_components/ui/badge';
import { MapPin, Square, Loader2, X, Navigation, Trash2 } from 'lucide-react';
import type { PlotFilters, EnrichmentData } from '@/server/trpc/router/plot/plots';
import Image from 'next/image';
import Supercluster from 'supercluster';

// Mapbox CSS
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/app/_components/ui/button';
import { getWMSLayers, DEFAULT_ENABLED_LAYERS, detectCountryFromCoordinates } from '@/app/_components/map/wms-layers-config';
import { MapLayers } from '@/app/_components/map/map-layers';
import { LayerMenu } from '@/app/_components/map/layer-menu';

interface PlotsMapProps {
  filters: Partial<PlotFilters>;
  onPlotClick: (plotId: string) => void;
  onBoundsChange?: (center: { latitude: number; longitude: number }, radiusKm: number) => void;
  resizeKey?: number; // Simple prop to trigger resize
  shouldZoomToLocation?: boolean; // Flag to zoom to location when filters applied via event
  onZoomComplete?: () => void; // Callback when zoom is complete
  singlePlotMode?: boolean; // New: Show single plot mode
  singlePlot?: {
    id: string;
    latitude: number;
    longitude: number;
    price: number;
    size: number | null;
    images: string[] | null;
  }; // New: Single plot data
  showCadastreLayer?: boolean; // Show cadastre WMS layers
  cadastreData?: {
    parcel?: {
      area_value: number;
      label: string;
      reference_point?: {
        coordinates: [number, number];
      };
    };
  }; // Cadastre data for parcel boundary
  country?: 'ES' | 'PT'; // Country code for cadastre layer
  droppedPin?: { latitude: number; longitude: number; label?: string } | null; // Pin dropped from chat navigation
  onPinDrop?: (coords: { latitude: number; longitude: number }) => void; // Callback when user drops a pin
  onPinRemove?: () => void; // Callback when user removes the pin
  enablePinDrop?: boolean; // Enable interactive pin drop mode
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface JitteredPlot {
  latitude: number;
  longitude: number;
  price: number;
  size: number | null;
  id: string;
  enrichmentData: EnrichmentData | null;
  images: string[] | null;
  distanceKm?: number | null;
  originalCoordinates?: {
    latitude: number;
    longitude: number;
  };
  isJittered?: boolean;
  plotsAtLocation?: number;
  organizationPlotId?: string | null;
  organizationPlotStatus?: string | null;
}

export default function PlotsMap({ filters, onPlotClick, onBoundsChange, resizeKey, shouldZoomToLocation, onZoomComplete, singlePlotMode = false, singlePlot, showCadastreLayer = false, cadastreData, country = 'PT', droppedPin, onPinDrop, onPinRemove, enablePinDrop = false }: PlotsMapProps) {
  const mapRef = useRef<MapRef>(null);
  
  // Initialize view state based on mode
  const [viewState, setViewState] = useState(() => {
    if (singlePlotMode && singlePlot) {
      return {
        longitude: singlePlot.longitude,
        latitude: singlePlot.latitude,
        zoom: 16 // Good zoom level for single plot view
      };
    }
    return {
      longitude: -8.5, // Center of Portugal
      latitude: 39.5,
      zoom: 6
    };
  });
  
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [debouncedBounds, setDebouncedBounds] = useState<MapBounds | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [selectedPlotData, setSelectedPlotData] = useState<JitteredPlot | null>(null);
  const [pinDropMode, setPinDropMode] = useState(false); // Interactive pin drop mode
  const [isDraggingPin, setIsDraggingPin] = useState(false); // Track if pin is being dragged
  
  // Detect country from viewport coordinates (dynamic switching between PT/ES layers)
  const detectedCountry = useMemo(() => {
    // In single plot mode, use the passed country prop
    if (singlePlotMode) return country;
    // Otherwise detect from viewport center
    return detectCountryFromCoordinates(viewState.latitude, viewState.longitude);
  }, [viewState.latitude, viewState.longitude, singlePlotMode, country]);
  
  // Track if plots have finished initial load (for layer loading priority)
  const [plotsLoaded, setPlotsLoaded] = useState(false);
  
  // State for enabled layers - initialize with defaults when cadastre layer is shown
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(() => {
    if (showCadastreLayer) {
      return new Set(DEFAULT_ENABLED_LAYERS[country]);
    }
    return new Set();
  });
  
  // Track previous country to detect country changes
  const prevCountryRef = useRef(detectedCountry);
  
  // Update enabled layers when country changes (reset to defaults for new country)
  useEffect(() => {
    if (prevCountryRef.current !== detectedCountry) {
      prevCountryRef.current = detectedCountry;
      // Keep plots layer enabled, reset other layers to defaults for new country
      const newLayers = new Set(DEFAULT_ENABLED_LAYERS[detectedCountry]);
      // Preserve plots layer state
      if (enabledLayers.has('plots')) {
        newLayers.add('plots');
      }
      setEnabledLayers(newLayers);
    }
  }, [detectedCountry, enabledLayers]);
  
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
  
  // Keep track of previous clusters to avoid removing markers during loading
  const previousClustersRef = useRef<Supercluster.PointFeature<Supercluster.AnyProps>[]>([]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Debounce bounds changes and sync to filters (one-way: map → filters)
  useEffect(() => {
    if (!bounds) return;
    
    const timer = setTimeout(() => {
      setDebouncedBounds(bounds);
      
      // Calculate center and radius for filter sync
      if (onBoundsChange) {
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLng = (bounds.east + bounds.west) / 2;
        
        // Calculate radius as distance from center to furthest corner
        const radiusKm = Math.max(
          calculateDistance(centerLat, centerLng, bounds.north, bounds.east),
          calculateDistance(centerLat, centerLng, bounds.south, bounds.west)
        );
        
        onBoundsChange({ latitude: centerLat, longitude: centerLng }, Math.ceil(radiusKm));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [bounds, onBoundsChange, calculateDistance]);

  // Create map filters with bounds instead of radius
  const mapFilters = useMemo(() => {
    if (!debouncedBounds) return null;
    
    // Extract and ignore radius-based filters for map view
    const { latitude, longitude, radiusKm, ...otherFilters } = filters;
    void latitude; void longitude; void radiusKm; // Explicitly mark as used
    
    return {
      ...otherFilters,
      bounds: debouncedBounds,
      limit: 1000, // Always limit to 1000 for map view
      page: 1
    };
  }, [debouncedBounds, filters]);

  // Fetch plots for map bounds (skip in single plot mode)
  const { data: plotsData, isLoading } = trpc.plots.searchPlots.useQuery(
    mapFilters as PlotFilters,
    { enabled: !!mapFilters && !singlePlotMode }
  );

  // Track when plots finish loading (for layer loading priority)
  useEffect(() => {
    if (!isLoading && plotsData) {
      setPlotsLoaded(true);
    }
  }, [isLoading, plotsData]);

  // Function to add small offset to overlapping coordinates
  const addJitterToOverlappingCoordinates = useCallback((plots: JitteredPlot[]): JitteredPlot[] => {
    if (!plots || plots.length === 0) return [];
    
    const coordinateMap: { [key: string]: JitteredPlot[] } = {};
    
    // Group plots by exact coordinates
    plots.forEach(plot => {
      const key = `${plot.latitude.toFixed(6)},${plot.longitude.toFixed(6)}`;
      if (!coordinateMap[key]) {
        coordinateMap[key] = [];
      }
      coordinateMap[key].push(plot);
    });

    // Add small random offset to overlapping plots
    const result: JitteredPlot[] = [];
    Object.values(coordinateMap).forEach((plotsAtLocation) => {
      if (plotsAtLocation.length === 1) {
        // Single plot, no offset needed
        result.push(plotsAtLocation[0]);
      } else {
        // Multiple plots at same location - add small circular offset
        plotsAtLocation.forEach((plot: JitteredPlot, index: number) => {
          const offsetDistance = 0.0001; // ~10 meters offset
          const angle = (index / plotsAtLocation.length) * 2 * Math.PI;
          const offsetLat = offsetDistance * Math.cos(angle);
          const offsetLng = offsetDistance * Math.sin(angle);
          
          result.push({
            ...plot,
            latitude: plot.latitude + offsetLat,
            longitude: plot.longitude + offsetLng,
            originalCoordinates: {
              latitude: plot.latitude,
              longitude: plot.longitude
            },
            isJittered: true,
            plotsAtLocation: plotsAtLocation.length
          });
        });
      }
    });

    return result;
  }, []);

  // Get processed plots for popup access
  const processedPlots = useMemo(() => {
    if (singlePlotMode && singlePlot) {
      // In single plot mode, just use the provided plot
      return [singlePlot as JitteredPlot];
    }
    if (plotsData?.plots) {
      return addJitterToOverlappingCoordinates(plotsData.plots as JitteredPlot[]);
    }
    return [];
  }, [plotsData?.plots, addJitterToOverlappingCoordinates, singlePlotMode, singlePlot]);

  // Initialize supercluster
  const supercluster = useMemo(() => {
    const cluster = new Supercluster({
      radius: 60,
      maxZoom: 15,
      minZoom: 0,
      minPoints: 2,
    });

    if (processedPlots.length > 0) {      
      const points = processedPlots.map(plot => ({
        type: 'Feature' as const,
        properties: {
          cluster: false,
          plotId: plot.id,
          plot: plot
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [plot.longitude, plot.latitude]
        }
      }));

      cluster.load(points);
    }

    return cluster;
  }, [processedPlots]);

  // Get clusters for current viewport - keep previous clusters during loading
  const clusters = useMemo(() => {
    // In single plot mode, return the plot as a single point (no clustering)
    if (singlePlotMode && singlePlot) {
      return [{
        type: 'Feature' as const,
        properties: {
          cluster: false,
          plotId: singlePlot.id,
          plot: singlePlot
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [singlePlot.longitude, singlePlot.latitude]
        }
      }];
    }

    // Guard against invalid bounds or uninitialized supercluster
    if (!bounds) {
      return previousClustersRef.current;
    }

    // Check if we have valid plot data
    const hasPlots = plotsData && plotsData.plots && plotsData.plots.length > 0;

    // If we're loading and don't have new data yet, keep showing previous clusters
    if (isLoading && !hasPlots) {
      return previousClustersRef.current;
    }

    // If we have no data at all, clear previous clusters and return empty
    if (!hasPlots) {
      previousClustersRef.current = [];
      return [];
    }

    // Validate bounds values
    if (
      typeof bounds.west !== 'number' || 
      typeof bounds.south !== 'number' || 
      typeof bounds.east !== 'number' || 
      typeof bounds.north !== 'number' ||
      !isFinite(bounds.west) || !isFinite(bounds.south) || 
      !isFinite(bounds.east) || !isFinite(bounds.north)
    ) {
      return previousClustersRef.current;
    }

    // Validate zoom level
    const zoom = Math.floor(viewState.zoom);
    if (!isFinite(zoom) || zoom < 0 || zoom > 24) {
      return previousClustersRef.current;
    }

    try {
      const newClusters = supercluster.getClusters(
        [bounds.west, bounds.south, bounds.east, bounds.north],
        zoom
      );
      
      // Store the new clusters as previous for next time
      previousClustersRef.current = newClusters;
      return newClusters;
    } catch (error) {
      console.error('Supercluster getClusters error:', error);
      return previousClustersRef.current;
    }
  }, [supercluster, bounds, viewState.zoom, plotsData, isLoading, singlePlotMode, singlePlot]);

  // Handle map move - suppress any for complex mapbox types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMove = useCallback((evt: { viewState: typeof viewState; target?: any }) => {
    setViewState(evt.viewState);
    
    // Update bounds from map instance
    if (evt.target?.getBounds) {
      try {
        const mapBounds = evt.target.getBounds();
        if (mapBounds) {
          setBounds({
            north: mapBounds.getNorth(),
            south: mapBounds.getSouth(),
            east: mapBounds.getEast(),
            west: mapBounds.getWest()
          });
        }
      } catch (error) {
        console.error('Error getting map bounds:', error);
      }
    }
  }, []);

  // Handle map load to set initial bounds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLoad = useCallback((evt: { target: any }) => {
    try {
      const map = evt.target;
      const mapBounds = map.getBounds();
      if (mapBounds) {
        setBounds({
          north: mapBounds.getNorth(),
          south: mapBounds.getSouth(),
          east: mapBounds.getEast(),
          west: mapBounds.getWest()
        });
      }
    } catch (error) {
      console.error('Error setting initial bounds:', error);
    }
  }, []);

  // Handle map click for pin drop
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapClick = useCallback((evt: any) => {
    // Only handle click if pin drop mode is actively toggled on
    if (!pinDropMode) return;
    
    // Get coordinates from click event
    const { lngLat } = evt;
    if (lngLat && onPinDrop) {
      onPinDrop({
        latitude: lngLat.lat,
        longitude: lngLat.lng
      });
      // Exit pin drop mode after dropping - user must click button again to drop another
      setPinDropMode(false);
    }
  }, [pinDropMode, onPinDrop]);

  // Handle pin drag end
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePinDragEnd = useCallback((evt: any) => {
    const { lngLat } = evt;
    if (lngLat && onPinDrop) {
      onPinDrop({
        latitude: lngLat.lat,
        longitude: lngLat.lng
      });
    }
    setIsDraggingPin(false);
  }, [onPinDrop]);

  // Handle cluster click with smooth flyTo
  const handleClusterClick = useCallback((clusterId: number, longitude: number, latitude: number) => {
    try {
      let targetZoom;
      
      // Try to get the proper expansion zoom, but fall back to simple zoom-in if it fails
      try {
        targetZoom = supercluster.getClusterExpansionZoom(clusterId);
      } catch {
        // If supercluster methods fail (during loading), just zoom in by 2 levels
        targetZoom = Math.min(viewState.zoom + 2, 20);
      }
      
      // Use native Mapbox GL JS flyTo for smooth animation
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [longitude, latitude],
          zoom: Math.min(targetZoom, 20),
          duration: 1000, // 1 second smooth transition
          essential: true // Animation won't be skipped if user has reduced motion
        });
      }
    } catch (error) {
      console.error('Error during cluster click:', error);
    }
  }, [supercluster, viewState.zoom]);

  // Format distance helper
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Get enrichment info
  const getEnrichmentInfo = (enrichmentData: EnrichmentData) => {
    if (!enrichmentData) return [];
    
    const info = [];
    if (enrichmentData.beach?.distance) {
      info.push({ type: 'Beach', distance: enrichmentData.beach.distance });
    }
    if (enrichmentData.cafe?.distance) {
      info.push({ type: 'Café', distance: enrichmentData.cafe.distance });
    }
    if (enrichmentData.supermarket?.distance) {
      info.push({ type: 'Supermarket', distance: enrichmentData.supermarket.distance });
    }
    if (enrichmentData.public_transport?.distance) {
      info.push({ type: 'Transport', distance: enrichmentData.public_transport.distance });
    }
    
    return info.sort((a, b) => a.distance - b.distance).slice(0, 3);
  };

  // Trigger resize when resizeKey changes
  useEffect(() => {
    if (resizeKey && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.resize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [resizeKey]);

  // Handle window resize events
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Zoom to location when filters are applied via window event
  useEffect(() => {
    if (shouldZoomToLocation && filters.latitude && filters.longitude && mapRef.current) {
      const targetZoom = 12; // Good zoom level for plot searching
      
      mapRef.current.flyTo({
        center: [filters.longitude, filters.latitude],
        zoom: targetZoom,
        duration: 2000, // 2 second smooth transition
        essential: true
      });
      
      // Call completion callback after animation
      if (onZoomComplete) {
        setTimeout(onZoomComplete, 2000);
      }
    }
  }, [shouldZoomToLocation, filters.latitude, filters.longitude, onZoomComplete]);

  return (
    <div className="relative w-full h-full">
      {/* CSS overrides for Mapbox popup styling */}
      <style>{`
        .mapboxgl-popup {
          max-width: none !important;
        }
        
        .mapboxgl-popup-content {
          background: transparent !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
          border: none !important;
        }
        
        .mapboxgl-popup-close-button {
          display: none !important;
        }
        
        .mapboxgl-popup-tip {
          display: none !important;
        }
      `}</style>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onLoad={handleLoad}
        onClick={handleMapClick}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        cursor={pinDropMode ? 'crosshair' : undefined}
      >
        {/* Plot markers - only shown when 'plots' layer is enabled */}
        {enabledLayers.has('plots') && clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count } = cluster.properties;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={longitude}
                latitude={latitude}
              >
                <div className="cluster-marker">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm sm:text-base font-semibold shadow-lg cursor-pointer hover:bg-blue-600 transition-colors border-2 border-white"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleClusterClick(cluster.id as number, longitude, latitude);
                    }}
                  >
                    {point_count}
                  </div>
                </div>
              </Marker>
            );
          }

          const plot = cluster.properties.plot as JitteredPlot;
          return (
            <Marker
              key={plot.id}
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
            >
              <div className="plot-marker flex flex-col items-center">
                <div 
                  className={`bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1 transition-shadow ${
                    singlePlotMode ? '' : 'cursor-pointer hover:shadow-xl'
                  }`}
                  onClick={singlePlotMode ? undefined : (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setSelectedPlot(plot.id);
                    setSelectedPlotData(plot);
                  }}
                >
                  <span className="text-sm font-semibold text-gray-900">
                    €{plot.price.toLocaleString()}
                  </span>
                </div>
                {/* Pin pointer showing exact location */}
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white -mt-[1px] drop-shadow-sm" />
                
                {/* Indicator for multiple plots at same location (not shown in single plot mode) */}
                {!singlePlotMode && plot.isJittered && plot.plotsAtLocation && plot.plotsAtLocation > 1 && (
                  <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-md">
                    {plot.plotsAtLocation}
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

        {/* Cadastral Parcel Reference Point Marker */}
        {showCadastreLayer && singlePlot && cadastreData?.parcel?.reference_point && (
          <Marker
            longitude={cadastreData.parcel.reference_point.coordinates[0]}
            latitude={cadastreData.parcel.reference_point.coordinates[1]}
          >
            <div className="relative">
              <div className="bg-orange-500 text-white rounded-full shadow-lg border-2 border-white px-3 py-1.5 text-xs font-semibold">
                Parcel {cadastreData.parcel.label}
              </div>
              {/* Pin pointer */}
              <div className="absolute left-1/2 -bottom-1.5 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-orange-500 -translate-x-1/2 drop-shadow-md" />
            </div>
          </Marker>
        )}

        {/* Dropped Pin - Draggable when onPinDrop is provided */}
        {droppedPin && (
          <Marker
            longitude={droppedPin.longitude}
            latitude={droppedPin.latitude}
            anchor="bottom"
            draggable={!!onPinDrop}
            onDragStart={() => setIsDraggingPin(true)}
            onDragEnd={handlePinDragEnd}
          >
            <div className={`relative animate-in fade-in-0 zoom-in-50 duration-300 ${onPinDrop ? 'cursor-grab active:cursor-grabbing' : ''}`}>
              <div className="flex flex-col items-center">
                {/* Pin label or coordinates */}
                <div className="bg-purple-600 text-white rounded-lg shadow-lg px-3 py-1.5 text-xs font-semibold mb-1 whitespace-nowrap flex items-center gap-2">
                  {droppedPin.label || `${droppedPin.latitude.toFixed(5)}, ${droppedPin.longitude.toFixed(5)}`}
                  {/* Remove pin button */}
                  {onPinRemove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinRemove();
                      }}
                      className="ml-1 p-0.5 hover:bg-purple-700 rounded transition-colors"
                      title="Remove pin"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {/* Pin icon */}
                <div className={`w-8 h-8 bg-purple-600 rounded-full border-3 border-white shadow-xl flex items-center justify-center transition-transform ${isDraggingPin ? 'scale-110' : ''}`}>
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
                {/* Pin pointer */}
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-purple-600 -mt-1 drop-shadow-md" />
              </div>
            </div>
          </Marker>
        )}

        {/* WMS/Vector/CRUS Layers - using reusable MapLayers component */}
        <MapLayers
          country={detectedCountry}
          enabledLayers={enabledLayers}
          showCadastreLayer={showCadastreLayer}
          mapRef={mapRef}
          viewState={viewState}
          plotsLoaded={plotsLoaded}
          singlePlotMode={singlePlotMode}
        />

        {/* Parcel boundary circle */}
        {showCadastreLayer && singlePlot && cadastreData?.parcel?.area_value && (() => {
          const center = cadastreData.parcel.reference_point?.coordinates 
            ? [cadastreData.parcel.reference_point.coordinates[0], cadastreData.parcel.reference_point.coordinates[1]]
            : [singlePlot.longitude, singlePlot.latitude];
          
          // Calculate radius in meters
          const radiusMeters = Math.sqrt(cadastreData.parcel.area_value / Math.PI);
          
          // Create circle polygon (approximate circle with 64 points)
          const points = 64;
          const coords = [];
          const distanceX = radiusMeters / (111320 * Math.cos(center[1] * Math.PI / 180));
          const distanceY = radiusMeters / 110574;
          
          for (let i = 0; i <= points; i++) {
            const theta = (i / points) * (2 * Math.PI);
            const x = distanceX * Math.cos(theta);
            const y = distanceY * Math.sin(theta);
            coords.push([center[0] + x, center[1] + y]);
          }
          
          return (
            <Source
              key="parcel-boundary"
              id="parcel-boundary"
              type="geojson"
              data={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Polygon',
                  coordinates: [coords]
                }
              }}
            >
              <Layer
                id="parcel-circle-fill"
                type="fill"
                paint={{
                  'fill-color': '#ffd700',
                  'fill-opacity': 0.25
                }}
              />
              <Layer
                id="parcel-circle-outline"
                type="line"
                paint={{
                  'line-color': '#ff8c00',
                  'line-width': 3,
                  'line-opacity': 0.9
                }}
              />
            </Source>
          );
        })()}

        {/* Popup for selected plot (disabled in single plot mode) */}
        {!singlePlotMode && selectedPlot && selectedPlotData && (
          <Popup
            longitude={selectedPlotData.longitude}
            latitude={selectedPlotData.latitude}
            anchor="bottom"
            onClose={() => {
              setSelectedPlot(null);
              setSelectedPlotData(null);
            }}
            closeOnClick={true}
          >
            <div className="w-56 sm:w-64">
              <Card className="border shadow-lg mb-6 gap-3 rounded-3xl overflow-hidden">
                <div className="relative">
                  {/* Close button */}
                  <button
                    onClick={() => {
                      setSelectedPlot(null);
                      setSelectedPlotData(null);
                    }}
                    className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-1 shadow-md transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4 text-neutral-600" />
                  </button>
                  
                  {selectedPlotData.images && selectedPlotData.images.length > 0 ? (
                    <div className="aspect-[4/3] overflow-hidden rounded-t-lg">
                      <Image 
                        width={256}
                        height={192}
                        src={selectedPlotData.images[0]} 
                        alt="Plot image"
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center rounded-t-lg">
                      <MapPin className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <CardContent className="p-3 pt-0">
                  <div className="space-y-2">
                    {/* Jittered plot indicator */}
                    {selectedPlotData.isJittered && selectedPlotData.plotsAtLocation && selectedPlotData.plotsAtLocation > 1 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs">
                        <div className="flex items-center gap-1 text-orange-700">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="font-medium">
                            {selectedPlotData.plotsAtLocation} plots at this location
                          </span>
                        </div>
                        <div className="text-orange-600 mt-1">
                          Position slightly adjusted for visibility
                        </div>
                      </div>
                    )}

                    {/* Price and Size */}
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">
                        €{selectedPlotData.price.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Square className="w-3 h-3" />
                        {selectedPlotData.size ? selectedPlotData.size.toLocaleString() + 'm²' : 'Size N/A'}
                      </div>
                    </div>

                    {/* Enrichment Info */}
                    {selectedPlotData.enrichmentData && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Nearby:</div>
                        <div className="flex flex-wrap gap-1">
                          {getEnrichmentInfo(selectedPlotData.enrichmentData as EnrichmentData).map((info, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {info.type}: {formatDistance(info.distance)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View Details Button */}
                    <Button
                      onClick={() => onPlotClick(selectedPlotData.id)}
                      className="w-full mt-2"
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Popup>
        )}
      </Map>

      {/* Loading indicator (hide in single plot mode) */}
      {!singlePlotMode && isLoading && (
        <div className="absolute animate-in fade-in-0 duration-300 slide-in-from-top-3 top-2 sm:top-4 left-2 sm:left-4 bg-white rounded-lg shadow-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm flex items-center">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading plots...
        </div>
      )}

      {/* Results count (hide in single plot mode) */}
      {!singlePlotMode && plotsData && (
        <div className="absolute animate-in fade-in-0 duration-400 top-2 sm:top-4 right-2 sm:right-4 bg-white rounded-lg shadow-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
          {plotsData.plots.length} plots shown
          {plotsData.plots.length >= 1000 && ' (max 1000)'}
        </div>
      )}

      {/* Pin Drop Button - bottom-left */}
      {enablePinDrop && (
        <div className="absolute bottom-12 left-2 z-10 flex gap-2">
          <button
            onClick={() => setPinDropMode(!pinDropMode)}
            className={`shadow-lg rounded-lg px-2 sm:px-3 py-2 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors border ${
              pinDropMode 
                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
            title={pinDropMode ? 'Click on map to drop pin' : 'Drop a pin on map'}
          >
            <Navigation className={`w-4 h-4 ${pinDropMode ? 'animate-pulse' : ''}`} />
            <span>{pinDropMode ? 'Tap map' : 'Pin'}</span>
          </button>
          {droppedPin && onPinRemove && (
            <button
              onClick={onPinRemove}
              className="bg-white shadow-lg rounded-lg px-2 sm:px-3 py-2 flex items-center gap-1.5 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 border border-gray-200"
              title="Remove pin"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Layer Toggle Menu - using reusable LayerMenu component */}
      <div className="absolute bottom-2 left-2 z-10">
        <LayerMenu
          country={detectedCountry}
          enabledLayers={enabledLayers}
          onToggleLayer={toggleLayer}
          showCadastreLayer={showCadastreLayer}
          position="bottom-left"
        />
      </div>
    </div>
  );
} 