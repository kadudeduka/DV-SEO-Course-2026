/**
 * Learner Course Report Component
 * 
 * Displays detailed performance report for a specific course.
 * Shows course overview, chapter progress, lab performance, and activity timeline.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import { courseService } from '../../../services/course-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class LearnerCourseReport {
    constructor(container, courseId, learnerId = null) {
        this.container = container;
        this.courseId = courseId;
        this.learnerId = learnerId; // Optional: if provided, use this instead of current user
        this.currentUser = null;
        this.reportData = null;
        this.course = null;
        this.dateRange = null;
        console.log('[LearnerCourseReport] Constructor called with courseId:', courseId, 'learnerId:', learnerId);
    }

    async init() {
        try {
            console.log('[LearnerCourseReport] Initializing for courseId:', this.courseId, 'learnerId:', this.learnerId);
            
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
            }

            // Initialize header
            console.log('[LearnerCourseReport] Rendering header...');
            await this.renderHeader();

            // Get current user (or use provided learnerId for admin view)
            if (this.learnerId) {
                // Admin viewing a learner's report - create a user object with the learnerId
                console.log('[LearnerCourseReport] Using provided learnerId for admin view:', this.learnerId);
                this.currentUser = { id: this.learnerId };
            } else {
                console.log('[LearnerCourseReport] Getting current user from authService...');
                this.currentUser = await authService.getCurrentUser();
                if (!this.currentUser) {
                    throw new Error('User not authenticated');
                }
                console.log('[LearnerCourseReport] Current user from authService:', this.currentUser.id);
            }
            console.log('[LearnerCourseReport] Final currentUser.id that will be used for report:', this.currentUser.id);

            // Load course data
            console.log('[LearnerCourseReport] Loading course data...');
            this.course = await courseService.getCourseById(this.courseId);
            if (!this.course) {
                throw new Error('Course not found');
            }
            console.log('[LearnerCourseReport] Course loaded:', this.course.title);

            // Load report data
            console.log('[LearnerCourseReport] Loading report data...');
            await this.loadData();
            console.log('[LearnerCourseReport] Report data loaded:', this.reportData);

            // Render report
            console.log('[LearnerCourseReport] Rendering report...');
            this.render();
            console.log('[LearnerCourseReport] Report rendered successfully');
        } catch (error) {
            console.error('[LearnerCourseReport] Error initializing:', error);
            console.error('[LearnerCourseReport] Error stack:', error.stack);
            this.showError(error.message || 'Failed to load course report. Please try again.');
        }
    }

    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    async loadData() {
        try {
            this.container.innerHTML = '<div class="report-loading">Loading...</div>';
            
            // Use learnerId if provided (admin view), otherwise use currentUser.id
            const userIdToUse = this.learnerId || this.currentUser.id;
            console.log('[LearnerCourseReport] loadData - learnerId:', this.learnerId, 'currentUser.id:', this.currentUser.id, 'userIdToUse:', userIdToUse);
            
            console.log('[LearnerCourseReport] Calling reportService.getLearnerCourseReport with:', {
                userId: userIdToUse,
                courseId: this.courseId,
                dateRange: this.dateRange,
                learnerIdProvided: !!this.learnerId
            });

            this.reportData = await reportService.getLearnerCourseReport(
                userIdToUse,
                this.courseId,
                this.dateRange
            );

            console.log('[LearnerCourseReport] Report data received:', this.reportData);
        } catch (error) {
            console.error('[LearnerCourseReport] Error loading data:', error);
            console.error('[LearnerCourseReport] Error stack:', error.stack);
            throw error;
        }
    }

    render() {
        if (!this.reportData) {
            this.container.innerHTML = '<div class="report-loading">Loading...</div>';
            return;
        }

        const exportOptions = new ExportOptions();
        const reportCharts = new ReportCharts();

        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <a href="${this.learnerId ? `#/reports/admin/learner/${this.learnerId}` : '#/reports/learner'}" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to ${this.learnerId ? 'Learner Report' : 'Dashboard'}
                        </a>
                        <h1>${this.escapeHtml(this.reportData.course.name)}</h1>
                        <p class="report-subtitle">Course Performance Report${this.learnerId ? ' (Admin View)' : ''}</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'learner_course')}
                    </div>
                </div>

                <div class="statistics-cards">
                    ${this.renderCourseStatistics()}
                </div>

                <div class="course-report-tabs">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="overview">Overview</button>
                        <button class="tab-button" data-tab="chapters">Chapters</button>
                        <button class="tab-button" data-tab="labs">Labs</button>
                        <button class="tab-button" data-tab="timeline">Activity Timeline</button>
                    </div>

                    <div class="tab-content">
                        <div id="tab-overview" class="tab-pane active">
                            ${this.renderOverview()}
                        </div>
                        <div id="tab-chapters" class="tab-pane">
                            ${this.renderChapters()}
                        </div>
                        <div id="tab-labs" class="tab-pane">
                            ${this.renderLabs()}
                        </div>
                        <div id="tab-timeline" class="tab-pane">
                            ${this.renderTimeline()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();
        
        // Initialize export options
        exportOptions.attachEventListeners(this.container);
    }

    renderCourseStatistics() {
        const { reportData } = this;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Progress</div>
                <div class="stat-value">${(reportData.progress || 0).toFixed(1)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Time Spent</div>
                <div class="stat-value">${reportData.timeSpent > 0 ? this.formatTime(reportData.timeSpent) : 'Not tracked'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Days Since Start</div>
                <div class="stat-value">${reportData.daysSinceStart || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Chapters Completed</div>
                <div class="stat-value">${(reportData.chapterProgress || []).filter(c => c.completed).length}/${(reportData.chapterProgress || []).length}</div>
            </div>
        `;
    }

    renderOverview() {
        const reportCharts = new ReportCharts();
        const { reportData } = this;

        return `
            <div class="overview-section">
                <div class="overview-item">
                    <h3>Course Description</h3>
                    <p>${this.escapeHtml(reportData.course.description || 'No description available')}</p>
                </div>

                <div class="overview-item">
                    <h3>Overall Progress</h3>
                    ${reportCharts.renderProgressBar(reportData.progress || 0, '', 'lg')}
                </div>

                ${reportData.estimatedCompletionDate ? `
                    <div class="overview-item">
                        <h3>Estimated Completion</h3>
                        <p>${this.formatDate(reportData.estimatedCompletionDate)}</p>
                    </div>
                ` : ''}

                ${reportData.metrics ? `
                    <div class="overview-item">
                        <h3>Performance Metrics</h3>
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-label">Avg Time per Chapter:</span>
                                <span class="metric-value">${reportData.metrics.averageTimePerChapter > 0 ? this.formatTime(reportData.metrics.averageTimePerChapter) : 'Not tracked'}</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Consistency Score:</span>
                                <span class="metric-value">${(reportData.metrics.consistencyScore || 0).toFixed(1)}%</span>
                                <span class="metric-hint" style="font-size: 0.75rem; color: #6b7280; margin-left: 8px;">
                                    (Days with activity / Total days)
                                </span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Engagement Score:</span>
                                <span class="metric-value">${(reportData.metrics.engagementScore || 0).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderChapters() {
        if (!this.reportData.chapterProgress || this.reportData.chapterProgress.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📖</div>
                    <div class="report-empty-title">No Chapters Available</div>
                    <div class="report-empty-message">Chapter information is not available for this course.</div>
                </div>
            `;
        }

        return `
            <div class="chapters-list">
                ${this.reportData.chapterProgress.map((chapter, index) => `
                    <div class="chapter-item">
                        <div class="chapter-header">
                            <h4>${this.escapeHtml(chapter.name || `Chapter ${index + 1}`)}</h4>
                            <span class="status-badge status-${chapter.completed ? 'completed' : 'in_progress'}">
                                ${chapter.completed ? 'Completed' : 'In Progress'}
                            </span>
                        </div>
                        ${chapter.completedAt ? `
                            <div class="chapter-meta">
                                <span>Completed: ${this.formatDate(chapter.completedAt)}</span>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderLabs() {
        if (!this.reportData.labPerformance || this.reportData.labPerformance.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📝</div>
                    <div class="report-empty-title">No Labs Available</div>
                    <div class="report-empty-message">Lab information is not available for this course.</div>
                </div>
            `;
        }

        return `
            <div class="labs-list">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Lab Name</th>
                            <th>Status</th>
                            <th>Submitted</th>
                            <th>Score</th>
                            <th>Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.labPerformance.map(lab => `
                            <tr>
                                <td>${this.escapeHtml(lab.name || 'Unknown Lab')}</td>
                                <td>
                                    <span class="status-badge status-${this.getLabStatusClass(lab.status)}">
                                        ${this.formatLabStatus(lab.status)}
                                    </span>
                                </td>
                                <td>${this.formatDate(lab.submittedAt)}</td>
                                <td>${lab.score ? lab.score.toFixed(1) : 'N/A'}</td>
                                <td>${lab.feedback ? this.escapeHtml(lab.feedback.substring(0, 50)) + '...' : 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderTimeline() {
        if (!this.reportData.activityTimeline || this.reportData.activityTimeline.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📅</div>
                    <div class="report-empty-title">No Activity</div>
                    <div class="report-empty-message">No activity recorded for this course yet.</div>
                </div>
            `;
        }

        return `
            <div class="timeline">
                ${this.reportData.activityTimeline.map(activity => `
                    <div class="timeline-item">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <div class="timeline-date">${this.formatDate(activity.date)}</div>
                            <div class="timeline-activity">${this.escapeHtml(activity.description || activity.type)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    attachEventListeners() {
        // Tab switching
        const tabButtons = this.container.querySelectorAll('.tab-button');
        const tabPanes = this.container.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');

                // Update active states
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));

                button.classList.add('active');
                const targetPane = this.container.querySelector(`#tab-${tabName}`);
                if (targetPane) {
                    targetPane.classList.add('active');
                }
            });
        });
    }

    getLabStatusClass(status) {
        const statusMap = {
            'pending': 'needs_attention',
            'approved': 'completed',
            'needs_revision': 'at_risk',
            'submitted': 'in_progress'
        };
        return statusMap[status] || 'not_started';
    }

    formatLabStatus(status) {
        const statusMap = {
            'pending': 'Pending Review',
            'approved': 'Approved',
            'needs_revision': 'Needs Revision',
            'submitted': 'Submitted'
        };
        return statusMap[status] || status;
    }

    formatTime(minutes) {
        if (!minutes || minutes === 0) return '0 min';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }

    formatDate(date) {
        if (!date) return 'N/A';
        try {
            return new Date(date).toLocaleDateString();
        } catch (e) {
            return 'N/A';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="report-error">
                <div class="report-error-icon">⚠️</div>
                <div class="report-error-title">Error</div>
                <div class="report-error-message">${this.escapeHtml(message)}</div>
                <a href="${this.learnerId ? `#/reports/admin/learner/${this.learnerId}` : '#/reports/learner'}" class="btn btn-primary" style="margin-top: 16px;">
                    Back to ${this.learnerId ? 'Learner Report' : 'Dashboard'}
                </a>
            </div>
        `;
    }
}

export default LearnerCourseReport;

