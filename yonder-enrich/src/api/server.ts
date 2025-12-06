import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { enrichLocation, LocationEnrichmentRequest, LocationEnrichmentResponse } from './location-enrichment';

dotenv.config();

// Cloud Run provides PORT env var, use it if available, otherwise use API_PORT or default to 3000
const PORT = parseInt(process.env.PORT || process.env.API_PORT || '3000', 10);

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    service: 'yonder-enrich',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main location enrichment endpoint
app.post('/api/enrich/location', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, plot_id, store_results, translate, target_language } = req.body;

    // Validate required parameters
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'latitude and longitude are required and must be numbers',
        example: {
          latitude: 40.7128,
          longitude: -74.0060,
          plot_id: 'plot-uuid-123',
          store_results: true,
          translate: false,
          target_language: 'en'
        }
      });
    }

    // Validate plot_id is required when store_results is true
    if (store_results !== false && !plot_id) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'plot_id is required when store_results is true (or not specified)',
        example: {
          latitude: 40.7128,
          longitude: -74.0060,
          plot_id: 'plot-uuid-123',
          store_results: true
        }
      });
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        error: 'Invalid latitude',
        message: 'latitude must be between -90 and 90'
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: 'Invalid longitude',
        message: 'longitude must be between -180 and 180'
      });
    }

    console.log(`\n=== Enrichment Request ===`);
    console.log(`Coordinates: ${latitude}, ${longitude}`);
    console.log(`Plot ID: ${plot_id || 'none'}`);
    console.log(`Store results: ${store_results !== false}`);
    console.log(`Translate: ${translate === true}`);
    console.log(`Target language: ${target_language || 'en'}`);

    // Create enrichment request
    const request: LocationEnrichmentRequest = {
      latitude,
      longitude,
      plot_id,
      store_results: store_results !== false, // Default to true
      translate: translate === true, // Default to false
      target_language: target_language || 'en'
    };

    // Run enrichment
    const result: LocationEnrichmentResponse = await enrichLocation(request);

    console.log(`\n=== Enrichment Complete ===`);
    console.log(`Enrichments run: ${result.enrichments_run.join(', ')}`);
    console.log(`Enrichments skipped: ${result.enrichments_skipped.join(', ')}`);
    console.log(`Enrichments failed: ${result.enrichments_failed.join(', ')}`);

    // Return response
    res.json(result);

  } catch (error: any) {
    console.error('Error processing enrichment request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Get enrichment documentation
app.get('/api/enrich/info', (req: Request, res: Response) => {
  res.json({
    description: 'Location enrichment API for Yonder',
    version: '1.0.0',
    endpoints: {
      health: {
        method: 'GET',
        path: '/health',
        description: 'Health check endpoint'
      },
      location_enrichment: {
        method: 'POST',
        path: '/api/enrich/location',
        description: 'Enrich a location with all available data sources',
        request_body: {
          latitude: 'number (required) - Latitude coordinate (-90 to 90)',
          longitude: 'number (required) - Longitude coordinate (-180 to 180)',
          plot_id: 'string (required if store_results is true) - Plot ID to link enrichment data',
          store_results: 'boolean (optional) - Store results in database (default: true)',
          translate: 'boolean (optional) - Translate zoning labels to English (default: false)',
          target_language: 'string (optional) - Target language for translation (default: "en")'
        },
        example_request: {
          latitude: 40.7128,
          longitude: -74.0060,
          plot_id: 'plot-uuid-123',
          store_results: true,
          translate: false,
          target_language: 'en'
        }
      },
      info: {
        method: 'GET',
        path: '/api/enrich/info',
        description: 'Get API documentation'
      }
    },
    available_enrichments: {
      global: ['amenities', 'municipalities'],
      portugal: ['crus-zoning', 'portugal-cadastre'],
      spain: ['spain-zoning', 'spain-cadastre'],
      germany: ['germany-zoning']
    },
    data_sources: {
      amenities: 'OpenStreetMap Overpass API',
      municipalities: 'Nominatim (OpenStreetMap)',
      'crus-zoning': 'Portugal DGT OGC API',
      'portugal-cadastre': 'Portugal Cadastral Services',
      'spain-zoning': 'Regional WFS Services (Autonomous Communities)',
      'spain-cadastre': 'Spanish Dirección General del Catastro',
      'germany-zoning': 'State/Länder WFS Services'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    available_endpoints: [
      'GET /health',
      'GET /api/enrich/info',
      'POST /api/enrich/location'
    ]
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║   Yonder Enrichment API Server                     ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n📚 Available endpoints:`);
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   GET  http://localhost:${PORT}/api/enrich/info`);
    console.log(`   POST http://localhost:${PORT}/api/enrich/location`);
    console.log(`\n📖 Documentation: See src/api/doc/ for details`);
    console.log(`\n✨ Ready to enrich locations!\n`);
  });
}

export default app;
