-- Fix RLS Policy: Allow trainers to read learners assigned to them
-- Run this in Supabase SQL Editor

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Trainers can read assigned learners" ON public.users;

-- Create policy for trainers to read learners assigned to them
CREATE POLICY "Trainers can read assigned learners"
    ON public.users
    FOR SELECT
    USING (
        -- Trainers can read learners where trainer_id matches their own ID
        trainer_id = auth.uid()
        AND role = 'learner'
    );

-- Verify the policy was created
SELECT 'Trainer read learners policy created successfully!' as status;

