/**
 * Canonical Reference Registry Service
 * 
 * Single source of truth for all course content references.
 * Every atomic content node has exactly one canonical reference that is
 * human-readable, machine-resolvable, and stable over time.
 */

import { supabaseClient } from './supabase-client.js';

class CanonicalReferenceRegistry {
    constructor(client = null) {
        this.client = client || supabaseClient;
        this.cache = new Map(); // In-memory cache
    }

    /**
     * Resolve canonical reference to display format
     * @param {string} canonicalRef - e.g., "D1.C1.S3"
     * @returns {Promise<Object>} Resolved reference
     */
    async resolve(canonicalRef) {
        // Check cache first
        if (this.cache.has(canonicalRef)) {
            return this.cache.get(canonicalRef);
        }

        // Validate format
        if (!this.validateFormat(canonicalRef)) {
            throw new Error(`Invalid reference format: ${canonicalRef}`);
        }

        // Query registry
        const { data, error } = await this.client
            .from('canonical_reference_registry')
            .select('*')
            .eq('canonical_reference', canonicalRef)
            .eq('is_valid', true)
            .single();

        if (error || !data) {
            throw new Error(`Reference not found: ${canonicalRef}`);
        }

        // Build display format
        const display = this.formatDisplay(data);

        const resolved = {
            canonical_reference: canonicalRef,
            day: data.day,
            container_type: data.container_type,
            container_id: data.container_id,
            container_title: data.container_title,
            sequence_number: data.sequence_number,
            node_type: data.node_type,
            display_reference: display,
            short_reference: canonicalRef,
            content_preview: data.content_preview
        };

        // Cache result
        this.cache.set(canonicalRef, resolved);

        return resolved;
    }

    /**
     * Format reference for display
     * @param {Object} data - Registry entry
     * @returns {string} Display format
     */
    formatDisplay(data) {
        const day = data.day;
        const containerType = data.container_type;
        const containerId = data.container_id;
        const seq = data.sequence_number;
        const nodeType = data.node_type;

        // Extract container number from formats like:
        // - day20-ch1 (chapter)
        // - day12-lab2 (lab)
        // - ch1 or lab2 (fallback)
        let containerNum = '?';
        const dayContainerMatch = containerId.match(/day\d+-(ch|lab)(\d+)/i);
        if (dayContainerMatch) {
            containerNum = dayContainerMatch[2];
        } else {
            const simpleMatch = containerId.match(/(?:ch|lab)(\d+)/i);
            if (simpleMatch) {
                containerNum = simpleMatch[1];
            }
        }

        // Format node type
        const nodeTypeLabel = {
            'step': 'Step',
            'concept': 'Concept',
            'example': 'Example',
            'definition': 'Definition',
            'procedure': 'Procedure',
            'list_item': 'Item',
            'heading': 'Section',
            'table': 'Table',
            'code_block': 'Code'
        }[nodeType] || 'Section';

        if (containerType === 'chapter') {
            return `Day ${day} → Chapter ${containerNum} → ${nodeTypeLabel} ${seq}`;
        } else if (containerType === 'lab') {
            return `Day ${day} → Lab ${containerNum} → ${nodeTypeLabel} ${seq}`;
        }

        // Fallback: use container title if available
        if (data.container_title) {
            return `${data.container_title} → ${nodeTypeLabel} ${seq}`;
        }

        return `Day ${day} → ${containerType} ${containerNum} → ${nodeTypeLabel} ${seq}`;
    }

    /**
     * Validate reference format
     * @param {string} ref - Reference to validate
     * @returns {boolean} True if valid
     */
    validateFormat(ref) {
        return /^D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+$/.test(ref);
    }

    /**
     * Get all references for a container
     * @param {string} courseId - Course ID
     * @param {string} containerType - 'chapter' or 'lab'
     * @param {string} containerId - Container ID
     * @returns {Promise<Array>} Array of references
     */
    async getContainerReferences(courseId, containerType, containerId) {
        const { data, error } = await this.client
            .from('canonical_reference_registry')
            .select('*')
            .eq('course_id', courseId)
            .eq('container_type', containerType)
            .eq('container_id', containerId)
            .eq('is_valid', true)
            .order('sequence_number', { ascending: true });

        if (error) {
            throw error;
        }

        return data.map(entry => ({
            canonical_reference: entry.canonical_reference,
            sequence_number: entry.sequence_number,
            node_type: entry.node_type,
            content_preview: entry.content_preview,
            display_reference: this.formatDisplay(entry)
        }));
    }

    /**
     * Batch resolve references
     * @param {Array<string>} references - Array of canonical references
     * @returns {Promise<Array>} Array of resolved references
     */
    async batchResolve(references) {
        const uniqueRefs = [...new Set(references)];
        const results = await Promise.all(
            uniqueRefs.map(ref => this.resolve(ref).catch(err => {
                console.warn(`Failed to resolve ${ref}:`, err);
                return null;
            }))
        );
        return results.filter(r => r !== null);
    }

    /**
     * Get node content by canonical reference
     * @param {string} canonicalRef - Canonical reference
     * @param {string} courseId - Course ID
     * @returns {Promise<Object>} Node content
     */
    async getNodeContent(canonicalRef, courseId) {
        const { data, error } = await this.client
            .from('content_nodes')
            .select('*')
            .eq('canonical_reference', canonicalRef)
            .eq('course_id', courseId)
            .eq('is_valid', true)
            .single();

        if (error || !data) {
            throw new Error(`Node not found: ${canonicalRef}`);
        }

        return data;
    }

    /**
     * Batch get node content
     * @param {Array<string>} canonicalRefs - Array of canonical references
     * @param {string} courseId - Course ID
     * @returns {Promise<Array>} Array of node content
     */
    async batchGetNodeContent(canonicalRefs, courseId) {
        const uniqueRefs = [...new Set(canonicalRefs)];
        
        const { data, error } = await this.client
            .from('content_nodes')
            .select('*')
            .in('canonical_reference', uniqueRefs)
            .eq('course_id', courseId)
            .eq('is_valid', true)
            .order('day', { ascending: true })
            .order('sequence_number', { ascending: true });

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export singleton instance
export const canonicalReferenceRegistry = new CanonicalReferenceRegistry();

// Also export class for testing
export default CanonicalReferenceRegistry;

