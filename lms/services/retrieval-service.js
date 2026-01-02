/**
 * Retrieval Service
 * 
 * Handles vector similarity search and content chunk retrieval.
 * Performs course-scoped semantic search.
 */

import { supabaseClient } from './supabase-client.js';
import { llmService } from './llm-service.js';

class RetrievalService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Search for similar content chunks using vector similarity
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {string} courseId - Course identifier (required for course-scoped search)
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of similar chunks
     */
    async searchSimilarChunks(queryEmbedding, courseId, filters = {}, limit = 5) {
        if (!courseId) {
            throw new Error('courseId is required for course-scoped search');
        }

        const cacheKey = `search_${courseId}_${queryEmbedding.slice(0, 10).join(',')}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Verify user session for RLS
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                console.warn('[RetrievalService] No authenticated user session. RLS will block access.');
            } else {
                console.log('[RetrievalService] Authenticated user:', user.id);
            }

            // Build query
            let query = supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId); // Course-scoped search

            // Apply filters
            if (filters.contentType) {
                query = query.eq('content_type', filters.contentType);
            }

            if (filters.chapterId) {
                query = query.eq('chapter_id', filters.chapterId);
            }

            if (filters.day) {
                query = query.eq('day', filters.day);
            }

            // Get all matching chunks first
            const { data: chunks, error } = await query;

            if (error) {
                console.error('[RetrievalService] Database error:', error);
                // Check if it's an RLS error
                if (error.code === '42501' || error.message?.includes('row-level security')) {
                    console.error('[RetrievalService] RLS policy blocked access. User may not be authenticated or may not have course allocation.');
                    // Return empty array instead of throwing to allow graceful degradation
                    return [];
                }
                throw error;
            }

            console.log(`[RetrievalService] Found ${chunks?.length || 0} chunks for course ${courseId}`, {
                filters,
                chunksWithEmbeddings: chunks?.filter(c => c.embedding).length || 0
            });

            if (!chunks || chunks.length === 0) {
                console.warn('[RetrievalService] No chunks found in database for course:', courseId);
                return [];
            }

            // Calculate similarity scores
            const chunksWithSimilarity = chunks.map(chunk => {
                if (!chunk.embedding) {
                    console.warn('[RetrievalService] Chunk missing embedding:', chunk.id);
                    return { ...chunk, similarity: 0 };
                }

                // Parse embedding (stored as string array)
                let embedding;
                if (typeof chunk.embedding === 'string') {
                    try {
                        embedding = JSON.parse(chunk.embedding);
                    } catch (e) {
                        // If parsing fails, try as array literal
                        try {
                            embedding = eval(chunk.embedding); // eslint-disable-line no-eval
                        } catch (e2) {
                            console.error('[RetrievalService] Failed to parse embedding for chunk:', chunk.id, e2);
                            return { ...chunk, similarity: 0 };
                        }
                    }
                } else {
                    embedding = chunk.embedding;
                }

                // Calculate cosine similarity
                const similarity = this._cosineSimilarity(queryEmbedding, embedding);
                return { ...chunk, similarity, embedding: undefined }; // Remove embedding from result
            });

            // Sort by similarity and limit
            // Very lenient threshold - return top results even if similarity is low
            const sortedChunks = chunksWithSimilarity.sort((a, b) => b.similarity - a.similarity);
            const topChunks = sortedChunks.slice(0, limit);
            
            console.log(`[RetrievalService] Similarity scores (top 5):`, topChunks.slice(0, 5).map(c => ({
                id: c.id,
                chapter: c.chapter_title,
                similarity: c.similarity.toFixed(3)
            })));
            
            // Return top chunks regardless of similarity threshold (very lenient)
            // Filter only chunks with similarity > 0.1 (very low threshold)
            const results = topChunks.filter(chunk => chunk.similarity > 0.1);
            
            // If still no results, return at least top 3 chunks anyway
            if (results.length === 0 && topChunks.length > 0) {
                console.warn('[RetrievalService] All chunks below similarity threshold. Returning top 3 chunks anyway.');
                return topChunks.slice(0, 3);
            }

            // Cache results
            this.cache.set(cacheKey, results);
            setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000); // 5 minute cache

            return results;
        } catch (error) {
            console.error('[RetrievalService] Error searching chunks:', error);
            throw error;
        }
    }

    /**
     * Get chunks by IDs
     * @param {Array<string>} chunkIds - Array of chunk IDs
     * @returns {Promise<Array<Object>>} Array of chunks
     */
    async getChunksByIds(chunkIds) {
        if (!chunkIds || chunkIds.length === 0) {
            return [];
        }

        const { data, error } = await supabaseClient
            .from('ai_coach_content_chunks')
            .select('*')
            .in('id', chunkIds);

        if (error) {
            throw error;
        }

        return data || [];
    }

    /**
     * Get chunks by chapter
     * @param {string} courseId - Course identifier
     * @param {string} chapterId - Chapter identifier
     * @returns {Promise<Array<Object>>} Array of chunks
     */
    async getChunksByChapter(courseId, chapterId) {
        const { data, error } = await supabaseClient
            .from('ai_coach_content_chunks')
            .select('*')
            .eq('course_id', courseId)
            .eq('chapter_id', chapterId)
            .order('day', { ascending: true });

        if (error) {
            throw error;
        }

        return data || [];
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array<number>} vecA - First vector
     * @param {Array<number>} vecB - Second vector
     * @returns {number} Similarity score (0-1)
     */
    _cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) {
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
     * Hybrid search: Combine semantic and keyword search
     * @param {string} query - Search query
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of relevant chunks
     */
    async hybridSearch(query, courseId, filters = {}, limit = 5) {
        // Generate query embedding
        const queryEmbedding = await llmService.generateEmbedding(query);

        // Semantic search
        const semanticResults = await this.searchSimilarChunks(queryEmbedding, courseId, filters, limit * 2);

        // Keyword search (simple text matching)
        const keywordResults = await this.keywordSearch(query, courseId, filters, limit * 2);

        // Combine and deduplicate
        const combined = new Map();
        
        // Add semantic results with higher weight
        semanticResults.forEach((chunk, index) => {
            const score = chunk.similarity * 0.7 + (1 - index / semanticResults.length) * 0.3;
            combined.set(chunk.id, { ...chunk, combinedScore: score, source: 'semantic' });
        });

        // Add keyword results
        keywordResults.forEach((chunk, index) => {
            const existing = combined.get(chunk.id);
            if (existing) {
                existing.combinedScore += 0.3 * (1 - index / keywordResults.length);
                existing.source = 'both';
            } else {
                const score = 0.3 * (1 - index / keywordResults.length);
                combined.set(chunk.id, { ...chunk, combinedScore: score, source: 'keyword' });
            }
        });

        // Sort by combined score and return top results
        return Array.from(combined.values())
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, limit);
    }

    /**
     * Simple keyword search
     * @param {string} query - Search query
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of matching chunks
     */
    async keywordSearch(query, courseId, filters = {}, limit = 5) {
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

        let dbQuery = supabaseClient
            .from('ai_coach_content_chunks')
            .select('*')
            .eq('course_id', courseId);

        // Apply filters
        if (filters.contentType) {
            dbQuery = dbQuery.eq('content_type', filters.contentType);
        }

        const { data: chunks, error } = await dbQuery;

        if (error) {
            throw error;
        }

        if (!chunks || chunks.length === 0) {
            return [];
        }

        // Score chunks by keyword matches
        const scoredChunks = chunks.map(chunk => {
            const content = (chunk.content || '').toLowerCase();
            const title = (chunk.chapter_title || '').toLowerCase();
            
            let score = 0;
            keywords.forEach(keyword => {
                const contentMatches = (content.match(new RegExp(keyword, 'g')) || []).length;
                const titleMatches = (title.match(new RegExp(keyword, 'g')) || []).length;
                score += contentMatches * 1 + titleMatches * 3; // Title matches weighted higher
            });

            return { ...chunk, keywordScore: score };
        });

        // Sort by score and return top results
        return scoredChunks
            .filter(chunk => chunk.keywordScore > 0)
            .sort((a, b) => b.keywordScore - a.keywordScore)
            .slice(0, limit);
    }
}

export const retrievalService = new RetrievalService();

