/**
 * Course Performance Report Component (Admin View)
 * 
 * Displays comprehensive performance analytics for a specific course.
 * Shows enrollment, completion rates, learner performance, and trends.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import { courseService } from '../../../services/course-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class AdminCoursePerformanceReport {
    constructor(container, courseId) {
        this.container = container;
        this.courseId = courseId;
        this.currentUser = null;
        this.reportData = null;
        this.course = null;
    }

    async init() {
        try {
            console.log('[AdminCoursePerformanceReport] Initializing for courseId:', this.courseId);
            
            if (this.container) {
                this.container.style.display = 'block';
            }

            await this.renderHeader();

            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || this.currentUser.role !== 'admin') {
                throw new Error('Access denied: Admin role required');
            }

            this.course = await courseService.getCourseById(this.courseId);
            if (!this.course) {
                throw new Error('Course not found');
            }

            await this.loadData();
            this.render();
        } catch (error) {
            console.error('[AdminCoursePerformanceReport] Error initializing:', error);
            this.showError(error.message || 'Failed to load course report.');
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
            
            this.reportData = await reportService.getAdminCoursePerformanceReport(this.courseId);
        } catch (error) {
            console.error('[AdminCoursePerformanceReport] Error loading data:', error);
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
                        <a href="#/reports/admin" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to Dashboard
                        </a>
                        <h1>${this.escapeHtml(this.reportData.course.name)}</h1>
                        <p class="report-subtitle">Course Performance Analytics</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'admin_course_performance')}
                    </div>
                </div>

                <div class="statistics-cards">
                    ${this.renderCourseStatistics()}
                </div>

                <div class="course-report-tabs">
                    <div class="tab-buttons">
                        <button class="tab-button active" data-tab="overview">Overview</button>
                        <button class="tab-button" data-tab="learners">Learner Performance</button>
                        <button class="tab-button" data-tab="chapters">Chapter Analysis</button>
                        <button class="tab-button" data-tab="labs">Lab Analysis</button>
                    </div>

                    <div class="tab-content">
                        <div id="tab-overview" class="tab-pane active">
                            ${this.renderOverview()}
                        </div>
                        <div id="tab-learners" class="tab-pane">
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

        this.attachEventListeners();
        exportOptions.attachEventListeners(this.container);
    }

    renderCourseStatistics() {
        const { overview } = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Enrollments</div>
                <div class="stat-value">${overview.totalEnrollments || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Learners</div>
                <div class="stat-value">${overview.activeLearners || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Completion Rate</div>
                <div class="stat-value">${(overview.completionRate || 0).toFixed(1)}%</div>
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

    renderOverview() {
        const { overview } = this.reportData;
        const reportCharts = new ReportCharts();

        return `
            <div class="overview-section">
                <div class="overview-card">
                    <h3>Enrollment Trends</h3>
                    <p>Total enrollments: <strong>${overview.totalEnrollments || 0}</strong></p>
                    <p>Active learners: <strong>${overview.activeLearners || 0}</strong></p>
                </div>
                <div class="overview-card">
                    <h3>Completion Metrics</h3>
                    <p>Completion rate: <strong>${(overview.completionRate || 0).toFixed(1)}%</strong></p>
                    <p>Average progress: ${reportCharts.renderProgressBar(overview.averageProgress || 0, '', 'md')}</p>
                </div>
            </div>
        `;
    }

    renderLearnerPerformance() {
        if (!this.reportData.learners || this.reportData.learners.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">👥</div>
                    <div class="report-empty-title">No Learners</div>
                    <div class="report-empty-message">No learners are enrolled in this course.</div>
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
                            <th>Status</th>
                            <th>Time Spent</th>
                            <th>Labs</th>
                            <th>Avg Score</th>
                            <th>Enrolled</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.learners.map(learner => `
                            <tr>
                                <td><strong>${this.escapeHtml(learner.name || 'Unknown')}</strong></td>
                                <td>${reportCharts.renderProgressBar(learner.progress || 0, '', 'sm')}</td>
                                <td>
                                    <span class="status-badge status-${learner.status || 'not_started'}">
                                        ${this.formatStatus(learner.status)}
                                    </span>
                                </td>
                                <td>${this.formatTime(learner.timeSpent || 0)}</td>
                                <td>${learner.labsSubmitted || 0}</td>
                                <td>${learner.averageScore ? learner.averageScore.toFixed(1) : 'N/A'}</td>
                                <td>${this.formatDate(learner.enrolledAt)}</td>
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
                            <th>Resubmission Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.labAnalysis.map(lab => `
                            <tr>
                                <td><strong>${this.escapeHtml(lab.name || 'Unknown Lab')}</strong></td>
                                <td>${(lab.submissionRate || 0).toFixed(1)}%</td>
                                <td>${lab.averageScore ? lab.averageScore.toFixed(1) : 'N/A'}</td>
                                <td>${(lab.resubmissionRate || 0).toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    attachEventListeners() {
        const tabButtons = this.container.querySelectorAll('.tab-button');
        const tabPanes = this.container.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');

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
            'not_started': 'Not Started',
            'in_progress': 'In Progress',
            'completed': 'Completed'
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
                <a href="#/reports/admin" class="btn btn-primary" style="margin-top: 16px;">
                    Back to Dashboard
                </a>
            </div>
        `;
    }
}

export default AdminCoursePerformanceReport;

