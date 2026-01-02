/**
 * Learner Dashboard Component
 * 
 * Displays learner's overall performance across all assigned courses.
 * Shows statistics, progress trends, and course breakdown.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class LearnerDashboard {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.reportData = null;
    }

    async init() {
        try {
            console.log('[LearnerDashboard] Initializing...');
            
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
            }

            // Initialize header
            console.log('[LearnerDashboard] Rendering header...');
            await this.renderHeader();

            // Get current user
            console.log('[LearnerDashboard] Getting current user...');
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }
            console.log('[LearnerDashboard] Current user:', this.currentUser.id);

            // Load report data
            console.log('[LearnerDashboard] Loading report data...');
            await this.loadData();
            console.log('[LearnerDashboard] Report data loaded:', this.reportData);

            // Render dashboard
            console.log('[LearnerDashboard] Rendering dashboard...');
            this.render();
            console.log('[LearnerDashboard] Dashboard rendered successfully');
        } catch (error) {
            console.error('[LearnerDashboard] Error initializing:', error);
            console.error('[LearnerDashboard] Error stack:', error.stack);
            this.showError(error.message || 'Failed to load dashboard. Please try again.');
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

            console.log('[LearnerDashboard] Calling reportService.getLearnerOverview with:', {
                userId: this.currentUser.id
            });

            this.reportData = await reportService.getLearnerOverview(
                this.currentUser.id,
                null // No date range filtering
            );

            console.log('[LearnerDashboard] Report data received:', this.reportData);
        } catch (error) {
            console.error('[LearnerDashboard] Error loading data:', error);
            console.error('[LearnerDashboard] Error stack:', error.stack);
            throw error;
        }
    }

    render() {
        if (!this.reportData) {
            this.container.innerHTML = '<div class="report-loading">Loading...</div>';
            return;
        }

        const exportOptions = new ExportOptions();

        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <h1>My Performance Report</h1>
                        <p class="report-subtitle">Track your learning progress and achievements</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'learner_overview')}
                    </div>
                </div>

                <div class="statistics-cards">
                    ${this.renderStatisticsCards()}
                </div>

                <div class="charts-section">
                    <div class="chart-container">
                        <h2 class="chart-title">Progress Overview</h2>
                        <div id="progress-chart-container">
                            ${this.renderProgressSummary()}
                        </div>
                    </div>
                </div>

                <div class="course-breakdown-section">
                    <h2>Course Breakdown</h2>
                    ${this.renderCourseBreakdown()}
                </div>
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();
        
        // Initialize export options
        exportOptions.attachEventListeners(this.container);
    }

    renderStatisticsCards() {
        const { reportData } = this;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Courses</div>
                <div class="stat-value">${reportData.totalCourses || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">In Progress</div>
                <div class="stat-value">${reportData.coursesInProgress || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Completed</div>
                <div class="stat-value">${reportData.coursesCompleted || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Overall Progress</div>
                <div class="stat-value">${(reportData.overallProgress || 0).toFixed(1)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Labs Submitted</div>
                <div class="stat-value">${reportData.labsSubmitted || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lab Score</div>
                <div class="stat-value">${reportData.averageLabScore ? reportData.averageLabScore.toFixed(1) : 'N/A'}</div>
            </div>
        `;
    }

    renderProgressSummary() {
        // Simple progress visualization - can be enhanced with Chart.js later
        const progress = this.reportData.overallProgress || 0;
        const reportCharts = new ReportCharts();
        
        return `
            <div class="progress-summary">
                ${reportCharts.renderProgressBar(progress, 'Overall Progress', 'lg')}
                <div class="progress-info-note" style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 0.875rem; color: #1e40af;">
                    <strong>Note:</strong> Progress is calculated based on Chapters (25% weight) and Labs (75% weight).
                </div>
                <div class="progress-details" style="margin-top: 24px;">
                    <div class="progress-detail-item">
                        <span class="detail-label">Chapters Completed:</span>
                        <span class="detail-value">${this.reportData.chaptersCompleted || 0}</span>
                    </div>
                    <div class="progress-detail-item">
                        <span class="detail-label">Labs Submitted:</span>
                        <span class="detail-value">${this.reportData.labsSubmitted || 0}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderCourseBreakdown() {
        if (!this.reportData.courseBreakdown || this.reportData.courseBreakdown.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📚</div>
                    <div class="report-empty-title">No Courses Assigned</div>
                    <div class="report-empty-message">You don't have any courses assigned yet.</div>
                </div>
            `;
        }

        const reportCharts = new ReportCharts();

        return `
            <div class="table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Progress</th>
                            <th>Status</th>
                            <th>Last Accessed</th>
                            <th>Labs</th>
                            <th>Avg Score</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.courseBreakdown.map(course => `
                            <tr>
                                <td>
                                    <strong>${this.escapeHtml(course.name || 'Unknown Course')}</strong>
                                </td>
                                <td>
                                    ${reportCharts.renderProgressBar(course.progress || 0, '', 'sm')}
                                </td>
                                <td>
                                    <span class="status-badge status-${course.status || 'not_started'}">
                                        ${this.formatStatus(course.status)}
                                    </span>
                                </td>
                                <td>${this.formatDate(course.lastAccessed)}</td>
                                <td>${course.labsSubmitted || 0}/${course.totalLabs || 0}</td>
                                <td>${course.averageScore ? course.averageScore.toFixed(1) : 'N/A'}</td>
                                <td>
                                    <a href="#/reports/learner/course/${course.id}" 
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

    attachEventListeners() {
        // Course detail links are handled by router
        // Additional event listeners can be added here
    }

    formatStatus(status) {
        const statusMap = {
            'not_started': 'Not Started',
            'in_progress': 'In Progress',
            'completed': 'Completed'
        };
        return statusMap[status] || status;
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
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">
                    Reload Page
                </button>
            </div>
        `;
    }
}

export default LearnerDashboard;

