/**
 * Individual Learner Report Component (Admin View)
 * 
 * Displays detailed performance report for a specific learner.
 * Shows learner profile, course performance, lab evaluation summary, and activity timeline.
 * 
 * Version: 1.0.1 - Fixed syntax error in getDaysSinceRegistration
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import { adminService } from '../../../services/admin-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class AdminIndividualLearnerReport {
    constructor(container, learnerId) {
        this.container = container;
        this.learnerId = learnerId;
        this.currentUser = null;
        this.reportData = null;
        this.learner = null;
        this.dateRange = null;
        this.activeTab = 'overview';
    }

    async init() {
        try {
            console.log('[AdminIndividualLearnerReport] Initializing for learnerId:', this.learnerId);
            
            if (this.container) {
                this.container.style.display = 'block';
            }

            await this.renderHeader();

            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || this.currentUser.role !== 'admin') {
                throw new Error('Access denied: Admin role required');
            }

            // Load learner details
            const allUsers = await adminService.getAllUsers();
            this.learner = allUsers.find(u => u.id === this.learnerId);
            if (!this.learner) {
                throw new Error('Learner not found');
            }

            await this.loadData();
            this.render();
        } catch (error) {
            console.error('[AdminIndividualLearnerReport] Error initializing:', error);
            this.showError(error.message || 'Failed to load learner report.');
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
            
            // Get learner overview - this already includes all the data we need
            const overview = await reportService.getLearnerOverview(this.learnerId, this.dateRange);
            
            // Calculate status based on overview data
            // We'll determine status from the overview data itself
            let status = 'needs_attention';
            let statusReason = 'Engaged and performing well';
            
            // Check if learner has low lab scores
            if (overview.averageLabScore !== undefined && overview.averageLabScore !== null && overview.labsSubmitted > 0) {
                if (overview.averageLabScore < 50) {
                    status = 'at_risk';
                    statusReason = `Low lab score: ${overview.averageLabScore.toFixed(1)}%`;
                } else if (overview.averageLabScore < 70) {
                    status = 'needs_attention';
                    statusReason = `Lab scores need attention: ${overview.averageLabScore.toFixed(1)}%`;
                } else {
                    status = 'on_track';
                    statusReason = 'Engaged and performing well';
                }
            } else if (overview.overallProgress > 0) {
                status = 'on_track';
                statusReason = 'Making progress';
            }
            
            // Add status to overview
            overview.status = status;
            overview.statusReason = statusReason;
            overview.averageProgress = overview.overallProgress || 0;
            
            // Get course performance - we'll get it from the overview's course breakdown
            // The overview already includes course breakdown data
            const coursePerformance = overview.courseBreakdown || [];
            
            this.reportData = {
                overview,
                coursePerformance
            };
        } catch (error) {
            console.error('[AdminIndividualLearnerReport] Error loading data:', error);
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
        const { overview } = this.reportData;
        const statusConfig = this.getStatusConfig(overview.status);

        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <a href="#/reports/admin/learners" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to Learner List
                        </a>
                        <h1>Learner Performance Report</h1>
                        <p class="report-subtitle">${this.escapeHtml(this.learner.full_name || this.learner.name || this.learner.email || 'Unknown Learner')}</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'learner_report')}
                    </div>
                </div>

                <!-- Tabs -->
                <div class="report-tabs">
                    <button class="tab-button ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
                        Overview
                    </button>
                    <button class="tab-button ${this.activeTab === 'courses' ? 'active' : ''}" data-tab="courses">
                        Courses
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="tab-content">
                    <div id="tab-overview" class="tab-panel" style="display: ${this.activeTab === 'overview' ? 'block' : 'none'};">
                        ${this.renderOverviewTab()}
                    </div>
                    <div id="tab-courses" class="tab-panel" style="display: ${this.activeTab === 'courses' ? 'block' : 'none'};">
                        ${this.renderCoursesTab()}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        exportOptions.attachEventListeners(this.container);
    }

    renderOverviewTab() {
        const { overview } = this.reportData;
        const statusConfig = this.getStatusConfig(overview.status);
        const reportCharts = new ReportCharts();

        return `
            <div class="profile-card">
                <h2>Learner Profile</h2>
                <div class="profile-item">
                    <span class="profile-label">Email:</span>
                    <span class="profile-value">${this.escapeHtml(this.learner.email)}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Learner Type:</span>
                    <span class="profile-value">${this.escapeHtml(this.learner.learner_type || 'Active')} Learner</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Days Since Registration:</span>
                    <span class="profile-value">${this.getDaysSinceRegistration()}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Status:</span>
                    <span class="profile-value">
                        <span class="status-badge status-${overview.status || 'needs_attention'}">
                            ${statusConfig.label}
                        </span>
                        ${overview.statusReason ? `
                            <span class="status-reason">${this.escapeHtml(overview.statusReason)}</span>
                        ` : ''}
                    </span>
                </div>
            </div>

            <div class="overview-section">
                <h2>Summary Statistics</h2>
                <div class="statistics-cards">
                    <div class="stat-card">
                        <div class="stat-label">Total Courses</div>
                        <div class="stat-value">${overview.totalCourses || 0}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Average Progress</div>
                        <div class="stat-value">${(overview.averageProgress || 0).toFixed(1)}%</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Labs Submitted</div>
                        <div class="stat-value">${overview.labsSubmitted || 0}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Average Lab Score</div>
                        <div class="stat-value">${overview.averageLabScore ? overview.averageLabScore.toFixed(1) + '%' : 'N/A'}</div>
                    </div>
                </div>
            </div>

            <div class="overview-section">
                <h2>Progress Summary</h2>
                <div class="progress-summary">
                    <div class="progress-item">
                        <div class="progress-label">Overall Progress</div>
                        ${reportCharts.renderProgressBar(overview.averageProgress || 0, '', 'md')}
                    </div>
                </div>
            </div>
        `;
    }

    renderCoursesTab() {
        const { coursePerformance } = this.reportData;
        const reportCharts = new ReportCharts();

        if (!coursePerformance || coursePerformance.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">📚</div>
                    <div class="report-empty-title">No Courses</div>
                    <div class="report-empty-message">This learner is not enrolled in any courses.</div>
                </div>
            `;
        }

        return `
            <div class="course-performance-section">
                <h2>Course Performance</h2>
                <div class="table-container">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Progress</th>
                                <th>Chapters Completed</th>
                                <th>Labs Submitted</th>
                                <th>Avg Lab Score</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${coursePerformance.map(course => `
                                <tr>
                                    <td><strong>${this.escapeHtml(course.name || course.id || 'Unknown')}</strong></td>
                                    <td>${reportCharts.renderProgressBar(course.progress || 0, '', 'sm')}</td>
                                    <td>${course.chaptersCompleted !== undefined ? course.chaptersCompleted : 'N/A'}</td>
                                    <td>${course.labsSubmitted || 0}</td>
                                    <td>${course.averageScore ? course.averageScore.toFixed(1) + '%' : 'N/A'}</td>
                                    <td>
                                        <a href="#/reports/admin/learner/${this.learnerId}/course/${course.id}" 
                                           class="btn btn-sm btn-primary">
                                            View Details
                                        </a>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    getStatusConfig(status) {
        const configs = {
            'on_track': {
                label: 'On Track',
                class: 'status-on-track'
            },
            'needs_attention': {
                label: 'Needs Attention',
                class: 'status-needs-attention'
            },
            'at_risk': {
                label: 'At Risk',
                class: 'status-at-risk'
            }
        };
        return configs[status] || configs['needs_attention'];
    }

    getDaysSinceRegistration() {
        if (!this.learner.created_at) return 'N/A';
        const created = new Date(this.learner.created_at);
        const now = new Date();
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        return days;
    }

    attachEventListeners() {
        const tabs = this.container.querySelectorAll('.tab-button');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.getAttribute('data-tab');
                this.render();
            });
        });
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
                <a href="#/reports/admin/learners" class="btn btn-primary" style="margin-top: 16px;">
                    Back to Learner List
                </a>
            </div>
        `;
    }
}

export default AdminIndividualLearnerReport;

