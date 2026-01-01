/**
 * Yonder Agent API Client
 * Shared client for querying the yonder-agent RAG service
 */

import { getAuthHeaders as getGCloudAuthHeaders } from './gcloud-auth';

// Yonder Agent API configuration
const AGENT_API_URL = process.env.YONDER_AGENT_API_URL || 'http://localhost:8080';

// Timeout configuration for API calls
const QUERY_TIMEOUT_MS = 300000; // 5 minutes for RAG queries (can be slow with large documents)
const PDM_PROCESS_TIMEOUT_MS = 900000; // 15 minutes for PDM processing (PDF to JSON + embeddings generation)

export interface ZoningQueryRequest {
  query: string;
  municipality_id: number;
  plot_id?: string;
}

export interface ZoningQueryResponse {
  answer: string;
  municipality: string;
  sources: Array<{
    document_title: string;
    document_url: string;
    chunk_index: number;
    similarity_score?: number;
  }>;
  question: string;
  context_chunks_used: number;
  response_time: number;
  search_method: string;
  retrieval_calls?: number | null;  // Agentic RAG v2.0: Number of retrieval calls made by agent (null for non-agentic)
  agent_steps?: number | null;       // Agentic RAG v2.0: Total agent decision steps (null for non-agentic)
}

export interface Municipality {
  id: number;
  name: string;
  district?: string;
  chunk_count: number;
  document_count: number;
}

export interface PlotReportRequest {
  plot_id: string;
  project_id?: string;
}

export interface PlotReportResponse {
  plot_id: string;
  project_id?: string;
  pdf_url: string;
  report_summary: {
    address: string;
    total_area: string;
    zoning: string;
    completeness: number;
    sections_generated: number;
  };
  status: string;
  generation_time: number;
  metadata?: {
    pdf_size: number;
    gcs_blob_name: string;
    completeness: number;
    database_updated: boolean;
    materialized_views_refreshed: string[];
    storage_time_seconds: number;
  };
}


/**
 * Query zoning information from the yonder-agent API
 * Uses extended timeout due to potentially large document processing
 */
