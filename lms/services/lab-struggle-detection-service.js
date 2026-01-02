/**
 * Lab Struggle Detection Service
 * 
 * Detects when learners are struggling with labs,
 * analyzes patterns, and provides struggle context.
 */

import { supabaseClient } from './supabase-client.js';

class LabStruggleDetectionService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Detect if learner is struggling with labs
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} labId - Optional specific lab ID
     * @returns {Promise<Object>} Struggle detection result
     */
    async detectStruggle(learnerId, courseId, labId = null) {
        const cacheKey = `struggle_${learnerId}_${courseId}_${labId || 'all'}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const result = await this.analyzeLabHistory(learnerId, courseId, labId);
            
            // Cache result for 5 minutes
            this.cache.set(cacheKey, result);
            setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
            
            return result;
        } catch (error) {
            console.error('[LabStruggleDetectionService] Error detecting struggle:', error);
            return {
                detected: false,
                struggleScore: 0,
                attempts: 0,
                averageScore: 0,
                recentFailures: 0,
                repeatedQuestions: 0
            };
        }
    }

    /**
     * Analyze lab submission history
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} labId - Optional specific lab ID
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeLabHistory(learnerId, courseId, labId = null) {
        // Build query
        let query = supabaseClient
            .from('lab_submissions')
            .select('*')
            .eq('user_id', learnerId)
            .eq('course_id', courseId)
            .order('submitted_at', { ascending: false })
            .limit(20);

        if (labId) {
            query = query.eq('lab_id', labId);
        }

        const { data: labSubmissions, error } = await query;

        if (error) {
            throw error;
        }

        if (!labSubmissions || labSubmissions.length === 0) {
            return {
                detected: false,
                struggleScore: 0,
                attempts: 0,
                averageScore: 0,
                recentFailures: 0,
                repeatedQuestions: 0,
                indicators: {}
            };
        }

        // Calculate metrics
        const attempts = labSubmissions.length;
        const scores = labSubmissions
            .filter(s => s.score !== null && s.score !== undefined)
            .map(s => parseFloat(s.score) * 10); // Convert 0-10 to 0-100
        const averageScore = scores.length > 0 
            ? scores.reduce((a, b) => a + b, 0) / scores.length 
            : 0;
        const recentFailures = labSubmissions.filter(s => {
            const score = parseFloat(s.score || 0) * 10;
            return score < 50;
        }).length;

        // Check for repeated questions about labs
        const repeatedQuestions = await this._getRepeatedLabQuestions(learnerId, courseId, labId);

        // Calculate struggle score
        const struggleScore = 
            (attempts > 2 ? 0.3 : 0) +
            (averageScore < 50 ? 0.3 : 0) +
            (recentFailures > 1 ? 0.2 : 0) +
            (repeatedQuestions > 0 ? 0.2 : 0);

        const indicators = {
            attempts,
            averageScore: Math.round(averageScore * 10) / 10,
            recentFailures,
            repeatedQuestions,
            timeSpent: this._calculateTimeSpent(labSubmissions)
        };

        const result = {
            detected: struggleScore >= 0.5,
            struggleScore: Math.round(struggleScore * 100) / 100,
            attempts,
            averageScore: Math.round(averageScore * 10) / 10,
            recentFailures,
            repeatedQuestions,
            indicators
        };

        // Store/update struggle detection record
        await this._updateStruggleRecord(learnerId, courseId, labId, result);

        return result;
    }

    /**
     * Get struggle indicators
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<Object>} Struggle indicators
     */
    async getStruggleIndicators(learnerId, courseId) {
        const struggle = await this.detectStruggle(learnerId, courseId);
        return struggle.indicators || {};
    }

    /**
     * Get lab performance metrics
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<Object>} Performance metrics
     */
    async getLabPerformanceMetrics(learnerId, courseId) {
        const { data: labSubmissions } = await supabaseClient
            .from('lab_submissions')
            .select('*')
            .eq('user_id', learnerId)
            .eq('course_id', courseId)
            .order('submitted_at', { ascending: false });

        if (!labSubmissions || labSubmissions.length === 0) {
            return {
                totalLabs: 0,
                submittedLabs: 0,
                averageScore: 0,
                passedLabs: 0,
                failedLabs: 0
            };
        }

        const scores = labSubmissions
            .filter(s => s.score !== null && s.score !== undefined)
            .map(s => parseFloat(s.score) * 10);
        const averageScore = scores.length > 0 
            ? scores.reduce((a, b) => a + b, 0) / scores.length 
            : 0;

        return {
            totalLabs: labSubmissions.length,
            submittedLabs: labSubmissions.length,
            averageScore: Math.round(averageScore * 10) / 10,
            passedLabs: labSubmissions.filter(s => {
                const score = parseFloat(s.score || 0) * 10;
                return score >= 50;
            }).length,
            failedLabs: labSubmissions.filter(s => {
                const score = parseFloat(s.score || 0) * 10;
                return score < 50;
            }).length
        };
    }

    /**
     * Get repeated lab questions count
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} labId - Optional specific lab ID
     * @returns {Promise<number>} Count of repeated questions
     */
    async _getRepeatedLabQuestions(learnerId, courseId, labId = null) {
        let query = supabaseClient
            .from('ai_coach_queries')
            .select('*')
            .eq('learner_id', learnerId)
            .eq('course_id', courseId)
            .in('intent', ['lab_guidance', 'lab_struggle'])
            .order('created_at', { ascending: false })
            .limit(10);

        const { data: queries } = await query;

        if (!queries || queries.length === 0) {
            return 0;
        }

        // Count queries about the same lab (if labId provided)
        if (labId) {
            return queries.filter(q => {
                const context = q.context || {};
                return context.current_lab === labId;
            }).length;
        }

        // Count all lab-related queries
        return queries.length;
    }

    /**
     * Calculate time spent on labs
     * @param {Array<Object>} labSubmissions - Lab submissions
     * @returns {number} Total time spent in seconds
     */
    _calculateTimeSpent(labSubmissions) {
        // Estimate based on submission timestamps
        // This is a rough estimate - actual time tracking would need additional data
        return labSubmissions.length * 30 * 60; // Assume 30 minutes per submission
    }

    /**
     * Update or create struggle detection record
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} labId - Optional specific lab ID
     * @param {Object} result - Struggle detection result
     * @returns {Promise<void>}
     */
    async _updateStruggleRecord(learnerId, courseId, labId, result) {
        const record = {
            learner_id: learnerId,
            course_id: courseId,
            lab_id: labId || null,
            struggle_score: result.struggleScore,
            indicators: result.indicators,
            detected_at: result.detected ? new Date().toISOString() : null,
            last_checked: new Date().toISOString()
        };

        // Upsert record
        const { error } = await supabaseClient
            .from('ai_coach_lab_struggle_detection')
            .upsert(record, {
                onConflict: 'learner_id,course_id,lab_id'
            });

        if (error) {
            console.error('[LabStruggleDetectionService] Error updating struggle record:', error);
        }
    }
}

export const labStruggleDetectionService = new LabStruggleDetectionService();

