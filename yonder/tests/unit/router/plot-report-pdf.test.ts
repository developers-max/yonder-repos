import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock GCS client functions
const mockGcsClient = vi.hoisted(() => ({
  fileExists: vi.fn(),
  getFileMetadata: vi.fn(),
  getFileStream: vi.fn(),
}));

vi.mock('../../../src/server/utils/gcs-client', () => mockGcsClient);

// Mock database
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../../../src/server/db', () => ({
  db: mockDb,
}));

vi.mock('../../../src/server/db/schema', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    enrichedPlots: {
      ...(actual.enrichedPlots || {}),
      id: Symbol('id'),
      plotReportUrl: Symbol('plotReportUrl'),
    },
  };
});

// Import the router after mocking
import { plotReportRouter } from '../../../src/server/trpc/router/plot';

beforeEach(() => {
  vi.clearAllMocks();
  
  // Set up default mock chain for database queries
  mockDb.select.mockReturnValue(mockDb);
  mockDb.from.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue(mockDb);
});

describe('plotReportRouter.fetchPlotReportPdf', () => {
  const createCaller = (session: { user: { id: string } } | null) => {
    return plotReportRouter.createCaller({
      session,
      user: session?.user || null,
    } as any);
  };

  it('returns PDF metadata when plot and file exist', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    const mockPlot = {
      id: 'plot-uuid-123',
      plotReportUrl: 'gs://yonder-reports/reports/2024/plot-123.pdf',
    };

    // Mock database response
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    // Mock GCS client responses
    mockGcsClient.fileExists.mockResolvedValueOnce(true);
    mockGcsClient.getFileMetadata.mockResolvedValueOnce({
      size: 2048000,
      contentType: 'application/pdf',
      updated: new Date('2024-11-13T22:00:00.000Z'),
    });

    const result = await caller.fetchPlotReportPdf({ plotId: 'plot-uuid-123' });

    expect(result).toEqual({
      plotId: 'plot-uuid-123',
      pdfUrl: 'gs://yonder-reports/reports/2024/plot-123.pdf',
      metadata: {
        size: 2048000,
        contentType: 'application/pdf',
        updated: '2024-11-13T22:00:00.000Z',
      },
      available: true,
    });

    expect(mockGcsClient.fileExists).toHaveBeenCalledWith(mockPlot.plotReportUrl);
    expect(mockGcsClient.getFileMetadata).toHaveBeenCalledWith(mockPlot.plotReportUrl);
  });

  it('throws error when plot is not found', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    // Mock empty database response
    mockDb.limit.mockResolvedValueOnce([]);

    await expect(
      caller.fetchPlotReportPdf({ plotId: 'non-existent-plot' })
    ).rejects.toThrow('Plot not found');

    expect(mockGcsClient.fileExists).not.toHaveBeenCalled();
  });

  it('throws error when plot has no PDF report URL', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    const mockPlot = {
      id: 'plot-uuid-456',
      plotReportUrl: null,
    };

    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    await expect(
      caller.fetchPlotReportPdf({ plotId: 'plot-uuid-456' })
    ).rejects.toThrow('No PDF report available for this plot');

    expect(mockGcsClient.fileExists).not.toHaveBeenCalled();
  });

  it('throws error when PDF file does not exist in GCS', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    const mockPlot = {
      id: 'plot-uuid-789',
      plotReportUrl: 'gs://yonder-reports/missing.pdf',
    };

    mockDb.limit.mockResolvedValueOnce([mockPlot]);
    mockGcsClient.fileExists.mockResolvedValueOnce(false);

    await expect(
      caller.fetchPlotReportPdf({ plotId: 'plot-uuid-789' })
    ).rejects.toThrow('PDF report file not found in storage');

    expect(mockGcsClient.fileExists).toHaveBeenCalledWith(mockPlot.plotReportUrl);
    expect(mockGcsClient.getFileMetadata).not.toHaveBeenCalled();
  });

  it('throws error when metadata retrieval fails', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    const mockPlot = {
      id: 'plot-uuid-999',
      plotReportUrl: 'gs://yonder-reports/report.pdf',
    };

    mockDb.limit.mockResolvedValueOnce([mockPlot]);
    mockGcsClient.fileExists.mockResolvedValueOnce(true);
    mockGcsClient.getFileMetadata.mockResolvedValueOnce(null);

    await expect(
      caller.fetchPlotReportPdf({ plotId: 'plot-uuid-999' })
    ).rejects.toThrow('Failed to retrieve PDF metadata');

    expect(mockGcsClient.getFileMetadata).toHaveBeenCalledWith(mockPlot.plotReportUrl);
  });

  it('handles https:// GCS URLs correctly', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    const mockPlot = {
      id: 'plot-uuid-https',
      plotReportUrl: 'https://storage.googleapis.com/yonder-reports/reports/report.pdf',
    };

    mockDb.limit.mockResolvedValueOnce([mockPlot]);
    mockGcsClient.fileExists.mockResolvedValueOnce(true);
    mockGcsClient.getFileMetadata.mockResolvedValueOnce({
      size: 1024000,
      contentType: 'application/pdf',
      updated: new Date('2024-11-13T00:00:00.000Z'),
    });

    const result = await caller.fetchPlotReportPdf({ plotId: 'plot-uuid-https' });

    expect(result.pdfUrl).toBe(mockPlot.plotReportUrl);
    expect(result.available).toBe(true);
  });

  it('requires authentication', async () => {
    const caller = createCaller(null);

    // Note: The actual authentication check depends on your tRPC setup
    // This test assumes protectedProcedure throws for unauthenticated users
    // You may need to adjust based on your actual error handling
    await expect(
      caller.fetchPlotReportPdf({ plotId: 'plot-123' })
    ).rejects.toThrow();
  });

  it('validates plotId input', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    // Test with invalid input (not a string)
    await expect(
      caller.fetchPlotReportPdf({ plotId: 123 as any })
    ).rejects.toThrow();

    // Test with empty string
    await expect(
      caller.fetchPlotReportPdf({ plotId: '' })
    ).rejects.toThrow();
  });

  it('handles database errors gracefully', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    mockDb.limit.mockRejectedValueOnce(new Error('Database connection failed'));

    await expect(
      caller.fetchPlotReportPdf({ plotId: 'plot-123' })
    ).rejects.toThrow('Database connection failed');
  });

  it('handles GCS errors gracefully', async () => {
    const mockSession = { user: { id: 'user-123' } };
    const caller = createCaller(mockSession);

    const mockPlot = {
      id: 'plot-uuid-error',
      plotReportUrl: 'gs://yonder-reports/report.pdf',
    };

    mockDb.limit.mockResolvedValueOnce([mockPlot]);
    mockGcsClient.fileExists.mockRejectedValueOnce(new Error('GCS unavailable'));

    await expect(
      caller.fetchPlotReportPdf({ plotId: 'plot-uuid-error' })
    ).rejects.toThrow('GCS unavailable');
  });
});
