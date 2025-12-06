# BUPi Available Services & Data Fields

## Available Services & Layers

### 1. **Open Data Services** (Public Access ✅)

#### A. Continental Portugal
- **Endpoint**: `https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT/MapServer`
- **Layer 0**: "Dados Abertos - RGG Continente"
- **Coverage**: Portugal Continental only
- **Native CRS**: EPSG:3763 (ETRS89 / PT-TM06)
- **Max Records**: 2,000 per query
- **Formats**: JSON, GeoJSON, PBF
- **Extensions**: WFSServer, WMSServer

**Available Fields** (LIMITED):
```json
{
  "objectid": "Integer (Primary Key)",
  "shape": "Geometry (Polygon)",
  "st_area(shape)": "Double (Area in m²)",
  "st_length(shape)": "Double (Perimeter in m)"
}
```

#### B. Madeira
- **Endpoint**: `https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT_Madeira/MapServer`
- **Layer 0**: "Dados Abertos - RGG Madeira"
- **Coverage**: Madeira islands
- **Native CRS**: EPSG:5016 (PTRA08-UTM / Azores Central Islands)
- **Max Records**: 2,000 per query

**Available Fields** (SAME LIMITED SET):
```json
{
  "objectid": "Integer (Primary Key)",
  "shape": "Geometry (Polygon)",
  "st_area(shape)": "Double (Area in m²)",
  "st_length(shape)": "Double (Perimeter in m)"
}
```

---

### 2. **Partner Services** (Parceiros - Requires Authentication? 🔒)

#### A. BUPi_v1 (Full Dataset)
- **Endpoint**: `https://geo.bupi.gov.pt/arcgis/rest/services/Parceiros/BUPi_v1/MapServer`
- **Layer 0**: "RGG_Continente"
- **Coverage**: Portugal Continental
- **Extensions**: EBUPI_BlockAccess_SOIFilter_114, FeatureServer, WFSServer, WMSServer
- ⚠️ **Note**: "EBUPI_BlockAccess_SOIFilter_114" suggests access control

**Available Fields** (COMPREHENSIVE):
```json
{
  "objectid": "Integer (Primary Key)",
  "shape": "Geometry (Polygon)",
  
  // Process Information
  "processoid": "Integer - Process ID",
  "idestadoprocesso": "SmallInt - Process State ID",
  "estadoprocessodesc": "String(255) - Process State Description",
  "dt_process": "Date - RGG Creation Date",
  
  // Administrative Boundaries
  "concelhodesc": "String(255) - Municipality Name",
  "dicofre": "String(6) - Parish Code (DICOFRE)",
  "freguesiadesc": "String(255) - Parish Name",
  
  // Property Information
  "naturezamatrizdesc": "String(50) - Property Type (Urban/Rural)",
  "numeromatriz": "String(1000) - Tax Registration Number(s)",
  
  // Owner/Promoter Information (PII)
  "promotornome": "String(255) - Promoter/Owner Name",
  "promotornif": "String(50) - Tax ID (NIF)",
  "promotormorada": "String(255) - Address",
  "promotorlocalidade": "String(255) - Locality",
  "promotorcodigopostal": "String(50) - Postal Code",
  "promotortelemovel": "String(50) - Mobile Phone",
  "promotoremail": "String(255) - Email",
  "promotortitular": "String(5) - Is Promoter the Owner? (Yes/No)",
  
  // Geometry
  "st_area(shape)": "Double - Area (m²)",
  "st_length(shape)": "Double - Perimeter (m)"
}
```

#### B. Other Partner Services (Not Explored)
- `Parceiros/RGG_AIGP` - AIGP Partner Data
- `Parceiros/RGG_APA` - APA (Environment Agency) Partner Data
- `Parceiros/RGG_CCDR_Norte` - Northern Regional Coordination Commission
- `Parceiros/RGG_IFAP_MADEIRA` - IFAP Madeira
- `Parceiros/RGG_Madeira` - Madeira Partner Data
- `Parceiros/RGG_Municipios` - Municipal Partner Data

---

## Current Usage vs. Potential Enhancement

