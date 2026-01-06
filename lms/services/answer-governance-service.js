/**
 * Answer Governance Service
 * 
 * Enforces non-negotiable answer invariants and decides whether the system
 * is allowed to generate an answer. Acts as a gatekeeper between intent
 * classification and answer generation.
 * 
 * This service does NOT call the LLM. It only evaluates:
 * - Question
 * - Retrieved chunks
 * - Intent classification
 * - Specific references
 * 
 * Responsibilities:
 * 1. Enforce non-negotiable answer invariants
 * 2. Decide whether the system is allowed to answer
 * 3. Decide whether to retry, ask clarification, escalate, or block
 */

class AnswerGovernanceService {
    constructor() {
        // Configuration thresholds
        this.minChunksRequired = 1;
        this.minChunksForComprehensive = 3;
        this.minSimilarityThreshold = 0.3; // Minimum similarity for chunks
        this.minDedicatedChunkSimilarity = 0.7; // For dedicated chapters
        this.maxChunksForRetry = 50; // If we have too many chunks, might need refinement
        
        // Coverage level requirements
        this.requiredCoverageForTopics = {
            'comprehensive': ['comprehensive', 'advanced'],
            'intermediate': ['comprehensive', 'advanced', 'intermediate'],
            'introduction': ['introduction', 'intermediate', 'comprehensive', 'advanced'] // Accept any
        };
    }

    /**
     * Main governance check - evaluates if answer generation should proceed
     * @param {Object} params - Governance evaluation parameters
     * @param {string} params.question - Original user question
     * @param {string} params.processedQuestion - Preprocessed question
     * @param {string} params.intent - Intent classification (course_content, lab_guidance, etc.)
     * @param {Array<Object>} params.selectedChunks - Chunks selected for answer generation
     * @param {Array<Object>} params.allRetrievedChunks - All chunks retrieved (before filtering)
     * @param {Object} params.specificReferences - Parsed specific references (Day, Chapter, Lab, Step)
     * @param {Array<string>} params.topicKeywords - Extracted topic keywords
     * @param {Array<string>} params.topicModifiers - Topic modifiers that require strict topic-specific content
     * @param {Object} params.depthClassification - Query depth type classification (procedural, conceptual, etc.)
     * @param {Object} params.context - Full context (progress, course structure)
     * @param {Object} params.primaryReferenceChunk - Primary reference chunk (for named concepts)
     * @param {Object} params.referenceSelectionResult - Primary reference selection result
     * @returns {Promise<Object>} Governance decision
     */
    async evaluateAnswerReadiness(params) {
        const {
            question,
            processedQuestion,
            intent,
            selectedChunks,
            allRetrievedChunks,
            specificReferences,
            topicKeywords,
            topicModifiers = [],
            depthClassification = null,
            context,
            primaryReferenceChunk = null,
            referenceSelectionResult = null
        } = params;

        console.log('[AnswerGovernance] Evaluating answer readiness...', {
            intent,
            selectedChunksCount: selectedChunks.length,
            allRetrievedChunksCount: allRetrievedChunks.length,
            hasSpecificReferences: specificReferences?.hasSpecificReference,
            topicKeywordsCount: topicKeywords?.length || 0
        });

        // Initialize result
        const result = {
            allowed: false,
            reason: null,
            action: 'block', // 'allow', 'retry', 'clarify', 'escalate', 'block'
            actionDetails: null,
            violations: [],
            warnings: [],
            recommendations: []
        };

        // Check 1: Minimum chunks required
        const chunkCheck = this._checkMinimumChunks(selectedChunks, intent);
        if (!chunkCheck.passed) {
            result.reason = chunkCheck.reason;
            result.violations.push({
                type: 'insufficient_chunks',
                severity: 'high',
                message: chunkCheck.reason
            });
            result.action = 'block';
            return result;
        }

        // IMMUTABLE INVARIANTS - These are non-negotiable and must pass
        // Invariant 1: Lab Safety
        const labSafetyCheck = this._invariantLabSafety(processedQuestion, specificReferences, selectedChunks, allRetrievedChunks);
        if (!labSafetyCheck.passed) {
            result.reason = labSafetyCheck.reason;
            result.violations.push({
                type: 'invariant_lab_safety',
                severity: 'critical',
                message: labSafetyCheck.reason,
                invariant: 'Lab Safety'
            });
            result.action = labSafetyCheck.action || 'block';
            result.actionDetails = labSafetyCheck.actionDetails;
            return result; // IMMUTABLE - cannot proceed
        }

        // Invariant 2: Topic Integrity (Enhanced with topic modifiers)
        const topicIntegrityCheck = this._invariantTopicIntegrity(processedQuestion, topicKeywords, selectedChunks, allRetrievedChunks, topicModifiers);
        if (!topicIntegrityCheck.passed) {
            result.reason = topicIntegrityCheck.reason;
            result.violations.push({
                type: 'invariant_topic_integrity',
                severity: 'critical',
                message: topicIntegrityCheck.reason,
                invariant: 'Topic Integrity'
            });
            result.action = topicIntegrityCheck.action || 'block';
            result.actionDetails = topicIntegrityCheck.actionDetails;
            
            // If blocking due to missing topic-specific content, use specific message
            if (topicIntegrityCheck.actionDetails?.userMessage) {
                result.actionDetails.userMessage = topicIntegrityCheck.actionDetails.userMessage;
            } else if (topicIntegrityCheck.actionDetails?.message) {
                result.actionDetails.userMessage = topicIntegrityCheck.actionDetails.message;
            }
            
            return result; // IMMUTABLE - cannot proceed
        }

        // Invariant 3: Reference Integrity
        const referenceIntegrityCheck = this._invariantReferenceIntegrity(specificReferences, selectedChunks, allRetrievedChunks);
        if (!referenceIntegrityCheck.passed) {
            result.reason = referenceIntegrityCheck.reason;
            result.violations.push({
                type: 'invariant_reference_integrity',
                severity: 'critical',
                message: referenceIntegrityCheck.reason,
                invariant: 'Reference Integrity'
            });
            result.action = referenceIntegrityCheck.action || 'block';
            result.actionDetails = referenceIntegrityCheck.actionDetails;
            return result; // IMMUTABLE - cannot proceed
        }

        // Invariant 4: Course Scope
        // Detect concepts for course scope validation (to allow low similarity for dedicated chunks)
        const conceptDetectionForScope = this._detectCourseConcepts(question);
        const courseScopeCheck = this._invariantCourseScope(selectedChunks, intent, question, conceptDetectionForScope);
        if (!courseScopeCheck.passed) {
            result.reason = courseScopeCheck.reason;
            result.violations.push({
                type: 'invariant_course_scope',
                severity: 'critical',
                message: courseScopeCheck.reason,
                invariant: 'Course Scope'
            });
            result.action = 'block';
            result.actionDetails = courseScopeCheck.actionDetails;
            return result; // IMMUTABLE - cannot proceed
        }

        // Invariant 5: Course Anchoring (Maturity-Aware)
        // Only applies to course_content queries
        if (intent === 'course_content') {
            const courseAnchoringCheck = await this._invariantCourseAnchoring(
                question,
                processedQuestion,
                selectedChunks,
                allRetrievedChunks,
                topicKeywords,
                primaryReferenceChunk,
                referenceSelectionResult
            );
            if (!courseAnchoringCheck.passed) {
                result.reason = courseAnchoringCheck.reason;
                result.violations.push({
                    type: 'invariant_course_anchoring',
                    severity: 'critical',
                    message: courseAnchoringCheck.reason,
                    invariant: 'Course Anchoring'
                });
                result.action = courseAnchoringCheck.action || 'retry';
                result.actionDetails = courseAnchoringCheck.actionDetails;
                // Store anchoring info for retry logic
                result.anchoringInfo = courseAnchoringCheck.anchoringInfo;
                // Only escalate if shouldEscalate is true (not for introduced/applied concepts)
                if (courseAnchoringCheck.anchoringInfo?.shouldEscalate === false) {
                    result.shouldEscalate = false; // Override escalation for introduced/applied concepts
                }
                return result; // IMMUTABLE - cannot proceed without anchoring
            } else if (courseAnchoringCheck.anchoringInfo) {
                // Store anchoring info for prompt conditioning and reference validation
                result.anchoringInfo = courseAnchoringCheck.anchoringInfo;
                // Store shouldEscalate flag
                if (courseAnchoringCheck.anchoringInfo.shouldEscalate === false) {
                    result.shouldEscalate = false; // Prevent escalation for introduced/applied concepts
                }
                // Add warnings if present
                if (courseAnchoringCheck.warnings) {
                    result.warnings.push(...courseAnchoringCheck.warnings);
                }
            }
        }

        // Check 5: Depth Type Requirements (especially for procedural queries)
        // Procedural queries MUST meet contract: step-by-step structure + implementation chapters
        if (depthClassification && depthClassification.depthType === 'procedural') {
            const proceduralCheck = this._validateProceduralContract(depthClassification, selectedChunks, allRetrievedChunks);
            if (!proceduralCheck.passed) {
                // Procedural contract violation - determine action based on severity
                if (proceduralCheck.severity === 'critical') {
                    // CRITICAL: Block answer generation
                    result.reason = proceduralCheck.reason;
                    result.violations.push({
                        type: 'procedural_contract_violation',
                        severity: 'critical',
                        message: proceduralCheck.reason,
                        invariant: 'Procedural Contract'
                    });
                    result.action = proceduralCheck.action || 'block';
                    result.actionDetails = proceduralCheck.actionDetails;
                    return result; // IMMUTABLE - cannot proceed
                } else if (proceduralCheck.severity === 'high') {
                    // HIGH: Escalate or block (implementation chunks exist but weren't selected)
                    result.reason = proceduralCheck.reason;
                    result.warnings.push({
                        type: 'procedural_contract_violation',
                        severity: 'high',
                        message: proceduralCheck.reason
                    });
                    result.action = proceduralCheck.action || 'escalate';
                    result.actionDetails = proceduralCheck.actionDetails;
                    // For high severity, also block to prevent poor answers
                    return result; // IMMUTABLE - cannot proceed
                } else {
                    // MEDIUM: Ask for clarification
                    result.reason = proceduralCheck.reason;
                    result.warnings.push({
                        type: 'procedural_contract_violation',
                        severity: 'medium',
                        message: proceduralCheck.reason
                    });
                    result.action = proceduralCheck.action || 'clarify';
                    result.actionDetails = proceduralCheck.actionDetails;
                    return result; // Ask for clarification before proceeding
                }
            }
        }

        // Check 2: Specific reference validation
        if (specificReferences?.hasSpecificReference) {
            const referenceCheck = this._validateSpecificReferences(
                specificReferences,
                selectedChunks,
                allRetrievedChunks
            );
            if (!referenceCheck.passed) {
                result.reason = referenceCheck.reason;
                result.violations.push({
                    type: 'reference_mismatch',
                    severity: 'high',
                    message: referenceCheck.reason
                });
                result.action = referenceCheck.action || 'clarify';
                result.actionDetails = referenceCheck.actionDetails;
                return result;
            }
        }

        // Check 3: Topic coverage validation
        if (topicKeywords && topicKeywords.length > 0) {
            const topicCheck = this._validateTopicCoverage(
                topicKeywords,
                selectedChunks,
                intent
            );
            if (!topicCheck.passed) {
                result.warnings.push({
                    type: 'topic_coverage_weak',
                    severity: topicCheck.severity,
                    message: topicCheck.reason
                });
                // Don't block, but flag for escalation or retry
                if (topicCheck.severity === 'high') {
                    result.action = 'escalate';
                    result.actionDetails = {
                        reason: 'Weak topic coverage despite dedicated chapter search',
                        topicKeywords,
                        chunksFound: selectedChunks.length
                    };
                }
            }
        }

        // Check 4: Chunk quality validation
        const qualityCheck = this._validateChunkQuality(selectedChunks, intent);
        if (!qualityCheck.passed) {
            result.warnings.push({
                type: 'chunk_quality_low',
                severity: qualityCheck.severity,
                message: qualityCheck.reason
            });
            if (qualityCheck.severity === 'high') {
                result.action = 'retry';
                result.actionDetails = {
                    reason: 'Low quality chunks detected, may need better retrieval',
                    recommendations: qualityCheck.recommendations
                };
            }
        }

        // Check 5: Intent-specific validations
        const intentCheck = this._validateIntentSpecificRules(intent, selectedChunks, question);
        if (!intentCheck.passed) {
            result.violations.push({
                type: 'intent_validation_failed',
                severity: intentCheck.severity,
                message: intentCheck.reason
            });
            result.action = intentCheck.action || 'block';
            result.actionDetails = intentCheck.actionDetails;
            return result;
        }

        // Check 6: Dedicated chapter validation (for topic questions)
        if (topicKeywords && topicKeywords.length > 0 && intent === 'course_content') {
            const dedicatedCheck = this._validateDedicatedChapterPresence(
                topicKeywords,
                selectedChunks,
                allRetrievedChunks
            );
            if (!dedicatedCheck.passed) {
                result.warnings.push({
                    type: 'dedicated_chapter_missing',
                    severity: 'medium',
                    message: dedicatedCheck.reason
                });
                // Suggest retry with better search
                if (dedicatedCheck.shouldRetry) {
                    result.action = 'retry';
                    result.actionDetails = {
                        reason: 'Dedicated chapter not found, may need better search',
                        topicKeywords
                    };
                }
            }
        }

        // Check 7: Similarity threshold validation
        const similarityCheck = this._validateSimilarityThresholds(selectedChunks, intent);
        if (!similarityCheck.passed) {
            result.warnings.push({
                type: 'low_similarity',
                severity: similarityCheck.severity,
                message: similarityCheck.reason
            });
            if (similarityCheck.severity === 'high') {
                result.action = 'escalate';
                result.actionDetails = {
                    reason: 'Chunks have very low similarity to question',
                    averageSimilarity: similarityCheck.averageSimilarity
                };
            }
        }

        // All checks passed
        if (result.violations.length === 0) {
            result.allowed = true;
            result.action = 'allow';
            result.reason = 'All governance checks passed';
            
            // Add recommendations if warnings exist
            if (result.warnings.length > 0) {
                result.recommendations = this._generateRecommendations(result.warnings);
            }
        } else {
            // Has violations - determine final action
            result.action = this._determineAction(result.violations, result.warnings);
        }

        console.log('[AnswerGovernance] Evaluation complete:', {
            allowed: result.allowed,
            action: result.action,
            violations: result.violations.length,
            warnings: result.warnings.length
        });

        return result;
    }

