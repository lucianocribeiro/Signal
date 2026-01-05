CREATE TABLE IF NOT EXISTS project_viewer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_project_viewer_project
  ON project_viewer_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_viewer_viewer
  ON project_viewer_assignments(viewer_id);

ALTER TABLE project_viewer_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage viewer assignments"
  ON project_viewer_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Viewers see their assignments"
  ON project_viewer_assignments
  FOR SELECT
  TO authenticated
  USING (viewer_id = auth.uid());

DROP POLICY IF EXISTS "Users can view all projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects" ON projects;

CREATE POLICY "Admins view all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'user'
    )
  );

CREATE POLICY "Viewers view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_viewer_assignments
      WHERE project_viewer_assignments.project_id = projects.id
      AND project_viewer_assignments.viewer_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'viewer'
    )
  );

CREATE POLICY "Users create own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('user', 'admin')
    )
  );

CREATE POLICY "Users update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
