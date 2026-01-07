-- Fix trainer ID mismatch - Find Raj's correct user ID and update course_allocations
-- The trainer_id in course_allocations (06f7809b-24fe-46f0-8fe4-22f07a5065af) doesn't exist in users table

-- STEP 1: Find Raj's correct user ID by email
SELECT 
    id,
    name,
    email,
    role,
    full_name
FROM users
WHERE email = 'raj@digital.com'
   OR name ILIKE '%raj%'
   OR full_name ILIKE '%raj%';

-- STEP 2: Check current course_allocations for this learner
SELECT 
    ca.id,
    ca.user_id as learner_id,
    ca.trainer_id as current_trainer_id,
    ca.course_id,
    u.name as learner_name,
    t.name as trainer_name,
    t.email as trainer_email,
    t.id as trainer_user_id
FROM course_allocations ca
LEFT JOIN users u ON u.id = ca.user_id
LEFT JOIN users t ON t.id = ca.trainer_id
WHERE ca.course_id = 'seo-master-2026'
  AND ca.user_id = '4eb79cb9-f376-4c46-bc69-6db29b66de22';

-- STEP 3: Find the correct trainer_id for Raj
-- Replace 'RAJ_CORRECT_ID_HERE' with the ID from STEP 1
-- Then uncomment and run this UPDATE:
/*
UPDATE course_allocations
SET trainer_id = 'RAJ_CORRECT_ID_HERE'  -- Replace with Raj's actual user ID from STEP 1
WHERE course_id = 'seo-master-2026'
  AND user_id = '4eb79cb9-f376-4c46-bc69-6db29b66de22'
  AND trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af';
*/

-- STEP 4: After updating course_allocations, create personalization for Raj's correct ID
-- Replace 'RAJ_CORRECT_ID_HERE' with the ID from STEP 1
/*
-- Delete any existing personalization for the old (wrong) trainer_id
DELETE FROM ai_coach_trainer_personalization
WHERE trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af';

-- Create GLOBAL personalization for Raj (correct ID)
INSERT INTO ai_coach_trainer_personalization (
    trainer_id,
    course_id,  -- NULL = global
    coach_name,
    personalization_enabled,
    share_level,
    trainer_info,
    created_at,
    updated_at
)
VALUES (
    'RAJ_CORRECT_ID_HERE',  -- Replace with Raj's actual user ID
    NULL,                    -- NULL = global
    'Raj',                   -- Coach name
    true,                    -- Enabled
    'name_only',             -- Share level
    '{}'::jsonb,             -- Trainer info
    NOW(),
    NOW()
);

-- Create COURSE-SPECIFIC personalization for Raj
INSERT INTO ai_coach_trainer_personalization (
    trainer_id,
    course_id,
    coach_name,
    personalization_enabled,
    share_level,
    trainer_info,
    created_at,
    updated_at
)
VALUES (
    'RAJ_CORRECT_ID_HERE',  -- Replace with Raj's actual user ID
    'seo-master-2026',       -- Course ID
    'Raj',                   -- Coach name
    true,                    -- Enabled
    'name_only',             -- Share level
    '{}'::jsonb,             -- Trainer info
    NOW(),
    NOW()
);
*/

-- STEP 5: Verify the fix
SELECT 
    ca.user_id as learner_id,
    ca.trainer_id,
    ca.course_id,
    u.name as learner_name,
    t.name as trainer_name,
    t.email as trainer_email,
    atp.coach_name,
    atp.personalization_enabled,
    atp.course_id as personalization_course_id
FROM course_allocations ca
LEFT JOIN users u ON u.id = ca.user_id
LEFT JOIN users t ON t.id = ca.trainer_id
LEFT JOIN ai_coach_trainer_personalization atp ON (
    atp.trainer_id = ca.trainer_id 
    AND (atp.course_id = ca.course_id OR atp.course_id IS NULL)
    AND atp.personalization_enabled = true
)
WHERE ca.course_id = 'seo-master-2026'
  AND ca.user_id = '4eb79cb9-f376-4c46-bc69-6db29b66de22'
ORDER BY 
    CASE WHEN atp.course_id IS NULL THEN 1 ELSE 0 END,  -- Course-specific first
    atp.course_id NULLS LAST
LIMIT 1;

