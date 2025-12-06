import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import booleanIntersects from '@turf/boolean-intersects';
import { polygon as turfPolygon, multiPolygon as turfMultiPolygon } from '@turf/helpers';

type Feature = {
  type: 'Feature';
  id?: string | number;
  geometry: { type: string; coordinates: any };
  properties: Record<string, any>;
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

const OGC_BASE = process.env.DGT_OGC_BASE || 'https://ogcapi.dgterritorio.gov.pt';
const MUNICIPIOS_COLLECTION = 'municipios';
const FREGUESIAS_COLLECTION = 'freguesias';
const COS2023_COLLECTION = 'cos2023v1';
const ACCEPT = 'application/geo+json, application/json;q=0.9';

// Structured CRUS zoning result
export interface CRUSZoningResult {
  // Primary zoning info
  designation: string;           // Designacao - main zoning label
  category?: string;             // Categoria_ - zoning category
  land_class?: string;           // Classe_202 - Solo Rústico/Urbano
  
  // Area and legal info
  area_hectares?: number;        // AREA_HA
  publication_date?: string;     // Data_Pub_O
  legal_reference?: string;      // Registo_ou
  
  // Technical metadata
  municipality?: string;         // Municipio
  municipal_code?: string;       // DTCC
  original_scale?: string;       // Escala_ori
  data_source?: string;          // Fonte
  author?: string;               // Autor
  feature_id?: number;           // ID1
  
  // Query metadata
  collection_id: string;
  query_method: 'point' | 'geometry';
  source: string;
  srs: string;
  
  // Raw properties for debugging
  raw_properties?: Record<string, any>;
}

// COS2023 Land Cover result
export interface LandCoverResult {
  // Classification hierarchy
  level4_code: string;           // COS23_n4_C - e.g., "1.1.1.1"
  level4_label: string;          // COS23_n4_L - full description
  
  // Administrative context
  municipality?: string;
  nuts2?: string;
  nuts3?: string;
  
  // Metadata
  source: string;
  collection_id: string;
  query_method: 'point' | 'geometry';
}

// Freguesias (Parish) result
export interface ParishResult {
  parish_name: string;           // freguesia
  municipality: string;          // municipio
  district: string;              // distrito_ilha
  
  // NUTS hierarchy
  nuts1?: string;
  nuts2?: string;
  nuts3?: string;
  
  // Area info
  area_hectares?: number;        // area_ha
  perimeter_km?: number;         // perimetro_km
  
  // Simplified name
  simplified_name?: string;      // designacao_simplificada
  
  source: string;
}

// Comprehensive Portugal zoning result
export interface PortugalZoningResult {
  crus?: CRUSZoningResult;
  land_cover?: LandCoverResult;
  parish?: ParishResult;
  
  // Legacy fields for backward compatibility
  label?: string;
  query_method?: 'point' | 'geometry';
}

const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 50,
  rejectUnauthorized: false
});

const AX = axios.create({
  headers: { Accept: ACCEPT, 'User-Agent': 'yonder-enrich/1.0' },
  timeout: 30_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

function metersToDegrees(lat: number, meters: number) {
  const dLat = meters / 111_320;
  const dLon = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLon };
}

function bboxAroundPoint(lon: number, lat: number, meters = 100): [number, number, number, number] {
  const { dLat, dLon } = metersToDegrees(lat, meters);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

/**
 * Calculate bounding box from a GeoJSON geometry
 */
function bboxFromGeometry(geometry: any): [number, number, number, number] | null {
  try {
    if (!geometry || !geometry.coordinates) return null;
    
    let allCoords: number[][] = [];
    
    if (geometry.type === 'Polygon') {
      // Flatten all rings
      allCoords = geometry.coordinates.flat();
    } else if (geometry.type === 'MultiPolygon') {
      // Flatten all polygons and rings
      allCoords = geometry.coordinates.flat(2);
    } else {
      return null;
    }
    
    if (allCoords.length === 0) return null;
    
    let minLon = Infinity, minLat = Infinity;
    let maxLon = -Infinity, maxLat = -Infinity;
    
    for (const [lon, lat] of allCoords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    
    return [minLon, minLat, maxLon, maxLat];
  } catch (e) {
    console.warn('Failed to calculate bbox from geometry:', e);
    return null;
  }
}

/**
 * Check if two geometries intersect
 */
function geometriesIntersect(geom1: any, geom2: any): boolean {
  try {
    let poly1: any;
    let poly2: any;
    
    // Convert to Turf polygons
    if (geom1.type === 'Polygon') {
      poly1 = turfPolygon(geom1.coordinates);
    } else if (geom1.type === 'MultiPolygon') {
      poly1 = turfMultiPolygon(geom1.coordinates);
    } else {
      return false;
    }
    
    if (geom2.type === 'Polygon') {
      poly2 = turfPolygon(geom2.coordinates);
    } else if (geom2.type === 'MultiPolygon') {
      poly2 = turfMultiPolygon(geom2.coordinates);
    } else {
      return false;
    }
    
    return booleanIntersects(poly1, poly2);
  } catch (e) {
    console.warn('Failed to check geometry intersection:', e);
    return false;
  }
}

async function getJSON<T = any>(url: string): Promise<T> {
  const { data } = await AX.get(url);
  return data as T;
}

async function getMunicipio(lon: number, lat: number) {
  const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 200);
  const url = `${OGC_BASE}/collections/${MUNICIPIOS_COLLECTION}/items?bbox=${minx},${miny},${maxx},${maxy}&limit=5&f=json`;
  const fc = await getJSON<FeatureCollection>(url);
  if (!fc?.features?.length) return undefined;

  const pt: Feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} };
  const containing = fc.features.find((f) => {
    try {
      return booleanPointInPolygon(pt as any, f as any);
    } catch {
      return false;
    }
  });
  const best = containing || fc.features[0];

  const props = best.properties || {};
  const municipio =
    props.municipio ??
    props.MUNICIPIO ??
    props.NOME ??
    props.nome ??
    undefined;

  return { id: best.id, municipio: String(municipio || '').trim() || undefined, raw: best };
}

