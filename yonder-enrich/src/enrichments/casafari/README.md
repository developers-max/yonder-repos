# Casafari Enrichment Module

This module provides tools for downloading, paginating, and processing real estate data from the Casafari API for specific regions.

## Features

- **Region-specific downloads** for Portugal, Niedersachsen (Germany), and Alella (Spain)
- **Automatic pagination** to fetch all available data
- **Country-organized storage** in separate subdirectories
- **Data aggregation** to combine paginated results
- **Realtor extraction** from property listings

## Region-Specific Search Functions

### 1. Portugal (Country-level)
- **Location ID**: 499
- **Function**: `searchPlotsForSalePortugal()`
- **Output**: `outputs/casafari-search/portugal/`

### 2. Niedersachsen, Germany (Province-level)
- **Location ID**: 532983
- **Function**: `searchPlotsForSaleNiedersachsen()`
- **Output**: `outputs/casafari-search/germany/`

### 3. Alella, Spain (Province-level)
- **Location ID**: 10300
- **Function**: `searchPlotsForSaleAlella()`
- **Output**: `outputs/casafari-search/spain/`

## Quick Start

### Download a Single Region

```typescript
import { downloadPortugalPlots } from './enrichments/casafari';

// Download all plots for sale in Portugal
const result = await downloadPortugalPlots({
  startLimit: 500,   // Optional: results per page
  startOffset: 0,    // Optional: starting offset
  startOrder: 'desc' // Optional: sort order
});

console.log(`Downloaded ${result.pages} pages`);
console.log(`Files saved to: ${result.baseDir}`);
```

### Download All Regions at Once

```typescript
import { downloadAllRegions } from './enrichments/casafari';

const results = await downloadAllRegions();

// Results contains data for all three regions:
// - results.portugal
// - results.germany  
// - results.spain
```

### Aggregate Results

```typescript
import { aggregateCasafariSearchPages } from './enrichments/casafari';

// After downloading, aggregate all pages into a single file
const aggregatedFile = await aggregateCasafariSearchPages(
  result.baseDir,  // Directory containing page files
  result.ts        // Timestamp identifier
);

console.log(`Aggregated data saved to: ${aggregatedFile}`);
```

## Output Structure

```
outputs/
└── casafari-search/
    ├── portugal/
    │   ├── casafari-search_2025-10-23T20-30-00-000Z_page1_limit500_offset0.json
    │   ├── casafari-search_2025-10-23T20-30-00-000Z_page2_limit500_offset500.json
    │   └── casafari-search_2025-10-23T20-30-00-000Z_aggregated.json
    ├── germany/
    │   ├── casafari-search_2025-10-23T20-35-00-000Z_page1_limit500_offset0.json
    │   └── casafari-search_2025-10-23T20-35-00-000Z_aggregated.json
    └── spain/
        ├── casafari-search_2025-10-23T20-40-00-000Z_page1_limit500_offset0.json
        └── casafari-search_2025-10-23T20-40-00-000Z_aggregated.json
```

## API Payload Structure

Each search function sends the following payload structure:

```typescript
{
  search_operations: ["sale"],
  types: ["urban_plot"],
  location_ids: [<location_id>]  // Region-specific ID
}
```

## Environment Variables

Required:
- `CASAFARI_AUTH` or `CASAFARI_API_TOKEN`: Authentication token for Casafari API

Optional:
- `CASAFARI_API_BASE_URL`: API base URL (default: `https://api.casafari.com`)
- `CASAFARI_OUTPUT_DIR`: Base output directory (default: `outputs/casafari-search`)
- `DATABASE_URL`: PostgreSQL connection string (for realtor extraction)
- `REALTORS_DEFAULT_COUNTRY`: Default country for realtors (default: `PT`)

## Advanced Usage

### Custom Filters

Use the `filtersOverride` option to add custom filters:

```typescript
const result = await downloadPortugalPlots({
  filtersOverride: {
    price_min: 50000,
    price_max: 500000,
    plot_area_min: 1000
  }
});
```

### Manual Pagination

For more control over pagination:

```typescript
import { paginateCasafariSearchAndSave, searchPlotsForSalePortugal } from './enrichments/casafari';

const result = await paginateCasafariSearchAndSave({
  searchFn: searchPlotsForSalePortugal,
  outDir: 'outputs/casafari-search',
  countrySubdir: 'portugal',
  startLimit: 100,
  startOffset: 0,
  startOrder: 'asc'
});
```

### Extract Realtors

After downloading data, extract realtor information to database:

```typescript
import { extractAndStoreRealtorsFromCasafariOutputs } from './enrichments/casafari/realtors';

// Extract from Portugal directory
await extractAndStoreRealtorsFromCasafariOutputs(
  'outputs/casafari-search/portugal'
);

// Extract from all directories
await extractAndStoreRealtorsFromCasafariOutputs('outputs/casafari-search/portugal');
await extractAndStoreRealtorsFromCasafariOutputs('outputs/casafari-search/germany');
await extractAndStoreRealtorsFromCasafariOutputs('outputs/casafari-search/spain');
```

## Error Handling

All functions throw errors on failure. Wrap in try-catch for proper error handling:

```typescript
try {
  const result = await downloadPortugalPlots();
  console.log('Success!', result);
} catch (error) {
  console.error('Download failed:', error.message);
}
```

## Location ID Reference

To add more regions, you'll need the Casafari location_id:
1. Search the API response `locations_structure` array
2. Find the desired administrative level (País, Distrito, Concelho, Freguesia, etc.)
3. Use the corresponding `location_id` in your search payload

Example from API response:
```json
{
  "location_id": 499,
  "name": "Portugal",
  "administrative_level": "País"
}
```
