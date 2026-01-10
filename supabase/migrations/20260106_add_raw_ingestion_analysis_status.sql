-- Add analysis status tracking to raw_ingestions
ALTER TABLE raw_ingestions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_analysis',
ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_message TEXT;
