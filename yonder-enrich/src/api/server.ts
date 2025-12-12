import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { enrichLocation, LocationEnrichmentRequest, LocationEnrichmentResponse } from './location-enrichment';
import { queryAllLayers, LayerQueryOptions } from '../layers';

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

// Layer query endpoint - query geographic layers for a point or polygon
app.get('/api/layers', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const country = ((req.query.country as string) || 'PT').toUpperCase() as 'PT' | 'ES';
    const areaParam = req.query.area as string;
    const areaM2 = areaParam ? parseFloat(areaParam) : undefined;

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Provide lat and lng as numbers',
        example: '/api/layers?lat=38.7&lng=-9.1&country=PT'
      });
    }

    // Validate country
    if (country !== 'PT' && country !== 'ES') {
      return res.status(400).json({
        error: 'Invalid country',
        message: 'Use PT (Portugal) or ES (Spain)'
      });
    }

    // Validate area if provided
    if (areaM2 !== undefined && (isNaN(areaM2) || areaM2 <= 0)) {
      return res.status(400).json({
        error: 'Invalid area',
        message: 'Provide a positive number in square meters'
      });
    }

    console.log(`\n=== Layer Query ===`);
    console.log(`Coordinates: ${lat}, ${lng}`);
    console.log(`Country: ${country}`);
    if (areaM2) console.log(`Area: ${areaM2} m²`);

    const options: LayerQueryOptions = { lat, lng, country, areaM2 };
    const result = await queryAllLayers(options);

    console.log(`Found ${result.layers.filter(l => l.found).length}/${result.layers.length} layers`);

    res.json(result);

  } catch (error: any) {
    console.error('Error processing layer query:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Layer query endpoint - POST for polygon-based queries
app.post('/api/layers', async (req: Request, res: Response) => {
  try {
    const { lat, lng, country = 'PT', areaM2, polygon } = req.body;

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'lat and lng must be numbers',
        example: { lat: 38.7, lng: -9.1, country: 'PT' }
      });
    }

    // Validate country
    const countryCode = country.toUpperCase() as 'PT' | 'ES';
    if (countryCode !== 'PT' && countryCode !== 'ES') {
      return res.status(400).json({
        error: 'Invalid country',
        message: 'Use PT (Portugal) or ES (Spain)'
      });
    }

    console.log(`\n=== Layer Query (POST) ===`);
    console.log(`Coordinates: ${lat}, ${lng}`);
    console.log(`Country: ${countryCode}`);
    if (areaM2) console.log(`Area: ${areaM2} m²`);
    if (polygon) console.log(`Polygon vertices: ${polygon.coordinates?.[0]?.length || 0}`);

    const options: LayerQueryOptions = { 
      lat, 
      lng, 
      country: countryCode, 
      areaM2,
      polygon 
    };
    const result = await queryAllLayers(options);

    console.log(`Found ${result.layers.filter(l => l.found).length}/${result.layers.length} layers`);

    res.json(result);

  } catch (error: any) {
    console.error('Error processing layer query:', error);
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
      global: ['amenities', 'elevation'],
      portugal: ['administrative', 'cadastre', 'crus-zoning', 'ren', 'ran', 'land-use'],
      spain: ['cadastre']
    },
    layers: {
      portugal: {
        administrative: ['pt-distrito', 'pt-municipio', 'pt-freguesia', 'pt-nuts3'],
        cadastre: ['pt-cadastro'],
        zoning: ['pt-crus', 'pt-ren', 'pt-ran'],
        landUse: ['pt-cos', 'pt-clc', 'pt-built-up'],
        elevation: ['elevation']
      },
      spain: {
        cadastre: ['es-cadastro'],
        elevation: ['elevation']
      }
    },
    data_sources: {
      amenities: 'OpenStreetMap Overpass API',
      administrative: 'DGT OGC API (distritos, municipios, freguesias, nuts3)',
      'pt-cadastro': 'DGT OGC API (cadastro collection)',
      'crus-zoning': 'DGT OGC API (crus_<municipio> collections)',
      'ren': 'Municipal ArcGIS REST / DGT SRUP WFS (gmgml:REN_Nacional)',
      'ran': 'Municipal ArcGIS REST / DGT SRUP WFS (gmgml:RAN)',
      'land-use': 'DGT WMS (COS2018, CLC2012, areas_edificadas)',
      elevation: 'Open-Elevation API',
      'es-cadastro': 'Spanish Dirección General del Catastro'
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
      'POST /api/enrich/location',
      'GET /api/layers?lat={lat}&lng={lng}&country={PT|ES}',
      'POST /api/layers'
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
    console.log(`   GET  http://localhost:${PORT}/api/layers?lat=38.7&lng=-9.1&country=PT`);
    console.log(`   POST http://localhost:${PORT}/api/layers`);
    console.log(`\n📖 Documentation: See src/api/doc/ for details`);
    console.log(`\n✨ Ready to enrich locations!\n`);
  });
}

export default app;
