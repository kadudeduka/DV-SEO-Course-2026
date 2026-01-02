-- Fix RLS policy for ai_coach_trainer_personalization
-- Allow learners to read their assigned trainer's personalization

-- Drop existing policy if it exists (we'll recreate it)
DROP POLICY IF EXISTS "Learners can read assigned trainer personalization" ON ai_coach_trainer_personalization;

-- Create policy to allow learners to read their assigned trainer's personalization
-- This policy allows:
-- 1. Trainers to read their own personalization (already covered by existing policy, but included for clarity)
-- 2. Admins to read all personalization (already covered by existing policy, but included for clarity)
-- 3. Learners to read their assigned trainer's personalization (NEW - this is what was missing!)
CREATE POLICY "Learners can read assigned trainer personalization"
ON ai_coach_trainer_personalization FOR SELECT
USING (
    -- Allow if user is the trainer themselves
    auth.uid() = trainer_id
    OR
    -- Allow if user is an admin
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Allow if user is a learner assigned to this trainer
    -- Check if learner is assigned to this trainer for any course
    EXISTS (
        SELECT 1 
        FROM course_allocations ca
        JOIN users u ON u.id = auth.uid()
        WHERE ca.user_id = auth.uid()
        AND ca.trainer_id = ai_coach_trainer_personalization.trainer_id
        AND u.role = 'learner'
        AND (
            -- Match course-specific personalization (course_id matches)
            (ai_coach_trainer_personalization.course_id IS NOT NULL 
             AND ca.course_id = ai_coach_trainer_personalization.course_id)
            OR
            -- Match global personalization (course_id IS NULL - applies to all courses)
            ai_coach_trainer_personalization.course_id IS NULL
        )
    )
);

