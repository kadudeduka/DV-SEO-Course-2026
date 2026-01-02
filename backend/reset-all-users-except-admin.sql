-- ============================================================================
-- RESET ALL USERS AND USER-RELATED DATA (EXCEPT ADMINS)
-- ============================================================================
-- This script deletes all non-admin users and all their related data
-- WARNING: This is a destructive operation. Run with caution!
-- 
-- What gets deleted:
-- - All non-admin users from public.users
-- - All user-related data (progress, submissions, allocations, etc.)
-- - All AI Coach data for non-admin users
-- - All notifications for non-admin users
-- - All reports cache for non-admin users
--
-- What is preserved:
-- - Admin users (role='admin' OR is_admin=true)
-- - Course structure and content (not user-specific)
-- - AI Coach content chunks (course content, not user data)
-- - Trainer personalization for admin trainers (if any)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Identify admin users (to preserve them)
-- ============================================================================
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    -- Count admin users
    SELECT COUNT(*) INTO admin_count
    FROM public.users
    WHERE (role = 'admin' OR is_admin = true);
    
    RAISE NOTICE 'Found % admin user(s) to preserve', admin_count;
    
    IF admin_count = 0 THEN
        RAISE WARNING 'No admin users found! Proceeding with deletion anyway...';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Delete AI Coach user-related data for non-admin users
-- ============================================================================

-- Delete AI Coach conversation history for non-admin learners
DELETE FROM public.ai_coach_conversation_history
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- Delete AI Coach feedback for non-admin learners
DELETE FROM public.ai_coach_feedback
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- Delete AI Coach escalations (both learner and trainer if non-admin)
DELETE FROM public.ai_coach_escalations
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)
OR trainer_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- Delete AI Coach responses (via cascade from queries)
-- Delete AI Coach queries for non-admin learners
DELETE FROM public.ai_coach_queries
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- Delete AI Coach trainer personalization for non-admin trainers
DELETE FROM public.ai_coach_trainer_personalization
WHERE trainer_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- ============================================================================
-- STEP 3: Delete reports and analytics data for non-admin users
-- ============================================================================

-- Delete report cache for non-admin users
DELETE FROM public.report_cache
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- Delete user tag assignments for non-admin users
DELETE FROM public.user_tag_assignments
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- ============================================================================
-- STEP 4: Delete lab submissions for non-admin users
-- ============================================================================

DELETE FROM public.lab_submissions
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- ============================================================================
-- STEP 5: Delete course allocations for non-admin users
-- ============================================================================

DELETE FROM public.course_allocations
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)
OR trainer_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- ============================================================================
-- STEP 6: Delete user progress for non-admin users
-- ============================================================================

DELETE FROM public.user_progress
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- ============================================================================
-- STEP 7: Delete notifications for non-admin users
-- ============================================================================

DELETE FROM public.notifications
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- ============================================================================
-- STEP 8: Delete admin approvals for non-admin users
-- ============================================================================

DELETE FROM public.admin_approvals
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)
OR approved_by IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)
OR rejected_by IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- ============================================================================
-- STEP 9: Delete non-admin users from public.users
-- ============================================================================

DELETE FROM public.users
WHERE (role != 'admin' AND is_admin != true);

-- ============================================================================
-- STEP 10: Clean up auth.users (optional - Supabase handles this via triggers)
-- ============================================================================
-- Note: If you have a trigger that deletes auth.users when public.users is deleted,
-- you may want to manually clean up orphaned auth.users records:
--
-- DELETE FROM auth.users
-- WHERE id NOT IN (SELECT id FROM public.users);
--
-- However, be careful with this as it might affect authentication.
-- It's safer to let Supabase handle auth.users cleanup via triggers.

-- ============================================================================
-- STEP 11: Reset sequences (optional - if you want to reset auto-increment IDs)
-- ============================================================================
-- Note: UUIDs don't use sequences, but if you have any integer IDs, you might
-- want to reset them. This is commented out as most tables use UUIDs.

-- ============================================================================
-- VERIFICATION: Count remaining users
-- ============================================================================
DO $$
DECLARE
    remaining_users INTEGER;
    admin_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_users FROM public.users;
    SELECT COUNT(*) INTO admin_users FROM public.users WHERE (role = 'admin' OR is_admin = true);
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESET COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total users remaining: %', remaining_users;
    RAISE NOTICE 'Admin users: %', admin_users;
    RAISE NOTICE 'Non-admin users: %', (remaining_users - admin_users);
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================
COMMIT;

-- ============================================================================
-- POST-RESET VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after the reset to verify:

-- Check remaining users
-- SELECT id, email, full_name, role, is_admin, status 
-- FROM public.users 
-- ORDER BY created_at;

-- Check if any user data remains (should all be 0)
-- SELECT 
--     (SELECT COUNT(*) FROM public.course_allocations) as allocations,
--     (SELECT COUNT(*) FROM public.user_progress) as progress,
--     (SELECT COUNT(*) FROM public.lab_submissions) as submissions,
--     (SELECT COUNT(*) FROM public.notifications) as notifications,
--     (SELECT COUNT(*) FROM public.ai_coach_queries) as ai_queries,
--     (SELECT COUNT(*) FROM public.ai_coach_responses) as ai_responses;

