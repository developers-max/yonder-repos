# Spain vs Portugal Cadastre Data Structure Comparison

## Overview

This document compares the cadastral data structures stored for Spain and Portugal, highlighting key differences in data sources, field mappings, and coverage.

---

## 📊 Data Source Architecture

### Spain - **Multi-Service WFS Architecture**
- **Primary**: Dirección General del Catastro WFS services
- **Services**: 3 separate WFS endpoints
  - `wfsCP.aspx` - Cadastral parcels
  - `wfsBU.aspx` - Buildings  
  - `wfsAD.aspx` - Addresses
- **Additional**: WMS service for map visualization
- **Coverage**: Nationwide (Spain mainland + islands)

### Portugal - **Dual-Source Hybrid Architecture**
- **Primary**: DGT OGC API Features (official cadastre)
- **Fallback**: BUPi ArcGIS REST (crowd-sourced RGG)
- **Strategy**: Parallel calls, DGT as primary, BUPi as supplementary
- **Coverage**: Partial (DGT 18% urban, BUPi 64% rural)

---

## 🔍 Field-by-Field Comparison

### Common Fields (Both Countries)
| Field | Spain | Portugal | Notes |
|-------|--------|----------|-------|
| `cadastral_reference` | ✅ `nationalCadastralReference` | ✅ `nationalcadastralreference` | Both use INSPIRE format |
| `distance_meters` | ✅ | ✅ | Distance from query point |
| `coordinates` | ✅ `{x, y, srs}` | ✅ `{longitude, latitude, srs}` | Different coordinate formats |
| `source` | ✅ | ✅ | Service source tracking |
| `service_url(s)` | ✅ Array | ✅ Single | Spain tracks multiple URLs |
| `srs` | ✅ `EPSG:4326` | ✅ `EPSG:4326` | Both use WGS84 |

---

### 🏠 **Spain-Exclusive Fields**

#### Administrative Context
```typescript
{
  address: string,           // Street address from parcel label
  postal_code: string,       // Not available in WFS (would need separate API)
  municipality: string,      // Municipality name
  province: string,          // Province/state
}
```

#### Multi-Parcel Support
```typescript
{
  parcel: object,            // Primary parcel (legacy)
  parcels: Array<object>,    // ALL parcels at location
  parcel_count: number,      // Total parcels found
  
  // Each parcel contains:
  // - cadastral_reference
  // - area_value
  // - label
  // - beginning_lifespan
  // - valid_from/valid_to
  // - reference_point
  // - zoning
  // - geometry
}
```

#### Building Information
```typescript
{
  building: object,          // Primary building (legacy)
  buildings: Array<object>,  // ALL buildings at location
  building_count: number,    // Total buildings found
  
  // Each building contains:
  // - nationalCadastralReference
  // - areaValue (built area)
  // - label
  // - constructionYear
  // - numberOfFloors
  // - numberOfDwellings
  // - buildingType
  // - geometry
}
```

#### Address Information
```typescript
{
  addresses: Array<object>,  // ALL addresses at location
  address_count: number,     // Total addresses found
  
  // Each address contains:
  // - thoroughfareName (street)
  // - thoroughfareType (street type)
  // - postCode (postal code)
  // - postName (locality)
  // - adminUnit (municipality)
  // - locators (house numbers)
}
```

#### Map Visualization
```typescript
{
  map_images: {
    wms_url: string,         // WMS map image URL
    viewer_url: string,      // Interactive map viewer
    embeddable_html: string, // Embeddable iframe HTML
    // interactive_map_html: string, // Full Leaflet map (large)
    description: string      // Usage instructions
  }
}
```

---

### 🏛️ **Portugal-Exclusive Fields**

#### Official Identifiers
```typescript
{
  inspire_id: string,        // INSPIRE unique identifier
  label: string,             // Human-readable label
}
```

#### Administrative Context
```typescript
{
  administrative_unit: string,  // Municipality code (DICOFRE)
  municipality_code: string,    // Same as administrative_unit
}
```

#### Temporal Data
```typescript
{
  registration_date: string,    // When parcel was registered
}
```

#### Dual-Source Geometry
```typescript
{
  // Primary geometry (DGT or BUPi)
  geometry: object,             // Official or crowd-sourced geometry
  centroid: [lon, lat],         // Calculated centroid
  
  // BUPi supplementary geometry (when DGT is primary)
  bupi_geometry: object,        // BUPi geometry for validation
  bupi_area_m2: number,         // BUPi area measurement
  bupi_id: string,              // BUPi object ID
  bupi_source: string,          // BUPi service endpoint used
}
```

#### Accuracy Indicators
```typescript
{
  contains_point: boolean,      // Does polygon contain query point?
}
```

---

## 📈 Data Richness Comparison

