/**
 * Alias Generator Service
 * 
 * Generates high-quality semantic aliases for concepts using LLM.
 * Domain-agnostic: works for any course/domain without hardcoded mappings.
 * 
 * Principles:
 * - Aliases represent the SAME concept (not broader/narrower)
 * - Aliases reflect how users naturally refer to the concept
 * - No domain-specific rules or hardcoded mappings
 */

import { llmService } from './llm-service.js';

class AliasGeneratorService {
    constructor() {
        this.cache = new Map();
        // Cache indefinitely (30 days is too long for setTimeout)
        // Cache will persist for the lifetime of the service instance
        // For production, consider using a persistent cache (Redis, database)
    }

    /**
     * Generate semantic aliases for a concept
     * @param {string} primaryTopic - The primary topic/concept name
     * @param {string} definition - Short definition or context (first 2-3 lines of content)
     * @param {string} nodeType - Node type (concept, definition, etc.)
     * @returns {Promise<Array<string>>} Array of lowercase aliases (max 6-8)
     */
    async generateAliases(primaryTopic, definition = '', nodeType = 'concept') {
        // Validate inputs
        if (!primaryTopic || typeof primaryTopic !== 'string' || primaryTopic.trim().length === 0) {
            console.warn('[AliasGenerator] Invalid primaryTopic, returning empty aliases');
            return [];
        }

        // Check cache
        const cacheKey = this._buildCacheKey(primaryTopic, definition);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            console.log(`[AliasGenerator] Cache hit for: "${primaryTopic}"`);
            return cached;
        }

        // Check if API key is configured before attempting LLM call
        if (!llmService.apiKey) {
            // API key not configured, use fallback immediately without error
            const fallbackAliases = this._fallbackAliases(primaryTopic);
            this.cache.set(cacheKey, fallbackAliases);
            return fallbackAliases;
        }

