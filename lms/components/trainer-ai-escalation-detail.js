/**
 * Trainer AI Escalation Detail Component
 * 
 * Displays detailed view of an escalation with AI context and allows trainer to respond.
 */

import { authService } from '../services/auth-service.js';
import { escalationService } from '../services/escalation-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class TrainerAIEscalationDetail {
    constructor(container, escalationId) {
        this.container = container;
        this.escalationId = escalationId;
        this.currentUser = null;
        this.escalation = null;
    }

    /**
     * Show escalation detail page
     */
    async show() {
        if (this.container) {
            this.container.style.display = 'block';
        }

        await this.renderHeader();
        await this.loadData();
        this.render();
    }

    /**
     * Render header
     */
    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    /**
     * Load escalation data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            this.escalation = await escalationService.getEscalationById(this.escalationId);

            // Verify trainer owns this escalation
            if (this.escalation.trainer_id !== this.currentUser.id) {
                this.renderError('Unauthorized: This escalation is not assigned to you.');
                return;
            }
        } catch (error) {
            console.error('[TrainerAIEscalationDetail] Error loading data:', error);
            this.renderError('Failed to load escalation: ' + error.message);
        }
    }

    /**
     * Render the page
     */
    render() {
        if (!this.container || !this.escalation) return;

        const learner = this.escalation.learner || {};
        const learnerName = learner.full_name || learner.name || learner.email || 'Unknown Learner';
        const query = this.escalation.query || {};
        const response = this.escalation.response || {};
        const confidencePercent = (this.escalation.ai_confidence * 100).toFixed(0);

        this.container.innerHTML = `
            <div class="container" style="max-width: 1000px; margin: 20px auto; padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <a href="#/trainer/ai-escalations" style="color: #007bff; text-decoration: none;">← Back to Escalations</a>
                </div>

                <div class="page-header" style="margin-bottom: 30px;">
                    <h1 style="margin: 0 0 10px 0;">Escalation Details</h1>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span style="padding: 6px 12px; background: ${this.getStatusColor(this.escalation.status)}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                            ${this.escalation.status}
                        </span>
                        <span style="color: #666;">Created: ${new Date(this.escalation.created_at).toLocaleString()}</span>
                    </div>
                </div>

                <div class="escalation-content" style="display: grid; gap: 20px;">
                    ${this.renderLearnerInfo(learner, learnerName)}
                    ${this.renderQuestion(query)}
                    ${this.renderAIContext(response)}
                    ${this.renderLearnerProgress()}
                    ${this.renderResponseForm()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Get status color
     */
    getStatusColor(status) {
        const colors = {
            'pending': '#ffc107',
            'responded': '#17a2b8',
            'resolved': '#28a745'
        };
        return colors[status] || '#6c757d';
    }

    /**
     * Render learner info
     */
    renderLearnerInfo(learner, learnerName) {
        return `
            <div class="info-card" style="padding: 20px; background: white; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0;">Learner Information</h3>
                <div style="display: grid; gap: 10px;">
                    <div><strong>Name:</strong> ${this.escapeHtml(learnerName)}</div>
                    <div><strong>Email:</strong> ${this.escapeHtml(learner.email || 'N/A')}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render question
     */
    renderQuestion(query) {
        return `
            <div class="info-card" style="padding: 20px; background: white; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0;">Learner's Question</h3>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 4px; font-size: 16px; line-height: 1.6;">
                    ${this.escapeHtml(this.escalation.original_question)}
                </div>
                <div style="margin-top: 15px; color: #666; font-size: 14px;">
                    <strong>Intent:</strong> ${query.intent || 'N/A'} | 
                    <strong>Asked:</strong> ${query.created_at ? new Date(query.created_at).toLocaleString() : 'N/A'}
                </div>
            </div>
        `;
    }

    /**
     * Render AI context
     */
    renderAIContext(response) {
        const aiContext = this.escalation.ai_context || {};
        const references = response.reference_locations || [];

        return `
            <div class="info-card" style="padding: 20px; background: white; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0;">AI Coach Context</h3>
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; gap: 20px; margin-bottom: 10px;">
                        <div>
                            <strong>AI Confidence:</strong> 
                            <span style="color: ${this.escalation.ai_confidence < 0.5 ? '#dc3545' : '#ffc107'}; font-weight: 600;">
                                ${(this.escalation.ai_confidence * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div><strong>Chunks Used:</strong> ${aiContext.chunks_used || 0}</div>
                    </div>
                </div>
                ${response.answer ? `
                    <div style="margin-top: 15px;">
                        <strong>AI's Answer:</strong>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 4px; margin-top: 10px;">
                            ${this.escapeHtml(response.answer)}
                        </div>
                    </div>
                ` : ''}
                ${references.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <strong>References:</strong>
                        <ul style="margin: 10px 0 0 20px;">
                            ${references.map(ref => `
                                <li>Day ${ref.day} → ${ref.chapter_title || ref.chapter}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render learner progress
     */
    renderLearnerProgress() {
        const progress = this.escalation.learner_progress || {};

        return `
            <div class="info-card" style="padding: 20px; background: white; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0;">Learner Progress Snapshot</h3>
                <div style="display: grid; gap: 10px;">
                    <div><strong>Current Day:</strong> ${progress.currentDay || 'N/A'}</div>
                    <div><strong>Current Chapter:</strong> ${progress.currentChapter || 'N/A'}</div>
                    <div><strong>Completed Chapters:</strong> ${(progress.completedChapters || []).length}</div>
                    <div><strong>In Progress:</strong> ${(progress.inProgressChapters || []).length}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render response form
     */
    renderResponseForm() {
        if (this.escalation.status === 'resolved') {
            return `
                <div class="info-card" style="padding: 20px; background: #d4edda; border: 1px solid #28a745; border-radius: 8px;">
                    <h3 style="margin: 0 0 15px 0;">✅ Resolved</h3>
                    ${this.escalation.trainer_response ? `
                        <div style="padding: 15px; background: white; border-radius: 4px; margin-top: 10px;">
                            <strong>Your Response:</strong>
                            <p style="margin: 10px 0 0 0;">${this.escapeHtml(this.escalation.trainer_response)}</p>
                            <div style="margin-top: 10px; color: #666; font-size: 14px;">
                                Responded: ${this.escalation.trainer_responded_at ? new Date(this.escalation.trainer_responded_at).toLocaleString() : 'N/A'}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div class="info-card" style="padding: 20px; background: white; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0;">${this.escalation.status === 'responded' ? 'Update Response' : 'Your Response'}</h3>
                <form id="response-form">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Response to Learner
                        </label>
                        <textarea 
                            id="trainer-response" 
                            rows="6" 
                            required
                            placeholder="Provide a helpful response to the learner's question..."
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; font-family: inherit;"
                        >${this.escapeHtml(this.escalation.trainer_response || '')}</textarea>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="use-as-reference" />
                            <span>Use this response as a reference for future AI responses (optional)</span>
                        </label>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button 
                            type="submit" 
                            class="btn btn-primary"
                            style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;"
                        >
                            ${this.escalation.status === 'responded' ? 'Update Response' : 'Send Response'}
                        </button>
                        ${this.escalation.status === 'responded' ? `
                            <button 
                                type="button" 
                                id="resolve-btn"
                                class="btn btn-success"
                                style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"
                            >
                                Mark as Resolved
                            </button>
                        ` : ''}
                    </div>
                </form>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const responseForm = document.getElementById('response-form');
        if (responseForm) {
            responseForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        const resolveBtn = document.getElementById('resolve-btn');
        if (resolveBtn) {
            resolveBtn.addEventListener('click', () => this.handleResolve());
        }
    }

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();

        const responseText = document.getElementById('trainer-response').value.trim();
        const useAsReference = document.getElementById('use-as-reference')?.checked || false;

        if (!responseText) {
            alert('Please enter a response');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            await escalationService.respondToEscalation(
                this.escalationId,
                this.currentUser.id,
                responseText,
                useAsReference
            );

            this.showMessage('✅ Response sent successfully!', 'success');
            
            // Reload data and re-render
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('[TrainerAIEscalationDetail] Error submitting response:', error);
            this.showMessage('❌ Failed to send response: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = this.escalation.status === 'responded' ? 'Update Response' : 'Send Response';
        }
    }

    /**
     * Handle resolve
     */
    async handleResolve() {
        if (!confirm('Mark this escalation as resolved?')) {
            return;
        }

        try {
            await escalationService.resolveEscalation(this.escalationId, this.currentUser.id);
            this.showMessage('✅ Escalation marked as resolved!', 'success');
            
            // Reload data and re-render
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('[TrainerAIEscalationDetail] Error resolving escalation:', error);
            this.showMessage('❌ Failed to resolve: ' + error.message, 'error');
        }
    }

    /**
     * Show message
     */
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `alert alert-${type}`;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        messageEl.textContent = message;
        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }

    /**
     * Render error
     */
    renderError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="alert alert-danger" style="margin: 20px; padding: 15px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;">
                <strong>Error:</strong> ${this.escapeHtml(message)}
            </div>
        `;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default TrainerAIEscalationDetail;

