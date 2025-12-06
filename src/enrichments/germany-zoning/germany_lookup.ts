#!/usr/bin/env ts-node

import axios from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import proj4 from 'proj4';
import { parseStringPromise } from 'xml2js';

// Types
export type Feature = {
  type: 'Feature';
  id?: string | number;
  geometry: { type: string; coordinates: any };
  properties: Record<string, any>;
};
export type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

export type GermanyZoningPayload = {
  state?: string;
  service_type: string;
  service_url?: string;
  collection_id?: string;
  typename?: string;
  feature_id?: string | number | null;
  feature_count?: number;
  label?: string;
  picked_field?: string;
  properties?: Record<string, any>;
  notes?: string;
};

// Config
const ACCEPT = 'application/geo+json, application/json;q=0.9';

// NRW OGC API (INSPIRE Planned Land Use - Bebauungspläne)
const NRW_API_BASE = process.env.NRW_API_BASE || 'https://ogc-api.nrw.de/inspire-lu-bplan/api';

// Berlin WFS
const BERLIN_WFS_BASE = process.env.BERLIN_WFS_BASE || 'https://fbinter.stadt-berlin.de/fb/wfs/data';
const BERLIN_TYPENAMES = (process.env.BERLIN_WFS_TYPENAMES || 'fis:re_bplan').split(',');
const BW_WFS_BASE = process.env.BW_WFS_BASE || 'https://www.geoportal-raumordnung-bw.de/ows/services/org.1.7c61f5dd-b978-476c-8f95-64839e68bc71_wfs';
const HAMBURG_WFS_BASE = process.env.HAMBURG_WFS_BASE || 'https://geodienste.hamburg.de/HH_WFS_FNP';
const NI_SEARCH_BASE = process.env.NI_SEARCH_BASE || 'https://geoportal.geodaten.niedersachsen.de/harvest/r0om67';
const NI_WFS_SEEDS = (process.env.NI_WFS_SEEDS || '').split(',').map(s => s.trim()).filter(Boolean);
const NI_VG_WFS_BASE = process.env.NI_VG_WFS_BASE || 'https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wfs';
const NI_LANDUSE_WFS_BASE = process.env.NI_LANDUSE_WFS_BASE || '';

// HTTP client with keep-alive
const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 50, rejectUnauthorized: false });
const AX = axios.create({
  headers: { Accept: ACCEPT, 'User-Agent': 'yonder-enrich/1.0' },
  timeout: 30_000,
  httpAgent,
  httpsAgent,
  validateStatus: (s) => s >= 200 && s < 300,
});

// Define common CRSs used by German XPlan WFS
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs +type=crs');
proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs +type=crs');

function metersToDegrees(lat: number, meters: number) {
  const dLat = meters / 111_320;
  const dLon = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLon };
}

function bboxAroundPoint(lon: number, lat: number, meters = 150): [number, number, number, number] {
  const { dLat, dLon } = metersToDegrees(lat, meters);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function bboxForCRS(lon: number, lat: number, meters: number, srs: string): [number, number, number, number] {
  const s = srs.toUpperCase();
  if (s === 'EPSG:4326') return bboxAroundPoint(lon, lat, meters);
  try {
    const [x, y] = proj4('EPSG:4326', s, [lon, lat]);
    return [x - meters, y - meters, x + meters, y + meters];
  } catch {
    // Fallback to geographic bbox
    return bboxAroundPoint(lon, lat, meters);
  }
}

function pickBestFeature(features: Feature[], lon: number, lat: number) {
  if (!features.length) return undefined;
  const pt: Feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} };

  const containing = features.find((f) => {
    try {
      return f.geometry?.type?.toLowerCase().includes('polygon') && booleanPointInPolygon(pt as any, f as any);
    } catch { return false; }
  });
  if (containing) return containing;

  const firstPoly = features.find((f) => f.geometry?.type?.toLowerCase().includes('polygon'));
  if (firstPoly) return firstPoly;

  return features[0];
}

