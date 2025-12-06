/**
 * Example usage of the Casafari region-specific download functions
 * 
 * Run with: npx ts-node src/enrichments/casafari/example-usage.ts
 */

import {
  downloadPortugalPlots,
  downloadNiedersachsenPlots,
  downloadAlellaPlots,
  downloadAllRegions,
  aggregateCasafariSearchPages
} from './index';

async function main() {
  // Example 1: Download Portugal plots only
  // This will save to: outputs/casafari-search/portugal/
  console.log('\n=== Example 1: Download Portugal plots ===');
  const portugalResult = await downloadPortugalPlots({
    startLimit: 500,  // Optional: default is 500
    startOffset: 0,   // Optional: default is 0
    startOrder: 'desc' // Optional: default is 'desc'
  });
  
  // Aggregate the Portugal results
  const portugalAggregated = await aggregateCasafariSearchPages(
    portugalResult.baseDir,
    portugalResult.ts
  );
  console.log(`Aggregated file: ${portugalAggregated}`);

  // Example 2: Download Niedersachsen (Germany) plots only
  // This will save to: outputs/casafari-search/germany/
  console.log('\n=== Example 2: Download Niedersachsen plots ===');
  const germanyResult = await downloadNiedersachsenPlots();
  
  const germanyAggregated = await aggregateCasafariSearchPages(
    germanyResult.baseDir,
    germanyResult.ts
  );
  console.log(`Aggregated file: ${germanyAggregated}`);

  // Example 3: Download Alella (Spain) plots only
  // This will save to: outputs/casafari-search/spain/
  console.log('\n=== Example 3: Download Alella plots ===');
  const spainResult = await downloadAlellaPlots();
  
  const spainAggregated = await aggregateCasafariSearchPages(
    spainResult.baseDir,
    spainResult.ts
  );
  console.log(`Aggregated file: ${spainAggregated}`);

  // Example 4: Download all regions in one call
  // This will save to:
  //   - outputs/casafari-search/portugal/
  //   - outputs/casafari-search/germany/
  //   - outputs/casafari-search/spain/
  console.log('\n=== Example 4: Download all regions ===');
  const allResults = await downloadAllRegions();
  
  // Aggregate each region
  for (const [region, result] of Object.entries(allResults)) {
    const aggregated = await aggregateCasafariSearchPages(
      result.baseDir,
      result.ts
    );
    console.log(`${region} aggregated file: ${aggregated}`);
  }
}

// Run the examples
if (require.main === module) {
  main().catch(console.error);
}

export { main };
