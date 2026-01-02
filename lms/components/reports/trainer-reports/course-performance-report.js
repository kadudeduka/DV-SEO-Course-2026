/**
 * Course Performance Report Component (Trainer View)
 * 
 * Displays how all assigned learners are performing in a specific course.
 * Shows course overview, learner performance, chapter analysis, and lab analysis.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import { courseService } from '../../../services/course-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class CoursePerformanceReport {
    constructor(container, courseId) {
        this.container = container;
        this.courseId = courseId;
        this.currentUser = null;
        this.reportData = null;
        this.course = null;
        this.filters = {};
    }

    async init() {
        try {
            console.log('[CoursePerformanceReport] Initializing for courseId:', this.courseId);
            
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
            }

            // Initialize header
            console.log('[CoursePerformanceReport] Rendering header...');
            await this.renderHeader();

            // Get current user
            console.log('[CoursePerformanceReport] Getting current user...');
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }
            if (this.currentUser.role !== 'trainer') {
                throw new Error('Access denied: Trainer role required');
            }
            console.log('[CoursePerformanceReport] Current user:', this.currentUser.id);

            // Load course data
            console.log('[CoursePerformanceReport] Loading course data...');
            this.course = await courseService.getCourseById(this.courseId);
            if (!this.course) {
                throw new Error('Course not found');
            }
            console.log('[CoursePerformanceReport] Course loaded:', this.course.title);

            // Load report data
            console.log('[CoursePerformanceReport] Loading report data...');
            await this.loadData();
            console.log('[CoursePerformanceReport] Report data loaded:', this.reportData);

            // Render report
            console.log('[CoursePerformanceReport] Rendering report...');
            this.render();
            console.log('[CoursePerformanceReport] Report rendered successfully');
        } catch (error) {
            console.error('[CoursePerformanceReport] Error initializing:', error);
            console.error('[CoursePerformanceReport] Error stack:', error.stack);
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
            
            console.log('[CoursePerformanceReport] Calling reportService.getCoursePerformanceReport with:', {
                trainerId: this.currentUser.id,
                courseId: this.courseId,
                filters: this.filters
            });

            this.reportData = await reportService.getCoursePerformanceReport(
                this.currentUser.id,
                this.courseId,
                this.filters
            );

            console.log('[CoursePerformanceReport] Report data received:', this.reportData);
        } catch (error) {
            console.error('[CoursePerformanceReport] Error loading data:', error);
            console.error('[CoursePerformanceReport] Error stack:', error.stack);
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
                        <a href="#/reports/trainer" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to Dashboard
                        </a>
                        <h1>${this.escapeHtml(this.reportData.course.name)}</h1>
                        <p class="report-subtitle">Course Performance Report</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'course_performance')}
                    </div>
                </div>

                <div class="statistics-cards">
                    ${this.renderCourseStatistics()}
                </div>

                <div class="course-report-tabs">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="learners">Learner Performance</button>
                        <button class="tab-button" data-tab="chapters">Chapter Analysis</button>
                        <button class="tab-button" data-tab="labs">Lab Analysis</button>
                    </div>

                    <div class="tab-content">
                        <div id="tab-learners" class="tab-pane active">
                            ${this.renderLearnerPerformance()}
                        </div>
                        <div id="tab-chapters" class="tab-pane">
                            ${this.renderChapterAnalysis()}
                        </div>
                        <div id="tab-labs" class="tab-pane">
                            ${this.renderLabAnalysis()}
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
        const { overview } = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Learners</div>
                <div class="stat-value">${overview.totalLearners || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Progress</div>
                <div class="stat-value">${(overview.averageProgress || 0).toFixed(1)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Completion Time</div>
                <div class="stat-value">${overview.averageCompletionTime ? overview.averageCompletionTime.toFixed(1) + ' days' : 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Lab Score</div>
                <div class="stat-value">${overview.averageLabScore ? overview.averageLabScore.toFixed(1) : 'N/A'}</div>
            </div>
        `;
    }

    renderLearnerPerformance() {
        if (!this.reportData.learners || this.reportData.learners.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">👥</div>
                    <div class="report-empty-title">No Learners</div>
                    <div class="report-empty-message">No learners are assigned to this course.</div>
                </div>
            `;
        }

        const reportCharts = new ReportCharts();

        return `
            <div class="table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Learner Name</th>
                            <th>Progress</th>
                            <th>Chapters Completed</th>
                            <th>Labs Submitted</th>
                            <th>Lab Scores</th>
                            <th>Time Spent</th>
                            <th>Last Accessed</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.learners.map(learner => `
                            <tr>
                                <td>
                                    <strong>${this.escapeHtml(learner.name || 'Unknown')}</strong>
                                </td>
                                <td>
                                    ${reportCharts.renderProgressBar(learner.progress || 0, '', 'sm')}
                                </td>
                                <td>${learner.chaptersCompleted || 0}</td>
                                <td>${learner.labsSubmitted || 0}</td>
                                <td>${learner.labScores ? learner.labScores.join(', ') : 'N/A'}</td>
                                <td>${this.formatTime(learner.timeSpent || 0)}</td>
                                <td>${this.formatDate(learner.lastAccessed)}</td>
                                <td>
                                    <span class="status-badge status-${learner.status || 'needs_attention'}">
                                        ${this.formatStatus(learner.status)}
                                    </span>
                                </td>
                                <td>
                                    <a href="#/reports/trainer/learner/${learner.id}" 
                                       class="btn btn-sm btn-primary">
                                        View Details
                                    </a>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderChapterAnalysis() {
        if (!this.reportData.chapterAnalysis || this.reportData.chapterAnalysis.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📖</div>
                    <div class="report-empty-title">No Chapter Data</div>
                    <div class="report-empty-message">Chapter analysis data is not available.</div>
                </div>
            `;
        }

        return `
            <div class="chapter-analysis-list">
                ${this.reportData.chapterAnalysis.map(chapter => `
                    <div class="chapter-analysis-item">
                        <div class="chapter-analysis-header">
                            <h4>${this.escapeHtml(chapter.name || 'Unknown Chapter')}</h4>
                            <span class="completion-rate">${(chapter.completionRate || 0).toFixed(1)}% completed</span>
                        </div>
                        <div class="chapter-analysis-details">
                            <div class="analysis-detail">
                                <span class="detail-label">Average Time to Complete:</span>
                                <span class="detail-value">${this.formatTime(chapter.averageTimeToComplete || 0)}</span>
                            </div>
                            ${chapter.commonIssues ? `
                                <div class="analysis-detail">
                                    <span class="detail-label">Common Issues:</span>
                                    <span class="detail-value">${this.escapeHtml(chapter.commonIssues)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderLabAnalysis() {
        if (!this.reportData.labAnalysis || this.reportData.labAnalysis.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📝</div>
                    <div class="report-empty-title">No Lab Data</div>
                    <div class="report-empty-message">Lab analysis data is not available.</div>
                </div>
            `;
        }

        return `
            <div class="lab-analysis-list">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Lab Name</th>
                            <th>Submission Rate</th>
                            <th>Average Score</th>
                            <th>Common Mistakes</th>
                            <th>Resubmission Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.labAnalysis.map(lab => `
                            <tr>
                                <td><strong>${this.escapeHtml(lab.name || 'Unknown Lab')}</strong></td>
                                <td>${(lab.submissionRate || 0).toFixed(1)}%</td>
                                <td>${lab.averageScore ? lab.averageScore.toFixed(1) : 'N/A'}</td>
                                <td>${lab.commonMistakes ? this.escapeHtml(lab.commonMistakes) : 'N/A'}</td>
                                <td>${(lab.resubmissionRate || 0).toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
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

    formatStatus(status) {
        const statusMap = {
            'on_track': 'On Track',
            'behind': 'Behind',
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

export default CoursePerformanceReport;

