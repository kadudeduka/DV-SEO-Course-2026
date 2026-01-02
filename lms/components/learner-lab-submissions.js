/**
 * Learner Lab Submissions Component
 * 
 * Displays all lab submissions for the current learner.
 */

import { labSubmissionService } from '../services/lab-submission-service.js';
import { authService } from '../services/auth-service.js';
import { courseService } from '../services/course-service.js';
import Header from './header.js';

class LearnerLabSubmissions {
    constructor(container) {
        this.container = container;
        this.submissions = [];
        this.currentUser = null;
        this.courses = {};
    }

    /**
     * Show learner lab submissions interface
     */
    async show() {
        this.container.style.display = 'block';
        this.renderLoading();
        await this.loadData();
        this.render();
    }

    /**
     * Load submissions and course data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                throw new Error('Authentication required');
            }

            console.log('[LearnerLabSubmissions] Loading submissions for learner:', this.currentUser.id);
            
            // Load all submissions for the learner
            this.submissions = await labSubmissionService.getAllSubmissionsForLearner(this.currentUser.id);
            console.log('[LearnerLabSubmissions] Loaded submissions:', this.submissions.length);

            // Load course metadata for display
            const uniqueCourseIds = [...new Set(this.submissions.map(s => s.course_id))];
            for (const courseId of uniqueCourseIds) {
                try {
                    this.courses[courseId] = await courseService.getCourseById(courseId);
                } catch (error) {
                    console.warn(`[LearnerLabSubmissions] Failed to load course ${courseId}:`, error);
                }
            }
        } catch (error) {
            console.error('[LearnerLabSubmissions] Error loading data:', error);
            this.showError('Failed to load submissions: ' + error.message);
            this.submissions = [];
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        this.container.innerHTML = `
            <div class="learner-lab-submissions">
                <h2>My Lab Submissions</h2>
                <p>Loading submissions...</p>
            </div>
        `;
    }

    /**
     * Render main interface
     */
    render() {
        this.renderHeader();
        
        this.container.innerHTML = `
            <div class="learner-lab-submissions-page">
                <div class="submissions-container">
                    <div class="submissions-header">
                        <div>
                            <h1 class="submissions-title">My Lab Submissions</h1>
                            <p class="submissions-subtitle">View and manage all your lab submissions</p>
                        </div>
                    </div>
                    <div id="submissions-error" class="error-message" style="display: none;"></div>
                    <div id="submissions-success" class="success-message" style="display: none;"></div>
                    
                    ${this.renderSubmissionsList()}
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Group submissions by lab (course_id + lab_id)
     */
    groupSubmissionsByLab() {
        const grouped = {};
        
        this.submissions.forEach(submission => {
            const key = `${submission.course_id}::${submission.lab_id}`;
            if (!grouped[key]) {
                grouped[key] = {
                    course_id: submission.course_id,
                    lab_id: submission.lab_id,
                    submissions: []
                };
            }
            grouped[key].submissions.push(submission);
        });
        
        // Sort submissions within each group by submitted_at (latest first)
        Object.values(grouped).forEach(group => {
            group.submissions.sort((a, b) => {
                const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
                const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
                return dateB - dateA; // Latest first
            });
        });
        
        // Sort groups by latest submission date (latest first)
        return Object.values(grouped).sort((a, b) => {
            const latestA = a.submissions[0]?.submitted_at ? new Date(a.submissions[0].submitted_at).getTime() : 0;
            const latestB = b.submissions[0]?.submitted_at ? new Date(b.submissions[0].submitted_at).getTime() : 0;
            return latestB - latestA; // Latest first
        });
    }

    /**
     * Render submissions list (modern card-based design)
     */
    renderSubmissionsList() {
        if (this.submissions.length === 0) {
            return `
                <div class="submissions-empty-state">
                    <div class="empty-icon">📝</div>
                    <h3 class="empty-title">No lab submissions yet</h3>
                    <p class="empty-text">
                        Your submitted labs will appear here. Go to a course and complete a lab to get started.
                    </p>
                    <a href="#/courses/my-courses" class="btn btn-primary">View My Courses</a>
                </div>
            `;
        }

        const groupedLabs = this.groupSubmissionsByLab();

        return `
            <div class="submissions-list">
                ${groupedLabs.map(labGroup => {
                    const course = this.courses[labGroup.course_id] || {};
                    const courseTitle = course.title || labGroup.course_id;
                    const latestSubmission = labGroup.submissions[0];
                    const statusConfig = this.getStatusConfig(latestSubmission.status);
                    
                    return `
                        <div class="submission-lab-card">
                            <div class="lab-card-header">
                                <div class="lab-card-info">
                                    <a href="#/courses/${labGroup.course_id}" class="lab-course-link">${this.escapeHtml(courseTitle)}</a>
                                    <a href="#/courses/${labGroup.course_id}/lab/${labGroup.lab_id}" class="lab-title-link">${this.escapeHtml(labGroup.lab_id)}</a>
                                    <div class="lab-submission-count">${labGroup.submissions.length} submission${labGroup.submissions.length !== 1 ? 's' : ''}</div>
                                </div>
                                <div class="lab-card-status ${statusConfig.class}">
                                    <span class="status-icon">${statusConfig.icon}</span>
                                    <span class="status-text">${statusConfig.label}</span>
                                </div>
                            </div>
                            <div class="lab-submissions-list">
                                ${labGroup.submissions.map(submission => this.renderSubmissionCard(submission)).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render individual submission card
     */
    renderSubmissionCard(submission) {
        const statusConfig = this.getStatusConfig(submission.status);
        const submittedDate = submission.submitted_at ? new Date(submission.submitted_at) : null;
        const reviewedDate = submission.reviewed_at ? new Date(submission.reviewed_at) : null;
        const hasFile = submission.file_url && submission.file_url.trim() !== '';
        const isOldSubmission = submittedDate && (Date.now() - submittedDate.getTime() > 30 * 24 * 60 * 60 * 1000);
        const feedbackPreview = submission.feedback ? (submission.feedback.length > 150 ? submission.feedback.substring(0, 150) + '...' : submission.feedback) : null;

        return `
            <div class="submission-card">
                <div class="submission-card-header">
                    <div class="submission-meta">
                        <span class="submission-status-badge ${statusConfig.class}">
                            <span class="status-icon">${statusConfig.icon}</span>
                            <span class="status-text">${statusConfig.label}</span>
                        </span>
                        <span class="submission-date">${submittedDate ? submittedDate.toLocaleString() : 'N/A'}</span>
                        ${submission.resubmission_count > 0 ? `<span class="resubmission-badge">Resubmission #${submission.resubmission_count}</span>` : ''}
                    </div>
                    <a href="#/submissions/${submission.id}" class="btn btn-ghost btn-sm">View Details</a>
                </div>
                <div class="submission-card-content">
                    ${hasFile ? `
                        ${isOldSubmission ? `
                            <div class="file-warning">
                                <span class="warning-icon">⚠️</span>
                                <span class="warning-text">File deleted (30+ days old)</span>
                            </div>
                        ` : `
                            <div class="file-info">
                                <span class="file-icon">📄</span>
                                <span class="file-name">${this.escapeHtml(submission.file_name || 'submission.docx')}</span>
                                ${submission.file_size ? `<span class="file-size">${this.formatFileSize(submission.file_size)}</span>` : ''}
                                <button class="btn-link download-submission-file" data-file-url="${this.escapeHtml(submission.file_url)}" data-submission-id="${this.escapeHtml(submission.id)}">
                                    Download
                                </button>
                            </div>
                        `}
                    ` : `
                        <div class="file-empty">No file attached</div>
                    `}
                    ${feedbackPreview ? `
                        <div class="feedback-preview">
                            <div class="feedback-label">Feedback:</div>
                            <div class="feedback-text">${this.escapeHtml(feedbackPreview)}</div>
                        </div>
                    ` : submission.status === 'submitted' ? `
                        <div class="pending-feedback">
                            <span class="pending-icon">⏳</span>
                            <span class="pending-text">Pending review</span>
                        </div>
                    ` : ''}
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
     * Render header
     */
    renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            header.init();
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Handle file downloads
        const downloadLinks = this.container.querySelectorAll('.download-submission-file');
        downloadLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const fileUrl = link.getAttribute('data-file-url');
                const submissionId = link.getAttribute('data-submission-id');
                if (fileUrl) {
                    await this.handleDownloadFile(fileUrl, submissionId);
                }
            });
        });
    }

    /**
     * Handle file download
     */
    async handleDownloadFile(fileUrl, submissionId) {
        try {
            const signedUrl = await labSubmissionService.getSubmissionFileUrl(fileUrl);
            if (signedUrl) {
                window.open(signedUrl, '_blank');
            } else {
                this.showError('Failed to generate download URL. The file may have been deleted after 30 days.');
            }
        } catch (error) {
            console.error('[LearnerLabSubmissions] Error downloading file:', error);
            if (error.message.includes('not found') || error.message.includes('404')) {
                this.showError('File not found. It may have been automatically deleted after 30 days.');
            } else {
                this.showError('Failed to download file: ' + error.message);
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#submissions-error');
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
        const successDiv = this.container.querySelector('#submissions-success');
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

export default LearnerLabSubmissions;

