# Portugal Geographic Layers

This module provides unified access to all geographic data layers available for Portugal and Spain.

## Overview

| Category | Layer | Source | Service Type | Endpoint |
|----------|-------|--------|--------------|----------|
| **Administrative** | District | DGT GeoServer | WMS GetFeatureInfo | `geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms` |
| | Municipality | DGT OGC API | OGC API Features | `ogcapi.dgterritorio.gov.pt/collections/municipios` |
| | Parish | DGT OGC API | OGC API Features | `ogcapi.dgterritorio.gov.pt/collections/freguesias` |
| | NUTS3 | DGT OGC API | OGC API Features | `ogcapi.dgterritorio.gov.pt/collections/nuts3` |
| **Cadastre** | Portugal Cadastro | DGT OGC API | OGC API Features | Via `portugal_cadastre_lookup.ts` |
| | Spain Catastro | Spanish Cadastre | REST API | Via `spain_cadastre_lookup.ts` |
| | BUPi | Municipal ArcGIS | ArcGIS REST | Via `bupi_arcgis_rest.ts` |
| **Zoning** | CRUS | DGT OGC API | OGC API Features | `crus_<municipio>` collections |
| | REN | Municipal ArcGIS → Regional WFS → National WFS | ArcGIS REST / WFS | See fallback chain below |
| | RAN | Municipal ArcGIS → National WFS | ArcGIS REST / WFS | See fallback chain below |
| **Land Use** | COS 2018 | DGT GeoServer | WMS GetFeatureInfo | `geo2.dgterritorio.gov.pt/geoserver/COS2018/wms` |
| | CLC 2012 | DGT GeoServer | WMS GetFeatureInfo | `geo2.dgterritorio.gov.pt/geoserver/CLC/wms` |
| | Built-up Areas | DGT GeoServer | WMS GetFeatureInfo | `geo2.dgterritorio.gov.pt/geoserver/AE/wms` |
| **Elevation** | Elevation | Open-Elevation | REST API | `api.open-elevation.com/api/v1/lookup` |

---

## Query Order (Portugal)

The `queryAllLayers()` function queries layers in this order:

1. **Administrative** (parallel): District, Municipality, Parish, NUTS3
2. **Cadastre**: Portugal Cadastro (extracts municipality code)
3. **Municipality DB Lookup**: Finds REN/RAN service endpoints from `@yonder/persistence`
4. **Zoning** (parallel): REN, RAN (uses municipality context for service selection)
5. **Land Use + Elevation** (parallel): COS, CLC, Built-up Areas, Elevation

---

## Data Sources

### 1. DGT OGC API (Primary for Administrative & Cadastre)
**Base URL:** `https://ogcapi.dgterritorio.gov.pt`

Modern OGC API Features service providing GeoJSON access to:
- Administrative boundaries (municipalities, parishes, NUTS3)
- CRUS zoning (per municipality)

```bash
# List all collections
curl "https://ogcapi.dgterritorio.gov.pt/collections?f=json"

# Query items in a collection with bbox
curl "https://ogcapi.dgterritorio.gov.pt/collections/municipios/items?bbox=-9.2,38.7,-9.1,38.8&f=json"
```

### 2. DGT GeoServer WMS (Administrative & Land Use)
WMS GetFeatureInfo for districts and land cover classification:

| Layer | WMS URL | Layer Name |
|-------|---------|------------|
| Districts | `https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms` | `cont_distritos` |
| COS 2018 | `https://geo2.dgterritorio.gov.pt/geoserver/COS2018/wms` | `COS2018:COS2018v2` |
| CLC 2012 | `https://geo2.dgterritorio.gov.pt/geoserver/CLC/wms` | `CLC2012` |
| Built-up | `https://geo2.dgterritorio.gov.pt/geoserver/AE/wms` | `AreasEdificadas2018` |

### 3. DGT SRUP WFS (REN/RAN Zoning Restrictions)
**Important:** These services use **Intergraph GeoMedia WFS**, not GeoServer.
- ❌ `CQL_FILTER` is NOT supported
- ✅ Standard WFS `FILTER` with FES 2.0 XML works
- ✅ Filter by `CONCELHO` (municipality) for faster queries

