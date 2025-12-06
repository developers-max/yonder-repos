# Yonder Enrichment Services

This document lists all available enrichment services that can be run for a given location (latitude/longitude coordinates).

## Location-Based Enrichments

These enrichments can be run for any location and require only coordinates.

### 1. **Amenities Enrichment**
- **Module**: `src/enrichments/amenities`
- **Description**: Finds nearby amenities using OpenStreetMap data
- **Data Points**:
  - Coastline distance
  - Beach distance
  - Airport distance
  - Nearest main town (city/town)
  - Public transport (bus stops, train stations)
  - Supermarket
  - Convenience store
  - Restaurants/fast food
  - Cafe
- **Radius**: 10km
- **Data Source**: OpenStreetMap Overpass API
- **Status**: ✅ Implemented

### 2. **Municipalities Enrichment**
- **Module**: `src/enrichments/municipalities`
- **Description**: Links location to municipality using reverse geocoding
- **Data Points**:
  - Municipality name
  - District/state
  - Country code (ISO-2)
- **Data Source**: Nominatim (OpenStreetMap)
- **Rate Limiting**: 1.1s delay between requests
- **Status**: ✅ Implemented
- **Supports**: All countries

### 3. **Combined Enrichment**
- **Module**: `src/enrichments/combined`
- **Description**: Runs amenities and municipalities enrichments together
- **Status**: ✅ Implemented
- **Recommendation**: Preferred over running individual enrichments

## Country-Specific Enrichments

### Portugal Enrichments

#### 4. **CRUS Zoning (Portugal)**
- **Module**: `src/enrichments/crus`
- **Description**: Portugal land zoning information from DGT CRUS
- **Data Points**: Zoning classification and regulations
- **Data Source**: Portugal DGT OGC API
- **Status**: ✅ Implemented
- **Countries**: PT only
- **Features**: Optional LLM translation to English

#### 5. **Portugal Cadastre**
- **Module**: `src/enrichments/portugal-cadastre`
- **Description**: Portuguese cadastral information
- **Data Points**:
  - Cadastral references
  - Parcel information
  - Building details
  - Property data from BUPi
- **Data Source**: Portugal cadastral services (OGC API, BUPi, ArcGIS REST)
- **Status**: ✅ Implemented
- **Countries**: PT only
- **Rate Limiting**: 500ms delay
- **Concurrency**: Max 3-5 workers

### Spain Enrichments

#### 6. **Spain Zoning**
- **Module**: `src/enrichments/spain-zoning`
- **Description**: Regional zoning information for Spanish autonomous communities
- **Data Points**: Urban planning and zoning classifications
- **Data Source**: Regional WFS services by Autonomous Community
- **Status**: ✅ Implemented
- **Countries**: ES only
- **Rate Limiting**: 500ms delay
- **Concurrency**: Max 5 workers
- **Features**: Optional LLM translation to English

#### 7. **Spain Cadastre**
- **Module**: `src/enrichments/spain-cadastre`
- **Description**: Spanish cadastral information from Dirección General del Catastro
- **Data Points**:
  - Cadastral references
  - Parcel information (area, dates, reference points, zoning)
  - Building details (dwellings, floors, construction dates)
  - Address data
  - WMS map images (static images, interactive Leaflet maps)
- **Data Source**: Spanish Cadastre WFS and WMS services
- **Status**: ✅ Implemented
- **Countries**: ES only
- **Rate Limiting**: 1000ms delay (default)
- **Concurrency**: Max 3 workers
- **Features**: Map generation, dry-run mode, force refresh, retry failed plots

### Germany Enrichments

#### 8. **Germany Zoning**
- **Module**: `src/enrichments/germany-zoning`
- **Description**: State-level (Länder) zoning information for Germany
- **Data Points**: Land-use plans (Bebauungspläne)
- **Data Source**: State/Länder WFS services
- **Coverage**: 
  - NRW (via OGC API Features)
  - Berlin (via WFS 2.0)
  - Extensible to more Länder
