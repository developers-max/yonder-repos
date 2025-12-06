'use client';

import { useEffect, useRef } from 'react';
import { useControl } from 'react-map-gl/mapbox';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { ControlPosition } from 'react-map-gl/mapbox';

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: ControlPosition;
  onCreate?: (evt: { features: GeoJSON.Feature[] }) => void;
  onUpdate?: (evt: { features: GeoJSON.Feature[]; action: string }) => void;
  onDelete?: (evt: { features: GeoJSON.Feature[] }) => void;
  onModeChange?: (evt: { mode: string }) => void;
  onSelectionChange?: (evt: { features: GeoJSON.Feature[] }) => void;
  /** Initial features to load into the draw control */
  initialFeatures?: GeoJSON.Feature[];
  /** Callback to get the draw instance reference */
  onDrawRef?: (draw: MapboxDraw) => void;
};

export default function DrawControl(props: DrawControlProps) {
  const { initialFeatures, onDrawRef, onCreate, onUpdate, onDelete, onModeChange, onSelectionChange, position, ...drawOptions } = props;
  const drawRef = useRef<MapboxDraw | null>(null);
  const featuresLoadedRef = useRef(false);
  
  const draw = useControl<MapboxDraw>(
    () => {
      const drawInstance = new MapboxDraw(drawOptions);
      drawRef.current = drawInstance;
      
      // Store reference if callback provided
      if (onDrawRef) {
        onDrawRef(drawInstance);
      }
      
      return drawInstance;
    },
    ({ map }) => {
      if (onCreate) map.on('draw.create', onCreate);
      if (onUpdate) map.on('draw.update', onUpdate);
      if (onDelete) map.on('draw.delete', onDelete);
      if (onModeChange) map.on('draw.modechange', onModeChange);
      if (onSelectionChange) map.on('draw.selectionchange', onSelectionChange);
    },
    ({ map }) => {
      if (onCreate) map.off('draw.create', onCreate);
      if (onUpdate) map.off('draw.update', onUpdate);
      if (onDelete) map.off('draw.delete', onDelete);
      if (onModeChange) map.off('draw.modechange', onModeChange);
      if (onSelectionChange) map.off('draw.selectionchange', onSelectionChange);
    },
    {
      position: position || 'top-right',
    }
  );

  // Load initial features after control is mounted
  useEffect(() => {
    if (draw && initialFeatures && initialFeatures.length > 0 && !featuresLoadedRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        try {
          // Clear any existing features first
          draw.deleteAll();
          
          initialFeatures.forEach(feature => {
            const ids = draw.add(feature);
            // Select first polygon feature for direct editing
            if (ids.length > 0 && feature.geometry && feature.geometry.type === 'Polygon') {
              draw.changeMode('direct_select', { featureId: ids[0] });
            }
          });
          featuresLoadedRef.current = true;
        } catch (error) {
          console.error('Error loading initial features:', error);
        }
      });
    }
  }, [draw, initialFeatures]);

  return null;
}

export { DrawControl };
