-- Migration: Add question_text and learner_name to ai_coach_escalations
-- This allows storing the question text and learner name directly to avoid RLS issues when retrieving escalations

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS question_text TEXT;

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS learner_name TEXT;

-- Add comments
COMMENT ON COLUMN ai_coach_escalations.question_text IS 'Stored question text from ai_coach_queries.question to avoid RLS issues';
COMMENT ON COLUMN ai_coach_escalations.learner_name IS 'Stored learner name from users table to avoid RLS issues';

-- Backfill existing escalations (optional - can be run separately)
-- UPDATE ai_coach_escalations e
-- SET question_text = q.question
-- FROM ai_coach_queries q
-- WHERE e.question_id = q.id
-- AND e.question_text IS NULL;

-- UPDATE ai_coach_escalations e
-- SET learner_name = u.full_name || u.name || u.email
-- FROM users u
-- WHERE e.learner_id = u.id
-- AND e.learner_name IS NULL;

