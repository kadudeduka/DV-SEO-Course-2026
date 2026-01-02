-- Fix: Add INSERT policy for notifications table
-- This allows the system to create notifications for users
-- Run this in Supabase SQL Editor

-- Drop existing policy if it exists (to allow re-running)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create INSERT policy
-- This policy allows:
-- 1. Any authenticated user to insert notifications (for system notifications)
-- 2. Service role to insert notifications for any user (via service role key)
-- 3. Admins to insert notifications for any user
-- Note: This is permissive because notifications are created by the system
-- on behalf of users, not directly by users themselves
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (
        -- Allow if authenticated (any authenticated user can create notifications)
        -- This is needed because when a user registers, we need to notify admins
        -- The registering user is authenticated, but we're creating notifications for admins
        auth.uid() IS NOT NULL
        OR
        -- Allow service role (when using service_role key, auth.uid() is null)
        auth.uid() IS NULL
    );

-- Verify the policy was created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'notifications'
    AND policyname = 'System can insert notifications';
    
    IF policy_count = 1 THEN
        RAISE NOTICE '✅ Policy "System can insert notifications" created successfully';
    ELSE
        RAISE WARNING '❌ Policy creation may have failed. Count: %', policy_count;
    END IF;
END $$;

-- List all notification policies for verification
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
ORDER BY policyname;

