/**
 * Reference Resolution Service
 * 
 * Deterministic, rule-based system that extracts and resolves explicit course references
 * from user questions BEFORE the LLM processes them.
 * 
 * Uses pattern matching and database lookups only—no LLM, no guessing, no inference.
 */

import { supabaseClient } from './supabase-client.js';

class ReferenceResolutionService {
    constructor(client = null) {
        this.client = client || supabaseClient;
        this.cache = new Map(); // In-memory cache for resolved references
    }

    /**
     * Resolve explicit references from question
     * @param {string} question - User's question
     * @param {string} courseId - Course ID
     * @param {string} userId - Optional user ID for progress-based hints
     * @returns {Promise<Object>} Resolution result
     */
    async resolve(question, courseId, userId = null) {
        // Normalize input
        const normalized = this.normalizeQuestion(question);
        
        // Extract patterns
        const patterns = this.extractReferencePatterns(normalized);
        
        if (patterns.length === 0) {
            return {
                resolved_nodes: [],
                resolution_type: 'none',
                confidence: 0.0,
                matched_patterns: [],
                warnings: ['No explicit references found. Proceeding with semantic search.']
            };
        }
        
        // Parse and validate
        const parsedRefs = patterns
            .map(p => this.parsePattern(p))
            .filter(ref => this.validateReference(ref));
        
        if (parsedRefs.length === 0) {
            return {
                resolved_nodes: [],
                resolution_type: 'none',
                confidence: 0.0,
                matched_patterns: patterns.map(p => p.type),
                warnings: ['No valid references found after validation']
            };
        }
        
        // Lookup in registry
        const resolvedNodes = await this.lookupReferences(parsedRefs, courseId);
        
        return {
            resolved_nodes: resolvedNodes,
            resolution_type: resolvedNodes.length > 0 ? (parsedRefs[0].isPartial ? 'partial' : 'exact') : 'none',
            confidence: resolvedNodes.length > 0 ? 1.0 : 0.0,
            matched_patterns: patterns.map(p => p.type),
            warnings: resolvedNodes.length < parsedRefs.length
                ? [`Only ${resolvedNodes.length} of ${parsedRefs.length} references resolved`]
                : []
        };
    }

    /**
     * Normalize question for pattern matching
     * @param {string} question - Original question
     * @returns {string} Normalized question
     */
    normalizeQuestion(question) {
        return question
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
    }

    /**
     * Extract reference patterns from question
     * @param {string} normalized - Normalized question
     * @returns {Array<Object>} Matched patterns
     */
    extractReferencePatterns(normalized) {
        const patterns = [];
        
        // Pattern 1: Canonical format (D1.C1.S3)
        const canonicalPattern = /D(\d+)\.(C|L)(\d+)\.([SCEDPLHTB])(\d+)/gi;
        let match;
        while ((match = canonicalPattern.exec(normalized)) !== null) {
            patterns.push({
                type: 'canonical_format',
                day: parseInt(match[1]),
                containerType: match[2] === 'C' ? 'chapter' : 'lab',
                containerSeq: parseInt(match[3]),
                nodeType: match[4],
                nodeSeq: parseInt(match[5]),
                fullMatch: match[0]
            });
        }
        
        // Pattern 2: Day → Chapter → Step
        const chapterStepPattern = /day\s+(\d+)\s*[→,]\s*chapter\s+(\d+)\s*[→,]\s*(?:step|concept|example)\s+(\d+)/gi;
        while ((match = chapterStepPattern.exec(normalized)) !== null) {
            patterns.push({
                type: 'chapter_step_reference',
                day: parseInt(match[1]),
                containerType: 'chapter',
                containerSeq: parseInt(match[2]),
                nodeSeq: parseInt(match[3]),
                fullMatch: match[0]
            });
        }
        
        // Pattern 3: Day → Lab → Step
        const labStepPattern = /day\s+(\d+)\s*[→,]\s*lab\s+(\d+)\s*[→,]\s*step\s+(\d+)/gi;
        while ((match = labStepPattern.exec(normalized)) !== null) {
            patterns.push({
                type: 'lab_step_reference',
                day: parseInt(match[1]),
                containerType: 'lab',
                containerSeq: parseInt(match[2]),
                nodeSeq: parseInt(match[3]),
                fullMatch: match[0]
            });
        }
        
        // Pattern 4: Step of Lab on Day
        const stepOfLabPattern = /step\s+(\d+)\s+of\s+lab\s+(\d+)\s+on\s+day\s+(\d+)/gi;
        while ((match = stepOfLabPattern.exec(normalized)) !== null) {
            patterns.push({
                type: 'step_of_lab',
                day: parseInt(match[3]),
                containerType: 'lab',
                containerSeq: parseInt(match[2]),
                nodeSeq: parseInt(match[1]),
                fullMatch: match[0]
            });
        }
        
        // Pattern 5: Lab of Day, Step
        const labOfDayPattern = /lab\s+(\d+)\s+of\s+day\s+(\d+)[,\s]+step\s+(\d+)/gi;
        while ((match = labOfDayPattern.exec(normalized)) !== null) {
            patterns.push({
                type: 'lab_of_day_step',
                day: parseInt(match[2]),
                containerType: 'lab',
                containerSeq: parseInt(match[1]),
                nodeSeq: parseInt(match[3]),
                fullMatch: match[0]
            });
        }
        
        // Pattern 6: Day Chapter (partial)
        const dayChapterPattern = /day\s+(\d+)\s*[→,]\s*chapter\s+(\d+)(?!\s*[→,])/gi;
        while ((match = dayChapterPattern.exec(normalized)) !== null) {
            patterns.push({
                type: 'chapter_partial',
                day: parseInt(match[1]),
                containerType: 'chapter',
                containerSeq: parseInt(match[2]),
                fullMatch: match[0]
            });
        }
        
        // Pattern 7: Day Lab (partial)
        const dayLabPattern = /day\s+(\d+)\s*[→,]\s*lab\s+(\d+)(?!\s*[→,])/gi;
        while ((match = dayLabPattern.exec(normalized)) !== null) {
            patterns.push({
                type: 'lab_partial',
                day: parseInt(match[1]),
                containerType: 'lab',
                containerSeq: parseInt(match[2]),
                fullMatch: match[0]
            });
        }
        
        return patterns;
    }

