import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { paginateCasafariSearchAndSave, Order, SearchFn } from '../src/enrichments/casafari/pagination';

describe('paginateCasafariSearchAndSave', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yonder-enrich-paginate-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('paginates using next URL and writes each page to a file', async () => {
    // Prepare a dataset of 5 items
    const dataset = [1, 2, 3, 4, 5].map((n) => ({ id: n }));

    const calls: Array<{ limit?: number; offset?: number; order?: Order }> = [];

    const mockSearchFn: SearchFn = async ({ limit = 2, offset = 0, order = 'desc' }) => {
      calls.push({ limit, offset, order });
      const slice = dataset.slice(offset, offset + limit);
      const nextOffset = offset + limit;
      const hasNext = nextOffset < dataset.length;
      const next = hasNext
        ? `https://api.casafari.com/api/v1/properties/search?limit=${limit}&offset=${nextOffset}&order=${order}&order_by=price`
        : null;
      return {
        count: dataset.length,
        next,
        previous: null,
        results: slice,
      };
    };

    const res = await paginateCasafariSearchAndSave({
      searchFn: mockSearchFn,
      outDir: tmpDir,
      startLimit: 2,
      startOffset: 0,
      startOrder: 'desc',
    });

    // Expect 3 pages: [1,2], [3,4], [5]
    expect(res.pages).toBe(3);
    expect(res.files).toHaveLength(3);

    // Verify files exist and content
    const contents = res.files.map((f) => JSON.parse(fs.readFileSync(f, 'utf-8')));
    expect(contents[0].results.map((r: any) => r.id)).toEqual([1, 2]);
    expect(contents[1].results.map((r: any) => r.id)).toEqual([3, 4]);
    expect(contents[2].results.map((r: any) => r.id)).toEqual([5]);

    // Verify the search function was called with the expected pagination params
    expect(calls).toEqual([
      { limit: 2, offset: 0, order: 'desc' },
      { limit: 2, offset: 2, order: 'desc' },
      { limit: 2, offset: 4, order: 'desc' },
    ]);
  });
});
