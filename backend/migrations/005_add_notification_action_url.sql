-- Migration: Add action_url column to notifications table
-- This allows notifications to link to specific pages where action is needed
-- Run this in Supabase SQL Editor

-- Add action_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'action_url'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN action_url TEXT;
        CREATE INDEX IF NOT EXISTS idx_notifications_action_url ON public.notifications(action_url) WHERE action_url IS NOT NULL;
        COMMENT ON COLUMN public.notifications.action_url IS 'Optional URL to navigate to when notification is clicked (e.g., /admin/dashboard, /trainer/lab-review, /courses/:id)';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'notifications'
AND column_name = 'action_url';

