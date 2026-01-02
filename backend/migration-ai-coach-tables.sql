-- AI Coach Database Migration
-- Version: 1.0
-- Date: 2025-01-29
-- Description: Creates all tables, indexes, and RLS policies for AI Coach feature

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. AI COACH QUERIES
-- ============================================================================
-- Stores learner queries to AI Coach

CREATE TABLE IF NOT EXISTS ai_coach_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL, -- Course identifier (matches course_allocations.course_id)
    question TEXT NOT NULL,
    intent VARCHAR(50) NOT NULL DEFAULT 'course_content', -- 'course_content', 'navigation', 'lab_guidance', 'lab_struggle', 'out_of_scope'
    context JSONB, -- {current_chapter, current_day, completed_chapters, in_progress_chapters, current_lab}
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'answered', 'escalated', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_queries_learner ON ai_coach_queries(learner_id, course_id, created_at DESC);
CREATE INDEX idx_ai_coach_queries_course ON ai_coach_queries(course_id, created_at DESC);
CREATE INDEX idx_ai_coach_queries_status ON ai_coach_queries(status);
CREATE INDEX idx_ai_coach_queries_intent ON ai_coach_queries(intent);

-- ============================================================================
-- 2. AI COACH RESPONSES
-- ============================================================================
-- Stores AI Coach responses to queries

