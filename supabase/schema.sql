-- Signal Project Database Schema
-- Supabase PostgreSQL Schema

-- ==============================================
-- ENUM TYPES
-- ==============================================

CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
CREATE TYPE signal_status AS ENUM ('Accelerating', 'Stabilizing', 'New', 'Archived');
CREATE TYPE signal_momentum AS ENUM ('high', 'medium', 'low');
CREATE TYPE source_type AS ENUM ('rss', 'api', 'web_scraper', 'manual', 'twitter', 'reddit', 'news');
CREATE TYPE scraper_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE report_frequency AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE notification_channel AS ENUM ('email', 'in_app', 'slack', 'webhook');

-- ==============================================
-- TABLES
-- ==============================================

-- User Profiles Table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role user_role DEFAULT 'user' NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb
);

-- Sources Table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type source_type NOT NULL,
    url TEXT,
    api_endpoint TEXT,
    api_key_encrypted TEXT,
    scraper_config JSONB,
    fetch_interval_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_fetch_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Raw Ingestions Table
CREATE TABLE raw_ingestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    raw_data JSONB NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    processed BOOLEAN DEFAULT false NOT NULL,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Signals Table
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    status signal_status DEFAULT 'New' NOT NULL,
    momentum signal_momentum DEFAULT 'low' NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT,
    source_name TEXT,
    source_url TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Signal References Table (for tracking related signals)
CREATE TABLE signal_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    referenced_signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    relationship_type TEXT DEFAULT 'related',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT no_self_reference CHECK (signal_id != referenced_signal_id),
    CONSTRAINT unique_reference UNIQUE (signal_id, referenced_signal_id)
);

-- Scraper Logs Table
CREATE TABLE scraper_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    status scraper_status NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    items_found INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    execution_time_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Usage Logs Table
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Notification Preferences Table
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    enabled BOOLEAN DEFAULT true NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_channel UNIQUE (user_id, channel)
);

-- Scheduled Reports Table
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    frequency report_frequency NOT NULL,
    recipients TEXT[] NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================
-- INDEXES
-- ==============================================

-- User Profiles Indexes
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active);

-- Projects Indexes
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_is_active ON projects(is_active);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Sources Indexes
CREATE INDEX idx_sources_project_id ON sources(project_id);
CREATE INDEX idx_sources_source_type ON sources(source_type);
CREATE INDEX idx_sources_is_active ON sources(is_active);
CREATE INDEX idx_sources_last_fetch_at ON sources(last_fetch_at);

-- Raw Ingestions Indexes
CREATE INDEX idx_raw_ingestions_source_id ON raw_ingestions(source_id);
CREATE INDEX idx_raw_ingestions_processed ON raw_ingestions(processed);
CREATE INDEX idx_raw_ingestions_ingested_at ON raw_ingestions(ingested_at DESC);
CREATE INDEX idx_raw_ingestions_metadata ON raw_ingestions USING GIN(metadata);

-- Signals Indexes
CREATE INDEX idx_signals_project_id ON signals(project_id);
CREATE INDEX idx_signals_source_id ON signals(source_id);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_momentum ON signals(momentum);
CREATE INDEX idx_signals_detected_at ON signals(detected_at DESC);
CREATE INDEX idx_signals_created_by ON signals(created_by);
CREATE INDEX idx_signals_tags ON signals USING GIN(tags);
CREATE INDEX idx_signals_metadata ON signals USING GIN(metadata);

-- Signal References Indexes
CREATE INDEX idx_signal_references_signal_id ON signal_references(signal_id);
CREATE INDEX idx_signal_references_referenced_signal_id ON signal_references(referenced_signal_id);

-- Scraper Logs Indexes
CREATE INDEX idx_scraper_logs_source_id ON scraper_logs(source_id);
CREATE INDEX idx_scraper_logs_status ON scraper_logs(status);
CREATE INDEX idx_scraper_logs_started_at ON scraper_logs(started_at DESC);

-- Audit Logs Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Usage Logs Indexes
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_project_id ON usage_logs(project_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);

-- Notification Preferences Indexes
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_channel ON notification_preferences(channel);

-- Scheduled Reports Indexes
CREATE INDEX idx_scheduled_reports_project_id ON scheduled_reports(project_id);
CREATE INDEX idx_scheduled_reports_user_id ON scheduled_reports(user_id);
CREATE INDEX idx_scheduled_reports_is_active ON scheduled_reports(is_active);
CREATE INDEX idx_scheduled_reports_next_send_at ON scheduled_reports(next_send_at);

