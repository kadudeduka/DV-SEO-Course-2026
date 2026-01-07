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
1. QUERY CATEGORY CLASSIFICATION (FIRST STEP):
   - Classify the query into ONE of these categories:
     * "content" - Questions about course concepts/subject matter (e.g., "What is AEO?", "Explain SEO")
     * "lab_guidance" - Questions about labs/assignments (e.g., "I'm stuck in lab 3", "Help with lab 2")
     * "structural" - Questions about course structure (e.g., "How many chapters?", "What's the syllabus?")
     * "navigation" - Questions about course navigation (e.g., "Can I skip chapter 2?", "What's the order?")
     * "planning" - Questions about time/planning (e.g., "How much time for chapter 2?", "How long is this?")
     * "unrelated" - Questions completely outside the scope of the course (e.g., "What's the weather?", "Tell me a joke", "How to cook pasta?")
   - Category detection keywords:
     * Content: "what is", "explain", "how does", "tell me about", "define" + subject matter terms
     * Lab Guidance: "stuck", "help with lab", "lab", "assignment", "submission"
     * Structural: "how many", "what chapters", "course structure", "syllabus", "outline"
     * Navigation: "skip", "can I", "should I", "order", "sequence", "prerequisite"
     * Planning: "how much time", "how long", "duration", "schedule", "timeline", "estimate"
     * Unrelated: Questions about topics completely unrelated to the course, general knowledge, personal questions, off-topic queries

2. CORRECT SPELLING: Fix all spelling mistakes and typos

3. CLARIFY INTENT: Rephrase questions into clear, unambiguous learning queries

4. PRESERVE TERMS: Do NOT replace the user's terminology with different terms/synonyms. Keep the user's key phrases (after spelling fixes).

5. PRIMARY TOPIC IDENTIFICATION (ONLY for "content" category):
   - Identify the MAIN SUBJECT MATTER the user is asking about
   - This is typically a noun phrase, acronym, or technical term
   - Examples: "AEO", "Technical SEO", "Keyword Research"
   - DO NOT include action verbs, temporal phrases, or comparative words as primary topics
   - For non-content queries, primary_topic may be null or the referenced element (e.g., "Chapter 2")

6. EXTRACT CONCEPTS (ONLY for "content" category):
   - Identify key concepts as noun phrases (2-4 words max per phrase). Prefer phrases that appear in the user's question.
   - ALWAYS extract acronyms (e.g., "AEO", "SEO", "KPI") as separate concepts, even in complex queries
   - For strategy/winning questions (e.g., "how to win", "what to do differently"), extract the core topic/acronym mentioned
   - Ignore action words like "win", "differently", "need" - focus on the subject matter (e.g., "AEO", "technical seo")
   - For non-content queries, key_concepts may be empty

7. ACRONYMS: If you expand an acronym, include BOTH forms in key_concepts (the acronym form and the expanded form) when applicable.

8. IDENTIFY INTENT: Classify the question type (see INTENT TYPES below)

9. ADDITIONAL INFORMATION EXTRACTION (for non-content queries):
   - For navigation queries: Extract chapter/lab numbers and navigation action (skip, prerequisite, etc.)
   - For planning queries: Extract chapter/lab numbers and time-related question type
   - For structural queries: Extract what structural element is being asked about
   - For lab guidance queries: Extract lab number and guidance type (stuck, help, submission, etc.)

10. BE GENERIC: Do NOT reference specific courses, domains, or topics

11. NO HALLUCINATION: Only work with what the user provided

INTENT TYPES:
- "definition": User wants to know what something is
- "explanation": User wants to understand how/why something works
- "comparison": User wants to compare two or more things
- "procedure": User wants to know steps/how-to (generic steps)
- "implementation": How to implement/apply (specific, actionable)
- "strategy": How to win/succeed (keywords: win, succeed, beat, outperform, differently)
- "best_practices": What are best practices (keywords: best, optimal, recommended, should)
- "troubleshooting": How to fix something (keywords: fix, error, problem, issue)
- "example": User wants examples or use cases
- "general": General question (for structural, navigation, planning queries)

