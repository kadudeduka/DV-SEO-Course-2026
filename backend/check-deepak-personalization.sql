-- Check Deepak's personalization setup for Shah
-- Replace trainer_id and course_id with actual values from your database

-- 1. Find Deepak's trainer ID
SELECT id, email, full_name, role
FROM users
WHERE email LIKE '%deepak%' OR full_name ILIKE '%deepak%';

-- 2. Find Shah's learner ID
SELECT id, email, full_name, role
FROM users
WHERE email LIKE '%shah%' OR full_name ILIKE '%shah%';

-- 3. Check course allocation (replace IDs with actual values)
SELECT 
    ca.*,
    u.email as learner_email,
    u.full_name as learner_name,
    t.email as trainer_email,
    t.full_name as trainer_name
FROM course_allocations ca
JOIN users u ON ca.user_id = u.id
JOIN users t ON ca.trainer_id = t.id
WHERE u.email LIKE '%shah%' OR u.full_name ILIKE '%shah%'
AND (t.email LIKE '%deepak%' OR t.full_name ILIKE '%deepak%');

-- 4. Check ALL personalization records for Deepak (replace trainer_id with actual value)
-- Use the trainer_id from query 1 above
SELECT 
    tp.*,
    u.email as trainer_email,
    u.full_name as trainer_name
FROM ai_coach_trainer_personalization tp
JOIN users u ON tp.trainer_id = u.id
WHERE u.email LIKE '%deepak%' OR u.full_name ILIKE '%deepak%'
ORDER BY 
    CASE WHEN tp.course_id IS NULL THEN 0 ELSE 1 END,
    tp.course_id;

-- 5. Specific check for seo-master-2026 course (replace trainer_id with actual value)
SELECT 
    tp.*,
    u.email as trainer_email,
    u.full_name as trainer_name
FROM ai_coach_trainer_personalization tp
JOIN users u ON tp.trainer_id = u.id
WHERE (u.email LIKE '%deepak%' OR u.full_name ILIKE '%deepak%')
AND (tp.course_id = 'seo-master-2026' OR tp.course_id IS NULL);

