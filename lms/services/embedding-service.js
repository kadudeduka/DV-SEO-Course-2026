/**
 * Embedding Service
 * 
 * Handles embedding generation for course content,
 * batch processing, and caching.
 */

import { llmService } from './llm-service.js';
import { supabaseClient } from './supabase-client.js';

class EmbeddingService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Generate embedding for a single text
     * @param {string} text - Text to embed
     * @returns {Promise<Array<number>>} Embedding vector
     */
    async generateEmbedding(text) {
        return await llmService.generateEmbedding(text);
    }

    /**
     * Generate embeddings for multiple texts in batch
     * @param {Array<string>} texts - Array of texts to embed
     * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
     */
    async generateEmbeddingsBatch(texts) {
        return await llmService.generateEmbeddingsBatch(texts);
    }

    /**
     * Calculate SHA-256 hash of content for change detection
     * @param {string} content - Content to hash
     * @returns {Promise<string>} SHA-256 hash
     */
    async calculateContentHash(content) {
        // Use Web Crypto API (available in modern browsers)
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(content);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        
        // Fallback: simple hash (not cryptographically secure, but sufficient for change detection)
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    /**
     * Index course content into chunks with embeddings
     * @param {string} courseId - Course identifier
     * @param {Object} options - Indexing options
     * @returns {Promise<Object>} Indexing result
     */
    async indexCourseContent(courseId, options = {}) {
        const {
            full = false,
            incremental = true,
            force = false
        } = options;

        console.log(`[EmbeddingService] Starting content indexing for course: ${courseId}`);

        try {
            // Get course data
            const { getCourses } = await import('../../data/courses.js');
            const courses = await getCourses();
            const course = courses.find(c => c.id === courseId);

            if (!course) {
                throw new Error(`Course not found: ${courseId}`);
            }

            // Get existing chunks
            const { data: existingChunks } = await supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId);

            const existingChunksMap = new Map();
            if (existingChunks) {
                existingChunks.forEach(chunk => {
                    const key = `${chunk.day}_${chunk.chapter_id}_${chunk.lab_id || ''}`;
                    existingChunksMap.set(key, chunk);
                });
            }

            // Extract and chunk content
            const chunks = this._extractChunks(course);
            const chunksToIndex = [];
            const chunksToUpdate = [];

            for (const chunk of chunks) {
                const key = `${chunk.day}_${chunk.chapter_id}_${chunk.lab_id || ''}`;
                const contentHash = await this.calculateContentHash(chunk.content);
                const existing = existingChunksMap.get(key);

                if (full || force || !existing) {
                    // New chunk or full re-index
                    chunksToIndex.push({ ...chunk, contentHash });
                } else if (incremental && existing) {
                    // Check if content changed
                    if (existing.content_hash !== contentHash) {
                        chunksToUpdate.push({ ...chunk, contentHash, existingId: existing.id });
                    }
                }
            }

            console.log(`[EmbeddingService] Found ${chunksToIndex.length} new chunks, ${chunksToUpdate.length} chunks to update`);

            // Generate embeddings in batches
            const batchSize = 10;
            let indexed = 0;
            let updated = 0;

            // Index new chunks
            for (let i = 0; i < chunksToIndex.length; i += batchSize) {
                const batch = chunksToIndex.slice(i, i + batchSize);
                const texts = batch.map(c => c.content);
                
                console.log(`[EmbeddingService] Generating embeddings for batch ${Math.floor(i / batchSize) + 1}...`);
                const embeddings = await this.generateEmbeddingsBatch(texts);

                // Insert chunks with embeddings
                for (let j = 0; j < batch.length; j++) {
                    const chunk = batch[j];
                    const embedding = embeddings[j];

                    const { error } = await supabaseClient
                        .from('ai_coach_content_chunks')
                        .insert({
                            course_id: courseId,
                            day: chunk.day,
                            chapter_id: chunk.chapter_id,
                            chapter_title: chunk.chapter_title,
                            lab_id: chunk.lab_id || null,
                            content: chunk.content,
                            content_type: chunk.content_type,
                            token_count: chunk.token_count || this._estimateTokenCount(chunk.content),
                            embedding: `[${embedding.join(',')}]`, // Convert to PostgreSQL array format
                            content_hash: chunk.contentHash,
                            content_version: 1,
                            indexed_at: new Date().toISOString()
                        });

                    if (error) {
                        console.error(`[EmbeddingService] Error inserting chunk ${chunk.chapter_id}:`, error);
                    } else {
                        indexed++;
                    }
                }
            }

            // Update existing chunks
            for (const chunk of chunksToUpdate) {
                const texts = [chunk.content];
                const embeddings = await this.generateEmbeddingsBatch(texts);
                const embedding = embeddings[0];

                const { error } = await supabaseClient
                    .from('ai_coach_content_chunks')
                    .update({
                        content: chunk.content,
                        embedding: `[${embedding.join(',')}]`,
                        content_hash: chunk.contentHash,
                        content_version: (existingChunksMap.get(`${chunk.day}_${chunk.chapter_id}_${chunk.lab_id || ''}`).content_version || 0) + 1,
                        indexed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', chunk.existingId);

                if (error) {
                    console.error(`[EmbeddingService] Error updating chunk ${chunk.chapter_id}:`, error);
                } else {
                    updated++;
                }
            }

            console.log(`[EmbeddingService] Indexing complete: ${indexed} indexed, ${updated} updated`);

            return {
                success: true,
                indexed,
                updated,
                total: chunks.length
            };
        } catch (error) {
            console.error('[EmbeddingService] Error indexing course content:', error);
            throw error;
        }
    }

    /**
     * Extract content chunks from course data
     * @param {Object} course - Course object
     * @returns {Array<Object>} Array of content chunks
     */
    extractChunks(course) {
        const chunks = [];

        if (!course.courseData || !course.courseData.days) {
            return chunks;
        }

        // Extract chunks from each day
        course.courseData.days.forEach((day, dayIndex) => {
            const dayNumber = dayIndex + 1;

            // Add overview chunk if available
            if (day.overview) {
                chunks.push({
                    day: dayNumber,
                    chapter_id: `day${dayNumber}-overview`,
                    chapter_title: day.title || `Day ${dayNumber} Overview`,
                    lab_id: null,
                    content: day.overview,
                    content_type: 'overview',
                    token_count: this._estimateTokenCount(day.overview)
                });
            }

            // Extract chunks from chapters
            if (day.chapters) {
                day.chapters.forEach((chapter, chapterIndex) => {
                    const chapterId = chapter.id || `day${dayNumber}-ch${chapterIndex + 1}`;
                    
                    // Chunk chapter content (split by sections if large)
                    const chapterContent = chapter.content || '';
                    const chapterChunks = this._chunkText(chapterContent, {
                        maxTokens: 500,
                        overlap: 50
                    });

                    chapterChunks.forEach((chunkContent, chunkIndex) => {
                        chunks.push({
                            day: dayNumber,
                            chapter_id: chunkIndex === 0 ? chapterId : `${chapterId}-part${chunkIndex + 1}`,
                            chapter_title: chapter.title || `Chapter ${chapterIndex + 1}`,
                            lab_id: null,
                            content: chunkContent,
                            content_type: 'chapter',
                            token_count: this._estimateTokenCount(chunkContent)
                        });
                    });
                });
            }

            // Extract chunks from labs
            if (day.labs) {
                day.labs.forEach((lab, labIndex) => {
                    const labId = lab.id || `day${dayNumber}-lab${labIndex + 1}`;
                    const labContent = [
                        lab.title || `Lab ${labIndex + 1}`,
                        lab.description || '',
                        lab.instructions || ''
                    ].filter(Boolean).join('\n\n');

                    if (labContent.trim()) {
                        chunks.push({
                            day: dayNumber,
                            chapter_id: `day${dayNumber}-lab${labIndex + 1}`,
                            chapter_title: lab.title || `Lab ${labIndex + 1}`,
                            lab_id: labId,
                            content: labContent,
                            content_type: 'lab',
                            token_count: this._estimateTokenCount(labContent)
                        });
                    }
                });
            }
        });

        return chunks;
    }

    /**
     * Chunk text into smaller pieces
     * @param {string} text - Text to chunk
     * @param {Object} options - Chunking options
     * @returns {Array<string>} Array of text chunks
     */
    _chunkText(text, options = {}) {
        const { maxTokens = 500, overlap = 50 } = options;
        const maxChars = maxTokens * 4; // Rough estimate: 1 token ≈ 4 characters
        const overlapChars = overlap * 4;

        if (text.length <= maxChars) {
            return [text];
        }

        const chunks = [];
        let start = 0;

        while (start < text.length) {
            let end = start + maxChars;
            
            // Try to break at sentence boundary
            if (end < text.length) {
                const lastPeriod = text.lastIndexOf('.', end);
                const lastNewline = text.lastIndexOf('\n', end);
                const breakPoint = Math.max(lastPeriod, lastNewline);
                
                if (breakPoint > start + maxChars * 0.5) {
                    end = breakPoint + 1;
                }
            }

            chunks.push(text.substring(start, end).trim());
            start = end - overlapChars;
        }

        return chunks.filter(chunk => chunk.length > 0);
    }

    /**
     * Estimate token count (rough approximation)
     * @param {string} text - Text to estimate
     * @returns {number} Estimated token count
     */
    _estimateTokenCount(text) {
        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }
}

export const embeddingService = new EmbeddingService();

