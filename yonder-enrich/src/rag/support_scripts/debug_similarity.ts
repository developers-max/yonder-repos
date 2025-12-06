#!/usr/bin/env node
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { OpenAI } from 'openai';

dotenv.config();

async function debugSimilarity() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const client = await pool.connect();

    console.log('=== Debugging Similarity Scores ===\n');

    // Check embeddings exist
    const { rows: [count] } = await client.query(`
      SELECT COUNT(*) FROM pdm_document_embeddings WHERE municipality_id = 401
    `);
    console.log(`Total embeddings for Alella: ${count.count}\n`);

    // Test question
    const question = 'What information can you find on code 13d1?';
    console.log(`Test question: "${question}"\n`);

    // Create embedding for question
    console.log('Creating question embedding...');
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });
    const queryEmbedding = response.data[0].embedding;

    // Get top 10 matches WITHOUT threshold to see actual scores
    console.log('Finding top 10 matches (no threshold)...\n');
    
    const { rows } = await client.query(`
      SELECT 
        chunk_index,
        LEFT(chunk_text, 150) as preview,
        1 - (embedding <=> $1::vector) as similarity
      FROM pdm_document_embeddings
      WHERE municipality_id = 401
      ORDER BY embedding <=> $1::vector
      LIMIT 10
    `, [JSON.stringify(queryEmbedding)]);

    console.log('Top 10 matches:');
    rows.forEach((row, idx) => {
      console.log(`\n[${idx + 1}] Chunk ${row.chunk_index}`);
      console.log(`    Similarity: ${(row.similarity * 100).toFixed(2)}%`);
      console.log(`    Preview: ${row.preview}...`);
    });

    console.log('\n=== Analysis ===\n');
    if (rows[0].similarity < 0.7) {
      console.log(`⚠️  Highest similarity: ${(rows[0].similarity * 100).toFixed(2)}%`);
      console.log(`⚠️  Current threshold: 70%`);
      console.log(`\nRecommendation: Lower threshold to ${Math.floor(rows[0].similarity * 100)}% or test with different questions.`);
    } else {
      console.log(`✓ Similarities look good (above 70%)`);
    }

    client.release();
    await pool.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

debugSimilarity();
