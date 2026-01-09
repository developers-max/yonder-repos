#!/bin/bash

# Test script for layers enrichment in location enrichment API
# Run API server first: npm run api

API_URL="http://localhost:3001/api/enrich/location"

echo "=== Testing Layers Enrichment in Location API ==="
echo ""

# Test 1: Portugal location (Lisboa)
echo "Test 1: Portugal location (Lisboa)"
echo "-----------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 38.7223,
    "longitude": -9.1393,
    "store_results": false
  }' | jq '{
    enrichments_run: .enrichments_run,
    enrichments_failed: .enrichments_failed,
    enrichments_skipped: .enrichments_skipped,
    layers_found: (.layers.layersRaw | length),
    layers_categories: (.layers.layersByCategory | keys),
    has_layers_in_enrichment_data: (.enrichment_data.layers != null)
  }'

echo ""
echo ""

# Test 2: Spain location (Barcelona)
echo "Test 2: Spain location (Barcelona)"
echo "-----------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 41.3851,
    "longitude": 2.1734,
    "store_results": false
  }' | jq '{
    enrichments_run: .enrichments_run,
    enrichments_failed: .enrichments_failed,
    enrichments_skipped: .enrichments_skipped,
    layers_found: (.layers.layersRaw | length),
    layers_categories: (.layers.layersByCategory | keys),
    has_layers_in_enrichment_data: (.enrichment_data.layers != null)
  }'

echo ""
echo ""

# Test 3: Germany location (should skip layers)
echo "Test 3: Germany location (should skip layers)"
echo "----------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 52.5200,
    "longitude": 13.4050,
    "store_results": false
  }' | jq '{
    enrichments_run: .enrichments_run,
    enrichments_failed: .enrichments_failed,
    enrichments_skipped: .enrichments_skipped,
    has_layers: (.layers != null)
  }'

echo ""
echo ""

# Test 4: Portugal with detailed layer inspection
echo "Test 4: Portugal - Detailed layer structure"
echo "--------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 38.7223,
    "longitude": -9.1393,
    "store_results": false
  }' | jq '.layers'

echo ""
echo "=== Tests Complete ==="
