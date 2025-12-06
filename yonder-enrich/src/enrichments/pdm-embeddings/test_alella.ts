#!/usr/bin/env node
import { enrichPDMDocumentsWithEmbeddings } from './index';

/**
 * Test script to process embeddings for Alella municipality only
 */
async function testAlellaEmbeddings() {
  console.log('Testing PDF embeddings enrichment for Alella...\n');
  
  try {
    // Alella's municipality ID is 401
    const ALELLA_ID = 401;
    await enrichPDMDocumentsWithEmbeddings({
      municipalityIds: [ALELLA_ID],
      forceRefresh: true, // Always recreate embeddings for testing
    });
    
    console.log('\n✓ Test completed successfully!');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

testAlellaEmbeddings();
