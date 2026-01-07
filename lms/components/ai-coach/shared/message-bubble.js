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

        // Add trainer badge for trainer messages (before content)
        if (type === 'trainer') {
            const trainerBadge = document.createElement('div');
            trainerBadge.className = 'trainer-badge';
            const trainerName = message.trainer?.name || message.trainer?.full_name || 'Trainer';
            trainerBadge.innerHTML = `
                <span class="trainer-icon">👨‍🏫</span>
                <span class="trainer-label">Trainer Response</span>
                <span class="trainer-name">by ${trainerName}</span>
            `;
            container.insertBefore(trainerBadge, contentEl);
        }

        container.appendChild(contentEl);

        // References (for AI messages)
        if ((type === 'ai' || type === 'trainer') && message.references && message.references.length > 0) {
            // Separate primary and secondary references
            const primaryRefs = message.references.filter(r => r.is_primary === true);
            const secondaryRefs = message.references.filter(r => r.is_primary !== true);
            
            // Render primary references first with indicator
            if (primaryRefs.length > 0) {
                const primaryRefsEl = document.createElement('div');
                primaryRefsEl.className = 'message-references message-references-primary';
                primaryRefs.forEach(ref => {
                    const refEl = ReferenceLink.render(ref, { courseId });
                    // Add primary indicator
                    const primaryBadge = document.createElement('span');
                    primaryBadge.className = 'reference-primary-badge';
                    primaryBadge.textContent = 'Primary';
                    primaryBadge.setAttribute('aria-label', 'Primary reference');
                    refEl.insertBefore(primaryBadge, refEl.firstChild);
                    primaryRefsEl.appendChild(refEl);
                });
                container.appendChild(primaryRefsEl);
            }
            
            // Render secondary references
            if (secondaryRefs.length > 0) {
                const secondaryRefsEl = ReferenceLink.renderMultiple(secondaryRefs, { courseId });
                secondaryRefsEl.className = 'message-references message-references-secondary';
                container.appendChild(secondaryRefsEl);
            }
            
            // Show disclaimer if required
            const refWithDisclaimer = message.references.find(r => r.requires_disclaimer === true);
            if (refWithDisclaimer && refWithDisclaimer.disclaimer) {
                const disclaimerEl = document.createElement('div');
                disclaimerEl.className = 'reference-disclaimer';
                disclaimerEl.innerHTML = `⚠️ <em>${refWithDisclaimer.disclaimer}</em>`;
                container.appendChild(disclaimerEl);
            }
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

        // Escalation button (for AI messages)
        if (type === 'ai' && message.queryId) {
            const escalationBtn = this._renderEscalationButton(message);
            if (escalationBtn) {
                container.appendChild(escalationBtn);
            }
        }

        // Feedback buttons (for AI messages)
        if (type === 'ai' && showFeedback) {
            const feedbackEl = this._renderFeedback(message.id || container.getAttribute('data-message-id'));
            container.appendChild(feedbackEl);
        }

        // Expand button for long answers (for AI messages)
        if (type === 'ai' && message.answer) {
            const answerLength = message.answer.length;
            const isLongAnswer = answerLength > 500; // Consider answers > 500 chars as "long"
            
            if (isLongAnswer) {
                const expandBtn = this._renderExpandButton(message.id || container.getAttribute('data-message-id'), message.queryId);
                container.appendChild(expandBtn);
            }
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

        // Escape HTML first
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Handle "Key Points:" and "Next Steps:" as headers (even without ###)
        // Convert them to markdown headers first
        formatted = formatted.replace(/\b(Key Points|Next Steps):\s*/gi, '### $1\n');
        
        // Handle headers that might have content on the same line
        // Pattern: ### Header: - list item or ### Header: content
        formatted = formatted.replace(/###\s+([^:]+):\s*([^\n]+)/g, (match, header, content) => {
            // If content starts with - or *, it's a list - split to new line
            if (content.trim().match(/^[-*]\s/)) {
                return `### ${header.trim()}\n${content.trim()}`;
            }
            // Otherwise, keep header and content together for now
            return match;
        });

        // Convert markdown headers (### Header) to HTML headers
        formatted = formatted.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        // Split into paragraphs (double newlines or after headers)
        // First, mark paragraph boundaries
        formatted = formatted.replace(/\n\n+/g, '<PARAGRAPH_BREAK>');
        formatted = formatted.replace(/\n(?=<h[1-3])/g, '<PARAGRAPH_BREAK>');
        formatted = formatted.replace(/(<\/h[1-3]>)\n/g, '$1<PARAGRAPH_BREAK>');
        formatted = formatted.replace(/(<\/h[1-3]>)</g, '$1<PARAGRAPH_BREAK>');

        // Basic markdown: **bold**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Basic markdown: *italic* (but not list markers)
        formatted = formatted.replace(/(?<!^[-*]\s)\*(.*?)\*(?!\s)/g, '<em>$1</em>');

        // Numbered lists (1. item) - handle multiple lists properly
        // Match lists that come after headers, paragraph breaks, or start of line
        formatted = formatted.replace(/(?:^|<PARAGRAPH_BREAK>|<\/h[1-3]>|<PARAGRAPH_BREAK><\/h[1-3]>)\s*(\d+\.\s+.+(?:\n\d+\.\s+.+)*)/gm, (match, listContent) => {
            const items = listContent.trim().split(/\n(?=\d+\.\s+)/);
            return '<ol>' + items.map(item => {
                const content = item.replace(/^\d+\.\s+/, '').trim();
                return '<li>' + content + '</li>';
            }).join('') + '</ol>';
        });

        // Bullet lists (- item or * item) - handle multiple lists properly
        // Match lists that come after headers, paragraph breaks, or start of line
        // Also handle cases where list items might be on the same line separated by spaces
        formatted = formatted.replace(/(?:^|<PARAGRAPH_BREAK>|<\/h[1-3]>|<PARAGRAPH_BREAK><\/h[1-3]>)\s*([-*]\s+.+(?:\n[-*]\s+.+)*)/gm, (match, listContent) => {
            // Split by newlines first
            let items = listContent.trim().split(/\n(?=[-*]\s+)/);
            
            // If we only have one item, check if it contains multiple list items on the same line
            if (items.length === 1) {
                const singleItem = items[0];
                // Check for pattern: - item1 - item2 - item3 (multiple list markers)
                // Match: - followed by content, then another - (not at start)
                const listPattern = /-\s+[^-]+(?=\s+-)/g;
                const matches = singleItem.match(listPattern);
                
                if (matches && matches.length > 0) {
                    // Split by list markers that appear after content
                    // Pattern: match " - " that comes after some content (not at start)
                    items = singleItem.split(/(?<=[^\s])\s+-\s+/).map((item, index) => {
                        if (index === 0) {
                            // First item already has the marker
                            return item.trim();
                        }
                        // Add marker back for subsequent items
                        return '- ' + item.trim();
                    });
                }
            }
            
            return '<ul>' + items.map(item => {
                const content = item.replace(/^[-*]\s+/, '').trim();
                return '<li>' + content + '</li>';
            }).join('') + '</ul>';
        });

        // Convert paragraph breaks to actual paragraphs
        // Split by paragraph breaks and wrap each section
        const sections = formatted.split('<PARAGRAPH_BREAK>');
        formatted = sections.map(section => {
            const trimmed = section.trim();
            if (!trimmed) return '';
            
            // Don't wrap if it's already a header, list, or empty
            if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
                return trimmed;
            }
            
            // Wrap in paragraph tag
            return '<p>' + trimmed + '</p>';
        }).filter(s => s).join('');

        // Clean up any remaining line breaks (convert single \n to space within paragraphs)
        formatted = formatted.replace(/(?<!<\/p>)\n(?!<[puloh])/g, ' ');

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
     * Render expand button for long answers
     * @param {string} messageId - Message ID
     * @param {string} queryId - Query ID (optional, for navigation)
     * @returns {HTMLElement} Expand button element
     */
    static _renderExpandButton(messageId, queryId = null) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'btn-expand-view';
        expandBtn.setAttribute('aria-label', 'Expand view in Coach Section');
        expandBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 4L14 0M14 0H10M14 0V4M4 14L0 10M0 10H4M0 10V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Expand in Coach Section</span>
        `;
        
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._handleExpandClick(messageId, queryId);
        });
        
        return expandBtn;
    }

    /**
     * Handle expand button click
     * @param {string} messageId - Message ID
     * @param {string} queryId - Query ID
     */
    static _handleExpandClick(messageId, queryId) {
        // Navigate to Coach Section with query ID
        const router = window.router || (window.location.hash ? null : null);
        
        if (queryId) {
            // Navigate to coach section with specific query
            const currentHash = window.location.hash.slice(1);
            const courseMatch = currentHash.match(/\/courses\/([^\/]+)/);
            const courseId = courseMatch ? courseMatch[1] : null;
            
            if (courseId) {
                const coachRoute = `#/courses/${courseId}/coach/ai?queryId=${queryId}`;
                window.location.hash = coachRoute;
            } else {
                // Fallback: navigate to coach section without query
                const coachRoute = `#/coach/ai${queryId ? `?queryId=${queryId}` : ''}`;
                window.location.hash = coachRoute;
            }
        } else {
            // Navigate to coach section without specific query
            const currentHash = window.location.hash.slice(1);
            const courseMatch = currentHash.match(/\/courses\/([^\/]+)/);
            const courseId = courseMatch ? courseMatch[1] : null;
            
            if (courseId) {
                window.location.hash = `#/courses/${courseId}/coach/ai`;
            } else {
                window.location.hash = '#/coach/ai';
            }
        }
    }

    /**
     * Render escalation button
     * @param {Object} message - Message object
     * @returns {HTMLElement|null} Escalation button element or null
     */
    static _renderEscalationButton(message) {
        // Don't show escalation button if already escalated
        if (message.escalated || message.escalationId) {
            return null;
        }

        const escalationBtn = document.createElement('button');
        escalationBtn.className = 'btn-escalate';
        escalationBtn.setAttribute('aria-label', 'Escalate to Trainer');
        escalationBtn.innerHTML = `
            <span class="escalate-icon">🔼</span>
            <span>Escalate to Trainer</span>
        `;
        
        escalationBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this._handleEscalationClick(message);
        });

        return escalationBtn;
    }

    /**
     * Handle escalation button click
     * @param {Object} message - Message object
     */
    static async _handleEscalationClick(message) {
        if (!message.queryId) {
            console.error('[MessageBubble] Cannot escalate: missing queryId');
            return;
        }

        try {
            const { escalationService } = await import('../../../services/escalation-service.js');
            
            // Get question details
            const { supabaseClient } = await import('../../../services/supabase-client.js');
            
            // Try query_id first, then fallback to id
            let query = null;
            const { data: queryById } = await supabaseClient
                .from('ai_coach_queries')
                .select('id, course_id, learner_id')
                .eq('id', message.queryId)
                .maybeSingle();
            
            if (queryById) {
                query = queryById;
            } else {
                // Try with query_id field
                const { data: queryByQueryId } = await supabaseClient
                    .from('ai_coach_queries')
                    .select('id, course_id, learner_id')
                    .eq('query_id', message.queryId)
                    .maybeSingle();
                
                if (queryByQueryId) {
                    query = queryByQueryId;
                }
            }

            if (!query) {
                console.error('[MessageBubble] Question not found for queryId:', message.queryId);
                throw new Error('Question not found. Please refresh the page and try again.');
            }

            // Get confidence score from message or fetch from latest response
            let confidenceScore = null;
            if (message.confidence !== undefined && message.confidence !== null) {
                // Convert 0-1 to 0-100
                confidenceScore = message.confidence * 100;
            } else if (message.confidenceScore !== undefined && message.confidenceScore !== null) {
                // Handle if already 0-100 or 0-1
                confidenceScore = message.confidenceScore > 1 ? message.confidenceScore : message.confidenceScore * 100;
            } else {
                // Fallback: fetch from database
                const { data: latestResponse } = await supabaseClient
                    .from('ai_coach_responses')
                    .select('confidence_score')
                    .eq('query_id', message.queryId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (latestResponse && latestResponse.confidence_score !== null) {
                    confidenceScore = parseFloat(latestResponse.confidence_score);
                }
            }
            
            const escalation = await escalationService.manualEscalate({
                questionId: message.queryId,
                courseId: query.course_id,
                learnerId: query.learner_id,
                aiResponseSnapshot: message.answer || '',
                confidenceScore: confidenceScore
            });

            if (escalation) {
                // Update message
                message.escalated = true;
                message.escalationId = escalation.escalation_id;

                // Show success message
                const notice = document.createElement('div');
                notice.className = 'escalation-notice success';
                notice.textContent = '✓ Question escalated to trainer. You will be notified when they respond.';
                
                const messageEl = document.querySelector(`[data-message-id="${message.id}"]`);
                if (messageEl) {
                    messageEl.appendChild(notice);
                    // Hide escalation button
                    const escalationBtn = messageEl.querySelector('.btn-escalate');
                    if (escalationBtn) {
                        escalationBtn.style.display = 'none';
                    }
                }

                // Dispatch event
                window.dispatchEvent(new CustomEvent('ai-coach-escalated', {
                    detail: { escalation, message }
                }));
            }
        } catch (error) {
            console.error('[MessageBubble] Error escalating question:', error);
            alert('Failed to escalate question. Please try again.');
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

