/**
 * AI Coach Service
 * 
 * Main orchestration service for AI Coach functionality.
 * Handles query processing, context building, retrieval, and response generation.
 */

import { queryProcessorService } from './query-processor-service.js';
import { contextBuilderService } from './context-builder-service.js';
import { retrievalService } from './retrieval-service.js';
import { llmService } from './llm-service.js';
import { labStruggleDetectionService } from './lab-struggle-detection-service.js';
import { trainerPersonalizationService } from './trainer-personalization-service.js';
import { escalationService } from './escalation-service.js';
import { supabaseClient } from './supabase-client.js';

class AICoachService {
    constructor() {
        this.confidenceThreshold = 0.65; // Default confidence threshold
    }

    /**
     * Process a learner query and generate response
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} question - User question
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response object
     */
    async processQuery(learnerId, courseId, question, options = {}) {
        const startTime = Date.now();
        console.log('[AICoachService] processQuery called:', { learnerId, courseId, question: question.substring(0, 50) });

        try {
            // 1. Validate query
            console.log('[AICoachService] Validating query...');
            const validation = await queryProcessorService.validateQuery(learnerId, courseId, question);
            console.log('[AICoachService] Validation result:', validation);
            if (!validation.valid) {
                console.warn('[AICoachService] Query validation failed:', validation.reason);
                return {
                    success: false,
                    error: validation.reason === 'Course not allocated to learner' 
                        ? 'This course is not allocated to you. Please contact your administrator.'
                        : validation.reason,
                    queryId: null
                };
            }

            // 2. Preprocess query
            const processedQuestion = queryProcessorService.preprocessQuery(question);

            // 3. Detect lab struggle (if lab-related)
            let labStruggle = null;
            if (queryProcessorService.isLabQuestion(processedQuestion)) {
                labStruggle = await labStruggleDetectionService.detectStruggle(learnerId, courseId);
            }

            // 4. Classify intent
            const context = await contextBuilderService.getCurrentContext(learnerId, courseId);
            const intent = await queryProcessorService.classifyIntent(processedQuestion, context);

            // 5. Check if out of scope
            if (intent === 'out_of_scope') {
                return {
                    success: false,
                    error: 'This question is outside the scope of the course. Please ask questions related to the course content.',
                    queryId: null
                };
            }

            // 6. Build context
            const fullContext = await contextBuilderService.buildContext(
                learnerId,
                courseId,
                processedQuestion,
                intent
            );

            // 7. Search for similar chunks using hybrid search (semantic + keyword)
            // Only filter by contentType for lab-specific questions, otherwise search all content
            const searchFilters = {
                contentType: intent === 'lab_guidance' || intent === 'lab_struggle' ? 'lab' : null
            };
            console.log('[AICoachService] Searching for chunks with filters:', searchFilters);
            
            // Use hybrid search (combines semantic and keyword search)
            let similarChunks = await retrievalService.hybridSearch(
                processedQuestion,
                courseId,
                searchFilters,
                15 // Get more chunks for filtering
            );
            console.log(`[AICoachService] Hybrid search found ${similarChunks.length} chunks`);
            
            // Fallback: If hybrid search returns nothing, try keyword-only search
            if (similarChunks.length === 0) {
                console.warn('[AICoachService] Hybrid search returned no results, trying keyword search...');
                const keywordChunks = await retrievalService.keywordSearch(
                    processedQuestion,
                    courseId,
                    searchFilters,
                    10
                );
                similarChunks = keywordChunks.map(chunk => ({ ...chunk, similarity: 0.5 })); // Give keyword results a default similarity
                console.log(`[AICoachService] Keyword search found ${similarChunks.length} chunks`);
            }

            // 9. Filter chunks by access and progress
            const filteredChunks = contextBuilderService.filterChunksByAccess(
                similarChunks,
                fullContext.progressContext,
                intent
            );

            // 10. Prioritize chunks
            const prioritizedChunks = contextBuilderService.prioritizeChunks(
                filteredChunks,
                processedQuestion,
                fullContext.progressContext
            );

            // 11. Select top chunks within token limit
            const selectedChunks = contextBuilderService.constructContextWithinTokenLimit(
                prioritizedChunks,
                2000 // Max 2000 tokens for context
            );

            console.log(`[AICoachService] Selected ${selectedChunks.length} chunks after filtering and prioritization`, {
                similarChunks: similarChunks.length,
                filteredChunks: filteredChunks.length,
                prioritizedChunks: prioritizedChunks.length,
                selectedChunks: selectedChunks.length
            });

            if (selectedChunks.length === 0) {
                console.warn('[AICoachService] No chunks selected. Debug info:', {
                    similarChunks: similarChunks.length,
                    filteredChunks: filteredChunks.length,
                    prioritizedChunks: prioritizedChunks.length,
                    intent,
                    courseId
                });
                return {
                    success: false,
                    error: 'No relevant content found. Please try rephrasing your question.',
                    queryId: null
                };
            }

            // 12. Build system prompt
            const systemPrompt = await this._buildSystemPrompt(courseId, learnerId, intent, labStruggle);

            // 13. Generate answer
            const isLabGuidance = intent === 'lab_guidance' || intent === 'lab_struggle';
            const answerResult = await llmService.generateAnswer(
                processedQuestion,
                selectedChunks,
                systemPrompt,
                {
                    isLabGuidance,
                    labStruggleContext: labStruggle
                }
            );

            // 14. Extract references from chunks
            const references = selectedChunks.map(chunk => ({
                day: chunk.day,
                chapter: chunk.chapter_id,
                chapter_title: chunk.chapter_title,
                lab_id: chunk.lab_id || null
            }));

            // 15. Store query and response (don't fail if storage fails)
            let queryId = null;
            let responseId = null;
            try {
                queryId = await this._storeQuery(learnerId, courseId, processedQuestion, intent, fullContext);
                responseId = await this._storeResponse(
                    queryId,
                    answerResult,
                    references,
                    isLabGuidance
                );

                // 16. Store conversation history
                await this._storeConversationHistory(learnerId, courseId, queryId, responseId);
            } catch (storageError) {
                console.warn('[AICoachService] Failed to store query/response in database:', storageError);
                // Continue anyway - we still have the answer to return to the user
                // This prevents RLS errors from blocking the user experience
            }

            // 17. Check if escalation needed and create escalation if needed
            const shouldEscalate = answerResult.confidence < this.confidenceThreshold;
            let escalationId = null;

            if (shouldEscalate && queryId) {
                try {
                    const escalation = await escalationService.createEscalation(
                        queryId,
                        learnerId,
                        courseId,
                        processedQuestion,
                        answerResult.confidence,
                        {
                            chunkIds: selectedChunks.map(c => c.id),
                            chunksUsed: selectedChunks.length,
                            intent,
                            modelUsed: answerResult.modelUsed
                        },
                        {
                            completedChapters: fullContext.progressContext.completedChapters,
                            inProgressChapters: fullContext.progressContext.inProgressChapters,
                            currentDay: fullContext.currentContext.currentDay,
                            currentChapter: fullContext.currentContext.currentChapter
                        }
                    );
                    escalationId = escalation.id;
                    console.log('[AICoachService] Escalation created:', escalationId);
                } catch (error) {
                    console.warn('[AICoachService] Failed to create escalation:', error);
                    // Don't fail the query if escalation fails
                }
            }

            const responseTime = Date.now() - startTime;

            return {
                success: true,
                queryId,
                responseId,
                answer: answerResult.answer,
                references,
                confidence: answerResult.confidence,
                nextSteps: this._generateNextSteps(selectedChunks, fullContext.progressContext),
                escalated: shouldEscalate,
                escalationId,
                isLabGuidance,
                wordCount: answerResult.wordCount,
                tokensUsed: answerResult.tokensUsed,
                modelUsed: answerResult.modelUsed,
                responseTimeMs: responseTime
            };
        } catch (error) {
            console.error('[AICoachService] Error processing query:', error);
            console.error('[AICoachService] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            return {
                success: false,
                error: error.message || 'An error occurred while processing your question.',
                queryId: null
            };
        }
    }

