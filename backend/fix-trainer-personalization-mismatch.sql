    -- Fix trainer personalization mismatch
    -- This script helps identify and fix the mismatch between trainer_id in course_allocations
    -- and trainer_id in ai_coach_trainer_personalization

    -- STEP 1: Check current state
    -- Show which trainer the learner is allocated to
    SELECT 
        ca.user_id as learner_id,
        ca.trainer_id as allocated_trainer_id,
        ca.course_id,
        u.name as learner_name,
        t_allocated.name as allocated_trainer_name,
        t_allocated.email as allocated_trainer_email
    FROM course_allocations ca
    LEFT JOIN users u ON u.id = ca.user_id
    LEFT JOIN users t_allocated ON t_allocated.id = ca.trainer_id
    WHERE ca.course_id = 'seo-master-2026'
    AND ca.user_id = '4eb79cb9-f376-4c46-bc69-6db29b66de22';

    -- STEP 2: Show which trainer has personalization set up
    SELECT 
        atp.trainer_id as personalized_trainer_id,
        atp.course_id,
        atp.coach_name,
        atp.personalization_enabled,
        t_personalized.name as personalized_trainer_name,
        t_personalized.email as personalized_trainer_email
    FROM ai_coach_trainer_personalization atp
    LEFT JOIN users t_personalized ON t_personalized.id = atp.trainer_id
    WHERE atp.course_id = 'seo-master-2026' OR atp.course_id IS NULL
    ORDER BY atp.course_id NULLS LAST;

    -- STEP 3: OPTION A - Update course_allocations to use the trainer with personalization
    -- (Only run this if the learner should be assigned to the trainer with personalization)
    /*
    UPDATE course_allocations
    SET trainer_id = '24ade319-3713-460d-8c72-9e2f7d649381'
    WHERE course_id = 'seo-master-2026'
    AND user_id = '4eb79cb9-f376-4c46-bc69-6db29b66de22'
    AND trainer_id = '06f7809b-24fe-46f0-8fe4-22f07a5065af';
    */

    -- STEP 4: OPTION B - Create personalization for the current trainer
    -- (Only run this if the learner should stay with current trainer and you want to add personalization for that trainer)
    /*
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
        '06f7809b-24fe-46f0-8fe4-22f07a5065af',  -- Current trainer ID
        'seo-master-2026',                        -- Course ID
        'AI Coach',                               -- Coach name (update as needed)
        true,                                     -- Enabled
        'name_only',                              -- Share level
        '{}'::jsonb,                              -- Trainer info (empty for now)
        NOW(),
        NOW()
    )
    ON CONFLICT (trainer_id, course_id) DO UPDATE
    SET 
        coach_name = EXCLUDED.coach_name,
        personalization_enabled = EXCLUDED.personalization_enabled,
        share_level = EXCLUDED.share_level,
        updated_at = NOW();
    */

    -- STEP 5: OPTION C - Create global personalization for the current trainer
    -- (This will apply to all courses for this trainer)
    /*
    INSERT INTO ai_coach_trainer_personalization (
        trainer_id,
        course_id,  -- NULL for global
        coach_name,
        personalization_enabled,
        share_level,
        trainer_info,
        created_at,
        updated_at
    )
    VALUES (
        '06f7809b-24fe-46f0-8fe4-22f07a5065af',  -- Current trainer ID
        NULL,                                     -- NULL = global
        'AI Coach',                               -- Coach name (update as needed)
        true,                                     -- Enabled
        'name_only',                              -- Share level
        '{}'::jsonb,                              -- Trainer info (empty for now)
        NOW(),
        NOW()
    )
    ON CONFLICT (trainer_id, course_id) DO UPDATE
    SET 
        coach_name = EXCLUDED.coach_name,
        personalization_enabled = EXCLUDED.personalization_enabled,
        share_level = EXCLUDED.share_level,
        updated_at = NOW();
    */

    -- STEP 6: Verify the fix
    -- After running one of the options above, verify the fix:
    SELECT 
        ca.user_id as learner_id,
        ca.trainer_id,
        ca.course_id,
        atp.coach_name,
        atp.personalization_enabled,
        atp.course_id as personalization_course_id
    FROM course_allocations ca
    LEFT JOIN ai_coach_trainer_personalization atp ON (
        atp.trainer_id = ca.trainer_id 
        AND (atp.course_id = ca.course_id OR atp.course_id IS NULL)
        AND atp.personalization_enabled = true
    )
    WHERE ca.course_id = 'seo-master-2026'
    AND ca.user_id = '4eb79cb9-f376-4c46-bc69-6db29b66de22'
    ORDER BY atp.course_id NULLS LAST
    LIMIT 1;