### What We're Currently Extracting ✅
From **Open Data Services**:
```typescript
{
  bupi_id: "objectid",           // e.g., "210380669"
  area_m2: "st_area(shape)",     // e.g., 9152.75
  geometry: "Polygon coordinates"
}
```

### What We COULD Extract (if Partner Access Available) 🚀

From **BUPi_v1 Partner Service**:
```typescript
{
  // Current fields (keep)
  bupi_id: "objectid",
  area_m2: "st_area(shape)",
  perimeter_m: "st_length(shape)",
  geometry: "Polygon",
  
  // Administrative context (NEW)
  municipality: "concelhodesc",        // e.g., "Lisboa"
  parish: "freguesiadesc",             // e.g., "Santa Maria Maior"
  parish_code: "dicofre",              // e.g., "110616"
  
  // Property classification (NEW)
  property_type: "naturezamatrizdesc", // "Urban" or "Rural"
  tax_reference: "numeromatriz",       // Official tax registration number
  
  // Temporal data (NEW)
  rgg_date: "dt_process",              // When RGG was created
  
  // Process tracking (NEW)
  process_id: "processoid",
  process_state: "estadoprocessodesc", // e.g., "Validated", "Pending"
  
  // Owner information (NEW - but SENSITIVE PII!)
  // Note: Probably should NOT extract to avoid privacy issues
  // unless explicitly needed and with proper data handling
}
```

---

## WFS 2.0 Service Analysis

### GetCapabilities Results

**Endpoint**: `https://geo.bupi.gov.pt/arcgis/services/opendata/RGG_DadosGovPT/MapServer/WFSServer`

**Supported Operations**:
- GetCapabilities
- DescribeFeatureType
- GetPropertyValue
- GetFeature

**Output Formats**:
- `text/xml; subtype=gml/3.2` (GML 3.2)
- `application/json` (GeoJSON via query parameter)
- `application/gml+xml; version=3.2`

**Feature Type**:
- `RGG_DadosGovPT:Dados_Abertos_-_RGG_Continente`

**Limitations**:
- Same limited fields as REST API (objectid, area, perimeter)
- More complex query syntax than REST API
- No additional fields exposed via WFS

**Recommendation**: ✅ **Stick with ArcGIS REST API** - simpler, same data, better performance

---

## Geographic Coverage

### Continental Portugal ✅
- **Service**: `opendata/RGG_DadosGovPT`
- **CRS**: EPSG:3763
- **Extent**: 
  - X: -94,120 to 162,060 meters
  - Y: -55,624 to 276,013 meters
- **Coverage**: ~2M properties (as of 2023)

### Madeira ✅
- **Service**: `opendata/RGG_DadosGovPT_Madeira`
- **CRS**: EPSG:5016 (PTRA08-UTM Zone 28N)
- **Extent**:
  - X: 288,261 to 317,424 meters
  - Y: 3,615,572 to 3,638,774 meters

### Azores ❌
- **Status**: Not found in open data services
- May be available in partner services or separate endpoint

---

## Data Quality & Limitations

### Crowd-Sourced Nature ⚠️
- **Self-declared boundaries** by property owners
- **Variable accuracy**:
  - GPS/topographic surveys (high accuracy)
  - Visual interpretation of aerial imagery (moderate accuracy)
  - User-drawn on map (lower accuracy)

### Coverage Gaps
- **Rural areas**: Better coverage (post-2017 fire prevention initiative)
- **Urban areas**: Sparse (Lisbon, Porto have official cadastre)
- **Coastal/mountain**: Limited submissions

### Data Freshness
- **Last Update**: April 24, 2025 (from dados.gov.pt)
- **Update Frequency**: Monthly
- **Temporal Coverage**: December 2017 - October 2024

---

## Recommendations for Enhancement

### 1. **Immediate (No Auth Required)** ✅

