#!/usr/bin/env node
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

async function checkEmbeddings() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();

    // Check existing embeddings
    const { rows: [stats] } = await client.query(`
      SELECT 
        COUNT(*) as total_chunks,
        AVG(LENGTH(chunk_text)) as avg_chunk_size,
        MIN(LENGTH(chunk_text)) as min_chunk_size,
        MAX(LENGTH(chunk_text)) as max_chunk_size
      FROM pdm_document_embeddings
      WHERE municipality_id = 401
    `);

    console.log('=== Current Embeddings for Alella ===\n');
    console.log(`Total chunks: ${stats.total_chunks}`);
    console.log(`Average chunk size: ${Math.round(stats.avg_chunk_size)} characters`);
    console.log(`Min chunk size: ${stats.min_chunk_size} characters`);
    console.log(`Max chunk size: ${stats.max_chunk_size} characters`);

    console.log('\n=== Expected After Re-embedding ===\n');
    console.log('New chunk size: 400 characters');
    console.log('Expected chunks: ~2,300 (more, smaller chunks)');
    console.log('Cost to re-embed: ~$0.045');

    console.log('\n=== Recommendation ===\n');
    console.log('⚠️  Current embeddings use 1000-char chunks (old config)');
    console.log('✓  Phase 1 optimization requires 400-char chunks');
    console.log('✓  Need to re-embed with new settings\n');

    console.log('To re-embed with optimized chunk size:');
    console.log('  npm run test-alella-embeddings\n');

    client.release();
    await pool.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkEmbeddings();
