/**
 * Trainer AI Escalations List Component
 * 
 * Displays list of AI Coach escalations for trainers to review and respond to.
 */

import { authService } from '../services/auth-service.js';
import { escalationService } from '../services/escalation-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class TrainerAIEscalations {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.escalations = [];
        this.filters = {
            status: 'pending' // Default: show pending escalations
        };
    }

    /**
     * Show escalations page
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
     * Load escalations data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            await this.loadEscalations();
            await this.loadStats();
        } catch (error) {
            console.error('[TrainerAIEscalations] Error loading data:', error);
            this.renderError('Failed to load escalations: ' + error.message);
        }
    }

    /**
     * Load escalations
     */
    async loadEscalations() {
        try {
            this.escalations = await escalationService.getEscalationsForTrainer(
                this.currentUser.id,
                this.filters
            );
        } catch (error) {
            console.error('[TrainerAIEscalations] Error loading escalations:', error);
            this.escalations = [];
        }
    }

    /**
     * Load statistics
     */
    async loadStats() {
        try {
            this.stats = await escalationService.getEscalationStats(this.currentUser.id);
        } catch (error) {
            console.warn('[TrainerAIEscalations] Error loading stats:', error);
            this.stats = { total: 0, pending: 0, responded: 0, resolved: 0 };
        }
    }

    /**
     * Render the page
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="container" style="max-width: 1200px; margin: 20px auto; padding: 20px;">
                <div class="page-header" style="margin-bottom: 30px;">
                    <h1 style="margin: 0 0 10px 0;">🤖 AI Coach Escalations</h1>
                    <p style="color: #666; margin: 0;">
                        Review and respond to questions where the AI Coach had low confidence.
                    </p>
                </div>

                ${this.renderStats()}
                ${this.renderFilters()}
                ${this.renderEscalationsList()}
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render statistics
     */
    renderStats() {
        if (!this.stats) return '';

        return `
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="stat-card" style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
                    <div style="font-size: 32px; font-weight: bold; color: #007bff;">${this.stats.total}</div>
                    <div style="color: #666; margin-top: 5px;">Total Escalations</div>
                </div>
                <div class="stat-card" style="padding: 20px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
                    <div style="font-size: 32px; font-weight: bold; color: #856404;">${this.stats.pending}</div>
                    <div style="color: #666; margin-top: 5px;">Pending</div>
                </div>
                <div class="stat-card" style="padding: 20px; background: #d1ecf1; border-radius: 8px; border: 1px solid #0c5460;">
                    <div style="font-size: 32px; font-weight: bold; color: #0c5460;">${this.stats.responded}</div>
                    <div style="color: #666; margin-top: 5px;">Responded</div>
                </div>
                <div class="stat-card" style="padding: 20px; background: #d4edda; border-radius: 8px; border: 1px solid #28a745;">
                    <div style="font-size: 32px; font-weight: bold; color: #155724;">${this.stats.resolved}</div>
                    <div style="color: #666; margin-top: 5px;">Resolved</div>
                </div>
            </div>
        `;
    }

    /**
     * Render filters
     */
    renderFilters() {
        return `
            <div class="filters" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <label style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 600;">Filter by status:</span>
                    <select id="status-filter" class="form-control" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="">All</option>
                        <option value="pending" ${this.filters.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="responded" ${this.filters.status === 'responded' ? 'selected' : ''}>Responded</option>
                        <option value="resolved" ${this.filters.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                </label>
            </div>
        `;
    }

    /**
     * Render escalations list
     */
    renderEscalationsList() {
        if (this.escalations.length === 0) {
            return `
                <div style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 8px;">
                    <p style="color: #666; font-size: 18px;">No escalations found.</p>
                    <p style="color: #999; margin-top: 10px;">Escalations will appear here when learners ask questions that the AI Coach has low confidence answering.</p>
                </div>
            `;
        }

        return `
            <div class="escalations-list">
                ${this.escalations.map(escalation => this.renderEscalationCard(escalation)).join('')}
            </div>
        `;
    }

    /**
     * Render single escalation card
     */
    renderEscalationCard(escalation) {
        const learner = escalation.learner || {};
        const learnerName = learner.full_name || learner.name || learner.email || 'Unknown Learner';
        const statusColor = {
            'pending': '#ffc107',
            'responded': '#17a2b8',
            'resolved': '#28a745'
        }[escalation.status] || '#6c757d';

        const confidencePercent = (escalation.ai_confidence * 100).toFixed(0);
        const date = new Date(escalation.created_at).toLocaleDateString();

        return `
            <div class="escalation-card" style="margin-bottom: 20px; padding: 20px; background: white; border: 1px solid #e0e0e0; border-radius: 8px; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                ${escalation.status}
                            </span>
                            <span style="color: #666; font-size: 14px;">${date}</span>
                        </div>
                        <h3 style="margin: 0 0 10px 0; font-size: 18px;">${this.escapeHtml(escalation.original_question)}</h3>
                        <div style="color: #666; font-size: 14px; margin-bottom: 10px;">
                            <strong>Learner:</strong> ${this.escapeHtml(learnerName)}
                        </div>
                        <div style="color: #666; font-size: 14px;">
                            <strong>AI Confidence:</strong> 
                            <span style="color: ${escalation.ai_confidence < 0.5 ? '#dc3545' : '#ffc107'}; font-weight: 600;">
                                ${confidencePercent}%
                            </span>
                        </div>
                    </div>
                    <div>
                        <a href="#/trainer/ai-escalations/${escalation.id}" 
                           class="btn btn-primary" 
                           style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; text-decoration: none; cursor: pointer;">
                            ${escalation.status === 'pending' ? 'Respond' : 'View'}
                        </a>
                    </div>
                </div>
                ${escalation.trainer_response ? `
                    <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
                        <strong style="color: #666;">Your Response:</strong>
                        <p style="margin: 10px 0 0 0; color: #333;">${this.escapeHtml(escalation.trainer_response)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value || null;
                this.loadEscalations().then(() => this.render());
            });
        }
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

export default TrainerAIEscalations;

