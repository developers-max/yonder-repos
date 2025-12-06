# Spanish Cadastre Data Storage

## Database Schema

The cadastral enrichment data is stored in the `enriched_plots_stage` table's `enrichment_data` JSONB column under the `cadastral` key.

### Table Structure

```sql
CREATE TABLE IF NOT EXISTS enriched_plots_stage (
  id TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  enrichment_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_enrichment_cadastral 
ON enriched_plots_stage USING gin ((enrichment_data->'cadastral'));
```

## Stored Data Structure

```json
{
  "cadastral": {
    "cadastral_reference": "0044005DF4904S",
    "address": "03",
    "postal_code": null,
    "municipality": "Sant Cugat del Vallès",
    "province": "Barcelona",
    "distance_meters": 33.5,
    
    "parcel": {
      "cadastral_reference": "0044005DF4904S",
      "area_value": 1021,
      "label": "05",
      "beginning_lifespan": "2010-10-25T00:00:00",
      "reference_point": {
        "type": "Point",
        "coordinates": [2.280290, 41.498485]
      },
      "zoning": [],
      "geometry": { "type": "Unknown", "coordinates": [] }
    },
    
    "parcels": [ /* array of all parcels at location */ ],
    "parcel_count": 1,
    
    "building": { /* primary building data */ },
    "buildings": [ /* array of all buildings */ ],
    "building_count": 0,
    
    "addresses": [ /* array of addresses */ ],
    "address_count": 0,
    
    "map_images": {
      "wms_url": "http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx?...",
      "viewer_url": "data:text/html;base64,...",
      "embeddable_html": "<img src=\"...\" />",
      "description": "WMS map images showing cadastral parcels and buildings..."
    },
    
    "cadastral_coordinates": {
      "x": 2.28,
      "y": 41.49878,
      "srs": "EPSG:4326"
    },
    
    "source": "Spanish Cadastre WFS (Parcels)",
    "service_urls": ["http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx"],
    "srs": "EPSG:4326",
    "notes": null
  }
}
```

## Map Images Storage

### What's Stored:

1. **`wms_url`** (string, ~500 bytes)
   - Direct WMS GetMap URL
   - Can be used as `<img src="...">`
   - Always fresh (generated on demand)

2. **`viewer_url`** (string, ~5-10 KB)
   - Data URI with embedded HTML viewer
   - Complete standalone page
   - Can be opened directly: `window.open(viewer_url)`

3. **`embeddable_html`** (string, ~500 bytes)
   - Ready-to-use `<img>` tag
   - Easy embedding in web pages

4. **`interactive_map_html`** (string, ~15-20 KB) - **OPTIONAL**
   - Full Leaflet interactive map
   - **Not stored by default** to save space
   - Can be regenerated on-demand from plot data

### Storage Size Estimate:

- **With interactive map**: ~25-30 KB per plot
- **Without interactive map**: ~6-11 KB per plot (recommended)

For **10,000 plots**:
- With interactive map: ~250-300 MB
- Without interactive map: ~60-110 MB

## Query Examples

### Get plots with cadastral data:

```sql
SELECT 
  id,
  latitude,
  longitude,
  enrichment_data->'cadastral'->>'cadastral_reference' as cadastral_ref,
  enrichment_data->'cadastral'->'map_images'->>'wms_url' as map_url
FROM enriched_plots_stage
WHERE enrichment_data->'cadastral' IS NOT NULL;
```

### Get plots by municipality:

```sql
SELECT *
FROM enriched_plots_stage
WHERE enrichment_data->'cadastral'->>'municipality' = 'Sant Cugat del Vallès';
```

### Get plots with buildings:

```sql
SELECT *
FROM enriched_plots_stage
WHERE (enrichment_data->'cadastral'->>'building_count')::int > 0;
```

### Get map image URL for a plot:

```sql
SELECT 
  id,
  enrichment_data->'cadastral'->'map_images'->>'wms_url' as map_url,
  enrichment_data->'cadastral'->'map_images'->>'embeddable_html' as embed_code
FROM enriched_plots_stage
WHERE id = '08813cfd-f27c-4ded-90fe-2c7c7a32af3f';
```

## Generating Interactive Maps On-Demand

Since `interactive_map_html` is not stored (to save space), you can regenerate it when needed:

```typescript
import { getSpanishCadastralInfo } from './spain_cadastre_lookup';

// Fetch from database
const plot = await db.query('SELECT * FROM enriched_plots_stage WHERE id = $1', [plotId]);
const cadastralData = plot.rows[0].enrichment_data.cadastral;

// If you need the interactive map, regenerate it
if (cadastralData && !cadastralData.map_images.interactive_map_html) {
  const fullData = await getSpanishCadastralInfo(
    plot.rows[0].longitude,
    plot.rows[0].latitude
  );
  
  // Use the interactive_map_html
  const mapHtml = fullData.map_images.interactive_map_html;
}
```

## Frontend Integration

### Option 1: Simple Image

```html
<img src="{{ cadastral.map_images.wms_url }}" alt="Cadastral Map" />
```

### Option 2: Embeddable HTML

```html
<div v-html="cadastral.map_images.embeddable_html"></div>
```

### Option 3: Interactive Map (regenerate or store separately)

```html
<!-- Save as separate .html file or load in iframe -->
<iframe 
  :src="cadastral.map_images.viewer_url" 
  width="100%" 
  height="600px" 
  frameborder="0">
</iframe>
```

### Option 4: Leaflet Integration (Best for production)

```javascript
// In your frontend, use Leaflet with the WMS URL
const map = L.map('map').setView([lat, lon], 18);

// Add Spanish Cadastre WMS layer
L.tileLayer.wms('http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx', {
  layers: 'CP.CadastralParcel',
  format: 'image/png',
  transparent: true,
  version: '1.1.1'
}).addTo(map);

// Add marker at plot location
L.marker([lat, lon]).addTo(map);
```

## Best Practices

1. **Store WMS URLs** - Small and always work
2. **Store embeddable HTML** - Quick to render
3. **DON'T store large HTML** - Regenerate interactive maps on-demand
4. **Use JSONB indexes** - Fast queries on cadastral data
5. **Cache on frontend** - Reduce database load for map tiles
6. **Consider CDN** - Cache WMS tiles if allowed by Cadastre terms

## Performance Tips

- WMS URLs can be cached client-side
- Interactive maps should be lazy-loaded
- Use database indexes for cadastral reference lookups
- Consider materialized views for common queries
