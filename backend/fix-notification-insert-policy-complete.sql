-- Complete Fix: Notification INSERT Policy
-- This script completely resets and recreates the INSERT policy
-- Run this in Supabase SQL Editor

-- Step 1: List ALL policies on notifications table (before cleanup)
SELECT 
    'BEFORE CLEANUP' AS stage,
    policyname,
    cmd AS operation,
    CASE 
        WHEN qual IS NOT NULL THEN qual::text
        ELSE 'No condition'
    END AS condition,
    CASE 
        WHEN with_check IS NOT NULL THEN with_check::text
        ELSE 'No check'
    END AS with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
ORDER BY cmd, policyname;

-- Step 2: Drop ALL policies on notifications table (we'll recreate them)
DO $$
DECLARE
    policy_record RECORD;
    dropped_count INTEGER := 0;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_record.policyname);
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
    
    RAISE NOTICE 'Dropped % policies', dropped_count;
END $$;

-- Step 3: Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Recreate SELECT policies (users can read their own notifications)
CREATE POLICY "Users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Step 5: Recreate SELECT policy for admins (admins can read all notifications)
CREATE POLICY "Admins can read all notifications"
    ON public.notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Step 6: Recreate UPDATE policy (users can update their own notifications)
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Step 7: Create INSERT policy (ALLOWS ANY AUTHENTICATED USER)
-- This is the critical policy that allows notifications to be created
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (TRUE);

-- Step 8: Verify all policies were created
SELECT 
    'AFTER RECREATION' AS stage,
    policyname,
    cmd AS operation,
    CASE 
        WHEN qual IS NOT NULL THEN qual::text
        ELSE 'No condition'
    END AS condition,
    CASE 
        WHEN with_check IS NOT NULL THEN with_check::text
        ELSE 'No check'
    END AS with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
ORDER BY cmd, policyname;

-- Step 9: Count policies by operation
SELECT 
    cmd AS operation,
    COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
GROUP BY cmd
ORDER BY cmd;

-- Step 10: Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity AS rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled - FIX NEEDED'
    END AS status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'notifications';

-- Step 11: Final verification - check INSERT policy specifically
DO $$
DECLARE
    insert_policy_count INTEGER;
    insert_policy_check TEXT;
BEGIN
    SELECT COUNT(*) INTO insert_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'notifications'
    AND cmd = 'INSERT';
    
    IF insert_policy_count = 1 THEN
        SELECT with_check INTO insert_policy_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'notifications'
        AND cmd = 'INSERT'
        LIMIT 1;
        
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ INSERT Policy Verification';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Policy count: %', insert_policy_count;
        RAISE NOTICE 'WITH CHECK: %', insert_policy_check;
        
        IF insert_policy_check = 'true' OR insert_policy_check = '(true)' THEN
            RAISE NOTICE '✅ Policy is permissive - should allow all authenticated users';
        ELSE
            RAISE WARNING '⚠️ Policy check is: % (expected: true)', insert_policy_check;
        END IF;
        RAISE NOTICE '========================================';
    ELSE
        RAISE WARNING '❌ Expected 1 INSERT policy, found %', insert_policy_count;
    END IF;
END $$;