function extractGermanZoningLabel(props: Record<string, any>) {
  const candidates = [
    // Common German zoning terms
    'ArtDerBaulichenNutzung', 'art_der_baulichen_nutzung', 'art_der_nutzung', 'art',
    'Nutzung', 'nutzung', 'Zweckbestimmung', 'zweckbestimmung',
    'Gebietstyp', 'gebietstyp', 'Baugebiet', 'baugebiet',
    'Name', 'name', 'Bezeichnung', 'bezeichnung', 'Planname', 'planname', 'Planbez', 'planbez',
    'BPlan', 'bplan', 'Bebauungsplan', 'bebauungsplan',
    'Nutzungsart', 'nutzungsart', 'nutzungszweck'
  ];
  for (const k of candidates) {
    const v = props?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return { label: String(v).trim(), pickedField: k };
    }
  }
  return { label: undefined, pickedField: undefined };
}

function detectState(lon: number, lat: number): 'NRW' | 'Berlin' | 'BW' | 'Hamburg' | 'NI' | undefined {
  // Berlin bbox approx
  if (lon >= 13.09 && lon <= 13.77 && lat >= 52.33 && lat <= 52.68) return 'Berlin';
  // NRW bbox approx
  if (lon >= 5.86 && lon <= 9.46 && lat >= 50.30 && lat <= 52.55) return 'NRW';
  // Hamburg bbox approx
  if (lon >= 9.70 && lon <= 10.30 && lat >= 53.30 && lat <= 53.75) return 'Hamburg';
  // Baden‑Württemberg bbox approx
  if (lon >= 7.30 && lon <= 10.50 && lat >= 47.50 && lat <= 49.80) return 'BW';
  // Niedersachsen bbox approx
  if (lon >= 6.60 && lon <= 11.60 && lat >= 51.30 && lat <= 53.90) return 'NI';
  return undefined;
}

async function getJSON<T = any>(url: string): Promise<T> {
  const { data } = await AX.get(url);
  return data as T;
}

async function getText(url: string, accept?: string): Promise<string> {
  const { data } = await AX.get(url, { responseType: 'text' as any, headers: accept ? { Accept: accept } : undefined });
  return typeof data === 'string' ? data : String(data);
}

async function getJSONWithTimeout<T = any>(url: string, timeoutMs: number): Promise<T> {
  const { data } = await AX.get(url, { timeout: timeoutMs });
  return data as T;
}

async function getTextWithTimeout(url: string, accept: string | undefined, timeoutMs: number): Promise<string> {
  const { data } = await AX.get(url, { responseType: 'text' as any, headers: accept ? { Accept: accept } : undefined, timeout: timeoutMs });
  return typeof data === 'string' ? data : String(data);
}

// NRW: OGC API Features
async function queryNRW(lon: number, lat: number) {
  // Discover collections
  const apiUrl = `${NRW_API_BASE}?f=json`;
  let collectionsUrl = `${NRW_API_BASE.replace(/\/$/, '')}/collections?f=json`;
  try {
    const api = await getJSON<any>(apiUrl);
    const collLink = (api?.links || []).find((l: any) => /\/collections\b/.test(l?.href || ''));
    if (collLink?.href) collectionsUrl = collLink.href.includes('f=') ? collLink.href : `${collLink.href}${collLink.href.includes('?') ? '&' : '?'}f=json`;
  } catch {}

  let collections: Array<{ id?: string; title?: string; links?: any[] }> = [];
  try {
    const data = await getJSON<any>(collectionsUrl);
    collections = Array.isArray(data?.collections) ? data.collections : [];
  } catch {}

  // Pick relevant collections
  const candidates = collections.filter((c) => {
    const id = (c.id || '').toString().toLowerCase();
    const title = (c.title || '').toString().toLowerCase();
    return id.includes('bplan') || id.includes('bebauung') || title.includes('bplan') || title.includes('bebauung') || title.includes('planned land use') || title.includes('lu');
  });

  const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 120);

  for (const coll of (candidates.length ? candidates : collections)) {
    const collId = coll.id || '';
    if (!collId) continue;
    const itemsUrl = `${NRW_API_BASE.replace(/\/$/, '')}/collections/${encodeURIComponent(collId)}/items?f=json&bbox=${minx},${miny},${maxx},${maxy}&limit=25`;
    try {
      const fc = await getJSON<FeatureCollection>(itemsUrl);
      const features = Array.isArray(fc?.features) ? fc.features : [];
      if (features.length) {
        const best = pickBestFeature(features, lon, lat);
        if (!best) continue;
        const props = best.properties || {};
        const { label, pickedField } = extractGermanZoningLabel(props);
        return {
          state: 'Nordrhein-Westfalen',
          service_type: 'OGC-API Features',
          service_url: NRW_API_BASE,
          collection_id: collId,
          feature_id: best.id ?? null,
          feature_count: features.length,
          typename: undefined,
          label,
          picked_field: pickedField,
          properties: props,
          notes: 'NRW INSPIRE Planned Land Use (Bebauungspläne)'
        };
      }
    } catch (e) {
      // try next collection
      continue;
    }
  }

  return {
    state: 'Nordrhein-Westfalen',
    service_type: 'OGC-API Features',
    service_url: NRW_API_BASE,
    feature_count: 0,
    notes: 'No features found at this location in NRW collections',
  };
}

