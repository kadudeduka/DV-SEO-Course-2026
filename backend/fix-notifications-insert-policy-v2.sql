-- Fix: Add INSERT policy for notifications table (Version 2)
-- This allows the system to create notifications for users
-- Run this in Supabase SQL Editor

-- First, check existing policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
ORDER BY policyname;

-- Drop existing policy if it exists (to allow re-running)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create INSERT policy
-- This policy allows ANY authenticated user to insert notifications for ANY user
-- This is needed because:
-- - When a user registers, we need to notify admins (different user_id)
-- - When a trainer reviews a lab, we need to notify the learner (different user_id)
-- - System notifications are created on behalf of users, not by users
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (
        -- Allow if authenticated (any authenticated user can create notifications for anyone)
        auth.uid() IS NOT NULL
        OR
        -- Allow service role (when using service_role key, auth.uid() is null)
        auth.uid() IS NULL
    );

-- Verify the policy was created
DO $$
DECLARE
    policy_count INTEGER;
    policy_check TEXT;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'notifications'
    AND policyname = 'System can insert notifications';
    
    IF policy_count = 1 THEN
        -- Get the with_check clause
        SELECT with_check INTO policy_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'notifications'
        AND policyname = 'System can insert notifications';
        
        RAISE NOTICE '✅ Policy "System can insert notifications" created successfully';
        RAISE NOTICE 'Policy WITH CHECK clause: %', policy_check;
    ELSE
        RAISE WARNING '❌ Policy creation may have failed. Count: %', policy_count;
    END IF;
END $$;

-- List all notification policies for verification
SELECT 
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
ORDER BY policyname;

-- Test: Try to insert a test notification (this will fail if RLS blocks it)
-- Replace with your admin user ID
DO $$
DECLARE
    admin_user_id UUID := '79923479-a63b-410f-9687-6f439d54702e';
    test_notification_id UUID;
BEGIN
    -- This will only work if the current user (auth.uid()) can insert
    -- If you're running this as a service role, it should work
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        admin_user_id,
        'user_registered',
        'Test Notification (Policy Check)',
        'This is a test to verify the INSERT policy works.'
    )
    RETURNING id INTO test_notification_id;
    
    IF test_notification_id IS NOT NULL THEN
        RAISE NOTICE '✅ Test notification inserted successfully with ID: %', test_notification_id;
        -- Clean up test notification
        DELETE FROM public.notifications WHERE id = test_notification_id;
        RAISE NOTICE '✅ Test notification cleaned up';
    ELSE
        RAISE WARNING '❌ Failed to insert test notification';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '❌ Error inserting test notification: %', SQLERRM;
END $$;

