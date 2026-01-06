/**
 * Depth Classifier Service
 * 
 * Classifies queries by depth type to determine the expected answer structure
 * and content requirements.
 * 
 * Depth Types:
 * - definition: "What is X?" - Requires concise definition
 * - conceptual: "Why does X work?" - Requires explanation of concepts
 * - procedural: "How to do X?" - Requires step-by-step implementation
 * - troubleshooting: "Why is X not working?" - Requires diagnostic steps
 * - comparison: "What's the difference between X and Y?" - Requires comparison
 */

class DepthClassifierService {
    constructor() {
        // Procedural indicators (must be step-by-step)
        this.proceduralIndicators = [
            'how to', 'how do', 'how can', 'how should',
            'step by step', 'step-by-step', 'steps to',
            'guide to', 'tutorial', 'walkthrough',
            'implement', 'implementation', 'execute', 'perform',
            'create', 'build', 'setup', 'set up', 'configure',
            'install', 'deploy', 'run', 'apply'
        ];

        // Definition indicators
        this.definitionIndicators = [
            'what is', 'what are', 'what does', 'what do',
            'define', 'definition', 'meaning of', 'meaning',
            'explain what', 'tell me what'
        ];

        // Conceptual indicators
        this.conceptualIndicators = [
            'why', 'why does', 'why do', 'why is', 'why are',
            'how does', 'how is', 'how are',
            'explain', 'explanation', 'understand',
            'concept', 'conceptual', 'theory', 'theoretical',
            'principle', 'principles', 'mechanism', 'mechanisms'
        ];

        // Troubleshooting indicators
        this.troubleshootingIndicators = [
            'not working', 'not working?', 'doesn\'t work', 'not working',
            'error', 'errors', 'issue', 'issues', 'problem', 'problems',
            'fix', 'fixing', 'broken', 'failing', 'failed',
            'troubleshoot', 'troubleshooting', 'debug', 'debugging',
            'why isn\'t', 'why isn\'t it', 'why is it not',
            'what\'s wrong', 'what went wrong'
        ];

        // Comparison indicators
        this.comparisonIndicators = [
            'difference', 'differences', 'compare', 'comparison',
            'versus', 'vs', 'vs.', 'vs ', 'vs. ',
            'better', 'best', 'which is better',
            'similar', 'similarities', 'same', 'different',
            'between', 'among', 'versus'
        ];
    }

    /**
     * Classify query depth type
     * @param {string} question - User question
     * @param {string} intent - Intent classification (from query processor)
     * @returns {Object} Depth classification result
     */
    classifyDepth(question, intent = null) {
        const lowerQuestion = question.toLowerCase().trim();
        
        // Initialize result
        const result = {
            depthType: 'conceptual', // Default
            confidence: 0.5,
            indicators: [],
            requiresStepByStep: false,
            requiresImplementation: false,
            requiresComparison: false
        };

        // Check for procedural indicators (highest priority - "how to" is very specific)
        const proceduralMatches = this.proceduralIndicators.filter(indicator => 
            lowerQuestion.includes(indicator)
        );
        
        if (proceduralMatches.length > 0) {
            result.depthType = 'procedural';
            result.confidence = 0.9;
            result.indicators = proceduralMatches;
            result.requiresStepByStep = true;
            result.requiresImplementation = true;
            return result;
        }

        // Check for troubleshooting indicators
        const troubleshootingMatches = this.troubleshootingIndicators.filter(indicator => 
            lowerQuestion.includes(indicator)
        );
        
        if (troubleshootingMatches.length > 0) {
            result.depthType = 'troubleshooting';
            result.confidence = 0.85;
            result.indicators = troubleshootingMatches;
            result.requiresStepByStep = true; // Troubleshooting often needs steps
            return result;
        }

        // Check for comparison indicators
        const comparisonMatches = this.comparisonIndicators.filter(indicator => 
            lowerQuestion.includes(indicator)
        );
        
        if (comparisonMatches.length > 0) {
            result.depthType = 'comparison';
            result.confidence = 0.8;
            result.indicators = comparisonMatches;
            result.requiresComparison = true;
            return result;
        }

        // Check for definition indicators
        const definitionMatches = this.definitionIndicators.filter(indicator => 
            lowerQuestion.startsWith(indicator) || // Definitions often start with "what is"
            lowerQuestion.includes(` ${indicator} `) // Or contain "what is" as a phrase
        );
        
        if (definitionMatches.length > 0) {
            result.depthType = 'definition';
            result.confidence = 0.75;
            result.indicators = definitionMatches;
            return result;
        }

        // Check for conceptual indicators
        const conceptualMatches = this.conceptualIndicators.filter(indicator => 
            lowerQuestion.includes(indicator)
        );
        
        if (conceptualMatches.length > 0) {
            result.depthType = 'conceptual';
            result.confidence = 0.7;
            result.indicators = conceptualMatches;
            return result;
        }

        // Default: conceptual (for general questions)
        return result;
    }

