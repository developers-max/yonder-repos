# Quick Start - Location Enrichment API

## 🚀 Start the Server

```bash
npm run api
```

## 📍 Test with Example Locations

### Madrid, Spain
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{"latitude": 40.4168, "longitude": -3.7038, "store_results": false}'
```

**Expected enrichments**: municipalities, amenities, spain-zoning, spain-cadastre

---

### Lisbon, Portugal
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{"latitude": 38.7223, "longitude": -9.1393, "store_results": false}'
```

**Expected enrichments**: municipalities, amenities, crus-zoning, portugal-cadastre

---

### Berlin, Germany
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{"latitude": 52.5200, "longitude": 13.4050, "store_results": false}'
```

**Expected enrichments**: municipalities, amenities, germany-zoning

---

### New York, USA
```bash
curl -X POST http://localhost:3000/api/enrich/location \
  -H "Content-Type: application/json" \
  -d '{"latitude": 40.7128, "longitude": -74.0060, "store_results": false}'
```

**Expected enrichments**: municipalities, amenities only (no country-specific)

---

## 🧪 Run Full Test Suite

```bash
./src/api/examples/test-api.sh
```

## 📚 List of All Enrichments

### Always Run (Global)
| Service | Description | Source |
|---------|-------------|--------|
| `municipalities` | Country, municipality, district | Nominatim |
| `amenities` | 9 nearby POIs (beach, airport, etc.) | OpenStreetMap |

### Portugal Only
| Service | Description | Source |
|---------|-------------|--------|
| `crus-zoning` | Land-use zoning | DGT CRUS |
| `portugal-cadastre` | Cadastral data | Portuguese Cadastre |

### Spain Only
| Service | Description | Source |
|---------|-------------|--------|
| `spain-zoning` | Regional zoning | Autonomous Communities |
| `spain-cadastre` | Cadastral + maps | Dirección General del Catastro |

### Germany Only
| Service | Description | Source |
|---------|-------------|--------|
| `germany-zoning` | Land-use plans | State/Länder WFS |

## ⚙️ Parameters

```json
{
  "latitude": 40.4168,        // Required: -90 to 90
  "longitude": -3.7038,       // Required: -180 to 180
  "store_results": false,     // Optional: Save to DB (default: true)
  "translate": true,          // Optional: Translate zoning (default: false)
  "target_language": "en"     // Optional: Target lang (default: "en")
}
```

## 🔑 Environment Variables

**Required for database storage:**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
```

**Optional for translation:**
```bash
GOOGLE_API_KEY=your_gemini_api_key
```

**Optional for API:**
```bash
API_PORT=3000  # Default port
```

## 📖 More Documentation

- `src/api/doc/ENRICHMENTS.md` - Complete list of all enrichment services
- `src/api/doc/API_USAGE.md` - Detailed API usage guide
- `src/api/doc/IMPLEMENTATION_SUMMARY.md` - Technical implementation details

## 💡 Tips

1. **First time?** Use `store_results: false` to avoid database writes
2. **Translation?** Requires `GOOGLE_API_KEY` environment variable
3. **Slow response?** Normal! Enrichment takes 5-15 seconds per location
4. **See logs?** Check the console where you ran `npm run api`
5. **Pretty output?** Pipe curl to `jq`: `curl ... | jq '.'`

## 🐛 Troubleshooting

**Server won't start:**
- Check if port 3000 is available
- Set `API_PORT=3001` to use a different port

**"No municipality found":**
- Check coordinates are over land
- Some remote locations may not have data

**"Translation failed":**
- Set `GOOGLE_API_KEY` environment variable
- Or use `translate: false`

**Database errors:**
- Set `store_results: false` if database not configured
- Or configure `DATABASE_URL`