Add Madeira support:
```typescript
// In bupi_arcgis_rest.ts
const BUPI_ENDPOINTS = {
  continental: "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT/MapServer/0/query",
  madeira: "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT_Madeira/MapServer/0/query"
};

// Auto-detect region from coordinates
function selectEndpoint(lon: number, lat: number): string {
  // Madeira: ~-17.3 to -16.2 lon, 32.3 to 33.2 lat
  if (lon >= -17.5 && lon <= -16.0 && lat >= 32.0 && lat <= 33.5) {
    return BUPI_ENDPOINTS.madeira;
  }
  return BUPI_ENDPOINTS.continental;
}
```

### 2. **Short-term (Investigate Access)** 🔍

**Check if Partner API is accessible**:
```bash
# Test anonymous access
curl "https://geo.bupi.gov.pt/arcgis/rest/services/Parceiros/BUPi_v1/MapServer/0/query?where=1=1&outFields=*&f=json&resultRecordCount=1"

# If 401/403 → requires authentication
# If 200 → may be publicly accessible!
```

If accessible, extract:
- `concelhodesc` (Municipality)
- `freguesiadesc` (Parish)
- `naturezamatrizdesc` (Property Type: Urban/Rural)
- `numeromatriz` (Tax Reference Number) 
- `dt_process` (RGG Creation Date)

**Do NOT extract PII fields** (promotor* fields) to avoid privacy issues.

### 3. **Long-term (API Key / Partnership)** 🤝

**Status**: ⚠️ **CONFIRMED - Partner services require authentication**

Test result:
```json
{
  "error": {
    "code": 400,
    "message": "Chave de autenticação inválida. Não foram retornados dados.",
    "details": ["Utilizador nao autorizado"]
  }
}
```
Translation: "Invalid authentication key. No data returned. Unauthorized user."

**To gain access**, contact eBUPi to request:
- Official API access for enrichment purposes
- Authentication credentials for partner services
- Higher rate limits (currently 2,000 records/query on open data)
- Access to partner endpoints with full metadata (21+ fields)
- Clarification on data usage terms for commercial enrichment
- Confirmation on PII handling requirements

**Contact Information**: 
- **Website**: https://bupi.gov.pt
- **Organization**: eBUPi - Estrutura de Missão para a Expansão do Sistema de Informação Cadastral Simplificado
- **Portal**: https://ebupi.justica.gov.pt/
- **Email**: Check official website for current contact
- **Phone**: Check official website for support line

**Value Proposition for Access Request**:
- Enriching ~2M Portuguese property records with cadastral data
- Improving data quality for real estate, planning, and analysis
- Contributing to better territorial knowledge (aligned with BUPi mission)
- Providing feedback on data quality and coverage gaps

---

## Comparison: Open Data vs. Partner Service

| Feature | Open Data | Partner (BUPi_v1) |
|---------|-----------|-------------------|
| **Access** | ✅ Public | 🔒 **Requires Auth (Confirmed)** |
| **Fields** | 4 (ID, geometry, area, perimeter) | 21+ fields |
| **Municipality** | ❌ No | ✅ Yes |
| **Parish** | ❌ No | ✅ Yes |
| **Property Type** | ❌ No | ✅ Yes (Urban/Rural) |
| **Tax Reference** | ❌ No | ✅ Yes |
| **RGG Date** | ❌ No | ✅ Yes |
| **Owner Info** | ❌ No | ⚠️ Yes (PII - handle carefully) |
| **Process State** | ❌ No | ✅ Yes |

---

## Summary

### Currently Available (Open Data) ✅
- **Basic geometry** (polygons)
- **Area and perimeter** calculations
- **Continental + Madeira** coverage
- **~2M properties** total

### Potentially Available (Partner Services) 🔍
- **Administrative context** (municipality, parish)
- **Property classification** (urban/rural)
- **Tax references** (numeromatriz)
- **Temporal data** (RGG creation dates)
- **Process tracking** (validation status)

### Not Recommended to Extract ⚠️
- **Owner PII** (names, NIF, addresses, phone, email)
- Requires explicit consent and data protection measures
- May violate GDPR if used without proper legal basis

### Next Steps
1. ✅ Add Madeira endpoint support (easy win)
2. 🔍 Test partner service accessibility
3. 📧 Contact eBUPi if partner data would significantly improve enrichment
4. 📊 Monitor open data service for field additions (check quarterly)
