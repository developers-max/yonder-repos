/**
 * Operations Index - Re-export all database operations
 */
export {
  upsertEnrichedPlot,
  upsertPlotMunicipality,
  getExistingEnrichmentDataMap,
  getPlotsByIds,
  type PlotInput,
} from './plots';

export {
  findPortugalMunicipalityByName,
  findPortugalMunicipalityByCaopId,
  findPortugalMunicipality,
} from './municipalities';
