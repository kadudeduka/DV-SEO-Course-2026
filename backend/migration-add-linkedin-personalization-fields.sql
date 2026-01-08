-- LinkedIn Trainer Personalization - Database Migration
-- Version: 1.0
-- Date: 2025-01-29
-- Description: Adds LinkedIn OAuth and data extraction fields to ai_coach_trainer_personalization table

-- ============================================================================
-- ADD NEW FIELDS TO AI_COACH_TRAINER_PERSONALIZATION
-- ============================================================================

-- Add trainer photo URL (Supabase Storage public URL)
ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS trainer_photo_url TEXT;

-- Add manual bio entry (supplements LinkedIn headline)
ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS trainer_bio TEXT;

-- Add LinkedIn data extraction tracking fields
ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_data_extracted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_extraction_status VARCHAR(50) DEFAULT 'pending';
-- Values: 'pending', 'oauth_pending', 'success', 'failed', 'token_expired'

ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_extraction_error TEXT;

-- Add LinkedIn OAuth token fields (will be encrypted at application level)
ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_access_token TEXT;

ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_refresh_token TEXT;

ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Add LinkedIn profile ID
ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_profile_id VARCHAR(100);

-- Add OAuth state token for CSRF protection
ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS linkedin_oauth_state VARCHAR(255);

-- Add auto-refresh settings
ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT false;

ALTER TABLE ai_coach_trainer_personalization
ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for LinkedIn profile ID lookups
CREATE INDEX IF NOT EXISTS idx_ai_coach_personalization_linkedin_id 
ON ai_coach_trainer_personalization(linkedin_profile_id)
WHERE linkedin_profile_id IS NOT NULL;

-- Index for extraction status (for background jobs)
CREATE INDEX IF NOT EXISTS idx_ai_coach_personalization_extraction_status 
ON ai_coach_trainer_personalization(linkedin_extraction_status)
WHERE linkedin_extraction_status IS NOT NULL;

-- Index for auto-refresh enabled (for scheduled refresh job)
CREATE INDEX IF NOT EXISTS idx_ai_coach_personalization_auto_refresh 
ON ai_coach_trainer_personalization(auto_refresh_enabled, last_refreshed_at)
WHERE auto_refresh_enabled = true;

-- Index for token expiration (for token refresh job)
CREATE INDEX IF NOT EXISTS idx_ai_coach_personalization_token_expires 
ON ai_coach_trainer_personalization(linkedin_token_expires_at)
WHERE linkedin_token_expires_at IS NOT NULL;

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN ai_coach_trainer_personalization.trainer_photo_url IS 
'Public URL to trainer photo stored in Supabase Storage bucket: trainer-photos';

COMMENT ON COLUMN ai_coach_trainer_personalization.trainer_bio IS 
'Manual bio entry by trainer to supplement LinkedIn headline (optional)';

COMMENT ON COLUMN ai_coach_trainer_personalization.linkedin_data_extracted_at IS 
'Timestamp when LinkedIn data was last successfully extracted';

COMMENT ON COLUMN ai_coach_trainer_personalization.linkedin_extraction_status IS 
'Status of LinkedIn data extraction: pending, oauth_pending, success, failed, token_expired';

COMMENT ON COLUMN ai_coach_trainer_personalization.linkedin_access_token IS 
'Encrypted LinkedIn OAuth access token (encrypted at application level)';

COMMENT ON COLUMN ai_coach_trainer_personalization.linkedin_refresh_token IS 
'Encrypted LinkedIn OAuth refresh token (encrypted at application level)';

COMMENT ON COLUMN ai_coach_trainer_personalization.linkedin_token_expires_at IS 
'Timestamp when access token expires (used for automatic refresh)';

COMMENT ON COLUMN ai_coach_trainer_personalization.linkedin_profile_id IS 
'LinkedIn numeric profile ID for API calls';

COMMENT ON COLUMN ai_coach_trainer_personalization.linkedin_oauth_state IS 
'OAuth state parameter for CSRF protection during OAuth flow';

COMMENT ON COLUMN ai_coach_trainer_personalization.auto_refresh_enabled IS 
'Whether to automatically refresh LinkedIn data weekly (default: false)';

COMMENT ON COLUMN ai_coach_trainer_personalization.last_refreshed_at IS 
'Timestamp of last successful automatic refresh';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all columns were added
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'ai_coach_trainer_personalization'
-- AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Verify indexes were created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'ai_coach_trainer_personalization'
-- AND schemaname = 'public';

