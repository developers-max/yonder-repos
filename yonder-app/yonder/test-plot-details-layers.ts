#!/usr/bin/env tsx
/**
 * Test script to verify layer enrichment data is included in getPlotDetails tool
 * 
 * Run with: tsx test-plot-details-layers.ts <plot-id>
 * Example: tsx test-plot-details-layers.ts 123e4567-e89b-12d3-a456-426614174000
 */

import { appRouter } from './src/server/trpc';

async function testPlotDetailsWithLayers() {
  console.log('=== Testing Plot Details with Layer Enrichment Data ===\n');

  // Test with a plot ID that should have layer enrichment data
  const testPlotId = process.argv[2];
  
  if (!testPlotId) {
    console.error('❌ Please provide a plot ID as argument');
    console.log('Usage: tsx test-plot-details-layers.ts <plot-id>');
    process.exit(1);
  }

  console.log(`Testing with plot ID: ${testPlotId}\n`);

  try {
    // Create tRPC caller
    const caller = appRouter.createCaller({
      session: null,
      user: undefined,
    });

    // Fetch plot data
    const plot = await caller.plots.getPlot({ id: testPlotId });
    
    console.log('✅ Plot fetched successfully\n');
    
    // Extract enrichment data
    const enrichmentData = plot.enrichmentData as any;

    // Check enrichment data structure
    console.log('--- Enrichment Data Structure ---');
    console.log(`Has enrichment data: ${!!enrichmentData}`);
    
    if (enrichmentData) {
      const hasLayers = !!enrichmentData.layers;
      const hasZoning = !!enrichmentData.zoning;
      const hasCadastral = !!enrichmentData.cadastral;
      
      console.log(`  - Has layers: ${hasLayers}`);
      console.log(`  - Has zoning: ${hasZoning}`);
      console.log(`  - Has cadastral: ${hasCadastral}`);
      
      // Check layer data structure
      if (hasLayers) {
        console.log('\n--- Layer Enrichment Data ---');
        const layers = enrichmentData.layers;
        
        console.log(`Country: ${layers.country || 'N/A'}`);
        console.log(`Area (m²): ${layers.areaM2 || 'N/A'}`);
        console.log(`Timestamp: ${layers.timestamp || 'N/A'}`);
        
        if (layers.layersByCategory) {
          const categories = Object.keys(layers.layersByCategory);
          const totalLayers = Object.values(layers.layersByCategory).reduce(
            (sum: number, arr: any) => sum + arr.length, 
            0
          );
          
          console.log(`\nCategories (${categories.length}): ${categories.join(', ')}`);
          console.log(`Total layers: ${totalLayers}`);
          
          // Count by category
          console.log('\nLayers by category:');
          for (const [category, layersArray] of Object.entries(layers.layersByCategory)) {
            console.log(`  - ${category}: ${(layersArray as any[]).length}`);
          }
          
          // Show sample layer from each category
          console.log('\n--- Sample Layer Data ---');
          for (const [category, layersArray] of Object.entries(layers.layersByCategory)) {
            if ((layersArray as any[]).length > 0) {
              const sample = (layersArray as any[])[0];
              console.log(`\n${category.toUpperCase()}:`);
              console.log(`  Layer ID: ${sample.layerId || 'N/A'}`);
              console.log(`  Layer Name: ${sample.layerName || 'N/A'}`);
              console.log(`  Found: ${sample.found}`);
              
              if (sample.data) {
                const dataPreview = JSON.stringify(sample.data, null, 2);
                console.log(`  Data preview: ${dataPreview.slice(0, 200)}${dataPreview.length > 200 ? '...' : ''}`);
              }
            }
          }
          
          console.log('\n✅ Layer enrichment data is properly structured in database');
        } else {
          console.log('⚠️  layersByCategory is null/undefined');
        }
      } else {
        console.log('\nℹ️  No layer enrichment data found for this plot');
        console.log('   This plot may not have been enriched with the layers API yet.');
      }
      
      // Show other enrichment data
      if (hasZoning) {
        console.log('\n--- Zoning Data ---');
        console.log(`Label: ${enrichmentData.zoning.label || enrichmentData.zoning.label_en || 'N/A'}`);
      }
      
      if (hasCadastral) {
        console.log('\n--- Cadastral Data ---');
        console.log(`Reference: ${enrichmentData.cadastral.cadastral_reference || 'N/A'}`);
        console.log(`Municipality: ${enrichmentData.cadastral.municipality || 'N/A'}`);
      }
    } else {
      console.log('❌ No enrichment data found for this plot');
    }
    
    console.log('\n--- Plot Info ---');
    console.log(`Price: €${plot.price.toLocaleString()}`);
    console.log(`Size: ${plot.size ? plot.size.toLocaleString() + 'm²' : 'N/A'}`);
    console.log(`Location: ${plot.latitude}, ${plot.longitude}`);
    if (plot.municipality) {
      console.log(`Municipality: ${plot.municipality.name} (${plot.municipality.country})`);
    }

  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error);
  }
}

// Run the test
testPlotDetailsWithLayers().catch(console.error);
