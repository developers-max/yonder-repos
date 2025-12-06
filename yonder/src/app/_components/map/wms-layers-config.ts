/**
 * WMS Layer Configuration for Portugal
 * 
 * Sources:
 * - DGT (Direção-Geral do Território): https://www.dgterritorio.gov.pt
 * - DGADR (Direção-Geral de Agricultura e Desenvolvimento Rural): https://www.dgadr.gov.pt
 * - SNIT (Sistema Nacional de Informação Territorial): https://snig.dgterritorio.gov.pt
 */

export interface WMSLayerConfig {
  id: string;
  name: string;
  shortName: string;
  description: string;
  url: string;
  layers: string;
  opacity: number;
  color: string; // For legend/UI indicator
  provider: string;
  country: 'PT' | 'ES';
  legendUrl?: string; // WMS GetLegendGraphic URL
  unreliable?: boolean; // Mark layers that may timeout or be slow
  type?: 'raster' | 'vector'; // Layer type (default: raster for WMS)
  sourceLayer?: string; // For vector tiles: the layer name within the tile
}

// Portuguese Government WMS Layers
// Note: Only geo2.dgterritorio.gov.pt layers work because they support EPSG:3857 (Web Mercator)
// The SNIT services at servicos.dgterritorio.pt only support EPSG:3763 (PT-TM06) which Mapbox can't use
export const PT_WMS_LAYERS: Record<string, WMSLayerConfig> = {
  // Cadastro Predial - Property boundaries (NEW! Vector tiles from OGC API)
  cadastro: {
    id: 'cadastro',
    name: 'Cadastro Predial',
    shortName: 'Cadastre',
    description: 'Property boundaries from the Portuguese Land Registry (DGT)',
    url: 'https://ogcapi.dgterritorio.gov.pt/collections/cadastro/tiles/WebMercatorQuad/{z}/{y}/{x}?f=pbf',
    layers: 'cadastro',
    opacity: 0.7,
    color: '#dc2626', // Red
    provider: 'DGT',
    country: 'PT',
    type: 'vector',
    sourceLayer: 'mv_cadastralparcel_4326', // Layer name in the vector tile
    // SVG legend for vector tile layer (no server legend available)
    legendUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="30"><rect x="5" y="5" width="20" height="20" fill="#dc2626" fill-opacity="0.3" stroke="#dc2626" stroke-width="2"/><text x="32" y="20" font-family="Arial" font-size="12" fill="#333">Parcela Cadastral</text></svg>'),
  },

  // Administrative boundaries - Municipalities (CAOP 2024)
  caop: {
    id: 'caop',
    name: 'Limites Municipais (CAOP 2024)',
    shortName: 'Municipalities',
    description: 'Municipality boundaries from CAOP 2024',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=cont_municipios&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'cont_municipios',
    opacity: 0.7,
    color: '#3b82f6', // Blue
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms?request=GetLegendGraphic&format=image/png&layer=cont_municipios&width=25&height=25&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:14;dpi:120',
  },

  // Administrative boundaries - Parishes (CAOP 2024)
  parishes: {
    id: 'parishes',
    name: 'Limites de Freguesias (CAOP 2024)',
    shortName: 'Parishes',
    description: 'Parish boundaries from CAOP 2024',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=cont_freguesias&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'cont_freguesias',
    opacity: 0.6,
    color: '#6366f1', // Indigo
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms?request=GetLegendGraphic&format=image/png&layer=cont_freguesias&width=25&height=25&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:14;dpi:120',
  },

  // COS - Carta de Ocupação do Solo (Land Use/Land Cover) 2018
  cos: {
    id: 'cos',
    name: 'Carta de Ocupação do Solo (COS 2018)',
    shortName: 'Land Use',
    description: 'Land use and land cover classification',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/COS2018/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=COS2018:COS2018v2&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'COS2018:COS2018v2',
    opacity: 0.5,
    color: '#f97316', // Orange
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://geo2.dgterritorio.gov.pt/geoserver/COS2018/wms?request=GetLegendGraphic&format=image/png&layer=COS2018:COS2018v2&width=25&height=25&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:14;dpi:120',
  },

  // Corine Land Cover 2012 (latest available)
  clc: {
    id: 'clc',
    name: 'Corine Land Cover (CLC 2012)',
    shortName: 'CLC',
    description: 'European land cover classification',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/CLC/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=CLC2012&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'CLC2012',
    opacity: 0.5,
    color: '#8b5cf6', // Purple
    provider: 'DGT/EEA',
    country: 'PT',
    legendUrl: 'https://geo2.dgterritorio.gov.pt/geoserver/CLC/wms?request=GetLegendGraphic&format=image/png&layer=CLC2012&width=25&height=25&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:14;dpi:120',
  },

  // Districts (larger administrative regions)
  districts: {
    id: 'districts',
    name: 'Distritos',
    shortName: 'Districts',
    description: 'District boundaries (18 districts)',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=cont_distritos&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'cont_distritos',
    opacity: 0.6,
    color: '#10b981', // Emerald
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://geo2.dgterritorio.gov.pt/geoserver/caop_continente/wms?request=GetLegendGraphic&format=image/png&layer=cont_distritos&width=25&height=25&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:14;dpi:120',
  },

  // Built-up areas 2018
  builtup: {
    id: 'builtup',
    name: 'Áreas Edificadas (2018)',
    shortName: 'Built-up Areas',
    description: 'Urban and built-up areas',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/AE/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=AreasEdificadas2018&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'AreasEdificadas2018',
    opacity: 0.6,
    color: '#ef4444', // Red
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://geo2.dgterritorio.gov.pt/geoserver/AE/wms?request=GetLegendGraphic&format=image/png&layer=AreasEdificadas2018&width=25&height=25&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:14;dpi:120',
  },

  // Contour lines (elevation)
  contours: {
    id: 'contours',
    name: 'Curvas de Nível',
    shortName: 'Contours',
    description: 'Elevation contour lines',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/altimetria/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Curva_de_nivel&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'Curva_de_nivel',
    opacity: 0.7,
    color: '#a16207', // Amber/brown
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://geo2.dgterritorio.gov.pt/geoserver/altimetria/wms?request=GetLegendGraphic&format=image/png&layer=Curva_de_nivel&width=25&height=25&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:14;dpi:120',
  },

  // Orthophotos 2018 (aerial imagery)
  orthos: {
    id: 'orthos',
    name: 'Ortofotomapas (2018)',
    shortName: 'Aerial Photos',
    description: 'High-resolution aerial imagery',
    url: 'https://geo2.dgterritorio.gov.pt/geoserver/teste-ext/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Ortos2018-RGB&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'Ortos2018-RGB',
    opacity: 1.0,
    color: '#0ea5e9', // Sky blue
    provider: 'DGT',
    country: 'PT',
  },

  // =============================================================================
  // REN/RAN Municipal Layers
  // =============================================================================
  // These layers are served via /api/municipal-ren-ran endpoint which routes
  // to the appropriate municipal ArcGIS service based on the municipality parameter.
  // GIS endpoints are stored in the `portugal_municipalities` database table.
  // 
  // To add a new municipality:
  // 1. Find the municipal GIS portal (usually sig.cm-{name}.pt/arcgis)
  // 2. Locate the REN/RAN MapServer service and layer IDs
  // 3. Update the municipality record in the database with ren_service/ran_service
  // =============================================================================

  // REN - Reserva Ecológica Nacional (Sintra)
  ren_sintra: {
    id: 'ren_sintra',
    name: 'REN - Sintra',
    shortName: 'REN Sintra',
    description: 'Reserva Ecológica Nacional - Sintra',
    url: '/api/municipal-ren-ran?type=ren&municipality=sintra&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#22c55e', // Green
    provider: 'CM Sintra',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-sintra.pt/arcgis/rest/services/WMS_Inspire/WMS_SRUP_REN_CMS/MapServer/legend?f=json',
  },

  // RAN - Reserva Agrícola Nacional (Sintra)
  ran_sintra: {
    id: 'ran_sintra',
    name: 'RAN - Sintra',
    shortName: 'RAN Sintra',
    description: 'Reserva Agrícola Nacional - Sintra',
    url: '/api/municipal-ren-ran?type=ran&municipality=sintra&bbox={bbox-epsg-3857}',
    layers: 'ran',
    opacity: 0.6,
    color: '#eab308', // Yellow
    provider: 'CM Sintra',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-sintra.pt/arcgis/rest/services/WMS_Inspire/WMS_PDM20_Condicionantes/MapServer/legend?f=json&filter=RAN',
  },

  // REN - Reserva Ecológica Nacional (Seixal)
  ren_seixal: {
    id: 'ren_seixal',
    name: 'REN - Seixal',
    shortName: 'REN Seixal',
    description: 'Reserva Ecológica Nacional - Seixal',
    url: '/api/municipal-ren-ran?type=ren&municipality=seixal&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#16a34a', // Green variant
    provider: 'CM Seixal',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-seixal.pt/arcgis/rest/services/SERV_GEST_TERRITORIO_INTER/MapServer/legend?f=json&layer=662',
  },

  // REN - Reserva Ecológica Nacional (Loulé - Algarve)
  ren_loule: {
    id: 'ren_loule',
    name: 'REN - Loulé',
    shortName: 'REN Loulé',
    description: 'Reserva Ecológica Nacional - Loulé (Algarve)',
    url: '/api/municipal-ren-ran?type=ren&municipality=loul%C3%A9&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#15803d', // Green variant
    provider: 'CM Loulé',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://geoloule.cm-loule.pt/arcgisnprot/rest/services/MapasOnline/PMOT_vigor_COND_MO/MapServer/legend?f=json&filter=REN',
  },

  // RAN - Reserva Agrícola Nacional (Loulé - Algarve)
  ran_loule: {
    id: 'ran_loule',
    name: 'RAN - Loulé',
    shortName: 'RAN Loulé',
    description: 'Reserva Agrícola Nacional - Loulé (Algarve)',
    url: '/api/municipal-ren-ran?type=ran&municipality=loul%C3%A9&bbox={bbox-epsg-3857}',
    layers: 'ran',
    opacity: 0.6,
    color: '#ca8a04', // Yellow variant
    provider: 'CM Loulé',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://geoloule.cm-loule.pt/arcgisnprot/rest/services/MapasOnline/PMOT_vigor_COND_MO/MapServer/legend?f=json&filter=RAN',
  },

  // REN - Reserva Ecológica Nacional (Montijo)
  ren_montijo: {
    id: 'ren_montijo',
    name: 'REN - Montijo',
    shortName: 'REN Montijo',
    description: 'Reserva Ecológica Nacional - Montijo',
    url: '/api/municipal-ren-ran?type=ren&municipality=montijo&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#059669', // Green variant
    provider: 'CM Montijo',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://mtgeo.mun-montijo.pt/arcgis/rest/services/ORDENAMENTO/PDM/MapServer/legend?f=json&layer=67',
  },

  // RAN - Reserva Agrícola Nacional (Montijo)
  ran_montijo: {
    id: 'ran_montijo',
    name: 'RAN - Montijo',
    shortName: 'RAN Montijo',
    description: 'Reserva Agrícola Nacional - Montijo',
    url: '/api/municipal-ren-ran?type=ran&municipality=montijo&bbox={bbox-epsg-3857}',
    layers: 'ran',
    opacity: 0.6,
    color: '#d97706', // Yellow variant
    provider: 'CM Montijo',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://mtgeo.mun-montijo.pt/arcgis/rest/services/ORDENAMENTO/PDM/MapServer/legend?f=json&layer=68',
  },

  // REN - Reserva Ecológica Nacional (Ovar)
  ren_ovar: {
    id: 'ren_ovar',
    name: 'REN - Ovar',
    shortName: 'REN Ovar',
    description: 'Reserva Ecológica Nacional - Ovar',
    url: '/api/municipal-ren-ran?type=ren&municipality=ovar&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#059669',
    provider: 'CM Ovar',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://websig.cm-ovar.pt/arcgis/rest/services/2%C2%AA_AltPDM/MapServer/legend?f=json&layer=347',
  },

  // RAN - Reserva Agrícola Nacional (Ovar)
  ran_ovar: {
    id: 'ran_ovar',
    name: 'RAN - Ovar',
    shortName: 'RAN Ovar',
    description: 'Reserva Agrícola Nacional - Ovar',
    url: '/api/municipal-ren-ran?type=ran&municipality=ovar&bbox={bbox-epsg-3857}',
    layers: 'ran',
    opacity: 0.6,
    color: '#d97706',
    provider: 'CM Ovar',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://websig.cm-ovar.pt/arcgis/rest/services/2%C2%AA_AltPDM/MapServer/legend?f=json&layer=344',
  },

  // REN - Reserva Ecológica Nacional (Vizela)
  ren_vizela: {
    id: 'ren_vizela',
    name: 'REN - Vizela',
    shortName: 'REN Vizela',
    description: 'Reserva Ecológica Nacional - Vizela',
    url: '/api/municipal-ren-ran?type=ren&municipality=vizela&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#059669',
    provider: 'CM Vizela',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-vizela.pt/arcgis/rest/services/PlanoDiretorMunicipal_2013/MapServer/legend?f=json&layer=6',
  },

  // RAN - Reserva Agrícola Nacional (Vizela)
  ran_vizela: {
    id: 'ran_vizela',
    name: 'RAN - Vizela',
    shortName: 'RAN Vizela',
    description: 'Reserva Agrícola Nacional - Vizela',
    url: '/api/municipal-ren-ran?type=ran&municipality=vizela&bbox={bbox-epsg-3857}',
    layers: 'ran',
    opacity: 0.6,
    color: '#d97706',
    provider: 'CM Vizela',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-vizela.pt/arcgis/rest/services/PlanoDiretorMunicipal_2013/MapServer/legend?f=json&layer=8',
  },

  // REN - Reserva Ecológica Nacional (Coimbra)
  ren_coimbra: {
    id: 'ren_coimbra',
    name: 'REN - Coimbra',
    shortName: 'REN Coimbra',
    description: 'Reserva Ecológica Nacional - Coimbra',
    url: '/api/municipal-ren-ran?type=ren&municipality=coimbra&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#059669',
    provider: 'CM Coimbra',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-coimbra.pt/arcgis/rest/services/PDM_1994raster/MapServer/legend?f=json&layer=3',
  },

  // RAN - Reserva Agrícola Nacional (Coimbra)
  ran_coimbra: {
    id: 'ran_coimbra',
    name: 'RAN - Coimbra',
    shortName: 'RAN Coimbra',
    description: 'Reserva Agrícola Nacional - Coimbra',
    url: '/api/municipal-ren-ran?type=ran&municipality=coimbra&bbox={bbox-epsg-3857}',
    layers: 'ran',
    opacity: 0.6,
    color: '#d97706',
    provider: 'CM Coimbra',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-coimbra.pt/arcgis/rest/services/PDM_1994raster/MapServer/legend?f=json&layer=2',
  },

  // REN - Reserva Ecológica Nacional (Seia)
  ren_seia: {
    id: 'ren_seia',
    name: 'REN - Seia',
    shortName: 'REN Seia',
    description: 'Reserva Ecológica Nacional - Seia',
    url: '/api/municipal-ren-ran?type=ren&municipality=seia&bbox={bbox-epsg-3857}',
    layers: 'ren',
    opacity: 0.6,
    color: '#059669',
    provider: 'CM Seia',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-seia.pt/arcgis/rest/services/PC_RecursosNaturais/MapServer/legend?f=json&layer=37',
  },

  // RAN - Reserva Agrícola Nacional (Seia)
  ran_seia: {
    id: 'ran_seia',
    name: 'RAN - Seia',
    shortName: 'RAN Seia',
    description: 'Reserva Agrícola Nacional - Seia',
    url: '/api/municipal-ren-ran?type=ran&municipality=seia&bbox={bbox-epsg-3857}',
    layers: 'ran',
    opacity: 0.6,
    color: '#d97706',
    provider: 'CM Seia',
    country: 'PT',
    legendUrl: '/api/arcgis-legend?url=https://sig.cm-seia.pt/arcgis/rest/services/PC_RecursosNaturais/MapServer/legend?f=json&layer=3',
  },

};