    /**
     * Check if minimum chunks are available
     * @private
     */
    _checkMinimumChunks(chunks, intent) {
        if (!chunks || chunks.length === 0) {
            return {
                passed: false,
                reason: 'No chunks available for answer generation'
            };
        }

        if (chunks.length < this.minChunksRequired) {
            return {
                passed: false,
                reason: `Insufficient chunks: ${chunks.length} (minimum: ${this.minChunksRequired})`
            };
        }

        // For comprehensive questions, prefer more chunks
        if (intent === 'course_content' && chunks.length < this.minChunksForComprehensive) {
            return {
                passed: true, // Don't block, but warn
                warning: `Only ${chunks.length} chunks available (recommended: ${this.minChunksForComprehensive} for comprehensive answers)`
            };
        }

        return { passed: true };
    }

    /**
     * Validate that specific references match retrieved chunks
     * @private
     */
    _validateSpecificReferences(references, selectedChunks, allRetrievedChunks) {
        const { day, chapter, lab, step } = references;
        
        // Check if exact matches were found
        const hasExactMatch = selectedChunks.some(chunk => chunk.exactMatch === true);
        
        if (!hasExactMatch) {
            // Check if any chunks match the references at all
            const matchingChunks = selectedChunks.filter(chunk => {
                let matches = true;
                if (day !== null && day !== undefined) {
                    const chunkDay = parseInt(chunk.day) || chunk.day;
                    if (chunkDay !== day && !String(chunkDay).includes(String(day))) {
                        matches = false;
                    }
                }
                if (chapter !== null && chapter !== undefined && matches) {
                    const chunkChapter = chunk.chapter_id || chunk.chapter;
                    if (!String(chunkChapter).includes(String(chapter))) {
                        matches = false;
                    }
                }
                if (lab !== null && lab !== undefined && matches) {
                    const chunkLab = chunk.lab_id || chunk.lab;
                    if (!chunkLab || !String(chunkLab).includes(String(lab))) {
                        matches = false;
                    }
                }
                return matches;
            });

            if (matchingChunks.length === 0) {
                return {
                    passed: false,
                    reason: `No chunks found matching specific references: Day ${day || 'N/A'}, Chapter ${chapter || 'N/A'}, Lab ${lab || 'N/A'}`,
                    action: 'clarify',
                    actionDetails: {
                        requestedReferences: references,
                        chunksAvailable: allRetrievedChunks.length,
                        suggestion: 'Please verify the reference or try rephrasing without specific references'
                    }
                };
            } else {
                // Some matches but not exact - warn
                return {
                    passed: true,
                    warning: `Partial matches found for references, but no exact matches`
                };
            }
        }

        return { passed: true };
    }

    /**
     * Validate that chunks cover the requested topics
     * @private
     */
    _validateTopicCoverage(topicKeywords, chunks, intent) {
        if (chunks.length === 0) {
            return {
                passed: false,
                severity: 'high',
                reason: 'No chunks available to validate topic coverage'
            };
        }

        // Check if any chunks are dedicated to the topic
        const dedicatedChunks = chunks.filter(chunk => 
            chunk.is_dedicated_topic_chapter || 
            chunk.isDedicatedTopicMatch ||
            chunk.metadata?.is_dedicated_topic_chapter
        );

        // Check if chunks contain topic keywords
        const chunksWithTopics = chunks.filter(chunk => {
            const content = (chunk.content || '').toLowerCase();
            const title = (chunk.chapter_title || '').toLowerCase();
            const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
            
            return topicKeywords.some(topic => {
                const topicLower = topic.toLowerCase();
                return content.includes(topicLower) || 
                       title.includes(topicLower) || 
                       primaryTopic.includes(topicLower);
            });
        });

        if (dedicatedChunks.length === 0 && chunksWithTopics.length < chunks.length * 0.5) {
            return {
                passed: false,
                severity: 'high',
                reason: `Weak topic coverage: Only ${chunksWithTopics.length}/${chunks.length} chunks contain topic keywords, and no dedicated chapters found`
            };
        }

        if (dedicatedChunks.length === 0 && chunksWithTopics.length < chunks.length) {
            return {
                passed: true,
                severity: 'medium',
                warning: `No dedicated chapters found for topics: ${topicKeywords.join(', ')}`
            };
        }

        return { passed: true };
    }

    /**
     * Validate chunk quality (coverage level, completeness)
     * @private
     */
    _validateChunkQuality(chunks, intent) {
        if (chunks.length === 0) {
            return {
                passed: false,
                severity: 'high',
                reason: 'No chunks to validate'
            };
        }

        const recommendations = [];
        
        // Check coverage levels
        const coverageLevels = chunks.map(chunk => 
            chunk.coverage_level || chunk.metadata?.coverage_level
        ).filter(Boolean);

        const hasComprehensive = coverageLevels.some(level => 
            level === 'comprehensive' || level === 'advanced'
        );
        const allIntroduction = coverageLevels.length > 0 && 
                               coverageLevels.every(level => level === 'introduction');

        if (allIntroduction && intent === 'course_content') {
            return {
                passed: false,
                severity: 'high',
                reason: 'All chunks are introduction-level, but question likely requires comprehensive coverage',
                recommendations: ['Retry with broader search', 'Check for dedicated chapters']
            };
        }

        // Check completeness scores
        const completenessScores = chunks
            .map(chunk => chunk.completeness_score ?? chunk.metadata?.completeness_score)
            .filter(score => score !== null && score !== undefined);

        if (completenessScores.length > 0) {
            const avgCompleteness = completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length;
            if (avgCompleteness < 0.5) {
                recommendations.push('Low completeness scores detected, may need more comprehensive chunks');
            }
        }

        if (recommendations.length > 0) {
            return {
                passed: true,
                severity: 'medium',
                warning: 'Chunk quality concerns detected',
                recommendations
            };
        }

        return { passed: true };
    }

    /**
     * Validate intent-specific rules
     * @private
     */
    _validateIntentSpecificRules(intent, chunks, question) {
        switch (intent) {
            case 'list_request':
                // For list requests, we should have chunks from a specific chapter
                const hasFromListRequest = chunks.some(chunk => chunk.fromListRequest);
                if (!hasFromListRequest && chunks.length < 5) {
                    return {
                        passed: false,
                        severity: 'high',
                        reason: 'List request requires comprehensive chapter content, but insufficient chunks found',
                        action: 'retry',
                        actionDetails: {
                            suggestion: 'Try specifying the exact chapter reference (e.g., "Day X, Chapter Y")'
                        }
                    };
                }
                break;

            case 'lab_guidance':
                // Lab guidance should have lab chunks or prerequisite chapters
                const hasLabChunks = chunks.some(chunk => chunk.content_type === 'lab');
                const hasChapterChunks = chunks.some(chunk => chunk.content_type === 'chapter');
                if (!hasLabChunks && !hasChapterChunks) {
                    return {
                        passed: false,
                        severity: 'high',
                        reason: 'Lab guidance requires lab chunks or prerequisite chapters, but none found',
                        action: 'clarify',
                        actionDetails: {
                            suggestion: 'Please specify which lab you need help with'
                        }
                    };
                }
                break;

            case 'navigation':
                // Navigation questions should have course structure info
                if (chunks.length === 0) {
                    return {
                        passed: false,
                        severity: 'medium',
                        reason: 'Navigation question requires course structure information',
                        action: 'clarify'
                    };
                }
                break;
        }

        return { passed: true };
    }

