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
        // Generate query embedding (with timeout protection)
        let queryEmbedding;
        try {
            const embeddingPromise = llmService.generateEmbedding(query);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Embedding generation timed out after 20 seconds')), 20000);
            });
            queryEmbedding = await Promise.race([embeddingPromise, timeoutPromise]);
        } catch (error) {
            console.error('[RetrievalService] Error generating embedding:', error);
            // If embedding fails, fall back to keyword-only search
            console.warn('[RetrievalService] Falling back to keyword-only search due to embedding error');
            return await this.keywordSearch(query, courseId, filters, limit);
        }

        // Increase search limit to ensure we find dedicated chapters even if they score slightly lower
        // This helps ensure comprehensive/dedicated chapters are included in results
        const searchLimit = limit * 3; // Increased from limit * 2 to get more candidates

        // Semantic search
        const semanticResults = await this.searchSimilarChunks(queryEmbedding, courseId, filters, searchLimit);

        // Keyword search (simple text matching)
        const keywordResults = await this.keywordSearch(query, courseId, filters, limit * 2);

        // Extract topic keywords from query for dedicated chapter matching
        // Use improved topic extraction
        const topicKeywords = this._extractTopicKeywordsImproved(query);

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
                // Enhanced topic matching (same logic as context builder)
                const primaryTopicLower = primaryTopic.toLowerCase();
                const topicMatch = topicKeywords.some(tk => {
                    const tkLower = tk.toLowerCase();
                    
                    // Exact or contains match
                    if (primaryTopicLower.includes(tkLower) || tkLower.includes(primaryTopicLower)) {
                        return true;
                    }
                    
                    // Word-by-word matching
                    const primaryWords = primaryTopicLower.split(/\s+/).filter(w => w.length > 3);
                    const allWordsMatch = primaryWords.every(pw => 
                        topicKeywords.some(tk2 => tk2.includes(pw) || pw.includes(tk2))
                    );
                    if (allWordsMatch && primaryWords.length >= 2) {
                        return true;
                    }
                    
                    // Acronym expansion
                    if (tkLower.length <= 5 && /^[a-z]+$/.test(tkLower)) {
                        const primaryWordsInQuery = primaryWords.some(pw => 
                            query.toLowerCase().includes(pw)
                        );
                        if (primaryWordsInQuery) {
                            return true;
                        }
                    }
                    
                    return false;
                });
                
                if (topicMatch) {
                    score += 0.5; // Increased boost from 0.3 to 0.5 for dedicated chapters
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
    /**
     * Extract topic keywords from query (improved version)
     * Recognizes multi-word topics, acronyms, and technical terms
     * @param {string} query - User query
     * @returns {Array<string>} Topic keywords and phrases
     */
    _extractTopicKeywordsImproved(query) {
        const lowerQuery = query.toLowerCase();
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'different', 'difference', 'key', 'elements', 'examples', 'list', 'case', 'success', 'about']);
        
        const topics = [];
        
        // 1. Extract multi-word technical terms (2-4 words that are commonly used together)
        const technicalPhrases = [
            'answer engine optimization', 'aeo',
            'search engine optimization', 'seo',
            'technical seo', 'on-page seo', 'off-page seo',
            'ecommerce seo', 'local seo',
            'keyword research', 'keyword mapping',
            'content marketing', 'link building',
            'page experience', 'core web vitals',
            'structured data', 'schema markup',
            'featured snippets', 'zero-click search',
            'search intent', 'user intent',
            'serp features', 'serp analysis',
            'canonical tags', 'meta tags',
            'robots.txt', 'sitemap',
            'internal linking', 'external linking',
            'backlinks', 'domain authority',
            'page speed', 'mobile optimization',
            'voice search', 'ai search'
        ];
        
        for (const phrase of technicalPhrases) {
            if (lowerQuery.includes(phrase)) {
                topics.push(phrase);
                // Also add individual significant words from the phrase
                const phraseWords = phrase.split(/\s+/).filter(w => w.length > 3 && !commonWords.has(w));
                topics.push(...phraseWords);
            }
        }
        
        // 2. Extract acronyms (2-5 uppercase letters, possibly with periods)
        const acronymPattern = /\b([A-Z]{2,5}(?:\.[A-Z]{2,5})*)\b/g;
        const acronyms = lowerQuery.match(acronymPattern);
        if (acronyms) {
            topics.push(...acronyms.map(a => a.toLowerCase().replace(/\./g, '')));
        }
        
        // 3. Extract significant individual words (length > 3, not common words)
        const words = lowerQuery.split(/\s+/)
            .map(w => w.replace(/[^\w]/g, ''))
            .filter(w => w.length > 3 && !commonWords.has(w) && !topics.includes(w));
        
        topics.push(...words);
        
        // 4. Remove duplicates and return
        return [...new Set(topics)];
    }

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
     * STRICT LAB SEARCH - Lab Isolation Enforcement
     * 
     * This method enforces strict lab isolation for lab_guidance questions.
     * CRITICAL: This method does NOT use semantic search or fallback mechanisms.
     * 
     * Why fallback is forbidden for labs:
     * 1. Lab Safety: Learners must get guidance ONLY from the specific lab they're working on
     * 2. Context Integrity: Cross-day or cross-lab content can mislead learners
     * 3. Precision Requirement: Lab questions are highly specific and require exact matches
     * 4. Safety: Preventing confusion from similar but different lab content
     * 
     * @param {Object} references - Reference object with day and lab (both required)
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of matching chunks (ONLY from Day X AND Lab Y)
     */
    async searchStrictLabMatch(references, courseId, filters = {}, limit = 50) {
        if (!courseId) {
            throw new Error('courseId is required for strict lab search');
        }

        // CRITICAL: Both day and lab must be specified for strict lab search
        if (references.day === null || references.day === undefined) {
            throw new Error('Day is required for strict lab search');
        }
        if (references.lab === null || references.lab === undefined) {
            throw new Error('Lab is required for strict lab search');
        }

        try {
            console.log(`[RetrievalService] STRICT LAB SEARCH: Day ${references.day}, Lab ${references.lab} - NO FALLBACKS ALLOWED`);

            // Verify user session for RLS
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                console.warn('[RetrievalService] No authenticated user session. RLS will block access.');
            }

            // Build STRICT query - MUST match BOTH day AND lab
            // NO semantic search, NO fallback, NO cross-day matches
            let query = supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId)
                .eq('content_type', 'lab'); // CRITICAL: Only lab content

            // STRICT Day filter - must match exactly
            // Handle both numeric and string day fields
            query = query.or(`day.eq.${references.day},day.eq.day${references.day},day.eq."day${references.day}"`);

            // STRICT Lab filter - must match exactly
            // Try multiple lab ID formats but ALL must match the specified lab
            const labPatterns = [
                `lab${references.lab}`,
                `day${references.day}-lab${references.lab}`,
                `lab-${references.lab}`
            ];
            query = query.or(
                labPatterns.map(pattern => 
                    `lab_id.ilike.%${pattern}%`
                ).join(',')
            );

            // Apply additional filters if provided
            if (filters.contentType) {
                query = query.eq('content_type', filters.contentType);
            }

            // Get matching chunks - NO LIMIT for strict lab search (we want all chunks from this lab)
            const { data: chunks, error } = await query.limit(limit || 100);

            if (error) {
                console.error('[RetrievalService] Database error in strict lab search:', error);
                if (error.code === '42501' || error.message?.includes('row-level security')) {
                    console.error('[RetrievalService] RLS policy blocked access.');
                    return [];
                }
                throw error;
            }

            console.log(`[RetrievalService] STRICT LAB SEARCH found ${chunks?.length || 0} chunks for Day ${references.day}, Lab ${references.lab}`);

            if (!chunks || chunks.length === 0) {
                console.warn(`[RetrievalService] STRICT LAB SEARCH: No chunks found for Day ${references.day}, Lab ${references.lab} - NO FALLBACK`);
                return [];
            }

            // CRITICAL: Post-filter to ensure ALL chunks match BOTH day AND lab
            // This is a safety check to prevent any cross-day or cross-lab contamination
            const strictlyFiltered = chunks.filter(chunk => {
                // Verify day matches
                const chunkDay = parseInt(chunk.day) || chunk.day;
                const dayMatches = chunkDay === references.day || 
                                 String(chunkDay).includes(String(references.day)) ||
                                 String(chunkDay).replace(/\D/g, '') === String(references.day);

                // Verify lab matches
                const chunkLab = chunk.lab_id || chunk.lab;
                const labMatches = chunkLab && (
                    String(chunkLab).includes(String(references.lab)) ||
                    String(chunkLab).replace(/\D/g, '') === String(references.lab) ||
                    chunkLab === references.lab
                );

                return dayMatches && labMatches;
            });

            if (strictlyFiltered.length !== chunks.length) {
                console.warn(`[RetrievalService] STRICT LAB SEARCH: Filtered out ${chunks.length - strictlyFiltered.length} chunks that didn't match strict criteria`);
            }

            // Return chunks with strict match flag
            return strictlyFiltered.map(chunk => ({ 
                ...chunk, 
                exactMatch: true,
                strictLabMatch: true, // Flag to indicate this is from strict lab search
                similarity: 1.0 // Set high similarity since it's an exact match
            }));
        } catch (error) {
            console.error('[RetrievalService] Error in strict lab search:', error);
            return [];
        }
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

    /**
     * Search for dedicated topic chapters by primary_topic
     * This ensures we find dedicated chapters even if they don't score high in semantic search
     * @param {Array<string>} topicKeywords - Topic keywords extracted from query
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array<Object>>} Array of dedicated chapter chunks
     */
    async searchDedicatedChaptersByTopic(topicKeywords, courseId, filters = {}) {
        if (!topicKeywords || topicKeywords.length === 0) {
            return [];
        }

        try {
            console.log('[RetrievalService] Searching for dedicated chapters by topic:', topicKeywords);

            // Search strategy: Try multiple approaches to find dedicated chapters
            // 1. Search by metadata (is_dedicated_topic_chapter = true)
            // 2. Search by chapter title/content containing topic keywords (fallback)
            
            let dedicatedChunks = [];
            
            // Approach 1: Search by metadata
            let query = supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId)
                .eq('is_dedicated_topic_chapter', true)
                .not('primary_topic', 'is', null);

            // Apply filters
            if (filters.contentType) {
                query = query.eq('content_type', filters.contentType);
            }

            const { data: metadataChunks, error } = await query;

            if (!error && metadataChunks && metadataChunks.length > 0) {
                dedicatedChunks = metadataChunks;
                console.log(`[RetrievalService] Found ${dedicatedChunks.length} chunks with dedicated topic metadata`);
            } else {
                console.log('[RetrievalService] No chunks found with dedicated topic metadata, trying fallback search...');
                
                // Fallback: Search by chapter title/content containing topic keywords
                // This helps when metadata isn't set but chapter is clearly about the topic
                // Use ALL topic keywords, not just top 3, to maximize chances of finding the chapter
                const topicSearchTerms = topicKeywords
                    .filter(tk => tk.length > 2) // Lower threshold to 2 to catch "seo", "aeo", etc.
                    .slice(0, 5); // Increased from 3 to 5 to catch more variations
                
                if (topicSearchTerms.length > 0) {
                    console.log(`[RetrievalService] Fallback search using terms: ${topicSearchTerms.join(', ')}`);
                    
                    let fallbackQuery = supabaseClient
                        .from('ai_coach_content_chunks')
                        .select('*')
                        .eq('course_id', courseId)
                        .eq('content_type', 'chapter'); // Only chapters
                    
                    // Search in chapter_title and content for topic keywords
                    // Use more flexible matching: search for each term individually and combine
                    // Also search for multi-word phrases as complete phrases
                    const searchPatterns = [];
                    
                    // First, try exact phrase matches (e.g., "technical seo" as a phrase)
                    const multiWordTopics = topicKeywords.filter(tk => tk.split(/\s+/).length >= 2);
                    multiWordTopics.forEach(phrase => {
                        searchPatterns.push(`chapter_title.ilike.%${phrase}%`);
                        searchPatterns.push(`content.ilike.%${phrase}%`);
                    });
                    
                    // Then, try individual word matches
                    topicSearchTerms.forEach(term => {
                        searchPatterns.push(`chapter_title.ilike.%${term}%`);
                        searchPatterns.push(`content.ilike.%${term}%`);
                    });
                    
                    if (searchPatterns.length > 0) {
                        fallbackQuery = fallbackQuery.or(searchPatterns.join(','));
                    }
                    
                    // Don't filter by day - dedicated chapters can be anywhere in the course
                    // Some topics like Technical SEO might be covered in earlier days
                    // We'll rely on title/content matching to find the right chapter
                    
                    if (filters.contentType) {
                        fallbackQuery = fallbackQuery.eq('content_type', filters.contentType);
                    }
                    
                    const { data: fallbackChunks, error: fallbackError } = await fallbackQuery.limit(50);
                    
                    if (!fallbackError && fallbackChunks && fallbackChunks.length > 0) {
                        console.log(`[RetrievalService] Fallback search found ${fallbackChunks.length} potential dedicated chapters`);
                        // Mark these as dedicated topic matches for prioritization
                        dedicatedChunks = fallbackChunks.map(chunk => ({
                            ...chunk,
                            // Infer that these are dedicated chapters based on title/content match
                            is_dedicated_topic_chapter: true,
                            primary_topic: chunk.chapter_title || 'inferred from content'
                        }));
                    }
                }
            }

            if (!dedicatedChunks || dedicatedChunks.length === 0) {
                console.log('[RetrievalService] No dedicated chapters found via any method');
                return [];
            }

            // Filter chunks where primary_topic or chapter_title/content matches topic keywords
            const matchingChunks = dedicatedChunks.filter(chunk => {
                const primaryTopic = (chunk.primary_topic || '').toLowerCase();
                const chapterTitle = (chunk.chapter_title || '').toLowerCase();
                const content = (chunk.content || '').toLowerCase();
                
                // Check if any topic keyword matches primary_topic, chapter_title, or content
                return topicKeywords.some(topic => {
                    const topicLower = topic.toLowerCase();
                    
                    // Match against primary_topic (if set)
                    if (primaryTopic) {
                        // Exact or contains match
                        if (primaryTopic.includes(topicLower) || topicLower.includes(primaryTopic)) {
                            return true;
                        }
                        
                        // Word-by-word matching
                        const primaryWords = primaryTopic.split(/\s+/).filter(w => w.length > 3);
                        const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3);
                        
                        if (primaryWords.length >= 2 && topicWords.length >= 2) {
                            // Check if significant words overlap
                            const overlap = primaryWords.filter(pw => 
                                topicWords.some(tw => pw.includes(tw) || tw.includes(pw))
                            );
                            if (overlap.length >= Math.min(primaryWords.length, topicWords.length) * 0.6) {
                                return true;
                            }
                        }
                        
                        // Acronym matching (e.g., "aeo" matches "answer engine optimization")
                        if (topicLower.length <= 5 && /^[a-z]+$/.test(topicLower)) {
                            const primaryWordsMatch = primaryWords.some(pw => 
                                topicLower.includes(pw.substring(0, 1)) || 
                                primaryTopic.split(/\s+/).map(w => w[0]).join('').toLowerCase() === topicLower
                            );
                            if (primaryWordsMatch) {
                                return true;
                            }
                        }
                    }
                    
                    // Fallback: Match against chapter_title or content (for chunks without primary_topic)
                    if (chapterTitle.includes(topicLower) || content.includes(topicLower)) {
                        return true;
                    }
                    
                    // Check if topic words appear in chapter title (flexible matching)
                    const topicWords = topicLower.split(/\s+/).filter(w => w.length > 2); // Lower threshold to 2
                    if (topicWords.length >= 1) { // Changed from 2 to 1
                        const wordsInTitle = topicWords.filter(tw => chapterTitle.includes(tw));
                        // If at least one significant word matches, consider it a match
                        // This helps match "technical seo" with chapters titled "Technical SEO"
                        if (wordsInTitle.length >= 1) {
                            return true;
                        }
                    }
                    
                    // Additional check: if topic is a multi-word phrase, check if all words appear
                    // This helps match "technical seo" even if chapter title has different word order
                    if (topicWords.length >= 2) {
                        const allWordsMatch = topicWords.every(tw => 
                            chapterTitle.includes(tw) || content.includes(tw)
                        );
                        if (allWordsMatch) {
                            return true;
                        }
                    }
                    
                    return false;
                });
            });

            console.log(`[RetrievalService] Found ${matchingChunks.length} dedicated chapters matching topics`);

            // Return chunks with high similarity score (they're dedicated chapters matching the topic)
            return matchingChunks.map(chunk => ({
                ...chunk,
                similarity: 0.9, // High similarity for dedicated chapters
                isDedicatedTopicMatch: true,
                source: 'dedicated_chapter_search'
            }));
        } catch (error) {
            console.error('[RetrievalService] Error in searchDedicatedChaptersByTopic:', error);
            return [];
        }
    }

    /**
     * Search for topic-specific chunks (excluding introductory/philosophy-only chapters)
     * Used when query contains topic modifiers that require strict topic matching
     * 
     * @param {Array<string>} topicModifiers - Topic modifiers extracted from query
     * @param {string} courseId - Course identifier
     * @param {Object} filters - Additional filters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array<Object>>} Array of topic-specific chunks (excluding introduction-level)
     */
    async searchTopicSpecificChunks(topicModifiers, courseId, filters = {}, limit = 20) {
        if (!topicModifiers || topicModifiers.length === 0) {
            return [];
        }

        try {
            console.log(`[RetrievalService] Searching for topic-specific chunks (excluding introductory) for modifiers: ${topicModifiers.join(', ')}`);

            let query = supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId);

            // CRITICAL: Exclude introduction-level chunks with low completeness
            // These are philosophy-only or introductory content, not topic-specific
            query = query.or(`coverage_level.neq.introduction,coverage_level.is.null,completeness_score.gte.0.4,completeness_score.is.null`);

            // Search for chunks with primary_topic matching any modifier
            const topicConditions = topicModifiers.map(modifier => 
                `primary_topic.ilike.%${modifier}%,chapter_title.ilike.%${modifier}%`
            );
            if (topicConditions.length > 0) {
                query = query.or(topicConditions.join(','));
            }

            // Prefer dedicated topic chapters
            query = query.eq('is_dedicated_topic_chapter', true);

            // Apply additional filters
            if (filters.contentType) {
                query = query.eq('content_type', filters.contentType);
            }

            const { data: chunks, error } = await query.limit(limit);

            if (error) {
                console.error('[RetrievalService] Error searching topic-specific chunks:', error);
                return [];
            }

            // Post-filter to ensure chunks match modifiers and exclude pure introduction
            const filteredChunks = (chunks || []).filter(chunk => {
                const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
                const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 1.0;
                const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
                const chapterTitle = (chunk.chapter_title || '').toLowerCase();

                // Exclude if it's introduction-level with low completeness (philosophy-only)
                if (coverageLevel === 'introduction' && completenessScore < 0.4) {
                    return false;
                }

                // Check if chunk matches any modifier
                return topicModifiers.some(modifier => {
                    const modifierLower = modifier.toLowerCase();
                    return primaryTopic.includes(modifierLower) ||
                           modifierLower.includes(primaryTopic) ||
                           chapterTitle.includes(modifierLower);
                });
            });

            console.log(`[RetrievalService] Found ${filteredChunks.length} topic-specific chunks (excluding introductory) for modifiers: ${topicModifiers.join(', ')}`);

            return filteredChunks.map(chunk => ({
                ...chunk,
                topicSpecificMatch: true,
                similarity: chunk.similarity || 0.9 // High similarity for topic-specific matches
            }));
        } catch (error) {
            console.error('[RetrievalService] Error in searchTopicSpecificChunks:', error);
            return [];
        }
    }
}

export const retrievalService = new RetrievalService();

