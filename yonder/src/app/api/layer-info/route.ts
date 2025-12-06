import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { portugalMunicipalities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * API endpoint to query map layer information at a specific point
 * Returns data from all available layers (cadastre, REN, RAN, etc.)
 * 
 * GET /api/layer-info?lat={latitude}&lng={longitude}&country={PT|ES}
 */

interface LayerResult {
  layerId: string;
  layerName: string;
  found: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

interface QueryResponse {
  coordinates: { lat: number; lng: number };
  country: 'PT' | 'ES';
  timestamp: string;
  layers: LayerResult[];
}

// Generic OGC API query helper
async function queryOGCCollection(
  lat: number, 
  lng: number, 
  collection: string,
  layerId: string,
  layerName: string,
  propsMapper?: (props: Record<string, unknown>) => Record<string, unknown>
): Promise<LayerResult> {
  const delta = 0.0001; // ~10m buffer
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url = `https://ogcapi.dgterritorio.gov.pt/collections/${collection}/items?bbox=${bbox}&f=json&limit=1`;
  
  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return { layerId, layerName, found: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const features = data.features || [];
    
    if (features.length === 0) {
      return { layerId, layerName, found: false };
    }
    
    const props = features[0].properties || {};
    return {
      layerId,
      layerName,
      found: true,
      data: propsMapper ? propsMapper(props) : props
    };
  } catch (error) {
    return { 
      layerId, 
      layerName, 
      found: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Query elevation from Open-Elevation API
async function queryElevation(lat: number, lng: number): Promise<LayerResult> {
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
  
  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return { layerId: 'elevation', layerName: 'Elevation', found: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const elevation = data.results?.[0]?.elevation;
    
    if (elevation === undefined) {
      return { layerId: 'elevation', layerName: 'Elevation', found: false };
    }
    
    return {
      layerId: 'elevation',
      layerName: 'Elevation',
      found: true,
      data: {
        elevationM: elevation,
        source: 'SRTM/Open-Elevation'
      }
    };
  } catch (error) {
    return { 
      layerId: 'elevation', 
      layerName: 'Elevation', 
      found: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Query Portuguese Cadastre via OGC API
async function queryPortugueseCadastre(lat: number, lng: number): Promise<LayerResult> {
  const delta = 0.0001; // ~10m buffer
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url = `https://ogcapi.dgterritorio.gov.pt/collections/cadastro/items?bbox=${bbox}&f=json&limit=1`;
  
  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return { layerId: 'pt-cadastro', layerName: 'Cadastro Predial', found: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const features = data.features || [];
    
    if (features.length === 0) {
      return { layerId: 'pt-cadastro', layerName: 'Cadastro Predial', found: false };
    }
    
    const props = features[0].properties || {};
    return {
      layerId: 'pt-cadastro',
      layerName: 'Cadastro Predial',
      found: true,
      data: {
        parcelReference: props.nationalcadastralreference,
        inspireId: props.inspireid,
        label: props.label,
        areaM2: props.areavalue,
        municipalityCode: props.administrativeunit,
        validFrom: props.beginlifespanversion,
      }
    };
  } catch (error) {
    return { 
      layerId: 'pt-cadastro', 
      layerName: 'Cadastro Predial', 
      found: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Query Spanish Cadastre via WMS GetFeatureInfo
async function querySpanishCadastre(lat: number, lng: number): Promise<LayerResult> {
  // Create a small bbox around the point
  const delta = 0.001;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url = `https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&QUERY_LAYERS=Catastro&LAYERS=Catastro&INFO_FORMAT=text/plain&X=128&Y=128&WIDTH=256&HEIGHT=256&SRS=EPSG:4326&BBOX=${bbox}`;
  
  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Yonder/1.0' }
    });
    
    if (!response.ok) {
      return { layerId: 'es-cadastro', layerName: 'Catastro', found: false, error: `HTTP ${response.status}` };
    }
    
    const text = await response.text();
    
    // Parse the plain text response (Spanish cadastre returns text, not JSON)
    if (text.includes('error') || text.includes('Error') || !text.includes('Parcela')) {
      return { layerId: 'es-cadastro', layerName: 'Catastro', found: false };
    }
    
    // Extract parcel reference from text response
    const refMatch = text.match(/Referencia catastral[:\s]+([A-Z0-9]+)/i);
    const areaMatch = text.match(/Superficie[:\s]+([\d.,]+)/i);
    
    return {
      layerId: 'es-cadastro',
      layerName: 'Catastro',
      found: true,
      data: {
        parcelReference: refMatch?.[1] || 'Unknown',
        rawResponse: text.substring(0, 500), // First 500 chars
        areaM2: areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null,
      }
    };
  } catch (error) {
    return { 
      layerId: 'es-cadastro', 
      layerName: 'Catastro', 
      found: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Query Municipal REN/RAN via ArcGIS Identify
async function queryMunicipalRenRan(
  lat: number, 
  lng: number, 
  serviceUrl: string, 
  layerId: string,
  layerName: string
): Promise<LayerResult> {
  // ArcGIS MapServer identify endpoint
  const identifyUrl = serviceUrl.replace('/export', '/identify');
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: 'all',
    tolerance: '2',
    mapExtent: `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`,
    imageDisplay: '256,256,96',
    returnGeometry: 'false',
    f: 'json',
  });
  
  try {
    const response = await fetch(`${identifyUrl}?${params}`, { 
      signal: AbortSignal.timeout(10000) 
    });
    
    if (!response.ok) {
      return { layerId, layerName, found: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      return { layerId, layerName, found: false };
    }
    
    // Return first matching result
    const result = results[0];
    return {
      layerId,
      layerName,
      found: true,
      data: {
        sourceLayer: result.layerName,
        attributes: result.attributes,
      }
    };
  } catch (error) {
    return { 
      layerId, 
      layerName, 
      found: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  const country = (searchParams.get('country') || 'PT').toUpperCase() as 'PT' | 'ES';
  
  // Validate coordinates
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'Invalid coordinates. Provide lat and lng as numbers.' },
      { status: 400 }
    );
  }
  
  // Validate country
  if (country !== 'PT' && country !== 'ES') {
    return NextResponse.json(
      { error: 'Invalid country. Use PT or ES.' },
      { status: 400 }
    );
  }
  
  const layers: LayerResult[] = [];
  
  if (country === 'PT') {
    // First query cadastre to get municipality code
    const cadastreResult = await queryPortugueseCadastre(lat, lng);
    layers.push(cadastreResult);
    
    // Extract municipality code from cadastre result (format: DDCCFF where DD=district, CC=concelho, FF=freguesia)
    const municipalityCode = cadastreResult.data?.municipalityCode as string | undefined;
    
    // Look up municipality by CAOP ID (first 4 digits of municipality code)
    let municipality: typeof portugalMunicipalities.$inferSelect | undefined;
    if (municipalityCode) {
      const caopId = municipalityCode.substring(0, 4);
      const result = await db.select()
        .from(portugalMunicipalities)
        .where(eq(portugalMunicipalities.caopId, caopId))
        .limit(1);
      municipality = result[0];
    }
    
    // Query REN/RAN if municipality has verified services
    if (municipality?.gisVerified && municipality.renService?.url) {
      const renResult = await queryMunicipalRenRan(
        lat, lng,
        municipality.renService.url,
        'pt-ren',
        `REN - ${municipality.name}`
      );
      layers.push(renResult);
    } else {
      layers.push({
        layerId: 'pt-ren',
        layerName: 'Reserva Ecológica Nacional',
        found: false,
        error: municipality 
          ? `No REN service available for ${municipality.name}` 
          : 'Municipality not identified from cadastre',
      });
    }
    
    if (municipality?.gisVerified && municipality.ranService?.url) {
      const ranResult = await queryMunicipalRenRan(
        lat, lng,
        municipality.ranService.url,
        'pt-ran',
        `RAN - ${municipality.name}`
      );
      layers.push(ranResult);
    } else {
      layers.push({
        layerId: 'pt-ran',
        layerName: 'Reserva Agrícola Nacional',
        found: false,
        error: municipality 
          ? `No RAN service available for ${municipality.name}` 
          : 'Municipality not identified from cadastre',
      });
    }
    
    // Add municipality info from our database
    if (municipality) {
      layers.push({
        layerId: 'pt-municipality-db',
        layerName: 'Município (Database)',
        found: true,
        data: {
          name: municipality.name,
          caopId: municipalityCode?.substring(0, 4),
          hasRenService: !!municipality.renService,
          hasRanService: !!municipality.ranService,
          gisVerified: municipality.gisVerified,
        }
      });
    }
    
    // Query additional layers in parallel
    const additionalQueries = await Promise.all([
      // Elevation
      queryElevation(lat, lng),
      
      // Administrative boundaries from OGC API
      queryOGCCollection(lat, lng, 'municipios', 'pt-municipio', 'Município (CAOP)', (props) => ({
        municipio: props.municipio,
        distrito: props.distrito_ilha,
        nuts1: props.nuts1,
        nuts2: props.nuts2,
        nuts3: props.nuts3,
        areaHa: props.area_ha,
        nFreguesias: props.n_freguesias,
      })),
      
      queryOGCCollection(lat, lng, 'freguesias', 'pt-freguesia', 'Freguesia', (props) => ({
        freguesia: props.freguesia,
        municipio: props.municipio,
        distrito: props.distrito_ilha,
        areaHa: props.area_ha,
      })),
      
      queryOGCCollection(lat, lng, 'nuts3', 'pt-nuts3', 'NUTS III', (props) => ({
        nuts3: props.nuts3,
        nuts2: props.nuts2,
        nuts1: props.nuts1,
      })),
    ]);
    
    layers.push(...additionalQueries);
    
  } else {
    // Query Spanish layers in parallel
    const [cadastreResult, elevationResult] = await Promise.all([
      querySpanishCadastre(lat, lng),
      queryElevation(lat, lng),
    ]);
    layers.push(cadastreResult, elevationResult);
  }
  
  const response: QueryResponse = {
    coordinates: { lat, lng },
    country,
    timestamp: new Date().toISOString(),
    layers,
  };
  
  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    },
  });
}
