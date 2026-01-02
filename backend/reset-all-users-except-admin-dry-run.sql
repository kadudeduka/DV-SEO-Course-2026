-- ============================================================================
-- DRY RUN: Preview what will be deleted (NO ACTUAL DELETION)
-- ============================================================================
-- Run this first to see what will be deleted before running the actual reset
-- ============================================================================

-- Count users to be deleted
SELECT 
    'Users to be deleted' as category,
    COUNT(*) as count
FROM public.users
WHERE (role != 'admin' AND is_admin != true)

UNION ALL

-- Count AI Coach queries
SELECT 
    'AI Coach Queries',
    COUNT(*)
FROM public.ai_coach_queries
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count AI Coach responses
SELECT 
    'AI Coach Responses',
    COUNT(*)
FROM public.ai_coach_responses
WHERE query_id IN (
    SELECT id FROM public.ai_coach_queries
    WHERE learner_id IN (
        SELECT id FROM public.users 
        WHERE (role != 'admin' AND is_admin != true)
    )
)

UNION ALL

-- Count AI Coach escalations
SELECT 
    'AI Coach Escalations',
    COUNT(*)
FROM public.ai_coach_escalations
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)
OR trainer_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count AI Coach feedback
SELECT 
    'AI Coach Feedback',
    COUNT(*)
FROM public.ai_coach_feedback
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count AI Coach conversation history
SELECT 
    'AI Coach Conversation History',
    COUNT(*)
FROM public.ai_coach_conversation_history
WHERE learner_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count course allocations
SELECT 
    'Course Allocations',
    COUNT(*)
FROM public.course_allocations
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)
OR trainer_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count user progress
SELECT 
    'User Progress',
    COUNT(*)
FROM public.user_progress
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count lab submissions
SELECT 
    'Lab Submissions',
    COUNT(*)
FROM public.lab_submissions
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count notifications
SELECT 
    'Notifications',
    COUNT(*)
FROM public.notifications
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count admin approvals
SELECT 
    'Admin Approvals',
    COUNT(*)
FROM public.admin_approvals
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count report cache
SELECT 
    'Report Cache',
    COUNT(*)
FROM public.report_cache
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count user tag assignments
SELECT 
    'User Tag Assignments',
    COUNT(*)
FROM public.user_tag_assignments
WHERE user_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
)

UNION ALL

-- Count trainer personalization
SELECT 
    'Trainer Personalization',
    COUNT(*)
FROM public.ai_coach_trainer_personalization
WHERE trainer_id IN (
    SELECT id FROM public.users 
    WHERE (role != 'admin' AND is_admin != true)
);

-- Show admin users that will be preserved
SELECT 
    'Admin users to preserve' as info,
    id,
    email,
    full_name,
    role,
    is_admin,
    status
FROM public.users
WHERE (role = 'admin' OR is_admin = true)
ORDER BY created_at;

-- Show non-admin users that will be deleted (first 20)
SELECT 
    'Non-admin users to delete (showing first 20)' as info,
    id,
    email,
    full_name,
    role,
    is_admin,
    status,
    created_at
FROM public.users
WHERE (role != 'admin' AND is_admin != true)
ORDER BY created_at
LIMIT 20;

