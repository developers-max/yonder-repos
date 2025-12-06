-- Migration: Add regulations table, plot_report field, and valid_email flag
-- Date: 2025-11-11
-- Description: 
--   1. Creates regulations table for storing municipality regulation documents
--   2. Adds plot_report field to enriched_plots and enriched_plots_stage tables
--   3. Adds valid_email flag to realtors table

-- ============================================================================
-- 1. Create regulations table
-- ============================================================================
CREATE TABLE IF NOT EXISTS regulations (
  id SERIAL PRIMARY KEY,
  municipality_id INTEGER NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  doc_url TEXT NOT NULL,
  regulation JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(municipality_id, doc_url)
);

-- Create indexes for regulations table
CREATE INDEX IF NOT EXISTS regulations_municipality_id_idx 
ON regulations USING btree (municipality_id);

CREATE INDEX IF NOT EXISTS regulations_doc_url_idx 
ON regulations USING btree (doc_url);

CREATE INDEX IF NOT EXISTS regulations_regulation_gin 
ON regulations USING gin (regulation);

-- ============================================================================
-- 2. Add plot_report_url and plot_report_json columns to enriched_plots_stage (base table)
-- ============================================================================
ALTER TABLE enriched_plots_stage 
ADD COLUMN IF NOT EXISTS plot_report_url TEXT,
ADD COLUMN IF NOT EXISTS plot_report_json JSONB;

-- ============================================================================
-- 3. Recreate enriched_plots materialized view with new column
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
  plot_report_json
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

-- ============================================================================
-- 4. Add valid_email column to realtors
-- ============================================================================
ALTER TABLE realtors 
ADD COLUMN IF NOT EXISTS valid_email BOOLEAN DEFAULT NULL;
