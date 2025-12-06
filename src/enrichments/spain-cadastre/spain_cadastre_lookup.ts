#!/usr/bin/env ts-node

import axios from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { parseStringPromise } from "xml2js";
import minimist from "minimist";
import proj4 from "proj4";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, polygon as turfPolygon } from "@turf/helpers";

// Define projections
// EPSG:25831 - ETRS89 / UTM zone 31N (Catalunya, Aragón, parts of Valencia)
proj4.defs("EPSG:25831", "+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
// EPSG:25830 - ETRS89 / UTM zone 30N (Galicia, Asturias, Madrid, parts of Castilla)
proj4.defs("EPSG:25830", "+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
// EPSG:25829 - ETRS89 / UTM zone 29N (Canary Islands)
proj4.defs("EPSG:25829", "+proj=utm +zone=29 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

/**
 * Determine which UTM zone to use based on longitude
 * Spain uses ETRS89 UTM zones 29N, 30N, and 31N
 */
function getUTMZoneForSpain(lon: number): string {
  if (lon < -6) return "EPSG:25829"; // Zone 29N (Canary Islands, westernmost Spain)
  if (lon < 0) return "EPSG:25830";  // Zone 30N (Most of western Spain)
  return "EPSG:25831";                // Zone 31N (Catalunya, eastern Spain)
}

/**
 * Parse GML coordinates string into array of coordinate pairs
 * GML format: "x1 y1 x2 y2 x3 y3..." or "x1,y1 x2,y2 x3,y3..."
 */
function parseGMLCoordinates(coordString: string): number[][] {
  if (!coordString) return [];
  
  // Handle both space and comma separators
  const coords = coordString.trim().split(/\s+/);
  const pairs: number[][] = [];
  
  for (let i = 0; i < coords.length; i += 2) {
    if (i + 1 < coords.length) {
      pairs.push([parseFloat(coords[i]), parseFloat(coords[i + 1])]);
    }
  }
  
  return pairs;
}

/**
 * Extract geometry from GML element
 */
function extractGMLGeometry(gmlElement: any): any {
  if (!gmlElement) return null;
  
  // Try different GML geometry types
  const polygon = gmlElement['gml:Polygon']?.[0] || gmlElement['Polygon']?.[0];
  const point = gmlElement['gml:Point']?.[0] || gmlElement['Point']?.[0];
  const multiSurface = gmlElement['gml:MultiSurface']?.[0] || gmlElement['MultiSurface']?.[0];
  
  if (point) {
    const pos = point['gml:pos']?.[0] || point['pos']?.[0];
    if (pos) {
      const coords = parseGMLCoordinates(pos);
      return {
        type: "Point",
        coordinates: coords[0] || []
      };
    }
  }
  
  if (polygon) {
    const exterior = polygon['gml:exterior']?.[0] || polygon['exterior']?.[0];
    const linearRing = exterior?.['gml:LinearRing']?.[0] || exterior?.['LinearRing']?.[0];
    const posList = linearRing?.['gml:posList']?.[0] || linearRing?.['posList']?.[0];
    
    if (posList) {
      const coords = parseGMLCoordinates(posList);
      return {
        type: "Polygon",
        coordinates: [coords]
      };
    }
  }
  
  if (multiSurface) {
    // MultiSurface can contain multiple polygons
    const surfaceMembers = multiSurface['gml:surfaceMember'] || multiSurface['surfaceMember'] || [];
    const polygons: number[][][] = [];
    
    for (const member of surfaceMembers) {
      const poly = member['gml:Polygon']?.[0] || member['Polygon']?.[0];
      if (poly) {
        const exterior = poly['gml:exterior']?.[0] || poly['exterior']?.[0];
        const linearRing = exterior?.['gml:LinearRing']?.[0] || exterior?.['LinearRing']?.[0];
        const posList = linearRing?.['gml:posList']?.[0] || linearRing?.['posList']?.[0];
        
        if (posList) {
          const coords = parseGMLCoordinates(posList);
          polygons.push(coords);
        }
      }
    }
    
    if (polygons.length === 1) {
      return {
        type: "Polygon",
        coordinates: polygons
      };
    } else if (polygons.length > 1) {
      return {
        type: "MultiPolygon",
        coordinates: polygons.map(p => [p])
      };
    }
  }
  
  return null;
}

type Feature = {
  type: "Feature";
  id?: string | number;
  geometry: { type: string; coordinates: any };
  properties: Record<string, any>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

// Spanish Cadastre WFS endpoints (INSPIRE-compliant)
// Note: SOAP OVCCoordenadas API often returns 500 errors, so we use WFS service URLs
const CADASTRE_WFS_PARCELS = "http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx";
const CADASTRE_WFS_ADDRESSES = "http://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx";
const CADASTRE_WFS_BUILDINGS = "http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx";

// WMS service URL for map images
const CADASTRE_WMS = "http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx";

const ACCEPT = "application/geo+json, application/json;q=0.9, application/xml;q=0.8";

// Keep-alive HTTP agents
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 50,
  rejectUnauthorized: false // Spanish Cadastre SSL certificate has known issues
});

const AX = axios.create({
  headers: { Accept: ACCEPT, "User-Agent": "yonder-enrich/1.0" },
  timeout: 30_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

interface CadastralReferenceResult {
  cadastral_reference?: string;
  address?: string;
  postal_code?: string;
  municipality?: string;
  province?: string;
  coordinates?: {
    x: number;
    y: number;
    srs: string;
  };
  parcel_area?: number;
  land_use?: string;
  construction_year?: number;
  built_area?: number;
  source: string;
  service_url: string;
  distance_meters?: number;
}

/**
 * Query WFS directly for cadastral reference from coordinates
 * More reliable than SOAP API which often returns 500 errors
 */
async function getCadastralReferenceByCoordinates(
  lon: number, 
  lat: number,
  srs: string = "EPSG:4326"
): Promise<CadastralReferenceResult | null> {
  try {
    // Query the WFS Parcels service directly
    // This is more reliable than the SOAP OVCCoordenadas service
    const parcel = await getParcelDataFromWFS(lon, lat);
    
    if (!parcel?.properties) {
      return null;
    }

    const props = parcel.properties;
    
    return {
      cadastral_reference: props.nationalCadastralReference || props.inspireId || undefined,
      address: props.label || undefined,
      postal_code: undefined, // Not typically in WFS parcel data
      parcel_area: props.areaValue || undefined,
      coordinates: {
        x: lon,
        y: lat,
        srs: srs
      },
      source: "Spanish Cadastre WFS (Parcels)",
      service_url: CADASTRE_WFS_PARCELS
    };
  } catch (error) {
    console.warn("WFS cadastral reference query failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Alternative: Get all cadastral parcels within a radius using WFS
 * Gets all cadastral references within the WFS query bbox
 */
async function getCadastralReferencesByDistance(
  lon: number,
  lat: number,
  srs: string = "EPSG:4326"
): Promise<CadastralReferenceResult[]> {
  try {
    // Use a larger buffer for distance search (100m)
    const buffer = 0.001; // roughly 100 meters
    const bbox = `${lon - buffer},${lat - buffer},${lon + buffer},${lat + buffer}`;
    
    const url = `${CADASTRE_WFS_PARCELS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=CP.CadastralParcel&bbox=${bbox}&srsName=EPSG:4326&outputFormat=application/json&count=20`;
    
    const response = await AX.get(url);
    const fc = response.data as FeatureCollection;
    
    if (!fc?.features || fc.features.length === 0) {
      return [];
    }
    
    return fc.features.map((feature: Feature) => {
      const props = feature.properties || {};
      
      return {
        cadastral_reference: props.nationalCadastralReference || props.inspireId || undefined,
        address: props.label || undefined,
        parcel_area: props.areaValue || undefined,
        coordinates: {
          x: lon,
          y: lat,
          srs: srs
        },
        source: "Spanish Cadastre WFS (Parcels - Distance)",
        service_url: url
      };
    });
  } catch (error) {
    console.warn("WFS distance-based query failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Query WFS service for cadastral parcels
 * Provides detailed parcel geometry and attributes
 */
async function getParcelDataFromWFS(
  lon: number,
  lat: number
): Promise<Feature | null> {
  try {
    // CRITICAL: Spanish Cadastre WFS requires projected coordinates (UTM), not geographic (lat/lon)
    // Determine the appropriate UTM zone for this location
    const utmZone = getUTMZoneForSpain(lon);
    
    // Transform from WGS84 to UTM
    const [utmX, utmY] = proj4("EPSG:4326", utmZone, [lon, lat]);
    
    // Create bbox in projected coordinates (meters)
    // Start with a very small bbox - cadastral parcels are typically small
    const buffer = 50; // 50 meters in UTM coordinates
    const minx = utmX - buffer;
    const miny = utmY - buffer;
    const maxx = utmX + buffer;
    const maxy = utmY + buffer;
    
    // Bbox format: minx,miny,maxx,maxy,CRS
    const bbox = `${minx},${miny},${maxx},${maxy}`;
    
    // Use WFS 2.0 with projected coordinates
    const url = `${CADASTRE_WFS_PARCELS}?service=WFS&version=2.0.0&request=GetFeature&TYPENAMES=CP.CadastralParcel&bbox=${bbox}&SRSNAME=${utmZone}&count=10`;
    
    const response = await AX.get(url);
    
    const contentType = response.headers['content-type'] || '';
    
    // Parse GML/XML response
    if (contentType.includes('xml') || contentType.includes('gml')) {
      const parsed = await parseStringPromise(response.data);
      
      // Navigate GML structure
      const collection = parsed['wfs:FeatureCollection'] || parsed['FeatureCollection'];
      if (!collection) {
        return null;
      }
      
      const members = collection['wfs:member'] || collection['gml:featureMember'] || collection['featureMember'] || collection['member'] || [];
      
      if (members.length === 0) {
        return null;
      }
      
      // Extract ALL cadastral parcels, not just the first one
      const parcels: Feature[] = [];
      
      for (const member of members) {
        const parcel = member['cp:CadastralParcel']?.[0] || member['CadastralParcel']?.[0];
        
        if (!parcel) continue;
        
        // Extract properties from GML
        const properties: Record<string, any> = {};
        
        // National Cadastral Reference (the most important field)
        if (parcel['cp:nationalCadastralReference']) {
          properties.nationalCadastralReference = parcel['cp:nationalCadastralReference'][0];
        }
        
        // inspireId
        if (parcel['cp:inspireId']) {
          const inspireId = parcel['cp:inspireId'][0]['cp:Identifier']?.[0];
          if (inspireId) {
            properties.inspireId = inspireId['cp:localId']?.[0] || inspireId['localId']?.[0];
            properties.namespace = inspireId['cp:namespace']?.[0] || inspireId['namespace']?.[0];
          }
        }
        
        // Area value
        if (parcel['cp:areaValue']) {
          const areaValue = parcel['cp:areaValue'][0];
          if (typeof areaValue === 'object' && areaValue['_']) {
            properties.areaValue = parseFloat(areaValue['_']);
          } else {
            properties.areaValue = parseFloat(areaValue);
          }
        }
        
        // Label
        if (parcel['cp:label']) {
          properties.label = parcel['cp:label'][0];
        }
        
        // Beginning of lifespan
        if (parcel['cp:beginLifespanVersion']) {
          properties.beginLifespanVersion = parcel['cp:beginLifespanVersion'][0];
        }
        
        // End of lifespan / validity
        if (parcel['cp:endLifespanVersion']) {
          properties.endLifespanVersion = parcel['cp:endLifespanVersion'][0];
        }
        
        // Valid from/to
        if (parcel['cp:validFrom']) {
          properties.validFrom = parcel['cp:validFrom'][0];
        }
        if (parcel['cp:validTo']) {
          properties.validTo = parcel['cp:validTo'][0];
        }
        
        // Reference point (official centroid)
        if (parcel['cp:referencePoint']) {
          const refPoint = extractGMLGeometry(parcel['cp:referencePoint'][0]);
          if (refPoint) {
            properties.referencePoint = refPoint;
          }
        }
        
        // Cadastral Zoning
        if (parcel['cp:zoning']) {
          const zoningArray = Array.isArray(parcel['cp:zoning']) ? parcel['cp:zoning'] : [parcel['cp:zoning']];
          properties.zoning = zoningArray.map((z: any) => {
            const zoningRef = z['cp:CadastralZoning']?.[0] || z['CadastralZoning']?.[0];
            if (zoningRef) {
              return {
                inspireId: zoningRef['cp:inspireId']?.[0],
                label: zoningRef['cp:label']?.[0],
                nationalCadastralZoningReference: zoningRef['cp:nationalCadastralZoningReference']?.[0]
              };
            }
            return null;
          }).filter((z: any) => z !== null);
        }
        
        // Extract full parcel geometry
        let geometry = null;
        if (parcel['cp:geometry']) {
          geometry = extractGMLGeometry(parcel['cp:geometry'][0]);
        }
        
        parcels.push({
          type: "Feature",
          geometry: geometry || { type: "Unknown", coordinates: [] },
          properties
        });
      }
      
      // Return the first parcel (for backward compatibility)
      // But we'll also return all parcels in the main function
      return parcels.length > 0 ? parcels[0] : null;
    }
    
    // Try JSON format
    const fc = response.data as FeatureCollection;
    if (!fc?.features || fc.features.length === 0) {
      return null;
    }
    
    return fc.features[0];
    
  } catch (error) {
    console.warn("WFS parcel query failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Query WFS service for the specific parcel containing a point
 * Uses spatial filtering to get only the parcel that contains the coordinates
 */
async function getAllParcelsFromWFS(
  lon: number,
  lat: number
): Promise<Feature[]> {
  try {
    const utmZone = getUTMZoneForSpain(lon);
    const [utmX, utmY] = proj4("EPSG:4326", utmZone, [lon, lat]);
    
    // Use a tight bbox to limit results
    const buffer = 100; // 100 meters
    const bbox = `${utmX - buffer},${utmY - buffer},${utmX + buffer},${utmY + buffer}`;
    const url = `${CADASTRE_WFS_PARCELS}?service=WFS&version=2.0.0&request=GetFeature&TYPENAMES=CP.CadastralParcel&bbox=${bbox}&SRSNAME=${utmZone}&count=50`;
    
    const response = await AX.get(url);
    const parsed = await parseStringPromise(response.data);
    
    const collection = parsed['wfs:FeatureCollection'] || parsed['FeatureCollection'];
    if (!collection) return [];
    
    const members = collection['wfs:member'] || collection['gml:featureMember'] || collection['featureMember'] || collection['member'] || [];
    if (members.length === 0) return [];
    
    const parcels: Feature[] = [];
    const queryPoint = turfPoint([lon, lat]);
    
    for (const member of members) {
      const parcel = member['cp:CadastralParcel']?.[0] || member['CadastralParcel']?.[0];
      if (!parcel) continue;
      
      const properties: Record<string, any> = {};
      
      if (parcel['cp:nationalCadastralReference']) {
        properties.nationalCadastralReference = parcel['cp:nationalCadastralReference'][0];
      }
      if (parcel['cp:areaValue']) {
        const areaValue = parcel['cp:areaValue'][0];
        properties.areaValue = typeof areaValue === 'object' && areaValue['_'] ? parseFloat(areaValue['_']) : parseFloat(areaValue);
      }
      if (parcel['cp:label']) {
        properties.label = parcel['cp:label'][0];
      }
      if (parcel['cp:beginLifespanVersion']) {
        properties.beginLifespanVersion = parcel['cp:beginLifespanVersion'][0];
      }
      if (parcel['cp:validFrom']) {
        properties.validFrom = parcel['cp:validFrom'][0];
      }
      
      // Extract reference point for spatial filtering
      let refPointCoords: [number, number] | null = null;
      if (parcel['cp:referencePoint']) {
        const refPoint = extractGMLGeometry(parcel['cp:referencePoint'][0]);
        if (refPoint && refPoint.coordinates && refPoint.coordinates.length === 2) {
          // Reference point is in UTM, convert back to WGS84
          const [refLon, refLat] = proj4(utmZone, "EPSG:4326", refPoint.coordinates);
          refPointCoords = [refLon, refLat];
          properties.referencePoint = { type: "Point", coordinates: [refLon, refLat] };
        }
      }
      
      if (parcel['cp:zoning']) {
        const zoningArray = Array.isArray(parcel['cp:zoning']) ? parcel['cp:zoning'] : [parcel['cp:zoning']];
        properties.zoning = zoningArray.map((z: any) => {
          const zoningRef = z['cp:CadastralZoning']?.[0] || z['CadastralZoning']?.[0];
          return zoningRef ? {
            label: zoningRef['cp:label']?.[0],
            nationalCadastralZoningReference: zoningRef['cp:nationalCadastralZoningReference']?.[0]
          } : null;
        }).filter((z: any) => z !== null);
      }
      
      // Extract geometry (simplified - just noting if it exists)
      let geometry = null;
      if (parcel['cp:geometry']) {
        geometry = extractGMLGeometry(parcel['cp:geometry'][0]);
        // Convert UTM coordinates to WGS84 if geometry was extracted
        if (geometry && geometry.coordinates && geometry.coordinates.length > 0) {
          try {
            if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates[0])) {
              geometry.coordinates = geometry.coordinates.map((ring: number[][]) =>
                ring.map((coord: number[]) => {
                  if (coord.length >= 2) {
                    return proj4(utmZone, "EPSG:4326", [coord[0], coord[1]]);
                  }
                  return coord;
                })
              );
            }
          } catch (e) {
            // Keep original if conversion fails
          }
        }
      }
      
      // Calculate distance from query point to reference point for ranking
      if (refPointCoords) {
        const refTurfPoint = turfPoint(refPointCoords);
        const distance = Math.sqrt(
          Math.pow(lon - refPointCoords[0], 2) + Math.pow(lat - refPointCoords[1], 2)
        ) * 111000; // rough conversion to meters
        properties.distance_meters = Math.round(distance);
      }
      
      parcels.push({
        type: "Feature",
        geometry: geometry || { type: "Unknown", coordinates: [] },
        properties
      });
    }
    
    // Sort by distance to find the parcel most likely containing the point
    parcels.sort((a, b) => {
      const distA = a.properties.distance_meters || Infinity;
      const distB = b.properties.distance_meters || Infinity;
      return distA - distB;
    });
    
    // Return only the closest parcel (most likely to contain the point)
    return parcels.length > 0 ? [parcels[0]] : [];
  } catch (error) {
    console.warn("WFS all parcels query failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Generate WMS GetMap URL for cadastral parcel visualization
 * Returns a URL that can be used to display the parcel as an image
 */
function generateCadastralMapImageURL(
  lon: number,
  lat: number,
  options: {
    buffer?: number;      // Buffer around point in meters (default: 100m)
    width?: number;       // Image width in pixels (default: 800)
    height?: number;      // Image height in pixels (default: 600)
    layers?: string[];    // WMS layers to display (default: parcels)
    transparent?: boolean; // Transparent background (default: true)
  } = {}
): { wmsUrl: string; viewUrl: string; embeddableHtml: string } {
  const {
    buffer = 100,
    width = 800,
    height = 600,
    layers = ['CP.CadastralParcel'],
    transparent = true
  } = options;
  
  // Get UTM zone and convert coordinates
  const utmZone = getUTMZoneForSpain(lon);
  const [utmX, utmY] = proj4("EPSG:4326", utmZone, [lon, lat]);
  
  // Create bounding box in UTM coordinates
  const minX = utmX - buffer;
  const minY = utmY - buffer;
  const maxX = utmX + buffer;
  const maxY = utmY + buffer;
  
  // Build WMS GetMap URL (using WMS 1.1.1 for better compatibility)
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: layers.join(','),
    SRS: utmZone,  // WMS 1.1.1 uses SRS instead of CRS
    BBOX: `${minX},${minY},${maxX},${maxY}`, // WMS 1.1.1 uses minX,minY,maxX,maxY order
    WIDTH: width.toString(),
    HEIGHT: height.toString(),
    FORMAT: 'image/png',
    TRANSPARENT: transparent.toString(),
    STYLES: ''
  });
  
  const wmsUrl = `${CADASTRE_WMS}?${params.toString()}`;
  
  // Generate a simple HTML viewer URL (using data URI)
  const viewerHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Spanish Cadastre - Parcel View</title>
  <style>
    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f0f0f0; }
    .container { max-width: ${width}px; margin: 0 auto; background: white; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { margin-top: 0; color: #333; }
    img { width: 100%; height: auto; border: 1px solid #ddd; }
    .info { margin-top: 10px; padding: 10px; background: #f9f9f9; border-left: 3px solid #007bff; }
    .coords { font-family: monospace; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📍 Cadastral Parcel View</h1>
    <div class="info">
      <strong>Location:</strong> <span class="coords">${lon.toFixed(6)}, ${lat.toFixed(6)}</span><br>
      <strong>Projection:</strong> ${utmZone}<br>
      <strong>Layers:</strong> ${layers.join(', ')}
    </div>
    <img src="${wmsUrl}" alt="Cadastral Parcel Map" />
    <div class="info">
      <small>Source: Spanish Cadastre (Dirección General del Catastro)</small><br>
      <small><a href="${wmsUrl}" target="_blank">Open image in new tab</a></small>
    </div>
  </div>
</body>
</html>`;
  
  const viewUrl = `data:text/html;base64,${Buffer.from(viewerHtml).toString('base64')}`;
  
  // Embeddable HTML snippet
  const embeddableHtml = `<img src="${wmsUrl}" alt="Cadastral parcel at ${lon.toFixed(4)}, ${lat.toFixed(4)}" style="width:100%;max-width:${width}px;border:1px solid #ddd;" />`;
  
  return {
    wmsUrl,      // Direct image URL
    viewUrl,     // Data URI with HTML viewer
    embeddableHtml  // HTML snippet to embed
  };
}

/**
 * Generate interactive Leaflet map HTML with WMS layers and plot highlight
 */
function generateInteractiveMapHTML(
  lon: number,
  lat: number,
  plotData: {
    cadastralRef: string;
    label?: string;
    area?: number;
    referencePoint?: [number, number];
  }
): string {
  const areaM2 = plotData.area || 1000;
  const radiusM = Math.sqrt(areaM2 / Math.PI);
  const refPoint = plotData.referencePoint || [lon, lat];
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Plot ${plotData.cadastralRef}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    #map { width: 100%; height: 100vh; }
    .highlight-marker {
      background-color: #ff4444;
      border: 3px solid white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      box-shadow: 0 0 10px rgba(255, 68, 68, 0.8);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 10px rgba(255, 68, 68, 0.8); }
      50% { box-shadow: 0 0 20px rgba(255, 68, 68, 1); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView([${lat}, ${lon}], 18);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      opacity: 0.3
    }).addTo(map);
    
    L.tileLayer.wms('http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx', {
      layers: 'CP.CadastralParcel',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      attribution: '© Catastro',
      opacity: 0.8
    }).addTo(map);
    
    L.tileLayer.wms('http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx', {
      layers: 'BU.Building',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: 0.7
    }).addTo(map);
    
    const icon = L.divIcon({ className: 'highlight-marker', iconSize: [20, 20], iconAnchor: [10, 10] });
    L.marker([${lat}, ${lon}], { icon }).addTo(map)
      .bindPopup('<b>Plot ${plotData.label || plotData.cadastralRef}</b><br>Area: ${areaM2} m²').openPopup();
    
    L.circle([${refPoint[1]}, ${refPoint[0]}], {
      color: '#ffff00',
      fillColor: '#ffff00',
      fillOpacity: 0.2,
      radius: ${radiusM},
      weight: 2
    }).addTo(map).bindTooltip('Parcel ${plotData.label || ''}<br>~${radiusM.toFixed(0)}m radius');
    
    L.control.scale().addTo(map);
  </script>
</body>
</html>`;
}

/**
 * Query WFS for parcel geometry using cadastral reference
 * This uses a filter to get the specific parcel with full geometry
 */
async function getParcelGeometryByCadastralRef(
  cadastralRef: string,
  utmZone: string
): Promise<any> {
  try {
    // Try using CQL_FILTER with GET request (more widely supported)
    const cqlFilter = `nationalCadastralReference='${cadastralRef}'`;
    const url = `${CADASTRE_WFS_PARCELS}?service=WFS&version=2.0.0&request=GetFeature&TYPENAMES=CP.CadastralParcel&CQL_FILTER=${encodeURIComponent(cqlFilter)}&SRSNAME=${utmZone}`;
    
    console.log(`  Trying CQL filter: ${cqlFilter}`);
    const response = await AX.get(url);
    
    if (!response.data) return null;
    
    const parsed = await parseStringPromise(response.data);
    const collection = parsed['wfs:FeatureCollection'] || parsed['FeatureCollection'];
    if (!collection) return null;
    
    const members = collection['wfs:member'] || collection['gml:featureMember'] || collection['featureMember'] || collection['member'] || [];
    if (members.length === 0) return null;
    
    const parcel = members[0]['cp:CadastralParcel']?.[0] || members[0]['CadastralParcel']?.[0];
    if (!parcel || !parcel['cp:geometry']) return null;
    
    const geometry = extractGMLGeometry(parcel['cp:geometry'][0]);
    
    // Convert UTM coordinates to WGS84 if geometry was extracted
    if (geometry && geometry.coordinates && geometry.coordinates.length > 0) {
      try {
        if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates[0])) {
          geometry.coordinates = geometry.coordinates.map((ring: number[][]) =>
            ring.map((coord: number[]) => {
              if (coord.length >= 2) {
                return proj4(utmZone, "EPSG:4326", [coord[0], coord[1]]);
              }
              return coord;
            })
          );
        } else if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates[0])) {
          geometry.coordinates = geometry.coordinates.map((polygon: number[][][]) =>
            polygon.map((ring: number[][]) =>
              ring.map((coord: number[]) => {
                if (coord.length >= 2) {
                  return proj4(utmZone, "EPSG:4326", [coord[0], coord[1]]);
                }
                return coord;
              })
            )
          );
        }
      } catch (e) {
        console.warn("Failed to convert geometry coordinates:", e);
      }
    }
    
    return geometry;
  } catch (error) {
    console.warn(`Failed to fetch geometry for cadastral ref ${cadastralRef}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Query WFS service for buildings with comprehensive attributes
 */
async function getBuildingDataFromWFS(
  lon: number,
  lat: number
): Promise<Feature[]> {
  try {
    const utmZone = getUTMZoneForSpain(lon);
    const [utmX, utmY] = proj4("EPSG:4326", utmZone, [lon, lat]);
    
    const buffer = 50;
    const bbox = `${utmX - buffer},${utmY - buffer},${utmX + buffer},${utmY + buffer}`;
    
    const url = `${CADASTRE_WFS_BUILDINGS}?service=WFS&version=2.0.0&request=GetFeature&TYPENAMES=BU.Building&bbox=${bbox}&SRSNAME=${utmZone}&count=20`;
    
    const response = await AX.get(url);
    const parsed = await parseStringPromise(response.data);
    
    const collection = parsed['wfs:FeatureCollection'] || parsed['FeatureCollection'];
    if (!collection) return [];
    
    const members = collection['wfs:member'] || collection['gml:featureMember'] || collection['featureMember'] || collection['member'] || [];
    if (members.length === 0) return [];
    
    const buildings: Feature[] = [];
    
    for (const member of members) {
      const building = member['bu-core2d:Building']?.[0] || member['bu:Building']?.[0] || member['Building']?.[0];
      if (!building) continue;
      
      const properties: Record<string, any> = {};
      
      // Building reference
      if (building['bu-core2d:inspireId'] || building['bu:inspireId']) {
        const inspireId = (building['bu-core2d:inspireId'] || building['bu:inspireId'])?.[0];
        const identifier = inspireId?.['base:Identifier']?.[0] || inspireId?.['Identifier']?.[0];
        if (identifier) {
          properties.reference = identifier['base:localId']?.[0] || identifier['localId']?.[0];
        }
      }
      
      // Condition of construction
      if (building['bu-core2d:conditionOfConstruction'] || building['bu:conditionOfConstruction']) {
        properties.conditionOfConstruction = (building['bu-core2d:conditionOfConstruction'] || building['bu:conditionOfConstruction'])?.[0];
      }
      
      // Current use
      if (building['bu-core2d:currentUse'] || building['bu:currentUse']) {
        const currentUse = (building['bu-core2d:currentUse'] || building['bu:currentUse'])?.[0];
        const useValue = currentUse?.['bu-core2d:CurrentUse']?.[0] || currentUse?.['CurrentUse']?.[0];
        if (useValue && useValue['bu-core2d:currentUse']) {
          properties.currentUse = useValue['bu-core2d:currentUse'][0];
        }
      }
      
      // Date of construction
      if (building['bu-core2d:dateOfConstruction'] || building['bu:dateOfConstruction']) {
        properties.dateOfConstruction = (building['bu-core2d:dateOfConstruction'] || building['bu:dateOfConstruction'])?.[0];
      }
      
      // Date of renovation
      if (building['bu-core2d:dateOfRenovation'] || building['bu:dateOfRenovation']) {
        properties.dateOfRenovation = (building['bu-core2d:dateOfRenovation'] || building['bu:dateOfRenovation'])?.[0];
      }
      
      // Number of dwellings
      if (building['bu-core2d:numberOfDwellings'] || building['bu:numberOfDwellings']) {
        properties.numberOfDwellings = parseInt((building['bu-core2d:numberOfDwellings'] || building['bu:numberOfDwellings'])?.[0] || '0');
      }
      
      // Number of building units
      if (building['bu-core2d:numberOfBuildingUnits'] || building['bu:numberOfBuildingUnits']) {
        properties.numberOfBuildingUnits = parseInt((building['bu-core2d:numberOfBuildingUnits'] || building['bu:numberOfBuildingUnits'])?.[0] || '0');
      }
      
      // Number of floors above ground
      if (building['bu-core2d:numberOfFloorsAboveGround'] || building['bu:numberOfFloorsAboveGround']) {
        properties.numberOfFloorsAboveGround = parseInt((building['bu-core2d:numberOfFloorsAboveGround'] || building['bu:numberOfFloorsAboveGround'])?.[0] || '0');
      }
      
      // Number of floors below ground
      if (building['bu-core2d:numberOfFloorsBelowGround'] || building['bu:numberOfFloorsBelowGround']) {
        properties.numberOfFloorsBelowGround = parseInt((building['bu-core2d:numberOfFloorsBelowGround'] || building['bu:numberOfFloorsBelowGround'])?.[0] || '0');
      }
      
      // Building geometry
      let geometry = null;
      if (building['bu-core2d:geometry'] || building['bu:geometry']) {
        geometry = extractGMLGeometry((building['bu-core2d:geometry'] || building['bu:geometry'])?.[0]);
      }
      
      buildings.push({
        type: "Feature",
        geometry: geometry || { type: "Unknown", coordinates: [] },
        properties
      });
    }
    
    return buildings;
  } catch (error) {
    console.warn("WFS building query failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Query WFS service for addresses
 */
async function getAddressDataFromWFS(
  lon: number,
  lat: number
): Promise<Feature[]> {
  try {
    const utmZone = getUTMZoneForSpain(lon);
    const [utmX, utmY] = proj4("EPSG:4326", utmZone, [lon, lat]);
    
    const buffer = 50;
    const bbox = `${utmX - buffer},${utmY - buffer},${utmX + buffer},${utmY + buffer}`;
    
    const url = `${CADASTRE_WFS_ADDRESSES}?service=WFS&version=2.0.0&request=GetFeature&TYPENAMES=AD.Address&bbox=${bbox}&SRSNAME=${utmZone}&count=20`;
    
    const response = await AX.get(url);
    const parsed = await parseStringPromise(response.data);
    
    const collection = parsed['wfs:FeatureCollection'] || parsed['FeatureCollection'];
    if (!collection) return [];
    
    const members = collection['wfs:member'] || collection['gml:featureMember'] || collection['featureMember'] || collection['member'] || [];
    if (members.length === 0) return [];
    
    const addresses: Feature[] = [];
    
    for (const member of members) {
      const address = member['ad:Address']?.[0] || member['Address']?.[0];
      if (!address) continue;
      
      const properties: Record<string, any> = {};
      
      // Locator (house/building number)
      if (address['ad:locator']) {
        const locators = Array.isArray(address['ad:locator']) ? address['ad:locator'] : [address['ad:locator']];
        properties.locators = locators.map((loc: any) => {
          const locatorDesignator = loc?.['ad:AddressLocator']?.[0] || loc?.['AddressLocator']?.[0];
          return {
            designator: locatorDesignator?.['ad:designator']?.[0],
            type: locatorDesignator?.['ad:type']?.[0],
            level: locatorDesignator?.['ad:level']?.[0]
          };
        });
      }
      
      // Thoroughfare name (street)
      if (address['ad:thoroughfare']) {
        const thoroughfare = address['ad:thoroughfare'][0];
        const tfName = thoroughfare?.['ad:ThoroughfareName']?.[0] || thoroughfare?.['ThoroughfareName']?.[0];
        if (tfName) {
          properties.thoroughfareName = tfName['ad:name']?.[0];
          properties.thoroughfareType = tfName['ad:type']?.[0];
        }
      }
      
      // Post code
      if (address['ad:postCode']) {
        properties.postCode = address['ad:postCode'][0];
      }
      
      // Post name (locality)
      if (address['ad:postName']) {
        properties.postName = address['ad:postName'][0];
      }
      
      // Admin unit (municipality)
      if (address['ad:adminUnit']) {
        properties.adminUnit = address['ad:adminUnit'][0];
      }
      
      // Position (address coordinates)
      if (address['ad:position']) {
        properties.position = extractGMLGeometry(address['ad:position'][0]);
      }
      
      // Valid from/to
      if (address['ad:validFrom']) {
        properties.validFrom = address['ad:validFrom'][0];
      }
      if (address['ad:validTo']) {
        properties.validTo = address['ad:validTo'][0];
      }
      
      let geometry = null;
      if (address['ad:position']) {
        geometry = extractGMLGeometry(address['ad:position'][0]);
      }
      
      addresses.push({
        type: "Feature",
        geometry: geometry || { type: "Unknown", coordinates: [] },
        properties
      });
    }
    
    return addresses;
  } catch (error) {
    console.warn("WFS address query failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Main function: Get comprehensive cadastral information for a point
 */
export async function getSpanishCadastralInfo(lon: number, lat: number) {
  // Strategy:
  // 1. Try WFS direct lookup for parcel at coordinates
  // 2. If that fails, try broader WFS search in area
  // 3. Enhance with building data from WFS
  
  let cadastralData: CadastralReferenceResult | null = null;
  
  // Try direct coordinate lookup first (tight bbox)
  cadastralData = await getCadastralReferenceByCoordinates(lon, lat);
  
  // If no exact match, try broader area search
  if (!cadastralData) {
    const nearby = await getCadastralReferencesByDistance(lon, lat);
    if (nearby.length > 0) {
      // Take the first one from the nearby results
      cadastralData = nearby[0];
    }
  }
  
  if (!cadastralData) {
    return {
      cadastral_reference: null,
      source: "Spanish Cadastre WFS",
      notes: "No cadastral parcel found at this location"
    };
  }
  
  // Query ALL data sources in parallel
  let allParcels: Feature[] = [];
  let buildings: Feature[] = [];
  let addresses: Feature[] = [];
  
  try {
    [allParcels, buildings, addresses] = await Promise.all([
      getAllParcelsFromWFS(lon, lat),
      getBuildingDataFromWFS(lon, lat),
      getAddressDataFromWFS(lon, lat)
    ]);
  } catch (error) {
    console.warn("Failed to fetch WFS enhancement data:", error);
  }
  
  // If we have a parcel with cadastral reference, fetch its full geometry
  if (allParcels.length > 0 && allParcels[0].properties.nationalCadastralReference) {
    const cadastralRef = allParcels[0].properties.nationalCadastralReference;
    const utmZone = getUTMZoneForSpain(lon);
    
    try {
      console.log(`Fetching full geometry for cadastral reference: ${cadastralRef}`);
      const fullGeometry = await getParcelGeometryByCadastralRef(cadastralRef, utmZone);
      
      if (fullGeometry && fullGeometry.coordinates && fullGeometry.coordinates.length > 0) {
        // Replace the empty geometry with the full one
        allParcels[0].geometry = fullGeometry;
        console.log(`✓ Got full parcel geometry: ${fullGeometry.type}`);
      }
    } catch (error) {
      console.warn("Failed to fetch full parcel geometry:", error);
    }
  }
  
  // Generate WMS map image URLs
  const mapImages = generateCadastralMapImageURL(lon, lat, {
    buffer: 150,  // 150m around the point
    layers: ['CP.CadastralParcel', 'BU.Building'],  // Show parcels and buildings
    width: 1024,
    height: 768
  });
  
  // Generate interactive map HTML if we have parcel data
  let interactiveMapHtml = null;
  if (allParcels.length > 0) {
    interactiveMapHtml = generateInteractiveMapHTML(lon, lat, {
      cadastralRef: allParcels[0].properties.nationalCadastralReference,
      label: allParcels[0].properties.label,
      area: allParcels[0].properties.areaValue,
      referencePoint: allParcels[0].properties.referencePoint?.coordinates as [number, number]
    });
  }
  
  // Merge all data sources
  const result: any = {
    cadastral_reference: cadastralData.cadastral_reference,
    address: cadastralData.address,
    postal_code: cadastralData.postal_code,
    municipality: cadastralData.municipality,
    province: cadastralData.province,
    coordinates: cadastralData.coordinates,
    distance_meters: cadastralData.distance_meters,
    source: cadastralData.source,
    service_urls: [cadastralData.service_url],
    map_images: {
      wms_url: mapImages.wmsUrl,
      viewer_url: mapImages.viewUrl,
      embeddable_html: mapImages.embeddableHtml,
      interactive_map_html: interactiveMapHtml,
      description: "WMS map images showing cadastral parcels and buildings. Use interactive_map_html for full Leaflet map, or wms_url for simple image."
    }
  };
  
  // Add ALL parcels at this location (not just the first one)
  if (allParcels.length > 0) {
    result.parcels = allParcels.map(p => ({
      cadastral_reference: p.properties.nationalCadastralReference,
      area_value: p.properties.areaValue,
      label: p.properties.label,
      beginning_lifespan: p.properties.beginLifespanVersion,
      valid_from: p.properties.validFrom,
      valid_to: p.properties.validTo,
      reference_point: p.properties.referencePoint,
      zoning: p.properties.zoning,
      geometry: p.geometry
    }));
    
    // For backward compatibility, keep single "parcel" field with the first one
    result.parcel = result.parcels[0];
    result.parcel_count = allParcels.length;
    
    result.service_urls.push(CADASTRE_WFS_PARCELS);
  }
  
  // Add ALL buildings at this location
  if (buildings.length > 0) {
    result.buildings = buildings.map(b => ({
      reference: b.properties.reference,
      condition_of_construction: b.properties.conditionOfConstruction,
      current_use: b.properties.currentUse,
      date_of_construction: b.properties.dateOfConstruction,
      date_of_renovation: b.properties.dateOfRenovation,
      number_of_dwellings: b.properties.numberOfDwellings,
      number_of_building_units: b.properties.numberOfBuildingUnits,
      number_of_floors_above_ground: b.properties.numberOfFloorsAboveGround,
      number_of_floors_below_ground: b.properties.numberOfFloorsBelowGround,
      geometry: b.geometry
    }));
    
    // For backward compatibility, keep single "building" field with the first one
    result.building = result.buildings[0];
    result.building_count = buildings.length;
    
    result.service_urls.push(CADASTRE_WFS_BUILDINGS);
  }
  
  // Add ALL addresses at this location
  if (addresses.length > 0) {
    result.addresses = addresses.map(a => ({
      locators: a.properties.locators,
      thoroughfare_name: a.properties.thoroughfareName,
      thoroughfare_type: a.properties.thoroughfareType,
      post_code: a.properties.postCode,
      post_name: a.properties.postName,
      admin_unit: a.properties.adminUnit,
      position: a.properties.position,
      valid_from: a.properties.validFrom,
      valid_to: a.properties.validTo
    }));
    
    // Use first address for primary fields if not already set
    if (!result.postal_code && addresses[0].properties.postCode) {
      result.postal_code = addresses[0].properties.postCode;
    }
    if (!result.address && addresses[0].properties.thoroughfareName) {
      const addr = addresses[0].properties;
      result.address = `${addr.thoroughfareType || ''} ${addr.thoroughfareName || ''}`.trim();
    }
    
    result.address_count = addresses.length;
    result.service_urls.push(CADASTRE_WFS_ADDRESSES);
  }
  
  return result;
}

/**
 * CLI interface for testing
 */
async function main() {
  const argv = minimist(process.argv.slice(2));
  const lon = parseFloat(argv.lon ?? argv.lng ?? argv.x);
  const lat = parseFloat(argv.lat ?? argv.y);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.error("Usage: ts-node spain_cadastre_lookup.ts --lon <lon> --lat <lat>");
    process.exit(1);
  }

  console.log(`Spanish Cadastre Lookup`);
  console.log(`Point: lon=${lon}, lat=${lat}`);
  console.log();

  const result = await getSpanishCadastralInfo(lon, lat);
  
  if (!result.cadastral_reference) {
    console.error("No cadastral information found.");
    process.exit(1);
  }
  
  console.log("Cadastral Information:");
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(99);
  });
}
