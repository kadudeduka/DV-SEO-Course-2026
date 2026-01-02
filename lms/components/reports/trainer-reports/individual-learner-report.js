/**
 * Individual Learner Report Component (Trainer View)
 * 
 * Displays detailed performance report for a specific learner.
 * Shows learner profile, course performance, lab evaluation summary, and activity timeline.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class IndividualLearnerReport {
    constructor(container, learnerId) {
        this.container = container;
        this.learnerId = learnerId;
        this.currentUser = null;
        this.reportData = null;
        this.dateRange = null;
    }

    async init() {
        try {
            console.log('[IndividualLearnerReport] Initializing for learnerId:', this.learnerId);
            
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
                console.log('[IndividualLearnerReport] Container set to visible');
            } else {
                console.error('[IndividualLearnerReport] Container is null!');
                throw new Error('Container not found');
            }

            // Initialize header
            console.log('[IndividualLearnerReport] Rendering header...');
            await this.renderHeader();
            console.log('[IndividualLearnerReport] Header rendered');

            // Get current user
            console.log('[IndividualLearnerReport] Getting current user...');
            this.currentUser = await authService.getCurrentUser();
            console.log('[IndividualLearnerReport] Current user retrieved:', this.currentUser);
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }
            if (this.currentUser.role !== 'trainer') {
                throw new Error('Access denied: Trainer role required');
            }
            console.log('[IndividualLearnerReport] Current user validated:', this.currentUser.id);

            // Load report data
            console.log('[IndividualLearnerReport] Loading report data...');
            await this.loadData();
            console.log('[IndividualLearnerReport] Report data loaded:', this.reportData);

            // Render report
            console.log('[IndividualLearnerReport] Rendering report...');
            this.render();
            console.log('[IndividualLearnerReport] Report rendered successfully');
        } catch (error) {
            console.error('[IndividualLearnerReport] Error initializing:', error);
            console.error('[IndividualLearnerReport] Error stack:', error.stack);
            if (this.container) {
                this.showError(error.message || 'Failed to load learner report. Please try again.');
            } else {
                console.error('[IndividualLearnerReport] Cannot show error - container is null');
            }
        }
    }

    async renderHeader() {
        try {
            const headerContainer = document.getElementById('header-container');
            if (headerContainer) {
                const header = new Header(headerContainer);
                await header.init();
                console.log('[IndividualLearnerReport] Header initialization completed');
            } else {
                console.warn('[IndividualLearnerReport] Header container not found');
            }
        } catch (error) {
            console.error('[IndividualLearnerReport] Error rendering header:', error);
            // Don't throw - header is not critical for the report to display
        }
    }

    async loadData() {
        try {
            this.container.innerHTML = '<div class="report-loading">Loading...</div>';
            
            console.log('[IndividualLearnerReport] Calling reportService.getIndividualLearnerReport with:', {
                trainerId: this.currentUser.id,
                learnerId: this.learnerId,
                dateRange: this.dateRange
            });

            this.reportData = await reportService.getIndividualLearnerReport(
                this.currentUser.id,
                this.learnerId,
                this.dateRange
            );

            console.log('[IndividualLearnerReport] Report data received:', this.reportData);
        } catch (error) {
            console.error('[IndividualLearnerReport] Error loading data:', error);
            console.error('[IndividualLearnerReport] Error stack:', error.stack);
            throw error;
        }
    }

    render() {
        if (!this.reportData) {
            console.warn('[IndividualLearnerReport] No report data available, showing loading state');
            if (this.container) {
                this.container.innerHTML = '<div class="report-loading">Loading...</div>';
            }
            return;
        }

        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }

        const exportOptions = new ExportOptions();
        const reportCharts = new ReportCharts();

        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <a href="#/reports/trainer" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to Dashboard
                        </a>
                        <h1>${this.escapeHtml(this.reportData.learner.full_name || this.reportData.learner.email || 'Unknown Learner')}</h1>
                        <p class="report-subtitle">Learner Performance Report</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'individual_learner_report')}
                    </div>
                </div>

                <div class="learner-profile-section">
                    <div class="profile-card">
                        <h3>Learner Profile</h3>
                        <div class="profile-details">
                            <div class="profile-item">
                                <span class="profile-label">Email:</span>
                                <span class="profile-value">${this.escapeHtml(this.reportData.learner.email || 'N/A')}</span>
                            </div>
                            <div class="profile-item">
                                <span class="profile-label">Learner Type:</span>
                                <span class="profile-value">${this.formatLearnerType(this.reportData.learner.learner_type)}</span>
                            </div>
                            <div class="profile-item">
                                <span class="profile-label">Days Since Registration:</span>
                                <span class="profile-value">${this.reportData.learner.daysSinceRegistration || 0}</span>
                            </div>
                            <div class="profile-item">
                                <span class="profile-label">Status:</span>
                                <span class="profile-value">
                                    <span class="status-badge status-${this.reportData.learner.status || 'needs_attention'}">
                                        ${this.formatStatus(this.reportData.learner.status)}
                                    </span>
                                    ${this.reportData.learner.statusReason ? `
                                        <span class="status-reason-text" style="display: block; font-size: 12px; color: #6b7280; margin-top: 4px;">
                                            ${this.escapeHtml(this.reportData.learner.statusReason)}
                                        </span>
                                    ` : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="statistics-cards">
                    ${this.renderOverviewStatistics()}
                </div>

                <div class="course-report-tabs">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="courses">Course Performance</button>
                        <button class="tab-button" data-tab="labs">Lab Evaluation</button>
                        <button class="tab-button" data-tab="timeline">Activity Timeline</button>
                    </div>

                    <div class="tab-content">
                        <div id="tab-courses" class="tab-pane active">
                            ${this.renderCoursePerformance()}
                        </div>
                        <div id="tab-labs" class="tab-pane">
                            ${this.renderLabEvaluation()}
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

    renderOverviewStatistics() {
        const { overview } = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Courses</div>
                <div class="stat-value">${overview.totalCourses || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Overall Progress</div>
                <div class="stat-value">${(overview.overallProgress || 0).toFixed(1)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Courses Completed</div>
                <div class="stat-value">${overview.coursesCompleted || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Labs Submitted</div>
                <div class="stat-value">${overview.labsSubmitted || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lab Score</div>
                <div class="stat-value">${overview.averageLabScore ? overview.averageLabScore.toFixed(1) : 'N/A'}</div>
            </div>
        `;
    }

    renderCoursePerformance() {
        if (!this.reportData.coursePerformance || this.reportData.coursePerformance.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📚</div>
                    <div class="report-empty-title">No Courses Assigned</div>
                    <div class="report-empty-message">This learner doesn't have any courses assigned yet.</div>
                </div>
            `;
        }

        const reportCharts = new ReportCharts();

        return `
            <div class="courses-list">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Progress</th>
                            <th>Status</th>
                            <th>Time Spent</th>
                            <th>Labs</th>
                            <th>Avg Score</th>
                            <th>Last Activity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.coursePerformance.map(course => {
                            // Ensure progress is formatted with one decimal place
                            const progress = parseFloat((course.progress || 0).toFixed(1));
                            return `
                            <tr>
                                <td><strong>${this.escapeHtml(course.name || 'Unknown Course')}</strong></td>
                                <td>${reportCharts.renderProgressBar(progress, '', 'sm')}</td>
                                <td>
                                    <span class="status-badge status-${course.status || 'not_started'}">
                                        ${this.formatStatus(course.status)}
                                    </span>
                                </td>
                                <td>${this.formatTime(course.timeSpent || 0)}</td>
                                <td>${course.labsSubmitted || 0}/${course.totalLabs || 0}</td>
                                <td>${course.averageScore ? course.averageScore.toFixed(1) : 'N/A'}</td>
                                <td>${this.formatDate(course.lastActivityDate)}</td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderLabEvaluation() {
        const { labEvaluation } = this.reportData;
        
        if (!labEvaluation || Object.keys(labEvaluation).length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📝</div>
                    <div class="report-empty-title">No Lab Data</div>
                    <div class="report-empty-message">No lab evaluation data available for this learner.</div>
                </div>
            `;
        }

        return `
            <div class="lab-evaluation-summary">
                <div class="evaluation-stats">
                    <div class="eval-stat-card">
                        <div class="eval-stat-label">Total Labs Submitted</div>
                        <div class="eval-stat-value">${labEvaluation.totalLabsSubmitted || 0}</div>
                    </div>
                    <div class="eval-stat-card">
                        <div class="eval-stat-label">Pending Review</div>
                        <div class="eval-stat-value">${labEvaluation.labsPendingReview || 0}</div>
                    </div>
                    <div class="eval-stat-card">
                        <div class="eval-stat-label">Approved</div>
                        <div class="eval-stat-value">${labEvaluation.labsApproved || 0}</div>
                    </div>
                    <div class="eval-stat-card">
                        <div class="eval-stat-label">Needs Revision</div>
                        <div class="eval-stat-value">${labEvaluation.labsNeedingRevision || 0}</div>
                    </div>
                    <div class="eval-stat-card">
                        <div class="eval-stat-label">Average Score</div>
                        <div class="eval-stat-value">${labEvaluation.averageScore ? labEvaluation.averageScore.toFixed(1) : 'N/A'}</div>
                    </div>
                    ${labEvaluation.avgResponseTime ? `
                        <div class="eval-stat-card">
                            <div class="eval-stat-label">Avg Response Time</div>
                            <div class="eval-stat-value">${this.formatResponseTime(labEvaluation.avgResponseTime)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderTimeline() {
        if (!this.reportData.activityTimeline || this.reportData.activityTimeline.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📅</div>
                    <div class="report-empty-title">No Activity</div>
                    <div class="report-empty-message">No activity recorded for this learner yet.</div>
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

    formatLearnerType(type) {
        const typeMap = {
            'active': 'Active Learner',
            'inactive': 'Inactive Learner',
            'graduate': 'Graduate Learner',
            'archive': 'Archive Learner'
        };
        return typeMap[type] || type;
    }

    formatStatus(status) {
        const statusMap = {
            'not_started': 'Not Started',
            'in_progress': 'In Progress',
            'completed': 'Completed',
            'on_track': 'On Track',
            'needs_attention': 'Needs Attention',
            'at_risk': 'At Risk'
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

    formatResponseTime(hours) {
        if (!hours) return 'N/A';
        if (hours < 1) {
            return `${Math.round(hours * 60)} min`;
        }
        if (hours < 24) {
            return `${hours.toFixed(1)} hours`;
        }
        return `${(hours / 24).toFixed(1)} days`;
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
                <a href="#/reports/trainer" class="btn btn-primary" style="margin-top: 16px;">
                    Back to Dashboard
                </a>
            </div>
        `;
    }
}

export default IndividualLearnerReport;

