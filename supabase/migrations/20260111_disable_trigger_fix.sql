-- Disable the handle_new_user trigger to prevent 500 errors during signup/verification
-- We are relying on the client-side fallback to create user_info rows.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
