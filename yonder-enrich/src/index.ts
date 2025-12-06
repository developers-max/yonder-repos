#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
// Note: Do not statically import enrichment modules here to avoid side effects on import.
// We will lazy-load them via dynamic imports in the switch statement.
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Type representing the available enrichment options
 */
type EnrichmentType = 'amenities' | 'climate' | 'population' | 'municipalities' | 'combined' | 'casafari' | 'casafari-search' | 'crus-zoning' | 'casafari-realtors' | 'llm-realtors' | 'llm-municipalities' | 'pdm-embeddings' | 'crus-translate' | 'plots-loader' | 'plots-realtors' | 'images' | 'sync-price-size' | 'plot-search' | 'plots-loader-country' | 'spain-zoning' | 'spain-cadastre' | 'portugal-cadastre' | 'germany-zoning';

/**
 * Creates a CLI interface to prompt the user for selecting an enrichment type
 */
async function promptForEnrichmentType(): Promise<EnrichmentType> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\nYonder Enrichment\n');
    console.log('Available enrichment types:');
    console.log('1. Amenities (restaurants, supermarkets, etc)');
    console.log('2. Climate (temperature, rainfall, etc)');
    console.log('3. Population (density, demographics, etc)');
    console.log('4. Municipalities (link plots to municipalities)');
    console.log('5. Combined (amenities + municipalities together - RECOMMENDED)');
    console.log('6. Casafari property details (requires property ID)');
    console.log('7. Casafari search: PT plots for sale (urban and rural)');
    console.log('8. CRUS zoning (Portugal DGT CRUS via OGC API)');
    console.log('9. Casafari realtor companies (extract from saved outputs)');
    console.log('10. LLM enrichment: find realtor websites/emails (Gemini)');
    console.log('11. CRUS: translate existing zoning labels (LLM)');
    console.log('12. Plots loader (load outputs into staging table)');
    console.log('13. Plot-Realtor links (plots_stage -> realtors)');
    console.log('14. Images (populate enriched_plots_stage.images from outputs)');
    console.log('15. Sync size/price (plots_stage -> enriched_plots_stage)');
    console.log('16. Spain zoning (Regional WFS via Autonomous Communities)');
    console.log('17. Spain cadastre (Catastro - parcels, buildings, cadastral references)');
    console.log('18. Germany zoning (State/Länder WFS - Bebauungspläne)');
    console.log('19. LLM enrichment: find municipality websites, country codes, PDM documents (Gemini)');
    console.log('20. PDM document embeddings (OpenAI + pgvector)');
    
    rl.question('\nSelect a type of enrichment (1-20): ', (answer) => {
      rl.close();
      
      switch(answer.trim()) {
        case '1':
          resolve('amenities');
          break;
        case '2':
          resolve('climate');
          break;
        case '3':
          resolve('population');
          break;
        case '4':
          resolve('municipalities');
          break;
        case '5':
          resolve('combined');
          break;
        case '6':
          resolve('casafari');
          break;
        case '7':
          resolve('casafari-search');
          break;
        case '8':
          resolve('crus-zoning');
          break;
        case '9':
          resolve('casafari-realtors');
          break;
        case '10':
          resolve('llm-realtors');
          break;
        case '11':
          resolve('crus-translate');
          break;
        case '12':
          resolve('plots-loader');
          break;
        case '13':
          resolve('plots-realtors');
          break;
        case '14':
          resolve('images');
          break;
        case '15':
          resolve('sync-price-size');
          break;
        case '16':
          resolve('spain-zoning');
          break;
        case '17':
          resolve('spain-cadastre');
          break;
        case '18':
          resolve('germany-zoning');
          break;
        case '19':
          resolve('llm-municipalities');
          break;
        case '20':
          resolve('pdm-embeddings');
          break;
        default:
          console.log('Invalid selection, defaulting to combined.');
          resolve('combined');
      }
    });
  });
}

/**
 * Prompt the user for a Casafari property ID if not provided as an argument.
 */
