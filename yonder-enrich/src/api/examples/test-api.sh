#!/bin/bash
# Test script for the Yonder Enrichment API

API_URL="http://localhost:3000"

echo "╔════════════════════════════════════════════════════╗"
echo "║   Yonder Enrichment API Test Suite                ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Health check
echo "1️⃣  Testing health endpoint..."
curl -s "$API_URL/health" | jq '.'
echo ""

# API info
echo "2️⃣  Getting API information..."
curl -s "$API_URL/api/enrich/info" | jq '.description, .available_enrichments'
echo ""

# Test Madrid, Spain (should trigger Spain-specific enrichments)
echo "3️⃣  Testing Madrid, Spain..."
echo "   Location: 40.4168, -3.7038"
curl -s -X POST "$API_URL/api/enrich/location" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.4168,
    "longitude": -3.7038,
    "store_results": false,
    "translate": false
  }' | jq '{
    country: .country,
    municipality: .municipality.name,
    enrichments_run: .enrichments_run,
    enrichments_skipped: .enrichments_skipped,
    has_amenities: (.amenities != null),
    has_zoning: (.zoning != null),
    has_cadastre: (.cadastre != null)
  }'
echo ""

# Test Lisbon, Portugal (should trigger Portugal-specific enrichments)
echo "4️⃣  Testing Lisbon, Portugal..."
echo "   Location: 38.7223, -9.1393"
curl -s -X POST "$API_URL/api/enrich/location" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 38.7223,
    "longitude": -9.1393,
    "store_results": false,
    "translate": false
  }' | jq '{
    country: .country,
    municipality: .municipality.name,
    enrichments_run: .enrichments_run,
    enrichments_skipped: .enrichments_skipped,
    has_amenities: (.amenities != null),
    has_zoning: (.zoning != null),
    has_cadastre: (.cadastre != null)
  }'
echo ""

# Test Berlin, Germany (should trigger Germany-specific enrichments)
echo "5️⃣  Testing Berlin, Germany..."
echo "   Location: 52.5200, 13.4050"
curl -s -X POST "$API_URL/api/enrich/location" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 52.5200,
    "longitude": 13.4050,
    "store_results": false,
    "translate": false
  }' | jq '{
    country: .country,
    municipality: .municipality.name,
    enrichments_run: .enrichments_run,
    enrichments_skipped: .enrichments_skipped,
    has_amenities: (.amenities != null),
    has_zoning: (.zoning != null)
  }'
echo ""

# Test New York, USA (should only run global enrichments)
echo "6️⃣  Testing New York, USA..."
echo "   Location: 40.7128, -74.0060"
curl -s -X POST "$API_URL/api/enrich/location" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "store_results": false,
    "translate": false
  }' | jq '{
    country: .country,
    municipality: .municipality.name,
    enrichments_run: .enrichments_run,
    enrichments_skipped: .enrichments_skipped,
    has_amenities: (.amenities != null)
  }'
echo ""

# Test invalid request
echo "7️⃣  Testing error handling (invalid coordinates)..."
curl -s -X POST "$API_URL/api/enrich/location" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 999,
    "longitude": -999
  }' | jq '{error: .error, message: .message}'
echo ""

echo "✅ Test suite complete!"
echo ""
echo "💡 To see full responses, run individual curl commands from src/api/doc/API_USAGE.md"
