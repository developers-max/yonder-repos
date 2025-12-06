import dotenv from 'dotenv';
import { Pool } from 'pg';
import axios from 'axios';
import { PDFParse } from 'pdf-parse';
import { OpenAI } from 'openai';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Configuration - Optimized based on 2024 RAG research (Wang et al.)
const CHUNK_SIZE = 400; // Characters per chunk (~100-130 tokens for PT/ES/CA)
const CHUNK_OVERLAP = 100; // 25% overlap for context preservation
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function assertEnv() {
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL');
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface PDMDocument {
  id: string;
  url: string;
  title: string;
  documentType: string;
}

interface MunicipalityWithDocuments {
  id: number;
  name: string;
  district?: string;
  documents: PDMDocument[];
}

/**
 * Fetch municipalities that have PDM documents but no embeddings yet
 */
async function fetchMunicipalitiesWithDocuments(
  client: any,
  municipalityIds?: number[]
): Promise<MunicipalityWithDocuments[]> {
  let query = `
    SELECT 
      m.id,
      m.name,
      m.district,
      m.pdm_documents
    FROM municipalities m
    WHERE m.pdm_documents IS NOT NULL
      AND m.pdm_documents::jsonb -> 'documents' IS NOT NULL
  `;

  const params: any[] = [];

  if (municipalityIds && municipalityIds.length > 0) {
    query += ` AND m.id = ANY($1)`;
    params.push(municipalityIds);
  }

  query += ` ORDER BY m.name`;

  const { rows } = await client.query(query, params);

  return rows
    .map((row: any) => {
      const pdmData = row.pdm_documents;
      if (!pdmData || !pdmData.documents || !Array.isArray(pdmData.documents)) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        district: row.district,
        documents: pdmData.documents,
      };
    })
    .filter((m: any) => m !== null);
}

/**
 * Check if embeddings already exist for a document
 */
async function hasEmbeddings(client: any, documentId: string): Promise<boolean> {
  const { rows } = await client.query(
    'SELECT COUNT(*) as count FROM pdm_document_embeddings WHERE document_id = $1',
    [documentId]
  );
  return parseInt(rows[0].count) > 0;
}

/**
 * Download PDF from URL
 */
async function downloadPDF(url: string): Promise<Buffer> {
  console.log(`  Downloading PDF from: ${url}`);
  
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: {
      'User-Agent': 'YonderEnrich-PDM-Embeddings/1.0',
    },
  });

  return Buffer.from(response.data);
}

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log(`  Extracting text from PDF...`);
  
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  
  console.log(`  Extracted ${result.text.length} characters from PDF`);
  return result.text;
}

/**
 * Split text into chunks with overlap
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  
  console.log(`  Starting chunking (${text.length} characters)...`);
  
  // For very large texts, skip heavy cleaning to avoid memory issues
  // Just normalize basic whitespace
  let workingText = text.trim();
  
  if (text.length > 500000) {
    console.log(`  Large document detected - using simplified cleaning`);
    // Minimal cleaning for large docs
    workingText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  } else {
    // Normal cleaning for smaller docs
    console.log(`  Applying text cleaning...`);
    workingText = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  console.log(`  Text ready for chunking: ${workingText.length} characters`);
  
  let position = 0;
  const step = chunkSize - overlap;
  let chunkCount = 0;
  const maxChunks = 2000; // Safety limit

  while (position < workingText.length && chunkCount < maxChunks) {
    const end = Math.min(position + chunkSize, workingText.length);
    const chunk = workingText.slice(position, end).trim();
    
    if (chunk.length > 50) { // Only add chunks with substantial content
      chunks.push(chunk);
      chunkCount++;
    }
    
    // Move position forward by step size
    position += step;
    
    // Safety: if we're past the last possible chunk start, we're done
    if (position >= workingText.length) {
      break;
    }
  }

  console.log(`  Created ${chunks.length} chunks from text`);
  console.log(`  This will take approximately ${Math.ceil(chunks.length / 100) * 2} minutes to embed...`);
  
  if (chunkCount >= maxChunks) {
    console.warn(`  ⚠ Hit maximum chunk limit (${maxChunks}). Some text may be truncated.`);
  }
  
  return chunks;
}

/**
 * Create embeddings for text chunks using OpenAI
 */
