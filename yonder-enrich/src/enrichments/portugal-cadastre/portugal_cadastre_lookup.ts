#!/usr/bin/env ts-node

import axios from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, polygon as turfPolygon } from "@turf/helpers";

// Portugal Cadastre OGC API Features endpoint
const CADASTRE_API_BASE = "https://ogcapi.dgterritorio.gov.pt";
const CADASTRE_COLLECTION = "cadastro"; // Cadastro Predial - Continente

// Keep-alive HTTP agents for connection pooling
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 50,
  rejectUnauthorized: false  // DGT API may have certificate chain issues
});

const AX = axios.create({
  headers: { 
    Accept: "application/geo+json, application/json",
    "User-Agent": "yonder-enrich/1.0" 
  },
  timeout: 30_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

interface PortugalCadastralFeature {
  type: "Feature";
  id: number;
  geometry: {
    type: "MultiPolygon" | "Polygon";
    coordinates: any;
  };
  properties: {
    nationalcadastralreference: string;  // NIC - Número de Inscrição na Carta Cadastral
    inspireid: string;
    label: string;
    areavalue: number;  // Area in m²
    beginlifespanversion?: string;  // Registration date
    validfrom?: string | null;
    validto?: string | null;
    endlifespanversion?: string | null;
    administrativeunit?: string;  // Municipality code
  };
}

interface PortugalCadastralInfo {
  cadastral_reference: string;  // NIC
  inspire_id?: string;
  label?: string;
  parcel_area_m2?: number;
  registration_date?: string;
  administrative_unit?: string;
  municipality_code?: string;
  
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
 * Query Portugal cadastre by coordinates using OGC API Features
 * 
 * Uses bbox filtering to find parcels near the given point,
 * then returns the parcel that contains the point or is closest to it.
 */
export async function getPortugalCadastralInfo(
  lon: number,
  lat: number
): Promise<PortugalCadastralInfo | null> {
  try {
    // Create bbox around the point (approximately 100m buffer)
    const buffer = 0.001; // ~100 meters in degrees
    const bbox = `${lon - buffer},${lat - buffer},${lon + buffer},${lat + buffer}`;
    
    // Query OGC API Features with bbox
    const url = `${CADASTRE_API_BASE}/collections/${CADASTRE_COLLECTION}/items`;
    const params = {
      bbox,
      limit: 20,  // Get nearby parcels
      f: 'json'
    };
    
    console.log(`  Querying Portugal cadastre at (${lon.toFixed(6)}, ${lat.toFixed(6)})...`);
    
    const response = await AX.get(url, { params });
    const data = response.data;
    
    if (!data.features || data.features.length === 0) {
      console.log(`  No cadastral parcels found near coordinates`);
      return null;
    }
    
    console.log(`  Found ${data.features.length} nearby parcel(s)`);
    
    // Find parcel that contains the point, or the closest one
    let bestFeature: PortugalCadastralFeature | null = null;
    let bestDistance = Infinity;
    let containsPoint = false;
    
    for (const feature of data.features as PortugalCadastralFeature[]) {
      // Check if point is inside this parcel
      const inside = isPointInGeometry(lon, lat, feature.geometry);
      
      if (inside) {
        bestFeature = feature;
        containsPoint = true;
        bestDistance = 0;
        break; // Found exact parcel
      }
      
      // Calculate distance to parcel centroid
      const centroid = calculateCentroid(feature.geometry);
      if (centroid) {
        const distance = calculateDistance(lon, lat, centroid[0], centroid[1]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestFeature = feature;
        }
      }
    }
    
    if (!bestFeature) {
      console.log(`  Could not determine best parcel`);
      return null;
    }
    
    // Extract data from the best feature
    const props = bestFeature.properties;
    const centroid = calculateCentroid(bestFeature.geometry);
    
    const result: PortugalCadastralInfo = {
      cadastral_reference: props.nationalcadastralreference,
      inspire_id: props.inspireid,
      label: props.label,
      parcel_area_m2: props.areavalue,
      registration_date: props.beginlifespanversion,
      administrative_unit: props.administrativeunit,
      municipality_code: props.administrativeunit,
      
      geometry: bestFeature.geometry,
      centroid: centroid || undefined,
      
      distance_meters: containsPoint ? 0 : Math.round(bestDistance),
      contains_point: containsPoint,
      
      source: "Portugal Cadastre - Direção-Geral do Território",
      service_url: url,
      coordinates: {
        longitude: lon,
        latitude: lat,
        srs: "EPSG:4326"
      },
      notes: containsPoint 
        ? "Point is inside parcel" 
        : `Closest parcel, ~${Math.round(bestDistance)}m from point`
    };
    
    console.log(`  ✓ Found cadastral parcel: ${props.label} (${props.areavalue}m², ${containsPoint ? 'contains point' : `~${Math.round(bestDistance)}m away`})`);
    
    return result;
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Portugal cadastre API error: ${error.message}`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Response:`, error.response.data);
      }
    } else {
      console.error(`Unexpected error querying Portugal cadastre:`, error);
    }
    return null;
  }
}

