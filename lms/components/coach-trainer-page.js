/**
 * Coach-Trainer Page Component
 * 
 * Dedicated page for trainers to view and respond to escalated AI Coach questions.
 * Features:
 * - List of escalated questions
 * - Filter by status (pending, resolved, etc.)
 * - View escalation details
 * - Respond to learners
 * - Mark as resolved
 */

import { escalationService } from '../services/escalation-service.js';
import { supabaseClient } from '../services/supabase-client.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';
import CourseNavigationTabs from './course-navigation-tabs.js';

class CoachTrainerPage {
    constructor(container) {
        this.container = container;
        this.courseId = null;
        this.currentUser = null;
        this.escalations = [];
        this.filteredEscalations = [];
        this.selectedEscalation = null;
        this.filterStatus = 'pending'; // pending, resolved, all
    }

    /**
     * Show Coach-Trainer page
     * @param {string} courseId - Course ID
     */
    async show(courseId) {
        this.courseId = courseId;
        
        if (!this.container) {
            console.error('[CoachTrainerPage] Container not found');
            return;
        }

        this.container.style.display = 'block';

        // Get current user
        this.currentUser = await authService.getCurrentUser();
        if (!this.currentUser) {
            router.navigate('/login');
            return;
        }

        // Verify user is trainer
        if (this.currentUser.role !== 'trainer' && this.currentUser.role !== 'admin') {
            router.navigate('/courses');
            return;
        }

        // Render header
        await this.renderHeader();

        // Render page
        await this.render();

        // Load escalations
        await this.loadEscalations();
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
     * Render page
     */
    async render() {
        this.container.innerHTML = `
            <div class="coach-page-container">
                <!-- Course Navigation Tabs -->
                <div id="course-nav-tabs-container"></div>

                <!-- Page Header -->
                <div class="coach-page-header">
                    <h1>Trainer Responses</h1>
                    <p class="page-subtitle">Review and respond to escalated AI Coach questions</p>
                </div>

                <!-- Main Content Area -->
                <div class="coach-page-content">
                    <!-- Left Sidebar: Escalation List -->
                    <div class="coach-sidebar">
                        <div class="sidebar-header">
                            <h2>Escalated Questions</h2>
                            <div class="filter-tabs">
                                <button class="filter-tab ${this.filterStatus === 'pending' ? 'active' : ''}" 
                                        data-status="pending">
                                    Pending
                                </button>
                                <button class="filter-tab ${this.filterStatus === 'resolved' ? 'active' : ''}" 
                                        data-status="resolved">
                                    Resolved
                                </button>
                                <button class="filter-tab ${this.filterStatus === 'all' ? 'active' : ''}" 
                                        data-status="all">
                                    All
                                </button>
                            </div>
                        </div>
                        <div class="escalation-list" id="escalation-list-container">
                            <div class="loading-state">Loading escalations...</div>
                        </div>
                    </div>

                    <!-- Right Panel: Escalation Detail / Response -->
                    <div class="coach-main-panel">
                        <div id="coach-main-content">
                            <div class="empty-state">
                                <div class="empty-icon">📋</div>
                                <h3>Select an escalation to view details</h3>
                                <p>Review the question and provide a response to the learner</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render navigation tabs
        await this.renderNavigationTabs();

        // Attach event listeners
        this.attachEventListeners();
    }

    /**
     * Render navigation tabs
     */
    async renderNavigationTabs() {
        const tabsContainer = document.getElementById('course-nav-tabs-container');
        if (tabsContainer) {
            const navTabs = new CourseNavigationTabs(tabsContainer, this.courseId);
            await navTabs.render('coach');
            navTabs.setTabChangeCallback((tabName) => {
                this.handleTabChange(tabName);
            });
        }
    }

    /**
     * Handle tab change
     * @param {string} tabName - Tab name
     */
    handleTabChange(tabName) {
        if (tabName === 'overview') {
            router.navigate(`/courses/${this.courseId}`);
        } else if (tabName === 'content') {
            router.navigate(`/courses/${this.courseId}/learn`);
        } else if (tabName === 'coach') {
            // Already on coach tab
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Filter tabs
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const status = tab.dataset.status;
                this.filterStatus = status;
                this.applyFilter();
            });
        });
    }

    /**
     * Load escalations
     */
    async loadEscalations() {
        const listContainer = document.getElementById('escalation-list-container');
        
        try {
            listContainer.innerHTML = '<div class="loading-state">Loading escalations...</div>';
            
            // Fetch escalations for this course
            const { data, error } = await supabaseClient
                .from('ai_coach_escalations')
                .select(`
                    id,
                    original_question,
                    ai_confidence,
                    status,
                    escalation_reason,
                    created_at,
                    learner_progress,
                    ai_context,
                    trainer_response,
                    resolved_at,
                    query:ai_coach_queries!query_id (
                        id,
                        question,
                        intent,
                        learner_id,
                        course_id
                    )
                `)
                .eq('course_id', this.courseId)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.escalations = data || [];
            this.applyFilter();
        } catch (error) {
            console.error('[CoachTrainerPage] Error loading escalations:', error);
            listContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">Failed to load escalations. Please try again.</div>
                </div>
            `;
        }
    }

