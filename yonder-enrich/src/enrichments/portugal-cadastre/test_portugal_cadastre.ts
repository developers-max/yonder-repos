#!/usr/bin/env ts-node

import { getPortugalCadastralInfo, getNearbyCadastralParcels } from './portugal_cadastre_lookup';

/**
 * Test script for Portugal cadastral lookup
 * 
 * Usage:
 *   ts-node test_portugal_cadastre.ts [lon] [lat]
 * 
 * Examples:
 *   # Lisbon
 *   ts-node test_portugal_cadastre.ts -9.15 38.75
 *   
 *   # Porto
 *   ts-node test_portugal_cadastre.ts -8.61 41.16
 *   
 *   # Faro
 *   ts-node test_portugal_cadastre.ts -7.93 37.02
 */

async function testCadastralLookup(lon: number, lat: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Portugal Cadastral Lookup`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`📍 Coordinates: ${lon.toFixed(6)}, ${lat.toFixed(6)}`);
  console.log(`🌍 Location: https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=18\n`);

  // Test 1: Single parcel lookup
  console.log(`\n--- Test 1: Single Parcel Lookup ---\n`);
  try {
    const info = await getPortugalCadastralInfo(lon, lat);
    
    if (info) {
      console.log(`✅ Success! Found cadastral information:\n`);
      console.log(`Cadastral Reference: ${info.cadastral_reference}`);
      console.log(`Label: ${info.label}`);
      console.log(`INSPIRE ID: ${info.inspire_id}`);
      console.log(`Area: ${info.parcel_area_m2?.toLocaleString()} m²`);
      console.log(`Registration Date: ${info.registration_date || 'N/A'}`);
      console.log(`Administrative Unit: ${info.administrative_unit || 'N/A'}`);
      console.log(`Municipality Code: ${info.municipality_code || 'N/A'}`);
      
      if (info.centroid) {
        console.log(`Centroid: ${info.centroid[0].toFixed(6)}, ${info.centroid[1].toFixed(6)}`);
      }
      
      console.log(`\nAccuracy:`);
      console.log(`  Contains point: ${info.contains_point ? '✅ Yes' : '❌ No'}`);
      console.log(`  Distance: ${info.distance_meters !== undefined ? `${info.distance_meters}m` : 'N/A'}`);
      
      console.log(`\nGeometry:`);
      console.log(`  Type: ${info.geometry?.type || 'N/A'}`);
      if (info.geometry?.coordinates) {
        const coordCount = info.geometry.type === 'MultiPolygon' 
          ? info.geometry.coordinates.reduce((sum: number, poly: any) => sum + (poly[0]?.length || 0), 0)
          : info.geometry.coordinates[0]?.length || 0;
        console.log(`  Vertices: ${coordCount}`);
      }
      
      console.log(`\nMetadata:`);
      console.log(`  Source: ${info.source}`);
      console.log(`  SRS: ${info.coordinates.srs}`);
      console.log(`  Notes: ${info.notes || 'None'}`);
      
      // Show full JSON
      console.log(`\n--- Full JSON Response ---\n`);
      console.log(JSON.stringify(info, null, 2));
      
    } else {
      console.log(`❌ No cadastral information found for these coordinates`);
      console.log(`\nPossible reasons:`);
      console.log(`  - Point is outside Portugal Continental`);
      console.log(`  - Point is in an area without cadastral coverage`);
      console.log(`  - Coordinates may be invalid\n`);
    }
  } catch (error) {
    console.error(`❌ Error during lookup:`, error);
  }

  // Test 2: Nearby parcels
  console.log(`\n\n--- Test 2: Nearby Parcels (within ~200m) ---\n`);
  try {
    const nearby = await getNearbyCadastralParcels(lon, lat, 5);
    
    if (nearby.length > 0) {
      console.log(`✅ Found ${nearby.length} nearby parcel(s):\n`);
      
      nearby.forEach((parcel, idx) => {
        console.log(`${idx + 1}. ${parcel.label}`);
        console.log(`   Reference: ${parcel.cadastral_reference}`);
        console.log(`   Area: ${parcel.parcel_area_m2?.toLocaleString()} m²`);
        console.log(`   Distance: ${parcel.distance_meters !== undefined ? `${parcel.distance_meters}m` : 'N/A'}`);
        console.log(`   Contains point: ${parcel.contains_point ? '✅ Yes' : '❌ No'}`);
        if (parcel.centroid) {
          console.log(`   Centroid: ${parcel.centroid[0].toFixed(6)}, ${parcel.centroid[1].toFixed(6)}`);
        }
        console.log('');
      });
      
    } else {
      console.log(`❌ No nearby parcels found`);
    }
  } catch (error) {
    console.error(`❌ Error during nearby lookup:`, error);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test Complete`);
  console.log(`${'='.repeat(60)}\n`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     Portugal Cadastral Lookup - Test Script               ║
╚════════════════════════════════════════════════════════════╝

Usage: ts-node test_portugal_cadastre.ts <longitude> <latitude>

Examples:
  
  📍 Lisbon (city center):
     ts-node test_portugal_cadastre.ts -9.15 38.75
  
  📍 Porto (historic center):
     ts-node test_portugal_cadastre.ts -8.61 41.16
  
  📍 Faro (Algarve):
     ts-node test_portugal_cadastre.ts -7.93 37.02
  
  📍 Coimbra:
     ts-node test_portugal_cadastre.ts -8.43 40.21
  
  📍 Braga:
     ts-node test_portugal_cadastre.ts -8.43 41.55

Data Source: Direção-Geral do Território (DGT)
API: OGC API Features
Collection: Cadastro Predial (Continente)
Coverage: Portugal Continental only
License: CC-BY 4.0
  `);
  process.exit(1);
}

const lon = parseFloat(args[0]);
const lat = parseFloat(args[1]);

if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
  console.error('❌ Invalid coordinates. Must be numeric values.');
  console.error(`   Provided: longitude=${args[0]}, latitude=${args[1]}`);
  process.exit(1);
}

// Validate coordinates are within Portugal Continental bounds
const PT_BOUNDS = {
  minLon: -9.51,
  maxLon: -6.19,
  minLat: 36.96,
  maxLat: 42.15
};

if (lon < PT_BOUNDS.minLon || lon > PT_BOUNDS.maxLon || 
    lat < PT_BOUNDS.minLat || lat > PT_BOUNDS.maxLat) {
  console.warn(`
⚠️  Warning: Coordinates appear to be outside Portugal Continental bounds.
   
   Provided: (${lon}, ${lat})
   Expected bounds: 
     Longitude: ${PT_BOUNDS.minLon} to ${PT_BOUNDS.maxLon}
     Latitude: ${PT_BOUNDS.minLat} to ${PT_BOUNDS.maxLat}
   
   Continuing anyway, but results may be empty...
  `);
}

// Run the test
testCadastralLookup(lon, lat).catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
