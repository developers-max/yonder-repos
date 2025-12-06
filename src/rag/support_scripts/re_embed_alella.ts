#!/usr/bin/env node
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

async function reEmbedAlella() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();

    console.log('=== Re-embedding Alella with Optimized Chunk Size ===\n');

    // Step 1: Check current embeddings
    const { rows: [current] } = await client.query(`
      SELECT COUNT(*) as count FROM pdm_document_embeddings WHERE municipality_id = 401
    `);

    console.log(`Current embeddings: ${current.count} chunks (1000-char size)`);
    console.log('New chunk size: 400 characters\n');

    // Step 2: Delete old embeddings
    console.log('🗑️  Deleting old embeddings...');
    await client.query('DELETE FROM pdm_document_embeddings WHERE municipality_id = 401');
    console.log('✓ Old embeddings deleted\n');

    // Step 3: Instructions for re-embedding
    console.log('📝 Next steps:');
    console.log('   Run the embedding script which will now use 400-char chunks:');
    console.log('   npm run test-alella-embeddings\n');

    console.log('Expected results:');
    console.log('   • ~2,300 chunks (more, smaller chunks)');
    console.log('   • Better precision for retrieval');
    console.log('   • Cost: ~$0.045\n');

    client.release();
    await pool.end();

    console.log('✅ Ready for re-embedding!');
  } catch (error: any) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

reEmbedAlella();