    /**
     * Apply filter
     */
    applyFilter() {
        // Update filter tab states
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.status === this.filterStatus);
        });

        // Filter escalations
        if (this.filterStatus === 'all') {
            this.filteredEscalations = this.escalations;
        } else {
            this.filteredEscalations = this.escalations.filter(e => 
                e.status === this.filterStatus
            );
        }

        this.renderEscalationList();
    }

    /**
     * Render escalation list
     */
    renderEscalationList() {
        const listContainer = document.getElementById('escalation-list-container');
        if (!listContainer) return;

        if (this.filteredEscalations.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state-small">
                    <div class="empty-icon">📋</div>
                    <p>No ${this.filterStatus === 'all' ? '' : this.filterStatus} escalations</p>
                </div>
            `;
            return;
        }

        const escalationsHTML = this.filteredEscalations.map(escalation => {
            const date = new Date(escalation.created_at);
            const dateStr = date.toLocaleDateString();
            const isResolved = escalation.status === 'resolved';
            const isPending = escalation.status === 'pending';

            return `
                <div class="escalation-item ${this.selectedEscalation?.id === escalation.id ? 'active' : ''} ${isResolved ? 'resolved' : ''}" 
                     data-escalation-id="${escalation.id}">
                    <div class="escalation-item-header">
                        <div class="escalation-preview">${this.truncateText(escalation.original_question, 60)}</div>
                        <div class="escalation-meta">
                            <span class="escalation-date">${dateStr}</span>
                            ${isPending ? '<span class="escalation-status pending">Pending</span>' : ''}
                            ${isResolved ? '<span class="escalation-status resolved">✓ Resolved</span>' : ''}
                        </div>
                    </div>
                    ${escalation.escalation_reason ? `
                        <div class="escalation-reason">
                            Reason: ${escalation.escalation_reason}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        listContainer.innerHTML = escalationsHTML;

        // Attach click listeners
        const escalationItems = listContainer.querySelectorAll('.escalation-item');
        escalationItems.forEach(item => {
            item.addEventListener('click', () => {
                const escalationId = item.dataset.escalationId;
                this.selectEscalation(escalationId);
            });
        });
    }

    /**
     * Select an escalation to view details
     * @param {string} escalationId - Escalation ID
     */
    selectEscalation(escalationId) {
        const escalation = this.escalations.find(e => e.id === escalationId);
        if (!escalation) return;

        this.selectedEscalation = escalation;
        this.renderEscalationDetail(escalation);

        // Update active state in list
        const listContainer = document.getElementById('escalation-list-container');
        if (listContainer) {
            const items = listContainer.querySelectorAll('.escalation-item');
            items.forEach(item => {
                item.classList.toggle('active', item.dataset.escalationId === escalationId);
            });
        }
    }

    /**
     * Render escalation detail
     * @param {Object} escalation - Escalation object
     */
    renderEscalationDetail(escalation) {
        const mainContent = document.getElementById('coach-main-content');
        if (!mainContent) return;

        const isResolved = escalation.status === 'resolved';
        const aiContext = escalation.ai_context || {};
        const governanceDetails = aiContext.governanceDetails || {};

        mainContent.innerHTML = `
            <div class="escalation-detail">
                <div class="escalation-detail-header">
                    <button class="btn btn-link btn-back" id="back-to-list-btn">
                        ← Back to List
                    </button>
                    <div class="escalation-status-badge ${escalation.status}">
                        ${escalation.status === 'pending' ? '⏳ Pending' : '✓ Resolved'}
                    </div>
                </div>

                <div class="escalation-question-card">
                    <div class="card-label">Learner Question</div>
                    <div class="question-text">${this.escapeHtml(escalation.original_question)}</div>
                    <div class="question-meta">
                        <span>Created: ${new Date(escalation.created_at).toLocaleString()}</span>
                        ${escalation.ai_confidence !== null ? `
                            <span>AI Confidence: ${(escalation.ai_confidence * 100).toFixed(0)}%</span>
                        ` : ''}
                    </div>
                </div>

                <div class="escalation-context-card">
                    <div class="card-label">Escalation Context</div>
                    <div class="context-details">
                        <div class="context-item">
                            <strong>Reason:</strong> ${escalation.escalation_reason || 'Not specified'}
                        </div>
                        ${governanceDetails.violations && governanceDetails.violations.length > 0 ? `
                            <div class="context-item">
                                <strong>Violations:</strong>
                                <ul>
                                    ${governanceDetails.violations.map(v => `
                                        <li>${v.invariant || v.type}: ${v.message || ''}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${aiContext.chunksUsed !== undefined ? `
                            <div class="context-item">
                                <strong>Chunks Used:</strong> ${aiContext.chunksUsed}
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${escalation.trainer_response ? `
                    <div class="trainer-response-card">
                        <div class="card-label">Your Response</div>
                        <div class="response-text">${this.formatResponse(escalation.trainer_response)}</div>
                        ${escalation.resolved_at ? `
                            <div class="response-meta">
                                Resolved: ${new Date(escalation.resolved_at).toLocaleString()}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${!isResolved ? `
                    <div class="trainer-response-form">
                        <div class="form-header">
                            <h3>Respond to Learner</h3>
                        </div>
                        <form id="trainer-response-form">
                            <div class="form-group">
                                <label for="trainer-response-input">Your Response</label>
                                <textarea 
                                    id="trainer-response-input" 
                                    class="form-control"
                                    rows="6"
                                    placeholder="Provide a helpful response to the learner..."
                                    required
                                ></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary" id="submit-response-btn">
                                    <span class="btn-icon">💬</span>
                                    Send Response & Mark Resolved
                                </button>
                            </div>
                        </form>
                    </div>
                ` : ''}
            </div>
        `;

        // Attach event listeners
        const backBtn = document.getElementById('back-to-list-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showEmptyState();
            });
        }

        if (!isResolved) {
            const form = document.getElementById('trainer-response-form');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.submitResponse(escalation.id);
                });
            }
        }
    }

    /**
     * Submit trainer response
     * @param {string} escalationId - Escalation ID
     */
    async submitResponse(escalationId) {
        const textarea = document.getElementById('trainer-response-input');
        const response = textarea?.value.trim();

        if (!response) {
            return;
        }

        const submitBtn = document.getElementById('submit-response-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }

        try {
            // Update escalation with trainer response and mark as resolved
            const { error } = await supabaseClient
                .from('ai_coach_escalations')
                .update({
                    trainer_response: response,
                    status: 'resolved',
                    resolved_at: new Date().toISOString()
                })
                .eq('id', escalationId);

            if (error) {
                throw error;
            }

            // Reload escalations
            await this.loadEscalations();

            // Show success message
            alert('Response sent successfully!');

            // Clear selection
            this.showEmptyState();
        } catch (error) {
            console.error('[CoachTrainerPage] Error submitting response:', error);
            alert('An error occurred. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="btn-icon">💬</span> Send Response & Mark Resolved';
            }
        }
    }

    /**
     * Show empty state
     */
    showEmptyState() {
        const mainContent = document.getElementById('coach-main-content');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Select an escalation to view details</h3>
                <p>Review the question and provide a response to the learner</p>
            </div>
        `;

        this.selectedEscalation = null;
    }

    /**
     * Format response text
     * @param {string} text - Response text
     * @returns {string} Formatted HTML
     */
    formatResponse(text) {
        return this.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    /**
     * Truncate text
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Escape HTML
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default CoachTrainerPage;

