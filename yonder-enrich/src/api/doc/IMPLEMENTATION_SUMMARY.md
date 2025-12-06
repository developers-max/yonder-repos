# Location Enrichment API - Implementation Summary

## Overview

Created a unified location enrichment API endpoint that takes coordinates (latitude/longitude) and automatically runs all applicable enrichments for that location.

## What Was Created

### 1. Documentation (`ENRICHMENTS.md`)
Complete documentation of all available enrichment services:
- **Global enrichments**: Amenities, Municipalities (work for any location)
- **Country-specific**: Portugal (CRUS, Cadastre), Spain (Zoning, Cadastre), Germany (Zoning)
- **Not yet implemented**: Climate, Population
- Data sources, rate limiting, and technical details

### 2. Core Orchestrator (`src/api/location-enrichment.ts`)
Main enrichment orchestrator that:
- Accepts coordinates and configuration options
- Automatically identifies country/municipality using Nominatim
- Runs global enrichments (amenities, municipalities)
- Runs country-specific enrichments based on location:
  - **Portugal**: CRUS zoning + Portugal cadastre
  - **Spain**: Spain zoning + Spain cadastre  
  - **Germany**: Germany zoning
- Optional LLM translation of zoning labels
- Stores results to database (optional)
- Returns consolidated enrichment data

**Features**:
- Defensive error handling (failed enrichments don't block others)
- Translation support with confidence scores
- Tracks which enrichments ran, skipped, or failed
- Database storage optional via `store_results` parameter

### 3. Helper Modules

#### `src/api/helpers/municipality-helpers.ts`
- `getMunicipalityFromCoordinates()`: Reverse geocoding via Nominatim
- `findMunicipalityByName()`: Database lookup
- `insertMunicipality()`: Create municipality records
- Retry logic with exponential backoff

#### `src/api/helpers/crus-helpers.ts`
- `getCRUSZoningForPoint()`: Portugal CRUS zoning lookup
- Integration with DGT OGC API
- Point-in-polygon detection
- Handles SSL certificate issues

### 4. Express API Server (`src/api/server.ts`)
Production-ready REST API with:
- **POST `/api/enrich/location`**: Main enrichment endpoint
- **GET `/api/enrich/info`**: API documentation endpoint
- **GET `/health`**: Health check endpoint
- Request validation (coordinate ranges, required fields)
- Error handling and logging
- 404 handler
- Clear console output with enrichment summaries

### 5. Usage Documentation (`API_USAGE.md`)
Complete usage guide with:
- Quick start instructions
- curl examples for different countries
- Request/response schemas
- Error handling
- Rate limiting details
- Production tips
- Programmatic usage examples

### 6. Test Suite (`examples/test-api.sh`)
Automated test script that tests:
- Health check
- API info endpoint
- Madrid, Spain (Spain enrichments)
- Lisbon, Portugal (Portugal enrichments)
- Berlin, Germany (Germany enrichments)
- New York, USA (global only)
- Error handling

### 7. Package.json Update
Added new script:
```json
"api": "ts-node src/api/server.ts"
```

## Available Enrichments

### Executed for All Locations
1. **Municipalities** - Country, municipality, district identification
2. **Amenities** - Distances to 9 types of points of interest:
   - Coastline, Beach, Airport
   - Nearest town/city
   - Public transport
   - Supermarket, Convenience store
   - Restaurant/fast food, Cafe

### Country-Specific

#### Portugal (PT)
3. **CRUS Zoning** - Land-use planning from Portugal DGT
4. **Portugal Cadastre** - Cadastral references and property data

#### Spain (ES)
5. **Spain Zoning** - Regional zoning from autonomous communities
6. **Spain Cadastre** - Cadastral references, parcels, buildings, maps

#### Germany (DE)
7. **Germany Zoning** - State-level land-use plans

## API Request/Response

### Request
```json
{
  "latitude": 40.4168,
  "longitude": -3.7038,
  "store_results": true,
  "translate": true,
  "target_language": "en"
}
```

### Response
```json
{
  "location": { "latitude": 40.4168, "longitude": -3.7038 },
  "country": "ES",
  "municipality": {
    "id": 123,
    "name": "Madrid",
    "district": "Comunidad de Madrid",
    "country": "ES"
  },
  "amenities": { /* 9 amenity types with distances */ },
  "zoning": { /* Zoning classification */ },
  "cadastre": { /* Cadastral data */ },
  "enrichment_data": { /* Complete merged data */ },
  "enrichments_run": ["municipalities", "amenities", "spain-zoning", "spain-cadastre"],
  "enrichments_skipped": ["portugal-cadastre", "crus-zoning", "germany-zoning"],
  "enrichments_failed": [],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## How to Use

### Start the API Server
```bash
npm run api
```

Server starts on `http://localhost:3000` (configurable via `API_PORT` env var)

### Test the API

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Get API Info:**
```bash
curl http://localhost:3000/api/enrich/info
```

**Enrich a Location (Madrid):**
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.4168,
    "longitude": -3.7038,
    "store_results": false,
    "translate": true
  }'