    /**
     * Validate if dedicated chapters are present for topic questions
     * @private
     */
    _validateDedicatedChapterPresence(topicKeywords, selectedChunks, allRetrievedChunks) {
        // Check if we have dedicated chunks in selected chunks
        const hasDedicatedInSelected = selectedChunks.some(chunk =>
            chunk.is_dedicated_topic_chapter ||
            chunk.isDedicatedTopicMatch ||
            chunk.metadata?.is_dedicated_topic_chapter
        );

        if (hasDedicatedInSelected) {
            return { passed: true };
        }

        // Check if dedicated chunks exist in all retrieved chunks (but weren't selected)
        const hasDedicatedInRetrieved = allRetrievedChunks.some(chunk =>
            chunk.is_dedicated_topic_chapter ||
            chunk.isDedicatedTopicMatch ||
            chunk.metadata?.is_dedicated_topic_chapter
        );

        if (hasDedicatedInRetrieved) {
            return {
                passed: false,
                reason: 'Dedicated chapter exists but was not selected (may be filtered out)',
                shouldRetry: true
            };
        }

        return {
            passed: false,
            reason: `No dedicated chapters found for topics: ${topicKeywords.join(', ')}`,
            shouldRetry: true
        };
    }

    /**
     * Validate similarity thresholds
     * @private
     */
    _validateSimilarityThresholds(chunks, intent) {
        if (chunks.length === 0) {
            return {
                passed: false,
                severity: 'high',
                reason: 'No chunks to validate similarity'
            };
        }

        const similarities = chunks
            .map(chunk => chunk.similarity || 0)
            .filter(sim => sim > 0);

        if (similarities.length === 0) {
            return {
                passed: true, // Some chunks may not have similarity scores
                warning: 'No similarity scores available for validation'
            };
        }

        const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
        const maxSimilarity = Math.max(...similarities);

        // Check dedicated chunks have high similarity
        const dedicatedChunks = chunks.filter(chunk =>
            chunk.is_dedicated_topic_chapter || chunk.isDedicatedTopicMatch
        );
        
        if (dedicatedChunks.length > 0) {
            const dedicatedSimilarities = dedicatedChunks
                .map(chunk => chunk.similarity || 0)
                .filter(sim => sim > 0);
            
            if (dedicatedSimilarities.length > 0) {
                const avgDedicatedSimilarity = dedicatedSimilarities.reduce((a, b) => a + b, 0) / dedicatedSimilarities.length;
                if (avgDedicatedSimilarity < this.minDedicatedChunkSimilarity) {
                    return {
                        passed: false,
                        severity: 'high',
                        reason: `Dedicated chunks have low similarity: ${avgDedicatedSimilarity.toFixed(2)} (minimum: ${this.minDedicatedChunkSimilarity})`,
                        averageSimilarity: avgDedicatedSimilarity
                    };
                }
            }
        }

        // Check overall similarity
        if (avgSimilarity < this.minSimilarityThreshold) {
            return {
                passed: false,
                severity: 'high',
                reason: `Low average similarity: ${avgSimilarity.toFixed(2)} (minimum: ${this.minSimilarityThreshold})`,
                averageSimilarity: avgSimilarity
            };
        }

        // Warn if max similarity is also low
        if (maxSimilarity < this.minSimilarityThreshold * 1.5) {
            return {
                passed: true,
                severity: 'medium',
                warning: `Even best chunk has low similarity: ${maxSimilarity.toFixed(2)}`
            };
        }

        return { passed: true };
    }

    /**
     * Determine final action based on violations and warnings
     * @private
     */
    _determineAction(violations, warnings) {
        // High severity violations -> block
        const highSeverityViolations = violations.filter(v => v.severity === 'high');
        if (highSeverityViolations.length > 0) {
            return 'block';
        }

        // Medium severity violations -> escalate or clarify
        const mediumViolations = violations.filter(v => v.severity === 'medium');
        if (mediumViolations.length > 0) {
            // Check violation types
            const hasReferenceMismatch = mediumViolations.some(v => v.type === 'reference_mismatch');
            if (hasReferenceMismatch) {
                return 'clarify';
            }
            return 'escalate';
        }

        // High severity warnings -> escalate
        const highWarnings = warnings.filter(w => w.severity === 'high');
        if (highWarnings.length > 0) {
            return 'escalate';
        }

        // Default: block if we have violations
        return 'block';
    }

    /**
     * Generate recommendations from warnings
     * @private
     */
    _generateRecommendations(warnings) {
        const recommendations = [];

        warnings.forEach(warning => {
            switch (warning.type) {
                case 'topic_coverage_weak':
                    recommendations.push('Consider rephrasing question with more specific topic keywords');
                    break;
                case 'chunk_quality_low':
                    recommendations.push('Answer may be incomplete - consider asking a more specific question');
                    break;
                case 'dedicated_chapter_missing':
                    recommendations.push('A dedicated chapter may exist for this topic - try different keywords');
                    break;
                case 'low_similarity':
                    recommendations.push('Chunks may not be highly relevant - consider rephrasing question');
                    break;
            }
        });

        return [...new Set(recommendations)]; // Remove duplicates
    }

    // ============================================================================
    // IMMUTABLE ANSWER INVARIANTS
    // These are non-negotiable rules that MUST pass before answer generation
    // ============================================================================

    /**
     * Invariant 1: Lab Safety
     * If learner mentions Day X and Lab Y explicitly:
     * - Only chunks from Day X + Lab Y are allowed
     * - If exact match retrieval fails → BLOCK answer
     * - Response must ask for clarification or escalate
     * 
     * @param {string} question - Original question
     * @param {Object} specificReferences - Parsed references
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {Array<Object>} allRetrievedChunks - All retrieved chunks
     * @returns {Object} Invariant check result with structured violation
     * @private
     */
    _invariantLabSafety(question, specificReferences, selectedChunks, allRetrievedChunks) {
        // Check if question explicitly mentions both Day and Lab
        const hasDay = specificReferences?.day !== null && specificReferences?.day !== undefined;
        const hasLab = specificReferences?.lab !== null && specificReferences?.lab !== undefined;

        if (!hasDay || !hasLab) {
            // Not a lab safety case - invariant doesn't apply
            return { passed: true };
        }

        const requestedDay = specificReferences.day;
        const requestedLab = specificReferences.lab;

        console.log(`[AnswerGovernance] Invariant 1 (Lab Safety): Checking Day ${requestedDay}, Lab ${requestedLab}`);

        // Check if we have exact matches
        const exactMatches = selectedChunks.filter(chunk => {
            const chunkDay = parseInt(chunk.day) || chunk.day;
            const chunkLab = chunk.lab_id || chunk.lab;
            
            // Normalize day comparison
            const dayMatches = chunkDay === requestedDay || 
                             String(chunkDay).includes(String(requestedDay)) ||
                             String(chunkDay).replace(/\D/g, '') === String(requestedDay);
            
            // Normalize lab comparison
            const labMatches = chunkLab && (
                String(chunkLab).includes(String(requestedLab)) ||
                String(chunkLab).replace(/\D/g, '') === String(requestedLab) ||
                chunkLab === requestedLab
            );

            return dayMatches && labMatches;
        });

        if (exactMatches.length === 0) {
            // Check if exact matches exist in all retrieved chunks (but weren't selected)
            const exactMatchesInRetrieved = allRetrievedChunks.filter(chunk => {
                const chunkDay = parseInt(chunk.day) || chunk.day;
                const chunkLab = chunk.lab_id || chunk.lab;
                
                const dayMatches = chunkDay === requestedDay || 
                                 String(chunkDay).includes(String(requestedDay)) ||
                                 String(chunkDay).replace(/\D/g, '') === String(requestedDay);
                
                const labMatches = chunkLab && (
                    String(chunkLab).includes(String(requestedLab)) ||
                    String(chunkLab).replace(/\D/g, '') === String(requestedLab) ||
                    chunkLab === requestedLab
                );

                return dayMatches && labMatches;
            });

            if (exactMatchesInRetrieved.length === 0) {
                // No exact matches found at all - BLOCK
                return {
                    passed: false,
                    reason: `No content found for Day ${requestedDay}, Lab ${requestedLab}. Exact match required for lab questions.`,
                    action: 'block',
                    actionDetails: {
                        requestedDay,
                        requestedLab,
                        selectedChunksCount: selectedChunks.length,
                        allRetrievedChunksCount: allRetrievedChunks.length,
                        message: 'Please verify the Day and Lab numbers, or try rephrasing without specific references.'
                    },
                    violation: {
                        invariant: 'Lab Safety',
                        type: 'missing_exact_match',
                        severity: 'critical',
                        details: {
                            requestedDay,
                            requestedLab,
                            exactMatchesFound: 0
                        }
                    }
                };
            } else {
                // Exact matches exist but weren't selected - this is a retrieval/filtering issue
                return {
                    passed: false,
                    reason: `Exact match for Day ${requestedDay}, Lab ${requestedLab} exists but was not selected. This may indicate a filtering or prioritization issue.`,
                    action: 'escalate',
                    actionDetails: {
                        requestedDay,
                        requestedLab,
                        exactMatchesFound: exactMatchesInRetrieved.length,
                        selectedChunksCount: selectedChunks.length,
                        message: 'Exact match exists but was filtered out. Escalating for review.'
                    },
                    violation: {
                        invariant: 'Lab Safety',
                        type: 'exact_match_filtered',
                        severity: 'critical',
                        details: {
                            requestedDay,
                            requestedLab,
                            exactMatchesFound: exactMatchesInRetrieved.length,
                            selectedChunksCount: selectedChunks.length
                        }
                    }
                };
            }
        }

        // Verify ALL selected chunks are from the requested Day + Lab
        const nonMatchingChunks = selectedChunks.filter(chunk => {
            const chunkDay = parseInt(chunk.day) || chunk.day;
            const chunkLab = chunk.lab_id || chunk.lab;
            
            const dayMatches = chunkDay === requestedDay || 
                             String(chunkDay).includes(String(requestedDay)) ||
                             String(chunkDay).replace(/\D/g, '') === String(requestedDay);
            
            const labMatches = chunkLab && (
                String(chunkLab).includes(String(requestedLab)) ||
                String(chunkLab).replace(/\D/g, '') === String(requestedLab) ||
                chunkLab === requestedLab
            );

            return !(dayMatches && labMatches);
        });

        if (nonMatchingChunks.length > 0) {
            return {
                passed: false,
                reason: `Selected chunks include content from outside Day ${requestedDay}, Lab ${requestedLab}. Only exact matches are allowed for lab questions.`,
                action: 'block',
                actionDetails: {
                    requestedDay,
                    requestedLab,
                    nonMatchingChunksCount: nonMatchingChunks.length,
                    totalSelectedChunks: selectedChunks.length,
                    message: 'Lab safety violation: Mixed content detected. Blocking answer generation.'
                },
                violation: {
                    invariant: 'Lab Safety',
                    type: 'mixed_content',
                    severity: 'critical',
                    details: {
                        requestedDay,
                        requestedLab,
                        nonMatchingChunksCount: nonMatchingChunks.length,
                        totalSelectedChunks: selectedChunks.length
                    }
                }
            };
        }

        // All checks passed
        return {
            passed: true,
            exactMatchesCount: exactMatches.length
        };
    }

