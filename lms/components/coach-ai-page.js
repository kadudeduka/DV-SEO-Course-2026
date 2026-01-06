/**
 * Coach-AI Page Component
 * 
 * Dedicated page for learners to view all AI Coach query history and ask questions.
 * Features:
 * - Full query history with search/filter
 * - Ask new questions
 * - View detailed responses
 * - Recent queries sidebar
 */

import { queryHistoryService } from '../services/query-history-service.js';
import { aiCoachService } from '../services/ai-coach-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';
import CourseNavigationTabs from './course-navigation-tabs.js';

class CoachAIPage {
    constructor(container) {
        this.container = container;
        this.courseId = null;
        this.currentUser = null;
        this.queries = [];
        this.filteredQueries = [];
        this.selectedQuery = null;
        this.isLoading = false;
        this.currentPage = 0;
        this.pageSize = 20;
        this.searchTerm = '';
    }

    /**
     * Show Coach-AI page
     * @param {string} courseId - Course ID
     */
    async show(courseId) {
        this.courseId = courseId;
        
        if (!this.container) {
            console.error('[CoachAIPage] Container not found');
            return;
        }

        this.container.style.display = 'block';

        // Get current user
        this.currentUser = await authService.getCurrentUser();
        if (!this.currentUser) {
            router.navigate('/login');
            return;
        }

        // Render header
        await this.renderHeader();

        // Render page
        await this.render();

        // Load query history
        await this.loadQueryHistory();
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
                    <h1>AI Coach</h1>
                    <p class="page-subtitle">Ask questions and view your conversation history</p>
                </div>

                <!-- Main Content Area -->
                <div class="coach-page-content">
                    <!-- Left Sidebar: Query List -->
                    <div class="coach-sidebar">
                        <div class="sidebar-header">
                            <h2>Your Questions</h2>
                            <div class="search-box">
                                <input 
                                    type="text" 
                                    id="query-search-input" 
                                    placeholder="Search questions..."
                                    class="search-input"
                                />
                                <span class="search-icon">🔍</span>
                            </div>
                        </div>
                        <div class="query-list" id="query-list-container">
                            <div class="loading-state">Loading your questions...</div>
                        </div>
                        <div class="sidebar-footer">
                            <button class="btn btn-primary btn-block" id="ask-new-question-btn">
                                <span class="btn-icon">➕</span>
                                Ask New Question
                            </button>
                        </div>
                    </div>

                    <!-- Right Panel: Query Detail / Ask Question -->
                    <div class="coach-main-panel">
                        <div id="coach-main-content">
                            <div class="empty-state">
                                <div class="empty-icon">💬</div>
                                <h3>Select a question to view details</h3>
                                <p>Or ask a new question to get started</p>
                                <button class="btn btn-primary" id="ask-question-empty-btn">
                                    Ask Your First Question
                                </button>
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
        // Search input
        const searchInput = document.getElementById('query-search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchTerm = e.target.value.trim();
                    this.filterQueries();
                }, 300);
            });
        }

        // Ask new question buttons
        const askButtons = document.querySelectorAll('#ask-new-question-btn, #ask-question-empty-btn');
        askButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.showAskQuestionForm();
            });
        });
    }

    /**
     * Load query history
     */
    async loadQueryHistory() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const listContainer = document.getElementById('query-list-container');
        
        try {
            listContainer.innerHTML = '<div class="loading-state">Loading your questions...</div>';
            
            this.queries = await queryHistoryService.getQueryHistory(
                this.currentUser.id,
                this.courseId,
                {
                    limit: 100, // Load more for search
                    offset: 0
                }
            );

            this.filteredQueries = this.queries;
            this.renderQueryList();
        } catch (error) {
            console.error('[CoachAIPage] Error loading query history:', error);
            listContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">Failed to load questions. Please try again.</div>
                </div>
            `;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Filter queries based on search term
     */
    filterQueries() {
        if (!this.searchTerm) {
            this.filteredQueries = this.queries;
        } else {
            const searchLower = this.searchTerm.toLowerCase();
            this.filteredQueries = this.queries.filter(query => 
                query.question.toLowerCase().includes(searchLower)
            );
        }
        this.renderQueryList();
    }

    /**
     * Render query list
     */
    renderQueryList() {
        const listContainer = document.getElementById('query-list-container');
        if (!listContainer) return;

        if (this.filteredQueries.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state-small">
                    <div class="empty-icon">💬</div>
                    <p>${this.searchTerm ? 'No questions match your search' : 'No questions yet'}</p>
                </div>
            `;
            return;
        }

        const queriesHTML = this.filteredQueries.map(query => {
            const hasResponse = query.responses && query.responses.length > 0;
            const latestResponse = hasResponse ? query.responses[0] : null;
            const date = new Date(query.createdAt);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="query-item ${this.selectedQuery?.id === query.id ? 'active' : ''}" 
                     data-query-id="${query.id}">
                    <div class="query-item-header">
                        <div class="query-preview">${this.truncateText(query.question, 60)}</div>
                        <div class="query-meta">
                            <span class="query-date">${dateStr}</span>
                            ${hasResponse ? '<span class="query-status success">✓</span>' : '<span class="query-status pending">⏳</span>'}
                        </div>
                    </div>
                    ${latestResponse ? `
                        <div class="query-response-preview">
                            ${this.truncateText(latestResponse.answer, 80)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        listContainer.innerHTML = queriesHTML;

        // Attach click listeners
        const queryItems = listContainer.querySelectorAll('.query-item');
        queryItems.forEach(item => {
            item.addEventListener('click', () => {
                const queryId = item.dataset.queryId;
                this.selectQuery(queryId);
            });
        });
    }

    /**
     * Select a query to view details
     * @param {string} queryId - Query ID
     */
    async selectQuery(queryId) {
        const query = this.queries.find(q => q.id === queryId);
        if (!query) {
            // Load full details
            const fullQuery = await queryHistoryService.getQueryDetails(queryId, this.currentUser.id);
            if (fullQuery) {
                this.selectedQuery = fullQuery;
                this.renderQueryDetail(fullQuery);
            }
        } else {
            this.selectedQuery = query;
            this.renderQueryDetail(query);
        }

        // Update active state in list
        const listContainer = document.getElementById('query-list-container');
        if (listContainer) {
            const items = listContainer.querySelectorAll('.query-item');
            items.forEach(item => {
                item.classList.toggle('active', item.dataset.queryId === queryId);
            });
        }
    }

    /**
     * Render query detail
     * @param {Object} query - Query object
     */
    renderQueryDetail(query) {
        const mainContent = document.getElementById('coach-main-content');
        if (!mainContent) return;

        const responses = query.responses || [];
        const latestResponse = responses.length > 0 ? responses[0] : null;

        mainContent.innerHTML = `
            <div class="query-detail">
                <div class="query-detail-header">
                    <button class="btn btn-link btn-back" id="back-to-list-btn">
                        ← Back to List
                    </button>
                    <div class="query-meta-info">
                        <span class="query-date-full">${new Date(query.createdAt).toLocaleString()}</span>
                        ${query.intent ? `<span class="query-intent">${query.intent}</span>` : ''}
                    </div>
                </div>

                <div class="query-question-card">
                    <div class="card-label">Your Question</div>
                    <div class="question-text">${this.escapeHtml(query.question)}</div>
                </div>

                ${latestResponse ? `
                    <div class="query-response-card">
                        <div class="card-label">
                            AI Coach Response
                            ${latestResponse.confidenceScore !== null ? `
                                <span class="confidence-badge" style="background: ${this.getConfidenceColor(latestResponse.confidenceScore)}">
                                    ${(latestResponse.confidenceScore * 100).toFixed(0)}% confidence
                                </span>
                            ` : ''}
                        </div>
                        <div class="response-text">${this.formatResponse(latestResponse.answer)}</div>
                        
                        ${latestResponse.references && latestResponse.references.length > 0 ? `
                            <div class="response-references">
                                <div class="references-label">References:</div>
                                <div class="references-list">
                                    ${latestResponse.references.map(ref => `
                                        <a href="#/courses/${this.courseId}/content/${ref.chapter || ref.chapter_id}" 
                                           class="reference-link">
                                            ${ref.chapter_title || ref.chapter || 'Chapter'}
                                        </a>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="query-response-card pending">
                        <div class="card-label">Response</div>
                        <div class="pending-message">
                            <span class="pending-icon">⏳</span>
                            <p>No response yet. This question may have been blocked or is still processing.</p>
                        </div>
                    </div>
                `}

                <div class="query-actions">
                    <button class="btn btn-secondary" id="ask-followup-btn">
                        Ask Follow-up Question
                    </button>
                </div>
            </div>
        `;

        // Attach event listeners
        const backBtn = document.getElementById('back-to-list-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showEmptyState();
            });
        }

        const followupBtn = document.getElementById('ask-followup-btn');
        if (followupBtn) {
            followupBtn.addEventListener('click', () => {
                this.showAskQuestionForm(query.question);
            });
        }
    }

    /**
     * Show ask question form
     * @param {string} initialQuestion - Initial question text (for follow-ups)
     */
    showAskQuestionForm(initialQuestion = '') {
        const mainContent = document.getElementById('coach-main-content');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="ask-question-form">
                <div class="form-header">
                    <h2>Ask AI Coach</h2>
                    <p>Get instant answers about the course content</p>
                </div>
                <form id="ask-question-form">
                    <div class="form-group">
                        <label for="question-input">Your Question</label>
                        <textarea 
                            id="question-input" 
                            class="form-control"
                            rows="4"
                            placeholder="Ask anything about the course content..."
                            required
                        >${this.escapeHtml(initialQuestion)}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancel-ask-btn">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary" id="submit-question-btn">
                            <span class="btn-icon">🚀</span>
                            Ask Question
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Attach event listeners
        const form = document.getElementById('ask-question-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitQuestion();
            });
        }

        const cancelBtn = document.getElementById('cancel-ask-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.showEmptyState();
            });
        }

        // Focus on textarea
        const textarea = document.getElementById('question-input');
        if (textarea) {
            textarea.focus();
        }
    }

    /**
     * Submit question
     */
    async submitQuestion() {
        const textarea = document.getElementById('question-input');
        const question = textarea?.value.trim();

        if (!question) {
            return;
        }

        const submitBtn = document.getElementById('submit-question-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Asking...';
        }

        try {
            // Use AI Coach service to process question
            const result = await aiCoachService.processQuery(
                this.currentUser.id,
                this.courseId,
                question
            );

            if (result.success) {
                // Reload query history to show new question
                await this.loadQueryHistory();
                
                // Select the new query
                if (result.queryId) {
                    await this.selectQuery(result.queryId);
                } else {
                    this.showEmptyState();
                }
            } else {
                // Show error
                alert(result.error || 'Failed to process question');
            }
        } catch (error) {
            console.error('[CoachAIPage] Error submitting question:', error);
            alert('An error occurred. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="btn-icon">🚀</span> Ask Question';
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
                <div class="empty-icon">💬</div>
                <h3>Select a question to view details</h3>
                <p>Or ask a new question to get started</p>
                <button class="btn btn-primary" id="ask-question-empty-btn">
                    Ask Your First Question
                </button>
            </div>
        `;

        const askBtn = document.getElementById('ask-question-empty-btn');
        if (askBtn) {
            askBtn.addEventListener('click', () => {
                this.showAskQuestionForm();
            });
        }

        this.selectedQuery = null;
    }

    /**
     * Format response text (markdown support)
     * @param {string} text - Response text
     * @returns {string} Formatted HTML
     */
    formatResponse(text) {
        // Simple markdown-like formatting
        // In production, use a proper markdown renderer
        return this.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    /**
     * Get confidence color
     * @param {number} confidence - Confidence score (0-1)
     * @returns {string} Color hex
     */
    getConfidenceColor(confidence) {
        if (confidence >= 0.7) return '#10b981'; // Green
        if (confidence >= 0.5) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
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

export default CoachAIPage;

