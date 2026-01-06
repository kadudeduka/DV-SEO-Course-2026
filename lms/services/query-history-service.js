/**
 * Query History Service
 * 
 * Manages retrieval and management of AI Coach query history for learners.
 */

import { supabaseClient } from './supabase-client.js';

class QueryHistoryService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get query history for a learner in a course
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Maximum number of queries to return
     * @param {number} options.offset - Offset for pagination
     * @param {string} options.search - Search term to filter queries
     * @returns {Promise<Array>} Array of queries with responses
     */
    async getQueryHistory(learnerId, courseId, options = {}) {
        const { limit = 50, offset = 0, search = '' } = options;
        
        try {
            let query = supabaseClient
                .from('ai_coach_queries')
                .select(`
                    id,
                    question,
                    intent,
                    status,
                    created_at,
                    responses:ai_coach_responses (
                        id,
                        answer,
                        confidence_score,
                        references,
                        created_at
                    )
                `)
                .eq('learner_id', learnerId)
                .eq('course_id', courseId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Add search filter if provided
            if (search && search.trim()) {
                query = query.ilike('question', `%${search.trim()}%`);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            // Format the data for easier consumption
            return (data || []).map(query => ({
                id: query.id,
                question: query.question,
                intent: query.intent,
                status: query.status,
                createdAt: query.created_at,
                responses: (query.responses || []).map(response => ({
                    id: response.id,
                    answer: response.answer,
                    confidenceScore: response.confidence_score,
                    references: response.references,
                    createdAt: response.created_at
                }))
            }));
        } catch (error) {
            console.error('[QueryHistoryService] Error fetching query history:', error);
            throw error;
        }
    }

    /**
     * Get recent queries (for widget display)
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course ID
     * @param {number} limit - Number of recent queries (default: 5)
     * @returns {Promise<Array>} Array of recent queries
     */
    async getRecentQueries(learnerId, courseId, limit = 5) {
        try {
            const { data, error } = await supabaseClient
                .from('ai_coach_queries')
                .select(`
                    id,
                    question,
                    intent,
                    status,
                    created_at,
                    responses:ai_coach_responses (
                        id,
                        answer,
                        confidence_score,
                        references,
                        created_at
                    )
                `)
                .eq('learner_id', learnerId)
                .eq('course_id', courseId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                throw error;
            }

            return (data || []).map(query => ({
                id: query.id,
                question: query.question,
                intent: query.intent,
                status: query.status,
                createdAt: query.created_at,
                hasResponse: query.responses && query.responses.length > 0,
                latestResponse: query.responses && query.responses.length > 0 
                    ? query.responses[0] 
                    : null
            }));
        } catch (error) {
            console.error('[QueryHistoryService] Error fetching recent queries:', error);
            throw error;
        }
    }

    /**
     * Get a single query with full details
     * @param {string} queryId - Query ID
     * @param {string} learnerId - Learner ID (for security)
     * @returns {Promise<Object>} Query with full details
     */
    async getQueryDetails(queryId, learnerId) {
        try {
            const { data, error } = await supabaseClient
                .from('ai_coach_queries')
                .select(`
                    id,
                    question,
                    intent,
                    status,
                    created_at,
                    context,
                    responses:ai_coach_responses (
                        id,
                        answer,
                        confidence_score,
                        references,
                        is_lab_guidance,
                        tokens_used,
                        model_used,
                        created_at
                    )
                `)
                .eq('id', queryId)
                .eq('learner_id', learnerId)
                .single();

            if (error) {
                throw error;
            }

            if (!data) {
                return null;
            }

            return {
                id: data.id,
                question: data.question,
                intent: data.intent,
                status: data.status,
                createdAt: data.created_at,
                context: data.context,
                responses: (data.responses || []).map(response => ({
                    id: response.id,
                    answer: response.answer,
                    confidenceScore: response.confidence_score,
                    references: response.references,
                    isLabGuidance: response.is_lab_guidance,
                    tokensUsed: response.tokens_used,
                    modelUsed: response.model_used,
                    createdAt: response.created_at
                }))
            };
        } catch (error) {
            console.error('[QueryHistoryService] Error fetching query details:', error);
            throw error;
        }
    }

    /**
     * Get query count for a learner in a course
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Total query count
     */
    async getQueryCount(learnerId, courseId) {
        try {
            const { count, error } = await supabaseClient
                .from('ai_coach_queries')
                .select('*', { count: 'exact', head: true })
                .eq('learner_id', learnerId)
                .eq('course_id', courseId);

            if (error) {
                throw error;
            }

            return count || 0;
        } catch (error) {
            console.error('[QueryHistoryService] Error fetching query count:', error);
            return 0;
        }
    }
}

export const queryHistoryService = new QueryHistoryService();

