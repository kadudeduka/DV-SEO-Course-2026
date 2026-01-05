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
import { chunkMetadataService } from './chunk-metadata-service.js';

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
            
            // Determine if this is a list request (needed early for chunk retrieval logic)
            const isListRequest = intent === 'list_request';

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

            // 7. Parse specific references and search for chunks
            const specificReferences = queryProcessorService.parseSpecificReferences(processedQuestion);
            console.log('[AICoachService] Parsed references:', specificReferences);
            
            // Only filter by contentType for lab-specific questions, otherwise search all content
            const searchFilters = {
                contentType: intent === 'lab_guidance' || intent === 'lab_struggle' ? 'lab' : null
            };
            console.log('[AICoachService] Searching for chunks with filters:', searchFilters);
            
            // Extract topic keywords early for dedicated chapter search
            const topicKeywords = contextBuilderService.extractTopicKeywords(processedQuestion);
            console.log('[AICoachService] Extracted topic keywords:', topicKeywords);
            
            let similarChunks = [];
            let dedicatedChunks = [];
            
            // STEP 1: Search for dedicated chapters by topic (if topics detected)
            // This ensures we find dedicated chapters even if they don't score high in semantic search
            if (topicKeywords.length > 0 && !specificReferences.hasSpecificReference) {
                console.log('[AICoachService] Searching for dedicated chapters by topic...');
                dedicatedChunks = await retrievalService.searchDedicatedChaptersByTopic(
                    topicKeywords,
                    courseId,
                    searchFilters
                );
                console.log(`[AICoachService] Found ${dedicatedChunks.length} dedicated chapters matching topics`);
            }
            
            // STEP 2: Regular search (exact match or hybrid search)
            if (specificReferences.hasSpecificReference) {
                console.log('[AICoachService] Specific references detected, attempting exact match...');
                const exactMatchChunks = await retrievalService.searchExactMatch(
                    specificReferences,
                    courseId,
                    searchFilters,
                    50 // Get more chunks for exact match
                );
                
                if (exactMatchChunks.length > 0) {
                    console.log(`[AICoachService] Exact match found ${exactMatchChunks.length} chunks`);
                    similarChunks = exactMatchChunks;
                } else {
                    console.warn('[AICoachService] Exact match returned no results, falling back to hybrid search...');
                    // Fall back to hybrid search if exact match fails
                    similarChunks = await retrievalService.hybridSearch(
                        processedQuestion,
                        courseId,
                        searchFilters,
                        20
                    );
                }
            } else {
                // No specific references, use hybrid search
                similarChunks = await retrievalService.hybridSearch(
                    processedQuestion,
                    courseId,
                    searchFilters,
                    20
                );
                console.log(`[AICoachService] Hybrid search found ${similarChunks.length} chunks`);
            }
            
            // STEP 3: Merge dedicated chapters with regular search results
            // Deduplicate by chunk ID, keeping dedicated chapters if they appear in both
            const chunkMap = new Map();
            
            // Add regular search results first
            similarChunks.forEach(chunk => {
                chunkMap.set(chunk.id, chunk);
            });
            
            // Add dedicated chapters (they override regular results if duplicate)
            dedicatedChunks.forEach(chunk => {
                const existing = chunkMap.get(chunk.id);
                if (existing) {
                    // Merge: keep dedicated chapter properties but preserve higher similarity if exists
                    chunkMap.set(chunk.id, {
                        ...existing,
                        ...chunk,
                        similarity: Math.max(existing.similarity || 0, chunk.similarity || 0.9),
                        isDedicatedTopicMatch: true
                    });
                } else {
                    chunkMap.set(chunk.id, chunk);
                }
            });
            
            // Convert back to array
            similarChunks = Array.from(chunkMap.values());
            console.log(`[AICoachService] After merging dedicated chapters: ${similarChunks.length} total chunks`);
            
            // Fallback: If no results, try keyword-only search
            if (similarChunks.length === 0) {
                console.warn('[AICoachService] No results found, trying keyword search...');
                const keywordChunks = await retrievalService.keywordSearch(
                    processedQuestion,
                    courseId,
                    searchFilters,
                    10
                );
                similarChunks = keywordChunks.map(chunk => ({ ...chunk, similarity: 0.5 }));
                console.log(`[AICoachService] Keyword search found ${similarChunks.length} chunks`);
            }

            // 9. For list requests with specific chapter, retrieve ALL chunks from that chapter
            if (isListRequest) {
                const chapterRef = this._extractChapterReference(processedQuestion);
                if (chapterRef && (chapterRef.day || chapterRef.chapter)) {
                    console.log('[AICoachService] List request with specific chapter, retrieving ALL chunks from chapter...');
                    const allChapterChunks = await retrievalService.getAllChunksFromChapter(
                        chapterRef,
                        courseId,
                        searchFilters
                    );
                    
                    if (allChapterChunks.length > 0) {
                        console.log(`[AICoachService] Retrieved ${allChapterChunks.length} chunks from specified chapter for list request`);
                        // Use ALL chunks from the chapter for list requests
                        similarChunks = allChapterChunks;
                    } else {
                        console.warn('[AICoachService] No chunks found for specified chapter, using hybrid search results');
                        // Fall back to hybrid search results if chapter not found
                    }
                } else {
                    // List request without specific chapter - prioritize chunks from search results
                    console.log('[AICoachService] List request without specific chapter reference');
                }
            }

            // 8a. Enrich chunks with metadata if not present (optional, lightweight)
            // Only enrich if chunks don't have metadata to avoid performance impact
            const chunksNeedingMetadata = similarChunks.filter(chunk => {
                const hasMetadata = chunk.metadata && (
                    chunk.metadata.coverage_level || 
                    chunk.metadata.completeness_score !== undefined ||
                    chunk.metadata.is_dedicated_topic_chapter !== undefined
                );
                return !hasMetadata;
            });

            if (chunksNeedingMetadata.length > 0 && chunksNeedingMetadata.length <= 10) {
                // Only enrich if we have a small number of chunks (performance optimization)
                console.log(`[AICoachService] Enriching ${chunksNeedingMetadata.length} chunks with metadata...`);
                try {
                    const enrichedChunks = await chunkMetadataService.analyzeChunks(chunksNeedingMetadata, {
                        useLLM: false // Use fast heuristic analysis
                    });
                    
                    // Merge enriched metadata back into similarChunks
                    const enrichedMap = new Map(enrichedChunks.map(c => [c.id, c]));
                    similarChunks = similarChunks.map(chunk => {
                        const enriched = enrichedMap.get(chunk.id);
                        return enriched || chunk;
                    });
                } catch (error) {
                    console.warn('[AICoachService] Error enriching chunks with metadata:', error);
                    // Continue without metadata enrichment
                }
            }

            // 9. Filter chunks by access and progress
            // For list requests with specific chapter, be more lenient with filtering
            const filteredChunks = isListRequest && similarChunks.some(c => c.fromListRequest)
                ? similarChunks // Don't filter list request chunks - we want all of them
                : contextBuilderService.filterChunksByAccess(
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

            // 11. Select chunks within token limit
            // For list requests, try to include ALL chunks (increase limit significantly)
            let selectedChunks;
            if (isListRequest && prioritizedChunks.some(c => c.fromListRequest)) {
                // For list requests with specific chapter, include ALL chunks (or as many as possible)
                const contextTokenLimit = 5000; // Very high limit for list requests
                selectedChunks = contextBuilderService.constructContextWithinTokenLimit(
                    prioritizedChunks,
                    contextTokenLimit
                );
                console.log(`[AICoachService] List request: Selected ${selectedChunks.length} chunks (target: all chunks from chapter)`);
            } else {
                // Normal token limit for other requests
                const contextTokenLimit = isListRequest ? 3000 : 2000;
                selectedChunks = contextBuilderService.constructContextWithinTokenLimit(
                    prioritizedChunks,
                    contextTokenLimit
                );
            }

            console.log(`[AICoachService] Selected ${selectedChunks.length} chunks after filtering and prioritization`, {
                similarChunks: similarChunks.length,
                filteredChunks: filteredChunks.length,
                prioritizedChunks: prioritizedChunks.length,
                selectedChunks: selectedChunks.length,
                hasSpecificReference: specificReferences.hasSpecificReference
            });

            if (selectedChunks.length === 0) {
                console.warn('[AICoachService] No chunks selected. Debug info:', {
                    similarChunks: similarChunks.length,
                    filteredChunks: filteredChunks.length,
                    prioritizedChunks: prioritizedChunks.length,
                    intent,
                    courseId,
                    specificReferences: specificReferences.hasSpecificReference ? specificReferences : null
                });
                
                // If specific references were provided but no content found, provide more specific error
                if (specificReferences.hasSpecificReference) {
                    const refParts = [];
                    if (specificReferences.day) refParts.push(`Day ${specificReferences.day}`);
                    if (specificReferences.chapter) refParts.push(`Chapter ${specificReferences.chapter}`);
                    if (specificReferences.lab) refParts.push(`Lab ${specificReferences.lab}`);
                    if (specificReferences.step) refParts.push(`Step ${specificReferences.step}`);
                    
                    return {
                        success: false,
                        error: `No content found for ${refParts.join(', ')}. Please verify the reference or try rephrasing your question.`,
                        queryId: null
                    };
                }
                
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
            // Note: isListRequest is already defined above after intent classification
            
            // Adjust token limits for comprehensive questions or list requests
            let maxTokens = 500;
            if (isListRequest || processedQuestion.toLowerCase().includes('comprehensive') || 
                processedQuestion.toLowerCase().includes('all') || 
                processedQuestion.toLowerCase().includes('list')) {
                maxTokens = 1000; // Allow more tokens for comprehensive answers and lists
            }
            
            const answerResult = await llmService.generateAnswer(
                processedQuestion,
                selectedChunks,
                systemPrompt,
                {
                    isLabGuidance,
                    labStruggleContext: labStruggle,
                    maxTokens: maxTokens
                }
            );

            // 14. Extract references from chunks
            const references = selectedChunks.map(chunk => ({
                day: chunk.day,
                chapter: chunk.chapter_id,
                chapter_title: chunk.chapter_title,
                lab_id: chunk.lab_id || null
            }));
            
            // 14a. Validate references match question context
            const referenceValidation = this._validateReferences(processedQuestion, references, selectedChunks);
            if (referenceValidation.warnings.length > 0) {
                // Log all warnings
                referenceValidation.warnings.forEach(warning => {
                    console.warn(`[AICoachService] ${warning.severity === 'high' ? 'HIGH PRIORITY' : ''} ${warning.message}`);
                });
                
                // If specific references were provided and validation failed, this is a critical issue
                if (specificReferences.hasSpecificReference && referenceValidation.warnings.some(w => w.severity === 'high')) {
                    console.error('[AICoachService] CRITICAL: Specific references provided but validation failed. This may indicate wrong content was retrieved.');
                    // For now, we log the error but still return the answer
                    // In future, we might want to retry with stricter matching or return an error
                }
            }
            
            // 14b. Additional validation: Check if exact match was required but not found
            if (specificReferences.hasSpecificReference) {
                const hasExactMatch = selectedChunks.some(chunk => chunk.exactMatch === true);
                if (!hasExactMatch && selectedChunks.length > 0) {
                    console.warn('[AICoachService] Warning: Specific references provided but no exact matches found in selected chunks. Using semantic similarity results instead.');
                } else if (!hasExactMatch && selectedChunks.length === 0) {
                    // This case is already handled above (no chunks selected)
                } else if (hasExactMatch) {
                    console.log('[AICoachService] Success: Exact matches found for specific references');
                }
            }
            
            // 14b. Validate list completeness if this is a list request
            if (isListRequest) {
                const listValidation = this._validateListCompleteness(processedQuestion, answerResult.answer, selectedChunks);
                if (listValidation.warnings.length > 0) {
                    listValidation.warnings.forEach(warning => {
                        console.warn(`[AICoachService] List completeness warning: ${warning.message}`);
                    });
                }
            }

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

        // Add list request specific instructions
        if (intent === 'list_request') {
            basePrompt += `\n\nLIST REQUEST RULES (CRITICAL):
- When asked to "list" items from a specific chapter, extract and enumerate ALL items, not just a summary
- When a specific chapter is mentioned (e.g., "Day 4, Chapter 2"), extract content ONLY from that chapter
- Ensure references in your answer match the chapter explicitly mentioned in the question
- For listing requests, provide complete enumeration in structured format (numbered or bulleted list)
- Don't summarize - list all items comprehensively
- If the chapter has 10 examples, list all 10 (not just 3-4)
- Format: Use clear numbered or bulleted lists for easy reading`;
        }

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
     * Extract chapter reference from question
     * @param {string} question - User question
     * @returns {Object|null} Chapter reference with day and/or chapter, or null
     */
    _extractChapterReference(question) {
        // Pattern: "Day 4, Chapter 2" or "Day 4 Chapter 2" or "day 4 ch 2"
        const dayChapterMatch = question.match(/day\s*(\d+)[,\s]+chapter\s*(\d+)/i);
        if (dayChapterMatch) {
            return {
                day: parseInt(dayChapterMatch[1]),
                chapter: parseInt(dayChapterMatch[2])
            };
        }
        
        // Pattern: "Chapter 2" (without day)
        const chapterMatch = question.match(/chapter\s*(\d+)/i);
        if (chapterMatch) {
            return {
                chapter: parseInt(chapterMatch[1])
            };
        }
        
        // Pattern: "Day 4" (without chapter)
        const dayMatch = question.match(/day\s*(\d+)/i);
        if (dayMatch) {
            return {
                day: parseInt(dayMatch[1])
            };
        }
        
        return null;
    }

    /**
     * Validate that references match the question context
     * @param {string} question - User question
     * @param {Array<Object>} references - Extracted references
     * @param {Array<Object>} chunks - Selected chunks
     * @returns {Object} Validation result with warnings
     */
    _validateReferences(question, references, chunks) {
        const warnings = [];
        const lowerQuestion = question.toLowerCase();
        
        // Extract specific day/chapter/lab/step references from question
        // Pattern: "Day 4, Chapter 2" or "Day 4 Chapter 2" or "day 4 ch 2"
        const dayChapterMatch = question.match(/day\s*(\d+)[,\s]+chapter\s*(\d+)/i);
        const dayMatch = question.match(/day\s*(\d+)/i);
        const chapterMatch = question.match(/chapter\s*(\d+)/i);
        const labMatch = question.match(/lab\s*(\d+)/i);
        const stepMatch = question.match(/step\s*(\d+)/i);
        
        // Check for Day + Chapter combination (e.g., "Day 4, Chapter 2")
        if (dayChapterMatch) {
            const questionDay = parseInt(dayChapterMatch[1]);
            const questionChapter = parseInt(dayChapterMatch[2]);
            
            const hasMatchingDayChapter = references.some(ref => {
                const refDay = typeof ref.day === 'number' ? ref.day : 
                             (typeof ref.day === 'string' ? parseInt(ref.day.match(/\d+/)?.[0] || '0') : null);
                const refChapter = ref.chapter ? 
                    (ref.chapter.match(/\d+/)?.[0] || ref.chapter_title?.match(/chapter\s*(\d+)/i)?.[1]) : null;
                
                return refDay === questionDay && refChapter === questionChapter.toString();
            });
            
            if (!hasMatchingDayChapter && chunks.length > 0) {
                warnings.push({
                    type: 'day_chapter_mismatch',
                    message: `Question mentions Day ${questionDay}, Chapter ${questionChapter} but references don't match`,
                    expected: `Day ${questionDay}, Chapter ${questionChapter}`,
                    actual: references.map(r => `Day ${r.day}, Chapter ${r.chapter || r.chapter_title}`).join(', ')
                });
                console.warn(`[AICoachService] Warning: Question mentions Day ${questionDay}, Chapter ${questionChapter} but references don't match. References:`, references);
            }
        } else {
            // Check individual day reference
            if (dayMatch) {
                const questionDay = parseInt(dayMatch[1]);
                const hasMatchingDay = references.some(ref => {
                    const refDay = typeof ref.day === 'number' ? ref.day : 
                                 (typeof ref.day === 'string' ? parseInt(ref.day.match(/\d+/)?.[0] || '0') : null);
                    return refDay === questionDay;
                });
                
                if (!hasMatchingDay && chunks.length > 0) {
                    warnings.push({
                        type: 'day_mismatch',
                        message: `Question mentions Day ${questionDay} but references don't match`,
                        expected: `Day ${questionDay}`,
                        actual: references.map(r => `Day ${r.day}`).join(', ')
                    });
                    console.warn(`[AICoachService] Warning: Question mentions Day ${questionDay} but references don't match. References:`, references);
                }
            }
            
            // Check individual chapter reference
            if (chapterMatch) {
                const questionChapter = parseInt(chapterMatch[1]);
                const hasMatchingChapter = references.some(ref => {
                    const refChapter = ref.chapter ? 
                        (ref.chapter.match(/\d+/)?.[0] || ref.chapter_title?.match(/chapter\s*(\d+)/i)?.[1]) : null;
                    return refChapter === questionChapter.toString();
                });
                
                if (!hasMatchingChapter && chunks.length > 0) {
                    warnings.push({
                        type: 'chapter_mismatch',
                        message: `Question mentions Chapter ${questionChapter} but references don't match`,
                        expected: `Chapter ${questionChapter}`,
                        actual: references.map(r => r.chapter || r.chapter_title).join(', ')
                    });
                    console.warn(`[AICoachService] Warning: Question mentions Chapter ${questionChapter} but references don't match. References:`, references);
                }
            }
        }
        
        // Check for Lab + Step combination (e.g., "Lab 1 Step 3")
        if (labMatch && stepMatch) {
            const questionLab = parseInt(labMatch[1]);
            const questionStep = parseInt(stepMatch[1]);
            
            const hasMatchingLabStep = references.some(ref => {
                const refLab = ref.lab_id ? parseInt(ref.lab_id.match(/\d+/)?.[0] || '0') : null;
                // Note: step_number may not be in references yet, would need to check chunks
                return refLab === questionLab;
            });
            
            if (!hasMatchingLabStep && chunks.length > 0) {
                warnings.push({
                    type: 'lab_step_mismatch',
                    message: `Question mentions Lab ${questionLab}, Step ${questionStep} but references don't match`,
                    expected: `Lab ${questionLab}, Step ${questionStep}`,
                    actual: references.map(r => `Lab ${r.lab_id || 'N/A'}`).join(', ')
                });
                console.warn(`[AICoachService] Warning: Question mentions Lab ${questionLab}, Step ${questionStep} but references don't match. References:`, references);
            }
        }
        
        // For list requests, ensure references match the chapter mentioned
        if (lowerQuestion.includes('list') && (dayChapterMatch || chapterMatch)) {
            const questionChapter = dayChapterMatch ? parseInt(dayChapterMatch[2]) : parseInt(chapterMatch[1]);
            const hasMatchingChapter = references.some(ref => {
                const refChapter = ref.chapter ? 
                    (ref.chapter.match(/\d+/)?.[0] || ref.chapter_title?.match(/chapter\s*(\d+)/i)?.[1]) : null;
                return refChapter === questionChapter.toString();
            });
            
            if (!hasMatchingChapter) {
                warnings.push({
                    type: 'list_chapter_mismatch',
                    message: `List request mentions Chapter ${questionChapter} but references don't match`,
                    expected: `Chapter ${questionChapter}`,
                    actual: references.map(r => r.chapter || r.chapter_title).join(', '),
                    severity: 'high' // High severity for list requests
                });
                console.warn(`[AICoachService] Warning: List request mentions Chapter ${questionChapter} but references don't match. References:`, references);
            }
        }
        
        return { valid: warnings.length === 0, warnings };
    }

    /**
     * Validate list completeness for list requests
     * @param {string} question - User question
     * @param {string} answer - Generated answer
     * @param {Array<Object>} chunks - Selected chunks
     * @returns {Object} Validation result with warnings
     */
    _validateListCompleteness(question, answer, chunks) {
        const warnings = [];
        
        // Check if answer appears to be a complete list or just a summary
        const answerLower = answer.toLowerCase();
        
        // Count list items in answer (numbered lists, bullet points)
        const numberedItems = (answer.match(/^\d+\./gm) || []).length;
        const bulletItems = (answer.match(/^[-•*]\s/gm) || []).length;
        const listItemCount = numberedItems + bulletItems;
        
        // Check for summary indicators
        const summaryIndicators = [
            'here are the key',
            'some examples include',
            'examples include',
            'focus on',
            'illustrate',
            'common patterns',
            'key examples',
            'main examples'
        ];
        const hasSummaryLanguage = summaryIndicators.some(indicator => answerLower.includes(indicator));
        
        // If answer has summary language but few list items, it might be incomplete
        if (hasSummaryLanguage && listItemCount < 3) {
            warnings.push({
                type: 'incomplete_list',
                message: 'Answer appears to be a summary rather than a complete list',
                listItemCount: listItemCount,
                chunksUsed: chunks.length,
                suggestion: 'Ensure all items from the specified chapter are listed'
            });
        }
        
        // Check if we retrieved chunks from list request (should have fromListRequest flag)
        const hasListRequestChunks = chunks.some(c => c.fromListRequest === true);
        if (hasListRequestChunks && listItemCount < chunks.length / 2) {
            // If we retrieved many chunks but answer has few items, might be incomplete
            warnings.push({
                type: 'potentially_incomplete_extraction',
                message: `Retrieved ${chunks.length} chunks but answer only lists ${listItemCount} items`,
                listItemCount: listItemCount,
                chunksRetrieved: chunks.length,
                suggestion: 'Answer should list all items from all retrieved chunks'
            });
        }
        
        // Check if answer mentions "all" or "complete" but has few items
        if ((answerLower.includes('all') || answerLower.includes('complete')) && listItemCount < 5) {
            warnings.push({
                type: 'potentially_incomplete',
                message: `Answer claims completeness but only lists ${listItemCount} items`,
                listItemCount: listItemCount,
                chunksRetrieved: chunks.length
            });
        }
        
        // Validate that answer references match the chapter mentioned in question
        const dayChapterMatch = question.match(/day\s*(\d+)[,\s]+chapter\s*(\d+)/i);
        const chapterMatch = question.match(/chapter\s*(\d+)/i);
        
        if (dayChapterMatch || chapterMatch) {
            const questionChapter = dayChapterMatch ? dayChapterMatch[2] : chapterMatch[1];
            const questionDay = dayChapterMatch ? dayChapterMatch[1] : null;
            
            // Check if answer mentions the correct chapter
            const chapterPattern = questionDay 
                ? new RegExp(`(day\\s*${questionDay}[,\\s]+)?chapter\\s*${questionChapter}`, 'i')
                : new RegExp(`chapter\\s*${questionChapter}`, 'i');
            const answerHasCorrectChapter = answer.match(chapterPattern);
            
            if (!answerHasCorrectChapter) {
                warnings.push({
                    type: 'chapter_reference_mismatch',
                    message: `Answer doesn't reference Chapter ${questionChapter} mentioned in question`,
                    expected: questionDay ? `Day ${questionDay}, Chapter ${questionChapter}` : `Chapter ${questionChapter}`,
                    severity: 'high'
                });
            }
            
            // Check if chunks match the chapter
            const chunksFromCorrectChapter = chunks.filter(chunk => {
                if (questionDay) {
                    const chunkDay = typeof chunk.day === 'number' ? chunk.day : 
                                   parseInt(chunk.day?.match(/\d+/)?.[0] || '0');
                    if (chunkDay !== parseInt(questionDay)) return false;
                }
                const chunkChapter = chunk.chapter_id?.match(/\d+/)?.[0] || 
                                   chunk.chapter_title?.match(/chapter\s*(\d+)/i)?.[1];
                return chunkChapter === questionChapter;
            });
            
            if (chunksFromCorrectChapter.length === 0 && chunks.length > 0) {
                warnings.push({
                    type: 'chunk_chapter_mismatch',
                    message: `Retrieved chunks don't match Chapter ${questionChapter} mentioned in question`,
                    expected: questionDay ? `Day ${questionDay}, Chapter ${questionChapter}` : `Chapter ${questionChapter}`,
                    chunksRetrieved: chunks.length,
                    severity: 'high'
                });
            }
        }
        
        return { valid: warnings.length === 0, warnings };
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