    /**
     * Validate if chunks meet procedural requirements
     * @param {Array<Object>} chunks - Selected chunks
     * @param {Object} depthClassification - Depth classification result
     * @returns {Object} Validation result
     */
    validateProceduralRequirements(chunks, depthClassification) {
        if (depthClassification.depthType !== 'procedural') {
            return { passed: true }; // Not a procedural query
        }

        // Procedural queries MUST have:
        // 1. Implementation-focused chunks (not just conceptual)
        // 2. Step-by-step content
        // 3. Reference to implementation chapters

        const hasImplementationChunks = chunks.some(chunk => {
            const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
            const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
            const content = (chunk.content || '').toLowerCase();

            // Check for implementation indicators
            const hasImplementationIndicators = 
                coverageLevel === 'comprehensive' || 
                coverageLevel === 'advanced' ||
                primaryTopic.includes('implementation') ||
                primaryTopic.includes('how to') ||
                chapterTitle.includes('implementation') ||
                chapterTitle.includes('how to') ||
                content.includes('step 1') ||
                content.includes('step 2') ||
                content.includes('first,') ||
                content.includes('then,') ||
                content.includes('next,') ||
                content.includes('finally,');

            return hasImplementationIndicators;
        });

        const hasStepByStepContent = chunks.some(chunk => {
            const content = (chunk.content || '').toLowerCase();
            // Check for step-by-step patterns
            const stepPatterns = [
                /step\s+\d+/i,
                /step\s+by\s+step/i,
                /first[,\s]+\w+[,\s]+then/i,
                /\d+\.\s+\w+/i, // Numbered list
                /first[,\s]+\w+[,\s]+second/i
            ];
            return stepPatterns.some(pattern => pattern.test(content));
        });

        const hasImplementationChapters = chunks.some(chunk => {
            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
            const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
            
            return chapterTitle.includes('implementation') ||
                   chapterTitle.includes('how to') ||
                   chapterTitle.includes('guide') ||
                   chapterTitle.includes('tutorial') ||
                   primaryTopic.includes('implementation');
        });

        // Check if chunks are purely conceptual (coverage_level='introduction' with low completeness)
        const hasOnlyConceptual = chunks.every(chunk => {
            const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
            const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 1.0;
            return coverageLevel === 'introduction' && completenessScore < 0.4;
        });

        if (hasOnlyConceptual) {
            return {
                passed: false,
                reason: 'Procedural query requires implementation content, but only conceptual/introductory chunks found.',
                missingRequirements: ['implementation_content', 'step_by_step'],
                hasImplementationChunks: false,
                hasStepByStepContent: false,
                hasImplementationChapters: false
            };
        }

        if (!hasImplementationChunks && !hasStepByStepContent) {
            return {
                passed: false,
                reason: 'Procedural query requires step-by-step implementation content, but chunks lack implementation details.',
                missingRequirements: ['implementation_content', 'step_by_step'],
                hasImplementationChunks: false,
                hasStepByStepContent: false,
                hasImplementationChapters: hasImplementationChapters
            };
        }

        if (!hasStepByStepContent) {
            return {
                passed: false,
                reason: 'Procedural query requires step-by-step structure, but chunks do not contain step-by-step content.',
                missingRequirements: ['step_by_step'],
                hasImplementationChunks: hasImplementationChunks,
                hasStepByStepContent: false,
                hasImplementationChapters: hasImplementationChapters
            };
        }

        // All requirements met
        return {
            passed: true,
            hasImplementationChunks,
            hasStepByStepContent,
            hasImplementationChapters
        };
    }
}

export const depthClassifierService = new DepthClassifierService();

