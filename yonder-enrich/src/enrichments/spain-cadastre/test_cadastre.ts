#!/usr/bin/env ts-node

/**
 * Test script for Spanish Cadastre enrichment
 * 
 * Tests various locations across Spain to verify cadastral data retrieval
 */

import { getSpanishCadastralInfo } from './spain_cadastre_lookup';

// Test locations across Spain
const TEST_LOCATIONS = [
  {
    name: "Barcelona - Sagrada Familia area",
    lon: 2.1744,
    lat: 41.4036,
    description: "Dense urban area in Catalunya"
  },
  {
    name: "Madrid - Puerta del Sol",
    lon: -3.7038,
    lat: 40.4168,
    description: "Central Madrid"
  },
  {
    name: "Valencia - City Centre",
    lon: -0.3763,
    lat: 39.4699,
    description: "Urban Valencia"
  },
  {
    name: "Seville - Historic Centre",
    lon: -5.9845,
    lat: 37.3891,
    description: "Andalucía"
  },
  {
    name: "Bilbao - Guggenheim area",
    lon: -2.9349,
    lat: 43.2683,
    description: "País Vasco"
  }
];

async function testLocation(location: typeof TEST_LOCATIONS[0]) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${location.name}`);
  console.log(`Description: ${location.description}`);
  console.log(`Coordinates: ${location.lon}, ${location.lat}`);
  console.log('='.repeat(80));
  
  try {
    const startTime = Date.now();
    const result = await getSpanishCadastralInfo(location.lon, location.lat);
    const elapsed = Date.now() - startTime;
    
    if (!result.cadastral_reference) {
      console.log('❌ No cadastral reference found');
      console.log('Notes:', result.notes || 'N/A');
    } else {
      console.log('✅ Cadastral information retrieved');
      console.log('\nCadastral Reference:', result.cadastral_reference);
      console.log('Address:', result.address || 'N/A');
      console.log('Postal Code:', result.postal_code || 'N/A');
      console.log('Municipality:', result.municipality || 'N/A');
      console.log('Province:', result.province || 'N/A');
      
      if (result.distance_meters !== undefined) {
        console.log('Distance from query point:', result.distance_meters, 'meters');
      }
      
      if (result.parcel) {
        console.log('\n📦 Parcel Data:');
        console.log('  Area:', result.parcel.area_value || 'N/A', 'm²');
        console.log('  Label:', result.parcel.label || 'N/A');
        console.log('  Beginning Lifespan:', result.parcel.beginning_lifespan || 'N/A');
      }
      
      if (result.building) {
        console.log('\n🏢 Building Data:');
        console.log('  Current Use:', result.building.current_use || 'N/A');
        console.log('  Condition:', result.building.condition_of_construction || 'N/A');
        console.log('  Number of Dwellings:', result.building.number_of_dwellings || 'N/A');
        console.log('  Number of Building Units:', result.building.number_of_building_units || 'N/A');
        console.log('  Floors Above Ground:', result.building.number_of_floors_above_ground || 'N/A');
      }
      
      console.log('\n📍 Cadastral Coordinates:');
      if (result.coordinates) {
        console.log('  X:', result.coordinates.x);
        console.log('  Y:', result.coordinates.y);
        console.log('  SRS:', result.coordinates.srs);
      }
      
      console.log('\n🔗 Services Used:', result.service_urls?.length || 0);
      result.service_urls?.forEach((url: string, idx: number) => {
        console.log(`  ${idx + 1}. ${url}`);
      });
    }
    
    console.log(`\n⏱️  Query time: ${elapsed}ms`);
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('🇪🇸 Spanish Cadastre Enrichment Test Suite');
  console.log('Testing cadastral data retrieval for various Spanish locations\n');
  
  for (const location of TEST_LOCATIONS) {
    await testLocation(location);
    
    // Small delay between tests to be polite to the API
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test suite completed');
  console.log('='.repeat(80));
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}

export { testLocation, TEST_LOCATIONS };
