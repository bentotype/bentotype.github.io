-- FIX: Infinite Recursion (42P17) on user_info table
-- This happens when an RLS policy tries to query the table itself (e.g. to check if you are Admin)
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the check

-- 1. Create a secure function to get the current user's tier without triggering RLS
CREATE OR REPLACE FUNCTION get_my_tier()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER -- <--- This is the key. It runs with owner privileges, bypassing RLS.
SET search_path = public
AS $$
BEGIN
  -- Safe to query user_info here because RLS is bypassed for this function
  RETURN (SELECT tier FROM user_info WHERE user_id = auth.uid());
END;
$$;

-- 2. Drop the recursive policies to prevent "policy already exists" errors
DROP POLICY IF EXISTS "Admins can view all" ON user_info;
DROP POLICY IF EXISTS "Admins can update all" ON user_info;
DROP POLICY IF EXISTS "Admins can do everything" ON user_info; -- <--- Added this drop
DROP POLICY IF EXISTS "Users can view own profile" ON user_info;
DROP POLICY IF EXISTS "Users can update own profile" ON user_info;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_info;
DROP POLICY IF EXISTS "Public profiles are viewable" ON user_info;
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON user_info;

-- 3. Re-create the Policies using the non-recursive function

-- A. Users can see their own profile
CREATE POLICY "Users can view own profile"
ON user_info FOR SELECT
USING ( auth.uid() = user_id );

-- B. Users can update their own profile
CREATE POLICY "Users can update own profile"
ON user_info FOR UPDATE
USING ( auth.uid() = user_id );

-- C. Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON user_info FOR INSERT
WITH CHECK ( auth.uid() = user_id );

-- D. Admins can see/update EVERYTHING (Using the function to avoid recursion)
CREATE POLICY "Admins can do everything"
ON user_info FOR ALL
USING ( get_my_tier() = 4 );
-- Note: 4 = Admin Tier

-- E. Public read access (Optional - for searching friends)
CREATE POLICY "Authenticated can view all profiles"
ON user_info FOR SELECT
TO authenticated
USING ( true );
