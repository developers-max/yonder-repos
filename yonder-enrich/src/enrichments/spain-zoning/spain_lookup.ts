#!/usr/bin/env ts-node

import axios from "axios";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import minimist from "minimist";

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

// Spain's decentralized architecture - National IGN for admin boundaries
const IGN_BASE = process.env.IGN_BASE || "https://www.ign.es/wfs-inspire/unidades-administrativas";
const ACCEPT = "application/geo+json, application/json;q=0.9";

// Keep-alive HTTP agents
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 50,
  rejectUnauthorized: false // In case of cert issues
});
const AX = axios.create({
  headers: { Accept: ACCEPT, "User-Agent": "yonder-enrich/1.0" },
  timeout: 30_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

// Autonomous Community to WFS mapping (from documentation)
const REGIONAL_SERVICES: Record<string, { wfs?: string; type: string; notes: string }> = {
  "Catalunya": { 
    wfs: "https://sig.gencat.cat/ows/PLANEJAMENT/wfs",
    type: "WFS",
    notes: "Mapa Urbanístic de Catalunya (MUC) - No legal validity" 
  },
  "Cataluña": { 
    wfs: "https://sig.gencat.cat/ows/PLANEJAMENT/wfs",
    type: "WFS",
    notes: "Mapa Urbanístic de Catalunya (MUC) - No legal validity" 
  },
  "Andalucía": { 
    wfs: "http://www.ideandalucia.es/services/DERA_g7_sistema_urbano/wfs",
    type: "WFS",
    notes: "Sistema Urbano - Urban fabric, detailed zoning at municipal level"
  },
  "Castilla y León": { 
    wfs: "https://idecyl.jcyl.es/geoserver/lu/wfs",
    type: "WFS",
    notes: "Land use WFS - Check GetCapabilities for planning layers"
  },
  "Comunidad de Madrid": {
    type: "ATOM",
    notes: "Primary access via ATOM feed, not WFS"
  },
  "Madrid": {
    type: "ATOM",
    notes: "Primary access via ATOM feed, not WFS"
  },
  "Comunitat Valenciana": {
    wfs: "https://terramapas.icv.gva.es/0101_BCV05?service=WFS&request=GetCapabilities",
    type: "WFS",
    notes: "Base cartography 1:5,000 - Thematic planning in regional viewer"
  },
  // Add more regions as needed
};

function metersToDegrees(lat: number, meters: number) {
  const dLat = meters / 111_320;
  const dLon = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLon };
}

function bboxAroundPoint(lon: number, lat: number, meters = 200): [number, number, number, number] {
  const { dLat, dLon } = metersToDegrees(lat, meters);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

async function getJSON<T = any>(url: string): Promise<T> {
  const { data } = await AX.get(url);
  return data as T;
}

function normalizeRegionName(name?: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Determine which Autonomous Community (CCAA) a point is in
 * Uses IGN's national administrative boundaries WFS
 */
/**
 * Simple coordinate-based CCAA detection
 * Uses bounding box approximations for Spanish Autonomous Communities
 */
function detectCCAA(lon: number, lat: number): string | undefined {
  // Rough bounding boxes for major autonomous communities
  // Catalunya
  if (lon >= 0.16 && lon <= 3.33 && lat >= 40.52 && lat <= 42.87) {
    return "Catalunya";
  }
  // Andalucía
  if (lon >= -7.5 && lon <= -1.6 && lat >= 36.0 && lat <= 38.7) {
    return "Andalucía";
  }
  // Madrid
  if (lon >= -4.6 && lon <= -3.0 && lat >= 39.9 && lat <= 41.2) {
    return "Madrid";
  }
  // Valencia / Comunitat Valenciana
  if (lon >= -1.5 && lon <= 0.5 && lat >= 37.8 && lat <= 40.8) {
    return "Comunitat Valenciana";
  }
  // Castilla y León
  if (lon >= -7.0 && lon <= -1.5 && lat >= 40.0 && lat <= 43.0) {
    return "Castilla y León";
  }
  // País Vasco
  if (lon >= -3.5 && lon <= -1.5 && lat >= 42.5 && lat <= 43.5) {
    return "País Vasco";
  }
  // Galicia
  if (lon >= -9.3 && lon <= -6.7 && lat >= 41.8 && lat <= 43.8) {
    return "Galicia";
  }
  // Aragón
  if (lon >= -2.0 && lon <= 0.8 && lat >= 39.8 && lat <= 42.9) {
    return "Aragón";
  }
  
  return undefined;
}

async function getAutonomousCommunity(lon: number, lat: number) {
  // Use simple coordinate-based detection for now
  // TODO: Replace with proper IGN WFS query once format issues are resolved
  const ccaa = detectCCAA(lon, lat);
  if (ccaa) {
    return { ccaa };
  }
  
  // Fallback: try IGN but don't fail if it doesn't work
  try {
    const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 500);
    const url = `${IGN_BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=AU.AdministrativeUnit&bbox=${minx},${miny},${maxx},${maxy}&srsName=EPSG:4326&count=10`;
    
    // This will likely fail due to format issues, but worth trying
    const fc = await getJSON<FeatureCollection>(url);
    if (fc?.features?.length) {
      const ccaaFeature = fc.features.find(f => {
        const nl = f.properties?.nationalLevel;
        return nl === "2nd" || nl === "2";
      });
      if (ccaaFeature?.properties?.name) {
        return { ccaa: String(ccaaFeature.properties.name).trim() };
      }
    }
  } catch (e) {
    // IGN lookup failed, already have fallback from detectCCAA
  }

  return undefined;
}

/**
 * Query the regional WFS for zoning data
 */
async function queryRegionalZoning(wfsUrl: string, lon: number, lat: number): Promise<Feature[]> {
  const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 100);
  
  // Generic WFS query - may need adjustment per region
  const url = `${wfsUrl}?service=WFS&version=2.0.0&request=GetFeature&bbox=${minx},${miny},${maxx},${maxy}&srsName=EPSG:4326&outputFormat=application/json&count=20`;
  
  try {
    const fc = await getJSON<FeatureCollection>(url);
    return Array.isArray(fc?.features) ? fc.features : [];
  } catch (e) {
    console.warn(`Failed to query regional zoning service: ${wfsUrl}`, e);
    return [];
  }
}

function pickBestZoningFeature(features: Feature[], lon: number, lat: number) {
  if (!features.length) return undefined;
  const pt: Feature = { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: {} };

  // 1) Prefer polygon that contains the point
  const containing = features.find((f) => {
    try {
      return f.geometry?.type?.toLowerCase().includes("polygon") && booleanPointInPolygon(pt as any, f as any);
    } catch {
      return false;
    }
  });
  if (containing) return containing;

  // 2) Otherwise, first polygon
  const firstPoly = features.find((f) => f.geometry?.type?.toLowerCase().includes("polygon"));
  if (firstPoly) return firstPoly;

  // 3) Or just the first feature
  return features[0];
}

/**
 * Extract zoning label from feature properties
 * Field names vary by region - try common ones
 */
function extractZoningLabel(props: Record<string, any>) {
  const candidates = [
    // Catalunya MUC (Mapa Urbanístic de Catalunya) - most detailed first
    "DESC_QUAL_MUC",          // Zoning qualification description
    "DESC_QUAL_AJUNT",        // Municipal zoning description (even more detailed)
    "DESC_CLAS_MUC",          // Land classification description
    "DESC_CLAS_AJUNT",        // Municipal classification description
    "CODI_QUAL_MUC",          // Zoning code
    "CODI_CLAS_MUC",          // Classification code
    "SISTEMA_URBA_PTP",       // Regional planning area (fallback)
    // Catalunya general
    "us_text", "qualificacio", "planejament",
    // General Spanish
    "clasificacion", "clasificación", "categoria", "categoría",
    "uso", "uso_suelo", "clase_suelo", "calificacion", "calificación",
    // Castilla y León
    "clasificacion_de_suelo", "categoria_de_suelo",
    // Generic
    "nombre", "descripcion", "description", "name",
  ];
  
  for (const k of candidates) {
    const v = props?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return { label: String(v).trim(), pickedField: k };
    }
  }
  return { label: undefined, pickedField: undefined };
}

