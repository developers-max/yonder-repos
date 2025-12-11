/**
 * Database Helpers - Re-exports from @yonder/persistence
 * 
 * This file re-exports database operations from the shared persistence package.
 * All new database operations should be added to @yonder/persistence, not here.
 * 
 * @deprecated Import directly from '@yonder/persistence'
 */

// Re-export everything from @yonder/persistence (includes connection, schema, and operations)
export {
  // Connection utilities
  getPgPool,
  getDrizzle,
  // Plot operations
  upsertEnrichedPlot,
  upsertPlotMunicipality,
  upsertEnrichedPlotWithMunicipality,
  getExistingEnrichmentDataMap,
  getPlotsByIds,
  fetchPlotsBatch,
  markPlotEnriched,
  type PlotInput,
  // Municipality operations
  findMunicipalityByName,
  upsertMunicipality,
  type MunicipalityInput,
} from '@yonder/persistence';
