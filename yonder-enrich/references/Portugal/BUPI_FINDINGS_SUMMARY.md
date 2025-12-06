# BUPi Services - Quick Findings Summary

## What I Found 🔍

### Available Services & Layers

#### ✅ **Publicly Accessible** (What we can use NOW)

1. **Continental Portugal RGG**
   - URL: `https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT/MapServer/0`
   - **Already integrated** ✓
   
2. **Madeira RGG** (NEW! 🎉)
   - URL: `https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT_Madeira/MapServer/0`
   - **Not yet integrated** - Quick win!

#### 🔒 **Requires Authentication** (Rich data, but locked)

**Partner Service (BUPi_v1)**:
- URL: `https://geo.bupi.gov.pt/arcgis/rest/services/Parceiros/BUPi_v1/MapServer/0`
- Error: `"Chave de autenticação inválida. Utilizador nao autorizado"`
- **21+ fields** vs our current **4 fields**

---

## Field Comparison

### Current Open Data (What We Extract)
```typescript
{
  objectid: 210380669,           // ✅
  st_area_shape: 9152.75,        // ✅
  st_length_shape: 368.67,       // ✅
  geometry: { ... }              // ✅
}
// Total: 4 fields
```

### Partner Service (Requires Auth)
```typescript
{
  // Everything above, PLUS:
  
  // Administrative 🏛️
  concelhodesc: "Lisboa",
  freguesiadesc: "Santa Maria Maior",
  dicofre: "110616",
  
  // Property 🏠
  naturezamatrizdesc: "Urban",
  numeromatriz: "123-456",
  
  // Temporal ⏰
  dt_process: "2023-05-15",
  
  // Process 📋
  processoid: 987654,
  estadoprocessodesc: "Validated",
  
  // Owner (PII) ⚠️
  promotornome: "João Silva",
  promotornif: "123456789",
  // ... and 7 more PII fields
}
// Total: 21+ fields
```

---

## What Additional Data Could Enhance Enrichment?

### High Value (If Accessible) ⭐⭐⭐

1. **Municipality (`concelhodesc`)**
   - **Use**: Administrative context, market segmentation
   - **Example**: "Lisboa", "Porto", "Faro"

2. **Parish (`freguesiadesc` + `dicofre`)**
   - **Use**: Fine-grained location, local planning zones
   - **Example**: "Santa Maria Maior" (DICOFRE: 110616)

3. **Property Type (`naturezamatrizdesc`)**
   - **Use**: Urban vs Rural classification
   - **Example**: "Urban", "Rural"

4. **RGG Creation Date (`dt_process`)**
   - **Use**: Data freshness indicator, temporal analysis
   - **Example**: "2023-05-15T00:00:00Z"

### Medium Value ⭐⭐

5. **Tax Reference (`numeromatriz`)**
   - **Use**: Link to official tax records
   - **Example**: "123-456" (can be multiple)

6. **Process State (`estadoprocessodesc`)**
   - **Use**: Data quality indicator
   - **Example**: "Validated", "Pending Review"

### Low Value / Not Recommended ⭐

7. **Owner Information (`promotor*` fields)**
   - ⚠️ **PII (Personal Identifiable Information)**
   - Includes: Name, NIF, Address, Phone, Email
   - **Recommendation**: DO NOT extract without explicit consent & legal basis
   - **GDPR Risk**: High

---

## Immediate Action Items

### 1. ✅ **Add Madeira Support** (Easy - 30 min)

Update `bupi_arcgis_rest.ts`:

```typescript
const BUPI_ENDPOINTS = {
  continental: "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT/MapServer/0/query",
  madeira: "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT_Madeira/MapServer/0/query"
};

function selectEndpoint(lon: number, lat: number): string {
  // Madeira: approximately -17.3 to -16.2 lon, 32.3 to 33.2 lat
  if (lon >= -17.5 && lon <= -16.0 && lat >= 32.0 && lat <= 33.5) {
    return BUPI_ENDPOINTS.madeira;
  }
  return BUPI_ENDPOINTS.continental;
}
```

**Benefit**: Extend coverage to Madeira islands (~100k additional properties)

### 2. 📧 **Contact eBUPi for Partner Access** (Medium effort)

**Why**:
- 21+ fields vs current 4 fields
- Municipality, Parish, Property Type would significantly enhance data
- No competitive alternative for this data

**How**:
- Email: Check https://bupi.gov.pt or https://ebupi.justica.gov.pt/
- Request: API credentials for enrichment purposes
- Mention: ~2M property enrichment, aligned with BUPi's mission

**Expected Timeline**: 2-4 weeks response time (government agency)

### 3. 📊 **Alternative: Cross-reference with DGT Cadastre** (Already doing!)

DGT provides similar administrative data:
- Municipality code (`municipality_code`)
- Administrative unit (`administrative_unit`)

**Current Coverage**:
- DGT: 18% (urban areas, official cadastre)
- BUPi: 64% (rural areas, crowd-sourced)
- **Combined**: 82% coverage ✅

---

## Other Discovered Services (Not Explored)

Under `Parceiros/` folder:
- `RGG_AIGP` - AIGP (Instituto dos Registos e do Notariado) partner data
- `RGG_APA` - APA (Environment Agency) partner data
- `RGG_CCDR_Norte` - Northern Regional Commission data
- `RGG_IFAP_MADEIRA` - IFAP Madeira agricultural data
- `RGG_Municipios` - Municipal partner data

**Status**: All likely require authentication
**Value**: Unknown - would need to explore field schemas

---

## Online Sources Found

1. **Official Data Portal**
   - https://dados.gov.pt/pt/datasets/representacao-grafica-georreferenciada/
   - Confirms: 2M properties, CC-BY 4.0 license, monthly updates

2. **BUPi Public Viewer**
   - https://experience.arcgis.com/experience/4f7ae3949aae46d59d119e4b3094f21f
   - Interactive map viewer (not API)

3. **ArcGIS Server Documentation**
   - Confirmed query syntax and parameter formats
   - https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/

4. **News & Documentation**
   - BUPi Gov.pt announcements
   - ESRI Portugal case studies
   - GovTech Justice portal

---

## Bottom Line

### What We Can Do NOW ✅
- Extract: ID, area, perimeter, geometry
- Coverage: Continental Portugal (working!) + Madeira (easy to add)
- Data: 2M properties, crowd-sourced, CC-BY 4.0 license

### What We COULD Do (with Auth) 🔐
- Extract: +17 additional fields
- Add: Municipality, Parish, Property Type, RGG Date
- Quality: Better administrative context for enrichment

### What We SHOULD NOT Do ⛔
- Extract owner PII without legal basis
- Scrape restricted endpoints
- Exceed rate limits (2,000 records/query)

### Recommendation 🎯
1. **Immediate**: Add Madeira support (quick win)
2. **Short-term**: Contact eBUPi for partner API access
3. **Long-term**: Monitor for new open data fields (check quarterly)

---

## Files Created

1. **`BUPI_AVAILABLE_DATA.md`** - Complete technical documentation
2. **`BUPI_FIX_SUMMARY.md`** - Bug fix documentation (geometry parameter)
3. **`BUPI_FINDINGS_SUMMARY.md`** - This file (executive summary)

All located in: `/src/enrichments/portugal-cadastre/`
