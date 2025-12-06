-- Additional verified REN/RAN municipal services
-- Discovered via automated scan + manual verification

-- Ovar (Aveiro district)
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://websig.cm-ovar.pt/arcgis/rest/services',
  ren_service = '{"url": "https://websig.cm-ovar.pt/arcgis/rest/services/2ª_AltPDM/MapServer/export", "layers": "347"}'::jsonb,
  ran_service = '{"url": "https://websig.cm-ovar.pt/arcgis/rest/services/2ª_AltPDM/MapServer/export", "layers": "344"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'ovar';

-- Vizela (Braga district)
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://sig.cm-vizela.pt/arcgis/rest/services',
  ren_service = '{"url": "https://sig.cm-vizela.pt/arcgis/rest/services/PlanoDiretorMunicipal_2013/MapServer/export", "layers": "6"}'::jsonb,
  ran_service = '{"url": "https://sig.cm-vizela.pt/arcgis/rest/services/PlanoDiretorMunicipal_2013/MapServer/export", "layers": "8"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'vizela';

-- Coimbra (Coimbra district)
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://sig.cm-coimbra.pt/arcgis/rest/services',
  ren_service = '{"url": "https://sig.cm-coimbra.pt/arcgis/rest/services/PDM_1994raster/MapServer/export", "layers": "3"}'::jsonb,
  ran_service = '{"url": "https://sig.cm-coimbra.pt/arcgis/rest/services/PDM_1994raster/MapServer/export", "layers": "2"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'coimbra';

-- Seia (Guarda district)
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://sig.cm-seia.pt/arcgis/rest/services',
  ren_service = '{"url": "https://sig.cm-seia.pt/arcgis/rest/services/PC_RecursosNaturais/MapServer/export", "layers": "37"}'::jsonb,
  ran_service = '{"url": "https://sig.cm-seia.pt/arcgis/rest/services/PC_RecursosNaturais/MapServer/export", "layers": "3"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'seia';
