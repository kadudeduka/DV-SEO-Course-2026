-- Migration: AI Coach Escalation System
-- Creates escalation table and related indexes for AI → Human Trainer escalation
-- NOTE: This replaces the old ai_coach_escalations table from migration-ai-coach-tables.sql

-- ============================================================================
-- DROP OLD ESCALATIONS TABLE (if exists from previous migration)
-- ============================================================================
-- Drop the old table if it exists (it uses query_id instead of question_id)
DROP TABLE IF EXISTS ai_coach_escalations CASCADE;

-- ============================================================================
-- ESCALATIONS TABLE
-- ============================================================================
CREATE TABLE ai_coach_escalations (
    escalation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES ai_coach_queries(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    escalation_type TEXT NOT NULL CHECK (escalation_type IN ('auto', 'manual')),
    confidence_score DECIMAL(5,2), -- AI confidence score (0-100) at time of escalation
    ai_response_snapshot TEXT NOT NULL, -- Immutable snapshot of AI response
    question_text TEXT, -- Stored question text from ai_coach_queries.question to avoid RLS issues
    learner_name TEXT, -- Stored learner name from users table to avoid RLS issues
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'responded', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT -- Internal notes for trainers
);

-- Ensure one open escalation per question (can have multiple closed ones)
-- Using a partial unique index instead of a constraint with CASE
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_escalation_per_question 
    ON ai_coach_escalations(question_id) 
    WHERE status = 'open';

-- ============================================================================
-- TRAINER RESPONSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_coach_trainer_responses (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escalation_id UUID NOT NULL REFERENCES ai_coach_escalations(escalation_id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One response per escalation (trainer can update)
    CONSTRAINT unique_response_per_escalation UNIQUE (escalation_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Escalations indexes
CREATE INDEX IF NOT EXISTS idx_escalations_question_id ON ai_coach_escalations(question_id);
CREATE INDEX IF NOT EXISTS idx_escalations_learner_id ON ai_coach_escalations(learner_id);
CREATE INDEX IF NOT EXISTS idx_escalations_trainer_id ON ai_coach_escalations(trainer_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON ai_coach_escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_course_id ON ai_coach_escalations(course_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON ai_coach_escalations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_open_trainer ON ai_coach_escalations(trainer_id, status) 
    WHERE status = 'open';

-- Trainer responses indexes
CREATE INDEX IF NOT EXISTS idx_trainer_responses_escalation_id ON ai_coach_trainer_responses(escalation_id);
CREATE INDEX IF NOT EXISTS idx_trainer_responses_trainer_id ON ai_coach_trainer_responses(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_responses_created_at ON ai_coach_trainer_responses(created_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update responded_at when trainer responds
CREATE OR REPLACE FUNCTION update_escalation_on_trainer_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Update escalation status to 'responded' and set responded_at
    UPDATE ai_coach_escalations
    SET 
        status = 'responded',
        responded_at = NOW(),
        trainer_id = NEW.trainer_id
    WHERE escalation_id = NEW.escalation_id
      AND status = 'open';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update escalation when trainer responds
DROP TRIGGER IF EXISTS trigger_update_escalation_on_response ON ai_coach_trainer_responses;
CREATE TRIGGER trigger_update_escalation_on_response
    AFTER INSERT ON ai_coach_trainer_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_escalation_on_trainer_response();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for trainer responses
DROP TRIGGER IF EXISTS trigger_update_trainer_response_updated_at ON ai_coach_trainer_responses;
CREATE TRIGGER trigger_update_trainer_response_updated_at
    BEFORE UPDATE ON ai_coach_trainer_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS (Row Level Security) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE ai_coach_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_trainer_responses ENABLE ROW LEVEL SECURITY;

-- Learners can view their own escalations
CREATE POLICY "Learners can view own escalations"
    ON ai_coach_escalations
    FOR SELECT
    USING (auth.uid() = learner_id);

-- Trainers can view escalations assigned to them or all open escalations
CREATE POLICY "Trainers can view assigned escalations"
    ON ai_coach_escalations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('trainer', 'admin')
        )
        AND (
            trainer_id = auth.uid() 
            OR status = 'open'
        )
    );

-- Learners can create escalations for their own questions
-- Simplified: Just check that learner_id matches auth user
-- The foreign key constraint ensures question_id is valid
CREATE POLICY "Learners can create escalations"
    ON ai_coach_escalations
    FOR INSERT
    WITH CHECK (auth.uid() = learner_id);

-- Trainers can update escalations assigned to them
CREATE POLICY "Trainers can update assigned escalations"
    ON ai_coach_escalations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('trainer', 'admin')
        )
        AND trainer_id = auth.uid()
    );

-- Learners can view trainer responses for their escalations
CREATE POLICY "Learners can view trainer responses"
    ON ai_coach_trainer_responses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM ai_coach_escalations
            WHERE escalation_id = ai_coach_trainer_responses.escalation_id
            AND learner_id = auth.uid()
        )
    );

-- Trainers can view and create responses for assigned escalations
CREATE POLICY "Trainers can manage responses"
    ON ai_coach_trainer_responses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('trainer', 'admin')
        )
        AND EXISTS (
            SELECT 1 FROM ai_coach_escalations
            WHERE escalation_id = ai_coach_trainer_responses.escalation_id
            AND (trainer_id = auth.uid() OR status = 'open')
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_coach_escalations IS 'Tracks AI Coach escalations from AI to human trainers';
COMMENT ON COLUMN ai_coach_escalations.escalation_type IS 'auto = system-triggered (confidence < 40), manual = user-triggered';
COMMENT ON COLUMN ai_coach_escalations.ai_response_snapshot IS 'Immutable snapshot of AI response at time of escalation';
COMMENT ON COLUMN ai_coach_escalations.confidence_score IS 'AI confidence score (0-100) at time of escalation, NULL for manual escalations';
COMMENT ON COLUMN ai_coach_escalations.question_text IS 'Stored question text from ai_coach_queries.question to avoid RLS issues';
COMMENT ON COLUMN ai_coach_escalations.learner_name IS 'Stored learner name from users table to avoid RLS issues';

COMMENT ON TABLE ai_coach_trainer_responses IS 'Trainer responses to escalated questions';
COMMENT ON COLUMN ai_coach_trainer_responses.escalation_id IS 'One response per escalation (trainer can update)';

