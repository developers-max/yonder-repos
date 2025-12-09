/**
 * Layer Query Service
 * 
 * Unified service for querying all geographic layers:
 * - Administrative: District, Municipality, Parish, NUTS3
 * - Cadastre: DGT Cadastro, BUPi
 * - Zoning: CRUS, REN, RAN
 * - Land Use: COS, CLC, Built-up Areas
 * - Elevation
 * 
 * @example
 * ```typescript
 * import { queryAllLayers, queryPortugueseCadastre } from 'yonder-enrich/layers';
 * 
 * // Query all layers for a point
 * const result = await queryAllLayers({ lat: 38.7, lng: -9.1, country: 'PT' });
 * 
 * // Query just cadastre
 * const cadastre = await queryPortugueseCadastre(38.7, -9.1);
 * ```
 */

// Re-export types
export * from './types';

// Re-export administrative layer functions
export {
  queryDistrict,
  queryMunicipality,
  queryParish,
  queryNUTS3,
  queryAdministrativeLayers,
} from './administrative';

// Re-export cadastre functions (includes original portugal_cadastre_lookup exports)
export {
  queryPortugueseCadastre,
  querySpanishCadastre,
  getPortugalCadastralInfo,
  getNearbyCadastralParcels,
  getBUPiPropertyInfo,
  getBUPiPropertyInfoArcGIS,
} from './cadastre';

// Re-export zoning functions (includes original crus_lookup exports)
export {
  queryCRUSZoning,
  queryREN,
  queryRAN,
  getCRUSZoningForPoint,
} from './zoning';

// Re-export land use functions
export {
  queryCOS,
  queryCLC,
  queryBuiltUpAreas,
  queryLandUseLayers,
} from './land-use';

// Re-export elevation function
export { queryElevation } from './elevation';

// Import for internal use
import { queryAdministrativeLayers, queryMunicipality } from './administrative';
import { queryPortugueseCadastre, querySpanishCadastre } from './cadastre';
import { queryREN, queryRAN } from './zoning';
import { queryLandUseLayers } from './land-use';
import { queryElevation } from './elevation';
import { LayerResult, LayerQueryOptions, LayerQueryResponse, MunicipalityRecord, BoundingBox } from './types';

// Import municipality lookup from persistence (if available)
let findPortugalMunicipality: ((name?: string | null, caopId?: string | null) => Promise<MunicipalityRecord | undefined>) | null = null;

try {
  // Try to import from persistence package
  const persistence = require('@yonder/persistence');
  if (persistence.findPortugalMunicipality) {
    findPortugalMunicipality = persistence.findPortugalMunicipality;
  }
} catch {
  // Persistence package not available, REN/RAN queries will be limited
  console.warn('[layers] @yonder/persistence not available, REN/RAN queries will be skipped');
}

/**
 * Calculate bounding box from center point and area
 */
function calculateBoundingBox(lat: number, lng: number, areaM2: number): BoundingBox {
  const sideMeters = Math.sqrt(areaM2);
  const halfSideMeters = sideMeters / 2;
  
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(lat * Math.PI / 180);
  
  const deltaLat = halfSideMeters / metersPerDegreeLat;
  const deltaLng = halfSideMeters / metersPerDegreeLng;
  
  return {
    minLng: lng - deltaLng,
    minLat: lat - deltaLat,
    maxLng: lng + deltaLng,
    maxLat: lat + deltaLat,
  };
}

/**
 * Query all available layers for Portugal
 * 
 * Order: General → Specific
 * 1. Administrative (District → Municipality → Parish → NUTS3)
 * 2. Cadastre (BUPI)
 * 3. Zoning (REN, RAN) - requires municipality context
 * 4. Land Use (COS, CLC, Built-up)
 * 5. Elevation
 */
