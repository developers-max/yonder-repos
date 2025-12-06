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

const OGC_BASE = process.env.DGT_OGC_BASE || "https://ogcapi.dgterritorio.gov.pt";
const MUNICIPIOS_COLLECTION = "municipios"; // confirmed; use bbox here
const ACCEPT = "application/geo+json, application/json;q=0.9";

// Keep-alive HTTP agents and a shared axios instance
// NOTE: rejectUnauthorized=false to handle expired DGT SSL certificates
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 50,
  rejectUnauthorized: false // Allow expired certificates (DGT API issue)
});
const AX = axios.create({
  headers: { Accept: ACCEPT, "User-Agent": "yonder-enrich/1.0" },
  timeout: 30_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

function metersToDegrees(lat: number, meters: number) {
  // crude, but fine for small boxes
  const dLat = meters / 111_320; // ~ meters per degree latitude
  const dLon = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLon };
}

function bboxAroundPoint(lon: number, lat: number, meters = 100): [number, number, number, number] {
  const { dLat, dLon } = metersToDegrees(lat, meters);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

async function getJSON<T = any>(url: string): Promise<T> {
  const { data } = await AX.get(url);
  return data as T;
}

function normalizeMunicipioName(name?: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    // remove diacritics
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function getMunicipio(lon: number, lat: number) {
  const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 200); // ~200m
  const url = `${OGC_BASE}/collections/${MUNICIPIOS_COLLECTION}/items?bbox=${minx},${miny},${maxx},${maxy}&limit=5&f=json`;
  const fc = await getJSON<FeatureCollection>(url);
  if (!fc?.features?.length) return undefined;

  // If multiple, pick the one that actually contains the point
  const pt: Feature = { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: {} };
  const containing = fc.features.find((f) => {
    try {
      return booleanPointInPolygon(pt as any, f as any);
    } catch {
      return false;
    }
  });
  const best = containing || fc.features[0];

  // Common properties: municipio / NOME (varies)
  const props = best.properties || {};
  const municipio =
    props.municipio ??
    props.MUNICIPIO ??
    props.NOME ??
    props.nome ??
    undefined;

  return { id: best.id, municipio: String(municipio || "").trim() || undefined, raw: best };
}

let cachedCollections: Array<{ id: string; title?: string }> | null = null;
async function listCollections(): Promise<Array<{ id: string; title?: string }>> {
  if (cachedCollections) return cachedCollections;
  const url = `${OGC_BASE}/collections?f=json`;
  const json = await getJSON<any>(url);
  const list = Array.isArray(json?.collections) ? json.collections : [];
  cachedCollections = list;
  return list;
}

const municipioToCollectionCache = new Map<string, string | undefined>();
async function resolveCRUSCollectionId(municipioName?: string): Promise<string | undefined> {
  const all = await listCollections();
  if (!all.length) return undefined;

  const n = normalizeMunicipioName(municipioName);
  if (n) {
    const cached = municipioToCollectionCache.get(n);
    if (cached !== undefined) return cached;

    const exact = all.find((c) => c.id?.toLowerCase() === `crus_${n}`);
    if (exact?.id) {
      municipioToCollectionCache.set(n, exact.id);
      return exact.id;
    }

    const contains = all.find((c) => c.id?.toLowerCase().startsWith("crus_") && c.id.toLowerCase().includes(n));
    if (contains?.id) {
      municipioToCollectionCache.set(n, contains.id);
      return contains.id;
    }
  }

  // Fallbacks if present in your environment (may or may not exist)
  const national = all.find((c) =>
    ["crus_portugal", "crus_continente", "crus"].includes((c.id || "").toLowerCase())
  );
  if (national?.id) return national.id;

  // As a last resort: pick ANY crus_*
  const anyCrus = all.find((c) => c.id?.toLowerCase().startsWith("crus_"));
  return anyCrus?.id;
}

async function queryCRUSByBbox(collectionId: string, lon: number, lat: number): Promise<Feature[]> {
  // Very small bbox; expand slightly if you routinely hit edges
  const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 100);
  const url = `${OGC_BASE}/collections/${encodeURIComponent(collectionId)}/items?bbox=${minx},${miny},${maxx},${maxy}&limit=20&f=json`;
  const fc = await getJSON<FeatureCollection>(url);
  return Array.isArray(fc?.features) ? fc.features : [];
}

function pickBestZoningFeature(features: Feature[], lon: number, lat: number) {
  if (!features.length) return undefined;
  const pt: Feature = { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: {} };

  // 1) Prefer a polygon that actually contains the point
  const containing = features.find((f) => {
    try {
      return f.geometry?.type?.toLowerCase().includes("polygon") && booleanPointInPolygon(pt as any, f as any);
    } catch {
      return false;
    }
  });
  if (containing) return containing;

  // 2) Otherwise, return the first polygon-ish feature
  const firstPoly = features.find((f) => f.geometry?.type?.toLowerCase().includes("polygon"));
  if (firstPoly) return firstPoly;

  // 3) Or just the first one
  return features[0];
}

function extractZoningLabel(props: Record<string, any>) {
  // Order of preference: Designacao -> Categoria_ -> Classe_202 -> fallbacks
  const candidates = [
    "Designacao",
    "designacao",
    "Categoria_",
    "categoria",
    "Classe_202",
    "classe_202",
    "classe",
    "classe_solo",
    "qualificacao",
    "uso",
    "uso_solo",
    "categoria_",
    "classe1",
    "desc_class",
  ];
  for (const k of candidates) {
    const v = props?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return { label: String(v).trim(), pickedField: k };
    }
  }
  return { label: undefined, pickedField: undefined };
}

export async function getCRUSZoningForPoint(lon: number, lat: number) {
  // 1) municipality
  const muni = await getMunicipio(lon, lat);
  if (!muni?.municipio) {
    return undefined;
  }

  // 2) CRUS collection id
  const crusCollection = await resolveCRUSCollectionId(muni.municipio);
  if (!crusCollection) {
    return undefined;
  }

  // 3) Query CRUS via bbox
  const feats = await queryCRUSByBbox(crusCollection, lon, lat);
  if (!feats.length) {
    return undefined;
  }

  // 4) Pick the best feature for the point
  const best = pickBestZoningFeature(feats, lon, lat);
  if (!best) {
    return undefined;
  }

  // 5) Extract a compact label
  const { label, pickedField } = extractZoningLabel(best.properties || {});
  const payload = {
    municipality: muni.municipio,
    collection_id: crusCollection,
    feature_id: best.id ?? null,
    feature_count: feats.length,
    label,
    picked_field: pickedField,
    properties: best.properties,
  };

  return payload;
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const lon = parseFloat(argv.lon ?? argv.lng ?? argv.x);
  const lat = parseFloat(argv.lat ?? argv.y);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.error("Usage: ts-node crus-lookup.ts --lon <lon> --lat <lat>");
    process.exit(1);
  }

  console.log(`OGC base: ${OGC_BASE}`);
  console.log(`Point: lon=${lon}, lat=${lat}`);

  const payload = await getCRUSZoningForPoint(lon, lat);
  if (!payload) {
    console.error("Could not resolve zoning for the provided point.");
    process.exit(6);
  }
  console.log(`Municipio: ${payload.municipality}`);
  console.log(`CRUS collection: ${payload.collection_id}`);
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(99);
  });
}