// Berlin: WFS 2.0
async function queryBerlin(lon: number, lat: number) {
  const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, 120);
  const typenames = BERLIN_TYPENAMES;

  for (const tn of typenames) {
    const url = `${BERLIN_WFS_BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(tn)}&bbox=${minx},${miny},${maxx},${maxy},EPSG:4326&srsName=EPSG:4326&outputFormat=application/json&count=20`;
    try {
      const fc = await getJSON<FeatureCollection>(url);
      const features = Array.isArray(fc?.features) ? fc.features : [];
      if (features.length) {
        const best = pickBestFeature(features, lon, lat);
        if (!best) continue;
        const props = best.properties || {};
        const { label, pickedField } = extractGermanZoningLabel(props);
        return {
          state: 'Berlin',
          service_type: 'WFS 2.0',
          service_url: BERLIN_WFS_BASE,
          collection_id: undefined,
          typename: tn,
          feature_id: best.id ?? null,
          feature_count: features.length,
          label,
          picked_field: pickedField,
          properties: props,
          notes: 'Berlin FIS-Broker Bebauungspläne'
        };
      }
    } catch (e) {
      // try next typename
      continue;
    }
  }

  return {
    state: 'Berlin',
    service_type: 'WFS 2.0',
    service_url: BERLIN_WFS_BASE,
    typename: BERLIN_TYPENAMES[0],
    feature_count: 0,
    notes: 'No features found at this location for Berlin WFS',
  };
}

async function safeGetText(url: string): Promise<string | null> {
  try {
    const { data } = await AX.get(url, { responseType: 'text' as any });
    return typeof data === 'string' ? data : String(data);
  } catch {
    return null;
  }
}

function extractRecordUuidsFromHtml(html: string): string[] {
  const uuids: string[] = [];
  const re = /api\/records\/([0-9a-fA-F-]{36})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    if (id && !uuids.includes(id)) uuids.push(id);
  }
  return uuids;
}

function extractWfsUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  const re = /(https?:\/\/[^\s"'<>]+?(?:service=WFS|WFSServer)[^\s"'<>]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    // Normalize: strip querystring, keep WFSServer path or base OWS endpoint
    const [beforeQ] = raw.split('?');
    const finalUrl = beforeQ.includes('WFSServer') ? beforeQ : beforeQ;
    if (!urls.includes(finalUrl)) urls.push(finalUrl);
  }
  return urls;
}

