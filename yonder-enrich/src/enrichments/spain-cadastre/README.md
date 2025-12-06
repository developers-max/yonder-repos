# Spanish Cadastre Enrichment

This module enriches Spanish plots with cadastral information from Spain's **Dirección General del Catastro** (General Directorate of Cadastre).

## Overview

The Spanish Cadastre is the official government registry of real property, providing definitive legal and geometric descriptions of land parcels. This service queries multiple Cadastre APIs to retrieve:

- **Cadastral references** (unique property identifiers)
- **Property addresses** and postal codes
- **Parcel geometry** and area measurements
- **Building information** (construction details, dwellings, floors)
- **Land use classification**

## Services Used

### 1. OVCCoordenadas Service

REST/SOAP API for geocoding and reverse geocoding cadastral references:
- **Base URL**: `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx`
- **Operations**:
  - `Consulta_RCCOOR`: Get cadastral reference from coordinates
  - `Consulta_RCCOOR_Distancia`: Get all cadastral references within 50m radius

### 2. INSPIRE WFS Services

OGC-compliant Web Feature Services providing spatial data:
- **Cadastral Parcels (CP)**: `http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx`
- **Buildings (BU)**: `http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx`
- **Addresses (AD)**: `http://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx`

## Architecture

The service uses a multi-source lookup strategy:

1. **Primary**: OVCCoordenadas reverse geocoding for cadastral reference
2. **Fallback**: Distance-based search if no exact match
3. **Enhancement**: WFS queries for detailed parcel and building attributes

## Usage

### Basic Command

```bash
npm run spain-cadastre
```

### Direct Script Execution

```bash
# Test a single point (Barcelona example)
ts-node src/enrichments/spain-cadastre/spain_cadastre_lookup.ts --lon 2.1734 --lat 41.3851

# Run enrichment for all Spanish plots
npm run spain-cadastre
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPAIN_CADASTRE_DRY_RUN` | `false` | Enable dry run mode (no database writes) |
| `SPAIN_CADASTRE_DRY_RUN_LIMIT` | `5` | Max plots to process in dry run mode |
| `SPAIN_CADASTRE_CONCURRENCY` | `2` | Number of concurrent workers (1-3 recommended) |
| `SPAIN_CADASTRE_INTER_PLOT_DELAY_MS` | `1000` | Delay between requests (ms) - respect API limits |
| `SPAIN_CADASTRE_FORCE_REFRESH` | `false` | Re-process plots with existing cadastral data |

### Example Usage

```bash
# Dry run with 10 plots
SPAIN_CADASTRE_DRY_RUN=true SPAIN_CADASTRE_DRY_RUN_LIMIT=10 npm run spain-cadastre

# Production run with conservative rate limiting
SPAIN_CADASTRE_CONCURRENCY=2 SPAIN_CADASTRE_INTER_PLOT_DELAY_MS=2000 npm run spain-cadastre

# Force refresh existing data
SPAIN_CADASTRE_FORCE_REFRESH=true npm run spain-cadastre
```

## Data Model

Cadastral data is stored in `enriched_plots_stage.enrichment_data->cadastral`:

```json
{
  "cadastral": {
    "cadastral_reference": "1234567AB1234S0001AB",
    "address": "CL EXAMPLE 123",
    "postal_code": "08001",
    "municipality": "Barcelona",
    "province": "Barcelona",
    "distance_meters": 0,
    "parcel": {
      "national_cadastral_reference": "1234567AB1234S0001AB",
      "area_value": 250.5,
      "beginning_lifespan": "2020-01-01T00:00:00",
      "label": "Residential parcel",
      "reference_point": {
        "x": 2.1734,
        "y": 41.3851
      }
    },
    "building": {
      "reference": "1234567AB1234S0001",
      "condition_of_construction": "functional",
      "current_use": "residential",
      "number_of_dwellings": 12,
      "number_of_building_units": 12,
      "number_of_floors_above_ground": 4
    },
    "cadastral_coordinates": {
      "x": 2.1734,
      "y": 41.3851,
      "srs": "EPSG:4326"
    },
    "source": "Spanish Cadastre OVCCoordenadas",
    "service_urls": [
      "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR",
      "http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx",
      "http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx"
    ],
    "srs": "EPSG:4326",
    "notes": null
  }
}
```

