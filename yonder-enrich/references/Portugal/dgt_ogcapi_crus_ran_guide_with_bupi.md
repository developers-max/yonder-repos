# DGT OGC API + CRUS/RAN quick guide (for LLM-assisted workflows)

This guide is written to be *copy/pasted into an LLM* so it can help you:
- connect to **DGT’s OGC API service**
- discover **available layers (collections)**
- query **features/items** with practical examples
- focus on **CRUS** (Carta do Regime de Uso do Solo) and **RAN** (Reserva Agrícola Nacional / SRUP)

---

## 0) Key endpoints (DGT)

### OGC API landing page
- `https://ogcapi.dgterritorio.gov.pt/`

### Human-friendly collections list (may be heavy in-browser)
- `https://ogcapi.dgterritorio.gov.pt/collections?f=html`

### OpenAPI (interactive docs)
- `https://ogcapi.dgterritorio.gov.pt/openapi?f=html`

### User manual
- `https://dgterritorio.github.io/ogcapi-user/`

> Tip: Prefer `?f=json` for machine use. Prefer `?f=html` for quick human inspection.

---

## 1) OGC API basics you will use

OGC API endpoints are “resource-centric”. The most useful patterns:

### 1.1 List collections (“layers”)
**HTTP**
- `GET /collections`
- Example:
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections?f=json" | head
```

What to look for in the response:
- `collections[].id`  → collection identifier used in URLs
- `collections[].title` / `description`
- `collections[].links` (often includes items, tiles, schema, queryables)

### 1.2 Get one collection’s metadata
**HTTP**
- `GET /collections/{collectionId}`
- Example:
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections/cadastro?f=json" | head
```

### 1.3 Browse/query items (features)
**HTTP**
- `GET /collections/{collectionId}/items`
- Common parameters (support can vary by server configuration):
  - `f=`: output format (usually `json`, `html`)
  - `limit=`: number of features returned
  - `bbox=`: spatial filter (minx,miny,maxx,maxy) in CRS84 lon/lat by default
  - `offset=`: pagination (if supported)
  - `datetime=`: temporal filter (if the collection supports time)
  - `filter=` / `filter-lang=`: CQL2 filters (if enabled)
  - `properties=`: select a subset of properties (if supported)

Example:
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections/cadastro/items?f=json&limit=1"
```

### 1.4 Discover which attributes are filterable (“queryables”)
Many collections expose:
- `GET /collections/{collectionId}/queryables`

Example:
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections/crus_agueda/queryables?f=json" | head
```

### 1.5 Tiles (fast map consumption)
Some collections provide vector tiles (MVT) and/or raster tiles via **OGC API - Tiles**.

Typical tile template pattern:
- `/collections/{collectionId}/tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}?f=mvt`

Example (CRUS municipality example):
```text
https://ogcapi.dgterritorio.gov.pt/collections/crus_macedo_de_cavaleiros/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}?f=mvt
```

---

## 2) CRUS (Carta do Regime de Uso do Solo)

### 2.1 How CRUS is organized
On DGT OGC API, CRUS appears as **multiple collections**, typically one per municipality, with ids like:
- `crus_agueda`
- `crus_felgueiras`
- `crus_rio_maior`
- `crus_tavira`
- (many more)

Collection titles usually look like:
- `Carta do Regime de Uso do Solo - <MUNICÍPIO>`

### 2.2 Find CRUS collections
If `/collections?f=json` is large/slow, use a strategy like:
1) Pull collections JSON once and grep locally; or
2) Use the HTML page and search for “CRUS”; or
3) Use the server’s search capabilities if exposed.

Simple “download then grep”:
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections?f=json" > collections.json
cat collections.json | grep -i "crus" | head
```

### 2.3 Query CRUS features (GeoJSON)
Example: fetch 5 features from CRUS ÁGUEDA
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections/crus_agueda/items?f=json&limit=5"
```

### 2.4 Query CRUS by bbox (lon/lat)
Example bbox (Portugal-ish window; replace with your AOI):
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections/crus_agueda/items?f=json&limit=100&bbox=-8.6,40.4,-8.3,40.7"
```

### 2.5 Filter CRUS by attribute (when filter/queryables are enabled)
Workflow:
1) Retrieve queryables:
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections/crus_agueda/queryables?f=json"
```
2) Build a filter based on available fields (examples of fields seen in CRUS items include `Designacao`, `Categoria_`, `Municipio`, `Classe_202`, etc. — check queryables for the collection you use).