async function discoverNiWfsEndpoints(keyword = 'Bebauungsplan', limit = 10): Promise<string[]> {
  const endpoints = new Set<string>();
  // Include env-provided seeds first
  for (const s of NI_WFS_SEEDS) endpoints.add(s);
  // Try JSON API first
  const jsonUrl = `${NI_SEARCH_BASE}/api/search/records?any=${encodeURIComponent(keyword)}&from=1&to=${limit}`;
  const jsonText = await safeGetText(jsonUrl);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const records: any[] = Array.isArray(parsed?.records) ? parsed.records : [];
      for (const r of records) {
        const recId = r?.uuid || r?.id;
        if (!recId) continue;
        const recUrl = `${NI_SEARCH_BASE}/api/records/${recId}`;
        const recText = await safeGetText(recUrl);
        if (recText) {
          for (const u of extractWfsUrlsFromText(recText)) endpoints.add(u);
        }
        if (endpoints.size >= limit) break;
      }
    } catch {
      // Fall through to HTML scraping
    }
  }
  if (endpoints.size < 3) {
    // Fallback: HTML search page
    const htmlUrl = `${NI_SEARCH_BASE}/search?keyword=${encodeURIComponent(keyword)}`;
    const html = await safeGetText(htmlUrl);
    if (html) {
      const uuids = extractRecordUuidsFromHtml(html).slice(0, limit);
      for (const id of uuids) {
        const recUrl = `${NI_SEARCH_BASE}/api/records/${id}`;
        const recText = await safeGetText(recUrl);
        if (recText) {
          for (const u of extractWfsUrlsFromText(recText)) endpoints.add(u);
        }
        if (endpoints.size >= limit) break;
      }
    }
  }
  return Array.from(endpoints).slice(0, limit);
}

async function queryNiLanduse(lon: number, lat: number): Promise<GermanyZoningPayload> {
  const selectors = [
    'landnutz', 'bodennutz', 'flaechennutz', 'landuse', 'nutz', 'alkis', 'ax_', 'ax:', 'basis-dlm', 'dlm', 'nutzung', 'nutzungsart'
  ];
  const endpoints: string[] = [];
  if (NI_LANDUSE_WFS_BASE) endpoints.push(NI_LANDUSE_WFS_BASE);
  // Discover via harvest if not configured
  if (!NI_LANDUSE_WFS_BASE) {
    const queries = [
      'ALKIS Landnutzung',
      'Landnutzung',
      'Bodennutzung',
      'Flächennutzung',
      'Flaechennutzung',
      'ATKIS Basis-DLM',
      'DLM Landbedeckung',
      'Landbedeckung'
    ];
    const discovered = new Set<string>();
    for (const q of queries) {
      const url = `${NI_SEARCH_BASE}/api/search/records?any=${encodeURIComponent(q)}&from=1&to=10`;
      const jsonText = await safeGetText(url);
      if (!jsonText) continue;
      try {
        const parsed = JSON.parse(jsonText);
        const records: any[] = Array.isArray(parsed?.records) ? parsed.records : [];
        for (const r of records) {
          const recId = r?.uuid || r?.id;
          if (!recId) continue;
          const recUrl = `${NI_SEARCH_BASE}/api/records/${recId}`;
          const recText = await safeGetText(recUrl);
          if (recText) {
            for (const u of extractWfsUrlsFromText(recText)) discovered.add(u);
          }
          if (discovered.size >= 10) break;
        }
      } catch {}
      if (discovered.size >= 10) break;
    }
    for (const u of discovered) endpoints.push(u);
  }
  for (const base of endpoints) {
    const res = await queryGenericWFS(base, lon, lat, selectors, 'Niedersachsen (ALKIS Landnutzung)', 'Niedersachsen state land-use WFS');
    if ((res?.feature_count || 0) > 0) return res;
  }
  return {
    state: 'Niedersachsen',
    service_type: 'WFS 2.0',
    notes: 'No state land-use features found (ALKIS fallback) for Niedersachsen at this location.'
  } as GermanyZoningPayload;
}

