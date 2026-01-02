-- ============================================================================
-- Fix RLS Policies for AI Coach
-- Adds missing INSERT policies for ai_coach_responses and ai_coach_escalations
-- ============================================================================

-- Allow system to insert responses for queries belonging to authenticated user
-- This is needed because the AI Coach service creates responses automatically
CREATE POLICY "System can insert responses for user queries"
ON ai_coach_responses FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM ai_coach_queries
        WHERE id = ai_coach_responses.query_id 
        AND learner_id = auth.uid()
    )
);

-- Also allow admins to insert responses (for testing/manual creation)
CREATE POLICY "Admins can insert responses"
ON ai_coach_responses FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Allow system to insert escalations for queries belonging to authenticated user
-- This is needed because the AI Coach service creates escalations automatically when confidence is low
CREATE POLICY "System can insert escalations for user queries"
ON ai_coach_escalations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM ai_coach_queries
        WHERE id = ai_coach_escalations.query_id 
        AND learner_id = auth.uid()
    )
    AND learner_id = auth.uid()
);

-- Also allow admins to insert escalations (for testing/manual creation)
CREATE POLICY "Admins can insert escalations"
ON ai_coach_escalations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