**REN Fallback Chain:**
1. Municipal ArcGIS REST (if `gisVerified` and `renService` configured)
2. Regional DGT WFS (based on latitude: Norte > Centro > LVT > Alentejo > Algarve)
3. National DGT WFS (slowest, last resort)

**RAN Fallback Chain:**
1. Municipal ArcGIS REST (if `gisVerified` and `ranService` configured)
2. National DGT WFS

| Layer | WFS URL | TypeName |
|-------|---------|----------|
| RAN (National) | `https://servicos.dgterritorio.pt/SDISNITWFSSRUP_RAN_PT1/WFService.aspx` | `gmgml:RAN` |
| REN (National) | `https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_PT1/WFService.aspx` | `gmgml:REN_Nacional` |
| REN Norte | `https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_NORTE/WFService.aspx` | `gmgml:REN_Nacional` |
| REN Centro | `https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_CENTRO/WFService.aspx` | `gmgml:REN_Nacional` |
| REN LVT | `https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_LVT/WFService.aspx` | `gmgml:REN_Nacional` |
| REN Alentejo | `https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_ALENTEJO/WFService.aspx` | `gmgml:REN_Nacional` |
| REN Algarve | `https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_ALGARVE/WFService.aspx` | `gmgml:REN_Nacional` |

**Query Example (filter by municipality):**
```bash
curl "https://servicos.dgterritorio.pt/SDISNITWFSSRUP_RAN_PT1/WFService.aspx?\
service=WFS&version=2.0.0&request=GetFeature&typeNames=gmgml:RAN&\
outputFormat=application/vnd.geo%2Bjson&count=10&\
FILTER=<fes:Filter xmlns:fes=\"http://www.opengis.net/fes/2.0\">\
<fes:PropertyIsEqualTo><fes:ValueReference>CONCELHO</fes:ValueReference>\
<fes:Literal>SINTRA</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>"
```

### 4. Municipal ArcGIS REST Services (REN/RAN)
Some municipalities provide dedicated ArcGIS REST services for REN/RAN.
These are faster and more detailed than national services.

Service URLs are stored in the `portugal_municipalities` database table:
- `ren_service` - REN ArcGIS MapServer URL
- `ran_service` - RAN ArcGIS MapServer URL

---

## Layer Details

### Administrative Layers

| Layer ID | Description | Key Attributes |
|----------|-------------|----------------|
| `pt-distrito` | District | `distrito` |
| `pt-municipio` | Municipality | `municipio`, `distrito` |
| `pt-freguesia` | Parish | `freguesia`, `municipio`, `distrito` |
| `pt-nuts3` | NUTS3 Region | `nuts3`, `nuts2`, `nuts1` |

### Cadastre

| Layer ID | Description | Key Attributes |
|----------|-------------|----------------|
| `pt-cadastro` | Cadastral Parcel | `parcelReference`, `inspireId`, `areaM2`, `municipalityCode` |

### Zoning (Legal Restrictions)

| Layer ID | Description | Key Attributes | Building Impact |
|----------|-------------|----------------|-----------------|
| `pt-crus` | Municipal Zoning (PDM) | `label`, `category`, `typename` | Defines allowed uses |
| `pt-ren` | Ecological Reserve | `designation`, `type`, `legalRef` | **Building restricted** |
| `pt-ran` | Agricultural Reserve | `designation`, `type`, `legalRef` | **Building restricted** |

**REN/RAN Attributes (from DGT SRUP WFS):**
```json
{
  "DESIGNACAO": "DELIMITAÇÃO DA REN DO CONCELHO",
  "TIPOLOGIA": "Reserva Ecológica Nacional",
  "LEI_TIPO": "DL 166/2008",
  "SERV_LEI": "AVISO 20905/2023",
  "AREA_HA": 21931.23,
  "CONCELHO": "OVAR",
  "TUTELA": "CCDR CENTRO"
}
```

### Land Use (Physical Classification)

