#!/bin/bash

# Install dependencies for PDM embeddings enrichment

echo "Installing dependencies for PDF embeddings..."

# Install pdf-parse for PDF text extraction
npm install pdf-parse@2.4.5

# Install OpenAI SDK
npm install openai@^4.70.0

# Install @types for TypeScript
npm install --save-dev @types/pdf-parse

echo "✓ Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Run the SQL script to enable pgvector: psql \$DATABASE_URL -f src/db/enable_pgvector.sql"
echo "2. Set OPENAI_API_KEY in your .env file"
echo "3. Run: npm run pdm-embeddings"
