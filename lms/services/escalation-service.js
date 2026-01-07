/**
 * Escalation Service
 * 
 * Handles AI → Human Trainer escalation workflow:
 * - Auto-escalation (confidence < 40)
 * - Manual escalation (user-triggered)
 * - Escalation lifecycle management
 * - Trainer response handling
 */

import { supabaseClient } from './supabase-client.js';

// Dynamic import for notification service
let notificationService = null;
async function getNotificationService() {
    if (!notificationService) {
        try {
            const module = await import('./notification-service.js');
            notificationService = module.notificationService || module.default;
        } catch (error) {
            console.warn('[EscalationService] Notification service not available:', error);
            notificationService = { createNotification: async () => {} }; // No-op fallback
        }
    }
    return notificationService;
}

class EscalationService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 2 * 60 * 1000; // 2 minutes
    }

    /**
     * Create an escalation (auto or manual)
     * @param {Object} params - Escalation parameters
     * @param {string} params.questionId - Query/question ID
     * @param {string} params.courseId - Course ID
     * @param {string} params.learnerId - Learner user ID
     * @param {string} params.escalationType - 'auto' or 'manual'
     * @param {number} params.confidenceScore - AI confidence score (0-100)
     * @param {string} params.aiResponseSnapshot - Immutable AI response text
     * @param {string} params.trainerId - Optional trainer ID (for assignment)
     * @returns {Promise<Object>} Created escalation object
     */
    async createEscalation(params) {
        const {
            questionId,
            courseId,
            learnerId,
            escalationType,
            confidenceScore = null,
            aiResponseSnapshot,
            trainerId = null
        } = params;

        // Validate escalation type
        if (!['auto', 'manual'].includes(escalationType)) {
            throw new Error(`Invalid escalation_type: ${escalationType}. Must be 'auto' or 'manual'`);
        }

        // Validate confidence score for auto-escalation
        if (escalationType === 'auto' && (confidenceScore === null || confidenceScore === undefined)) {
            throw new Error('confidence_score is required for auto-escalation');
        }

        // Validate questionId exists
        if (!questionId) {
            throw new Error('questionId is required');
        }

        // Check if there's already an open escalation for this question
        const existingEscalation = await this.getEscalationForQuestion(questionId);
        if (existingEscalation && existingEscalation.status === 'open') {
            console.log(`[EscalationService] Open escalation already exists for question ${questionId}: ${existingEscalation.escalation_id}`);
            return existingEscalation;
        }

        // Auto-assign trainer if not provided
        let assignedTrainerId = trainerId;
        if (!assignedTrainerId) {
            assignedTrainerId = await this._assignTrainer(courseId, learnerId);
        }

        // Fetch question text and learner name before creating escalation (to avoid RLS issues later)
        let questionText = null;
        let learnerName = null;
        
        try {
            // Fetch question text
            const { data: question, error: questionError } = await supabaseClient
                .from('ai_coach_queries')
                .select('question')
                .eq('id', questionId)
                .eq('learner_id', learnerId) // Include learner_id for RLS
                .maybeSingle();
            
            if (!questionError && question) {
                questionText = question.question;
            } else {
                console.warn('[EscalationService] Could not fetch question text during escalation creation:', questionError);
            }
        } catch (err) {
            console.warn('[EscalationService] Error fetching question text:', err);
        }

        try {
            // Fetch learner name - try through course_allocations first (more reliable)
            const { data: allocation, error: allocError } = await supabaseClient
                .from('course_allocations')
                .select(`
                    user_id,
                    users:user_id(id, name, email, full_name)
                `)
                .eq('user_id', learnerId)
                .eq('course_id', courseId)
                .maybeSingle();
            
            if (!allocError && allocation && allocation.users) {
                learnerName = allocation.users.full_name || allocation.users.name || allocation.users.email || null;
            } else {
                // Fallback: try direct users query
                const { data: user, error: userError } = await supabaseClient
                    .from('users')
                    .select('id, name, email, full_name')
                    .eq('id', learnerId)
                    .maybeSingle();
                
                if (!userError && user) {
                    learnerName = user.full_name || user.name || user.email || null;
                } else {
                    console.warn('[EscalationService] Could not fetch learner name during escalation creation:', userError || allocError);
                }
            }
        } catch (err) {
            console.warn('[EscalationService] Error fetching learner name:', err);
        }

        try {
            // Create escalation record with question_text and learner_name stored
            // Note: question_id in escalations table references ai_coach_queries(id)
            const { data: escalation, error } = await supabaseClient
                .from('ai_coach_escalations')
                .insert({
                    question_id: questionId, // This should match the id field in ai_coach_queries
                    course_id: courseId,
                    learner_id: learnerId,
                    trainer_id: assignedTrainerId,
                    escalation_type: escalationType,
                    confidence_score: confidenceScore,
                    ai_response_snapshot: aiResponseSnapshot,
                    question_text: questionText, // Store question text directly
                    learner_name: learnerName, // Store learner name directly
                    status: 'open'
                })
                .select()
                .single();

            if (error) {
                // Handle duplicate key error gracefully
                if (error.code === '23505' && error.message.includes('idx_unique_open_escalation_per_question')) {
                    console.log(`[EscalationService] Open escalation already exists for question ${questionId}, fetching existing...`);
                    // Fetch the existing escalation
                    const existing = await this.getEscalationForQuestion(questionId);
                    if (existing && existing.status === 'open') {
                        return existing;
                    }
                }
                
                console.error('[EscalationService] Error creating escalation:', error);
                console.error('[EscalationService] Error details:', {
                    questionId,
                    courseId,
                    learnerId,
                    escalationType,
                    errorCode: error.code,
                    errorMessage: error.message,
                    errorDetails: error.details
                });
                throw new Error(`Failed to create escalation: ${error.message}`);
            }

            console.log(`[EscalationService] Created ${escalationType} escalation ${escalation.escalation_id} for question ${questionId}`);

            // Clear cache for this question to force refresh
            this.cache.delete(`question_${questionId}`);

            // Notify trainer (if assigned)
            if (assignedTrainerId) {
                await this._notifyTrainer(escalation, courseId);
            }

            // Notify learner
            await this._notifyLearner(escalation, escalationType);

            return escalation;
        } catch (error) {
            console.error('[EscalationService] Error in createEscalation:', error);
            throw error;
        }
    }

    /**
     * Auto-escalate if confidence is below threshold
     * @param {Object} params - Escalation parameters
     * @param {string} params.questionId - Query/question ID
     * @param {string} params.courseId - Course ID
     * @param {string} params.learnerId - Learner user ID
     * @param {number} params.confidenceScore - AI confidence score (0-100)
     * @param {string} params.aiResponseSnapshot - AI response text
     * @returns {Promise<Object|null>} Escalation object if created, null if not escalated
     */
    async autoEscalateIfNeeded(params) {
        const { confidenceScore, questionId } = params;

        // Auto-escalate if confidence < 40
        if (confidenceScore !== null && confidenceScore !== undefined && confidenceScore < 40) {
            console.log(`[EscalationService] Auto-escalating question ${questionId} (confidence: ${confidenceScore} < 40)`);
            return await this.createEscalation({
                ...params,
                escalationType: 'auto'
            });
        }

        return null;
    }

    /**
     * Manually escalate a question
     * @param {Object} params - Escalation parameters
     * @param {string} params.questionId - Query/question ID
     * @param {string} params.courseId - Course ID
     * @param {string} params.learnerId - Learner user ID
     * @param {string} params.aiResponseSnapshot - AI response text
     * @returns {Promise<Object>} Created escalation object
     */
    async manualEscalate(params) {
        console.log(`[EscalationService] Manual escalation for question ${params.questionId}`);
        return await this.createEscalation({
            ...params,
            escalationType: 'manual'
        });
    }

    /**
     * Get escalation by ID
     * @param {string} escalationId - Escalation ID
     * @returns {Promise<Object|null>} Escalation object or null
     */
    async getEscalationById(escalationId) {
        const cacheKey = `escalation_${escalationId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            // Fetch escalation first
            const { data: escalation, error } = await supabaseClient
                .from('ai_coach_escalations')
                .select('*')
                .eq('escalation_id', escalationId)
                .single();

            if (error) {
                console.error('[EscalationService] Error fetching escalation by ID:', error);
                console.error('[EscalationService] Error details:', {
                    escalationId,
                    errorCode: error.code,
                    errorMessage: error.message,
                    errorDetails: error.details
                });
                return null;
            }

            if (!escalation) {
                console.warn(`[EscalationService] Escalation ${escalationId} not found`);
                return null;
            }

            // Fetch related data separately (relations might not work due to RLS)
            // For trainers, we need to check RLS policies - they may not have direct access
            let queryData = null;
            let learnerData = null;

            try {
                // Fetch question - include learner_id in filter so RLS policy can evaluate properly
                // The RLS policy checks course_allocations, so including learner_id helps
                const { data: query, error: queryError } = await supabaseClient
                    .from('ai_coach_queries')
                    .select('id, question, intent, created_at')
                    .eq('id', escalation.question_id)
                    .eq('learner_id', escalation.learner_id) // Include learner_id for RLS evaluation
                    .maybeSingle();
                
                if (queryError) {
                    console.error('[EscalationService] Error fetching query:', {
                        error: queryError,
                        question_id: escalation.question_id,
                        learner_id: escalation.learner_id,
                        escalation_id: escalation.escalation_id
                    });
                } else if (query) {
                    queryData = query;
                } else {
                    console.warn('[EscalationService] Query not found for question_id:', escalation.question_id);
                }
            } catch (err) {
                console.error('[EscalationService] Exception fetching query:', err);
            }

            try {
                // Try to fetch learner through course_allocations (trainers have access to this)
                // This is more reliable than direct users table access
                const { data: allocation, error: allocError } = await supabaseClient
                    .from('course_allocations')
                    .select(`
                        user_id,
                        users:user_id(id, name, email, full_name)
                    `)
                    .eq('user_id', escalation.learner_id)
                    .eq('course_id', escalation.course_id)
                    .eq('trainer_id', escalation.trainer_id) // Ensure trainer is assigned
                    .maybeSingle();
                
                if (!allocError && allocation && allocation.users) {
                    learnerData = allocation.users;
                } else {
                    // Fallback: try direct users table (might work if RLS allows)
                    console.warn('[EscalationService] Could not fetch learner via course_allocations, trying direct:', allocError);
                    const { data: learner, error: learnerError } = await supabaseClient
                        .from('users')
                        .select('id, name, email, full_name')
                        .eq('id', escalation.learner_id)
                        .maybeSingle();
                    
                    if (!learnerError && learner) {
                        learnerData = learner;
                    }
                }
            } catch (err) {
                console.warn('[EscalationService] Error fetching learner:', err);
            }

            // Map fields to match component expectations
            escalation.query = queryData;
            escalation.learner = learnerData;
            
            // Extract original question - prefer stored question_text, then query data
            if (escalation.question_text) {
                escalation.original_question = escalation.question_text;
            } else if (queryData && queryData.question) {
                escalation.original_question = queryData.question;
            } else {
                escalation.original_question = 'Question text not available';
                console.warn('[EscalationService] Could not fetch question text, question_id:', escalation.question_id);
            }
            
            // Create response object from ai_response_snapshot
            escalation.response = {
                answer: escalation.ai_response_snapshot || '',
                confidence_score: escalation.confidence_score || 0,
                reference_locations: [] // New schema doesn't have this, but component expects it
            };
            
            // Map confidence_score (0-100) to ai_confidence (0-1) for component compatibility
            // Handle null/undefined confidence_score
            if (escalation.confidence_score !== null && escalation.confidence_score !== undefined) {
                escalation.ai_confidence = parseFloat(escalation.confidence_score) / 100;
            } else {
                escalation.ai_confidence = null; // Keep as null if not available
                console.warn(`[EscalationService] Escalation ${escalation.escalation_id} has no confidence_score`);
            }
            
            // Set ai_context to empty object (new schema doesn't have this field)
            escalation.ai_context = {};
            
            // Debug logging
            console.log('[EscalationService] Fetched escalation with relations:', {
                escalation_id: escalation.escalation_id,
                has_query: !!escalation.query,
                has_learner: !!escalation.learner,
                confidence_score: escalation.confidence_score,
                question_text: escalation.original_question,
                learner_name: escalation.learner?.name || escalation.learner?.full_name || 'N/A'
            });
            
            this.cache.set(cacheKey, { data: escalation, timestamp: Date.now() });

            return escalation;
        } catch (error) {
            console.error('[EscalationService] Error in getEscalationById:', error);
            return null;
        }
    }

    /**
     * Get escalation for a question
     * @param {string} questionId - Question ID
     * @returns {Promise<Object|null>} Escalation object or null
     */
    async getEscalationForQuestion(questionId) {
        const cacheKey = `question_${questionId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            // question_id in escalations table references ai_coach_queries(id)
            // So we use the id directly
            // First, try to get an open escalation
            const { data: openEscalation, error: openError } = await supabaseClient
                .from('ai_coach_escalations')
                .select('*')
                .eq('question_id', questionId)
                .eq('status', 'open')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (openEscalation) {
                this.cache.set(cacheKey, { data: openEscalation, timestamp: Date.now() });
                return openEscalation;
            }

            // If no open escalation, get the most recent one (any status)
            const { data: escalation, error } = await supabaseClient
                .from('ai_coach_escalations')
                .select('*')
                .eq('question_id', questionId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('[EscalationService] Error fetching escalation:', error);
                return null;
            }

            if (escalation) {
                this.cache.set(cacheKey, { data: escalation, timestamp: Date.now() });
            }

            return escalation;
        } catch (error) {
            console.error('[EscalationService] Error in getEscalationForQuestion:', error);
            return null;
        }
    }

    /**
     * Get trainer response for an escalation
     * @param {string} escalationId - Escalation ID
     * @returns {Promise<Object|null>} Trainer response or null
     */
    async getTrainerResponse(escalationId) {
        try {
            const { data: response, error } = await supabaseClient
                .from('ai_coach_trainer_responses')
                .select(`
                    *,
                    trainer:users!trainer_id(id, name, email, full_name)
                `)
                .eq('escalation_id', escalationId)
                .maybeSingle();

            if (error) {
                console.error('[EscalationService] Error fetching trainer response:', error);
                return null;
            }

            return response;
        } catch (error) {
            console.error('[EscalationService] Error in getTrainerResponse:', error);
            return null;
        }
    }

    /**
     * Create or update trainer response
     * @param {Object} params - Response parameters
     * @param {string} params.escalationId - Escalation ID
     * @param {string} params.trainerId - Trainer user ID
     * @param {string} params.responseText - Response text
     * @returns {Promise<Object>} Created/updated response object
     */
    async createOrUpdateTrainerResponse(params) {
        const { escalationId, trainerId, responseText } = params;

        try {
            // Check if response already exists
            const { data: existing } = await supabaseClient
                .from('ai_coach_trainer_responses')
                .select('response_id')
                .eq('escalation_id', escalationId)
                .maybeSingle();

            let response;
            if (existing) {
                // Update existing response
                const { data: updated, error: updateError } = await supabaseClient
                    .from('ai_coach_trainer_responses')
                    .update({
                        response_text: responseText,
                        updated_at: new Date().toISOString()
                    })
                    .eq('escalation_id', escalationId)
                    .select(`
                        *,
                        trainer:users!trainer_id(id, name, email, full_name)
                    `)
                    .single();

                if (updateError) throw updateError;
                response = updated;
                console.log(`[EscalationService] Updated trainer response for escalation ${escalationId}`);
            } else {
                // Create new response
                const { data: created, error: createError } = await supabaseClient
                    .from('ai_coach_trainer_responses')
                    .insert({
                        escalation_id: escalationId,
                        trainer_id: trainerId,
                        response_text: responseText
                    })
                    .select(`
                        *,
                        trainer:users!trainer_id(id, name, email, full_name)
                    `)
                    .single();

                if (createError) throw createError;
                response = created;
                console.log(`[EscalationService] Created trainer response for escalation ${escalationId}`);
            }

            // Notify learner
            await this._notifyLearnerOfTrainerResponse(escalationId);

            return response;
        } catch (error) {
            console.error('[EscalationService] Error creating/updating trainer response:', error);
            throw error;
        }
    }

    /**
     * Respond to an escalation (wrapper for createOrUpdateTrainerResponse)
     * @param {string} escalationId - Escalation ID
     * @param {string} trainerId - Trainer user ID
     * @param {string} responseText - Response text
     * @param {boolean} useAsReference - Optional: use response as reference for future AI responses (future feature)
     * @returns {Promise<Object>} Created/updated response object
     */
    async respondToEscalation(escalationId, trainerId, responseText, useAsReference = false) {
        // useAsReference is a future feature - for now just log it
        if (useAsReference) {
            console.log('[EscalationService] useAsReference flag set (feature not yet implemented)');
        }
        
        return await this.createOrUpdateTrainerResponse({
            escalationId,
            trainerId,
            responseText
        });
    }

    /**
     * Get open escalations for a trainer
     * @param {string} trainerId - Trainer user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of escalation objects
     */
    async getOpenEscalationsForTrainer(trainerId, options = {}) {
        const { courseId = null, limit = 50 } = options;

        try {
            let query = supabaseClient
                .from('ai_coach_escalations')
                .select(`
                    *,
                    question:ai_coach_queries!question_id(id, question, created_at),
                    learner:users!learner_id(id, name, email)
                `)
                .eq('trainer_id', trainerId)
                .eq('status', 'open')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (courseId) {
                query = query.eq('course_id', courseId);
            }

            const { data: escalations, error } = await query;

            if (error) {
                console.error('[EscalationService] Error fetching open escalations:', error);
                return [];
            }

            return escalations || [];
        } catch (error) {
            console.error('[EscalationService] Error in getOpenEscalationsForTrainer:', error);
            return [];
        }
    }

    /**
     * Get escalations for a trainer (with filters)
     * @param {string} trainerId - Trainer user ID
     * @param {Object} filters - Filter options
     * @param {string} filters.status - Status filter ('open', 'responded', 'closed', or 'pending' for open)
     * @returns {Promise<Array>} Array of escalation objects
     */
    async getEscalationsForTrainer(trainerId, filters = {}) {
        const { status = 'open' } = filters;
        
        // Map 'pending' to 'open' for backward compatibility
        const statusFilter = status === 'pending' ? 'open' : status;
        
        try {
            let query = supabaseClient
                .from('ai_coach_escalations')
                .select(`
                    *,
                    question:ai_coach_queries!question_id(id, question, created_at),
                    learner:users!learner_id(id, name, email)
                `)
                .eq('trainer_id', trainerId);
            
            if (statusFilter) {
                query = query.eq('status', statusFilter);
            }
            
            query = query.order('created_at', { ascending: false }).limit(50);

            const { data: escalations, error } = await query;

            if (error) {
                console.error('[EscalationService] Error fetching escalations:', error);
                return [];
            }

            // Fetch learner data separately for each escalation (RLS might block relations)
            const escalationsWithLearners = await Promise.all(
                (escalations || []).map(async (escalation) => {
                    // Try to fetch learner through course_allocations (more reliable)
                    let learnerData = null;
                    try {
                        // First try through course_allocations with user relation
                        const { data: allocation, error: allocError } = await supabaseClient
                            .from('course_allocations')
                            .select(`
                                user_id,
                                users:user_id(id, name, email, full_name)
                            `)
                            .eq('user_id', escalation.learner_id)
                            .eq('course_id', escalation.course_id)
                            .eq('trainer_id', escalation.trainer_id)
                            .maybeSingle();
                        
                        if (!allocError && allocation && allocation.users) {
                            learnerData = allocation.users;
                            console.log(`[EscalationService] Fetched learner via course_allocations for escalation ${escalation.escalation_id}:`, learnerData.name || learnerData.full_name);
                        } else {
                            // Fallback: try without trainer_id filter (might be assigned differently)
                            console.warn(`[EscalationService] Could not fetch learner via course_allocations (with trainer filter), trying without:`, {
                                learner_id: escalation.learner_id,
                                course_id: escalation.course_id,
                                trainer_id: escalation.trainer_id,
                                error: allocError
                            });
                            
                            const { data: allocation2, error: allocError2 } = await supabaseClient
                                .from('course_allocations')
                                .select(`
                                    user_id,
                                    users:user_id(id, name, email, full_name)
                                `)
                                .eq('user_id', escalation.learner_id)
                                .eq('course_id', escalation.course_id)
                                .maybeSingle();
                            
                            if (!allocError2 && allocation2 && allocation2.users) {
                                learnerData = allocation2.users;
                                console.log(`[EscalationService] Fetched learner via course_allocations (without trainer filter) for escalation ${escalation.escalation_id}`);
                            } else {
                                // Last resort: try direct users table query (might work if RLS allows)
                                console.warn(`[EscalationService] Trying direct users query for learner ${escalation.learner_id}`);
                                const { data: user, error: userError } = await supabaseClient
                                    .from('users')
                                    .select('id, name, email, full_name')
                                    .eq('id', escalation.learner_id)
                                    .maybeSingle();
                                
                                if (!userError && user) {
                                    learnerData = user;
                                    console.log(`[EscalationService] Fetched learner via direct users query for escalation ${escalation.escalation_id}`);
                                } else {
                                    console.error(`[EscalationService] All methods failed to fetch learner ${escalation.learner_id}:`, userError || allocError2);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('[EscalationService] Exception fetching learner for escalation:', err);
                    }
                    
                    // Map fields for component compatibility
                    // Map confidence_score (0-100) to ai_confidence (0-1)
                    // Handle null/undefined confidence_score
                    if (escalation.confidence_score !== null && escalation.confidence_score !== undefined) {
                        const score = parseFloat(escalation.confidence_score);
                        escalation.ai_confidence = score / 100; // Convert 0-100 to 0-1
                    } else {
                        escalation.ai_confidence = null; // Keep as null if not available
                    }
                    
                    // Debug confidence score
                    if (!escalation.confidence_score) {
                        console.warn(`[EscalationService] Escalation ${escalation.escalation_id} has no confidence_score`);
                    }
                    
                    // Get question text - prefer stored question_text, then question relation
                    if (escalation.question_text) {
                        escalation.original_question = escalation.question_text;
                    } else if (escalation.question && escalation.question.question) {
                        escalation.original_question = escalation.question.question;
                    } else {
                        escalation.original_question = 'Question text not available';
                    }
                    
                    // Set learner data - prefer fetched data, then relation data, then create from stored name
                    if (learnerData) {
                        escalation.learner = learnerData;
                    } else if (escalation.learner) {
                        // Use relation data if available
                    } else if (escalation.learner_name) {
                        // Create learner object from stored name
                        escalation.learner = {
                            id: escalation.learner_id,
                            name: escalation.learner_name,
                            full_name: escalation.learner_name,
                            email: null
                        };
                        console.log(`[EscalationService] Using stored learner_name for escalation ${escalation.escalation_id}: ${escalation.learner_name}`);
                    } else {
                        escalation.learner = null;
                        console.warn(`[EscalationService] Escalation ${escalation.escalation_id} has no learner data. learner_id: ${escalation.learner_id}, course_id: ${escalation.course_id}, trainer_id: ${escalation.trainer_id}`);
                    }
                    
                    // Debug learner data
                    if (!escalation.learner) {
                        console.warn(`[EscalationService] Escalation ${escalation.escalation_id} has no learner data. learner_id: ${escalation.learner_id}, course_id: ${escalation.course_id}, trainer_id: ${escalation.trainer_id}`);
                    } else {
                        console.log(`[EscalationService] Escalation ${escalation.escalation_id} learner:`, escalation.learner.name || escalation.learner.full_name || escalation.learner.email);
                    }
                    
                    return escalation;
                })
            );

            return escalationsWithLearners;
        } catch (error) {
            console.error('[EscalationService] Error in getEscalationsForTrainer:', error);
            return [];
        }
    }

    /**
     * Get escalation statistics for a trainer
     * @param {string} trainerId - Trainer user ID
     * @returns {Promise<Object>} Statistics object
     */
    async getEscalationStats(trainerId) {
        try {
            const { data: escalations, error } = await supabaseClient
                .from('ai_coach_escalations')
                .select('status')
                .eq('trainer_id', trainerId);

            if (error) {
                console.error('[EscalationService] Error fetching escalation stats:', error);
                return { total: 0, pending: 0, responded: 0, closed: 0 };
            }

            const stats = {
                total: escalations?.length || 0,
                pending: escalations?.filter(e => e.status === 'open').length || 0,
                responded: escalations?.filter(e => e.status === 'responded').length || 0,
                resolved: escalations?.filter(e => e.status === 'closed').length || 0, // Map 'closed' to 'resolved' for component
                closed: escalations?.filter(e => e.status === 'closed').length || 0 // Keep for backward compatibility
            };

            return stats;
        } catch (error) {
            console.error('[EscalationService] Error in getEscalationStats:', error);
            return { total: 0, pending: 0, responded: 0, closed: 0 };
        }
    }

    /**
     * Close an escalation
     * @param {string} escalationId - Escalation ID
     * @param {string} closedBy - User ID who closed it
     * @returns {Promise<Object>} Updated escalation object
     */
    /**
     * Resolve an escalation (alias for closeEscalation with status 'closed')
     * @param {string} escalationId - Escalation ID
     * @param {string} closedBy - User ID who is closing the escalation
     * @returns {Promise<Object|null>} Updated escalation or null
     */
    async resolveEscalation(escalationId, closedBy) {
        return await this.closeEscalation(escalationId, closedBy);
    }

    /**
     * Close an escalation
     * @param {string} escalationId - Escalation ID
     * @param {string} closedBy - User ID who is closing the escalation
     * @returns {Promise<Object|null>} Updated escalation or null
     */
    async closeEscalation(escalationId, closedBy) {
        try {
            const { data: escalation, error } = await supabaseClient
                .from('ai_coach_escalations')
                .update({
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                    closed_by: closedBy
                })
                .eq('escalation_id', escalationId)
                .select()
                .single();

            if (error) throw error;

            // Clear cache
            this.cache.delete(`question_${escalation.question_id}`);

            return escalation;
        } catch (error) {
            console.error('[EscalationService] Error closing escalation:', error);
            throw error;
        }
    }

    /**
     * Assign trainer to escalation
     * @param {string} escalationId - Escalation ID
     * @param {string} trainerId - Trainer user ID
     * @returns {Promise<Object>} Updated escalation object
     */
    async assignTrainer(escalationId, trainerId) {
        try {
            const { data: escalation, error } = await supabaseClient
                .from('ai_coach_escalations')
                .update({ trainer_id: trainerId })
                .eq('escalation_id', escalationId)
                .select()
                .single();

            if (error) throw error;

            // Notify trainer
            await this._notifyTrainer(escalation, escalation.course_id);

            return escalation;
        } catch (error) {
            console.error('[EscalationService] Error assigning trainer:', error);
            throw error;
        }
    }

    /**
     * Auto-assign trainer based on course allocation
     * @param {string} courseId - Course ID
     * @param {string} learnerId - Learner user ID
     * @returns {Promise<string|null>} Trainer ID or null
     * @private
     */
    async _assignTrainer(courseId, learnerId) {
        try {
            // Get trainer from course allocation
            const { data: allocation, error } = await supabaseClient
                .from('course_allocations')
                .select('trainer_id')
                .eq('course_id', courseId)
                .eq('user_id', learnerId)
                .not('trainer_id', 'is', null)
                .maybeSingle();

            if (error) {
                console.warn('[EscalationService] Error fetching trainer allocation:', error);
            } else if (allocation && allocation.trainer_id) {
                return allocation.trainer_id;
            }

            // Fallback: Get any trainer for this course
            const { data: fallbackAllocation, error: fallbackError } = await supabaseClient
                .from('course_allocations')
                .select('trainer_id')
                .eq('course_id', courseId)
                .not('trainer_id', 'is', null)
                .limit(1)
                .maybeSingle();

            if (!fallbackError && fallbackAllocation && fallbackAllocation.trainer_id) {
                console.log(`[EscalationService] Using fallback trainer ${fallbackAllocation.trainer_id} for course ${courseId}`);
                return fallbackAllocation.trainer_id;
            }

            console.warn(`[EscalationService] No trainer found for course ${courseId}, learner ${learnerId}`);
            return null;
        } catch (error) {
            console.error('[EscalationService] Error in _assignTrainer:', error);
            return null;
        }
    }

    /**
     * Notify trainer of new escalation
     * @param {Object} escalation - Escalation object
     * @param {string} courseId - Course ID
     * @private
     */
    async _notifyTrainer(escalation, courseId) {
        if (!escalation.trainer_id) {
            console.warn('[EscalationService] No trainer_id, skipping trainer notification');
            return;
        }

        try {
            // Get question details
            const { data: question } = await supabaseClient
                .from('ai_coach_queries')
                .select('question, created_at')
                .eq('id', escalation.question_id)
                .single();

            const notificationTitle = escalation.escalation_type === 'auto'
                ? 'Auto-escalated Question Requires Your Attention'
                : 'New Question Escalated to You';

            const notificationMessage = escalation.escalation_type === 'auto'
                ? `A question was auto-escalated due to low AI confidence (${escalation.confidence_score}%). Please review and respond.`
                : 'A learner has escalated a question to you. Please review and respond.';

            const notifService = await getNotificationService();
            await notifService.createNotification(
                escalation.trainer_id, // userId
                'escalation', // type
                notificationTitle, // title
                notificationMessage, // message
                { // metadata
                    escalation_id: escalation.escalation_id,
                    question_id: escalation.question_id,
                    course_id: courseId,
                    learner_id: escalation.learner_id,
                    escalation_type: escalation.escalation_type,
                    confidence_score: escalation.confidence_score
                },
                `#/courses/${courseId}/coach/escalations/${escalation.escalation_id}` // actionUrl
            );

            console.log(`[EscalationService] Notified trainer ${escalation.trainer_id} of escalation ${escalation.escalation_id}`);
        } catch (error) {
            console.error('[EscalationService] Error notifying trainer:', error);
        }
    }

    /**
     * Notify learner of escalation
     * @param {Object} escalation - Escalation object
     * @param {string} escalationType - 'auto' or 'manual'
     * @private
     */
    async _notifyLearner(escalation, escalationType) {
        try {
            const notificationTitle = escalationType === 'auto'
                ? 'Question Escalated to Trainer'
                : 'Question Escalated Successfully';

            const notificationMessage = escalationType === 'auto'
                ? 'Your question has been automatically escalated to a trainer to ensure you get the best possible answer.'
                : 'Your question has been escalated to a trainer. You will be notified when they respond.';

            const notifService = await getNotificationService();
            await notifService.createNotification(
                escalation.learner_id, // userId
                'escalation', // type
                notificationTitle, // title
                notificationMessage, // message
                { // metadata
                    escalation_id: escalation.escalation_id,
                    question_id: escalation.question_id,
                    course_id: escalation.course_id
                }
            );

            console.log(`[EscalationService] Notified learner ${escalation.learner_id} of escalation`);
        } catch (error) {
            console.error('[EscalationService] Error notifying learner:', error);
        }
    }

    /**
     * Notify learner of trainer response
     * @param {string} escalationId - Escalation ID
     * @private
     */
    async _notifyLearnerOfTrainerResponse(escalationId) {
        try {
            const { data: escalation } = await supabaseClient
                .from('ai_coach_escalations')
                .select('learner_id, course_id, question_id')
                .eq('escalation_id', escalationId)
                .single();

            if (!escalation) return;

            const notifService = await getNotificationService();
            await notifService.createNotification(
                escalation.learner_id, // userId
                'escalation_response', // type
                'Trainer Has Responded', // title
                'Your escalated question has been answered by a trainer.', // message
                { // metadata
                    escalation_id: escalationId,
                    question_id: escalation.question_id,
                    course_id: escalation.course_id
                },
                `#/courses/${escalation.course_id}/coach/ai?queryId=${escalation.question_id}` // actionUrl
            );

            console.log(`[EscalationService] Notified learner ${escalation.learner_id} of trainer response`);
        } catch (error) {
            console.error('[EscalationService] Error notifying learner of trainer response:', error);
        }
    }

    /**
     * Clear cache for a question
     * @param {string} questionId - Question ID
     */
    clearCache(questionId) {
        this.cache.delete(`question_${questionId}`);
    }
}

export const escalationService = new EscalationService();
