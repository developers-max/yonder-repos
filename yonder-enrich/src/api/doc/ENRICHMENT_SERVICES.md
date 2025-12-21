# Enrichment Services - Third-Party APIs & Endpoints

This document summarizes all external services and endpoints used by the yonder-enrich location enrichment service for Portugal, Spain, and Germany.

---

## 🇵🇹 Portugal

### Cadastre (Cadastro Predial)

| Service | Provider | Endpoint |
|---------|----------|----------|
| **OGC API Features** | DGT (Direção-Geral do Território) | `https://ogcapi.dgterritorio.gov.pt` |

**Collections used:**
- `cadastro` - Cadastro Predial (land parcels)

**Data returned:**
- `nationalcadastralreference` - NIC (Número de Inscrição na Carta Cadastral)
- `inspireid` - INSPIRE identifier
- `areavalue` - Parcel area in m²
- `beginlifespanversion` - Registration date
- `administrativeunit` - Municipality code
- Parcel geometry (MultiPolygon/Polygon)

**Source file:** `src/enrichments/portugal-cadastre/portugal_cadastre_lookup.ts`

---

### Zoning (CRUS - Carta de Regime de Uso do Solo)

| Service | Provider | Endpoint |
|---------|----------|----------|
| **OGC API Features** | DGT (Direção-Geral do Território) | `https://ogcapi.dgterritorio.gov.pt` |

**Collections used:**
- `municipios` - Municipality boundaries
- `freguesias` - Parish (freguesia) boundaries
- `cos2023v1` - COS2023 Land Cover/Land Use
- Municipality-specific CRUS collections (dynamically discovered)

**Data returned:**
- `Designacao` - Main zoning designation/label
- `Categoria_` - Zoning category
- `Classe_202` - Land class (Solo Rústico/Urbano)
- `AREA_HA` - Area in hectares
- `Data_Pub_O` - Publication date
- `Municipio` - Municipality name
- Parish information (freguesia, distrito)
- Land cover classification (COS23_n4_C, COS23_n4_L)

**Source files:**
- `src/api/helpers/crus-helpers.ts`
- `src/enrichments/crus/crus_lookup.ts`

---

## 🇪🇸 Spain

### Cadastre (Catastro)

| Service | Provider | Endpoint |
|---------|----------|----------|
| **WFS Parcels** | Catastro (Ministerio de Hacienda) | `http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx` |
| **WFS Buildings** | Catastro | `http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx` |
| **WFS Addresses** | Catastro | `http://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx` |
| **WMS Maps** | Catastro | `http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx` |

**WFS TypeNames:**
- `CP.CadastralParcel` - Cadastral parcels
- `BU.Building` - Buildings
- `AD.Address` - Addresses

**Coordinate Systems:**
- `EPSG:25829` - UTM zone 29N (Canary Islands, western Spain)
- `EPSG:25830` - UTM zone 30N (Most of western/central Spain)
- `EPSG:25831` - UTM zone 31N (Catalunya, eastern Spain)

**Data returned:**
- `nationalCadastralReference` - Cadastral reference number
- `areaValue` - Parcel area in m²
- `label` - Parcel label
- `beginLifespanVersion` - Registration date
- Building info: construction date, floors, dwellings, current use
- Address info: street, postal code, locality

**Source file:** `src/enrichments/spain-cadastre/spain_cadastre_lookup.ts`

---

### Zoning (Urbanismo)

| Service | Provider | Endpoint |
|---------|----------|----------|
| **WFS Admin Units** | IGN (Instituto Geográfico Nacional) | `https://www.ign.es/wfs-inspire/unidades-administrativas` |

**Regional Services (Autonomous Communities):**

| Region | Service URL | Type | Notes |
|--------|------------|------|-------|
| **Catalunya** | `https://sig.gencat.cat/ows/PLANEJAMENT/wfs` | WFS | Mapa Urbanístic de Catalunya (MUC) |
| **Andalucía** | `http://www.ideandalucia.es/services/DERA_g7_sistema_urbano/wfs` | WFS | Sistema Urbano |
| **Castilla y León** | `https://idecyl.jcyl.es/geoserver/lu/wfs` | WFS | Land use WFS |
| **Comunitat Valenciana** | `https://terramapas.icv.gva.es/0101_BCV05` | WFS | Base cartography 1:5,000 |
| **Comunidad de Madrid** | - | ATOM | Primary access via ATOM feed |