CREATE TABLE IF NOT EXISTS ai_coach_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES ai_coach_queries(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    reference_locations JSONB NOT NULL, -- Array of {day, chapter, chapter_title, lab_id}
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    next_steps JSONB, -- Array of suggested next actions
    tokens_used INTEGER NOT NULL DEFAULT 0,
    model_used VARCHAR(50) NOT NULL, -- 'gpt-4o-mini', 'gpt-4-turbo', etc.
    word_count INTEGER, -- For conciseness tracking
    is_lab_guidance BOOLEAN DEFAULT false, -- True if response is lab guidance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_responses_query ON ai_coach_responses(query_id);
CREATE INDEX idx_ai_coach_responses_confidence ON ai_coach_responses(confidence_score);
CREATE INDEX idx_ai_coach_responses_lab_guidance ON ai_coach_responses(is_lab_guidance);

-- ============================================================================
-- 3. AI COACH ESCALATIONS
-- ============================================================================
-- Stores escalations to trainers

CREATE TABLE IF NOT EXISTS ai_coach_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES ai_coach_queries(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_question TEXT NOT NULL,
    ai_context JSONB, -- Chunk IDs and context used by AI
    ai_confidence DECIMAL(3,2) NOT NULL,
    learner_progress JSONB, -- Progress snapshot at time of escalation
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'responded', 'resolved', 'archived'
    trainer_response TEXT,
    trainer_responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ai_coach_escalations_trainer ON ai_coach_escalations(trainer_id, status);
CREATE INDEX idx_ai_coach_escalations_learner ON ai_coach_escalations(learner_id);
CREATE INDEX idx_ai_coach_escalations_status ON ai_coach_escalations(status);
CREATE INDEX idx_ai_coach_escalations_query ON ai_coach_escalations(query_id);

-- ============================================================================
-- 4. AI COACH FEEDBACK
-- ============================================================================
-- Stores user feedback on responses

CREATE TABLE IF NOT EXISTS ai_coach_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES ai_coach_responses(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating VARCHAR(20) NOT NULL, -- 'helpful', 'not_helpful'
    feedback_text TEXT,
    is_lab_guidance_feedback BOOLEAN DEFAULT false, -- True if feedback is for lab guidance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_feedback_response ON ai_coach_feedback(response_id);
CREATE INDEX idx_ai_coach_feedback_learner ON ai_coach_feedback(learner_id);
CREATE INDEX idx_ai_coach_feedback_rating ON ai_coach_feedback(rating);

-- ============================================================================
-- 5. AI COACH CONTENT CHUNKS
-- ============================================================================
-- Stores indexed course content for retrieval (course-specific)

CREATE TABLE IF NOT EXISTS ai_coach_content_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id TEXT NOT NULL, -- Course identifier (matches course_allocations.course_id)
    day INTEGER,
    chapter_id VARCHAR(100) NOT NULL,
    chapter_title VARCHAR(255),
    lab_id VARCHAR(100),
    content TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL, -- 'chapter', 'lab', 'overview'
    token_count INTEGER NOT NULL,
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimensions
    content_hash VARCHAR(64), -- SHA-256 hash for change detection
    content_version INTEGER DEFAULT 1, -- Version number for tracking updates
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Last indexing time
    metadata JSONB, -- Additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_chunks_course ON ai_coach_content_chunks(course_id);
CREATE INDEX idx_ai_coach_chunks_chapter ON ai_coach_content_chunks(course_id, chapter_id);
CREATE INDEX idx_ai_coach_chunks_type ON ai_coach_content_chunks(content_type);
CREATE INDEX idx_ai_coach_chunks_hash ON ai_coach_content_chunks(course_id, content_hash); -- For change detection

-- Vector similarity search index (pgvector)
-- Note: This index is created separately as it requires the vector extension
-- CREATE INDEX idx_ai_coach_chunks_embedding ON ai_coach_content_chunks 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 6. AI COACH CONVERSATION HISTORY
-- ============================================================================
-- Stores conversation history for context

CREATE TABLE IF NOT EXISTS ai_coach_conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL, -- Course identifier (matches course_allocations.course_id)
    query_id UUID REFERENCES ai_coach_queries(id) ON DELETE SET NULL,
    response_id UUID REFERENCES ai_coach_responses(id) ON DELETE SET NULL,
    escalation_id UUID REFERENCES ai_coach_escalations(id) ON DELETE SET NULL,
    sequence_number INTEGER NOT NULL, -- Order in conversation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_history_learner ON ai_coach_conversation_history(learner_id, course_id, created_at DESC);
CREATE INDEX idx_ai_coach_history_query ON ai_coach_conversation_history(query_id);
CREATE INDEX idx_ai_coach_history_course ON ai_coach_conversation_history(course_id, created_at DESC);

-- ============================================================================
-- 7. AI COACH TRAINER PERSONALIZATION
-- ============================================================================
-- Stores trainer personalization settings

CREATE TABLE IF NOT EXISTS ai_coach_trainer_personalization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT, -- Course identifier (NULL = global, or specific course)
    coach_name VARCHAR(100) NOT NULL, -- e.g., "John's AI Coach"
    linkedin_profile_url TEXT,
    trainer_info JSONB, -- Extracted trainer information {name, bio, expertise, years_experience, extracted_at}
    personalization_enabled BOOLEAN DEFAULT true,
    share_level VARCHAR(20) DEFAULT 'name_only', -- 'name_only', 'name_expertise', 'full'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trainer_id, course_id) -- One personalization per trainer per course
);

CREATE INDEX idx_ai_coach_personalization_trainer ON ai_coach_trainer_personalization(trainer_id);
CREATE INDEX idx_ai_coach_personalization_course ON ai_coach_trainer_personalization(course_id);

-- ============================================================================
-- 8. AI COACH CONTENT UPDATES
-- ============================================================================
-- Tracks content updates for automatic re-indexing

CREATE TABLE IF NOT EXISTS ai_coach_content_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id TEXT NOT NULL, -- Course identifier (matches course_allocations.course_id)
    update_type VARCHAR(20) NOT NULL, -- 'full', 'incremental', 'manual'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    chunks_updated INTEGER DEFAULT 0,
    chunks_total INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    triggered_by VARCHAR(50), -- 'automatic', 'manual', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_updates_course ON ai_coach_content_updates(course_id, status);
CREATE INDEX idx_ai_coach_updates_status ON ai_coach_content_updates(status);
CREATE INDEX idx_ai_coach_updates_triggered ON ai_coach_content_updates(triggered_by);

-- ============================================================================
-- 9. AI COACH LAB STRUGGLE DETECTION
-- ============================================================================
-- Tracks lab struggle detection for proactive guidance

CREATE TABLE IF NOT EXISTS ai_coach_lab_struggle_detection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL, -- Course identifier (matches course_allocations.course_id)
    lab_id VARCHAR(100), -- Specific lab or NULL for overall
    struggle_score DECIMAL(3,2) NOT NULL CHECK (struggle_score >= 0 AND struggle_score <= 1),
    indicators JSONB NOT NULL, -- {attempts, average_score, recent_failures, repeated_questions, time_spent}
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false, -- If learner acknowledged guidance
    UNIQUE(learner_id, course_id, lab_id)
);

