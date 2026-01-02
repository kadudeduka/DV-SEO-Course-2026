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
        const parts = [];

        if (reference.day) {
            parts.push(`Day ${reference.day}`);
        }

        if (reference.chapter) {
            parts.push(`Chapter ${reference.chapter}`);
        }

        if (reference.chapter_title) {
            parts.push(reference.chapter_title);
        } else if (reference.chapter) {
            parts.push(reference.chapter);
        }

        if (reference.lab_id) {
            parts.push(`Lab: ${reference.lab_id}`);
        }

        return parts.join(' → ');
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

        // Build URL based on reference type
        if (reference.lab_id) {
            return `#/courses/${courseId}/labs/${reference.lab_id}`;
        } else if (reference.chapter) {
            return `#/courses/${courseId}/content/${reference.chapter}`;
        } else if (reference.day) {
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

