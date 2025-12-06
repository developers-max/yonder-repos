# PDM Document Embeddings with OpenAI & pgvector

Generate and store vector embeddings from municipal planning documents (PDM) for semantic search and AI applications.

## Overview

This enrichment:
1. **Extracts text** from PDM PDF documents
2. **Chunks text** into manageable pieces (1000 chars with 200 char overlap)
3. **Creates embeddings** using OpenAI's `text-embedding-3-small` model
4. **Stores in PostgreSQL** with pgvector for fast similarity search

## Architecture

```
PDF Document → Text Extraction → Text Chunking → OpenAI Embeddings → PostgreSQL (pgvector)
```

### Database Schema

```sql
pdm_document_embeddings
├── id (bigserial)
├── municipality_id (integer) → municipalities.id
├── document_id (varchar)
├── document_url (text)
├── document_title (text)
├── chunk_index (integer)
├── chunk_text (text)
├── embedding (vector(1536))  -- pgvector
├── metadata (jsonb)
└── timestamps
```

### Key Features

- ✓ Automatic chunking with overlap (maintains context)
- ✓ Batch processing (100 chunks per API call)
- ✓ Rate limiting and retry logic
- ✓ Skip already-processed documents
- ✓ IVFFlat index for fast similarity search
- ✓ Metadata tracking (document type, chunk info, etc.)

## Setup

### 1. Install Dependencies

```bash
chmod +x install-embeddings-deps.sh
./install-embeddings-deps.sh
```

This installs:
- `pdf-parse@2.4.5` - PDF text extraction
- `openai@^4.70.0` - OpenAI SDK
- `@types/pdf-parse` - TypeScript types

### 2. Enable pgvector in PostgreSQL

Connect to your database and run:

```bash
psql $DATABASE_URL -f src/db/enable_pgvector.sql
```

Or manually:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Configure Environment

Add to your `.env` file:

```bash
# Required
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...

# Optional tuning
EMBEDDING_CHUNK_SIZE=1000          # Characters per chunk
EMBEDDING_CHUNK_OVERLAP=200        # Overlap between chunks
EMBEDDING_MODEL=text-embedding-3-small  # Or text-embedding-3-large
```

## Usage

### Test with Alella

Process only Alella's POUM document:

```bash
npm run test-alella-embeddings
```

### Process All Municipalities

Process all municipalities with PDM documents:

```bash
npm run pdm-embeddings
```

### Process Specific Municipalities

```typescript
import { enrichPDMDocumentsWithEmbeddings } from './enrichments/pdm-embeddings';

await enrichPDMDocumentsWithEmbeddings({
  municipalityIds: [401, 402, 403], // Specific IDs
});
```

## How It Works

### 1. PDF Download
```typescript
const pdfBuffer = await downloadPDF(document.url);
// Downloads PDF from URL (e.g., Alella's POUM)
```

### 2. Text Extraction
```typescript
const text = await extractTextFromPDF(pdfBuffer);
// Extracts raw text using pdf-parse
```

### 3. Chunking
```typescript
const chunks = chunkText(text, 1000, 200);
// Splits into overlapping chunks:
// Chunk 1: chars 0-1000
// Chunk 2: chars 800-1800
// Chunk 3: chars 1600-2600
// ...
```

### 4. Embedding Creation
```typescript
const embeddings = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: chunks,
});
// Returns 1536-dimensional vectors
```

### 5. Storage
```typescript
await storeEmbeddings(client, municipalityId, document, chunks, embeddings);
// Stores in pdm_document_embeddings table
```

## Querying Embeddings

### Semantic Search

Find similar document chunks:

```sql
-- Find chunks similar to a query
WITH query_embedding AS (
  SELECT embedding FROM pdm_document_embeddings 
  WHERE id = 123  -- Or generate embedding for new text
)
SELECT 
  pde.document_title,
  pde.chunk_text,
  pde.chunk_index,
  1 - (pde.embedding <=> query_embedding.embedding) as similarity
FROM pdm_document_embeddings pde, query_embedding
WHERE pde.municipality_id = 401
ORDER BY pde.embedding <=> query_embedding.embedding
LIMIT 10;
```

### Filter by Municipality

```sql
SELECT 
  m.name as municipality,
  pde.document_title,
  COUNT(*) as chunks
FROM pdm_document_embeddings pde
JOIN municipalities m ON pde.municipality_id = m.id
WHERE m.name = 'Alella'
GROUP BY m.name, pde.document_title;
```

### Summary View

```sql
SELECT * FROM pdm_documents_summary
WHERE municipality_name = 'Alella';
```

