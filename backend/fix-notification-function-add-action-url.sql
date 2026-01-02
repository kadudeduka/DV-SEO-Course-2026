-- Update: Add action_url parameter to create_notification function
-- Run this in Supabase SQL Editor after running migration 005_add_notification_action_url.sql

-- Drop and recreate the function with action_url support
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'::JSONB,
    p_action_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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
        action_url,
        read,
        created_at
    )
    VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_metadata,
        p_action_url,
        false,
        NOW()
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

-- Verify the function was updated
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_notification';

