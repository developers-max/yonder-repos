/**
 * Portuguese Municipal REN/RAN GIS Services - Utility Functions
 * 
 * GIS service data is stored in the `portugal_municipalities` database table.
 * This file provides utility functions and known GIS portal patterns.
 * 
 * Data is sourced from individual municipal GIS portals (sig.cm-*.pt pattern).
 * Each municipality may have different layer IDs and service structures.
 */

import { type GISServiceConfig } from '@/lib/db/schema';

/**
 * Known municipal GIS portal URL patterns to check for REN/RAN data
 * These follow common URL patterns but need verification before adding to DB
 */
export const KNOWN_MUNICIPAL_GIS_PATTERNS = {
  // Common patterns for ArcGIS REST endpoints
  arcgis: [
    'https://sig.cm-{municipality}.pt/arcgis/rest/services',
    'https://sigonline.cm-{municipality}.pt/arcgis/rest/services',
    'https://geoportal.cm-{municipality}.pt/arcgis/rest/services',
    'https://geo.cm-{municipality}.pt/arcgis/rest/services',
  ],
  // Some municipalities use different naming
  special: {
    'sintra': 'https://sig.cm-sintra.pt/arcgis/rest/services',
    'seixal': 'https://sig.cm-seixal.pt/arcgis/rest/services',
    'loule': 'https://geoloule.cm-loule.pt/arcgisnprot/rest/services',
    'montijo': 'https://mtgeo.mun-montijo.pt/arcgis/rest/services',
    'setubal': 'https://sig.mun-setubal.pt/arcgis/rest/services',
  },
};

/**
 * Common layer names for REN/RAN in municipal services
 * These are searched when discovering new services
 */
export const COMMON_LAYER_KEYWORDS = {
  ren: ['REN', 'Reserva_Ecologica', 'Reserva Ecológica', 'SRUP_REN'],
  ran: ['RAN', 'Reserva_Agricola', 'Reserva Agrícola', 'Agricola_Nacional'],
};

/**
 * Build ArcGIS REST export URL for a municipal service
 */
export function buildMunicipalExportUrl(
  service: GISServiceConfig,
  bbox: string,
  width = 256,
  height = 256
): string {
  const params = new URLSearchParams({
    bbox,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${width},${height}`,
    format: 'png',
    transparent: 'true',
    f: 'image',
  });
  
  if (service.layers && service.layers !== 'all') {
    params.set('layers', `show:${service.layers}`);
  }
  
  return `${service.url}?${params.toString()}`;
}

/**
 * Test if a municipal ArcGIS endpoint is accessible
 */
export async function testMunicipalEndpoint(url: string, timeoutMs = 10000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(`${url}?f=json`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Discover MapServer services at a given ArcGIS REST endpoint
 */
export async function discoverMapServices(baseUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}?f=json`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const services: string[] = [];
    
    if (data.services) {
      for (const service of data.services) {
        if (service.type === 'MapServer') {
          services.push(`${baseUrl}/${service.name}/MapServer`);
        }
      }
    }
    
    // Also check folders
    if (data.folders) {
      for (const folder of data.folders) {
        const folderServices = await discoverMapServices(`${baseUrl}/${folder}`);
        services.push(...folderServices);
      }
    }
    
    return services;
  } catch {
    return [];
  }
}
