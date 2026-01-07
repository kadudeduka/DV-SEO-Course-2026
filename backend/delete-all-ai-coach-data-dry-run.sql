-- ============================================================================
-- DRY RUN: Preview what will be deleted
-- This script shows counts of what will be deleted WITHOUT actually deleting
-- Run this first to see what will be removed
-- ============================================================================

SELECT 
    'ai_coach_conversation_history' as table_name,
    COUNT(*) as records_to_delete
FROM ai_coach_conversation_history

UNION ALL

SELECT 
    'content_node_references' as table_name,
    COUNT(*) as records_to_delete
FROM content_node_references

UNION ALL

SELECT 
    'ai_coach_feedback' as table_name,
    COUNT(*) as records_to_delete
FROM ai_coach_feedback

UNION ALL

SELECT 
    'ai_coach_escalations' as table_name,
    COUNT(*) as records_to_delete
FROM ai_coach_escalations

UNION ALL

SELECT 
    'ai_coach_responses' as table_name,
    COUNT(*) as records_to_delete
FROM ai_coach_responses

UNION ALL

SELECT 
    'ai_coach_queries' as table_name,
    COUNT(*) as records_to_delete
FROM ai_coach_queries

ORDER BY table_name;

-- Show breakdown by course (if you want to see per-course counts)
SELECT 
    course_id,
    COUNT(*) as query_count
FROM ai_coach_queries
GROUP BY course_id
ORDER BY query_count DESC;