CREATE INDEX idx_ai_coach_struggle_learner ON ai_coach_lab_struggle_detection(learner_id, course_id);
CREATE INDEX idx_ai_coach_struggle_score ON ai_coach_lab_struggle_detection(struggle_score DESC);
CREATE INDEX idx_ai_coach_struggle_detected ON ai_coach_lab_struggle_detection(detected_at DESC);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE ai_coach_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_content_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_trainer_personalization ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_content_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_lab_struggle_detection ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10.1 AI COACH QUERIES POLICIES
-- ============================================================================

-- Learners can only see their own queries
CREATE POLICY "Learners can view own queries"
ON ai_coach_queries FOR SELECT
USING (auth.uid() = learner_id);

-- Learners can only create queries for their allocated courses
CREATE POLICY "Learners can create queries for allocated courses"
ON ai_coach_queries FOR INSERT
WITH CHECK (
    auth.uid() = learner_id AND
    EXISTS (
        SELECT 1 FROM course_allocations
        WHERE user_id = auth.uid() AND course_id = ai_coach_queries.course_id
    )
);

-- Trainers can view queries from their assigned learners
CREATE POLICY "Trainers can view assigned learner queries"
ON ai_coach_queries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM course_allocations ca
        WHERE ca.user_id = ai_coach_queries.learner_id
        AND ca.trainer_id = auth.uid()
    )
);

-- Admins can view all queries
CREATE POLICY "Admins can view all queries"
ON ai_coach_queries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.2 AI COACH RESPONSES POLICIES
-- ============================================================================

-- Learners can view responses to their queries
CREATE POLICY "Learners can view own responses"
ON ai_coach_responses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM ai_coach_queries
        WHERE id = ai_coach_responses.query_id AND learner_id = auth.uid()
    )
);

-- Trainers can view responses to their assigned learners' queries
CREATE POLICY "Trainers can view assigned learner responses"
ON ai_coach_responses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM ai_coach_queries aq
        JOIN course_allocations ca ON ca.user_id = aq.learner_id
        WHERE aq.id = ai_coach_responses.query_id
        AND ca.trainer_id = auth.uid()
    )
);

-- Admins can view all responses
CREATE POLICY "Admins can view all responses"
ON ai_coach_responses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.3 AI COACH ESCALATIONS POLICIES
-- ============================================================================

-- Learners can view their own escalations
CREATE POLICY "Learners can view own escalations"
ON ai_coach_escalations FOR SELECT
USING (auth.uid() = learner_id);

-- Trainers can view escalations assigned to them
CREATE POLICY "Trainers can view assigned escalations"
ON ai_coach_escalations FOR SELECT
USING (auth.uid() = trainer_id);

-- Trainers can update escalations assigned to them
CREATE POLICY "Trainers can update assigned escalations"
ON ai_coach_escalations FOR UPDATE
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

-- Admins can view all escalations
CREATE POLICY "Admins can view all escalations"
ON ai_coach_escalations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.4 AI COACH FEEDBACK POLICIES
-- ============================================================================

-- Learners can view and create their own feedback
CREATE POLICY "Learners can manage own feedback"
ON ai_coach_feedback FOR ALL
USING (auth.uid() = learner_id)
WITH CHECK (auth.uid() = learner_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
ON ai_coach_feedback FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.5 AI COACH CONTENT CHUNKS POLICIES
-- ============================================================================

-- All authenticated users can view content chunks (for their allocated courses)
CREATE POLICY "Users can view chunks for allocated courses"
ON ai_coach_content_chunks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM course_allocations
        WHERE user_id = auth.uid() AND course_id = ai_coach_content_chunks.course_id
    )
    OR
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role IN ('admin', 'trainer')
    )
);

