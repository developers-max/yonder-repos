/**
 * Cadastre Layer Queries
 * Wraps existing portugal_cadastre_lookup.ts and bupi_lookup.ts functionality
 */

import { LayerResult, CadastralData } from './types';

// Re-export existing cadastre lookup functions
export { 
  getPortugalCadastralInfo,
  getNearbyCadastralParcels 
} from '../enrichments/portugal-cadastre/portugal_cadastre_lookup';

export {
  getBUPiPropertyInfo
} from '../enrichments/portugal-cadastre/bupi_lookup';

export {
  getBUPiPropertyInfoArcGIS
} from '../enrichments/portugal-cadastre/bupi_arcgis_rest';

// Import for internal use
import { getPortugalCadastralInfo } from '../enrichments/portugal-cadastre/portugal_cadastre_lookup';

/**
 * Query Portugal cadastre and return as LayerResult
 * This wraps the existing getPortugalCadastralInfo function
 */
export async function queryPortugueseCadastre(
  lat: number,
  lng: number,
  areaM2?: number
): Promise<LayerResult> {
  const layerId = 'pt-cadastro';
  const layerName = 'Cadastro Predial';

  try {
    const info = await getPortugalCadastralInfo(lng, lat);

    if (!info) {
      return { layerId, layerName, found: false };
    }

    const cadastralData: CadastralData = {
      parcelReference: info.cadastral_reference,
      inspireId: info.inspire_id,
      label: info.label,
      areaM2: info.parcel_area_m2,
      municipalityCode: info.municipality_code,
      validFrom: info.registration_date,
      geometry: info.geometry,
      centroid: info.centroid,
      distanceMeters: info.distance_meters,
      containsPoint: info.contains_point,
    };

    return {
      layerId,
      layerName,
      found: true,
      data: cadastralData as unknown as Record<string, unknown>,
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
 * Query Spanish cadastre (placeholder - uses existing spain_cadastre_lookup)
 */
export async function querySpanishCadastre(
  lat: number,
  lng: number
): Promise<LayerResult> {
  const layerId = 'es-cadastro';
  const layerName = 'Catastro';

  try {
    // Import dynamically to avoid circular deps
    const { getSpanishCadastralInfo } = await import('../enrichments/spain-cadastre/spain_cadastre_lookup');
    const info = await getSpanishCadastralInfo(lng, lat);

    if (!info) {
      return { layerId, layerName, found: false };
    }

    return {
      layerId,
      layerName,
      found: true,
      data: info as unknown as Record<string, unknown>,
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
