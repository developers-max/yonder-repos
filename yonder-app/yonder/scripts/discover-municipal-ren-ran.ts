/**
 * Script to discover REN/RAN services across Portuguese municipalities
 * 
 * Usage: npx tsx scripts/discover-municipal-ren-ran.ts
 */

import { db } from '../src/lib/db';
import { portugalMunicipalities } from '../src/lib/db/schema';
import { isNull, eq } from 'drizzle-orm';

interface LayerInfo {
  layerId: number;
  layerName: string;
  type?: string;
}

interface ServiceDiscovery {
  municipality: string;
  baseUrl: string;
  services: {
    name: string;
    url: string;
    renLayers: LayerInfo[];
    ranLayers: LayerInfo[];
  }[];
}

// Common GIS portal URL patterns
const GIS_URL_PATTERNS = [
  'https://sig.cm-{slug}.pt/arcgis/rest/services',
  'https://sigonline.cm-{slug}.pt/arcgis/rest/services',
  'https://geoportal.cm-{slug}.pt/arcgis/rest/services',
  'https://geo.cm-{slug}.pt/arcgis/rest/services',
  'https://sig.mun-{slug}.pt/arcgis/rest/services',
  'https://gis.cm-{slug}.pt/arcgis/rest/services',
  'https://websig.cm-{slug}.pt/arcgis/rest/services',
];

// Special cases where URL doesn't follow pattern
const SPECIAL_URLS: Record<string, string[]> = {
  'sintra': ['https://sig.cm-sintra.pt/arcgis/rest/services'],
  'seixal': ['https://sig.cm-seixal.pt/arcgis/rest/services'],
  'loule': ['https://geoloule.cm-loule.pt/arcgisnprot/rest/services'],
  'loulé': ['https://geoloule.cm-loule.pt/arcgisnprot/rest/services'],
  'montijo': ['https://mtgeo.mun-montijo.pt/arcgis/rest/services'],
  'setubal': ['https://sig.mun-setubal.pt/arcgis/rest/services'],
  'setúbal': ['https://sig.mun-setubal.pt/arcgis/rest/services'],
  'vila nova de gaia': ['https://sig.cm-gaia.pt/arcgis/rest/services'],
  'vila franca de xira': ['https://sig.cm-vfxira.pt/arcgis/rest/services'],
  'caldas da rainha': ['https://sig.cm-caldas-rainha.pt/arcgis/rest/services'],
  'figueira da foz': ['https://sig.cm-figfoz.pt/arcgis/rest/services'],
  'santa maria da feira': ['https://sig.cm-feira.pt/arcgis/rest/services'],
  'vila nova de famalicão': ['https://sig.cm-vnfamalicao.pt/arcgis/rest/services'],
  'viana do castelo': ['https://sig.cm-viana-castelo.pt/arcgis/rest/services'],
  'castelo branco': ['https://sig.cm-castelobranco.pt/arcgis/rest/services'],
  'torres vedras': ['https://sig.cm-tvedras.pt/arcgis/rest/services'],
  'póvoa de varzim': ['https://sig.cm-pvarzim.pt/arcgis/rest/services'],
  'oliveira de azeméis': ['https://sig.cm-oaz.pt/arcgis/rest/services'],
  'porto': ['https://sig.cm-porto.pt/arcgis/rest/services', 'https://geodados-cmp.hub.arcgis.com'],
  'lisboa': ['https://geodados-cml.hub.arcgis.com', 'https://sig.cm-lisboa.pt/arcgis/rest/services'],
};

