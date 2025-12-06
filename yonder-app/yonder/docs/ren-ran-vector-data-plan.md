# REN/RAN National Vector Data - Implementation Plan

## Current Situation

### Data Availability
REN (Reserva Ecológica Nacional) and RAN (Reserva Agrícola Nacional) data in Portugal is **decentralized**:

- **No national download available** - DGTERRITÓRIO/SNIT provides WMS viewing services but no bulk vector download
- **Data is managed at municipal level** - Each of the 308 municipalities maintains their own REN/RAN data as part of their PDM (Plano Diretor Municipal)
- **CCDR regional oversight** - 5 CCDRs (Norte, Centro, Lisboa e Vale do Tejo, Alentejo, Algarve) coordinate but don't centralize data

### Data Sources Analysis

| Source | Coverage | Format | Reliability | Access |
|--------|----------|--------|-------------|--------|
| SNIT WMS | National | Raster tiles | ❌ Unreliable | View only |
| Municipal ArcGIS | ~50 municipalities | Vector/Raster | ✅ Good | API export |
| dados.gov.pt | ~5 municipalities | Shapefile | ✅ Good | Download |
| CCDR portals | Regional | Mixed | ⚠️ Variable | Request |

## Option 3: Pre-cache National Vector Data

### Strategy: Aggregate from Municipal Sources

Since there's no national vector dataset, we need to build one by:

1. **Automated scraping** of municipal ArcGIS REST services
2. **Manual requests** to CCDRs for regional datasets
3. **dados.gov.pt downloads** for municipalities that publish open data

### Database Schema for Vector Data

```sql
-- REN/RAN polygon storage
CREATE TABLE ren_ran_polygons (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER REFERENCES portugal_municipalities(id),
  layer_type VARCHAR(10) NOT NULL CHECK (layer_type IN ('ren', 'ran')),
  category VARCHAR(255),           -- REN/RAN subcategory (e.g., "Leitos de cursos de água")
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
  area_m2 DOUBLE PRECISION GENERATED ALWAYS AS (ST_Area(geom::geography)) STORED,
  source_url VARCHAR(500),
  source_layer_id INTEGER,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  
  CONSTRAINT valid_geometry CHECK (ST_IsValid(geom))
);

-- Spatial index for fast intersection queries
CREATE INDEX idx_ren_ran_geom ON ren_ran_polygons USING GIST (geom);
CREATE INDEX idx_ren_ran_municipality ON ren_ran_polygons (municipality_id);
CREATE INDEX idx_ren_ran_type ON ren_ran_polygons (layer_type);

-- Simplified version for faster tile rendering
CREATE TABLE ren_ran_simplified (
  id SERIAL PRIMARY KEY,
  polygon_id INTEGER REFERENCES ren_ran_polygons(id),
  zoom_level INTEGER NOT NULL,
  geom_simplified GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX idx_ren_ran_simplified_geom ON ren_ran_simplified USING GIST (geom_simplified);
CREATE INDEX idx_ren_ran_simplified_zoom ON ren_ran_simplified (zoom_level);
```

### Data Ingestion Pipeline

```typescript
// scripts/ingest-ren-ran-vectors.ts

interface RenRanFeature {
  type: 'Feature';
  geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon;
  properties: {
    category?: string;
    area?: number;
    [key: string]: unknown;
  };
}

async function fetchMunicipalVectors(
  municipalityId: number,
  layerType: 'ren' | 'ran',
  serviceUrl: string,
  layerId: string
): Promise<RenRanFeature[]> {
  // Use ArcGIS REST API query endpoint to get actual vectors
  // /query?where=1=1&outFields=*&f=geojson&outSR=4326
  const queryUrl = `${serviceUrl.replace('/export', '')}/query`;
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    f: 'geojson',
    outSR: '4326',
  });
  
  const response = await fetch(`${queryUrl}?${params}`);
  const data = await response.json();
  return data.features;
}
```

### Estimated Coverage

Based on discovery scan:
- **~20-30 municipalities** have accessible ArcGIS REST services with query capability
- **~50 municipalities** have WMS/tile services (view only)
- **~228+ municipalities** have no public GIS services

### Implementation Phases

#### Phase 3A: Vector Extraction (2-3 days)
1. Enhance discovery script to test query endpoints
2. Build ingestion pipeline for GeoJSON/Shapefile
3. Create database tables and indexes

#### Phase 3B: Data Population (1-2 weeks)
1. Automated extraction from verified ArcGIS services
2. Manual download from dados.gov.pt
3. CCDR data requests for remaining regions

#### Phase 3C: Tile Generation (2-3 days)
1. Generate vector tiles (MVT format) for Mapbox
2. Set up tile caching with proper invalidation
3. Implement zoom-level simplification

### API Endpoints

```typescript
// Serve pre-cached vector tiles
GET /api/ren-ran-tiles/{z}/{x}/{y}.mvt

// Query REN/RAN at a point
GET /api/ren-ran/check?lat={lat}&lng={lng}
Response: {
  ren: { exists: boolean, categories: string[], area_pct: number },
  ran: { exists: boolean, categories: string[], area_pct: number }
}

// Get REN/RAN polygons for a bounding box
GET /api/ren-ran/bbox?north=&south=&east=&west=&type=ren|ran
Response: GeoJSON FeatureCollection
```

### Storage Requirements

| Data | Estimated Size | Notes |
|------|----------------|-------|
| Raw polygons | ~2-5 GB | All municipalities, full resolution |
| Simplified (z14) | ~500 MB | For rendering |
| Simplified (z10) | ~100 MB | For overview |
| Vector tiles (MVT) | ~200 MB | Pre-generated |

### Benefits of Vector Storage

1. **Offline availability** - No dependency on municipal servers
2. **Fast queries** - Check if a plot intersects REN/RAN in <50ms
3. **Custom styling** - Full control over rendering
4. **Analytics** - Calculate exact areas, overlaps
5. **Reliability** - No timeouts from slow municipal servers

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data freshness | Schedule monthly updates, track source timestamps |
| Licensing issues | Verify open data licenses, attribute sources |
| Incomplete coverage | Fall back to WMS for missing municipalities |
| Storage costs | Use geometry simplification, compress tiles |

## Recommendation

**Hybrid approach:**
1. Store vectors for municipalities where we can extract them (~30)
2. Continue using dynamic proxy for others
3. Display coverage status to users (verified vs. dynamic)

This provides the best user experience while being realistic about data availability.
