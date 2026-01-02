-- Fix Trigger Function for User Profile Creation
-- Run this in Supabase SQL Editor if profiles are not being created

-- Step 1: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Create the trigger function with proper field handling and error logging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_name TEXT;
    user_full_name TEXT;
    user_role TEXT;
BEGIN
    -- Extract metadata
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        ''
    );
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        ''
    );
    user_role := COALESCE(
        (NEW.raw_user_meta_data->>'role')::TEXT,
        'learner'
    );
    
    -- Insert user profile
    BEGIN
        INSERT INTO public.users (id, email, name, full_name, role, status)
        VALUES (
            NEW.id,
            NEW.email,
            user_name,
            user_full_name,
            user_role,
            'pending'
        )
        ON CONFLICT (id) DO UPDATE
        SET
            email = EXCLUDED.email,
            name = COALESCE(EXCLUDED.name, public.users.name),
            full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
            role = COALESCE(EXCLUDED.role, public.users.role),
            status = COALESCE(EXCLUDED.status, public.users.status);
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        RAISE WARNING 'Error creating user profile for %: %', NEW.email, SQLERRM;
        -- Re-raise to see in logs
        RAISE;
    END;
    
    RETURN NEW;
END;
$$;

-- Step 4: Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON public.users TO authenticated;

-- Step 6: Verify the trigger was created
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- Expected result: Should show the trigger attached to auth.users table

