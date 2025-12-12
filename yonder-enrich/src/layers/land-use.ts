/**
 * Land Use Layer Queries
 * COS (Carta de Ocupação do Solo), CLC (CORINE Land Cover), Built-up Areas
 */

import axios from 'axios';
import { Agent as HttpsAgent } from 'https';
import { LayerResult } from './types';

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
 * Query COS (Carta de Ocupação do Solo) via WMS GetFeatureInfo
 */
export async function queryCOS(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  const layerId = 'pt-cos';
  const layerName = 'Carta de Ocupação do Solo (COS)';

  try {
    const bufferMeters = areaM2 ? Math.sqrt(areaM2) / 2 : 100;
    const delta = bufferMeters / 111320;
    
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const width = 256;
    const height = 256;
    const x = 128;
    const y = 128;

    // DGT COS WMS service
    const wmsUrl = 'https://geo2.dgterritorio.gov.pt/geoserver/COS2018/wms';
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetFeatureInfo',
      LAYERS: 'COS2018:COS2018v2',
      QUERY_LAYERS: 'COS2018:COS2018v2',
      INFO_FORMAT: 'application/json',
      SRS: 'EPSG:4326',
      BBOX: bbox,
      WIDTH: String(width),
      HEIGHT: String(height),
      X: String(x),
      Y: String(y),
    });

    const response = await AX.get(`${wmsUrl}?${params.toString()}`);
    const data = response.data;

    if (!data.features || data.features.length === 0) {
      return { layerId, layerName, found: false };
    }

    const props = data.features[0].properties || {};
    return {
      layerId,
      layerName,
      found: true,
      data: {
        // Most detailed classification (Level 4, or fallback to Level 3)
        cos: props.COS18n4_L || props.COS18n3_L || props.COS2018_Leg || props.Descricao,
        cosCode: props.COS18n4_C || props.COS18n3_C || props.COS2018,
        // Level hierarchy
        cosLevel1: props.COS18n1_L || props.Nivel1,
        cosLevel1Code: props.COS18n1_C,
        cosLevel2: props.COS18n2_L || props.Nivel2,
        cosLevel2Code: props.COS18n2_C,
        cosLevel3: props.COS18n3_L || props.Nivel3,
        cosLevel3Code: props.COS18n3_C,
        cosLevel4: props.COS18n4_L,
        cosLevel4Code: props.COS18n4_C,
        areaHa: props.Area_ha,
        source: 'DGT COS 2018',
      },
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
 * Query CLC (CORINE Land Cover) via WMS GetFeatureInfo
 */
export async function queryCLC(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  const layerId = 'pt-clc';
  const layerName = 'CORINE Land Cover (CLC)';

  try {
    const bufferMeters = areaM2 ? Math.sqrt(areaM2) / 2 : 100;
    const delta = bufferMeters / 111320;
    
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const width = 256;
    const height = 256;
    const x = 128;
    const y = 128;

    // DGT CLC WMS service (CLC 2012 - latest available)
    const wmsUrl = 'https://geo2.dgterritorio.gov.pt/geoserver/CLC/wms';
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetFeatureInfo',
      LAYERS: 'CLC2012',
      QUERY_LAYERS: 'CLC2012',
      INFO_FORMAT: 'application/json',
      SRS: 'EPSG:4326',
      BBOX: bbox,
      WIDTH: String(width),
      HEIGHT: String(height),
      X: String(x),
      Y: String(y),
    });

    const response = await AX.get(`${wmsUrl}?${params.toString()}`);
    const data = response.data;

    if (!data.features || data.features.length === 0) {
      return { layerId, layerName, found: false };
    }

    const props = data.features[0].properties || {};
    return {
      layerId,
      layerName,
      found: true,
      data: {
        // Main classification label
        clc: props.Legenda || props.LABEL3 || props.Label3 || props.Descricao,
        clcCode: props.CLC2012 || props.CODE_18 || props.Code_18,
        areaHa: props.AREA_ha,
        // Fallback level fields (may not be present in all responses)
        clcLevel1: props.LABEL1 || props.Label1,
        clcLevel2: props.LABEL2 || props.Label2,
        clcLevel3: props.Legenda || props.LABEL3 || props.Label3,
        source: 'CORINE Land Cover 2012',
      },
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
 * Query Built-up/Urban Areas via WMS GetFeatureInfo
 */
export async function queryBuiltUpAreas(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  const layerId = 'pt-built-up';
  const layerName = 'Built-up Areas';

  try {
    const bufferMeters = areaM2 ? Math.sqrt(areaM2) / 2 : 100;
    const delta = bufferMeters / 111320;
    
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const width = 256;
    const height = 256;
    const x = 128;
    const y = 128;

    // DGT Urban areas WMS service
    const wmsUrl = 'https://geo2.dgterritorio.gov.pt/geoserver/AE/wms';
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetFeatureInfo',
      LAYERS: 'AreasEdificadas2018',
      QUERY_LAYERS: 'AreasEdificadas2018',
      INFO_FORMAT: 'application/json',
      SRS: 'EPSG:4326',
      BBOX: bbox,
      WIDTH: String(width),
      HEIGHT: String(height),
      X: String(x),
      Y: String(y),
    });

    const response = await AX.get(`${wmsUrl}?${params.toString()}`);
    const data = response.data;

    if (!data.features || data.features.length === 0) {
      return { layerId, layerName, found: false };
    }

    const props = data.features[0].properties || {};
    return {
      layerId,
      layerName,
      found: true,
      data: {
        isBuiltUp: true,
        classification: props.Classe || props.CLASSE || props.Tipo,
        source: 'DGT Solo Urbano',
        attributes: props,
      },
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
 * Query all land use layers in parallel
 */
export async function queryLandUseLayers(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult[]> {
  const [cosResult, clcResult, builtUpResult] = await Promise.all([
    queryCOS(lat, lng, areaM2),
    queryCLC(lat, lng, areaM2),
    queryBuiltUpAreas(lat, lng, areaM2),
  ]);

  return [cosResult, clcResult, builtUpResult];
}
