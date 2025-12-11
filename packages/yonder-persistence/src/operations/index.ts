/**
 * Operations Index - Re-export all database operations
 * 
 * All database operations should be defined here and imported from @yonder/persistence
 * by both yonder-app and yonder-enrich.
 */

// Plot Operations
export {
  upsertEnrichedPlot,
  upsertPlotMunicipality,
  upsertEnrichedPlotWithMunicipality,
  getExistingEnrichmentDataMap,
  getPlotsByIds,
  fetchPlotsBatch,
  markPlotEnriched,
  type PlotInput,
} from './plots';

// Municipality Operations
export {
  // Generic municipality operations
  findMunicipalityByName,
  upsertMunicipality,
  type MunicipalityInput,
  // Portugal-specific operations
  findPortugalMunicipalityByName,
  findPortugalMunicipalityByCaopId,
  findPortugalMunicipality,
} from './municipalities';
