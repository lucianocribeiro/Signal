-- Migration: Update platform types
-- Remove unused platform types (x_twitter, other) and add marketplace
-- Note: PostgreSQL doesn't allow removing enum values directly, so we recreate the enum

-- Step 1: Add new enum with correct values
CREATE TYPE source_type_new AS ENUM ('rss', 'api', 'web_scraper', 'manual', 'twitter', 'reddit', 'news', 'marketplace');

-- Step 2: Update existing sources with deprecated types to use new values
-- Convert 'x_twitter' to 'twitter' and 'other' to 'news'
UPDATE sources SET source_type = 'twitter' WHERE source_type = 'x_twitter';
UPDATE sources SET source_type = 'news' WHERE source_type = 'other';

-- Step 3: Update sources table to use new enum
ALTER TABLE sources
  ALTER COLUMN source_type TYPE source_type_new
  USING source_type::text::source_type_new;

-- Step 4: Drop old enum
DROP TYPE source_type;

-- Step 5: Rename new enum to original name
ALTER TYPE source_type_new RENAME TO source_type;

-- Add comment
COMMENT ON TYPE source_type IS 'Supported source types: rss, api, web_scraper, manual, twitter, reddit, news, marketplace';
