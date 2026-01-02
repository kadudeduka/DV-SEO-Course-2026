/**
 * Confidence Indicator Component
 * 
 * Displays AI Coach's confidence level in a response.
 * Shows confidence score visually with color coding.
 */

class ConfidenceIndicator {
    /**
     * Render confidence indicator
     * @param {number} confidence - Confidence score (0-1)
     * @param {Object} options - Display options
     * @returns {HTMLElement} Confidence indicator element
     */
    static render(confidence, options = {}) {
        const {
            showLabel = true,
            showPercentage = true,
            threshold = 0.65,
            size = 'medium' // 'small', 'medium', 'large'
        } = options;

        const container = document.createElement('div');
        container.className = `ai-coach-confidence ai-coach-confidence-${size}`;

        // Determine confidence level
        let level = 'high';
        let color = '#10b981'; // green
        let label = 'High Confidence';

        if (confidence < threshold) {
            level = 'low';
            color = '#ef4444'; // red
            label = 'Low Confidence';
        } else if (confidence < threshold + 0.15) {
            level = 'medium';
            color = '#f59e0b'; // amber
            label = 'Medium Confidence';
        }

        // Create indicator
        const indicator = document.createElement('div');
        indicator.className = `confidence-indicator confidence-${level}`;
        indicator.style.setProperty('--confidence-color', color);

        // Confidence bar
        const bar = document.createElement('div');
        bar.className = 'confidence-bar';
        bar.style.width = `${confidence * 100}%`;
        bar.style.backgroundColor = color;
        indicator.appendChild(bar);

        // Confidence content
        const content = document.createElement('div');
        content.className = 'confidence-content';

        if (showLabel) {
            const labelEl = document.createElement('span');
            labelEl.className = 'confidence-label';
            labelEl.textContent = label;
            content.appendChild(labelEl);
        }

        if (showPercentage) {
            const percentageEl = document.createElement('span');
            percentageEl.className = 'confidence-percentage';
            percentageEl.textContent = `${Math.round(confidence * 100)}%`;
            content.appendChild(percentageEl);
        }

        indicator.appendChild(content);
        container.appendChild(indicator);

        // Add tooltip for low confidence
        if (level === 'low') {
            container.title = 'This answer has low confidence. It may be escalated to your trainer.';
        }

        return container;
    }

    /**
     * Render compact confidence indicator (icon only)
     * @param {number} confidence - Confidence score (0-1)
     * @param {number} threshold - Confidence threshold
     * @returns {HTMLElement} Compact indicator
     */
    static renderCompact(confidence, threshold = 0.65) {
        const container = document.createElement('span');
        container.className = 'ai-coach-confidence-compact';

        let icon = '✓';
        let color = '#10b981';
        let title = 'High confidence';

        if (confidence < threshold) {
            icon = '⚠';
            color = '#ef4444';
            title = 'Low confidence - may be escalated';
        } else if (confidence < threshold + 0.15) {
            icon = '~';
            color = '#f59e0b';
            title = 'Medium confidence';
        }

        container.textContent = icon;
        container.style.color = color;
        container.title = title;
        container.setAttribute('aria-label', title);

        return container;
    }
}

export default ConfidenceIndicator;

