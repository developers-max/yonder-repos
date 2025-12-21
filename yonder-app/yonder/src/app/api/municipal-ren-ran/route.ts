import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { portugalMunicipalities, type GISServiceConfig } from '@/lib/db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';

// 1x1 transparent PNG for areas without data
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/**
 * Build ArcGIS REST export URL for a municipal service
 */
function buildExportUrl(
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
 * API endpoint to fetch REN/RAN tiles from municipal ArcGIS services
 * 
 * Query params:
 * - type: 'ren' | 'ran'
 * - municipality: municipality name (e.g., 'sintra', 'seixal')
 * - bbox: bounding box in EPSG:3857 format (minx,miny,maxx,maxy)
 * - width: tile width (default 256)
 * - height: tile height (default 256)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'ren' | 'ran' | null;
    const municipality = searchParams.get('municipality');
    const bbox = searchParams.get('bbox');
    const width = parseInt(searchParams.get('width') || '256');
    const height = parseInt(searchParams.get('height') || '256');

    // Validate required params
    if (!type || !['ren', 'ran'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid or missing type parameter. Use "ren" or "ran"' },
        { status: 400 }
      );
    }

    if (!municipality) {
      return NextResponse.json(
        { error: 'Missing municipality parameter' },
        { status: 400 }
      );
    }

    if (!bbox) {
      return NextResponse.json(
        { error: 'Missing bbox parameter. Format: minx,miny,maxx,maxy' },
        { status: 400 }
      );
    }

    // Find the municipality in database (case-insensitive)
    const [municipalityData] = await db
      .select()
      .from(portugalMunicipalities)
      .where(sql`LOWER(${portugalMunicipalities.name}) = LOWER(${municipality})`)
      .limit(1);

    if (!municipalityData || !municipalityData.gisVerified) {
      // Return transparent pixel for unverified municipalities
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
          'Access-Control-Allow-Origin': '*',
          'X-Municipality-Status': 'not-verified',
        },
      });
    }

    // Get the appropriate service (REN or RAN)
    const layerService = type === 'ren' 
      ? municipalityData.renService as GISServiceConfig | null
      : municipalityData.ranService as GISServiceConfig | null;

    if (!layerService) {
      // Return transparent pixel if this municipality doesn't have this layer type
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'X-Municipality-Status': 'no-layer',
        },
      });
    }

    // Build the ArcGIS export URL
    const exportUrl = buildExportUrl(layerService, bbox, width, height);

    // Fetch from municipal ArcGIS service with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(exportUrl, {
        headers: {
          'Accept': 'image/png, */*',
          'User-Agent': 'Yonder-Municipal-REN-RAN/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // 503 means no REN/RAN data available in this area - treat as "no REN present"
        if (response.status === 503) {
          return new NextResponse(TRANSPARENT_PIXEL, {
            status: 200,
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=86400', // Cache for 24 hours - area has no REN
              'Access-Control-Allow-Origin': '*',
              'X-Municipality-Status': 'no-ren-in-area',
            },
          });
        }
        console.error(`[Municipal REN/RAN] Error ${response.status} for ${municipality}/${type}`);
        return new NextResponse(TRANSPARENT_PIXEL, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=300', // Short cache for errors
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const imageBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      // Check if response is actually an image
      if (!contentType.includes('image/')) {
        console.error(`[Municipal REN/RAN] Unexpected content-type: ${contentType}`);
        return new NextResponse(TRANSPARENT_PIXEL, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=300',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
          'Access-Control-Allow-Origin': '*',
          'X-Municipality': municipality,
          'X-Layer-Type': type,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorName = (fetchError as Error).name;
      if (errorName === 'AbortError') {
        console.error(`[Municipal REN/RAN] Timeout for ${municipality}/${type}`);
      } else {
        console.error(`[Municipal REN/RAN] Fetch error:`, fetchError);
      }
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    console.error('[Municipal REN/RAN] Error:', error);
    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

/**
 * Return list of available municipalities with REN/RAN data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body.type as 'ren' | 'ran' | 'both';

    // Build query based on type
    let query = db
      .select({
        id: portugalMunicipalities.id,
        name: portugalMunicipalities.name,
        district: portugalMunicipalities.district,
        renService: portugalMunicipalities.renService,
        ranService: portugalMunicipalities.ranService,
        gisVerified: portugalMunicipalities.gisVerified,
        gisLastChecked: portugalMunicipalities.gisLastChecked,
      })
      .from(portugalMunicipalities)
      .where(eq(portugalMunicipalities.gisVerified, true));

    const municipalities = await query;

    // Filter based on type
    const filtered = municipalities.filter(m => {
      if (type === 'ren') return m.renService !== null;
      if (type === 'ran') return m.ranService !== null;
      return m.renService !== null || m.ranService !== null;
    });

    return NextResponse.json({
      count: filtered.length,
      municipalities: filtered.map(m => ({
        id: m.id,
        municipality: m.name,
        district: m.district,
        hasREN: m.renService !== null,
        hasRAN: m.ranService !== null,
        verified: m.gisVerified,
        lastChecked: m.gisLastChecked?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Municipal REN/RAN] POST error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
