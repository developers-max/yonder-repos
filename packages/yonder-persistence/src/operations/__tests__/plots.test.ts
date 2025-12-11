import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the connection module before importing operations
vi.mock('../../connection', () => ({
  getPgPool: vi.fn(),
}));

import { getPgPool } from '../../connection';
import {
  upsertEnrichedPlot,
  upsertPlotMunicipality,
  getExistingEnrichmentDataMap,
  getPlotsByIds,
  fetchPlotsBatch,
  markPlotEnriched,
  upsertEnrichedPlotWithMunicipality,
} from '../plots';

describe('Plot Operations', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };
    vi.mocked(getPgPool).mockReturnValue(mockPool as any);
  });

  describe('upsertEnrichedPlot', () => {
    it('should upsert enrichment data for a plot', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await upsertEnrichedPlot(
        { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
        { zoning: { type: 'residential' } }
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO enriched_plots_stage'),
        ['plot-1', 38.7223, -9.1393, '{"zoning":{"type":"residential"}}']
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should use custom table name when provided', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await upsertEnrichedPlot(
        { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
        { zoning: { type: 'residential' } },
        'enriched_plots_prod'
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO enriched_plots_prod'),
        expect.any(Array)
      );
    });

    it('should merge with existing enrichment data on conflict', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await upsertEnrichedPlot(
        { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
        { zoning: { type: 'residential' } }
      );

      const query = mockClient.query.mock.calls[0][0];
      expect(query).toContain('ON CONFLICT (id) DO UPDATE');
      expect(query).toContain('COALESCE');
      expect(query).toContain('|| EXCLUDED.enrichment_data');
    });
  });

  describe('upsertPlotMunicipality', () => {
    it('should upsert municipality ID for a plot', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await upsertPlotMunicipality(
        mockClient,
        { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
        123
      );

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO enriched_plots_stage'),
        ['plot-1', 38.7223, -9.1393, 123]
      );
    });

    it('should return false on error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await upsertPlotMunicipality(
        mockClient,
        { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
        123
      );

      expect(result).toBe(false);
    });
  });

  describe('getExistingEnrichmentDataMap', () => {
    it('should return map of existing enrichment data', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          { id: 'plot-1', enrichment_data: { zoning: { type: 'residential' } } },
          { id: 'plot-2', enrichment_data: { cadastral: { ref: 'ABC123' } } },
        ],
      });

      const result = await getExistingEnrichmentDataMap(['plot-1', 'plot-2']);

      expect(result.get('plot-1')).toEqual({ zoning: { type: 'residential' } });
      expect(result.get('plot-2')).toEqual({ cadastral: { ref: 'ABC123' } });
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return empty map for empty input', async () => {
      const result = await getExistingEnrichmentDataMap([]);

      expect(result.size).toBe(0);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should handle null enrichment_data', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 'plot-1', enrichment_data: null }],
      });

      const result = await getExistingEnrichmentDataMap(['plot-1']);

      expect(result.get('plot-1')).toEqual({});
    });
  });

  describe('getPlotsByIds', () => {
    it('should return plots by IDs', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          { id: 'plot-1', latitude: 38.7223, longitude: -9.1393, enrichment_data: {} },
          { id: 'plot-2', latitude: 41.1579, longitude: -8.6291, enrichment_data: {} },
        ],
      });

      const result = await getPlotsByIds(['plot-1', 'plot-2']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('plot-1');
      expect(result[1].id).toBe('plot-2');
    });

    it('should return empty array for empty input', async () => {
      const result = await getPlotsByIds([]);

      expect(result).toEqual([]);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });
  });

  describe('fetchPlotsBatch', () => {
    it('should fetch plots with pagination', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
          { id: 'plot-2', latitude: 41.1579, longitude: -8.6291 },
        ],
      });

      const result = await fetchPlotsBatch(0, 100);

      expect(result).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET'),
        expect.arrayContaining([0, 100])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should filter by country when provided', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await fetchPlotsBatch(0, 100, { country: 'PT' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE country = $1'),
        expect.arrayContaining(['PT'])
      );
    });

    it('should use custom table name when provided', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await fetchPlotsBatch(0, 100, { tableName: 'plots_prod' });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM plots_prod'),
        expect.any(Array)
      );
    });
  });

  describe('markPlotEnriched', () => {
    it('should mark plot as enriched', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await markPlotEnriched('plot-1');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plots_stage SET enriched = true'),
        ['plot-1']
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should use custom table name when provided', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await markPlotEnriched('plot-1', 'plots_prod');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plots_prod'),
        ['plot-1']
      );
    });
  });

  describe('upsertEnrichedPlotWithMunicipality', () => {
    it('should upsert enriched plot with municipality ID', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await upsertEnrichedPlotWithMunicipality(
        { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
        { zoning: { type: 'residential' } },
        123
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO enriched_plots_stage'),
        ['plot-1', 38.7223, -9.1393, '{"zoning":{"type":"residential"}}', 123]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle null municipality ID', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await upsertEnrichedPlotWithMunicipality(
        { id: 'plot-1', latitude: 38.7223, longitude: -9.1393 },
        { zoning: { type: 'residential' } },
        null
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null])
      );
    });
  });
});
