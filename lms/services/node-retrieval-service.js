/**
 * Node Retrieval Service
 * 
 * Handles retrieval of atomic content nodes using the new architecture.
 * Works with content_nodes and canonical_reference_registry.
 */

import { supabaseClient } from './supabase-client.js';
import { llmService } from './llm-service.js';
import { canonicalReferenceRegistry } from './canonical-reference-registry-service.js';

class NodeRetrievalService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Search for similar content nodes using vector similarity
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of similar nodes with canonical references
     */
    async searchSimilarNodes(queryEmbedding, courseId, filters = {}, limit = 5) {
        if (!courseId) {
            throw new Error('courseId is required for course-scoped search');
        }

        const cacheKey = `node_search_${courseId}_${queryEmbedding.slice(0, 10).join(',')}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Build query
            let query = supabaseClient
                .from('content_nodes')
                .select('*')
                .eq('course_id', courseId)
                .eq('is_valid', true);

            // Apply filters
            if (filters.containerType) {
                query = query.eq('container_type', filters.containerType);
            }

            if (filters.containerId) {
                query = query.eq('container_id', filters.containerId);
            }

            if (filters.day) {
                query = query.eq('day', filters.day);
            }

            if (filters.primaryTopic) {
                query = query.eq('primary_topic', filters.primaryTopic);
            }

            if (filters.isDedicatedTopicNode !== undefined) {
                query = query.eq('is_dedicated_topic_node', filters.isDedicatedTopicNode);
            }

            // Get all matching nodes
            const { data: nodes, error } = await query;

            if (error) {
                console.error('[NodeRetrievalService] Database error:', error);
                throw error;
            }

            if (!nodes || nodes.length === 0) {
                console.warn('[NodeRetrievalService] No nodes found in database for course:', courseId);
                return [];
            }

            // Calculate similarity scores for nodes with embeddings
            const nodesWithSimilarity = nodes
                .filter(node => node.embedding) // Only nodes with embeddings
                .map(node => {
                    // Parse embedding if needed
                    let embedding = node.embedding;
                    if (typeof embedding === 'string') {
                        try {
                            embedding = JSON.parse(embedding);
                        } catch (e) {
                            console.warn('[NodeRetrievalService] Failed to parse embedding for node:', node.id);
                            return null;
                        }
                    }

                    // Calculate cosine similarity
                    const similarity = this._cosineSimilarity(queryEmbedding, embedding);
                    return { ...node, similarity };
                })
                .filter(node => node !== null);

            // Sort by similarity and limit
            const sortedNodes = nodesWithSimilarity.sort((a, b) => b.similarity - a.similarity);
            const topNodes = sortedNodes.slice(0, limit);

            // Format nodes with display references
            const formattedNodes = await Promise.all(
                topNodes.map(async (node) => {
                    try {
                        const resolved = await canonicalReferenceRegistry.resolve(node.canonical_reference);
                        return {
                            ...node,
                            display_reference: resolved.display_reference,
                            embedding: undefined // Remove embedding from result
                        };
                    } catch (error) {
                        console.warn(`[NodeRetrievalService] Failed to resolve reference ${node.canonical_reference}:`, error);
                        // Fallback: build display reference manually
                        return {
                            ...node,
                            display_reference: this._buildDisplayReference(node),
                            embedding: undefined
                        };
                    }
                })
            );

            // Cache results
            this.cache.set(cacheKey, formattedNodes);
            setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000); // 5 minute cache

            return formattedNodes;
        } catch (error) {
            console.error('[NodeRetrievalService] Error searching nodes:', error);
            throw error;
        }
    }

    /**
     * Get nodes by canonical references
     * @param {Array<string>} canonicalRefs - Array of canonical references
     * @param {string} courseId - Course ID
     * @returns {Promise<Array<Object>>} Array of nodes
     */
    async getNodesByReferences(canonicalRefs, courseId) {
        if (!canonicalRefs || canonicalRefs.length === 0) {
            return [];
        }

        try {
            const nodes = await canonicalReferenceRegistry.batchGetNodeContent(canonicalRefs, courseId);
            
            // Format nodes with display references
            const formattedNodes = await Promise.all(
                nodes.map(async (node) => {
                    try {
                        const resolved = await canonicalReferenceRegistry.resolve(node.canonical_reference);
                        return {
                            ...node,
                            display_reference: resolved.display_reference
                        };
                    } catch (error) {
                        console.warn(`[NodeRetrievalService] Failed to resolve reference ${node.canonical_reference}:`, error);
                        return {
                            ...node,
                            display_reference: this._buildDisplayReference(node)
                        };
                    }
                })
            );

            return formattedNodes;
        } catch (error) {
            console.error('[NodeRetrievalService] Error getting nodes by references:', error);
            throw error;
        }
    }

    /**
     * Hybrid search: semantic + keyword
     * @param {string} normalizedQuestion - Normalized question (from QueryNormalizerService)
     * @param {Array<string>} concepts - Extracted key concepts (from QueryNormalizerService)
     * @param {string} courseId - Course ID
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of nodes
     */
    async hybridSearch(normalizedQuestion, concepts, courseId, filters = {}, limit = 5) {
        try {
            // Hard guardrails: this service must never process raw user text.
            if (typeof normalizedQuestion !== 'string' || normalizedQuestion.trim().length === 0) {
                throw new Error('NodeRetrievalService.hybridSearch requires normalizedQuestion (non-empty string)');
            }
            if (!Array.isArray(concepts)) {
                // Catch regressions where callers pass raw user question as first arg to keywordSearch/hybridSearch
                throw new Error('NodeRetrievalService.hybridSearch requires concepts (Array<string>), not raw user text');
            }
            if (concepts.length === 0) {
                throw new Error('NodeRetrievalService.hybridSearch requires at least one concept');
            }

            // Generate query embedding from normalized question
            const queryEmbedding = await llmService.generateEmbedding(normalizedQuestion);
            
            // Semantic search
            const semanticResults = await this.searchSimilarNodes(queryEmbedding, courseId, filters, limit);
            
            // Keyword search using extracted concepts
            const keywordResults = await this.keywordSearch(concepts, courseId, filters, limit);
            
            // Combine and deduplicate
            const combined = [...semanticResults, ...keywordResults];
            const unique = Array.from(
                new Map(combined.map(node => [node.canonical_reference, node])).values()
            );
            
            // Sort by similarity (if available) or relevance
            const sorted = unique.sort((a, b) => {
                if (a.similarity && b.similarity) {
                    return b.similarity - a.similarity;
                }
                return 0;
            });
            
            return sorted.slice(0, limit);
        } catch (error) {
            console.error('[NodeRetrievalService] Error in hybrid search:', error);
            throw error;
        }
    }

    async keywordSearch(concepts, courseId, filters = {}, limit = 5) {
        try {
            // Hard guardrails: this service must operate ONLY on extracted concepts.
            // If someone passes raw user text, fail loudly to prevent silent regression.
            if (typeof concepts === 'string') {
                throw new Error('NodeRetrievalService.keywordSearch called with raw question string. Expected concepts Array<string>.');
            }
            console.log(`[NodeRetrievalService] Keyword search with concepts:`, concepts);
            
            // Validate concepts
            if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
                console.warn('[NodeRetrievalService] No concepts provided for keyword search');
                return [];
            }
            
            // Filter out empty concepts
            const validConcepts = concepts.filter(c => c && typeof c === 'string' && c.trim().length > 0);
            
            if (validConcepts.length === 0) {
                console.warn('[NodeRetrievalService] No valid concepts after filtering');
                return [];
            }
            
            // Prioritize concepts: longer/multi-word concepts first (more specific)
            // IMPORTANT: We do NOT broaden concepts here (no substring matching / no generic base-word expansion).
            // Broadening caused major relevance regressions (e.g., "onpage seo" collapsing to "seo").
            const sortedConcepts = validConcepts.sort((a, b) => {
                // Multi-word concepts first
                if (a.includes(' ') && !b.includes(' ')) return -1;
                if (!a.includes(' ') && b.includes(' ')) return 1;
                // Then by length (longer = more specific)
                return b.length - a.length;
            });
            
            // Use the most specific concept for primary search
            const primaryConcept = sortedConcepts[0];
            
            console.log(`[NodeRetrievalService] Primary search concept: "${primaryConcept}"`);
            
            let query = supabaseClient
                .from('content_nodes')
                .select('*')
                .eq('course_id', courseId)
                .eq('is_valid', true);

            // Apply filters
            if (filters.containerType) {
                query = query.eq('container_type', filters.containerType);
            }

            if (filters.day) {
                query = query.eq('day', filters.day);
            }

            // Search using metadata fields ONLY (course-agnostic)
            // Priority: primary_topic > aliases[] > keywords[]
            // This ensures retrieval is driven by course-defined metadata only (no content/title fallback).
            
            // Step 1: Search primary_topic (exact or partial match) - try all concepts
            const topicQueries = sortedConcepts.slice(0, 5).map(concept => {
                let q = supabaseClient
                    .from('content_nodes')
                    .select('*')
                    .eq('course_id', courseId)
                    .eq('is_valid', true)
                    .ilike('primary_topic', `%${concept}%`)
                    .limit(limit * 2);
                    
                if (filters.containerType) {
                    q = q.eq('container_type', filters.containerType);
                }
                
                if (filters.day) {
                    q = q.eq('day', filters.day);
                }
                
                return q;
            });
            
            const topicResults = await Promise.all(topicQueries);
            let topicNodes = [];
            const seenTopicIds = new Set();
            for (const result of topicResults) {
                if (result.data && !result.error) {
                    result.data.forEach(node => {
                        if (!seenTopicIds.has(node.canonical_reference)) {
                            topicNodes.push(node);
                            seenTopicIds.add(node.canonical_reference);
                        }
                    });
                }
            }
            
            const topicError = topicResults.find(r => r.error)?.error;
            
            // Step 2: Search aliases array (exact contains match only)
            // We try up to 5 concepts (most specific first). No substring matching (prevents broad "seo" regressions).
            const aliasResults = await Promise.all(
                sortedConcepts.slice(0, 5).map(async (concept) => {
                    let aliasesQuery = supabaseClient
                        .from('content_nodes')
                        .select('*')
                        .eq('course_id', courseId)
                        .eq('is_valid', true)
                        .contains('aliases', [concept.toLowerCase()])
                        .limit(limit * 2);

                    if (filters.containerType) {
                        aliasesQuery = aliasesQuery.eq('container_type', filters.containerType);
                    }

                    if (filters.day) {
                        aliasesQuery = aliasesQuery.eq('day', filters.day);
                    }

                    return aliasesQuery;
                })
            );

            let aliasesNodes = [];
            const seenAliasIds = new Set();
            for (const result of aliasResults) {
                if (result.data && !result.error) {
                    for (const node of result.data) {
                        if (!seenAliasIds.has(node.canonical_reference)) {
                            aliasesNodes.push(node);
                            seenAliasIds.add(node.canonical_reference);
                        }
                    }
                }
            }

            const aliasesError = aliasResults.find(r => r.error)?.error;
            
            // Step 3: Search keywords array (contains concept) - try all concepts
            const keywordQueries = sortedConcepts.slice(0, 5).map(concept => {
                let q = supabaseClient
                    .from('content_nodes')
                    .select('*')
                    .eq('course_id', courseId)
                    .eq('is_valid', true)
                    .contains('keywords', [concept.toLowerCase()]) // Array contains value
                    .limit(limit * 2);
                    
                if (filters.containerType) {
                    q = q.eq('container_type', filters.containerType);
                }
                
                if (filters.day) {
                    q = q.eq('day', filters.day);
                }
                
                return q;
            });
            
            const keywordResults = await Promise.all(keywordQueries);
            let keywordNodes = [];
            const seenKeywordIds = new Set();
            for (const result of keywordResults) {
                if (result.data && !result.error) {
                    result.data.forEach(node => {
                        if (!seenKeywordIds.has(node.canonical_reference)) {
                            keywordNodes.push(node);
                            seenKeywordIds.add(node.canonical_reference);
                        }
                    });
                }
            }
            
            const keywordError = keywordResults.find(r => r.error)?.error;
            
            // Combine all results, prioritizing metadata matches
            const allNodes = [];
            const seenIds = new Set();
            
            // Priority 1: primary_topic matches (highest relevance)
            if (!topicError && topicNodes) {
                topicNodes.forEach(node => {
                    if (!seenIds.has(node.canonical_reference)) {
                        allNodes.push({ ...node, _matchType: 'primary_topic', _relevance: 1.0 });
                        seenIds.add(node.canonical_reference);
                    }
                });
            }
            
            // Priority 2: aliases array matches (very high relevance - course-defined vocabulary)
            if (!aliasesError && aliasesNodes) {
                aliasesNodes.forEach(node => {
                    if (!seenIds.has(node.canonical_reference)) {
                        allNodes.push({ ...node, _matchType: 'aliases', _relevance: 0.95 });
                        seenIds.add(node.canonical_reference);
                    }
                });
            }
            
            // Priority 3: keywords array matches (high relevance)
            if (!keywordError && keywordNodes) {
                keywordNodes.forEach(node => {
                    if (!seenIds.has(node.canonical_reference)) {
                        allNodes.push({ ...node, _matchType: 'keywords', _relevance: 0.8 });
                        seenIds.add(node.canonical_reference);
                    }
                });
            }

            console.log(
                `[NodeRetrievalService] Keyword search found ${allNodes.length} nodes (topic: ${topicNodes?.length || 0}, aliases: ${aliasesNodes?.length || 0}, keywords: ${keywordNodes?.length || 0})`
            );
            
            // Sort by relevance: match type > dedicated topic nodes > relevance score
            const sortedNodes = allNodes.sort((a, b) => {
                // First: prioritize by match type (metadata matches > content matches)
                if (a._relevance !== b._relevance) {
                    return b._relevance - a._relevance;
                }
                
                // Second: prioritize dedicated topic nodes
                if (a.is_dedicated_topic_node && !b.is_dedicated_topic_node) return -1;
                if (!a.is_dedicated_topic_node && b.is_dedicated_topic_node) return 1;
                
                return 0;
            });
            
            // Remove internal metadata before returning
            sortedNodes.forEach(node => {
                delete node._matchType;
                delete node._relevance;
            });

            // Format nodes (use sorted nodes)
            const formattedNodes = await Promise.all(
                sortedNodes.slice(0, limit).map(async (node) => {
                    try {
                        const resolved = await canonicalReferenceRegistry.resolve(node.canonical_reference);
                        return {
                            ...node,
                            display_reference: resolved.display_reference,
                            similarity: 0.5 // Default relevance for keyword matches
                        };
                    } catch (error) {
                        return {
                            ...node,
                            display_reference: this._buildDisplayReference(node),
                            similarity: 0.5
                        };
                    }
                })
            );

            return formattedNodes;
        } catch (error) {
            console.error('[NodeRetrievalService] Error in keyword search:', error);
            return [];
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
        const seq = node.sequence_number;
        const nodeType = node.reference_type || node.node_type || 'concept';

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

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array<number>} vecA - First vector
     * @param {Array<number>} vecB - Second vector
     * @returns {number} Similarity score (0-1)
     */
    _cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) {
            return 0;
        }

        return dotProduct / denominator;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export singleton instance
export const nodeRetrievalService = new NodeRetrievalService();

// Also export class for testing
export default NodeRetrievalService;

