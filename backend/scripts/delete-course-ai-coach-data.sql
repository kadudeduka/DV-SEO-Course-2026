    -- Script to delete all AI Coach data for a specific course
    -- Usage: Replace 'seo-master-2026' with your course ID in the DO block below
    -- Run this in Supabase SQL Editor

    -- Start transaction
    BEGIN;

    -- Set the course ID here (replace 'seo-master-2026' with your course ID)
    DO $$
    DECLARE
        target_course_id TEXT := 'seo-master-2026'; -- CHANGE THIS TO YOUR COURSE ID
    BEGIN
        -- Delete in order to respect foreign key constraints

        -- 1. Delete conversation history (references queries and responses)
        DELETE FROM ai_coach_conversation_history
        WHERE ai_coach_conversation_history.course_id = target_course_id;

        -- 2. Delete feedback (references responses)
        DELETE FROM ai_coach_feedback
        WHERE response_id IN (
            SELECT r.id 
            FROM ai_coach_responses r
            JOIN ai_coach_queries q ON q.id = r.query_id
            WHERE q.course_id = target_course_id
        );

        -- 3. Delete escalations (references queries)
        DELETE FROM ai_coach_escalations
        WHERE query_id IN (
            SELECT id FROM ai_coach_queries WHERE course_id = target_course_id
        );

        -- 4. Delete responses (references queries)
        DELETE FROM ai_coach_responses
        WHERE query_id IN (
            SELECT id FROM ai_coach_queries WHERE course_id = target_course_id
        );

        -- 5. Delete queries
        DELETE FROM ai_coach_queries
        WHERE course_id = target_course_id;

        -- 6. Delete chunk versions (references chunks)
        DELETE FROM ai_coach_content_chunk_versions
        WHERE chunk_id IN (
            SELECT id FROM ai_coach_content_chunks WHERE course_id = target_course_id
        );

        -- 7. Delete content chunks (main table)
        DELETE FROM ai_coach_content_chunks
        WHERE course_id = target_course_id;

        -- 8. Delete ingestion records (optional - for tracking)
        DELETE FROM ai_coach_content_ingestions
        WHERE course_id = target_course_id;

        -- Show summary
        RAISE NOTICE 'Deleted AI Coach data for course: %', target_course_id;
        RAISE NOTICE 'Remaining chunks: %', (SELECT COUNT(*) FROM ai_coach_content_chunks WHERE course_id = target_course_id);
        RAISE NOTICE 'Remaining queries: %', (SELECT COUNT(*) FROM ai_coach_queries WHERE course_id = target_course_id);
    END $$;

    -- Commit transaction
    COMMIT;

    -- Show final summary (replace 'seo-master-2026' with your course ID)
    SELECT 
        'seo-master-2026' as course_id, -- CHANGE THIS TO YOUR COURSE ID
        (SELECT COUNT(*) FROM ai_coach_content_chunks WHERE course_id = 'seo-master-2026') as remaining_chunks, -- CHANGE THIS TO YOUR COURSE ID
        (SELECT COUNT(*) FROM ai_coach_queries WHERE course_id = 'seo-master-2026') as remaining_queries; -- CHANGE THIS TO YOUR COURSE ID

