-- Migration: Add metadata fields to ai_coach_content_chunks table
-- Phase 4: Enhanced Chunk Metadata
-- 
-- This migration adds fields for chunk metadata to improve prioritization
-- and retrieval accuracy. All fields are nullable to support gradual migration.

-- Add coverage level field
ALTER TABLE ai_coach_content_chunks 
ADD COLUMN IF NOT EXISTS coverage_level VARCHAR(20) CHECK (coverage_level IN ('introduction', 'intermediate', 'comprehensive', 'advanced'));

-- Add completeness score field
ALTER TABLE ai_coach_content_chunks 
ADD COLUMN IF NOT EXISTS completeness_score DECIMAL(3,2) CHECK (completeness_score >= 0 AND completeness_score <= 1);

-- Add dedicated topic chapter flag
ALTER TABLE ai_coach_content_chunks 
ADD COLUMN IF NOT EXISTS is_dedicated_topic_chapter BOOLEAN DEFAULT FALSE;

-- Add primary topic field
ALTER TABLE ai_coach_content_chunks 
ADD COLUMN IF NOT EXISTS primary_topic VARCHAR(255);

-- Add secondary topics (stored as JSONB array)
ALTER TABLE ai_coach_content_chunks 
ADD COLUMN IF NOT EXISTS secondary_topics JSONB DEFAULT '[]'::jsonb;

-- Add step number field (for lab steps)
ALTER TABLE ai_coach_content_chunks 
ADD COLUMN IF NOT EXISTS step_number INTEGER;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chunks_coverage_level ON ai_coach_content_chunks(coverage_level);
CREATE INDEX IF NOT EXISTS idx_chunks_completeness ON ai_coach_content_chunks(completeness_score);
CREATE INDEX IF NOT EXISTS idx_chunks_dedicated_topic ON ai_coach_content_chunks(is_dedicated_topic_chapter) WHERE is_dedicated_topic_chapter = TRUE;
CREATE INDEX IF NOT EXISTS idx_chunks_primary_topic ON ai_coach_content_chunks(primary_topic);
CREATE INDEX IF NOT EXISTS idx_chunks_step_number ON ai_coach_content_chunks(step_number) WHERE step_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN ai_coach_content_chunks.coverage_level IS 'Level at which topic is covered: introduction, intermediate, comprehensive, or advanced';
COMMENT ON COLUMN ai_coach_content_chunks.completeness_score IS 'Score 0-1 indicating how completely the chunk covers its topic';
COMMENT ON COLUMN ai_coach_content_chunks.is_dedicated_topic_chapter IS 'True if this chapter is primarily dedicated to a specific topic';
COMMENT ON COLUMN ai_coach_content_chunks.primary_topic IS 'Main topic/focus of this chapter';
COMMENT ON COLUMN ai_coach_content_chunks.secondary_topics IS 'Array of other topics mentioned in this chapter (JSONB)';
COMMENT ON COLUMN ai_coach_content_chunks.step_number IS 'Step number within a lab (if applicable)';

-- Note: Existing chunks will have NULL values for these fields
-- Metadata can be populated gradually using the chunk-metadata-service
-- The system will work with or without these fields (graceful degradation)

