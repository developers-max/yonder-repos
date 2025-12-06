# Spanish Zoning Enrichment

This module enriches Spanish plots with zoning and land use information from regional WFS (Web Feature Service) endpoints provided by Spain's Autonomous Communities.

## Overview

Spain has a **decentralized** geospatial data infrastructure. Unlike Portugal's national CRUS system, zoning and urban planning data in Spain is managed at the **regional level** by each Autonomous Community (Comunidad Autónoma).

## Architecture

The service follows a two-step lookup process:

1. **Determine Autonomous Community** - Query IGN's national administrative boundaries WFS to identify which CCAA the point is in
2. **Query Regional Service** - Route to the appropriate regional WFS endpoint for that CCAA

## Supported Regions

Currently configured regional services:

| Region | Service Type | WFS Endpoint | Notes |
|--------|--------------|--------------|-------|
| Catalunya | WFS | `https://sig.gencat.cat/ows/PLANEJAMENT/wfs` | Mapa Urbanístic de Catalunya (MUC) - No legal validity |
| Andalucía | WFS | `http://www.ideandalucia.es/services/DERA_g7_sistema_urbano/wfs` | Urban fabric - Detailed zoning at municipal level |
| Castilla y León | WFS | `https://idecyl.jcyl.es/geoserver/lu/wfs` | Land use WFS |
| Madrid | ATOM | - | Primary access via ATOM feed (not yet implemented) |
| Comunitat Valenciana | WFS | `https://terramapas.icv.gva.es/0101_BCV05` | Base cartography 1:5,000 |

## Usage

### Basic Command

```bash
npm run spain-zoning
```

### Direct Script Execution

```bash
# Test a single point
ts-node src/enrichments/spain-zoning/spain_lookup.ts --lon 2.1734 --lat 41.3851

# Run enrichment for all Spanish plots
npm run spain-zoning
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPAIN_ZONING_DRY_RUN` | `false` | Enable dry run mode (no database writes) |
| `SPAIN_ZONING_DRY_RUN_LIMIT` | `5` | Max plots to process in dry run mode |
| `SPAIN_ZONING_CONCURRENCY` | `3` | Number of concurrent workers (1-5) |
| `SPAIN_ZONING_INTER_PLOT_DELAY_MS` | `500` | Delay between requests (ms) |
| `SPAIN_ZONING_TRANSLATE` | `false` | Enable LLM translation of zoning labels |
| `SPAIN_ZONING_TRANSLATE_TARGET_LANG` | `en` | Target language for translation |

### Example with Environment Variables

```bash
# Dry run with 10 plots
SPAIN_ZONING_DRY_RUN=true SPAIN_ZONING_DRY_RUN_LIMIT=10 npm run spain-zoning

# Production run with translation enabled
SPAIN_ZONING_TRANSLATE=true SPAIN_ZONING_CONCURRENCY=5 npm run spain-zoning
```

## Data Model

Enrichment data is stored in `enriched_plots_stage.enrichment_data->zoning`:

```json
{
  "zoning": {
    "label": "Residencial",
    "label_en": "Residential",
    "picked_field": "uso_suelo",
    "source": "Spain Regional WFS (via spain_lookup)",
    "ccaa": "Catalunya",
    "service_type": "WFS",
    "service_url": "https://sig.gencat.cat/ows/PLANEJAMENT/wfs",
    "srs": "EPSG:4326",
    "feature_count": 3,
    "sample_properties": { ... },
    "notes": "Mapa Urbanístic de Catalunya (MUC) - No legal validity"
  }
}
```

## Key Differences from Portugal CRUS

| Aspect | Portugal (CRUS) | Spain (Regional) |
|--------|-----------------|------------------|
| **Data Authority** | National (DGT) | Regional (17 Autonomous Communities) |
| **API Structure** | Single national OGC API | Multiple regional WFS endpoints |
| **Municipality Resolution** | Direct from DGT municipios | Via IGN administrative boundaries |
| **Service Discovery** | Automatic collection resolution | Manual regional mapping required |
| **Data Harmonization** | Uniform CRUS schema | Varies by region |

## Adding New Regions

To add support for a new autonomous community:

1. Find the regional WFS endpoint (consult the research document)
2. Add to `REGIONAL_SERVICES` in `spain_lookup.ts`:

```typescript
"New Region Name": {
  wfs: "https://example.region.es/wfs",
  type: "WFS",
  notes: "Description and caveats"
}
```

3. Update `extractZoningLabel()` if the region uses different field names

## Limitations

1. **Regional Coverage** - Only regions with configured WFS endpoints are supported
2. **Field Variation** - Zoning field names vary by region, requiring manual mapping
3. **Data Quality** - Some regional services may have gaps or inconsistencies
4. **No Legal Validity** - Many services explicitly state data is for informational purposes only
5. **ATOM Services** - Some regions (e.g., Madrid) use ATOM feeds instead of WFS (not yet implemented)

## References

See `/references/spain/Spain Zoning Land Use Data Services.md` for comprehensive documentation on:
- Spain's IDEE infrastructure
- Regional WFS service inventory
- Field name mapping by region
- API access strategies

## Future Enhancements

- [ ] Add ATOM feed support for Madrid
- [ ] Implement fallback to municipal-level services for Andalucía
- [ ] Add more autonomous communities (País Vasco, Galicia, Navarra, etc.)
- [ ] Harmonize zoning classifications across regions
- [ ] Add caching layer for administrative boundary lookups
- [ ] Support for historical zoning data where available
