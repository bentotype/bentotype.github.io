-- FINAL RLS FIX
-- Based on the exact policy names provided by the user.

-- 1. Drop ALL existing policies using their EXACT names
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_info;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_info;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_info;
DROP POLICY IF EXISTS "Allows users to update their info and profile pictures" ON user_info;
DROP POLICY IF EXISTS "Users can insert their own info." ON user_info;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_info;
DROP POLICY IF EXISTS "Users can update own profile" ON user_info;
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON user_info;

-- 2. Drop the recursive function (just in case)
DROP FUNCTION IF EXISTS get_my_tier();

-- 3. Re-create ONLY the Safe Policies (No Admin Recursion)

-- A. Users can view their own data
CREATE POLICY "Users can view own profile"
ON user_info FOR SELECT
USING ( auth.uid() = user_id );

-- B. Users can insert their own data (Critical for Sign Up)
CREATE POLICY "Users can insert own profile"
ON user_info FOR INSERT
WITH CHECK ( auth.uid() = user_id );

-- C. Users can update their own data
CREATE POLICY "Users can update own profile"
ON user_info FOR UPDATE
USING ( auth.uid() = user_id );

-- D. Public/Auth Read Access (Needed for finding friends)
-- Uses "true" to avoid any recursive lookups
CREATE POLICY "Authenticated can view all profiles"
ON user_info FOR SELECT
TO authenticated
USING ( true );