/**
 * Get multiple cadastral parcels near a point
 * Useful for understanding parcel boundaries in the area
 */
export async function getNearbyCadastralParcels(
  lon: number,
  lat: number,
  maxResults: number = 10
): Promise<PortugalCadastralInfo[]> {
  try {
    const buffer = 0.002; // ~200 meters
    const bbox = `${lon - buffer},${lat - buffer},${lon + buffer},${lat + buffer}`;
    
    const url = `${CADASTRE_API_BASE}/collections/${CADASTRE_COLLECTION}/items`;
    const params = {
      bbox,
      limit: maxResults,
      f: 'json'
    };
    
    const response = await AX.get(url, { params });
    const data = response.data;
    
    if (!data.features || data.features.length === 0) {
      return [];
    }
    
    return data.features.map((feature: PortugalCadastralFeature) => {
      const props = feature.properties;
      const centroid = calculateCentroid(feature.geometry);
      const distance = centroid ? calculateDistance(lon, lat, centroid[0], centroid[1]) : null;
      const containsPoint = isPointInGeometry(lon, lat, feature.geometry);
      
      return {
        cadastral_reference: props.nationalcadastralreference,
        inspire_id: props.inspireid,
        label: props.label,
        parcel_area_m2: props.areavalue,
        registration_date: props.beginlifespanversion,
        administrative_unit: props.administrativeunit,
        municipality_code: props.administrativeunit,
        
        geometry: feature.geometry,
        centroid: centroid || undefined,
        
        distance_meters: distance !== null ? Math.round(distance) : undefined,
        contains_point: containsPoint,
        
        source: "Portugal Cadastre - Direção-Geral do Território",
        service_url: url,
        coordinates: {
          longitude: lon,
          latitude: lat,
          srs: "EPSG:4326"
        }
      };
    });
    
  } catch (error) {
    console.error(`Error fetching nearby parcels:`, error);
    return [];
  }
}

// CLI interface for testing
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log("Usage: ts-node portugal_cadastre_lookup.ts <longitude> <latitude>");
    console.log("Example: ts-node portugal_cadastre_lookup.ts -9.15 38.75");
    process.exit(1);
  }
  
  const lon = parseFloat(args[0]);
  const lat = parseFloat(args[1]);
  
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.error("Invalid coordinates");
    process.exit(1);
  }
  
  (async () => {
    console.log(`\n=== Portugal Cadastral Lookup ===`);
    console.log(`Coordinates: ${lon}, ${lat}\n`);
    
    const info = await getPortugalCadastralInfo(lon, lat);
    
    if (info) {
      console.log(`\n✓ Cadastral Information:`);
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log(`\n✗ No cadastral information found`);
    }
  })();
}
