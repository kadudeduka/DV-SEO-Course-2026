-- Migration: Create content ingestion tracking tables
-- Purpose: Track content ingestion batches, enable rollback, and monitor pipeline status

-- ============================================================================
-- CONTENT INGESTION TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_coach_content_ingestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id TEXT NOT NULL,
    batch_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed', 'rolled_back'
    files_count INTEGER NOT NULL DEFAULT 0,
    chunks_processed INTEGER NOT NULL DEFAULT 0,
    chunks_new INTEGER NOT NULL DEFAULT 0,
    chunks_updated INTEGER NOT NULL DEFAULT 0,
    chunks_unchanged INTEGER NOT NULL DEFAULT 0,
    chunks_failed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ingestions_course ON ai_coach_content_ingestions(course_id, created_at DESC);
CREATE INDEX idx_ingestions_batch ON ai_coach_content_ingestions(batch_id);
CREATE INDEX idx_ingestions_status ON ai_coach_content_ingestions(status) WHERE status IN ('processing', 'failed');

-- ============================================================================
-- CONTENT CHUNK VERSIONS TABLE (for rollback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_coach_content_chunk_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES ai_coach_content_chunks(id) ON DELETE CASCADE,
    content_version INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    content_hash VARCHAR(64),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chunk_versions_chunk ON ai_coach_content_chunk_versions(chunk_id, content_version DESC);
CREATE INDEX idx_chunk_versions_archived ON ai_coach_content_chunk_versions(archived_at);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ai_coach_content_ingestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_coach_content_ingestions_updated_at
    BEFORE UPDATE ON ai_coach_content_ingestions
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_coach_content_ingestions_updated_at();

-- ============================================================================
-- FUNCTION: Archive old chunk version before update
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_chunk_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Archive old version before update
    IF OLD.content_version IS DISTINCT FROM NEW.content_version THEN
        INSERT INTO ai_coach_content_chunk_versions (
            chunk_id,
            content_version,
            content,
            embedding,
            content_hash,
            metadata
        ) VALUES (
            OLD.id,
            OLD.content_version,
            OLD.content,
            OLD.embedding,
            OLD.content_hash,
            jsonb_build_object(
                'coverage_level', OLD.coverage_level,
                'completeness_score', OLD.completeness_score,
                'is_dedicated_topic_chapter', OLD.is_dedicated_topic_chapter,
                'primary_topic', OLD.primary_topic,
                'secondary_topics', OLD.secondary_topics,
                'step_number', OLD.step_number
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to archive versions on update
CREATE TRIGGER archive_chunk_version_trigger
    BEFORE UPDATE ON ai_coach_content_chunks
    FOR EACH ROW
    WHEN (OLD.content_version IS DISTINCT FROM NEW.content_version)
    EXECUTE FUNCTION archive_chunk_version();

-- ============================================================================
-- FUNCTION: Rollback chunk to previous version
-- ============================================================================

CREATE OR REPLACE FUNCTION rollback_chunk_to_version(
    p_chunk_id UUID,
    p_target_version INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_archived_version RECORD;
BEGIN
    -- Find archived version
    SELECT * INTO v_archived_version
    FROM ai_coach_content_chunk_versions
    WHERE chunk_id = p_chunk_id
      AND content_version = p_target_version
    ORDER BY archived_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Version % not found for chunk %', p_target_version, p_chunk_id;
    END IF;

    -- Restore chunk from archived version
    UPDATE ai_coach_content_chunks
    SET
        content = v_archived_version.content,
        embedding = v_archived_version.embedding,
        content_hash = v_archived_version.content_hash,
        content_version = v_archived_version.content_version,
        coverage_level = (v_archived_version.metadata->>'coverage_level')::VARCHAR,
        completeness_score = (v_archived_version.metadata->>'completeness_score')::DECIMAL,
        is_dedicated_topic_chapter = (v_archived_version.metadata->>'is_dedicated_topic_chapter')::BOOLEAN,
        primary_topic = v_archived_version.metadata->>'primary_topic',
        secondary_topics = (v_archived_version.metadata->>'secondary_topics')::JSONB,
        step_number = (v_archived_version.metadata->>'step_number')::INTEGER,
        updated_at = NOW()
    WHERE id = p_chunk_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_coach_content_ingestions IS 'Tracks content ingestion batches for monitoring and rollback';
COMMENT ON TABLE ai_coach_content_chunk_versions IS 'Archives old versions of content chunks for rollback capability';
COMMENT ON FUNCTION rollback_chunk_to_version IS 'Rolls back a chunk to a specific version from archive';

