-- Migration to add signal_instructions to projects and platform to sources
-- Run this in your Supabase SQL Editor

-- Step 1: Add signal_instructions column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS signal_instructions TEXT;

-- Add constraint for max length (2000 characters)
ALTER TABLE projects
ADD CONSTRAINT signal_instructions_length CHECK (length(signal_instructions) <= 2000);

-- Step 2: Add platform column to sources table for easier platform detection
-- This supplements source_type which is more technical
ALTER TABLE sources
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add check constraint for valid platforms
ALTER TABLE sources
ADD CONSTRAINT valid_platform CHECK (platform IN ('x_twitter', 'reddit', 'news', 'other') OR platform IS NULL);

-- Step 3: Add index for faster queries on signal_instructions (for searching)
CREATE INDEX IF NOT EXISTS idx_projects_signal_instructions ON projects USING gin(to_tsvector('spanish', signal_instructions));

-- Step 4: Add index for platform on sources
CREATE INDEX IF NOT EXISTS idx_sources_platform ON sources(platform);
