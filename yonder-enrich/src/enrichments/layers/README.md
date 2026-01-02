# Unified Layers Enrichment

This enrichment module fetches **all available geographic layers** for each plot and stores them in the `enrichment_data.layers` field.

## Overview

Instead of running separate enrichments for cadastre, zoning, and other geographic data, this unified enrichment queries all layers at once using the `queryAllLayers()` function from `src/layers/`.

## What It Does

For each plot, it fetches:

### Portugal (PT)
- **Administrative**: District, Municipality, Parish, NUTS3
- **Cadastre**: Portuguese Cadastro (DGT OGC API)
- **Zoning**: CRUS, REN, RAN
- **Land Use**: COS 2018, CLC 2012, Built-up Areas
- **Elevation**: Terrain elevation

### Spain (ES)
- **Cadastre**: Spanish Catastro
- **Zoning**: Regional WFS services
- **Elevation**: Terrain elevation

## Data Structure

The enrichment stores data in `enrichment_data.layers`:

```typescript
{
  "layers": {
    "timestamp": "2025-01-02T16:30:00.000Z",
    "coordinates": { "lat": 38.7223, "lng": -9.1393 },
    "country": "PT",
    "layersByCategory": {
      "administrative": [
        {
          "layerId": "pt-distrito",
          "layerName": "Distrito",
          "found": true,
          "data": { "distrito": "Lisboa" }
        },
        {
          "layerId": "pt-municipio",
          "layerName": "Município",
          "found": true,
          "data": { "municipio": "Lisboa", "distrito": "Lisboa" }
        }
      ],
      "cadastre": [
        {
          "layerId": "pt-cadastro",
          "layerName": "Cadastro",
          "found": true,
          "data": {
            "parcelReference": "123456",
            "areaM2": 1000,
            "municipalityCode": "1106"
          }
        }
      ],
      "zoning": [...],
      "landuse": [...],
      "elevation": [...]
    },
    "layersRaw": [...]  // Full layer data for advanced queries
  }
}
```

## Usage

### Run the enrichment

```bash
cd yonder-enrich

# Process all plots
npm run enrich:layers

# Dry run (no database writes)
LAYERS_DRY_RUN=true npm run enrich:layers

# Process only Portugal plots
LAYERS_COUNTRY=PT npm run enrich:layers

# Force refresh all plots
LAYERS_FORCE_REFRESH=true npm run enrich:layers
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LAYERS_DRY_RUN` | `false` | If `true`, no database writes |
| `LAYERS_DRY_RUN_LIMIT` | `5` | Max plots in dry run mode |
| `LAYERS_INTER_PLOT_DELAY_MS` | `1000` | Delay between plots (ms) |
| `LAYERS_CONCURRENCY` | `2` | Number of concurrent workers |
| `LAYERS_FORCE_REFRESH` | `false` | Re-process plots with existing data |
| `LAYERS_COUNTRY` | - | Filter by country (`PT` or `ES`) |

## Advantages Over Individual Enrichments

1. **Single Query**: Fetches all layers in one enrichment run
2. **Optimized**: The `queryAllLayers()` function queries layers in parallel where possible
3. **Consistent**: All layer data has the same timestamp
4. **Comprehensive**: Includes all available layers for the plot's location
5. **Maintainable**: Leverages existing `src/layers/` infrastructure

## Relationship to Existing Enrichments

This enrichment **replaces** the need for:
- `portugal-cadastre` - Now included in layers.cadastre
- `spain-cadastre` - Now included in layers.cadastre
- `crus` - Now included in layers.zoning
- `spain-zoning` - Now included in layers.zoning

The old enrichments can still be run independently if needed, but this unified approach is recommended for new plots.

## Implementation Details

- Uses `queryAllLayers()` from `src/layers/` for layer queries
- Stores data in `enrichment_data.layers` field
- Preserves all other enrichment data (cadastral, zoning, amenities, etc.)
- Categorizes layers by type for easier querying
- Includes both categorized and raw layer data

## Data Preservation

This enrichment follows the standard pattern:
- ✅ Preserves all existing enrichment fields
- ✅ Only updates the `layers` field
- ✅ Validates no data loss before writing
- ✅ Logs preserved enrichment types

## Error Handling

- Invalid coordinates are skipped with warnings
- Individual layer failures don't stop the enrichment
- Each layer includes `found` and optional `error` fields
- Database write failures are logged and skipped
