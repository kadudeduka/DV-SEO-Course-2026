/**
 * Submission Detail Component
 * 
 * Detailed view of a specific lab submission with full context, feedback history, and resubmission flow.
 */

import { labSubmissionService } from '../services/lab-submission-service.js';
import { courseService } from '../services/course-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class SubmissionDetail {
    constructor(container) {
        this.container = container;
        this.submissionId = null;
        this.submission = null;
        this.course = null;
        this.lab = null;
        this.currentUser = null;
        this.feedbackHistory = [];
    }

    /**
     * Show submission detail page
     */
    async show(submissionId) {
        if (this.container) {
            this.container.style.display = 'block';
        }

        this.submissionId = submissionId;
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
     * Load all submission data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            // Load submission
            this.submission = await labSubmissionService.getSubmissionById(this.submissionId);
            if (!this.submission) {
                throw new Error('Submission not found');
            }

            // Load course
            this.course = await courseService.getCourseById(this.submission.course_id);

            // Find lab in course structure
            this.findLab();

            // Load feedback history (all submissions for this lab)
            await this.loadFeedbackHistory();
        } catch (error) {
            console.error('[SubmissionDetail] Error loading data:', error);
            this.renderError('Failed to load submission: ' + error.message);
        }
    }

    /**
     * Find lab in course structure
     */
    findLab() {
        if (!this.course || !this.course.courseData || !this.course.courseData.days) {
            return;
        }

        for (const day of this.course.courseData.days) {
            if (day.labs && Array.isArray(day.labs)) {
                const lab = day.labs.find(l => l.id === this.submission.lab_id);
                if (lab) {
                    this.lab = lab;
                    return;
                }
            }
        }
    }

    /**
     * Load feedback history (all submissions for this lab)
     */
    async loadFeedbackHistory() {
        try {
            const allSubmissions = await labSubmissionService.getAllSubmissionsForLearner(this.currentUser.id);
            this.feedbackHistory = allSubmissions
                .filter(s => s.course_id === this.submission.course_id && s.lab_id === this.submission.lab_id)
                .sort((a, b) => {
                    const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
                    const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
                    return dateB - dateA; // Latest first
                });
        } catch (error) {
            console.warn('[SubmissionDetail] Failed to load feedback history:', error);
            this.feedbackHistory = [this.submission];
        }
    }

    /**
     * Render submission detail
     */
    render() {
        if (!this.submission) {
            return;
        }

        const statusConfig = this.getStatusConfig(this.submission.status);
        const submittedDate = this.submission.submitted_at ? new Date(this.submission.submitted_at) : null;
        const reviewedDate = this.submission.reviewed_at ? new Date(this.submission.reviewed_at) : null;

        this.container.innerHTML = `
            <div class="submission-detail-page">
                <div class="submission-detail-container">
                    <div class="submission-detail-header">
                        <div class="submission-breadcrumb">
                            <a href="#/courses/${this.submission.course_id}" class="breadcrumb-link">${this.course?.title || 'Course'}</a>
                            <span class="breadcrumb-separator">/</span>
                            <a href="#/courses/${this.submission.course_id}/lab/${this.submission.lab_id}" class="breadcrumb-link">${this.lab?.title || this.submission.lab_id}</a>
                            <span class="breadcrumb-separator">/</span>
                            <span class="breadcrumb-current">Submission</span>
                        </div>
                        <div class="submission-header-top">
                            <div>
                                <h1 class="submission-title">${this.lab?.title || this.submission.lab_id}</h1>
                                <p class="submission-subtitle">${this.course?.title || this.submission.course_id}</p>
                            </div>
                            <div class="submission-status-badge ${statusConfig.class}">
                                <span class="status-icon">${statusConfig.icon}</span>
                                <span class="status-text">${statusConfig.label}</span>
                            </div>
                        </div>
                    </div>

                    <div class="submission-detail-content">
                        <div class="submission-info-cards">
                            <div class="info-card">
                                <div class="info-card-icon">📅</div>
                                <div class="info-card-content">
                                    <div class="info-card-label">Submitted</div>
                                    <div class="info-card-value">${submittedDate ? submittedDate.toLocaleString() : 'N/A'}</div>
                                </div>
                            </div>
                            ${reviewedDate ? `
                                <div class="info-card">
                                    <div class="info-card-icon">✓</div>
                                    <div class="info-card-content">
                                        <div class="info-card-label">Reviewed</div>
                                        <div class="info-card-value">${reviewedDate.toLocaleString()}</div>
                                    </div>
                                </div>
                            ` : ''}
                            ${this.submission.resubmission_count > 0 ? `
                                <div class="info-card">
                                    <div class="info-card-icon">🔄</div>
                                    <div class="info-card-content">
                                        <div class="info-card-label">Resubmissions</div>
                                        <div class="info-card-value">${this.submission.resubmission_count}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <div class="submission-section">
                            <h2 class="section-title">Submission File</h2>
                            ${this.renderFileSection()}
                        </div>

                        ${this.submission.feedback ? `
                            <div class="submission-section">
                                <h2 class="section-title">Feedback</h2>
                                <div class="feedback-card">
                                    <div class="feedback-header">
                                        <span class="feedback-label">Trainer Feedback</span>
                                        ${reviewedDate ? `<span class="feedback-date">Reviewed on ${reviewedDate.toLocaleDateString()}</span>` : ''}
                                    </div>
                                    <div class="feedback-content">
                                        ${this.escapeHtml(this.submission.feedback)}
                                    </div>
                                </div>
                            </div>
                        ` : this.submission.status === 'submitted' ? `
                            <div class="submission-section">
                                <div class="pending-feedback-card">
                                    <div class="pending-icon">⏳</div>
                                    <div class="pending-content">
                                        <h3 class="pending-title">Awaiting Review</h3>
                                        <p class="pending-text">Your submission is being reviewed by your trainer. You'll receive feedback once the review is complete.</p>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <div class="submission-section">
                            <h2 class="section-title">Submission History</h2>
                            <div class="feedback-history">
                                ${this.renderFeedbackHistory()}
                            </div>
                        </div>

                        ${this.submission.status === 'needs_revision' ? `
                            <div class="submission-actions">
                                <a href="#/courses/${this.submission.course_id}/lab/${this.submission.lab_id}" class="btn btn-primary btn-large">
                                    Resubmit Lab
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Get status configuration
     */
    getStatusConfig(status) {
        const configs = {
            'submitted': {
                label: 'Submitted',
                icon: '📤',
                class: 'status-submitted',
                color: 'var(--color-info)'
            },
            'reviewed': {
                label: 'Reviewed',
                icon: '✓',
                class: 'status-reviewed',
                color: 'var(--color-info)'
            },
            'approved': {
                label: 'Approved',
                icon: '✓',
                class: 'status-approved',
                color: 'var(--color-success)'
            },
            'needs_revision': {
                label: 'Needs Revision',
                icon: '↻',
                class: 'status-revision',
                color: 'var(--color-warning)'
            }
        };
        return configs[status] || configs['submitted'];
    }

    /**
     * Render file section
     */
    renderFileSection() {
        const hasFile = this.submission.file_url && this.submission.file_url.trim() !== '';
        const submittedDate = this.submission.submitted_at ? new Date(this.submission.submitted_at) : null;
        const isOldSubmission = submittedDate && (Date.now() - submittedDate.getTime() > 30 * 24 * 60 * 60 * 1000);

        if (!hasFile) {
            return `
                <div class="file-section-empty">
                    <span class="file-icon">📄</span>
                    <span class="file-text">No file attached</span>
                </div>
            `;
        }

        if (isOldSubmission) {
            return `
                <div class="file-section-warning">
                    <span class="warning-icon">⚠️</span>
                    <div class="warning-content">
                        <div class="warning-title">File Deleted</div>
                        <div class="warning-text">This file was automatically deleted after 30 days for storage management.</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="file-section">
                <div class="file-info">
                    <span class="file-icon">📄</span>
                    <div class="file-details">
                        <div class="file-name">${this.submission.file_name || 'submission.docx'}</div>
                        ${this.submission.file_size ? `
                            <div class="file-size">${this.formatFileSize(this.submission.file_size)}</div>
                        ` : ''}
                    </div>
                </div>
                <button class="btn btn-primary" id="download-file-btn">
                    <span class="btn-icon">📥</span>
                    <span>Download File</span>
                </button>
            </div>
        `;
    }

    /**
     * Render feedback history
     */
    renderFeedbackHistory() {
        if (this.feedbackHistory.length === 0) {
            return '<p class="empty-text">No submission history available</p>';
        }

        return this.feedbackHistory.map((submission, index) => {
            const isCurrent = submission.id === this.submissionId;
            const statusConfig = this.getStatusConfig(submission.status);
            const submittedDate = submission.submitted_at ? new Date(submission.submitted_at) : null;

            return `
                <div class="history-item ${isCurrent ? 'current' : ''}">
                    <div class="history-timeline">
                        <div class="history-dot"></div>
                        ${index < this.feedbackHistory.length - 1 ? '<div class="history-line"></div>' : ''}
                    </div>
                    <div class="history-content">
                        <div class="history-header">
                            <div class="history-status ${statusConfig.class}">
                                <span>${statusConfig.icon}</span>
                                <span>${statusConfig.label}</span>
                            </div>
                            <div class="history-date">${submittedDate ? submittedDate.toLocaleString() : 'N/A'}</div>
                        </div>
                        ${submission.feedback ? `
                            <div class="history-feedback">
                                <div class="history-feedback-label">Feedback:</div>
                                <div class="history-feedback-text">${this.escapeHtml(submission.feedback)}</div>
                            </div>
                        ` : ''}
                        ${submission.resubmission_count > 0 ? `
                            <div class="history-resubmission">
                                Resubmission #${submission.resubmission_count}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (!bytes) return 'Unknown size';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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
     * Attach event listeners
     */
    attachEventListeners() {
        // Download file button
        const downloadBtn = document.getElementById('download-file-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                await this.handleDownloadFile();
            });
        }
    }

    /**
     * Handle file download
     */
    async handleDownloadFile() {
        if (!this.submission.file_url) {
            return;
        }

        const button = document.getElementById('download-file-btn');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="btn-spinner"><span class="spinner"></span></span><span>Downloading...</span>';
        }

        try {
            const signedUrl = await labSubmissionService.getSubmissionFileUrl(this.submission.file_url);
            if (signedUrl) {
                window.open(signedUrl, '_blank');
            } else {
                alert('Failed to generate download URL. The file may have been deleted.');
            }
        } catch (error) {
            console.error('[SubmissionDetail] Error downloading file:', error);
            alert('Failed to download file: ' + error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="btn-icon">📥</span><span>Download File</span>';
            }
        }
    }

    /**
     * Render error
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="submission-detail-page">
                <div class="submission-detail-container">
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h2 class="error-title">Error Loading Submission</h2>
                        <p class="error-message">${this.escapeHtml(message)}</p>
                        <a href="#/learner/lab-submissions" class="btn btn-primary">Back to Submissions</a>
                    </div>
                </div>
            </div>
        `;
    }
}

export default SubmissionDetail;

