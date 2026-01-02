-- Fix: Create a database function to insert notifications
-- This function bypasses RLS by using SECURITY DEFINER
-- Run this in Supabase SQL Editor

-- Step 1: Create a function that can insert notifications
-- This function runs with the privileges of the function creator (postgres)
-- and can bypass RLS policies
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with elevated privileges
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    -- Insert the notification
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        metadata,
        read,
        created_at
    )
    VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_metadata,
        false,
        NOW()
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

-- Step 2: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO anon;

-- Step 3: Verify the function was created
SELECT 
    routine_name,
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_notification';

-- Step 4: Test the function (optional - uncomment to test)
/*
DO $$
DECLARE
    test_user_id UUID := '79923479-a63b-410f-9687-6f439d54702e'; -- Your admin user ID
    test_notification_id UUID;
BEGIN
    SELECT public.create_notification(
        test_user_id,
        'lab_submitted',
        'Test Notification',
        'Testing the create_notification function',
        '{}'::JSONB
    ) INTO test_notification_id;
    
    IF test_notification_id IS NOT NULL THEN
        RAISE NOTICE '✅ Function test successful. Notification ID: %', test_notification_id;
        DELETE FROM public.notifications WHERE id = test_notification_id;
        RAISE NOTICE '✅ Test notification cleaned up';
    ELSE
        RAISE WARNING '❌ Function test failed';
    END IF;
END $$;
*/

-- Step 5: Also ensure the INSERT policy exists as a fallback
-- (Keep the policy in case we want to use direct inserts later)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Step 6: Summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Notification Function Created';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Function: public.create_notification()';
    RAISE NOTICE 'Security: SECURITY DEFINER (bypasses RLS)';
    RAISE NOTICE '';
    RAISE NOTICE 'Usage from JavaScript:';
    RAISE NOTICE '  const { data, error } = await supabaseClient';
    RAISE NOTICE '    .rpc(''create_notification'', {';
    RAISE NOTICE '      p_user_id: userId,';
    RAISE NOTICE '      p_type: type,';
    RAISE NOTICE '      p_title: title,';
    RAISE NOTICE '      p_message: message,';
    RAISE NOTICE '      p_metadata: metadata';
    RAISE NOTICE '    });';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Update notification-service.js to use this function';
    RAISE NOTICE '========================================';
END $$;

