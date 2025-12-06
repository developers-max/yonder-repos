import dotenv from 'dotenv';
import { Pool } from 'pg';
import { OpenAI } from 'openai';
import { translateQueryIfNeeded } from './query_translator';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const COHERE_API_KEY = process.env.COHERE_API_KEY || ''; // Optional for reranking

// Phase 2 & 3 Advanced Configuration
const ADVANCED_RAG_CONFIG = {
  // LLM Settings
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 800,
  topP: 0.9,
  
  // Retrieval Settings
  baseTopK: 5,
  candidateMultiplier: 4, // Retrieve 4x candidates for reranking
  similarityThreshold: 0.20, // Lowered for hybrid search
  
  // Hybrid Search Weights
  semanticWeight: 0.7,  // 70% weight on semantic similarity
  keywordWeight: 0.3,   // 30% weight on BM25 keyword matching
  
  // Features
  useHybridSearch: true,
  useDynamicTopK: true,
  useQueryClassification: true,
  useQueryTranslation: true,  // Translate queries to match document language
  useReranking: false, // Set to true if Cohere API key available
  
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
  keyword_rank?: number;
  combined_score?: number;
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
    searchMethod: string;
    queryClass?: string;
  };
}

/**
 * Phase 3: Query Classification
 * Determine if query needs retrieval and what type
 */
function classifyQuery(question: string): {
  needsRetrieval: boolean;
  queryType: 'simple' | 'complex' | 'code_lookup' | 'comparative';
  suggestedTopK: number;
} {
  const lowerQ = question.toLowerCase();
  
  // Check for code/reference patterns
  const hasCodePattern = /\b\d+[a-z]\d+\b|code\s+\d+|clau\s+\d+|qualificació\s+\d+/i.test(question);
  if (hasCodePattern) {
    return {
      needsRetrieval: true,
      queryType: 'code_lookup',
      suggestedTopK: 3, // Fewer chunks for specific codes
    };
  }
  
  // Check for comparative questions
  const isComparative = /compar|differ|versus|vs\.|entre|distinció/i.test(question);
  if (isComparative) {
    return {
      needsRetrieval: true,
      queryType: 'comparative',
      suggestedTopK: 10, // More chunks to compare
    };
  }
  
  // Check for complex questions (long or with multiple clauses)
  const isComplex = question.length > 100 || question.split(/[,;]/).length > 2;
  if (isComplex) {
    return {
      needsRetrieval: true,
      queryType: 'complex',
      suggestedTopK: 7,
    };
  }
  
  // Simple questions
  return {
    needsRetrieval: true,
    queryType: 'simple',
    suggestedTopK: 5,
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
    model: ADVANCED_RAG_CONFIG.embeddingModel,
    input: question,
  });
  
  return response.data[0].embedding;
}

/**
 * Phase 2: Hybrid Search - Semantic + BM25 Keyword
 */
async function hybridSearch(
  client: any,
  municipalityId: number,
  question: string,
  queryEmbedding: number[],
  topK: number
): Promise<RelevantChunk[]> {
  const { semanticWeight, keywordWeight } = ADVANCED_RAG_CONFIG;
  
  // Extract key terms for keyword search
  const keyTerms = question.replace(/[^\w\s]/g, ' ').trim();
  
  const query = `
    WITH semantic_results AS (
      SELECT 
        pde.id,
        pde.chunk_index,
        pde.chunk_text,
        pde.document_title,
        pde.document_url,
        m.name as municipality_name,
        1 - (pde.embedding <=> $1::vector) as similarity,
        0 as keyword_rank
      FROM pdm_document_embeddings pde
      JOIN municipalities m ON pde.municipality_id = m.id
      WHERE pde.municipality_id = $2
      ORDER BY pde.embedding <=> $1::vector
      LIMIT $3
    ),
    keyword_results AS (
      SELECT 
        pde.id,
        pde.chunk_index,
        pde.chunk_text,
        pde.document_title,
        pde.document_url,
        m.name as municipality_name,
        0 as similarity,
        ts_rank(pde.fts_document, plainto_tsquery('simple', $4)) as keyword_rank
      FROM pdm_document_embeddings pde
      JOIN municipalities m ON pde.municipality_id = m.id
      WHERE pde.municipality_id = $2
        AND pde.fts_document @@ plainto_tsquery('simple', $4)
      ORDER BY keyword_rank DESC
      LIMIT $3
    ),
    combined AS (
      SELECT DISTINCT ON (id)
        id, chunk_index, chunk_text, document_title, document_url, municipality_name,
        COALESCE(semantic_results.similarity, 0) as similarity,
        COALESCE(keyword_results.keyword_rank, 0) as keyword_rank
      FROM (
        SELECT * FROM semantic_results
        UNION ALL
        SELECT * FROM keyword_results
      ) all_results
      ORDER BY id, similarity DESC, keyword_rank DESC
    )
    SELECT 
      chunk_index,
      chunk_text,
      document_title,
      document_url,
      municipality_name,
      similarity,
      keyword_rank,
      ($5 * similarity + $6 * keyword_rank) as combined_score
    FROM combined
    WHERE ($5 * similarity + $6 * keyword_rank) > $7
    ORDER BY combined_score DESC
    LIMIT $8
  `;

  const { rows } = await client.query(query, [
    JSON.stringify(queryEmbedding),
    municipalityId,
    topK * ADVANCED_RAG_CONFIG.candidateMultiplier, // Get more candidates
    keyTerms,
    semanticWeight,
    keywordWeight,
    ADVANCED_RAG_CONFIG.similarityThreshold,
    topK
  ]);

  return rows;
}

