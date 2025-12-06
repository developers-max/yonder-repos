import axios from 'axios';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

// Create mock axios instance before importing module
const mockAxiosInstance = {
  get: jest.fn(),
};

// Mock dependencies
jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));
jest.mock('@turf/boolean-point-in-polygon');

// Import after mocks are set up
import { getCRUSZoningForPoint } from '../../../src/api/helpers/crus-helpers';

const mockedPointInPolygon = booleanPointInPolygon as jest.MockedFunction<typeof booleanPointInPolygon>;

describe('CRUS Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCRUSZoningForPoint', () => {
    it('should return zoning data for valid coordinates', async () => {
      // Mock município lookup
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[[-9.2, 38.7], [-9.1, 38.7], [-9.1, 38.8], [-9.2, 38.8], [-9.2, 38.7]]],
                },
                properties: {
                  NOME: 'Lisboa',
                },
              },
            ],
          },
        })
        // Mock collections list
        .mockResolvedValueOnce({
          data: {
            collections: [
              { id: 'crus_uso_solo', title: 'CRUS Uso do Solo' },
              { id: 'other_collection', title: 'Other' },
            ],
          },
        })
        // Mock zoning data
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[[-9.2, 38.7], [-9.1, 38.7], [-9.1, 38.8], [-9.2, 38.8], [-9.2, 38.7]]],
                },
                properties: {
                  uso: 'Espaços Urbanos',
                  classification: 'Residencial',
                },
              },
            ],
          },
        });

      mockedPointInPolygon.mockReturnValue(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeDefined();
      expect(result?.label).toBe('Espaços Urbanos');
      expect(result?.picked_field).toBe('uso');
      expect(result?.source).toBe('DGT CRUS');
      expect(result?.typename).toBe('crus_uso_solo');
      expect(result?.srs).toBe('EPSG:4326');
    });

    it('should return null if no município found', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should return null if no zoning collections found', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: { NOME: 'Lisboa' },
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [
              { id: 'other_collection', title: 'Other' },
            ],
          },
        });

      mockedPointInPolygon.mockReturnValue(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should try multiple collections until finding data', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [
              { id: 'crus_collection1', title: 'CRUS 1' },
              { id: 'zoning_collection2', title: 'Zoning 2' },
            ],
          },
        })
        // First collection returns empty
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        })
        // Second collection has data
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: { zoning: 'Industrial' },
              },
            ],
          },
        });

      mockedPointInPolygon.mockReturnValueOnce(true).mockReturnValueOnce(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeDefined();
      expect(result?.label).toBe('Industrial');
      expect(result?.typename).toBe('zoning_collection2');
    });

    it('should handle point not in polygon', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [{ id: 'crus_uso', title: 'CRUS' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: { uso: 'Urbano' },
              },
            ],
          },
        });

      mockedPointInPolygon.mockReturnValue(false);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should try different property fields for zoning label', async () => {
      const testCases = [
        { properties: { uso: 'Test1' }, expected: 'Test1', field: 'uso' },
        { properties: { zoning: 'Test2' }, expected: 'Test2', field: 'zoning' },
        { properties: { classification: 'Test3' }, expected: 'Test3', field: 'classification' },
        { properties: { class: 'Test4' }, expected: 'Test4', field: 'class' },
        { properties: { tipo: 'Test5' }, expected: 'Test5', field: 'tipo' },
        { properties: { type: 'Test6' }, expected: 'Test6', field: 'type' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        mockAxiosInstance.get
          .mockResolvedValueOnce({
            data: {
              type: 'FeatureCollection',
              features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
            },
          })
          .mockResolvedValueOnce({
            data: {
              collections: [{ id: 'crus_test', title: 'CRUS Test' }],
            },
          })
          .mockResolvedValueOnce({
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  id: 1,
                  properties: testCase.properties,
                },
              ],
            },
          });

        mockedPointInPolygon.mockReturnValue(true);

        const result = await getCRUSZoningForPoint(38.7223, -9.1393);

        expect(result?.label).toBe(testCase.expected);
        expect(result?.picked_field).toBe(testCase.field);
      }
    });

    it('should skip features without zoning labels', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [{ id: 'crus_test', title: 'CRUS Test' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: { other_field: 'value' }, // No zoning-related fields
              },
            ],
          },
        });

      mockedPointInPolygon.mockReturnValue(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should handle polygon check errors', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [{ id: 'crus_test', title: 'CRUS Test' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: { uso: 'Urbano' },
              },
            ],
          },
        });

      mockedPointInPolygon.mockImplementation(() => {
        throw new Error('Invalid geometry');
      });

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should include sample properties in response', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [{ id: 'crus_test', title: 'CRUS Test' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: {
                  uso: 'Urbano',
                  area: 1000,
                  code: 'URB001',
                },
              },
            ],
          },
        });

      mockedPointInPolygon.mockReturnValue(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result?.sample_properties).toEqual({
        uso: 'Urbano',
        area: 1000,
        code: 'URB001',
      });
    });

    it('should include feature count in response', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [{ id: 'crus_test', title: 'CRUS Test' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              { id: 1, properties: { uso: 'Urbano' } },
              { id: 2, properties: { uso: 'Rural' } },
              { id: 3, properties: { uso: 'Industrial' } },
            ],
          },
        });

      mockedPointInPolygon.mockReturnValueOnce(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result?.feature_count).toBe(3);
    });

    it('should identify collections by keywords', async () => {
      const keywords = ['crus', 'zoning', 'uso'];

      for (const keyword of keywords) {
        jest.clearAllMocks();

        mockAxiosInstance.get
          .mockResolvedValueOnce({
            data: {
              type: 'FeatureCollection',
              features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
            },
          })
          .mockResolvedValueOnce({
            data: {
              collections: [
                { id: `${keyword}_collection`, title: `${keyword} Collection` },
              ],
            },
          })
          .mockResolvedValueOnce({
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  id: 1,
                  properties: { uso: 'Test' },
                },
              ],
            },
          });

        mockedPointInPolygon.mockReturnValue(true);

        const result = await getCRUSZoningForPoint(38.7223, -9.1393);

        expect(result).toBeDefined();
        expect(result?.typename).toContain(keyword);
      }
    });

    it('should use different municipality property names', async () => {
      const municipalityProps = [
        { municipio: 'Lisboa' },
        { MUNICIPIO: 'Lisboa' },
        { NOME: 'Lisboa' },
        { nome: 'Lisboa' },
      ];

      for (const props of municipalityProps) {
        jest.clearAllMocks();

        mockAxiosInstance.get
          .mockResolvedValueOnce({
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  id: 1,
                  properties: props,
                },
              ],
            },
          })
          .mockResolvedValueOnce({
            data: {
              collections: [{ id: 'crus_test', title: 'CRUS Test' }],
            },
          })
          .mockResolvedValueOnce({
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  id: 1,
                  properties: { uso: 'Test' },
                },
              ],
            },
          });

        mockedPointInPolygon.mockReturnValue(true);

        const result = await getCRUSZoningForPoint(38.7223, -9.1393);

        expect(result).toBeDefined();
      }
    });

    it('should handle empty município name', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          type: 'FeatureCollection',
          features: [
            {
              id: 1,
              properties: { NOME: '' },
            },
          ],
        },
      });

      mockedPointInPolygon.mockReturnValue(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should handle município lookup with multiple features', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: { NOME: 'Lisboa' },
              },
              {
                id: 2,
                properties: { NOME: 'Sintra' },
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [{ id: 'crus_test', title: 'CRUS Test' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 1,
                properties: { uso: 'Urbano' },
              },
            ],
          },
        });

      // Point is in the first municipality
      mockedPointInPolygon.mockReturnValueOnce(true).mockReturnValue(true);

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeDefined();
      expect(result?.label).toBe('Urbano');
    });

    it('should construct correct bbox around point', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [{ id: 1, properties: { NOME: 'Lisboa' } }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            collections: [{ id: 'crus_test', title: 'CRUS Test' }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

      await getCRUSZoningForPoint(38.7223, -9.1393);

      // Check that bbox parameters are included in the request
      const zoneCall = mockAxiosInstance.get.mock.calls[2][0];
      expect(zoneCall).toContain('bbox=');
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle malformed GeoJSON', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            // Missing 'type' field
            features: null,
          },
        });

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should handle network timeouts', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await getCRUSZoningForPoint(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should handle coordinates at Portugal boundaries', async () => {
      // Test various boundary coordinates
      const boundaryCoords = [
        [42.1543, -8.1834], // North
        [36.9617, -7.9892], // South
        [41.8626, -6.1890], // East
        [39.4679, -9.5006], // West
      ];

      for (const [lat, lon] of boundaryCoords) {
        jest.clearAllMocks();

        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        const result = await getCRUSZoningForPoint(lat, lon);

        // Should handle gracefully
        expect(result).toBeNull();
      }
    });
  });
});