Possible CQL2 Text example (only if supported by that collection/server):
```bash
curl -G "https://ogcapi.dgterritorio.gov.pt/collections/crus_agueda/items"   --data-urlencode "f=json"   --data-urlencode "filter-lang=cql2-text"   --data-urlencode "filter=Categoria_ = 'Espaço Agrícola'"
```

If filtering isn’t enabled, fallback:
- request by bbox + limit
- filter client-side in Python.

### 2.6 Python example: download CRUS features for an AOI
```python
import requests

base = "https://ogcapi.dgterritorio.gov.pt"
collection = "crus_agueda"  # replace
params = {
    "f": "json",
    "limit": 1000,
    "bbox": "-8.6,40.4,-8.3,40.7",
}

r = requests.get(f"{base}/collections/{collection}/items", params=params, timeout=60)
r.raise_for_status()
data = r.json()

print("returned", len(data.get("features", [])), "features")
# save as GeoJSON
with open("crus_aoi.geojson", "w", encoding="utf-8") as f:
    import json
    json.dump(data, f)
```

---

## 3) RAN + “RAN regulation” (SRUP - Reserva Agrícola Nacional)

### 3.1 Where RAN appears in DGT ecosystem
There are at least two relevant pathways:

1) **CRUS features may mention RAN** in attributes (e.g., “Área Agrícola da RAN”, “integrado na RAN”)
   - This is useful but depends on municipality and CRUS classification text.

2) **SRUP RAN dataset** (Servidão e Restrição de Utilidade Pública) is discoverable via DGT’s catalogue (PoInT)
   - The PoInT record “SRUP - Reserva Agrícola Nacional” links to WMS/WFS services.

### 3.2 Discover SRUP RAN via PoInT (OGC API Records)
PoInT is exposed as a collection:
- `https://ogcapi.dgterritorio.gov.pt/collections/point`

A specific catalogue item for SRUP RAN exists (example record id):
- `528a3b46-555a-4472-85d3-d06c18c34be5`

Human view:
- `https://ogcapi.dgterritorio.gov.pt/collections/point/items/528a3b46-555a-4472-85d3-d06c18c34be5?f=html`

Machine view:
- `https://ogcapi.dgterritorio.gov.pt/collections/point/items/528a3b46-555a-4472-85d3-d06c18c34be5?f=json`

This record includes (key):
- a **WMS GetCapabilities** URL
- a **WFS GetCapabilities** URL

### 3.3 RAN WMS/WFS endpoints (from the SRUP RAN catalogue record)
**WMS (map) GetCapabilities**
```text
https://servicos.dgterritorio.pt/SDISNITWMSSRUP_RAN_PT1/WMService.aspx?service=WMS&request=getcapabilities&VERSION=1.3.0
```

**WFS (features) GetCapabilities**
```text
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_RAN_PT1/WFService.aspx?service=WFS&request=getcapabilities&VERSION=2.0.0
```

### 3.4 Practical use (QGIS)
**OGC API (CRUS etc.)**
- QGIS → Data Source Manager → “WFS / OGC API - Features” (depending on QGIS version)
- Add: `https://ogcapi.dgterritorio.gov.pt/`

**RAN (SRUP) via WMS/WFS**
- QGIS → Data Source Manager → WMS/WMTS:
  - use the WMS GetCapabilities URL above
- QGIS → Data Source Manager → WFS:
  - use the WFS GetCapabilities URL above
- Pick the layer(s) exposed in capabilities (names can vary; always inspect capabilities first)

### 3.5 Extracting RAN features via WFS (example template)
You will need:
- the WFS `typeName` (layer name) from GetCapabilities
- then call GetFeature with bbox or other filters

Template (replace `TYPENAME_GOES_HERE`):
```text
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_RAN_PT1/WFService.aspx?
service=WFS&
version=2.0.0&
request=GetFeature&
typeNames=TYPENAME_GOES_HERE&
outputFormat=application/json&
count=1000&
bbox=-8.6,40.4,-8.3,40.7,urn:ogc:def:crs:EPSG::4326
```

> NOTE: Some WFS servers require EPSG:4326 axis order quirks; if results are empty, try swapping bbox axis or using EPSG:3763 if supported.

### 3.6 What “RAN regulation” typically means in data terms
In many planning/constraints workflows, “RAN regulation” is operationalized as:
- the **delimitation polygons** of RAN (where restrictions apply), plus
- attributes indicating the restriction type/category, status (“em vigor”), etc.

