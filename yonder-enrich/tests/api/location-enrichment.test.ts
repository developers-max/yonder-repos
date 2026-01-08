import { Pool } from 'pg';
import { enrichLocation, LocationEnrichmentRequest } from '../../src/api/location-enrichment';
import * as municipalityHelpers from '../../src/api/helpers/municipality-helpers';
import * as amenitiesEnrichment from '../../src/enrichments/amenities';
import * as spanishCadastre from '../../src/enrichments/spain-cadastre/spain_cadastre_lookup';
import * as spainZoning from '../../src/enrichments/spain-zoning/spain_lookup';
import * as portugalCadastre from '../../src/enrichments/portugal-cadastre/portugal_cadastre_lookup';
import * as crusHelpers from '../../src/api/helpers/crus-helpers';
import * as germanyZoning from '../../src/enrichments/germany-zoning/germany_lookup';
import * as translateModule from '../../src/llm/translate';
import * as layersModule from '../../src/layers';

// Mock all dependencies
jest.mock('pg');
jest.mock('../../src/api/helpers/municipality-helpers');
jest.mock('../../src/enrichments/amenities');
jest.mock('../../src/enrichments/spain-cadastre/spain_cadastre_lookup');
jest.mock('../../src/enrichments/spain-zoning/spain_lookup');
jest.mock('../../src/enrichments/portugal-cadastre/portugal_cadastre_lookup');
jest.mock('../../src/api/helpers/crus-helpers');
jest.mock('../../src/enrichments/germany-zoning/germany_lookup');
jest.mock('../../src/llm/translate');
jest.mock('../../src/layers');

