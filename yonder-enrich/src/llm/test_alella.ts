#!/usr/bin/env node
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

// Import the enrichment function (we'll need to extract it)
import { enrichMunicipalitiesWithGemini } from './municipalities';

async function testAlella() {
  console.log('=== Testing Alella Municipality Enrichment ===\n');
  
  const pool = new Pool({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    const client = await pool.connect();
    
    // Find Alella in the database
    const { rows } = await client.query(
      `SELECT id, name, district, website, country, pdm_documents
       FROM municipalities
       WHERE name ILIKE '%Alella%'
       LIMIT 1`
    );
    
    if (!rows || rows.length === 0) {
      console.error('❌ Alella not found in municipalities table');
      console.log('Searching for municipalities containing "Alella"...');
      
      const { rows: searchRows } = await client.query(
        `SELECT id, name, district FROM municipalities WHERE name ILIKE '%Alella%' LIMIT 10`
      );
      
      if (searchRows.length > 0) {
        console.log('\nFound municipalities:');
        searchRows.forEach((r: any) => {
          console.log(`  - ID: ${r.id}, Name: ${r.name}, District: ${r.district || 'N/A'}`);
        });
      }
      
      client.release();
      await pool.end();
      return;
    }
    
    const alella = rows[0];
    console.log('Found Alella:');
    console.log(`  ID: ${alella.id}`);
    console.log(`  Name: ${alella.name}`);
    console.log(`  District: ${alella.district || 'N/A'}`);
    console.log(`  Current Website: ${alella.website || 'Not set'}`);
    console.log(`  Current Country: ${alella.country || 'Not set'}`);
    console.log(`  Current PDM Docs: ${alella.pdm_documents ? JSON.stringify(alella.pdm_documents, null, 2) : 'Not set'}`);
    console.log('\n');
    
    client.release();
    
    // Run enrichment for just this municipality
    console.log('Starting enrichment for Alella...\n');
    
    await enrichMunicipalitiesWithGemini({
      municipalityIds: [alella.id],
      concurrency: 1,
    });
    
    // Check results
    const client2 = await pool.connect();
    const { rows: updatedRows } = await client2.query(
      `SELECT id, name, website, country, pdm_documents
       FROM municipalities
       WHERE id = $1`,
      [alella.id]
    );
    
    if (updatedRows.length > 0) {
      const updated = updatedRows[0];
      console.log('\n=== Enrichment Results ===');
      console.log(`Website: ${updated.website || 'Not found'}`);
      console.log(`Country: ${updated.country || 'Not found'}`);
      console.log(`PDM Documents: ${updated.pdm_documents ? JSON.stringify(updated.pdm_documents, null, 2) : 'Not found'}`);
      
      // Validate PDM document URLs
      if (updated.pdm_documents && updated.pdm_documents.documents) {
        console.log('\n=== PDM Document URL Validation ===');
        updated.pdm_documents.documents.forEach((doc: any, idx: number) => {
          const isPdf = doc.url.toLowerCase().includes('.pdf');
          const isDocument = doc.url.toLowerCase().includes('/document') || 
                            doc.url.toLowerCase().includes('/urbanismo') ||
                            doc.url.toLowerCase().includes('/ordenanza');
          const isMainSite = doc.url === updated.website;
          
          console.log(`\nDocument ${idx + 1}: ${doc.title}`);
          console.log(`  URL: ${doc.url}`);
          console.log(`  Is PDF: ${isPdf ? '✓' : '✗'}`);
          console.log(`  Contains doc path: ${isDocument ? '✓' : '✗'}`);
          console.log(`  Is main website: ${isMainSite ? '✗ BAD' : '✓ GOOD'}`);
          console.log(`  Type: ${doc.documentType}`);
        });
      }
    }
    
    client2.release();
    
  } catch (error) {
    console.error('Error testing Alella:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testAlella().catch(console.error);
