import * as path from 'path';
import { loadPlotsFromOutputs } from './plots_loader';

const DEFAULT_CASAFARI_SEARCH_DIR = path.resolve(process.cwd(), 'outputs', 'casafari-search');

/**
 * Load plots from Portugal outputs into staging table
 */
export async function loadPortugalPlots(options?: { baseDir?: string }) {
  const dir = options?.baseDir 
    ? path.join(options.baseDir, 'portugal')
    : path.join(DEFAULT_CASAFARI_SEARCH_DIR, 'portugal');
  
  console.log('Loading Portugal plots from:', dir);
  await loadPlotsFromOutputs(dir, { country: 'PT' });
}

/**
 * Load plots from Spain outputs into staging table
 */
export async function loadSpainPlots(options?: { baseDir?: string }) {
  const dir = options?.baseDir 
    ? path.join(options.baseDir, 'spain')
    : path.join(DEFAULT_CASAFARI_SEARCH_DIR, 'spain');
  
  console.log('Loading Spain plots from:', dir);
  await loadPlotsFromOutputs(dir, { country: 'ES' });
}

/**
 * Load plots from Germany outputs into staging table
 */
export async function loadGermanyPlots(options?: { baseDir?: string }) {
  const dir = options?.baseDir 
    ? path.join(options.baseDir, 'germany')
    : path.join(DEFAULT_CASAFARI_SEARCH_DIR, 'germany');
  
  console.log('Loading Germany plots from:', dir);
  await loadPlotsFromOutputs(dir, { country: 'DE' });
}

/**
 * Load plots from all countries (Portugal, Spain, Germany) into staging table
 * This loads all countries sequentially and appends to the staging table
 */
export async function loadAllCountriesPlots(options?: { baseDir?: string }) {
  console.log('='.repeat(60));
  console.log('Loading plots from all countries...');
  console.log('='.repeat(60));

  const baseDir = options?.baseDir || DEFAULT_CASAFARI_SEARCH_DIR;
  
  // Load all countries - the first one will truncate, subsequent ones append
  console.log('\n1/3 Loading Portugal plots...');
  await loadPlotsFromOutputs(path.join(baseDir, 'portugal'), { truncate: true, country: 'PT' });
  
  console.log('\n2/3 Loading Spain plots...');
  await loadPlotsFromOutputs(path.join(baseDir, 'spain'), { truncate: false, country: 'ES' });
  
  console.log('\n3/3 Loading Germany plots...');
  await loadPlotsFromOutputs(path.join(baseDir, 'germany'), { truncate: false, country: 'DE' });

  console.log('\n' + '='.repeat(60));
  console.log('All countries loaded successfully!');
  console.log('='.repeat(60));
}