        try {
            // Generate aliases using LLM
            const aliases = await this._generateWithLLM(primaryTopic, definition, nodeType);
            
            // Validate and clean aliases
            const validatedAliases = this._validateAndClean(aliases, primaryTopic);
            
            // Cache result (indefinitely for service instance lifetime)
            this.cache.set(cacheKey, validatedAliases);
            
            console.log(`[AliasGenerator] Generated ${validatedAliases.length} aliases for: "${primaryTopic}"`);
            return validatedAliases;
            
        } catch (error) {
            // Log as warning instead of error since fallback is available
            console.warn(`[AliasGenerator] LLM generation failed for "${primaryTopic}", using fallback:`, error.message);
            // Fallback: return basic aliases (lowercase version + acronym if applicable)
            const fallbackAliases = this._fallbackAliases(primaryTopic);
            this.cache.set(cacheKey, fallbackAliases);
            return fallbackAliases;
        }
    }

    /**
     * Generate aliases using LLM
     * @private
     */
    async _generateWithLLM(primaryTopic, definition, nodeType) {
        const prompt = this._buildPrompt(primaryTopic, definition, nodeType);
        const userMessage = `Primary Topic: "${primaryTopic}"\n${definition ? `Definition: "${definition}"` : ''}`;

        try {
            // Use generateAnswer method with custom prompt
            const response = await llmService.generateAnswer(
                userMessage,
                [], // No context chunks needed
                {
                    base: prompt
                },
                {
                    model: 'gpt-4o-mini',
                    temperature: 0.3, // Lower temperature for more consistent outputs
                    maxTokens: 300,
                    responseFormat: { type: 'json_object' }
                }
            );

            // Parse JSON response
            let parsed;
            try {
                // Extract JSON from response (might be wrapped in markdown code blocks)
                let answerText = response.answer || response;
                if (typeof answerText !== 'string') {
                    answerText = JSON.stringify(answerText);
                }
                
                // Remove markdown code blocks if present
                const jsonMatch = answerText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                                 answerText.match(/\{[\s\S]*\}/);
                
                const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : answerText;
                parsed = JSON.parse(jsonString);
            } catch (parseError) {
                console.error('[AliasGenerator] Failed to parse LLM JSON response:', parseError);
                console.error('[AliasGenerator] Response was:', response.answer || response);
                return this._fallbackAliases(primaryTopic);
            }

            // Extract aliases array
            let aliases = [];
            if (Array.isArray(parsed.aliases)) {
                aliases = parsed.aliases;
            } else if (Array.isArray(parsed.synonyms)) {
                aliases = parsed.synonyms;
            } else if (typeof parsed === 'object') {
                // Try to extract any array value
                for (const key in parsed) {
                    if (Array.isArray(parsed[key])) {
                        aliases = parsed[key];
                        break;
                    }
                }
            }
            
            if (!Array.isArray(aliases)) {
                console.warn('[AliasGenerator] LLM response is not an array, using fallback');
                return this._fallbackAliases(primaryTopic);
            }

            return aliases;
            
        } catch (error) {
            console.error('[AliasGenerator] LLM call failed:', error);
            throw error;
        }
    }

    /**
     * Build LLM prompt for alias generation
     * @private
     */
    _buildPrompt(primaryTopic, definition, nodeType) {
        return `You are a semantic equivalence expert. Your task is to generate alternative names and phrases that refer to the EXACT SAME concept as the given primary topic.

STRICT RULES (NON-NEGOTIABLE):

1. **Semantic Equivalence Only**: Generate ONLY aliases that refer to the SAME concept. Do NOT include:
   - Broader categories (e.g., if topic is "Technical SEO", do NOT include "SEO" or "Search Engine Optimization")
   - Narrower subtopics (e.g., if topic is "Technical SEO", do NOT include "Page Speed" or "Crawlability")
   - Related but different concepts
   - Examples or implementations

2. **User Language**: Generate aliases that reflect how users naturally refer to the concept:
   - Common paraphrases
   - Functional descriptions
   - Industry shorthand/acronyms (if applicable)
   - Alternative phrasings

3. **Domain Agnostic**: Do NOT use domain-specific knowledge. Work purely from the topic name and definition provided.

4. **Output Format**: Return ONLY a JSON object with this exact structure:
   \`\`\`json
   {
     "aliases": ["alias1", "alias2", "alias3"]
   }
   \`\`\`

5. **Alias Requirements**:
   - Lowercase only
   - No punctuation (except hyphens in compound terms)
   - 2-8 aliases maximum
   - Each alias must be a valid phrase (2-6 words typically)
   - No duplicates

6. **Quality Over Quantity**: Prefer fewer, high-quality aliases over many weak ones.

EXAMPLES:

Input:
  Primary Topic: "Technical SEO"
  Definition: "SEO focused on site infrastructure, crawlability, and performance"

Valid Aliases (SAME concept):
  - "technical seo"
  - "technical optimization"
  - "site technical optimization"
  - "website technical health"
  - "technical search optimization"

Invalid Aliases (broader/narrower/different):
  - "seo" (broader)
  - "search engine optimization" (broader)
  - "page speed" (narrower subtopic)
  - "crawlability" (narrower subtopic)
  - "on-page seo" (different concept)

Input:
  Primary Topic: "Technical SEO Audits and Crawlability"
  Definition: "Process of auditing technical SEO factors and assessing site crawlability"

Valid Aliases (SAME concept):
  - "technical seo audits and crawlability"
  - "technical seo audits"
  - "technical seo" (base concept - if topic contains a common phrase like "Technical SEO", include it as an alias)
  - "crawlability assessment"
  - "technical site audit"
  - "seo crawlability audit"

IMPORTANT RULE: Extract Base Concepts
If the primary topic contains a recognizable base concept (e.g., "Technical SEO", "Keyword Research", "Link Building", "Content Optimization"), ALWAYS include that base phrase as one of the aliases, even if the full topic is more specific.

Example:
  Topic: "Technical SEO Audits and Crawlability"
  → MUST include "technical seo" as an alias (extracted base concept)
  → Then add specific variations: "technical seo audits", "crawlability assessment", etc.

This ensures users searching for the general concept (e.g., "technical seo") can find related specific content (e.g., "technical seo audits").

Input:
  Primary Topic: "Keyword Research"
  Definition: "The process of finding and analyzing search terms"

Valid Aliases:
  - "keyword research"
  - "keyword analysis"
  - "search term research"
  - "keyword discovery"
  - "kw research"

Invalid Aliases:
  - "research" (broader)
  - "seo" (broader)
  - "long-tail keywords" (narrower subtopic)
  - "keyword tools" (different concept - tools vs. process)

Input:
  Primary Topic: "Answer Engine Optimization"
  Definition: "Optimizing content for featured snippets and zero-click searches"

Valid Aliases:
  - "answer engine optimization"
  - "aeo"
  - "answer optimization"
  - "featured snippet optimization"
  - "zero-click optimization"

Invalid Aliases:
  - "seo" (broader)
  - "optimization" (broader)
  - "featured snippets" (narrower - just one aspect)
  - "voice search" (related but different)

Now generate aliases for the provided topic. Return ONLY the JSON object, no explanations.`;
    }

    /**
     * Validate and clean aliases
     * @private
     */
    _validateAndClean(aliases, primaryTopic) {
        if (!Array.isArray(aliases)) {
            return this._fallbackAliases(primaryTopic);
        }

        const cleaned = aliases
            .filter(alias => {
                // Must be a string
                if (typeof alias !== 'string') return false;
                
                // Must have content after trimming
                const trimmed = alias.trim();
                if (trimmed.length === 0) return false;
                
                // Must be 2-50 characters (reasonable phrase length)
                if (trimmed.length < 2 || trimmed.length > 50) return false;
                
                // Must not be just the primary topic (we'll add that separately)
                if (trimmed.toLowerCase() === primaryTopic.toLowerCase()) return false;
                
                return true;
            })
            .map(alias => {
                // Normalize: lowercase, trim, remove extra spaces
                return alias
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, ' ')
                    .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens
                    .trim();
            })
            .filter(alias => alias.length >= 2) // Re-check after normalization
            .filter((alias, index, self) => self.indexOf(alias) === index) // Remove duplicates
            .slice(0, 8); // Limit to 8 aliases

        // Always include lowercase version of primary topic as first alias
        const primaryTopicLower = primaryTopic.toLowerCase().trim();
        const result = [primaryTopicLower, ...cleaned.filter(a => a !== primaryTopicLower)];
        
        // Remove duplicates again (in case primary topic was already in list)
        return [...new Set(result)].slice(0, 8);
    }

    /**
     * Fallback aliases when LLM fails
     * @private
     */
    _fallbackAliases(primaryTopic) {
        const aliases = [primaryTopic.toLowerCase().trim()];
        
        // Extract acronym if applicable (2+ words)
        const words = primaryTopic.trim().split(/\s+/);
        if (words.length >= 2 && words.length <= 5) {
            const acronym = words.map(w => w[0]).join('').toLowerCase();
            if (acronym.length >= 2 && acronym.length <= 5) {
                aliases.push(acronym);
            }
        }
        
        return aliases;
    }

    /**
     * Build cache key
     * @private
     */
    _buildCacheKey(primaryTopic, definition) {
        const topicKey = primaryTopic.toLowerCase().trim();
        const defKey = definition ? definition.substring(0, 100).toLowerCase().trim() : '';
        return `alias_${topicKey}_${defKey}`.replace(/\s+/g, '_');
    }

    /**
     * Clear cache (for testing or forced regeneration)
     */
    clearCache() {
        this.cache.clear();
        console.log('[AliasGenerator] Cache cleared');
    }

    /**
     * Get cache stats (for monitoring)
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

export const aliasGeneratorService = new AliasGeneratorService();

