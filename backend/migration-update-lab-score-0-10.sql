-- Migration: Update Lab Score to 0-10 Scale
-- Description: Changes lab_submissions.score constraint from 0-100 to 0-10
-- Date: 2025-01-29

-- Update the score column constraint to 0-10
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE public.lab_submissions 
    DROP CONSTRAINT IF EXISTS lab_submissions_score_check;
    
    -- Add new constraint for 0-10 scale
    ALTER TABLE public.lab_submissions
    ADD CONSTRAINT lab_submissions_score_check 
    CHECK (score IS NULL OR (score >= 0 AND score <= 10));
    
    -- Update existing scores from 0-100 scale to 0-10 scale (if any exist)
    -- This converts percentage scores to 0-10 scale
    UPDATE public.lab_submissions
    SET score = score / 10.0
    WHERE score IS NOT NULL AND score > 10;
    
    RAISE NOTICE 'Lab score constraint updated to 0-10 scale';
END $$;

