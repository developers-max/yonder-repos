-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for PDM document embeddings
-- Using text-embedding-3-small which has 1536 dimensions
CREATE TABLE IF NOT EXISTS pdm_document_embeddings (
  id BIGSERIAL PRIMARY KEY,
  municipality_id INTEGER NOT NULL,
  document_id VARCHAR(255) NOT NULL,
  document_url TEXT NOT NULL,
  document_title TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key to municipalities table
  CONSTRAINT fk_municipality
    FOREIGN KEY (municipality_id)
    REFERENCES municipalities(id)
    ON DELETE CASCADE,
    
  -- Ensure unique chunks per document
  CONSTRAINT unique_document_chunk
    UNIQUE (document_id, chunk_index)
);

-- Create IVFFlat index for fast similarity searches using cosine distance
-- lists = 100 is good for up to 1M vectors (adjust based on dataset size)
CREATE INDEX IF NOT EXISTS idx_pdm_embeddings_vector 
  ON pdm_document_embeddings 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pdm_embeddings_municipality 
  ON pdm_document_embeddings(municipality_id);

CREATE INDEX IF NOT EXISTS idx_pdm_embeddings_document 
  ON pdm_document_embeddings(document_id);

CREATE INDEX IF NOT EXISTS idx_pdm_embeddings_created_at 
  ON pdm_document_embeddings(created_at DESC);

-- Create GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_pdm_embeddings_metadata 
  ON pdm_document_embeddings USING gin(metadata);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pdm_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_pdm_embeddings_updated_at 
  ON pdm_document_embeddings;
  
CREATE TRIGGER trigger_update_pdm_embeddings_updated_at
  BEFORE UPDATE ON pdm_document_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_pdm_embeddings_updated_at();

-- View for easy querying of documents with their embeddings count
CREATE OR REPLACE VIEW pdm_documents_summary AS
SELECT 
  m.id as municipality_id,
  m.name as municipality_name,
  pde.document_id,
  pde.document_title,
  pde.document_url,
  COUNT(pde.id) as chunk_count,
  MIN(pde.created_at) as first_embedded_at,
  MAX(pde.updated_at) as last_updated_at
FROM pdm_document_embeddings pde
JOIN municipalities m ON pde.municipality_id = m.id
GROUP BY m.id, m.name, pde.document_id, pde.document_title, pde.document_url;

COMMENT ON TABLE pdm_document_embeddings IS 'Stores embeddings for PDM (urban planning) documents, chunked for vector similarity search';
COMMENT ON COLUMN pdm_document_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN pdm_document_embeddings.chunk_index IS 'Sequential index of this chunk within the document (0-based)';
COMMENT ON COLUMN pdm_document_embeddings.metadata IS 'Additional metadata: {page_number, section, total_chunks, etc}';
