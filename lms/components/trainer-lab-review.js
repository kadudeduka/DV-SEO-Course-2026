/**
 * Trainer Lab Review Component
 * 
 * Allows trainers to review lab submissions from assigned learners.
 */

import { labSubmissionService } from '../services/lab-submission-service.js';
import { authService } from '../services/auth-service.js';

class TrainerLabReview {
    constructor(container) {
        this.container = container;
        this.submissions = [];
        this.pastEvaluations = [];
        this.currentUser = null;
        this.selectedSubmission = null;
        this.activeTab = 'pending'; // 'pending' or 'past'
        this.pastEvaluationsFilters = {
            dateFrom: '',
            dateTo: '',
            searchQuery: ''
        };
    }

    /**
     * Show trainer lab review interface
     */
    async show() {
        this.container.style.display = 'block';
        this.renderLoading();
        await this.loadSubmissions();
        
        // Initialize pastEvaluations array if not already initialized
        if (!this.pastEvaluations) {
            this.pastEvaluations = [];
        }
        
        this.render();
    }

    /**
     * Load submissions for review
     */
    async loadSubmissions() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                throw new Error('Authentication required');
            }

            console.log('[TrainerLabReview] Loading submissions for trainer:', this.currentUser.id);
            this.submissions = await labSubmissionService.getSubmissionsForReview(this.currentUser.id);
            console.log('[TrainerLabReview] Loaded submissions:', this.submissions.length, this.submissions);
        } catch (error) {
            console.error('[TrainerLabReview] Error loading submissions:', error);
            this.showError('Failed to load submissions: ' + error.message);
            this.submissions = [];
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        this.container.innerHTML = `
            <div class="trainer-lab-review">
                <h2 class="page-title">Lab Submissions Review</h2>
                <div class="loading-state">
                    <div class="loading-state-text">Loading submissions...</div>
                </div>
            </div>
        `;
    }

    /**
     * Render main interface
     */
    render() {
        this.container.innerHTML = `
            <div class="trainer-lab-review-page">
                <div class="review-container">
                    <div class="review-header">
                        <div>
                            <h1 class="review-title">Lab Submissions Review</h1>
                            <p class="review-subtitle">Review and provide feedback on learner submissions</p>
                        </div>
                        <div class="review-actions">
                            <a href="#/trainer/dashboard" class="btn btn-ghost">
                                <span class="btn-icon">←</span>
                                <span>Back to Dashboard</span>
                            </a>
                        </div>
                    </div>
                    
                    <div id="review-error" class="error-message" style="display: none;"></div>
                    <div id="review-success" class="success-message" style="display: none;"></div>
                    
                    <!-- Tabs -->
                    <div class="review-tabs">
                        <button 
                            id="tab-pending" 
                            class="review-tab ${this.activeTab === 'pending' ? 'active' : ''}">
                            <span class="tab-icon">📝</span>
                            <span class="tab-label">Pending Submissions</span>
                            ${this.submissions.length > 0 ? `<span class="tab-badge">${this.submissions.length}</span>` : ''}
                        </button>
                        <button 
                            id="tab-past" 
                            class="review-tab ${this.activeTab === 'past' ? 'active' : ''}">
                            <span class="tab-icon">📋</span>
                            <span class="tab-label">Past Evaluations</span>
                        </button>
                    </div>

                    <!-- Pending Submissions Tab -->
                    <div id="pending-tab-content" class="review-tab-content" style="display: ${this.activeTab === 'pending' ? 'block' : 'none'};">
                        <div class="review-layout">
                            <div class="review-sidebar">
                                <div class="sidebar-header">
                                    <h3 class="sidebar-title">Pending Submissions</h3>
                                    <span class="sidebar-count">${this.submissions.length}</span>
                                </div>
                                <div id="submissions-list" class="submissions-list-container">
                                    ${this.renderSubmissionsList()}
                                </div>
                            </div>
                            <div class="review-main">
                                <div id="submission-detail" class="submission-detail-container">
                                    ${this.renderSubmissionDetail()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Past Evaluations Tab -->
                    <div id="past-tab-content" class="review-tab-content" style="display: ${this.activeTab === 'past' ? 'block' : 'none'};">
                        ${this.renderPastEvaluations()}
                    </div>
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Render submissions list (modern card-based design)
     */
    renderSubmissionsList() {
        if (this.submissions.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">✓</div>
                    <div class="empty-text">No pending submissions</div>
                    <p class="empty-description">
                        New submissions from your assigned learners will appear here once they submit lab answers.
                        Submissions marked as "needs revision" will disappear from this list until the learner resubmits.
                    </p>
                </div>
            `;
        }

        // Sort by submitted_at (oldest first for priority)
        const sortedSubmissions = [...this.submissions].sort((a, b) => {
            const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
            return dateA - dateB; // Oldest first
        });

        return `
            <div class="submissions-cards-list">
                ${sortedSubmissions.map(submission => {
                    const isSelected = this.selectedSubmission && this.selectedSubmission.id === submission.id;
                    const user = submission.user || {};
                    const learnerName = user.full_name || user.name || user.email || 'Unknown Learner';
                    const submittedDate = submission.submitted_at ? new Date(submission.submitted_at) : null;
                    const daysAgo = submittedDate ? Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    const hasFile = submission.file_url || submission.file_name;
                    
                    return `
                        <div class="submission-card ${isSelected ? 'selected' : ''}" data-submission-id="${submission.id}">
                            <div class="submission-card-header">
                                <div class="learner-avatar-mini">
                                    <span class="avatar-initials-mini">${this.getInitials(learnerName)}</span>
                                </div>
                                <div class="submission-card-info">
                                    <div class="learner-name">${this.escapeHtml(learnerName)}</div>
                                    <div class="submission-meta">
                                        <span class="submission-course">${this.escapeHtml(submission.course_id)}</span>
                                        <span class="submission-separator">•</span>
                                        <span class="submission-lab">Lab ${this.escapeHtml(submission.lab_id)}</span>
                                    </div>
                                </div>
                                ${daysAgo > 0 ? `
                                    <div class="submission-priority priority-${daysAgo >= 3 ? 'high' : daysAgo >= 1 ? 'medium' : 'low'}">
                                        ${daysAgo}d
                                    </div>
                                ` : ''}
                            </div>
                            <div class="submission-card-body">
                                <div class="submission-date-info">
                                    <span class="date-icon">📅</span>
                                    <span class="date-text">${submittedDate ? submittedDate.toLocaleString() : 'N/A'}</span>
                                </div>
                                <div class="submission-file-info">
                                    <span class="file-icon">${hasFile ? '📄' : '📝'}</span>
                                    <span class="file-text">${hasFile ? (submission.file_name || 'submission.docx') : 'Text Answer'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Get user initials
     */
    getInitials(name) {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
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

    /**
     * Render submission detail (enhanced)
     */
    renderSubmissionDetail() {
        if (!this.selectedSubmission) {
            return `
                <div class="submission-detail-empty">
                    <div class="empty-icon">👈</div>
                    <div class="empty-text">Select a submission to review</div>
                    <p class="empty-description">Choose a submission from the list on the left to begin reviewing</p>
                </div>
            `;
        }

        const user = this.selectedSubmission.user || {};
        const learnerName = user.full_name || user.name || user.email || 'Unknown Learner';
        const submissionData = this.selectedSubmission.submission_data || {};
        const hasFile = this.selectedSubmission.file_url || this.selectedSubmission.file_name;
        const currentFeedback = this.selectedSubmission.feedback || '';
        const currentStatus = this.selectedSubmission.status || 'submitted';
        const submittedDate = this.selectedSubmission.submitted_at ? new Date(this.selectedSubmission.submitted_at) : null;

        // Get file download URL if available
        let fileDownloadSection = '';
        if (hasFile) {
            const fileSize = this.selectedSubmission.file_size 
                ? (this.selectedSubmission.file_size < 1024 
                    ? this.selectedSubmission.file_size + ' B'
                    : (this.selectedSubmission.file_size / 1024).toFixed(2) + ' KB')
                : '';
            
            fileDownloadSection = `
                <div class="submission-section">
                    <h3 class="section-title">Submitted File</h3>
                    <div class="file-section">
                        <div class="file-info">
                            <span class="file-icon">📄</span>
                            <div class="file-details">
                                <div class="file-name">${this.escapeHtml(this.selectedSubmission.file_name || 'submission.docx')}</div>
                                ${fileSize ? `<div class="file-size">${fileSize}</div>` : ''}
                            </div>
                        </div>
                        <button 
                            id="download-submission-file" 
                            data-file-url="${this.escapeHtml(this.selectedSubmission.file_url)}"
                            class="btn btn-primary">
                            <span class="btn-icon">📥</span>
                            <span>Download File</span>
                        </button>
                    </div>
                </div>
            `;
        }

        // Legacy text answer display (for old submissions)
        const answer = typeof submissionData === 'string' ? submissionData : (submissionData?.answer || '');
        const textAnswerSection = !hasFile && answer ? `
            <div class="submission-section">
                <h3 class="section-title">Learner Answer</h3>
                <div class="answer-content">
                    ${this.escapeHtml(answer)}
                </div>
            </div>
        ` : '';

        const statusConfig = this.getStatusConfig(currentStatus);

        return `
            <div class="submission-detail-card">
                <div class="detail-header">
                    <div class="detail-learner">
                        <div class="learner-avatar-small">
                            <span class="avatar-initials-small">${this.getInitials(learnerName)}</span>
                        </div>
                        <div class="learner-details">
                            <div class="learner-name-large">${this.escapeHtml(learnerName)}</div>
                            <div class="learner-email">${this.escapeHtml(user.email || '')}</div>
                        </div>
                    </div>
                    <div class="detail-status ${statusConfig.class}">
                        <span class="status-icon">${statusConfig.icon}</span>
                        <span class="status-text">${statusConfig.label}</span>
                    </div>
                </div>

                <div class="detail-info-cards">
                    <div class="info-card">
                        <div class="info-card-icon">📚</div>
                        <div class="info-card-content">
                            <div class="info-card-label">Course</div>
                            <div class="info-card-value">${this.escapeHtml(this.selectedSubmission.course_id)}</div>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-icon">🔬</div>
                        <div class="info-card-content">
                            <div class="info-card-label">Lab</div>
                            <div class="info-card-value">${this.escapeHtml(this.selectedSubmission.lab_id)}</div>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-icon">📅</div>
                        <div class="info-card-content">
                            <div class="info-card-label">Submitted</div>
                            <div class="info-card-value">${submittedDate ? submittedDate.toLocaleString() : 'N/A'}</div>
                        </div>
                    </div>
                </div>

                ${fileDownloadSection}
                ${textAnswerSection}

                <div class="submission-section">
                    <h3 class="section-title">Review & Feedback</h3>
                    <form id="feedback-form" class="feedback-form">
                        <div class="form-group">
                            <label for="score-input" class="form-label">
                                Score <span class="required-asterisk">*</span>
                            </label>
                            <input 
                                type="number" 
                                id="score-input" 
                                name="score" 
                                min="0" 
                                max="10" 
                                step="0.1"
                                class="form-input"
                                placeholder="Enter score (0-10)"
                                value="${this.selectedSubmission.score !== null && this.selectedSubmission.score !== undefined ? this.selectedSubmission.score : ''}"
                                required>
                            <small class="form-help-text">Score must be between 0 and 10 (required)</small>
                        </div>
                        <div class="form-group">
                            <label for="feedback-text" class="form-label">Feedback</label>
                            <textarea 
                                id="feedback-text" 
                                name="feedback" 
                                rows="8" 
                                class="form-textarea"
                                placeholder="Provide detailed feedback to help the learner improve...">${this.escapeHtml(currentFeedback)}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="status-select" class="form-label">Status <span class="required-asterisk">*</span></label>
                            <select 
                                id="status-select" 
                                name="status" 
                                class="form-select"
                                required>
                                <option value="">Select status...</option>
                                <option value="approved" ${currentStatus === 'approved' ? 'selected' : ''}>Approved</option>
                                <option value="needs_revision" ${currentStatus === 'needs_revision' ? 'selected' : ''}>Needs Revision</option>
                            </select>
                            <small class="form-help-text">Select whether the submission is approved or needs revision</small>
                        </div>
                        <div class="form-actions">
                            <button 
                                type="submit" 
                                id="save-feedback-btn"
                                class="btn btn-primary btn-large">
                                <span class="btn-icon">💾</span>
                                <span>Save Feedback</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    /**
     * Get status configuration
     */
    getStatusConfig(status) {
        const configs = {
            'submitted': {
                label: 'Submitted',
                icon: '📤',
                class: 'status-submitted'
            },
            'reviewed': {
                label: 'Reviewed',
                icon: '✓',
                class: 'status-reviewed'
            },
            'approved': {
                label: 'Approved',
                icon: '✓',
                class: 'status-approved'
            },
            'needs_revision': {
                label: 'Needs Revision',
                icon: '↻',
                class: 'status-revision'
            }
        };
        return configs[status] || configs['submitted'];
    }

    /**
     * Render past evaluations section
     */
    renderPastEvaluations() {
        return `
            <div class="past-evaluations-section">
                <h3 class="section-heading">Past Evaluations</h3>
                
                <!-- Filters -->
                <div class="filters-section">
                    <div class="filters-grid">
                        <div class="filter-group">
                            <label class="filter-label">Search (Name/Email):</label>
                            <input 
                                type="text" 
                                id="past-eval-search" 
                                placeholder="Enter name or email..."
                                value="${this.pastEvaluationsFilters.searchQuery || ''}"
                                class="filter-input">
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Date From:</label>
                            <input 
                                type="date" 
                                id="past-eval-date-from" 
                                value="${this.pastEvaluationsFilters.dateFrom || ''}"
                                class="filter-input">
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Date To:</label>
                            <input 
                                type="date" 
                                id="past-eval-date-to" 
                                value="${this.pastEvaluationsFilters.dateTo || ''}"
                                class="filter-input">
                        </div>
                    </div>
                    <div class="filter-actions">
                        <button 
                            id="apply-past-filters" 
                            class="btn btn-primary btn-sm">
                            Apply Filters
                        </button>
                        <button 
                            id="clear-past-filters" 
                            class="btn btn-secondary btn-sm">
                            Clear Filters
                        </button>
                    </div>
                </div>

                <!-- Results Table -->
                <div id="past-evaluations-table" class="table-container">
                    ${this.renderPastEvaluationsTable()}
                </div>
            </div>
        `;
    }

    /**
     * Render past evaluations table
     */
    renderPastEvaluationsTable() {
        if (this.pastEvaluations.length === 0) {
            return `
                <div class="empty-state">
                    <p class="empty-state-text">
                        No past evaluations found. ${this.pastEvaluationsFilters.searchQuery || this.pastEvaluationsFilters.dateFrom || this.pastEvaluationsFilters.dateTo ? 'Try adjusting your filters.' : 'Evaluations you complete will appear here.'}
                    </p>
                </div>
            `;
        }

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Learner</th>
                        <th>Email</th>
                        <th>Course</th>
                        <th>Lab</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th>Reviewed Date</th>
                        <th>Feedback</th>
                        <th>File</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.pastEvaluations.map(submission => {
                        const user = submission.user || {};
                        const hasFile = submission.file_url || submission.file_name;
                        
                        return `
                            <tr class="table-row">
                                <td class="table-cell">${user.full_name || user.name || 'Unknown'}</td>
                                <td class="table-cell">${user.email || '-'}</td>
                                <td class="table-cell">${submission.course_id || '-'}</td>
                                <td class="table-cell">${submission.lab_id || '-'}</td>
                                <td class="table-cell">
                                    ${submission.score !== null && submission.score !== undefined ? 
                                        `<strong>${parseFloat(submission.score).toFixed(1)}</strong> / 10` : 
                                        '<span style="color: #999;">-</span>'
                                    }
                                </td>
                                <td class="table-cell">
                                    <span class="status-badge status-badge-${submission.status || 'reviewed'}">
                                        ${submission.status || '-'}
                                    </span>
                                </td>
                                <td class="table-cell">${submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleString() : '-'}</td>
                                <td class="table-cell table-cell-feedback">
                                    ${submission.feedback ? `
                                        <div class="feedback-preview">
                                            ${submission.feedback.length > 100 ? submission.feedback.substring(0, 100) + '...' : submission.feedback}
                                        </div>
                                    ` : '-'}
                                </td>
                                <td class="table-cell">
                                    ${hasFile ? `
                                        <a href="#" 
                                           class="download-past-file link-primary" 
                                           data-file-url="${submission.file_url}">
                                            📥 Download
                                        </a>
                                    ` : '-'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * Load past evaluations
     */
    async loadPastEvaluations() {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                this.currentUser = await authService.getCurrentUser();
            }

            console.log('[TrainerLabReview] Loading past evaluations for trainer:', this.currentUser.id);
            this.pastEvaluations = await labSubmissionService.getPastEvaluations(
                this.currentUser.id,
                this.pastEvaluationsFilters
            );
            console.log('[TrainerLabReview] Loaded past evaluations:', this.pastEvaluations.length);
        } catch (error) {
            console.error('[TrainerLabReview] Error loading past evaluations:', error);
            this.showError('Failed to load past evaluations: ' + error.message);
            this.pastEvaluations = [];
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Tab switching
        const tabPending = this.container.querySelector('#tab-pending');
        const tabPast = this.container.querySelector('#tab-past');
        
        if (tabPending) {
            tabPending.addEventListener('click', () => {
                this.activeTab = 'pending';
                this.render();
            });
        }
        
        if (tabPast) {
            tabPast.addEventListener('click', async () => {
                this.activeTab = 'past';
                await this.loadPastEvaluations();
                this.render();
            });
        }

        // Pending submissions listeners (new card-based)
        const submissionCards = this.container.querySelectorAll('.submission-card');
        submissionCards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const submissionId = card.getAttribute('data-submission-id');
                this.handleSubmissionSelect(submissionId);
            });
        });

        const feedbackForm = this.container.querySelector('#feedback-form');
        if (feedbackForm) {
            feedbackForm.addEventListener('submit', (e) => this.handleSaveFeedback(e));
        }

        // Handle file download (pending)
        const downloadLink = this.container.querySelector('#download-submission-file');
        if (downloadLink) {
            downloadLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const fileUrl = downloadLink.getAttribute('data-file-url');
                if (fileUrl) {
                    await this.handleDownloadFile(fileUrl);
                }
            });
        }

        // Past evaluations filters
        const applyFiltersBtn = this.container.querySelector('#apply-past-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', async () => {
                await this.handleApplyPastFilters();
            });
        }

        const clearFiltersBtn = this.container.querySelector('#clear-past-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', async () => {
                await this.handleClearPastFilters();
            });
        }

        // Past evaluations file downloads
        const pastDownloadLinks = this.container.querySelectorAll('.download-past-file');
        pastDownloadLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const fileUrl = link.getAttribute('data-file-url');
                if (fileUrl) {
                    await this.handleDownloadFile(fileUrl);
                }
            });
        });
    }

    /**
     * Handle apply past evaluations filters
     */
    async handleApplyPastFilters() {
        const searchInput = this.container.querySelector('#past-eval-search');
        const dateFromInput = this.container.querySelector('#past-eval-date-from');
        const dateToInput = this.container.querySelector('#past-eval-date-to');

        this.pastEvaluationsFilters = {
            searchQuery: searchInput ? searchInput.value.trim() : '',
            dateFrom: dateFromInput ? dateFromInput.value : '',
            dateTo: dateToInput ? dateToInput.value : ''
        };

        await this.loadPastEvaluations();
        
        // Update only the table section
        const tableContainer = this.container.querySelector('#past-evaluations-table');
        if (tableContainer) {
            tableContainer.innerHTML = this.renderPastEvaluationsTable();
            // Re-attach download listeners
            const pastDownloadLinks = this.container.querySelectorAll('.download-past-file');
            pastDownloadLinks.forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const fileUrl = link.getAttribute('data-file-url');
                    if (fileUrl) {
                        await this.handleDownloadFile(fileUrl);
                    }
                });
            });
        }
    }

    /**
     * Handle clear past evaluations filters
     */
    async handleClearPastFilters() {
        this.pastEvaluationsFilters = {
            searchQuery: '',
            dateFrom: '',
            dateTo: ''
        };

        await this.loadPastEvaluations();
        this.render();
    }

    /**
     * Handle file download
     */
    async handleDownloadFile(fileUrl) {
        try {
            const signedUrl = await labSubmissionService.getSubmissionFileUrl(fileUrl);
            if (signedUrl) {
                window.open(signedUrl, '_blank');
            } else {
                this.showError('Failed to generate download URL');
            }
        } catch (error) {
            console.error('[TrainerLabReview] Error downloading file:', error);
            this.showError('Failed to download file: ' + error.message);
        }
    }

    /**
     * Handle submission selection
     */
    handleSubmissionSelect(submissionId) {
        this.selectedSubmission = this.submissions.find(s => s.id === submissionId);
        
        // Update only the necessary parts instead of full render
        const submissionsList = this.container.querySelector('#submissions-list');
        const submissionDetail = this.container.querySelector('#submission-detail');
        
        if (submissionsList) {
            submissionsList.innerHTML = this.renderSubmissionsList();
            // Re-attach listeners
            const submissionCards = submissionsList.querySelectorAll('.submission-card');
            submissionCards.forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = card.getAttribute('data-submission-id');
                    this.handleSubmissionSelect(id);
                });
            });
        }
        
        if (submissionDetail) {
            submissionDetail.innerHTML = this.renderSubmissionDetail();
            // Re-attach form listeners
            const feedbackForm = submissionDetail.querySelector('#feedback-form');
            if (feedbackForm) {
                feedbackForm.addEventListener('submit', (e) => this.handleSaveFeedback(e));
            }
            
            const downloadLink = submissionDetail.querySelector('#download-submission-file');
            if (downloadLink) {
                downloadLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const fileUrl = downloadLink.getAttribute('data-file-url');
                    if (fileUrl) {
                        await this.handleDownloadFile(fileUrl);
                    }
                });
            }
        }
    }

    /**
     * Handle save feedback
     */
    async handleSaveFeedback(event) {
        event.preventDefault();

        if (!this.selectedSubmission) {
            this.showError('No submission selected');
            return;
        }

        const scoreInput = this.container.querySelector('#score-input');
        const feedbackTextarea = this.container.querySelector('#feedback-text');
        const statusSelect = this.container.querySelector('#status-select');
        const saveBtn = this.container.querySelector('#save-feedback-btn');

        // Validate score (mandatory, 0-10)
        const scoreValue = scoreInput ? scoreInput.value.trim() : '';
        if (!scoreValue) {
            this.showError('Score is required. Please enter a score between 0 and 10.');
            if (scoreInput) {
                scoreInput.focus();
            }
            return;
        }

        const score = parseFloat(scoreValue);
        if (isNaN(score) || score < 0 || score > 10) {
            this.showError('Score must be a number between 0 and 10.');
            if (scoreInput) {
                scoreInput.focus();
            }
            return;
        }

        const feedback = feedbackTextarea ? feedbackTextarea.value.trim() : '';
        const status = statusSelect ? statusSelect.value : '';
        
        // Validate status (mandatory, must be 'approved' or 'needs_revision')
        if (!status || (status !== 'approved' && status !== 'needs_revision')) {
            this.showError('Status is required. Please select either "Approved" or "Needs Revision".');
            if (statusSelect) {
                statusSelect.focus();
            }
            return;
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        try {
            await labSubmissionService.provideFeedback(
                this.selectedSubmission.id,
                feedback,
                status,
                score
            );

            this.showSuccess('Feedback saved successfully');
            await this.loadSubmissions();
            this.selectedSubmission = this.submissions.find(s => s.id === this.selectedSubmission.id);
            
            // If on past tab, reload past evaluations too
            if (this.activeTab === 'past') {
                await this.loadPastEvaluations();
            }
            
            this.render();
        } catch (error) {
            this.showError('Failed to save feedback: ' + error.message);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Feedback';
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#review-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;';
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const successDiv = this.container.querySelector('#review-success');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            successDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; border-radius: 3px;';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 5000);
        }
    }
}

export default TrainerLabReview;

