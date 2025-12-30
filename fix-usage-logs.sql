-- Fix usage_logs table to work with new columns
-- Make old 'action' column nullable since we're using 'action_type' now
ALTER TABLE usage_logs
ALTER COLUMN action DROP NOT NULL;

-- Optionally rename for clarity (or drop it later)
-- ALTER TABLE usage_logs DROP COLUMN action;
-- ALTER TABLE usage_logs DROP COLUMN details;
