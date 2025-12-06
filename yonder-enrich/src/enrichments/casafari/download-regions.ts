import * as path from 'path';
import { paginateCasafariSearchAndSave } from './pagination';
import { 
  searchPlotsForSalePortugal, 
  searchPlotsForSaleNiedersachsen, 
  searchPlotsForSaleAlella 
} from './index';

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'outputs', 'casafari-search');

/**
 * Download all plots for sale in Portugal
 * Stores data in: outputs/casafari-search/portugal/
 */
export async function downloadPortugalPlots(options?: {
  outDir?: string;
  startLimit?: number;
  startOffset?: number;
  startOrder?: 'asc' | 'desc';
}) {
  console.log('Starting download of Portugal plots...');
  const outDir = options?.outDir || DEFAULT_OUTPUT_DIR;
  
  const result = await paginateCasafariSearchAndSave({
    searchFn: searchPlotsForSalePortugal,
    outDir,
    countrySubdir: 'portugal',
    startLimit: options?.startLimit,
    startOffset: options?.startOffset,
    startOrder: options?.startOrder,
  });

  console.log(`✓ Portugal download complete: ${result.pages} pages, ${result.files.length} files`);
  console.log(`  Output directory: ${result.baseDir}`);
  return result;
}

/**
 * Download all plots for sale in Niedersachsen, Germany (Province ID: 532983)
 * Stores data in: outputs/casafari-search/germany/
 */
export async function downloadNiedersachsenPlots(options?: {
  outDir?: string;
  startLimit?: number;
  startOffset?: number;
  startOrder?: 'asc' | 'desc';
}) {
  console.log('Starting download of Niedersachsen (Germany) plots...');
  const outDir = options?.outDir || DEFAULT_OUTPUT_DIR;
  
  const result = await paginateCasafariSearchAndSave({
    searchFn: searchPlotsForSaleNiedersachsen,
    outDir,
    countrySubdir: 'germany',
    startLimit: options?.startLimit,
    startOffset: options?.startOffset,
    startOrder: options?.startOrder,
  });

  console.log(`✓ Niedersachsen download complete: ${result.pages} pages, ${result.files.length} files`);
  console.log(`  Output directory: ${result.baseDir}`);
  return result;
}

/**
 * Download all plots for sale in Alella, Spain (Province ID: 10300)
 * Stores data in: outputs/casafari-search/spain/
 */
export async function downloadAlellaPlots(options?: {
  outDir?: string;
  startLimit?: number;
  startOffset?: number;
  startOrder?: 'asc' | 'desc';
}) {
  console.log('Starting download of Alella (Spain) plots...');
  const outDir = options?.outDir || DEFAULT_OUTPUT_DIR;
  
  const result = await paginateCasafariSearchAndSave({
    searchFn: searchPlotsForSaleAlella,
    outDir,
    countrySubdir: 'spain',
    startLimit: options?.startLimit,
    startOffset: options?.startOffset,
    startOrder: options?.startOrder,
  });

  console.log(`✓ Alella download complete: ${result.pages} pages, ${result.files.length} files`);
  console.log(`  Output directory: ${result.baseDir}`);
  return result;
}

/**
 * Download plots for all three regions sequentially
 */
export async function downloadAllRegions(options?: {
  outDir?: string;
  startLimit?: number;
  startOffset?: number;
  startOrder?: 'asc' | 'desc';
}) {
  console.log('='.repeat(60));
  console.log('Starting downloads for all regions...');
  console.log('='.repeat(60));

  const results = {
    portugal: await downloadPortugalPlots(options),
    germany: await downloadNiedersachsenPlots(options),
    spain: await downloadAlellaPlots(options),
  };

  console.log('='.repeat(60));
  console.log('All downloads complete!');
  console.log(`Total pages: ${results.portugal.pages + results.germany.pages + results.spain.pages}`);
  console.log(`Total files: ${results.portugal.files.length + results.germany.files.length + results.spain.files.length}`);
  console.log('='.repeat(60));

  return results;
}
