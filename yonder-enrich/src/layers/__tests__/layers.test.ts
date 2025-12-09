/**
 * Unit and Integration Tests for Layer Query Service
 */

import { 
  queryAllLayers,
  queryPortugueseCadastre,
  queryCRUSZoning,
  queryElevation,
  queryDistrict,
  queryMunicipality,
  queryParish,
  queryNUTS3,
  queryCOS,
  queryCLC,
  queryBuiltUpAreas,
  LayerQueryOptions,
  LayerResult,
} from '../index';

// Test coordinates - Lisbon area
const LISBON_COORDS = { lat: 38.7223, lng: -9.1393 };
// Test coordinates - Porto area  
const PORTO_COORDS = { lat: 41.1579, lng: -8.6291 };
// Test coordinates - rural Portugal (Alentejo)
const ALENTEJO_COORDS = { lat: 38.0167, lng: -7.8633 };

// Increase timeout for external API calls
jest.setTimeout(30000);

describe('Layer Query Service', () => {
  describe('Unit Tests - Type Validation', () => {
    it('should export all required types', () => {
      expect(typeof queryAllLayers).toBe('function');
      expect(typeof queryPortugueseCadastre).toBe('function');
      expect(typeof queryCRUSZoning).toBe('function');
      expect(typeof queryElevation).toBe('function');
    });

    it('should validate LayerQueryOptions structure', () => {
      const options: LayerQueryOptions = {
        lat: 38.7,
        lng: -9.1,
        country: 'PT',
      };
      
      expect(options.lat).toBeDefined();
      expect(options.lng).toBeDefined();
      expect(options.country).toBe('PT');
    });

    it('should accept optional areaM2 parameter', () => {
      const options: LayerQueryOptions = {
        lat: 38.7,
        lng: -9.1,
        country: 'PT',
        areaM2: 1000,
      };
      
      expect(options.areaM2).toBe(1000);
    });
  });

  describe('Integration Tests - Administrative Layers', () => {
    it('should query district for Lisbon coordinates', async () => {
      const result = await queryDistrict(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-distrito');
      expect(result.layerName).toBe('Distrito');
      // May or may not find data depending on service availability
      expect(typeof result.found).toBe('boolean');
    });

    it('should query municipality for Lisbon coordinates', async () => {
      const result = await queryMunicipality(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-municipio');
      expect(result.layerName).toBe('Município (CAOP)');
      
      if (result.found && result.data) {
        expect(result.data.municipio).toBeDefined();
      }
    });

    it('should query parish for Lisbon coordinates', async () => {
      const result = await queryParish(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-freguesia');
      expect(result.layerName).toBe('Freguesia');
    });

    it('should query NUTS3 for Lisbon coordinates', async () => {
      const result = await queryNUTS3(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-nuts3');
      expect(result.layerName).toBe('NUTS III');
    });
  });

  describe('Integration Tests - Cadastre', () => {
    it('should query Portuguese cadastre', async () => {
      const result = await queryPortugueseCadastre(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-cadastro');
      expect(result.layerName).toBe('Cadastro Predial');
      expect(typeof result.found).toBe('boolean');
    });

    it('should include geometry data when cadastre found', async () => {
      const result = await queryPortugueseCadastre(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      if (result.found && result.data) {
        // Check for expected cadastral data fields
        const data = result.data as Record<string, unknown>;
        expect(['parcelReference', 'label', 'areaM2', 'geometry'].some(
          key => data[key] !== undefined
        )).toBe(true);
      }
    });
  });

  describe('Integration Tests - Land Use', () => {
    it('should query COS (land cover)', async () => {
      const result = await queryCOS(ALENTEJO_COORDS.lat, ALENTEJO_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-cos');
      expect(result.layerName).toBe('Carta de Ocupação do Solo (COS)');
    });

    it('should query CLC (CORINE Land Cover)', async () => {
      const result = await queryCLC(ALENTEJO_COORDS.lat, ALENTEJO_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-clc');
      expect(result.layerName).toBe('CORINE Land Cover (CLC)');
    });

    it('should query built-up areas', async () => {
      const result = await queryBuiltUpAreas(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-built-up');
      expect(result.layerName).toBe('Built-up Areas');
    });
  });

  describe('Integration Tests - Elevation', () => {
    it('should query elevation for coordinates', async () => {
      const result = await queryElevation(LISBON_COORDS.lat, LISBON_COORDS.lng);
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('elevation');
      expect(result.layerName).toBe('Elevation');
      
      if (result.found && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(typeof data.elevationM).toBe('number');
        expect(data.source).toBe('SRTM/Open-Elevation');
      }
    });
  });

  describe('Integration Tests - Full Query', () => {
    it('should query all Portugal layers', async () => {
      const options: LayerQueryOptions = {
        lat: PORTO_COORDS.lat,
        lng: PORTO_COORDS.lng,
        country: 'PT',
      };
      
      const result = await queryAllLayers(options);
      
      expect(result).toBeDefined();
      expect(result.coordinates).toEqual({ lat: options.lat, lng: options.lng });
      expect(result.country).toBe('PT');
      expect(result.timestamp).toBeDefined();
      expect(Array.isArray(result.layers)).toBe(true);
      expect(result.layers.length).toBeGreaterThan(0);
      
      // Check that we have various layer types
      const layerIds = result.layers.map(l => l.layerId);
      expect(layerIds).toContain('pt-municipio');
      expect(layerIds).toContain('pt-cadastro');
      expect(layerIds).toContain('elevation');
    });

    it('should include bounding box when area is provided', async () => {
      const options: LayerQueryOptions = {
        lat: LISBON_COORDS.lat,
        lng: LISBON_COORDS.lng,
        country: 'PT',
        areaM2: 5000,
      };
      
      const result = await queryAllLayers(options);
      
      expect(result.areaM2).toBe(5000);
      expect(result.boundingBox).toBeDefined();
      if (result.boundingBox) {
        expect(result.boundingBox.minLng).toBeLessThan(result.boundingBox.maxLng);
        expect(result.boundingBox.minLat).toBeLessThan(result.boundingBox.maxLat);
      }
    });

    it('should query Spain layers', async () => {
      const options: LayerQueryOptions = {
        lat: 40.4168, // Madrid
        lng: -3.7038,
        country: 'ES',
      };
      
      const result = await queryAllLayers(options);
      
      expect(result).toBeDefined();
      expect(result.country).toBe('ES');
      expect(Array.isArray(result.layers)).toBe(true);
      
      // Spain should have cadastre and elevation
      const layerIds = result.layers.map(l => l.layerId);
      expect(layerIds).toContain('es-cadastro');
      expect(layerIds).toContain('elevation');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid coordinates gracefully', async () => {
      // Ocean coordinates - no land data expected
      const result = await queryMunicipality(0, 0);
      
      expect(result).toBeDefined();
      expect(result.found).toBe(false);
    });

    it('should return error message on service failure', async () => {
      // This tests the error structure - actual behavior depends on service
      const result = await queryDistrict(90, 180); // Edge coordinates
      
      expect(result).toBeDefined();
      expect(result.layerId).toBe('pt-distrito');
      // Should either find data or have an error/not found
      expect(typeof result.found).toBe('boolean');
    });
  });
});

describe('LayerResult Structure', () => {
  it('should have correct structure when found', async () => {
    const result = await queryElevation(LISBON_COORDS.lat, LISBON_COORDS.lng);
    
    // Check LayerResult interface
    expect(result).toHaveProperty('layerId');
    expect(result).toHaveProperty('layerName');
    expect(result).toHaveProperty('found');
    
    if (result.found) {
      expect(result).toHaveProperty('data');
      expect(result.error).toBeUndefined();
    }
  });

  it('should have correct structure when not found', async () => {
    // Query somewhere likely to have no data
    const result = await queryBuiltUpAreas(0, 0);
    
    expect(result).toHaveProperty('layerId');
    expect(result).toHaveProperty('layerName');
    expect(result).toHaveProperty('found');
    
    if (!result.found) {
      // Either no data or has an error message
      expect(result.data === undefined || result.error !== undefined).toBe(true);
    }
  });
});