/**
 * Fallback: Pure semantic search (if hybrid fails)
 */
async function semanticSearch(
  client: any,
  municipalityId: number,
  queryEmbedding: number[],
  topK: number
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
    ADVANCED_RAG_CONFIG.similarityThreshold,
    topK
  ]);

  return rows;
}

/**
 * Phase 3: Simple Reranking (without external service)
 * Sorts by combined score and filters low-quality matches
 */
function rerankChunks(chunks: RelevantChunk[], topK: number): RelevantChunk[] {
  // Sort by combined_score (if available) or similarity
  const sorted = chunks.sort((a, b) => {
    const scoreA = a.combined_score || a.similarity;
    const scoreB = b.combined_score || b.similarity;
    return scoreB - scoreA;
  });
  
  // Filter out very low scores
  const filtered = sorted.filter(chunk => {
    const score = chunk.combined_score || chunk.similarity;
    return score > 0.15; // Minimum quality threshold
  });
  
  return filtered.slice(0, topK);
}

/**
 * Generate answer using LLM with retrieved context
 */
async function generateAnswer(
  openai: OpenAI,
  question: string,
  chunks: RelevantChunk[],
  municipalityName: string
): Promise<{ answer: string; tokensUsed: number }> {
  const context = chunks
    .map((chunk, idx) => {
      const scoreInfo = chunk.combined_score 
        ? `Relevance: ${(chunk.combined_score * 100).toFixed(1)}%`
        : `Similarity: ${(chunk.similarity * 100).toFixed(1)}%`;
      return `[Source ${idx + 1}] (${scoreInfo})\n${chunk.document_title} - Chunk ${chunk.chunk_index}:\n${chunk.chunk_text}`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `You are an expert urban planning assistant for ${municipalityName} municipality. 
Your role is to answer questions about municipal planning regulations, zoning, and urban development based ONLY on the provided document excerpts.

Guidelines:
1. Only use information from the provided sources
2. Cite sources using [Source N] format
3. If the answer isn't in the sources, say "I don't have enough information in the available documents to answer this question."
4. Be precise and refer to specific regulations when applicable
5. Use technical planning terminology appropriately
6. If sources mention codes or classifications, include them in your answer
7. If multiple sources contradict, mention the discrepancy`;

  const userPrompt = `Context from planning documents:\n\n${context}\n\n---\n\nQuestion: ${question}\n\nAnswer:`;

  const response = await openai.chat.completions.create({
    model: ADVANCED_RAG_CONFIG.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: ADVANCED_RAG_CONFIG.temperature,
    max_tokens: ADVANCED_RAG_CONFIG.maxTokens,
    top_p: ADVANCED_RAG_CONFIG.topP,
  });

  return {
    answer: response.choices[0].message.content || '',
    tokensUsed: response.usage?.total_tokens || 0,
  };
}

/**
 * Main Advanced RAG function with Phase 2 & 3 optimizations
 */
export async function askMunicipalityQuestionAdvanced(
  municipalityId: number,
  question: string,
  options?: {
    topK?: number;
    verbose?: boolean;
    forceSemanticOnly?: boolean;
  }
): Promise<RAGResponse> {
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
      console.log(`\n🔍 Advanced RAG Query - ${municipalityName}`);
      console.log(`Question: "${question}"`);
      console.log(`\nPhase 2 & 3 Optimizations Active:`);
    }

    // Optional: Query Translation
    let queryForSearch = question;
    let translationInfo;
    
    if (ADVANCED_RAG_CONFIG.useQueryTranslation) {
      translationInfo = await translateQueryIfNeeded(
        openai,
        question,
        municipalityId,
        { verbose }
      );
      queryForSearch = translationInfo.translatedQuery;
      
      if (verbose && translationInfo.wasTranslated) {
        console.log(`  ✓ Query translated: ${translationInfo.sourceLanguage} → ${translationInfo.targetLanguage}`);
      }
    }

    // Phase 3: Query Classification
    let queryClass;
    let topK = options?.topK || ADVANCED_RAG_CONFIG.baseTopK;
    
    if (ADVANCED_RAG_CONFIG.useQueryClassification && !options?.topK) {
      queryClass = classifyQuery(question);
      topK = queryClass.suggestedTopK;
      
      if (verbose) {
        console.log(`  ✓ Query classification: ${queryClass.queryType}`);
        console.log(`  ✓ Dynamic Top-K: ${topK}`);
      }
    }

    if (verbose) {
      console.log(`  ✓ Hybrid search: ${ADVANCED_RAG_CONFIG.useHybridSearch ? 'enabled' : 'disabled'}`);
      console.log(`  ✓ Model: ${ADVANCED_RAG_CONFIG.model}\n`);
    }

    // Step 1: Create embedding for question (using translated query if available)
    if (verbose) console.log('1. Creating question embedding...');
    const queryEmbedding = await createQueryEmbedding(openai, queryForSearch);

    // Step 2: Retrieve with hybrid or semantic search
    if (verbose) console.log(`2. Retrieving chunks with ${ADVANCED_RAG_CONFIG.useHybridSearch && !options?.forceSemanticOnly ? 'hybrid' : 'semantic'} search...`);
    
    let relevantChunks: RelevantChunk[];
    let searchMethod: string;
    
    if (ADVANCED_RAG_CONFIG.useHybridSearch && !options?.forceSemanticOnly) {
      try {
        relevantChunks = await hybridSearch(client, municipalityId, queryForSearch, queryEmbedding, topK);
        searchMethod = 'hybrid (semantic + BM25)';
      } catch (error) {
        if (verbose) console.log('   Hybrid search failed, falling back to semantic...');
        relevantChunks = await semanticSearch(client, municipalityId, queryEmbedding, topK);
        searchMethod = 'semantic (fallback)';
      }
    } else {
      relevantChunks = await semanticSearch(client, municipalityId, queryEmbedding, topK);
      searchMethod = 'semantic only';
    }

    // Step 3: Rerank results
    if (relevantChunks.length > topK) {
      if (verbose) console.log('3. Reranking results...');
      relevantChunks = rerankChunks(relevantChunks, topK);
    }

    if (relevantChunks.length === 0) {
      const response: RAGResponse = {
        answer: `I don't have enough information in the available documents to answer this question. No chunks met the relevance threshold.`,
        sources: [],
        municipalityName,
        metadata: {
          topK,
          avgSimilarity: 0,
          model: ADVANCED_RAG_CONFIG.model,
          searchMethod,
          queryClass: queryClass?.queryType,
        }
      };
      
      client.release();
      await pool.end();
      return response;
    }

    if (verbose) {
      console.log(`   Found ${relevantChunks.length} relevant chunks:`);
      relevantChunks.forEach((chunk, idx) => {
        const score = chunk.combined_score || chunk.similarity;
        console.log(`   [${idx + 1}] Score: ${(score * 100).toFixed(1)}% | ${chunk.document_title.slice(0, 50)}...`);
      });
    }

    // Step 4: Generate answer with LLM
    if (verbose) console.log(`${relevantChunks.length > topK ? '4' : '3'}. Generating answer with ${ADVANCED_RAG_CONFIG.model}...`);
    const { answer, tokensUsed } = await generateAnswer(
      openai,
      question,
      relevantChunks,
      municipalityName
    );

    if (verbose) {
      console.log(`\n✅ Answer generated!`);
      console.log(`   Tokens used: ${tokensUsed}`);
      console.log(`   Search method: ${searchMethod}`);
      console.log(`   Estimated cost: $${(tokensUsed * 0.00015 / 1000).toFixed(5)}`);
    }

    const avgSimilarity = relevantChunks.reduce((sum, c) => {
      return sum + (c.combined_score || c.similarity);
    }, 0) / relevantChunks.length;

    client.release();
    await pool.end();

    return {
      answer,
      sources: relevantChunks,
      municipalityName,
      metadata: {
        topK,
        avgSimilarity,
        model: ADVANCED_RAG_CONFIG.model,
        tokensUsed,
        searchMethod,
        queryClass: queryClass?.queryType,
      }
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

/**
 * Get advanced configuration info
 */
export function getAdvancedRAGConfig() {
  return {
    ...ADVANCED_RAG_CONFIG,
    phase: 'Phase 2 & 3 - Advanced Optimizations',
    optimizations: [
      'Hybrid search (semantic + BM25)',
      'Dynamic Top-K based on query type',
      'Query classification',
      'Query translation (cross-language support)',
      'Improved reranking',
      'Lower similarity threshold (0.20)',
      `Semantic weight: ${ADVANCED_RAG_CONFIG.semanticWeight * 100}%`,
      `Keyword weight: ${ADVANCED_RAG_CONFIG.keywordWeight * 100}%`,
    ]
  };
}

// Export for backward compatibility
export { askMunicipalityQuestionAdvanced as askMunicipalityQuestion };
