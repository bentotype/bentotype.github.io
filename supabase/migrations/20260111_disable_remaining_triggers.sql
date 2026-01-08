-- Drop potentially failing triggers on auth.users causing 500 errors
-- "on_auth_user_confirmed" likely fails on profile creation logic
-- "trigger_welcome_email" likely fails if the Edge Function is not deployed or misconfigured

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
DROP TRIGGER IF EXISTS trigger_welcome_email ON auth.users;
