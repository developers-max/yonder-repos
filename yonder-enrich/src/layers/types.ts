/**
 * Shared types for Layer Query Service
 */

// GeoJSON types
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon | {
  type: string;
  coordinates: any;
};

// Layer result types
export interface LayerResult {
  layerId: string;
  layerName: string;
  found: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// Bounding box type
export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// Query options
export interface LayerQueryOptions {
  /** Center latitude */
  lat: number;
  /** Center longitude */
  lng: number;
  /** Country code (PT or ES) */
  country: 'PT' | 'ES';
  /** Optional area in square meters for area-based queries */
  areaM2?: number;
  /** Optional polygon geometry */
  polygon?: GeoJSONPolygon;
}

// Complete query response
export interface LayerQueryResponse {
  coordinates: { lat: number; lng: number };
  country: 'PT' | 'ES';
  timestamp: string;
  layers: LayerResult[];
  areaM2?: number;
  boundingBox?: BoundingBox;
  polygon?: GeoJSONPolygon;
}

// Administrative layer data types
export interface DistrictData {
  distrito?: string;
  source?: string;
}

export interface MunicipalityData {
  municipio?: string;
  distrito?: string;
  nuts1?: string;
  nuts2?: string;
  nuts3?: string;
  areaHa?: number;
  nFreguesias?: number;
}

export interface ParishData {
  freguesia?: string;
  municipio?: string;
  distrito?: string;
  areaHa?: number;
}

export interface NUTS3Data {
  nuts3?: string;
  nuts2?: string;
  nuts1?: string;
}

// Cadastral data types
export interface CadastralData {
  parcelReference?: string;
  inspireId?: string;
  label?: string;
  areaM2?: number;
  municipalityCode?: string;
  validFrom?: string;
  geometry?: GeoJSONGeometry;
  centroid?: [number, number];
  distanceMeters?: number;
  containsPoint?: boolean;
}

// Zoning data types
export interface ZoningData {
  label?: string;
  labelEn?: string;
  category?: string;
  landClass?: string;
  typename?: string;
  pickedField?: string;
  source?: string;
  municipality?: string;
  rawProperties?: Record<string, unknown>;
}

// REN/RAN data types
export interface RenRanData {
  sourceLayer?: string;
  attributes?: Record<string, unknown>;
}

// Land use data types
export interface LandUseData {
  cos?: string;
  cosLevel1?: string;
  cosLevel2?: string;
  cosLevel3?: string;
  cosSource?: string;
  clc?: string;
  clcCode?: string;
  clcSource?: string;
}

// Elevation data
export interface ElevationData {
  elevationM?: number;
  source?: string;
}

// Municipality database record (for REN/RAN service lookup)
export interface MunicipalityRecord {
  id: number;
  caopId: string;
  name: string;
  district?: string | null;
  gisBaseUrl?: string | null;
  gisVerified?: boolean | null;
  renService?: { url: string; layers?: string } | null;
  ranService?: { url: string; layers?: string } | null;
}
