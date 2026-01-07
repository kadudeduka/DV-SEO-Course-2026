-- Create personalization for trainer Raj (raj@digital.com)
-- Trainer ID: 06f7809b-24fe-46f0-8fe4-22f07a5065af

-- STEP 1: Verify Raj exists and get his details
SELECT 
    id,
    name,
    email,
    role,
    full_name
FROM users
WHERE id = '06f7809b-24fe-46f0-8fe4-22f07a5065af'
   OR email = 'raj@digital.com';

-- STEP 2: Delete any existing personalization for Raj first (to avoid conflicts)
DELETE FROM ai_coach_trainer_personalization
WHERE trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af';

-- STEP 3: Create GLOBAL personalization for Raj (applies to all courses)
-- This will be used as fallback if course-specific personalization doesn't exist
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
    '06f7809b-24fe-46f0-8fe4-22f07a5065af',  -- Raj's trainer ID
    NULL,                                     -- NULL = global (applies to all courses)
    'Raj',                                    -- Coach name (update if needed)
    true,                                     -- Enabled
    'name_only',                              -- Share level (update if needed: 'name_only', 'name_expertise', 'full')
    '{}'::jsonb,                              -- Trainer info (empty for now, can add later)
    NOW(),
    NOW()
);

-- STEP 4: Create COURSE-SPECIFIC personalization for Raj for seo-master-2026
-- This will override the global setting for this specific course
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
    '06f7809b-24fe-46f0-8fe4-22f07a5065af',  -- Raj's trainer ID
    'seo-master-2026',                        -- Course ID
    'Raj',                                    -- Coach name (update if needed)
    true,                                     -- Enabled
    'name_only',                              -- Share level (update if needed)
    '{}'::jsonb,                              -- Trainer info (empty for now)
    NOW(),
    NOW()
);

-- STEP 5: Verify the personalization was created
SELECT 
    id,
    trainer_id,
    course_id,
    coach_name,
    personalization_enabled,
    share_level,
    created_at
FROM ai_coach_trainer_personalization
WHERE trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af'
ORDER BY course_id NULLS LAST;

-- STEP 6: Verify it will work for the learner
SELECT 
    ca.user_id as learner_id,
    ca.trainer_id,
    ca.course_id,
    u.name as learner_name,
    t.name as trainer_name,
    atp.coach_name,
    atp.personalization_enabled,
    atp.course_id as personalization_course_id,
    CASE 
        WHEN atp.course_id IS NULL THEN 'Global'
        ELSE 'Course-specific'
    END as personalization_type
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

