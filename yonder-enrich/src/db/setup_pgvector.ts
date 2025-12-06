#!/usr/bin/env node
import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function setupPgvector() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  console.log('Setting up pgvector extension and tables...\n');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();

    // Read SQL file
    const sqlPath = path.join(__dirname, 'enable_pgvector.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Executing SQL setup script...');
    
    await client.query(sql);

    console.log('✓ pgvector extension enabled');
    console.log('✓ pdm_document_embeddings table created');
    console.log('✓ Indexes created');
    console.log('✓ Views and triggers created');
    console.log('\n✅ Setup complete!');

    client.release();
  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    
    if (error.message.includes('extension "vector"')) {
      console.error('\n⚠️  pgvector extension is not installed on your PostgreSQL server.');
      console.error('   You need to install it first. Options:');
      console.error('   - Use a managed database with pgvector (Supabase, Timescale, Neon)');
      console.error('   - Install pgvector extension on your PostgreSQL instance');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupPgvector();
