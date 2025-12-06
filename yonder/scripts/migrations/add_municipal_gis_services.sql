-- Migration: Add GIS service fields to portugal_municipalities table for REN/RAN layers
-- This allows storing verified ArcGIS REST API endpoints for each municipality

-- Add GIS service columns to portugal_municipalities
ALTER TABLE portugal_municipalities 
ADD COLUMN IF NOT EXISTS gis_base_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS ren_service JSONB,
ADD COLUMN IF NOT EXISTS ran_service JSONB,
ADD COLUMN IF NOT EXISTS gis_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gis_last_checked TIMESTAMP WITH TIME ZONE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_portugal_municipalities_gis_verified 
ON portugal_municipalities(gis_verified) WHERE gis_verified = TRUE;

CREATE INDEX IF NOT EXISTS idx_portugal_municipalities_ren_gin 
ON portugal_municipalities USING gin(ren_service) WHERE ren_service IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portugal_municipalities_ran_gin 
ON portugal_municipalities USING gin(ran_service) WHERE ran_service IS NOT NULL;

-- Add comments explaining the JSONB structure
COMMENT ON COLUMN portugal_municipalities.ren_service IS 'REN service config: { url: string, layers?: string }';
COMMENT ON COLUMN portugal_municipalities.ran_service IS 'RAN service config: { url: string, layers?: string }';

-- Seed verified municipal GIS services
-- Sintra
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://sig.cm-sintra.pt/arcgis/rest/services',
  ren_service = '{"url": "https://sig.cm-sintra.pt/arcgis/rest/services/WMS_Inspire/WMS_SRUP_REN_CMS/MapServer/export", "layers": "all"}'::jsonb,
  ran_service = '{"url": "https://sig.cm-sintra.pt/arcgis/rest/services/WMS_Inspire/WMS_PDM20_Condicionantes/MapServer/export", "layers": "264"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'sintra';

-- Seixal
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://sig.cm-seixal.pt/arcgis/rest/services',
  ren_service = '{"url": "https://sig.cm-seixal.pt/arcgis/rest/services/SERV_GEST_TERRITORIO_INTER/MapServer/export", "layers": "662"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'seixal';

-- Loulé
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://geoloule.cm-loule.pt/arcgisnprot/rest/services',
  ren_service = '{"url": "https://geoloule.cm-loule.pt/arcgisnprot/rest/services/MapasOnline/PMOT_vigor_COND_MO/MapServer/export", "layers": "185"}'::jsonb,
  ran_service = '{"url": "https://geoloule.cm-loule.pt/arcgisnprot/rest/services/MapasOnline/PMOT_vigor_COND_MO/MapServer/export", "layers": "101"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'loulé' OR LOWER(name) = 'loule';

-- Montijo
UPDATE portugal_municipalities 
SET 
  gis_base_url = 'https://mtgeo.mun-montijo.pt/arcgis/rest/services',
  ren_service = '{"url": "https://mtgeo.mun-montijo.pt/arcgis/rest/services/ORDENAMENTO/PDM/MapServer/export", "layers": "67"}'::jsonb,
  ran_service = '{"url": "https://mtgeo.mun-montijo.pt/arcgis/rest/services/ORDENAMENTO/PDM/MapServer/export", "layers": "68"}'::jsonb,
  gis_verified = TRUE,
  gis_last_checked = NOW()
WHERE LOWER(name) = 'montijo';
