-- ============================================================================
-- Fix RLS Policies for ai_coach_conversation_history
-- Adds missing INSERT policies to allow learners to store their conversation history
-- ============================================================================

-- Allow learners to insert their own conversation history
-- This is needed because the AI Coach service creates conversation history automatically
-- The foreign key constraints on query_id and response_id ensure data integrity
CREATE POLICY "Learners can insert own conversation history"
ON ai_coach_conversation_history FOR INSERT
WITH CHECK (
    auth.uid() = learner_id
);

-- Also allow admins to insert conversation history (for testing/manual creation)
CREATE POLICY "Admins can insert conversation history"
ON ai_coach_conversation_history FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);


