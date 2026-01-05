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
            // Start with similarity, but dedicated chapters get minimum priority floor
            let priority = chunk.similarity || 0;
            
            // CRITICAL: Dedicated chapters that match topic get minimum priority of 2.0
            // This ensures they ALWAYS rank above non-dedicated chapters regardless of similarity
            const isDedicatedMatch = chunk.isDedicatedTopicMatch === true || 
                                     (chunk.is_dedicated_topic_chapter && chunk.primary_topic);
            if (isDedicatedMatch) {
                // Check if it matches the question topic
                const primaryTopic = chunk.primary_topic || chunk.metadata?.primary_topic || '';
                if (primaryTopic) {
                    const topicMatch = questionTopics.some(qt => {
                        const qtLower = qt.toLowerCase();
                        const ptLower = primaryTopic.toLowerCase();
                        return ptLower.includes(qtLower) || qtLower.includes(ptLower) ||
                               primaryTopic.toLowerCase().split(/\s+/).some(pw => 
                                   questionTopics.some(qt2 => qt2.includes(pw) || pw.includes(qt2))
                               );
                    });
                    if (topicMatch) {
                        // Set minimum priority to ensure dedicated chapters always win
                        priority = Math.max(priority, 2.0);
                        console.log(`[ContextBuilder] Dedicated chapter priority floor set to 2.0: ${primaryTopic}`);
                    }
                }
            }

            // Get metadata (from chunk.metadata or direct properties)
            const metadata = chunk.metadata || {};
            const coverageLevel = metadata.coverage_level || chunk.coverage_level;
            const completenessScore = metadata.completeness_score ?? chunk.completeness_score ?? 0.5;
            const isDedicatedTopic = metadata.is_dedicated_topic_chapter ?? chunk.is_dedicated_topic_chapter ?? false;
            const primaryTopic = metadata.primary_topic || chunk.primary_topic;

            // HIGHEST PRIORITY: Dedicated topic chapters that match question topic
            if (isDedicatedTopic && primaryTopic) {
                const primaryTopicLower = primaryTopic.toLowerCase();
                
                // Enhanced topic matching:
                // 1. Exact match or contains match
                // 2. Word-by-word matching (e.g., "answer engine optimization" matches "answer", "engine", "optimization")
                // 3. Acronym matching (e.g., "AEO" matches "answer engine optimization")
                // 4. Partial phrase matching
                const topicMatch = questionTopics.some(qt => {
                    const qtLower = qt.toLowerCase();
                    
                    // Exact or contains match
                    if (primaryTopicLower.includes(qtLower) || qtLower.includes(primaryTopicLower)) {
                        return true;
                    }
                    
                    // Word-by-word matching: check if all significant words from primary topic appear in question topics
                    const primaryWords = primaryTopicLower.split(/\s+/).filter(w => w.length > 3);
                    const allWordsMatch = primaryWords.every(pw => 
                        questionTopics.some(qt2 => qt2.includes(pw) || pw.includes(qt2))
                    );
                    if (allWordsMatch && primaryWords.length >= 2) {
                        return true;
                    }
                    
                    // Acronym expansion: if question has acronym, check if primary topic words match
                    // e.g., "aeo" -> check if "answer engine optimization" words are in question
                    if (qtLower.length <= 5 && /^[a-z]+$/.test(qtLower)) {
                        // Might be an acronym, check if primary topic words are in question
                        const primaryWordsInQuestion = primaryWords.some(pw => 
                            lowerQuestion.includes(pw)
                        );
                        if (primaryWordsInQuestion) {
                            return true;
                        }
                    }
                    
                    return false;
                });
                
                if (topicMatch) {
                    priority += 1.0; // STRONG boost for dedicated chapters matching topic (increased from 0.5)
                    console.log(`[ContextBuilder] Boosted priority (+1.0) for dedicated topic chapter: ${primaryTopic}`);
                }
            }

            // HIGH PRIORITY: Comprehensive coverage
            if (coverageLevel === 'comprehensive' || coverageLevel === 'advanced') {
                priority += 0.4; // Increased from 0.3
            } else if (coverageLevel === 'intermediate') {
                priority += 0.15;
            } else if (coverageLevel === 'introduction') {
                // STRONG deprioritization for introductions when comprehensive coverage exists
                // Check if there are comprehensive chunks in the results
                const hasComprehensiveChunks = chunks.some(c => {
                    const cCoverage = c.metadata?.coverage_level || c.coverage_level;
                    return cCoverage === 'comprehensive' || cCoverage === 'advanced';
                });
                if (hasComprehensiveChunks) {
                    priority -= 0.3; // Increased deprioritization from -0.1 to -0.3
                } else {
                    priority -= 0.1;
                }
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

            // Boost for dedicated chapter matches from topic search
            if (chunk.isDedicatedTopicMatch === true) {
                priority += 0.6; // Additional boost for dedicated chapters found via topic search
                console.log(`[ContextBuilder] Additional boost (+0.6) for dedicated topic match: ${primaryTopic || chunk.chapter_title}`);
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
     * Recognizes multi-word topics, acronyms, and technical terms
     * @param {string} question - User question
     * @returns {Array<string>} Topic keywords and phrases
     */
    extractTopicKeywords(question) {
        return this._extractTopicKeywords(question);
    }

    /**
     * Internal method for topic extraction
     * @private
     */
    _extractTopicKeywords(question) {
        const lowerQuestion = question.toLowerCase();
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
            if (lowerQuestion.includes(phrase)) {
                topics.push(phrase);
                // Also add individual significant words from the phrase
                const phraseWords = phrase.split(/\s+/).filter(w => w.length > 3 && !commonWords.has(w));
                topics.push(...phraseWords);
            }
        }
        
        // 2. Extract acronyms (2-5 uppercase letters, possibly with periods)
        const acronymPattern = /\b([A-Z]{2,5}(?:\.[A-Z]{2,5})*)\b/g;
        const acronyms = lowerQuestion.match(acronymPattern);
        if (acronyms) {
            topics.push(...acronyms.map(a => a.toLowerCase().replace(/\./g, '')));
        }
        
        // 3. Extract significant individual words (length > 3, not common words)
        const words = lowerQuestion.split(/\s+/)
            .map(w => w.replace(/[^\w]/g, ''))
            .filter(w => w.length > 3 && !commonWords.has(w) && !topics.includes(w));
        
        topics.push(...words);
        
        // 4. Remove duplicates and return
        return [...new Set(topics)];
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
        
        // TWO-PHASE SELECTION: Dedicated chapters first, then others
        // This ensures dedicated chapters are ALWAYS included if they match the topic
        
        // Phase 1: Separate dedicated chapters from others
        const dedicatedChunks = [];
        const otherChunks = [];
        
        for (const chunk of chunks) {
            const isDedicated = chunk.is_dedicated_topic_chapter || 
                               chunk.metadata?.is_dedicated_topic_chapter ||
                               chunk.isDedicatedTopicMatch === true;
            
            if (isDedicated) {
                dedicatedChunks.push(chunk);
            } else {
                otherChunks.push(chunk);
            }
        }
        
        console.log(`[ContextBuilder] Separated chunks: ${dedicatedChunks.length} dedicated, ${otherChunks.length} others`);
        
        // Phase 2: Select dedicated chapters first (ALWAYS include if they fit)
        const selectChunks = (chunkList, reservedTokens = 0) => {
            const selectedFromList = [];
            let tokensUsed = 0;
            
            for (const chunk of chunkList) {
                // Calculate token count
                let chunkTokens = chunk.token_count;
                
                if (!chunkTokens || chunkTokens === 0 || isNaN(chunkTokens)) {
                    const contentLength = chunk.content?.length || 0;
                    if (contentLength > 0) {
                        chunkTokens = Math.ceil(contentLength / 4);
                    } else {
                        chunkTokens = 200;
                    }
                }
                
                if (isNaN(chunkTokens) || chunkTokens <= 0) {
                    chunkTokens = 200;
                }
                
                // Check if chunk fits (accounting for reserved tokens for other chunks)
                const availableTokens = maxTokens - reservedTokens;
                if (tokensUsed + chunkTokens <= availableTokens) {
                    selectedFromList.push(chunk);
                    tokensUsed += chunkTokens;
                } else {
                    // For dedicated chapters, try to include at least one even if it exceeds limit slightly
                    if (selectedFromList.length === 0 && reservedTokens === 0) {
                        selectedFromList.push(chunk);
                        tokensUsed = chunkTokens;
                        break;
                    }
                }
            }
            
            return { selected: selectedFromList, tokensUsed };
        };
        
        // First, select dedicated chapters (they get priority)
        const dedicatedResult = selectChunks(dedicatedChunks, 0);
        selected.push(...dedicatedResult.selected);
        totalTokens = dedicatedResult.tokensUsed;
        
        console.log(`[ContextBuilder] Selected ${dedicatedResult.selected.length} dedicated chunks, ${totalTokens} tokens used`);
        
        // Then, select other chunks with remaining token budget
        const remainingTokens = maxTokens - totalTokens;
        if (remainingTokens > 0 && otherChunks.length > 0) {
            const otherResult = selectChunks(otherChunks, 0);
            // Only add other chunks if we have space
            for (const chunk of otherResult.selected) {
                let chunkTokens = chunk.token_count;
                if (!chunkTokens || chunkTokens === 0 || isNaN(chunkTokens)) {
                    const contentLength = chunk.content?.length || 0;
                    chunkTokens = contentLength > 0 ? Math.ceil(contentLength / 4) : 200;
                }
                if (isNaN(chunkTokens) || chunkTokens <= 0) {
                    chunkTokens = 200;
                }
                
                if (totalTokens + chunkTokens <= maxTokens) {
                    selected.push(chunk);
                    totalTokens += chunkTokens;
                } else {
                    break;
                }
            }
        }
        
        // If no dedicated chunks were selected but we have other chunks, fall back to normal selection
        if (selected.length === 0 && otherChunks.length > 0) {
            console.log('[ContextBuilder] No dedicated chunks selected, using normal selection');
            const allChunks = [...dedicatedChunks, ...otherChunks];
            for (const chunk of allChunks) {
                let chunkTokens = chunk.token_count;
                if (!chunkTokens || chunkTokens === 0 || isNaN(chunkTokens)) {
                    const contentLength = chunk.content?.length || 0;
                    chunkTokens = contentLength > 0 ? Math.ceil(contentLength / 4) : 200;
                }
                if (isNaN(chunkTokens) || chunkTokens <= 0) {
                    chunkTokens = 200;
                }
                
                if (selected.length === 0) {
                    selected.push(chunk);
                    totalTokens = chunkTokens;
                } else if (totalTokens + chunkTokens <= maxTokens) {
                    selected.push(chunk);
                    totalTokens += chunkTokens;
                } else {
                    break;
                }
            }
        }

        console.log(`[ContextBuilder] Selected ${selected.length} chunks (${dedicatedResult.selected.length} dedicated), total tokens: ${totalTokens}`);
        
        // Very lenient fallback: if no chunks selected, return at least the first chunk
        if (selected.length === 0 && chunks.length > 0) {
            console.warn(`[ContextBuilder] No chunks fit within token limit, returning first chunk anyway`);
            return [chunks[0]];
        }

        return selected;
    }
}

export const contextBuilderService = new ContextBuilderService();

