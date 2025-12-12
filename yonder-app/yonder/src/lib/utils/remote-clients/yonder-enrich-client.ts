/**
 * Yonder Enrich API Client
 * Shared client for calling the yonder-enrich location enrichment service
 */

import { getAuthHeaders } from './gcloud-auth';

// Yonder Enrich API configuration
const ENRICH_API_URL = process.env.YONDER_ENRICH_API_URL || 'https://yonder-enrich-634586379515.us-central1.run.app';

// Timeout configuration for API calls
// Fluid Compute enabled: up to 800s on Pro, we use 300s (5 min)
const ENRICH_TIMEOUT_MS = 300000; // 5 minutes

export interface MunicipalityInfo {
  id?: number;
  name: string;
  district?: string;
  country?: string;
}

export interface LocationEnrichmentRequest {
  latitude: number;
  longitude: number;
  plot_id?: string;
  store_results?: boolean;
  translate?: boolean;
  target_language?: string;
}

export interface LocationEnrichmentResponse {
  location: {
    latitude: number;
    longitude: number;
  };
  country?: string;
  municipality?: MunicipalityInfo;
  amenities?: any;
  zoning?: any;
  cadastre?: any;
  enrichment_data?: any;
  enrichments_run: string[];
  enrichments_skipped: string[];
  enrichments_failed: string[];
  timestamp: string;
  error?: string;
}

// Layer Query Types
export interface LayerResult {
  layerId: string;
  layerName: string;
  found: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface LayerQueryRequest {
  lat: number;
  lng: number;
  country?: 'PT' | 'ES';
  areaM2?: number;
  polygon?: GeoJSONPolygon;
}

export interface LayerQueryResponse {
  coordinates: { lat: number; lng: number };
  country: 'PT' | 'ES';
  timestamp: string;
  layers: LayerResult[];
  areaM2?: number;
  boundingBox?: BoundingBox;
  polygon?: GeoJSONPolygon;
}

/**
 * Make an authenticated request to the Yonder Enrich API
 */
async function makeEnrichRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ENRICH_API_URL}${endpoint}`;
  
  // Get authenticated headers
  const headers = await getAuthHeaders(
    ENRICH_API_URL,
    'yonder-enrich',
    {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      cache: 'no-store', // Disable Next.js data cache
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Enrich API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Enrich API request timeout after ${ENRICH_TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

/**
 * Enrich a location with all available data sources
 */
export async function enrichLocation(
  request: LocationEnrichmentRequest
): Promise<LocationEnrichmentResponse> {
  return makeEnrichRequest<LocationEnrichmentResponse>('/api/enrich/location', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get health status of the enrichment service
 */
export async function getEnrichHealth(): Promise<{
  status: string;
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}> {
  return makeEnrichRequest('/health', {
    method: 'GET',
  });
}

/**
 * Get enrichment API information
 */
export async function getEnrichInfo(): Promise<any> {
  return makeEnrichRequest('/api/enrich/info', {
    method: 'GET',
  });
}

/**
 * Query geographic layers for a point (GET request)
 * @param lat - Latitude
 * @param lng - Longitude
 * @param country - Country code (PT or ES)
 * @param areaM2 - Optional area in square meters for area-based queries
 */
export async function queryLayers(
  lat: number,
  lng: number,
  country: 'PT' | 'ES' = 'PT',
  areaM2?: number
): Promise<LayerQueryResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    country,
  });
  
  if (areaM2 !== undefined) {
    params.append('area', String(areaM2));
  }
  
  return makeEnrichRequest<LayerQueryResponse>(`/api/layers?${params.toString()}`, {
    method: 'GET',
  });
}

/**
 * Query geographic layers with polygon (POST request)
 * @param request - Layer query request with lat, lng, country, and optional polygon/area
 */
export async function queryLayersWithPolygon(
  request: LayerQueryRequest
): Promise<LayerQueryResponse> {
  return makeEnrichRequest<LayerQueryResponse>('/api/layers', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