- **Status**: ✅ Implemented
- **Countries**: DE only
- **Rate Limiting**: 500ms delay
- **Concurrency**: Max 5 workers
- **Features**: Optional LLM translation to English

## Not Yet Implemented

### 9. **Climate Enrichment**
- **Module**: `src/enrichments/climate`
- **Description**: Temperature, rainfall, and other climate data
- **Status**: ❌ Not yet implemented

### 10. **Population Enrichment**
- **Module**: `src/enrichments/population`
- **Description**: Population density and demographics
- **Status**: ❌ Not yet implemented

## Supporting Services

### LLM Translation
- **Module**: `src/llm/translate`
- **Description**: Translates zoning labels to English using Gemini
- **Used By**: Spain Zoning, Germany Zoning, CRUS Zoning
- **Provider**: Google Gemini

### Image Enrichment
- **Module**: `src/enrichments/images`
- **Description**: Populates image data from output files
- **Status**: ✅ Implemented

## API Enrichment Orchestrator

### Location-Based Unified Enrichment Endpoint

**Endpoint**: `POST /api/enrich/location`

**Request Body**:
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Response**:
```json
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "country": "US",
  "municipality": {
    "name": "New York",
    "district": "New York",
    "country": "US"
  },
  "amenities": {
    "coastline": { "distance": 5234.5, "nearest_point": {...} },
    "beach": { "distance": 5500.2, "nearest_point": {...} },
    ...
  },
  "zoning": {...},
  "cadastre": {...},
  "enrichments_run": ["municipalities", "amenities", "spain-cadastre", "spain-zoning"],
  "enrichments_skipped": ["portugal-cadastre", "germany-zoning"],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Behavior**:
1. Identifies country/municipality from coordinates
2. Runs applicable enrichments based on location:
   - Always: Amenities, Municipalities
   - For Portugal (PT): CRUS Zoning, Portugal Cadastre
   - For Spain (ES): Spain Zoning, Spain Cadastre
   - For Germany (DE): Germany Zoning
3. Returns consolidated enrichment data
4. Optionally stores results in `enriched_plots_stage` table

**Configuration Options**:
- `store_results`: Whether to persist to database (default: true)
- `translate`: Whether to translate zoning labels to English (default: false)
- `target_language`: Translation target language (default: 'en')

## Technical Notes

### Database Schema

All enrichments store data in the `enriched_plots_stage` table:
- `id`: Plot identifier
- `latitude`: Location latitude
- `longitude`: Location longitude
- `municipality_id`: Foreign key to municipalities table
- `enrichment_data`: JSONB field containing all enrichment results
  - `amenities`: Amenity distances
  - `zoning`: Zoning information
  - `cadastral`: Cadastral data
  - And more...

### Rate Limiting & Concurrency

Each enrichment service has its own rate limiting and concurrency controls:
- **Amenities**: No rate limiting (single combined query)
- **Municipalities**: 1.1s delay (Nominatim requirement)
- **CRUS/Portugal**: 500ms delay, max 3-5 workers
- **Spain**: 500-1000ms delay, max 3-5 workers
- **Germany**: 500ms delay, max 5 workers

### Environment Variables

Key environment variables for configuration:
- `DATABASE_URL`: PostgreSQL connection string
- `GEMINI_API_KEY`: For LLM translation features
- `*_DRY_RUN`: Enable dry-run mode for testing
- `*_CONCURRENCY`: Control concurrent requests
- `*_INTER_PLOT_DELAY_MS`: Control rate limiting
- `*_TRANSLATE`: Enable translation for zoning data
- `*_FORCE_REFRESH`: Re-process existing enriched plots

## Usage Examples

### CLI Usage

```bash
# Run amenities enrichment
npm run amenities

# Run municipalities enrichment for Spain
npm run municipalities-spain

# Run combined enrichment (recommended)
npm run combined

# Run country-specific enrichments
npm run spain-cadastre
npm run portugal-cadastre
npm run germany-zoning
npm run spain-zoning
npm run crus-zoning
```

### API Usage (Planned)

```bash
# Start API server
npm run api

# Enrich a location
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{"latitude": 40.7128, "longitude": -74.0060}'
```
