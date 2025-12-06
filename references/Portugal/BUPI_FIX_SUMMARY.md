# BUPi Integration Fix Summary

## Problem Statement

BUPi ArcGIS REST API queries were returning **no data** during Portugal cadastral enrichment runs, despite the service containing ~2 million property records.

## Root Cause Analysis

### 1. **Incorrect Geometry Parameter Format** ❌

**The Issue:**
```typescript
// OLD (BROKEN) - JSON.stringify creates invalid parameter
geometry: JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } })
// Results in: geometry=%7B%22x%22%3A-9.15%2C%22y%22%3A38.75%2C...
```

**Why It Failed:**
- ArcGIS REST API expects simple `"x,y"` format for point geometry
- JSON-stringifying creates a malformed parameter that the server silently ignores
- All queries returned empty `features: []` arrays

**The Fix:** ✅
```typescript
// NEW (WORKING) - Simple coordinate format
geometry: `${lon},${lat}`
// Results in: geometry=-7.821,39.691
```

### 2. **Wrong Field Names** ❌

**The Issue:**
```typescript
area_m2: props.Shape_Area || props.SHAPE_Area || props.shape_area
bupi_id: props.OBJECTID ? String(props.OBJECTID) : ...
```

**Actual Field Names** (from service metadata):
- Area: `st_area(shape)` (computed field)
- ID: `objectid` (lowercase)
- Perimeter: `st_length(shape)` (computed field)

**The Fix:** ✅
```typescript
area_m2: props["st_area(shape)"] || props.shape_area || props.Shape_Area
bupi_id: props.objectid ? String(props.objectid) : ...
```

### 3. **Multiple Endpoints Confusion** ❌

Tried two endpoints but only one is valid:
- ✅ `https://geo.bupi.gov.pt/arcgis/rest/services/opendata/RGG_DadosGovPT/MapServer/0/query`
- ❌ `https://geo.bupi.gov.pt/gisbupi/rest/services/...` (doesn't exist)

## Verification

### Before Fix:
```bash
$ curl "...geometry=%7B%22x%22%3A-7.821..."
{"features":[]}  # Empty!
```

### After Fix:
```bash
$ ts-node bupi_arcgis_rest.ts -7.821 39.691
✓ BUPi ArcGIS: 210380669 (9153m², contains point)
```

## Important: BUPi Coverage Limitations

### Why You Still May Not Get Data ⚠️

**BUPi RGG is crowd-sourced** - property owners voluntarily submit boundary data:

1. **Patchy Coverage**
   - Only ~2 million properties (as of 2023)
   - Better in rural areas (fire prevention initiative post-2017 fires)
   - Sparse in urban areas (Lisbon, Porto have better official cadastre)

2. **Self-Declared Boundaries**
   - Accuracy varies (GPS, topographic surveys, OR visual interpretation)
   - Not authoritative like DGT cadastre
   - Intended to complement official cadastre, not replace it

3. **Testing Recommendations**
   ```bash
   # ✅ Good coverage (rural central Portugal)
   -7.821, 39.691  # Returns data
   
   # ❌ Poor coverage (Lisbon city center)  
   -9.15, 38.75    # Often returns nothing (normal!)
   ```

## Files Modified

1. **`bupi_arcgis_rest.ts`**
   - Fixed geometry parameter format
   - Fixed field name extraction
   - Removed non-working endpoint
   - Improved logging

2. **No changes needed to `bupi_lookup.ts`** (WFS)
   - WFS already uses correct BBOX format
   - Also has limited coverage (same dataset source)

## Performance Impact

### Expected Results After Fix:

**In areas WITH BUPi coverage:**
- ✅ Queries work (100m buffer usually sufficient)
- ✅ Correct property ID and area returned
- ✅ Geometry properly extracted

**In areas WITHOUT BUPi coverage:**
- ℹ️ Still returns no data (expected - not a bug!)
- Falls back to DGT cadastre (if available)
- Logged as "No BUPi ArcGIS properties found near coordinates"

## Best Practices for BUPi Queries

1. **Always use DGT as primary source**
   - Official, authoritative cadastre
   - Better coverage in urban areas
   - Use BUPi as fallback only

2. **Progressive buffer expansion** (already implemented)
   - 100m → 500m → 1km
   - Stop at first hit
   - Prefer "contains point" over "nearest"

3. **Expect gaps**
   - Don't retry excessively if no data
   - Log clearly: "No coverage" vs "API error"
   - Consider adding coverage statistics to final report

## Testing Checklist

- [x] Test with known coordinates (-7.821, 39.691)
- [x] Verify geometry extraction works
- [x] Verify field names are correct
- [x] Test with urban coordinates (expect no data)
- [ ] Run small batch (10-50 plots) with mix of rural/urban
- [ ] Check final statistics: DGT vs BUPi coverage ratio
- [ ] Verify no API timeout/errors (if errors occur, investigate)

## Next Steps

1. **Run Test Batch** (10-20 plots)
   ```bash
   PORTUGAL_CADASTRE_DRY_RUN=true \
   PORTUGAL_CADASTRE_DRY_RUN_LIMIT=20 \
   npm run portugal-cadastre
   ```

2. **Check for BUPi hits**
   - Look for "✓ BUPi ArcGIS" log messages
   - Expect 5-20% hit rate (depends on plot locations)

3. **Review final stats**
   ```
   Total plots processed: 20
   Successfully enriched: 18 (90%)
   - From DGT Cadastre: 16 (89%)
   - From BUPi (ArcGIS): 2 (11%)
   ```

4. **If still no BUPi data:**
   - Check if plots are in urban areas (Lisbon, Porto)
   - Verify coordinates are in Portugal Continental
   - Review logs for API errors (timeouts, HTTP 500, etc.)

## Resources

- BUPi Public Viewer: https://experience.arcgis.com/experience/4f7ae3949aae46d59d119e4b3094f21f
- Open Data Portal: https://dados.gov.pt/pt/datasets/representacao-grafica-georreferenciada/
- ArcGIS REST API Docs: https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/