async function promptForPropertyId(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter Casafari property ID: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main entry point for the application
 */
async function main() {
  try {
    const enrichmentType = process.argv[2] as EnrichmentType || await promptForEnrichmentType();
    
    console.log(`Starting enrichment process: ${enrichmentType}`);
    
    switch(enrichmentType) {
      case 'amenities': {
        const { enrichAmenities } = await import('./enrichments/amenities');
        await enrichAmenities();
        break;
      }
      case 'climate': {
        const { enrichClimate } = await import('./enrichments/climate');
        await enrichClimate();
        break;
      }
      case 'population': {
        const { enrichPopulation } = await import('./enrichments/population');
        await enrichPopulation();
        break;
      }
      case 'municipalities': {
        const { enrichMunicipalities } = await import('./enrichments/municipalities');
        const country = process.argv[3]?.toUpperCase(); // e.g., 'ES', 'PT', 'DE'
        const forceRefresh = process.argv[4]?.toLowerCase() === 'force' || process.argv[4]?.toLowerCase() === 'refresh';
        await enrichMunicipalities({ country, forceRefresh });
        break;
      }
      case 'combined': {
        const { enrichCombined } = await import('./enrichments/combined');
        await enrichCombined();
        break;
      }
      case 'casafari': {
        const propertyIdArg = process.argv[3];
        const propertyId = propertyIdArg || await promptForPropertyId();
        if (!propertyId) {
          console.error('No property ID provided.');
          process.exit(1);
        }
        //const { fetchCasafariProperty } = await import('./enrichments/casafari');
        //const data = await fetchCasafariProperty(propertyId);
        //console.log(JSON.stringify(data, null, 2));
        break;
      }
      case 'casafari-search': {
        const { searchPlotsForSalePortugal } = await import('./enrichments/casafari');
        const limitArg = parseInt(process.argv[3] || '', 10);
        const offsetArg = parseInt(process.argv[4] || '', 10);

        // Prepare output directory and timestamp prefix once
        const baseDir = path.resolve(process.cwd(), 'outputs', 'casafari-search');
        fs.mkdirSync(baseDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');

        // Pagination state
        let page = 1;
        let nextLimit = Number.isFinite(limitArg) ? limitArg : 500; // default to larger page size for efficiency
        let nextOffset = Number.isFinite(offsetArg) ? offsetArg : 0;
        let nextOrder: 'asc' | 'desc' | undefined = 'desc';
        const seen = new Set<string>();

        // Helper to build a unique key for cycles protection
        const pageKey = (limit: number, offset: number, order?: 'asc' | 'desc') => `${limit}|${offset}|${order || ''}`;

        // Iterate through all pages until the API indicates there is no next page
        while (true) {
          const key = pageKey(nextLimit, nextOffset, nextOrder);
          if (seen.has(key)) {
            console.warn(`Detected repeated pagination key ${key}. Stopping to avoid infinite loop.`);
            break;
          }
          seen.add(key);

      const data = await searchPlotsForSalePortugal({
        limit: nextLimit,
        offset: nextOffset,
        order: nextOrder,
      });

      // Persist each page to its own file
      try {
        const fileName = `casafari-search_${ts}_page${page}_limit${nextLimit}_offset${nextOffset}.json`;
        const filePath = path.join(baseDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        const resultsCount = Array.isArray((data as any)?.results) ? (data as any).results.length : 0;
        console.log(`Saved Casafari search page ${page} (${resultsCount} results) to: ${filePath}`);
      } catch (e) {
        console.error('Failed to save Casafari search results to file:', e);
      }

      // Determine if there is a next page
      const nextUrl: string | undefined = (data as any)?.next || undefined;
      if (!nextUrl) {
        break; // no further pages
      }

      // Extract pagination params from the next URL without relying on global URL availability
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

    // Aggregate all pages from this run into a single file
    try {
      const { aggregateCasafariSearchPages } = await import('./enrichments/casafari/aggregate');
      const aggregatedPath = await aggregateCasafariSearchPages(baseDir, ts);
      console.log(`Saved aggregated Casafari search results to: ${aggregatedPath}`);
    } catch (e) {
      console.error('Failed to aggregate Casafari search results:', e);
    }
        break;
      }
      case 'crus-zoning': {
        const { enrichCRUSZoning } = await import('./enrichments/crus');
        await enrichCRUSZoning();
        break;
      }
      case 'spain-zoning': {
        const { enrichSpanishZoning } = await import('./enrichments/spain-zoning');
        await enrichSpanishZoning();
        break;
      }
      case 'spain-cadastre': {
        const { enrichSpanishCadastre } = await import('./enrichments/spain-cadastre');
        await enrichSpanishCadastre();
        break;
      }
      case 'portugal-cadastre': {
        const { enrichPortugalCadastre } = await import('./enrichments/portugal-cadastre');
        await enrichPortugalCadastre();
        break;
      }
      case 'germany-zoning': {
        const { runGermanyZoningEnrichment } = await import('./enrichments/germany-zoning');
        await runGermanyZoningEnrichment();
        break;
      }
      case 'casafari-realtors': {
        const { extractAndStoreRealtorsFromCasafariOutputs } = await import('./enrichments/casafari/realtors');
        const dirArg = process.argv[3];
        await extractAndStoreRealtorsFromCasafariOutputs(dirArg);
        break;
      }
      case 'llm-realtors': {
        const { enrichRealtorsWithGemini } = await import('./llm/realtors');
        const limit = process.env.LLM_REALTORS_LIMIT ? Number(process.env.LLM_REALTORS_LIMIT) : undefined;
        const concurrency = process.env.LLM_REALTORS_CONCURRENCY ? Number(process.env.LLM_REALTORS_CONCURRENCY) : undefined;
        await enrichRealtorsWithGemini({ limit, concurrency });
        break;
      }
      case 'llm-municipalities': {
        const { enrichMunicipalitiesWithGemini } = await import('./llm/municipalities');
        const limit = process.env.LLM_MUNICIPALITIES_LIMIT ? Number(process.env.LLM_MUNICIPALITIES_LIMIT) : undefined;
        const concurrency = process.env.LLM_MUNICIPALITIES_CONCURRENCY ? Number(process.env.LLM_MUNICIPALITIES_CONCURRENCY) : undefined;
        await enrichMunicipalitiesWithGemini({ limit, concurrency });
        break;
      }
      case 'pdm-embeddings': {
        const { enrichPDMDocumentsWithEmbeddings } = await import('./enrichments/pdm-embeddings');
        await enrichPDMDocumentsWithEmbeddings();
        break;
      }
      case 'crus-translate': {
        const { translateExistingCRUSLabels } = await import('./enrichments/crus/translate_existing');
        await translateExistingCRUSLabels();
        break;
      }
      case 'plots-loader': {
        const { loadPlotsFromOutputs } = await import('./etl/plots_loader');
        const dirArg = process.argv[3];
        await loadPlotsFromOutputs(dirArg);
        break;
      }
      case 'plots-realtors': {
        const { linkPlotsToRealtorsFromOutputs } = await import('./etl/plots_realtors');
        const dirArg = process.argv[3];
        await linkPlotsToRealtorsFromOutputs(dirArg);
        break;
      }
      case 'images': {
        const { enrichImagesFromOutputs } = await import('./enrichments/images');
        const dirArg = process.argv[3];
        await enrichImagesFromOutputs(dirArg);
        break;
      }
      case 'sync-price-size': {
        const { syncPriceSize } = await import('./enrichments/sync_price_size');
        await syncPriceSize();
        break;
      }
      case 'plot-search': {
        const country = process.argv[3]?.toLowerCase();
        if (!country || !['portugal', 'spain', 'germany'].includes(country)) {
          console.error('Error: plot-search requires a country argument: portugal, spain, or germany');
          console.error('Usage: npm run plot-search-portugal (or plot-search-spain, plot-search-germany)');
          process.exit(1);
        }

        const { downloadPortugalPlots, downloadNiedersachsenPlots, downloadAlellaPlots } = await import('./enrichments/casafari/download-regions');
        
        console.log(`Starting plot search for ${country}...`);
        
        switch (country) {
          case 'portugal':
            await downloadPortugalPlots();
            break;
          case 'spain':
            await downloadAlellaPlots();
            break;
          case 'germany':
            await downloadNiedersachsenPlots();
            break;
        }
        break;
      }
      case 'plots-loader-country': {
        const country = process.argv[3]?.toLowerCase();
        if (!country || !['portugal', 'spain', 'germany', 'all'].includes(country)) {
          console.error('Error: plots-loader-country requires a country argument: portugal, spain, germany, or all');
          console.error('Usage: npm run plots-load-portugal (or plots-load-spain, plots-load-germany, plots-load-all)');
          process.exit(1);
        }

        const { loadPortugalPlots, loadSpainPlots, loadGermanyPlots, loadAllCountriesPlots } = await import('./etl/plots_loader_countries');
        
        console.log(`Loading plots from ${country}...`);
        
        switch (country) {
          case 'portugal':
            await loadPortugalPlots();
            break;
          case 'spain':
            await loadSpainPlots();
            break;
          case 'germany':
            await loadGermanyPlots();
            break;
          case 'all':
            await loadAllCountriesPlots();
            break;
        }
        break;
      }
      default:
        console.error(`Unknown enrichment type: ${enrichmentType}`);
        process.exit(1);
        
      }
    console.log('Enrichment process complete!');
  } catch (error) {
    console.error('Error in enrichment process:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}