## Cadastral Reference Format

Spanish cadastral references follow this structure:

**Format**: `1234567AB1234S0001AB` (20 characters)

- **Positions 1-7**: Municipality code
- **Positions 8-9**: Province letters
- **Positions 10-13**: Parcel number
- **Position 14**: Section letter
- **Positions 15-18**: Subparcel number
- **Positions 19-20**: Control digits

## Key Features

### Multi-Source Data Integration

- **Primary lookup**: Fast reverse geocoding via OVCCoordenadas
- **Distance search**: Finds nearest properties when exact match unavailable
- **WFS enhancement**: Detailed parcel and building attributes from INSPIRE services

### Rate Limiting & Politeness

- Conservative concurrency (default: 2 workers)
- Configurable inter-request delays (default: 1000ms)
- Respects Spanish Cadastre API usage guidelines

### SSL Certificate Handling

The Spanish Cadastre SSL certificate has known issues (see [GitHub Issue #40](https://github.com/rOpenSpain/CatastRo/issues/40)). This module handles SSL verification gracefully.

## Comparison with Other Services

| Aspect | Spanish Cadastre | Spain Zoning (Regional) |
|--------|------------------|-------------------------|
| **Authority** | National (Dirección General del Catastro) | Regional (17 Autonomous Communities) |
| **Data Type** | Property registry, parcels, buildings | Zoning, land use, urban planning |
| **Coverage** | All of Spain (urban + rural) | Varies by region |
| **API Type** | SOAP + WFS | WFS only |
| **Legal Status** | Official property registry | Informational (varies by region) |
| **Uniqueness** | Cadastral reference (unique per property) | Zoning classification (per area) |

## Known Limitations

1. **SSL Certificate Issues**: The Cadastre API has SSL certificate problems on some systems (handled automatically)
2. **SOAP API Complexity**: OVCCoordenadas uses SOAP, which is more complex than modern REST APIs
3. **Rate Limits**: Conservative rate limiting is necessary to avoid overloading the service
4. **Urban Focus**: Some rural areas may have limited cadastral data
5. **Coordinate Precision**: Small coordinate errors may result in wrong parcel matches

## Common Issues & Solutions

### No Cadastral Reference Found

**Cause**: Point may be in a non-cadastral area (e.g., public roads, natural areas)

**Solution**: Check distance_meters - if >50m, the point is far from registered parcels

### SOAP Request Failures

**Cause**: API may be temporarily unavailable or SSL issues

**Solution**: Module automatically falls back to distance-based search

### Wrong Parcel Match

**Cause**: Coordinates may be imprecise or at parcel boundaries

**Solution**: Review `distance_meters` field - should be close to 0 for confident matches

## References

### Official Documentation

- [Sede Electrónica del Catastro](https://www.sedecatastro.gob.es/)
- [OVCCoordenadas API Documentation](https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx)
- [Catastro INSPIRE Services](https://www.catastro.hacienda.gob.es/webinspire/index.html)
- [INSPIRE Directive](https://inspire.ec.europa.eu/)

### Research Resources

- `/references/spain/Spain Zoning Land Use Data Services.md` - Comprehensive guide to Spanish geospatial services
- [CatastRo R Package](https://ropenspain.github.io/CatastRo/) - Reference implementation

## Future Enhancements

- [ ] Add support for forward geocoding (address → cadastral reference)
- [ ] Implement cadastral reference validation/checksum verification
- [ ] Cache cadastral references to reduce API calls
- [ ] Add historical cadastral data where available
- [ ] Support for querying by cadastral reference directly
- [ ] Integration with property valuation data (if publicly available)
- [ ] Batch download via ATOM feeds for municipalities
- [ ] Support for querying cadastral zones and sections

## Legal Notice

**Copyright**: © Dirección General del Catastro

Cadastral data is provided under the INSPIRE Directive and is subject to the terms and conditions of the Spanish Cadastre. This service is for informational purposes only and does not constitute official cadastral certification.

For official certificates and legal documentation, consult the [Sede Electrónica del Catastro](https://www.sedecatastro.gob.es/).
