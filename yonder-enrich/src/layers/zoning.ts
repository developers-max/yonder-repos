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
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Don't retry on 4xx errors (client errors)
      if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 400 && error.response.status < 500) {
        throw lastError;
      }
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// DGT National SRUP WFS endpoints (fallback when municipal services unavailable)
// Reference: https://ogcapi.dgterritorio.gov.pt/collections/point/items/{record-id}
const DGT_SRUP_WFS = {
  REN: 'https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_PT1/WFService.aspx',
  RAN: 'https://servicos.dgterritorio.pt/SDISNITWFSSRUP_RAN_PT1/WFService.aspx',
  // Regional REN services (faster than national)
  REN_NORTE: 'https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_NORTE/WFService.aspx',
  REN_CENTRO: 'https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_CENTRO/WFService.aspx',
  REN_LVT: 'https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_LVT/WFService.aspx',
  REN_ALENTEJO: 'https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_ALENTEJO/WFService.aspx',
  REN_ALGARVE: 'https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_ALGARVE/WFService.aspx',
};

// Layer names from WFS GetCapabilities
const DGT_WFS_LAYERS = {
  REN: 'gmgml:REN_Nacional',
  RAN: 'gmgml:RAN',
};

/**
 * Query national DGT SRUP WFS service for REN/RAN
 * Uses WFS GetFeature with FILTER by municipality (CONCELHO)
 * Note: DGT services use Intergraph GeoMedia WFS, not GeoServer - CQL_FILTER not supported
 */
