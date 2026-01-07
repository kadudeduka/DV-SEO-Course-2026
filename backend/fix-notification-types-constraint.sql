-- Fix: Add missing notification types to database constraint
-- Run this in Supabase SQL Editor

-- Step 1: Check current constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass
AND conname = 'notifications_type_check';

-- Step 2: Drop the existing constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Step 3: Add new constraint with ALL notification types
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'user_registered',
    'user_approved',
    'trainer_assigned',
    'course_allocated',
    'lab_submitted',
    'lab_reviewed',
    'escalation'
));

-- Step 4: Verify the constraint was updated
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass
AND conname = 'notifications_type_check';

-- Step 5: Test all notification types
DO $$
DECLARE
    test_user_id UUID := '79923479-a63b-410f-9687-6f439d54702e'; -- Your admin user ID
    test_types TEXT[] := ARRAY[
        'user_registered',
        'user_approved',
        'trainer_assigned',
        'course_allocated',
        'lab_submitted',
        'lab_reviewed',
        'escalation'
    ];
    test_type TEXT;
    test_id UUID;
    success_count INTEGER := 0;
    fail_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Testing all notification types...';
    RAISE NOTICE '';
    
    FOREACH test_type IN ARRAY test_types
    LOOP
        BEGIN
            INSERT INTO public.notifications (user_id, type, title, message)
            VALUES (
                test_user_id,
                test_type,
                'Test: ' || test_type,
                'Testing notification type: ' || test_type
            )
            RETURNING id INTO test_id;
            
            -- Clean up
            DELETE FROM public.notifications WHERE id = test_id;
            
            success_count := success_count + 1;
            RAISE NOTICE '✅ Type "%" is allowed', test_type;
        EXCEPTION
            WHEN OTHERS THEN
                fail_count := fail_count + 1;
                RAISE WARNING '❌ Type "%" is NOT allowed: %', test_type, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Summary: % succeeded, % failed', success_count, fail_count;
    IF fail_count = 0 THEN
        RAISE NOTICE '✅ All notification types are working!';
    ELSE
        RAISE WARNING '⚠️ Some notification types are still not working';
    END IF;
    RAISE NOTICE '========================================';
END $$;

