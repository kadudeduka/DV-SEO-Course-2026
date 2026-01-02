/**
 * Escalation Service
 * 
 * Handles escalation of AI Coach queries to trainers.
 * Creates escalation records, notifies trainers, and tracks escalation status.
 */

import { supabaseClient } from './supabase-client.js';
import { notificationService } from './notification-service.js';

class EscalationService {
    constructor() {
        this.confidenceThreshold = 0.65; // Default threshold
    }

    /**
     * Create escalation for a query
     * @param {string} queryId - Query ID
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course ID
     * @param {string} question - Original question
     * @param {number} confidence - AI confidence score
     * @param {Object} context - AI context (chunks, etc.)
     * @param {Object} progressSnapshot - Learner progress snapshot
     * @returns {Promise<Object>} Escalation record
     */
    async createEscalation(queryId, learnerId, courseId, question, confidence, context = {}, progressSnapshot = {}) {
        try {
            // Get trainer for this course
            const trainerId = await this._getTrainerForCourse(courseId, learnerId);
            
            if (!trainerId) {
                throw new Error('No trainer assigned to this course');
            }

            // Create escalation record
            const { data: escalation, error } = await supabaseClient
                .from('ai_coach_escalations')
                .insert({
                    query_id: queryId,
                    learner_id: learnerId,
                    trainer_id: trainerId,
                    original_question: question,
                    ai_context: {
                        chunk_ids: context.chunkIds || [],
                        chunks_used: context.chunksUsed || [],
                        intent: context.intent,
                        model_used: context.modelUsed
                    },
                    ai_confidence: confidence,
                    learner_progress: progressSnapshot,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Notify trainer
            await this._notifyTrainer(trainerId, escalation.id, question, learnerId);

            return escalation;
        } catch (error) {
            console.error('[EscalationService] Error creating escalation:', error);
            throw error;
        }
    }

    /**
     * Get trainer ID for a course and learner
     * @private
     */
    async _getTrainerForCourse(courseId, learnerId) {
        try {
            const { data, error } = await supabaseClient
                .from('course_allocations')
                .select('trainer_id')
                .eq('course_id', courseId)
                .eq('user_id', learnerId)
                .eq('status', 'active')
                .single();

            if (error || !data) {
                return null;
            }

            return data.trainer_id;
        } catch (error) {
            console.error('[EscalationService] Error getting trainer:', error);
            return null;
        }
    }

    /**
     * Notify trainer about escalation
     * @private
     */
    async _notifyTrainer(trainerId, escalationId, question, learnerId) {
        try {
            // Get learner name
            const { data: learner } = await supabaseClient
                .from('users')
                .select('full_name, name, email')
                .eq('id', learnerId)
                .single();

            const learnerName = learner?.full_name || learner?.name || 'a learner';

            // Create notification
            await notificationService.createNotification({
                user_id: trainerId,
                type: 'ai_coach_escalation',
                title: 'AI Coach Escalation',
                message: `${learnerName} needs help with: "${question.substring(0, 100)}${question.length > 100 ? '...' : ''}"`,
                link: `#/trainer/ai-escalations/${escalationId}`,
                metadata: {
                    escalation_id: escalationId,
                    learner_id: learnerId,
                    question: question
                }
            });
        } catch (error) {
            console.warn('[EscalationService] Failed to notify trainer:', error);
            // Don't throw - notification failure shouldn't block escalation
        }
    }

    /**
     * Get escalations for a trainer
     * @param {string} trainerId - Trainer ID
     * @param {Object} filters - Filter options
     * @returns {Promise<Array<Object>>} Array of escalations
     */
    async getEscalationsForTrainer(trainerId, filters = {}) {
        try {
            let query = supabaseClient
                .from('ai_coach_escalations')
                .select(`
                    *,
                    learner:users!ai_coach_escalations_learner_id_fkey(id, full_name, name, email),
                    query:ai_coach_queries(id, question, intent, context, created_at)
                `)
                .eq('trainer_id', trainerId);

            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.courseId) {
                // Join with queries to filter by course
                query = query.eq('query.course_id', filters.courseId);
            }

            // Order by created_at (newest first)
            query = query.order('created_at', { ascending: false });

            // Limit
            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('[EscalationService] Error getting escalations:', error);
            throw error;
        }
    }

    /**
     * Get escalation by ID
     * @param {string} escalationId - Escalation ID
     * @returns {Promise<Object>} Escalation record
     */
    async getEscalationById(escalationId) {
        try {
            const { data, error } = await supabaseClient
                .from('ai_coach_escalations')
                .select(`
                    *,
                    learner:users!ai_coach_escalations_learner_id_fkey(id, full_name, name, email),
                    trainer:users!ai_coach_escalations_trainer_id_fkey(id, full_name, name, email),
                    query:ai_coach_queries(id, question, intent, context, course_id, created_at),
                    response:ai_coach_responses(id, answer, reference_locations, confidence_score)
                `)
                .eq('id', escalationId)
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('[EscalationService] Error getting escalation:', error);
            throw error;
        }
    }

    /**
     * Respond to an escalation
     * @param {string} escalationId - Escalation ID
     * @param {string} trainerId - Trainer ID (for verification)
     * @param {string} response - Trainer response
     * @param {boolean} useAsReference - Whether to use response as reference for future queries
     * @returns {Promise<Object>} Updated escalation
     */
    async respondToEscalation(escalationId, trainerId, response, useAsReference = false) {
        try {
            // Verify trainer owns this escalation
            const escalation = await this.getEscalationById(escalationId);
            if (escalation.trainer_id !== trainerId) {
                throw new Error('Unauthorized: This escalation is not assigned to you');
            }

            // Update escalation
            const { data, error } = await supabaseClient
                .from('ai_coach_escalations')
                .update({
                    trainer_response: response,
                    trainer_responded_at: new Date().toISOString(),
                    status: 'responded'
                })
                .eq('id', escalationId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // If useAsReference, store in a reference table (future enhancement)
            if (useAsReference) {
                // TODO: Store as reference for future AI responses
                console.log('[EscalationService] Reference storage not yet implemented');
            }

            // Notify learner
            await this._notifyLearner(escalation.learner_id, escalationId, response);

            return data;
        } catch (error) {
            console.error('[EscalationService] Error responding to escalation:', error);
            throw error;
        }
    }

    /**
     * Notify learner about trainer response
     * @private
     */
    async _notifyLearner(learnerId, escalationId, response) {
        try {
            await notificationService.createNotification({
                user_id: learnerId,
                type: 'ai_coach_trainer_response',
                title: 'Trainer Response',
                message: `Your trainer has responded to your question.`,
                link: `#/courses/${escalationId}/learn`, // Link to course where they can see response
                metadata: {
                    escalation_id: escalationId,
                    response: response.substring(0, 200)
                }
            });
        } catch (error) {
            console.warn('[EscalationService] Failed to notify learner:', error);
        }
    }

    /**
     * Resolve an escalation
     * @param {string} escalationId - Escalation ID
     * @param {string} trainerId - Trainer ID (for verification)
     * @returns {Promise<Object>} Updated escalation
     */
    async resolveEscalation(escalationId, trainerId) {
        try {
            const escalation = await this.getEscalationById(escalationId);
            if (escalation.trainer_id !== trainerId) {
                throw new Error('Unauthorized: This escalation is not assigned to you');
            }

            const { data, error } = await supabaseClient
                .from('ai_coach_escalations')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString()
                })
                .eq('id', escalationId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('[EscalationService] Error resolving escalation:', error);
            throw error;
        }
    }

    /**
     * Get escalation statistics for a trainer
     * @param {string} trainerId - Trainer ID
     * @returns {Promise<Object>} Statistics
     */
    async getEscalationStats(trainerId) {
        try {
            const { data, error } = await supabaseClient
                .from('ai_coach_escalations')
                .select('status')
                .eq('trainer_id', trainerId);

            if (error) {
                throw error;
            }

            const stats = {
                total: data.length,
                pending: data.filter(e => e.status === 'pending').length,
                responded: data.filter(e => e.status === 'responded').length,
                resolved: data.filter(e => e.status === 'resolved').length
            };

            return stats;
        } catch (error) {
            console.error('[EscalationService] Error getting stats:', error);
            throw error;
        }
    }
}

export const escalationService = new EscalationService();

