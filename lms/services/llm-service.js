/**
 * LLM Service
 * 
 * Handles integration with OpenAI API for answer generation,
 * intent classification, and confidence estimation.
 */

import { supabaseClient } from './supabase-client.js';

class LLMService {
    constructor() {
        // Try multiple sources for API key
        let apiKey = null;
        
        // Check environment variables (Node.js)
        if (typeof process !== 'undefined' && process.env) {
            apiKey = process.env.OPENAI_API_KEY || 
                     process.env.VITE_OPENAI_API_KEY || 
                     apiKey;
        }
        
        // Check import.meta.env (for Vite builds)
        try {
            if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY) {
                apiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
            }
        } catch (e) {
            // import.meta not available, continue
        }
        
        // Check window.LMS_CONFIG (browser config)
        if (!apiKey && typeof window !== 'undefined' && window.LMS_CONFIG?.OPENAI_API_KEY) {
            apiKey = window.LMS_CONFIG.OPENAI_API_KEY;
        }
        
        // For Node.js: Try loading from config file if not found (deferred, since we can't use top-level await in constructor)
        // Note: This will be done lazily if needed, but primarily we rely on environment variables for Node.js
        
        this.apiKey = apiKey;
        this.baseURL = 'https://api.openai.com/v1';
        this.cache = new Map();
        
