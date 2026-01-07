/**
 * Answer Renderer Service
 * 
 * Formats AI Coach responses using a standardized, empathetic template
 * that ensures every response:
 * - Feels personally understood
 * - Is clearly structured and easy to read
 * - Cites exact course references
 * - Encourages continued learning
 */

class AnswerRendererService {
    /**
     * Render a formatted answer following the standardized template
     * @param {Object} params - Rendering parameters
     * @param {string} params.coachName - AI Coach name (e.g., "John's AI Coach")
     * @param {string} params.normalizedIntent - Normalized user intent/question
     * @param {string} params.llmAnswer - Raw answer from LLM (explanation only)
     * @param {Array<Object>} params.resolvedNodes - Resolved content nodes
     * @param {Array<Object>} params.canonicalReferences - Canonical references (primary + secondary)
     * @param {Object} params.options - Additional options
     * @returns {string} Fully formatted answer following the template
     */
    render({
        coachName = 'AI Coach',
        normalizedIntent = '',
        llmAnswer = '',
        resolvedNodes = [],
        canonicalReferences = [],
        options = {}
    }) {
        // If no references, return early failure message
        if (!resolvedNodes || resolvedNodes.length === 0 || !canonicalReferences || canonicalReferences.length === 0) {
            return this._renderNoReferences(coachName);
        }

        // Build sections
        const sections = [];

        // 1. Coach Identity
        sections.push(this._renderCoachIdentity(coachName));

        // 2. Understanding Section (MANDATORY)
        sections.push(this._renderUnderstanding(normalizedIntent));

        // 3. Explanation Section (MANDATORY)
        sections.push(this._renderExplanation(llmAnswer, resolvedNodes));

        // 4. Importance Section (OPTIONAL - only if relevant)
        const importance = this._renderImportance(llmAnswer, resolvedNodes);
        if (importance) {
            sections.push(importance);
        }

        // 5. Reference Section - REMOVED
        // References are rendered separately by MessageBubble component with clickable links
        // Do NOT include references in the answer text to avoid duplication

        // 6. Engagement Section (MANDATORY)
        sections.push(this._renderEngagement(resolvedNodes, normalizedIntent));

        return sections.join('\n\n');
    }

    /**
     * Render coach identity section
     * @param {string} coachName - Coach name
     * @returns {string} Formatted coach identity
     * @private
     */
    _renderCoachIdentity(coachName) {
        return `🤖 ${coachName}`;
    }

    /**
     * Render understanding section
     * @param {string} normalizedIntent - Normalized user intent
     * @returns {string} Formatted understanding section
     * @private
     */
    _renderUnderstanding(normalizedIntent) {
        // Extract the core topic from normalized intent
        let understanding = normalizedIntent
            .replace(/\?$/, '') // Remove trailing question mark
            .trim();

        // Remove common question patterns (order matters - longer patterns first)
        // Handle "How do I perform/do/implement" patterns
        understanding = understanding
            .replace(/^(how do i|how can i|how should i|how to)\s+(perform|do|implement|apply|use|create|build|make|start|begin|get|achieve|accomplish|execute|carry out)\s+/i, '')
            .replace(/^(how do|how does|how can|how should|how to)\s+/i, '')
            .replace(/^(what is|what are|what does|what do|what was|what were)\s+/i, '')
            .replace(/^(can you|tell me|explain|describe|show me|help me)\s+/i, '')
            .replace(/^(what|how|why|when|where)\s+/i, '')
            .replace(/^(is|are|does|do|was|were)\s+/i, '') // Remove "is", "are", "does", "do" at start
            .replace(/^(i|you|we|they)\s+(perform|do|implement|apply|use|create|build|make|start|begin|get|achieve|accomplish|execute|carry out)\s+/i, '') // Remove "I perform", "you do", etc.
            .replace(/^(a|an|the)\s+/i, '') // Remove articles at start
            .trim();

        // If empty after cleaning, use a fallback
        if (!understanding || understanding.length === 0) {
            understanding = 'this topic';
        }

        // Ensure it doesn't start with verbs or pronouns (safety check)
        understanding = understanding
            .replace(/^(is|are|does|do|was|were|i|you|we|they)\s+/i, '')
            .trim();
        
        if (!understanding || understanding.length === 0) {
            understanding = 'this topic';
        }

        // Keep lowercase for natural flow (we'll use it in "about {topic}")
        // Don't capitalize - let it flow naturally in the sentence

        // If understanding is too long, simplify
        if (understanding.length > 80) {
            // Extract key phrase (first 60 chars + ellipsis)
            understanding = understanding.substring(0, 60).trim() + '...';
        }

        return `🔍 **What I understand from your question**

You're asking about ${understanding}. Let me break this down for you.`;
    }