    /**
     * Build system prompt with personalization
     * @param {string} courseId - Course identifier
     * @param {string} learnerId - Learner ID for personalization
     * @param {string} intent - Query intent
     * @param {Object} labStruggle - Lab struggle context
     * @returns {Promise<Object>} System prompt configuration
     */
    async _buildSystemPrompt(courseId, learnerId, intent, labStruggle) {
        // Get course name
        const { getCourses } = await import('../../data/courses.js');
        const courses = await getCourses();
        const course = courses.find(c => c.id === courseId);
        const courseName = course?.title || courseId;

        // Get trainer personalization (only for learners, not trainers/admins)
        let trainerInfo = null;
        if (learnerId) {
            // Verify user is a learner before getting personalization
            try {
                const { data: user } = await supabaseClient
                    .from('users')
                    .select('role')
                    .eq('id', learnerId)
                    .single();

                if (user && user.role === 'learner') {
                    trainerInfo = await trainerPersonalizationService.getTrainerInfoForPrompt(courseId, learnerId);
                }
            } catch (error) {
                console.warn('[AICoachService] Error checking user role for personalization:', error);
            }
        }

        let basePrompt = `You are an AI Coach for Digital Vidya's LMS. Your role is to help learners understand course content.`;

        // Add trainer personalization if available
        if (trainerInfo) {
            basePrompt += `\n\n${trainerInfo}`;
        }

        basePrompt += `\n\nRules:
1. Answer ONLY using the provided course content
2. Reference specific course locations (Day X → Chapter Y)
3. If uncertain, explicitly state uncertainty
4. Maintain a supportive, instructional tone
5. Only answer questions about the current course (${courseName})
6. If question is about a different course, redirect to current course`;

        return {
            base: basePrompt,
            trainerPersonalization: trainerInfo
        };
    }

