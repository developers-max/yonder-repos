# Spain vs Portugal - JSON Structure Examples

## 🇪🇸 Spain Cadastre JSON Structure

```json
{
  "cadastral": {
    "cadastral_reference": "9872023VH5797S0001WX",
    "address": "CL GRAN VIA 59",
    "postal_code": "28013",
    "municipality": "Madrid",
    "province": "Madrid",
    "distance_meters": 0,
    
    "parcel": {
      "cadastral_reference": "9872023VH5797S0001WX",
      "area_value": 152.75,
      "label": "CL GRAN VIA 59",
      "zoning": "Urbano",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      }
    },
    
    "parcels": [
      {
        "cadastral_reference": "9872023VH5797S0001WX",
        "area_value": 152.75,
        "label": "CL GRAN VIA 59",
        "beginning_lifespan": "2010-05-15",
        "valid_from": "2010-05-15",
        "valid_to": null,
        "reference_point": [-3.7058, 40.4168],
        "zoning": "Urbano",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[...]]]
        }
      },
      {
        "cadastral_reference": "9872023VH5797S0002WY",
        "area_value": 89.23,
        "label": "CL GRAN VIA 61",
        "beginning_lifespan": "2010-05-15",
        "valid_from": "2010-05-15",
        "valid_to": null,
        "reference_point": [-3.7057, 40.4169],
        "zoning": "Urbano",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[...]]]
        }
      }
    ],
    "parcel_count": 2,
    
    "building": {
      "nationalCadastralReference": "9872023VH5797S0001WX",
      "areaValue": 456.50,
      "label": "CL GRAN VIA 59",
      "constructionYear": 1975,
      "numberOfFloors": 8,
      "numberOfDwellings": 16,
      "buildingType": "Residencial",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...]]]
      }
    },
    
    "buildings": [
      {
        "nationalCadastralReference": "9872023VH5797S0001WX",
        "areaValue": 456.50,
        "label": "CL GRAN VIA 59",
        "constructionYear": 1975,
        "numberOfFloors": 8,
        "numberOfDwellings": 16,
        "buildingType": "Residencial",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[...]]]
        }
      }
    ],
    "building_count": 1,
    
    "addresses": [
      {
        "thoroughfareName": "GRAN VIA",
        "thoroughfareType": "CL",
        "postCode": "28013",
        "postName": "Madrid",
        "adminUnit": "Madrid",
        "locators": [
          {
            "designator": "59",
            "type": "NUMBER",
            "level": "0"
          }
        ]
      }
    ],
    "address_count": 1,
    
    "map_images": {
      "wms_url": "http://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=CP.CadastralParcel,BU.Building&STYLES=&WIDTH=1024&HEIGHT=768&CRS=EPSG:4326&BBOX=-3.708,40.415,-3.703,40.418",
      "viewer_url": "http://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccoordenadas.aspx?centro=-3.7058,40.4168",
      "embeddable_html": "<iframe src='http://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccoordenadas.aspx?centro=-3.7058,40.4168' width='800' height='600'></iframe>",
      "description": "WMS map images showing cadastral parcels and buildings. Use interactive_map_html for full Leaflet map, or wms_url for simple image."
    },
    
    "cadastral_coordinates": {
      "x": -3.7058,
      "y": 40.4168,
      "srs": "EPSG:4326"
    },
    
    "source": "Spanish Cadastre WFS (Parcels)",
    "service_urls": [
      "http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx",
      "http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx",
      "http://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx"
    ],
    "srs": "EPSG:4326",
    "notes": null
  }
}
```

---

## 🇵🇹 Portugal Cadastre JSON Structure

### Scenario 1: Both DGT and BUPi Data Available (Urban Area)

```json
{
  "cadastral": {
    "cadastral_reference": "AAA001140232",
    "inspire_id": "PT.IGP.CP.11-10-AAA001140232",
    "label": "AAA 001 140 232",
    
    "parcel_area_m2": 23571,
    "registration_date": "2010-05-15",
    "administrative_unit": "1506",
    "municipality_code": "1506",
    
    "geometry": {
      "type": "MultiPolygon",
      "coordinates": [[[...]]]
    },
    "centroid": [-9.1393, 38.7223],
    
    "bupi_geometry": {
      "type": "Polygon",
      "coordinates": [[[...]]]
    },
    "bupi_area_m2": 23450,
    "bupi_id": "210380669",
    "bupi_source": "BUPi - ArcGIS REST (RGG Continental)",
    
    "distance_meters": 0,
    "contains_point": true,
    
    "cadastral_coordinates": {
      "longitude": -9.1393,
      "latitude": 38.7223,
      "srs": "EPSG:4326"
    },
    
    "source": "Portugal Cadastre - DGT",
    "service_url": "https://ogcapi.dgterritorio.gov.pt/collections/cadastro/items/12345",
    "srs": "EPSG:4326",
    "notes": null
  }
}
```

### Scenario 2: Only BUPi Data Available (Rural Area)

