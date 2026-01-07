/**
 * Reference Link Component
 * 
 * Displays clickable links to course content referenced in AI responses.
 * Shows format: "Day X → Chapter Y: [Chapter Title]"
 */

class ReferenceLink {
    /**
     * Render reference link
     * @param {Object} reference - Reference object
     * @param {Object} options - Display options
     * @returns {HTMLElement} Reference link element
     */
    static render(reference, options = {}) {
        const {
            showIcon = true,
            icon = '📖',
            courseId = null
        } = options;

        const container = document.createElement('a');
        container.className = 'ai-coach-reference-link';
        container.href = this._buildUrl(reference, courseId);
        container.setAttribute('data-reference', JSON.stringify(reference));

        // Icon
        if (showIcon) {
            const iconEl = document.createElement('span');
            iconEl.className = 'reference-icon';
            iconEl.textContent = icon;
            iconEl.setAttribute('aria-hidden', 'true');
            container.appendChild(iconEl);
        }

        // Reference text
        const textEl = document.createElement('span');
        textEl.className = 'reference-text';
        textEl.textContent = this._formatReference(reference);
        container.appendChild(textEl);

        // Add click handler
        container.addEventListener('click', (e) => {
            e.preventDefault();
            this._handleClick(reference, courseId);
        });

        return container;
    }

    /**
     * Render multiple reference links
     * @param {Array<Object>} references - Array of reference objects
     * @param {Object} options - Display options
     * @returns {HTMLElement} Container with all reference links
     */
    static renderMultiple(references, options = {}) {
        const container = document.createElement('div');
        container.className = 'ai-coach-references';

        if (!references || references.length === 0) {
            return container;
        }

        references.forEach((reference, index) => {
            const link = this.render(reference, options);
            container.appendChild(link);

            // Add separator (except for last item)
            if (index < references.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'reference-separator';
                separator.textContent = ' • ';
                container.appendChild(separator);
            }
        });

        return container;
    }

    /**
     * Format reference text
     * @param {Object} reference - Reference object
     * @returns {string} Formatted reference text
     */
    static _formatReference(reference) {
        // Priority 1: Use display_reference if available and meaningful (new atomic content architecture)
        // Also check for 'display' field (legacy compatibility)
        const displayRef = reference.display_reference || reference.display;
        if (displayRef && 
            displayRef.trim() && 
            displayRef.length > 10 &&
            !displayRef.match(/^(Chapter|Lab)$/i) &&
            !displayRef.match(/^Day\s+\d+\s*→\s*Chapter$/i)) {
            return displayRef;
        }

        // Priority 2: Build from new format (container_id, container_type, container_title)
        const parts = [];

        // Day
        if (reference.day) {
            parts.push(`Day ${reference.day}`);
        }

        // Container (Chapter or Lab) with number
        if (reference.container_type === 'chapter' && reference.container_id) {
            // Extract chapter number from container_id (e.g., "day5-ch1" or "ch1")
            const dayMatch = reference.container_id.match(/day\d+-ch(\d+)/i);
            const simpleMatch = reference.container_id.match(/ch(\d+)/i);
            const chapterNum = dayMatch ? dayMatch[1] : (simpleMatch ? simpleMatch[1] : null);
            if (chapterNum) {
                parts.push(`Chapter ${chapterNum}`);
            } else {
                parts.push('Chapter');
            }
        } else if (reference.container_type === 'lab' && reference.container_id) {
            // Extract lab number from container_id (e.g., "day5-lab1" or "lab1")
            const dayMatch = reference.container_id.match(/day\d+-lab(\d+)/i);
            const simpleMatch = reference.container_id.match(/lab(\d+)/i);
            const labNum = dayMatch ? dayMatch[1] : (simpleMatch ? simpleMatch[1] : null);
            if (labNum) {
                parts.push(`Lab ${labNum}`);
            } else {
                parts.push('Lab');
            }
        }

        // Container title (CRITICAL - makes references descriptive)
        if (reference.container_title && reference.container_title.trim()) {
            // Clean up container_title - remove redundant prefixes
            let title = reference.container_title
                .replace(/^Day\s+\d+[,\s]+/i, '')
                .replace(/^Chapter\s+\d+[,\s—\-]+/i, '')
                .replace(/^Lab\s+\d+[,\s—\-]+/i, '')
                .replace(/^[—\-]\s*/, '')
                .trim();
            
            // Only add if meaningful (not just "Chapter" or "Lab")
            if (title && 
                title.length > 3 &&
                !title.match(/^(Chapter|Lab|Day)\s*\d*$/i)) {
                parts.push(title);
            }
        }

        // Primary topic (if container_title is missing or too short)
        if (reference.primary_topic && 
            (!reference.container_title || reference.container_title.length < 10)) {
            let topic = reference.primary_topic
                .replace(/^Day\s+\d+[,\s]+/i, '')
                .replace(/^Chapter\s+\d+[,\s—\-]+/i, '')
                .replace(/^Lab\s+\d+[,\s—\-]+/i, '')
                .replace(/^[—\-]\s*/, '')
                .trim();
            
            if (topic && 
                topic.length > 3 &&
                topic !== reference.container_title &&
                !topic.match(/^(Chapter|Lab|Day)\s*\d*$/i)) {
                parts.push(topic);
            }
        }

        // Fallback: Legacy format support (for backward compatibility)
        if (parts.length === 0) {
            if (reference.chapter) {
                const chapterMatch = reference.chapter.match(/day\d+-ch(\d+)/i);
                if (chapterMatch) {
                    parts.push(`Day ${reference.day || '?'}`, `Chapter ${chapterMatch[1]}`);
                } else {
                    parts.push(`Chapter ${reference.chapter}`);
                }
            }
            if (reference.chapter_title) {
                parts.push(reference.chapter_title);
            }
            if (reference.lab_id) {
                const labMatch = reference.lab_id.match(/day\d+-lab(\d+)/i);
                if (labMatch) {
                    parts.push(`Lab ${labMatch[1]}`);
                } else {
                    parts.push(`Lab: ${reference.lab_id}`);
                }
            }
        }

        return parts.length > 0 ? parts.join(' → ') : 'Chapter';
    }

