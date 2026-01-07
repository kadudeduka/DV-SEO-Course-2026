/**
 * Trainer Escalations Component
 * 
 * Interface for trainers to view and respond to escalated questions.
 * Features:
 * - List of open escalations
 * - View question + AI response
 * - Respond to escalations
 * - Status management
 */

import { escalationService } from '../services/escalation-service.js';
import { authService } from '../services/auth-service.js';
import { supabaseClient } from '../services/supabase-client.js';

class CoachTrainerEscalations {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.courseId = null;
        this.escalations = [];
        this.selectedEscalation = null;
    }

    /**
     * Initialize component
     * @param {string} courseId - Course ID (optional)
     */
    async init(courseId = null) {
        this.courseId = courseId;
        this.currentUser = await authService.getCurrentUser();
        
        if (!this.currentUser) {
            this.container.innerHTML = '<p>Please log in to view escalations.</p>';
            return;
        }

        // Verify user is a trainer
        if (this.currentUser.role !== 'trainer' && this.currentUser.role !== 'admin') {
            this.container.innerHTML = '<p>Access denied. Trainer role required.</p>';
            return;
        }

        await this.render();
        await this.loadEscalations();
    }

    /**
     * Render component
     */
    async render() {
        this.container.innerHTML = `
            <div class="trainer-escalations-container">
                <div class="escalations-header">
                    <h2>Escalated Questions</h2>
                    <p>Review and respond to questions escalated from AI Coach</p>
                </div>

                <div class="escalations-layout">
                    <!-- Left: Escalations List -->
                    <div class="escalations-list-container">
                        <div class="escalations-list-header">
                            <h3>Open Escalations</h3>
                            <button class="btn-refresh" id="refresh-escalations-btn">🔄 Refresh</button>
                        </div>
                        <div class="escalations-list" id="escalations-list">
                            <div class="loading-state">Loading escalations...</div>
                        </div>
                    </div>

                    <!-- Right: Escalation Detail -->
                    <div class="escalation-detail-container">
                        <div class="empty-state" id="escalation-detail-empty">
                            <div class="empty-icon">💬</div>
                            <h3>Select an escalation to view details</h3>
                            <p>Choose an escalation from the list to see the question and AI response</p>
                        </div>
                        <div class="escalation-detail" id="escalation-detail" style="display: none;">
                            <!-- Will be populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        const refreshBtn = document.getElementById('refresh-escalations-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadEscalations());
        }
    }

    /**
     * Load escalations
     */
    async loadEscalations() {
        const listContainer = document.getElementById('escalations-list');
        if (!listContainer) return;

        try {
            listContainer.innerHTML = '<div class="loading-state">Loading escalations...</div>';

            this.escalations = await escalationService.getOpenEscalationsForTrainer(
                this.currentUser.id,
                { courseId: this.courseId, limit: 100 }
            );

            if (this.escalations.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state-small">
                        <div class="empty-icon">✅</div>
                        <p>No open escalations</p>
                        <p class="text-muted">All escalated questions have been responded to.</p>
                    </div>
                `;
                return;
            }

            // Render escalations list
            const escalationsHTML = this.escalations.map(escalation => {
                const question = escalation.question?.question || 'No question text';
                const questionPreview = question.length > 60 ? question.substring(0, 60) + '...' : question;
                const date = new Date(escalation.created_at);
                const dateStr = date.toLocaleDateString();
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isSelected = this.selectedEscalation?.escalation_id === escalation.escalation_id;

                return `
                    <div class="escalation-item ${isSelected ? 'active' : ''}" 
                         data-escalation-id="${escalation.escalation_id}">
                        <div class="escalation-item-header">
                            <div class="escalation-type-badge ${escalation.escalation_type}">
                                ${escalation.escalation_type === 'auto' ? '🤖 Auto' : '👤 Manual'}
                            </div>
                            ${escalation.confidence_score !== null ? `
                                <div class="confidence-badge" style="background: ${this._getConfidenceColor(escalation.confidence_score)}">
                                    ${escalation.confidence_score.toFixed(0)}%
                                </div>
                            ` : ''}
                        </div>
                        <div class="escalation-question-preview">${this._escapeHtml(questionPreview)}</div>
                        <div class="escalation-meta">
                            <span class="escalation-date">${dateStr} ${timeStr}</span>
                            <span class="escalation-course">${escalation.course_id}</span>
                        </div>
                    </div>
                `;
            }).join('');

            listContainer.innerHTML = escalationsHTML;

            // Attach click listeners
            const escalationItems = listContainer.querySelectorAll('.escalation-item');
            escalationItems.forEach(item => {
                item.addEventListener('click', () => {
                    const escalationId = item.dataset.escalationId;
                    const escalation = this.escalations.find(e => e.escalation_id === escalationId);
                    if (escalation) {
                        this.selectEscalation(escalation);
                    }
                });
            });
        } catch (error) {
            console.error('[CoachTrainerEscalations] Error loading escalations:', error);
            listContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">Failed to load escalations. Please try again.</div>
                </div>
            `;
        }
    }

    /**
     * Select an escalation to view details
     * @param {Object} escalation - Escalation object
     */
    async selectEscalation(escalation) {
        this.selectedEscalation = escalation;

        // Update UI
        const items = document.querySelectorAll('.escalation-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.escalationId === escalation.escalation_id);
        });

        // Show detail view
        const emptyState = document.getElementById('escalation-detail-empty');
        const detailView = document.getElementById('escalation-detail');
        
        if (emptyState) emptyState.style.display = 'none';
        if (detailView) detailView.style.display = 'block';

        // Load escalation details
        await this.renderEscalationDetail(escalation);
    }

    /**
     * Render escalation detail
     * @param {Object} escalation - Escalation object
     */
    async renderEscalationDetail(escalation) {
        const detailView = document.getElementById('escalation-detail');
        if (!detailView) return;

        // Get trainer response if exists
        const trainerResponse = await escalationService.getTrainerResponse(escalation.escalation_id);

        const question = escalation.question?.question || 'No question text';
        const date = new Date(escalation.created_at);
        const learnerName = escalation.learner?.name || escalation.learner?.email || 'Unknown Learner';

        detailView.innerHTML = `
            <div class="escalation-detail-header">
                <button class="btn-back" id="back-to-list-btn">← Back to List</button>
                <div class="escalation-meta-info">
                    <span class="escalation-type-badge ${escalation.escalation_type}">
                        ${escalation.escalation_type === 'auto' ? '🤖 Auto-escalated' : '👤 Manually escalated'}
                    </span>
                    ${escalation.confidence_score !== null ? `
                        <span class="confidence-badge" style="background: ${this._getConfidenceColor(escalation.confidence_score)}">
                            Confidence: ${escalation.confidence_score.toFixed(0)}%
                        </span>
                    ` : ''}
                </div>
            </div>

            <div class="escalation-detail-content">
                <!-- Learner Question -->
                <div class="detail-section">
                    <div class="section-label">Learner Question</div>
                    <div class="question-text">${this._escapeHtml(question)}</div>
                    <div class="question-meta">
                        <span>Asked by: ${this._escapeHtml(learnerName)}</span>
                        <span>•</span>
                        <span>${date.toLocaleString()}</span>
                        <span>•</span>
                        <span>Course: ${escalation.course_id}</span>
                    </div>
                </div>

                <!-- AI Response -->
                <div class="detail-section">
                    <div class="section-label">🤖 AI Coach Response</div>
                    <div class="ai-response-text">${this._formatText(escalation.ai_response_snapshot)}</div>
                </div>

                <!-- Trainer Response -->
                <div class="detail-section">
                    <div class="section-label">👨‍🏫 Your Response</div>
                    ${trainerResponse ? `
                        <div class="trainer-response-existing">
                            <div class="trainer-response-text">${this._formatText(trainerResponse.response_text)}</div>
                            <div class="trainer-response-meta">
                                <span>Responded: ${new Date(trainerResponse.created_at).toLocaleString()}</span>
                                ${trainerResponse.updated_at !== trainerResponse.created_at ? `
                                    <span>• Updated: ${new Date(trainerResponse.updated_at).toLocaleString()}</span>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    <div class="trainer-response-form">
                        <textarea 
                            id="trainer-response-input" 
                            class="form-control"
                            rows="6"
                            placeholder="Type your response to the learner here...">${trainerResponse ? trainerResponse.response_text : ''}</textarea>
                        <div class="form-actions">
                            <button class="btn btn-primary" id="submit-response-btn">
                                ${trainerResponse ? 'Update Response' : 'Submit Response'}
                            </button>
                            ${trainerResponse ? `
                                <button class="btn btn-secondary" id="cancel-edit-btn">Cancel</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        const backBtn = document.getElementById('back-to-list-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const emptyState = document.getElementById('escalation-detail-empty');
                const detailView = document.getElementById('escalation-detail');
                if (emptyState) emptyState.style.display = 'block';
                if (detailView) detailView.style.display = 'none';
                this.selectedEscalation = null;
            });
        }

        const submitBtn = document.getElementById('submit-response-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitResponse(escalation.escalation_id));
        }

        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const textarea = document.getElementById('trainer-response-input');
                if (textarea && trainerResponse) {
                    textarea.value = trainerResponse.response_text;
                }
            });
        }
    }

    /**
     * Submit trainer response
     * @param {string} escalationId - Escalation ID
     */
    async submitResponse(escalationId) {
        const textarea = document.getElementById('trainer-response-input');
        if (!textarea) return;

        const responseText = textarea.value.trim();
        if (!responseText) {
            alert('Please enter a response before submitting.');
            return;
        }

        const submitBtn = document.getElementById('submit-response-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        try {
            await escalationService.createOrUpdateTrainerResponse({
                escalationId: escalationId,
                trainerId: this.currentUser.id,
                responseText: responseText
            });

            // Reload escalation detail to show updated response
            const escalation = this.escalations.find(e => e.escalation_id === escalationId);
            if (escalation) {
                await this.renderEscalationDetail(escalation);
            }

            // Show success message
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.textContent = '✓ Response submitted successfully!';
            const detailView = document.getElementById('escalation-detail');
            if (detailView) {
                detailView.insertBefore(successMsg, detailView.firstChild);
                setTimeout(() => successMsg.remove(), 3000);
            }

            // Reload escalations list (may remove if responded)
            await this.loadEscalations();
        } catch (error) {
            console.error('[CoachTrainerEscalations] Error submitting response:', error);
            alert('Failed to submit response. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.textContent.includes('Update') ? 'Update Response' : 'Submit Response';
            }
        }
    }

    /**
     * Get confidence color
     * @param {number} confidence - Confidence score (0-100)
     * @returns {string} Color hex
     */
    _getConfidenceColor(confidence) {
        if (confidence >= 70) return '#10b981'; // Green
        if (confidence >= 50) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    }

    /**
     * Format text (basic markdown)
     * @param {string} text - Text to format
     * @returns {string} Formatted HTML
     */
    _formatText(text) {
        if (!text) return '';
        return this._escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    /**
     * Escape HTML
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default CoachTrainerEscalations;

