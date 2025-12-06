#!/usr/bin/env ts-node
/**
 * Test script to verify enrichment_data merging logic
 * Ensures cadastral data doesn't override other enrichment data
 */

// Simulate existing enrichment data with multiple enrichment types
const existingEnrichmentData = {
  zoning: {
    zone_type: "Residential",
    classification: "R-1",
    max_height: 15,
    density: "Low",
    source: "Municipal Zoning Map"
  },
  soil: {
    type: "Clay",
    ph: 6.5,
    drainage: "Poor"
  },
  flood_risk: {
    zone: "X",
    risk_level: "Minimal"
  },
  // Maybe has old cadastral data too
  cadastral: {
    old_field: "should_be_preserved",
    cadastral_reference: "OLD_REF"
  }
};

// New cadastral data from Spain enrichment
const newCadastralData = {
  cadastral_reference: "0044005DF4904S",
  address: "03",
  parcel: {
    area_value: 1021,
    label: "05"
  },
  map_images: {
    wms_url: "http://example.com/wms",
    embeddable_html: "<img src='...' />"
  }
};

console.log('🧪 Testing enrichment data merge logic\n');

// ❌ BAD: This would override everything
const badMerge = { cadastral: newCadastralData };
console.log('❌ BAD merge (overwrites all data):');
console.log('  Keys preserved:', Object.keys(badMerge));
console.log('  Lost keys:', Object.keys(existingEnrichmentData).filter(k => !(k in badMerge)));
console.log();

// ✅ GOOD: Spread existing first, then update cadastral
const goodMerge1 = {
  ...existingEnrichmentData,
  cadastral: newCadastralData
};
console.log('✅ GOOD merge (spreads existing first):');
console.log('  Keys preserved:', Object.keys(goodMerge1));
console.log('  Zoning still there?', 'zoning' in goodMerge1);
console.log('  Soil still there?', 'soil' in goodMerge1);
console.log('  Cadastral updated?', goodMerge1.cadastral.cadastral_reference === '0044005DF4904S');
console.log('  Old cadastral field lost?', !('old_field' in goodMerge1.cadastral));
console.log();

// ✅ BEST: Also preserve existing cadastral fields not in new data
const bestMerge = {
  ...existingEnrichmentData,
  cadastral: {
    ...(existingEnrichmentData.cadastral || {}),
    ...newCadastralData
  }
};
console.log('✅ BEST merge (preserves existing cadastral fields too):');
console.log('  Keys preserved:', Object.keys(bestMerge));
console.log('  Zoning still there?', 'zoning' in bestMerge);
console.log('  Soil still there?', 'soil' in bestMerge);
console.log('  Cadastral updated?', bestMerge.cadastral.cadastral_reference === '0044005DF4904S');
console.log('  Old cadastral field preserved?', 'old_field' in bestMerge.cadastral);
console.log();

// Verify all enrichment types preserved
const existingKeys = Object.keys(existingEnrichmentData);
const mergedKeys = Object.keys(bestMerge);
const lostKeys = existingKeys.filter(k => !(k in bestMerge));

console.log('📊 Merge verification:');
console.log('  Original keys:', existingKeys.length, '-', existingKeys.join(', '));
console.log('  Merged keys:', mergedKeys.length, '-', mergedKeys.join(', '));
console.log('  Lost keys:', lostKeys.length, lostKeys.length > 0 ? '⚠️  ' + lostKeys.join(', ') : '✅ None');
console.log();

if (lostKeys.length === 0 && bestMerge.zoning && bestMerge.soil && bestMerge.flood_risk) {
  console.log('✅ SUCCESS: All enrichment data preserved!');
} else {
  console.log('❌ FAILURE: Some enrichment data was lost!');
}
