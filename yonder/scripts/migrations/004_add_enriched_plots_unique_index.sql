-- Migration: Add unique index to enriched_plots materialized view
-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY to work
-- This allows refreshing the view without blocking reads

-- Create unique index on the id column of the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS enriched_plots_id_unique_idx ON enriched_plots (id);

-- Verify the index was created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'enriched_plots';
