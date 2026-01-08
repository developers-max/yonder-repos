import { enrichLocation, LocationEnrichmentRequest } from '../../src/api/location-enrichment';
import * as municipalityHelpers from '../../src/api/helpers/municipality-helpers';
import * as amenitiesEnrichment from '../../src/enrichments/amenities';
import * as layersModule from '../../src/layers';
import * as spanishCadastre from '../../src/enrichments/spain-cadastre/spain_cadastre_lookup';
import * as spainZoning from '../../src/enrichments/spain-zoning/spain_lookup';
import * as portugalCadastre from '../../src/enrichments/portugal-cadastre/portugal_cadastre_lookup';
import * as crusHelpers from '../../src/api/helpers/crus-helpers';

// Mock dependencies
jest.mock('../../src/api/helpers/municipality-helpers');
jest.mock('../../src/enrichments/amenities');
jest.mock('../../src/layers');
jest.mock('../../src/enrichments/spain-cadastre/spain_cadastre_lookup');
jest.mock('../../src/enrichments/spain-zoning/spain_lookup');
jest.mock('../../src/enrichments/portugal-cadastre/portugal_cadastre_lookup');
jest.mock('../../src/api/helpers/crus-helpers');

describe('Layers Enrichment Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock municipality detection
    (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
      name: 'Lisboa',
      district: 'Lisboa',
      country: 'PT',
    });

    // Mock amenities
    (amenitiesEnrichment.enrichPlot as jest.Mock).mockResolvedValue({
      schools: 5,
      restaurants: 10,
    });

    // Mock Spain enrichments (return null to skip)
    (spanishCadastre.getSpanishCadastralInfo as jest.Mock).mockResolvedValue(null);
    (spainZoning.getSpanishZoningForPoint as jest.Mock).mockResolvedValue(null);

    // Mock Portugal enrichments (return null to skip)
    (portugalCadastre.getPortugalCadastralInfo as jest.Mock).mockResolvedValue(null);
    (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue(null);
  });

  describe('Portugal Layers', () => {
    it('should run layers enrichment for Portugal', async () => {
      (layersModule.queryAllLayers as jest.Mock).mockResolvedValue({
        timestamp: '2025-01-08T06:00:00.000Z',
        coordinates: { lat: 38.7223, lng: -9.1393 },
        country: 'PT',
        layers: [
          {
            layerId: 'pt-distrito',
            layerName: 'Distrito',
            found: true,
            data: { distrito: 'Lisboa' }
          },
          {
            layerId: 'pt-municipio',
            layerName: 'Município',
            found: true,
            data: { municipio: 'Lisboa' }
          },
          {
            layerId: 'pt-cadastro',
            layerName: 'Cadastro',
            found: true,
            data: { reference: 'PT-12345', areaM2: 500 }
          },
          {
            layerId: 'pt-crus',
            layerName: 'CRUS Zoning',
            found: true,
            data: { label: 'Urbano' }
          }
        ]
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      // Verify layers enrichment was called
      expect(layersModule.queryAllLayers).toHaveBeenCalledWith({
        lat: 38.7223,
        lng: -9.1393,
        country: 'PT',
      });

      // Verify layers enrichment was run
      expect(result.enrichments_run).toContain('layers');
      
      // Verify layers data is present
      expect(result.layers).toBeDefined();
      expect(result.layers.layersByCategory).toBeDefined();
      expect(result.layers.layersRaw).toBeDefined();
      
      // Verify enrichment data includes layers
      expect(result.enrichment_data.layers).toBeDefined();
    });

    it('should categorize layers correctly', async () => {
      (layersModule.queryAllLayers as jest.Mock).mockResolvedValue({
        timestamp: '2025-01-08T06:00:00.000Z',
        coordinates: { lat: 38.7223, lng: -9.1393 },
        country: 'PT',
        layers: [
          {
            layerId: 'pt-distrito',
            layerName: 'Distrito',
            found: true,
            data: { distrito: 'Lisboa' }
          },
          {
            layerId: 'pt-cadastro',
            layerName: 'Cadastro',
            found: true,
            data: { reference: 'PT-12345' }
          },
          {
            layerId: 'pt-crus',
            layerName: 'CRUS Zoning',
            found: true,
            data: { label: 'Urbano' }
          },
          {
            layerId: 'elevation',
            layerName: 'Elevation',
            found: true,
            data: { elevationM: 100 }
          }
        ]
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      // Verify categorization
      expect(result.layers.layersByCategory.administrative).toBeDefined();
      expect(result.layers.layersByCategory.cadastre).toBeDefined();
      expect(result.layers.layersByCategory.zoning).toBeDefined();
      expect(result.layers.layersByCategory.elevation).toBeDefined();
    });
  });

  describe('Spain Layers', () => {
    it('should run layers enrichment for Spain', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Barcelona',
        district: 'Barcelona',
        country: 'ES',
      });

      (layersModule.queryAllLayers as jest.Mock).mockResolvedValue({
        timestamp: '2025-01-08T06:00:00.000Z',
        coordinates: { lat: 41.3851, lng: 2.1734 },
        country: 'ES',
        layers: [
          {
            layerId: 'es-cadastro',
            layerName: 'Catastro',
            found: true,
            data: { reference: 'ES-67890' }
          },
          {
            layerId: 'elevation',
            layerName: 'Elevation',
            found: true,
            data: { elevationM: 12 }
          }
        ]
      });

      const request: LocationEnrichmentRequest = {
        latitude: 41.3851,
        longitude: 2.1734,
        store_results: false,
      };

      const result = await enrichLocation(request);

      // Verify layers enrichment was called for Spain
      expect(layersModule.queryAllLayers).toHaveBeenCalledWith({
        lat: 41.3851,
        lng: 2.1734,
        country: 'ES',
      });

      expect(result.enrichments_run).toContain('layers');
      expect(result.layers).toBeDefined();
    });
  });

  describe('Non-PT/ES Countries', () => {
    it('should skip layers enrichment for other countries', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Berlin',
        country: 'DE',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 52.5200,
        longitude: 13.4050,
        store_results: false,
      };

      const result = await enrichLocation(request);

      // Verify layers enrichment was skipped
      expect(result.enrichments_skipped).toContain('layers');
      expect(layersModule.queryAllLayers).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle layers enrichment failure gracefully', async () => {
      (layersModule.queryAllLayers as jest.Mock).mockRejectedValue(
        new Error('Layers service unavailable')
      );

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      // Should still have other enrichments
      expect(result.enrichments_run).toContain('amenities');
      expect(result.enrichments_failed).toContain('layers');
      expect(result.amenities).toBeDefined();
    });
  });
});
