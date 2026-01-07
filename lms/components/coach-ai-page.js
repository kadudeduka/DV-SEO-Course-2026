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
import { courseService } from '../services/course-service.js';
import { router } from '../core/router.js';
import Header from './header.js';
import ReferenceLink from './ai-coach/shared/reference-link.js';
import { supabaseClient } from '../services/supabase-client.js';

class CoachAIPage {
    constructor(container) {
        this.container = container;
        this.courseId = null;
        this.course = null;
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
     * @param {Object} params - URL parameters (e.g., { queryId: '...' })
     */
    async show(courseId, params = {}) {
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

        // Load course data for title
        await this.loadCourse();

        // Render header
        await this.renderHeader();

        // Render page
        await this.render();

        // Attach event listeners
        this.attachEventListeners();

        // Load query history
        await this.loadQueryHistory();

        // If queryId is provided in params, open that query
        if (params.queryId) {
            await this.selectQuery(params.queryId);
        }
    }

    /**
     * Load course data
     */
    async loadCourse() {
        if (!this.courseId) {
            return;
        }
        try {
            this.course = await courseService.getCourseById(this.courseId);
        } catch (error) {
            console.warn('[CoachAIPage] Failed to load course:', error);
            this.course = null;
        }
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
                <!-- Page Header -->
                <div class="coach-page-header">
                    <h1>AI Coach${this.course ? ` - ${this.course.title || this.courseId}` : ''}</h1>
                    <p class="page-subtitle">Ask questions and view your conversation history</p>
                </div>

                <!-- Main Content Area -->
                <div class="coach-page-content">
                    <!-- Left Sidebar: Query List -->
                    <div class="coach-sidebar">
                        <div class="sidebar-header">
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

        // Attach event listeners
        this.attachEventListeners();
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
        if (!queryId) {
            console.warn('[CoachAIPage] No queryId provided to selectQuery');
            return;
        }

        const query = this.queries.find(q => q.id === queryId);
        if (!query) {
            // Load full details
            try {
                const fullQuery = await queryHistoryService.getQueryDetails(queryId, this.currentUser.id);
                if (fullQuery) {
                    this.selectedQuery = fullQuery;
                    await this.renderQueryDetail(fullQuery);
                    // Highlight the query in the list if it exists
                    this._highlightQueryInList(queryId);
                } else {
                    console.warn('[CoachAIPage] Query not found:', queryId);
                }
            } catch (error) {
                console.error('[CoachAIPage] Error loading query details:', error);
            }
        } else {
            this.selectedQuery = query;
            await this.renderQueryDetail(query);
            // Highlight the query in the list
            this._highlightQueryInList(queryId);
        }
    }

    /**
     * Highlight a query in the list and scroll to it
     * @param {string} queryId - Query ID
     * @private
     */
    _highlightQueryInList(queryId) {
        const listContainer = document.getElementById('query-list-container');
        if (!listContainer) {
            return;
        }

        // Remove active class from all items
        const allItems = listContainer.querySelectorAll('.query-item');
        allItems.forEach(item => item.classList.remove('active'));

        // Add active class to selected item and scroll to it
        const selectedItem = listContainer.querySelector(`[data-query-id="${queryId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
            // Scroll to the item smoothly
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Render query detail
     * @param {Object} query - Query object
     */
    async renderQueryDetail(query) {
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
                                <div class="references-list" id="response-references-container"></div>
                            </div>
                        ` : ''}
                        
                        ${!latestResponse.escalated && !latestResponse.escalationId ? `
                            <div class="response-actions">
                                <button class="btn btn-escalate" id="escalate-btn-${query.id}" data-query-id="${query.id}">
                                    <span class="escalate-icon">🔼</span>
                                    Escalate to Trainer
                                </button>
                            </div>
                        ` : latestResponse.escalated || latestResponse.escalationId ? `
                            <div class="escalation-notice">
                                <p>✓ Question has been escalated to trainer. You will be notified when they respond.</p>
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

        // Render references using ReferenceLink component (same as widget)
        if (latestResponse && latestResponse.references && latestResponse.references.length > 0) {
            const referencesContainer = document.getElementById('response-references-container');
            if (referencesContainer) {
                // Use ReferenceLink component to render references (same logic as widget)
                const referencesEl = ReferenceLink.renderMultiple(latestResponse.references, {
                    courseId: this.courseId
                });
                referencesContainer.appendChild(referencesEl);
            }
        }

        // Load and display trainer response if escalation exists
        if (latestResponse && (latestResponse.escalated || latestResponse.escalationId)) {
            await this.loadTrainerResponse(latestResponse.escalationId, mainContent);
        }

        // Attach escalation button handler
        const escalateBtn = document.getElementById(`escalate-btn-${query.id}`);
        if (escalateBtn) {
            escalateBtn.addEventListener('click', async () => {
                await this.handleEscalation(query.id, latestResponse);
            });
        }

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
     * Handle escalation button click
     * @param {string} queryId - Query ID
     * @param {Object} response - Response object
     */
    async handleEscalation(queryId, response) {
        const escalateBtn = document.querySelector(`[data-query-id="${queryId}"]`);
        if (!escalateBtn) return;

        try {
            escalateBtn.disabled = true;
            escalateBtn.innerHTML = '<span>Escalating...</span>';

            const { escalationService } = await import('../services/escalation-service.js');
            
            // Get question details - try 'id' field first (standard), then 'query_id' if needed
            let query = null;
            const { data: queryById, error: errorById } = await supabaseClient
                .from('ai_coach_queries')
                .select('id, course_id, learner_id')
                .eq('id', queryId)
                .maybeSingle();
            
            if (!errorById && queryById) {
                query = queryById;
            } else {
                // Try with query_id field if id doesn't work
                const { data: queryByQueryId, error: errorByQueryId } = await supabaseClient
                    .from('ai_coach_queries')
                    .select('id, course_id, learner_id')
                    .eq('query_id', queryId)
                    .maybeSingle();
                
                if (!errorByQueryId && queryByQueryId) {
                    query = queryByQueryId;
                }
            }

            if (!query) {
                console.error('[CoachAIPage] Query not found for ID:', queryId);
                throw new Error('Question not found. Please refresh the page and try again.');
            }

            // Create manual escalation - use the id field for questionId
            const escalation = await escalationService.manualEscalate({
                questionId: query.id, // Use the actual id from the query
                courseId: query.course_id,
                learnerId: query.learner_id,
                aiResponseSnapshot: response.answer || ''
            });

            if (escalation) {
                // Update UI
                escalateBtn.style.display = 'none';
                
                // Show success notice
                const noticeEl = document.createElement('div');
                noticeEl.className = 'escalation-notice success';
                noticeEl.style.cssText = 'margin-top: 15px; padding: 10px; background: #e7f3ff; border: 1px solid #2196F3; border-radius: 4px;';
                noticeEl.innerHTML = '<p style="margin: 0; color: #1565C0;">✓ Question escalated to trainer. You will be notified when they respond.</p>';
                
                const responseCard = escalateBtn.closest('.query-response-card');
                if (responseCard) {
                    responseCard.appendChild(noticeEl);
                }

                // Reload query detail to show updated state
                await this.selectQuery(queryId);
            }
        } catch (error) {
            console.error('[CoachAIPage] Error escalating question:', error);
            alert(`Failed to escalate question: ${error.message}. Please try again.`);
            if (escalateBtn) {
                escalateBtn.disabled = false;
                escalateBtn.innerHTML = '<span class="escalate-icon">🔼</span> Escalate to Trainer';
            }
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
            // Use AI Coach service to process question (strict pipeline with new answer template)
            const result = await aiCoachService.processQueryStrict(
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

    /**
     * Handle escalation button click
     * @param {string} queryId - Query ID
     * @param {Object} response - Response object
     */
    async handleEscalation(queryId, response) {
        const escalateBtn = document.querySelector(`[data-query-id="${queryId}"]`);
        if (!escalateBtn) return;

        try {
            escalateBtn.disabled = true;
            escalateBtn.textContent = 'Escalating...';

            const { escalationService } = await import('../services/escalation-service.js');
            
            // Get question details
            const { data: query } = await supabaseClient
                .from('ai_coach_queries')
                .select('id, course_id, learner_id')
                .eq('id', queryId)
                .single();

            if (!query) {
                throw new Error('Question not found');
            }

            // Get confidence score from response object or fetch from database
            let confidenceScore = null;
            if (response.confidence !== undefined && response.confidence !== null) {
                // Convert 0-1 to 0-100
                confidenceScore = response.confidence * 100;
            } else if (response.confidenceScore !== undefined && response.confidenceScore !== null) {
                // Handle if already 0-100 or 0-1
                confidenceScore = response.confidenceScore > 1 ? response.confidenceScore : response.confidenceScore * 100;
            } else {
                // Fallback: fetch from database
                const { data: latestResponse } = await supabaseClient
                    .from('ai_coach_responses')
                    .select('confidence_score')
                    .eq('query_id', queryId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (latestResponse && latestResponse.confidence_score !== null) {
                    confidenceScore = parseFloat(latestResponse.confidence_score);
                }
            }
            
            const escalation = await escalationService.manualEscalate({
                questionId: queryId,
                courseId: query.course_id,
                learnerId: query.learner_id,
                aiResponseSnapshot: response.answer || '',
                confidenceScore: confidenceScore
            });

            if (escalation) {
                // Update UI
                escalateBtn.style.display = 'none';
                
                // Show success notice
                const noticeEl = document.createElement('div');
                noticeEl.className = 'escalation-notice success';
                noticeEl.innerHTML = '<p>✓ Question escalated to trainer. You will be notified when they respond.</p>';
                
                const responseCard = escalateBtn.closest('.query-response-card');
                if (responseCard) {
                    responseCard.appendChild(noticeEl);
                }

                // Reload query detail to show updated state
                await this.selectQuery(queryId);
            }
        } catch (error) {
            console.error('[CoachAIPage] Error escalating question:', error);
            alert('Failed to escalate question. Please try again.');
            if (escalateBtn) {
                escalateBtn.disabled = false;
                escalateBtn.innerHTML = '<span class="escalate-icon">🔼</span> Escalate to Trainer';
            }
        }
    }

    /**
     * Load and display trainer response for an escalation
     * @param {string} escalationId - Escalation ID
     * @param {HTMLElement} container - Container to append trainer response to
     */
    async loadTrainerResponse(escalationId, container) {
        if (!escalationId || !container) return;

        try {
            const { escalationService } = await import('../services/escalation-service.js');
            const trainerResponse = await escalationService.getTrainerResponse(escalationId);

            if (trainerResponse) {
                // Find the response card to append trainer response after it
                const responseCard = container.querySelector('.query-response-card');
                if (responseCard) {
                    const trainerResponseCard = document.createElement('div');
                    trainerResponseCard.className = 'query-response-card trainer-response';
                    trainerResponseCard.style.marginTop = '20px';
                    trainerResponseCard.style.borderLeft = '4px solid #007bff';
                    trainerResponseCard.innerHTML = `
                        <div class="card-label">
                            👨‍🏫 Trainer Response
                            ${trainerResponse.trainer ? `
                                <span style="font-size: 12px; font-weight: normal; color: #666; margin-left: 10px;">
                                    by ${this.escapeHtml(trainerResponse.trainer.full_name || trainerResponse.trainer.name || 'Trainer')}
                                </span>
                            ` : ''}
                        </div>
                        <div class="response-text">${this.formatResponse(trainerResponse.response_text)}</div>
                        <div style="margin-top: 10px; color: #666; font-size: 12px;">
                            Responded: ${new Date(trainerResponse.created_at).toLocaleString()}
                            ${trainerResponse.updated_at && trainerResponse.updated_at !== trainerResponse.created_at ? 
                                ` • Updated: ${new Date(trainerResponse.updated_at).toLocaleString()}` : ''}
                        </div>
                    `;
                    responseCard.insertAdjacentElement('afterend', trainerResponseCard);
                }
            }
        } catch (error) {
            console.error('[CoachAIPage] Error loading trainer response:', error);
        }
    }
}

export default CoachAIPage;