async function queryNationalSRUPWFS(
  lat: number,
  lng: number,
  wfsUrl: string,
  typeName: string,
  layerId: string,
  layerName: string,
  municipalityName?: string
): Promise<LayerResult> {
  try {
    // Build WFS request - filter by municipality if available (much faster than spatial filter)
    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: typeName,
      outputFormat: 'application/vnd.geo+json',
      count: '10',
    });

    // Add municipality filter if available (FES 2.0 XML filter)
    if (municipalityName) {
      const filter = `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>CONCELHO</fes:ValueReference><fes:Literal>${municipalityName.toUpperCase()}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`;
      params.set('FILTER', filter);
    }

    const response = await withRetry(
      () => AX.get(`${wfsUrl}?${params.toString()}`, {
        timeout: 45000, // Longer timeout for slow national services
      }),
      1, // 1 retry (2 total attempts)
      2000 // 2s initial delay
    );
    
    const data = response.data;
    
    // Check if we got valid GeoJSON
    if (!data || data.type !== 'FeatureCollection') {
      return { layerId, layerName, found: false, error: 'Invalid response from WFS' };
    }

    const features = data.features || [];
    if (features.length === 0) {
      return { layerId, layerName, found: false };
    }

    // Extract attributes from first feature
    const feature = features[0];
    const attrs = feature.properties || {};

    const renRanData: RenRanData = {
      sourceLayer: `DGT SRUP ${typeName}`,
      // Standard attribute names from DGT SRUP (RAN and REN have different schemas)
      type: attrs.TIPOLOGIA || attrs.TIPOREN || attrs.TIPORAN || attrs.TIPO,
      designation: attrs.DESIGNACAO || attrs['SERVIDÃO'] || attrs.SERVIDAO || attrs.DESCRICAO,
      areaHa: attrs.AREA_HA || attrs.Area_ha,
      legalRef: attrs.LEI_TIPO || attrs.SERV_LEI || attrs.DIPLOMA || attrs.LEGISLACAO,
      category: attrs.SERVIDAO || attrs['SERVIDÃO'] || attrs.CATEGORIA || attrs.CLASSE,
      subcategory: attrs.DINAMICA || attrs['DINÂMICA'] || attrs.SUBCATEGORIA,
      municipality: attrs.CONCELHO || attrs.MUNICIPIO,
      attributes: attrs,
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
      error: error instanceof Error ? error.message : 'Unknown error querying national WFS',
    };
  }
}

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

    // Return first matching result with parsed attributes
    const result = results[0];
    const attrs = result.attributes || {};
    
    // Extract common REN/RAN attribute fields (names vary by municipality)
    const renRanData: RenRanData = {
      sourceLayer: result.layerName,
      // Type/category
      type: attrs.TIPOREN || attrs.TIPORAN || attrs.TIPO || attrs.Tipo || attrs.TYPE,
      // Description/designation
      designation: attrs.DESIGNACAO || attrs.Designacao || attrs.DESCRICAO || attrs.Descricao || 
                   attrs.DESIGNA || attrs.DESC || attrs.NOME || attrs.Nome,
      // Area
      areaHa: attrs.AREA_HA || attrs.Area_ha || attrs.AREAHA || attrs.Shape_Area,
      // Legal reference
      legalRef: attrs.DIPLOMA || attrs.Diploma || attrs.LEGISLACAO || attrs.LEI,
      // Category/class
      category: attrs.CATEGORIA || attrs.Categoria || attrs.CLASSE || attrs.Classe,
      // Subcategory
      subcategory: attrs.SUBCATEGORIA || attrs.Subcategoria || attrs.SUBCLASSE,
      // Municipality (if present)
      municipality: attrs.MUNICIPIO || attrs.Municipio || attrs.CONCELHO,
      // Raw attributes for debugging/completeness
      attributes: attrs,
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
 * Determine which regional REN service to use based on coordinates
 * Portugal regions: Norte, Centro, LVT (Lisboa e Vale do Tejo), Alentejo, Algarve
 */
function getRegionalRENService(lat: number, lng: number): string | null {
  // Approximate regional boundaries (latitude-based, simplified)
  if (lat >= 41.0) return DGT_SRUP_WFS.REN_NORTE;
  if (lat >= 39.5) return DGT_SRUP_WFS.REN_CENTRO;
  if (lat >= 38.5) return DGT_SRUP_WFS.REN_LVT;
  if (lat >= 37.5) return DGT_SRUP_WFS.REN_ALENTEJO;
  return DGT_SRUP_WFS.REN_ALGARVE;
}

/**
 * Query REN (Reserva Ecológica Nacional)
 * Uses municipal ArcGIS service if available, falls back to regional then national DGT WFS
 */
export async function queryREN(
  lat: number,
  lng: number,
  municipality?: MunicipalityRecord
): Promise<LayerResult> {
  const layerId = 'pt-ren';
  const layerName = 'Reserva Ecológica Nacional';

  // Try municipal ArcGIS service first (faster, more detailed)
  if (municipality?.gisVerified && municipality.renService?.url) {
    try {
      const municipalResult = await queryMunicipalRenRan(
        lat,
        lng,
        municipality.renService.url,
        layerId,
        `REN - ${municipality.name}`
      );
      
      if (municipalResult.found) {
        return municipalResult;
      }
    } catch {
      // Municipal service failed, continue to fallback
    }
  }

  // Try regional REN service first (faster than national, less load)
  const regionalService = getRegionalRENService(lat, lng);
  if (regionalService) {
    try {
      const regionalResult = await queryNationalSRUPWFS(
        lat,
        lng,
        regionalService,
        DGT_WFS_LAYERS.REN,
        layerId,
        layerName,
        municipality?.name
      );
      if (regionalResult.found || !regionalResult.error) {
        return regionalResult;
      }
    } catch {
      // Regional service failed, continue to national fallback
    }
  }

  // Fallback to national DGT SRUP WFS
  try {
    return await queryNationalSRUPWFS(
      lat,
      lng,
      DGT_SRUP_WFS.REN,
      DGT_WFS_LAYERS.REN,
      layerId,
      layerName,
      municipality?.name
    );
  } catch {
    // All services failed - return graceful degradation
    return {
      layerId,
      layerName,
      found: false,
      error: 'DGT REN services temporarily unavailable',
    };
  }
}

/**
 * Query RAN (Reserva Agrícola Nacional)
 * Uses municipal ArcGIS service if available, falls back to national DGT WFS
 */
export async function queryRAN(
  lat: number,
  lng: number,
  municipality?: MunicipalityRecord
): Promise<LayerResult> {
  const layerId = 'pt-ran';
  const layerName = 'Reserva Agrícola Nacional';

  // Try municipal ArcGIS service first (faster, more detailed)
  if (municipality?.gisVerified && municipality.ranService?.url) {
    try {
      const municipalResult = await queryMunicipalRenRan(
        lat,
        lng,
        municipality.ranService.url,
        layerId,
        `RAN - ${municipality.name}`
      );
      
      if (municipalResult.found) {
        return municipalResult;
      }
    } catch {
      // Municipal service failed, continue to fallback
    }
  }

  // Fallback to national DGT SRUP WFS (filter by municipality for speed)
  try {
    return await queryNationalSRUPWFS(
      lat,
      lng,
      DGT_SRUP_WFS.RAN,
      DGT_WFS_LAYERS.RAN,
      layerId,
      layerName,
      municipality?.name
    );
  } catch {
    // National service failed - return graceful degradation
    return {
      layerId,
      layerName,
      found: false,
      error: 'DGT RAN service temporarily unavailable',
    };
  }
}
