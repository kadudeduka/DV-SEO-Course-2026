-- Fix RLS Policies for Trigger Function
-- This ensures the trigger can create user profiles

-- Step 1: Check current INSERT policies
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users' 
AND schemaname = 'public'
AND cmd = 'INSERT';

-- Step 2: Drop existing INSERT policy if it exists (we'll recreate it)
DROP POLICY IF EXISTS "Allow trigger to create profiles" ON public.users;
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;

-- Step 3: Create a policy that allows the trigger function to insert
-- Since the function uses SECURITY DEFINER, it runs as the function owner
-- We need to allow INSERT for authenticated users (which includes the trigger context)
CREATE POLICY "Allow trigger to create user profiles"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Alternative: Allow service_role (function might run as this)
-- Uncomment if the above doesn't work:
-- CREATE POLICY "Allow service role to create profiles"
-- ON public.users
-- FOR INSERT
-- TO service_role
-- WITH CHECK (true);

-- Step 4: Grant INSERT permission explicitly
GRANT INSERT ON public.users TO authenticated;
GRANT INSERT ON public.users TO service_role;

-- Step 5: Verify the policy was created
SELECT 
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'users' 
AND schemaname = 'public'
AND cmd = 'INSERT';

-- Expected: Should show "Allow trigger to create user profiles" policy

-- Step 6: Test if we can insert (as authenticated)
-- This simulates what the trigger should do
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
BEGIN
    -- Try to insert a test user profile
    INSERT INTO public.users (id, email, name, full_name, role, status)
    VALUES (
        test_id,
        'test-trigger@example.com',
        'Test Trigger',
        'Test Trigger',
        'learner',
        'pending'
    );
    
    RAISE NOTICE '✅ INSERT test succeeded';
    
    -- Clean up
    DELETE FROM public.users WHERE id = test_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ INSERT test failed: %', SQLERRM;
END $$;

