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
     * Parse specific references from question (Day X, Lab Y, Step Z, Chapter N)
     * @param {string} question - User question
     * @returns {Object} Parsed references with day, lab, step, chapter
     */
    parseSpecificReferences(question) {
        const references = {
            day: null,
            lab: null,
            step: null,
            chapter: null,
            hasSpecificReference: false
        };

        // Pattern: "Day 4, Chapter 2" or "Day 4 Chapter 2" or "day 4 ch 2"
        const dayChapterMatch = question.match(/day\s*(\d+)[,\s]+chapter\s*(\d+)/i);
        if (dayChapterMatch) {
            references.day = parseInt(dayChapterMatch[1]);
            references.chapter = parseInt(dayChapterMatch[2]);
            references.hasSpecificReference = true;
        } else {
            // Individual day reference: "Day 2", "day 15"
            const dayMatch = question.match(/day\s*(\d+)/i);
            if (dayMatch) {
                references.day = parseInt(dayMatch[1]);
                references.hasSpecificReference = true;
            }

            // Individual chapter reference: "Chapter 2", "chapter 3", "ch 2"
            const chapterMatch = question.match(/chapter\s*(\d+)|ch\s*(\d+)/i);
            if (chapterMatch) {
                references.chapter = parseInt(chapterMatch[1] || chapterMatch[2]);
                references.hasSpecificReference = true;
            }
        }

        // Lab reference: "Lab 1", "lab 2", "day2-lab1"
        const labMatch = question.match(/lab\s*(\d+)|day\d+-lab(\d+)/i);
        if (labMatch) {
            references.lab = parseInt(labMatch[1] || labMatch[2]);
            references.hasSpecificReference = true;
        }

        // Step reference: "Step 3", "step 1"
        const stepMatch = question.match(/step\s*(\d+)/i);
        if (stepMatch) {
            references.step = parseInt(stepMatch[1]);
            references.hasSpecificReference = true;
        }

        // Pattern: "Step 3 of Lab 1 on Day 2"
        const stepLabDayMatch = question.match(/step\s*(\d+)\s+of\s+lab\s*(\d+)\s+on\s+day\s*(\d+)/i);
        if (stepLabDayMatch) {
            references.step = parseInt(stepLabDayMatch[1]);
            references.lab = parseInt(stepLabDayMatch[2]);
            references.day = parseInt(stepLabDayMatch[3]);
            references.hasSpecificReference = true;
        }

        // Pattern: "Lab 1 Step 3" or "Lab 1, Step 3"
        const labStepMatch = question.match(/lab\s*(\d+)[,\s]+step\s*(\d+)/i);
        if (labStepMatch && !references.step) {
            references.lab = parseInt(labStepMatch[1]);
            references.step = parseInt(labStepMatch[2]);
            references.hasSpecificReference = true;
        }

        return references;
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

