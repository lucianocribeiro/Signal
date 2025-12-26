-- Migration: Add project refresh settings for scheduled scraper
-- Epic 3.4: Scheduled Scraper with User-Configurable Intervals
-- Created: 2025-12-26

-- Add last_refresh_at column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ;

-- Add comment for settings column (documents the refresh_interval_hours usage)
COMMENT ON COLUMN projects.settings IS
'JSONB settings including:
- refresh_interval_hours (2, 4, 8, or 12): How often to scrape project sources
- scrape_lock: { locked_at, locked_by, expires_at } for preventing concurrent scrapes
Default refresh_interval_hours: 4';

-- Initialize existing projects with defaults
UPDATE projects
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{refresh_interval_hours}',
    '4'
  ),
  last_refresh_at = COALESCE(last_refresh_at, created_at)
WHERE settings->>'refresh_interval_hours' IS NULL;

-- Create composite index for efficient querying of active projects
CREATE INDEX IF NOT EXISTS idx_projects_active_last_refresh
  ON projects(is_active, last_refresh_at)
  WHERE is_active = true;

-- Create GIN index for JSONB queries on settings
CREATE INDEX IF NOT EXISTS idx_projects_settings_gin
  ON projects USING GIN(settings);

-- Create function to get projects due for refresh
CREATE OR REPLACE FUNCTION get_projects_due_for_refresh()
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  owner_id UUID,
  refresh_interval_hours INTEGER,
  last_refresh_at TIMESTAMPTZ,
  hours_since_refresh NUMERIC,
  is_due BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS project_id,
    p.name AS project_name,
    p.owner_id,
    COALESCE((p.settings->>'refresh_interval_hours')::INTEGER, 4) AS refresh_interval_hours,
    p.last_refresh_at,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(p.last_refresh_at, p.created_at))) / 3600 AS hours_since_refresh,
    (
      p.last_refresh_at IS NULL OR
      p.last_refresh_at < NOW() - (COALESCE((p.settings->>'refresh_interval_hours')::INTEGER, 4) || ' hours')::INTERVAL
    ) AS is_due
  FROM projects p
  WHERE p.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Add comment for the function
COMMENT ON FUNCTION get_projects_due_for_refresh() IS
'Returns all active projects with their refresh settings and whether they are due for a scrape.
Used by the cron job to determine which projects to refresh.
Default refresh interval: 4 hours';

-- Verify migration
DO $$
DECLARE
  column_exists BOOLEAN;
  index_exists BOOLEAN;
  function_exists BOOLEAN;
BEGIN
  -- Check if column was added
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects'
    AND column_name = 'last_refresh_at'
  ) INTO column_exists;

  -- Check if composite index was created
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_projects_active_last_refresh'
  ) INTO index_exists;

  -- Check if function was created
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'get_projects_due_for_refresh'
  ) INTO function_exists;

  -- Log results
  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '  - last_refresh_at column: %', CASE WHEN column_exists THEN 'Created' ELSE 'Failed' END;
  RAISE NOTICE '  - Composite index: %', CASE WHEN index_exists THEN 'Created' ELSE 'Failed' END;
  RAISE NOTICE '  - Function get_projects_due_for_refresh: %', CASE WHEN function_exists THEN 'Created' ELSE 'Failed' END;

  -- Fail migration if any component is missing
  IF NOT (column_exists AND index_exists AND function_exists) THEN
    RAISE EXCEPTION 'Migration failed: One or more components were not created successfully';
  END IF;

  RAISE NOTICE 'Migration completed successfully!';
END $$;
