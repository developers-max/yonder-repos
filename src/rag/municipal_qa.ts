import dotenv from 'dotenv';
import { Pool } from 'pg';
import { OpenAI } from 'openai';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Phase 1 Optimizations (RAG_OPTIMIZATION.md)
const RAG_CONFIG = {
  // LLM Settings (gpt-4o-mini for cost/performance)
  model: 'gpt-4o-mini',
  temperature: 0.2,        // Low for factual answers
  maxTokens: 800,          // Room for detailed responses
  topP: 0.9,              // Slightly restrict randomness
  
  // Retrieval Settings
  topK: 5,                 // Number of chunks to retrieve
  similarityThreshold: 0.25, // Minimum similarity score (lowered for cross-language queries)
  
  // Embedding
  embeddingModel: 'text-embedding-3-small',
};

interface RelevantChunk {
  chunk_index: number;
  chunk_text: string;
  document_title: string;
  document_url: string;
  municipality_name: string;
  similarity: number;
}

interface RAGResponse {
  answer: string;
  sources: RelevantChunk[];
  municipalityName: string;
  metadata: {
    topK: number;
    avgSimilarity: number;
    model: string;
    tokensUsed?: number;
  };
}

/**
 * Create embedding for a user question
 */
async function createQueryEmbedding(
  openai: OpenAI,
  question: string
): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: RAG_CONFIG.embeddingModel,
    input: question,
  });
  
  return response.data[0].embedding;
}

/**
 * Find relevant document chunks using similarity search with threshold
 * OPTIMIZED: Added similarity threshold filter (Phase 1)
 */
async function findRelevantChunks(
  client: any,
  municipalityId: number,
  queryEmbedding: number[],
  topK: number = RAG_CONFIG.topK
): Promise<RelevantChunk[]> {
  const query = `
    SELECT 
      pde.chunk_index,
      pde.chunk_text,
      pde.document_title,
      pde.document_url,
      m.name as municipality_name,
      1 - (pde.embedding <=> $1::vector) as similarity
    FROM pdm_document_embeddings pde
    JOIN municipalities m ON pde.municipality_id = m.id
    WHERE pde.municipality_id = $2
      AND 1 - (pde.embedding <=> $1::vector) > $3
    ORDER BY pde.embedding <=> $1::vector
    LIMIT $4
  `;

  const { rows } = await client.query(query, [
    JSON.stringify(queryEmbedding),
    municipalityId,
    RAG_CONFIG.similarityThreshold,  // Phase 1: Add threshold
    topK
  ]);

  return rows;
}

/**
 * Generate answer using LLM with retrieved context
 * OPTIMIZED: Using gpt-4o-mini with optimal parameters (Phase 1)
 */
async function generateAnswer(
  openai: OpenAI,
  question: string,
  chunks: RelevantChunk[],
  municipalityName: string
): Promise<{ answer: string; tokensUsed: number }> {
  // Build context from retrieved chunks
  const context = chunks
    .map((chunk, idx) => 
      `[Source ${idx + 1}] ${chunk.document_title} (Chunk ${chunk.chunk_index}):\n${chunk.chunk_text}`
    )
    .join('\n\n---\n\n');

  const systemPrompt = `You are an expert urban planning assistant for ${municipalityName} municipality. 
Your role is to answer questions about municipal planning regulations, zoning, and urban development based ONLY on the provided document excerpts.

Guidelines:
1. Only use information from the provided sources
2. Cite sources using [Source N] format
3. If the answer isn't in the sources, say "I don't have enough information in the available documents to answer this question."
4. Be precise and refer to specific regulations when applicable
5. Use technical planning terminology appropriately
6. If multiple sources contradict, mention the discrepancy`;

  const userPrompt = `Context from planning documents:\n\n${context}\n\n---\n\nQuestion: ${question}\n\nAnswer:`;

  // Phase 1 Optimization: Use gpt-4o-mini with optimal parameters
  const response = await openai.chat.completions.create({
    model: RAG_CONFIG.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: RAG_CONFIG.temperature,
    max_tokens: RAG_CONFIG.maxTokens,
    top_p: RAG_CONFIG.topP,
  });

  return {
    answer: response.choices[0].message.content || '',
    tokensUsed: response.usage?.total_tokens || 0,
  };
}

