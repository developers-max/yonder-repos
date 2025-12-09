import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock database dependencies (we don't want to hit real DB in integration tests)
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/schema', () => ({
  portugalMunicipalities: {
    caopId: Symbol('caopId'),
  },
}));

// Import after mocking
import { GET, POST } from '../../src/app/api/layer-info/route';

// Test coordinates - Lisbon area (Portugal)
const LISBON_COORDS = { lat: 38.7223, lng: -9.1393 };
// Rural Portugal coordinates (more likely to have cadastre data)
const RURAL_PT_COORDS = { lat: 39.4575, lng: -8.0297 }; // Near Tomar
// Spanish coordinates - Madrid area
const MADRID_COORDS = { lat: 40.4168, lng: -3.7038 };

// Sample polygon (small plot near Lisbon - ~100m x 100m square)
const SAMPLE_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [[
    [-9.1400, 38.7220],
    [-9.1390, 38.7220],
    [-9.1390, 38.7230],
    [-9.1400, 38.7230],
    [-9.1400, 38.7220], // Closing point
  ]],
};

// Larger polygon for area tests
const LARGE_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [[
    [-8.0350, 39.4550],
    [-8.0250, 39.4550],
    [-8.0250, 39.4600],
    [-8.0350, 39.4600],
    [-8.0350, 39.4550],
  ]],
};

// Helper to create GET request
function createRequest(params: Record<string, string | number | undefined>): NextRequest {
  const url = new URL('http://localhost:3000/api/layer-info');
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  return new NextRequest(url);
}

// Helper to create POST request with polygon
function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/layer-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  
  // Set up default mock chain for database queries
  mockDb.select.mockReturnValue(mockDb);
  mockDb.from.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  // Return empty result by default (no municipality found in DB)
  mockDb.limit.mockResolvedValue([]);
});

