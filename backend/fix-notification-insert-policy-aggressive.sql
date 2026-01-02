-- Aggressive Fix: Notification INSERT Policy
-- This script tries multiple approaches to fix the INSERT policy
-- Run this in Supabase SQL Editor

-- Step 1: Check current state
SELECT 
    'Current Policies' AS info,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
ORDER BY cmd, policyname;

-- Step 2: Drop ALL policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_record.policyname);
    END LOOP;
END $$;

-- Step 3: Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Recreate SELECT policies
CREATE POLICY "Users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all notifications"
    ON public.notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Step 5: Recreate UPDATE policy
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Step 6: Create INSERT policy with explicit authentication check
-- Try approach 1: Check if authenticated
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (
        -- Allow if user is authenticated (auth.uid() is not null)
        auth.uid() IS NOT NULL
    );

-- Step 7: Verify the policy
SELECT 
    'After Creation' AS info,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
AND cmd = 'INSERT';

-- Step 8: If the above doesn't work, try this alternative approach
-- Drop and recreate with a different check
-- (Uncomment if needed)
/*
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (
        -- Allow authenticated users OR service role
        (auth.uid() IS NOT NULL) OR (auth.role() = 'service_role')
    );
*/

-- Step 9: Final verification
DO $$
DECLARE
    insert_count INTEGER;
    select_count INTEGER;
    update_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO insert_count FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'INSERT';
    
    SELECT COUNT(*) INTO select_count FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'SELECT';
    
    SELECT COUNT(*) INTO update_count FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'UPDATE';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Policy Summary:';
    RAISE NOTICE '  INSERT policies: %', insert_count;
    RAISE NOTICE '  SELECT policies: %', select_count;
    RAISE NOTICE '  UPDATE policies: %', update_count;
    RAISE NOTICE '========================================';
    
    IF insert_count = 1 THEN
        RAISE NOTICE '✅ INSERT policy exists';
    ELSE
        RAISE WARNING '❌ INSERT policy count is % (expected 1)', insert_count;
    END IF;
END $$;

