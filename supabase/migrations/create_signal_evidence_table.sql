-- Migration: Create signal_evidence table for linking signals to raw_ingestions
-- Epic 4 Story 4.4: Link Evidence (Raw Data) to Signals
-- This creates a many-to-many relationship between signals and raw_ingestions

-- Create signal_evidence table for many-to-many signal-to-ingestion relationships
CREATE TABLE IF NOT EXISTS signal_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    raw_ingestion_id UUID NOT NULL REFERENCES raw_ingestions(id) ON DELETE CASCADE,
    reference_type TEXT NOT NULL DEFAULT 'detected',  -- 'detected', 'momentum', 'manual'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_signal_evidence UNIQUE (signal_id, raw_ingestion_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_signal_evidence_signal_id ON signal_evidence(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_evidence_ingestion_id ON signal_evidence(raw_ingestion_id);

-- Enable RLS
ALTER TABLE signal_evidence ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view evidence for their project signals"
    ON signal_evidence FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM signals s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = signal_evidence.signal_id
            AND p.owner_id = auth.uid()
        )
    );

CREATE POLICY "System can insert signal evidence"
    ON signal_evidence FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update signal evidence"
    ON signal_evidence FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete evidence for their project signals"
    ON signal_evidence FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM signals s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = signal_evidence.signal_id
            AND p.owner_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON TABLE signal_evidence IS 'Many-to-many relationship linking signals to raw_ingestions as evidence';
COMMENT ON COLUMN signal_evidence.reference_type IS 'Type of evidence link: detected (signal creation), momentum (momentum update), or manual (user added)';
COMMENT ON COLUMN signal_evidence.metadata IS 'Additional context about when/why this evidence was linked';
