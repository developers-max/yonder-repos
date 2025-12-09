/**
 * Zoning Layer Queries
 * REN, RAN, CRUS - wraps existing crus_lookup.ts and adds REN/RAN queries
 */

import axios from 'axios';
import { Agent as HttpsAgent } from 'https';
import { LayerResult, ZoningData, RenRanData, MunicipalityRecord } from './types';

// Re-export existing CRUS lookup function
export { getCRUSZoningForPoint } from '../enrichments/crus/crus_lookup';

// Import for internal use
import { getCRUSZoningForPoint } from '../enrichments/crus/crus_lookup';

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: false,
});

const AX = axios.create({
  headers: {
    Accept: 'application/json',
    'User-Agent': 'yonder-enrich/1.0',
  },
  timeout: 15000,
  httpsAgent,
});

/**
 * Query CRUS zoning and return as LayerResult
 */
export async function queryCRUSZoning(
  lat: number,
  lng: number
): Promise<LayerResult> {
  const layerId = 'pt-crus';
  const layerName = 'CRUS Zoning';

  try {
    const result = await getCRUSZoningForPoint(lng, lat);

    if (!result) {
      return { layerId, layerName, found: false };
    }

    const zoningData: ZoningData = {
      label: result.label,
      typename: result.collection_id,
      pickedField: result.picked_field,
      municipality: result.municipality,
      rawProperties: result.properties,
      source: 'DGT CRUS (OGC API)',
    };

    return {
      layerId,
      layerName,
      found: true,
      data: zoningData as unknown as Record<string, unknown>,
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

/**
 * Query municipal REN/RAN service via ArcGIS REST API
 */
async function queryMunicipalRenRan(
  lat: number,
  lng: number,
  serviceUrl: string,
  layerId: string,
  layerName: string
): Promise<LayerResult> {
  try {
    // Create small bbox around point (~50m)
    const delta = 0.0005;
    const geometry = JSON.stringify({
      xmin: lng - delta,
      ymin: lat - delta,
      xmax: lng + delta,
      ymax: lat + delta,
      spatialReference: { wkid: 4326 },
    });

    // Query all layers (0-10) to find REN/RAN data
    const identifyUrl = `${serviceUrl}/identify`;
    const params = new URLSearchParams({
      f: 'json',
      geometry,
      geometryType: 'esriGeometryEnvelope',
      sr: '4326',
      layers: 'all:0,1,2,3,4,5,6,7,8,9,10',
      tolerance: '5',
      mapExtent: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`,
      imageDisplay: '256,256,96',
      returnGeometry: 'false',
      returnFieldName: 'true',
      returnUnformattedValues: 'true',
    });

    const response = await AX.get(`${identifyUrl}?${params.toString()}`);
    const data = response.data;
    const results = data.results || [];

    if (results.length === 0) {
      return { layerId, layerName, found: false };
    }

    // Return first matching result
    const result = results[0];
    const renRanData: RenRanData = {
      sourceLayer: result.layerName,
      attributes: result.attributes,
    };

    return {
      layerId,
      layerName,
      found: true,
      data: renRanData as unknown as Record<string, unknown>,
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

/**
 * Query REN (Reserva Ecológica Nacional)
 * Requires municipality record with REN service URL
 */
export async function queryREN(
  lat: number,
  lng: number,
  municipality?: MunicipalityRecord
): Promise<LayerResult> {
  const layerId = 'pt-ren';
  const layerName = 'Reserva Ecológica Nacional';

  if (!municipality?.gisVerified || !municipality.renService?.url) {
    return {
      layerId,
      layerName,
      found: false,
      error: municipality
        ? `No REN service available for ${municipality.name}`
        : 'Municipality not identified',
    };
  }

  return queryMunicipalRenRan(
    lat,
    lng,
    municipality.renService.url,
    layerId,
    `REN - ${municipality.name}`
  );
}

/**
 * Query RAN (Reserva Agrícola Nacional)
 * Requires municipality record with RAN service URL
 */
export async function queryRAN(
  lat: number,
  lng: number,
  municipality?: MunicipalityRecord
): Promise<LayerResult> {
  const layerId = 'pt-ran';
  const layerName = 'Reserva Agrícola Nacional';

  if (!municipality?.gisVerified || !municipality.ranService?.url) {
    return {
      layerId,
      layerName,
      found: false,
      error: municipality
        ? `No RAN service available for ${municipality.name}`
        : 'Municipality not identified',
    };
  }

  return queryMunicipalRenRan(
    lat,
    lng,
    municipality.ranService.url,
    layerId,
    `RAN - ${municipality.name}`
  );
}
