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
     * Hybrid search: Combine semantic and keyword search with metadata-aware prioritization
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

        // Extract topic keywords from query for dedicated chapter matching
        const topicKeywords = this._extractTopicKeywords(query);

        // Combine and deduplicate
        const combined = new Map();
        
        // Add semantic results with higher weight
        semanticResults.forEach((chunk, index) => {
            let score = chunk.similarity * 0.7 + (1 - index / semanticResults.length) * 0.3;
            
            // Boost score for dedicated topic chapters that match query topic
            const metadata = chunk.metadata || {};
            const isDedicatedTopic = metadata.is_dedicated_topic_chapter ?? chunk.is_dedicated_topic_chapter;
            const primaryTopic = metadata.primary_topic || chunk.primary_topic;
            
            if (isDedicatedTopic && primaryTopic && topicKeywords.length > 0) {
                const topicMatch = topicKeywords.some(tk => 
                    primaryTopic.toLowerCase().includes(tk) || tk.includes(primaryTopic.toLowerCase())
                );
                if (topicMatch) {
                    score += 0.3; // Boost for dedicated chapters matching topic
                }
            }
            
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
     * Extract topic keywords from query
     * @param {string} query - Search query
     * @returns {Array<string>} Topic keywords
     */
    _extractTopicKeywords(query) {
        const lowerQuery = query.toLowerCase();
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'different', 'difference', 'key', 'elements', 'examples', 'list', 'are', 'is', 'what']);
        
        // Extract significant words (length > 4, not common words)
        const words = lowerQuery.split(/\s+/)
            .map(w => w.replace(/[^\w]/g, ''))
            .filter(w => w.length > 4 && !commonWords.has(w));
        
        return words;
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

    /**
     * Search for chunks with exact match on specific references (Day, Lab, Step, Chapter)
     * @param {Object} references - Reference object with day, lab, step, chapter
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of matching chunks
     */
    async searchExactMatch(references, courseId, filters = {}, limit = 50) {
        if (!courseId) {
            throw new Error('courseId is required for exact match search');
        }

        try {
            // Verify user session for RLS
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                console.warn('[RetrievalService] No authenticated user session. RLS will block access.');
            }

            // Build query with exact match filters
            let query = supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId);

            // Apply exact match filters
            if (references.day !== null && references.day !== undefined) {
                // Handle both numeric and string day fields
                query = query.or(`day.eq.${references.day},day.eq.day${references.day},day.eq."day${references.day}"`);
            }

            if (references.chapter !== null && references.chapter !== undefined) {
                // Try multiple chapter ID formats
                const chapterPatterns = [
                    `chapter-${references.chapter}`,
                    `ch${references.chapter}`,
                    `day${references.day || ''}-ch${references.chapter}`,
                    `chapter ${references.chapter}`
                ];
                // Use ilike for pattern matching on chapter_id or chapter_title
                query = query.or(
                    chapterPatterns.map(pattern => 
                        `chapter_id.ilike.%${pattern}%,chapter_title.ilike.%${pattern}%`
                    ).join(',')
                );
            }

            if (references.lab !== null && references.lab !== undefined) {
                // Try multiple lab ID formats
                const labPatterns = [
                    `lab${references.lab}`,
                    `day${references.day || ''}-lab${references.lab}`,
                    `lab-${references.lab}`
                ];
                query = query.or(
                    labPatterns.map(pattern => 
                        `lab_id.ilike.%${pattern}%`
                    ).join(',')
                );
            }

            // Apply additional filters
            if (filters.contentType) {
                query = query.eq('content_type', filters.contentType);
            }

            // Get all matching chunks
            const { data: chunks, error } = await query.limit(limit);

            if (error) {
                console.error('[RetrievalService] Database error in exact match search:', error);
                if (error.code === '42501' || error.message?.includes('row-level security')) {
                    console.error('[RetrievalService] RLS policy blocked access.');
                    return [];
                }
                throw error;
            }

            console.log(`[RetrievalService] Exact match search found ${chunks?.length || 0} chunks`, {
                references,
                filters
            });

            if (!chunks || chunks.length === 0) {
                console.warn('[RetrievalService] No chunks found for exact match:', references);
                return [];
            }

            // Add step number filtering if specified (may need to check content or metadata)
            if (references.step !== null && references.step !== undefined) {
                // Filter chunks that contain step information
                // This is a heuristic - step info might be in content or metadata
                const stepFiltered = chunks.filter(chunk => {
                    const content = (chunk.content || '').toLowerCase();
                    const stepPatterns = [
                        `step ${references.step}`,
                        `step ${references.step}:`,
                        `step ${references.step}.`,
                        `step${references.step}`
                    ];
                    return stepPatterns.some(pattern => content.includes(pattern));
                });

                if (stepFiltered.length > 0) {
                    console.log(`[RetrievalService] Filtered to ${stepFiltered.length} chunks matching step ${references.step}`);
                    return stepFiltered.map(chunk => ({ ...chunk, similarity: 1.0, exactMatch: true }));
                }
            }

            // Return chunks with exact match flag
            return chunks.map(chunk => ({ ...chunk, similarity: 1.0, exactMatch: true }));
        } catch (error) {
            console.error('[RetrievalService] Error in exact match search:', error);
            return [];
        }
    }

    /**
     * Retrieve ALL chunks from a specific chapter (for list requests)
     * @param {Object} chapterRef - Chapter reference with day and/or chapter
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array<Object>>} Array of all chunks from the chapter
     */
    async getAllChunksFromChapter(chapterRef, courseId, filters = {}) {
        if (!courseId) {
            throw new Error('courseId is required');
        }

        try {
            // Verify user session for RLS
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                console.warn('[RetrievalService] No authenticated user session. RLS will block access.');
            }

            // Build query
            let query = supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId);

            // Filter by day if specified
            if (chapterRef.day !== null && chapterRef.day !== undefined) {
                query = query.or(`day.eq.${chapterRef.day},day.eq.day${chapterRef.day},day.eq."day${chapterRef.day}"`);
            }

            // Filter by chapter if specified
            if (chapterRef.chapter !== null && chapterRef.chapter !== undefined) {
                const chapterPatterns = [
                    `chapter-${chapterRef.chapter}`,
                    `ch${chapterRef.chapter}`,
                    `day${chapterRef.day || ''}-ch${chapterRef.chapter}`,
                    `chapter ${chapterRef.chapter}`
                ];
                query = query.or(
                    chapterPatterns.map(pattern => 
                        `chapter_id.ilike.%${pattern}%,chapter_title.ilike.%${pattern}%`
                    ).join(',')
                );
            }

            // Apply additional filters
            if (filters.contentType) {
                query = query.eq('content_type', filters.contentType);
            }

            // Get ALL chunks (no limit for list requests)
            const { data: chunks, error } = await query;

            if (error) {
                console.error('[RetrievalService] Database error in getAllChunksFromChapter:', error);
                if (error.code === '42501' || error.message?.includes('row-level security')) {
                    console.error('[RetrievalService] RLS policy blocked access.');
                    return [];
                }
                throw error;
            }

            console.log(`[RetrievalService] Retrieved ${chunks?.length || 0} chunks from chapter`, {
                chapterRef,
                filters
            });

            if (!chunks || chunks.length === 0) {
                console.warn('[RetrievalService] No chunks found for chapter:', chapterRef);
                return [];
            }

            // Return all chunks with high similarity score (they're all from the requested chapter)
            return chunks.map(chunk => ({ 
                ...chunk, 
                similarity: 1.0, 
                exactMatch: true,
                fromListRequest: true 
            }));
        } catch (error) {
            console.error('[RetrievalService] Error in getAllChunksFromChapter:', error);
            return [];
        }
    }
}

export const retrievalService = new RetrievalService();

