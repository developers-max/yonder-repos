#!/usr/bin/env ts-node

import axios from "axios";
import { Agent as HttpsAgent } from "https";
import minimist from "minimist";

const CAT_WFS = "https://sig.gencat.cat/ows/PLANEJAMENT/wfs";

const httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  maxSockets: 50,
  rejectUnauthorized: false 
});

async function testCatalunyaWFS(lon: number, lat: number) {
  // Small bbox around the point
  const buffer = 0.001; // ~100m
  const minx = lon - buffer;
  const miny = lat - buffer;
  const maxx = lon + buffer;
  const maxy = lat + buffer;
  
  // Query Catalunya WFS
  const url = `${CAT_WFS}?service=WFS&version=2.0.0&request=GetFeature&bbox=${minx},${miny},${maxx},${maxy}&srsName=EPSG:4326&outputFormat=application/json&count=10`;
  
  console.log('Querying Catalunya WFS:', url);
  
  try {
    const { data } = await axios.get(url, {
      headers: { 
        Accept: "application/geo+json, application/json",
        "User-Agent": "yonder-enrich/1.0" 
      },
      timeout: 30_000,
      httpsAgent,
    });
    
    console.log('\n=== Response ===');
    console.log('Type:', data?.type);
    console.log('Features:', data?.features?.length || 0);
    
    if (data?.features?.length > 0) {
      console.log('\n=== First Feature ===');
      const first = data.features[0];
      console.log('ID:', first.id);
      console.log('Geometry type:', first.geometry?.type);
      console.log('Properties:', JSON.stringify(first.properties, null, 2));
    }
    
    return data;
  } catch (e: any) {
    console.error('Error:', e.message);
    if (e.response) {
      console.error('Status:', e.response.status);
      console.error('Data:', e.response.data);
    }
    throw e;
  }
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const lon = parseFloat(argv.lon ?? argv.lng ?? argv.x ?? '2.1734');
  const lat = parseFloat(argv.lat ?? argv.y ?? '41.3851');

  console.log(`Testing Catalunya WFS for point: lon=${lon}, lat=${lat}\n`);
  
  await testCatalunyaWFS(lon, lat);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { testCatalunyaWFS };