    /**
     * Parse pattern into reference components
     * @param {Object} pattern - Matched pattern
     * @returns {Object} Parsed reference
     */
    parsePattern(pattern) {
        // For canonical format, already parsed
        if (pattern.type === 'canonical_format') {
            return {
                day: pattern.day,
                containerType: pattern.containerType,
                containerSeq: pattern.containerSeq,
                nodeType: pattern.nodeType.toLowerCase(),
                nodeSeq: pattern.nodeSeq,
                isPartial: false
            };
        }
        
        // For step references, default to 'step' type
        if (pattern.nodeSeq !== undefined) {
            return {
                day: pattern.day,
                containerType: pattern.containerType,
                containerSeq: pattern.containerSeq,
                nodeType: 'step', // Default for step references
                nodeSeq: pattern.nodeSeq,
                isPartial: false
            };
        }
        
        // For partial references (chapter/lab only)
        return {
            day: pattern.day,
            containerType: pattern.containerType,
            containerSeq: pattern.containerSeq,
            nodeType: null,
            nodeSeq: null,
            isPartial: true
        };
    }

    /**
     * Validate reference components
     * @param {Object} ref - Parsed reference
     * @returns {boolean} True if valid
     */
    validateReference(ref) {
        // Day range: 1-365
        if (ref.day < 1 || ref.day > 365) {
            return false;
        }
        
        // Container sequence: 1-100
        if (ref.containerSeq < 1 || ref.containerSeq > 100) {
            return false;
        }
        
        // Node sequence: 1-1000 (if not partial)
        if (!ref.isPartial && (ref.nodeSeq < 1 || ref.nodeSeq > 1000)) {
            return false;
        }
        
        // Container type must be 'chapter' or 'lab'
        if (ref.containerType !== 'chapter' && ref.containerType !== 'lab') {
            return false;
        }
        
        return true;
    }

    /**
     * Lookup references in canonical_reference_registry
     * @param {Array<Object>} refs - Parsed references
     * @param {string} courseId - Course ID
     * @returns {Promise<Array<string>>} Resolved canonical references
     */
    async lookupReferences(refs, courseId) {
        const resolvedNodes = [];
        
        for (const ref of refs) {
            if (ref.isPartial) {
                // Partial match: get all nodes in container
                const containerId = `day${ref.day}-${ref.containerType === 'chapter' ? 'ch' : 'lab'}${ref.containerSeq}`;
                
                const { data, error } = await this.client
                    .from('canonical_reference_registry')
                    .select('canonical_reference')
                    .eq('course_id', courseId)
                    .eq('day', ref.day)
                    .eq('container_type', ref.containerType)
                    .eq('container_id', containerId)
                    .eq('is_valid', true)
                    .order('sequence_number', { ascending: true });
                
                if (!error && data) {
                    resolvedNodes.push(...data.map(r => r.canonical_reference));
                }
            } else {
                // Exact match: lookup specific node
                const containerId = `day${ref.day}-${ref.containerType === 'chapter' ? 'ch' : 'lab'}${ref.containerSeq}`;
                
                // Map node type to code
                const nodeTypeCode = {
                    'step': 'S',
                    'concept': 'C',
                    'example': 'E',
                    'definition': 'D',
                    'procedure': 'P',
                    'list_item': 'L',
                    'heading': 'H',
                    'table': 'T',
                    'code_block': 'B'
                }[ref.nodeType] || 'C';
                
                // Build expected canonical reference
                const containerCode = ref.containerType === 'chapter' ? 'C' : 'L';
                const expectedRef = `D${ref.day}.${containerCode}${ref.containerSeq}.${nodeTypeCode}${ref.nodeSeq}`;
                
                // Verify it exists
                const { data, error } = await this.client
                    .from('canonical_reference_registry')
                    .select('canonical_reference')
                    .eq('canonical_reference', expectedRef)
                    .eq('course_id', courseId)
                    .eq('is_valid', true)
                    .single();
                
                if (!error && data) {
                    resolvedNodes.push(data.canonical_reference);
                }
            }
        }
        
        // Remove duplicates
        return [...new Set(resolvedNodes)];
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export singleton instance
export const referenceResolutionService = new ReferenceResolutionService();

// Also export class for testing
export default ReferenceResolutionService;