    /**
     * Build URL for reference
     * @param {Object} reference - Reference object
     * @param {string} courseId - Course identifier
     * @returns {string} URL hash
     */
    static _buildUrl(reference, courseId) {
        if (!courseId && reference.course_id) {
            courseId = reference.course_id;
        }

        if (!courseId) {
            return '#';
        }

        // Priority 1: New format - Use container_id and container_type (MUST be non-empty)
        const containerId = reference.container_id && reference.container_id.trim() ? reference.container_id.trim() : null;
        const containerType = reference.container_type && reference.container_type.trim() ? reference.container_type.trim() : null;
        
        if (containerId && containerType) {
            if (containerType === 'lab') {
                // Lab URL: /courses/{courseId}/labs/{container_id}
                return `#/courses/${courseId}/labs/${containerId}`;
            } else if (containerType === 'chapter') {
                // Chapter URL: /courses/{courseId}/content/{container_id}
                return `#/courses/${courseId}/content/${containerId}`;
            }
        }

        // Priority 2: Try to extract from canonical_reference if container_id is missing
        if (reference.canonical_reference && (!containerId || !containerType)) {
            // Extract day and container from canonical reference (e.g., "D8.C1.H1" or "D20.C1.S1")
            const match = reference.canonical_reference.match(/^D(\d+)\.(C|L)(\d+)/i);
            if (match) {
                const day = match[1];
                const type = match[2].toLowerCase() === 'c' ? 'chapter' : 'lab';
                const num = match[3];
                const extractedContainerId = `day${day}-${type === 'chapter' ? 'ch' : 'lab'}${num}`;
                
                if (type === 'lab') {
                    return `#/courses/${courseId}/labs/${extractedContainerId}`;
                } else {
                    return `#/courses/${courseId}/content/${extractedContainerId}`;
                }
            }
        }

        // Priority 3: Legacy format support (for backward compatibility)
        if (reference.lab_id && reference.lab_id.trim()) {
            return `#/courses/${courseId}/labs/${reference.lab_id.trim()}`;
        } else if (reference.chapter && reference.chapter.trim()) {
            return `#/courses/${courseId}/content/${reference.chapter.trim()}`;
        }

        // Last resort: Day level (only if no container information available)
        if (reference.day) {
            console.warn('[ReferenceLink] Falling back to day-level URL. Missing container_id/container_type for reference:', reference);
            return `#/courses/${courseId}/learn?day=${reference.day}`;
        }

        return `#/courses/${courseId}/learn`;
    }

    /**
     * Handle reference link click
     * @param {Object} reference - Reference object
     * @param {string} courseId - Course identifier
     */
    static _handleClick(reference, courseId) {
        const url = this._buildUrl(reference, courseId);
        
        // Navigate using router if available
        if (window.router) {
            window.router.navigate(url);
        } else {
            // Fallback to hash change
            window.location.hash = url;
        }

        // Dispatch custom event
        const event = new CustomEvent('ai-coach-reference-click', {
            detail: { reference, courseId, url }
        });
        window.dispatchEvent(event);
    }
}

export default ReferenceLink;

