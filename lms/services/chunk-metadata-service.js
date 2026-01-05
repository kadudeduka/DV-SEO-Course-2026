/**
 * Chunk Metadata Service
 * 
 * Analyzes content chunks to extract metadata:
 * - Coverage level (introduction, intermediate, comprehensive, advanced)
 * - Completeness score
 * - Primary/secondary topics
 * - Dedicated chapter status
 * - Structured references
 */

import { llmService } from './llm-service.js';

class ChunkMetadataService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Analyze chunk and extract metadata
     * @param {Object} chunk - Content chunk
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Extracted metadata
     */
    async analyzeChunk(chunk, options = {}) {
        const {
            useLLM = false, // Use LLM for analysis (more accurate but slower)
            compareWithOtherChunks = false // Compare with other chunks covering same topic
        } = options;

        const metadata = {
            coverage_level: null,
            completeness_score: null,
            is_dedicated_topic_chapter: false,
            primary_topic: null,
            secondary_topics: [],
            step_number: null
        };

        // Extract structured references
        metadata.step_number = this._extractStepNumber(chunk);

        // Calculate completeness score (heuristic-based)
        metadata.completeness_score = this._calculateCompletenessScore(chunk);

        // Determine coverage level based on heuristics
        metadata.coverage_level = this._determineCoverageLevel(chunk, metadata.completeness_score);

        // Extract topics (heuristic-based)
        const topics = this._extractTopics(chunk);
        metadata.primary_topic = topics.primary;
        metadata.secondary_topics = topics.secondary;

        // Determine if dedicated topic chapter
        metadata.is_dedicated_topic_chapter = this._isDedicatedTopicChapter(chunk, topics);

        // Use LLM for more accurate analysis if requested
        if (useLLM && llmService.apiKey) {
            try {
                const llmMetadata = await this._analyzeWithLLM(chunk, metadata);
                // Merge LLM results with heuristic results
                return { ...metadata, ...llmMetadata };
            } catch (error) {
                console.warn('[ChunkMetadataService] LLM analysis failed, using heuristic results:', error);
            }
        }

        return metadata;
    }

    /**
     * Extract step number from chunk
     * @param {Object} chunk - Content chunk
     * @returns {number|null} Step number
     */
    _extractStepNumber(chunk) {
        if (!chunk.content) return null;

        // Look for step patterns in content
        const stepMatch = chunk.content.match(/step\s*(\d+)/i);
        if (stepMatch) {
            return parseInt(stepMatch[1]);
        }

        // Check metadata if available
        if (chunk.metadata && chunk.metadata.step_number) {
            return chunk.metadata.step_number;
        }

        return null;
    }

    /**
     * Calculate completeness score (0-1)
     * @param {Object} chunk - Content chunk
     * @returns {number} Completeness score
     */
    _calculateCompletenessScore(chunk) {
        let score = 0;
        const content = chunk.content || '';
        const contentLength = content.length;

        // Base score from content length (normalized)
        // Assume average comprehensive chunk is ~2000-3000 chars
        const normalizedLength = Math.min(contentLength / 2500, 1);
        score += normalizedLength * 0.3;

        // Check for structural elements (indicates comprehensive coverage)
        const hasHeadings = /^#{1,3}\s/m.test(content);
        const hasLists = /^[-*•]\s|^\d+\.\s/m.test(content);
        const hasExamples = /example|for instance|such as/i.test(content);
        const hasDetails = /details?|specifically|in detail/i.test(content);
        const hasComparisons = /versus|vs\.|compared to|difference/i.test(content);

        if (hasHeadings) score += 0.15;
        if (hasLists) score += 0.1;
        if (hasExamples) score += 0.15;
        if (hasDetails) score += 0.1;
        if (hasComparisons) score += 0.1;

        // Check for comprehensive indicators
        const comprehensiveIndicators = [
            'comprehensive',
            'complete',
            'thorough',
            'in depth',
            'detailed',
            'extensive'
        ];
        const hasComprehensiveLanguage = comprehensiveIndicators.some(indicator => 
            content.toLowerCase().includes(indicator)
        );
        if (hasComprehensiveLanguage) score += 0.1;

        return Math.min(score, 1.0);
    }

    /**
     * Determine coverage level
     * @param {Object} chunk - Content chunk
     * @param {number} completenessScore - Completeness score
     * @returns {string} Coverage level
     */
    _determineCoverageLevel(chunk, completenessScore) {
        const content = (chunk.content || '').toLowerCase();
        const chapterTitle = (chunk.chapter_title || '').toLowerCase();

        // Check for introduction/glossary indicators
        const introIndicators = ['introduction', 'overview', 'basics', 'fundamentals', 'getting started', 'terms', 'glossary'];
        if (introIndicators.some(indicator => chapterTitle.includes(indicator) || content.includes(indicator))) {
            return 'introduction';
        }

        // Check for advanced indicators
        const advancedIndicators = ['advanced', 'expert', 'master', 'deep dive', 'advanced techniques'];
        if (advancedIndicators.some(indicator => chapterTitle.includes(indicator) || content.includes(indicator))) {
            return 'advanced';
        }

        // Use completeness score to determine level
        if (completenessScore >= 0.7) {
            return 'comprehensive';
        } else if (completenessScore >= 0.4) {
            return 'intermediate';
        } else {
            return 'introduction';
        }
    }

    /**
     * Extract topics from chunk
     * @param {Object} chunk - Content chunk
     * @returns {Object} Primary and secondary topics
     */
    _extractTopics(chunk) {
        const content = (chunk.content || '').toLowerCase();
        const chapterTitle = (chunk.chapter_title || '').toLowerCase();

        // Extract primary topic from chapter title
        let primaryTopic = null;
        
        // Common topic patterns in chapter titles
        const topicPatterns = [
            /(?:about|on|for|guide to|introduction to)\s+([^:—\-]+)/i,
            /^([^:—\-]+?)(?:\s*[:—\-]|$)/i
        ];

        for (const pattern of topicPatterns) {
            const match = chapterTitle.match(pattern);
            if (match && match[1]) {
                primaryTopic = match[1].trim();
                // Clean up common prefixes
                primaryTopic = primaryTopic.replace(/^(the|a|an)\s+/i, '').trim();
                break;
            }
        }

        // If no pattern match, use chapter title as primary topic
        if (!primaryTopic && chapterTitle) {
            primaryTopic = chapterTitle.split(/[:—\-]/)[0].trim();
        }

        // Extract secondary topics from content (keywords that appear frequently)
        const secondaryTopics = [];
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);
        
        const words = content.split(/\s+/)
            .map(w => w.toLowerCase().replace(/[^\w]/g, ''))
            .filter(w => w.length > 4 && !commonWords.has(w));
        
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        // Get top 5 most frequent words as secondary topics
        const sortedWords = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
        
        secondaryTopics.push(...sortedWords);

        return {
            primary: primaryTopic,
            secondary: secondaryTopics
        };
    }

    /**
     * Determine if chunk is from a dedicated topic chapter
     * @param {Object} chunk - Content chunk
     * @param {Object} topics - Extracted topics
     * @returns {boolean} True if dedicated topic chapter
     */
    _isDedicatedTopicChapter(chunk, topics) {
        const chapterTitle = (chunk.chapter_title || '').toLowerCase();
        const primaryTopic = (topics.primary || '').toLowerCase();

        // If chapter title matches primary topic closely, it's likely dedicated
        if (primaryTopic && chapterTitle.includes(primaryTopic)) {
            return true;
        }

        // Check for dedicated chapter indicators
        const dedicatedIndicators = [
            'complete guide',
            'comprehensive',
            'deep dive',
            'everything about',
            'guide to',
            'mastering'
        ];

        return dedicatedIndicators.some(indicator => chapterTitle.includes(indicator));
    }

    /**
     * Analyze chunk with LLM for more accurate metadata
     * @param {Object} chunk - Content chunk
     * @param {Object} heuristicMetadata - Heuristic-based metadata
     * @returns {Promise<Object>} LLM-analyzed metadata
     */
    async _analyzeWithLLM(chunk, heuristicMetadata) {
        if (!llmService.apiKey) {
            return heuristicMetadata;
        }

        try {
            const prompt = `Analyze this course content chunk and provide metadata:

Chapter: ${chunk.chapter_title || chunk.chapter_id}
Content: ${(chunk.content || '').substring(0, 1000)}

Provide JSON with:
- coverage_level: "introduction", "intermediate", "comprehensive", or "advanced"
- completeness_score: 0-1 (how completely does this cover the topic)
- is_dedicated_topic_chapter: true/false (is this chapter primarily about one specific topic)
- primary_topic: main topic of this chapter
- secondary_topics: array of other topics mentioned

Respond with ONLY valid JSON.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${llmService.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are a content analyzer. Respond with only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                throw new Error(`LLM API error: ${response.statusText}`);
            }

            const data = await response.json();
            const llmResponse = data.choices[0].message.content.trim();
            
            // Parse JSON response
            const llmMetadata = JSON.parse(llmResponse);
            
            return {
                coverage_level: llmMetadata.coverage_level || heuristicMetadata.coverage_level,
                completeness_score: llmMetadata.completeness_score ?? heuristicMetadata.completeness_score,
                is_dedicated_topic_chapter: llmMetadata.is_dedicated_topic_chapter ?? heuristicMetadata.is_dedicated_topic_chapter,
                primary_topic: llmMetadata.primary_topic || heuristicMetadata.primary_topic,
                secondary_topics: llmMetadata.secondary_topics || heuristicMetadata.secondary_topics
            };
        } catch (error) {
            console.error('[ChunkMetadataService] Error in LLM analysis:', error);
            return heuristicMetadata;
        }
    }

    /**
     * Batch analyze chunks
     * @param {Array<Object>} chunks - Array of chunks
     * @param {Object} options - Analysis options
     * @returns {Promise<Array<Object>>} Chunks with metadata
     */
    async analyzeChunks(chunks, options = {}) {
        const results = await Promise.all(
            chunks.map(chunk => this.analyzeChunk(chunk, options))
        );

        return chunks.map((chunk, index) => ({
            ...chunk,
            metadata: {
                ...(chunk.metadata || {}),
                ...results[index]
            }
        }));
    }
}

export const chunkMetadataService = new ChunkMetadataService();

