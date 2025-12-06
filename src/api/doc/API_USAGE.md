# Yonder Enrichment API Usage Guide

## Quick Start

### 1. Start the API Server

```bash
npm run api
```

The server will start on `http://localhost:3000` (configurable via `API_PORT` environment variable).

### 2. Test the API

#### Health Check
```bash
curl http://localhost:3000/health
```

#### Get API Information
```bash
curl http://localhost:3000/api/enrich/info
```

#### Enrich a Location

**Example: New York City, USA**
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "store_results": true,
    "translate": false
  }'
```

**Example: Madrid, Spain (with translation)**
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.4168,
    "longitude": -3.7038,
    "store_results": true,
    "translate": true,
    "target_language": "en"
  }'
```

**Example: Lisbon, Portugal**
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 38.7223,
    "longitude": -9.1393,
    "store_results": true,
    "translate": true
  }'
```

**Example: Berlin, Germany**
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 52.5200,
    "longitude": 13.4050,
    "store_results": false,
    "translate": true
  }'
```

## Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `latitude` | number | Yes | - | Latitude coordinate (-90 to 90) |
| `longitude` | number | Yes | - | Longitude coordinate (-180 to 180) |
| `store_results` | boolean | No | `true` | Store enrichment results in database |
| `translate` | boolean | No | `false` | Translate zoning labels to English using LLM |
| `target_language` | string | No | `'en'` | Target language for translation |

## Response Structure

```json
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "country": "US",
  "municipality": {
    "id": 123,
    "name": "New York",
    "district": "New York",
    "country": "US"
  },
  "amenities": {
    "coastline": { "distance": 5234.5, "nearest_point": {...} },
    "beach": { "distance": 5500.2, "nearest_point": {...} },
    "airport": { "distance": 15000.0, "nearest_point": {...} },
    "nearest_main_town": { "distance": 0, "nearest_point": {...} },
    "public_transport": { "distance": 150.5, "nearest_point": {...} },
    "supermarket": { "distance": 200.0, "nearest_point": {...} },
    "convenience_store": { "distance": 100.0, "nearest_point": {...} },
    "restaurant_or_fastfood": { "distance": 50.0, "nearest_point": {...} },
    "cafe": { "distance": 75.0, "nearest_point": {...} }
  },
  "zoning": {
    "label": "Residential Urban Zone",
    "label_original": "Zona Urbana Residencial",
    "translated": true,
    "translation_confidence": 0.95,
    "source": "Regional WFS",
    "...": "..."
  },
  "cadastre": {
    "cadastral_reference": "1234567890",
    "...": "..."
  },
  "enrichment_data": {
    "amenities": {...},
    "zoning": {...},
    "cadastral": {...}
  },
  "enrichments_run": [
    "municipalities",
    "amenities",
    "spain-cadastre",
    "spain-zoning"
  ],
  "enrichments_skipped": [
    "portugal-cadastre",
    "crus-zoning",
    "germany-zoning"
  ],
  "enrichments_failed": [],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Enrichment Logic

The API automatically determines which enrichments to run based on the location:

### Always Run
- **Municipalities**: Reverse geocoding to identify country, municipality, and district
- **Amenities**: Find nearby points of interest (beaches, airports, supermarkets, etc.)

### Country-Specific Enrichments

#### Portugal (PT)
- **CRUS Zoning**: Portugal land-use planning from DGT
- **Portugal Cadastre**: Cadastral references and property data

#### Spain (ES)
- **Spain Zoning**: Regional zoning from autonomous communities
- **Spain Cadastre**: Cadastral references, parcel info, building details, and maps

#### Germany (DE)
- **Germany Zoning**: State-level land-use plans (Bebauungspläne)

## Environment Variables

```bash
# Database (required for storing results)
DATABASE_URL=postgresql://user:password@host:5432/database

# API Server
API_PORT=3000

# LLM Translation (optional, for zoning label translation)
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-pro
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200 OK`: Successful enrichment
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Route not found
- `500 Internal Server Error`: Server error

Example error response:
```json
{
  "error": "Invalid request",
  "message": "latitude and longitude are required and must be numbers",
  "example": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "store_results": true,
    "translate": false,
    "target_language": "en"
  }
}
```

## Rate Limiting

The API implements internal rate limiting for external data sources:
- **Nominatim (municipalities)**: 1.1s delay between requests
- **Cadastral services**: 500ms - 1000ms delays
- **OpenStreetMap (amenities)**: Single combined query per location

## Tips for Production Use

1. **Caching**: The API stores results in the database by default. Set `store_results: false` to skip database storage.

2. **Translation**: LLM translation adds latency and requires API keys. Enable only when needed with `translate: true`.

3. **Batch Processing**: For bulk enrichment, consider using the CLI tools instead:
   ```bash
   npm run combined  # Batch process all plots in database
   ```

4. **Error Handling**: Some enrichments may fail without affecting others. Check the `enrichments_failed` array in the response.

5. **Country Detection**: The API automatically detects the country from coordinates. Ensure coordinates are accurate for best results.

## Programmatic Usage (Node.js)

```javascript
import { enrichLocation } from './src/api/location-enrichment';

const result = await enrichLocation({
  latitude: 40.7128,
  longitude: -74.0060,
  store_results: true,
  translate: false,
  target_language: 'en'
});

console.log('Enrichments run:', result.enrichments_run);
console.log('Municipality:', result.municipality);
console.log('Amenities:', result.amenities);
```

## Development

```bash
# Start in development mode with auto-reload
npm run dev

# Run tests
npm test

# Build TypeScript
npm run build
```

## Troubleshooting

### "No municipality found"
- Check if coordinates are valid (land-based locations work best)
- Nominatim may not have data for remote locations

### "No zoning data found"
- Country-specific enrichments require the location to be in that country
- Not all regions have complete zoning data

### "Translation failed"
- Ensure `GOOGLE_API_KEY` is set in environment variables
- Check API quota limits

### Database connection errors
- Verify `DATABASE_URL` is correctly configured
- Set `store_results: false` if database is not available