async function listCollections(): Promise<Array<{ id: string; title?: string }>> {
  const url = `${OGC_BASE}/collections?f=json`;
  const data = await getJSON<any>(url);
  const colls = data?.collections || [];
  return colls.map((c: any) => ({ id: c.id, title: c.title }));
}

/**
 * Get COS2023 land cover information for a point or parcel geometry
 */
export async function getCOS2023ForPoint(
  lat: number,
  lon: number,
  parcelGeometry?: any
): Promise<LandCoverResult | null> {
  try {
    let bbox: [number, number, number, number];
    let queryMethod: 'point' | 'geometry' = 'point';
    
    if (parcelGeometry) {
      const geomBbox = bboxFromGeometry(parcelGeometry);
      if (geomBbox) {
        bbox = geomBbox;
        queryMethod = 'geometry';
      } else {
        bbox = bboxAroundPoint(lon, lat, 50);
      }
    } else {
      bbox = bboxAroundPoint(lon, lat, 50);
    }
    
    const [minx, miny, maxx, maxy] = bbox;
    const url = `${OGC_BASE}/collections/${COS2023_COLLECTION}/items?bbox=${minx},${miny},${maxx},${maxy}&limit=10&f=json`;
    
    const fc = await getJSON<FeatureCollection>(url);
    if (!fc?.features?.length) return null;
    
    // Find matching feature
    let matchingFeature: Feature | undefined;
    
    if (parcelGeometry) {
      matchingFeature = fc.features.find((f) => {
        try {
          return geometriesIntersect(parcelGeometry, f.geometry);
        } catch {
          return false;
        }
      });
    } else {
      const pt: Feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} };
      matchingFeature = fc.features.find((f) => {
        try {
          return booleanPointInPolygon(pt as any, f as any);
        } catch {
          return false;
        }
      });
    }
    
    if (!matchingFeature) return null;
    
    const props = matchingFeature.properties || {};
    
    return {
      level4_code: props.COS23_n4_C || props.cos23_n4_c || '',
      level4_label: props.COS23_n4_L || props.cos23_n4_l || '',
      municipality: props.Municipio || props.municipio,
      nuts2: props.NUTSII || props.nutsii,
      nuts3: props.NUTSIII || props.nutsiii,
      source: 'DGT COS2023',
      collection_id: COS2023_COLLECTION,
      query_method: queryMethod,
    };
  } catch (error) {
    console.warn('COS2023 lookup failed:', error);
    return null;
  }
}

/**
 * Get freguesia (parish) information for a point
 */
export async function getFreguesiaForPoint(
  lat: number,
  lon: number
): Promise<ParishResult | null> {
  try {
    const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 200);
    const url = `${OGC_BASE}/collections/${FREGUESIAS_COLLECTION}/items?bbox=${minx},${miny},${maxx},${maxy}&limit=5&f=json`;
    
    const fc = await getJSON<FeatureCollection>(url);
    if (!fc?.features?.length) return null;
    
    const pt: Feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} };
    const containing = fc.features.find((f) => {
      try {
        return booleanPointInPolygon(pt as any, f as any);
      } catch {
        return false;
      }
    });
    
    const best = containing || fc.features[0];
    const props = best.properties || {};
    
    return {
      parish_name: props.freguesia || props.Freguesia || '',
      municipality: props.municipio || props.Municipio || '',
      district: props.distrito_ilha || props.Distrito_Ilha || '',
      nuts1: props.nuts1 || props.NUTS1,
      nuts2: props.nuts2 || props.NUTS2,
      nuts3: props.nuts3 || props.NUTS3,
      area_hectares: props.area_ha,
      perimeter_km: props.perimetro_km,
      simplified_name: props.designacao_simplificada,
      source: 'DGT CAOP2024 Freguesias',
    };
  } catch (error) {
    console.warn('Freguesia lookup failed:', error);
    return null;
  }
}