    /**
     * Invariant 2: Topic Integrity (Enhanced)
     * If question contains topic modifiers (e.g., "technical", "implementation", "audit", "AEO"):
     * - At least one chunk must have primary_topic matching that modifier
     * - Exclude introductory/philosophy-only chapters (coverage_level='introduction' with completeness < 0.4)
     * - If no topic-specific chunk exists → BLOCK with message: "This topic will be covered in detail later in the course."
     * 
     * @param {string} question - Original question
     * @param {Array<string>} topicKeywords - Extracted topic keywords
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {Array<Object>} allRetrievedChunks - All retrieved chunks
     * @param {Array<string>} topicModifiers - Topic modifiers that require strict topic-specific content
     * @returns {Object} Invariant check result with structured violation
     * @private
     */
    _invariantTopicIntegrity(question, topicKeywords, selectedChunks, allRetrievedChunks, topicModifiers = []) {
        if (!topicKeywords || topicKeywords.length === 0) {
            // No topic keywords - invariant doesn't apply
            return { passed: true };
        }

        // Use provided topic modifiers or extract from question
        let matchedModifiers = topicModifiers || [];
        
        if (matchedModifiers.length === 0) {
            // Fallback: Extract from question if not provided
            const questionLower = question.toLowerCase();
            const defaultModifiers = [
                'technical', 'technical seo',
                'implementation', 'implement',
                'audit', 'auditing',
                'aeo', 'answer engine optimization',
                'ecommerce', 'ecommerce seo',
                'local seo', 'mobile seo',
                'on-page', 'off-page',
                'strategy', 'strategies', 'strategic',
                'advanced', 'comprehensive',
                'how to', 'how do', 'how can',
                'step by step', 'step-by-step',
                'practical', 'practically',
                'execute', 'execution',
                'perform', 'performing',
                'conduct', 'conducting'
            ];
            matchedModifiers = defaultModifiers.filter(modifier => 
                questionLower.includes(modifier.toLowerCase())
            );
        }

        if (matchedModifiers.length === 0) {
            // No topic modifier - invariant doesn't apply
            return { passed: true };
        }

        console.log(`[AnswerGovernance] Invariant 2 (Topic Integrity): Checking for topic modifier match (excluding introductory): ${matchedModifiers.join(', ')}`);

        // Filter out introductory/philosophy-only chapters
        // These are chunks with coverage_level='introduction' AND completeness_score < 0.4
        const excludeIntroductory = (chunks) => {
            return chunks.filter(chunk => {
                const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
                const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 1.0;
                
                // Exclude if it's introduction-level with low completeness (philosophy-only)
                if (coverageLevel === 'introduction' && completenessScore < 0.4) {
                    return false;
                }
                return true;
            });
        };

        // Check if any selected chunk has primary_topic matching the modifier (excluding introductory)
        const nonIntroductoryChunks = excludeIntroductory(selectedChunks);
        const chunksWithMatchingTopic = nonIntroductoryChunks.filter(chunk => {
            const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
            
            return matchedModifiers.some(modifier => {
                const modifierLower = modifier.toLowerCase();
                return primaryTopic.includes(modifierLower) || 
                       modifierLower.includes(primaryTopic) ||
                       chapterTitle.includes(modifierLower);
            });
        });

        if (chunksWithMatchingTopic.length === 0) {
            // Check if matching chunks exist in all retrieved chunks (but weren't selected)
            const nonIntroductoryRetrieved = excludeIntroductory(allRetrievedChunks);
            const matchingChunksInRetrieved = nonIntroductoryRetrieved.filter(chunk => {
                const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
                const chapterTitle = (chunk.chapter_title || '').toLowerCase();
                
                return matchedModifiers.some(modifier => {
                    const modifierLower = modifier.toLowerCase();
                    return primaryTopic.includes(modifierLower) || 
                           modifierLower.includes(primaryTopic) ||
                           chapterTitle.includes(modifierLower);
                });
            });

            if (matchingChunksInRetrieved.length === 0) {
                // No topic-specific chunks found at all - BLOCK with specific message
                return {
                    passed: false,
                    reason: `No topic-specific content found for modifiers: ${matchedModifiers.join(', ')}. Only introductory content available.`,
                    action: 'block',
                    actionDetails: {
                        matchedModifiers,
                        selectedChunksCount: selectedChunks.length,
                        nonIntroductoryChunksCount: nonIntroductoryChunks.length,
                        allRetrievedChunksCount: allRetrievedChunks.length,
                        message: 'This topic will be covered in detail later in the course.',
                        userMessage: 'This topic will be covered in detail later in the course.'
                    },
                    violation: {
                        invariant: 'Topic Integrity',
                        type: 'missing_topic_specific_content',
                        severity: 'critical',
                        details: {
                            matchedModifiers,
                            selectedChunksCount: selectedChunks.length,
                            nonIntroductoryChunksCount: nonIntroductoryChunks.length,
                            allRetrievedChunksCount: allRetrievedChunks.length,
                            excludedIntroductory: selectedChunks.length - nonIntroductoryChunks.length
                        }
                    }
                };
            } else {
                // Topic-specific chunks exist but weren't selected - suggest retry
                return {
                    passed: false,
                    reason: `Topic-specific chunks exist but were not selected. Topic integrity requires topic-specific content (excluding introductory).`,
                    action: 'retry',
                    actionDetails: {
                        matchedModifiers,
                        matchingChunksFound: matchingChunksInRetrieved.length,
                        selectedChunksCount: selectedChunks.length,
                        nonIntroductoryChunksCount: nonIntroductoryChunks.length,
                        message: 'Topic-specific chunks exist but were filtered out. Retry with better prioritization.'
                    },
                    violation: {
                        invariant: 'Topic Integrity',
                        type: 'topic_specific_filtered',
                        severity: 'critical',
                        details: {
                            matchedModifiers,
                            matchingChunksFound: matchingChunksInRetrieved.length,
                            selectedChunksCount: selectedChunks.length,
                            nonIntroductoryChunksCount: nonIntroductoryChunks.length
                        }
                    }
                };
            }
        }

        // Check if we have dedicated topic chapters (excluding introductory)
        const dedicatedChunks = chunksWithMatchingTopic.filter(chunk =>
            (chunk.is_dedicated_topic_chapter ||
             chunk.isDedicatedTopicMatch ||
             chunk.metadata?.is_dedicated_topic_chapter) &&
            // Ensure it's not introductory with low completeness
            !(chunk.coverage_level === 'introduction' && 
              (chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 1.0) < 0.4)
        );

        if (dedicatedChunks.length === 0 && chunksWithMatchingTopic.length > 0) {
            // We have matching topics but not dedicated chapters - warn but allow
            console.warn('[AnswerGovernance] Topic integrity: Matching topics found but no dedicated chapters (excluding introductory)');
        }

        // All checks passed
        return {
            passed: true,
            matchingChunksCount: chunksWithMatchingTopic.length,
            dedicatedChunksCount: dedicatedChunks.length,
            excludedIntroductory: selectedChunks.length - nonIntroductoryChunks.length
        };
    }

    /**
     * Invariant 3: Reference Integrity
     * If answer references Day/Chapter/Lab:
     * - References must match retrieved chunks
     * - If mismatch → BLOCK or escalate (no silent pass)
     * 
     * Note: This validates that the chunks we're about to use will produce
     * valid references. Post-generation validation should also check the actual answer.
     * 
     * @param {Object} specificReferences - Parsed specific references
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {Array<Object>} allRetrievedChunks - All retrieved chunks
     * @returns {Object} Invariant check result with structured violation
     * @private
     */
    _invariantReferenceIntegrity(specificReferences, selectedChunks, allRetrievedChunks) {
        if (!specificReferences?.hasSpecificReference) {
            // No specific references - invariant doesn't apply
            return { passed: true };
        }

        const { day, chapter, lab, step } = specificReferences;

        console.log(`[AnswerGovernance] Invariant 3 (Reference Integrity): Validating references Day ${day || 'N/A'}, Chapter ${chapter || 'N/A'}, Lab ${lab || 'N/A'}, Step ${step || 'N/A'}`);

        // Check if selected chunks match the requested references
        const mismatches = [];
        
        if (day !== null && day !== undefined) {
            const dayMismatches = selectedChunks.filter(chunk => {
                const chunkDay = parseInt(chunk.day) || chunk.day;
                const dayMatches = chunkDay === day || 
                                 String(chunkDay).includes(String(day)) ||
                                 String(chunkDay).replace(/\D/g, '') === String(day);
                return !dayMatches;
            });
            if (dayMismatches.length > 0) {
                mismatches.push({
                    type: 'day',
                    requested: day,
                    mismatchedChunks: dayMismatches.length
                });
            }
        }

        if (chapter !== null && chapter !== undefined) {
            const chapterMismatches = selectedChunks.filter(chunk => {
                const chunkChapter = chunk.chapter_id || chunk.chapter;
                if (!chunkChapter) return true; // Missing chapter ID is a mismatch
                return !String(chunkChapter).includes(String(chapter));
            });
            if (chapterMismatches.length > 0) {
                mismatches.push({
                    type: 'chapter',
                    requested: chapter,
                    mismatchedChunks: chapterMismatches.length
                });
            }
        }

        if (lab !== null && lab !== undefined) {
            const labMismatches = selectedChunks.filter(chunk => {
                const chunkLab = chunk.lab_id || chunk.lab;
                if (!chunkLab) return true; // Missing lab ID is a mismatch
                return !String(chunkLab).includes(String(lab));
            });
            if (labMismatches.length > 0) {
                mismatches.push({
                    type: 'lab',
                    requested: lab,
                    mismatchedChunks: labMismatches.length
                });
            }
        }

        if (mismatches.length > 0) {
            // Reference mismatch detected - CRITICAL violation
            const mismatchDetails = mismatches.map(m => 
                `${m.type} ${m.requested} (${m.mismatchedChunks} chunks don't match)`
            ).join(', ');

            return {
                passed: false,
                reason: `Reference integrity violation: Selected chunks do not match requested references. Mismatches: ${mismatchDetails}`,
                action: 'block',
                actionDetails: {
                    requestedReferences: { day, chapter, lab, step },
                    mismatches,
                    selectedChunksCount: selectedChunks.length,
                    message: 'References in answer will not match requested content. Blocking to prevent misinformation.'
                },
                violation: {
                    invariant: 'Reference Integrity',
                    type: 'reference_mismatch',
                    severity: 'critical',
                    details: {
                        requestedReferences: { day, chapter, lab, step },
                        mismatches
                    }
                }
            };
        }

        // Verify that chunks have the required reference fields
        const chunksWithMissingReferences = selectedChunks.filter(chunk => {
            if (day !== null && day !== undefined && !chunk.day) return true;
            if (chapter !== null && chapter !== undefined && !chunk.chapter_id && !chunk.chapter) return true;
            if (lab !== null && lab !== undefined && !chunk.lab_id && !chunk.lab) return true;
            return false;
        });

        if (chunksWithMissingReferences.length > 0) {
            return {
                passed: false,
                reason: `Reference integrity violation: Selected chunks are missing required reference fields (Day, Chapter, or Lab).`,
                action: 'escalate',
                actionDetails: {
                    requestedReferences: { day, chapter, lab, step },
                    chunksWithMissingReferences: chunksWithMissingReferences.length,
                    message: 'Chunks missing reference metadata. Escalating for data quality review.'
                },
                violation: {
                    invariant: 'Reference Integrity',
                    type: 'missing_reference_fields',
                    severity: 'critical',
                    details: {
                        requestedReferences: { day, chapter, lab, step },
                        chunksWithMissingReferences: chunksWithMissingReferences.length
                    }
                }
            };
        }

        // All checks passed
        return {
            passed: true,
            validatedReferences: { day, chapter, lab, step }
        };
    }

