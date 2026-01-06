/**
 * Concept Maturity Service
 * 
 * Classifies the maturity level of course concepts based on content depth,
 * presence of labs, coverage level, and dedicated chapters.
 * 
 * Maturity Levels:
 * - introduced: Concept is introduced conceptually, no implementation yet
 * - applied: Concept is applied with examples/practices, but not fully implemented
 * - implemented: Concept has full implementation coverage with labs/steps
 * - not_covered: Concept is not covered in the course
 */

class ConceptMaturityService {
    constructor() {
        // Maturity thresholds
        this.introducedMaxCompleteness = 0.4;
        this.appliedMinCompleteness = 0.4;
        this.appliedMaxCompleteness = 0.7;
        this.implementedMinCompleteness = 0.7;
    }

    /**
     * Classify concept maturity based on available chunks
     * @param {string} conceptName - Name of the concept (e.g., 'AEO', 'Technical SEO')
     * @param {Array<Object>} chunks - All chunks related to the concept
     * @returns {Object} Maturity classification result
     */
    async classifyMaturity(conceptName, chunks) {
        if (!chunks || chunks.length === 0) {
            return {
                maturity: 'not_covered',
                confidence: 1.0,
                reason: 'No chunks found for concept',
                signals: {
                    chunkCount: 0,
                    hasDedicatedChapter: false,
                    hasLabs: false,
                    maxCompleteness: 0,
                    maxCoverageLevel: null
                }
            };
        }

        // Filter chunks that are relevant to the concept
        const conceptLower = conceptName.toLowerCase();
        const relevantChunks = chunks.filter(chunk => {
            const primaryTopic = (chunk.primary_topic || '').toLowerCase();
            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
            const content = (chunk.content || '').toLowerCase();
            
            return primaryTopic.includes(conceptLower) ||
                   chapterTitle.includes(conceptLower) ||
                   content.includes(conceptLower) ||
                   (chunk.is_dedicated_topic_chapter && primaryTopic.includes(conceptLower));
        });

        if (relevantChunks.length === 0) {
            return {
                maturity: 'not_covered',
                confidence: 0.8,
                reason: 'No chunks explicitly mention the concept',
                signals: {
                    chunkCount: chunks.length,
                    relevantChunkCount: 0,
                    hasDedicatedChapter: false,
                    hasLabs: false,
                    maxCompleteness: 0,
                    maxCoverageLevel: null
                }
            };
        }

        // Extract signals
        const signals = this._extractMaturitySignals(relevantChunks, conceptName);

        // Classify based on signals
        const maturity = this._classifyFromSignals(signals);

        return {
            maturity,
            confidence: this._calculateMaturityConfidence(signals, maturity),
            reason: this._generateMaturityReason(maturity, signals),
            signals
        };
    }

    /**
     * Extract maturity signals from chunks
     * @param {Array<Object>} chunks - Relevant chunks
     * @param {string} conceptName - Concept name
     * @returns {Object} Maturity signals
     * @private
     */
    _extractMaturitySignals(chunks, conceptName) {
        const signals = {
            chunkCount: chunks.length,
            hasDedicatedChapter: false,
            hasLabs: false,
            hasStepByStep: false,
            maxCompleteness: 0,
            maxCoverageLevel: null,
            coverageLevels: [],
            completenessScores: [],
            hasImplementationContent: false,
            hasLabReferences: false
        };

        for (const chunk of chunks) {
            // Check for dedicated chapter
            if (chunk.is_dedicated_topic_chapter) {
                signals.hasDedicatedChapter = true;
            }

            // Check coverage level
            const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level || 'introduction';
            signals.coverageLevels.push(coverageLevel);
            if (!signals.maxCoverageLevel || this._compareCoverageLevels(coverageLevel, signals.maxCoverageLevel) > 0) {
                signals.maxCoverageLevel = coverageLevel;
            }

            // Check completeness score
            const completeness = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 0;
            signals.completenessScores.push(completeness);
            if (completeness > signals.maxCompleteness) {
                signals.maxCompleteness = completeness;
            }

            // Check for labs
            if (chunk.lab_id || chunk.content_type === 'lab' || (chunk.content || '').toLowerCase().includes('lab')) {
                signals.hasLabs = true;
                signals.hasLabReferences = true;
            }

            // Check for step-by-step content
            if (chunk.step_number || 
                (chunk.content || '').match(/step\s+\d+/i) ||
                (chunk.content || '').match(/^\d+\./m)) {
                signals.hasStepByStep = true;
            }

            // Check for implementation content
            const content = (chunk.content || '').toLowerCase();
            const implementationKeywords = [
                'implement', 'implementation', 'how to', 'step by step',
                'procedure', 'process', 'method', 'technique', 'approach',
                'execute', 'perform', 'apply', 'practice'
            ];
            if (implementationKeywords.some(keyword => content.includes(keyword))) {
                signals.hasImplementationContent = true;
            }
        }

        return signals;
    }