/**
 * Main RAG function: Answer a question about a municipality
 * PHASE 1 OPTIMIZED VERSION
 */
export async function askMunicipalityQuestion(
  municipalityId: number,
  question: string,
  options?: {
    topK?: number;
    verbose?: boolean;
  }
): Promise<RAGResponse> {
  const topK = options?.topK || RAG_CONFIG.topK;
  const verbose = options?.verbose || false;

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const client = await pool.connect();

    // Get municipality name
    const { rows: [municipality] } = await client.query(
      'SELECT name FROM municipalities WHERE id = $1',
      [municipalityId]
    );

    if (!municipality) {
      throw new Error(`Municipality with ID ${municipalityId} not found`);
    }

    const municipalityName = municipality.name;

    if (verbose) {
      console.log(`\n🔍 RAG Query - ${municipalityName}`);
      console.log(`Question: "${question}"`);
      console.log(`\nPhase 1 Optimizations:`);
      console.log(`  ✓ Model: ${RAG_CONFIG.model}`);
      console.log(`  ✓ Temperature: ${RAG_CONFIG.temperature}`);
      console.log(`  ✓ Similarity threshold: ${RAG_CONFIG.similarityThreshold}`);
      console.log(`  ✓ Top-K: ${topK}\n`);
    }

    // Step 1: Create embedding for question
    if (verbose) console.log('1. Creating question embedding...');
    const queryEmbedding = await createQueryEmbedding(openai, question);

    // Step 2: Find relevant chunks with similarity threshold
    if (verbose) console.log(`2. Finding top ${topK} relevant chunks (similarity > ${RAG_CONFIG.similarityThreshold})...`);
    const relevantChunks = await findRelevantChunks(
      client,
      municipalityId,
      queryEmbedding,
      topK
    );

    if (relevantChunks.length === 0) {
      const response: RAGResponse = {
        answer: `I don't have enough information in the available documents to answer this question. The retrieved chunks did not meet the similarity threshold of ${RAG_CONFIG.similarityThreshold}.`,
        sources: [],
        municipalityName,
        metadata: {
          topK,
          avgSimilarity: 0,
          model: RAG_CONFIG.model,
        }
      };
      
      client.release();
      await pool.end();
      return response;
    }

    if (verbose) {
      console.log(`   Found ${relevantChunks.length} relevant chunks:`);
      relevantChunks.forEach((chunk, idx) => {
        console.log(`   [${idx + 1}] Similarity: ${(chunk.similarity * 100).toFixed(1)}% | ${chunk.document_title.slice(0, 50)}...`);
      });
    }

    // Step 3: Generate answer with LLM
    if (verbose) console.log('3. Generating answer with gpt-4o-mini...');
    const { answer, tokensUsed } = await generateAnswer(
      openai,
      question,
      relevantChunks,
      municipalityName
    );

    if (verbose) {
      console.log(`\n✅ Answer generated!`);
      console.log(`   Tokens used: ${tokensUsed}`);
      console.log(`   Estimated cost: $${(tokensUsed * 0.00015 / 1000).toFixed(5)}`);
    }

    const avgSimilarity = relevantChunks.reduce((sum, c) => sum + c.similarity, 0) / relevantChunks.length;

    client.release();
    await pool.end();

    return {
      answer,
      sources: relevantChunks,
      municipalityName,
      metadata: {
        topK,
        avgSimilarity,
        model: RAG_CONFIG.model,
        tokensUsed,
      }
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

/**
 * Batch process multiple questions
 */
export async function askMultipleQuestions(
  municipalityId: number,
  questions: string[],
  options?: { verbose?: boolean }
): Promise<RAGResponse[]> {
  const results: RAGResponse[] = [];

  for (const question of questions) {
    console.log(`\nProcessing: "${question}"`);
    const response = await askMunicipalityQuestion(municipalityId, question, options);
    results.push(response);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * Get configuration info
 */
export function getRAGConfig() {
  return {
    ...RAG_CONFIG,
    phase: 'Phase 1 - Quick Wins',
    optimizations: [
      'gpt-4o-mini (79% cost reduction)',
      'Similarity threshold (0.7)',
      'Optimized temperature (0.2)',
      'Increased max tokens (800)',
    ]
  };
}
