-- EMERGENCY RLS RESET
-- Run this to completely wipe bad policies and fix the "Infinite Recursion" loop.

-- 1. Disable RLS temporarily (Stops the checking immediately)
ALTER TABLE user_info DISABLE ROW LEVEL SECURITY;

-- 2. Drop EVERY known policy variant to clear the slate
DROP POLICY IF EXISTS "Admins can view all" ON user_info;
DROP POLICY IF EXISTS "Admins can update all" ON user_info;
DROP POLICY IF EXISTS "Admins can do everything" ON user_info;
DROP POLICY IF EXISTS "Users can view own profile" ON user_info;
DROP POLICY IF EXISTS "Users can update own profile" ON user_info;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_info;
DROP POLICY IF EXISTS "Public profiles are viewable" ON user_info;
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON user_info;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_info;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_info;

-- 3. Drop the function causing complexity
DROP FUNCTION IF EXISTS get_my_tier();

-- 4. Re-enable RLS (Clean slate)
ALTER TABLE user_info ENABLE ROW LEVEL SECURITY;

-- 5. Create SIMPLE, SAFE policies (No Admin Recursion)

-- Allow users to see their own data
CREATE POLICY "Users can view own profile" 
ON user_info FOR SELECT 
USING ( auth.uid() = user_id );

-- Allow users to create their own profile (Crucial for Sign Up)
CREATE POLICY "Users can insert own profile" 
ON user_info FOR INSERT 
WITH CHECK ( auth.uid() = user_id );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON user_info FOR UPDATE 
USING ( auth.uid() = user_id );

-- Allow any logged-in user to view other profiles (Needed for Friends search)
-- This is SAFE because it uses "true", not a database query.
CREATE POLICY "Authenticated can view all profiles" 
ON user_info FOR SELECT 
TO authenticated 
USING ( true );
