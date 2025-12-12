import { NextRequest, NextResponse } from 'next/server';

/**
 * CRUS GeoJSON API
 * 
 * Fetches CRUS (Carta do Regime de Uso do Solo) zoning data from DGT OGC API
 * as GeoJSON for a given bounding box.
 * 
 * CRUS is municipal zoning data. Each municipality has its own collection: crus_<municipio>
 * 
 * Usage: /api/crus-tiles?bbox=minLng,minLat,maxLng,maxLat&municipality=sintra
 */

// Normalize municipality name for CRUS collection ID
function normalizeMunicipalityName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[\s-]+/g, '_') // Spaces and hyphens to underscores
    .replace(/[^a-z0-9_]/g, ''); // Remove special chars
}

// Color mapping for CRUS land use classes
const CRUS_COLORS: Record<string, string> = {
  'Solo Urbano': '#e74c3c',           // Red - Urban
  'Solo Urbanizável': '#f39c12',       // Orange - Urbanizable
  'Solo Rural': '#27ae60',             // Green - Rural
  'Espaço Agrícola': '#2ecc71',        // Light green - Agricultural
  'Espaço Florestal': '#16a085',       // Teal - Forest
  'Espaço Natural': '#1abc9c',         // Cyan - Natural
  'Espaço de Uso Múltiplo': '#9b59b6', // Purple - Multiple use
  'Aglomerado Rural': '#e67e22',       // Dark orange - Rural settlement
  'default': '#8b5cf6',                // Purple fallback
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bbox = searchParams.get('bbox');
  const municipality = searchParams.get('municipality');
  const limit = searchParams.get('limit') || '200';

  if (!municipality) {
    return NextResponse.json({ type: 'FeatureCollection', features: [] });
  }

  // Normalize municipality name for CRUS collection ID
  const normalizedMunicipality = normalizeMunicipalityName(municipality);
  const collectionId = `crus_${normalizedMunicipality}`;

  // Build DGT OGC API items URL
  let itemsUrl = `https://ogcapi.dgterritorio.gov.pt/collections/${collectionId}/items?f=json&limit=${limit}`;
  
  if (bbox) {
    itemsUrl += `&bbox=${bbox}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(itemsUrl, {
      headers: {
        'Accept': 'application/geo+json, application/json',
        'User-Agent': 'Yonder-CRUS-API/1.0',
      },
      signal: controller.signal,
      cache: 'no-store', // Disable Next.js data cache
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        // Collection doesn't exist for this municipality
        return NextResponse.json({ 
          type: 'FeatureCollection', 
          features: [],
          error: `No CRUS data for ${municipality}` 
        });
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Add color property to each feature based on land use class
    if (data.features) {
      data.features = data.features.map((feature: { properties?: Record<string, unknown> }) => {
        const props = feature.properties || {};
        const classe = (props.Classe_202 as string) || (props.Categoria_ as string) || '';
        const color = CRUS_COLORS[classe] || CRUS_COLORS['default'];
        
        return {
          ...feature,
          properties: {
            ...props,
            _color: color,
            _label: props.Designacao || props.Categoria_ || classe || 'Sem classificação',
          }
        };
      });
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'X-CRUS-Collection': collectionId,
        'X-Feature-Count': String(data.features?.length || 0),
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`CRUS API error for ${collectionId}:`, errorMessage);
    
    return NextResponse.json({ 
      type: 'FeatureCollection', 
      features: [],
      error: errorMessage 
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
