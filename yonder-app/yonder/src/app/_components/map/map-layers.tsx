'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Source, Layer, MapRef } from 'react-map-gl/mapbox';
import { getWMSLayers, type WMSLayerConfig } from './wms-layers-config';

interface MapLayersProps {
  country: 'PT' | 'ES';
  enabledLayers: Set<string>;
  showCadastreLayer: boolean;
  mapRef: React.RefObject<MapRef | null>;
  viewState: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  plotsLoaded?: boolean; // For priority loading - only fetch layers after plots load
  singlePlotMode?: boolean; // Skip priority loading in single plot mode
}

/**
 * Reusable component for rendering WMS, vector tile, and GeoJSON layers
 * Used by both the main search map and the cadastral polygon editor
 */
export function MapLayers({
  country,
  enabledLayers,
  showCadastreLayer,
  mapRef,
  viewState,
  plotsLoaded = true,
  singlePlotMode = false,
}: MapLayersProps) {
  const [currentMunicipality, setCurrentMunicipality] = useState<string | null>(null);
  const [crusGeoJson, setCrusGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

  // Get available WMS layers for the country (excludes plots pseudo-layer)
  const availableLayers = useMemo(() => {
    const layers = getWMSLayers(country);
    // Remove plots pseudo-layer - that's handled by the parent component
    const { plots, ...otherLayers } = layers;
    return otherLayers as Record<string, WMSLayerConfig>;
  }, [country]);

  // Fetch municipality for current map center (for CRUS layer)
  // PRIORITY: Only fetch after plots are loaded to avoid blocking main content
  useEffect(() => {
    if (!showCadastreLayer || country !== 'PT') return;
    if (!plotsLoaded && !singlePlotMode) return; // Wait for plots to load first

    const fetchMunicipality = async () => {
      try {
        const response = await fetch(
          `/api/municipality-lookup?lat=${viewState.latitude}&lng=${viewState.longitude}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.normalized && data.normalized !== currentMunicipality) {
            setCurrentMunicipality(data.normalized);
          }
        }
      } catch (error) {
        console.error('Municipality lookup failed:', error);
      }
    };

    // Debounce the fetch - longer delay for layer data (lower priority)
    const timer = setTimeout(fetchMunicipality, 800);
    return () => clearTimeout(timer);
  }, [viewState.latitude, viewState.longitude, showCadastreLayer, country, currentMunicipality, plotsLoaded, singlePlotMode]);

  // Fetch CRUS GeoJSON when municipality changes and CRUS layer is enabled
  // PRIORITY: Only fetch after plots are loaded
  useEffect(() => {
    if (!showCadastreLayer || !currentMunicipality || !enabledLayers.has('crus')) {
      setCrusGeoJson(null);
      return;
    }
    if (!plotsLoaded && !singlePlotMode) return; // Wait for plots first

    const fetchCrusData = async () => {
      try {
        // Calculate bbox from current view
        const map = mapRef.current?.getMap();
        if (!map) return;

        const mapBounds = map.getBounds();
        if (!mapBounds) return;

        const bbox = `${mapBounds.getWest()},${mapBounds.getSouth()},${mapBounds.getEast()},${mapBounds.getNorth()}`;

        const response = await fetch(
          `/api/crus-tiles?municipality=${currentMunicipality}&bbox=${bbox}&limit=500`
        );
        if (response.ok) {
          const data = await response.json();
          setCrusGeoJson(data);
        }
      } catch (error) {
        console.error('CRUS data fetch failed:', error);
      }
    };

    // Debounce the fetch - delay for lower priority layer data
    const timer = setTimeout(fetchCrusData, 500);
    return () => clearTimeout(timer);
  }, [currentMunicipality, showCadastreLayer, enabledLayers, viewState.zoom, plotsLoaded, singlePlotMode, mapRef]);

  if (!showCadastreLayer) return null;

  return (
    <>
      {/* CRUS GeoJSON Layer - rendered separately as it uses dynamic GeoJSON (PT only) */}
      {country === 'PT' && enabledLayers.has('crus') && crusGeoJson && crusGeoJson.features?.length > 0 && (
        <Source
          key={`crus-geojson-${currentMunicipality}`}
          id="crus-geojson"
          type="geojson"
          data={crusGeoJson}
        >
          <Layer
            id="crus-fill"
            type="fill"
            paint={{
              'fill-color': ['get', '_color'],
              'fill-opacity': 0.4
            }}
          />
          <Layer
            id="crus-outline"
            type="line"
            paint={{
              'line-color': ['get', '_color'],
              'line-width': 1.5,
              'line-opacity': 0.8
            }}
          />
        </Source>
      )}

      {/* WMS/Vector Tile Layers - dynamically render enabled layers */}
      {Object.entries(availableLayers).map(([layerId, config]) => {
        if (!enabledLayers.has(layerId)) return null;

        // Skip CRUS - it's handled separately as GeoJSON above
        if (layerId === 'crus') return null;

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
    </>
  );
}