describe('GET /api/layer-info', () => {
  describe('Parameter validation', () => {
    it('returns 400 when lat is missing', async () => {
      const request = createRequest({ lng: -9.1393, country: 'PT' });
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid coordinates');
    });

    it('returns 400 when lng is missing', async () => {
      const request = createRequest({ lat: 38.7223, country: 'PT' });
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid coordinates');
    });

    it('returns 400 when lat is not a number', async () => {
      const request = createRequest({ lat: 'invalid', lng: -9.1393 });
      const response = await GET(request);
      
      expect(response.status).toBe(400);
    });

    it('returns 400 when area is negative', async () => {
      const request = createRequest({ lat: 38.7223, lng: -9.1393, area: -100 });
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid area');
    });

    it('returns 400 when area is zero', async () => {
      const request = createRequest({ lat: 38.7223, lng: -9.1393, area: 0 });
      const response = await GET(request);
      
      expect(response.status).toBe(400);
    });

    it('returns 400 when area is not a number', async () => {
      const request = createRequest({ lat: 38.7223, lng: -9.1393, area: 'large' });
      const response = await GET(request);
      
      expect(response.status).toBe(400);
    });

    it('defaults country to PT when not provided', async () => {
      const request = createRequest({ lat: 38.7223, lng: -9.1393 });
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.country).toBe('PT');
    });

    it('accepts lowercase country code', async () => {
      const request = createRequest({ lat: 38.7223, lng: -9.1393, country: 'pt' });
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.country).toBe('PT');
    });
  });

  describe('Response structure', () => {
    it('returns correct structure for point query', async () => {
      const request = createRequest({ 
        lat: LISBON_COORDS.lat, 
        lng: LISBON_COORDS.lng, 
        country: 'PT' 
      });
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      
      expect(body).toHaveProperty('coordinates');
      expect(body.coordinates).toEqual({ lat: LISBON_COORDS.lat, lng: LISBON_COORDS.lng });
      expect(body).toHaveProperty('country', 'PT');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('layers');
      expect(Array.isArray(body.layers)).toBe(true);
      
      // Point queries should NOT have areaM2 or boundingBox
      expect(body.areaM2).toBeUndefined();
      expect(body.boundingBox).toBeUndefined();
    });

    it('returns correct structure for area query', async () => {
      const request = createRequest({ 
        lat: LISBON_COORDS.lat, 
        lng: LISBON_COORDS.lng, 
        country: 'PT',
        area: 10000 // 10,000 m² = 1 hectare
      });
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      
      expect(body).toHaveProperty('areaM2', 10000);
      expect(body).toHaveProperty('boundingBox');
      expect(body.boundingBox).toHaveProperty('minLng');
      expect(body.boundingBox).toHaveProperty('minLat');
      expect(body.boundingBox).toHaveProperty('maxLng');
      expect(body.boundingBox).toHaveProperty('maxLat');
      
      // Verify bounding box is centered on coordinates
      const { minLng, maxLng, minLat, maxLat } = body.boundingBox;
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      expect(centerLng).toBeCloseTo(LISBON_COORDS.lng, 4);
      expect(centerLat).toBeCloseTo(LISBON_COORDS.lat, 4);
    });

    it('each layer has required properties', async () => {
      const request = createRequest({ 
        lat: LISBON_COORDS.lat, 
        lng: LISBON_COORDS.lng, 
        country: 'PT' 
      });
      const response = await GET(request);
      const body = await response.json();
      
      body.layers.forEach((layer: Record<string, unknown>) => {
        expect(layer).toHaveProperty('layerId');
        expect(layer).toHaveProperty('layerName');
        expect(layer).toHaveProperty('found');
        expect(typeof layer.layerId).toBe('string');
        expect(typeof layer.layerName).toBe('string');
        expect(typeof layer.found).toBe('boolean');
      });
    });
  });

  describe('Bounding box calculation', () => {
    it('calculates correct bounding box for 10000 m² area', async () => {
      const areaM2 = 10000; // 100m x 100m square
      const request = createRequest({ 
        lat: LISBON_COORDS.lat, 
        lng: LISBON_COORDS.lng, 
        country: 'PT',
        area: areaM2
      });
      const response = await GET(request);
      const body = await response.json();
      
      const { minLng, maxLng, minLat, maxLat } = body.boundingBox;
      
      // For a 10000 m² square: side = 100m, half-side = 50m
      // At ~38.7° latitude:
      // - 1° lat ≈ 111,320m, so 50m ≈ 0.000449°
      // - 1° lng ≈ 111,320 * cos(38.7°) ≈ 86,800m, so 50m ≈ 0.000576°
      
      const deltaLat = (maxLat - minLat) / 2;
      const deltaLng = (maxLng - minLng) / 2;
      
      // Check that deltas are approximately correct (within 10% tolerance)
      expect(deltaLat).toBeGreaterThan(0.0004);
      expect(deltaLat).toBeLessThan(0.0005);
      expect(deltaLng).toBeGreaterThan(0.0005);
      expect(deltaLng).toBeLessThan(0.0007);
    });

    it('calculates larger bounding box for larger area', async () => {
      const request1 = createRequest({ 
        lat: LISBON_COORDS.lat, 
        lng: LISBON_COORDS.lng, 
        area: 1000 
      });
      const request2 = createRequest({ 
        lat: LISBON_COORDS.lat, 
        lng: LISBON_COORDS.lng, 
        area: 100000 
      });
      
      const [response1, response2] = await Promise.all([GET(request1), GET(request2)]);
      const body1 = await response1.json();
      const body2 = await response2.json();
      
      const size1 = (body1.boundingBox.maxLat - body1.boundingBox.minLat);
      const size2 = (body2.boundingBox.maxLat - body2.boundingBox.minLat);
      
      expect(size2).toBeGreaterThan(size1);
    });
  });

  describe('Cache headers', () => {
    it('sets cache-control header', async () => {
      const request = createRequest({ lat: LISBON_COORDS.lat, lng: LISBON_COORDS.lng });
      const response = await GET(request);
      
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    });
  });
});

