/* Step 1: Drop the problematic policy */
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

/* Step 2: Create security definer function to check admin role */
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/* Step 3: Create new admin policies */
CREATE POLICY "Admins can view all profiles"
    ON user_profiles FOR SELECT
    USING (is_admin());

CREATE POLICY "Admins can update all profiles"
    ON user_profiles FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can insert profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete profiles"
    ON user_profiles FOR DELETE
    USING (is_admin());

/* Step 5: Fix audit logs policy */
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Admins can view all audit logs"
    ON audit_logs FOR SELECT
    USING (is_admin());
