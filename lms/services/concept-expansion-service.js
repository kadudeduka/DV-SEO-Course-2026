/**
 * Concept Expansion Service
 * 
 * Generates semantic variants of extracted concepts to improve retrieval matching.
 * 
 * Example:
 *   Input: ["technical optimization"]
 *   Output: ["technical optimization", "technical seo", "technical search optimization"]
 * 
 * STRICT RULES:
 * - Course-agnostic (no domain-specific hardcoding)
 * - Only generates semantic equivalents (same meaning)
 * - No broader/narrower concepts
 * - Uses LLM for intelligent expansion
 */

import { llmService } from './llm-service.js';

class ConceptExpansionService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Expand concepts to semantic variants
     * @param {Array<string>} concepts - Original concepts from QueryNormalizer
     * @param {string} intentType - User intent (definition, explanation, etc.)
     * @returns {Promise<Array<string>>} Expanded concepts including originals + variants
     */
    async expandConcepts(concepts, intentType = 'general') {
        if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
            return [];
        }

        // Filter valid concepts
        const validConcepts = concepts.filter(c => c && typeof c === 'string' && c.trim().length > 0);
        if (validConcepts.length === 0) {
            return [];
        }

        // Stop words that should not start a concept
        const stopWords = new Set(['of', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'about', 'into', 'onto', 'upon']);
        
        // Clean concepts by removing leading stop words
        const cleanConcept = (c) => {
            const words = c.toLowerCase().trim().split(/\s+/);
            while (words.length > 0 && stopWords.has(words[0])) {
                words.shift();
            }
            return words.join(' ');
        };
        
        // Expand each concept
        const expandedSet = new Set();
        
        // Add cleaned originals
        validConcepts.forEach(c => {
            const cleaned = cleanConcept(c);
            if (cleaned) {
                expandedSet.add(cleaned);
            }
        });
        
        for (const concept of validConcepts) {
            try {
                const variants = await this._generateVariants(concept, intentType);
                variants.forEach(v => {
                    if (v && v.trim().length > 0) {
                        const cleaned = cleanConcept(v);
                        if (cleaned) {
                            expandedSet.add(cleaned);
                        }
                    }
                });
            } catch (error) {
                console.warn(`[ConceptExpansion] Failed to expand "${concept}":`, error.message);
                // Continue with other concepts even if one fails
            }
        }

        return Array.from(expandedSet);
    }

    /**
     * Generate semantic variants for a single concept using LLM
     * @param {string} concept - Original concept
     * @param {string} intentType - User intent
     * @returns {Promise<Array<string>>} Semantic variants
     * @private
     */
    async _generateVariants(concept, intentType) {
        // Check cache
        const cacheKey = `${concept.toLowerCase()}:${intentType}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const systemPrompt = this._buildExpansionPrompt();
            const userPrompt = `Generate semantic variants for: "${concept}"`;

            const response = await llmService.generateAnswer(
                userPrompt,
                [], // No context chunks
                { base: systemPrompt },
                {
                    model: 'gpt-4o-mini',
                    temperature: 0.2, // Low temperature for consistency
                    maxTokens: 200,
                    responseFormat: { type: 'json_object' }
                }
            );

            // Parse JSON response
            const parsed = this._parseResponse(response.answer);
            
            // Cache result
            this.cache.set(cacheKey, parsed.variants || []);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return parsed.variants || [];

        } catch (error) {
            console.error(`[ConceptExpansion] Error generating variants for "${concept}":`, error);
            return []; // Return empty array on error
        }
    }

    /**
     * Build LLM prompt for concept expansion
     * @returns {string} System prompt
     * @private
     */
    _buildExpansionPrompt() {
        return `You are a Semantic Equivalence Expert. Your task is to generate alternative phrases that mean the EXACT SAME thing as the given concept.

CRITICAL RULES:
1. **Semantic Equivalence Only**: Generate ONLY phrases that refer to the SAME concept. Do NOT include:
   - Broader categories (e.g., if concept is "technical seo", do NOT include "seo" or "search engine optimization")
   - Narrower subtopics (e.g., if concept is "technical seo", do NOT include "page speed" or "crawlability")
   - Related but different concepts
   - Examples or implementations

2. **Common Variants**: Generate common ways users might refer to the same concept:
   - Alternative phrasings (e.g., "technical optimization" ↔ "technical seo")
   - Abbreviations and expansions (e.g., "seo" ↔ "search engine optimization" - but ONLY if the original is the abbreviation)
   - Common synonyms (e.g., "onpage seo" ↔ "on-page seo" ↔ "on page seo")
   - Domain-specific equivalents (e.g., "technical optimization" in SEO context = "technical seo")

3. **Domain Agnostic**: Your logic must work across ANY domain (SEO, Finance, HR, etc.). Do NOT use hardcoded domain knowledge.

4. **Output Format**: Return ONLY a JSON object:
\`\`\`json
{
  "variants": ["variant1", "variant2", "variant3"]
}
\`\`\`

5. **Quantity**: Generate 2-5 high-quality variants maximum. Quality over quantity.

6. **Format**: All variants must be lowercase, no punctuation (except hyphens in compound terms).

EXAMPLES:

Input: "technical optimization"
Output: {
  "variants": ["technical seo", "technical search optimization", "technical search engine optimization"]
}

Input: "onpage seo"
Output: {
  "variants": ["on-page seo", "on page seo", "onpage optimization"]
}

Input: "keyword research"
Output: {
  "variants": ["keyword analysis", "search term research", "keyword discovery"]
}

Input: "answer engine optimization"
Output: {
  "variants": ["aeo", "answer optimization", "answer engine seo"]
}

Remember:
- Return ONLY valid JSON
- Do NOT include markdown formatting
- Do NOT add explanations outside JSON
- All variants must be semantically equivalent (same meaning)`;
    }

    /**
     * Parse LLM response
     * @param {string} response - LLM response
     * @returns {Object} Parsed response with variants array
     * @private
     */
    _parseResponse(response) {
        try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = response.trim();
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
            
            const parsed = JSON.parse(jsonStr);
            
            // Validate structure
            if (!Array.isArray(parsed.variants)) {
                console.warn('[ConceptExpansion] LLM response missing variants array:', parsed);
                return { variants: [] };
            }
            
            // Filter and normalize variants
            const validVariants = parsed.variants
                .filter(v => v && typeof v === 'string' && v.trim().length > 0)
                .map(v => v.toLowerCase().trim())
                .filter(v => v.length >= 2 && v.length <= 50); // Reasonable length limits
            
            return { variants: validVariants };
            
        } catch (error) {
            console.error('[ConceptExpansion] Failed to parse LLM response:', error);
            console.error('[ConceptExpansion] Raw response:', response);
            return { variants: [] };
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export const conceptExpansionService = new ConceptExpansionService();

