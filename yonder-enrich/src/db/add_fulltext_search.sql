-- Phase 2 Optimization: Add full-text search for hybrid retrieval
-- This enables BM25 keyword search alongside semantic vector search

-- Add full-text search column for Catalan documents
ALTER TABLE pdm_document_embeddings 
ADD COLUMN IF NOT EXISTS fts_document tsvector 
GENERATED ALWAYS AS (
  to_tsvector('simple', chunk_text)  -- 'simple' works for multi-language
) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_pdm_fts_document 
ON pdm_document_embeddings USING GIN(fts_document);

-- Add helpful comment
COMMENT ON COLUMN pdm_document_embeddings.fts_document 
IS 'Full-text search vector for BM25 keyword matching (Phase 2 optimization)';

-- Test query to verify it works
-- SELECT chunk_text, ts_rank(fts_document, plainto_tsquery('simple', '13c1')) as rank
-- FROM pdm_document_embeddings
-- WHERE fts_document @@ plainto_tsquery('simple', '13c1')
-- ORDER BY rank DESC
-- LIMIT 5;
