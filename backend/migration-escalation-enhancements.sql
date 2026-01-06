-- Migration: Enhance escalation table for hardened escalation flow
-- Purpose: Store violated invariants, full chunk details, and escalation triggers

-- ============================================================================
-- ADD NEW COLUMNS TO ESCALATION TABLE
-- ============================================================================

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS escalation_reason VARCHAR(50); -- 'blocked', 'low_confidence', 'invariant_violation', 'reference_validation_failed', 'strict_lab_missing'

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS violated_invariants JSONB DEFAULT '[]'::jsonb; -- Array of violated invariant objects

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS chunks_used JSONB; -- Full chunk details (not just IDs)

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS governance_details JSONB; -- Full governance check results

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS reference_validation_failed BOOLEAN DEFAULT false;

ALTER TABLE ai_coach_escalations 
ADD COLUMN IF NOT EXISTS confidence_downgraded BOOLEAN DEFAULT false;

-- ============================================================================
-- UPDATE EXISTING COLUMNS (if needed)
-- ============================================================================

-- Ensure ai_context can store more detailed information
-- (Already JSONB, so no change needed, but we'll document expected structure)

-- ============================================================================
-- INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_escalations_reason ON ai_coach_escalations(escalation_reason);
CREATE INDEX IF NOT EXISTS idx_escalations_invariants ON ai_coach_escalations USING GIN (violated_invariants);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN ai_coach_escalations.escalation_reason IS 'Reason for escalation: blocked, low_confidence, invariant_violation, reference_validation_failed, strict_lab_missing';
COMMENT ON COLUMN ai_coach_escalations.violated_invariants IS 'Array of violated invariant objects: [{type, severity, message, invariant}]';
COMMENT ON COLUMN ai_coach_escalations.chunks_used IS 'Full chunk details used in answer generation: [{id, day, chapter_id, chapter_title, content_type, similarity, ...}]';
COMMENT ON COLUMN ai_coach_escalations.governance_details IS 'Full governance check results: {violations, warnings, recommendations, actionDetails}';
COMMENT ON COLUMN ai_coach_escalations.reference_validation_failed IS 'True if reference validation failed (high confidence but wrong references)';
COMMENT ON COLUMN ai_coach_escalations.confidence_downgraded IS 'True if confidence was downgraded due to validation failure';

-- ============================================================================
-- UPDATE EXISTING ESCALATIONS (set default values)
-- ============================================================================

-- Set default escalation_reason for existing escalations based on confidence
UPDATE ai_coach_escalations
SET escalation_reason = CASE
    WHEN ai_confidence < 0.65 THEN 'low_confidence'
    ELSE 'unknown'
END
WHERE escalation_reason IS NULL;

-- ============================================================================
-- VIEW: Escalation Summary for Trainers
-- ============================================================================

CREATE OR REPLACE VIEW ai_coach_escalations_summary AS
SELECT 
    e.id,
    e.query_id,
    e.learner_id,
    e.trainer_id,
    e.original_question,
    e.escalation_reason,
    e.ai_confidence,
    e.status,
    e.created_at,
    e.trainer_response,
    e.trainer_responded_at,
    e.resolved_at,
    -- Count violated invariants
    jsonb_array_length(COALESCE(e.violated_invariants, '[]'::jsonb)) as invariant_violation_count,
    -- Extract critical violations
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(COALESCE(e.violated_invariants, '[]'::jsonb)) AS inv
        WHERE inv->>'severity' = 'critical'
    ) as critical_violations_count,
    -- Learner info
    l.full_name as learner_name,
    l.email as learner_email,
    -- Trainer info
    t.full_name as trainer_name,
    -- Query info
    q.intent,
    q.course_id
FROM ai_coach_escalations e
LEFT JOIN users l ON l.id = e.learner_id
LEFT JOIN users t ON t.id = e.trainer_id
LEFT JOIN ai_coach_queries q ON q.id = e.query_id;

COMMENT ON VIEW ai_coach_escalations_summary IS 'Summary view of escalations with learner, trainer, and violation counts';