    /**
     * Classify maturity from signals
     * @param {Object} signals - Maturity signals
     * @returns {string} Maturity level
     * @private
     */
    _classifyFromSignals(signals) {
        // Implemented: Has dedicated chapter, labs, high completeness, step-by-step
        if (signals.hasDedicatedChapter && 
            signals.maxCompleteness >= this.implementedMinCompleteness &&
            (signals.hasLabs || signals.hasStepByStep || signals.hasImplementationContent)) {
            return 'implemented';
        }

        // Applied: Has some depth, examples, but not full implementation
        if (signals.maxCompleteness >= this.appliedMinCompleteness &&
            signals.maxCompleteness < this.implementedMinCompleteness &&
            (signals.hasDedicatedChapter || signals.maxCoverageLevel === 'intermediate' || signals.maxCoverageLevel === 'comprehensive')) {
            return 'applied';
        }

        // Introduced: Low completeness, introduction-level coverage
        if (signals.maxCompleteness <= this.introducedMaxCompleteness &&
            (signals.maxCoverageLevel === 'introduction' || !signals.hasDedicatedChapter)) {
            return 'introduced';
        }

        // Applied (fallback): Medium completeness without clear implementation
        if (signals.maxCompleteness >= this.appliedMinCompleteness) {
            return 'applied';
        }

        // Introduced (fallback): Everything else
        return 'introduced';
    }

    /**
     * Calculate confidence in maturity classification
     * @param {Object} signals - Maturity signals
     * @param {string} maturity - Classified maturity level
     * @returns {number} Confidence score (0-1)
     * @private
     */
    _calculateMaturityConfidence(signals, maturity) {
        let confidence = 0.5; // Base confidence

        // Boost confidence based on clear signals
        if (signals.hasDedicatedChapter) {
            confidence += 0.2;
        }
        if (signals.hasLabs) {
            confidence += 0.15;
        }
        if (signals.hasStepByStep) {
            confidence += 0.1;
        }
        if (signals.chunkCount >= 3) {
            confidence += 0.1;
        }

        // Adjust based on maturity level
        if (maturity === 'implemented' && signals.hasDedicatedChapter && signals.hasLabs) {
            confidence = Math.min(1.0, confidence + 0.1);
        } else if (maturity === 'introduced' && signals.maxCoverageLevel === 'introduction' && signals.maxCompleteness < 0.3) {
            confidence = Math.min(1.0, confidence + 0.1);
        }

        return Math.min(1.0, Math.max(0.3, confidence));
    }

    /**
     * Generate human-readable reason for maturity classification
     * @param {string} maturity - Maturity level
     * @param {Object} signals - Maturity signals
     * @returns {string} Reason
     * @private
     */
    _generateMaturityReason(maturity, signals) {
        switch (maturity) {
            case 'implemented':
                return `Concept has dedicated chapter (completeness: ${signals.maxCompleteness.toFixed(2)}) with ${signals.hasLabs ? 'labs' : 'implementation content'}`;
            case 'applied':
                return `Concept is applied with examples (completeness: ${signals.maxCompleteness.toFixed(2)}, coverage: ${signals.maxCoverageLevel})`;
            case 'introduced':
                return `Concept is introduced conceptually (completeness: ${signals.maxCompleteness.toFixed(2)}, coverage: ${signals.maxCoverageLevel})`;
            case 'not_covered':
                return 'Concept is not covered in the course';
            default:
                return 'Unknown maturity level';
        }
    }

    /**
     * Compare coverage levels (higher = more comprehensive)
     * @param {string} level1 - First coverage level
     * @param {string} level2 - Second coverage level
     * @returns {number} Comparison result (-1, 0, 1)
     * @private
     */
    _compareCoverageLevels(level1, level2) {
        const levels = {
            'introduction': 1,
            'intermediate': 2,
            'comprehensive': 3,
            'advanced': 4
        };
        const val1 = levels[level1] || 0;
        const val2 = levels[level2] || 0;
        return val1 - val2;
    }
}

export const conceptMaturityService = new ConceptMaturityService();

