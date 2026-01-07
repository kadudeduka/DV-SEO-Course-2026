-- ============================================================================
-- DELETE ALL AI COACH QUESTIONS AND ANSWERS
-- 
-- WARNING: This will permanently delete ALL AI Coach conversation data:
--   - All questions (ai_coach_queries)
--   - All answers (ai_coach_responses)
--   - All conversation history (ai_coach_conversation_history)
--   - All content node references (content_node_references)
--   - All feedback (ai_coach_feedback)
--   - All escalations (ai_coach_escalations)
--   - All trainer responses (ai_coach_trainer_responses)
--
-- This does NOT delete:
--   - Content chunks (ai_coach_content_chunks) - course content remains
--   - Trainer personalization (ai_coach_trainer_personalization)
--   - Lab struggle detection (ai_coach_lab_struggle_detection)
--   - Content updates tracking (ai_coach_content_updates)
--
-- RECOMMENDATION: Run delete-all-ai-coach-data-dry-run.sql first to see what will be deleted
-- ============================================================================

BEGIN;

-- Show what will be deleted (before deletion)
DO $$
DECLARE
    conv_count INTEGER;
    node_refs_count INTEGER;
    feedback_count INTEGER;
    escalation_count INTEGER;
    trainer_response_count INTEGER;
    response_count INTEGER;
    query_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conv_count FROM ai_coach_conversation_history;
    SELECT COUNT(*) INTO node_refs_count FROM content_node_references;
    SELECT COUNT(*) INTO feedback_count FROM ai_coach_feedback;
    SELECT COUNT(*) INTO escalation_count FROM ai_coach_escalations;
    SELECT COUNT(*) INTO trainer_response_count FROM ai_coach_trainer_responses;
    SELECT COUNT(*) INTO response_count FROM ai_coach_responses;
    SELECT COUNT(*) INTO query_count FROM ai_coach_queries;
    
    RAISE NOTICE '=== BEFORE DELETION ===';
    RAISE NOTICE 'Conversation History: % records', conv_count;
    RAISE NOTICE 'Content Node References: % records', node_refs_count;
    RAISE NOTICE 'Feedback: % records', feedback_count;
    RAISE NOTICE 'Escalations: % records', escalation_count;
    RAISE NOTICE 'Trainer Responses: % records', trainer_response_count;
    RAISE NOTICE 'Responses: % records', response_count;
    RAISE NOTICE 'Queries: % records', query_count;
    RAISE NOTICE '========================';
END $$;

-- Delete in order to respect foreign key constraints

-- 1. Delete conversation history (references queries and responses)
DELETE FROM ai_coach_conversation_history;

-- 2. Delete content_node_references (references responses and queries)
-- This table stores system-assembled references for AI Coach responses
DELETE FROM content_node_references;

-- 3. Delete feedback (references responses)
DELETE FROM ai_coach_feedback;

-- 4. Delete trainer responses (references escalations)
-- Must be deleted before escalations due to foreign key constraint
DELETE FROM ai_coach_trainer_responses;

-- 5. Delete escalations (references queries)
DELETE FROM ai_coach_escalations;

-- 6. Delete responses (references queries)
DELETE FROM ai_coach_responses;

-- 7. Delete queries (main table)
DELETE FROM ai_coach_queries;

-- Show what remains (should be 0 for all conversation tables)
DO $$
DECLARE
    conv_count INTEGER;
    node_refs_count INTEGER;
    feedback_count INTEGER;
    escalation_count INTEGER;
    trainer_response_count INTEGER;
    response_count INTEGER;
    query_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conv_count FROM ai_coach_conversation_history;
    SELECT COUNT(*) INTO node_refs_count FROM content_node_references;
    SELECT COUNT(*) INTO feedback_count FROM ai_coach_feedback;
    SELECT COUNT(*) INTO escalation_count FROM ai_coach_escalations;
    SELECT COUNT(*) INTO trainer_response_count FROM ai_coach_trainer_responses;
    SELECT COUNT(*) INTO response_count FROM ai_coach_responses;
    SELECT COUNT(*) INTO query_count FROM ai_coach_queries;
    
    RAISE NOTICE '=== AFTER DELETION ===';
    RAISE NOTICE 'Conversation History: % records (should be 0)', conv_count;
    RAISE NOTICE 'Content Node References: % records (should be 0)', node_refs_count;
    RAISE NOTICE 'Feedback: % records (should be 0)', feedback_count;
    RAISE NOTICE 'Escalations: % records (should be 0)', escalation_count;
    RAISE NOTICE 'Trainer Responses: % records (should be 0)', trainer_response_count;
    RAISE NOTICE 'Responses: % records (should be 0)', response_count;
    RAISE NOTICE 'Queries: % records (should be 0)', query_count;
    RAISE NOTICE '======================';
    
    IF conv_count = 0 AND node_refs_count = 0 AND feedback_count = 0 
       AND escalation_count = 0 AND trainer_response_count = 0 
       AND response_count = 0 AND query_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All AI Coach conversation data deleted successfully';
    ELSE
        RAISE WARNING 'WARNING: Some records may still exist. Check the counts above.';
    END IF;
END $$;

-- Commit transaction
COMMIT;

-- Final verification query
SELECT 
    'ai_coach_conversation_history' as table_name,
    COUNT(*) as remaining_records
FROM ai_coach_conversation_history

UNION ALL

SELECT 
    'content_node_references' as table_name,
    COUNT(*) as remaining_records
FROM content_node_references

UNION ALL

SELECT 
    'ai_coach_feedback' as table_name,
    COUNT(*) as remaining_records
FROM ai_coach_feedback

UNION ALL

SELECT 
    'ai_coach_trainer_responses' as table_name,
    COUNT(*) as remaining_records
FROM ai_coach_trainer_responses

UNION ALL

SELECT 
    'ai_coach_escalations' as table_name,
    COUNT(*) as remaining_records
FROM ai_coach_escalations

UNION ALL

SELECT 
    'ai_coach_responses' as table_name,
    COUNT(*) as remaining_records
FROM ai_coach_responses

UNION ALL

SELECT 
    'ai_coach_queries' as table_name,
    COUNT(*) as remaining_records
FROM ai_coach_queries

ORDER BY table_name;