```json
{
  "cadastral": {
    "cadastral_reference": "210380669",
    "label": "BUPi-210380669",
    
    "parcel_area_m2": 9152.75,
    "registration_date": null,
    "administrative_unit": null,
    "municipality_code": null,
    
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[...]]]
    },
    "centroid": [-7.821, 39.691],
    
    "bupi_geometry": null,
    "bupi_area_m2": null,
    "bupi_id": null,
    "bupi_source": null,
    
    "distance_meters": 0,
    "contains_point": true,
    
    "cadastral_coordinates": {
      "longitude": -7.821,
      "latitude": 39.691,
      "srs": "EPSG:4326"
    },
    
    "source": "BUPi - ArcGIS REST (RGG Continental)",
    "service_url": "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT/MapServer/0/query",
    "srs": "EPSG:4326",
    "notes": "Point is inside property"
  }
}
```

### Scenario 3: Madeira Region

```json
{
  "cadastral": {
    "cadastral_reference": "456789012",
    "label": "BUPi-456789012",
    
    "parcel_area_m2": 1250.50,
    "registration_date": null,
    "administrative_unit": null,
    "municipality_code": null,
    
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[...]]]
    },
    "centroid": [-16.92, 32.65],
    
    "bupi_geometry": null,
    "bupi_area_m2": null,
    "bupi_id": null,
    "bupi_source": null,
    
    "distance_meters": 45,
    "contains_point": false,
    
    "cadastral_coordinates": {
      "longitude": -16.92,
      "latitude": 32.65,
      "srs": "EPSG:4326"
    },
    
    "source": "BUPi - ArcGIS REST (RGG Madeira)",
    "service_url": "https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT_Madeira/MapServer/0/query",
    "srs": "EPSG:4326",
    "notes": "Closest property within ~100m; ~45m from point"
  }
}
```

---

## 🔍 Key Structural Differences

### **Spain: Multi-Entity Rich Structure**
```typescript
interface SpanishCadastral {
  // Core identification
  cadastral_reference: string;
  address: string;
  postal_code: string;
  municipality: string;
  province: string;
  
  // Multiple entities at same location
  parcel: object;              // Primary parcel
  parcels: object[];           // ALL parcels
  parcel_count: number;
  
  building: object;            // Primary building
  buildings: object[];         // ALL buildings
  building_count: number;
  
  addresses: object[];         // ALL addresses
  address_count: number;
  
  // Visualization
  map_images: {
    wms_url: string;
    viewer_url: string;
    embeddable_html: string;
    description: string;
  };
  
  // Metadata
  service_urls: string[];      // Multiple service URLs
  source: string;
}
```

### **Portugal: Dual-Source Focused Structure**
```typescript
interface PortugueseCadastral {
  // Core identification
  cadastral_reference: string;
  inspire_id: string;          // INSPIRE identifier
  label: string;
  
  // Administrative context
  administrative_unit: string; // Municipality code
  municipality_code: string;
  registration_date: string;
  
  // Dual-source geometry
  geometry: object;            // Primary (DGT or BUPi)
  bupi_geometry: object;       // Supplementary BUPi
  bupi_area_m2: number;        // BUPi area for comparison
  bupi_id: string;             // BUPi reference
  bupi_source: string;         // Which BUPi endpoint used
  
  // Accuracy metrics
  contains_point: boolean;     // Point-in-polygon test
  distance_meters: number;     // Distance to nearest property
  
  // Metadata
  service_url: string;         // Single service URL
  source: string;              // Indicates primary source
}
```

---

## 📊 Data Volume Comparison

| Metric | Spain | Portugal |
|--------|-------|----------|
| **Average JSON size** | ~8-12 KB | ~2-4 KB |
| **Field count** | 25+ fields | 15 fields |
| **Array fields** | 4 (parcels, buildings, addresses, service_urls) | 0 |
| **Geometry objects** | 1 per entity type | 1-2 total |
| **Visualization data** | WMS URLs + HTML | None |

---

## 🎯 Usage Examples

### **Spain: Urban Property Analysis**
```javascript
// Get all buildings on a property
const buildingCount = plot.cadastral.building_count;
const totalFloors = plot.cadastral.buildings.reduce((sum, b) => sum + (b.numberOfFloors || 0), 0);

// Get complete address
const address = `${plot.cadastral.address}, ${plot.cadastral.postal_code} ${plot.cadastral.municipality}`;

// Generate map visualization
const mapUrl = plot.cadastral.map_images.wms_url;
```

### **Portugal: Rural Property Validation**
```javascript
// Cross-validate area measurements
const dgtArea = plot.cadastral.parcel_area_m2;
const bupiArea = plot.cadastral.bupi_area_m2;
const discrepancy = Math.abs(dgtArea - bupiArea) / dgtArea * 100;

// Check accuracy
const isAccurate = plot.cadastral.contains_point && plot.cadastral.distance_meters === 0;

// Identify data source
const hasOfficialData = plot.cadastral.source.includes('DGT');
const hasCrowdData = plot.cadastral.bupi_id !== null;
```

---

## 📝 Summary

The JSON structures reflect each country's **data ecosystem and use cases**:

- **Spain**: Comprehensive multi-entity data for urban analysis and visualization
- **Portugal**: Streamlined dual-source data for coverage maximization and validation

Both are **optimally designed** for their respective cadastral systems and enrichment requirements.