**Data returned:**
- Autonomous community name
- Municipal zoning classification
- Regional planning data (varies by autonomous community)

**Source file:** `src/enrichments/spain-zoning/spain_lookup.ts`

---

## 🇩🇪 Germany

### Zoning (Bebauungspläne / Flächennutzungspläne)

Germany has a federated structure where each state (Bundesland) provides its own planning data services:

| State | Service URL | Type |
|-------|-------------|------|
| **NRW (Nordrhein-Westfalen)** | `https://ogc-api.nrw.de/inspire-lu-bplan/api` | OGC API |
| **Berlin** | `https://fbinter.stadt-berlin.de/fb/wfs/data` | WFS |
| **Baden-Württemberg** | `https://www.geoportal-raumordnung-bw.de/ows/services/...` | WFS |
| **Hamburg** | `https://geodienste.hamburg.de/HH_WFS_FNP` | WFS |
| **Niedersachsen** | `https://opendata.lgln.niedersachsen.de/doorman/noauth/verwaltungsgrenzen_wfs` | WFS |

**Berlin WFS TypeNames:**
- `fis:re_bplan` - Bebauungspläne (development plans)

**Coordinate Systems:**
- `EPSG:25832` - UTM zone 32 (western Germany)
- `EPSG:25833` - UTM zone 33 (eastern Germany)

**Data returned:**
- `ArtDerBaulichenNutzung` - Type of building use
- `Nutzung` / `nutzung` - Usage
- `Zweckbestimmung` - Purpose designation
- `Gebietstyp` - Area type
- `Planname` / `Bebauungsplan` - Plan name

**State detection:** Based on coordinate bounding boxes:
- Berlin: lon 13.09-13.77, lat 52.33-52.68
- NRW: lon 5.86-9.46, lat 50.30-52.55
- Hamburg: lon 9.70-10.30, lat 53.30-53.75
- Baden-Württemberg: lon 7.30-10.50, lat 47.50-49.80
- Niedersachsen: lon 6.60-11.60, lat 51.30-53.90

**Source file:** `src/enrichments/germany-zoning/germany_lookup.ts`

---

## Common Dependencies

| Library | Purpose |
|---------|---------|
| `axios` | HTTP client for API requests |
| `xml2js` | XML parsing for WFS responses |
| `proj4` | Coordinate system transformations |
| `@turf/boolean-point-in-polygon` | Point-in-polygon tests |
| `@turf/helpers` | GeoJSON geometry helpers |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DGT_OGC_BASE` | `https://ogcapi.dgterritorio.gov.pt` | Portugal DGT OGC API base |
| `IGN_BASE` | `https://www.ign.es/wfs-inspire/unidades-administrativas` | Spain IGN WFS base |
| `NRW_API_BASE` | `https://ogc-api.nrw.de/inspire-lu-bplan/api` | Germany NRW OGC API |
| `BERLIN_WFS_BASE` | `https://fbinter.stadt-berlin.de/fb/wfs/data` | Germany Berlin WFS |
| `BERLIN_WFS_TYPENAMES` | `fis:re_bplan` | Berlin WFS layer names |
| `BW_WFS_BASE` | (see code) | Germany Baden-Württemberg WFS |
| `HAMBURG_WFS_BASE` | `https://geodienste.hamburg.de/HH_WFS_FNP` | Germany Hamburg WFS |

---

## API Orchestration

The `enrichLocation()` function in `src/api/location-enrichment.ts` orchestrates all enrichments:

1. **Determine country** from coordinates (reverse geocoding)
2. **Run country-specific enrichments:**
   - **PT**: Portugal Cadastre + CRUS Zoning
   - **ES**: Spain Cadastre + Spain Zoning
   - **DE**: Germany Zoning
3. **Optional translation** of zoning labels via LLM
4. **Store results** in database (if `store_results: true`)

---

*Last updated: December 2024*
