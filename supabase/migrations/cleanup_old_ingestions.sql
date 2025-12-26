-- Data Retention Cleanup Functions
-- Delete old raw_ingestions (14 days) and scraper_logs (30 days)
--
-- Usage:
-- SELECT run_data_cleanup();

-- Function to clean up old raw ingestions (older than 14 days)
CREATE OR REPLACE FUNCTION cleanup_old_ingestions()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  DELETE FROM raw_ingestions
  WHERE ingested_at < NOW() - INTERVAL '14 days';

  GET DIAGNOSTICS count = ROW_COUNT;

  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_ingestions() IS
'Delete raw_ingestions older than 14 days. Returns count of deleted rows.';

-- Function to clean up old scraper logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_scraper_logs()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  DELETE FROM scraper_logs
  WHERE started_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS count = ROW_COUNT;

  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_scraper_logs() IS
'Delete scraper_logs older than 30 days. Returns count of deleted rows.';

-- Combined cleanup function - runs both cleanups
CREATE OR REPLACE FUNCTION run_data_cleanup()
RETURNS TABLE(
  ingestions_deleted INTEGER,
  logs_deleted INTEGER
) AS $$
DECLARE
  ing_count INTEGER;
  log_count INTEGER;
BEGIN
  -- Clean up old ingestions
  SELECT * INTO ing_count FROM cleanup_old_ingestions();

  -- Clean up old scraper logs
  SELECT * INTO log_count FROM cleanup_old_scraper_logs();

  RETURN QUERY SELECT ing_count, log_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION run_data_cleanup() IS
'Run both cleanup functions. Returns (ingestions_deleted, logs_deleted).
Schedule daily via Supabase pg_cron extension or external scheduler:
SELECT run_data_cleanup();';

-- Example: Schedule with pg_cron (requires pg_cron extension)
-- SELECT cron.schedule(
--   'cleanup-old-data',
--   '0 2 * * *',  -- Run at 2 AM every day
--   $$SELECT run_data_cleanup()$$
-- );