async function discoverNiWfsEndpointsForPoint(lon: number, lat: number, limit = 10): Promise<string[]> {
  const endpoints = new Set<string>();
  for (const s of NI_WFS_SEEDS) endpoints.add(s);
  const sizes = [2000, 5000, 10000];
  for (const meters of sizes) {
    const [minx, miny, maxx, maxy] = bboxAroundPoint(lon, lat, meters);
    const url = `${NI_SEARCH_BASE}/api/search/records?bbox=${minx},${miny},${maxx},${maxy}&fast=index&from=1&to=${limit}`;
    const jsonText = await safeGetText(url);
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText);
        const records: any[] = Array.isArray(parsed?.records) ? parsed.records : [];
        for (const r of records) {
          const recId = r?.uuid || r?.id;
          if (!recId) continue;
          const recUrl = `${NI_SEARCH_BASE}/api/records/${recId}`;
          const recText = await safeGetText(recUrl);
          if (recText) {
            for (const u of extractWfsUrlsFromText(recText)) endpoints.add(u);
          }
          if (endpoints.size >= limit) break;
        }
      } catch {
        // Not JSON or unsupported; break and fallback
      }
    }
    if (endpoints.size) break;
  }
  if (endpoints.size === 0) {
    const fallback = await discoverNiWfsEndpoints('Bebauungsplan', limit);
    for (const u of fallback) endpoints.add(u);
  }
  return Array.from(endpoints).slice(0, limit);
}

type NiMunicipality = { name?: string; ags?: string; props?: Record<string, any>; service_url?: string; typename?: string };

function pickMunicipalityName(props: Record<string, any>): { name?: string; ags?: string } {
  const keysName = [
    'gemeindename','gemeinde','gmd_name','gmdname','gemeinde_name','gemname','name','gen','bezeichnung'
  ];
  const keysAgs = [
    'ags','rs','gemeindeschluessel','gemeindekennziffer','ags_0','ags0'
  ];
  let name: string | undefined;
  for (const k of keysName) {
    const v = props?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') { name = String(v).trim(); break; }
  }
  let ags: string | undefined;
  for (const k of keysAgs) {
    const v = props?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') { ags = String(v).trim(); break; }
  }
  return { name, ags };
}

async function queryNiMunicipality(lon: number, lat: number): Promise<NiMunicipality | undefined> {
  const typenames = await fetchCapabilitiesTypenames(NI_VG_WFS_BASE);
  const sels = ['gemeinde','samtgemeinde','gmd','verwaltungs','kreis','landkreis'];
  const preferred = typenames.filter(t => sels.some(s => t.toLowerCase().includes(s)));
  const candidates = (preferred.length ? preferred : typenames).slice(0, 20);
  const meters = 400;
  const srsCandidates = ['EPSG:25832','EPSG:4326'];
  for (const tn of candidates) {
    for (const srs of srsCandidates) {
      const [minx, miny, maxx, maxy] = bboxForCRS(lon, lat, meters, srs);
      const url = `${NI_VG_WFS_BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(tn)}&bbox=${minx},${miny},${maxx},${maxy},${encodeURIComponent(srs)}&srsName=${encodeURIComponent(srs)}&outputFormat=${encodeURIComponent('application/json')}&count=5`;
      try {
        const fc = await getJSONWithTimeout<FeatureCollection>(url, 7000);
        const features = Array.isArray(fc?.features) ? fc.features : [];
        if (!features.length) {
          const xml = await getTextWithTimeout(`${NI_VG_WFS_BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(tn)}&bbox=${minx},${miny},${maxx},${maxy},${encodeURIComponent(srs)}&srsName=${encodeURIComponent(srs)}&count=5`, 'application/xml, text/xml, */*', 7000);
          const feats = await parseGmlFeatures(xml);
          if (!feats.length) continue;
          const best = pickBestFeature(feats as any, lon, lat) || feats[0];
          const props = (best as any).properties || {};
          const { name, ags } = pickMunicipalityName(props);
          if (name || ags) return { name, ags, props, service_url: NI_VG_WFS_BASE, typename: tn };
          continue;
        }
        const best = pickBestFeature(features, lon, lat) || features[0];
        const props = best.properties || {};
        const { name, ags } = pickMunicipalityName(props);
        if (name || ags) return { name, ags, props, service_url: NI_VG_WFS_BASE, typename: tn };
      } catch {}
    }
  }
  return undefined;
}