/**
 * Get CRUS zoning information for a point or parcel geometry
 * @param lat - Latitude of the point
 * @param lon - Longitude of the point
 * @param parcelGeometry - Optional parcel geometry (Polygon or MultiPolygon) from cadastre
 */
export async function getCRUSZoningForPoint(
  lat: number,
  lon: number,
  parcelGeometry?: any
): Promise<CRUSZoningResult | null> {
  try {
    const municipioInfo = await getMunicipio(lon, lat);
    if (!municipioInfo?.municipio) {
      console.warn(`CRUS: No município found for ${lat},${lon}`);
      return null;
    }

    const collections = await listCollections();
    const candidateCollections = collections.filter(c =>
      c.id.toLowerCase().includes('crus') || 
      c.id.toLowerCase().includes('zoning') ||
      c.id.toLowerCase().includes('uso')
    );

    if (candidateCollections.length === 0) {
      console.warn('CRUS: No zoning collections found');
      return null;
    }

    // Try each collection
    for (const coll of candidateCollections) {
      // Determine bbox: use parcel geometry if available, otherwise point buffer
      let bbox: [number, number, number, number];
      if (parcelGeometry) {
        const geomBbox = bboxFromGeometry(parcelGeometry);
        if (geomBbox) {
          bbox = geomBbox;
          console.log(`  Using parcel geometry bbox for CRUS query`);
        } else {
          bbox = bboxAroundPoint(lon, lat, 50);
          console.log(`  Parcel geometry bbox failed, using point buffer`);
        }
      } else {
        bbox = bboxAroundPoint(lon, lat, 50);
      }
      
      const [minx, miny, maxx, maxy] = bbox;
      const url = `${OGC_BASE}/collections/${coll.id}/items?bbox=${minx},${miny},${maxx},${maxy}&limit=20&f=json`;
      
      try {
        const fc = await getJSON<FeatureCollection>(url);
        if (!fc?.features?.length) continue;

        // If parcel geometry is provided, find features that intersect with it
        // Otherwise, use point-in-polygon check
        let matchingFeature: Feature | undefined;
        
        if (parcelGeometry) {
          // Find zoning feature that intersects with the parcel
          matchingFeature = fc.features.find((f) => {
            try {
              return geometriesIntersect(parcelGeometry, f.geometry);
            } catch {
              return false;
            }
          });
        } else {
          // Traditional point-in-polygon check
          const pt: Feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} };
          matchingFeature = fc.features.find((f) => {
            try {
              return booleanPointInPolygon(pt as any, f as any);
            } catch {
              return false;
            }
          });
        }

        if (matchingFeature) {
          const props = matchingFeature.properties || {};
          // Try common property names for zoning designation
          const designation = props.Designacao || props.designacao || props.uso || props.zoning || props.tipo;
          
          if (designation) {
            return {
              // Primary zoning info
              designation: String(designation),
              category: props.Categoria_ || props.categoria,
              land_class: props.Classe_202 || props.classe_202,
              
              // Area and legal info
              area_hectares: props.AREA_HA || props.area_ha,
              publication_date: props.Data_Pub_O || props.data_pub_o,
              legal_reference: props.Registo_ou || props.registo_ou,
              
              // Technical metadata
              municipality: props.Municipio || props.municipio || municipioInfo.municipio,
              municipal_code: props.DTCC || props.dtcc,
              original_scale: props.Escala_ori || props.escala_ori,
              data_source: props.Fonte || props.fonte,
              author: props.Autor || props.autor,
              feature_id: props.ID1 || props.id1,
              
              // Query metadata
              collection_id: coll.id,
              query_method: parcelGeometry ? 'geometry' : 'point',
              source: 'DGT CRUS',
              srs: 'EPSG:4326',
              
              // Raw properties
              raw_properties: props,
            };
          }
        }
      } catch (e) {
        console.warn(`CRUS: Failed to query collection ${coll.id}:`, e);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('CRUS zoning lookup failed:', error);
    return null;
  }
}

/**
 * Get comprehensive Portugal zoning data including CRUS, COS2023, and parish info
 */
export async function getPortugalZoningData(
  lat: number,
  lon: number,
  parcelGeometry?: any
): Promise<PortugalZoningResult | null> {
  try {
    // Run all lookups in parallel
    const [crus, landCover, parish] = await Promise.all([
      getCRUSZoningForPoint(lat, lon, parcelGeometry),
      getCOS2023ForPoint(lat, lon, parcelGeometry),
      getFreguesiaForPoint(lat, lon),
    ]);
    
    // Return null if no data found
    if (!crus && !landCover && !parish) {
      return null;
    }
    
    return {
      crus: crus || undefined,
      land_cover: landCover || undefined,
      parish: parish || undefined,
      
      // Legacy fields for backward compatibility
      label: crus?.designation || landCover?.level4_label,
      query_method: crus?.query_method || landCover?.query_method || 'point',
    };
  } catch (error) {
    console.error('Portugal zoning data lookup failed:', error);
    return null;
  }
}
