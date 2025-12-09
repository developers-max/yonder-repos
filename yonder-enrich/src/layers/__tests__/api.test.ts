/**
 * API Integration Tests for Layer Query Endpoints
 */

import request from 'supertest';
import app from '../../api/server';

// Increase timeout for external API calls
jest.setTimeout(30000);

describe('Layer Query API Endpoints', () => {
  describe('GET /api/layers', () => {
    it('should return 400 for missing coordinates', async () => {
      const response = await request(app)
        .get('/api/layers')
        .expect(400);
      
      expect(response.body.error).toBe('Invalid coordinates');
    });

    it('should return 400 for invalid lat', async () => {
      const response = await request(app)
        .get('/api/layers?lat=invalid&lng=-9.1')
        .expect(400);
      
      expect(response.body.error).toBe('Invalid coordinates');
    });

    it('should return 400 for invalid country', async () => {
      const response = await request(app)
        .get('/api/layers?lat=38.7&lng=-9.1&country=FR')
        .expect(400);
      
      expect(response.body.error).toBe('Invalid country');
    });

    it('should return 400 for invalid area', async () => {
      const response = await request(app)
        .get('/api/layers?lat=38.7&lng=-9.1&area=-100')
        .expect(400);
      
      expect(response.body.error).toBe('Invalid area');
    });

    it('should query layers successfully for Portugal', async () => {
      const response = await request(app)
        .get('/api/layers?lat=38.7223&lng=-9.1393&country=PT')
        .expect(200);
      
      expect(response.body).toHaveProperty('coordinates');
      expect(response.body).toHaveProperty('country', 'PT');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('layers');
      expect(Array.isArray(response.body.layers)).toBe(true);
    });

    it('should default to Portugal when country not specified', async () => {
      const response = await request(app)
        .get('/api/layers?lat=38.7223&lng=-9.1393')
        .expect(200);
      
      expect(response.body.country).toBe('PT');
    });

    it('should include bounding box when area provided', async () => {
      const response = await request(app)
        .get('/api/layers?lat=38.7223&lng=-9.1393&area=5000')
        .expect(200);
      
      expect(response.body.areaM2).toBe(5000);
      expect(response.body.boundingBox).toBeDefined();
      expect(response.body.boundingBox).toHaveProperty('minLng');
      expect(response.body.boundingBox).toHaveProperty('minLat');
      expect(response.body.boundingBox).toHaveProperty('maxLng');
      expect(response.body.boundingBox).toHaveProperty('maxLat');
    });

    it('should query layers for Spain', async () => {
      const response = await request(app)
        .get('/api/layers?lat=40.4168&lng=-3.7038&country=ES')
        .expect(200);
      
      expect(response.body.country).toBe('ES');
      expect(Array.isArray(response.body.layers)).toBe(true);
    });
  });

  describe('POST /api/layers', () => {
    it('should return 400 for missing coordinates', async () => {
      const response = await request(app)
        .post('/api/layers')
        .send({})
        .expect(400);
      
      expect(response.body.error).toBe('Invalid coordinates');
    });

    it('should return 400 for invalid coordinate types', async () => {
      const response = await request(app)
        .post('/api/layers')
        .send({ lat: 'invalid', lng: -9.1 })
        .expect(400);
      
      expect(response.body.error).toBe('Invalid coordinates');
    });

    it('should query layers successfully with POST', async () => {
      const response = await request(app)
        .post('/api/layers')
        .send({
          lat: 38.7223,
          lng: -9.1393,
          country: 'PT',
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('coordinates');
      expect(response.body).toHaveProperty('country', 'PT');
      expect(response.body).toHaveProperty('layers');
    });

    it('should accept polygon in POST body', async () => {
      const response = await request(app)
        .post('/api/layers')
        .send({
          lat: 38.7223,
          lng: -9.1393,
          country: 'PT',
          polygon: {
            type: 'Polygon',
            coordinates: [[
              [-9.14, 38.72],
              [-9.14, 38.73],
              [-9.13, 38.73],
              [-9.13, 38.72],
              [-9.14, 38.72],
            ]],
          },
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('polygon');
    });

    it('should handle area parameter in POST', async () => {
      const response = await request(app)
        .post('/api/layers')
        .send({
          lat: 38.7223,
          lng: -9.1393,
          areaM2: 10000,
        })
        .expect(200);
      
      // Note: areaM2 may or may not be in response depending on implementation
      expect(response.body).toHaveProperty('layers');
    });
  });

  describe('Layer Response Structure', () => {
    it('should return properly structured layer results', async () => {
      const response = await request(app)
        .get('/api/layers?lat=38.7223&lng=-9.1393')
        .expect(200);
      
      for (const layer of response.body.layers) {
        expect(layer).toHaveProperty('layerId');
        expect(layer).toHaveProperty('layerName');
        expect(layer).toHaveProperty('found');
        expect(typeof layer.found).toBe('boolean');
        
        if (layer.found) {
          expect(layer).toHaveProperty('data');
        }
      }
    });

    it('should include expected Portugal layer IDs', async () => {
      const response = await request(app)
        .get('/api/layers?lat=41.1579&lng=-8.6291&country=PT')
        .expect(200);
      
      const layerIds = response.body.layers.map((l: any) => l.layerId);
      
      // Core layers should always be present
      expect(layerIds).toContain('pt-municipio');
      expect(layerIds).toContain('pt-freguesia');
      expect(layerIds).toContain('pt-cadastro');
      expect(layerIds).toContain('elevation');
    });

    it('should include expected Spain layer IDs', async () => {
      const response = await request(app)
        .get('/api/layers?lat=40.4168&lng=-3.7038&country=ES')
        .expect(200);
      
      const layerIds = response.body.layers.map((l: any) => l.layerId);
      
      expect(layerIds).toContain('es-cadastro');
      expect(layerIds).toContain('elevation');
    });
  });

  describe('Health and Info Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('yonder-enrich');
    });

    it('should return API info', async () => {
      const response = await request(app)
        .get('/api/enrich/info')
        .expect(200);
      
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('endpoints');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown/route')
        .expect(404);
      
      expect(response.body.error).toBe('Not found');
      expect(response.body.available_endpoints).toContain('GET /api/layers?lat={lat}&lng={lng}&country={PT|ES}');
    });
  });
});
