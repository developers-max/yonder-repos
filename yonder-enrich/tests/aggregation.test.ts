import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { aggregateCasafariSearchPages } from '../src/enrichments/casafari/aggregate';

describe('aggregateCasafariSearchPages', () => {
  let tmpDir: string;
  const ts = '2025-09-26T23-30-00-000Z';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yonder-enrich-aggregate-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('aggregates multiple page files into a single file with concatenated results', async () => {
    // Create 3 page files
    const mkPage = (page: number, results: any[]) => {
      const fname = `casafari-search_${ts}_page${page}_limit2_offset${(page - 1) * 2}.json`;
      const fpath = path.join(tmpDir, fname);
      fs.writeFileSync(
        fpath,
        JSON.stringify({ count: 5, next: page < 3 ? 'dummy' : null, previous: null, results }, null, 2),
        'utf-8'
      );
    };

    mkPage(1, [{ id: 1 }, { id: 2 }]);
    mkPage(2, [{ id: 3 }, { id: 4 }]);
    mkPage(3, [{ id: 5 }]);

    const aggregatedPath = await aggregateCasafariSearchPages(tmpDir, ts);
    expect(fs.existsSync(aggregatedPath)).toBe(true);

    const aggregated = JSON.parse(fs.readFileSync(aggregatedPath, 'utf-8'));
    expect(aggregated.pages).toBe(3);
    expect(aggregated.files).toHaveLength(3);
    expect(aggregated.total_results).toBe(5);
    expect(aggregated.results.map((r: any) => r.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('throws if no page files exist to aggregate', async () => {
    await expect(aggregateCasafariSearchPages(tmpDir, ts)).rejects.toThrow(/No page files found/);
  });
});