// Keywords to identify REN/RAN layers
const REN_KEYWORDS = ['ren', 'reserva ecológica', 'reserva ecologica', 'ecológica nacional', 'ecologica nacional'];
const RAN_KEYWORDS = ['ran', 'reserva agrícola', 'reserva agricola', 'agrícola nacional', 'agricola nacional'];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);
    return response;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function discoverServicesAtUrl(baseUrl: string): Promise<string[]> {
  const services: string[] = [];
  
  try {
    const response = await fetchWithTimeout(`${baseUrl}?f=json`);
    if (!response?.ok) return services;
    
    const data = await response.json();
    
    // Check MapServer services
    if (data.services) {
      for (const service of data.services) {
        if (service.type === 'MapServer') {
          services.push(`${baseUrl}/${service.name}/MapServer`);
        }
      }
    }
    
    // Check folders
    if (data.folders) {
      for (const folder of data.folders) {
        const folderResponse = await fetchWithTimeout(`${baseUrl}/${folder}?f=json`);
        if (folderResponse?.ok) {
          const folderData = await folderResponse.json();
          if (folderData.services) {
            for (const service of folderData.services) {
              if (service.type === 'MapServer') {
                services.push(`${baseUrl}/${folder}/${service.name}/MapServer`);
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }
  
  return services;
}

async function findRenRanLayers(serviceUrl: string): Promise<{ renLayers: LayerInfo[], ranLayers: LayerInfo[] }> {
  const renLayers: LayerInfo[] = [];
  const ranLayers: LayerInfo[] = [];
  
  try {
    const response = await fetchWithTimeout(`${serviceUrl}/legend?f=json`);
    if (!response?.ok) return { renLayers, ranLayers };
    
    const data = await response.json();
    
    if (data.layers) {
      for (const layer of data.layers) {
        const nameLower = layer.layerName?.toLowerCase() || '';
        
        // Check for REN
        if (REN_KEYWORDS.some(kw => nameLower.includes(kw)) && !nameLower.includes('ran')) {
          renLayers.push({
            layerId: layer.layerId,
            layerName: layer.layerName,
            type: layer.layerType,
          });
        }
        
        // Check for RAN
        if (RAN_KEYWORDS.some(kw => nameLower.includes(kw)) && !nameLower.includes('ren')) {
          ranLayers.push({
            layerId: layer.layerId,
            layerName: layer.layerName,
            type: layer.layerType,
          });
        }
      }
    }
  } catch {
    // Ignore errors
  }
  
  return { renLayers, ranLayers };
}

async function discoverMunicipality(name: string): Promise<ServiceDiscovery | null> {
  const slug = slugify(name);
  const nameLower = name.toLowerCase();
  
  // Get URLs to try
  const urlsToTry = new Set<string>();
  
  // Add special URLs if defined
  if (SPECIAL_URLS[nameLower]) {
    SPECIAL_URLS[nameLower].forEach(u => urlsToTry.add(u));
  }
  if (SPECIAL_URLS[slug]) {
    SPECIAL_URLS[slug].forEach(u => urlsToTry.add(u));
  }
  
  // Add pattern-based URLs
  for (const pattern of GIS_URL_PATTERNS) {
    urlsToTry.add(pattern.replace('{slug}', slug));
  }
  
  const discovery: ServiceDiscovery = {
    municipality: name,
    baseUrl: '',
    services: [],
  };
  
  for (const baseUrl of urlsToTry) {
    const services = await discoverServicesAtUrl(baseUrl);
    
    if (services.length > 0) {
      discovery.baseUrl = baseUrl;
      
      for (const serviceUrl of services) {
        const { renLayers, ranLayers } = await findRenRanLayers(serviceUrl);
        
        if (renLayers.length > 0 || ranLayers.length > 0) {
          discovery.services.push({
            name: serviceUrl.replace(baseUrl + '/', ''),
            url: serviceUrl,
            renLayers,
            ranLayers,
          });
        }
      }
      
      if (discovery.services.length > 0) {
        return discovery;
      }
    }
  }
  
  return null;
}

async function main() {
  console.log('🔍 Discovering REN/RAN services across Portuguese municipalities...\n');
  
  // Get all municipalities without verified GIS services
  const municipalities = await db
    .select({ id: portugalMunicipalities.id, name: portugalMunicipalities.name })
    .from(portugalMunicipalities)
    .where(eq(portugalMunicipalities.gisVerified, false));
  
  console.log(`Found ${municipalities.length} municipalities to check\n`);
  
  const discovered: ServiceDiscovery[] = [];
  const failed: string[] = [];
  
  let count = 0;
  for (const muni of municipalities) {
    count++;
    process.stdout.write(`[${count}/${municipalities.length}] Checking ${muni.name}...`);
    
    const result = await discoverMunicipality(muni.name);
    
    if (result) {
      console.log(` ✅ Found ${result.services.length} service(s)`);
      discovered.push(result);
      
      // Show details
      for (const svc of result.services) {
        if (svc.renLayers.length > 0) {
          console.log(`    REN: ${svc.renLayers.map(l => `${l.layerName} (${l.layerId})`).join(', ')}`);
        }
        if (svc.ranLayers.length > 0) {
          console.log(`    RAN: ${svc.ranLayers.map(l => `${l.layerName} (${l.layerId})`).join(', ')}`);
        }
      }
    } else {
      console.log(' ❌');
      failed.push(muni.name);
    }
    
    // Small delay to avoid overwhelming servers
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Discovered: ${discovered.length} municipalities with REN/RAN data`);
  console.log(`❌ Not found: ${failed.length} municipalities\n`);
  
  // Generate SQL for discovered services
  if (discovered.length > 0) {
    console.log('📝 SQL to update database:\n');
    console.log('-- Auto-discovered REN/RAN services');
    
    for (const d of discovered) {
      const svc = d.services[0]; // Use first service with REN/RAN
      const renLayer = svc.renLayers[0];
      const ranLayer = svc.ranLayers[0];
      
      const renService = renLayer 
        ? `'{"url": "${svc.url}/export", "layers": "${renLayer.layerId}"}'::jsonb`
        : 'NULL';
      const ranService = ranLayer 
        ? `'{"url": "${svc.url}/export", "layers": "${ranLayer.layerId}"}'::jsonb`
        : 'NULL';
      
      console.log(`
UPDATE portugal_municipalities 
SET 
  gis_base_url = '${d.baseUrl}',
  ren_service = ${renService},
  ran_service = ${ranService},
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = '${d.municipality.toLowerCase()}';`);
    }
  }
  
  // Exit
  process.exit(0);
}

main().catch(console.error);
