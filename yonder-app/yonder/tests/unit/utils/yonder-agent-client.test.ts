import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock state for fetch
const mockFetch = vi.fn();

// Mock gcloud-auth module
vi.mock('../../../src/lib/utils/remote-clients/gcloud-auth', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mock-token',
  }),
}));

// Mock global fetch
vi.stubGlobal('fetch', mockFetch);

// Import after mocking
import {
  processPdmDocument,
  queryPdmAnalyzer,
  getAgentApiUrl,
  type PDMProcessRequest,
  type PDMProcessResponse,
  type PDMAnalyzerRequest,
  type PDMAnalyzerResponse,
} from '../../../src/lib/utils/remote-clients/yonder-agent-client';

beforeEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('getAgentApiUrl', () => {
  it('returns a valid API URL', () => {
    const url = getAgentApiUrl();
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
    // Should be a valid URL (http or https)
    expect(url).toMatch(/^https?:\/\//);
  });
});

describe('processPdmDocument', () => {
  const mockRequest: PDMProcessRequest = {
    pdm_url: 'https://example.com/pdm/regulamento.pdf',
    municipality_id: 123,
    force_refresh: false,
    generate_embeddings: true,
  };

  const mockSuccessResponse: PDMProcessResponse = {
    municipality_id: 123,
    municipality_name: 'Lisboa',
    pdm_url: 'https://example.com/pdm/regulamento.pdf',
    status: 'success',
    pdm_documents_updated: true,
    json_conversion: {
      success: true,
      processing_time_seconds: 45.2,
      sections_count: 12,
      zones_count: 8,
      content_blocks_count: 156,
      tables_count: 5,
    },
    embeddings_generation: {
      success: true,
      processing_time_seconds: 23.1,
      chunks_created: 245,
      embeddings_stored: 245,
    },
    processing_time: 68.3,
    ready_for_queries: true,
  };

  it('successfully processes a PDM document', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const result = await processPdmDocument(mockRequest);

    expect(result).toEqual(mockSuccessResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Verify the correct endpoint was called
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('/api/v1/pdm/process');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.body).toBe(JSON.stringify(mockRequest));
  });

  it('handles already processed documents', async () => {
    const alreadyProcessedResponse: PDMProcessResponse = {
      municipality_id: 123,
      municipality_name: 'Lisboa',
      pdm_url: 'https://example.com/pdm/regulamento.pdf',
      status: 'already_processed',
      pdm_documents_updated: true,
      json_conversion: {
        skipped: true,
        reason: 'Document already exists',
      },
      embeddings_generation: {
        skipped: true,
        reason: 'Embeddings already exist',
      },
      processing_time: 0.5,
      ready_for_queries: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(alreadyProcessedResponse),
    });

    const result = await processPdmDocument(mockRequest);

    expect(result.status).toBe('already_processed');
    expect(result.ready_for_queries).toBe(true);
  });

  it('throws error when API returns error status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(JSON.stringify({ 
        detail: 'Municipality with ID 123 not found.' 
      })),
    });

    await expect(processPdmDocument(mockRequest)).rejects.toThrow(
      'Municipality with ID 123 not found.'
    );
  });

  it('throws error when API returns 500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve(JSON.stringify({
        detail: 'Error processing PDM document: PDF conversion failed',
      })),
    });

    await expect(processPdmDocument(mockRequest)).rejects.toThrow(
      'Error processing PDM document: PDF conversion failed'
    );
  });

  it('throws error when network fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(processPdmDocument(mockRequest)).rejects.toThrow('Network error');
  });

  it('handles timeout error gracefully', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(processPdmDocument(mockRequest)).rejects.toThrow(
      /timed out/i
    );
  });

  it('sends force_refresh parameter correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    const requestWithForceRefresh: PDMProcessRequest = {
      ...mockRequest,
      force_refresh: true,
    };

    await processPdmDocument(requestWithForceRefresh);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"force_refresh":true'),
      })
    );
  });

  it('sends generate_embeddings parameter correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ...mockSuccessResponse,
        embeddings_generation: null,
      }),
    });

    const requestWithoutEmbeddings: PDMProcessRequest = {
      ...mockRequest,
      generate_embeddings: false,
    };

    await processPdmDocument(requestWithoutEmbeddings);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"generate_embeddings":false'),
      })
    );
  });

  it('handles partial success (JSON ok, embeddings failed)', async () => {
    const partialSuccessResponse: PDMProcessResponse = {
      municipality_id: 123,
      municipality_name: 'Lisboa',
      pdm_url: 'https://example.com/pdm/regulamento.pdf',
      status: 'success',
      pdm_documents_updated: true,
      json_conversion: {
        success: true,
        processing_time_seconds: 45.2,
        sections_count: 12,
        zones_count: 8,
      },
      embeddings_generation: {
        success: false,
        error: 'Embedding service unavailable',
      },
      processing_time: 45.5,
      ready_for_queries: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(partialSuccessResponse),
    });

    const result = await processPdmDocument(mockRequest);

    expect(result.status).toBe('success');
    expect(result.json_conversion.success).toBe(true);
    expect(result.embeddings_generation?.success).toBe(false);
    expect(result.ready_for_queries).toBe(false);
  });
});

