-- Debug script to check AI Coach personalization setup
-- Run this to verify why personalization might not be working for a learner

-- Replace these values with actual values from your database
-- SET @learner_email = 'shah@example.com';  -- Replace with Shah's email
-- SET @trainer_email = 'deepak@example.com';  -- Replace with Deepak's email
-- SET @course_id = 'seo-master-2026';  -- Replace with actual course ID

-- 1. Check if learner exists and is a learner
SELECT 
    id,
    email,
    full_name,
    role,
    status
FROM users
WHERE email LIKE '%shah%' OR full_name ILIKE '%shah%';

-- 2. Check if trainer exists
SELECT 
    id,
    email,
    full_name,
    role,
    status
FROM users
WHERE email LIKE '%deepak%' OR full_name ILIKE '%deepak%';

-- 3. Check course allocation for the learner
SELECT 
    ca.*,
    u.email as learner_email,
    u.full_name as learner_name,
    t.email as trainer_email,
    t.full_name as trainer_name
FROM course_allocations ca
LEFT JOIN users u ON ca.user_id = u.id
LEFT JOIN users t ON ca.trainer_id = t.id
WHERE u.email LIKE '%shah%' OR u.full_name ILIKE '%shah%';

-- 4. Check trainer personalization (course-specific)
SELECT 
    tp.*,
    u.email as trainer_email,
    u.full_name as trainer_name
FROM ai_coach_trainer_personalization tp
JOIN users u ON tp.trainer_id = u.id
WHERE u.email LIKE '%deepak%' OR u.full_name ILIKE '%deepak%'
AND tp.course_id = 'seo-master-2026';  -- Replace with actual course ID

-- 5. Check trainer personalization (global)
SELECT 
    tp.*,
    u.email as trainer_email,
    u.full_name as trainer_name
FROM ai_coach_trainer_personalization tp
JOIN users u ON tp.trainer_id = u.id
WHERE u.email LIKE '%deepak%' OR u.full_name ILIKE '%deepak%'
AND tp.course_id IS NULL;

-- 6. Complete check: Get personalization for a specific learner-course combination
-- Replace the IDs below with actual values from queries above
WITH learner_info AS (
    SELECT id, email, full_name
    FROM users
    WHERE email LIKE '%shah%' OR full_name ILIKE '%shah%'
    LIMIT 1
),
trainer_info AS (
    SELECT id, email, full_name
    FROM users
    WHERE email LIKE '%deepak%' OR full_name ILIKE '%deepak%'
    LIMIT 1
),
allocation_info AS (
    SELECT 
        ca.user_id,
        ca.course_id,
        ca.trainer_id
    FROM course_allocations ca
    CROSS JOIN learner_info li
    CROSS JOIN trainer_info ti
    WHERE ca.user_id = li.id
    AND ca.trainer_id = ti.id
    AND ca.course_id = 'seo-master-2026'  -- Replace with actual course ID
    LIMIT 1
)
SELECT 
    li.email as learner_email,
    li.full_name as learner_name,
    ti.email as trainer_email,
    ti.full_name as trainer_name,
    ai.course_id,
    ai.trainer_id,
    tp_course.coach_name as course_coach_name,
    tp_course.personalization_enabled as course_enabled,
    tp_global.coach_name as global_coach_name,
    tp_global.personalization_enabled as global_enabled,
    COALESCE(tp_course.coach_name, tp_global.coach_name) as final_coach_name,
    COALESCE(tp_course.personalization_enabled, tp_global.personalization_enabled, false) as final_enabled
FROM learner_info li
CROSS JOIN trainer_info ti
LEFT JOIN allocation_info ai ON ai.user_id = li.id AND ai.trainer_id = ti.id
LEFT JOIN ai_coach_trainer_personalization tp_course 
    ON tp_course.trainer_id = ti.id 
    AND tp_course.course_id = ai.course_id
LEFT JOIN ai_coach_trainer_personalization tp_global 
    ON tp_global.trainer_id = ti.id 
    AND tp_global.course_id IS NULL;

