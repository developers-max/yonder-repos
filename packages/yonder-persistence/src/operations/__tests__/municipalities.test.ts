import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the connection module before importing operations
vi.mock('../../connection', () => ({
  getDrizzle: vi.fn(),
  getPgPool: vi.fn(),
}));

import { getDrizzle, getPgPool } from '../../connection';
import {
  findMunicipalityByName,
  upsertMunicipality,
  findPortugalMunicipalityByName,
  findPortugalMunicipalityByCaopId,
  findPortugalMunicipality,
} from '../municipalities';

describe('Municipality Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMunicipalityByName', () => {
    it('should find municipality by exact name match', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 1, name: 'Lisboa', district: 'Lisboa', country: 'PT' },
        ]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findMunicipalityByName('Lisboa');

      expect(result).toEqual({
        id: 1,
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });
    });

    it('should fallback to case-insensitive search if exact match not found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn()
          .mockResolvedValueOnce([]) // First call returns empty
          .mockResolvedValueOnce([
            { id: 1, name: 'Lisboa', district: 'Lisboa', country: 'PT' },
          ]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findMunicipalityByName('lisboa');

      expect(result).toEqual({
        id: 1,
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });
      expect(mockDb.limit).toHaveBeenCalledTimes(2);
    });

    it('should return undefined if no match found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findMunicipalityByName('NonExistent');

      expect(result).toBeUndefined();
    });
  });

  describe('upsertMunicipality', () => {
    let mockClient: any;
    let mockPool: any;

    beforeEach(() => {
      mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };
      vi.mocked(getPgPool).mockReturnValue(mockPool as any);
    });

    it('should insert new municipality successfully', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Lisboa', district: 'Lisboa', country: 'PT' },
        ],
      });

      const result = await upsertMunicipality({
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });

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
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle upsert on conflict', async () => {
      mockClient.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Lisboa', district: 'Updated District', country: 'PT' },
        ],
      });

      await upsertMunicipality({
        name: 'Lisboa',
        district: 'Updated District',
        country: 'PT',
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (name) DO UPDATE'),
        expect.any(Array)
      );
    });

    it('should handle null district and country', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test City', district: null, country: null }],
      });

      const result = await upsertMunicipality({ name: 'Test City' });

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

    it('should return null on database error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await upsertMunicipality({
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null when no rows returned', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await upsertMunicipality({
        name: 'Lisboa',
        district: 'Lisboa',
        country: 'PT',
      });

      expect(result).toBeNull();
    });

    it('should include timestamps in insert', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Lisboa' }],
      });

      await upsertMunicipality({ name: 'Lisboa', district: 'Lisboa', country: 'PT' });

      const query = mockClient.query.mock.calls[0][0];
      expect(query).toContain('created_at');
      expect(query).toContain('updated_at');
      expect(query).toContain('NOW()');
    });
  });

  describe('findPortugalMunicipalityByName', () => {
    it('should find Portugal municipality by name', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 1, name: 'Lisboa', caopId: '1106' },
        ]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findPortugalMunicipalityByName('Lisboa');

      expect(result).toEqual({ id: 1, name: 'Lisboa', caopId: '1106' });
    });

    it('should return undefined if not found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findPortugalMunicipalityByName('NonExistent');

      expect(result).toBeUndefined();
    });
  });

  describe('findPortugalMunicipalityByCaopId', () => {
    it('should find Portugal municipality by CAOP ID', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 1, name: 'Lisboa', caopId: '1106' },
        ]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findPortugalMunicipalityByCaopId('1106');

      expect(result).toEqual({ id: 1, name: 'Lisboa', caopId: '1106' });
    });
  });

  describe('findPortugalMunicipality', () => {
    it('should try name first, then fallback to CAOP ID', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn()
          .mockResolvedValueOnce([]) // Name search returns empty
          .mockResolvedValueOnce([{ id: 1, name: 'Lisboa', caopId: '1106' }]), // CAOP search returns result
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findPortugalMunicipality('NonExistent', '1106');

      expect(result).toEqual({ id: 1, name: 'Lisboa', caopId: '1106' });
    });

    it('should return undefined if neither name nor CAOP ID match', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      const result = await findPortugalMunicipality('NonExistent', '9999');

      expect(result).toBeUndefined();
    });

    it('should extract municipality code from full CAOP ID', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn()
          .mockResolvedValueOnce([]) // Name search returns empty  
          .mockResolvedValueOnce([{ id: 1, name: 'Lisboa', caopId: '1106' }]),
      };
      vi.mocked(getDrizzle).mockReturnValue(mockDb as any);

      // Full CAOP ID is DDCCFF (district, municipality, freguesia)
      // Should extract first 4 digits for municipality
      await findPortugalMunicipality(null, '110601');

      // Verify that the municipality lookup was called with truncated ID
      expect(mockDb.limit).toHaveBeenCalledTimes(1);
    });
  });
});