/**
 * Main function: Get Spanish zoning for a point
 */
export async function getSpanishZoningForPoint(lon: number, lat: number) {
  // 1) Determine autonomous community
  const ccaaInfo = await getAutonomousCommunity(lon, lat);
  if (!ccaaInfo?.ccaa) {
    return {
      ccaa: undefined,
      service_type: "unknown",
      notes: "Could not determine Autonomous Community for this location",
    };
  }

  const ccaaName = ccaaInfo.ccaa;
  
  // 2) Look up regional service
  const regionalService = REGIONAL_SERVICES[ccaaName] || REGIONAL_SERVICES[normalizeRegionName(ccaaName)];
  
  if (!regionalService) {
    return {
      ccaa: ccaaName,
      service_type: "unknown",
      notes: "No regional zoning service configured for this autonomous community",
    };
  }
  
  if (!regionalService.wfs) {
    return {
      ccaa: ccaaName,
      service_type: regionalService.type,
      notes: regionalService.notes,
    };
  }

  // 3) Query regional WFS with region-specific layer names
  const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 100);
  
  // Define layer names by region (in order of preference - most detailed first)
  const layersByRegion: Record<string, string[]> = {
    "Catalunya": [
      "PLANEJAMENT:MUC_QUALIFICACIONS",      // Most detailed: zoning qualifications
      "PLANEJAMENT:MUC_CLASSIFICACIONS",     // Land classification (urban/non-urban)
      "PLANEJAMENT:PLANSTP_SISTEMES_URBANS"  // Fallback: regional planning areas
    ],
    "Cataluña": [
      "PLANEJAMENT:MUC_QUALIFICACIONS",
      "PLANEJAMENT:MUC_CLASSIFICACIONS",
      "PLANEJAMENT:PLANSTP_SISTEMES_URBANS"
    ],
    "Andalucía": ["DERA_g7_sistema_urbano:g07_01_Poblaciones"],
    "Castilla y León": ["lu:LandUse"],
    // Add more as we discover them
  };
  
  const typeNames = layersByRegion[ccaaName] || [];
  
  if (typeNames.length === 0) {
    return {
      ccaa: ccaaName,
      service_type: regionalService.type,
      service_url: regionalService.wfs,
      feature_count: 0,
      notes: "WFS layer names not yet configured for this region - manual discovery needed",
    };
  }
  
  let feats: Feature[] = [];
  let usedTypeName: string | undefined;
  
  for (const typeName of typeNames) {
    // Note: Different regions may use different CRS (Catalunya uses EPSG:25831)
    // Request output in EPSG:4326 and specify bbox in 4326
    const url = `${regionalService.wfs}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${typeName}&bbox=${minx},${miny},${maxx},${maxy},EPSG:4326&srsName=EPSG:4326&outputFormat=application/json&count=20`;
    
    try {
      const fc = await getJSON<FeatureCollection>(url);
      if (fc?.features?.length > 0) {
        feats = fc.features;
        usedTypeName = typeName;
        break;
      }
    } catch (e) {
      // Try next typename
      console.warn(`Failed to query ${typeName}:`, e instanceof Error ? e.message : e);
      continue;
    }
  }
  
  if (!feats.length) {
    return {
      ccaa: ccaaName,
      service_type: regionalService.type,
      service_url: regionalService.wfs,
      feature_count: 0,
      notes: "No zoning features found at this location (tried configured layers)",
    };
  }

  // 4) Pick best feature
  const best = pickBestZoningFeature(feats, lon, lat);
  if (!best) {
    return {
      ccaa: ccaaName,
      service_type: regionalService.type,
      service_url: regionalService.wfs,
      feature_count: feats.length,
      notes: "Features found but none suitable",
    };
  }

  // 5) Extract all zoning information
  const props = best.properties || {};
  const { label, pickedField } = extractZoningLabel(props);
  
  // Build comprehensive zoning label with all available info
  const zoningParts: string[] = [];
  if (props.DESC_QUAL_MUC) zoningParts.push(props.DESC_QUAL_MUC);
  if (props.DESC_QUAL_AJUNT && props.DESC_QUAL_AJUNT !== props.DESC_QUAL_MUC) {
    zoningParts.push(props.DESC_QUAL_AJUNT);
  }
  if (props.DESC_CLAS_MUC && !zoningParts.includes(props.DESC_CLAS_MUC)) {
    zoningParts.push(props.DESC_CLAS_MUC);
  }
  
  const comprehensiveLabel = zoningParts.length > 0 ? zoningParts.join(' | ') : label;
  
  return {
    ccaa: ccaaName,
    service_type: regionalService.type,
    service_url: regionalService.wfs,
    typename: usedTypeName,
    feature_id: best.id ?? null,
    feature_count: feats.length,
    label: comprehensiveLabel,
    
    // Individual zoning fields
    zoning_qualification: props.DESC_QUAL_MUC || null,
    zoning_qualification_code: props.CODI_QUAL_MUC || null,
    zoning_municipal: props.DESC_QUAL_AJUNT || null,
    zoning_municipal_code: props.CODI_QUAL_AJUNT || null,
    land_classification: props.DESC_CLAS_MUC || null,
    land_classification_code: props.CODI_CLAS_MUC || null,
    municipality_code: props.CODI_INE || null,
    
    picked_field: pickedField,
    properties: best.properties,
    notes: regionalService.notes,
  };
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const lon = parseFloat(argv.lon ?? argv.lng ?? argv.x);
  const lat = parseFloat(argv.lat ?? argv.y);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.error("Usage: ts-node spain_lookup.ts --lon <lon> --lat <lat>");
    process.exit(1);
  }

  console.log(`IGN base: ${IGN_BASE}`);
  console.log(`Point: lon=${lon}, lat=${lat}`);

  const payload = await getSpanishZoningForPoint(lon, lat);
  if (!payload) {
    console.error("Could not resolve zoning for the provided point.");
    process.exit(6);
  }
  
  console.log(`Autonomous Community: ${payload.ccaa}`);
  console.log(`Service: ${payload.service_url || payload.service_type}`);
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(99);
  });
}
