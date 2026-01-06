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
import { answerGovernanceService } from './answer-governance-service.js';
import { depthClassifierService } from './depth-classifier.js';
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
        const stepTimes = {}; // Track time for each step
        const logStep = (stepName) => {
            const elapsed = Date.now() - startTime;
            stepTimes[stepName] = elapsed;
            console.log(`[AICoachService] Step "${stepName}" completed in ${elapsed}ms (total: ${elapsed}ms)`);
        };
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
            let intent = await queryProcessorService.classifyIntent(processedQuestion, context);
            
            // Validate out_of_scope classification: Check if content exists for the topic
            // This prevents false positives where LLM doesn't recognize course topics
            if (intent === 'out_of_scope') {
                console.log('[AICoachService] Intent classified as out_of_scope, validating by checking if content exists...');
                
                // Extract topic keywords to check if content exists
                const topicKeywords = contextBuilderService.extractTopicKeywords(processedQuestion);
                
                // Quick check: Search for chunks containing topic keywords
                // If we find relevant content, the question is NOT out of scope
                if (topicKeywords.length > 0) {
                    try {
                        const quickSearchChunks = await retrievalService.keywordSearch(
                            processedQuestion,
                            courseId,
                            {},
                            5 // Just check if any content exists
                        );
                        
                        // Also check for dedicated chapters
                        const dedicatedChunks = await retrievalService.searchDedicatedChaptersByTopic(
                            topicKeywords,
                            courseId,
                            {}
                        );
                        
                        if (quickSearchChunks.length > 0 || dedicatedChunks.length > 0) {
                            console.log('[AICoachService] Found relevant content, reclassifying as course_content instead of out_of_scope');
                            intent = 'course_content'; // Reclassify as course_content
                        } else {
                            // Additional check: Look for common SEO/AEO terms
                            const seoTerms = ['seo', 'aeo', 'answer engine', 'search engine', 'serp', 'keyword', 'optimization', 'ranking', 'content', 'link', 'backlink', 'technical seo', 'on-page', 'off-page'];
                            const questionLower = processedQuestion.toLowerCase();
                            const hasSEOTerms = seoTerms.some(term => questionLower.includes(term));
                            
                            if (hasSEOTerms) {
                                console.log('[AICoachService] Question contains SEO/AEO terms, reclassifying as course_content');
                                intent = 'course_content';
                            }
                        }
                    } catch (error) {
                        console.warn('[AICoachService] Error validating out_of_scope classification:', error);
                        // If validation fails, be lenient and assume it's course_content
                        const seoTerms = ['seo', 'aeo', 'answer engine', 'search engine'];
                        const questionLower = processedQuestion.toLowerCase();
                        if (seoTerms.some(term => questionLower.includes(term))) {
                            intent = 'course_content';
                        }
                    }
                }
            }
            
            // Determine if this is a list request (needed early for chunk retrieval logic)
            const isListRequest = intent === 'list_request';

            // 5. Check if out of scope (after validation)
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

            // 6a. Classify Query Depth Type
            const depthClassification = await depthClassifierService.classifyDepth(processedQuestion, intent);
            console.log('[AICoachService] Query Depth Type:', depthClassification);

            // 7. Parse specific references and search for chunks
            const specificReferences = queryProcessorService.parseSpecificReferences(processedQuestion);
            console.log('[AICoachService] Parsed references:', specificReferences);
            
            // Only filter by contentType for lab-specific questions, otherwise search all content
            const searchFilters = {
                contentType: intent === 'lab_guidance' || intent === 'lab_struggle' ? 'lab' : null
            };
            console.log('[AICoachService] Searching for chunks with filters:', searchFilters);
            
            // CRITICAL: Detect named concepts EARLY (before chunk retrieval)
            // This ensures we can force dedicated chapter search for named concepts
            const earlyConceptDetection = contextBuilderService.detectCourseConcepts(question);
            console.log('[AICoachService] Early concept detection:', earlyConceptDetection);
            
            // Extract topic keywords early for dedicated chapter search
            const topicKeywords = contextBuilderService.extractTopicKeywords(processedQuestion);
            console.log('[AICoachService] Extracted topic keywords:', topicKeywords);
            
            // Extract topic modifiers that require strict topic-specific content
            const topicModifiers = contextBuilderService.extractTopicModifiers(processedQuestion);
            console.log('[AICoachService] Extracted topic modifiers:', topicModifiers);
            
            let similarChunks = [];
            let dedicatedChunks = [];
            
            // STEP 1: Search for dedicated chapters by topic (if topics detected OR named concepts detected)
            // CRITICAL: If a named concept is detected, FORCE search for dedicated chapters
            // This ensures we find dedicated chapters (e.g., Day 20 for AEO) even if they don't score high in semantic search
            const shouldSearchDedicated = (topicKeywords.length > 0 || (earlyConceptDetection && earlyConceptDetection.requiresCourseAnchoring)) && 
                                         !specificReferences.hasSpecificReference;
            
            if (shouldSearchDedicated) {
                console.log('[AICoachService] Searching for dedicated chapters by topic/concept...');
                
                // Combine topic keywords with concept names for better matching
                const searchTerms = [...topicKeywords];
                if (earlyConceptDetection && earlyConceptDetection.requiresCourseAnchoring && earlyConceptDetection.conceptNames.length > 0) {
                    // Add concept names and variations to search terms
                    earlyConceptDetection.conceptNames.forEach(concept => {
                        searchTerms.push(concept.toLowerCase());
                        // Add variations
                        if (concept.toLowerCase() === 'aeo') {
                            searchTerms.push('answer engine optimization');
                        } else if (concept.toLowerCase() === 'technical seo') {
                            searchTerms.push('technical search engine optimization');
                        }
                    });
                    console.log(`[AICoachService] Named concept detected (${earlyConceptDetection.conceptNames.join(', ')}), forcing dedicated chapter search`);
                }
                
                dedicatedChunks = await retrievalService.searchDedicatedChaptersByTopic(
                    [...new Set(searchTerms)], // Remove duplicates
                    courseId,
                    searchFilters
                );
                console.log(`[AICoachService] Found ${dedicatedChunks.length} dedicated chapters matching topics/concepts`);
                
                // CRITICAL: If named concept detected but no dedicated chunks found, log warning
                if (earlyConceptDetection && earlyConceptDetection.requiresCourseAnchoring && dedicatedChunks.length === 0) {
                    console.warn(`[AICoachService] WARNING: Named concept(s) detected (${earlyConceptDetection.conceptNames.join(', ')}) but NO dedicated chapters found!`);
                    console.warn(`[AICoachService] This may result in foundational chapters being selected as primary reference.`);
                }
            }
            
            // STEP 1a: Search for topic-specific chunks (excluding introductory) if modifiers detected
            // This ensures we find implementation/technical content, not just philosophy/introduction
            if (topicModifiers.length > 0 && !specificReferences.hasSpecificReference) {
                console.log('[AICoachService] Searching for topic-specific chunks (excluding introductory)...');
                const topicSpecificChunks = await retrievalService.searchTopicSpecificChunks(
                    topicModifiers,
                    courseId,
                    searchFilters,
                    20
                );
                if (topicSpecificChunks.length > 0) {
                    console.log(`[AICoachService] Found ${topicSpecificChunks.length} topic-specific chunks (excluding introductory)`);
                    // Merge with dedicated chunks, prioritizing topic-specific
                    const chunkMap = new Map();
                    topicSpecificChunks.forEach(chunk => chunkMap.set(chunk.id, chunk));
                    dedicatedChunks.forEach(chunk => {
                        if (!chunkMap.has(chunk.id)) {
                            chunkMap.set(chunk.id, chunk);
                        }
                    });
                    dedicatedChunks = Array.from(chunkMap.values());
                }
            }
            
            // STEP 2: Regular search (exact match or hybrid search)
            // 
            // ========================================================================
            // STRICT LAB ISOLATION ENFORCEMENT
            // ========================================================================
            // For lab_guidance questions with explicit Day X + Lab Y references:
            // 1. Use STRICT LAB SEARCH - ONLY returns chunks from Day X AND Lab Y
            // 2. NO semantic fallback - prevents cross-day/cross-lab contamination
            // 3. NO hybrid search - ensures precision and safety
            // 4. NO dedicated chapter merging - lab isolation is absolute
            // 
            // Why fallback is forbidden for labs:
            // - Lab Safety: Learners must get guidance ONLY from their specific lab
            // - Context Integrity: Similar labs from other days can mislead learners
            // - Precision: Lab questions are highly specific and require exact matches
            // - Safety: Prevents confusion from similar but different lab content
            // 
            // If no chunks found for Day X + Lab Y:
            // - Do NOT generate answer (blocked)
            // - Trigger escalation to trainer
            // - Ask learner to confirm lab reference
            // ========================================================================
            
            const isLabGuidanceWithDayAndLab = (intent === 'lab_guidance' || intent === 'lab_struggle') &&
                                                specificReferences.hasSpecificReference &&
                                                specificReferences.day !== null && 
                                                specificReferences.day !== undefined &&
                                                specificReferences.lab !== null && 
                                                specificReferences.lab !== undefined;

            if (isLabGuidanceWithDayAndLab) {
                // STRICT LAB ISOLATION: Use strict lab search - NO FALLBACKS ALLOWED
                console.log(`[AICoachService] STRICT LAB ISOLATION: Day ${specificReferences.day}, Lab ${specificReferences.lab} - Using strict lab search (NO fallback)`);
                
                const strictLabChunks = await retrievalService.searchStrictLabMatch(
                    specificReferences,
                    courseId,
                    searchFilters,
                    100 // Get all chunks from this lab
                );

                if (strictLabChunks.length === 0) {
                    // NO CHUNKS FOUND - Do NOT generate answer, trigger escalation
                    console.error(`[AICoachService] STRICT LAB SEARCH: No chunks found for Day ${specificReferences.day}, Lab ${specificReferences.lab} - BLOCKING answer generation`);
                    
                    // Store query for escalation tracking
                    let queryId = null;
                    try {
                        queryId = await this._storeQuery(learnerId, courseId, processedQuestion, intent, fullContext);
                    } catch (error) {
                        console.warn('[AICoachService] Failed to store query for escalation:', error);
                    }

                    // Create escalation for missing lab content
                    let escalationId = null;
                    if (queryId) {
                        try {
                            const escalation = await escalationService.createEscalation(
                                queryId,
                                learnerId,
                                courseId,
                processedQuestion,
                                0.0, // Zero confidence - no answer possible
                                {
                                    chunkIds: [],
                                    chunksUsed: 0,
                                    intent,
                                    strictLabSearch: true,
                                    requestedDay: specificReferences.day,
                                    requestedLab: specificReferences.lab,
                                    reason: 'No chunks found for strict lab search'
                                },
                                {
                                    completedChapters: fullContext.progressContext.completedChapters,
                                    inProgressChapters: fullContext.progressContext.inProgressChapters,
                                    currentDay: fullContext.currentContext.currentDay,
                                    currentChapter: fullContext.currentContext.currentChapter
                                },
                                {
                                    reason: 'strict_lab_missing',
                                    violatedInvariants: [{
                                        type: 'invariant_lab_safety',
                                        severity: 'critical',
                                        message: `No chunks found for Day ${specificReferences.day}, Lab ${specificReferences.lab}`,
                                        invariant: 'Lab Safety'
                                    }],
                                    chunksUsed: [],
                                    governanceDetails: {
                                        violations: [{
                                            type: 'invariant_lab_safety',
                                            severity: 'critical',
                                            message: `Strict lab search found no content for Day ${specificReferences.day}, Lab ${specificReferences.lab}`,
                                            invariant: 'Lab Safety'
                                        }]
                                    }
                                }
                            );
                            escalationId = escalation.id;
                            console.log('[AICoachService] Escalation created for missing lab content:', escalationId);
                        } catch (error) {
                            console.warn('[AICoachService] Failed to create escalation:', error);
                        }
                    }

                    return {
                        success: false,
                        error: `No content found for Day ${specificReferences.day}, Lab ${specificReferences.lab}. Please verify the Day and Lab numbers are correct, or contact your trainer for assistance.`,
                        queryId,
                        escalationId,
                        needsLabConfirmation: true,
                        requestedDay: specificReferences.day,
                        requestedLab: specificReferences.lab
                    };
                }

                // Chunks found - use them (strict isolation enforced)
                console.log(`[AICoachService] STRICT LAB SEARCH: Found ${strictLabChunks.length} chunks - using strict lab results only`);
                similarChunks = strictLabChunks;
                
                // CRITICAL: Do NOT merge with dedicated chapters or use any fallback for labs
                // Lab isolation requires ONLY chunks from the specified Day + Lab
            } else if (specificReferences.hasSpecificReference) {
                // Non-lab specific references - use regular exact match with fallback
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
                    // Fall back to hybrid search if exact match fails (only for non-lab questions)
                    similarChunks = await retrievalService.hybridSearch(
                        processedQuestion,
                        courseId,
                        searchFilters,
                        20
                    );
                }
            } else {
                // No specific references, use hybrid search
                try {
                    logStep('Before Hybrid Search');
                    // Add timeout protection for hybrid search (30 seconds)
                    const hybridSearchPromise = retrievalService.hybridSearch(
                        processedQuestion,
                        courseId,
                        searchFilters,
                        20
                    );
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Hybrid search timed out after 30 seconds')), 30000);
                    });
                    similarChunks = await Promise.race([hybridSearchPromise, timeoutPromise]);
                    logStep('After Hybrid Search');
                    console.log(`[AICoachService] Hybrid search found ${similarChunks.length} chunks`);
                } catch (error) {
                    console.error('[AICoachService] Error in hybrid search:', error);
                    similarChunks = []; // Fall back to empty array
                    logStep('Hybrid Search Failed');
                    // Continue with empty chunks - dedicated chapters might still be available
                }
            }
            
            // STEP 3: Merge dedicated chapters with regular search results
            // CRITICAL: For strict lab search, do NOT merge with dedicated chapters
            // Lab isolation requires ONLY chunks from the specified Day + Lab
            if (dedicatedChunks.length > 0 && !isLabGuidanceWithDayAndLab) {
                console.log('[AICoachService] Merging dedicated chapters with search results...');
                console.log(`[AICoachService] Dedicated chunks found: ${dedicatedChunks.length}, Regular chunks: ${similarChunks.length}`);
                
                // Use a Map to deduplicate by chunk ID
                const chunkMap = new Map();
                
                // FIRST: Add dedicated chunks with high priority markers
                dedicatedChunks.forEach(chunk => {
                    // Mark as dedicated and set high similarity to ensure prioritization
                    chunkMap.set(chunk.id, { 
                        ...chunk, 
                        isDedicatedTopicMatch: true,
                        similarity: Math.max(chunk.similarity || 0, 0.95), // Ensure high similarity
                        priority: 2.0 // Set minimum priority
                    });
                });
                
                // SECOND: Add regular search results (they won't overwrite dedicated chunks)
                similarChunks.forEach(chunk => {
                    if (!chunkMap.has(chunk.id)) {
                        chunkMap.set(chunk.id, chunk);
                    }
                });
                
                // Convert back to array, but put dedicated chunks FIRST
                const allChunks = Array.from(chunkMap.values());
                const dedicated = allChunks.filter(c => c.isDedicatedTopicMatch === true);
                const others = allChunks.filter(c => c.isDedicatedTopicMatch !== true);
                
                // Dedicated chunks first, then others
                similarChunks = [...dedicated, ...others];
                console.log(`[AICoachService] After merging: ${dedicated.length} dedicated chunks, ${others.length} regular chunks`);
            }
            
            // Fallback: If no results, try keyword-only search
            // CRITICAL: Do NOT use fallback for lab_guidance with Day + Lab (already handled above)
            if (similarChunks.length === 0 && !isLabGuidanceWithDayAndLab) {
                console.warn('[AICoachService] No results found, trying keyword search...');
                const keywordChunks = await retrievalService.keywordSearch(
                    processedQuestion,
                    courseId,
                    searchFilters,
                    10
                );
                similarChunks = keywordChunks.map(chunk => ({ ...chunk, similarity: 0.5 }));
                console.log(`[AICoachService] Keyword search found ${similarChunks.length} chunks`);
            } else if (similarChunks.length === 0 && isLabGuidanceWithDayAndLab) {
                // This should not happen if strict lab search worked correctly, but handle it anyway
                console.error('[AICoachService] CRITICAL: Strict lab search returned no chunks but was not caught earlier');
                return {
                    success: false,
                    error: `No content found for Day ${specificReferences.day}, Lab ${specificReferences.lab}. Please verify the Day and Lab numbers are correct.`,
                    queryId: null,
                    needsLabConfirmation: true,
                    requestedDay: specificReferences.day,
                    requestedLab: specificReferences.lab
                };
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

            // 7a. CRITICAL: If named concept detected but no dedicated chunks found, force search by concept name
            // This is a safety net to ensure we find dedicated chapters even if topic keyword extraction failed
            if (earlyConceptDetection && earlyConceptDetection.requiresCourseAnchoring && 
                earlyConceptDetection.conceptNames.length > 0 && 
                dedicatedChunks.length === 0 &&
                !specificReferences.hasSpecificReference) {
                console.warn(`[AICoachService] CRITICAL: Named concept detected (${earlyConceptDetection.conceptNames.join(', ')}) but no dedicated chunks found. Forcing concept-specific search...`);
                
                // Try searching by concept name directly in chapter titles
                const conceptSearchTerms = earlyConceptDetection.conceptNames.flatMap(concept => {
                    const terms = [concept.toLowerCase()];
                    // Add variations
                    if (concept.toLowerCase() === 'aeo') {
                        terms.push('answer engine optimization');
                    } else if (concept.toLowerCase() === 'technical seo') {
                        terms.push('technical search engine optimization');
                    }
                    return terms;
                });
                
                const conceptSpecificChunks = await retrievalService.searchDedicatedChaptersByTopic(
                    conceptSearchTerms,
                    courseId,
                    searchFilters
                );
                
                if (conceptSpecificChunks.length > 0) {
                    console.log(`[AICoachService] Found ${conceptSpecificChunks.length} chunks via concept-specific search`);
                    dedicatedChunks = conceptSpecificChunks;
                } else {
                    console.error(`[AICoachService] ERROR: Still no dedicated chunks found for concept(s): ${earlyConceptDetection.conceptNames.join(', ')}`);
                    console.error(`[AICoachService] This will likely result in foundational chapters being incorrectly selected.`);
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

            // 10a. Select Primary and Secondary References (for named concepts)
            // This runs AFTER chunk selection but BEFORE governance check
            // Use early concept detection (already computed above) to avoid duplicate detection
            const conceptDetectionForRefs = earlyConceptDetection;
            let primaryReferenceChunk = null;
            let secondaryReferenceChunks = [];
            let referenceSelectionResult = null;
            
            if (conceptDetectionForRefs.requiresCourseAnchoring && selectedChunks.length > 0) {
                referenceSelectionResult = this._selectPrimaryReference(
                    selectedChunks,
                    conceptDetectionForRefs.conceptNames,
                    processedQuestion
                );
                primaryReferenceChunk = referenceSelectionResult.primaryReference;
                secondaryReferenceChunks = referenceSelectionResult.secondaryReferences;
                
                console.log('[AICoachService] Primary Reference Selection:', {
                    hasPrimaryReference: primaryReferenceChunk !== null,
                    primaryReferenceChapter: primaryReferenceChunk?.chapter_title || null,
                    primaryReferenceDay: primaryReferenceChunk?.day || null,
                    primaryReferenceTopic: primaryReferenceChunk?.primary_topic || primaryReferenceChunk?.metadata?.primary_topic || null,
                    isDedicated: primaryReferenceChunk?.is_dedicated_topic_chapter || primaryReferenceChunk?.metadata?.is_dedicated_topic_chapter || false,
                    secondaryReferencesCount: secondaryReferenceChunks.length,
                    requiresDisclaimer: referenceSelectionResult.requiresDisclaimer,
                    validPrimaryChunksCount: referenceSelectionResult.validPrimaryChunksCount,
                    foundationalChunksCount: referenceSelectionResult.foundationalChunksCount
                });
                
                // CRITICAL: If no valid primary reference found for a named concept, log error
                if (!primaryReferenceChunk && conceptDetectionForRefs.conceptNames.length > 0) {
                    console.error(`[AICoachService] ERROR: Named concept(s) detected (${conceptDetectionForRefs.conceptNames.join(', ')}) but NO valid primary reference selected!`);
                    console.error(`[AICoachService] Selected chunks:`, selectedChunks.map(c => ({
                        chapter: c.chapter_title || c.chapter_id,
                        day: c.day,
                        topic: c.primary_topic || c.metadata?.primary_topic,
                        dedicated: c.is_dedicated_topic_chapter || c.metadata?.is_dedicated_topic_chapter,
                        coverage: c.coverage_level || c.metadata?.coverage_level,
                        completeness: c.completeness_score ?? c.metadata?.completeness_score
                    })));
                }
            } else {
                // No concept detected - use first NON-FOUNDATIONAL chunk as primary (fallback)
                // CRITICAL: Never use foundational chunks as primary, even in fallback
                const nonFoundationalChunks = selectedChunks.filter(chunk => {
                    const coverageLevel = (chunk.coverage_level || chunk.metadata?.coverage_level || 'introduction').toLowerCase();
                    const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 0;
                    const isFoundational = (coverageLevel === 'introduction' && completenessScore < 0.4) ||
                                         (chunk.day && chunk.day <= 2);
                    return !isFoundational;
                });
                
                if (nonFoundationalChunks.length > 0) {
                    primaryReferenceChunk = nonFoundationalChunks[0];
                    secondaryReferenceChunks = selectedChunks.filter(chunk => chunk !== primaryReferenceChunk);
                    console.log('[AICoachService] Fallback: Using first non-foundational chunk as primary:', {
                        chapter: primaryReferenceChunk.chapter_title || primaryReferenceChunk.chapter_id,
                        day: primaryReferenceChunk.day
                    });
                } else if (selectedChunks.length > 0) {
                    // Only foundational chunks available - mark as concept introduction
                    primaryReferenceChunk = {
                        ...selectedChunks[0],
                        isConceptIntroduction: true
                    };
                    secondaryReferenceChunks = selectedChunks.slice(1);
                    console.warn('[AICoachService] Fallback: Only foundational chunks available, marking as concept introduction');
                }
            }

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

            // 11a. Answer Governance Check - Evaluate if answer generation should proceed
            // This runs AFTER chunk selection and BEFORE answer generation
            console.log('[AICoachService] Running answer governance check...');
            
            // Extract topic modifiers for governance check (if not already extracted)
            const topicModifiersForGovernance = contextBuilderService.extractTopicModifiers(processedQuestion);
            
            // Detect course concepts for anchoring (if not already done)
            const conceptDetection = contextBuilderService.detectCourseConcepts(question);
            if (conceptDetection.requiresCourseAnchoring) {
                console.log(`[AICoachService] Course Anchoring: Detected concepts requiring anchoring: ${conceptDetection.conceptNames.join(', ')}`);
            }
            
            const governanceResult = await answerGovernanceService.evaluateAnswerReadiness({
                question,
                processedQuestion,
                intent,
                selectedChunks,
                allRetrievedChunks: similarChunks, // All chunks before filtering/prioritization
                specificReferences,
                topicKeywords,
                topicModifiers: topicModifiersForGovernance, // Pass topic modifiers for enhanced topic integrity check
                depthClassification, // Pass depth classification for procedural contract validation
                context: fullContext
            });
            
            // Log anchoring diagnostics
            if (governanceResult.anchoringInfo) {
                console.log('[AICoachService] Course Anchoring Diagnostics:', {
                    requiresAnchoring: governanceResult.anchoringInfo.requiresAnchoring,
                    detectedConcepts: governanceResult.anchoringInfo.detectedConcepts,
                    anchoringChunksFound: governanceResult.anchoringInfo.anchoringChunksFound,
                    anchoringChunksCount: governanceResult.anchoringInfo.anchoringChunksCount || 0,
                    anchoringChapterTitles: governanceResult.anchoringInfo.anchoringChapterTitles || []
                });
            }

            // Handle governance decision
            if (!governanceResult.allowed) {
                console.warn('[AICoachService] Answer governance check failed:', {
                    action: governanceResult.action,
                    reason: governanceResult.reason,
                    violations: governanceResult.violations.length,
                    warnings: governanceResult.warnings.length
                });

                // Handle different actions
                switch (governanceResult.action) {
                    case 'block':
                        // CRITICAL: Only escalate if shouldEscalate is true (not for introduced/applied concepts)
                        // Escalation MUST trigger ONLY when:
                        // - Answer is factually incorrect
                        // - Lab reference mismatch
                        // - Confidence < threshold due to missing content (not shallowness)
                        let blockEscalationId = null;
                        
                        // Check if escalation should be skipped (for introduced/applied concepts)
                        const shouldEscalateBlock = governanceResult.shouldEscalate !== false && 
                                                    governanceResult.anchoringInfo?.shouldEscalate !== false;
                        
                        if (shouldEscalateBlock) {
                            try {
                                // Store query first (even though answer is blocked)
                                let queryId = null;
                                try {
                                    queryId = await this._storeQuery(learnerId, courseId, processedQuestion, intent, fullContext);
                                } catch (error) {
                                    console.warn('[AICoachService] Failed to store query for blocked answer escalation:', error);
                                }

                                // Create escalation for blocked answer (only if shouldEscalate is true)
                                const escalation = await escalationService.createEscalation(
                                queryId, // Can be null
                                learnerId,
                                courseId,
                                processedQuestion,
                                0.0, // Zero confidence - answer blocked
                                {
                                    chunkIds: selectedChunks.map(c => c.id),
                                    chunksUsed: selectedChunks.length,
                                    intent,
                                    modelUsed: null // No model used since answer was blocked
                                },
                                {
                                    completedChapters: fullContext.progressContext.completedChapters,
                                    inProgressChapters: fullContext.progressContext.inProgressChapters,
                                    currentDay: fullContext.currentContext.currentDay,
                                    currentChapter: fullContext.currentContext.currentChapter
                                },
                                {
                                    reason: 'blocked',
                                    violatedInvariants: governanceResult.violations || [],
                                    chunksUsed: selectedChunks.map(chunk => ({
                                        id: chunk.id,
                                        day: chunk.day,
                                        chapter_id: chunk.chapter_id,
                                        chapter_title: chunk.chapter_title,
                                        lab_id: chunk.lab_id,
                                        content_type: chunk.content_type,
                                        content: chunk.content,
                                        similarity: chunk.similarity,
                                        coverage_level: chunk.coverage_level,
                                        completeness_score: chunk.completeness_score,
                                        primary_topic: chunk.primary_topic,
                                        is_dedicated_topic_chapter: chunk.is_dedicated_topic_chapter
                                    })),
                                    governanceDetails: {
                                        violations: governanceResult.violations,
                                        warnings: governanceResult.warnings,
                                        recommendations: governanceResult.recommendations,
                                        actionDetails: governanceResult.actionDetails
                                    }
                                }
                            );
                            blockEscalationId = escalation.id;
                            console.log('[AICoachService] Escalation created for blocked answer:', blockEscalationId);
                        } catch (error) {
                            console.error('[AICoachService] CRITICAL: Failed to create escalation for blocked answer:', error);
                            // Don't throw - we still want to return the error to the user
                        }
                        } else {
                            console.log('[AICoachService] Skipping escalation for blocked answer (introduced/applied concept or shallow answer)');
                        }

                        return {
                            success: false,
                            error: governanceResult.reason || 'Answer generation blocked by governance rules',
                            queryId: null,
                            escalationId: blockEscalationId,
                            governanceDetails: {
                                violations: governanceResult.violations,
                                warnings: governanceResult.warnings,
                                recommendations: governanceResult.recommendations
                            }
                        };

                    case 'clarify':
                        // Use user-friendly message if available (e.g., from procedural contract)
                        const clarifyMessage = governanceResult.actionDetails?.userMessage || 
                                              governanceResult.actionDetails?.message ||
                                              governanceResult.reason || 
                                              'Please clarify your question';
                        
                        // Create escalation for clarification needed (if there are violations)
                        let clarifyEscalationId = null;
                        if (governanceResult.violations && governanceResult.violations.length > 0) {
                            try {
                                let queryId = null;
                                try {
                                    queryId = await this._storeQuery(learnerId, courseId, processedQuestion, intent, fullContext);
                                } catch (error) {
                                    console.warn('[AICoachService] Failed to store query for clarification escalation:', error);
                                }

                                const escalation = await escalationService.createEscalation(
                                    queryId,
                                    learnerId,
                                    courseId,
                                    processedQuestion,
                                    0.5, // Low confidence - needs clarification
                                    {
                                        chunkIds: selectedChunks.map(c => c.id),
                                        chunksUsed: selectedChunks.length,
                                        intent,
                                        modelUsed: null
                                    },
                                    {
                                        completedChapters: fullContext.progressContext.completedChapters,
                                        inProgressChapters: fullContext.progressContext.inProgressChapters,
                                        currentDay: fullContext.currentContext.currentDay,
                                        currentChapter: fullContext.currentContext.currentChapter
                                    },
                                    {
                                        reason: 'invariant_violation', // Clarification needed due to violations
                                        violatedInvariants: governanceResult.violations || [],
                                        chunksUsed: selectedChunks.map(chunk => ({
                                            id: chunk.id,
                                            day: chunk.day,
                                            chapter_id: chunk.chapter_id,
                                            chapter_title: chunk.chapter_title,
                                            lab_id: chunk.lab_id,
                                            content_type: chunk.content_type,
                                            content: chunk.content,
                                            similarity: chunk.similarity
                                        })),
                                        governanceDetails: {
                                            violations: governanceResult.violations,
                                            warnings: governanceResult.warnings,
                                            actionDetails: governanceResult.actionDetails
                                        }
                                    }
                                );
                                clarifyEscalationId = escalation.id;
                                console.log('[AICoachService] Escalation created for clarification needed:', clarifyEscalationId);
                            } catch (error) {
                                console.warn('[AICoachService] Failed to create escalation for clarification:', error);
                            }
                        }

                        return {
                            success: false,
                            error: clarifyMessage,
                            queryId: null,
                            escalationId: clarifyEscalationId,
                            needsClarification: true,
                            clarificationDetails: governanceResult.actionDetails,
                            governanceDetails: {
                                violations: governanceResult.violations,
                                warnings: governanceResult.warnings,
                                recommendations: governanceResult.recommendations
                            }
                        };

                    case 'escalate':
                        // Governance recommends escalation - create escalation but still allow answer generation
                        // Escalation will also be created after answer generation if confidence is low
                        try {
                            let queryId = null;
                            try {
                                queryId = await this._storeQuery(learnerId, courseId, processedQuestion, intent, fullContext);
                            } catch (error) {
                                console.warn('[AICoachService] Failed to store query for governance escalation:', error);
                            }

                            await escalationService.createEscalation(
                                queryId,
                                learnerId,
                                courseId,
                                processedQuestion,
                                0.6, // Medium confidence - flagged for escalation
                                {
                                    chunkIds: selectedChunks.map(c => c.id),
                                    chunksUsed: selectedChunks.length,
                                    intent,
                                    modelUsed: null
                                },
                                {
                                    completedChapters: fullContext.progressContext.completedChapters,
                                    inProgressChapters: fullContext.progressContext.inProgressChapters,
                                    currentDay: fullContext.currentContext.currentDay,
                                    currentChapter: fullContext.currentContext.currentChapter
                                },
                                {
                                    reason: 'invariant_violation',
                                    violatedInvariants: governanceResult.violations || [],
                                    chunksUsed: selectedChunks.map(chunk => ({
                                        id: chunk.id,
                                        day: chunk.day,
                                        chapter_id: chunk.chapter_id,
                                        chapter_title: chunk.chapter_title,
                                        content_type: chunk.content_type,
                                        similarity: chunk.similarity
                                    })),
                                    governanceDetails: {
                                        violations: governanceResult.violations,
                                        warnings: governanceResult.warnings,
                                        actionDetails: governanceResult.actionDetails
                                    }
                                }
                            );
                            console.log('[AICoachService] Escalation created per governance recommendation');
                        } catch (error) {
                            console.warn('[AICoachService] Failed to create governance escalation:', error);
                        }
                        // Continue to answer generation - escalation will also be handled later if confidence is low
                        break;

                    case 'retry':
                        // Handle retry action - especially for Course Anchoring
                        console.warn('[AICoachService] Governance recommends retry:', governanceResult.reason);
                        console.warn('[AICoachService] Retry details:', governanceResult.actionDetails);
                        
                        // Check if this is a Course Anchoring retry
                        if (governanceResult.anchoringInfo && governanceResult.anchoringInfo.requiresAnchoring) {
                            const retryFilters = governanceResult.actionDetails?.retryFilters;
                            if (retryFilters) {
                                console.log('[AICoachService] Attempting retry with strict filters for Course Anchoring:', retryFilters);
                                
                                try {
                                    // Retry retrieval with strict filters
                                    const retryChunks = await retrievalService.searchTopicSpecificChunks(
                                        governanceResult.anchoringInfo.detectedConcepts,
                                        courseId,
                                        searchFilters,
                                        20
                                    );
                                    
                                    // Also search for dedicated chapters
                                    const retryDedicatedChunks = await retrievalService.searchDedicatedChaptersByTopic(
                                        governanceResult.anchoringInfo.detectedConcepts,
                                        courseId,
                                        searchFilters
                                    );
                                    
                                    // Merge retry results
                                    const allRetryChunks = [...retryDedicatedChunks, ...retryChunks];
                                    
                                    if (allRetryChunks.length > 0) {
                                        console.log(`[AICoachService] Retry found ${allRetryChunks.length} anchoring chunks, replacing selected chunks`);
                                        // Replace selected chunks with retry results
                                        selectedChunks = allRetryChunks.slice(0, 10); // Limit to top 10
                                        // Re-prioritize
                                        selectedChunks = contextBuilderService.prioritizeChunks(selectedChunks, processedQuestion, fullContext.progressContext);
                                        // Re-run governance check with new chunks
                                        const retryGovernanceResult = await answerGovernanceService.evaluateAnswerReadiness({
                                            question,
                                            processedQuestion,
                                            intent,
                                            selectedChunks,
                                            allRetrievedChunks: allRetryChunks,
                                            specificReferences,
                                            topicKeywords,
                                            topicModifiers: topicModifiersForGovernance,
                                            depthClassification,
                                            context: fullContext
                                        });
                                        
                                        if (retryGovernanceResult.allowed) {
                                            console.log('[AICoachService] Retry successful - anchoring chunks found');
                                            // Update governanceResult to allow proceeding
                                            governanceResult.allowed = true;
                                            governanceResult.action = 'allow';
                                            governanceResult.anchoringInfo = retryGovernanceResult.anchoringInfo;
                                            break; // Exit switch, proceed to answer generation
                                        } else {
                                            console.warn('[AICoachService] Retry failed - still no anchoring chunks found');
                                            // Fall through to block/escalate
                                        }
                                    } else {
                                        console.warn('[AICoachService] Retry found no anchoring chunks');
                                        // Fall through to block/escalate
                                    }
                                } catch (retryError) {
                                    console.error('[AICoachService] Error during retry:', retryError);
                                    // Fall through to block/escalate
                                }
                            }
                        }
                        
                        // If retry didn't succeed, treat as block
                        if (!governanceResult.allowed) {
                            // Fall through to block case
                            console.warn('[AICoachService] Retry failed or not applicable, treating as block');
                            // Continue to block handling below
                            break;
                        }
                        break;

                    default:
                        // Unknown action - block for safety
                        return {
                            success: false,
                            error: 'Answer generation blocked by governance rules',
                            queryId: null,
                            governanceDetails: governanceResult
                        };
                }
            } else {
                console.log('[AICoachService] Answer governance check passed');
                if (governanceResult.warnings.length > 0) {
                    console.warn('[AICoachService] Governance warnings (non-blocking):', governanceResult.warnings);
                }
            }

            // 12. Build system prompt (include depth classification and anchoring info)
            const anchoringInfo = governanceResult.anchoringInfo || null;
            const systemPrompt = await this._buildSystemPrompt(courseId, learnerId, intent, labStruggle, depthClassification, anchoringInfo);

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

            // 14. Assemble references from validated chunks ONLY (SYSTEM-OWNED, not LLM-generated)
            // CRITICAL: References come ONLY from validated chunks, never from LLM output
            let references = [];
            
            if (primaryReferenceChunk && referenceSelectionResult) {
                // Add primary reference first (if exists and is valid)
                if (primaryReferenceChunk && !primaryReferenceChunk.isConceptIntroduction) {
                    references.push({
                        day: primaryReferenceChunk.day,
                        chapter: primaryReferenceChunk.chapter_id,
                        chapter_title: primaryReferenceChunk.chapter_title,
                        lab_id: primaryReferenceChunk.lab_id || null,
                        is_primary: true
                    });
                } else if (primaryReferenceChunk?.isConceptIntroduction) {
                    // Concept introduction - no primary reference, will show disclaimer
                    // Don't add as primary reference
                }
                
                // Add secondary references (excluding primary)
                const secondaryRefs = secondaryReferenceChunks
                    .filter(chunk => chunk !== primaryReferenceChunk)
                    .map(chunk => ({
                day: chunk.day,
                chapter: chunk.chapter_id,
                chapter_title: chunk.chapter_title,
                        lab_id: chunk.lab_id || null,
                        is_primary: false
                    }));
                references.push(...secondaryRefs);
            } else {
                // Fallback: use selected chunks in order (but still system-owned)
                references = selectedChunks.map(chunk => ({
                    day: chunk.day,
                    chapter: chunk.chapter_id,
                    chapter_title: chunk.chapter_title,
                    lab_id: chunk.lab_id || null,
                    is_primary: false
                }));
            }

            // CRITICAL: Ensure foundational chapters are never primary for named concepts
            if (conceptDetectionForRefs.requiresCourseAnchoring && references.length > 0) {
                const firstRef = references[0];
                // Check if first reference is foundational by looking at the chunk
                const firstChunk = selectedChunks.find(c => 
                    c.chapter_id === firstRef.chapter && c.day === firstRef.day
                );
                if (firstChunk) {
                    const isFoundational = (firstChunk.coverage_level === 'introduction' && 
                                          (firstChunk.completeness_score ?? 0) < 0.4);
                    
                    if (isFoundational && firstRef.is_primary) {
                        // Move foundational to secondary, remove primary
                        console.warn('[AICoachService] CRITICAL: Foundational chapter detected as primary reference - removing');
                        references = references.filter(r => !r.is_primary);
                        // No primary reference - will show disclaimer
                    }
                }
            }
            
            // 14a. Validate references match question context
            const referenceValidation = this._validateReferences(processedQuestion, references, selectedChunks);
            
            // 14a1. Validate course anchoring references (if anchoring required)
            if (governanceResult.anchoringInfo && governanceResult.anchoringInfo.requiresAnchoring && governanceResult.anchoringInfo.anchoringChunksFound) {
                const anchoringReferenceValidation = this._validateAnchoringReferences(references, governanceResult.anchoringInfo);
                if (!anchoringReferenceValidation.passed) {
                    console.warn('[AICoachService] Course anchoring reference validation failed:', anchoringReferenceValidation.reason);
                    // This is a critical violation - answer must reference anchoring chapters
                    referenceValidation.warnings.push({
                        severity: 'high',
                        message: anchoringReferenceValidation.reason
                    });
                } else {
                    console.log('[AICoachService] Course anchoring reference validation passed');
                }
            }
            
            // 14b. Calculate confidence adjustment factors
            const adjustmentFactors = this._calculateConfidenceAdjustments(
                referenceValidation,
                selectedChunks,
                topicKeywords,
                topicModifiersForGovernance,
                processedQuestion
            );
            
            // 14c. Recalculate confidence with adjustments
            let adjustedConfidence = await llmService.estimateConfidence(
                processedQuestion,
                selectedChunks,
                answerResult.answer,
                adjustmentFactors
            );
            
            // 14d. CRITICAL: If confidence > 0.7 AND reference validation fails, downgrade and force escalation
            const referenceValidationFailed = referenceValidation.warnings.length > 0 && 
                (referenceValidation.warnings.some(w => w.severity === 'high') || 
                 (specificReferences.hasSpecificReference && referenceValidation.warnings.length > 0));
            
            let confidenceDowngraded = false;
            let forceEscalation = false;
            let learnerWarning = null;
            
            if (adjustedConfidence > 0.7 && referenceValidationFailed) {
                console.warn('[AICoachService] CRITICAL: High confidence (>0.7) but reference validation failed. Downgrading confidence and forcing escalation.');
                
                // Downgrade confidence significantly
                adjustedConfidence = Math.min(adjustedConfidence, 0.5); // Cap at 0.5
                confidenceDowngraded = true;
                forceEscalation = true;
                
                // Create learner warning
                const highSeverityWarnings = referenceValidation.warnings.filter(w => w.severity === 'high');
                if (highSeverityWarnings.length > 0) {
                    learnerWarning = `⚠️ Note: The answer references may not fully match your question. Please verify the referenced chapters match what you asked about.`;
                } else {
                    learnerWarning = `⚠️ Note: Some references in the answer may not perfectly match your question. Please review the referenced chapters.`;
                }
            }
            
            // Update answerResult with adjusted confidence
            answerResult.confidence = adjustedConfidence;
            
            if (referenceValidation.warnings.length > 0) {
                // Log all warnings
                referenceValidation.warnings.forEach(warning => {
                    console.warn(`[AICoachService] ${warning.severity === 'high' ? 'HIGH PRIORITY' : ''} ${warning.message}`);
                });
                
                // If specific references were provided and validation failed, this is a critical issue
                if (specificReferences.hasSpecificReference && referenceValidation.warnings.some(w => w.severity === 'high')) {
                    console.error('[AICoachService] CRITICAL: Specific references provided but validation failed. This may indicate wrong content was retrieved.');
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
                console.log('[AICoachService] Stored query:', queryId);
                
                responseId = await this._storeResponse(
                    queryId,
                    answerResult,
                    references,
                    isLabGuidance
                );
                console.log('[AICoachService] Stored response:', responseId);

                // 16. Store conversation history (only if both queryId and responseId are valid)
                if (queryId && responseId) {
                    await this._storeConversationHistory(learnerId, courseId, queryId, responseId);
                } else {
                    console.warn('[AICoachService] Skipping conversation history: missing queryId or responseId', {
                        queryId,
                        responseId
                    });
                }
            } catch (storageError) {
                console.error('[AICoachService] Failed to store query/response in database:', storageError);
                console.error('[AICoachService] Storage error details:', {
                    message: storageError.message,
                    code: storageError.code,
                    details: storageError.details,
                    hint: storageError.hint,
                    queryId,
                    responseId
                });
                // Continue anyway - we still have the answer to return to the user
                // This prevents RLS errors from blocking the user experience
            }

            // 17. Check if escalation needed and create escalation if needed
            // CRITICAL: Escalate if:
            // - Low confidence (< threshold)
            // - Confidence was downgraded due to reference validation failure
            // - Invariant violations occurred (even if answer was generated)
            const hasInvariantViolations = governanceResult && governanceResult.violations && governanceResult.violations.length > 0;
            const shouldEscalate = forceEscalation || 
                                 answerResult.confidence < this.confidenceThreshold || 
                                 hasInvariantViolations;
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
                            modelUsed: answerResult.modelUsed,
                            adjustmentFactors: adjustmentFactors
                        },
                        {
                            completedChapters: fullContext.progressContext.completedChapters,
                            inProgressChapters: fullContext.progressContext.inProgressChapters,
                            currentDay: fullContext.currentContext.currentDay,
                            currentChapter: fullContext.currentContext.currentChapter
                        },
                        {
                            reason: forceEscalation ? 'reference_validation_failed' : 
                                   (answerResult.confidence < this.confidenceThreshold ? 'low_confidence' : 'invariant_violation'),
                            violatedInvariants: (governanceResult && governanceResult.violations) || [],
                            chunksUsed: selectedChunks.map(chunk => ({
                                id: chunk.id,
                                day: chunk.day,
                                chapter_id: chunk.chapter_id,
                                chapter_title: chunk.chapter_title,
                                lab_id: chunk.lab_id,
                                content_type: chunk.content_type,
                                content: chunk.content ? chunk.content.substring(0, 1000) : null, // First 1000 chars
                                similarity: chunk.similarity,
                                coverage_level: chunk.coverage_level,
                                completeness_score: chunk.completeness_score,
                                primary_topic: chunk.primary_topic,
                                is_dedicated_topic_chapter: chunk.is_dedicated_topic_chapter
                            })),
                            governanceDetails: governanceResult ? {
                                violations: governanceResult.violations,
                                warnings: governanceResult.warnings,
                                recommendations: governanceResult.recommendations,
                                actionDetails: governanceResult.actionDetails
                            } : null,
                            referenceValidationFailed: referenceValidationFailed,
                            confidenceDowngraded: confidenceDowngraded
                        }
                    );
                    escalationId = escalation.id;
                    const escalationReason = forceEscalation ? 'reference validation failure' : 
                                          (answerResult.confidence < this.confidenceThreshold ? 'low confidence' : 'invariant violation');
                    console.log(`[AICoachService] Escalation created (${escalationReason}):`, escalationId);
                } catch (error) {
                    console.warn('[AICoachService] Failed to create escalation:', error);
                    // Don't fail the query if escalation fails
                }
            }

            const responseTime = Date.now() - startTime;
            console.log(`[AICoachService] Query processed successfully in ${responseTime}ms`, {
                stepTimes: stepTimes,
                queryId,
                confidence: adjustedConfidence,
                escalationId
            });

            // 18. Enforce primary reference rules at render time
            let finalReferences = references;
            if (conceptDetectionForRefs && primaryReferenceChunk && referenceSelectionResult) {
                try {
                    finalReferences = this._enforcePrimaryReferenceRules(
                        references,
                        conceptDetectionForRefs,
                        primaryReferenceChunk,
                        referenceSelectionResult
                    );
                } catch (error) {
                    console.error('[AICoachService] Error enforcing primary reference rules:', error);
                    // Fall back to original references if enforcement fails
                    finalReferences = references;
                }
            }

            return {
                success: true,
                queryId,
                responseId,
                answer: answerResult.answer, // Already stripped of LLM references
                references: finalReferences, // System-assembled references only
                confidence: adjustedConfidence,
                nextSteps: this._generateNextSteps(selectedChunks, fullContext.progressContext),
                escalated: shouldEscalate,
                escalationId,
                isLabGuidance,
                wordCount: answerResult.wordCount,
                tokensUsed: answerResult.tokensUsed,
                modelUsed: answerResult.modelUsed,
                responseTimeMs: responseTime,
                learnerWarning: learnerWarning, // Warning message for learner if confidence was downgraded
                confidenceDowngraded: confidenceDowngraded,
                referenceValidationFailed: referenceValidationFailed
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
     * @param {Object} depthClassification - Query depth type classification
     * @param {Object} anchoringInfo - Course anchoring information
     * @returns {Promise<Object>} System prompt configuration
     */
    async _buildSystemPrompt(courseId, learnerId, intent, labStruggle, depthClassification = null, anchoringInfo = null) {
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
2. Do NOT include chapter, day, or lab references in your answer (e.g., "Day X → Chapter Y", "Chapter X", "Lab Y")
3. If uncertain, explicitly state uncertainty
4. Maintain a supportive, instructional tone
5. Only answer questions about the current course (${courseName})
6. If question is about a different course, redirect to current course
7. CRITICAL: References will be added automatically by the system - do NOT generate them yourself`;

        // Add course anchoring instructions (HARD RULE - must be automatic and non-optional)
        if (anchoringInfo && anchoringInfo.requiresAnchoring && anchoringInfo.anchoringChunksFound) {
            const conceptNames = anchoringInfo.detectedConcepts.join(', ');
            const chapterTitles = anchoringInfo.anchoringChapterTitles.join(', ');
            
            basePrompt += `\n\nCOURSE ANCHORING RULES (CRITICAL - HARD RULE):
- This question is about a named course concept: ${conceptNames}
- You MUST explain this concept using the framework, steps, and terminology used in the referenced course chapter(s): ${chapterTitles}
- Do NOT answer using generic industry explanations alone
- Ground your answer explicitly in how THIS course teaches the concept
- Use the course's specific terminology and frameworks
- If the course uses a specific methodology or approach, use that exact approach
- Example: If the course teaches AEO with specific steps, use those exact steps, not generic AEO advice
- CRITICAL: Do NOT include chapter references (Day X, Chapter Y) in your answer - the system will add them automatically`;
            
            console.log(`[AICoachService] Added course anchoring instructions for concepts: ${conceptNames}, chapters: ${chapterTitles}`);
        }

        // Add list request specific instructions
        if (intent === 'list_request') {
            basePrompt += `\n\nLIST REQUEST RULES (CRITICAL):
- When asked to "list" items from a specific chapter, extract and enumerate ALL items, not just a summary
- When a specific chapter is mentioned (e.g., "Day 4, Chapter 2"), extract content ONLY from that chapter
- For listing requests, provide complete enumeration in structured format (numbered or bulleted list)
- Don't summarize - list all items comprehensively
- If the chapter has 10 examples, list all 10 (not just 3-4)
- Format: Use clear numbered or bulleted lists for easy reading
- CRITICAL: Do NOT include chapter references (Day X, Chapter Y) in your answer - the system will add them automatically`;
        }

        // Add depth type specific instructions
        if (depthClassification) {
            switch (depthClassification.depthType) {
                case 'procedural':
                    basePrompt += `\n\nPROCEDURAL QUERY RULES (CRITICAL):
- This is a "how-to" question that requires step-by-step implementation guidance
- MUST provide step-by-step structure (numbered steps or clear sequential format)
- Structure: Step 1 → Step 2 → Step 3... (or First → Then → Next → Finally)
- Include specific actions, not just concepts
- Example format:
  Step 1: [Action]
  Step 2: [Action]
  Step 3: [Action]
- Do NOT provide purely conceptual answers - must include actionable steps
- CRITICAL: Do NOT include chapter references (Day X, Chapter Y) in your answer - the system will add them automatically`;
                    break;
                case 'troubleshooting':
                    basePrompt += `\n\nTROUBLESHOOTING QUERY RULES:
- This is a troubleshooting question that requires diagnostic steps
- Provide step-by-step diagnostic process
- Structure: Check X → If Y, then Z → If not, check A
- CRITICAL: Do NOT include chapter references (Day X, Chapter Y) in your answer - the system will add them automatically`;
                    break;
                case 'comparison':
                    basePrompt += `\n\nCOMPARISON QUERY RULES:
- This is a comparison question that requires side-by-side analysis
- Structure: Use clear comparison format (table or structured list)
- Highlight key differences and similarities
- CRITICAL: Do NOT include chapter references (Day X, Chapter Y) in your answer - the system will add them automatically`;
                    break;
                case 'definition':
                    basePrompt += `\n\nDEFINITION QUERY RULES:
- This is a definition question - provide concise, clear definition
- Start with direct definition, then add context if needed
- Keep it focused and to the point`;
                    break;
            }
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
        // Validate required parameters
        if (!learnerId || !courseId || !queryId || !responseId) {
            console.error('[AICoachService] Cannot store conversation history: missing required parameters', {
                learnerId,
                courseId,
                queryId,
                responseId
            });
            throw new Error('Missing required parameters for conversation history');
        }

        try {
            // Get current sequence number
            const { data: lastHistory, error: selectError } = await supabaseClient
                .from('ai_coach_conversation_history')
                .select('sequence_number')
                .eq('learner_id', learnerId)
                .eq('course_id', courseId)
                .order('sequence_number', { ascending: false })
                .limit(1)
                .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

            if (selectError) {
                console.error('[AICoachService] Error fetching last sequence number:', selectError);
                throw selectError;
            }

            const sequenceNumber = lastHistory ? lastHistory.sequence_number + 1 : 1;

            // Insert conversation history
            const { data, error: insertError } = await supabaseClient
                .from('ai_coach_conversation_history')
                .insert({
                    learner_id: learnerId,
                    course_id: courseId,
                    query_id: queryId,
                    response_id: responseId,
                    sequence_number: sequenceNumber
                })
                .select()
                .single();

            if (insertError) {
                console.error('[AICoachService] Error inserting conversation history:', insertError);
                throw insertError;
            }

            console.log('[AICoachService] Successfully stored conversation history:', {
                id: data.id,
                queryId,
                responseId,
                sequenceNumber
            });
        } catch (error) {
            console.error('[AICoachService] Failed to store conversation history:', error);
            throw error; // Re-throw to be caught by the calling function
        }
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
    /**
     * Calculate confidence adjustment factors based on reference integrity, topic specificity, and chunk agreement
     * @param {Object} referenceValidation - Reference validation result
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {Array<string>} topicKeywords - Topic keywords
     * @param {Array<string>} topicModifiers - Topic modifiers
     * @param {string} question - User question
     * @returns {Object} Adjustment factors (referenceIntegrity, topicSpecificity, chunkAgreement)
     * @private
     */
    _calculateConfidenceAdjustments(referenceValidation, selectedChunks, topicKeywords, topicModifiers, question) {
        // 1. Reference Integrity Score (0-1)
        // Higher score = better reference integrity
        let referenceIntegrity = 1.0;
        
        if (referenceValidation.warnings.length > 0) {
            const highSeverityWarnings = referenceValidation.warnings.filter(w => w.severity === 'high');
            const mediumSeverityWarnings = referenceValidation.warnings.filter(w => w.severity === 'medium');
            
            // High severity warnings significantly reduce integrity
            referenceIntegrity -= (highSeverityWarnings.length * 0.3);
            
            // Medium severity warnings moderately reduce integrity
            referenceIntegrity -= (mediumSeverityWarnings.length * 0.15);
            
            // Clamp to valid range
            referenceIntegrity = Math.max(0, Math.min(1, referenceIntegrity));
        }
        
        // 2. Topic Specificity Score (0-1)
        // Higher score = better topic match
        let topicSpecificity = 0.5; // Default: moderate specificity
        
        if (topicKeywords.length > 0 || topicModifiers.length > 0) {
            const allTopics = [...topicKeywords, ...topicModifiers];
            let matchingChunks = 0;
            
            selectedChunks.forEach(chunk => {
                const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
                const chapterTitle = (chunk.chapter_title || '').toLowerCase();
                const content = (chunk.content || '').toLowerCase();
                
                // Check if chunk matches any topic
                const matchesTopic = allTopics.some(topic => {
                    const topicLower = topic.toLowerCase();
                    return primaryTopic.includes(topicLower) ||
                           chapterTitle.includes(topicLower) ||
                           content.includes(topicLower);
                });
                
                if (matchesTopic) {
                    matchingChunks++;
                }
            });
            
            // Calculate specificity: ratio of matching chunks
            topicSpecificity = selectedChunks.length > 0 ? 
                (matchingChunks / selectedChunks.length) : 0.5;
            
            // Boost if dedicated topic chapters are present
            const hasDedicatedChapters = selectedChunks.some(chunk => 
                chunk.is_dedicated_topic_chapter || chunk.isDedicatedTopicMatch
            );
            if (hasDedicatedChapters) {
                topicSpecificity = Math.min(1.0, topicSpecificity + 0.2);
            }
        } else {
            // No specific topics - assume moderate specificity
            topicSpecificity = 0.6;
        }
        
        // 3. Chunk Agreement Score (0-1)
        // Higher score = better agreement between chunks
        let chunkAgreement = 0.5; // Default: moderate agreement
        
        if (selectedChunks.length > 0) {
            // Calculate average similarity
            const similarities = selectedChunks
                .map(chunk => chunk.similarity || 0)
                .filter(sim => sim > 0);
            
            if (similarities.length > 0) {
                const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
                chunkAgreement = avgSimilarity; // Use average similarity as agreement score
            }
            
            // Check coverage level consistency
            const coverageLevels = selectedChunks
                .map(chunk => chunk.coverage_level || chunk.metadata?.coverage_level)
                .filter(level => level);
            
            if (coverageLevels.length > 1) {
                const uniqueLevels = new Set(coverageLevels);
                // If all chunks have same coverage level, boost agreement
                if (uniqueLevels.size === 1) {
                    chunkAgreement = Math.min(1.0, chunkAgreement + 0.1);
                } else {
                    // Mixed coverage levels - slight penalty
                    chunkAgreement = Math.max(0, chunkAgreement - 0.1);
                }
            }
            
            // Check if chunks are from same day/chapter (better agreement)
            const days = selectedChunks
                .map(chunk => chunk.day)
                .filter(day => day);
            const uniqueDays = new Set(days);
            
            if (uniqueDays.size === 1 && days.length > 1) {
                // All chunks from same day - boost agreement
                chunkAgreement = Math.min(1.0, chunkAgreement + 0.1);
            }
        }
        
        return {
            referenceIntegrity,
            topicSpecificity,
            chunkAgreement
        };
    }

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
     * Validate that references include anchoring chapters for course concepts
     * @param {Array<Object>} references - Answer references
     * @param {Object} anchoringInfo - Course anchoring information
     * @returns {Object} Validation result
     * @private
     */
    _validateAnchoringReferences(references, anchoringInfo) {
        if (!anchoringInfo || !anchoringInfo.requiresAnchoring || !anchoringInfo.anchoringChunksFound) {
            return { passed: true };
        }

        const anchoringChapterTitles = anchoringInfo.anchoringChapterTitles || [];
        if (anchoringChapterTitles.length === 0) {
            return { passed: true }; // No specific chapters to validate
        }

        // Check if at least one reference matches an anchoring chapter
        const hasAnchoringReference = references.some(ref => {
            const refChapterTitle = (ref.chapter_title || '').toLowerCase();
            return anchoringChapterTitles.some(anchorTitle => {
                const anchorTitleLower = anchorTitle.toLowerCase();
                return refChapterTitle.includes(anchorTitleLower) || anchorTitleLower.includes(refChapterTitle);
            });
        });

        if (!hasAnchoringReference) {
            return {
                passed: false,
                reason: `Answer must reference at least one anchoring chapter (${anchoringChapterTitles.join(', ')}) for the concept(s): ${anchoringInfo.detectedConcepts.join(', ')}`
            };
        }

        return { passed: true };
    }

    /**
     * Select primary reference chunk for named concepts
     * Primary reference MUST satisfy at least ONE:
     * - chunk.primary_topic == concept
     * - chunk.is_dedicated_topic_chapter == true
     * - chapter_title contains concept explicitly
     * 
     * Foundational chapters MUST NEVER be selected as primary_reference
     * 
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {Array<string>} conceptNames - Detected concept names
     * @param {string} processedQuestion - Preprocessed question
     * @returns {Object} Primary reference selection result
     * @private
     */
    _selectPrimaryReference(selectedChunks, conceptNames, processedQuestion) {
        if (!selectedChunks || selectedChunks.length === 0) {
            return {
                primaryReference: null,
                secondaryReferences: [],
                requiresDisclaimer: true,
                reason: 'No chunks available for primary reference selection'
            };
        }

        const conceptNamesLower = conceptNames.map(c => c.toLowerCase());
        
        // Enhanced concept matching: normalize concept names and create variations
        const normalizedConcepts = conceptNamesLower.flatMap(conceptName => {
            const variations = [conceptName];
            // Add variations (e.g., "AEO" -> ["aeo", "answer engine optimization"])
            if (conceptName === 'aeo') {
                variations.push('answer engine optimization');
            } else if (conceptName === 'technical seo') {
                variations.push('technical search engine optimization');
            } else if (conceptName === 'e-e-a-t' || conceptName === 'eat') {
                variations.push('experience expertise authority trust');
            }
            return variations;
        });
        
        // Find valid primary reference chunks (topic-specific, not foundational)
        const validPrimaryChunks = selectedChunks.filter(chunk => {
            // CRITICAL: Check if chunk is foundational (introduction-level with low completeness)
            const coverageLevel = (chunk.coverage_level || chunk.metadata?.coverage_level || 'introduction').toLowerCase();
            const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 0;
            const isFoundational = (coverageLevel === 'introduction' && completenessScore < 0.4) ||
                                 (chunk.day && chunk.day <= 2); // Days 1-2 are typically foundational
            
            if (isFoundational) {
                console.log(`[AICoachService] Filtering out foundational chunk: ${chunk.chapter_title || chunk.chapter_id} (Day ${chunk.day}, coverage: ${coverageLevel}, completeness: ${completenessScore})`);
                return false; // Foundational chunks cannot be primary
            }
            
            // Enhanced concept matching: check multiple fields and variations
            const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
            const secondaryTopics = ((chunk.secondary_topics || chunk.metadata?.secondary_topics || [])).map(t => t.toLowerCase());
            const isDedicated = chunk.is_dedicated_topic_chapter === true || chunk.metadata?.is_dedicated_topic_chapter === true;
            const isDedicatedTopicMatch = chunk.isDedicatedTopicMatch === true; // From dedicated chapter search
            
            // CRITICAL: If chunk was found via dedicated chapter search, it's a strong candidate
            // Check if it matches the concept even if metadata isn't perfect
            if (isDedicatedTopicMatch) {
                // This chunk was found via dedicated chapter search - it's likely relevant
                // Check if chapter title or any field contains concept keywords
                const matchesViaDedicatedSearch = normalizedConcepts.some(conceptName => {
                    return chapterTitle.includes(conceptName) || 
                           primaryTopic.includes(conceptName) || 
                           conceptName.includes(primaryTopic) ||
                           secondaryTopics.some(st => st.includes(conceptName) || conceptName.includes(st));
                });
                
                if (matchesViaDedicatedSearch) {
                    console.log(`[AICoachService] Found dedicated chunk via dedicated search: ${chunk.chapter_title || chunk.chapter_id} (Day ${chunk.day})`);
                    return true; // Strong match - return immediately
                }
            }
            
            // Valid primary reference must satisfy at least ONE:
            // 1. primary_topic matches concept (exact or contains)
            // 2. is_dedicated_topic_chapter == true AND topic matches
            // 3. chapter_title contains concept explicitly
            // 4. secondary_topics contains concept
            const matchesConcept = normalizedConcepts.some(conceptName => {
                // Exact match or contains match
                const topicMatch = primaryTopic.includes(conceptName) || conceptName.includes(primaryTopic);
                const titleMatch = chapterTitle.includes(conceptName) || conceptName.includes(chapterTitle.split(' ')[0]);
                const secondaryMatch = secondaryTopics.some(st => st.includes(conceptName) || conceptName.includes(st));
                
                return topicMatch || (isDedicated && topicMatch) || titleMatch || secondaryMatch;
            });
            
            if (matchesConcept) {
                console.log(`[AICoachService] Found valid primary chunk: ${chunk.chapter_title || chunk.chapter_id} (Day ${chunk.day}, topic: ${primaryTopic}, dedicated: ${isDedicated})`);
            }
            
            return matchesConcept;
        });

        // Select primary reference (prefer dedicated chapters, then by completeness, then by day)
        let primaryReference = null;
        if (validPrimaryChunks.length > 0) {
            // Sort by: 
            // 1. isDedicatedTopicMatch (chunks found via dedicated search) - HIGHEST PRIORITY
            // 2. is_dedicated_topic_chapter flag
            // 3. completeness score
            // 4. day (later days = more advanced)
            validPrimaryChunks.sort((a, b) => {
                // First priority: chunks found via dedicated chapter search
                const aFromDedicatedSearch = a.isDedicatedTopicMatch === true ? 1 : 0;
                const bFromDedicatedSearch = b.isDedicatedTopicMatch === true ? 1 : 0;
                if (aFromDedicatedSearch !== bFromDedicatedSearch) {
                    return bFromDedicatedSearch - aFromDedicatedSearch;
                }
                
                // Second priority: dedicated topic chapter flag
                const aDedicated = (a.is_dedicated_topic_chapter || a.metadata?.is_dedicated_topic_chapter) ? 1 : 0;
                const bDedicated = (b.is_dedicated_topic_chapter || b.metadata?.is_dedicated_topic_chapter) ? 1 : 0;
                if (aDedicated !== bDedicated) {
                    return bDedicated - aDedicated;
                }
                
                // Third priority: completeness score
                const aCompleteness = a.completeness_score ?? a.metadata?.completeness_score ?? 0;
                const bCompleteness = b.completeness_score ?? b.metadata?.completeness_score ?? 0;
                if (Math.abs(aCompleteness - bCompleteness) > 0.1) {
                    return bCompleteness - aCompleteness;
                }
                
                // Fourth priority: later days (more advanced content)
                const aDay = a.day ?? 0;
                const bDay = b.day ?? 0;
                return bDay - aDay;
            });
            primaryReference = validPrimaryChunks[0];
            console.log(`[AICoachService] Selected primary reference: ${primaryReference.chapter_title || primaryReference.chapter_id} (Day ${primaryReference.day}, fromDedicatedSearch: ${primaryReference.isDedicatedTopicMatch}, dedicated: ${primaryReference.is_dedicated_topic_chapter || primaryReference.metadata?.is_dedicated_topic_chapter})`);
        } else {
            console.warn(`[AICoachService] No valid primary reference chunks found for concepts: ${conceptNames.join(', ')}`);
            console.warn(`[AICoachService] Available chunks:`, selectedChunks.map(c => ({
                chapter: c.chapter_title || c.chapter_id,
                day: c.day,
                topic: c.primary_topic || c.metadata?.primary_topic,
                dedicated: c.is_dedicated_topic_chapter || c.metadata?.is_dedicated_topic_chapter,
                coverage: c.coverage_level || c.metadata?.coverage_level,
                completeness: c.completeness_score ?? c.metadata?.completeness_score
            })));
        }

        // All other chunks are secondary (including foundational ones)
        const secondaryReferences = selectedChunks.filter(chunk => chunk !== primaryReference);

        // Determine if disclaimer is required
        let requiresDisclaimer = false;
        let reason = null;
        
        if (!primaryReference) {
            // No valid primary reference found
            // Check if we have foundational chunks (concept introduction)
            const foundationalChunks = selectedChunks.filter(chunk => {
                const coverageLevel = (chunk.coverage_level || chunk.metadata?.coverage_level || 'introduction').toLowerCase();
                const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 0;
                return (coverageLevel === 'introduction' && completenessScore < 0.4) ||
                       (chunk.day && chunk.day <= 2);
            });
            
            if (foundationalChunks.length > 0) {
                // Concept is introduced but not fully covered
                requiresDisclaimer = true;
                reason = 'Concept is introduced here. Dedicated application is covered later.';
                // Mark primary reference as "concept introduction"
                primaryReference = {
                    ...foundationalChunks[0],
                    isConceptIntroduction: true
                };
            } else {
                // No chunks at all - this should be handled by governance
                requiresDisclaimer = true;
                reason = 'No valid primary reference found for concept';
            }
        }

        return {
            primaryReference,
            secondaryReferences,
            requiresDisclaimer,
            reason,
            validPrimaryChunksCount: validPrimaryChunks.length,
            foundationalChunksCount: selectedChunks.filter(chunk => {
                const coverageLevel = chunk.coverage_level || 'introduction';
                const completenessScore = chunk.completeness_score ?? 0;
                return coverageLevel === 'introduction' && completenessScore < 0.4;
            }).length
        };
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

    /**
     * Enforce primary reference rules at render time
     * Ensures foundational chapters are never primary for named concepts
     * @param {Array<Object>} references - System-assembled references
     * @param {Object} conceptDetection - Concept detection result
     * @param {Object} primaryReferenceChunk - Primary reference chunk
     * @param {Object} referenceSelectionResult - Reference selection result
     * @returns {Array<Object>} Enforced references with disclaimer if needed
     * @private
     */
    _enforcePrimaryReferenceRules(references, conceptDetection, primaryReferenceChunk, referenceSelectionResult) {
        if (!conceptDetection || !conceptDetection.requiresCourseAnchoring) {
            return references; // No enforcement needed for non-named concepts
        }

        // Check if we have a valid primary reference
        const hasPrimaryReference = references.some(r => r.is_primary === true);
        
        if (!hasPrimaryReference) {
            // No valid primary reference - check if we should show disclaimer
            if (referenceSelectionResult?.requiresDisclaimer || primaryReferenceChunk?.isConceptIntroduction) {
                // Add disclaimer flag to first reference (or create a placeholder)
                if (references.length > 0) {
                    references[0].requires_disclaimer = true;
                    references[0].disclaimer = 'This concept is introduced here and applied in later chapters.';
                }
            }
            return references;
        }

        // Validate primary reference is not foundational
        const primaryRef = references.find(r => r.is_primary === true);
        if (primaryRef && primaryReferenceChunk?.isConceptIntroduction) {
            // Primary is concept introduction - remove primary flag
            console.warn('[AICoachService] CRITICAL: Primary reference is foundational - removing primary flag');
            primaryRef.is_primary = false;
            primaryRef.requires_disclaimer = true;
            primaryRef.disclaimer = 'This concept is introduced here and applied in later chapters.';
        }

        return references;
    }
}

export const aiCoachService = new AICoachService();

