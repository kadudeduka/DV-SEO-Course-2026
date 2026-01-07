/**
 * Strict Two-Step Pipeline Service
 * 
 * Implements the strict two-step pipeline for AI Coach:
 * Step 1: Reference Resolution (System Logic Only - No LLM)
 * Step 2: Answer Generation (LLM with Strict Constraints)
 * 
 * This eliminates reference hallucination by separating reference resolution
 * from answer generation.
 */

import { referenceResolutionService } from './reference-resolution-service.js';
import { nodeRetrievalService } from './node-retrieval-service.js';
import { canonicalReferenceRegistry } from './canonical-reference-registry-service.js';
import { llmService } from './llm-service.js';
import { supabaseClient } from './supabase-client.js';
import { queryNormalizerService } from './query-normalizer-service.js';
import { conceptExpansionService } from './concept-expansion-service.js';
import { answerRendererService } from './answer-renderer-service.js';

class StrictPipelineService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Step 1.1: Resolve explicit references
     * @param {string} question - User question
     * @param {string} courseId - Course ID
     * @returns {Promise<Object>} Resolution result
     */
    async resolveExplicitReferences(question, courseId) {
        const resolver = referenceResolutionService;
        const result = await resolver.resolve(question, courseId);
        
        if (result.resolved_nodes.length > 0) {
            console.log(`[StrictPipeline] Resolved ${result.resolved_nodes.length} explicit references`);
            return {
                source: 'explicit',
                nodeIds: result.resolved_nodes,
                confidence: result.confidence,
                resolutionType: result.resolution_type
            };
        }
        
        return null;
    }

    /**
     * Step 1.2: Semantic search fallback
     * @param {string} normalizedQuestion - Normalized question (from QueryNormalizerService)
     * @param {Array<string>} concepts - Extracted key concepts (from QueryNormalizerService)
     * @param {string} courseId - Course ID
     * @param {string} userId - User ID
     * @param {Object} filters - Additional filters
     * @returns {Promise<Object>} Search result
     */
    async semanticSearchFallback(normalizedQuestion, concepts, courseId, userId, filters = {}) {
        try {
            // Validate concepts (fail safely, no silent fallbacks)
            console.log('[StrictPipeline] semanticSearchFallback called with:', {
                normalizedQuestion: typeof normalizedQuestion === 'string' ? normalizedQuestion.substring(0, 50) : typeof normalizedQuestion,
                concepts: Array.isArray(concepts) ? concepts : typeof concepts,
                conceptsLength: Array.isArray(concepts) ? concepts.length : 'N/A',
                courseId,
                userId
            });
            
            if (!concepts) {
                console.error('[StrictPipeline] Semantic search failed: concepts is null/undefined');
                return null;
            }
            if (!Array.isArray(concepts)) {
                console.error('[StrictPipeline] Semantic search failed: concepts is not an array, got:', typeof concepts, concepts);
                throw new Error(`semanticSearchFallback requires concepts (Array<string>), got ${typeof concepts}`);
            }
            if (concepts.length === 0) {
                console.error('[StrictPipeline] Semantic search failed: concepts array is empty');
                return null;
            }
            
            // Perform hybrid search with normalized input
            const nodes = await nodeRetrievalService.hybridSearch(
                normalizedQuestion,
                concepts,
                courseId,
                filters,
                5
            );
            
            if (nodes.length === 0) {
                console.warn('[StrictPipeline] Semantic search found 0 nodes');
                return null;
            }
            
            // Extract canonical references from nodes
            const nodeIds = nodes
                .map(node => node.canonical_reference)
                .filter(ref => ref && ref.startsWith('D')); // Valid canonical format
            
            console.log(`[StrictPipeline] Found ${nodeIds.length} nodes via semantic search`);
            
            return {
                source: 'semantic',
                nodeIds: nodeIds,
                nodes: nodes, // Keep full node data for later use
                confidence: nodes[0]?.similarity || 0.7
            };
        } catch (error) {
            console.error('[StrictPipeline] Error in semantic search fallback:', error);
            return null;
        }
    }

    /**
     * Step 1.3: Validate and filter nodes
     * @param {Array<string>} nodeIds - Canonical reference IDs
     * @param {string} courseId - Course ID
     * @returns {Promise<Array<string>>} Valid node IDs
     */
    async validateNodes(nodeIds, courseId) {
        if (!nodeIds || nodeIds.length === 0) {
            return [];
        }

        try {
            const { data: nodes, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('canonical_reference')
                .in('canonical_reference', nodeIds)
                .eq('course_id', courseId)
                .eq('is_valid', true);
            
            if (error) {
                throw new Error(`Failed to validate nodes: ${error.message}`);
            }
            
            const validNodeIds = nodes.map(n => n.canonical_reference);
            const invalidNodeIds = nodeIds.filter(id => !validNodeIds.includes(id));
            
            if (invalidNodeIds.length > 0) {
                console.warn(`[StrictPipeline] Invalid nodes filtered: ${invalidNodeIds.join(', ')}`);
            }
            
            return validNodeIds;
        } catch (error) {
            console.error('[StrictPipeline] Error validating nodes:', error);
            return [];
        }
    }

    /**
     * Step 1.4: Retrieve full content for nodes
     * @param {Array<string>} nodeIds - Canonical reference IDs
     * @param {string} courseId - Course ID
     * @returns {Promise<Array<Object>>} Formatted nodes with content
     */
    async retrieveNodeContent(nodeIds, courseId) {
        if (!nodeIds || nodeIds.length === 0) {
            return [];
        }

        try {
            // Get node content
            const nodes = await canonicalReferenceRegistry.batchGetNodeContent(nodeIds, courseId);
            
            // Format for LLM context
            const formattedNodes = await Promise.all(
                nodes.map(async (node) => {
                    try {
                        const resolved = await canonicalReferenceRegistry.resolve(node.canonical_reference);
                        return {
                            canonical_reference: node.canonical_reference,
                            display_reference: resolved.display_reference,
                            content: node.content,
                            day: node.day,
                            container_type: node.container_type,
                            container_id: node.container_id,
                            container_title: node.container_title,
                            sequence_number: node.sequence_number,
                            primary_topic: node.primary_topic,
                            is_dedicated_topic_node: node.is_dedicated_topic_node
                        };
                    } catch (error) {
                        console.warn(`[StrictPipeline] Failed to resolve reference ${node.canonical_reference}:`, error);
                        // Fallback formatting
                        return {
                            canonical_reference: node.canonical_reference,
                            display_reference: this._buildDisplayReference(node),
                            content: node.content,
                            day: node.day,
                            container_type: node.container_type,
                            container_id: node.container_id,
                            container_title: node.container_title,
                            sequence_number: node.sequence_number,
                            primary_topic: node.primary_topic,
                            is_dedicated_topic_node: node.is_dedicated_topic_node
                        };
                    }
                })
            );

            return formattedNodes;
        } catch (error) {
            console.error('[StrictPipeline] Error retrieving node content:', error);
            throw error;
        }
    }

    /**
     * Step 0: Query Normalization
     * @param {string} question - Raw user question
     * @param {boolean} debug - Enable debug logging
     * @returns {Promise<Object>} Normalized query data
     */
    async normalizeQuery(question, debug = false) {
        try {
            const normalized = await queryNormalizerService.normalize(question);
            
            // Debug logging (if enabled)
            // Check for debug mode: options.debug, window.DEBUG, or URL param ?debug=true
            const isDebugMode = debug || 
                               (typeof window !== 'undefined' && window.DEBUG === true) ||
                               (typeof window !== 'undefined' && window.location?.search?.includes('debug=true'));
            
            if (isDebugMode) {
                console.log('[StrictPipeline] [DEBUG] Normalized Query JSON:', JSON.stringify(normalized, null, 2));
            }
            
            // Validate normalized response structure
            if (!normalized || typeof normalized !== 'object') {
                throw new Error('QueryNormalizerService returned invalid response (not an object)');
            }
            if (!Array.isArray(normalized.key_concepts)) {
                console.error('[StrictPipeline] QueryNormalizerService returned invalid key_concepts:', typeof normalized.key_concepts, normalized.key_concepts);
                throw new Error(`QueryNormalizerService returned invalid key_concepts (expected Array<string>, got ${typeof normalized.key_concepts})`);
            }
            
            // Log normalized data (always log key info)
            console.log(`[StrictPipeline] Normalized question: "${normalized.normalized_question || 'N/A'}"`);
            console.log(`[StrictPipeline] Extracted concepts: [${normalized.key_concepts.join(', ')}]`);
            console.log(`[StrictPipeline] Intent type: ${normalized.intent_type || 'N/A'}, Confidence: ${normalized.confidence || 'N/A'}`);
            
            return normalized;
        } catch (error) {
            console.error('[StrictPipeline] Error normalizing query:', error);
            throw new Error(`Query normalization failed: ${error.message}`);
        }
    }

    /**
     * Step 1.5: Decision gate - Complete Step 1
     * @param {string} originalQuestion - Original user question
     * @param {string} normalizedQuestion - Normalized question
     * @param {Array<string>} concepts - Extracted key concepts
     * @param {string} courseId - Course ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Step 1 result
     */
    async step1ReferenceResolution(originalQuestion, normalizedQuestion, concepts, courseId, userId) {
        // Try explicit resolution first (using original question for reference patterns)
        let resolution = await this.resolveExplicitReferences(originalQuestion, courseId);
        
        // Fallback to semantic search (using normalized question and concepts)
        if (!resolution || resolution.nodeIds.length === 0) {
            resolution = await this.semanticSearchFallback(normalizedQuestion, concepts, courseId, userId);
        }
        
        // No nodes found
        if (!resolution || resolution.nodeIds.length === 0) {
            return {
                proceed: false,
                answer: "Not covered in course material",
                references: [],
                confidence: 0.0
            };
        }
        
        // Validate nodes
        const validNodeIds = await this.validateNodes(resolution.nodeIds, courseId);
        
        if (validNodeIds.length === 0) {
            return {
                proceed: false,
                answer: "Not covered in course material",
                references: [],
                confidence: 0.0
            };
        }
        
        // Retrieve content
        const nodes = await this.retrieveNodeContent(validNodeIds, courseId);
        
        if (nodes.length === 0) {
            return {
                proceed: false,
                answer: "I don't have information about this topic in the course material. Please check with your trainer or refer to the course content directly.",
                references: [],
                confidence: 0.0
            };
        }
        
        return {
            proceed: true,
            nodes: nodes,
            source: resolution.source,
            confidence: resolution.confidence
        };
    }

    /**
     * Step 2.1: Build strict system prompt
     * @param {Array<Object>} nodes - Resolved nodes
     * @param {Object} options - Additional options
     * @returns {string} Strict system prompt
     */
    buildStrictSystemPrompt(nodes, options = {}) {
        const { trainerPersonalization = null, isLabGuidance = false } = options;
        
        const nodeList = nodes.map((node, index) => {
            return `[Reference ${index + 1}]
Canonical ID: ${node.canonical_reference}
Display: ${node.display_reference}
Content: ${node.content}`;
        }).join('\n\n');
        
        let prompt = `You are an AI Coach helping learners understand course material.

CRITICAL RULES (NON-NEGOTIABLE):

1. REFERENCE GENERATION IS FORBIDDEN
   - You MUST NOT include any references (Day X, Chapter Y, Lab Z) in your answer
   - You MUST NOT mention specific course locations
   - You MUST NOT create or infer references
   - The system will automatically add references based on the content you use

2. CONTENT RESTRICTION
   - You MUST use ONLY the provided content below
   - You MUST NOT add information not present in the provided content
   - You MUST NOT make assumptions beyond what is explicitly stated
   - If the provided content doesn't answer the question, say: "The provided course material doesn't cover this specific aspect. Please refer to the course content or ask your trainer."

3. ANSWER STRUCTURE
   - Provide a clear, direct answer
   - Use the exact terminology from the course material
   - Maintain the course's teaching style and framework
   - If multiple concepts are relevant, organize them logically
   - Be concise (50-300 words) but complete

4. CITATION REQUIREMENT
   - You do NOT need to cite references (system will add them)
   - Focus ONLY on explaining the content clearly
   - Do NOT include phrases like "as mentioned in", "refer to", "see Chapter X"

5. OUT-OF-SCOPE HANDLING
   - If the question cannot be answered with the provided content, explicitly state:
     "This topic is not covered in the provided course material. Please check with your trainer or refer to the course content directly."
   - Do NOT attempt to answer using general knowledge if it's not in the provided content`;

        if (isLabGuidance) {
            prompt += `

6. LAB GUIDANCE RULES (CRITICAL)
   - NEVER provide direct answers, solutions, or code
   - Guide learners to understand concepts, not solve problems
   - Suggest breaking down the problem into steps
   - Encourage review of prerequisites
   - Example good response: "Review the concepts covered in this lab. This lab tests your understanding of [concept]. Consider: 1) What is the goal? 2) What concepts apply? 3) How can you apply them?"
   - Example bad response: "The answer is X" or "You should do Y"`;
        }

        if (trainerPersonalization) {
            prompt += `\n\n${trainerPersonalization}`;
        }

        prompt += `\n\nPROVIDED COURSE CONTENT:
${nodeList}

Remember: Your answer will be automatically paired with the correct references by the system. Focus only on explaining the content clearly and accurately.`;

        return prompt;
    }

    /**
     * Step 2.2: Build user prompt
     * @param {string} question - User question
     * @returns {string} User prompt
     */
    buildUserPrompt(question) {
        return `Question: ${question}

Instructions:
- Answer the question using ONLY the provided course content
- Do NOT include any references in your answer
- If the content doesn't answer the question, state that explicitly
- Use clear, direct language`;
    }

    /**
     * Step 2.3: Generate answer with LLM (strict mode)
     * @param {string} question - User question
     * @param {Array<Object>} nodes - Resolved nodes
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Generated answer (no references)
     */
    async generateAnswerStrict(question, nodes, options = {}) {
        const systemPrompt = this.buildStrictSystemPrompt(nodes, options);
        const userPrompt = this.buildUserPrompt(question);
        
        // Use LLM service but with strict constraints
        const result = await llmService.generateAnswer(
            question,
            nodes.map(node => ({
                content: node.content,
                day: node.day,
                chapter_title: node.container_title,
                canonical_reference: node.canonical_reference
            })),
            {
                base: systemPrompt,
                trainerPersonalization: options.trainerPersonalization
            },
            {
                model: options.model || 'gpt-4o-mini',
                temperature: 0.3, // Lower temperature for more deterministic answers
                maxTokens: 1000,
                isLabGuidance: options.isLabGuidance || false
            }
        );
        
        return result.answer;
    }

    /**
     * Step 2.4: Strip any LLM-generated references
     * @param {string} answer - LLM-generated answer
     * @returns {string} Cleaned answer
     */
    stripLLMReferences(answer) {
        let cleaned = answer;
        const patterns = [
            /Day\s+\d+\s*→\s*Chapter\s+[\w\d-]+/gi,
            /Chapter\s+[\w\d-]+/gi,
            /Day\s+\d+/gi,
            /Lab\s+[\w\d-]+/gi,
            /\b(refer to|see|consult|as mentioned in|according to)\s+(Day|Chapter|Lab)\s+[\w\d-]+/gi,
            /\(Day\s+\d+[^)]*\)/gi,
            /\[Day\s+\d+[^\]]*\]/gi,
            /D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+/gi // Canonical format
        ];
        
        const foundRefs = [];
        for (const pattern of patterns) {
            const matches = cleaned.match(pattern);
            if (matches) {
                foundRefs.push(...matches);
                cleaned = cleaned.replace(pattern, '');
            }
        }
        
        // Clean up extra whitespace
        cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
        cleaned = cleaned.replace(/(\s*[,.;:]\s*){2,}/g, (match) => {
            return match.trim();
        });
        
        if (foundRefs.length > 0) {
            console.warn(`[StrictPipeline] Stripped ${foundRefs.length} LLM-generated references:`, foundRefs);
        }
        
        return cleaned;
    }

    /**
     * Step 2.5: Assemble system-owned references
     * Deduplicates by container (one reference per chapter/lab)
     * @param {Array<Object>} nodes - Resolved nodes
     * @returns {Object} Assembled references
     */
    assembleSystemReferences(nodes) {
        if (nodes.length === 0) {
            return {
                primary: null,
                secondary: []
            };
        }
        
        // Group nodes by container_id (one reference per chapter/lab)
        const containerMap = new Map();
        
        nodes.forEach(node => {
            // Use container_id as key (e.g., "day20-ch1" or "day20-lab2")
            // Fallback to day if container_id is missing
            const containerKey = node.container_id || `day${node.day || 'unknown'}`;
            
            // If we haven't seen this container, add it
            // Prefer nodes with container_title and primary_topic for better descriptions
            if (!containerMap.has(containerKey)) {
                containerMap.set(containerKey, node);
            } else {
                // If current node has better metadata, replace it
                const existing = containerMap.get(containerKey);
                const currentHasTitle = node.container_title && node.container_title.trim();
                const existingHasTitle = existing.container_title && existing.container_title.trim();
                const currentHasTopic = node.primary_topic && node.primary_topic.trim();
                const existingHasTopic = existing.primary_topic && existing.primary_topic.trim();
                
                // Prefer node with both title and topic, or better metadata
                if ((currentHasTitle && currentHasTopic && (!existingHasTitle || !existingHasTopic)) ||
                    (currentHasTitle && !existingHasTitle) ||
                    (currentHasTopic && !existingHasTopic && currentHasTitle)) {
                    containerMap.set(containerKey, node);
                }
            }
        });
        
        // Convert map to array of unique references (one per container)
        const uniqueReferences = Array.from(containerMap.values());
        
        if (uniqueReferences.length === 0) {
            return {
                primary: null,
                secondary: []
            };
        }
        
        // Helper function to ensure container_id and container_type are set
        const ensureContainerInfo = (node) => {
            let containerId = node.container_id;
            let containerType = node.container_type;
            
            // If container_id or container_type is missing, try to extract from canonical_reference
            if ((!containerId || !containerType) && node.canonical_reference) {
                const match = node.canonical_reference.match(/^D(\d+)\.(C|L)(\d+)/i);
                if (match) {
                    const day = match[1];
                    const type = match[2].toLowerCase() === 'c' ? 'chapter' : 'lab';
                    const num = match[3];
                    containerId = containerId || `day${day}-${type === 'chapter' ? 'ch' : 'lab'}${num}`;
                    containerType = containerType || type;
                }
            }
            
            return {
                ...node,
                container_id: containerId,
                container_type: containerType
            };
        };
        
        // Select primary reference (first unique container)
        const primaryNode = ensureContainerInfo(uniqueReferences[0]);
        const primary = {
            canonical_reference: primaryNode.canonical_reference,
            display_reference: primaryNode.display_reference,
            day: primaryNode.day,
            container_type: primaryNode.container_type,
            container_id: primaryNode.container_id,
            container_title: primaryNode.container_title,
            primary_topic: primaryNode.primary_topic, // Include primary_topic for descriptive references
            sequence_number: primaryNode.sequence_number,
            reference_type: primaryNode.reference_type || primaryNode.node_type,
            is_primary: true
        };
        
        // Secondary references (rest of unique containers, limit to 4 more = 5 total max)
        const secondary = uniqueReferences.slice(1, 5).map(node => {
            const ensuredNode = ensureContainerInfo(node);
            return {
                canonical_reference: ensuredNode.canonical_reference,
                display_reference: ensuredNode.display_reference,
                day: ensuredNode.day,
                container_type: ensuredNode.container_type,
                container_id: ensuredNode.container_id,
                container_title: ensuredNode.container_title,
                primary_topic: ensuredNode.primary_topic, // Include primary_topic for descriptive references
                sequence_number: ensuredNode.sequence_number,
                reference_type: ensuredNode.reference_type || ensuredNode.node_type,
                is_primary: false
            };
        });
        
        return {
            primary: primary,
            secondary: secondary
        };
    }

    /**
     * Step 2.6: Assemble final answer with standardized template
     * @param {string} answer - Generated answer (raw LLM output)
     * @param {Object} references - System-assembled references
     * @param {number} confidence - Confidence score
     * @param {string} source - Source of resolution
     * @param {Object} options - Additional options (coachName, normalizedIntent, nodes)
     * @returns {Object} Final answer object with formatted answer
     */
    assembleFinalAnswer(answer, references, confidence, source, options = {}) {
        const { coachName = 'AI Coach', normalizedIntent = '', nodes = [] } = options;
        
        // Format answer using AnswerRenderer
        const formattedAnswer = answerRendererService.render({
            coachName: coachName,
            normalizedIntent: normalizedIntent,
            llmAnswer: answer,
            resolvedNodes: nodes,
            canonicalReferences: [
                references.primary,
                ...references.secondary
            ].filter(ref => ref !== null),
            options: {}
        });

        return {
            answer: formattedAnswer,
            references: [
                references.primary,
                ...references.secondary
            ].filter(ref => ref !== null),
            confidence: confidence,
            source: source,
            has_references: references.primary !== null,
            reference_count: references.secondary.length + (references.primary ? 1 : 0)
        };
    }

    /**
     * Step 2: Generate answer with strict constraints
     * @param {string} question - User question
     * @param {Array<Object>} nodes - Resolved nodes
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Final answer with system references
     */
    async step2AnswerGeneration(question, nodes, options = {}) {
        // Generate answer
        let answer = await this.generateAnswerStrict(question, nodes, options);
        
        // Strip any LLM-generated references
        answer = this.stripLLMReferences(answer);
        
        // Assemble system references
        const references = this.assembleSystemReferences(nodes);
        
        // Assemble final answer with standardized template
        const finalAnswer = this.assembleFinalAnswer(
            answer,
            references,
            options.confidence || 1.0, // High confidence when using resolved nodes
            options.source || 'resolved_nodes',
            {
                coachName: options.coachName || 'AI Coach',
                normalizedIntent: options.normalized_data?.normalized_question || question,
                nodes: nodes
            }
        );
        
        return finalAnswer;
    }

    /**
     * Complete strict two-step pipeline
     * @param {string} question - User question
     * @param {string} courseId - Course ID
     * @param {string} userId - User ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Complete response
     */
    async processQueryStrict(question, courseId, userId, options = {}) {
        console.log(`[StrictPipeline] Processing query: "${question}"`);
        
        try {
            // STEP 0: Query Normalization (NEW - First Step)
            console.log('[StrictPipeline] Step 0: Query Normalization');
            const normalized = await this.normalizeQuery(question, options.debug);
            
            // Fail safely if no concepts found (no silent fallbacks)
            if (!normalized || !normalized.key_concepts || normalized.key_concepts.length === 0) {
                console.error('[StrictPipeline] Query normalization failed: No concepts extracted');
                return {
                    success: false,
                    answer: "I couldn't understand your question. Please try rephrasing it or ask your trainer for help.",
                    references: [],
                    confidence: 0.0,
                    source: 'normalization_failed',
                    has_references: false,
                    error: 'No concepts extracted from query'
                };
            }
            
            // STEP 0.5: Concept Expansion (generate semantic variants)
            console.log('[StrictPipeline] Step 0.5: Concept Expansion');
            const expandedConcepts = await conceptExpansionService.expandConcepts(
                normalized.key_concepts,
                normalized.intent_type
            );
            
            if (expandedConcepts.length === 0) {
                console.warn('[StrictPipeline] Concept expansion returned no concepts, using original');
                expandedConcepts.push(...normalized.key_concepts);
            }
            
            console.log(`[StrictPipeline] Original concepts: [${normalized.key_concepts.join(', ')}]`);
            console.log(`[StrictPipeline] Expanded concepts: [${expandedConcepts.join(', ')}]`);
            
            // STEP 1: Reference Resolution (using expanded concepts)
            console.log('[StrictPipeline] Step 1: Reference Resolution');
            
            // Validate normalized data before passing to step1
            if (!normalized || typeof normalized !== 'object') {
                throw new Error('Normalized data is invalid');
            }
            if (!Array.isArray(normalized.key_concepts)) {
                console.error('[StrictPipeline] key_concepts is not an array:', typeof normalized.key_concepts, normalized.key_concepts);
                throw new Error(`key_concepts must be an array, got ${typeof normalized.key_concepts}`);
            }
            if (normalized.key_concepts.length === 0) {
                throw new Error('key_concepts array is empty (should have been caught earlier)');
            }
            
            const step1Result = await this.step1ReferenceResolution(
                question, 
                normalized.normalized_question,
                expandedConcepts, // Use expanded concepts instead of original
                courseId, 
                userId
            );
            
            if (!step1Result.proceed) {
                // No nodes found - return early
                console.log('[StrictPipeline] No nodes found, returning early response');
                return {
                    success: true,
                    answer: step1Result.answer,
                    references: [],
                    confidence: 0.0,
                    source: 'no_nodes',
                    has_references: false
                };
            }
            
            console.log(`[StrictPipeline] Step 1 complete: ${step1Result.nodes.length} nodes resolved via ${step1Result.source}`);
            
            // STEP 2: Answer Generation (using normalized question)
            console.log('[StrictPipeline] Step 2: Answer Generation');
            const step2Result = await this.step2AnswerGeneration(
                normalized.normalized_question, // Use normalized question for LLM
                step1Result.nodes,
                {
                    ...options,
                    confidence: step1Result.confidence,
                    source: step1Result.source,
                    original_question: question, // Keep original for context
                    normalized_data: normalized // Include normalized data for debugging
                }
            );
            
            console.log(`[StrictPipeline] Step 2 complete: Answer generated with ${step2Result.reference_count} references`);
            
            return {
                success: true,
                ...step2Result
            };
            
        } catch (error) {
            console.error('[StrictPipeline] Error processing query:', error);
            return {
                success: false,
                answer: "I encountered an error processing your question. Please try again or contact your trainer.",
                references: [],
                confidence: 0.0,
                source: 'error',
                has_references: false,
                error: error.message
            };
        }
    }

    /**
     * Build display reference manually (fallback)
     * @param {Object} node - Node object
     * @returns {string} Display reference
     */
    _buildDisplayReference(node) {
        const day = node.day;
        const containerType = node.container_type;
        const containerId = node.container_id;
        const seq = node.sequence_number || 1;
        const nodeType = node.reference_type || 'concept';

        // Extract container number from formats like:
        // - day20-ch1 (chapter)
        // - day12-lab2 (lab)
        // - ch1 or lab2 (fallback)
        let containerNum = '?';
        const dayContainerMatch = containerId.match(/day\d+-(ch|lab)(\d+)/i);
        if (dayContainerMatch) {
            containerNum = dayContainerMatch[2];
        } else {
            const simpleMatch = containerId.match(/(?:ch|lab)(\d+)/i);
            if (simpleMatch) {
                containerNum = simpleMatch[1];
            }
        }

        // Format node type
        const nodeTypeLabel = {
            'step': 'Step',
            'concept': 'Concept',
            'example': 'Example',
            'definition': 'Definition',
            'procedure': 'Procedure',
            'list_item': 'Item',
            'heading': 'Section'
        }[nodeType] || 'Section';

        if (containerType === 'chapter') {
            return `Day ${day} → Chapter ${containerNum} → ${nodeTypeLabel} ${seq}`;
        } else if (containerType === 'lab') {
            return `Day ${day} → Lab ${containerNum} → Step ${seq}`;
        }

        return `${node.container_title || 'Unknown'} → ${nodeTypeLabel} ${seq}`;
    }
}

// Export singleton instance
export const strictPipelineService = new StrictPipelineService();

// Also export class for testing
export default StrictPipelineService;

