-- Debug script to check trainer personalization setup
-- Run this in Supabase SQL editor to diagnose issues

-- 1. Check if trainer exists in users table
SELECT 
    id,
    name,
    email,
    role,
    full_name
FROM users
WHERE id = '06f7809b-24fe-46f0-8fe4-22f07a5065af';

-- 2. Check course allocations for this trainer
SELECT 
    ca.user_id as learner_id,
    ca.trainer_id,
    ca.course_id,
    u.name as learner_name,
    t.name as trainer_name,
    t.role as trainer_role
FROM course_allocations ca
LEFT JOIN users u ON u.id = ca.user_id
LEFT JOIN users t ON t.id = ca.trainer_id
WHERE ca.trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af'
   OR ca.course_id = 'seo-master-2026'
LIMIT 10;

-- 3. Check all personalizations in the table
SELECT 
    id,
    trainer_id,
    course_id,
    coach_name,
    personalization_enabled,
    share_level
FROM ai_coach_trainer_personalization
ORDER BY trainer_id, course_id NULLS LAST
LIMIT 20;

-- 4. Check if personalization exists for this specific trainer
SELECT 
    id,
    trainer_id,
    course_id,
    coach_name,
    personalization_enabled,
    share_level
FROM ai_coach_trainer_personalization
WHERE trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af';

-- 5. Check global personalization (course_id IS NULL) for this trainer
SELECT 
    id,
    trainer_id,
    course_id,
    coach_name,
    personalization_enabled,
    share_level
FROM ai_coach_trainer_personalization
WHERE trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af'
  AND course_id IS NULL;

-- 6. Check course-specific personalization for this trainer and course
SELECT 
    id,
    trainer_id,
    course_id,
    coach_name,
    personalization_enabled,
    share_level
FROM ai_coach_trainer_personalization
WHERE trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af'
  AND course_id = 'seo-master-2026';

