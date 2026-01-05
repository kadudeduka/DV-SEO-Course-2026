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
        
        // Check import.meta.env (for Vite builds)
        try {
            if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY) {
                apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            }
        } catch (e) {
            // import.meta not available, continue
        }
        
        // Check window.LMS_CONFIG (browser config)
        if (!apiKey && typeof window !== 'undefined' && window.LMS_CONFIG?.OPENAI_API_KEY) {
            apiKey = window.LMS_CONFIG.OPENAI_API_KEY;
        }
        
        this.apiKey = apiKey;
        this.baseURL = 'https://api.openai.com/v1';
        this.cache = new Map();
        
        if (!this.apiKey) {
            console.warn('[LLMService] OpenAI API key not found. AI Coach will not work.');
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
                            content: `You are an intent classifier for an educational LMS. Classify the user's question into one of these categories:
- course_content: Questions about course material, concepts, definitions
- list_request: Questions asking to "list", "enumerate", "show all", "what are all" items/examples from a chapter
- navigation: Questions about course structure, where to find content, how to navigate
- lab_guidance: Questions about labs, assignments, exercises (NOT asking for answers)
- lab_struggle: Indications of struggling with labs (stuck, help, don't understand)
- out_of_scope: Questions not related to the course

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
        
        // List request indicators
        const listKeywords = ['list', 'enumerate', 'show all', 'what are all', 'list all', 'list the', 'list examples'];
        if (listKeywords.some(keyword => lowerQuestion.includes(keyword))) {
            return 'list_request';
        }
        
        // Lab struggle indicators
        const struggleKeywords = ['stuck', 'help', "don't understand", "can't", 'how to do', 'what should i do'];
        if (struggleKeywords.some(keyword => lowerQuestion.includes(keyword))) {
            if (lowerQuestion.includes('lab') || lowerQuestion.includes('assignment')) {
                return 'lab_struggle';
            }
        }
        
        // Lab guidance
        if (lowerQuestion.includes('lab') || lowerQuestion.includes('assignment') || lowerQuestion.includes('exercise')) {
            return 'lab_guidance';
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
- Structure: Direct Answer → Key Points (point-based) → References → Next Steps (if relevant)
- Use bullet points for lists and structured formatting
- Avoid filler words and repetition
- For "how-to" questions: Provide concise, point-based steps highlighting key actions
- For "list" requests: Extract and enumerate ALL items from the specified chapter (not just a summary)
- Exclude lab assignment logistics (documentation, submission templates, assignment steps) unless explicitly asked
- Distinguish between conceptual questions (explain concept) and lab questions (provide lab guidance)
- When a specific chapter is mentioned, extract content ONLY from that chapter and ensure references match`;

        const messages = [
            { role: 'system', content: fullSystemPrompt },
            {
                role: 'user',
                content: `Question: ${question}\n\nContext from course:\n${contextString}\n\nAnswer the question using only the provided context. Include references to specific course locations (Day X → Chapter Y).`
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
            const answer = data.choices[0].message.content;
            const tokensUsed = data.usage.total_tokens;

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
     * @returns {Promise<number>} Confidence score (0-1)
     */
    async estimateConfidence(question, contextChunks, answer) {
        if (!this.apiKey || contextChunks.length === 0) {
            // Fallback: simple heuristic
            return contextChunks.length > 0 ? 0.7 : 0.3;
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
                return 0.7; // Default confidence
            }

            const data = await response.json();
            const confidence = parseFloat(data.choices[0].message.content.trim());
            
            // Validate and clamp
            if (isNaN(confidence)) {
                return 0.7;
            }
            return Math.max(0, Math.min(1, confidence));
        } catch (error) {
            console.error('[LLMService] Error estimating confidence:', error);
            return 0.7; // Default confidence
        }
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
}

export const llmService = new LLMService();