    /**
     * Invariant 5: Course Anchoring (Maturity-Aware)
     * Ensures that all AI Coach answers are explicitly grounded in how THIS course teaches the concept,
     * not generic industry explanations.
     * 
     * Uses Concept Maturity Model to adjust strictness:
     * - introduced: Allow foundational chapters, no escalation, add disclaimer
     * - applied: Require topic-specific but allow with warning, no auto-escalation
     * - implemented: Strict anchoring, block/escalate if missing
     * - not_covered: Block immediately
     * 
     * @param {string} question - Original question
     * @param {string} processedQuestion - Preprocessed question
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {Array<Object>} allRetrievedChunks - All retrieved chunks
     * @param {Array<string>} topicKeywords - Extracted topic keywords
     * @param {Object} primaryReferenceChunk - Primary reference chunk (for validation)
     * @param {Object} referenceSelectionResult - Primary reference selection result
     * @returns {Object} Invariant check result with structured violation
     * @private
     */
    async _invariantCourseAnchoring(question, processedQuestion, selectedChunks, allRetrievedChunks, topicKeywords = [], primaryReferenceChunk = null, referenceSelectionResult = null) {
        try {
            // Import concept maturity service
            const { conceptMaturityService } = await import('./concept-maturity-service.js');
            
            // Detect course concepts
            const conceptDetection = this._detectCourseConcepts(question);
            
            if (!conceptDetection.requiresCourseAnchoring) {
                // No named concepts detected - invariant doesn't apply
                return { passed: true };
            }

            const conceptNames = conceptDetection.conceptNames;
            console.log(`[AnswerGovernance] Invariant 5 (Course Anchoring): Detected concepts requiring anchoring: ${conceptNames.join(', ')}`);

            // Classify maturity for the primary concept (use first detected concept)
            const primaryConcept = conceptNames[0];
            const maturityResult = await conceptMaturityService.classifyMaturity(primaryConcept, allRetrievedChunks);
            const maturity = maturityResult.maturity;
            
            console.log(`[AnswerGovernance] Concept maturity for "${primaryConcept}": ${maturity} (confidence: ${maturityResult.confidence.toFixed(2)})`);

            const lowerQuestion = processedQuestion.toLowerCase();

            // Find anchoring chunks - chunks that explicitly cover the detected concepts
            const anchoringChunks = selectedChunks.filter(chunk => {
                const primaryTopic = (chunk.primary_topic || '').toLowerCase();
                const chapterTitle = (chunk.chapter_title || '').toLowerCase();

                // Check if chunk's primary_topic or chapter_title matches any detected concept
                return conceptNames.some(conceptName => {
                    const conceptLower = conceptName.toLowerCase();
                    return primaryTopic.includes(conceptLower) ||
                           chapterTitle.includes(conceptLower) ||
                           (chunk.is_dedicated_topic_chapter && primaryTopic.includes(conceptLower));
                });
            });

            // Check for foundational chapters (introduction-level with low completeness)
            const foundationalChunks = selectedChunks.filter(chunk => {
                const coverageLevel = chunk.coverage_level || 'introduction';
                const completenessScore = chunk.completeness_score ?? 0;
                return coverageLevel === 'introduction' && completenessScore < 0.4;
            });

            // Check if only foundational chunks are present (no anchoring chunks)
            const hasOnlyFoundational = anchoringChunks.length === 0 && foundationalChunks.length > 0;

            // Handle based on maturity level
            switch (maturity) {
                case 'introduced':
                    // Introduced: Allow foundational chapters, no escalation, add disclaimer
                    if (foundationalChunks.length > 0 || selectedChunks.length > 0) {
                        console.log(`[AnswerGovernance] Concept "${primaryConcept}" is introduced - allowing foundational chapters`);
                        return {
                            passed: true,
                            anchoringInfo: {
                                requiresAnchoring: true,
                                detectedConcepts: conceptNames,
                                anchoringChunksFound: foundationalChunks.length > 0,
                                anchoringChunkIds: foundationalChunks.map(c => c.id),
                                anchoringChapterTitles: foundationalChunks.map(c => c.chapter_title).filter(Boolean),
                                anchoringChunksCount: foundationalChunks.length,
                                maturity: 'introduced',
                                requiresDisclaimer: true,
                                shouldEscalate: false // DO NOT escalate for introduced concepts
                            }
                        };
                    }
                    // No chunks at all - still allow but warn
                    return {
                        passed: true,
                        anchoringInfo: {
                            requiresAnchoring: true,
                            detectedConcepts: conceptNames,
                            anchoringChunksFound: false,
                            maturity: 'introduced',
                            requiresDisclaimer: true,
                            shouldEscalate: false
                        },
                        warnings: [{
                            type: 'introduced_concept_limited_content',
                            message: 'Concept is introduced but limited content found'
                        }]
                    };

                case 'applied':
                    // Applied: Require topic-specific but allow with warning, no auto-escalation
                    if (anchoringChunks.length > 0) {
                        // Good - has anchoring chunks
                        const anchoringChunkIds = anchoringChunks.map(c => c.id);
                        const anchoringChapterTitles = anchoringChunks.map(c => c.chapter_title).filter(Boolean);
                        return {
                            passed: true,
                            anchoringInfo: {
                                requiresAnchoring: true,
                                detectedConcepts: conceptNames,
                                anchoringChunksFound: true,
                                anchoringChunkIds: anchoringChunkIds,
                                anchoringChapterTitles: anchoringChapterTitles,
                                anchoringChunksCount: anchoringChunks.length,
                                maturity: 'applied',
                                requiresDisclaimer: false,
                                shouldEscalate: false // DO NOT auto-escalate for applied concepts
                            }
                        };
                    } else if (foundationalChunks.length > 0) {
                        // Only foundational - allow with warning
                        console.warn(`[AnswerGovernance] Concept "${primaryConcept}" is applied but only foundational chunks found - allowing with warning`);
                        return {
                            passed: true,
                            anchoringInfo: {
                                requiresAnchoring: true,
                                detectedConcepts: conceptNames,
                                anchoringChunksFound: false,
                                hasOnlyFoundational: true,
                                maturity: 'applied',
                                requiresDisclaimer: true,
                                shouldEscalate: false // DO NOT escalate - just warn
                            },
                            warnings: [{
                                type: 'applied_concept_foundational_only',
                                message: 'Concept is applied but only foundational chapters found. Consider searching for dedicated chapters.',
                                severity: 'medium'
                            }]
                        };
                    }
                    // No chunks - suggest retry but don't block
                    return {
                        passed: true,
                        action: 'retry',
                        anchoringInfo: {
                            requiresAnchoring: true,
                            detectedConcepts: conceptNames,
                            anchoringChunksFound: false,
                            maturity: 'applied',
                            requiresDisclaimer: false,
                            shouldEscalate: false
                        },
                        warnings: [{
                            type: 'applied_concept_missing_content',
                            message: 'Concept is applied but no relevant chunks found. Retrying with strict filters.',
                            severity: 'medium'
                        }]
                    };

                case 'implemented':
                    // Implemented: Strict anchoring, block/escalate if missing
                    if (anchoringChunks.length === 0) {
                        // Check if we can find them in all retrieved chunks
                        const potentialAnchoringChunks = allRetrievedChunks.filter(chunk => {
                            const primaryTopic = (chunk.primary_topic || '').toLowerCase();
                            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
                            
                            return conceptNames.some(conceptName => {
                                const conceptLower = conceptName.toLowerCase();
                                return primaryTopic.includes(conceptLower) ||
                                       chapterTitle.includes(conceptLower) ||
                                       (chunk.is_dedicated_topic_chapter && primaryTopic.includes(conceptLower));
                            });
                        });

                        if (potentialAnchoringChunks.length > 0) {
                            // Anchoring chunks exist but weren't selected - suggest retry
                            console.warn(`[AnswerGovernance] Course Anchoring: Found ${potentialAnchoringChunks.length} potential anchoring chunks in retrieved set, but none were selected`);
                            return {
                                passed: false,
                                reason: `This concept (${conceptNames.join(', ')}) requires course-specific anchoring, but the selected chunks don't include dedicated chapters covering it.`,
                                action: 'retry',
                                actionDetails: {
                                    detectedConcepts: conceptNames,
                                    potentialAnchoringChunksCount: potentialAnchoringChunks.length,
                                    selectedChunksCount: selectedChunks.length,
                                    message: 'Retry retrieval with strict filters for dedicated topic chapters.',
                                    retryFilters: {
                                        primary_topic: conceptNames,
                                        is_dedicated_topic_chapter: true
                                    },
                                    maturity: 'implemented'
                                },
                                anchoringInfo: {
                                    requiresAnchoring: true,
                                    detectedConcepts: conceptNames,
                                    anchoringChunksFound: false,
                                    hasOnlyFoundational: hasOnlyFoundational,
                                    maturity: 'implemented',
                                    shouldEscalate: true // Escalate for implemented concepts missing anchors
                                },
                                violation: {
                                    invariant: 'Course Anchoring',
                                    type: 'missing_anchoring_chunks',
                                    severity: 'critical',
                                    details: {
                                        detectedConcepts: conceptNames,
                                        potentialAnchoringChunksCount: potentialAnchoringChunks.length,
                                        selectedChunksCount: selectedChunks.length,
                                        maturity: 'implemented'
                                    }
                                }
                            };
                        } else {
                            // No anchoring chunks found at all
                            return {
                                passed: false,
                                reason: `This concept (${conceptNames.join(', ')}) requires course-specific anchoring, but no dedicated chapters were found.`,
                                action: 'block',
                                actionDetails: {
                                    detectedConcepts: conceptNames,
                                    selectedChunksCount: selectedChunks.length,
                                    allRetrievedChunksCount: allRetrievedChunks.length,
                                    hasOnlyFoundational: hasOnlyFoundational,
                                    message: 'No dedicated chapters found for this concept. Escalating for trainer review.',
                                    maturity: 'implemented'
                                },
                                anchoringInfo: {
                                    requiresAnchoring: true,
                                    detectedConcepts: conceptNames,
                                    anchoringChunksFound: false,
                                    hasOnlyFoundational: hasOnlyFoundational,
                                    maturity: 'implemented',
                                    shouldEscalate: true // Escalate for implemented concepts
                                },
                                violation: {
                                    invariant: 'Course Anchoring',
                                    type: 'no_anchoring_chunks',
                                    severity: 'critical',
                                    details: {
                                        detectedConcepts: conceptNames,
                                        selectedChunksCount: selectedChunks.length,
                                        allRetrievedChunksCount: allRetrievedChunks.length,
                                        hasOnlyFoundational: hasOnlyFoundational,
                                        maturity: 'implemented'
                                    }
                                }
                            };
                        }
                    }
                    // Anchoring chunks found - validation passed
                    const anchoringChunkIds = anchoringChunks.map(c => c.id);
                    const anchoringChapterTitles = anchoringChunks.map(c => c.chapter_title).filter(Boolean);
                    return {
                        passed: true,
                        anchoringInfo: {
                            requiresAnchoring: true,
                            detectedConcepts: conceptNames,
                            anchoringChunksFound: true,
                            anchoringChunkIds: anchoringChunkIds,
                            anchoringChapterTitles: anchoringChapterTitles,
                            anchoringChunksCount: anchoringChunks.length,
                            maturity: 'implemented',
                            requiresDisclaimer: false,
                            shouldEscalate: false
                        }
                    };

                case 'not_covered':
                    // Not covered: Block immediately
                    return {
                        passed: false,
                        reason: `This concept (${conceptNames.join(', ')}) is not covered in the course.`,
                        action: 'block',
                        actionDetails: {
                            detectedConcepts: conceptNames,
                            message: 'This concept is not covered in the course.',
                            maturity: 'not_covered'
                        },
                        anchoringInfo: {
                            requiresAnchoring: true,
                            detectedConcepts: conceptNames,
                            anchoringChunksFound: false,
                            maturity: 'not_covered',
                            shouldEscalate: false // Don't escalate - just block
                        },
                        violation: {
                            invariant: 'Course Anchoring',
                            type: 'concept_not_covered',
                            severity: 'critical',
                            details: {
                                detectedConcepts: conceptNames,
                                maturity: 'not_covered'
                            }
                        }
                    };

                default:
                    // Unknown maturity - be conservative but allow
                    console.warn(`[AnswerGovernance] Unknown maturity level: ${maturity}, allowing with warning`);
                    return {
                        passed: true,
                        anchoringInfo: {
                            requiresAnchoring: true,
                            detectedConcepts: conceptNames,
                            anchoringChunksFound: anchoringChunks.length > 0,
                            maturity: maturity,
                            shouldEscalate: false
                        },
                        warnings: [{
                            type: 'unknown_maturity_level',
                            message: `Unknown maturity level: ${maturity}`
                        }]
                    };
            }

            if (anchoringChunks.length === 0) {
                // No anchoring chunks found - check if we can find them in all retrieved chunks
                const potentialAnchoringChunks = allRetrievedChunks.filter(chunk => {
                    const primaryTopic = (chunk.primary_topic || '').toLowerCase();
                    const chapterTitle = (chunk.chapter_title || '').toLowerCase();
                    
                    return conceptNames.some(conceptName => {
                        const conceptLower = conceptName.toLowerCase();
                        return primaryTopic.includes(conceptLower) ||
                               chapterTitle.includes(conceptLower) ||
                               (chunk.is_dedicated_topic_chapter && primaryTopic.includes(conceptLower));
                    });
                });

                if (potentialAnchoringChunks.length > 0) {
                    // Anchoring chunks exist but weren't selected - suggest retry
                    console.warn(`[AnswerGovernance] Course Anchoring: Found ${potentialAnchoringChunks.length} potential anchoring chunks in retrieved set, but none were selected`);
                    return {
                        passed: false,
                        reason: `This concept (${conceptNames.join(', ')}) requires course-specific anchoring, but the selected chunks don't include dedicated chapters covering it.`,
                        action: 'retry',
                        actionDetails: {
                            detectedConcepts: conceptNames,
                            potentialAnchoringChunksCount: potentialAnchoringChunks.length,
                            selectedChunksCount: selectedChunks.length,
                            message: 'Retry retrieval with strict filters for dedicated topic chapters.',
                            retryFilters: {
                                primary_topic: conceptNames,
                                is_dedicated_topic_chapter: true
                            }
                        },
                        anchoringInfo: {
                            requiresAnchoring: true,
                            detectedConcepts: conceptNames,
                            anchoringChunksFound: false,
                            hasOnlyFoundational: hasOnlyFoundational
                        },
                        violation: {
                            invariant: 'Course Anchoring',
                            type: 'missing_anchoring_chunks',
                            severity: 'critical',
                            details: {
                                detectedConcepts: conceptNames,
                                potentialAnchoringChunksCount: potentialAnchoringChunks.length,
                                selectedChunksCount: selectedChunks.length
                            }
                        }
                    };
                } else {
                    // No anchoring chunks found at all
                    const message = hasOnlyFoundational
                        ? `This concept (${conceptNames.join(', ')}) is introduced in foundational chapters, but its practical application is covered in a dedicated chapter later in the course.`
                        : `This concept (${conceptNames.join(', ')}) requires course-specific anchoring, but no dedicated chapters were found.`;

                    return {
                        passed: false,
                        reason: message,
                        action: 'block',
                        actionDetails: {
                            detectedConcepts: conceptNames,
                            selectedChunksCount: selectedChunks.length,
                            allRetrievedChunksCount: allRetrievedChunks.length,
                            hasOnlyFoundational: hasOnlyFoundational,
                            message: hasOnlyFoundational
                                ? 'This concept is introduced earlier, but its practical application is covered in a dedicated chapter later in the course.'
                                : 'No dedicated chapters found for this concept. Escalating for trainer review.'
                        },
                        anchoringInfo: {
                            requiresAnchoring: true,
                            detectedConcepts: conceptNames,
                            anchoringChunksFound: false,
                            hasOnlyFoundational: hasOnlyFoundational
                        },
                        violation: {
                            invariant: 'Course Anchoring',
                            type: 'no_anchoring_chunks',
                            severity: 'critical',
                            details: {
                                detectedConcepts: conceptNames,
                                selectedChunksCount: selectedChunks.length,
                                allRetrievedChunksCount: allRetrievedChunks.length,
                                hasOnlyFoundational: hasOnlyFoundational
                            }
                        }
                    };
                }
            }

            // Anchoring chunks found - validate they're not only foundational
            if (hasOnlyFoundational && anchoringChunks.length === 0) {
                return {
                    passed: false,
                    reason: `This concept (${conceptNames.join(', ')}) requires course-specific anchoring beyond foundational introduction.`,
                    action: 'block',
                    actionDetails: {
                        detectedConcepts: conceptNames,
                        message: 'This concept is introduced earlier, but its practical application is covered in a dedicated chapter later in the course.'
                    },
                    anchoringInfo: {
                        requiresAnchoring: true,
                        detectedConcepts: conceptNames,
                        anchoringChunksFound: false,
                        hasOnlyFoundational: true
                    }
                };
            }

            // Anchoring validation passed
            const anchoringChunkIds = anchoringChunks.map(c => c.id);
            const anchoringChapterTitles = anchoringChunks.map(c => c.chapter_title).filter(Boolean);

            console.log(`[AnswerGovernance] Course Anchoring: Validation passed. Found ${anchoringChunks.length} anchoring chunks:`, {
                chunkIds: anchoringChunkIds,
                chapterTitles: anchoringChapterTitles
            });

            return {
                passed: true,
                anchoringInfo: {
                    requiresAnchoring: true,
                    detectedConcepts: conceptNames,
                    anchoringChunksFound: true,
                    anchoringChunkIds: anchoringChunkIds,
                    anchoringChapterTitles: anchoringChapterTitles,
                    anchoringChunksCount: anchoringChunks.length
                }
            };
        } catch (error) {
            console.error('[AnswerGovernance] Error in course anchoring check:', error);
            // On error, allow to proceed (fail open) but log warning
            return {
                passed: true,
                warnings: [{
                    type: 'course_anchoring_check_error',
                    message: 'Course anchoring check failed, proceeding with caution',
                    error: error.message
                }]
            };
        }
    }

