/* Step 1: Drop the problematic policy */
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

/* Step 2: Add 'owner' to the user_role enum */
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';

/* Step 3: Create security definer function to check owner role */
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/* Step 4: Create new owner policies */
CREATE POLICY "Owners can view all profiles"
    ON user_profiles FOR SELECT
    USING (is_owner());

CREATE POLICY "Owners can update all profiles"
    ON user_profiles FOR UPDATE
    USING (is_owner());

CREATE POLICY "Owners can insert profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (is_owner());

CREATE POLICY "Owners can delete profiles"
    ON user_profiles FOR DELETE
    USING (is_owner());

/* Step 5: Fix audit logs policy */
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Owners can view all audit logs"
    ON audit_logs FOR SELECT
    USING (is_owner());