    /**
     * Render explanation section
     * @param {string} llmAnswer - Raw LLM answer
     * @param {Array<Object>} nodes - Resolved nodes
     * @returns {string} Formatted explanation section
     * @private
     */
    _renderExplanation(llmAnswer, nodes) {
        // Clean and format the LLM answer
        let explanation = llmAnswer.trim();

        // Remove any remaining reference patterns (safety check)
        explanation = explanation.replace(/Day\s+\d+[^\n]*/gi, '');
        explanation = explanation.replace(/Chapter\s+[\w\d-]+/gi, '');
        explanation = explanation.replace(/\([^)]*Day[^)]*\)/gi, '');

        // Format as bullets if not already structured
        // If answer contains multiple sentences, convert to bullets
        const sentences = explanation.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
        
        if (sentences.length > 2) {
            // Convert to bullet points
            explanation = sentences
                .map(s => {
                    s = s.trim();
                    // Remove trailing punctuation
                    s = s.replace(/[.!?]+$/, '');
                    return `• ${s}`;
                })
                .join('\n');
        } else {
            // Keep as paragraph but ensure proper formatting
            explanation = explanation.replace(/\n{3,}/g, '\n\n');
        }

        return `📘 **Explanation**

${explanation}`;
    }

    /**
     * Render importance section (optional)
     * @param {string} llmAnswer - Raw LLM answer
     * @param {Array<Object>} nodes - Resolved nodes
     * @returns {string|null} Formatted importance section or null if not relevant
     * @private
     */
    _renderImportance(llmAnswer, nodes) {
        // Check if answer contains importance indicators
        const importanceKeywords = [
            'important', 'critical', 'essential', 'crucial', 'vital',
            'significance', 'impact', 'affects', 'influences', 'matters',
            'why this matters', 'benefit', 'advantage'
        ];

        const lowerAnswer = llmAnswer.toLowerCase();
        const hasImportance = importanceKeywords.some(keyword => lowerAnswer.includes(keyword));

        if (!hasImportance) {
            return null; // Skip if no importance indicators
        }

        // Extract importance statement (simplified)
        // Look for sentences containing importance keywords
        const sentences = llmAnswer.split(/[.!?]\s+/);
        const importanceSentence = sentences.find(s => {
            const lower = s.toLowerCase();
            return importanceKeywords.some(keyword => lower.includes(keyword));
        });

        if (!importanceSentence) {
            return null;
        }

        // Simplify and format
        let importance = importanceSentence.trim();
        importance = importance.replace(/[.!?]+$/, '');
        
        // Limit length
        if (importance.length > 120) {
            importance = importance.substring(0, 117).trim() + '...';
        }

        return `📌 **Why this matters**

${importance}`;
    }

    /**
     * Render references section
     * @param {Array<Object>} references - Canonical references
     * @returns {string} Formatted references section
     * @private
     */
    _renderReferences(references) {
        if (!references || references.length === 0) {
            return '';
        }

        // Format and deduplicate references with descriptive information
        const formattedRefs = references
            .filter(ref => ref !== null && ref !== undefined)
            .map(ref => {
                // Build a descriptive reference that helps users decide which to click
                const parts = [];
                
                // Day (always include if available)
                if (ref.day) {
                    parts.push(`Day ${ref.day}`);
                }
                
                // Container (Chapter or Lab) with number
                let containerLabel = '';
                if (ref.container_type === 'chapter') {
                    if (ref.container_id) {
                        // Extract chapter number from container_id (e.g., "day5-ch1" or "ch1")
                        const dayMatch = ref.container_id.match(/day\d+-ch(\d+)/i);
                        const simpleMatch = ref.container_id.match(/ch(\d+)/i);
                        const chapterNum = dayMatch ? dayMatch[1] : (simpleMatch ? simpleMatch[1] : null);
                        if (chapterNum) {
                            containerLabel = `Chapter ${chapterNum}`;
                        } else {
                            containerLabel = 'Chapter';
                        }
                    } else {
                        containerLabel = 'Chapter';
                    }
                } else if (ref.container_type === 'lab') {
                    if (ref.container_id) {
                        // Extract lab number from container_id (e.g., "day5-lab1" or "lab1")
                        const dayMatch = ref.container_id.match(/day\d+-lab(\d+)/i);
                        const simpleMatch = ref.container_id.match(/lab(\d+)/i);
                        const labNum = dayMatch ? dayMatch[1] : (simpleMatch ? simpleMatch[1] : null);
                        if (labNum) {
                            containerLabel = `Lab ${labNum}`;
                        } else {
                            containerLabel = 'Lab';
                        }
                    } else {
                        containerLabel = 'Lab';
                    }
                }
                
                if (containerLabel) {
                    parts.push(containerLabel);
                }
                
                // Container title (CRITICAL - makes references descriptive and clickable)
                // Clean up container_title to remove redundant prefixes
                let containerTitle = ref.container_title || '';
                if (containerTitle) {
                    // Remove redundant "Day X, Chapter Y" prefixes if they're already in parts
                    containerTitle = containerTitle
                        .replace(/^Day\s+\d+[,\s]+/i, '')
                        .replace(/^Chapter\s+\d+[,\s—\-]+/i, '')
                        .replace(/^Lab\s+\d+[,\s—\-]+/i, '')
                        .trim();
                    
                    // Remove em dashes and clean up
                    containerTitle = containerTitle.replace(/^[—\-]\s*/, '').trim();
                    
                    // Only add if it's meaningful and not just "Chapter" or "Lab"
                    if (containerTitle && 
                        containerTitle.length > 3 &&
                        !containerTitle.match(/^(Chapter|Lab|Day)\s*\d*$/i)) {
                        parts.push(containerTitle);
                    }
                }
                
                // Primary topic (if available) - makes it even more descriptive
                if (ref.primary_topic && ref.primary_topic.trim()) {
                    // Clean up primary_topic (remove redundant prefixes)
                    let topic = ref.primary_topic
                        .replace(/^Day\s+\d+[,\s]+/i, '')
                        .replace(/^Chapter\s+\d+[,\s—\-]+/i, '')
                        .replace(/^Lab\s+\d+[,\s—\-]+/i, '')
                        .replace(/^[—\-]\s*/, '')
                        .trim();
                    
                    // Only add if it's different from container_title and meaningful
                    if (topic && 
                        topic.length > 3 &&
                        topic !== containerTitle &&
                        !topic.match(/^(Chapter|Lab|Day)\s*\d*$/i)) {
                        // Add topic in parentheses or as additional context
                        // But only if we don't already have a good container_title
                        if (!containerTitle || containerTitle.length < 10) {
                            parts.push(topic);
                        }
                    }
                }
                
                // Build the final reference string
                let finalRef = parts.join(' → ');
                
                // If we have a good display_reference, prefer it if it's more descriptive
                if (ref.display_reference && 
                    ref.display_reference.trim() && 
                    ref.display_reference.length > 15 && // Must be substantial
                    !ref.display_reference.match(/^(Chapter|Lab)$/i) &&
                    !ref.display_reference.match(/^Day\s+\d+\s*→\s*Chapter$/i)) { // Not just "Day X → Chapter"
                    // Use display_reference if it's more descriptive
                    if (ref.display_reference.length > finalRef.length || finalRef.length < 15) {
                        finalRef = ref.display_reference;
                    }
                }
                
                // Ensure we have at least Day and Chapter/Lab
                if (finalRef.length < 10 && ref.day && containerLabel) {
                    finalRef = `Day ${ref.day} → ${containerLabel}`;
                    if (containerTitle && containerTitle.length > 3) {
                        finalRef += ` → ${containerTitle}`;
                    }
                }
                
                return finalRef.length > 0 ? finalRef : null;
            })
            .filter(ref => ref !== null && ref.trim().length > 0);

        // Deduplicate references (case-insensitive, but preserve original casing)
        const seen = new Set();
        const uniqueRefs = formattedRefs.filter(ref => {
            const key = ref.toLowerCase().trim();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });

        if (uniqueRefs.length === 0) {
            return '';
        }

        // Format with bullets and make them clickable/descriptive
        const bulletedRefs = uniqueRefs.map(ref => `• ${ref}`);

        return `📍 **Course Reference(s)**

${bulletedRefs.join('\n')}`;
    }

    /**
     * Render engagement section
     * @param {Array<Object>} nodes - Resolved nodes
     * @param {string} normalizedIntent - Normalized intent
     * @returns {string} Formatted engagement section
     * @private
     */
    _renderEngagement(nodes, normalizedIntent) {
        // Extract topic from nodes or intent
        const topic = this._extractTopic(nodes, normalizedIntent);
        
        // Generate 3-4 specific continuation options
        const options = this._generateContinuationOptions(topic, nodes);

        return `💬 **What would you like to explore next?**

${options.join('\n')}`;
    }

    /**
     * Extract topic from nodes or intent (general topic, not specific steps)
     * @param {Array<Object>} nodes - Resolved nodes
     * @param {string} normalizedIntent - Normalized intent
     * @returns {string} Extracted topic (general, user-friendly)
     * @private
     */
    _extractTopic(nodes, normalizedIntent) {
        // Try to get a general topic from nodes (prefer container_title over primary_topic)
        if (nodes && nodes.length > 0) {
            // Prefer container_title as it's usually more general (e.g., "On-Page SEO" vs "Step 2: Apply On-Page SEO Checklist")
            const containerTitle = nodes[0].container_title;
            if (containerTitle && containerTitle.trim()) {
                // Clean up container_title - remove step numbers, prefixes, etc.
                let topic = containerTitle
                    .replace(/^Day\s+\d+[,\s]+/i, '')
                    .replace(/^Chapter\s+\d+[,\s—\-]+/i, '')
                    .replace(/^Lab\s+\d+[,\s—\-]+/i, '')
                    .replace(/^[—\-]\s*/, '')
                    .replace(/^Step\s+\d+[:\s]+/i, '') // Remove "Step 2: " prefixes
                    .replace(/^Checkpoint\s+\d+[:\s]+/i, '') // Remove "Checkpoint 1: " prefixes
                    .trim();
                
                // Only use if it's a general topic (not a specific step)
                if (topic && 
                    topic.length > 3 &&
                    !topic.match(/^(Step|Checkpoint|Chapter|Lab|Day)\s+\d+/i) &&
                    topic.length < 50) { // Not too long (likely a specific step)
                    return topic;
                }
            }
            
            // Fallback to primary_topic, but clean it up
            if (nodes[0].primary_topic) {
                let topic = nodes[0].primary_topic
                    .replace(/^Day\s+\d+[,\s]+/i, '')
                    .replace(/^Chapter\s+\d+[,\s—\-]+/i, '')
                    .replace(/^Lab\s+\d+[,\s—\-]+/i, '')
                    .replace(/^[—\-]\s*/, '')
                    .replace(/^Step\s+\d+[:\s]+/i, '')
                    .replace(/^Checkpoint\s+\d+[:\s]+/i, '')
                    .trim();
                
                // Only use if it's general (not a specific step)
                if (topic && 
                    topic.length > 3 &&
                    !topic.match(/^(Step|Checkpoint)\s+\d+/i) &&
                    topic.length < 50) {
                    return topic;
                }
            }
        }

        // Fallback: extract from normalized intent
        let topic = normalizedIntent
            .replace(/^(what|how|why|when|where|can you|tell me|explain|describe|what is|what are|how do|how does|how can|how should|how to)\s+(is|are|does|do|can|should|to|i|you|we|they)\s+(perform|do|implement|apply|use|create|build|make|start|begin|get|achieve|accomplish|execute|carry out)\s+/i, '')
            .replace(/^(what|how|why|when|where|can you|tell me|explain|describe|what is|what are|how do|how does|how can|how should|how to)\s+/i, '')
            .replace(/^(is|are|does|do|can|should|to|i|you|we|they)\s+/i, '')
            .replace(/\?$/, '')
            .trim();

        return topic || 'this topic';
    }

    /**
     * Generate continuation options
     * @param {string} topic - Current topic
     * @param {Array<Object>} nodes - Resolved nodes
     * @returns {Array<string>} Formatted continuation options
     * @private
     */
    _generateContinuationOptions(topic, nodes) {
        const options = [];

        // Option 1: Related concepts
        if (nodes && nodes.length > 0) {
            const relatedConcept = nodes[0].primary_topic || topic;
            options.push(`• Learn more about related concepts in ${relatedConcept}`);
        }

        // Option 2: Practical application
        options.push(`• See how to apply ${topic} in practice`);

        // Option 3: Examples or use cases
        options.push(`• Explore examples of ${topic}`);

        // Option 4: Next steps or advanced topics
        options.push(`• Understand the next steps for mastering ${topic}`);

        // Limit to 4 options
        return options.slice(0, 4);
    }

    /**
     * Render no references response
     * @param {string} coachName - Coach name
     * @returns {string} Formatted no-references response
     * @private
     */
    _renderNoReferences(coachName) {
        return `🤖 ${coachName}

🔍 **What I understand from your question**

I understand you're looking for information on this topic.

Unfortunately, this topic is not covered in the current course material. Please check with your trainer or refer to the course content directly.

💬 **What would you like to explore next?**

• Ask about a different topic covered in the course
• Review your current progress and next steps
• Get help with a specific lab or assignment`;
    }
}

export const answerRendererService = new AnswerRendererService();

