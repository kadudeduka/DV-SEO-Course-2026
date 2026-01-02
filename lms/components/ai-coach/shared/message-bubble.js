/**
 * Message Bubble Component
 * 
 * Displays AI Coach messages with formatting, references, and feedback options.
 * Supports user messages, AI messages, and trainer messages.
 */

import ReferenceLink from './reference-link.js';
import ConfidenceIndicator from './confidence-indicator.js';

class MessageBubble {
    /**
     * Render message bubble
     * @param {Object} message - Message object
     * @param {Object} options - Display options
     * @returns {HTMLElement} Message bubble element
     */
    static render(message, options = {}) {
        const {
            type = 'ai', // 'user', 'ai', 'trainer'
            showTimestamp = true,
            showFeedback = true,
            showConfidence = false,
            courseId = null
        } = options;

        const container = document.createElement('div');
        container.className = `ai-coach-message ai-coach-message-${type}`;
        container.setAttribute('data-message-id', message.id || Date.now());

        // Message content
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        if (type === 'ai' || type === 'trainer') {
            // Format answer text (preserve line breaks, add basic markdown)
            const formattedText = this._formatText(message.answer || message.text);
            contentEl.innerHTML = formattedText;
        } else {
            // User message - plain text
            contentEl.textContent = message.text || message.question;
        }

        container.appendChild(contentEl);

        // References (for AI messages)
        if ((type === 'ai' || type === 'trainer') && message.references && message.references.length > 0) {
            const referencesEl = ReferenceLink.renderMultiple(message.references, { courseId });
            referencesEl.className = 'message-references';
            container.appendChild(referencesEl);
        }

        // Confidence indicator (for AI messages with low confidence)
        if (type === 'ai' && showConfidence && message.confidence !== undefined) {
            const confidenceEl = ConfidenceIndicator.renderCompact(message.confidence);
            confidenceEl.className = 'message-confidence';
            container.appendChild(confidenceEl);
        }

        // Trainer badge (for trainer messages)
        if (type === 'trainer') {
            const badgeEl = document.createElement('div');
            badgeEl.className = 'trainer-badge';
            badgeEl.textContent = 'Trainer Response';
            container.appendChild(badgeEl);
        }

        // Feedback buttons (for AI messages)
        if (type === 'ai' && showFeedback) {
            const feedbackEl = this._renderFeedback(message.id || container.getAttribute('data-message-id'));
            container.appendChild(feedbackEl);
        }

        // Timestamp
        if (showTimestamp && message.timestamp) {
            const timestampEl = document.createElement('div');
            timestampEl.className = 'message-timestamp';
            timestampEl.textContent = this._formatTimestamp(message.timestamp);
            container.appendChild(timestampEl);
        }

        return container;
    }

    /**
     * Format text with basic markdown support
     * @param {string} text - Text to format
     * @returns {string} Formatted HTML
     */
    static _formatText(text) {
        if (!text) return '';

        // Escape HTML
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Convert line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        // Basic markdown: **bold**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Basic markdown: *italic*
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Numbered lists (1. item)
        formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
        if (formatted.includes('<li>')) {
            formatted = '<ol>' + formatted + '</ol>';
        }

        // Bullet lists (- item)
        formatted = formatted.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
        if (formatted.includes('<li>') && !formatted.includes('<ol>')) {
            formatted = '<ul>' + formatted + '</ul>';
        }

        return formatted;
    }

    /**
     * Render feedback buttons
     * @param {string} messageId - Message ID
     * @returns {HTMLElement} Feedback element
     */
    static _renderFeedback(messageId) {
        const feedbackEl = document.createElement('div');
        feedbackEl.className = 'message-feedback';

        const helpfulBtn = document.createElement('button');
        helpfulBtn.className = 'btn-feedback helpful';
        helpfulBtn.setAttribute('aria-label', 'Mark as helpful');
        helpfulBtn.textContent = '👍';
        helpfulBtn.addEventListener('click', () => this._handleFeedback(messageId, 'helpful'));

        const notHelpfulBtn = document.createElement('button');
        notHelpfulBtn.className = 'btn-feedback not-helpful';
        notHelpfulBtn.setAttribute('aria-label', 'Mark as not helpful');
        notHelpfulBtn.textContent = '👎';
        notHelpfulBtn.addEventListener('click', () => this._handleFeedback(messageId, 'not_helpful'));

        feedbackEl.appendChild(helpfulBtn);
        feedbackEl.appendChild(notHelpfulBtn);

        return feedbackEl;
    }

    /**
     * Handle feedback button click
     * @param {string} messageId - Message ID
     * @param {string} rating - 'helpful' or 'not_helpful'
     */
    static _handleFeedback(messageId, rating) {
        // Dispatch custom event for feedback
        const event = new CustomEvent('ai-coach-feedback', {
            detail: { messageId, rating }
        });
        window.dispatchEvent(event);

        // Visual feedback
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            const feedbackEl = messageEl.querySelector('.message-feedback');
            if (feedbackEl) {
                feedbackEl.innerHTML = `<span class="feedback-thanks">Thanks for your feedback!</span>`;
            }
        }
    }

    /**
     * Format timestamp
     * @param {string|Date} timestamp - Timestamp
     * @returns {string} Formatted timestamp
     */
    static _formatTimestamp(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
}

export default MessageBubble;