export async function queryZoningInfo(request: ZoningQueryRequest): Promise<ZoningQueryResponse> {
  const url = `${AGENT_API_URL}/api/v1/query`;
  console.log('[yonder-agent-client] Querying:', url);
  console.log('[yonder-agent-client] Municipality ID:', request.municipality_id);
  console.log('[yonder-agent-client] Timeout:', `${QUERY_TIMEOUT_MS / 1000}s`);
  
  const headers = await getGCloudAuthHeaders(
    AGENT_API_URL,
    'yonder-agent',
    {
      'Content-Type': 'application/json',
    }
  );
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[yonder-agent-client] ❌ API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[yonder-agent-client] Response:', errorText);
      
      let errorMessage = `Failed to query zoning information (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // Response is not JSON
      }
      
      throw new Error(errorMessage);
    }

    console.log('[yonder-agent-client] ✅ Query successful');
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[yonder-agent-client] ❌ Query timeout after', `${QUERY_TIMEOUT_MS / 1000}s`);
      throw new Error(`Query timed out after ${QUERY_TIMEOUT_MS / 1000} seconds. The municipality documents may be large or the service is slow.`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get available municipalities from the yonder-agent API
 */
export async function getMunicipalities(): Promise<Municipality[]> {
  const response = await fetch(`${AGENT_API_URL}/api/v1/municipalities`, {
    headers: await getGCloudAuthHeaders(AGENT_API_URL, 'yonder-agent'),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch municipalities');
  }

  return response.json();
}

/**
 * Generate a plot report using the yonder-agent API
 * Extended timeout for report generation as it can take several minutes
 */
export async function generatePlotReport(request: PlotReportRequest): Promise<PlotReportResponse> {
  const url = `${AGENT_API_URL}/api/v1/generate_plot_report`;
  console.log('[yonder-agent-client] Generating plot report:', url);
  console.log('[yonder-agent-client] Plot ID:', request.plot_id);
  console.log('[yonder-agent-client] Timeout:', `${QUERY_TIMEOUT_MS / 1000}s`);
  
  const headers = await getGCloudAuthHeaders(
    AGENT_API_URL,
    'yonder-agent',
    {
      'Content-Type': 'application/json',
    }
  );
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[yonder-agent-client] ❌ Plot Report API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[yonder-agent-client] Response:', errorText);
      
      let errorMessage = `Failed to generate plot report (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        // Response is not JSON
      }
      
      throw new Error(errorMessage);
    }

    console.log('[yonder-agent-client] ✅ Plot report generated successfully');
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[yonder-agent-client] ❌ Plot report generation timeout after', `${QUERY_TIMEOUT_MS / 1000}s`);
      throw new Error(`Plot report generation timed out after ${QUERY_TIMEOUT_MS / 1000} seconds. The report generation may be taking longer than expected.`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get the yonder-agent API URL (for debugging/logging)
 */
export function getAgentApiUrl(): string {
  return AGENT_API_URL;
}

// PDM Analyzer types (for querying PDM regulations)
export interface PDMAnalyzerRequest {
  query: string;
  municipality_id?: number;
  municipality?: string;
  country?: string;
  action?: 'query' | 'scan' | 'summarize';
  zone_codes?: string[];
  output_language?: 'pt' | 'en' | 'auto';
}

export interface PDMAnalyzerCitation {
  section?: string;
  article?: string;
  text?: string;
  page?: number;
  relevance?: number;
}

export interface PDMAnalyzerResponse {
  answer: string;
  municipality: string;
  municipality_id: number;
  country: string;
  query: string;
  action: string;
  citations: PDMAnalyzerCitation[];
  confidence?: number | null;
  cached: boolean;
  response_time: number;
  metadata?: {
    output_language?: string;
    chunks_processed?: number;
    zone_codes_found?: string[];
  } | null;
}

/**
 * Query PDM regulations using the PDM Analyzer API
 * Supports querying by municipality ID or name
 */
export async function queryPdmAnalyzer(request: PDMAnalyzerRequest): Promise<PDMAnalyzerResponse> {
  const url = `${AGENT_API_URL}/api/v1/pdm/analyze`;
  console.log('[yonder-agent-client] Querying PDM Analyzer:', url);
  console.log('[yonder-agent-client] Municipality:', request.municipality_id || request.municipality);
  console.log('[yonder-agent-client] Action:', request.action || 'query');
  console.log('[yonder-agent-client] Timeout:', `${QUERY_TIMEOUT_MS / 1000}s`);
  
  const headers = await getGCloudAuthHeaders(
    AGENT_API_URL,
    'yonder-agent',
    {
      'Content-Type': 'application/json',
    }
  );
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[yonder-agent-client] ❌ PDM Analyzer API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[yonder-agent-client] Response:', errorText);
      
      let errorMessage = `Failed to query PDM analyzer (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        // Response is not JSON
      }
      
      throw new Error(errorMessage);
    }

    console.log('[yonder-agent-client] ✅ PDM Analyzer query successful');
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[yonder-agent-client] ❌ PDM Analyzer timeout after', `${QUERY_TIMEOUT_MS / 1000}s`);
      throw new Error(`PDM query timed out after ${QUERY_TIMEOUT_MS / 1000} seconds. The municipality documents may be large or the service is slow.`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

// PDM Processing types
export interface PDMProcessRequest {
  pdm_url: string;
  municipality_id: number;
  force_refresh?: boolean;
  generate_embeddings?: boolean;
}

export interface PDMProcessResponse {
  municipality_id: number;
  municipality_name: string;
  pdm_url: string;
  status: string;
  pdm_documents_updated: boolean;
  json_conversion: {
    success?: boolean;
    skipped?: boolean;
    reason?: string;
    processing_time_seconds?: number;
    sections_count?: number;
    zones_count?: number;
    content_blocks_count?: number;
    tables_count?: number;
  };
  embeddings_generation?: {
    success?: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
    processing_time_seconds?: number;
    chunks_created?: number;
    embeddings_stored?: number;
  } | null;
  processing_time: number;
  ready_for_queries: boolean;
}

// PDM Refresh types
export interface PDMRefreshRequest {
  municipality_id: number;
  max_iterations?: number;
  confidence_threshold?: number;
}

export interface PDMRefreshResponse {
  municipality_id: number;
  municipality_name: string;
  best_pdm_url: string | null;
  confidence_score: number;
  iterations: number;
  pdm_urls: string[];
  database_updated: boolean;
  execution_time: number;
  error: string | null;
}

/**
 * Process a PDM document for RAG/LLM integration
 * Converts PDF to JSON and generates embeddings for vector search
 */
export async function processPdmDocument(request: PDMProcessRequest): Promise<PDMProcessResponse> {
  const url = `${AGENT_API_URL}/api/v1/pdm/process`;
  // Trim the PDM URL to remove any leading/trailing whitespace
  const sanitizedRequest = {
    ...request,
    pdm_url: request.pdm_url.trim(),
  };
  console.log('[yonder-agent-client] Processing PDM document:', url);
  console.log('[yonder-agent-client] Municipality ID:', sanitizedRequest.municipality_id);
  console.log('[yonder-agent-client] PDM URL:', sanitizedRequest.pdm_url);
  console.log('[yonder-agent-client] Timeout:', `${PDM_PROCESS_TIMEOUT_MS / 1000}s`);
  
  const headers = await getGCloudAuthHeaders(
    AGENT_API_URL,
    'yonder-agent',
    {
      'Content-Type': 'application/json',
    }
  );
  
  // Create abort controller for timeout (PDM processing can take a long time)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDM_PROCESS_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(sanitizedRequest),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[yonder-agent-client] ❌ PDM Process API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[yonder-agent-client] Response:', errorText);
      
      let errorMessage = `Failed to process PDM document (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        // Response is not JSON
      }
      
      throw new Error(errorMessage);
    }

    console.log('[yonder-agent-client] ✅ PDM document processed successfully');
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[yonder-agent-client] ❌ PDM processing timeout after', `${PDM_PROCESS_TIMEOUT_MS / 1000}s`);
      throw new Error(`PDM processing timed out after ${PDM_PROCESS_TIMEOUT_MS / 1000} seconds. The document may be large or the service is slow.`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Refresh PDM URL for a municipality using the PDM Scraper API
 * Discovers and updates the PDM document URL for a municipality
 */
export async function refreshPdmUrl(request: PDMRefreshRequest): Promise<PDMRefreshResponse> {
  const url = `${AGENT_API_URL}/api/v1/pdm/refresh`;
  console.log('[yonder-agent-client] Refreshing PDM URL:', url);
  console.log('[yonder-agent-client] Municipality ID:', request.municipality_id);
  console.log('[yonder-agent-client] Max iterations:', request.max_iterations || 3);
  console.log('[yonder-agent-client] Confidence threshold:', request.confidence_threshold || 0.80);
  
  const headers = await getGCloudAuthHeaders(
    AGENT_API_URL,
    'yonder-agent',
    {
      'Content-Type': 'application/json',
    }
  );
  
  // Create abort controller for timeout (PDM refresh can take up to 2 minutes)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        municipality_id: request.municipality_id,
        max_iterations: request.max_iterations || 3,
        confidence_threshold: request.confidence_threshold || 0.80,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[yonder-agent-client] ❌ PDM Refresh API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[yonder-agent-client] Response:', errorText);
      
      let errorMessage = `Failed to refresh PDM URL (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        // Response is not JSON
      }
      
      throw new Error(errorMessage);
    }

    console.log('[yonder-agent-client] ✅ PDM URL refreshed successfully');
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[yonder-agent-client] ❌ PDM refresh timeout after 120s');
      throw new Error(`PDM refresh timed out after 120 seconds. The municipality may not have a PDM available or the service is slow.`);
    }
    
    // Re-throw other errors
    throw error;
  }
}
