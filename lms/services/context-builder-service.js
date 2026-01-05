/**
 * Context Builder Service
 * 
 * Builds dynamic context based on learner progress,
 * prioritizes content chunks, and filters by access.
 */

import { supabaseClient } from './supabase-client.js';
import { retrievalService } from './retrieval-service.js';

class ContextBuilderService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Build context for a query
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @param {string} question - User question
     * @param {string} intent - Query intent
     * @returns {Promise<Object>} Context object
     */
    async buildContext(learnerId, courseId, question, intent) {
        // Get current context
        const currentContext = await this.getCurrentContext(learnerId, courseId);
        
        // Get progress context
        const progressContext = await this.getProgressContext(learnerId, courseId);

        // Build context object
        return {
            currentContext,
            progressContext,
            question,
            intent,
            courseId
        };
    }

    /**
     * Get current context (current chapter, day, etc.)
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<Object>} Current context
     */
    async getCurrentContext(learnerId, courseId) {
        // Get most recently accessed content
        const { data: recentProgress } = await supabaseClient
            .from('user_progress')
            .select('*')
            .eq('user_id', learnerId)
            .eq('course_id', courseId)
            .order('last_accessed_at', { ascending: false })
            .limit(1)
            .single();

        if (!recentProgress) {
            return {
                currentChapter: null,
                currentDay: null,
                currentLab: null
            };
        }

        return {
            currentChapter: recentProgress.content_id,
            currentDay: recentProgress.day || null,
            currentLab: recentProgress.lab_id || null
        };
    }

    /**
     * Get progress context (completed chapters, in-progress, etc.)
     * @param {string} learnerId - Learner ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<Object>} Progress context
     */
    async getProgressContext(learnerId, courseId) {
        // Get completed chapters
        const { data: completedChapters } = await supabaseClient
            .from('user_progress')
            .select('content_id, day, chapter_id')
            .eq('user_id', learnerId)
            .eq('course_id', courseId)
            .eq('content_type', 'chapter')
            .not('completed_at', 'is', null);

        // Get in-progress chapters (accessed but not completed)
        const { data: inProgressChapters } = await supabaseClient
            .from('user_progress')
            .select('content_id, day, chapter_id')
            .eq('user_id', learnerId)
            .eq('course_id', courseId)
            .eq('content_type', 'chapter')
            .is('completed_at', null)
            .not('last_accessed_at', 'is', null);

        // Get submitted labs
        const { data: submittedLabs } = await supabaseClient
            .from('lab_submissions')
            .select('lab_id, day')
            .eq('user_id', learnerId)
            .eq('course_id', courseId);

        return {
            completedChapters: (completedChapters || []).map(c => c.content_id || c.chapter_id),
            inProgressChapters: (inProgressChapters || []).map(c => c.content_id || c.chapter_id),
            submittedLabs: (submittedLabs || []).map(l => l.lab_id),
            completedDays: [...new Set((completedChapters || []).map(c => c.day).filter(Boolean))]
        };
    }

    /**
     * Prioritize chunks based on question and progress, with metadata support
     * @param {Array<Object>} chunks - Content chunks
     * @param {string} question - User question
     * @param {Object} progress - Progress context
     * @returns {Array<Object>} Prioritized chunks
     */
    prioritizeChunks(chunks, question, progress) {
        const lowerQuestion = question.toLowerCase();
        
        // Extract topic keywords from question for topic matching
        const questionTopics = this._extractTopicKeywords(question);

        const prioritized = chunks.map(chunk => {
            let priority = chunk.similarity || 0;

            // Get metadata (from chunk.metadata or direct properties)
            const metadata = chunk.metadata || {};
            const coverageLevel = metadata.coverage_level || chunk.coverage_level;
            const completenessScore = metadata.completeness_score ?? chunk.completeness_score ?? 0.5;
            const isDedicatedTopic = metadata.is_dedicated_topic_chapter ?? chunk.is_dedicated_topic_chapter ?? false;
            const primaryTopic = metadata.primary_topic || chunk.primary_topic;

            // HIGHEST PRIORITY: Dedicated topic chapters that match question topic
            if (isDedicatedTopic && primaryTopic) {
                const topicMatch = questionTopics.some(qt => 
                    primaryTopic.toLowerCase().includes(qt) || qt.includes(primaryTopic.toLowerCase())
                );
                if (topicMatch) {
                    priority += 0.5; // Strong boost for dedicated chapters matching topic
                    console.log(`[ContextBuilder] Boosted priority for dedicated topic chapter: ${primaryTopic}`);
                }
            }

            // HIGH PRIORITY: Comprehensive coverage
            if (coverageLevel === 'comprehensive' || coverageLevel === 'advanced') {
                priority += 0.3;
            } else if (coverageLevel === 'intermediate') {
                priority += 0.15;
            } else if (coverageLevel === 'introduction') {
                // Deprioritize introductions when comprehensive coverage exists
                priority -= 0.1;
            }

            // Boost based on completeness score
            if (completenessScore > 0.7) {
                priority += 0.2;
            } else if (completenessScore > 0.5) {
                priority += 0.1;
            } else if (completenessScore < 0.3) {
                priority -= 0.1; // Deprioritize low completeness
            }

            // Boost priority for current chapter
            if (progress.currentChapter && 
                (chunk.chapter_id === progress.currentChapter || 
                 chunk.content_id === progress.currentChapter)) {
                priority += 0.2;
            }

            // Boost priority for completed chapters (for review questions)
            if (progress.completedChapters && 
                progress.completedChapters.includes(chunk.chapter_id)) {
                priority += 0.1;
            }

            // Boost priority for in-progress chapters
            if (progress.inProgressChapters && 
                progress.inProgressChapters.includes(chunk.chapter_id)) {
                priority += 0.15;
            }

            // Boost priority for current day
            if (progress.currentDay && chunk.day === progress.currentDay) {
                priority += 0.1;
            }

            // Boost for exact matches (from Phase 2)
            if (chunk.exactMatch === true) {
                priority += 0.4; // Strong boost for exact matches
            }

            return { ...chunk, priority };
        });

        // Sort by priority
        const sorted = prioritized.sort((a, b) => b.priority - a.priority);

        // Log prioritization results for debugging
        if (sorted.length > 0) {
            const topChunk = sorted[0];
            console.log(`[ContextBuilder] Top prioritized chunk:`, {
                chapter: topChunk.chapter_title || topChunk.chapter_id,
                priority: topChunk.priority.toFixed(2),
                coverage_level: topChunk.metadata?.coverage_level || topChunk.coverage_level,
                is_dedicated: topChunk.metadata?.is_dedicated_topic_chapter || topChunk.is_dedicated_topic_chapter
            });
        }

        return sorted;
    }

    /**
     * Extract topic keywords from question
     * @param {string} question - User question
     * @returns {Array<string>} Topic keywords
     */
    _extractTopicKeywords(question) {
        const lowerQuestion = question.toLowerCase();
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'different', 'difference', 'key', 'elements', 'examples', 'list']);
        
        // Extract significant words (length > 4, not common words)
        const words = lowerQuestion.split(/\s+/)
            .map(w => w.replace(/[^\w]/g, ''))
            .filter(w => w.length > 4 && !commonWords.has(w));
        
        return words;
    }

    /**
     * Filter chunks by access and progress
     * @param {Array<Object>} chunks - Content chunks
     * @param {Object} progress - Progress context
     * @param {string} intent - Query intent
     * @returns {Array<Object>} Filtered chunks
     */
    filterChunksByAccess(chunks, progress, intent) {
        // For navigation questions, allow all chunks
        if (intent === 'navigation') {
            return chunks;
        }

        // For lab guidance, prioritize lab-related chunks and prerequisite chapters
        if (intent === 'lab_guidance' || intent === 'lab_struggle') {
            return chunks.filter(chunk => {
                // Include labs
                if (chunk.content_type === 'lab') {
                    return true;
                }
                // Include completed chapters (prerequisites)
                if (chunk.content_type === 'chapter' && 
                    progress.completedChapters.includes(chunk.chapter_id)) {
                    return true;
                }
                // Include current/in-progress chapters
                if (chunk.content_type === 'chapter' && 
                    progress.inProgressChapters.includes(chunk.chapter_id)) {
                    return true;
                }
                return false;
            });
        }

        // For course content questions, be lenient - allow all chunks
        // This ensures general questions (like "What is SEO?") can find relevant content
        // even if the learner hasn't reached that chapter yet
        const filtered = chunks.filter(chunk => {
            // Always allow overview and completed chapters
            if (chunk.content_type === 'overview') {
                return true;
            }
            if (chunk.content_type === 'chapter' && 
                progress.completedChapters.includes(chunk.chapter_id)) {
                return true;
            }
            // Allow in-progress chapters
            if (chunk.content_type === 'chapter' && 
                progress.inProgressChapters.includes(chunk.chapter_id)) {
                return true;
            }
            // Allow current day chapters
            if (chunk.content_type === 'chapter' && 
                progress.currentDay && chunk.day === progress.currentDay) {
                return true;
            }
            // LENIENT: Allow chapters from early days (Days 1-3) for general questions
            // This helps answer fundamental questions like "What is SEO?"
            if (chunk.content_type === 'chapter' && chunk.day && chunk.day <= 3) {
                return true;
            }
            return false;
        });
        
        // Very lenient fallback: if filtering removed all chunks, return original chunks
        // This ensures we always have some context to work with
        return filtered.length > 0 ? filtered : chunks;
    }

    /**
     * Construct context within token limits
     * @param {Array<Object>} chunks - Content chunks
     * @param {number} maxTokens - Maximum tokens (default: 2000)
     * @returns {Array<Object>} Selected chunks
     */
    constructContextWithinTokenLimit(chunks, maxTokens = 2000) {
        const selected = [];
        let totalTokens = 0;

        console.log(`[ContextBuilder] constructContextWithinTokenLimit: ${chunks.length} chunks, maxTokens: ${maxTokens}`);
        
        // Log sample chunk data for debugging
        if (chunks.length > 0) {
            const sampleChunk = chunks[0];
            console.log(`[ContextBuilder] Sample chunk:`, {
                id: sampleChunk.id,
                token_count: sampleChunk.token_count,
                content_length: sampleChunk.content?.length,
                has_content: !!sampleChunk.content
            });
        }

        for (const chunk of chunks) {
            // Calculate token count - use token_count if available, otherwise estimate
            let chunkTokens = chunk.token_count;
            
            // If token_count is missing, null, 0, or invalid, estimate from content
            if (!chunkTokens || chunkTokens === 0 || isNaN(chunkTokens)) {
                // Estimate: ~4 characters per token
                const contentLength = chunk.content?.length || 0;
                if (contentLength > 0) {
                    chunkTokens = Math.ceil(contentLength / 4);
                } else {
                    // If no content either, use a reasonable default
                    chunkTokens = 200; // Default chunk size
                }
            }
            
            // Ensure chunkTokens is a valid positive number
            if (isNaN(chunkTokens) || chunkTokens <= 0) {
                console.warn(`[ContextBuilder] Invalid token_count for chunk ${chunk.id}, using default 200`);
                chunkTokens = 200; // Default to 200 tokens if calculation fails
            }

            // Always include at least the first chunk, even if it exceeds limit
            if (selected.length === 0) {
                selected.push(chunk);
                totalTokens = chunkTokens;
                continue;
            }

            // For subsequent chunks, check if they fit
            if (totalTokens + chunkTokens <= maxTokens) {
                selected.push(chunk);
                totalTokens += chunkTokens;
            } else {
                break;
            }
        }

        console.log(`[ContextBuilder] Selected ${selected.length} chunks, total tokens: ${totalTokens}`);
        
        // Very lenient fallback: if no chunks selected, return at least the first chunk
        if (selected.length === 0 && chunks.length > 0) {
            console.warn(`[ContextBuilder] No chunks fit within token limit, returning first chunk anyway`);
            return [chunks[0]];
        }

        return selected;
    }
}

export const contextBuilderService = new ContextBuilderService();

