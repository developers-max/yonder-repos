## Enrichment Goals (OSM-accessible data only)

The goal is to enrich each plot with the following fields:

- `distance_to_major_road` (meters)
- `road_surface_type` (e.g., "asphalt", "gravel")
- `has_public_transport` (boolean)
- `distance_to_beach` (meters)
- `distance_to_airport` (meters)
- `distance_to_town` (meters)
- `nearest_school` (meters)
- `nearest_hospital` (meters)
- `nearest_supermarket` (meters)
- `nearest_restaurant` (meters)

All values should be stored in a JSON object in the `enrichment_data` field in the database.

---

## Tools & APIs

- **OpenStreetMap (Overpass API)** – fetch geospatial data
- **Node.js** – script environment
- **`axios` or `node-fetch`** – to query Overpass
- **`geolib`** – calculate distances
- **`pg`** – to connect to Supabase PostgreSQL DB
- **Supabase** – store and update plot enrichment

---

## Casafari Property Details (New)

A dedicated command is available to fetch property details from Casafari using a specific property ID.

- Endpoint used: `/v1/properties/search/{property_id}` (Base URL defaults to `https://api.casafari.com`)
- Output: The raw JSON response from Casafari is printed to stdout.

### Environment Variables

- `CASAFARI_API_BASE_URL` (optional): Override base URL. Default: `https://api.casafari.com`.
- `CASAFARI_AUTH` (preferred): Full Authorization header value, e.g. `Bearer <token>` or `Basic <token>`.
- `CASAFARI_API_TOKEN` (fallback): If set, it will be used as `Bearer <token>`.

At least one of `CASAFARI_AUTH` or `CASAFARI_API_TOKEN` must be set.

### Usage

- Prompted flow:
  - `npm run casafari`
  - You will be prompted: `Enter Casafari property ID:`

- Passing the property ID as an argument:
  - `npm run casafari -- <PROPERTY_ID>`

Examples:

```bash
export SUPABASE_URL=...
export SUPABASE_KEY=...

export DGT_CRUS_WFS_URL="https://<your-geoserver-host>/geoserver/wfs"
export DGT_CRUS_TYPENAME="crus:crus_portugal_continental"   # example; confirm actual name
export DGT_CRUS_SRS="EPSG:4326"
export DGT_CRUS_GEOM_FIELD="the_geom"
# Optional: choose preferred label fields order
export DGT_CRUS_LABEL_FIELDS="classe,qualificacao,uso"

npm run crus-zoning
```

Each processed plot will gain `enrichment_data.zoning` with:

```json
{
  "label": "<derived label>",
  "picked_field": "<which property was used>",
  "source": "DGT CRUS",
  "typename": "<your typename>",
  "srs": "EPSG:4326",
  "feature_count": 1,
  "sample_properties": { "...": "first feature properties" }
}