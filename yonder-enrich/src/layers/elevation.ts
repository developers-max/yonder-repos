/**
 * Elevation Layer Query
 * Uses Open-Elevation API for terrain height data
 */

import axios from 'axios';
import { LayerResult, ElevationData } from './types';

const AX = axios.create({
  headers: {
    Accept: 'application/json',
    'User-Agent': 'yonder-enrich/1.0',
  },
  timeout: 15000,
});

/**
 * Query elevation from Open-Elevation API
 */
export async function queryElevation(
  lat: number,
  lng: number
): Promise<LayerResult> {
  const layerId = 'elevation';
  const layerName = 'Elevation';

  try {
    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
    const response = await AX.get(url);
    const data = response.data;

    const elevation = data.results?.[0]?.elevation;

    if (elevation === undefined) {
      return { layerId, layerName, found: false };
    }

    const elevationData: ElevationData = {
      elevationM: elevation,
      source: 'SRTM/Open-Elevation',
    };

    return {
      layerId,
      layerName,
      found: true,
      data: elevationData as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return {
      layerId,
      layerName,
      found: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
