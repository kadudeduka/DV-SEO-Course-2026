/**
 * Query Normalizer Service
 * 
 * Preprocesses raw user questions before node retrieval.
 * Responsibilities:
 * - Correct spelling mistakes
 * - Rephrase questions into clear learning intent
 * - Extract key concepts as noun phrases
 * - Identify user intent type
 * 
 * STRICT RULES:
 * - Course-agnostic (no domain-specific hardcoding)
 * - No content retrieval
 * - No hallucination
 * - Returns structured JSON only
 */

import { llmService } from './llm-service.js';

class QueryNormalizerService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Normalize a user question
     * @param {string} rawQuestion - Raw user input
     * @returns {Promise<Object>} Normalized query with structured metadata
     */
    async normalize(rawQuestion) {
        if (!rawQuestion || typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) {
            return this._createEmptyResult();
        }

        // Check cache
        const cacheKey = rawQuestion.toLowerCase().trim();
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Build normalization prompt
            const systemPrompt = this._buildNormalizationPrompt();
            const userPrompt = this._buildUserPrompt(rawQuestion);

            // Call LLM for normalization
            const response = await llmService.generateAnswer(
                userPrompt,
                [], // No context chunks needed
                {
                    base: systemPrompt
                },
                {
                    model: 'gpt-4o-mini',
                    temperature: 0.1, // Low temperature for consistency
                    maxTokens: 500
                }
            );

            // Parse JSON response
            const normalized = this._parseResponse(response.answer, rawQuestion);

            // Cache result
            this.cache.set(cacheKey, normalized);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return normalized;

        } catch (error) {
            console.error('[QueryNormalizerService] Error normalizing query:', error);
            // Fallback: return basic normalization
            return this._createFallbackResult(rawQuestion);
        }
    }

    /**
     * Build system prompt for query normalization
     * @returns {string} System prompt
     * @private
     */
    _buildNormalizationPrompt() {
        return `You are a Query Normalization Assistant. Your task is to preprocess user questions for a learning management system.

CRITICAL RULES:
1. CORRECT SPELLING: Fix all spelling mistakes and typos
2. CLARIFY INTENT: Rephrase questions into clear, unambiguous learning queries
3. PRESERVE TERMS: Do NOT replace the user's terminology with different terms/synonyms. Keep the user's key phrases (after spelling fixes).
4. EXTRACT CONCEPTS: Identify key concepts as noun phrases (2-4 words max per phrase). Prefer phrases that appear in the user's question.
5. ACRONYMS: If you expand an acronym, include BOTH forms in key_concepts (the acronym form and the expanded form) when applicable.
4. IDENTIFY INTENT: Classify the question type
5. BE GENERIC: Do NOT reference specific courses, domains, or topics
6. NO HALLUCINATION: Only work with what the user provided

INTENT TYPES:
- "definition": User wants to know what something is
- "explanation": User wants to understand how/why something works
- "comparison": User wants to compare two or more things
- "procedure": User wants to know steps/how-to
- "example": User wants examples or use cases
- "general": General question that doesn't fit other categories

OUTPUT FORMAT (JSON only):
{
  "normalized_question": "Corrected and rephrased question",
  "key_concepts": ["concept 1", "concept 2", "concept 3"],
  "intent_type": "definition|explanation|comparison|procedure|example|general",
  "confidence": 0.0-1.0,
  "original_question": "original user input",
  "spelling_corrections": ["word1 -> word2", "word3 -> word4"]
}

EXAMPLES:

Input: "wat is kpi?"
Output: {
  "normalized_question": "What is a key performance indicator?",
  "key_concepts": ["kpi", "key performance indicator"],
  "intent_type": "definition",
  "confidence": 0.95,
  "original_question": "wat is kpi?",
  "spelling_corrections": ["wat -> what"]
}

Input: "can you explain onpage seo?"
Output: {
  "normalized_question": "Can you explain onpage seo?",
  "key_concepts": ["onpage seo"],
  "intent_type": "explanation",
  "confidence": 0.9,
  "original_question": "can you explain onpage seo?",
  "spelling_corrections": []
}

Input: "tell me about api rate limits"
Output: {
  "normalized_question": "What are api rate limits?",
  "key_concepts": ["api", "rate limits"],
  "intent_type": "explanation",
  "confidence": 0.85,
  "original_question": "tell me about api rate limits",
  "spelling_corrections": []
}

Remember:
- Return ONLY valid JSON
- Do NOT include markdown formatting
- Do NOT add explanations outside JSON
- Do NOT over-generalize concepts (avoid collapsing specific phrases into a single broad term)
- Confidence should reflect certainty of normalization quality`;
    }

    /**
     * Build user prompt
     * @param {string} rawQuestion - Raw user question
     * @returns {string} User prompt
     * @private
     */
    _buildUserPrompt(rawQuestion) {
        return `Normalize this user question:

"${rawQuestion}"

Return ONLY the JSON object, no additional text.`;
    }

    /**
     * Parse LLM response into structured format
     * @param {string} response - LLM response
     * @param {string} originalQuestion - Original user question
     * @returns {Object} Parsed normalization result
     * @private
     */
    _parseResponse(response, originalQuestion) {
        try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = response.trim();
            
            // Remove markdown code blocks if present
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
            
            // Parse JSON
            const parsed = JSON.parse(jsonStr);

            const normalized = {
                normalized_question: parsed.normalized_question || originalQuestion,
                key_concepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [],
                intent_type: parsed.intent_type || 'general',
                confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
                original_question: originalQuestion,
                spelling_corrections: Array.isArray(parsed.spelling_corrections) ? parsed.spelling_corrections : []
            };

            // Post-parse guardrails (topic-agnostic):
            // - Drop overly broad single-word concepts unless they look like acronyms (2-6 letters)
            // - Keep concepts grounded in either the original question OR normalized question
            // - If the original contains a "word + ACRONYM" pattern (e.g., "onpage SEO"), ensure that phrase is included
            const originalLower = (originalQuestion || '').toLowerCase();
            const normalizedLower = (normalized.normalized_question || '').toLowerCase();

            const isAcronym = (s) => /^[a-z]{2,6}$/.test(String(s || '').toLowerCase());
            const isSingleWord = (s) => !String(s || '').trim().includes(' ');
            const appearsInText = (term) => {
                const t = String(term || '').toLowerCase().trim();
                if (!t) return false;
                return originalLower.includes(t) || normalizedLower.includes(t);
            };
            const appearsInOriginal = (term) => {
                const t = String(term || '').toLowerCase().trim();
                if (!t) return false;
                // Check lowercase match
                if (originalLower.includes(t)) return true;
                // Also check if it's an acronym - check uppercase version in original
                if (isAcronym(t)) {
                    const tUpper = t.toUpperCase();
                    const originalUpper = (originalQuestion || '').toUpperCase();
                    if (originalUpper.includes(tUpper)) return true;
                }
                return false;
            };
            const appearsInNormalized = (term) => {
                const t = String(term || '').toLowerCase().trim();
                if (!t) return false;
                return normalizedLower.includes(t);
            };

            // Detect acronyms in the original question (topic-agnostic)
            const originalAcronyms = new Set();
            const acrRe = /\b[A-Z]{2,6}\b/g;
            let am;
            while ((am = acrRe.exec(originalQuestion || '')) !== null) {
                originalAcronyms.add(am[0].toLowerCase());
            }
            const allowAcronymExpansion =
                normalized.intent_type === 'definition' && originalAcronyms.size > 0;
            
            // Add original acronyms to concepts if they're not already there (after stop word removal)
            // This ensures acronyms like "EEAT" are extracted even if LLM includes them with stop words
            for (const acronym of originalAcronyms) {
                if (!cleaned.includes(acronym)) {
                    cleaned.push(acronym);
                }
            }

            // Ensure "word + ACRONYM" phrases from the original are preserved (topic-agnostic)
            // Example: "onpage SEO" -> "onpage seo", "Technical SEO" -> "technical seo"
            const wordAcronymMatches = [];
            const re = /\b([A-Za-z0-9][A-Za-z0-9-]{1,})\s+([A-Z]{2,6})\b/g;
            const nonModifierWords = new Set([
                'what', 'why', 'how', 'can', 'could', 'would', 'should', 'please',
                'explain', 'define', 'tell', 'about', 'is', 'are', 'do', 'does', 'did'
            ]);
            let m;
            while ((m = re.exec(originalQuestion || '')) !== null) {
                const modifier = String(m[1] || '').toLowerCase();
                if (!nonModifierWords.has(modifier)) {
                    wordAcronymMatches.push(`${m[1]} ${m[2]}`.toLowerCase());
                }
            }

            // Stop words that should not start a concept
            const stopWords = new Set(['of', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'about', 'into', 'onto', 'upon']);
            
            // First pass: remove leading stop words from all concepts
            const cleaned = []
                .concat(normalized.key_concepts || [])
                .map(c => (typeof c === 'string' ? c.trim() : ''))
                .filter(Boolean)
                .map(c => {
                    // Remove leading stop words
                    const words = c.toLowerCase().split(/\s+/);
                    while (words.length > 0 && stopWords.has(words[0])) {
                        words.shift();
                    }
                    const cleaned = words.join(' ');
                    // Debug: log if we removed stop words
                    if (cleaned !== c.toLowerCase()) {
                        console.log(`[QueryNormalizer] Removed stop words: "${c}" -> "${cleaned}"`);
                    }
                    return cleaned;
                })
                .filter(Boolean) // Remove empty strings after stop word removal
                .filter(c => {
                    // After stop word removal, check if the cleaned concept appears in original
                    // This handles cases like "of eeat" -> "eeat" where "eeat" appears in original
                    const appearsAfterCleaning = appearsInOriginal(c);
                    
                    // Always keep acronyms (case-insensitive match with original)
                    if (isSingleWord(c) && isAcronym(c)) {
                        // Check if this acronym (case-insensitive) appears in original
                        const acronymUpper = c.toUpperCase();
                        const originalUpper = (originalQuestion || '').toUpperCase();
                        if (originalUpper.includes(acronymUpper)) {
                            return true;
                        }
                    }
                    
                    if (isSingleWord(c) && !isAcronym(c)) {
                        // For single words that aren't acronyms, only keep if appears in original
                        return appearsAfterCleaning;
                    }
                    
                    // Default: keep only if it appears in the ORIGINAL question (prevents synonym rewrites)
                    if (appearsAfterCleaning) return true;

                    // Allow acronym expansions ONLY for definition questions (e.g., "what is kpi?")
                    // and only if the term appears in the normalized question.
                    if (!isSingleWord(c) && allowAcronymExpansion && appearsInNormalized(c)) return true;

                    return false;
                });

            // Add word+acronym matches (e.g., "onpage SEO")
            for (const wa of wordAcronymMatches) {
                // Remove leading stop words from word+acronym matches too
                const words = wa.toLowerCase().split(/\s+/);
                while (words.length > 0 && stopWords.has(words[0])) {
                    words.shift();
                }
                const cleanedWa = words.join(' ');
                if (cleanedWa && !cleaned.includes(cleanedWa)) {
                    cleaned.push(cleanedWa);
                }
            }
            
            // Add original acronyms to concepts if they're not already there
            // This ensures acronyms like "EEAT" are extracted even if LLM includes them with stop words
            for (const acronym of originalAcronyms) {
                if (!cleaned.includes(acronym)) {
                    cleaned.push(acronym);
                }
            }

            // Final cleanup: remove any remaining stop words that might have been added back
            const finalCleaned = cleaned.map(c => {
                const words = c.toLowerCase().split(/\s+/);
                while (words.length > 0 && stopWords.has(words[0])) {
                    words.shift();
                }
                return words.join(' ');
            }).filter(Boolean);
            
            // If we have a more specific multi-word phrase containing an acronym, drop the acronym-only concept.
            // Example: ["seo", "onpage seo"] -> ["onpage seo"]
            const unique = Array.from(new Set(finalCleaned));
            const acronymOnly = unique.filter(c => isSingleWord(c) && isAcronym(c));
            const multiWord = unique.filter(c => !isSingleWord(c));

            const filtered = unique.filter(c => {
                if (!(isSingleWord(c) && isAcronym(c))) return true;
                // Keep acronym-only only if no multi-word concept contains it as a token
                const token = c.toLowerCase();
                const hasSpecific = multiWord.some(phrase => phrase.split(/\s+/).includes(token));
                return !hasSpecific;
            });

            normalized.key_concepts = filtered.slice(0, 8);
            
            // Debug: log final concepts
            if (normalized.key_concepts.some(c => stopWords.has(c.split(/\s+/)[0]))) {
                console.warn(`[QueryNormalizer] WARNING: Final concepts still contain stop words:`, normalized.key_concepts);
            }

            return normalized;
        } catch (error) {
            console.warn('[QueryNormalizerService] Failed to parse LLM response as JSON:', error);
            console.warn('[QueryNormalizerService] Raw response:', response);
            return this._createFallbackResult(originalQuestion);
        }
    }

    /**
     * Create fallback result when normalization fails
     * @param {string} originalQuestion - Original question
     * @returns {Object} Fallback normalization result
     * @private
     */
    _createFallbackResult(originalQuestion) {
        // Basic normalization: lowercase, trim, extract simple keywords
        const normalized = originalQuestion.trim();
        const keywords = normalized
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length >= 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'one', 'our', 'out', 'has', 'who', 'its', 'how', 'may', 'say', 'she', 'use', 'new', 'now', 'old', 'see', 'him', 'two', 'way', 'did', 'let', 'put', 'too', 'tell', 'me', 'about', 'what', 'is', 'does', 'do', 'this', 'that'].includes(w));

        return {
            normalized_question: normalized,
            key_concepts: keywords.slice(0, 5), // Top 5 keywords
            intent_type: this._inferIntentType(originalQuestion),
            confidence: 0.5,
            original_question: originalQuestion,
            spelling_corrections: []
        };
    }

    /**
     * Create empty result for invalid input
     * @returns {Object} Empty normalization result
     * @private
     */
    _createEmptyResult() {
        return {
            normalized_question: '',
            key_concepts: [],
            intent_type: 'general',
            confidence: 0.0,
            original_question: '',
            spelling_corrections: []
        };
    }

    /**
     * Infer intent type from question structure (fallback method)
     * @param {string} question - User question
     * @returns {string} Inferred intent type
     * @private
     */
    _inferIntentType(question) {
        const lower = question.toLowerCase();

        if (/^(what|define|definition|mean|meaning)/i.test(lower)) {
            return 'definition';
        }
        if (/^(how|why|explain|understand|works?)/i.test(lower)) {
            return 'explanation';
        }
        if (/(compare|difference|vs|versus|better|worse)/i.test(lower)) {
            return 'comparison';
        }
        if (/^(steps?|how to|procedure|process|do|perform|implement)/i.test(lower)) {
            return 'procedure';
        }
        if (/(example|instance|case|sample)/i.test(lower)) {
            return 'example';
        }

        return 'general';
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: 1000, // Approximate
            timeout: this.cacheTimeout
        };
    }
}

export const queryNormalizerService = new QueryNormalizerService();

