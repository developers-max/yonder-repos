import { NextRequest, NextResponse } from 'next/server';
import {
  queryLayers,
  queryLayersWithPolygon,
  type LayerQueryResponse,
  type GeoJSONPolygon,
} from '@/lib/utils/remote-clients/yonder-enrich-client';

/**
 * API endpoint to query map layer information at a specific point, area, or polygon
 * Proxies requests to the yonder-enrich service which handles all geographic layer queries.
 * 
 * GET /api/layer-info?lat={latitude}&lng={longitude}&country={PT|ES}
 * GET /api/layer-info?lat={latitude}&lng={longitude}&country={PT|ES}&area={areaM2}
 * 
 * POST /api/layer-info
 * Body: { polygon: GeoJSON Polygon, country: 'PT' | 'ES' }
 * 
 * Parameters:
 * - lat: Latitude of center point
 * - lng: Longitude of center point  
 * - country: PT (Portugal) or ES (Spain)
 * - area: Optional area in square meters
 * - polygon: GeoJSON Polygon geometry for the plot/parcel shape
 */

interface PostRequestBody {
  polygon: GeoJSONPolygon;
  country?: 'PT' | 'ES';
}

// Validate GeoJSON Polygon
function isValidPolygon(polygon: unknown): polygon is GeoJSONPolygon {
  if (!polygon || typeof polygon !== 'object') return false;
  const p = polygon as Record<string, unknown>;
  if (p.type !== 'Polygon') return false;
  if (!Array.isArray(p.coordinates)) return false;
  if (p.coordinates.length === 0) return false;
  
  const ring = p.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return false; // Min 3 points + closing point
  
  // Check each coordinate is [lng, lat]
  for (const coord of ring) {
    if (!Array.isArray(coord) || coord.length < 2) return false;
    if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') return false;
  }
  
  return true;
}

// Calculate centroid of a polygon (simple average of vertices)
function calculatePolygonCentroid(polygon: GeoJSONPolygon): { lat: number; lng: number } {
  const ring = polygon.coordinates[0]; // Outer ring
  let sumLng = 0;
  let sumLat = 0;
  // Exclude last point (same as first in closed ring)
  const n = ring.length - 1;
  
  for (let i = 0; i < n; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }
  
  return {
    lng: sumLng / n,
    lat: sumLat / n,
  };
}

// Calculate approximate area of polygon in square meters (using Shoelace formula)
function calculatePolygonAreaM2(polygon: GeoJSONPolygon, centerLat: number): number {
  const ring = polygon.coordinates[0];
  const n = ring.length - 1;
  
  // Shoelace formula for area in coordinate units
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i][0] * ring[j][1];
    area -= ring[j][0] * ring[i][1];
  }
  area = Math.abs(area) / 2;
  
  // Convert from square degrees to square meters
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
  
  return area * metersPerDegreeLat * metersPerDegreeLng;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const country = (searchParams.get('country') || 'PT').toUpperCase() as 'PT' | 'ES';
  const areaParam = searchParams.get('area');
  const areaM2 = areaParam ? parseFloat(areaParam) : undefined;
  
  // Validate coordinates
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'Invalid coordinates. Provide lat and lng as numbers.' },
      { status: 400 }
    );
  }
  
  // Validate country
  if (country !== 'PT' && country !== 'ES') {
    return NextResponse.json(
      { error: 'Invalid country. Use PT or ES.' },
      { status: 400 }
    );
  }
  
  // Validate area if provided
  if (areaM2 !== undefined && (isNaN(areaM2) || areaM2 <= 0)) {
    return NextResponse.json(
      { error: 'Invalid area. Provide a positive number in square meters.' },
      { status: 400 }
    );
  }
  
  try {
    // Call yonder-enrich API via authenticated client
    const response: LayerQueryResponse = await queryLayers(lat, lng, country, areaM2);
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('[layer-info] Error querying layers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to query layers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for polygon-based queries
 * Accepts a GeoJSON Polygon and returns layer information for the plot
 */
export async function POST(request: NextRequest) {
  let body: PostRequestBody;
  
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  // Validate polygon
  if (!isValidPolygon(body.polygon)) {
    return NextResponse.json(
      { error: 'Invalid polygon. Provide a valid GeoJSON Polygon with at least 3 vertices.' },
      { status: 400 }
    );
  }
  
  const polygon = body.polygon;
  const country = ((body.country || 'PT').toUpperCase()) as 'PT' | 'ES';
  
  // Validate country
  if (country !== 'PT' && country !== 'ES') {
    return NextResponse.json(
      { error: 'Invalid country. Use PT or ES.' },
      { status: 400 }
    );
  }
  
  // Calculate centroid and area from polygon
  const centroid = calculatePolygonCentroid(polygon);
  const areaM2 = calculatePolygonAreaM2(polygon, centroid.lat);
  
  try {
    // Call yonder-enrich API via authenticated client with polygon
    const response: LayerQueryResponse = await queryLayersWithPolygon({
      lat: centroid.lat,
      lng: centroid.lng,
      country,
      areaM2: Math.round(areaM2),
      polygon,
    });
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('[layer-info] Error querying layers with polygon:', error);
    return NextResponse.json(
      { 
        error: 'Failed to query layers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