        if (!this.apiKey) {
            console.warn('[LLMService] OpenAI API key not found. AI Coach will not work.');
            console.warn('[LLMService] Tried: process.env.OPENAI_API_KEY, window.LMS_CONFIG, config/app.config.local.js');
        }
    }

    /**
     * Generate embedding for text using OpenAI
     * @param {string} text - Text to embed
     * @returns {Promise<Array<number>>} Embedding vector
     */
    async generateEmbedding(text) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const cacheKey = `embedding_${text.substring(0, 100)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseURL}/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: text
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const embedding = data.data[0].embedding;

            // Cache embedding
            this.cache.set(cacheKey, embedding);
            return embedding;
        } catch (error) {
            console.error('[LLMService] Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings in batch
     * @param {Array<string>} texts - Array of texts to embed
     * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
     */
    async generateEmbeddingsBatch(texts) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const response = await fetch(`${this.baseURL}/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: texts
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.data.map(item => item.embedding);
        } catch (error) {
            console.error('[LLMService] Error generating batch embeddings:', error);
            throw error;
        }
    }

    /**
     * Classify intent of a query using GPT-3.5-turbo (cheap model)
     * @param {string} question - User question
     * @param {Object} context - Context information
     * @returns {Promise<string>} Intent classification
     */
    async classifyIntent(question, context = {}) {
        if (!this.apiKey) {
            // Fallback to simple keyword-based classification
            return this._classifyIntentFallback(question);
        }

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an intent classifier for an SEO course LMS. Classify the user's question into one of these categories:

- course_content: Questions about course material, concepts, definitions, strategies, how-to questions about SEO/AEO topics. This includes questions like "What is X?", "How to do X?", "What are the differences for X?", etc. where X is an SEO/AEO concept.

- list_request: Questions asking to "list", "enumerate", "show all", "what are all" items/examples from a chapter

- navigation: Questions about course structure, where to find content, how to navigate

- lab_guidance: Questions about labs, assignments, exercises (NOT asking for answers)

- lab_struggle: Indications of struggling with labs (stuck, help, don't understand)

- out_of_scope: Questions completely unrelated to SEO, AEO, digital marketing, or course content (e.g., "What's the weather?", "How to cook pasta?")

IMPORTANT RULES:
1. If the question mentions SEO, AEO, Answer Engine Optimization, keywords, SERP, search engines, or any digital marketing concept, classify as "course_content" NOT "out_of_scope"
2. "How to" questions about SEO/AEO topics should be "course_content", not "out_of_scope"
3. Only classify as "out_of_scope" if the question is clearly unrelated to the course domain

Respond with ONLY the category name.`
                        },
                        {
                            role: 'user',
                            content: `Question: ${question}\nContext: ${JSON.stringify(context)}`
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 10
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const intent = data.choices[0].message.content.trim().toLowerCase();
            
            // Validate intent
            const validIntents = ['course_content', 'list_request', 'navigation', 'lab_guidance', 'lab_struggle', 'out_of_scope'];
            return validIntents.includes(intent) ? intent : 'course_content';
        } catch (error) {
            console.error('[LLMService] Error classifying intent:', error);
            return this._classifyIntentFallback(question);
        }
    }

    /**
     * Fallback intent classification using keywords
     * @param {string} question - User question
     * @returns {string} Intent classification
     */
    _classifyIntentFallback(question) {
        const lowerQuestion = question.toLowerCase();
        
        // SEO/AEO topic keywords - if present, classify as course_content (not out_of_scope)
        const seoTopicKeywords = [
            'seo', 'aeo', 'answer engine', 'search engine', 'serp', 'keyword', 
            'optimization', 'ranking', 'content', 'link', 'backlink', 
            'technical seo', 'on-page', 'off-page', 'ecommerce seo',
            'local seo', 'mobile seo', 'voice search', 'featured snippet',
            'schema', 'structured data', 'canonical', 'robots.txt', 'sitemap',
            'crawl', 'index', 'meta tag', 'heading', 'anchor', 'internal link',
            'external link', 'domain authority', 'page authority', 'core web vitals'
        ];
        
        // Check if question contains SEO/AEO topics
        const hasSEOTopic = seoTopicKeywords.some(keyword => lowerQuestion.includes(keyword));
        
        // List request indicators
        const listKeywords = ['list', 'enumerate', 'show all', 'what are all', 'list all', 'list the', 'list examples'];
        if (listKeywords.some(keyword => lowerQuestion.includes(keyword))) {
            return 'list_request';
        }
        
        // Lab struggle indicators
        const struggleKeywords = ['stuck', 'help', "don't understand", "can't", 'what should i do'];
        if (struggleKeywords.some(keyword => lowerQuestion.includes(keyword))) {
            if (lowerQuestion.includes('lab') || lowerQuestion.includes('assignment')) {
                return 'lab_struggle';
            }
        }
        
        // Lab guidance
        if (lowerQuestion.includes('lab') || lowerQuestion.includes('assignment') || lowerQuestion.includes('exercise')) {
            return 'lab_guidance';
        }
        
        // "How to" questions about SEO/AEO topics should be course_content
        if ((lowerQuestion.includes('how to') || lowerQuestion.includes('how do')) && hasSEOTopic) {
            return 'course_content';
        }
        
        // If question contains SEO/AEO topics, default to course_content (not out_of_scope)
        if (hasSEOTopic) {
            return 'course_content';
        }
        
        // Navigation
        if (lowerQuestion.includes('where') || lowerQuestion.includes('how to find') || lowerQuestion.includes('navigate')) {
            return 'navigation';
        }
        
        // Default to course content
        return 'course_content';
    }

    /**
     * Generate answer from context using GPT-4o-mini or GPT-4-turbo
     * @param {string} question - User question
     * @param {Array<Object>} contextChunks - Relevant content chunks
     * @param {Object} systemPrompt - System prompt configuration
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response with answer, confidence, and metadata
     */
    async generateAnswer(question, contextChunks, systemPrompt, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const {
            model = 'gpt-4o-mini',
            temperature = 0.3,
            maxTokens = 500,
            isLabGuidance = false,
            labStruggleContext = null
        } = options;

        // Build context string from chunks
        const contextString = contextChunks.map((chunk, index) => {
            return `[Chunk ${index + 1}]\nDay: ${chunk.day || 'N/A'}\nChapter: ${chunk.chapter_title || chunk.chapter_id}\nContent: ${chunk.content}`;
        }).join('\n\n');

        // Build system prompt
        let fullSystemPrompt = systemPrompt.base || `You are an AI Coach for Digital Vidya's LMS. Your role is to help learners understand course content.`;
        
        // Add trainer personalization if available
        if (systemPrompt.trainerPersonalization) {
            fullSystemPrompt += `\n\n${systemPrompt.trainerPersonalization}`;
        }
        
        // Add lab guidance rules if needed
        if (isLabGuidance) {
            fullSystemPrompt += `\n\nLAB GUIDANCE RULES (CRITICAL):
- NEVER provide direct answers, solutions, or code
- Guide learners to understand concepts, not solve problems
- Reference course chapters that cover the lab topic
- Suggest breaking down the problem into steps
- Encourage review of prerequisites
- Example good response: "Review Day 2 → Chapter 3 on [topic]. This lab tests your understanding of [concept]. Consider: 1) What is the goal? 2) What concepts apply? 3) How can you apply them?"
- Example bad response: "The answer is X" or "You should do Y"`;
            
            if (labStruggleContext) {
                fullSystemPrompt += `\n\nLEARNER IS STRUGGLING WITH LABS:
- Multiple attempts: ${labStruggleContext.attempts || 0}
- Average score: ${labStruggleContext.averageScore || 0}%
- Be extra supportive and encouraging
- Provide clear guidance without solving
- Suggest reviewing fundamentals`;
            }
        }
        
        // Add comprehensive response instructions
        fullSystemPrompt += `\n\nRESPONSE STYLE:
- Be CONCISE: Get to the point quickly, avoid unnecessary words
- Be COMPLETE: Answer fully, don't leave gaps - expand on course content when needed
- Be RELEVANT: Focus on what was asked, exclude unrelated details
- Optimal length: 50-300 words (adjust based on question complexity - comprehensive questions may need more)
- Structure: Direct Answer → Key Points (point-based) → Next Steps (if relevant)
- Use bullet points for lists and structured formatting
- Avoid filler words and repetition
- For "how-to" questions: Provide concise, point-based steps highlighting key actions
- For "list" requests: Extract and enumerate ALL items from the specified chapter (not just a summary)
- Exclude lab assignment logistics (documentation, submission templates, assignment steps) unless explicitly asked
- Distinguish between conceptual questions (explain concept) and lab questions (provide lab guidance)
- When a specific chapter is mentioned, extract content ONLY from that chapter
- CRITICAL REFERENCE RULE: Do NOT include any chapter, day, or lab references in your answer (e.g., "Day X → Chapter Y", "Chapter X", "Lab Y", "D1.C1.S3"). The system will automatically add references based on the content you use. Do NOT use phrases like "refer to", "see Chapter X", "as mentioned in Day Y".`;

        const messages = [
            { role: 'system', content: fullSystemPrompt },
            {
                role: 'user',
                content: `Question: ${question}\n\nContext from course:\n${contextString}\n\nAnswer the question using only the provided context. Do NOT include any chapter, day, or lab references in your answer.`
            }
        ];

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            let answer = data.choices[0].message.content;
            const tokensUsed = data.usage.total_tokens;

            // CRITICAL: Strip any references that the LLM may have generated
            answer = this._stripLLMReferences(answer);

            // Calculate confidence score
            const confidence = await this.estimateConfidence(question, contextChunks, answer);

            // Validate response (check for direct lab answers if lab guidance)
            if (isLabGuidance) {
                const hasDirectAnswer = this._checkForDirectAnswer(answer);
                if (hasDirectAnswer) {
                    throw new Error('Response contains direct answer. Regenerate with guidance only.');
                }
            }

            // Count words for conciseness tracking
            const wordCount = answer.split(/\s+/).length;

            return {
                answer,
                confidence,
                tokensUsed,
                modelUsed: model,
                wordCount
            };
        } catch (error) {
            console.error('[LLMService] Error generating answer:', error);
            throw error;
        }
    }

    /**
     * Estimate confidence score for an answer
     * @param {string} question - Original question
     * @param {Array<Object>} contextChunks - Context chunks used
     * @param {string} answer - Generated answer
     * @param {Object} adjustmentFactors - Optional adjustment factors for confidence
     * @param {number} adjustmentFactors.referenceIntegrity - Reference integrity score (0-1)
     * @param {number} adjustmentFactors.topicSpecificity - Topic specificity score (0-1)
     * @param {number} adjustmentFactors.chunkAgreement - Chunk agreement score (0-1)
     * @returns {Promise<number>} Confidence score (0-1)
     */
    async estimateConfidence(question, contextChunks, answer, adjustmentFactors = {}) {
        if (!this.apiKey || contextChunks.length === 0) {
            // Fallback: simple heuristic
            const baseConfidence = contextChunks.length > 0 ? 0.7 : 0.3;
            // Apply adjustments if provided
            if (Object.keys(adjustmentFactors).length > 0) {
                return this._applyConfidenceAdjustments(baseConfidence, adjustmentFactors);
            }
            return baseConfidence;
        }

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a confidence estimator. Rate how confident the answer is based on the question and context. Respond with a number between 0 and 1.'
                        },
                        {
                            role: 'user',
                            content: `Question: ${question}\nAnswer: ${answer}\nContext chunks used: ${contextChunks.length}\n\nRate confidence (0-1):`
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 10
                })
            });

            if (!response.ok) {
                const baseConfidence = 0.7; // Default confidence
                return this._applyConfidenceAdjustments(baseConfidence, adjustmentFactors);
            }

            const data = await response.json();
            let confidence = parseFloat(data.choices[0].message.content.trim());
            
            // Validate and clamp
            if (isNaN(confidence)) {
                confidence = 0.7;
            }
            confidence = Math.max(0, Math.min(1, confidence));

            // Apply adjustments based on reference integrity, topic specificity, chunk agreement
            if (Object.keys(adjustmentFactors).length > 0) {
                confidence = this._applyConfidenceAdjustments(confidence, adjustmentFactors);
            }

            return confidence;
        } catch (error) {
            console.error('[LLMService] Error estimating confidence:', error);
            const baseConfidence = 0.7; // Default confidence
            return this._applyConfidenceAdjustments(baseConfidence, adjustmentFactors);
        }
    }

    /**
     * Apply confidence adjustments based on reference integrity, topic specificity, and chunk agreement
     * @param {number} baseConfidence - Base confidence score (0-1)
     * @param {Object} adjustmentFactors - Adjustment factors
     * @param {number} adjustmentFactors.referenceIntegrity - Reference integrity score (0-1)
     * @param {number} adjustmentFactors.topicSpecificity - Topic specificity score (0-1)
     * @param {number} adjustmentFactors.chunkAgreement - Chunk agreement score (0-1)
     * @returns {number} Adjusted confidence score (0-1)
     * @private
     */
    _applyConfidenceAdjustments(baseConfidence, adjustmentFactors) {
        let adjustedConfidence = baseConfidence;
        const weights = {
            referenceIntegrity: 0.4,  // 40% weight - most important
            topicSpecificity: 0.35,   // 35% weight
            chunkAgreement: 0.25      // 25% weight
        };

        // Calculate weighted adjustment
        let totalAdjustment = 0;
        let totalWeight = 0;

        if (adjustmentFactors.referenceIntegrity !== undefined) {
            const integrityScore = adjustmentFactors.referenceIntegrity;
            const adjustment = (integrityScore - 0.5) * 0.3; // Scale: -0.15 to +0.15
            totalAdjustment += adjustment * weights.referenceIntegrity;
            totalWeight += weights.referenceIntegrity;
        }

        if (adjustmentFactors.topicSpecificity !== undefined) {
            const specificityScore = adjustmentFactors.topicSpecificity;
            const adjustment = (specificityScore - 0.5) * 0.25; // Scale: -0.125 to +0.125
            totalAdjustment += adjustment * weights.topicSpecificity;
            totalWeight += weights.topicSpecificity;
        }

        if (adjustmentFactors.chunkAgreement !== undefined) {
            const agreementScore = adjustmentFactors.chunkAgreement;
            const adjustment = (agreementScore - 0.5) * 0.2; // Scale: -0.1 to +0.1
            totalAdjustment += adjustment * weights.chunkAgreement;
            totalWeight += weights.chunkAgreement;
        }

        // Apply weighted adjustment
        if (totalWeight > 0) {
            adjustedConfidence = baseConfidence + (totalAdjustment / totalWeight);
        }

        // Clamp to valid range
        return Math.max(0, Math.min(1, adjustedConfidence));
    }

    /**
     * Check if response contains direct answer (for lab guidance validation)
     * @param {string} answer - Generated answer
     * @returns {boolean} True if contains direct answer
     */
    _checkForDirectAnswer(answer) {
        const directAnswerPatterns = [
            /the answer is/i,
            /you should do/i,
            /the solution is/i,
            /here's how to/i,
            /just do this/i,
            /you need to/i
        ];

        return directAnswerPatterns.some(pattern => pattern.test(answer));
    }

    /**
     * Strip LLM-generated references from answer text
     * Hard block for reference leakage patterns
     * @param {string} answer - LLM-generated answer
     * @returns {string} Answer with references removed
     * @private
     */
    _stripLLMReferences(answer) {
        if (!answer || typeof answer !== 'string') {
            return answer;
        }

        let cleanedAnswer = answer;
        let referenceFound = false;

        // Pattern 1: "Day X → Chapter Y" or "Day X, Chapter Y"
        const dayChapterPattern = /(?:Day\s+\d+[,\s]*(?:→|to|-)?\s*)?Chapter\s+\d+/gi;
        if (dayChapterPattern.test(cleanedAnswer)) {
            referenceFound = true;
            cleanedAnswer = cleanedAnswer.replace(dayChapterPattern, '');
        }

        // Pattern 2: "Chapter X" standalone
        const chapterPattern = /\bChapter\s+\d+\b/gi;
        if (chapterPattern.test(cleanedAnswer)) {
            referenceFound = true;
            cleanedAnswer = cleanedAnswer.replace(chapterPattern, '');
        }

        // Pattern 3: "Day X" standalone (when not part of content)
        const dayPattern = /\bDay\s+\d+\b/gi;
        if (dayPattern.test(cleanedAnswer)) {
            referenceFound = true;
            cleanedAnswer = cleanedAnswer.replace(dayPattern, '');
        }

        // Pattern 4: "Lab X" or "Lab Y"
        const labPattern = /\bLab\s+\d+\b/gi;
        if (labPattern.test(cleanedAnswer)) {
            referenceFound = true;
            cleanedAnswer = cleanedAnswer.replace(labPattern, '');
        }

        // Pattern 5: "Day X → Chapter Y" with arrow
        const arrowPattern = /Day\s+\d+\s*[→-]\s*Chapter\s+\d+/gi;
        if (arrowPattern.test(cleanedAnswer)) {
            referenceFound = true;
            cleanedAnswer = cleanedAnswer.replace(arrowPattern, '');
        }

        // Pattern 6: Canonical format (D1.C1.S3)
        const canonicalPattern = /D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+/gi;
        if (canonicalPattern.test(cleanedAnswer)) {
            referenceFound = true;
            cleanedAnswer = cleanedAnswer.replace(canonicalPattern, '');
        }

        // Pattern 7: Reference phrases ("refer to", "see", "as mentioned in")
        const referencePhrasePattern = /\b(refer to|see|consult|as mentioned in|according to|in chapter|in day|in lab)\s+(day|chapter|lab)\s+\d+/gi;
        if (referencePhrasePattern.test(cleanedAnswer)) {
            referenceFound = true;
            cleanedAnswer = cleanedAnswer.replace(referencePhrasePattern, '');
        }

        // Clean up extra whitespace and punctuation
        cleanedAnswer = cleanedAnswer
            .replace(/\s+/g, ' ') // Multiple spaces to single
            .replace(/\s*[.,;:]\s*[.,;:]+/g, '.') // Multiple punctuation
            .replace(/^\s+|\s+$/g, '') // Trim
            .replace(/\n\s*\n/g, '\n'); // Multiple newlines to single

        if (referenceFound) {
            console.warn('[LLMService] CRITICAL: LLM-generated references detected and removed from answer');
        }

        return cleanedAnswer;
    }
}

export const llmService = new LLMService();

