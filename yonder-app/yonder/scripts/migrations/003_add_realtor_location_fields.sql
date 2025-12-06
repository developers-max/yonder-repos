-- Migration: Add realtor-provided accurate location fields
-- Date: 2025-11-25
-- Description: Add real_latitude, real_longitude, and real_address columns to enriched_plots_stage
--              These fields allow realtors to provide more accurate location data that remains
--              hidden from free plot information.

BEGIN;

-- Add new columns for realtor-provided accurate location data to stage table
ALTER TABLE enriched_plots_stage 
  ADD COLUMN IF NOT EXISTS real_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS real_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS real_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN enriched_plots_stage.real_latitude IS 'Realtor-provided accurate latitude (hidden from free users)';
COMMENT ON COLUMN enriched_plots_stage.real_longitude IS 'Realtor-provided accurate longitude (hidden from free users)';
COMMENT ON COLUMN enriched_plots_stage.real_address IS 'Realtor-provided accurate address (hidden from free users)';

-- Add check constraints to ensure valid coordinates when provided
ALTER TABLE enriched_plots_stage 
  ADD CONSTRAINT check_real_latitude CHECK (real_latitude IS NULL OR (real_latitude >= -90 AND real_latitude <= 90));

ALTER TABLE enriched_plots_stage 
  ADD CONSTRAINT check_real_longitude CHECK (real_longitude IS NULL OR (real_longitude >= -180 AND real_longitude <= 180));

-- ============================================================================
-- Recreate enriched_plots materialized view with new realtor location columns
-- ============================================================================

-- Drop the existing materialized view
DROP MATERIALIZED VIEW IF EXISTS enriched_plots;

-- Recreate with the new columns
CREATE MATERIALIZED VIEW enriched_plots AS
SELECT 
  id,
  latitude,
  longitude,
  environment,
  geom,
  price,
  size,
  enrichment_data,
  images,
  municipality_id,
  plot_report_url,
  plot_report_json,
  real_latitude,
  real_longitude,
  real_address
FROM enriched_plots_stage;

-- Recreate indexes on the materialized view
CREATE INDEX enriched_plots_geom_idx 
ON enriched_plots USING gist (geom);

CREATE INDEX idx_enriched_plots_size 
ON enriched_plots USING btree (size);

CREATE INDEX idx_enriched_plots_price 
ON enriched_plots USING btree (price);

CREATE INDEX idx_enriched_plots_enrichment_gin 
ON enriched_plots USING gin (enrichment_data);

CREATE INDEX idx_enriched_plots_municipality_id 
ON enriched_plots USING btree (municipality_id);

CREATE INDEX idx_enriched_plots_price_size 
ON enriched_plots USING btree (price, size) 
WHERE price IS NOT NULL AND size IS NOT NULL;

CREATE INDEX idx_enriched_plots_price_not_null 
ON enriched_plots USING btree (price) 
WHERE price IS NOT NULL;

CREATE INDEX idx_enriched_plots_size_not_null 
ON enriched_plots USING btree (size) 
WHERE size IS NOT NULL;

CREATE INDEX idx_enriched_plots_environment 
ON enriched_plots USING btree (environment);

COMMIT;
