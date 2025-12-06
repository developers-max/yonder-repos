# API Unit Tests

Comprehensive unit tests for the Yonder Enrich API, covering all endpoints, core enrichment functions, and helper utilities.

## Test Structure

```
tests/api/
├── server.test.ts                              # API endpoint tests
├── location-enrichment.test.ts                 # Core enrichment orchestrator tests
└── helpers/
    ├── municipality-helpers.test.ts            # Municipality geocoding & DB tests
    └── crus-helpers.test.ts                    # CRUS zoning lookup tests
```

## Test Coverage

### 1. Server Endpoints (`server.test.ts`)

Tests all HTTP endpoints with comprehensive validation:

#### GET /health
- ✅ Returns healthy status with correct service info
- ✅ Includes valid timestamp and uptime
- ✅ Returns 200 status code

#### POST /api/enrich/location
- ✅ Successfully enriches valid locations
- ✅ Validates required parameters (latitude, longitude)
- ✅ Validates coordinate ranges (-90 to 90 for lat, -180 to 180 for lon)
- ✅ Accepts boundary values
- ✅ Respects `store_results` flag
- ✅ Respects `translate` flag with target language
- ✅ Handles errors gracefully (500 response)
- ✅ Returns proper error messages for invalid input

#### GET /api/enrich/info
- ✅ Returns API documentation
- ✅ Lists all available endpoints
- ✅ Documents global and country-specific enrichments
- ✅ Includes data source information

#### 404 Handler
- ✅ Returns 404 for unknown routes
- ✅ Lists available endpoints in response

**Total Tests: 30+**

---

### 2. Location Enrichment (`location-enrichment.test.ts`)

Tests the core enrichment orchestrator with all country-specific enrichments:

#### Basic Enrichment Flow
- ✅ Successfully enriches locations with municipality and amenities data
- ✅ Returns proper response structure
- ✅ Includes timestamps

#### Portugal Enrichments
- ✅ Runs CRUS zoning lookup for PT coordinates
- ✅ Runs Portugal cadastre lookup
- ✅ Skips enrichments when no data found
- ✅ Marks enrichments as failed on errors
- ✅ Continues processing after individual failures

#### Spain Enrichments
- ✅ Runs Spain zoning lookup for ES coordinates
- ✅ Runs Spain cadastre lookup
- ✅ Handles missing data gracefully

#### Germany Enrichments
- ✅ Runs Germany zoning lookup for DE coordinates
- ✅ Skips enrichments when no data found

#### Translation Feature
- ✅ Translates Portugal zoning labels (pt → en)
- ✅ Translates Spain zoning labels (es → en)
- ✅ Translates Germany zoning labels (de → en)
- ✅ Includes original label and translation metadata
- ✅ Handles translation failures gracefully
- ✅ Respects translate flag setting

#### Database Storage
- ✅ Stores results when `store_results=true`
- ✅ Skips storage when `store_results=false`
- ✅ Handles database connection errors
- ✅ Includes municipality_id when available
- ✅ Releases connections properly

#### Error Handling
- ✅ Handles municipality enrichment failures
- ✅ Handles amenities enrichment failures
- ✅ Continues processing after individual enrichment failures
- ✅ Returns error in response for unhandled exceptions

#### Data Merging
- ✅ Merges all enrichment data into `enrichment_data` field
- ✅ Preserves existing data when merging

#### Unknown Countries
- ✅ Skips country-specific enrichments for unknown countries
- ✅ Still runs global enrichments (municipalities, amenities)

**Total Tests: 40+**

---

### 3. Municipality Helpers (`municipality-helpers.test.ts`)

Tests geocoding and database operations for municipalities:

#### getMunicipalityFromCoordinates
- ✅ Successfully gets municipality data from valid coordinates
- ✅ Extracts municipality name from various address fields (city, town, village, municipality, county)
- ✅ Extracts district from state or county fields
- ✅ Converts country code to uppercase ISO-2 format
- ✅ Returns null for invalid coordinates
- ✅ Returns null when no address data available
- ✅ Handles API errors gracefully
- ✅ Includes proper User-Agent header
- ✅ Uses correct Nominatim endpoint and parameters
- ✅ Has appropriate timeout (30s)

#### Retry Mechanism
- ✅ Retries up to 3 times on failures
- ✅ Uses exponential backoff
- ✅ Succeeds after transient failures
- ✅ Returns null after exhausting retries

#### findMunicipalityByName
- ✅ Finds municipality by exact name match
- ✅ Falls back to case-insensitive search (ILIKE)
- ✅ Returns null if no match found
- ✅ Handles database errors gracefully
- ✅ Handles empty result rows

#### insertMunicipality
- ✅ Inserts new municipality successfully
- ✅ Handles upsert on conflict (ON CONFLICT DO UPDATE)
- ✅ Handles null district and country
- ✅ Converts undefined to null
- ✅ Includes timestamps (created_at, updated_at)
- ✅ Updates timestamp on conflict
- ✅ Preserves existing data with COALESCE
- ✅ Returns null on database errors

#### Edge Cases
- ✅ Handles very long municipality names
- ✅ Handles special characters (São José dos Pinhais)
- ✅ Handles coordinates at boundaries

**Total Tests: 35+**

---

### 4. CRUS Helpers (`crus-helpers.test.ts`)

Tests Portugal CRUS zoning lookup functionality:

#### getCRUSZoningForPoint
- ✅ Returns zoning data for valid coordinates
- ✅ Returns null if no município found
- ✅ Returns null if no zoning collections found
- ✅ Tries multiple collections until finding data
- ✅ Handles point not in polygon
- ✅ Tries different property fields (uso, zoning, classification, class, tipo, type)
- ✅ Skips features without zoning labels
- ✅ Handles API errors gracefully
- ✅ Handles polygon check errors
- ✅ Includes sample properties in response
- ✅ Includes feature count in response
- ✅ Identifies collections by keywords (crus, zoning, uso)
- ✅ Uses different municipality property names (municipio, MUNICIPIO, NOME, nome)
- ✅ Handles empty município name
- ✅ Handles município lookup with multiple features
- ✅ Constructs correct bbox around point

#### Edge Cases & Robustness
- ✅ Handles malformed GeoJSON
- ✅ Handles network timeouts
- ✅ Handles coordinates at Portugal boundaries

**Total Tests: 25+**

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- server.test.ts
npm test -- location-enrichment.test.ts
npm test -- municipality-helpers.test.ts
npm test -- crus-helpers.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests for Specific Test Suite
```bash
npm test -- --testNamePattern="GET /health"
npm test -- --testNamePattern="Portugal Enrichments"
```

## Test Patterns & Best Practices

### Mocking Strategy

All tests use comprehensive mocking to isolate units:

1. **External APIs**: Mocked with `jest.mock('axios')`
2. **Database**: Mocked with `jest.mock('pg')`
3. **Dependencies**: Mocked at module level

### Test Structure

Each test follows AAA pattern:
- **Arrange**: Setup mocks and test data
- **Act**: Execute the function under test
- **Assert**: Verify the results

### Example Test Pattern

```typescript
it('should successfully enrich a location', async () => {
  // Arrange
  const mockData = { /* test data */ };
  mockedFunction.mockResolvedValue(mockData);
  
  // Act
  const result = await enrichLocation(request);
  
  // Assert
  expect(result).toBeDefined();
  expect(result.country).toBe('PT');
});
```

## Coverage Goals

- **Endpoint Coverage**: 100% of API endpoints tested
- **Function Coverage**: All exported functions tested
- **Error Paths**: All error scenarios covered
- **Edge Cases**: Boundary conditions and special cases tested

## Key Testing Decisions

### 1. Comprehensive Parameter Validation
All API endpoints validate:
- Required parameters
- Data types
- Value ranges
- Boundary conditions

### 2. Error Handling
Tests verify:
- Graceful degradation on failures
- Proper error messages
- Continuation of processing when possible

### 3. Database Operations
Tests ensure:
- Proper connection management
- Transaction handling
- Resource cleanup (connection release)

### 4. Country-Specific Logic
Tests cover:
- All supported countries (PT, ES, DE)
- Unknown country handling
- Conditional enrichment execution

### 5. Translation Features
Tests validate:
- Optional translation functionality
- Language-specific hints
- Fallback to original on failure
- Metadata preservation

## Test Data

### Coordinates Used
- **Portugal**: 38.7223, -9.1393 (Lisboa)
- **Spain**: 41.3851, 2.1734 (Barcelona)
- **Germany**: 52.5200, 13.4050 (Berlin)
- **USA**: 40.7128, -74.0060 (New York)

### Mock Municipality Data
- Name, district, country code
- Various address field combinations
- Edge cases (special characters, long names)

### Mock Enrichment Data
- Amenities (schools, restaurants)
- Zoning labels (various languages)
- Cadastral references

## Dependencies

### Testing Framework
- **jest**: ^29.7.0
- **ts-jest**: ^29.2.5

### Testing Utilities
- **supertest**: For HTTP endpoint testing
- **@types/jest**: TypeScript definitions
- **@types/supertest**: TypeScript definitions

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- No external dependencies required
- All network calls mocked
- Deterministic results
- Fast execution (~5-10 seconds total)

## Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test
```bash
npm test -- --testNamePattern="should successfully enrich"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["${fileBasename}", "--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Future Enhancements

### Planned Test Additions
- [ ] Integration tests with real database
- [ ] E2E tests with Docker containers
- [ ] Performance tests
- [ ] Load tests
- [ ] Contract tests for external APIs

### Coverage Improvements
- [ ] Add tests for remaining enrichment modules
- [ ] Add tests for LLM translation module
- [ ] Add tests for image processing modules
- [ ] Add tests for ETL pipeline

## Contributing

When adding new API features:
1. Write tests first (TDD approach)
2. Ensure all tests pass before committing
3. Maintain >80% code coverage
4. Update this README with new test information

## Troubleshooting

### Common Issues

**Issue**: Tests timeout
- **Solution**: Check mock configuration, ensure async operations are properly handled

**Issue**: "Cannot find module" errors
- **Solution**: Run `npm install` to ensure all dependencies are installed

**Issue**: Flaky tests
- **Solution**: Check for race conditions, ensure proper cleanup in `afterEach`

**Issue**: Type errors
- **Solution**: Ensure `@types/*` packages are installed and tsconfig is correct

## Summary

✅ **130+ comprehensive unit tests** covering all API functionality  
✅ **100% endpoint coverage** - all routes tested  
✅ **Full error handling** - all failure scenarios covered  
✅ **Country-specific logic** - PT, ES, DE enrichments tested  
✅ **Translation features** - optional translation fully tested  
✅ **Database operations** - storage and retrieval tested  
✅ **Helper functions** - all utilities thoroughly tested  
✅ **Edge cases** - boundary conditions and special cases covered  

The test suite provides confidence in the API's reliability and makes future changes safe through comprehensive automated testing.