Returns:
- Municipality info
- Document metadata
- Chunk count
- Timestamps

## Performance

### Chunking Strategy

| Chunk Size | Overlap | Pros | Cons |
|------------|---------|------|------|
| 500 chars  | 100     | More granular | More API calls, higher cost |
| **1000 chars** | **200** | **Balanced (recommended)** | **Good context + cost** |
| 2000 chars | 400     | Fewer API calls | Less precise matching |

### Cost Estimation

Using `text-embedding-3-small`:
- **$0.02 per 1M tokens** (OpenAI pricing)
- Average document (50 pages): ~75,000 characters
- ~75 chunks @ 1000 chars each
- Cost per document: **~$0.0015** (less than 1 cent)

For 100 municipalities with 1-3 docs each: **~$0.30-$0.45**

### Index Performance

IVFFlat index with `lists=100`:
- Good for up to 1M vectors
- Query time: <100ms for similarity search
- Build time: ~1s per 10k vectors

Adjust `lists` based on dataset size:
```sql
-- For larger datasets (>100k vectors)
CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 500);
```

## Troubleshooting

### pgvector Not Installed

**Error**: `extension "vector" does not exist`

**Fix**: Run the SQL setup script or install pgvector extension

```bash
# On Ubuntu/Debian
sudo apt-get install postgresql-16-pgvector

# On macOS with Homebrew
brew install pgvector

# Or use managed database with pgvector support (Supabase, Timescale, etc.)
```

### PDF Download Fails

**Error**: `ENOTFOUND` or timeout

**Fix**: Check document URL is accessible:
```bash
curl -I "https://alella.cat/ARXIUS/.../document.pdf"
```

### Text Extraction Issues

**Error**: PDF extracts very little text

**Cause**: PDF might be scanned images (no extractable text)

**Solution**: Consider using OCR (Tesseract.js) for scanned PDFs

### OpenAI Rate Limits

**Error**: `Rate limit exceeded`

**Fix**: Add delays between batches (already implemented) or reduce concurrency

### Memory Issues

**Error**: JavaScript heap out of memory

**Fix**: Increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run pdm-embeddings
```

## Advanced Usage

### Custom Chunking

```typescript
// In your code
const CUSTOM_CHUNK_SIZE = 1500;
const CUSTOM_OVERLAP = 300;
const chunks = chunkText(text, CUSTOM_CHUNK_SIZE, CUSTOM_OVERLAP);
```

### Using Different Embedding Models

```typescript
// text-embedding-3-large (3072 dimensions, more accurate, 5x cost)
const EMBEDDING_MODEL = 'text-embedding-3-large';

// Update table schema:
ALTER TABLE pdm_document_embeddings 
ALTER COLUMN embedding TYPE vector(3072);
```

### Filtering by Document Type

```sql
SELECT * FROM pdm_document_embeddings
WHERE metadata->>'document_type' = 'pdm';
```

### RAG (Retrieval Augmented Generation)

Use embeddings for context in LLM prompts:

```typescript
// 1. Find relevant chunks
const relevantChunks = await findSimilarChunks(query, municipalityId, limit=5);

// 2. Build context
const context = relevantChunks.map(c => c.chunk_text).join('\n\n');

// 3. Generate with LLM
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are an urban planning expert.' },
    { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
  ]
});
```

## Example: Alella POUM

**Document**: Pla d'Ordenació Urbanística Municipal 2014 - Normativa i Agenda

**URL**: `https://alella.cat/ARXIUS/2010_2015/2014/POUM2014/III_normativa_i_agenda_1de2.pdf`

**Processing**:
1. Downloads 218-page PDF (~2MB)
2. Extracts ~150,000 characters
3. Creates ~150 chunks
4. Generates 150 embeddings
5. Stores in database with metadata

**Query Example**:
```sql
SELECT chunk_text, chunk_index
FROM pdm_document_embeddings
WHERE municipality_id = 401
  AND document_id = 'POUM-2014'
ORDER BY chunk_index
LIMIT 5;
```

## Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pdf-parse NPM Package](https://www.npmjs.com/package/pdf-parse)
- [Vector Similarity Search with PostgreSQL](https://www.timescale.com/blog/postgresql-as-a-vector-database-create-store-and-query-openai-embeddings-with-pgvector/)

## Future Enhancements

- [ ] OCR support for scanned PDFs
- [ ] Multi-language support
- [ ] Incremental updates (detect document changes)
- [ ] Document deduplication
- [ ] Hybrid search (keyword + semantic)
- [ ] Export embeddings for external vector DBs
