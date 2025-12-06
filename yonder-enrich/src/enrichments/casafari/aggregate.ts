import * as fs from 'fs';
import * as path from 'path';

/**
 * Aggregate all page files for a given Casafari search run (identified by timestamp `ts`).
 * Produces a single aggregated JSON containing concatenated `results` and metadata.
 * Returns the path to the aggregated output file.
 */
export async function aggregateCasafariSearchPages(baseDir: string, ts: string): Promise<string> {
  const prefix = `casafari-search_${ts}_page`;
  const files = fs
    .readdirSync(baseDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'));

  if (files.length === 0) {
    throw new Error(`No page files found to aggregate for timestamp ${ts} in ${baseDir}`);
  }

  const pageNum = (name: string) => {
    const m = name.match(/_page(\d+)_/);
    return m ? parseInt(m[1], 10) : 0;
  };

  files.sort((a, b) => pageNum(a) - pageNum(b));

  const aggregatedResults: any[] = [];
  for (const file of files) {
    try {
      const fullPath = path.join(baseDir, file);
      const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const pageResults = Array.isArray(json?.results) ? json.results : [];
      aggregatedResults.push(...pageResults);
    } catch (e) {
      console.warn(`Skipping unreadable or invalid JSON file during aggregation: ${file}`, e);
    }
  }

  const aggregated = {
    aggregated_at: new Date().toISOString(),
    pages: files.length,
    files,
    total_results: aggregatedResults.length,
    results: aggregatedResults,
  };

  const outName = `casafari-search_${ts}_aggregated.json`;
  const outPath = path.join(baseDir, outName);
  fs.writeFileSync(outPath, JSON.stringify(aggregated, null, 2), 'utf-8');
  return outPath;
}
