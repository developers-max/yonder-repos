/**
 * Schema Index - Re-export all schema definitions
 */

// Plots
export {
  plots,
  enrichedPlots,
  plotsStage,
  enrichedPlotsStage,
  type Plot,
  type NewPlot,
  type EnrichedPlot,
  type NewEnrichedPlot,
} from "./plots";

// Municipalities
export {
  municipalities,
  portugalMunicipalities,
  portugalParishes,
  pdmDocumentEmbeddings,
  regulations,
  type Municipality,
  type NewMunicipality,
  type PortugalMunicipality,
  type NewPortugalMunicipality,
  type PortugalParish,
  type NewPortugalParish,
  type PDMDocumentEmbedding,
  type NewPDMDocumentEmbedding,
  type Regulation,
  type NewRegulation,
  type GISServiceConfig,
  type PDMDocuments,
} from "./municipalities";

// Casafari
export {
  rawCasafariBubblePlots,
  plotFetchLogs,
  type RawCasafariBubblePlot,
  type NewRawCasafariBubblePlot,
  type PlotFetchLog,
  type NewPlotFetchLog,
} from "./casafari";

// Realtors
export {
  ensureRealtorsTable,
  ensurePlotsStageRealtorsJoinTable,
  type SqlClient,
  type Realtor,
  type PlotRealtorJoin,
} from "./realtors";
