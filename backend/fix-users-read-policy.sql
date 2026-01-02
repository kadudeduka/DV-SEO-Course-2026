-- Fix: Allow users to read admin users for notification purposes
-- This is needed so that when a new user registers, the system can find admins to notify
-- Run this in Supabase SQL Editor

-- Check existing policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'users'
ORDER BY policyname;

-- Drop existing policy if it exists (to allow re-running)
DROP POLICY IF EXISTS "Users can read admin users" ON public.users;

-- Create policy to allow reading admin users
-- This allows any authenticated user to read users with role = 'admin'
-- This is needed for the notification system to find admins when a new user registers
CREATE POLICY "Users can read admin users"
    ON public.users FOR SELECT
    USING (
        -- Allow reading users who are admins
        role = 'admin' OR is_admin = TRUE
    );

-- Verify the policy was created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'users'
    AND policyname = 'Users can read admin users';
    
    IF policy_count = 1 THEN
        RAISE NOTICE '✅ Policy "Users can read admin users" created successfully';
    ELSE
        RAISE WARNING '❌ Policy creation may have failed. Count: %', policy_count;
    END IF;
END $$;

-- List all user policies for verification
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'users'
ORDER BY policyname;

