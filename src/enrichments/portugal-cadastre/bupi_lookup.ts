#!/usr/bin/env ts-node

import axios from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, polygon as turfPolygon } from "@turf/helpers";

// BUPi WFS endpoint for RGG (Representação Gráfica Georreferenciada)
const BUPI_WFS_BASE = "https://geo.bupi.gov.pt/arcgis/services/opendata/RGG_DadosGovPT/MapServer/WFSServer";
const BUPI_FEATURE_TYPE = "RGG_DadosGovPT:Dados_Abertos_-_RGG_Continente";

// Keep-alive HTTP agents for connection pooling
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 50
});

const AX = axios.create({
  headers: { 
    Accept: "application/json",
    "User-Agent": "yonder-enrich/1.0" 
  },
  timeout: 30_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

interface BUPiPropertyInfo {
  bupi_id?: string;
  area_m2?: number;
  
  // Geometry
  geometry?: any;
  centroid?: [number, number];
  
  // Distance/accuracy
  distance_meters?: number;
  contains_point?: boolean;
  
  // Metadata
  source: string;
  service_url: string;
  coordinates: {
    longitude: number;
    latitude: number;
    srs: string;
  };
  notes?: string;
}

/**
 * Calculate centroid of a polygon or multipolygon
 */
function calculateCentroid(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;
  
  try {
    if (geometry.type === "Polygon") {
      const coords = geometry.coordinates[0]; // Exterior ring
      if (!coords || coords.length === 0) return null;
      
      const sumX = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0);
      const sumY = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0);
      return [sumX / coords.length, sumY / coords.length];
    } else if (geometry.type === "MultiPolygon") {
      // Use first polygon's exterior ring
      const coords = geometry.coordinates[0]?.[0];
      if (!coords || coords.length === 0) return null;
      
      const sumX = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0);
      const sumY = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0);
      return [sumX / coords.length, sumY / coords.length];
    }
  } catch (e) {
    console.warn("Failed to calculate centroid:", e);
  }
  
  return null;
}

/**
 * Calculate approximate distance between two lat/lon points in meters
 */
function calculateDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a point is inside a polygon/multipolygon
 */
