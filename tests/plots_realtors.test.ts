import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Pool } from 'pg';
import { linkPlotsToRealtorsFromOutputs } from '../src/etl/plots_realtors';

// Mock pg Pool
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('linkPlotsToRealtorsFromOutputs', () => {
  let tmpDir: string;
  let mockClient: any;
  let mockPool: any;
  const originalEnv = process.env;

  beforeEach(() => {
    // Create temp directory for test files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yonder-enrich-plots-realtors-'));

    // Setup mock client with query tracking
    const queryResults = new Map<string, any>();
    
    mockClient = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        // Handle BEGIN/COMMIT/ROLLBACK
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }

        // Handle CREATE TABLE and CREATE INDEX
        if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
          return { rows: [] };
        }

        // Handle SELECT from plots_stage
        if (sql.includes('SELECT id::text AS id, casafari_id FROM plots_stage')) {
          return {
            rows: [
              { id: 'plot-uuid-1', casafari_id: '2173805076' },
              { id: 'plot-uuid-2', casafari_id: '2173805077' },
              { id: 'plot-uuid-3', casafari_id: '2173805078' },
            ],
          };
        }

        // Handle SELECT from realtors
        if (sql.includes('SELECT id, company_name FROM realtors')) {
          return {
            rows: [
              { id: 1, company_name: 'Best Place' },
              { id: 2, company_name: 'Idealista' },
              { id: 3, company_name: 'Central Hill Apartments' },
              { id: 4, company_name: 'Tap Imóveis' },
              { id: 5, company_name: 'Inactive Agency' },
            ],
          };
        }

        // Handle INSERT into plots_stage_realtors
        if (sql.includes('INSERT INTO plots_stage_realtors')) {
          const insertCount = params ? Math.floor(params.length / 5) : 0;
          queryResults.set('lastInsert', { params, insertCount });
          return { rowCount: insertCount };
        }

        return { rows: [] };
      }),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn(async () => mockClient),
      end: jest.fn(async () => {}),
    };

    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);

    // Setup environment
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REALTORS_DEFAULT_COUNTRY: 'PT',
    };
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should only link active listings to plots', async () => {
    // Create test JSON file with mixed active and inactive listings
    const testData = {
      count: 3,
      results: [
        {
          property_id: 2173805076,
          listings: [
            {
              listing_id: 1,
              sale_status: 'active',
              agency: 'Best Place',
              source_name: 'Idealista',
              companies: [
                { name: 'Central Hill Apartments' },
                { name: 'Tap Imóveis' },
              ],
            },
            {
              listing_id: 2,
              sale_status: 'inactive',
              agency: 'Inactive Agency',
              source_name: 'Inactive Source',
              companies: [{ name: 'Should Not Appear' }],
            },
          ],
        },
        {
          property_id: 2173805077,
          listings: [
            {
              listing_id: 3,
              rent_status: 'active',
              sale_status: 'none',
              agency: 'Best Place',
              source_name: 'Idealista',
              companies: [],
            },
          ],
        },
        {
          property_id: 2173805078,
          listings: [
            {
              listing_id: 4,
              sale_status: 'sold',
              rent_status: 'none',
              agency: 'Inactive Agency',
              source_name: 'Should Not Link',
              companies: [],
            },
          ],
        },
      ],
    };

    const testFile = path.join(tmpDir, 'test-listings.json');
    fs.writeFileSync(testFile, JSON.stringify(testData, null, 2), 'utf-8');

    await linkPlotsToRealtorsFromOutputs(tmpDir);

    // Verify that INSERT was called
    const insertCalls = mockClient.query.mock.calls.filter((call: any) =>
      call[0].includes('INSERT INTO plots_stage_realtors')
    );
    expect(insertCalls.length).toBeGreaterThan(0);

    // Get the inserted data
    const insertCall = insertCalls[0];
    const params = insertCall[1];

    // Extract inserted records (each record has 5 params: plot_id, realtor_id, role, name, file)
    const records: Array<{ plot_id: string; realtor_id: number; role: string; name: string }> = [];
    for (let i = 0; i < params.length; i += 5) {
      records.push({
        plot_id: params[i],
        realtor_id: params[i + 1],
        role: params[i + 2],
        name: params[i + 3],
      });
    }

    // Verify only active listings were processed
    // Property 2173805076 has 1 active listing with Best Place, Idealista, and 2 companies
    // Property 2173805077 has 1 active listing (rent) with Best Place and Idealista
    // Property 2173805078 has NO active listings (sold status)

    // Check that Inactive Agency was NOT linked (it only appears in inactive listings)
    const inactiveAgencyLinks = records.filter(r => r.name === 'Inactive Agency');
    expect(inactiveAgencyLinks.length).toBe(0);

    // Check that Best Place was linked (appears in active listings)
    const bestPlaceLinks = records.filter(r => r.name === 'Best Place');
    expect(bestPlaceLinks.length).toBeGreaterThan(0);

    // Check that Idealista was linked (appears in active listings)
    const idealistaLinks = records.filter(r => r.name === 'Idealista');
    expect(idealistaLinks.length).toBeGreaterThan(0);

    // Check that companies from active listings were linked
    const companyLinks = records.filter(r => r.role === 'company');
    expect(companyLinks.length).toBeGreaterThan(0);

    // Verify plot-uuid-3 (property 2173805078) has NO links because all its listings are inactive
    const plot3Links = records.filter(r => r.plot_id === 'plot-uuid-3');
    expect(plot3Links.length).toBe(0);

    // Verify transaction was committed
    const commitCalls = mockClient.query.mock.calls.filter((call: any) => call[0] === 'COMMIT');
    expect(commitCalls.length).toBe(1);
  });

  it('should handle rent_status active listings', async () => {
    const testData = {
      count: 1,
      results: [
        {
          property_id: 2173805076,
          listings: [
            {
              listing_id: 1,
              sale_status: 'none',
              rent_status: 'active',
              agency: 'Best Place',
              source_name: 'Idealista',
              companies: [],
            },
          ],
        },
      ],
    };

    const testFile = path.join(tmpDir, 'test-rent-listings.json');
    fs.writeFileSync(testFile, JSON.stringify(testData, null, 2), 'utf-8');

    await linkPlotsToRealtorsFromOutputs(tmpDir);

    const insertCalls = mockClient.query.mock.calls.filter((call: any) =>
      call[0].includes('INSERT INTO plots_stage_realtors')
    );
    expect(insertCalls.length).toBeGreaterThan(0);

    const params = insertCalls[0][1];
    const records: Array<{ name: string }> = [];
    for (let i = 0; i < params.length; i += 5) {
      records.push({ name: params[i + 3] });
    }

    // Verify that rent active listings were processed
    expect(records.some(r => r.name === 'Best Place')).toBe(true);
  });

  it('should deduplicate plot-realtor pairs across multiple files', async () => {
    // Create two files with the same property and agency
    const testData1 = {
      count: 1,
      results: [
        {
          property_id: 2173805076,
          listings: [
            {
              listing_id: 1,
              sale_status: 'active',
              agency: 'Best Place',
              source_name: 'Idealista',
              companies: [],
            },
          ],
        },
      ],
    };

    const testData2 = {
      count: 1,
      results: [
        {
          property_id: 2173805076,
          listings: [
            {
              listing_id: 2,
              sale_status: 'active',
              agency: 'Best Place',
              source_name: 'Idealista',
              companies: [],
            },
          ],
        },
      ],
    };

    fs.writeFileSync(path.join(tmpDir, 'file1.json'), JSON.stringify(testData1, null, 2), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'file2.json'), JSON.stringify(testData2, null, 2), 'utf-8');

    await linkPlotsToRealtorsFromOutputs(tmpDir);

    const insertCalls = mockClient.query.mock.calls.filter((call: any) =>
      call[0].includes('INSERT INTO plots_stage_realtors')
    );

    if (insertCalls.length > 0) {
      const params = insertCalls[0][1];
      const records: Array<{ plot_id: string; realtor_id: number; role: string }> = [];
      for (let i = 0; i < params.length; i += 5) {
        records.push({
          plot_id: params[i],
          realtor_id: params[i + 1],
          role: params[i + 2],
        });
      }

      // Count unique plot-realtor-role combinations for Best Place
      const bestPlaceAgencyLinks = records.filter(
        r => r.plot_id === 'plot-uuid-1' && r.realtor_id === 1 && r.role === 'agency'
      );
      // Should only have 1 link despite appearing in 2 files
      expect(bestPlaceAgencyLinks.length).toBe(1);
    }
  });

  it('should handle empty directory gracefully', async () => {
    await linkPlotsToRealtorsFromOutputs(tmpDir);

    // Should commit even with no files
    const commitCalls = mockClient.query.mock.calls.filter((call: any) => call[0] === 'COMMIT');
    expect(commitCalls.length).toBe(1);
  });

  it('should rollback if no plots found in database', async () => {
    // Override the plots_stage query to return empty
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql.includes('SELECT id::text AS id, casafari_id FROM plots_stage')) {
        return { rows: [] }; // No plots
      }
      return { rows: [] };
    });

    await linkPlotsToRealtorsFromOutputs(tmpDir);

    // Should rollback
    const rollbackCalls = mockClient.query.mock.calls.filter((call: any) => call[0] === 'ROLLBACK');
    expect(rollbackCalls.length).toBe(1);
  });

  it('should extract agency, source, and companies from active listings', async () => {
    const testData = {
      count: 1,
      results: [
        {
          property_id: 2173805076,
          listings: [
            {
              listing_id: 1,
              sale_status: 'active',
              agency: 'Best Place',
              source_name: 'Idealista',
              companies: [
                { name: 'Central Hill Apartments' },
                { name: 'Tap Imóveis' },
              ],
            },
          ],
        },
      ],
    };

    const testFile = path.join(tmpDir, 'test-extraction.json');
    fs.writeFileSync(testFile, JSON.stringify(testData, null, 2), 'utf-8');

    await linkPlotsToRealtorsFromOutputs(tmpDir);

    const insertCalls = mockClient.query.mock.calls.filter((call: any) =>
      call[0].includes('INSERT INTO plots_stage_realtors')
    );
    expect(insertCalls.length).toBeGreaterThan(0);

    const params = insertCalls[0][1];
    const records: Array<{ role: string; name: string }> = [];
    for (let i = 0; i < params.length; i += 5) {
      records.push({
        role: params[i + 2],
        name: params[i + 3],
      });
    }

    // Check for agency role
    expect(records.some(r => r.role === 'agency' && r.name === 'Best Place')).toBe(true);

    // Check for source role
    expect(records.some(r => r.role === 'source' && r.name === 'Idealista')).toBe(true);

    // Check for company roles
    expect(records.some(r => r.role === 'company' && r.name === 'Central Hill Apartments')).toBe(true);
    expect(records.some(r => r.role === 'company' && r.name === 'Tap Imóveis')).toBe(true);
  });
});
