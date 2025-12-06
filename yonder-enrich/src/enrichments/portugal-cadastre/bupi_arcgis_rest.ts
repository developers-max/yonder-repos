import axios, { AxiosInstance } from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, polygon as turfPolygon } from "@turf/helpers";

// ArcGIS REST Query endpoints for BUPi RGG dataset
// Layer 0 is typically the features layer for RGG
const BUPI_ENDPOINTS = {
  continental: "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT/MapServer/0/query",
  madeira: "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT_Madeira/MapServer/0/query"
};

/**
 * Detect which BUPi endpoint to use based on coordinates
 * Madeira: approximately -17.5 to -16.0 lon, 32.0 to 33.5 lat
 * Continental Portugal: everything else
 */
function selectBUPiEndpoint(lon: number, lat: number): { url: string; region: string } {
  // Madeira bounding box (with small buffer)
  if (lon >= -17.5 && lon <= -16.0 && lat >= 32.0 && lat <= 33.5) {
    return { url: BUPI_ENDPOINTS.madeira, region: "Madeira" };
  }
  return { url: BUPI_ENDPOINTS.continental, region: "Continental" };
}

// Keep-alive HTTP agents
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 50 });

const AX: AxiosInstance = axios.create({
  headers: {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "yonder-enrich/1.0"
  },
  timeout: 45_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

interface BUPiPropertyInfo {
  bupi_id?: string;
  area_m2?: number;
  geometry?: any;
  centroid?: [number, number];
  distance_meters?: number;
  contains_point?: boolean;
  source: string;
  service_url: string;
  coordinates: {
    longitude: number;
    latitude: number;
    srs: string;
  };
  notes?: string;
}

function calculateCentroid(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;
  try {
    if (geometry.type === "Polygon") {
      const coords = geometry.coordinates[0];
      if (!coords || coords.length === 0) return null;
      const sumX = coords.reduce((sum: number, c: number[]) => sum + c[0], 0);
      const sumY = coords.reduce((sum: number, c: number[]) => sum + c[1], 0);
      return [sumX / coords.length, sumY / coords.length];
    } else if (geometry.type === "MultiPolygon") {
      const coords = geometry.coordinates[0]?.[0];
      if (!coords || coords.length === 0) return null;
      const sumX = coords.reduce((sum: number, c: number[]) => sum + c[0], 0);
      const sumY = coords.reduce((sum: number, c: number[]) => sum + c[1], 0);
      return [sumX / coords.length, sumY / coords.length];
    }
  } catch {
    // ignore
  }
  return null;
}

function calculateDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointInGeometry(lon: number, lat: number, geometry: any): boolean {
  try {
    const point = turfPoint([lon, lat]);
    if (geometry.type === "Polygon") {
      return booleanPointInPolygon(point, turfPolygon(geometry.coordinates));
    } else if (geometry.type === "MultiPolygon") {
      for (const polygonCoords of geometry.coordinates) {
        if (booleanPointInPolygon(point, turfPolygon(polygonCoords))) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function esriPolygonToGeoJSON(geom: any): any | null {
  if (!geom) return null;
  // ArcGIS polygon format: { rings: [ [ [x,y], ... ] ], spatialReference: { wkid } }
  if (geom.rings && Array.isArray(geom.rings)) {
    return { type: "Polygon", coordinates: geom.rings };
  }
  return null;
}

async function requestWithRetry(url: string, params: any, attempts = 3, baseDelayMs = 500): Promise<any> {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await AX.get(url, { params });
      return res.data;
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      const retriable = !status || status >= 500 || status === 429;
      if (!retriable || i === attempts - 1) break;
      const delay = baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 200);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function getBUPiPropertyInfoArcGIS(
  lon: number,
  lat: number
): Promise<BUPiPropertyInfo | null> {
  const distances = [100, 500, 1000]; // meters
  
  // Auto-detect endpoint based on coordinates
  const { url: queryEndpoint, region } = selectBUPiEndpoint(lon, lat);
  console.log(`  Using BUPi ${region} endpoint`);

  try {
    // Try progressive radii from the point
    for (const dist of distances) {
      // Use simple x,y format - ArcGIS REST API prefers this over JSON
      const common: any = {
        where: "1=1",
        f: "json", // Use json format (more compatible than geojson)
        geometry: `${lon},${lat}`, // Simple x,y format
        geometryType: "esriGeometryPoint",
        inSR: 4326,
        outSR: 4326,
        spatialRel: "esriSpatialRelIntersects",
        distance: dist,
        units: "esriSRUnit_Meter",
        returnGeometry: true,
        outFields: "*", // Get all fields
        returnCountOnly: false
      };

      let data = await requestWithRetry(queryEndpoint, common);

      if (!data || !data.features) {
        continue; // try larger distance
      }

      // Convert ESRI JSON to GeoJSON-like format
      const geoJsonFeatures = data.features.map((f: any) => ({
        type: "Feature",
        geometry: esriPolygonToGeoJSON(f.geometry),
        properties: f.attributes || {}
      }));

      if (geoJsonFeatures.length === 0) {
        continue; // try larger distance
      }

      // Selection logic: exact match first, else closest by centroid
      let best: any = null;
      let bestDist = Infinity;
      let contains = false;

      for (const feat of geoJsonFeatures) {
        if (!feat.geometry) continue;
        const inside = isPointInGeometry(lon, lat, feat.geometry);
        if (inside) {
          best = feat;
          contains = true;
          bestDist = 0;
          break;
        }
        const centroid = calculateCentroid(feat.geometry);
        if (centroid) {
          const d = calculateDistance(lon, lat, centroid[0], centroid[1]);
          if (d < bestDist) {
            best = feat;
            bestDist = d;
          }
        }
      }

      if (!best || !best.geometry) {
        continue; // try larger distance
      }

      const props = best.properties || {};
      const centroid = calculateCentroid(best.geometry) || undefined;

      const result: BUPiPropertyInfo = {
        bupi_id: props.objectid ? String(props.objectid) : (props.OBJECTID ? String(props.OBJECTID) : undefined),
        area_m2: props["st_area(shape)"] || props.shape_area || props.Shape_Area || undefined,
        geometry: best.geometry,
        centroid,
        distance_meters: contains ? 0 : Math.round(bestDist),
        contains_point: contains,
        source: `BUPi - ArcGIS REST (RGG ${region})`,
        service_url: queryEndpoint,
        coordinates: { longitude: lon, latitude: lat, srs: "EPSG:4326" },
        notes: contains ? "Point is inside property" : `Closest property within ~${dist}m; ~${Math.round(bestDist)}m from point`
      };

      console.log(`  ✓ BUPi ArcGIS: ${result.bupi_id || "unknown"} (${result.area_m2 ? `${Math.round(result.area_m2)}m²` : "unknown area"}, ${contains ? "contains point" : `~${Math.round(bestDist)}m away`})`);
      return result;
    }
  } catch (e: any) {
    const msg = axios.isAxiosError(e) ? (e.response ? `${e.message} (status ${e.response.status})` : e.message) : String(e);
    console.log(`  BUPi ArcGIS query error: ${msg}`);
  }

  console.log("  No BUPi ArcGIS properties found near coordinates");
  return null;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: ts-node bupi_arcgis_rest.ts <longitude> <latitude>");
    process.exit(1);
  }
  const lon = parseFloat(args[0]);
  const lat = parseFloat(args[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.error("Invalid coordinates");
    process.exit(1);
  }
  (async () => {
    console.log("\n=== BUPi ArcGIS Property Lookup ===");
    console.log(`Coordinates: ${lon}, ${lat}\n`);
    const info = await getBUPiPropertyInfoArcGIS(lon, lat);
    if (info) {
      console.log("\n✓ BUPi ArcGIS Property Information:");
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log("\n✗ No BUPi ArcGIS property information found");
    }
  })();
}