function isPointInGeometry(lon: number, lat: number, geometry: any): boolean {
  try {
    const point = turfPoint([lon, lat]);
    
    if (geometry.type === "Polygon") {
      const poly = turfPolygon(geometry.coordinates);
      return booleanPointInPolygon(point, poly);
    } else if (geometry.type === "MultiPolygon") {
      // Check each polygon in the multipolygon
      for (const polygonCoords of geometry.coordinates) {
        const poly = turfPolygon(polygonCoords);
        if (booleanPointInPolygon(point, poly)) {
          return true;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to check point in polygon:", e);
  }
  
  return false;
}

/**
 * Query BUPi RGG data by coordinates using WFS
 * 
 * Uses bbox filtering to find properties near the given point,
 * then returns the property that contains the point or is closest to it.
 */
export async function getBUPiPropertyInfo(
  lon: number,
  lat: number
): Promise<BUPiPropertyInfo | null> {
  try {
    console.log(`  Querying BUPi WFS at (${lon.toFixed(6)}, ${lat.toFixed(6)})...`);
    
    // Progressive buffer expansion: start small, expand if nothing found
    const bufferSizes = [
      0.001,  // ~100m
      0.005,  // ~500m
      0.01    // ~1km
    ];
    
    let data: any = null;
    let usedBuffer = 0;
    
    for (const buffer of bufferSizes) {
      const bbox = `${lon - buffer},${lat - buffer},${lon + buffer},${lat + buffer}`;
      
      // WFS 2.0 GetFeature request with GeoJSON output
      const params = {
        SERVICE: 'WFS',
        REQUEST: 'GetFeature',
        VERSION: '2.0.0',
        TYPENAMES: BUPI_FEATURE_TYPE,
        BBOX: bbox,
        SRSNAME: 'urn:ogc:def:crs:EPSG::4326',
        COUNT: 50,  // Get more properties for better selection
        outputFormat: 'GEOJSON'
      };
      
      try {
        const response = await AX.get(BUPI_WFS_BASE, { params });
        data = response.data;
        
        // Debug: check response structure
        if (process.env.BUPI_DEBUG === 'true') {
          console.log(`  [DEBUG] Response type: ${typeof data}`);
          console.log(`  [DEBUG] Has features: ${data && data.features ? 'yes' : 'no'}`);
          if (data && data.features) {
            console.log(`  [DEBUG] Feature count: ${data.features.length}`);
          }
        }
        
        if (data.features && data.features.length > 0) {
          usedBuffer = buffer;
          break; // Found properties, stop searching
        }
      } catch (err) {
        // Continue to next buffer size on error
        console.log(`  BUPi query failed for buffer ${Math.round(buffer * 111000)}m: ${err instanceof Error ? err.message : 'unknown error'}`);
        continue;
      }
      
      // No properties in this buffer, try larger one
      if (buffer === bufferSizes[bufferSizes.length - 1]) {
        console.log(`  No BUPi properties found within ${Math.round(buffer * 111000)}m`);
        return null;
      }
    }
    
    if (!data || !data.features || data.features.length === 0) {
      console.log(`  No BUPi properties found near coordinates`);
      return null;
    }
    
    console.log(`  Found ${data.features.length} BUPi propert(ies) within ${Math.round(usedBuffer * 111000)}m`);
    
    // Priority 1: Find property that contains the exact point
    let bestFeature: any | null = null;
    let bestDistance = Infinity;
    let containsPoint = false;
    
    for (const feature of data.features) {
      const inside = isPointInGeometry(lon, lat, feature.geometry);
      
      if (inside) {
        bestFeature = feature;
        containsPoint = true;
        bestDistance = 0;
        console.log(`  ✓ Point is inside property (exact match)`);
        break; // Found exact property, stop searching
      }
    }
    
    // Priority 2: If no containing property, find the closest one by centroid distance
    if (!bestFeature) {
      for (const feature of data.features) {
        const centroid = calculateCentroid(feature.geometry);
        if (centroid) {
          const distance = calculateDistance(lon, lat, centroid[0], centroid[1]);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestFeature = feature;
          }
        }
      }
      
      if (bestFeature) {
        console.log(`  → Using closest property (~${Math.round(bestDistance)}m from point)`);
      }
    }
    
    if (!bestFeature) {
      console.log(`  Could not determine best BUPi property`);
      return null;
    }
    
    // Extract data from the best feature
    const props = bestFeature.properties || {};
    const centroid = calculateCentroid(bestFeature.geometry);
    
    const result: BUPiPropertyInfo = {
      bupi_id: props.OBJECTID ? String(props.OBJECTID) : props.objectid ? String(props.objectid) : undefined,
      area_m2: props.Shape_Area || props.SHAPE_Area || props.shape_area || undefined,
      
      geometry: bestFeature.geometry,
      centroid: centroid || undefined,
      
      distance_meters: containsPoint ? 0 : Math.round(bestDistance),
      contains_point: containsPoint,
      
      source: "BUPi - Balcão Único do Prédio (RGG)",
      service_url: BUPI_WFS_BASE,
      coordinates: {
        longitude: lon,
        latitude: lat,
        srs: "EPSG:4326"
      },
      notes: containsPoint 
        ? "Point is inside property" 
        : `Closest property, ~${Math.round(bestDistance)}m from point`
    };
    
    console.log(`  ✓ Found BUPi property: ${result.bupi_id || 'unknown'} (${result.area_m2 ? result.area_m2.toFixed(0) + 'm²' : 'unknown area'}, ${containsPoint ? 'contains point' : `~${Math.round(bestDistance)}m away`})`);
    
    return result;
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`BUPi WFS API error: ${error.message}`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
      }
    } else {
      console.error(`Unexpected error querying BUPi WFS:`, error);
    }
    return null;
  }
}

// CLI interface for testing
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log("Usage: ts-node bupi_lookup.ts <longitude> <latitude>");
    console.log("Example: ts-node bupi_lookup.ts -9.15 38.75");
    process.exit(1);
  }
  
  const lon = parseFloat(args[0]);
  const lat = parseFloat(args[1]);
  
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.error("Invalid coordinates");
    process.exit(1);
  }
  
  (async () => {
    console.log(`\n=== BUPi Property Lookup ===`);
    console.log(`Coordinates: ${lon}, ${lat}\n`);
    
    const info = await getBUPiPropertyInfo(lon, lat);
    
    if (info) {
      console.log(`\n✓ BUPi Property Information:`);
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log(`\n✗ No BUPi property information found`);
    }
  })();
}