    /**
     * Detect course concepts in a question
     * @param {string} question - User question
     * @returns {Object} Concept detection result
     * @private
     */
    _detectCourseConcepts(question) {
        const detectedConcepts = [];

        // Known course concepts (acronyms and named concepts)
        const courseConcepts = [
            // Acronyms
            { pattern: /\bAEO\b/i, name: 'AEO', fullName: 'Answer Engine Optimization' },
            { pattern: /\bE-E-A-T\b/i, name: 'E-E-A-T', fullName: 'Experience, Expertise, Authority, Trust' },
            { pattern: /\bEAT\b/i, name: 'E-E-A-T', fullName: 'Experience, Expertise, Authority, Trust' },
            { pattern: /\bPAA\b/i, name: 'PAA', fullName: 'People Also Ask' },
            { pattern: /\bCWV\b/i, name: 'CWV', fullName: 'Core Web Vitals' },
            { pattern: /\bSERP\b/i, name: 'SERP', fullName: 'Search Engine Results Page' },
            
            // Named concepts
            { pattern: /\bTechnical SEO\b/i, name: 'Technical SEO', fullName: 'Technical SEO' },
            { pattern: /\bAnswer Engine Optimization\b/i, name: 'AEO', fullName: 'Answer Engine Optimization' },
            { pattern: /\bIndex Bloat\b/i, name: 'Index Bloat', fullName: 'Index Bloat' },
            { pattern: /\bIndexation\b/i, name: 'Indexation', fullName: 'Indexation' },
            { pattern: /\bCrawlability\b/i, name: 'Crawlability', fullName: 'Crawlability' },
            { pattern: /\bIndexability\b/i, name: 'Indexability', fullName: 'Indexability' },
            { pattern: /\bCrawl Budget\b/i, name: 'Crawl Budget', fullName: 'Crawl Budget' },
            { pattern: /\bCore Web Vitals\b/i, name: 'Core Web Vitals', fullName: 'Core Web Vitals' },
            { pattern: /\bFeatured Snippet\b/i, name: 'Featured Snippet', fullName: 'Featured Snippet' },
            { pattern: /\bPeople Also Ask\b/i, name: 'People Also Ask', fullName: 'People Also Ask' },
            { pattern: /\bZero-Click SEO\b/i, name: 'Zero-Click SEO', fullName: 'Zero-Click SEO' },
            { pattern: /\bZero Click\b/i, name: 'Zero-Click SEO', fullName: 'Zero-Click SEO' },
            { pattern: /\bLink Equity\b/i, name: 'Link Equity', fullName: 'Link Equity' },
            { pattern: /\bInternal Linking\b/i, name: 'Internal Linking', fullName: 'Internal Linking' },
            { pattern: /\bOn-Page SEO\b/i, name: 'On-Page SEO', fullName: 'On-Page SEO' },
            { pattern: /\bOff-Page SEO\b/i, name: 'Off-Page SEO', fullName: 'Off-Page SEO' },
            { pattern: /\bEcommerce SEO\b/i, name: 'Ecommerce SEO', fullName: 'Ecommerce SEO' },
            { pattern: /\bLocal SEO\b/i, name: 'Local SEO', fullName: 'Local SEO' },
            { pattern: /\bJavaScript SEO\b/i, name: 'JavaScript SEO', fullName: 'JavaScript SEO' },
            { pattern: /\bHelpful Content\b/i, name: 'Helpful Content', fullName: 'Helpful Content' },
            { pattern: /\bCanonicalization\b/i, name: 'Canonicalization', fullName: 'Canonicalization' },
            { pattern: /\bDuplicate Content\b/i, name: 'Duplicate Content', fullName: 'Duplicate Content' }
        ];

        // Check for concept patterns
        for (const concept of courseConcepts) {
            if (concept.pattern.test(question)) {
                // Check if not already added
                if (!detectedConcepts.some(c => c.name === concept.name)) {
                    detectedConcepts.push({
                        name: concept.name,
                        fullName: concept.fullName
                    });
                }
            }
        }

        // Also check for concept mentions in lowercase (for "how to do aeo" type queries)
        const lowerQuestion = question.toLowerCase();
        const lowercaseConcepts = [
            { pattern: /aeo|answer engine optimization/, name: 'AEO', fullName: 'Answer Engine Optimization' },
            { pattern: /e-e-a-t|eat|experience expertise authority trust/, name: 'E-E-A-T', fullName: 'Experience, Expertise, Authority, Trust' },
            { pattern: /technical seo/, name: 'Technical SEO', fullName: 'Technical SEO' },
            { pattern: /index bloat/, name: 'Index Bloat', fullName: 'Index Bloat' },
            { pattern: /crawlability/, name: 'Crawlability', fullName: 'Crawlability' },
            { pattern: /indexability/, name: 'Indexability', fullName: 'Indexability' },
            { pattern: /crawl budget/, name: 'Crawl Budget', fullName: 'Crawl Budget' },
            { pattern: /core web vitals/, name: 'Core Web Vitals', fullName: 'Core Web Vitals' }
        ];

        for (const concept of lowercaseConcepts) {
            if (concept.pattern.test(lowerQuestion)) {
                // Check if not already added
                if (!detectedConcepts.some(c => c.name === concept.name)) {
                    detectedConcepts.push({
                        name: concept.name,
                        fullName: concept.fullName
                    });
                }
            }
        }

        return {
            requiresCourseAnchoring: detectedConcepts.length > 0,
            detectedConcepts: detectedConcepts,
            conceptNames: detectedConcepts.map(c => c.name)
        };
    }