// Integration tests that make real external API calls
// These are slower and depend on external services being available
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('GET /api/layer-info - External API Integration', () => {
  // Increase timeout for external API calls
  const TIMEOUT = 30000;

  it('queries Portuguese cadastre for valid coordinates', async () => {
    const request = createRequest({ 
      lat: RURAL_PT_COORDS.lat, 
      lng: RURAL_PT_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    
    // Find cadastre layer
    const cadastreLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-cadastro');
    expect(cadastreLayer).toBeDefined();
    
    // If cadastre data exists, verify structure
    if (cadastreLayer.found) {
      expect(cadastreLayer.data).toHaveProperty('parcelReference');
      expect(cadastreLayer.data).toHaveProperty('municipalityCode');
    }
  }, TIMEOUT);

  it('queries administrative boundaries for Portuguese coordinates', async () => {
    const request = createRequest({ 
      lat: LISBON_COORDS.lat, 
      lng: LISBON_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    
    // Check for municipality layer
    const municipioLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-municipio');
    expect(municipioLayer).toBeDefined();
    
    if (municipioLayer.found) {
      expect(municipioLayer.data).toHaveProperty('municipio');
      expect(municipioLayer.data).toHaveProperty('distrito');
    }
    
    // Check for freguesia layer
    const freguesiaLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-freguesia');
    expect(freguesiaLayer).toBeDefined();
  }, TIMEOUT);

  it('returns multiple parcels for area query', async () => {
    const request = createRequest({ 
      lat: RURAL_PT_COORDS.lat, 
      lng: RURAL_PT_COORDS.lng, 
      country: 'PT',
      area: 100000 // 10 hectares - should cover multiple parcels
    });
    const response = await GET(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.areaM2).toBe(100000);
    expect(body.boundingBox).toBeDefined();
    
    // Check cadastre layer for multiple results
    const cadastreLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-cadastro');
    if (cadastreLayer?.found && cadastreLayer.data?.count) {
      expect(cadastreLayer.data.count).toBeGreaterThan(1);
      expect(cadastreLayer.data.parcels).toBeDefined();
      expect(Array.isArray(cadastreLayer.data.parcels)).toBe(true);
    }
  }, TIMEOUT);

  it('queries elevation data', async () => {
    const request = createRequest({ 
      lat: LISBON_COORDS.lat, 
      lng: LISBON_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    const elevationLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'elevation');
    expect(elevationLayer).toBeDefined();
    
    // Elevation service may or may not be available
    if (elevationLayer.found) {
      expect(elevationLayer.data).toHaveProperty('elevationM');
      expect(typeof elevationLayer.data.elevationM).toBe('number');
    }
  }, TIMEOUT);

  it('queries COS (land use) layer', async () => {
    const request = createRequest({ 
      lat: RURAL_PT_COORDS.lat, 
      lng: RURAL_PT_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    const cosLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-cos');
    expect(cosLayer).toBeDefined();
    expect(cosLayer.layerName).toBe('Carta de Ocupação do Solo (COS 2018)');
    
    if (cosLayer.found) {
      // COS returns land use classification
      expect(cosLayer.data).toBeDefined();
    }
  }, TIMEOUT);

  it('queries CLC (Corine Land Cover) layer', async () => {
    const request = createRequest({ 
      lat: RURAL_PT_COORDS.lat, 
      lng: RURAL_PT_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    const clcLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-clc');
    expect(clcLayer).toBeDefined();
    expect(clcLayer.layerName).toBe('Corine Land Cover (CLC 2018)');
  }, TIMEOUT);

  it('queries district layer', async () => {
    const request = createRequest({ 
      lat: LISBON_COORDS.lat, 
      lng: LISBON_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    const districtLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-distrito');
    expect(districtLayer).toBeDefined();
    expect(districtLayer.layerName).toBe('Distrito');
    
    if (districtLayer.found) {
      expect(districtLayer.data).toHaveProperty('distrito');
    }
  }, TIMEOUT);

  it('queries built-up areas layer', async () => {
    const request = createRequest({ 
      lat: LISBON_COORDS.lat, 
      lng: LISBON_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    const builtupLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-builtup');
    expect(builtupLayer).toBeDefined();
    expect(builtupLayer.layerName).toBe('Áreas Edificadas (2018)');
  }, TIMEOUT);

  it('queries Spanish cadastre', async () => {
    const request = createRequest({ 
      lat: MADRID_COORDS.lat, 
      lng: MADRID_COORDS.lng, 
      country: 'ES' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.country).toBe('ES');
    
    const cadastreLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'es-cadastro');
    expect(cadastreLayer).toBeDefined();
  }, TIMEOUT);

  it('returns all available layers even when some fail', async () => {
    const request = createRequest({ 
      lat: LISBON_COORDS.lat, 
      lng: LISBON_COORDS.lng, 
      country: 'PT' 
    });
    const response = await GET(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    
    // Should have multiple layers regardless of individual layer success/failure
    expect(body.layers.length).toBeGreaterThan(0);
    
    // Each layer should either be found or have an error
    body.layers.forEach((layer: Record<string, unknown>) => {
      if (!layer.found) {
        // Not found is acceptable, may or may not have error
        expect(layer.found).toBe(false);
      } else {
        expect(layer.data).toBeDefined();
      }
    });
  }, TIMEOUT);

  it('handles area query returning features from multiple zones', async () => {
    // Large area that might span multiple administrative units
    const request = createRequest({ 
      lat: RURAL_PT_COORDS.lat, 
      lng: RURAL_PT_COORDS.lng, 
      country: 'PT',
      area: 1000000 // 100 hectares = 1 km²
    });
    const response = await GET(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.boundingBox).toBeDefined();
    
    // For large areas, check if layers return multiple features
    const layersWithMultipleFeatures = body.layers.filter((layer: Record<string, unknown>) => {
      if (layer.found && layer.data && typeof layer.data === 'object') {
        const data = layer.data as Record<string, unknown>;
        return data.count && (data.count as number) > 1;
      }
      return false;
    });
    
    // Log for debugging
    console.log(`Found ${layersWithMultipleFeatures.length} layers with multiple features`);
    layersWithMultipleFeatures.forEach((layer: Record<string, unknown>) => {
      const data = layer.data as Record<string, unknown>;
      console.log(`  - ${layer.layerId}: ${data.count} features`);
    });
  }, TIMEOUT);
});

// POST handler tests for polygon queries
describe('POST /api/layer-info (Polygon queries)', () => {
  describe('Parameter validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/layer-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid JSON');
    });

    it('returns 400 when polygon is missing', async () => {
      const request = createPostRequest({ country: 'PT' });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid polygon');
    });

    it('returns 400 when polygon type is not Polygon', async () => {
      const request = createPostRequest({ 
        polygon: { type: 'Point', coordinates: [0, 0] },
        country: 'PT'
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid polygon');
    });

    it('returns 400 when polygon has too few vertices', async () => {
      const request = createPostRequest({ 
        polygon: { 
          type: 'Polygon', 
          coordinates: [[[-9.14, 38.72], [-9.13, 38.72], [-9.14, 38.72]]] // Only 2 unique points
        },
        country: 'PT'
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid country', async () => {
      const request = createPostRequest({ 
        polygon: SAMPLE_POLYGON,
        country: 'FR'
      });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid country');
    });

    it('defaults country to PT when not provided', async () => {
      const request = createPostRequest({ polygon: SAMPLE_POLYGON });
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.country).toBe('PT');
    });
  });

  describe('Response structure', () => {
    it('returns correct structure for polygon query', async () => {
      const request = createPostRequest({ 
        polygon: SAMPLE_POLYGON,
        country: 'PT'
      });
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      
      // Should have coordinates (centroid)
      expect(body).toHaveProperty('coordinates');
      expect(body.coordinates).toHaveProperty('lat');
      expect(body.coordinates).toHaveProperty('lng');
      
      // Should have computed values
      expect(body).toHaveProperty('areaM2');
      expect(typeof body.areaM2).toBe('number');
      expect(body.areaM2).toBeGreaterThan(0);
      
      expect(body).toHaveProperty('boundingBox');
      expect(body.boundingBox).toHaveProperty('minLng');
      expect(body.boundingBox).toHaveProperty('minLat');
      expect(body.boundingBox).toHaveProperty('maxLng');
      expect(body.boundingBox).toHaveProperty('maxLat');
      
      // Should include the polygon in response
      expect(body).toHaveProperty('polygon');
      expect(body.polygon.type).toBe('Polygon');
      
      // Should have layers
      expect(body).toHaveProperty('layers');
      expect(Array.isArray(body.layers)).toBe(true);
    });

    it('calculates centroid correctly', async () => {
      const request = createPostRequest({ polygon: SAMPLE_POLYGON });
      const response = await POST(request);
      const body = await response.json();
      
      // Centroid should be roughly in the center of the polygon
      // SAMPLE_POLYGON spans from -9.14 to -9.139 lng and 38.722 to 38.723 lat
      expect(body.coordinates.lng).toBeCloseTo(-9.1395, 3);
      expect(body.coordinates.lat).toBeCloseTo(38.7225, 3);
    });

    it('calculates bounding box from polygon vertices', async () => {
      const request = createPostRequest({ polygon: SAMPLE_POLYGON });
      const response = await POST(request);
      const body = await response.json();
      
      // Check bounding box matches polygon extent
      expect(body.boundingBox.minLng).toBeCloseTo(-9.14, 3);
      expect(body.boundingBox.maxLng).toBeCloseTo(-9.139, 3);
      expect(body.boundingBox.minLat).toBeCloseTo(38.722, 3);
      expect(body.boundingBox.maxLat).toBeCloseTo(38.723, 3);
    });

    it('calculates approximate area in square meters', async () => {
      const request = createPostRequest({ polygon: SAMPLE_POLYGON });
      const response = await POST(request);
      const body = await response.json();
      
      // SAMPLE_POLYGON is roughly 100m x 100m = ~10,000 m²
      // Allow some tolerance for coordinate conversion
      expect(body.areaM2).toBeGreaterThan(5000);
      expect(body.areaM2).toBeLessThan(20000);
    });
  });
});

// Integration tests for POST with real APIs
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('POST /api/layer-info - External API Integration', () => {
  const TIMEOUT = 30000;

  it('queries all layers for a polygon', async () => {
    const request = createPostRequest({ 
      polygon: SAMPLE_POLYGON,
      country: 'PT'
    });
    const response = await POST(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.layers.length).toBeGreaterThan(0);
    
    // Check that we have the expected layer types
    const layerIds = body.layers.map((l: Record<string, unknown>) => l.layerId);
    expect(layerIds).toContain('pt-cadastro');
    expect(layerIds).toContain('elevation');
    expect(layerIds).toContain('pt-cos');
    expect(layerIds).toContain('pt-clc');
  }, TIMEOUT);

  it('returns layers for a larger polygon with multiple features', async () => {
    const request = createPostRequest({ 
      polygon: LARGE_POLYGON,
      country: 'PT'
    });
    const response = await POST(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.areaM2).toBeGreaterThan(100000); // Large polygon
    
    // Check for cadastre data (likely multiple parcels)
    const cadastreLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'pt-cadastro');
    if (cadastreLayer?.found && cadastreLayer.data?.count) {
      console.log(`Found ${cadastreLayer.data.count} cadastre parcels in polygon`);
      expect(cadastreLayer.data.count).toBeGreaterThan(1);
    }
  }, TIMEOUT);

  it('queries Spanish layers for polygon', async () => {
    const spanishPolygon = {
      type: 'Polygon' as const,
      coordinates: [[
        [-3.7050, 40.4160],
        [-3.7030, 40.4160],
        [-3.7030, 40.4180],
        [-3.7050, 40.4180],
        [-3.7050, 40.4160],
      ]],
    };
    
    const request = createPostRequest({ 
      polygon: spanishPolygon,
      country: 'ES'
    });
    const response = await POST(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(body.country).toBe('ES');
    
    const cadastreLayer = body.layers.find((l: Record<string, unknown>) => l.layerId === 'es-cadastro');
    expect(cadastreLayer).toBeDefined();
  }, TIMEOUT);
});
