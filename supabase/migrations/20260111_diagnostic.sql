-- DIAGNOSTIC QUERY
-- Run this to visually list all active policies on user_info.
-- Copy and paste the results back to me.

SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_info';
