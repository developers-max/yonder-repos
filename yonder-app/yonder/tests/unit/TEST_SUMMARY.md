# GCS PDF Report Tests - Summary

## Overview
Comprehensive unit tests for the GCS-based PDF report access system.

## Test Files Created

### 1. **GCS Client Tests** (`tests/unit/utils/gcs-client.test.ts`)
✅ **25 tests passing**

Tests the core Google Cloud Storage utility functions:

- **`extractGcsPath`** (8 tests)
  - Parses gs://, storage.googleapis.com, and storage.cloud.google.com URLs
  - Handles deeply nested paths
  - Returns null for invalid URLs

- **`fileExists`** (4 tests)
  - Checks file existence in GCS bucket
  - Handles invalid URLs and API errors gracefully

- **`getFileStream`** (5 tests)
  - Returns readable streams for valid files
  - Throws appropriate errors for missing files or invalid URLs
  - Works with both gs:// and https:// URL formats

- **`getFileMetadata`** (5 tests)
  - Returns metadata (size, content type, updated date)
  - Handles missing metadata fields with defaults
  - Parses sizes correctly as integers

- **`getBucketName`** (2 tests)
  - Returns configured bucket name
  - Validates bucket name format

- **Storage client initialization** (1 test)
  - Verifies correct bucket and file method calls

### 2. **Router Tests** (`tests/unit/router/plot-report-pdf.test.ts`)
✅ **10 tests passing**

Tests the tRPC `fetchPlotReportPdf` procedure:

- Returns PDF metadata when plot and file exist
- Throws errors for:
  - Non-existent plots
  - Plots without PDF URLs
  - PDFs not found in GCS
  - Failed metadata retrieval
- Handles https:// GCS URLs correctly
- Requires authentication
- Validates plotId input
- Handles database and GCS errors gracefully

### 3. **API Route Tests** (`tests/unit/api/plot-report-pdf-route.test.ts`)
✅ **10 tests passing**

Tests the Next.js API route `/api/plot-report-pdf/[plotId]`:

- Streams PDFs successfully for authenticated users
- Returns 401 for unauthenticated users
- Returns 404 for:
  - Non-existent plots
  - Plots without PDF reports
- Returns 500 for:
  - Metadata retrieval failures
  - GCS streaming errors
  - Database errors
- Sets correct headers:
  - Content-Type: application/pdf
  - Content-Disposition with filename
  - Content-Length
  - Cache-Control: private, max-age=3600
- Works with both gs:// and https:// GCS URLs

## Total Test Coverage

**45 tests passing** across 3 test suites covering:
- URL parsing and validation
- GCS bucket operations
- File streaming
- Authentication and authorization
- Error handling
- Database integration
- HTTP response formatting

## Running the Tests

```bash
# Run all GCS-related tests
npm test tests/unit/utils/gcs-client.test.ts
npm test tests/unit/router/plot-report-pdf.test.ts
npm test tests/unit/api/plot-report-pdf-route.test.ts

# Run with coverage
npm test:coverage
```

## Mock Strategy

- **GCS Storage SDK**: Fully mocked with hoisted state for predictable behavior
- **Database**: Mocked with chainable query builder
- **Auth**: Mocked session management
- **Next.js headers**: Mocked for API route testing

## Environment Variables Required

Tests verify the system works with:
- `GOOGLE_BUCKET_ACCESS_ACCOUNT`: Service account JSON credentials
- `GCP_PROJECT_ID`: yonder-477414
- `GCS_BUCKET_NAME`: yonder-reports
