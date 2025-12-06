#!/usr/bin/env node
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

async function clearAndReembed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();

    console.log('=== Clearing and Re-embedding Alella ===\n');

    // Check current state
    const { rows: [current] } = await client.query(`
      SELECT 
        COUNT(*) as count,
        AVG(LENGTH(chunk_text)) as avg_size
      FROM pdm_document_embeddings 
      WHERE municipality_id = 401
    `);

    console.log('📊 Current state:');
    console.log(`   Chunks: ${current.count}`);
    console.log(`   Average size: ${Math.round(current.avg_size)} characters\n`);

    // Delete all embeddings for Alella
    console.log('🗑️  Deleting all embeddings for Alella...');
    const { rowCount } = await client.query(
      'DELETE FROM pdm_document_embeddings WHERE municipality_id = 401'
    );
    console.log(`   ✓ Deleted ${rowCount} embeddings\n`);

    // Verify deletion
    const { rows: [verify] } = await client.query(`
      SELECT COUNT(*) as count FROM pdm_document_embeddings WHERE municipality_id = 401
    `);
    console.log(`✓ Verification: ${verify.count} embeddings remaining\n`);

    console.log('📝 Configuration for new embeddings:');
    console.log('   Chunk size: 400 characters');
    console.log('   Chunk overlap: 100 characters');
    console.log('   Model: text-embedding-3-small\n');

    console.log('📦 Next step:');
    console.log('   Run: npm run test-alella-embeddings\n');

    console.log('Expected results:');
    console.log('   • ~2,000-2,300 chunks');
    console.log('   • 400 chars per chunk');
    console.log('   • Cost: ~$0.04-$0.045');
    console.log('   • Time: ~3-5 minutes\n');

    client.release();
    await pool.end();

    console.log('✅ Ready for clean re-embedding!');
    console.log('\nRun now: npm run test-alella-embeddings');
  } catch (error: any) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

clearAndReembed();
