# Quick Start - Unified Layers Enrichment

## What This Does

Fetches **all available geographic layers** for each plot in a single enrichment run:

- **Portugal**: Administrative, Cadastre, CRUS/REN/RAN Zoning, Land Use (COS/CLC), Elevation
- **Spain**: Cadastre, Zoning, Elevation

Stores everything in `enrichment_data.layers` field.

## Run It

```bash
cd yonder-enrich

# Run for all plots
npm run layers

# Dry run first (recommended)
LAYERS_DRY_RUN=true LAYERS_DRY_RUN_LIMIT=5 npm run layers

# Portugal only
LAYERS_COUNTRY=PT npm run layers

# Spain only
LAYERS_COUNTRY=ES npm run layers

# Force refresh existing plots
LAYERS_FORCE_REFRESH=true npm run layers
```

## Environment Variables

```bash
# .env or inline
LAYERS_DRY_RUN=true              # No database writes
LAYERS_DRY_RUN_LIMIT=5          # Limit in dry run mode
LAYERS_COUNTRY=PT               # Filter by country (PT or ES)
LAYERS_FORCE_REFRESH=true       # Re-process plots with existing data
LAYERS_CONCURRENCY=2            # Worker threads (default: 2)
LAYERS_INTER_PLOT_DELAY_MS=1000 # Delay between plots (default: 1000ms)
```

## Output Structure

```json
{
  "enrichment_data": {
    "layers": {
      "timestamp": "2025-01-02T16:30:00.000Z",
      "coordinates": { "lat": 38.7223, "lng": -9.1393 },
      "country": "PT",
      "layersByCategory": {
        "administrative": [...],
        "cadastre": [...],
        "zoning": [...],
        "landuse": [...],
        "elevation": [...]
      },
      "layersRaw": [...]
    },
    "cadastral": {...},  // Preserved
    "zoning": {...},     // Preserved
    "amenities": {...}   // Preserved
  }
}
```

## Replaces These Enrichments

This unified enrichment **includes** data from:
- ✅ `portugal-cadastre` → now in `layers.cadastre`
- ✅ `spain-cadastre` → now in `layers.cadastre`
- ✅ `crus` → now in `layers.zoning`
- ✅ `spain-zoning` → now in `layers.zoning`

The old enrichments can still be run independently, but this is the recommended approach for comprehensive layer data.

## CLI Option

When running `npm start`, select option **22** for Unified Layers enrichment.