### **Spain: Rich & Comprehensive**
- ✅ **Multi-entity**: Parcels + Buildings + Addresses
- ✅ **Multi-parcel**: ALL parcels at location
- ✅ **Temporal**: Lifespan versions, validity periods
- ✅ **Visualization**: WMS maps, interactive HTML
- ✅ **Administrative**: Full hierarchy (province > municipality > address)
- ✅ **Building details**: Floors, dwellings, construction year

### **Portugal: Focused & Dual-Source**
- ✅ **Dual validation**: Official + crowd-sourced geometry
- ✅ **Accuracy metrics**: Point containment, distance
- ✅ **INSPIRE compliance**: Standard identifiers
- ⚠️ **Single-entity**: Parcels only (no buildings/addresses)
- ⚠️ **Single-parcel**: Primary parcel only
- ⚠️ **Limited admin**: Municipality codes only

---

## 🎯 Use Case Analysis

### **Spain Structure is Better For:**
- 🏢 **Urban development**: Building footprints, heights, dwellings
- 📍 **Address geocoding**: Street addresses, postal codes
- 📊 **Multi-parcel analysis**: All parcels within buffer
- 🗺️ **Visualization**: Interactive maps, WMS overlays
- 📋 **Temporal analysis**: Historical changes, validity periods

### **Portugal Structure is Better For:**
- ✅ **Data validation**: Cross-reference official vs crowd-sourced
- 🎯 **Accuracy assessment**: Point containment, distance metrics
- 🏛️ **INSPIRE integration**: Standardized identifiers
- 🌍 **Coverage gaps**: Rural areas where official cadastre missing

---

## 🔧 Technical Implementation Differences

### **Spain: Sequential Multi-Service**
```typescript
// Calls 4 services in sequence
const parcelData = await getParcelDataFromWFS(lon, lat);
const buildingData = await getBuildingDataFromWFS(lon, lat);
const addressData = await getAddressDataFromWFS(lon, lat);
const mapImages = generateCadastralMapImageURL(lon, lat);

// Merges all data sources
return { parcel: parcelData, buildings: buildingData, addresses: addressData, map_images: mapImages };
```

### **Portugal: Parallel Dual-Source**
```typescript
// Calls 2 services in parallel
const [dgtInfo, bupiInfo] = await Promise.all([
  getPortugalCadastralInfo(lon, lat),
  getBUPiPropertyInfoArcGIS(lon, lat)
]);

// DGT as primary, BUPi as supplementary
if (dgtInfo) {
  return { ...dgtInfo, bupi_geometry: bupiInfo?.geometry };
} else {
  return bupiInfo; // Fallback
}
```

---

## 📊 Data Quality & Coverage

### **Spain**
- **Source**: Official government cadastre
- **Coverage**: 100% nationwide
- **Accuracy**: High (official surveys)
- **Update frequency**: Regular (government maintained)
- **Reliability**: Very high

### **Portugal**
- **Source**: Mixed (official + crowd-sourced)
- **Coverage**: ~82% combined (18% DGT + 64% BUPi)
- **Accuracy**: Variable (DGT high, BUPi moderate)
- **Update frequency**: DGT regular, BUPI monthly
- **Reliability**: Good with validation

---

## 🚀 Recommendations for Harmonization

### **Short-term: Keep Separate**
- Each country's structure optimized for their data sources
- Different use cases and requirements
- Technical complexity of harmonization outweighs benefits

### **Long-term: Consider Common Interface**
```typescript
interface IberianCadastralInfo {
  // Common fields
  cadastral_reference: string;
  coordinates: { longitude: number; latitude: number; srs: string };
  geometry: object;
  area_m2: number;
  source: string;
  
  // Country-specific extensions
  spain?: SpanishCadastralExtensions;
  portugal?: PortugueseCadastralExtensions;
}
```

### **Potential Cross-Country Features**
- 🌍 **Iberian Peninsula coverage**: Combined Spain + Portugal
- 📊 **Cross-border analysis**: Properties near borders
- 🏛️ **INSPIRE harmonization**: Standardized European identifiers
- 🗺️ **Unified visualization**: Cross-country cadastral maps

---

## 📝 Summary

| Aspect | Spain | Portugal |
|--------|-------|----------|
| **Data Sources** | 4 WFS services | 2 parallel services |
| **Entity Types** | Parcels + Buildings + Addresses | Parcels only |
| **Coverage** | 100% nationwide | 82% combined |
| **Data Richness** | Very high | Moderate |
| **Visualization** | WMS + Interactive maps | Geometry only |
| **Validation** | Single source | Dual-source validation |
| **Administrative** | Full hierarchy | Municipality codes only |
| **Temporal** | Lifespan versions | Registration dates |
| **Best For** | Urban analysis, addresses | Rural coverage, validation |

Both structures are **well-designed for their respective data ecosystems** and serve different but complementary use cases in the Iberian Peninsula.