async function discoverNiWfsEndpointsForMunicipality(name: string, limit = 15): Promise<string[]> {
  const endpoints = new Set<string>();
  const queries = [
    `${name} Bebauungsplan`,
    `${name} Bebauungspläne`,
    `${name} XPlanung`,
    `${name} B-Plan`,
    `${name} BPlan`,
    `${name} Bauleitplan`
  ];
  for (const q of queries) {
    const url = `${NI_SEARCH_BASE}/api/search/records?any=${encodeURIComponent(q)}&from=1&to=${limit}`;
    const jsonText = await safeGetText(url);
    if (!jsonText) continue;
    try {
      const parsed = JSON.parse(jsonText);
      const records: any[] = Array.isArray(parsed?.records) ? parsed.records : [];
      for (const r of records) {
        const recId = r?.uuid || r?.id;
        if (!recId) continue;
        const recUrl = `${NI_SEARCH_BASE}/api/records/${recId}`;
        const recText = await safeGetText(recUrl);
        if (recText) {
          for (const u of extractWfsUrlsFromText(recText)) endpoints.add(u);
        }
        if (endpoints.size >= limit) break;
      }
    } catch {}
    if (endpoints.size >= limit) break;
  }
  return Array.from(endpoints).slice(0, limit);
}

async function queryNiedersachsen(lon: number, lat: number) {
  // Attempt discovery of municipal WFS endpoints in NI
  const selectors = ['bplan', 'bebau', 'xplan', 'bauleit', 'bp:', 'bp_', 'fnp', 'fplan', 'flächennutz', 'flaechen'];
  const muni = await queryNiMunicipality(lon, lat);
  const muniSeeds = muni?.name ? await discoverNiWfsEndpointsForMunicipality(muni.name, 20) : [];
  const pointSeeds = await discoverNiWfsEndpointsForPoint(lon, lat, 12);
  const seeds = Array.from(new Set<string>([...NI_WFS_SEEDS, ...muniSeeds, ...pointSeeds]));
  // Try each endpoint with generic WFS query
  for (const base of seeds) {
    const res = await queryGenericWFS(base, lon, lat, selectors, 'Niedersachsen (municipal)', 'Niedersachsen municipal WFS');
    if ((res?.feature_count || 0) > 0) return res;
  }
  // State-level land-use fallback (ALKIS)
  const landuse = await queryNiLanduse(lon, lat);
  if ((landuse?.feature_count || 0) > 0) return landuse;
  return {
    state: 'Niedersachsen',
    service_type: 'WFS 2.0',
    notes: muni?.name
      ? `No municipal WFS features found for municipality ${muni.name} (AGS ${muni.ags || 'n/a'}). ${landuse?.notes || 'Land-use fallback also returned no features.'}`
      : `No municipal WFS features found at this location in Niedersachsen. ${landuse?.notes || 'Land-use fallback also returned no features.'}`,
  } as GermanyZoningPayload;
}