-- ==============================================
-- TRIGGERS FOR AUTOMATIC UPDATED_AT TIMESTAMPS
-- ==============================================

-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signals_updated_at
    BEFORE UPDATE ON signals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
    BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_ingestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Projects Policies
CREATE POLICY "Users can view their own projects"
    ON projects FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own projects"
    ON projects FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own projects"
    ON projects FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own projects"
    ON projects FOR DELETE
    USING (owner_id = auth.uid());

-- Sources Policies
CREATE POLICY "Users can view sources for their projects"
    ON sources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = sources.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert sources for their projects"
    ON sources FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update sources for their projects"
    ON sources FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = sources.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete sources for their projects"
    ON sources FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = sources.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Raw Ingestions Policies
CREATE POLICY "Users can view raw ingestions for their project sources"
    ON raw_ingestions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sources
            JOIN projects ON sources.project_id = projects.id
            WHERE sources.id = raw_ingestions.source_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "System can insert raw ingestions"
    ON raw_ingestions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update raw ingestions"
    ON raw_ingestions FOR UPDATE
    USING (true);

-- Signals Policies
CREATE POLICY "Users can view signals for their projects"
    ON signals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = signals.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert signals for their projects"
    ON signals FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update signals for their projects"
    ON signals FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = signals.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete signals for their projects"
    ON signals FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = signals.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Signal References Policies
CREATE POLICY "Users can view signal references for their project signals"
    ON signal_references FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM signals
            JOIN projects ON signals.project_id = projects.id
            WHERE signals.id = signal_references.signal_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage signal references for their project signals"
    ON signal_references FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM signals
            JOIN projects ON signals.project_id = projects.id
            WHERE signals.id = signal_references.signal_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Scraper Logs Policies
CREATE POLICY "Users can view scraper logs for their project sources"
    ON scraper_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sources
            JOIN projects ON sources.project_id = projects.id
            WHERE sources.id = scraper_logs.source_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "System can insert scraper logs"
    ON scraper_logs FOR INSERT
    WITH CHECK (true);

-- Audit Logs Policies
CREATE POLICY "Users can view their own audit logs"
    ON audit_logs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all audit logs"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- Usage Logs Policies
CREATE POLICY "Users can view their own usage logs"
    ON usage_logs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "System can insert usage logs"
    ON usage_logs FOR INSERT
    WITH CHECK (true);

-- Notification Preferences Policies
CREATE POLICY "Users can view their own notification preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own notification preferences"
    ON notification_preferences FOR ALL
    USING (user_id = auth.uid());

-- Scheduled Reports Policies
CREATE POLICY "Users can view scheduled reports for their projects"
    ON scheduled_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = scheduled_reports.project_id
            AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage scheduled reports for their projects"
    ON scheduled_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = scheduled_reports.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- ==============================================
-- ADDITIONAL FUNCTIONS
-- ==============================================

-- Function to automatically archive old signals
CREATE OR REPLACE FUNCTION archive_old_signals()
RETURNS void AS $$
BEGIN
    UPDATE signals
    SET status = 'Archived',
        archived_at = NOW()
    WHERE status != 'Archived'
    AND detected_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old raw ingestions
CREATE OR REPLACE FUNCTION cleanup_old_ingestions()
RETURNS void AS $$
BEGIN
    DELETE FROM raw_ingestions
    WHERE processed = true
    AND ingested_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE user_profiles IS 'Stores user profile information and roles';
COMMENT ON TABLE projects IS 'Main projects that organize signals and sources';
COMMENT ON TABLE sources IS 'Data sources for ingesting signals (RSS, APIs, scrapers)';
COMMENT ON TABLE raw_ingestions IS 'Raw data ingested from sources before processing';
COMMENT ON TABLE signals IS 'Processed signals from various sources';
COMMENT ON TABLE signal_references IS 'Relationships between related signals';
COMMENT ON TABLE scraper_logs IS 'Logs from scraper execution for monitoring';
COMMENT ON TABLE audit_logs IS 'Audit trail for security and compliance';
COMMENT ON TABLE usage_logs IS 'Track user activity and usage patterns';
COMMENT ON TABLE notification_preferences IS 'User notification settings per channel';
COMMENT ON TABLE scheduled_reports IS 'Automated report generation and delivery';
