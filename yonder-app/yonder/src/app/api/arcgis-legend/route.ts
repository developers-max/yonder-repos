import { NextRequest, NextResponse } from 'next/server';

interface ArcGISLegendItem {
  label: string;
  imageData: string;
  contentType: string;
  width: number;
  height: number;
  values?: string[];
}

interface ArcGISLegendLayer {
  layerId: number;
  layerName: string;
  legend: ArcGISLegendItem[];
}

interface ArcGISLegendResponse {
  layers: ArcGISLegendLayer[];
}

/**
 * API endpoint to render ArcGIS REST legend as an SVG image
 * 
 * Query params:
 * - url: ArcGIS legend URL (must end with /legend?f=json)
 * - layer: (optional) specific layer ID to show
 * - filter: (optional) filter legend by name containing this string (e.g., 'REN', 'RAN')
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const legendUrl = searchParams.get('url');
    const layerFilter = searchParams.get('layer');
    const nameFilter = searchParams.get('filter');

    if (!legendUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Fetch legend from ArcGIS
    const response = await fetch(legendUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch legend' }, { status: 502 });
    }

    const data: ArcGISLegendResponse = await response.json();

    // Filter layers if specified
    let layers = data.layers || [];
    
    if (layerFilter) {
      const layerId = parseInt(layerFilter);
      layers = layers.filter(l => l.layerId === layerId);
    }

    if (nameFilter) {
      const filter = nameFilter.toLowerCase();
      layers = layers.filter(l => 
        l.layerName.toLowerCase().includes(filter) ||
        l.legend.some(item => item.label?.toLowerCase().includes(filter))
      );
    }

    // Calculate SVG dimensions
    const itemHeight = 28;
    const layerHeaderHeight = 24;
    const padding = 12;
    const iconSize = 20;
    const textOffset = iconSize + 10;
    
    let totalHeight = padding;
    for (const layer of layers) {
      totalHeight += layerHeaderHeight;
      totalHeight += layer.legend.length * itemHeight;
      totalHeight += 8; // spacing between layers
    }
    totalHeight += padding;

    const width = 320;

    // Generate SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <style>
    .layer-name { font: bold 13px system-ui, sans-serif; fill: #374151; }
    .legend-label { font: 12px system-ui, sans-serif; fill: #4b5563; }
  </style>
  <rect width="100%" height="100%" fill="white"/>`;

    let yOffset = padding;

    for (const layer of layers) {
      // Layer header
      svg += `\n  <text x="${padding}" y="${yOffset + 14}" class="layer-name">${escapeXml(layer.layerName)}</text>`;
      yOffset += layerHeaderHeight;

      // Legend items
      for (const item of layer.legend) {
        const imageY = yOffset + (itemHeight - iconSize) / 2;
        
        // Embedded image from base64
        svg += `\n  <image x="${padding}" y="${imageY}" width="${iconSize}" height="${iconSize}" href="data:${item.contentType};base64,${item.imageData}"/>`;
        
        // Label
        if (item.label) {
          svg += `\n  <text x="${padding + textOffset}" y="${yOffset + itemHeight/2 + 4}" class="legend-label">${escapeXml(item.label)}</text>`;
        }
        
        yOffset += itemHeight;
      }
      
      yOffset += 8; // spacing between layers
    }

    svg += '\n</svg>';

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[ArcGIS Legend] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