async function fetchCapabilitiesTypenames(baseUrl: string): Promise<string[]> {
  const capUrl = `${baseUrl}?service=WFS&request=GetCapabilities&version=2.0.0`;
  try {
    const { data } = await AX.get(capUrl, { responseType: 'text' as any });
    const xml: string = typeof data === 'string' ? data : String(data);
    const names: string[] = [];
    const re = /<\s*Name\s*>\s*([^<]+)\s*<\s*\/\s*Name\s*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const name = m[1].trim();
      if (name && !names.includes(name)) names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

async function queryGenericWFS(baseUrl: string, lon: number, lat: number, selectors: string[], stateLabel: string, note: string) {
  const typenames = await fetchCapabilitiesTypenames(baseUrl);
  const lowerSelectors = selectors.map(s => s.toLowerCase());
  const preferred = typenames.filter(tn => {
    const tl = tn.toLowerCase();
    return lowerSelectors.some(sel => tl.includes(sel));
  });
  const candidates = (preferred.length ? preferred : typenames);
  const meters = 2000;
  const srsCandidates = ['EPSG:4326', 'EPSG:25832', 'EPSG:25833'];
  for (const tn of candidates) {
    const outputFormats = [
      'application/json',
      'application/geo+json',
      'application/json; subtype=geojson',
      'application/vnd.geo+json',
      'json'
    ];
    for (const srs of srsCandidates) {
      const [minx, miny, maxx, maxy] = bboxForCRS(lon, lat, meters, srs);
      // First try WFS 2.0.0 (GeoJSON variants)
      for (const fmt of outputFormats) {
        const url20 = `${baseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(tn)}&bbox=${minx},${miny},${maxx},${maxy},${encodeURIComponent(srs)}&srsName=${encodeURIComponent(srs)}&outputFormat=${encodeURIComponent(fmt)}&count=20`;
        try {
          const fc = await getJSONWithTimeout<FeatureCollection>(url20, 9000);
          const features = Array.isArray(fc?.features) ? fc.features : [];
          if (!features.length) continue;
          const best = pickBestFeature(features, lon, lat);
          if (!best) continue;
          const props = best.properties || {};
          const { label, pickedField } = extractGermanZoningLabel(props);
          return {
            state: stateLabel,
            service_type: 'WFS 2.0.0',
            service_url: baseUrl,
            collection_id: undefined,
            typename: tn,
            feature_id: best.id ?? null,
            feature_count: features.length,
            label,
            picked_field: pickedField,
            properties: props,
            notes: note,
          } as GermanyZoningPayload;
        } catch {
          // try next format
        }
      }
      // WFS 2.0.0 GML fallback
      try {
        const gmlUrl20 = `${baseUrl}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(tn)}&bbox=${minx},${miny},${maxx},${maxy},${encodeURIComponent(srs)}&srsName=${encodeURIComponent(srs)}&count=20`;
        const xml20 = await getTextWithTimeout(gmlUrl20, 'application/xml, text/xml, */*', 9000);
        const feats20 = await parseGmlFeatures(xml20);
        if (feats20.length) {
          const best = pickBestFeature(feats20 as any, lon, lat) || feats20[0];
          const props = (best as any).properties || {};
          const { label, pickedField } = extractGermanZoningLabel(props);
          return {
            state: stateLabel,
            service_type: 'WFS 2.0.0',
            service_url: baseUrl,
            collection_id: undefined,
            typename: tn,
            feature_id: (best as any).id ?? null,
            feature_count: feats20.length,
            label,
            picked_field: pickedField,
            properties: props,
            notes: `${note} (GML fallback)`,
          } as GermanyZoningPayload;
        }
      } catch {}

      // Then try WFS 1.1.0 (axis order may differ)
      const bboxVariants: Array<[number, number, number, number]> = [
        [minx, miny, maxx, maxy],
      ];
      if (srs === 'EPSG:4326') {
        // Try flipped axis order variant
        bboxVariants.push([miny, minx, maxy, maxx]);
      }
      for (const bbox of bboxVariants) {
        for (const fmt of outputFormats) {
          const url11 = `${baseUrl}?service=WFS&version=1.1.0&request=GetFeature&typeName=${encodeURIComponent(tn)}&bbox=${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]},${encodeURIComponent(srs)}&srsName=${encodeURIComponent(srs)}&outputFormat=${encodeURIComponent(fmt)}&maxFeatures=20`;
          try {
            const fc = await getJSONWithTimeout<FeatureCollection>(url11, 9000);
            const features = Array.isArray(fc?.features) ? fc.features : [];
            if (!features.length) continue;
            const best = pickBestFeature(features, lon, lat);
            if (!best) continue;
            const props = best.properties || {};
            const { label, pickedField } = extractGermanZoningLabel(props);
            return {
              state: stateLabel,
              service_type: 'WFS 1.1.0',
              service_url: baseUrl,
              collection_id: undefined,
              typename: tn,
              feature_id: best.id ?? null,
              feature_count: features.length,
              label,
              picked_field: pickedField,
              properties: props,
              notes: note,
            } as GermanyZoningPayload;
          } catch {
            // try next format
          }
        }
        // GML fallback for 1.1.0
        try {
          const gmlUrl11 = `${baseUrl}?service=WFS&version=1.1.0&request=GetFeature&typeName=${encodeURIComponent(tn)}&bbox=${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]},${encodeURIComponent(srs)}&srsName=${encodeURIComponent(srs)}&maxFeatures=20`;
          const xml11 = await getTextWithTimeout(gmlUrl11, 'application/xml, text/xml, */*', 9000);
          const feats11 = await parseGmlFeatures(xml11);
          if (feats11.length) {
            const best = pickBestFeature(feats11 as any, lon, lat) || feats11[0];
            const props = (best as any).properties || {};
            const { label, pickedField } = extractGermanZoningLabel(props);
            return {
              state: stateLabel,
              service_type: 'WFS 1.1.0',
              service_url: baseUrl,
              collection_id: undefined,
              typename: tn,
              feature_id: (best as any).id ?? null,
              feature_count: feats11.length,
              label,
              picked_field: pickedField,
              properties: props,
              notes: `${note} (GML fallback)`,
            } as GermanyZoningPayload;
          }
        } catch {}
      }
    }
  }
  return {
    state: stateLabel,
    service_type: 'WFS 2.0',
    service_url: baseUrl,
    feature_count: 0,
    notes: `No features found at this location for ${stateLabel} WFS`,
  } as GermanyZoningPayload;
}

async function parseGmlFeatures(xml: string): Promise<Feature[]> {
  try {
    const doc = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
    const root = doc['wfs:FeatureCollection'] || doc['FeatureCollection'] || doc['gml:FeatureCollection'] || doc;
    let members: any[] = [];
    const wfsMember = root?.['wfs:member'];
    const gmlMember = root?.['gml:featureMember'];
    if (Array.isArray(wfsMember)) members = wfsMember;
    else if (wfsMember) members = [wfsMember];
    else if (Array.isArray(gmlMember)) members = gmlMember;
    else if (gmlMember) members = [gmlMember];
    else if (Array.isArray(root?.member)) members = root.member;
    else if (root?.member) members = [root.member];

    const features: Feature[] = [];
    for (const m of members) {
      if (!m || typeof m !== 'object') continue;
      const keys = Object.keys(m);
      if (!keys.length) continue;
      const featureObj = m[keys[0]] || m;
      const props = flattenProps(featureObj);
      features.push({ type: 'Feature', properties: props, geometry: { type: 'Unknown', coordinates: undefined } });
    }
    return features;
  } catch {
    return [];
  }
}

function flattenProps(obj: any, maxDepth = 2): Record<string, any> {
  const out: Record<string, any> = {};
  function walk(o: any, depth: number) {
    if (!o || typeof o !== 'object' || depth > maxDepth) return;
    for (const [k, v] of Object.entries(o)) {
      if (v != null && typeof v === 'object') {
        // If value is a simple text container like { _: 'value' }
        if ((v as any)._ != null && typeof (v as any)._ !== 'object') {
          out[k] = String((v as any)._);
        } else {
          walk(v, depth + 1);
        }
      } else if (v != null) {
        out[k] = String(v);
      }
    }
  }
  walk(obj, 0);
  return out;
}

async function queryBW(lon: number, lat: number) {
  return await queryGenericWFS(BW_WFS_BASE, lon, lat, ['bplan', 'beba', 'bebau', 'bauleit', 'bpl'], 'Baden-Württemberg', 'Baden-Württemberg state WFS');
}

async function queryHamburg(lon: number, lat: number) {
  return await queryGenericWFS(HAMBURG_WFS_BASE, lon, lat, ['fnp', 'flächennutzungs', 'flaechen', 'nutz'], 'Hamburg', 'Hamburg FNP WFS');
}

export async function getGermanZoningForPoint(lon: number, lat: number): Promise<GermanyZoningPayload> {
  const st = detectState(lon, lat);
  if (st === 'Berlin') {
    return await queryBerlin(lon, lat);
  }
  if (st === 'NRW') {
    return await queryNRW(lon, lat);
  }
  if (st === 'Hamburg') {
    return await queryHamburg(lon, lat);
  }
  if (st === 'BW') {
    return await queryBW(lon, lat);
  }
  if (st === 'NI') {
    return await queryNiedersachsen(lon, lat);
  }

  return {
    state: undefined,
    service_type: 'unknown',
    notes: 'Point not in configured states yet (Berlin, NRW). Extend detectState() and add query function for more Länder.',
  };
}
