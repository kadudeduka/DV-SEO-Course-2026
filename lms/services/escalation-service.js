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
     * @param {string} queryId - Query ID (can be null if answer was blocked before query storage)
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course ID
     * @param {string} question - Original question
     * @param {number} confidence - AI confidence score
     * @param {Object} context - AI context (chunks, etc.)
     * @param {Object} progressSnapshot - Learner progress snapshot
     * @param {Object} escalationDetails - Additional escalation details
     * @param {string} escalationDetails.reason - Escalation reason: 'blocked', 'low_confidence', 'invariant_violation', 'reference_validation_failed', 'strict_lab_missing'
     * @param {Array} escalationDetails.violatedInvariants - Array of violated invariant objects
     * @param {Array} escalationDetails.chunksUsed - Full chunk details (not just IDs)
     * @param {Object} escalationDetails.governanceDetails - Full governance check results
     * @param {boolean} escalationDetails.referenceValidationFailed - True if reference validation failed
     * @param {boolean} escalationDetails.confidenceDowngraded - True if confidence was downgraded
     * @returns {Promise<Object>} Escalation record
     */
    async createEscalation(queryId, learnerId, courseId, question, confidence, context = {}, progressSnapshot = {}, escalationDetails = {}) {
        try {
            // Get trainer for this course
            const trainerId = await this._getTrainerForCourse(courseId, learnerId);
            
            if (!trainerId) {
                throw new Error('No trainer assigned to this course');
            }

            // Determine escalation reason if not provided
            let escalationReason = escalationDetails.reason;
            if (!escalationReason) {
                if (confidence < this.confidenceThreshold) {
                    escalationReason = 'low_confidence';
                } else if (escalationDetails.violatedInvariants && escalationDetails.violatedInvariants.length > 0) {
                    escalationReason = 'invariant_violation';
                } else if (escalationDetails.referenceValidationFailed) {
                    escalationReason = 'reference_validation_failed';
                } else {
                    escalationReason = 'blocked';
                }
            }

            // Prepare chunks_used - store full chunk details if available
            let chunksUsed = null;
            if (escalationDetails.chunksUsed && escalationDetails.chunksUsed.length > 0) {
                // Store full chunk details (sanitize to avoid storing embeddings)
                chunksUsed = escalationDetails.chunksUsed.map(chunk => ({
                    id: chunk.id,
                    day: chunk.day,
                    chapter_id: chunk.chapter_id,
                    chapter_title: chunk.chapter_title,
                    lab_id: chunk.lab_id,
                    content_type: chunk.content_type,
                    content_preview: chunk.content ? chunk.content.substring(0, 500) : null, // First 500 chars
                    similarity: chunk.similarity,
                    coverage_level: chunk.coverage_level,
                    completeness_score: chunk.completeness_score,
                    primary_topic: chunk.primary_topic,
                    is_dedicated_topic_chapter: chunk.is_dedicated_topic_chapter
                }));
            } else if (context.chunkIds && context.chunkIds.length > 0) {
                // Fallback: store chunk IDs if full details not available
                chunksUsed = context.chunkIds.map(id => ({ id }));
            }

            // Create escalation record
            const escalationData = {
                query_id: queryId, // Can be null if answer was blocked
                learner_id: learnerId,
                trainer_id: trainerId,
                original_question: question,
                ai_context: {
                    chunk_ids: context.chunkIds || [],
                    chunks_used_count: context.chunksUsed || 0,
                    intent: context.intent,
                    model_used: context.modelUsed,
                    ...(context.adjustmentFactors && { adjustment_factors: context.adjustmentFactors })
                },
                ai_confidence: confidence,
                learner_progress: progressSnapshot,
                escalation_reason: escalationReason,
                violated_invariants: escalationDetails.violatedInvariants || [],
                chunks_used: chunksUsed,
                governance_details: escalationDetails.governanceDetails || null,
                reference_validation_failed: escalationDetails.referenceValidationFailed || false,
                confidence_downgraded: escalationDetails.confidenceDowngraded || false,
                status: 'pending'
            };

            const { data: escalation, error } = await supabaseClient
                .from('ai_coach_escalations')
                .insert(escalationData)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Notify trainer
            await this._notifyTrainer(trainerId, escalation.id, question, learnerId, escalationReason);

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
    async _notifyTrainer(trainerId, escalationId, question, learnerId, escalationReason = null) {
        try {
            // Get learner name
            const { data: learner } = await supabaseClient
                .from('users')
                .select('full_name, name, email')
                .eq('id', learnerId)
                .single();

            const learnerName = learner?.full_name || learner?.name || 'a learner';

            // Build notification message based on escalation reason
            let title = 'AI Coach Escalation';
            let message = `${learnerName} needs help with: "${question.substring(0, 100)}${question.length > 100 ? '...' : ''}"`;
            
            if (escalationReason) {
                const reasonMessages = {
                    'blocked': 'Answer blocked by governance rules',
                    'low_confidence': 'Low confidence answer',
                    'invariant_violation': 'Invariant violation detected',
                    'reference_validation_failed': 'Reference validation failed',
                    'strict_lab_missing': 'Lab content not found'
                };
                title = `AI Coach Escalation: ${reasonMessages[escalationReason] || escalationReason}`;
            }

            // Create notification
            await notificationService.createNotification({
                user_id: trainerId,
                type: 'ai_coach_escalation',
                title: title,
                message: message,
                link: `#/trainer/ai-escalations/${escalationId}`,
                metadata: {
                    escalation_id: escalationId,
                    learner_id: learnerId,
                    question: question,
                    escalation_reason: escalationReason
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