    /**
     * Invariant 6: Primary Reference Integrity
     * Ensures that foundational chapters are NEVER selected as primary reference for named concepts.
     * 
     * Rules:
     * - Primary reference MUST be topic-specific (not foundational)
     * - If no valid primary reference exists, answer is allowed ONLY if concept_maturity == introduced
     * - Violation: Block or downgrade answer
     * 
     * @param {string} question - Original question
     * @param {Object} primaryReferenceChunk - Selected primary reference chunk
     * @param {Object} referenceSelectionResult - Primary reference selection result
     * @param {Array<Object>} selectedChunks - All selected chunks
     * @returns {Object} Invariant check result
     * @private
     */
    _invariantPrimaryReference(question, primaryReferenceChunk, referenceSelectionResult, selectedChunks) {
        if (!primaryReferenceChunk || !referenceSelectionResult) {
            // No primary reference selected - this is OK for non-named concepts
            return { passed: true };
        }

        // Check if primary reference is marked as "concept introduction" (foundational)
        if (primaryReferenceChunk.isConceptIntroduction) {
            // This is allowed ONLY if concept maturity is "introduced"
            // The maturity check happens in Course Anchoring, so we just validate the structure
            if (referenceSelectionResult.requiresDisclaimer) {
                // Valid - concept introduction with disclaimer
                return {
                    passed: true,
                    warning: 'Primary reference is foundational (concept introduction). Disclaimer required.'
                };
            }
        }

        // Check if primary reference is foundational (should not be)
        const coverageLevel = primaryReferenceChunk.coverage_level || 'introduction';
        const completenessScore = primaryReferenceChunk.completeness_score ?? 0;
        const isFoundational = coverageLevel === 'introduction' && completenessScore < 0.4;
        
        if (isFoundational && !primaryReferenceChunk.isConceptIntroduction) {
            // VIOLATION: Foundational chapter assigned as primary reference without proper marking
            return {
                passed: false,
                reason: `Foundational chapter "${primaryReferenceChunk.chapter_title || primaryReferenceChunk.chapter_id}" cannot be primary reference for named concept.`,
                action: 'block',
                actionDetails: {
                    message: 'Primary reference must be topic-specific, not foundational.',
                    primaryReferenceChapter: primaryReferenceChunk.chapter_title || primaryReferenceChunk.chapter_id,
                    isFoundational: true,
                    coverageLevel,
                    completenessScore
                },
                violation: {
                    invariant: 'Primary Reference Integrity',
                    type: 'foundational_as_primary',
                    severity: 'critical',
                    details: {
                        primaryReferenceChapter: primaryReferenceChunk.chapter_title || primaryReferenceChunk.chapter_id,
                        coverageLevel,
                        completenessScore
                    }
                }
            };
        }

        // Check if primary reference is topic-specific
        const primaryTopic = (primaryReferenceChunk.primary_topic || '').toLowerCase();
        const chapterTitle = (primaryReferenceChunk.chapter_title || '').toLowerCase();
        const isDedicated = primaryReferenceChunk.is_dedicated_topic_chapter === true;
        
        // Extract concept names from question
        const conceptDetection = this._detectCourseConcepts(question);
        if (conceptDetection.requiresCourseAnchoring) {
            const conceptNames = conceptDetection.conceptNames.map(c => c.toLowerCase());
            const matchesConcept = conceptNames.some(conceptName => {
                return primaryTopic.includes(conceptName) ||
                       (isDedicated && primaryTopic.includes(conceptName)) ||
                       chapterTitle.includes(conceptName);
            });
            
            if (!matchesConcept && !primaryReferenceChunk.isConceptIntroduction) {
                // Primary reference doesn't match concept (and it's not a concept introduction)
                return {
                    passed: false,
                    reason: `Primary reference "${primaryReferenceChunk.chapter_title || primaryReferenceChunk.chapter_id}" does not match concept(s): ${conceptDetection.conceptNames.join(', ')}`,
                    action: 'block',
                    actionDetails: {
                        message: 'Primary reference must match the named concept.',
                        primaryReferenceChapter: primaryReferenceChunk.chapter_title || primaryReferenceChunk.chapter_id,
                        detectedConcepts: conceptDetection.conceptNames
                    },
                    violation: {
                        invariant: 'Primary Reference Integrity',
                        type: 'primary_reference_mismatch',
                        severity: 'critical',
                        details: {
                            primaryReferenceChapter: primaryReferenceChunk.chapter_title || primaryReferenceChunk.chapter_id,
                            detectedConcepts: conceptDetection.conceptNames
                        }
                    }
                };
            }
        }

        // All checks passed
        return { passed: true };
    }

