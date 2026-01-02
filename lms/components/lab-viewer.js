/**
 * Lab Viewer Component
 * 
 * Displays lab instructions and content.
 */

import { courseService } from '../services/course-service.js';
import { renderMarkdown } from '../utils/markdown-renderer.js';
import { labSubmissionService } from '../services/lab-submission-service.js';
import { authService } from '../services/auth-service.js';
import Header from './header.js';
import NavigationSidebar from './navigation-sidebar.js';

class LabViewer {
    constructor(container) {
        this.container = container;
        this.courseId = null;
        this.labId = null;
        this.course = null;
        this.lab = null;
        this.markdown = null;
        this.currentUser = null;
        this.latestSubmission = null;
        this.allSubmissions = [];
        this.metadata = {};
    }

    /**
     * Show lab viewer
     * @param {string} courseId - Course identifier
     * @param {string} labId - Lab identifier
     */
    async show(courseId, labId) {
        this.courseId = courseId;
        this.labId = labId;
        
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }
        
        this.renderHeader();
        this.renderLoading();
        
        // Initialize AI Coach widget for this course
        await this._initAICoach();
        
        try {
            await this.loadCourse();
            await this.findLab();
            
            if (!this.lab) {
                this.renderError('Lab not found');
                return;
            }
            
            await this.loadContent();
            await this.loadSubmissionStatus();
            this.render();
        } catch (error) {
            console.error('[LabViewer] Error in show():', error);
            this.renderError('Failed to load lab: ' + error.message);
        }
    }

    /**
     * Initialize AI Coach widget
     * @private
     */
    async _initAICoach() {
        try {
            const { default: AICoachWidget } = await import('./ai-coach/learner/ai-coach-widget.js');
            if (!window.aiCoachWidgetInstance) {
                window.aiCoachWidgetInstance = new AICoachWidget();
                await window.aiCoachWidgetInstance.init();
            } else {
                // Update course context if widget already exists
                window.aiCoachWidgetInstance.currentCourseId = this.courseId;
                await window.aiCoachWidgetInstance.render();
                // Re-attach event listeners after re-rendering
                window.aiCoachWidgetInstance.attachEventListeners();
                window.aiCoachWidgetInstance.show();
            }
        } catch (error) {
            console.error('[LabViewer] Failed to initialize AI Coach:', error);
        }
    }

    /**
     * Load course data
     */
    async loadCourse() {
        if (!this.courseId) {
            throw new Error('Course ID is required');
        }
        
        this.course = await courseService.getCourseById(this.courseId);
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
                const lab = day.labs.find(l => l.id === this.labId);
                if (lab) {
                    this.lab = lab;
                    // Extract metadata for template download
                    this.metadata = {
                        day: day.dayNumber || day.day,
                        lab_number: this._extractLabNumber(lab.id)
                    };
                    return;
                }
            }
        }
    }

    /**
     * Extract lab number from lab ID (e.g., "day1-lab1" -> 1)
     */
    _extractLabNumber(labId) {
        const match = labId.match(/lab(\d+)/i);
        return match ? parseInt(match[1]) : 1;
    }

    /**
     * Load markdown content
     */
    async loadContent() {
        if (!this.lab || !this.lab.file) {
            throw new Error('Lab file path not found');
        }

        this.markdown = await courseService.getCourseContent(this.lab.file);
    }

    /**
     * Load submission status
     */
    async loadSubmissionStatus() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                this.latestSubmission = null;
                this.allSubmissions = [];
                return;
            }

            this.allSubmissions = await labSubmissionService.getLabSubmissions(
                this.currentUser.id,
                this.courseId,
                this.labId
            );

            this.latestSubmission = this.allSubmissions.length > 0 ? this.allSubmissions[0] : null;
        } catch (error) {
            console.warn('Failed to load submission status:', error);
            this.latestSubmission = null;
            this.allSubmissions = [];
        }
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
     * Render loading state
     */
    renderLoading() {
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }
        this.container.innerHTML = `
            <div class="content-viewer-layout">
                <div id="nav-sidebar-container"></div>
                <div class="lab-viewer">
                    <div class="loading-state">
                        <div class="loading-state-text">Loading lab...</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render lab content
     */
    async render() {
        if (!this.lab || !this.markdown) {
            this.renderError('Lab content not available');
            return;
        }

        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }

        const html = await renderMarkdown(this.markdown, this.courseId);
        const submissionStatus = this.getSubmissionStatus();
        const canSubmit = this.canSubmit();

        this.container.innerHTML = `
            <div class="content-viewer-layout">
                <div id="nav-sidebar-container" class="content-sidebar-container"></div>
                <div class="content-viewer-main">
                    <div class="content-viewer-header">
                        <div class="content-header-title-row">
                            <h1 class="content-title">${this.lab.title || 'Untitled Lab'}</h1>
                        </div>
                        <div class="content-header-actions-row">
                            <div id="lab-submit-controls" class="completion-controls">
                                <button id="submit-labs-btn" class="btn btn-primary btn-sm" onclick="document.getElementById('lab-submission-section').scrollIntoView({ behavior: 'smooth', block: 'start' })">
                                    Submit Labs
                                </button>
                            </div>
                            <div class="reading-progress-bar">
                                <div class="reading-progress-fill" id="reading-progress-fill"></div>
                            </div>
                        </div>
                    </div>
                    <div id="lab-error" class="error-message" style="display: none;"></div>
                    <div class="lab-viewer">
                    ${submissionStatus ? `
                        <div id="submission-status" class="status-banner status-banner-info">
                            <strong>Status:</strong> ${submissionStatus}
                        </div>
                    ` : ''}
                    ${this.latestSubmission && this.latestSubmission.feedback ? `
                        <div id="trainer-feedback" class="feedback-section">
                            <div class="feedback-header">Trainer Feedback</div>
                            <div class="feedback-content">${this.latestSubmission.feedback}</div>
                        </div>
                    ` : ''}
                    ${this.allSubmissions.length > 1 ? this.renderSubmissionHistory() : ''}
                    <div class="lab-instructions">
                        <h3 class="section-heading">Instructions</h3>
                        <div class="lab-content-body markdown-content">
                            ${html}
                        </div>
                    </div>
                ${this.currentUser ? `
                    <div id="lab-submission-section" class="lab-submission">
                        <h3 class="section-heading">Lab Submission</h3>
                        <div class="warning-banner">
                            <p>
                                ⚠️ Important: Submission files are automatically deleted after 30 days. 
                                Please download and save your submissions for your records.
                            </p>
                        </div>
                        <div class="info-banner">
                            <p class="info-banner-title"><strong>Submission Process:</strong></p>
                            <ol class="info-banner-list">
                                <li>Download the submission template (DOCX file)</li>
                                <li>Complete the template offline with your answers</li>
                                <li>Upload your completed DOCX file</li>
                            </ol>
                        </div>
                        <div class="download-section">
                            <a 
                                href="/data/courses/seo-master-2026/assets/templates/Day${String(this.metadata?.day || '').padStart(2, '0')}_Lab${String(this.metadata?.lab_number || '').padStart(2, '0')}_Submission_Template.docx"
                                download
                                id="download-template-btn"
                                class="btn btn-success btn-download">
                                📥 Download Submission Template (.docx)
                            </a>
                        </div>
                        ${this.latestSubmission && this.latestSubmission.file_url ? `
                            <div class="submission-info">
                                <div class="submission-info-row">
                                    <strong>Submitted File:</strong> ${this.latestSubmission.file_name || 'submission.docx'}
                                    ${this.latestSubmission.file_size ? ` <span class="file-size">(${(this.latestSubmission.file_size / 1024).toFixed(2)} KB)</span>` : ''}
                                </div>
                                <div class="submission-info-row">
                                    <small>Submitted: ${new Date(this.latestSubmission.submitted_at).toLocaleString()}</small>
                                </div>
                                ${this.latestSubmission.status === 'needs_revision' ? `
                                    <div class="submission-info-row">
                                        <span class="revision-warning">⚠️ Revision required. Please download the template, update your submission, and resubmit.</span>
                                    </div>
                                ` : ''}
                                ${(() => {
                                    const submittedDate = new Date(this.latestSubmission.submitted_at);
                                    const daysSinceSubmission = Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));
                                    const isOldSubmission = daysSinceSubmission >= 30;
                                    
                                    if (isOldSubmission) {
                                        return `
                                            <div class="submission-info-row">
                                                <div class="error-banner">
                                                    <span>⚠️ File deleted: This submission is older than 30 days and has been automatically deleted from the server.</span>
                                                </div>
                                            </div>
                                        `;
                                    } else {
                                        return `
                                            <div class="submission-info-row">
                                                <a href="#" 
                                                   id="download-submitted-file" 
                                                   data-file-url="${this.latestSubmission.file_url}"
                                                   class="btn btn-primary btn-download">
                                                    📥 Download My Submission
                                                </a>
                                            </div>
                                            <div class="submission-info-row">
                                                <small class="deletion-warning">⚠️ Important: This file will be automatically deleted after 30 days (${30 - daysSinceSubmission} days remaining). Please download and save a copy for your records.</small>
                                            </div>
                                        `;
                                    }
                                })()}
                            </div>
                        ` : ''}
                        <form id="lab-submission-form" class="submission-form" enctype="multipart/form-data">
                            <div class="form-group">
                                <label for="lab-docx-file" class="form-label">
                                    Upload Completed DOCX File:
                                </label>
                                <input 
                                    type="file" 
                                    id="lab-docx-file" 
                                    name="docxFile"
                                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    ${!canSubmit ? 'disabled' : ''}
                                    class="form-input ${!canSubmit ? 'form-input-disabled' : ''}">
                                <small class="form-hint">Only .docx files are accepted</small>
                            </div>
                            <div class="form-actions">
                                <button 
                                    type="submit" 
                                    id="submit-lab-btn"
                                    ${!canSubmit ? 'disabled' : ''}
                                    class="btn btn-primary ${!canSubmit ? 'btn-disabled' : ''}">
                                    ${this.latestSubmission ? 'Resubmit' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                ` : ''}
                    </div>
                </div>
            </div>
        `;
        await this.renderSidebar();
        this.attachEventListeners();
        this.setupReadingProgress();
    }

    /**
     * Setup reading progress indicator
     */
    setupReadingProgress() {
        const contentBody = this.container.querySelector('.lab-content-body');
        const progressFill = this.container.querySelector('#reading-progress-fill');
        
        if (!contentBody || !progressFill) return;

        const updateProgress = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        };

        window.addEventListener('scroll', updateProgress);
        window.addEventListener('resize', updateProgress);
        updateProgress(); // Initial update
    }

    /**
     * Render navigation sidebar
     */
    async renderSidebar() {
        if (!this.course || !this.course.courseData) {
            console.warn('[LabViewer] Cannot render sidebar: course or courseData missing');
            return;
        }

        const sidebarContainer = this.container.querySelector('#nav-sidebar-container');
        if (!sidebarContainer) {
            console.warn('[LabViewer] Sidebar container not found');
            return;
        }

        this.sidebar = new NavigationSidebar(
            sidebarContainer,
            this.courseId,
            this.course.courseData,
            null, // activeChapterId
            this.labId // activeLabId
        );
        await this.sidebar.render();
    }

    /**
     * Get submission status text
     */
    getSubmissionStatus() {
        if (!this.latestSubmission) {
            return null;
        }

        const statusMap = {
            'submitted': 'Submitted',
            'reviewed': 'Reviewed',
            'approved': 'Approved',
            'needs_revision': 'Needs Revision'
        };

        return statusMap[this.latestSubmission.status] || this.latestSubmission.status;
    }

    /**
     * Check if user can submit
     */
    canSubmit() {
        if (!this.currentUser) {
            return false;
        }

        if (!this.latestSubmission) {
            return true;
        }

        const status = this.latestSubmission.status;
        return status === 'needs_revision';
    }

    /**
     * Get submission answer from latest submission
     * Returns empty string if status is 'needs_revision' to allow fresh resubmission
     */
    getSubmissionAnswer() {
        if (!this.latestSubmission || !this.latestSubmission.submission_data) {
            return '';
        }

        if (this.latestSubmission.status === 'needs_revision') {
            return '';
        }

        if (typeof this.latestSubmission.submission_data === 'string') {
            return this.latestSubmission.submission_data;
        }

        if (this.latestSubmission.submission_data.answer) {
            return this.latestSubmission.submission_data.answer;
        }

        return '';
    }

    /**
     * Render submission history
     */
    renderSubmissionHistory() {
        if (this.allSubmissions.length <= 1) {
            return '';
        }

        const previousSubmissions = this.allSubmissions.slice(1);

        return `
            <div class="submission-history">
                <h3 class="section-heading">Submission History</h3>
                ${previousSubmissions.map((submission, index) => {
                    const submissionData = submission.submission_data || {};
                    const answer = typeof submissionData === 'string' ? submissionData : (submissionData.answer || '');
                    const statusMap = {
                        'submitted': 'Submitted',
                        'reviewed': 'Reviewed',
                        'approved': 'Approved',
                        'needs_revision': 'Needs Revision'
                    };
                    const statusText = statusMap[submission.status] || submission.status;

                    return `
                        <div class="submission-history-item">
                            <div class="submission-history-header">
                                Submission #${this.allSubmissions.length - index} <span class="submission-status-badge submission-status-${submission.status}">${statusText}</span>
                            </div>
                            <div class="submission-history-meta">
                                Submitted: ${new Date(submission.submitted_at).toLocaleString()}
                                ${submission.reviewed_at ? ` | Reviewed: ${new Date(submission.reviewed_at).toLocaleString()}` : ''}
                            </div>
                            <div class="submission-history-answer">
                                <strong>Your Answer:</strong>
                                <div class="submission-answer-content">
                                    ${answer || 'No answer provided'}
                                </div>
                            </div>
                            ${submission.feedback ? `
                                <div class="submission-history-feedback">
                                    <strong>Trainer Feedback:</strong>
                                    <div class="feedback-content">
                                        ${submission.feedback}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const form = this.container.querySelector('#lab-submission-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Handle download of submitted file
        const downloadLink = this.container.querySelector('#download-submitted-file');
        if (downloadLink) {
            downloadLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const fileUrl = downloadLink.getAttribute('data-file-url');
                if (fileUrl) {
                    await this.handleDownloadSubmittedFile(fileUrl);
                }
            });
        }
    }

    /**
     * Handle download of submitted file
     */
    async handleDownloadSubmittedFile(fileUrl) {
        try {
            const signedUrl = await labSubmissionService.getSubmissionFileUrl(fileUrl);
            if (signedUrl) {
                window.open(signedUrl, '_blank');
            } else {
                this.showError('Failed to generate download URL. The file may have been deleted after 30 days.');
            }
        } catch (error) {
            console.error('[LabViewer] Error downloading submitted file:', error);
            if (error.message.includes('not found') || error.message.includes('404')) {
                this.showError('File not found. It may have been automatically deleted after 30 days.');
            } else {
                this.showError('Failed to download file: ' + error.message);
            }
        }
    }

    /**
     * Handle form submission
     */
    async handleSubmit(event) {
        event.preventDefault();

        if (!this.currentUser || !this.currentUser.id) {
            this.showError('You must be logged in to submit a lab');
            return;
        }

        const fileInput = this.container.querySelector('#lab-docx-file');
        const file = fileInput ? fileInput.files[0] : null;

        if (!file) {
            this.showError('Please select a DOCX file to upload');
            return;
        }

        // Validate file type
        if (!file.name.endsWith('.docx') && file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            this.showError('Only DOCX files are allowed. Please upload a .docx file.');
            return;
        }

        const submitBtn = this.container.querySelector('#submit-lab-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';
        }

        try {
            await labSubmissionService.submitLab(
                this.currentUser.id,
                this.courseId,
                this.labId,
                file
            );

            await this.loadSubmissionStatus();
            this.render();
            
            // Clear file input
            if (fileInput) {
                fileInput.value = '';
            }
            
            // Show success message
            this.showSuccess('Lab submitted successfully! Your trainer will review it soon.');
        } catch (error) {
            this.showError('Failed to submit lab: ' + error.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = this.latestSubmission ? 'Resubmit' : 'Submit';
            }
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const errorDiv = this.container.querySelector('#lab-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = 'success-message';
            errorDiv.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#lab-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = 'error-message';
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Render error state
     */
    renderError(message) {
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }
        this.container.innerHTML = `
            <div class="lab-viewer lab-viewer-standalone">
                <div class="error-message">
                    ${message}
                </div>
            </div>
        `;
    }
}

export default LabViewer;

