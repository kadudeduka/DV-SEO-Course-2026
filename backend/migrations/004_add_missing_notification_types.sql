-- Migration: Add missing notification types
-- Adds 'trainer_assigned' and 'course_allocated' to the notification type constraint
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with all notification types
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'user_registered',
    'user_approved',
    'trainer_assigned',
    'course_allocated',
    'lab_submitted',
    'lab_reviewed'
));

-- Verify the constraint
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'notifications_type_check'
        AND conrelid = 'public.notifications'::regclass
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✅ Notification type constraint updated successfully';
    ELSE
        RAISE WARNING '❌ Constraint update may have failed';
    END IF;
END $$;

-- List all notification types in the constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass
AND conname = 'notifications_type_check';

