import { NextRequest, NextResponse } from 'next/server';

// Vercel function configuration - Fluid Compute enabled
export const maxDuration = 30;

/**
 * Image proxy to serve HTTP images over HTTPS
 * Prevents mixed content warnings when loading external images
 * 
 * Usage: /api/image-proxy?url=http://example.com/image.jpg
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Only proxy HTTP URLs (HTTPS URLs can be loaded directly)
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(imageUrl, {
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Yonder-Image-Proxy/1.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Verify it's actually an image
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 });
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const errorName = (error as Error).name;
    if (errorName === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