    /**
     * Invariant 4: Course Scope
     * If answer content is generic and not traceable to course chunks:
     * - BLOCK with message: "This topic is not covered in sufficient depth yet."
     * 
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {string} intent - Intent classification
     * @param {string} question - Original question
     * @returns {Object} Invariant check result with structured violation
     * @private
     */
    _invariantCourseScope(selectedChunks, intent, question, conceptDetection = null) {
        if (selectedChunks.length === 0) {
            return {
                passed: false,
                reason: 'No chunks available - content is not traceable to course.',
                action: 'block',
                actionDetails: {
                    message: 'This topic is not covered in sufficient depth yet.'
                },
                violation: {
                    invariant: 'Course Scope',
                    type: 'no_chunks',
                    severity: 'critical',
                    details: {
                        selectedChunksCount: 0
                    }
                }
            };
        }

        // Check if chunks have sufficient content
        const chunksWithContent = selectedChunks.filter(chunk => {
            const content = chunk.content || '';
            return content.trim().length > 50; // Minimum content length
        });

        if (chunksWithContent.length === 0) {
            return {
                passed: false,
                reason: 'Selected chunks have insufficient content - answer would be generic and not traceable.',
                action: 'block',
                actionDetails: {
                    message: 'This topic is not covered in sufficient depth yet.',
                    chunksSelected: selectedChunks.length,
                    chunksWithContent: 0
                },
                violation: {
                    invariant: 'Course Scope',
                    type: 'insufficient_content',
                    severity: 'critical',
                    details: {
                        chunksSelected: selectedChunks.length,
                        chunksWithContent: 0
                    }
                }
            };
        }

        // Check if chunks are all introduction-level with low completeness
        const allIntroduction = selectedChunks.every(chunk => {
            const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
            const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 1.0;
            return coverageLevel === 'introduction' && completenessScore < 0.4;
        });

        if (allIntroduction && selectedChunks.length < 3) {
            // Very few introduction chunks with low completeness = generic content
            return {
                passed: false,
                reason: 'Only introduction-level chunks with low completeness found - answer would be too generic.',
                action: 'block',
                actionDetails: {
                    message: 'This topic is not covered in sufficient depth yet.',
                    chunksSelected: selectedChunks.length,
                    coverageLevel: 'introduction',
                    averageCompleteness: selectedChunks.reduce((sum, chunk) => {
                        const score = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 0;
                        return sum + score;
                    }, 0) / selectedChunks.length
                },
                violation: {
                    invariant: 'Course Scope',
                    type: 'generic_content',
                    severity: 'critical',
                    details: {
                        chunksSelected: selectedChunks.length,
                        coverageLevel: 'introduction',
                        averageCompleteness: selectedChunks.reduce((sum, chunk) => {
                            const score = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 0;
                            return sum + score;
                        }, 0) / selectedChunks.length
                    }
                }
            };
        }

        // Check if chunks have very low similarity (indicating generic/irrelevant content)
        // BUT: Allow low similarity if chunks were found via dedicated chapter search or have topic-specific metadata
        const similarities = selectedChunks
            .map(chunk => chunk.similarity || 0)
            .filter(sim => sim > 0);

        if (similarities.length > 0) {
            const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
            const maxSimilarity = Math.max(...similarities);

            // Check if we have dedicated chunks or topic-specific chunks (found via metadata/keyword search)
            // These are valid even with low similarity scores because they were explicitly matched
            const hasDedicatedChunks = selectedChunks.some(chunk => 
                chunk.isDedicatedTopicMatch === true || 
                chunk.is_dedicated_topic_chapter === true ||
                chunk.metadata?.is_dedicated_topic_chapter === true
            );
            
            // Check if chunks have topic-specific metadata indicating they match the query topic
            const hasTopicSpecificChunks = selectedChunks.some(chunk => {
                const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
                const chapterTitle = (chunk.chapter_title || '').toLowerCase();
                // Check if any detected concepts match the chunk's topic or title
                if (conceptDetection && conceptDetection.conceptNames) {
                    return conceptDetection.conceptNames.some(concept => {
                        const conceptLower = concept.toLowerCase();
                        return primaryTopic.includes(conceptLower) || 
                               conceptLower.includes(primaryTopic) ||
                               chapterTitle.includes(conceptLower) ||
                               conceptLower.includes(chapterTitle.split(' ')[0]);
                    });
                }
                return false;
            });

            // If both average and max similarity are very low, content is likely generic
            // UNLESS we have dedicated/topic-specific chunks (found via metadata search, not just similarity)
            if (avgSimilarity < 0.2 && maxSimilarity < 0.3) {
                // Allow if we have dedicated or topic-specific chunks (they were explicitly matched)
                if (hasDedicatedChunks || hasTopicSpecificChunks) {
                    console.log('[AnswerGovernance] Low similarity but allowing answer due to dedicated/topic-specific chunks', {
                        avgSimilarity,
                        maxSimilarity,
                        hasDedicatedChunks,
                        hasTopicSpecificChunks
                    });
                    // Don't block, but add a warning
                    return {
                        passed: true,
                        warning: `Low similarity scores (avg: ${avgSimilarity.toFixed(2)}, max: ${maxSimilarity.toFixed(2)}) but allowing answer due to dedicated/topic-specific chunks found via metadata search.`
                    };
                }
                
                // Otherwise, block if similarity is very low
                return {
                    passed: false,
                    reason: `Very low similarity scores (avg: ${avgSimilarity.toFixed(2)}, max: ${maxSimilarity.toFixed(2)}) - content is not relevant to question.`,
                    action: 'block',
                    actionDetails: {
                        message: 'This topic is not covered in sufficient depth yet.',
                        averageSimilarity: avgSimilarity,
                        maxSimilarity: maxSimilarity
                    },
                    violation: {
                        invariant: 'Course Scope',
                        type: 'low_similarity',
                        severity: 'critical',
                        details: {
                            averageSimilarity: avgSimilarity,
                            maxSimilarity: maxSimilarity
                        }
                    }
                };
            }
        }

        // Check if chunks are missing course-specific identifiers
        const chunksWithCourseIdentifiers = selectedChunks.filter(chunk => {
            return chunk.day || chunk.chapter_id || chunk.chapter_title || chunk.lab_id;
        });

        if (chunksWithCourseIdentifiers.length < selectedChunks.length * 0.5) {
            // Less than half have course identifiers - likely generic content
            return {
                passed: false,
                reason: 'Less than 50% of chunks have course-specific identifiers - content may be generic.',
                action: 'block',
                actionDetails: {
                    message: 'This topic is not covered in sufficient depth yet.',
                    chunksWithIdentifiers: chunksWithCourseIdentifiers.length,
                    totalChunks: selectedChunks.length
                },
                violation: {
                    invariant: 'Course Scope',
                    type: 'missing_course_identifiers',
                    severity: 'critical',
                    details: {
                        chunksWithIdentifiers: chunksWithCourseIdentifiers.length,
                        totalChunks: selectedChunks.length
                    }
                }
            };
        }

        // All checks passed
        return {
            passed: true,
            chunksWithContent: chunksWithContent.length,
            traceable: true
        };
    }

    /**
     * Validate procedural contract requirements
     * Procedural queries MUST have:
     * - Step-by-step structure
     * - Reference to implementation chapters
     * - Not be purely conceptual
     * 
     * @param {Object} depthClassification - Depth classification result
     * @param {Array<Object>} selectedChunks - Selected chunks
     * @param {Array<Object>} allRetrievedChunks - All retrieved chunks
     * @returns {Object} Validation result
     * @private
     */
    _validateProceduralContract(depthClassification, selectedChunks, allRetrievedChunks) {
        if (depthClassification.depthType !== 'procedural') {
            return { passed: true }; // Not a procedural query
        }

        console.log('[AnswerGovernance] Validating procedural contract requirements...');

        // Check for implementation chunks
        const hasImplementationChunks = selectedChunks.some(chunk => {
            const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
            const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
            const content = (chunk.content || '').toLowerCase();

            // Check for implementation indicators
            return coverageLevel === 'comprehensive' || 
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
        });

        // Check for step-by-step content
        const hasStepByStepContent = selectedChunks.some(chunk => {
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

        // Check for implementation chapters
        const hasImplementationChapters = selectedChunks.some(chunk => {
            const chapterTitle = (chunk.chapter_title || '').toLowerCase();
            const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
            
            return chapterTitle.includes('implementation') ||
                   chapterTitle.includes('how to') ||
                   chapterTitle.includes('guide') ||
                   chapterTitle.includes('tutorial') ||
                   primaryTopic.includes('implementation');
        });

        // Check if chunks are purely conceptual (coverage_level='introduction' with low completeness)
        const hasOnlyConceptual = selectedChunks.length > 0 && selectedChunks.every(chunk => {
            const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
            const completenessScore = chunk.completeness_score ?? chunk.metadata?.completeness_score ?? 1.0;
            return coverageLevel === 'introduction' && completenessScore < 0.4;
        });

        // CRITICAL: If only conceptual chunks, block
        if (hasOnlyConceptual) {
            return {
                passed: false,
                severity: 'critical',
                reason: 'Procedural query requires implementation content, but only conceptual/introductory chunks found. Cannot provide step-by-step guidance.',
                action: 'block',
                actionDetails: {
                    message: 'This question requires step-by-step implementation guidance, but only conceptual content is available. This topic will be covered in detail later in the course.',
                    userMessage: 'This question requires step-by-step implementation guidance, but only conceptual content is available. This topic will be covered in detail later in the course.',
                    missingRequirements: ['implementation_content', 'step_by_step'],
                    hasImplementationChunks: false,
                    hasStepByStepContent: false,
                    hasImplementationChapters: false
                }
            };
        }

        // HIGH: If no implementation chunks and no step-by-step content, escalate or block
        if (!hasImplementationChunks && !hasStepByStepContent) {
            // Check if implementation chunks exist in all retrieved chunks (but weren't selected)
            const implementationChunksInRetrieved = allRetrievedChunks.filter(chunk => {
                const coverageLevel = chunk.coverage_level || chunk.metadata?.coverage_level;
                const primaryTopic = (chunk.primary_topic || chunk.metadata?.primary_topic || '').toLowerCase();
                const chapterTitle = (chunk.chapter_title || '').toLowerCase();
                
                return coverageLevel === 'comprehensive' || 
                       coverageLevel === 'advanced' ||
                       primaryTopic.includes('implementation') ||
                       chapterTitle.includes('implementation');
            });

            if (implementationChunksInRetrieved.length > 0) {
                // Implementation chunks exist but weren't selected - escalate
                return {
                    passed: false,
                    severity: 'high',
                    reason: 'Procedural query requires step-by-step implementation content, but implementation chunks were not selected.',
                    action: 'escalate',
                    actionDetails: {
                        message: 'Implementation content exists but was not selected. Escalating for review.',
                        missingRequirements: ['implementation_content', 'step_by_step'],
                        hasImplementationChunks: false,
                        hasStepByStepContent: false,
                        hasImplementationChapters: hasImplementationChapters,
                        implementationChunksFound: implementationChunksInRetrieved.length
                    }
                };
            } else {
                // No implementation chunks at all - block
                return {
                    passed: false,
                    severity: 'critical',
                    reason: 'Procedural query requires step-by-step implementation content, but no implementation chunks found.',
                    action: 'block',
                    actionDetails: {
                        message: 'This question requires step-by-step implementation guidance, but implementation content is not available yet. This topic will be covered in detail later in the course.',
                        userMessage: 'This question requires step-by-step implementation guidance, but implementation content is not available yet. This topic will be covered in detail later in the course.',
                        missingRequirements: ['implementation_content', 'step_by_step'],
                        hasImplementationChunks: false,
                        hasStepByStepContent: false,
                        hasImplementationChapters: false
                    }
                };
            }
        }

        // MEDIUM: If no step-by-step content but has implementation chunks, ask for clarification
        if (!hasStepByStepContent && hasImplementationChunks) {
            return {
                passed: false,
                severity: 'medium',
                reason: 'Procedural query requires step-by-step structure, but chunks do not contain explicit step-by-step content.',
                action: 'clarify',
                actionDetails: {
                    message: 'Would you like step-by-step instructions, or are you looking for a general overview of the implementation process?',
                    userMessage: 'Would you like step-by-step instructions, or are you looking for a general overview of the implementation process?',
                    missingRequirements: ['step_by_step'],
                    hasImplementationChunks: true,
                    hasStepByStepContent: false,
                    hasImplementationChapters: hasImplementationChapters
                }
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

export const answerGovernanceService = new AnswerGovernanceService();