async function createEmbeddings(
  openai: OpenAI,
  texts: string[]
): Promise<number[][]> {
  console.log(`  Creating embeddings for ${texts.length} chunks...`);
  
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        encoding_format: 'float',
      });

      const embeddings = response.data.map(item => item.embedding);
      console.log(`  Created ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error: any) {
      retries++;
      if (retries >= MAX_RETRIES) {
        throw error;
      }
      
      console.warn(`  Embedding API error (attempt ${retries}/${MAX_RETRIES}):`, error.message);
      await sleep(RETRY_DELAY_MS * retries);
    }
  }

  throw new Error('Failed to create embeddings after retries');
}

/**
 * Store embeddings in database
 */
async function storeEmbeddings(
  client: any,
  municipalityId: number,
  document: PDMDocument,
  chunks: string[],
  embeddings: number[][]
): Promise<void> {
  console.log(`  Storing ${embeddings.length} embeddings in database...`);

  for (let i = 0; i < embeddings.length; i++) {
    const metadata = {
      municipality_id: municipalityId,
      document_type: document.documentType,
      total_chunks: chunks.length,
      chunk_size: CHUNK_SIZE,
      chunk_overlap: CHUNK_OVERLAP,
      embedding_model: EMBEDDING_MODEL,
    };

    await client.query(
      `INSERT INTO pdm_document_embeddings 
        (municipality_id, document_id, document_url, document_title, 
         chunk_index, chunk_text, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (document_id, chunk_index) 
       DO UPDATE SET
         chunk_text = EXCLUDED.chunk_text,
         embedding = EXCLUDED.embedding,
         metadata = EXCLUDED.metadata,
         updated_at = CURRENT_TIMESTAMP`,
      [
        municipalityId,
        document.id,
        document.url,
        document.title,
        i,
        chunks[i],
        JSON.stringify(embeddings[i]), // pgvector accepts JSON array
        JSON.stringify(metadata),
      ]
    );
  }

  console.log(`  ✓ Successfully stored embeddings`);
}

/**
 * Process a single PDM document
 */
async function processDocument(
  client: any,
  openai: OpenAI,
  municipality: MunicipalityWithDocuments,
  document: PDMDocument,
  options?: { forceRefresh?: boolean }
): Promise<boolean> {
  console.log(`\nProcessing: ${document.title}`);
  console.log(`  Municipality: ${municipality.name}`);
  console.log(`  URL: ${document.url}`);

  try {
    // Check if already processed (unless force refresh)
    if (!options?.forceRefresh) {
      const alreadyProcessed = await hasEmbeddings(client, document.id);
      if (alreadyProcessed) {
        console.log(`  ⚠ Skipping - embeddings already exist (use forceRefresh to override)`);
        return false;
      }
    } else {
      console.log(`  🔄 Force refresh enabled - deleting existing embeddings...`);
      await client.query('DELETE FROM pdm_document_embeddings WHERE document_id = $1', [document.id]);
    }

    // Download PDF
    const pdfBuffer = await downloadPDF(document.url);

    // Extract text
    const text = await extractTextFromPDF(pdfBuffer);

    if (text.length < 100) {
      console.warn(`  ⚠ Skipping - insufficient text extracted (${text.length} chars)`);
      return false;
    }

    // Chunk text
    let chunks: string[];
    try {
      chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
    } catch (error: any) {
      console.error(`  ✗ Error chunking text: ${error.message}`);
      console.error(`  Text length: ${text.length}, Chunk size: ${CHUNK_SIZE}, Overlap: ${CHUNK_OVERLAP}`);
      throw error;
    }

    if (chunks.length === 0) {
      console.warn(`  ⚠ Skipping - no valid chunks created`);
      return false;
    }

    // Create embeddings in batches (OpenAI allows up to 2048 per request)
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
      const progress = Math.round((i / chunks.length) * 100);
      
      console.log(`  [${progress}%] Creating embeddings for ${batch.length} chunks (${i + batch.length}/${chunks.length})...`);
      const embeddings = await createEmbeddings(openai, batch);
      allEmbeddings.push(...embeddings);
      
      console.log(`  ✓ Created ${embeddings.length} embeddings`);
      
      // Small delay to avoid rate limits
      if (i + batchSize < chunks.length) {
        await sleep(1000);
      }
    }
    console.log(`  [100%] All embeddings created!`);

    // Store in database
    await storeEmbeddings(client, municipality.id, document, chunks, allEmbeddings);

    return true;
  } catch (error: any) {
    console.error(`  ✗ Error processing document:`, error.message);
    return false;
  }
}

/**
 * Main enrichment function
 */
export async function enrichPDMDocumentsWithEmbeddings(options?: {
  municipalityIds?: number[];
  forceRefresh?: boolean;
}): Promise<void> {
  assertEnv();

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });

  console.log('=== PDM Document Embeddings Enrichment ===\n');
  console.log(`Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`Chunk size: ${CHUNK_SIZE} characters`);
  console.log(`Chunk overlap: ${CHUNK_OVERLAP} characters\n`);

  const client = await pool.connect();

  try {
    // Fetch municipalities with documents
    const municipalities = await fetchMunicipalitiesWithDocuments(
      client,
      options?.municipalityIds
    );

    if (municipalities.length === 0) {
      console.log('No municipalities with PDM documents found.');
      return;
    }

    console.log(`Found ${municipalities.length} municipalities with PDM documents\n`);

    let totalDocuments = 0;
    let processedDocuments = 0;
    let skippedDocuments = 0;
    let failedDocuments = 0;

    for (const municipality of municipalities) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Municipality: ${municipality.name} (ID: ${municipality.id})`);
      console.log(`Documents: ${municipality.documents.length}`);
      console.log('='.repeat(60));

      for (const document of municipality.documents) {
        totalDocuments++;

        const success = await processDocument(client, openai, municipality, document, options);

        if (success) {
          processedDocuments++;
        } else {
          skippedDocuments++;
        }

        // Delay between documents
        await sleep(2000);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('=== PDM Embeddings Enrichment Complete ===');
    console.log(`Total documents: ${totalDocuments}`);
    console.log(`Processed: ${processedDocuments}`);
    console.log(`Skipped: ${skippedDocuments}`);
    console.log(`Failed: ${failedDocuments}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error in PDM embeddings enrichment:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
