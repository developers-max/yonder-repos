import { NextRequest, NextResponse } from 'next/server';

// Allowed WMS base URLs (whitelist for security)
// Portugal sources: DGT SNIT services (servicos.dgterritorio.pt) and geo2 geoserver
const ALLOWED_WMS_SOURCES: Record<string, string> = {
  // Portugal - SNIT Services (require proxy due to CORS, but support EPSG:3857!)
  'pt-cadastro': 'https://cartografia.dgterritorio.gov.pt/wms/Cadastro',
  'pt-ren': 'https://servicos.dgterritorio.pt/SDISNITWMSSRUP_REN_PT1/service.svc/get',
  'pt-ran': 'https://servicos.dgterritorio.pt/SDISNITWMSSRUP_RAN_PT1/service.svc/get',
  // Portugal - geo2 geoserver (supports CORS, but included for completeness)
  'pt-geo2-caop': 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms',
  'pt-geo2-cos': 'https://geo2.dgterritorio.gov.pt/geoserver/COS2018/wms',
  'pt-geo2-cos-s2': 'https://geo2.dgterritorio.gov.pt/geoserver/COS-S2/wms',
  'pt-geo2-clc': 'https://geo2.dgterritorio.gov.pt/geoserver/CLC/wms',
  // Spain
  'es-cadastro': 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx',
};

// 1x1 transparent PNG for error fallback (prevents Mapbox decode errors)
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    
    if (!source || !ALLOWED_WMS_SOURCES[source]) {
      return NextResponse.json(
        { error: 'Invalid or missing source parameter' },
        { status: 400 }
      );
    }

    const baseUrl = ALLOWED_WMS_SOURCES[source];
    
    // Build the WMS URL with all query parameters except 'source'
    const wmsParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== 'source') {
        wmsParams.append(key, value);
      }
    });

    const wmsUrl = `${baseUrl}?${wmsParams.toString()}`;
    
    // Create abort controller for timeout
    // SNIT services (pt-ren, pt-ran) are notoriously slow - give them 30s
    // Other services get 15s
    const isSnitService = source?.startsWith('pt-ren') || source?.startsWith('pt-ran');
    const timeoutMs = isSnitService ? 30000 : 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Fetch from the WMS server
      const response = await fetch(wmsUrl, {
        headers: {
          'Accept': 'image/png, image/jpeg, */*',
          'User-Agent': 'Yonder-WMS-Proxy/1.0',
        },
        signal: controller.signal,
        // Cache for 1 hour
        next: { revalidate: 3600 },
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`WMS proxy error: ${response.status} for ${wmsUrl}`);
        // Return transparent pixel instead of error (prevents Mapbox decode errors)
        return new NextResponse(TRANSPARENT_PIXEL, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=60', // Short cache for errors
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Get the image data
      const imageBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      // Check if the response is actually an image (some WMS servers return XML errors with 200)
      if (!contentType.includes('image/')) {
        console.error(`WMS proxy: unexpected content-type ${contentType} for ${wmsUrl}`);
        return new NextResponse(TRANSPARENT_PIXEL, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=60',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Return the image with appropriate headers
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errorName = (fetchError as Error).name;
      if (errorName === 'AbortError') {
        console.error(`WMS proxy timeout for ${source}`);
      } else {
        console.error(`WMS proxy fetch error for ${source}:`, fetchError);
      }
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    console.error('WMS proxy error:', error);
    // Return transparent pixel on error
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

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