describe('queryPdmAnalyzer', () => {
  const mockPortugalRequest: PDMAnalyzerRequest = {
    query: 'What is the maximum building height allowed?',
    municipality_id: 60,
    municipality: 'Lisboa',
    country: 'Portugal',
    action: 'query',
    output_language: 'auto',
  };

  const mockSpainRequest: PDMAnalyzerRequest = {
    query: '¿Cuál es la altura máxima permitida?',
    municipality_id: 100,
    municipality: 'Alella',
    country: 'Spain',
    action: 'query',
    output_language: 'auto',
  };

  const mockPortugalResponse: PDMAnalyzerResponse = {
    answer: 'A altura máxima permitida é de 12 metros.',
    municipality: 'Lisboa',
    municipality_id: 60,
    country: 'Portugal',
    query: 'What is the maximum building height allowed?',
    action: 'query',
    citations: [
      {
        section: 'Artigo 45',
        article: 'PDM Lisboa',
        text: 'A altura máxima das edificações...',
        page: 23,
        relevance: 0.92,
      },
    ],
    confidence: 0.85,
    cached: false,
    response_time: 2.5,
    metadata: {
      output_language: 'pt',
      chunks_processed: 15,
    },
  };

  const mockSpainResponse: PDMAnalyzerResponse = {
    answer: 'La altura máxima permitida es de 10 metros en zonas residenciales.',
    municipality: 'Alella',
    municipality_id: 100,
    country: 'Spain',
    query: '¿Cuál es la altura máxima permitida?',
    action: 'query',
    citations: [
      {
        section: 'Artículo 32',
        article: 'POUM Alella',
        text: 'La altura máxima de las edificaciones...',
        page: 15,
        relevance: 0.89,
      },
    ],
    confidence: 0.82,
    cached: false,
    response_time: 1.8,
    metadata: {
      output_language: 'es',
      chunks_processed: 12,
    },
  };

  it('successfully queries PDM for Portuguese municipality', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPortugalResponse),
    });

    const result = await queryPdmAnalyzer(mockPortugalRequest);

    expect(result).toEqual(mockPortugalResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('/api/v1/pdm/analyze');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.body).toContain('"country":"Portugal"');
  });

  it('successfully queries PDM for Spanish municipality', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSpainResponse),
    });

    const result = await queryPdmAnalyzer(mockSpainRequest);

    expect(result).toEqual(mockSpainResponse);
    expect(result.country).toBe('Spain');
    expect(result.municipality).toBe('Alella');
    
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('/api/v1/pdm/analyze');
    expect(calledOptions.body).toContain('"country":"Spain"');
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(JSON.stringify({ detail: 'Municipality not found' })),
    });

    await expect(queryPdmAnalyzer(mockPortugalRequest)).rejects.toThrow('Municipality not found');
  });

  it('handles timeout errors', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(queryPdmAnalyzer(mockPortugalRequest)).rejects.toThrow(/timed out/);
  });

  it('passes output_language parameter correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPortugalResponse),
    });

    const requestWithLanguage: PDMAnalyzerRequest = {
      ...mockPortugalRequest,
      output_language: 'en',
    };

    await queryPdmAnalyzer(requestWithLanguage);

    const [, calledOptions] = mockFetch.mock.calls[0];
    expect(calledOptions.body).toContain('"output_language":"en"');
  });

  it('handles cached responses', async () => {
    const cachedResponse: PDMAnalyzerResponse = {
      ...mockPortugalResponse,
      cached: true,
      response_time: 0.1,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(cachedResponse),
    });

    const result = await queryPdmAnalyzer(mockPortugalRequest);

    expect(result.cached).toBe(true);
    expect(result.response_time).toBeLessThan(1);
  });

  it('supports query by municipality name without ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPortugalResponse),
    });

    const requestByName: PDMAnalyzerRequest = {
      query: 'What are the zoning rules?',
      municipality: 'Lisboa',
      country: 'Portugal',
    };

    await queryPdmAnalyzer(requestByName);

    const [, calledOptions] = mockFetch.mock.calls[0];
    const body = JSON.parse(calledOptions.body);
    expect(body.municipality).toBe('Lisboa');
    expect(body.municipality_id).toBeUndefined();
  });
});
