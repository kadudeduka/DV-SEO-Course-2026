-- Final Fix for Trigger Function
-- This version bypasses RLS completely and adds detailed logging

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create trigger function that bypasses RLS
-- Using SECURITY DEFINER with explicit schema and role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    user_name TEXT;
    user_full_name TEXT;
    user_role TEXT;
    result_id UUID;
BEGIN
    -- Extract metadata with defaults
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'email', ''),
        'User'
    );
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        user_name
    );
    user_role := COALESCE(
        (NEW.raw_user_meta_data->>'role')::TEXT,
        'learner'
    );
    
    -- Insert user profile (bypassing RLS with SECURITY DEFINER)
    BEGIN
        INSERT INTO public.users (id, email, name, full_name, role, status)
        VALUES (
            NEW.id,
            COALESCE(NEW.email, ''),
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
        
        result_id := NEW.id;
        
        -- Log success (will appear in Postgres logs)
        RAISE LOG 'Trigger handle_new_user: Successfully created profile for user % (email: %)', NEW.id, NEW.email;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log detailed error (will appear in Postgres logs)
        RAISE WARNING 'Trigger handle_new_user FAILED for user % (email: %): %', NEW.id, NEW.email, SQLERRM;
        RAISE WARNING 'Error details: SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
        -- Don't re-raise - allow auth user creation to succeed even if profile creation fails
    END;
    
    RETURN NEW;
END;
$$;

-- Step 3: Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- Step 4: Recreate trigger (ensure it's enabled)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Verify trigger is enabled (should show 'O' for origin or 'A' for always)
SELECT 
    tgname,
    tgenabled,
    CASE tgenabled
        WHEN 'O' THEN 'origin (enabled)'
        WHEN 'D' THEN 'disabled'
        WHEN 'R' THEN 'replica'
        WHEN 'A' THEN 'always (enabled)'
        ELSE 'unknown'
    END as trigger_status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Step 6: Check function definition
SELECT 
    p.proname,
    p.prosecdef as security_definer,
    p.proconfig as config,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
WHERE p.proname = 'handle_new_user';

-- Step 7: Ensure INSERT policy exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND schemaname = 'public'
        AND cmd = 'INSERT'
    ) THEN
        CREATE POLICY "Allow trigger to create user profiles"
        ON public.users
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
        
        RAISE NOTICE 'Created INSERT policy';
    ELSE
        RAISE NOTICE 'INSERT policy already exists';
    END IF;
END $$;

-- Step 8: Grant permissions
GRANT INSERT ON public.users TO authenticated;
GRANT INSERT ON public.users TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 9: Test by checking recent users
SELECT 
    au.id as auth_user_id,
    au.email as auth_email,
    au.created_at as auth_created,
    pu.id as profile_id,
    pu.status as profile_status,
    CASE 
        WHEN pu.id IS NULL THEN '❌ Profile missing'
        ELSE '✅ Profile exists'
    END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC
LIMIT 5;