    /**
     * Store query in database
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} question - Processed question
     * @param {string} intent - Query intent
     * @param {Object} context - Context object
     * @returns {Promise<string>} Query ID
     */
    async _storeQuery(learnerId, courseId, question, intent, context) {
        const { data, error } = await supabaseClient
            .from('ai_coach_queries')
            .insert({
                learner_id: learnerId,
                course_id: courseId,
                question,
                intent,
                context: {
                    current_chapter: context.currentContext.currentChapter,
                    current_day: context.currentContext.currentDay,
                    completed_chapters: context.progressContext.completedChapters,
                    in_progress_chapters: context.progressContext.inProgressChapters,
                    current_lab: context.currentContext.currentLab
                },
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data.id;
    }

    /**
     * Store response in database
     * @param {string} queryId - Query ID
     * @param {Object} answerResult - Answer generation result
     * @param {Array<Object>} references - Reference locations
     * @param {boolean} isLabGuidance - Whether this is lab guidance
     * @returns {Promise<string>} Response ID
     */
    async _storeResponse(queryId, answerResult, references, isLabGuidance) {
        const { data, error } = await supabaseClient
            .from('ai_coach_responses')
            .insert({
                query_id: queryId,
                answer: answerResult.answer,
                reference_locations: references,
                confidence_score: answerResult.confidence,
                next_steps: null, // Will be set separately
                tokens_used: answerResult.tokensUsed,
                model_used: answerResult.modelUsed,
                word_count: answerResult.wordCount,
                is_lab_guidance: isLabGuidance
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Update query status
        await supabaseClient
            .from('ai_coach_queries')
            .update({ status: 'answered' })
            .eq('id', queryId);

        return data.id;
    }

    /**
     * Store conversation history
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} queryId - Query ID
     * @param {string} responseId - Response ID
     * @returns {Promise<void>}
     */
    async _storeConversationHistory(learnerId, courseId, queryId, responseId) {
        // Get current sequence number
        const { data: lastHistory } = await supabaseClient
            .from('ai_coach_conversation_history')
            .select('sequence_number')
            .eq('learner_id', learnerId)
            .eq('course_id', courseId)
            .order('sequence_number', { ascending: false })
            .limit(1)
            .single();

        const sequenceNumber = lastHistory ? lastHistory.sequence_number + 1 : 1;

        await supabaseClient
            .from('ai_coach_conversation_history')
            .insert({
                learner_id: learnerId,
                course_id: courseId,
                query_id: queryId,
                response_id: responseId,
                sequence_number: sequenceNumber
            });
    }

    /**
     * Generate next steps suggestions
     * @param {Array<Object>} chunks - Selected chunks
     * @param {Object} progress - Progress context
     * @returns {Array<string>} Next steps
     */
    _generateNextSteps(chunks, progress) {
        const nextSteps = [];

        // Suggest reviewing relevant chapters
        const uniqueChapters = [...new Set(chunks.map(c => c.chapter_title).filter(Boolean))];
        if (uniqueChapters.length > 0) {
            nextSteps.push(`Review ${uniqueChapters[0]} for more details`);
        }

        // Suggest completing labs if mentioned
        const labChunks = chunks.filter(c => c.content_type === 'lab');
        if (labChunks.length > 0 && !progress.submittedLabs.includes(labChunks[0].lab_id)) {
            nextSteps.push(`Complete ${labChunks[0].chapter_title} to practice these concepts`);
        }

        return nextSteps;
    }
}

export const aiCoachService = new AICoachService();