In DGT’s SRUP RAN description:
- RAN is treated as *non aedificandi* zones (i.e., restrictions on building),
- and the delimitation is compiled at **municipal level**, published in the **PDM (Plano Diretor Municipal) condicionantes**.

So, for automated analysis you usually want:
- **RAN polygons** from SRUP WFS
- optionally: cross-reference with **CRUS** (zoning classes), parcels (cadastro), land cover (COS)


---

## 3b) REN + “REN regulation” (SRUP - Reserva Ecológica Nacional)

### 3b.1 What REN is (in DGT SRUP terms)
REN (Reserva Ecológica Nacional) is published as an SRUP (Servidão e Restrição de Utilidade Pública) dataset, i.e., a **legal restriction layer** that conditions land occupation/use/transformation.

In the DGT PoInT catalogue record for REN, DGT notes that the **national REN WFS can be heavy** and suggests using **regional CCDR WFS services** when needed.

### 3b.2 Discover SRUP REN via PoInT (OGC API Records)
PoInT record id for REN:
- `ad95b02a-fbd2-4b8e-89b6-f699a9ff3c0d`

Human view:
- `https://ogcapi.dgterritorio.gov.pt/collections/point/items/ad95b02a-fbd2-4b8e-89b6-f699a9ff3c0d?f=html`

Machine view:
- `https://ogcapi.dgterritorio.gov.pt/collections/point/items/ad95b02a-fbd2-4b8e-89b6-f699a9ff3c0d?f=json`

### 3b.3 REN WMS/WFS endpoints (from the PoInT REN record)

**WMS (map) GetCapabilities**
```text
https://servicos.dgterritorio.pt/SDISNITWMSSRUP_REN_PT1/WMService.aspx?service=WMS&request=getcapabilities
```

**WFS (features) GetCapabilities — regional CCDR services**
```text
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_NORTE/WFService.aspx?service=WFS&request=getcapabilities
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_CENTRO/WFService.aspx?service=WFS&request=getcapabilities
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_LVT/WFService.aspx?service=WFS&request=getcapabilities
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_ALENTEJO/WFService.aspx?service=WFS&request=getcapabilities
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_ALGARVE/WFService.aspx?service=WFS&request=getcapabilities
```

**WFS (features) GetCapabilities — national**
```text
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_PT1/WFService.aspx?service=WFS&request=getcapabilities
```

### 3b.4 Extract REN polygons via WFS (example template)
You must first read WFS GetCapabilities to obtain the correct `typeNames` (layer name).

Template (replace `TYPENAME_GOES_HERE` and bbox/AOI):
```text
https://servicos.dgterritorio.pt/SDISNITWFSSRUP_REN_PT1/WFService.aspx?
service=WFS&
version=2.0.0&
request=GetFeature&
typeNames=TYPENAME_GOES_HERE&
outputFormat=application/json&
count=1000&
bbox=-8.6,40.4,-8.3,40.7,urn:ogc:def:crs:EPSG::4326
```

> Practical tip: Prefer a CCDR regional endpoint matching your AOI if the national service is slow.

---

## 2b) “What layers are available?” (discovery playbook)

### 2b.1 Best case: list collections from the API
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections?f=json" > collections.json
```

Then classify ids (examples):
```bash
# CRUS (often per municipality)
grep -Eo '"id":"crus_[^"]+"' collections.json | head

# COS 2023 (often nationwide + per municipality)
grep -Eo '"id":"cos2023v1[^"]*"' collections.json | head

# COS 2018
grep -Eo '"id":"cos2018v3[^"]*"' collections.json | head

# Core layers often present
grep -Eo '"id":"(cadastro|point|snig|nuts1|distritos)"' collections.json | head
```

### 2b.2 If `/collections` is slow/timeouts: use a search-based fallback
When the service is under load, use a “site search” approach to discover ids:

```bash
# find CRUS collections
python - << 'PY'
import requests, re
import bs4  # pip install beautifulsoup4
import sys
PY
```

If you don’t want HTML parsing, the simplest practical fallback is:
- use your search engine with queries like:
  - `site:ogcapi.dgterritorio.gov.pt/collections crus_`
  - `site:ogcapi.dgterritorio.gov.pt/collections cos2023v1`
  - `site:ogcapi.dgterritorio.gov.pt/collections cadastro`

Once you have a collection id, you can immediately query:
- `/collections/{id}`
- `/collections/{id}/items`

### 2b.3 Collection “families” you should expect to see
From observed live endpoints, common families include:
- `crus_<municipio>` (CRUS, many municipalities)
- `cos2023v1` (COS 2023, plus `cos2023v1_<municipio>`)
- `cos2018v3_<municipio>` (COS 2018)
- `cadastro` (cadastral parcels)
- `nuts1` / `distritos` (administrative boundaries)
- `point` and `snig` (catalogue/metadata access via OGC API Records-like patterns)

> Treat this list as “likely present”; always verify via `/collections` in your environment.


---

## 4) Patterns to automate “discover → extract → analyze”

### 4.1 Recommended automated discovery sequence (robust)
1) Pull DGT OGC API collections:
   - `GET https://ogcapi.dgterritorio.gov.pt/collections?f=json`
