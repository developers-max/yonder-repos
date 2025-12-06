import axios from 'axios';
import {
  getMunicipalityFromCoordinates,
  findMunicipalityByName,
  insertMunicipality,
  MunicipalityData,
  Municipality,
} from '../../../src/api/helpers/municipality-helpers';
import * as coordinatesModule from '../../../src/enrichments/amenities/coordinates';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/enrichments/amenities/coordinates');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Municipality Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (coordinatesModule.isValidCoordinate as jest.Mock).mockReturnValue(true);
  });

  describe('getMunicipalityFromCoordinates', () => {
    it('should successfully get municipality data from valid coordinates', async () => {
      const mockResponse = {
        data: {
          display_name: 'Lisboa, Portugal',
          address: {
            city: 'Lisboa',
            state: 'Lisboa',
            country: 'Portugal',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result).toEqual({
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });
    });

    it('should use town when city is not available', async () => {
      const mockResponse = {
        data: {
          display_name: 'Sintra, Portugal',
          address: {
            town: 'Sintra',
            state: 'Lisboa',
            country: 'Portugal',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.8029, -9.3817);

      expect(result?.name).toBe('Sintra');
    });

    it('should use village when city and town are not available', async () => {
      const mockResponse = {
        data: {
          display_name: 'Small Village, Portugal',
          address: {
            village: 'Small Village',
            county: 'Test County',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result?.name).toBe('Small Village');
    });

    it('should use municipality field when available', async () => {
      const mockResponse = {
        data: {
          display_name: 'Test, Portugal',
          address: {
            municipality: 'Test Municipality',
            state: 'Test State',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result?.name).toBe('Test Municipality');
    });

    it('should use county as fallback', async () => {
      const mockResponse = {
        data: {
          display_name: 'Test, Portugal',
          address: {
            county: 'Test County',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result?.name).toBe('Test County');
    });

    it('should extract district from state field', async () => {
      const mockResponse = {
        data: {
          display_name: 'Lisboa, Portugal',
          address: {
            city: 'Lisboa',
            state: 'Lisboa District',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result?.district).toBe('Lisboa District');
    });

    it('should extract district from county when state is not available', async () => {
      const mockResponse = {
        data: {
          display_name: 'Test, Portugal',
          address: {
            city: 'Test City',
            county: 'Test County',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result?.district).toBe('Test County');
    });

    it('should convert country code to uppercase ISO-2 format', async () => {
      const mockResponse = {
        data: {
          display_name: 'Barcelona, Spain',
          address: {
            city: 'Barcelona',
            country_code: 'es',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(41.3851, 2.1734);

      expect(result?.country).toBe('ES');
    });

    it('should return null for invalid coordinates', async () => {
      (coordinatesModule.isValidCoordinate as jest.Mock).mockReturnValue(false);

      const result = await getMunicipalityFromCoordinates(999, 999);

      expect(result).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should return null when no address data is available', async () => {
      const mockResponse = {
        data: {},
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should return null when no municipality name can be extracted', async () => {
      const mockResponse = {
        data: {
          address: {
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result).toBeNull();
    });

    it('should retry on transient failures', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          data: {
            address: {
              city: 'Lisboa',
              country_code: 'pt',
            },
          },
        });

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Lisboa');
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('should include User-Agent header in request', async () => {
      const mockResponse = {
        data: {
          address: {
            city: 'Lisboa',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'YonderEnrich/1.0.0',
          }),
        })
      );
    });

    it('should use correct Nominatim endpoint and parameters', async () => {
      const mockResponse = {
        data: {
          address: {
            city: 'Lisboa',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://nominatim.openstreetmap.org/reverse',
        expect.objectContaining({
          params: {
            format: 'json',
            lat: 38.7223,
            lon: -9.1393,
            addressdetails: 1,
            zoom: 10,
          },
        })
      );
    });

    it('should have appropriate timeout', async () => {
      const mockResponse = {
        data: {
          address: {
            city: 'Lisboa',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });
  });

  describe('findMunicipalityByName', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
      };
    });

    it('should find municipality by exact name match', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Lisboa', district: 'Lisboa', country: 'PT' }],
      });

      const result = await findMunicipalityByName(mockClient, 'Lisboa');

      expect(result).toEqual({
        id: 1,
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT id, name, district, country FROM municipalities WHERE name = $1 LIMIT 1',
        ['Lisboa']
      );
    });

    it('should fallback to case-insensitive search if exact match not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // First query returns nothing
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Lisboa', district: 'Lisboa', country: 'PT' }],
        });

      const result = await findMunicipalityByName(mockClient, 'lisboa');

      expect(result).toEqual({
        id: 1,
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });

      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        'SELECT id, name, district, country FROM municipalities WHERE name ILIKE $1 LIMIT 1',
        ['lisboa']
      );
    });

    it('should return null if no match found', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await findMunicipalityByName(mockClient, 'NonExistent');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await findMunicipalityByName(mockClient, 'Lisboa');

      expect(result).toBeNull();
    });

    it('should handle empty result rows', async () => {
      mockClient.query.mockResolvedValue({ rows: undefined });

      const result = await findMunicipalityByName(mockClient, 'Lisboa');

      expect(result).toBeNull();
    });
  });

  describe('insertMunicipality', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
      };
    });

    it('should insert new municipality successfully', async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: 'Lisboa',
            district: 'Lisboa',
            country: 'PT',
          },
        ],
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await insertMunicipality(mockClient, 'Lisboa', 'Lisboa', 'PT');

      expect(result).toEqual({
        id: 1,
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO municipalities'),
        ['Lisboa', 'Lisboa', 'PT']
      );
    });

    it('should handle upsert on conflict', async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: 'Lisboa',
            district: 'Updated District',
            country: 'PT',
          },
        ],
      };

      mockClient.query.mockResolvedValue(mockResult);

      await insertMunicipality(mockClient, 'Lisboa', 'Updated District', 'PT');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (name) DO UPDATE'),
        expect.any(Array)
      );
    });

    it('should handle null district and country', async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: 'Test City',
            district: null,
            country: null,
          },
        ],
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await insertMunicipality(mockClient, 'Test City');

      expect(result).toEqual({
        id: 1,
        name: 'Test City',
        district: null,
        country: null,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        ['Test City', null, null]
      );
    });

    it('should convert undefined to null', async () => {
      const mockResult = {
        rows: [
          {
            id: 1,
            name: 'Test City',
            district: null,
            country: null,
          },
        ],
      };

      mockClient.query.mockResolvedValue(mockResult);

      await insertMunicipality(mockClient, 'Test City', undefined, undefined);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        ['Test City', null, null]
      );
    });

    it('should return null on database error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await insertMunicipality(mockClient, 'Lisboa', 'Lisboa', 'PT');

      expect(result).toBeNull();
    });

    it('should return null when no rows returned', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await insertMunicipality(mockClient, 'Lisboa', 'Lisboa', 'PT');

      expect(result).toBeNull();
    });

    it('should include timestamps in insert', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Lisboa' }],
      });

      await insertMunicipality(mockClient, 'Lisboa', 'Lisboa', 'PT');

      const query = mockClient.query.mock.calls[0][0];
      expect(query).toContain('created_at');
      expect(query).toContain('updated_at');
      expect(query).toContain('NOW()');
    });

    it('should update timestamps on conflict', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Lisboa' }],
      });

      await insertMunicipality(mockClient, 'Lisboa', 'Lisboa', 'PT');

      const query = mockClient.query.mock.calls[0][0];
      expect(query).toContain('updated_at = NOW()');
    });

    it('should preserve existing data with COALESCE on conflict', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Lisboa' }],
      });

      await insertMunicipality(mockClient, 'Lisboa', 'Lisboa', 'PT');

      const query = mockClient.query.mock.calls[0][0];
      expect(query).toContain('COALESCE(EXCLUDED.district, municipalities.district)');
      expect(query).toContain('COALESCE(EXCLUDED.country, municipalities.country)');
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry up to 3 times on failures', async () => {
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValueOnce({
          data: {
            address: {
              city: 'Lisboa',
              country_code: 'pt',
            },
          },
        });

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result).not.toBeNull();
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should throw after exhausting retries', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Persistent failure'));

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result).toBeNull();
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long municipality names', async () => {
      const longName = 'A'.repeat(200);
      const mockResponse = {
        data: {
          address: {
            city: longName,
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result?.name).toBe(longName);
    });

    it('should handle special characters in municipality names', async () => {
      const mockResponse = {
        data: {
          address: {
            city: "São José dos Pinhais",
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMunicipalityFromCoordinates(38.7223, -9.1393);

      expect(result?.name).toBe("São José dos Pinhais");
    });

    it('should handle coordinates at boundaries', async () => {
      const mockResponse = {
        data: {
          address: {
            city: 'Test',
            country_code: 'pt',
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await getMunicipalityFromCoordinates(90, 180);
      await getMunicipalityFromCoordinates(-90, -180);
      await getMunicipalityFromCoordinates(0, 0);

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });
});
