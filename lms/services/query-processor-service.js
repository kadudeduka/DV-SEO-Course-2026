/**
 * Query Processor Service
 * 
 * Handles query validation, intent classification, and preprocessing.
 * Detects lab struggles and lab-related questions.
 */

import { llmService } from './llm-service.js';
import { supabaseClient } from './supabase-client.js';

class QueryProcessorService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Validate query (scope, access, answerability)
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} question - User question
     * @returns {Promise<Object>} Validation result
     */
    async validateQuery(learnerId, courseId, question) {
        // Check if course is allocated to learner
        const { data: allocation, error } = await supabaseClient
            .from('course_allocations')
            .select('*')
            .eq('user_id', learnerId)
            .eq('course_id', courseId)
            .eq('status', 'active')
            .single();

        if (error || !allocation) {
            return {
                valid: false,
                reason: 'Course not allocated to learner'
            };
        }

        // Check if question is empty or too short
        if (!question || question.trim().length < 3) {
            return {
                valid: false,
                reason: 'Question too short'
            };
        }

        // Check if question is too long
        if (question.length > 1000) {
            return {
                valid: false,
                reason: 'Question too long (max 1000 characters)'
            };
        }

        return {
            valid: true
        };
    }

    /**
     * Classify intent of a query
     * @param {string} question - User question
     * @param {Object} context - Context information
     * @returns {Promise<string>} Intent classification
     */
    async classifyIntent(question, context = {}) {
        return await llmService.classifyIntent(question, context);
    }

    /**
     * Preprocess query (normalize, detect typos)
     * @param {string} question - User question
     * @returns {string} Preprocessed question
     */
    preprocessQuery(question) {
        // Trim whitespace
        let processed = question.trim();

        // Normalize whitespace
        processed = processed.replace(/\s+/g, ' ');

        // Remove excessive punctuation
        processed = processed.replace(/[!]{2,}/g, '!');
        processed = processed.replace(/[?]{2,}/g, '?');

        return processed;
    }

    /**
     * Check if question is course-related
     * @param {string} question - User question
     * @param {string} courseId - Course identifier
     * @returns {boolean} True if course-related
     */
    isCourseRelated(question, courseId) {
        // Simple heuristic: check for course-related keywords
        const courseKeywords = ['course', 'chapter', 'day', 'lab', 'lesson', 'content', 'learn'];
        const lowerQuestion = question.toLowerCase();
        
        return courseKeywords.some(keyword => lowerQuestion.includes(keyword));
    }

    /**
     * Check if question is about labs
     * @param {string} question - User question
     * @returns {boolean} True if lab-related
     */
    isLabQuestion(question) {
        const labKeywords = ['lab', 'assignment', 'exercise', 'practice', 'task'];
        const lowerQuestion = question.toLowerCase();
        
        return labKeywords.some(keyword => lowerQuestion.includes(keyword));
    }

    /**
     * Detect if learner is struggling with labs
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<Object>} Struggle detection result
     */
    async detectLabStruggle(learnerId, courseId) {
        try {
            // Get recent lab submissions
            const { data: labSubmissions } = await supabaseClient
                .from('lab_submissions')
                .select('*')
                .eq('user_id', learnerId)
                .eq('course_id', courseId)
                .order('submitted_at', { ascending: false })
                .limit(10);

            if (!labSubmissions || labSubmissions.length === 0) {
                return {
                    detected: false,
                    struggleScore: 0,
                    attempts: 0,
                    averageScore: 0,
                    recentFailures: 0
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
            const { data: recentQueries } = await supabaseClient
                .from('ai_coach_queries')
                .select('*')
                .eq('learner_id', learnerId)
                .eq('course_id', courseId)
                .in('intent', ['lab_guidance', 'lab_struggle'])
                .order('created_at', { ascending: false })
                .limit(5);

            const repeatedQuestions = recentQueries ? recentQueries.length : 0;

            // Calculate struggle score
            const struggleScore = 
                (attempts > 2 ? 0.3 : 0) +
                (averageScore < 50 ? 0.3 : 0) +
                (recentFailures > 1 ? 0.2 : 0) +
                (repeatedQuestions > 0 ? 0.2 : 0);

            return {
                detected: struggleScore >= 0.5,
                struggleScore,
                attempts,
                averageScore,
                recentFailures,
                repeatedQuestions
            };
        } catch (error) {
            console.error('[QueryProcessorService] Error detecting lab struggle:', error);
            return {
                detected: false,
                struggleScore: 0,
                attempts: 0,
                averageScore: 0,
                recentFailures: 0
            };
        }
    }

    /**
     * Determine if lab guidance should be provided
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} question - User question
     * @returns {Promise<boolean>} True if should provide guidance
     */
    async shouldProvideLabGuidance(learnerId, courseId, question) {
        if (!this.isLabQuestion(question)) {
            return false;
        }

        const struggle = await this.detectLabStruggle(learnerId, courseId);
        return struggle.detected || this.isLabQuestion(question);
    }
}

export const queryProcessorService = new QueryProcessorService();

