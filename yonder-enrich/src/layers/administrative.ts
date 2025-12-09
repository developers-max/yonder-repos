/**
 * Administrative Layer Queries
 * District, Municipality, Parish, NUTS3 from DGT OGC API
 */

import axios from 'axios';
import { Agent as HttpsAgent } from 'https';
import { LayerResult, MunicipalityData, ParishData, NUTS3Data, DistrictData } from './types';

const OGC_BASE = process.env.DGT_OGC_BASE || 'https://ogcapi.dgterritorio.gov.pt';

// Keep-alive HTTPS agent
const httpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: false, // DGT API may have certificate issues
});

const AX = axios.create({
  headers: {
    Accept: 'application/geo+json, application/json',
    'User-Agent': 'yonder-enrich/1.0',
  },
  timeout: 15000,
  httpsAgent,
});

/**
 * Calculate bounding box from center point and buffer in meters
 */
function bboxFromPoint(lng: number, lat: number, bufferMeters: number = 100): string {
  const dLat = bufferMeters / 111320;
  const dLng = bufferMeters / (111320 * Math.cos(lat * Math.PI / 180));
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

/**
 * Generic OGC API collection query
 */
async function queryOGCCollection<T>(
  lat: number,
  lng: number,
  collection: string,
  layerId: string,
  layerName: string,
  propsMapper?: (props: Record<string, unknown>) => T,
  areaM2?: number
): Promise<LayerResult> {
  const bufferMeters = areaM2 ? Math.sqrt(areaM2) / 2 : 100;
  const bbox = bboxFromPoint(lng, lat, bufferMeters);
  const limit = areaM2 ? 100 : 1;
  
  const url = `${OGC_BASE}/collections/${collection}/items?bbox=${bbox}&f=json&limit=${limit}`;

  try {
    const response = await AX.get(url);
    const data = response.data;
    const features = data.features || [];

    if (features.length === 0) {
      return { layerId, layerName, found: false };
    }

    // For area queries, return all features; for point queries, return first
    if (areaM2 && features.length > 1) {
      const allData = features.map((f: { properties?: Record<string, unknown> }) => {
        const props = f.properties || {};
        return propsMapper ? propsMapper(props) : props;
      });
      return {
        layerId,
        layerName,
        found: true,
        data: { count: features.length, features: allData },
      };
    }

    const props = features[0].properties || {};
    return {
      layerId,
      layerName,
      found: true,
      data: propsMapper ? propsMapper(props) : props,
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
 * Query District via WMS GetFeatureInfo (DGT Distritos layer)
 */
export async function queryDistrict(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  const layerId = 'pt-distrito';
  const layerName = 'Distrito';

  try {
    // Use WMS GetFeatureInfo for district layer
    const bufferMeters = areaM2 ? Math.sqrt(areaM2) / 2 : 100;
    const delta = bufferMeters / 111320;
    
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const width = 256;
    const height = 256;
    const x = 128;
    const y = 128;

    const wmsUrl = `https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms`;
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.1.1',
      REQUEST: 'GetFeatureInfo',
      LAYERS: 'cont_distritos',
      QUERY_LAYERS: 'cont_distritos',
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
    const districtData: DistrictData = {
      distrito: props.Distrito || props.distrito || props.DISTRITO,
      source: 'CAOP WMS',
    };

    return {
      layerId,
      layerName,
      found: true,
      data: districtData as unknown as Record<string, unknown>,
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
 * Query Municipality (Município) via OGC API
 */
export async function queryMunicipality(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  return queryOGCCollection<MunicipalityData>(
    lat,
    lng,
    'municipios',
    'pt-municipio',
    'Município (CAOP)',
    (props) => ({
      municipio: props.municipio as string,
      distrito: props.distrito_ilha as string,
      nuts1: props.nuts1 as string,
      nuts2: props.nuts2 as string,
      nuts3: props.nuts3 as string,
      areaHa: props.area_ha as number,
      nFreguesias: props.n_freguesias as number,
    }),
    areaM2
  );
}

/**
 * Query Parish (Freguesia) via OGC API
 */
export async function queryParish(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  return queryOGCCollection<ParishData>(
    lat,
    lng,
    'freguesias',
    'pt-freguesia',
    'Freguesia',
    (props) => ({
      freguesia: props.freguesia as string,
      municipio: props.municipio as string,
      distrito: props.distrito_ilha as string,
      areaHa: props.area_ha as number,
    }),
    areaM2
  );
}

/**
 * Query NUTS III region via OGC API
 */
export async function queryNUTS3(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  return queryOGCCollection<NUTS3Data>(
    lat,
    lng,
    'nuts3',
    'pt-nuts3',
    'NUTS III',
    (props) => ({
      nuts3: props.nuts3 as string,
      nuts2: props.nuts2 as string,
      nuts1: props.nuts1 as string,
    }),
    areaM2
  );
}

/**
 * Query all administrative layers in parallel
 */
export async function queryAdministrativeLayers(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult[]> {
  const [districtResult, municipioResult, freguesiaResult, nuts3Result] = await Promise.all([
    queryDistrict(lat, lng, areaM2),
    queryMunicipality(lat, lng, areaM2),
    queryParish(lat, lng, areaM2),
    queryNUTS3(lat, lng, areaM2),
  ]);

  return [districtResult, municipioResult, freguesiaResult, nuts3Result];
}