OUTPUT FORMAT (JSON only):
{
  "query_category": "content|lab_guidance|structural|navigation|planning|unrelated",
  "category_confidence": 0.0-1.0,
  "category_reasoning": "Brief explanation of category classification",
  "normalized_question": "Corrected and rephrased question",
  "primary_topic": "Main topic (for content queries) or null",
  "primary_topic_expanded": "Expanded form of primary topic (if applicable)",
  "main_topic_phrase": "Main topic phrase for display (e.g., 'AEO' or 'Chapter 2')",
  "primary_concepts": ["concept 1", "concept 2"],
  "secondary_concepts": [],
  "contextual_phrases": ["phrase 1", "phrase 2"],
  "key_concepts": ["concept 1", "concept 2"],  // For backward compatibility
  "intent_type": "definition|explanation|comparison|procedure|implementation|strategy|best_practices|troubleshooting|example|general",
  "intent_subtype": "subtype if applicable (e.g., 'implementation' for strategy queries)",
  "intent_confidence": 0.0-1.0,
  "intent_reasoning": "Brief explanation of intent classification",
  "additional_info": {
    "type": "navigation|planning|structural|lab_guidance",
    "chapter_number": 2,  // If applicable
    "lab_number": 3,  // If applicable
    "navigation_action": "skip",  // For navigation queries
    "planning_question": "time_estimate",  // For planning queries
    "structural_element": "chapters",  // For structural queries
    "guidance_type": "stuck",  // For lab guidance queries
    "question": "Original question context"
  },  // null for content queries
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

Input: "What do we need to differently to win in the current state of AEO?"
Output: {
  "normalized_question": "What do we need to do differently to win in the current state of answer engine optimization?",
  "key_concepts": ["aeo", "answer engine optimization"],
  "intent_type": "procedure",
  "confidence": 0.9,
  "original_question": "What do we need to differently to win in the current state of AEO?",
  "spelling_corrections": ["differently -> do differently"]
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

            // Build normalized object with new enhanced schema
            const normalized = {
                // Query category (NEW)
                query_category: parsed.query_category || 'content', // Default to content for backward compatibility
                category_confidence: typeof parsed.category_confidence === 'number' ? Math.max(0, Math.min(1, parsed.category_confidence)) : 0.8,
                category_reasoning: parsed.category_reasoning || '',
                
                // Basic fields
                normalized_question: parsed.normalized_question || originalQuestion,
                original_question: originalQuestion,
                confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
                spelling_corrections: Array.isArray(parsed.spelling_corrections) ? parsed.spelling_corrections : [],
                
                // Primary topic (NEW)
                primary_topic: parsed.primary_topic || null,
                primary_topic_expanded: parsed.primary_topic_expanded || null,
                main_topic_phrase: parsed.main_topic_phrase || parsed.primary_topic || null,
                
                // Concepts (ENHANCED)
                primary_concepts: Array.isArray(parsed.primary_concepts) ? parsed.primary_concepts : [],
                secondary_concepts: Array.isArray(parsed.secondary_concepts) ? parsed.secondary_concepts : [],
                contextual_phrases: Array.isArray(parsed.contextual_phrases) ? parsed.contextual_phrases : [],
                key_concepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [], // Backward compatibility
                
                // Intent (ENHANCED)
                intent_type: parsed.intent_type || 'general',
                intent_subtype: parsed.intent_subtype || null,
                intent_confidence: typeof parsed.intent_confidence === 'number' ? Math.max(0, Math.min(1, parsed.intent_confidence)) : 0.8,
                intent_reasoning: parsed.intent_reasoning || '',
                
                // Additional information (NEW - for non-content queries)
                additional_info: parsed.additional_info || null
            };
            
            // If primary_concepts is empty but key_concepts exists, use key_concepts as primary_concepts
            if (normalized.primary_concepts.length === 0 && normalized.key_concepts.length > 0) {
                normalized.primary_concepts = [...normalized.key_concepts];
            }
            
            // If primary_topic is null but primary_concepts has items, use first as primary_topic
            if (!normalized.primary_topic && normalized.primary_concepts.length > 0) {
                normalized.primary_topic = normalized.primary_concepts[0];
                normalized.main_topic_phrase = normalized.primary_concepts[0];
            }

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

            // Update concepts (only for content queries)
            if (normalized.query_category === 'content') {
                normalized.key_concepts = filtered.slice(0, 8);
                normalized.primary_concepts = normalized.primary_concepts.length > 0 
                    ? normalized.primary_concepts.filter(c => filtered.includes(c))
                    : filtered.slice(0, 5);
            } else {
                // For non-content queries, concepts may be empty or minimal
                normalized.key_concepts = filtered.slice(0, 3); // Keep minimal for backward compatibility
                normalized.primary_concepts = [];
            }
            
            // Debug: log final concepts
            if (normalized.key_concepts.some(c => stopWords.has(c.split(/\s+/)[0]))) {
                console.warn(`[QueryNormalizer] WARNING: Final concepts still contain stop words:`, normalized.key_concepts);
            }
            
            // Extract additional info for non-content queries if not provided by LLM
            if (normalized.query_category !== 'content' && !normalized.additional_info) {
                normalized.additional_info = this._extractAdditionalInfo(originalQuestion, normalized.query_category);
            }

            return normalized;
        } catch (error) {
            console.warn('[QueryNormalizerService] Failed to parse LLM response as JSON:', error);
            console.warn('[QueryNormalizerService] Raw response:', response);
            return this._createFallbackResult(originalQuestion);
        }
    }

    /**
     * Extract additional information for non-content queries
     * @param {string} question - Original question
     * @param {string} category - Query category
     * @returns {Object|null} Additional info object
     * @private
     */
    _extractAdditionalInfo(question, category) {
        const lower = question.toLowerCase();
        
        if (category === 'navigation') {
            // Extract chapter/lab numbers and navigation action
            const chapterMatch = lower.match(/chapter\s+(\d+)|ch\s*\.?\s*(\d+)/);
            const labMatch = lower.match(/lab\s+(\d+)/);
            const chapterNum = chapterMatch ? parseInt(chapterMatch[1] || chapterMatch[2]) : null;
            const labNum = labMatch ? parseInt(labMatch[1]) : null;
            
            let navigationAction = 'general';
            if (/(skip|skipping)/.test(lower)) navigationAction = 'skip';
            else if (/(prerequisite|required|need)/.test(lower)) navigationAction = 'prerequisite';
            else if (/(order|sequence|next|after)/.test(lower)) navigationAction = 'sequence';
            
            return {
                type: 'navigation',
                chapter_number: chapterNum,
                lab_number: labNum,
                navigation_action: navigationAction,
                question: question
            };
        }
        
        if (category === 'planning') {
            // Extract chapter/lab numbers and planning question type
            const chapterMatch = lower.match(/chapter\s+(\d+)|ch\s*\.?\s*(\d+)/);
            const labMatch = lower.match(/lab\s+(\d+)/);
            const chapterNum = chapterMatch ? parseInt(chapterMatch[1] || chapterMatch[2]) : null;
            const labNum = labMatch ? parseInt(labMatch[1]) : null;
            
            let planningQuestion = 'time_estimate';
            if (/(how\s+(much|long)\s+time|duration|time\s+estimate)/.test(lower)) planningQuestion = 'time_estimate';
            else if (/(schedule|timeline|plan)/.test(lower)) planningQuestion = 'schedule';
            
            return {
                type: 'planning',
                chapter_number: chapterNum,
                lab_number: labNum,
                planning_question: planningQuestion,
                question: question
            };
        }
        
        if (category === 'structural') {
            // Extract structural element
            let structuralElement = 'general';
            if (/(chapter|chapters)/.test(lower)) structuralElement = 'chapters';
            else if (/(lab|labs)/.test(lower)) structuralElement = 'labs';
            else if (/(day|days)/.test(lower)) structuralElement = 'days';
            else if (/(section|sections)/.test(lower)) structuralElement = 'sections';
            
            return {
                type: 'structural',
                structural_element: structuralElement,
                question: question
            };
        }
        
        if (category === 'lab_guidance') {
            // Extract lab number and guidance type
            const labMatch = lower.match(/lab\s+(\d+)/);
            const labNum = labMatch ? parseInt(labMatch[1]) : null;
            
            let guidanceType = 'help';
            if (/(stuck|stuck|blocked)/.test(lower)) guidanceType = 'stuck';
            else if (/(submit|submission)/.test(lower)) guidanceType = 'submission';
            else if (/(help|assistance)/.test(lower)) guidanceType = 'help';
            
            return {
                type: 'lab_guidance',
                lab_number: labNum,
                guidance_type: guidanceType,
                question: question
            };
        }
        
        return null;
    }

    /**
     * Create fallback result when normalization fails
     * @param {string} originalQuestion - Original question
     * @returns {Object} Fallback normalization result
     * @private
     */
    _createFallbackResult(originalQuestion) {
        // Try to infer category from question
        const category = this._inferCategory(originalQuestion);
        
        // Basic normalization: lowercase, trim, extract simple keywords
        const normalized = originalQuestion.trim();
        const keywords = normalized
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length >= 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'one', 'our', 'out', 'has', 'who', 'its', 'how', 'may', 'say', 'she', 'use', 'new', 'now', 'old', 'see', 'him', 'two', 'way', 'did', 'let', 'put', 'too', 'tell', 'me', 'about', 'what', 'is', 'does', 'do', 'this', 'that'].includes(w));

        return {
            query_category: category,
            category_confidence: 0.6,
            category_reasoning: 'Inferred from question structure',
            normalized_question: normalized,
            primary_topic: null,
            primary_topic_expanded: null,
            main_topic_phrase: null,
            primary_concepts: category === 'content' ? keywords.slice(0, 5) : [],
            secondary_concepts: [],
            contextual_phrases: [],
            key_concepts: category === 'content' ? keywords.slice(0, 5) : [], // Backward compatibility
            intent_type: this._inferIntentType(originalQuestion),
            intent_subtype: null,
            intent_confidence: 0.5,
            intent_reasoning: '',
            additional_info: category !== 'content' ? this._extractAdditionalInfo(originalQuestion, category) : null,
            confidence: 0.5,
            original_question: originalQuestion,
            spelling_corrections: []
        };
    }
    
    /**
     * Infer query category from question structure (fallback method)
     * @param {string} question - User question
     * @returns {string} Inferred category
     * @private
     */
    _inferCategory(question) {
        const lower = question.toLowerCase();
        
        // Lab guidance patterns
        if (/(stuck|help\s+with\s+lab|lab\s+\d+|assignment|submission)/.test(lower)) {
            return 'lab_guidance';
        }
        
        // Structural patterns
        if (/(how\s+many|what\s+chapters|course\s+structure|syllabus|outline)/.test(lower)) {
            return 'structural';
        }
        
        // Navigation patterns
        if (/(skip|can\s+i|should\s+i|order|sequence|prerequisite)/.test(lower)) {
            return 'navigation';
        }
        
        // Planning patterns
        if (/(how\s+(much|long)\s+time|duration|schedule|timeline|estimate)/.test(lower)) {
            return 'planning';
        }
        
        // Default to content
        return 'content';
    }

    /**
     * Create empty result for invalid input
     * @returns {Object} Empty normalization result
     * @private
     */
    _createEmptyResult() {
        return {
            query_category: 'content',
            category_confidence: 0.0,
            category_reasoning: '',
            normalized_question: '',
            primary_topic: null,
            primary_topic_expanded: null,
            main_topic_phrase: null,
            primary_concepts: [],
            secondary_concepts: [],
            contextual_phrases: [],
            key_concepts: [],
            intent_type: 'general',
            intent_subtype: null,
            intent_confidence: 0.0,
            intent_reasoning: '',
            additional_info: null,
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