async function queryPortugalLayers(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult[]> {
  const layers: LayerResult[] = [];

  // ============================================================
  // PHASE 1: Administrative Boundaries (General → Specific)
  // ============================================================
  const adminLayers = await queryAdministrativeLayers(lat, lng, areaM2);
  layers.push(...adminLayers);

  // Extract municipality name from CAOP query for later use
  const municipioResult = adminLayers.find(l => l.layerId === 'pt-municipio');
  const municipioName = municipioResult?.data?.municipio as string | undefined;

  // ============================================================
  // PHASE 2: Cadastre/BUPI
  // ============================================================
  const cadastreResult = await queryPortugueseCadastre(lat, lng, areaM2);
  layers.push(cadastreResult);

  // Extract municipality code from cadastre as fallback
  const cadastreMunicipalityCode = cadastreResult.data?.municipalityCode as string | undefined;

  // ============================================================
  // PHASE 3: Municipality Database Lookup for Zoning Services
  // ============================================================
  let municipality: MunicipalityRecord | undefined;

  if (findPortugalMunicipality) {
    municipality = await findPortugalMunicipality(municipioName, cadastreMunicipalityCode);

    // Add municipality database info
    if (municipality) {
      layers.push({
        layerId: 'pt-municipality-db',
        layerName: 'Município (Database)',
        found: true,
        data: {
          name: municipality.name,
          caopId: municipality.caopId,
          hasRenService: !!municipality.renService,
          hasRanService: !!municipality.ranService,
          gisVerified: municipality.gisVerified,
        },
      });
    }
  }

  // ============================================================
  // PHASE 4: Zoning & Restrictions (REN/RAN)
  // ============================================================
  const renResult = await queryREN(lat, lng, municipality);
  const ranResult = await queryRAN(lat, lng, municipality);
  layers.push(renResult, ranResult);

  // ============================================================
  // PHASE 5: Land Use & Elevation (in parallel)
  // ============================================================
  const [landUseLayers, elevationResult] = await Promise.all([
    queryLandUseLayers(lat, lng, areaM2),
    queryElevation(lat, lng),
  ]);

  layers.push(...landUseLayers, elevationResult);

  return layers;
}

/**
 * Query all available layers for Spain
 */
async function querySpainLayers(
  lat: number,
  lng: number
): Promise<LayerResult[]> {
  const layers: LayerResult[] = [];

  // Query Spanish cadastre and elevation in parallel
  const [cadastreResult, elevationResult] = await Promise.all([
    querySpanishCadastre(lat, lng),
    queryElevation(lat, lng),
  ]);

  layers.push(cadastreResult, elevationResult);

  return layers;
}

/**
 * Query all layers for a given location
 * 
 * This is the main entry point for the layer query service.
 * It queries all available layers based on the country and returns
 * a comprehensive response with all layer data.
 * 
 * @param options - Query options including coordinates, country, and optional area/polygon
 * @returns Complete layer query response
 */
export async function queryAllLayers(
  options: LayerQueryOptions
): Promise<LayerQueryResponse> {
  const { lat, lng, country, areaM2, polygon } = options;

  // Calculate bounding box if area is provided
  const boundingBox = areaM2 ? calculateBoundingBox(lat, lng, areaM2) : undefined;

  // Query layers based on country
  const layers = country === 'PT'
    ? await queryPortugalLayers(lat, lng, areaM2)
    : await querySpainLayers(lat, lng);

  return {
    coordinates: { lat, lng },
    country,
    timestamp: new Date().toISOString(),
    layers,
    ...(areaM2 && { areaM2 }),
    ...(boundingBox && { boundingBox }),
    ...(polygon && { polygon }),
  };
}

/**
 * Query a specific subset of layers
 * Useful when you only need certain layer types
 */
export async function queryLayersByType(
  lat: number,
  lng: number,
  layerTypes: ('administrative' | 'cadastre' | 'zoning' | 'landuse' | 'elevation')[],
  areaM2?: number
): Promise<LayerResult[]> {
  const results: LayerResult[] = [];

  for (const type of layerTypes) {
    switch (type) {
      case 'administrative':
        results.push(...await queryAdministrativeLayers(lat, lng, areaM2));
        break;
      case 'cadastre':
        results.push(await queryPortugueseCadastre(lat, lng, areaM2));
        break;
      case 'landuse':
        results.push(...await queryLandUseLayers(lat, lng, areaM2));
        break;
      case 'elevation':
        results.push(await queryElevation(lat, lng));
        break;
      // 'zoning' requires municipality context, handled separately
    }
  }

  return results;
}