describe('Location Enrichment', () => {
  let mockClient: any;
  let mockPool: any;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock client
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };

    // Setup mock pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn().mockResolvedValue(undefined),
    };

    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);

    // Setup environment
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    };

    // Setup default mock responses
    (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
      name: 'Test City',
      district: 'Test District',
      country: 'PT',
    });

    (municipalityHelpers.findMunicipalityByName as jest.Mock).mockResolvedValue({
      id: 1,
      name: 'Test City',
      district: 'Test District',
      country: 'PT',
    });

    (amenitiesEnrichment.enrichPlot as jest.Mock).mockResolvedValue({
      schools: 5,
      restaurants: 10,
    });

    // Setup default mock for layers enrichment
    (layersModule.queryAllLayers as jest.Mock).mockResolvedValue({
      timestamp: new Date().toISOString(),
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
        }
      ]
    });

    // Setup default mock for Portugal zoning (combines CRUS, COS2023, parish)
    (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Basic Enrichment Flow', () => {
    it('should successfully enrich a location with basic data', async () => {
      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result).toBeDefined();
      expect(result.location).toEqual({ latitude: 38.7223, longitude: -9.1393 });
      expect(result.country).toBe('PT');
      expect(result.municipality).toBeDefined();
      expect(result.enrichments_run).toContain('municipalities');
      expect(result.enrichments_run).toContain('amenities');
      expect(result.timestamp).toBeDefined();
    });

    it('should include amenities data', async () => {
      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.amenities).toEqual({
        schools: 5,
        restaurants: 10,
      });
    });

    it('should include municipality data', async () => {
      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.municipality).toEqual({
        name: 'Test City',
        district: 'Test District',
        country: 'PT',
      });
    });
  });

  describe('Portugal Enrichments', () => {
    beforeEach(() => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });
    });

    it('should run CRUS zoning for Portugal', async () => {
      (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue({
        crus: {
          designation: 'Urbano',
          source: 'DGT CRUS',
        },
        label: 'Urbano',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(crusHelpers.getPortugalZoningData).toHaveBeenCalledWith(38.7223, -9.1393, null);
      expect(result.enrichments_run).toContain('portugal-zoning');
      expect(result.zoning).toBeDefined();
      expect(result.zoning.label).toBe('Urbano');
    });

    it('should run Portugal cadastre', async () => {
      (portugalCadastre.getPortugalCadastralInfo as jest.Mock).mockResolvedValue({
        reference: 'PT-12345',
        area: 500,
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(portugalCadastre.getPortugalCadastralInfo).toHaveBeenCalledWith(-9.1393, 38.7223);
      expect(result.enrichments_run).toContain('portugal-cadastre');
      expect(result.cadastre).toBeDefined();
    });

    it('should skip CRUS zoning if no data found', async () => {
      (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue(null);

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_skipped).toContain('portugal-zoning');
    });

    it('should mark CRUS zoning as failed on error', async () => {
      (crusHelpers.getPortugalZoningData as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_failed).toContain('portugal-zoning');
    });
  });

  describe('Spain Enrichments', () => {
    beforeEach(() => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Barcelona',
        district: 'Barcelona',
        country: 'ES',
      });
    });

    it('should run Spain zoning for Spain', async () => {
      (spainZoning.getSpanishZoningForPoint as jest.Mock).mockResolvedValue({
        label: 'Residencial',
        source: 'Catastro',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 41.3851,
        longitude: 2.1734,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(spainZoning.getSpanishZoningForPoint).toHaveBeenCalledWith(2.1734, 41.3851);
      expect(result.enrichments_run).toContain('spain-zoning');
      expect(result.zoning).toBeDefined();
    });

    it('should run Spain cadastre', async () => {
      (spanishCadastre.getSpanishCadastralInfo as jest.Mock).mockResolvedValue({
        reference: 'ES-67890',
        area: 750,
      });

      const request: LocationEnrichmentRequest = {
        latitude: 41.3851,
        longitude: 2.1734,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(spanishCadastre.getSpanishCadastralInfo).toHaveBeenCalledWith(2.1734, 41.3851);
      expect(result.enrichments_run).toContain('spain-cadastre');
      expect(result.cadastre).toBeDefined();
    });

    it('should skip Spain zoning if no data found', async () => {
      (spainZoning.getSpanishZoningForPoint as jest.Mock).mockResolvedValue(null);

      const request: LocationEnrichmentRequest = {
        latitude: 41.3851,
        longitude: 2.1734,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_skipped).toContain('spain-zoning');
    });
  });

  describe('Germany Enrichments', () => {
    beforeEach(() => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Berlin',
        district: 'Berlin',
        country: 'DE',
      });
    });

    it('should run Germany zoning for Germany', async () => {
      (germanyZoning.getGermanZoningForPoint as jest.Mock).mockResolvedValue({
        label: 'Wohngebiet',
        source: 'Berlin WFS',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 52.5200,
        longitude: 13.4050,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(germanyZoning.getGermanZoningForPoint).toHaveBeenCalledWith(13.4050, 52.5200);
      expect(result.enrichments_run).toContain('germany-zoning');
      expect(result.zoning).toBeDefined();
    });

    it('should skip Germany zoning if no data found', async () => {
      (germanyZoning.getGermanZoningForPoint as jest.Mock).mockResolvedValue(null);

      const request: LocationEnrichmentRequest = {
        latitude: 52.5200,
        longitude: 13.4050,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_skipped).toContain('germany-zoning');
    });
  });

  describe('Translation Feature', () => {
    it('should translate Portugal zoning labels when enabled', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });

      (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue({
        crus: {
          designation: 'Espaços Urbanos',
          source: 'DGT CRUS',
        },
        label: 'Espaços Urbanos',
      });

      (translateModule.translateZoningLabel as jest.Mock).mockResolvedValue({
        label_en: 'Urban Spaces',
        confidence: 0.95,
        notes: 'High confidence translation',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
        translate: true,
        target_language: 'en',
      };

      const result = await enrichLocation(request);

      expect(translateModule.translateZoningLabel).toHaveBeenCalledWith(
        'Espaços Urbanos',
        {
          sourceLangHint: 'pt',
          targetLang: 'en',
          municipality: 'Lisboa',
        }
      );

      expect(result.zoning.label).toBe('Urban Spaces');
      expect(result.zoning.label_original).toBe('Espaços Urbanos');
      expect(result.zoning.crus.translated).toBe(true);
      expect(result.zoning.crus.translation_confidence).toBe(0.95);
    });

    it('should translate Spain zoning labels when enabled', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Barcelona',
        country: 'ES',
      });

      (spainZoning.getSpanishZoningForPoint as jest.Mock).mockResolvedValue({
        label: 'Zona Residencial',
        source: 'Catastro',
      });

      (translateModule.translateZoningLabel as jest.Mock).mockResolvedValue({
        label_en: 'Residential Zone',
        confidence: 0.92,
      });

      const request: LocationEnrichmentRequest = {
        latitude: 41.3851,
        longitude: 2.1734,
        store_results: false,
        translate: true,
      };

      const result = await enrichLocation(request);

      expect(result.zoning.label).toBe('Residential Zone');
      expect(result.zoning.label_original).toBe('Zona Residencial');
    });

    it('should handle translation failures gracefully', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Lisboa',
        country: 'PT',
      });

      (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue({
        crus: {
          designation: 'Espaços Urbanos',
        },
        label: 'Espaços Urbanos',
      });

      (translateModule.translateZoningLabel as jest.Mock).mockRejectedValue(
        new Error('Translation service down')
      );

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
        translate: true,
      };

      const result = await enrichLocation(request);

      // Should still have the original zoning data
      expect(result.zoning.label).toBe('Espaços Urbanos');
      expect(result.zoning.translated).toBeUndefined();
    });

    it('should not translate when translate flag is false', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Lisboa',
        country: 'PT',
      });

      (crusHelpers.getCRUSZoningForPoint as jest.Mock).mockResolvedValue({
        label: 'Espaços Urbanos',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
        translate: false,
      };

      await enrichLocation(request);

      expect(translateModule.translateZoningLabel).not.toHaveBeenCalled();
    });
  });

  describe('Database Storage', () => {
    it('should store results when store_results is true and plot_id is provided', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Test City',
        country: 'PT',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        plot_id: 'test-plot-123',
        store_results: true,
      };

      await enrichLocation(request);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO enriched_plots_stage'),
        expect.arrayContaining(['test-plot-123'])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should not store results when store_results is false', async () => {
      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      await enrichLocation(request);

      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should throw error when store_results is true but plot_id is missing', async () => {
      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: true,
        // plot_id missing
      };

      await expect(enrichLocation(request)).rejects.toThrow(
        'plot_id is required when store_results is true'
      );
    });

    it('should handle database storage errors gracefully', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Test City',
        country: 'PT',
      });
      
      // Mock the query to fail on INSERT but succeed on other queries
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO enriched_plots_stage')) {
          throw new Error('Storage failed');
        }
        return { rows: [] };
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        plot_id: 'test-plot-456',
        store_results: true,
      };

      const result = await enrichLocation(request);

      // Should still return enrichment data even if DB storage fails
      expect(result).toBeDefined();
      expect(result.amenities).toBeDefined();
      expect(result.municipality).toBeDefined();
    });

    it('should include municipality_id when available', async () => {
      (municipalityHelpers.findMunicipalityByName as jest.Mock).mockResolvedValue({
        id: 42,
        name: 'Test City',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        plot_id: 'test-plot-789',
        store_results: true,
      };

      await enrichLocation(request);

      const insertCall = mockClient.query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO enriched_plots_stage')
      );

      expect(insertCall).toBeDefined();
      expect(insertCall[1]).toContain(42); // municipality_id
    });

    it('should release client connection even on errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Query failed'));

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        plot_id: 'test-plot-error',
        store_results: true,
      };

      await enrichLocation(request);

      expect(mockClient.release).toHaveBeenCalled();
      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle municipality enrichment failure', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue(null);

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_failed).toContain('municipalities');
      expect(result.municipality).toBeUndefined();
    });

    it('should handle amenities enrichment failure', async () => {
      (amenitiesEnrichment.enrichPlot as jest.Mock).mockRejectedValue(
        new Error('Amenities service down')
      );

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_failed).toContain('amenities');
    });

    it('should continue processing after individual enrichment failures', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Lisboa',
        country: 'PT',
      });

      (crusHelpers.getPortugalZoningData as jest.Mock).mockRejectedValue(
        new Error('Portugal zoning service down')
      );

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      // Should still have amenities even though CRUS failed
      expect(result.enrichments_run).toContain('amenities');
      expect(result.enrichments_failed).toContain('portugal-zoning');
    });

    it('should return error in response on unhandled exceptions', async () => {
      // Mock Pool constructor to throw an error during initialization
      (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => {
        throw new Error('Catastrophic failure');
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        plot_id: 'test-plot-exception',
        store_results: true, // This will trigger Pool initialization
      };

      const result = await enrichLocation(request);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Catastrophic failure');
      
      // Restore the mock
      (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);
    });
  });

  describe('Enrichment Data Merging', () => {
    it('should merge all enrichment data into enrichment_data field', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Lisboa',
        country: 'PT',
      });

      (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue({
        crus: {
          designation: 'Urbano',
        },
        label: 'Urbano',
      });

      (portugalCadastre.getPortugalCadastralInfo as jest.Mock).mockResolvedValue({
        reference: 'PT-12345',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichment_data).toBeDefined();
      expect(result.enrichment_data.amenities).toBeDefined();
      expect(result.enrichment_data.zoning).toBeDefined();
      expect(result.enrichment_data.cadastral).toBeDefined();
    });

    it('should preserve existing enrichment data when merging', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Lisboa',
        country: 'PT',
      });

      (crusHelpers.getPortugalZoningData as jest.Mock).mockResolvedValue({
        crus: {
          designation: 'Urbano',
        },
        label: 'Urbano',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 38.7223,
        longitude: -9.1393,
        store_results: false,
      };

      const result = await enrichLocation(request);

      // Both amenities and zoning should be present
      expect(result.enrichment_data.amenities).toBeDefined();
      expect(result.enrichment_data.zoning).toBeDefined();
    });
  });

  describe('Unknown Country Handling', () => {
    it('should skip country-specific enrichments for unknown countries', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Unknown City',
        country: 'US',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 40.7128,
        longitude: -74.0060,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_skipped).toContain('portugal-cadastre');
      expect(result.enrichments_skipped).toContain('spain-cadastre');
      expect(result.enrichments_skipped).toContain('spain-zoning');
      expect(result.enrichments_skipped).toContain('crus-zoning');
      expect(result.enrichments_skipped).toContain('germany-zoning');
    });

    it('should still run global enrichments for unknown countries', async () => {
      (municipalityHelpers.getMunicipalityFromCoordinates as jest.Mock).mockResolvedValue({
        name: 'Unknown City',
        country: 'US',
      });

      const request: LocationEnrichmentRequest = {
        latitude: 40.7128,
        longitude: -74.0060,
        store_results: false,
      };

      const result = await enrichLocation(request);

      expect(result.enrichments_run).toContain('amenities');
      expect(result.enrichments_run).toContain('municipalities');
    });
  });
});
