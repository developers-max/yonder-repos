import request from 'supertest';
import express from 'express';
import app from '../../src/api/server';
import * as locationEnrichment from '../../src/api/location-enrichment';

// Mock the location enrichment module
jest.mock('../../src/api/location-enrichment');

describe('API Server Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'yonder-enrich');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return valid timestamp', async () => {
      const response = await request(app).get('/health');
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it('should return uptime as a number', async () => {
      const response = await request(app).get('/health');
      
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /api/enrich/info', () => {
    it('should return API documentation', async () => {
      const response = await request(app).get('/api/enrich/info');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('available_enrichments');
      expect(response.body).toHaveProperty('data_sources');
    });

    it('should document all endpoints', async () => {
      const response = await request(app).get('/api/enrich/info');

      const endpoints = response.body.endpoints;
      expect(endpoints).toHaveProperty('health');
      expect(endpoints).toHaveProperty('location_enrichment');
      expect(endpoints).toHaveProperty('info');
    });

    it('should list global enrichments', async () => {
      const response = await request(app).get('/api/enrich/info');

      const enrichments = response.body.available_enrichments;
      expect(enrichments.global).toContain('amenities');
      expect(enrichments.global).toContain('municipalities');
    });

    it('should list country-specific enrichments', async () => {
      const response = await request(app).get('/api/enrich/info');

      const enrichments = response.body.available_enrichments;
      expect(enrichments.portugal).toContain('crus-zoning');
      expect(enrichments.portugal).toContain('portugal-cadastre');
      expect(enrichments.spain).toContain('spain-zoning');
      expect(enrichments.spain).toContain('spain-cadastre');
      expect(enrichments.germany).toContain('germany-zoning');
    });
  });

  describe('POST /api/enrich/location', () => {
    const mockEnrichmentResponse = {
      location: { latitude: 40.7128, longitude: -74.0060 },
      country: 'US',
      municipality: { id: 1, name: 'New York', district: 'NY', country: 'US' },
      amenities: { schools: 5, restaurants: 10 },
      enrichments_run: ['municipalities', 'amenities'],
      enrichments_skipped: [],
      enrichments_failed: [],
      timestamp: new Date().toISOString(),
    };

    beforeEach(() => {
      (locationEnrichment.enrichLocation as jest.Mock).mockResolvedValue(mockEnrichmentResponse);
    });

    it('should successfully enrich a valid location with plot_id', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          plot_id: 'test-plot-456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('location');
      expect(response.body.location.latitude).toBe(40.7128);
      expect(response.body.location.longitude).toBe(-74.0060);
      expect(response.body).toHaveProperty('enrichments_run');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should successfully enrich when store_results is false (no plot_id needed)', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          store_results: false,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('location');
    });

    it('should reject request when plot_id is missing and store_results is true', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          store_results: true,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('plot_id is required');
    });

    it('should call enrichLocation with plot_id when provided', async () => {
      await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          plot_id: 'test-plot-123',
        });

      expect(locationEnrichment.enrichLocation).toHaveBeenCalledWith({
        latitude: 40.7128,
        longitude: -74.0060,
        plot_id: 'test-plot-123',
        store_results: true,
        translate: false,
        target_language: 'en',
      });
    });

    it('should respect store_results flag when false', async () => {
      await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          store_results: false,
        });

      expect(locationEnrichment.enrichLocation).toHaveBeenCalledWith({
        latitude: 40.7128,
        longitude: -74.0060,
        store_results: false,
        translate: false,
        target_language: 'en',
      });
    });

    it('should respect translate flag when true', async () => {
      await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          plot_id: 'test-plot-translate',
          translate: true,
          target_language: 'fr',
        });

      expect(locationEnrichment.enrichLocation).toHaveBeenCalledWith({
        latitude: 40.7128,
        longitude: -74.0060,
        plot_id: 'test-plot-translate',
        store_results: true,
        translate: true,
        target_language: 'fr',
      });
    });

    it('should reject missing latitude', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          longitude: -74.0060,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('latitude');
    });

    it('should reject missing longitude', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request');
      expect(response.body.message).toContain('longitude');
    });

    it('should reject non-numeric latitude', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 'invalid',
          longitude: -74.0060,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request');
    });

    it('should reject latitude out of range (< -90)', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: -91,
          longitude: -74.0060,
          store_results: false,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid latitude');
      expect(response.body.message).toContain('-90 and 90');
    });

    it('should reject latitude out of range (> 90)', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 91,
          longitude: -74.0060,
          store_results: false,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid latitude');
    });

    it('should reject longitude out of range (< -180)', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -181,
          store_results: false,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid longitude');
      expect(response.body.message).toContain('-180 and 180');
    });

    it('should reject longitude out of range (> 180)', async () => {
      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: 181,
          store_results: false,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid longitude');
    });

    it('should accept boundary latitude values', async () => {
      const response1 = await request(app)
        .post('/api/enrich/location')
        .send({ latitude: -90, longitude: 0, store_results: false });

      const response2 = await request(app)
        .post('/api/enrich/location')
        .send({ latitude: 90, longitude: 0, store_results: false });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should accept boundary longitude values', async () => {
      const response1 = await request(app)
        .post('/api/enrich/location')
        .send({ latitude: 0, longitude: -180, store_results: false });

      const response2 = await request(app)
        .post('/api/enrich/location')
        .send({ latitude: 0, longitude: 180, store_results: false });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should handle enrichLocation errors gracefully', async () => {
      (locationEnrichment.enrichLocation as jest.Mock).mockRejectedValue(
        new Error('External service unavailable')
      );

      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          store_results: false,
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(response.body.message).toContain('External service unavailable');
    });

    it('should handle unexpected errors', async () => {
      (locationEnrichment.enrichLocation as jest.Mock).mockRejectedValue(
        new Error()
      );

      const response = await request(app)
        .post('/api/enrich/location')
        .send({
          latitude: 40.7128,
          longitude: -74.0060,
          store_results: false,
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown GET routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not found');
      expect(response.body.message).toContain('/unknown-route');
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app).post('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not found');
    });

    it('should list available endpoints in 404 response', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.body).toHaveProperty('available_endpoints');
      expect(response.body.available_endpoints).toContain('GET /health');
      expect(response.body.available_endpoints).toContain('GET /api/enrich/info');
      expect(response.body.available_endpoints).toContain('POST /api/enrich/location');
    });
  });

  describe('Content-Type handling', () => {
    it('should accept JSON content type', async () => {
      (locationEnrichment.enrichLocation as jest.Mock).mockResolvedValue({
        location: { latitude: 40.7128, longitude: -74.0060 },
        enrichments_run: [],
        enrichments_skipped: [],
        enrichments_failed: [],
        timestamp: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/api/enrich/location')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          latitude: 40.7128,
          longitude: -74.0060,
          store_results: false,
        }));

      expect(response.status).toBe(200);
    });
  });
});
