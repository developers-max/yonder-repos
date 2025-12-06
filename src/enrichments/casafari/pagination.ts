import * as fs from 'fs';
import * as path from 'path';

export type Order = 'asc' | 'desc';

export type SearchFn = (options: { limit?: number; offset?: number; order?: Order }) => Promise<any>;

export interface PaginationRunResult {
  ts: string;
  baseDir: string;
  pages: number;
  files: string[];
}

/**
 * Paginates Casafari search using the provided search function and writes each page to a file.
 * Returns metadata about the run including the timestamp prefix and file list.
 */
export async function paginateCasafariSearchAndSave(params: {
  searchFn: SearchFn;
  outDir: string; // e.g., outputs/casafari-search
  startLimit?: number;
  startOffset?: number;
  startOrder?: Order;
  countrySubdir?: string; // e.g., 'portugal', 'germany', 'spain'
}): Promise<PaginationRunResult> {
  const { searchFn, outDir, countrySubdir } = params;
  let nextLimit = params.startLimit ?? 500;
  let nextOffset = params.startOffset ?? 0;
  let nextOrder: Order | undefined = params.startOrder ?? 'desc';

  // Prepare output directory and timestamp prefix once
  const baseDir = countrySubdir ? path.resolve(outDir, countrySubdir) : path.resolve(outDir);
  fs.mkdirSync(baseDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  const files: string[] = [];
  const seen = new Set<string>();
  const pageKey = (limit: number, offset: number, order?: Order) => `${limit}|${offset}|${order || ''}`;
  let page = 1;

  while (true) {
    const key = pageKey(nextLimit, nextOffset, nextOrder);
    if (seen.has(key)) {
      console.warn(`Detected repeated pagination key ${key}. Stopping to avoid infinite loop.`);
      break;
    }
    seen.add(key);

    const data = await searchFn({ limit: nextLimit, offset: nextOffset, order: nextOrder });

    // Persist each page to its own file
    const fileName = `casafari-search_${ts}_page${page}_limit${nextLimit}_offset${nextOffset}.json`;
    const filePath = path.join(baseDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    files.push(filePath);

    const nextUrl: string | undefined = (data as any)?.next || undefined;
    if (!nextUrl) {
      break; // no further pages
    }

    // Extract pagination params from the next URL
    try {
      const queryString = nextUrl.split('?')[1] || '';
      const params = new URLSearchParams(queryString);
      const lStr = params.get('limit');
      const oStr = params.get('offset');
      const ordStr = params.get('order');
      if (lStr) nextLimit = parseInt(lStr, 10);
      if (oStr) nextOffset = parseInt(oStr, 10);
      if (ordStr === 'asc' || ordStr === 'desc') nextOrder = ordStr;
    } catch (e) {
      console.error('Failed to parse next page URL; stopping pagination. URL:', nextUrl, e);
      break;
    }

    page += 1;
  }

  return { ts, baseDir, pages: files.length, files };
}
