-- Fix for infinite recursion in RLS policies and role enum mismatch
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Step 2: Fix the user_role enum to match application code
-- First, we need to add the 'owner' value if it doesn't exist
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';

-- Step 3: Create a corrected policy for owners (not admins) that avoids recursion
-- Using a security definer function to bypass RLS during the role check
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create new policy using the security definer function
CREATE POLICY "Owners can view all profiles"
    ON user_profiles FOR SELECT
    USING (is_owner());

-- Step 5: Add policy for owners to manage users (if needed for admin panel)
CREATE POLICY "Owners can update all profiles"
    ON user_profiles FOR UPDATE
    USING (is_owner());

CREATE POLICY "Owners can insert profiles"
    ON user_profiles FOR INSERT
    WITH CHECK (is_owner());

CREATE POLICY "Owners can delete profiles"
    ON user_profiles FOR DELETE
    USING (is_owner());

-- Step 6: Fix audit logs policy with same issue
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Owners can view all audit logs"
    ON audit_logs FOR SELECT
    USING (is_owner());
