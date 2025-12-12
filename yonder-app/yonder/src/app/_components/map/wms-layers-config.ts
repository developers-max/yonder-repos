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
  type?: 'raster' | 'vector' | 'geojson'; // Layer type (default: raster for WMS)
  sourceLayer?: string; // For vector tiles: the layer name within the tile
}

// Portuguese Government WMS Layers
// Note: Only geo2.dgterritorio.gov.pt layers work because they support EPSG:3857 (Web Mercator)
// The SNIT services at servicos.dgterritorio.pt only support EPSG:3763 (PT-TM06) which Mapbox can't use
export const PT_WMS_LAYERS: Record<string, WMSLayerConfig> = {
  // Cadastro Predial - Property boundaries (WMS from SNIC GeoServer)
  // Note: OGC API vector tiles at ogcapi.dgterritorio.gov.pt return empty - using WMS instead
  cadastro: {
    id: 'cadastro',
    name: 'Cadastro Predial',
    shortName: 'Cadastre',
    description: 'Property boundaries (DGT)',
    url: 'https://snicws.dgterritorio.gov.pt/geoserver/inspire/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=cadastralparcel&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'cadastralparcel',
    opacity: 0.7,
    color: '#1a1a1a', // Black (matches WMS default style)
    provider: 'DGT',
    country: 'PT',
    // SVG legend for cadastre layer (black to match WMS style)
    legendUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="30"><rect x="5" y="5" width="20" height="20" fill="none" stroke="#1a1a1a" stroke-width="2"/><text x="32" y="20" font-family="Arial" font-size="12" fill="#333">Parcela Cadastral</text></svg>'),
  },

  // CRUS - Carta do Regime de Uso do Solo (Municipal Zoning - PDM)
  // Dynamic layer that shows zoning data for the current municipality via GeoJSON API
  crus: {
    id: 'crus',
    name: 'CRUS (Zonamento PDM)',
    shortName: 'CRUS',
    description: 'Zonamento municipal (PDM)',
    url: '/api/crus-tiles', // GeoJSON API endpoint
    layers: 'crus',
    opacity: 0.6,
    color: '#8b5cf6', // Purple
    provider: 'DGT',
    country: 'PT',
    type: 'geojson', // Uses GeoJSON, not vector tiles
    // SVG legend showing CRUS land use classes
    legendUrl: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="140">
      <text x="5" y="15" font-family="Arial" font-size="11" font-weight="bold" fill="#333">Classificação CRUS</text>
      <rect x="5" y="25" width="16" height="12" fill="#e74c3c" fill-opacity="0.6"/><text x="26" y="35" font-family="Arial" font-size="10" fill="#333">Solo Urbano</text>
      <rect x="5" y="42" width="16" height="12" fill="#f39c12" fill-opacity="0.6"/><text x="26" y="52" font-family="Arial" font-size="10" fill="#333">Solo Urbanizável</text>
      <rect x="5" y="59" width="16" height="12" fill="#27ae60" fill-opacity="0.6"/><text x="26" y="69" font-family="Arial" font-size="10" fill="#333">Solo Rural</text>
      <rect x="5" y="76" width="16" height="12" fill="#2ecc71" fill-opacity="0.6"/><text x="26" y="86" font-family="Arial" font-size="10" fill="#333">Espaço Agrícola</text>
      <rect x="5" y="93" width="16" height="12" fill="#16a085" fill-opacity="0.6"/><text x="26" y="103" font-family="Arial" font-size="10" fill="#333">Espaço Florestal</text>
      <rect x="5" y="110" width="16" height="12" fill="#1abc9c" fill-opacity="0.6"/><text x="26" y="120" font-family="Arial" font-size="10" fill="#333">Espaço Natural</text>
    </svg>`),
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
  // REN/RAN National Layers (DGT SRUP WMS)
  // =============================================================================
  // These layers cover all of Portugal from DGT's national SRUP services.
  // They support EPSG:3857 (Web Mercator) and work directly with Mapbox.
  // Single layer option that works everywhere - no need to select per municipality.
  // =============================================================================

  // REN - Reserva Ecológica Nacional (covers all of Portugal)
  ren: {
    id: 'ren',
    name: 'REN (Reserva Ecológica)',
    shortName: 'REN',
    description: 'Proteção ecológica - restrições',
    url: '/api/wms-proxy?source=pt-ren&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=REN_em_Vigor&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'REN_em_Vigor',
    opacity: 0.6,
    color: '#22c55e', // Green
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://servicos.dgterritorio.pt/SDISNITWMSSRUP_REN_PT1/service.svc/get?VERSION=1.3.0&REQUEST=getlegendgraphic&SERVICE=WMS&format=image/png&layer=REN_em_Vigor&style=Default',
  },

  // RAN - Reserva Agrícola Nacional (covers all of Portugal)
  ran: {
    id: 'ran',
    name: 'RAN (Reserva Agrícola)',
    shortName: 'RAN',
    description: 'Reserva agrícola - restrições',
    url: '/api/wms-proxy?source=pt-ran&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Reserva_Agricola_Nacional&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    layers: 'Reserva_Agricola_Nacional',
    opacity: 0.6,
    color: '#eab308', // Yellow
    provider: 'DGT',
    country: 'PT',
    legendUrl: 'https://servicos.dgterritorio.pt/SDISNITWMSSRUP_RAN_PT1/service.svc/get?VERSION=1.3.0&REQUEST=getlegendgraphic&SERVICE=WMS&format=image/png&layer=Reserva_Agricola_Nacional&style=Default',
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
  PT: ['plots', 'cadastro', 'caop'], // Plots + Cadastre + Admin boundaries enabled by default
  ES: ['plots', 'cadastre'],
};

// Special "plots" layer config (not a WMS layer, but allows toggling plot markers)
export const PLOTS_LAYER_CONFIG: WMSLayerConfig = {
  id: 'plots',
  name: 'Land For Sale',
  shortName: 'Land for Sale',
  description: 'Property listings',
  url: '', // Not used - plots are rendered from database
  layers: '',
  opacity: 1,
  color: '#3b82f6', // Blue
  provider: 'Yonder',
  country: 'PT',
  type: 'geojson',
  legendUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><rect x="5" y="5" width="40" height="18" rx="4" fill="white" stroke="#e5e7eb"/><text x="10" y="18" font-family="Arial" font-size="10" font-weight="bold" fill="#111">€Price</text><polygon points="25,23 22,28 28,28" fill="white"/></svg>'),
};
