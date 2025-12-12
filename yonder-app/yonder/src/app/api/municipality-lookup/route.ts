import { NextRequest, NextResponse } from 'next/server';

/**
 * Municipality Lookup API
 * 
 * Returns the municipality name for given coordinates using DGT OGC API.
 * Used to determine which CRUS collection to query for zoning data.
 */

// Cache for municipality lookups (simple in-memory cache)
const municipalityCache = new Map<string, { municipality: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

// Round coordinates to ~100m grid for cache efficiency
function roundCoords(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'Invalid coordinates' },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = roundCoords(lat, lng);
  const cached = municipalityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ municipality: cached.municipality });
  }

  try {
    // Query DGT OGC API municipios collection
    // Use a small bbox around the point
    const buffer = 0.001; // ~100m
    const bbox = `${lng - buffer},${lat - buffer},${lng + buffer},${lat + buffer}`;
    
    const url = `https://ogcapi.dgterritorio.gov.pt/collections/municipios/items?bbox=${bbox}&limit=1&f=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/geo+json, application/json',
        'User-Agent': 'Yonder-Municipality-Lookup/1.0',
      },
      signal: controller.signal,
      cache: 'no-store', // Disable Next.js data cache
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Municipality lookup error: ${response.status}`);
      return NextResponse.json({ municipality: null });
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return NextResponse.json({ municipality: null });
    }

    // Extract municipality name from the feature properties
    const feature = data.features[0];
    const props = feature.properties || {};
    
    // Try different property names used by DGT
    const municipality = props.Municipio || props.municipio || props.MUNICIPIO || 
                        props.nome || props.Nome || props.name || null;

    if (municipality) {
      // Cache the result
      municipalityCache.set(cacheKey, { municipality, timestamp: Date.now() });
    }

    return NextResponse.json({ 
      municipality,
      // Also return normalized version for CRUS lookup
      normalized: municipality ? normalizeName(municipality) : null 
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Municipality lookup error:', errorMessage);
    return NextResponse.json({ municipality: null });
  }
}

// Normalize municipality name for CRUS collection ID
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[\s-]+/g, '_') // Spaces and hyphens to underscores
    .replace(/[^a-z0-9_]/g, ''); // Remove special chars
}