```

**Run Test Suite:**
```bash
chmod +x src/api/examples/test-api.sh
./src/api/examples/test-api.sh
```

## Configuration

### Required Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Optional Environment Variables
```bash
# API Server
API_PORT=3000

# LLM Translation (for zoning labels)
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-pro
```

## Architecture

```
Request (lat/lon)
    ↓
Municipality Detection (Nominatim)
    ↓
Country Identified (PT/ES/DE/Other)
    ↓
    ├─→ Global Enrichments (always)
    │   ├─ Amenities (OpenStreetMap)
    │   └─ Municipalities (Nominatim)
    │
    └─→ Country-Specific Enrichments
        ├─ PT: CRUS + Cadastre
        ├─ ES: Zoning + Cadastre
        └─ DE: Zoning
    ↓
Optional LLM Translation
    ↓
Merge & Store Results
    ↓
Return Consolidated Response
```

## Data Storage

All enrichment data is stored in the `enriched_plots_stage` table:
```sql
enriched_plots_stage (
  id TEXT PRIMARY KEY,
  latitude NUMERIC,
  longitude NUMERIC,
  municipality_id INTEGER,
  enrichment_data JSONB  -- Contains all enrichment results
)
```

The `enrichment_data` JSONB field structure:
```json
{
  "amenities": { /* Amenity distances */ },
  "zoning": { /* Zoning classification */ },
  "cadastral": { /* Cadastral data */ }
}
```

## Rate Limiting & Performance

- **Nominatim (municipalities)**: 1.1s delay between requests
- **Amenities**: Single combined Overpass query (~2-5s)
- **CRUS/Portugal**: 500ms delay, max 3-5 concurrent
- **Spain services**: 500-1000ms delay, max 3-5 concurrent
- **Germany**: 500ms delay, max 5 concurrent

**Typical response time**: 5-15 seconds per location (depending on country)

## Error Handling

The system is designed for graceful degradation:
- Failed enrichments are tracked in `enrichments_failed` array
- Other enrichments continue even if one fails
- Clear error messages in console and response
- HTTP status codes indicate error type (400, 404, 500)

## Next Steps / Possible Enhancements

1. **Caching Layer**: Add Redis caching for repeated lookups
2. **Batch Endpoint**: Process multiple locations in one request
3. **Async Processing**: Queue-based processing for large batches
4. **WebSocket Support**: Real-time progress updates
5. **Climate Data**: Implement climate enrichment (temperature, rainfall)
6. **Population Data**: Implement population density enrichment
7. **More Countries**: Extend to France, Italy, etc.
8. **Authentication**: Add API key authentication
9. **Rate Limiting**: Add request rate limiting per client
10. **Monitoring**: Add Prometheus metrics

## Files Created

```
yonder-enrich/
├── src/
│   └── api/
│       ├── server.ts                   # Express API server
│       ├── location-enrichment.ts      # Main orchestrator
│       ├── doc/
│       │   ├── ENRICHMENTS.md          # Complete enrichment documentation
│       │   ├── API_USAGE.md            # API usage guide
│       │   ├── IMPLEMENTATION_SUMMARY.md # This file
│       │   └── QUICK_START.md          # Quick reference guide
│       ├── examples/
│       │   └── test-api.sh             # Automated test script
│       └── helpers/
│           ├── municipality-helpers.ts # Municipality lookup helpers
│           └── crus-helpers.ts         # CRUS zoning helpers
└── package.json                        # Updated with "api" script
```

## Testing Checklist

- [x] Health endpoint works
- [x] API info endpoint returns documentation
- [x] Spain location triggers Spain enrichments
- [x] Portugal location triggers Portugal enrichments
- [x] Germany location triggers Germany enrichments
- [x] US location only triggers global enrichments
- [x] Invalid coordinates return 400 error
- [x] Missing parameters return 400 error
- [x] Translation option works (requires GOOGLE_API_KEY)
- [x] Database storage option works (requires DATABASE_URL)

## Summary

Successfully implemented a comprehensive location enrichment API that:
✅ Automatically detects country and runs applicable enrichments  
✅ Supports 7 different enrichment types across 4 countries  
✅ Provides REST API with clear documentation  
✅ Includes error handling and graceful degradation  
✅ Offers optional LLM translation of zoning labels  
✅ Stores results to database (optional)  
✅ Includes test suite and usage examples  
✅ Ready for production use  

The API is production-ready and can be extended with additional countries and enrichment types as needed.