// Spanish Government WMS Layers
export const ES_WMS_LAYERS: Record<string, WMSLayerConfig> = {
  // Cadastre - Property boundaries
  cadastre: {
    id: 'cadastre',
    name: 'Catastro',
    shortName: 'Cadastre',
    description: 'Property boundaries from the Spanish Cadastre',
    url: 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Catastro&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'Catastro',
    opacity: 0.7,
    color: '#6366f1', // Indigo
    provider: 'Catastro',
    country: 'ES',
  },
};

// Combined layers by country
export const WMS_LAYERS: Record<'PT' | 'ES', Record<string, WMSLayerConfig>> = {
  PT: PT_WMS_LAYERS,
  ES: ES_WMS_LAYERS,
};

// Get available layers for a country
export function getAvailableLayers(country: 'PT' | 'ES'): WMSLayerConfig[] {
  return Object.values(WMS_LAYERS[country]);
}

// Get a specific layer configuration
export function getLayerConfig(country: 'PT' | 'ES', layerId: string): WMSLayerConfig | undefined {
  return WMS_LAYERS[country][layerId];
}

// Default enabled layers
export const DEFAULT_ENABLED_LAYERS: Record<'PT' | 'ES', string[]> = {
  PT: ['cadastro', 'caop'], // Cadastre (vector tiles) + Admin boundaries enabled by default
  ES: ['cadastre'],
};
