import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Readable } from 'stream';

// Mock dependencies
const mockAuth = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

const mockGcsClient = vi.hoisted(() => ({
  getFileStream: vi.fn(),
  getFileMetadata: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

// Mock Next.js headers function
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/server/utils/gcs-client', () => mockGcsClient);
vi.mock('@/server/db', () => ({ db: mockDb }));
vi.mock('@/server/db/schema', () => ({
  enrichedPlots: {
    id: Symbol('id'),
    plotReportUrl: Symbol('plotReportUrl'),
  },
}));

// Import the route handler after mocking
import { GET } from '../../../src/app/api/plot-report-pdf/[plotId]/route';

beforeEach(() => {
  vi.clearAllMocks();
  
  // Set up default mock chain for database queries
  mockDb.select.mockReturnValue(mockDb);
  mockDb.from.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue(mockDb);
});

describe('GET /api/plot-report-pdf/[plotId]', () => {
  const createMockRequest = (url = 'http://localhost:3000/api/plot-report-pdf/plot-123') => {
    return new NextRequest(url);
  };

  const createMockParams = (plotId: string) => ({
    params: { plotId },
  });

  it('streams PDF successfully for authenticated user with valid plot', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    const mockPlot = {
      id: 'plot-123',
      plotReportUrl: 'gs://yonder-reports/report.pdf',
    };
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    mockGcsClient.getFileMetadata.mockResolvedValueOnce({
      size: 1024000,
      contentType: 'application/pdf',
      updated: new Date('2024-11-13T22:00:00.000Z'),
    });

    const mockStream = new Readable();
    mockGcsClient.getFileStream.mockResolvedValueOnce(mockStream);

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-123'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="plot-plot-123-report.pdf"');
    expect(response.headers.get('Content-Length')).toBe('1024000');
    
    expect(mockGcsClient.getFileStream).toHaveBeenCalledWith(mockPlot.plotReportUrl);
  });

  it('returns 401 for unauthenticated users', async () => {
    mockAuth.api.getSession.mockResolvedValueOnce(null);

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-123'));

    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.error).toBe('Unauthorized - Authentication required');
    
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockGcsClient.getFileStream).not.toHaveBeenCalled();
  });

  it('returns 404 when plot is not found', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    mockDb.limit.mockResolvedValueOnce([]);

    const request = createMockRequest();
    const response = await GET(request, createMockParams('non-existent-plot'));

    expect(response.status).toBe(404);
    
    const body = await response.json();
    expect(body.error).toBe('Plot not found');
  });

  it('returns 404 when plot has no PDF report URL', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    const mockPlot = {
      id: 'plot-456',
      plotReportUrl: null,
    };
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-456'));

    expect(response.status).toBe(404);
    
    const body = await response.json();
    expect(body.error).toBe('No PDF report available for this plot');
  });

  it('returns 500 when metadata retrieval fails', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    const mockPlot = {
      id: 'plot-789',
      plotReportUrl: 'gs://yonder-reports/report.pdf',
    };
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    mockGcsClient.getFileMetadata.mockResolvedValueOnce(null);

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-789'));

    expect(response.status).toBe(500);
    
    const body = await response.json();
    expect(body.error).toBe('Failed to retrieve PDF metadata from storage');
  });

  it('returns 500 when GCS stream throws error', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    const mockPlot = {
      id: 'plot-error',
      plotReportUrl: 'gs://yonder-reports/report.pdf',
    };
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    mockGcsClient.getFileMetadata.mockResolvedValueOnce({
      size: 1024000,
      contentType: 'application/pdf',
      updated: new Date(),
    });

    mockGcsClient.getFileStream.mockRejectedValueOnce(new Error('Stream creation failed'));

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-error'));

    expect(response.status).toBe(500);
    
    const body = await response.json();
    expect(body.error).toContain('Failed to stream PDF');
  });

  it('uses correct filename in Content-Disposition header', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    const plotId = 'custom-plot-id-xyz';
    const mockPlot = {
      id: plotId,
      plotReportUrl: 'gs://yonder-reports/report.pdf',
    };
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    mockGcsClient.getFileMetadata.mockResolvedValueOnce({
      size: 2048,
      contentType: 'application/pdf',
      updated: new Date(),
    });

    const mockStream = new Readable();
    mockGcsClient.getFileStream.mockResolvedValueOnce(mockStream);

    const request = createMockRequest();
    const response = await GET(request, createMockParams(plotId));

    const contentDisposition = response.headers.get('Content-Disposition');
    expect(contentDisposition).toBe(`attachment; filename="plot-${plotId}-report.pdf"`);
  });

  it('sets cache control header correctly', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    const mockPlot = {
      id: 'plot-cache',
      plotReportUrl: 'gs://yonder-reports/report.pdf',
    };
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    mockGcsClient.getFileMetadata.mockResolvedValueOnce({
      size: 1024,
      contentType: 'application/pdf',
      updated: new Date(),
    });

    const mockStream = new Readable();
    mockGcsClient.getFileStream.mockResolvedValueOnce(mockStream);

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-cache'));

    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
  });

  it('handles database errors gracefully', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    mockDb.limit.mockRejectedValueOnce(new Error('Database connection lost'));

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-123'));

    expect(response.status).toBe(500);
    
    const body = await response.json();
    expect(body.error).toContain('Database connection lost');
  });

  it('works with https:// GCS URLs', async () => {
    const mockSession = { user: { id: 'user-123' } };
    mockAuth.api.getSession.mockResolvedValueOnce(mockSession);

    const mockPlot = {
      id: 'plot-https',
      plotReportUrl: 'https://storage.googleapis.com/yonder-reports/reports/report.pdf',
    };
    mockDb.limit.mockResolvedValueOnce([mockPlot]);

    mockGcsClient.getFileMetadata.mockResolvedValueOnce({
      size: 2048000,
      contentType: 'application/pdf',
      updated: new Date(),
    });

    const mockStream = new Readable();
    mockGcsClient.getFileStream.mockResolvedValueOnce(mockStream);

    const request = createMockRequest();
    const response = await GET(request, createMockParams('plot-https'));

    expect(response.status).toBe(200);
    expect(mockGcsClient.getFileStream).toHaveBeenCalledWith(mockPlot.plotReportUrl);
  });
});
