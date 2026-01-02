-- Auto-Confirm Users for Testing
-- This allows users to sign in immediately without email verification
-- Run this in Supabase SQL Editor

-- Option 1: Update existing users to be confirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- Option 2: Create a trigger to auto-confirm new users
-- This will automatically confirm emails when users sign up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Auto-confirm email for new users
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-confirm emails
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- Verify trigger was created
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'on_auth_user_created_confirm';

-- Note: This is a workaround for testing
-- For production, you should either:
-- 1. Disable email confirmation in Supabase Dashboard, OR
-- 2. Use proper email verification flow

