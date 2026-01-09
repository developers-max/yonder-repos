import { NextRequest, NextResponse } from 'next/server';

// Vercel function configuration - Fluid Compute enabled: 5 min timeout for slow WMS services
export const maxDuration = 300;

// Allowed WMS base URLs (whitelist for security)
// Portugal sources: DGT SNIT services (servicos.dgterritorio.pt) and geo2 geoserver
const ALLOWED_WMS_SOURCES: Record<string, string> = {
  // Portugal - SNIT Services (require proxy due to CORS, but support EPSG:3857!)
  'pt-cadastro': 'https://cartografia.dgterritorio.gov.pt/wms/Cadastro',
  'pt-ren': 'https://servicos.dgterritorio.pt/SDISNITWMSSRUP_REN_PT1/WMService.aspx',
  'pt-ran': 'https://servicos.dgterritorio.pt/SDISNITWMSSRUP_RAN_PT1/WMService.aspx',
  'pt-orthos': 'https://geo2.dgterritorio.gov.pt/geoserver/teste-ext/wms',
  // Portugal - geo2 geoserver (supports CORS, but included for completeness)
  'pt-geo2-caop': 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms',
  'pt-geo2-cos': 'https://geo2.dgterritorio.gov.pt/geoserver/COS2018/wms',
  'pt-geo2-cos-s2': 'https://geo2.dgterritorio.gov.pt/geoserver/COS-S2/wms',
  'pt-geo2-clc': 'https://geo2.dgterritorio.gov.pt/geoserver/CLC/wms',
  // Spain (must use HTTP, HTTPS returns 403)
  'es-cadastro': 'http://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx',
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
    // Fluid Compute enabled: up to 800s on Pro, we use 300s (5 min) for slow services
    // SNIT services (pt-ren, pt-ran) are notoriously slow - give them full 5 min
    // Other services get 60s
    const isSnitService = source?.startsWith('pt-ren') || source?.startsWith('pt-ran');
    const timeoutMs = isSnitService ? 300000 : 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Build headers - Spanish cadastre needs browser-like headers
      const isSpanishCadastre = source === 'es-cadastro';
      const headers: Record<string, string> = {
        'Accept': 'image/png, image/jpeg, */*',
        'User-Agent': isSpanishCadastre 
          ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          : 'Yonder-WMS-Proxy/1.0',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      };
      
      // Add Referer for Spanish cadastre (some WMS servers check this)
      if (isSpanishCadastre) {
        headers['Referer'] = 'https://www.sedecatastro.gob.es/';
        headers['Origin'] = 'https://www.sedecatastro.gob.es';
      }
      
      // Retry logic for intermittent failures (Spanish cadastre can be flaky)
      const maxRetries = isSpanishCadastre ? 2 : 0;
      let lastError: Error | null = null;
      let response: Response | null = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          }
          
          response = await fetch(wmsUrl, {
            headers,
            signal: controller.signal,
            cache: 'no-store',
          });
          
          // If successful or non-retryable error, break
          if (response.ok || (response.status !== 403 && response.status !== 500 && response.status !== 502 && response.status !== 503)) {
            break;
          }
        } catch (err) {
          lastError = err as Error;
          if (attempt === maxRetries) break;
        }
      }
      
      clearTimeout(timeoutId);

      if (!response || !response.ok) {
        const status = response?.status || 'unknown';
        console.error(`WMS proxy error: ${status} for ${wmsUrl} after ${maxRetries + 1} attempts`);
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
        // REN/RAN services return XML when no data is available in the area - this is expected
        const isRenRanService = source === 'pt-ren' || source === 'pt-ran';
        if (!isRenRanService) {
          // Only log for non-REN/RAN services where this is unexpected
          console.error(`WMS proxy: unexpected content-type ${contentType} for ${wmsUrl}`);
        }
        // Return transparent pixel with longer cache for REN/RAN (indicates no data in area)
        return new NextResponse(TRANSPARENT_PIXEL, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': isRenRanService ? 'public, max-age=86400' : 'public, max-age=60',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Return the image with appropriate headers
      // Spanish cadastre has rate limits - cache aggressively to reduce requests
      const cacheTime = isSpanishCadastre ? 86400 : 3600; // 24h for Spain, 1h for others
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`,
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
