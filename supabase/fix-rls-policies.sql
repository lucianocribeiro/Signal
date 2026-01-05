-- Fix for infinite recursion in RLS policies and role enum mismatch
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Step 2: Fix policies to align with admin role

-- Step 3: Create a corrected policy for admins that avoids recursion
-- Using a security definer function to bypass RLS during the role check
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create new policy using the security definer function
CREATE POLICY "Admins can view all profiles"
    ON user_profiles FOR SELECT
    USING (is_admin());

-- Step 5: Add policy for admins to manage users (if needed for admin panel)
CREATE POLICY "Admins can update all profiles"
    ON user_profiles FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can insert profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can delete profiles"
    ON user_profiles FOR DELETE
    USING (is_admin());

-- Step 6: Fix audit logs policy with same issue
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Admins can view all audit logs"
    ON audit_logs FOR SELECT
    USING (is_admin());