| Layer ID | Description | Key Attributes |
|----------|-------------|----------------|
| `pt-cos` | COS 2018 Land Cover | `cos`, `cosLevel1-4`, `cosCode` |
| `pt-clc` | CORINE Land Cover 2012 | `clc`, `clcLevel1-3`, `clcCode` |
| `pt-built-up` | Built-up Areas | `builtUp`, `areaHa` |

### Elevation

| Layer ID | Description | Key Attributes |
|----------|-------------|----------------|
| `elevation` | Terrain Elevation | `elevationM` |

---

## Usage

### Query All Layers
```typescript
import { queryAllLayers } from 'yonder-enrich/layers';

const result = await queryAllLayers({
  lat: 38.7223,
  lng: -9.1393,
  country: 'PT',
  areaM2: 10000, // Optional: area context
});

// Result includes all layer data
console.log(result.layers);
```

### Query Specific Layer Types
```typescript
import { queryLayersByType } from 'yonder-enrich/layers';

const layers = await queryLayersByType(
  38.7223, -9.1393,
  ['administrative', 'cadastre', 'landuse'],
  10000
);
```

### Query Individual Layers
```typescript
import { 
  queryMunicipality,
  queryPortugueseCadastre,
  queryCRUSZoning,
  queryREN,
  queryRAN,
  queryCOS,
} from 'yonder-enrich/layers';

// Administrative
const municipality = await queryMunicipality(38.7223, -9.1393);

// Cadastre
const cadastre = await queryPortugueseCadastre(38.7223, -9.1393);

// Zoning (CRUS uses OGC API, fast)
const crus = await queryCRUSZoning(38.7223, -9.1393);

// REN/RAN (needs municipality record for optimal queries)
const ren = await queryREN(38.7223, -9.1393, municipalityRecord);
const ran = await queryRAN(38.7223, -9.1393, municipalityRecord);

// Land Use
const cos = await queryCOS(38.7223, -9.1393);
```

---

## Query Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     queryAllLayers()                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Administrative (DGT OGC API)                                │
│     District → Municipality → Parish → NUTS3                    │
│     Extract: municipioName                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Cadastre (DGT OGC API)                                      │
│     Query cadastro collection                                   │
│     Extract: municipalityCode                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Municipality DB Lookup                                      │
│     Find municipality record with REN/RAN service URLs          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Zoning (REN/RAN)                                            │
│     IF municipal service exists → Query ArcGIS REST             │
│     ELSE → Query DGT SRUP WFS (filtered by CONCELHO)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Land Use & Elevation (parallel)                             │
│     COS, CLC, Built-up (WMS) + Elevation (REST)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Spain Layers

For Spain, the module currently supports:
- **Cadastre**: Spanish Catastro via `spain_cadastre_lookup.ts`
- **Elevation**: Open-Elevation API (same as Portugal)

```typescript
import { querySpanishCadastre, queryElevation } from 'yonder-enrich/layers';

const cadastre = await querySpanishCadastre(lat, lng);
const elevation = await queryElevation(lat, lng);
```

---

## Module Files

| File | Description |
|------|-------------|
| `index.ts` | Main entry point, exports all functions, implements `queryAllLayers()` |
| `administrative.ts` | District, Municipality, Parish, NUTS3 queries (OGC API + WMS) |
| `cadastre.ts` | Portugal & Spain cadastre wrappers |
| `zoning.ts` | CRUS, REN, RAN queries (OGC API, ArcGIS REST, WFS) |
| `land-use.ts` | COS, CLC, Built-up Areas queries (WMS GetFeatureInfo) |
| `elevation.ts` | Open-Elevation API wrapper |
| `types.ts` | TypeScript interfaces for all layer data |

---

## References

- [DGT OGC API](https://ogcapi.dgterritorio.gov.pt/)
- [DGT OGC API User Manual](https://dgterritorio.github.io/ogcapi-user/)
- [SRUP Portal](https://www.dgterritorio.gov.pt/ordenamento/sgt/srup)
- [Open-Elevation API](https://open-elevation.com/)
- [SNIG Metadata](https://snig.dgterritorio.gov.pt/rndg/srv/search)