-- Only admins can insert/update/delete chunks
CREATE POLICY "Admins can manage content chunks"
ON ai_coach_content_chunks FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.6 AI COACH CONVERSATION HISTORY POLICIES
-- ============================================================================

-- Learners can view their own conversation history
CREATE POLICY "Learners can view own conversation history"
ON ai_coach_conversation_history FOR SELECT
USING (auth.uid() = learner_id);

-- Trainers can view conversation history of their assigned learners
CREATE POLICY "Trainers can view assigned learner history"
ON ai_coach_conversation_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM course_allocations ca
        WHERE ca.user_id = ai_coach_conversation_history.learner_id
        AND ca.trainer_id = auth.uid()
    )
);

-- Admins can view all conversation history
CREATE POLICY "Admins can view all conversation history"
ON ai_coach_conversation_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.7 AI COACH TRAINER PERSONALIZATION POLICIES
-- ============================================================================

-- Trainers can view and manage their own personalization
CREATE POLICY "Trainers can manage own personalization"
ON ai_coach_trainer_personalization FOR ALL
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

-- Admins can view and manage all personalization
CREATE POLICY "Admins can manage all personalization"
ON ai_coach_trainer_personalization FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.8 AI COACH CONTENT UPDATES POLICIES
-- ============================================================================

-- Admins and trainers can view update status
CREATE POLICY "Admins and trainers can view updates"
ON ai_coach_content_updates FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role IN ('admin', 'trainer')
    )
);

-- Only admins can create/update update records
CREATE POLICY "Admins can manage updates"
ON ai_coach_content_updates FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- 10.9 AI COACH LAB STRUGGLE DETECTION POLICIES
-- ============================================================================

-- Learners can view their own struggle detection
CREATE POLICY "Learners can view own struggle detection"
ON ai_coach_lab_struggle_detection FOR SELECT
USING (auth.uid() = learner_id);

-- Learners can update their own struggle detection (acknowledge)
CREATE POLICY "Learners can acknowledge struggle"
ON ai_coach_lab_struggle_detection FOR UPDATE
USING (auth.uid() = learner_id)
WITH CHECK (auth.uid() = learner_id);

-- Trainers can view struggle detection for their assigned learners
CREATE POLICY "Trainers can view assigned learner struggle"
ON ai_coach_lab_struggle_detection FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM course_allocations ca
        WHERE ca.user_id = ai_coach_lab_struggle_detection.learner_id
        AND ca.trainer_id = auth.uid()
    )
);

-- Admins can view all struggle detection
CREATE POLICY "Admins can view all struggle detection"
ON ai_coach_lab_struggle_detection FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- System can insert/update struggle detection (via service account)
-- Note: This would typically be done via a service role, not RLS

-- ============================================================================
-- 11. TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_ai_coach_queries_updated_at
    BEFORE UPDATE ON ai_coach_queries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_coach_content_chunks_updated_at
    BEFORE UPDATE ON ai_coach_content_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_coach_trainer_personalization_updated_at
    BEFORE UPDATE ON ai_coach_trainer_personalization
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ai_coach_queries IS 'Stores learner queries to AI Coach';
COMMENT ON TABLE ai_coach_responses IS 'Stores AI Coach responses to queries';
COMMENT ON TABLE ai_coach_escalations IS 'Stores escalations to trainers';
COMMENT ON TABLE ai_coach_feedback IS 'Stores user feedback on responses';
COMMENT ON TABLE ai_coach_content_chunks IS 'Stores indexed course content for retrieval (course-specific)';
COMMENT ON TABLE ai_coach_conversation_history IS 'Stores conversation history for context';
COMMENT ON TABLE ai_coach_trainer_personalization IS 'Stores trainer personalization settings';
COMMENT ON TABLE ai_coach_content_updates IS 'Tracks content updates for automatic re-indexing';
COMMENT ON TABLE ai_coach_lab_struggle_detection IS 'Tracks lab struggle detection for proactive guidance';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Note: After running this migration, you may need to create the vector index separately:
-- CREATE INDEX idx_ai_coach_chunks_embedding ON ai_coach_content_chunks 
-- USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- 
-- This should be done after some data is inserted, as ivfflat indexes work better with data.