2) Identify CRUS collections:
   - ids starting with `crus_`
3) For a chosen CRUS municipality:
   - inspect `/queryables`
   - extract features via `/items?bbox=...&limit=...`
4) For RAN:
   - use PoInT record(s) to obtain WMS/WFS endpoints
   - read WFS GetCapabilities to get layer names
   - extract via WFS GetFeature (GeoJSON) filtered by bbox/AOI

### 4.2 Simple CLI snippets you can hand to an LLM
List CRUS layers (works if collections JSON is accessible):
```bash
curl -s "https://ogcapi.dgterritorio.gov.pt/collections?f=json" | grep -i '"id":"crus_' | head -n 50
```

Fetch a CRUS tile (example z/x/y):
```bash
curl -L -o crus_tile.mvt "https://ogcapi.dgterritorio.gov.pt/collections/crus_macedo_de_cavaleiros/tiles/WebMercatorQuad/12/2100/1400?f=mvt"
```

---

## 5) Notes / gotchas
- Some endpoints can be slow; prefer:
  - smaller `limit`
  - bbox queries
  - vector tiles for visualization
- “One CRUS layer” is usually **not** a single nationwide dataset; it’s often split per municipality.
- RAN is accessible as a **constraint dataset (SRUP)** via WMS/WFS; use GetCapabilities first to confirm exact layer names.

---

## 6) What I (the LLM) should do when you ask for CRUS/RAN data
When the user provides:
- a municipality name (or list), and
- an AOI bbox/polygon, and
- desired output (GeoJSON, GeoPackage, tiles, etc.)

I should:
1) Find matching `crus_<municipio>` collection id(s).
2) Pull `/queryables` and sample items to understand attributes.
3) Extract CRUS via `/items` with bbox and paginate if needed.
4) For RAN:
   - read SRUP RAN WFS capabilities
   - identify layer/typeNames
   - run GetFeature queries for the AOI
5) Return:
   - download links or saved files (GeoJSON/GeoPackage)
   - a short data dictionary of key fields found (e.g., Designacao/Categoria_/Classe_202)


---

## 8) About BUPi (Balcão Único do Prédio) — scope clarification

### 8.1 Is BUPi exposed in the DGT OGC API?
**No.**  
The JIIDE 2025 presentation and the DGT OGC API platform **do not expose BUPi as a dataset or web service**.

BUPi is **not mentioned** in:
- the list of OGC API collections,
- the datasets presented (CRUS, COS, CAOP, Cadastro, Orthophotos, etc.),
- the platform architecture diagrams.

This absence is intentional and consistent with BUPi’s role.

---

### 8.2 Why BUPi is not part of the OGC API platform
BUPi is:
- a **transactional, citizen-facing system**
- focused on **declaration and identification of rural properties**
- involves authentication, validation, and administrative workflows

Therefore, it is **not an open geospatial dataset** and is **out of scope** for:
- OGC API – Features
- OGC API – Tiles
- OGC API – Records

---

### 8.3 Correct integration point: Cadastro Predial
The **official geospatial integration point** for BUPi-related information is:

- **Cadastro Predial – Continente** (explicitly mentioned in the presentation)

Conceptual relationship:
```
BUPi (declarations)
   ↓
Validation / administrative processes
   ↓
Cadastro Predial (DGT)  ← exposed via OGC API
   ↓
Overlay with CRUS + RAN + REN + COS
```

For spatial analysis, automation, or LLM-assisted workflows:
- ❌ Do not expect BUPi APIs or layers
- ✅ Use **Cadastro Predial** as the authoritative parcel layer

---

### 8.4 LLM guardrail (important)
When asked about parcels or property identification:
- **Never assume BUPi data access**
- **Always query Cadastro Predial** from the DGT OGC API
- Treat BUPi only as a *conceptual upstream process*, not a data source

This aligns with the scope and intent described in the JIIDE 2025 presentation.
