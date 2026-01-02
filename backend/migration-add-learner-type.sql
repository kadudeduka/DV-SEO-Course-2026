-- Migration: Add learner_type field to users table
-- Run this in Supabase SQL Editor

-- Add learner_type column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS learner_type TEXT 
CHECK (learner_type IN ('active', 'inactive', 'graduate', 'archive') OR learner_type IS NULL);

-- Add comment to explain the field
COMMENT ON COLUMN public.users.learner_type IS 
'Learner type: active (has incomplete courses, has trainer), inactive (no trainer, read-only), graduate (completed all + certification), archive (no access)';

-- Set default learner_type for existing approved learners
-- Active learners: have trainer_id and are approved
UPDATE public.users 
SET learner_type = 'active' 
WHERE role = 'learner' 
  AND status = 'approved' 
  AND trainer_id IS NOT NULL
  AND learner_type IS NULL;

-- Set learner_type to NULL for trainers and admins (they don't have learner types)
UPDATE public.users 
SET learner_type = NULL 
WHERE role IN ('trainer', 'admin');

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_learner_type ON public.users(learner_type);

-- Create index for trainer_id + learner_type queries
CREATE INDEX IF NOT EXISTS idx_users_trainer_learner_type ON public.users(trainer_id, learner_type) 
WHERE trainer_id IS NOT NULL;

