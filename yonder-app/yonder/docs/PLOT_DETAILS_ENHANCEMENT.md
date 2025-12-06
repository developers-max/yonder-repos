# Plot Details Tool Enhancement

## Overview

The `getPlotDetails` tool has been enhanced to retrieve and return comprehensive **zoning and cadastral information** alongside the existing plot data.

## What Changed

### New Data Retrieved

#### 1. **Zoning Information**
```typescript
zoning: {
  label: string | null;           // Zoning classification label
  labelEn: string | null;         // English label
  typename: string | null;        // Type name
  source: string | null;          // Data source
  hasData: boolean;              // Whether zoning data exists
}
```

**Example:**
```json
{
  "label": "Residencial R1",
  "labelEn": "Residential R1",
  "typename": "Urban Residential",
  "source": "Municipal GIS",
  "hasData": true
}
```

#### 2. **Cadastral Information**
```typescript
cadastral: {
  reference: string | null;       // Cadastral reference number
  address: string | null;         // Full address
  municipality: string | null;    // Municipality name
  province: string | null;        // Province
  postalCode: string | null;      // Postal code
  distanceMeters: number | null;  // Distance from plot center to cadastral point
  parcel: {
    reference: string | null;     // Parcel cadastral reference
    area: number | null;          // Parcel area in m²
    label: string | null;         // Parcel label/identifier
  } | null;
  parcelCount: number | null;     // Number of parcels
  buildingCount: number | null;   // Number of buildings
  mapViewerUrl: string | null;    // Link to cadastral map viewer
  hasData: boolean;              // Whether cadastral data exists
}
```

**Example:**
```json
{
  "reference": "08003A00100001",
  "address": "Carrer de la Font, 23",
  "municipality": "Alella",
  "province": "Barcelona",
  "postalCode": "08328",
  "distanceMeters": 15,
  "parcel": {
    "reference": "08003A00100001",
    "area": 1250,
    "label": "Parcel 001"
  },
  "parcelCount": 1,
  "buildingCount": 0,
  "mapViewerUrl": "https://ovc.catastro.meh.es/...",
  "hasData": true
}
```

### Enhanced Assistant Message

The tool now provides more context-aware messages:

**Before:**
```
Retrieved details for plot abc123: €150,000, 1,250m² at coordinates 41.4952, 2.2931.
```

**After (with zoning and cadastral):**
```
Retrieved details for plot abc123: €150,000, 1,250m² at coordinates 41.4952, 2.2931.
Cadastral reference: 08003A00100001, Alella. Zoning: Residencial R1
You can analyze pricing, discuss location/amenities, zoning regulations, cadastral details, or guide through next steps.
```

### Enhanced Suggestions

Suggestions are now context-aware and specific:

**Before:**
```json
[
  { "id": "analyze_pricing", "action": "Analyze pricing details" },
  { "id": "zoning_info", "action": "Get zoning information" },
  { "id": "cadastral_info", "action": "Get cadastral information" }
]
```

**After (with data available):**
```json
[
  { "id": "analyze_pricing", "action": "Analyze pricing and value proposition" },
  { "id": "discuss_zoning", "action": "Explain zoning classification: Residencial R1" },
  { "id": "review_cadastral", "action": "Review cadastral data: Ref 08003A00100001" },
  { "id": "discuss_location", "action": "Discuss location and accessibility" },
  { "id": "review_amenities", "action": "Review nearby amenities and distances" },
  { "id": "ask_municipal_planning", "action": "Query planning regulations for Alella" },
  { "id": "generate_report", "action": "Generate comprehensive property report" },
  { "id": "select_plot", "action": "Add to project for tracking" }
]
```

### Updated Tool Description

**Before:**
```
Get detailed information about a specific plot by ID.
Use when users mention a plot ID or when you see plot context metadata.
```

**After:**
```
Get comprehensive information about a specific plot including price, location, 
zoning classification, and cadastral data. Use when users mention a plot ID, 
ask for plot details, zoning information, or cadastral reference.
```

## Usage Examples

### Example 1: User Asks About Zoning

```
User: "What's the zoning for this plot?"
