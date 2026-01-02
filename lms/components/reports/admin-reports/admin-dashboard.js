/**
 * Admin Dashboard Component
 * 
 * Displays system-wide statistics and trends.
 * Shows key metrics, trends, and quick insights.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class AdminDashboard {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.reportData = null;
        this.dateRange = null;
    }

    async init() {
        try {
            console.log('[AdminDashboard] Initializing...');
            
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
            }

            // Initialize header
            console.log('[AdminDashboard] Rendering header...');
            await this.renderHeader();

            // Get current user
            console.log('[AdminDashboard] Getting current user...');
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }
            if (this.currentUser.role !== 'admin') {
                throw new Error('Access denied: Admin role required');
            }
            console.log('[AdminDashboard] Current user:', this.currentUser.id);

            // Load report data
            console.log('[AdminDashboard] Loading report data...');
            await this.loadData();
            console.log('[AdminDashboard] Report data loaded:', this.reportData);

            // Render dashboard
            console.log('[AdminDashboard] Rendering dashboard...');
            this.render();
            console.log('[AdminDashboard] Dashboard rendered successfully');
        } catch (error) {
            console.error('[AdminDashboard] Error initializing:', error);
            console.error('[AdminDashboard] Error stack:', error.stack);
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
            
            console.log('[AdminDashboard] Calling reportService.getSystemOverview with:', {
                dateRange: this.dateRange
            });

            this.reportData = await reportService.getSystemOverview(this.dateRange);

            console.log('[AdminDashboard] Report data received:', this.reportData);
        } catch (error) {
            console.error('[AdminDashboard] Error loading data:', error);
            console.error('[AdminDashboard] Error stack:', error.stack);
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
                        <h1>System Overview</h1>
                        <p class="report-subtitle">Monitor overall platform health and performance</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'system_overview')}
                    </div>
                </div>

                <div class="system-statistics-section">
                    <div class="statistics-group">
                        <h3 class="statistics-group-title">Users</h3>
                        <div class="statistics-cards">
                            ${this.renderUserStatistics()}
                        </div>
                    </div>
                    <div class="statistics-group">
                        <h3 class="statistics-group-title">Courses</h3>
                        <div class="statistics-cards">
                            ${this.renderCourseStatistics()}
                        </div>
                    </div>
                    <div class="statistics-group">
                        <h3 class="statistics-group-title">Engagement</h3>
                        <div class="statistics-cards">
                            ${this.renderEngagementStatistics()}
                        </div>
                    </div>
                </div>

                <div class="insights-section">
                    <h2>Quick Insights</h2>
                    <div class="insights-grid">
                        ${this.renderQuickInsights()}
                    </div>
                </div>

                <div class="quick-access-section">
                    <h2>Quick Access</h2>
                    <div class="quick-access-grid">
                        <a href="#/reports/admin/courses" class="quick-access-card">
                            <div class="quick-access-icon">📚</div>
                            <div class="quick-access-title">Course Performance</div>
                            <div class="quick-access-description">View performance analytics for all courses</div>
                        </a>
                        <a href="#/reports/admin/trainers" class="quick-access-card">
                            <div class="quick-access-icon">👨‍🏫</div>
                            <div class="quick-access-title">Trainer Performance</div>
                            <div class="quick-access-description">Analyze trainer effectiveness</div>
                        </a>
                        <a href="#/reports/admin/learners" class="quick-access-card">
                            <div class="quick-access-icon">👥</div>
                            <div class="quick-access-title">Learner Performance</div>
                            <div class="quick-access-description">View performance analytics for all learners</div>
                        </a>
                        <a href="#/reports/admin/tags" class="quick-access-card">
                            <div class="quick-access-icon">🏷️</div>
                            <div class="quick-access-title">Tag Management</div>
                            <div class="quick-access-description">Create and manage user tags</div>
                        </a>
                        <a href="#/reports/admin/tag-reports" class="quick-access-card">
                            <div class="quick-access-icon">📊</div>
                            <div class="quick-access-title">Tag-Based Reports</div>
                            <div class="quick-access-description">Analyze performance by tags</div>
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();
        
        // Initialize export options
        exportOptions.attachEventListeners(this.container);
    }

    renderUserStatistics() {
        const reportData = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Users</div>
                <div class="stat-value">${reportData.totalUsers || 0}</div>
                <div class="stat-breakdown">
                    <span>Learners: ${reportData.totalLearners || 0}</span>
                    <span>Trainers: ${reportData.totalTrainers || 0}</span>
                    <span>Admins: ${reportData.totalAdmins || 0}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Users</div>
                <div class="stat-value">${reportData.activeUsers || 0}</div>
                <div class="stat-subtitle">Last 30 days</div>
            </div>
        `;
    }

    renderCourseStatistics() {
        const reportData = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Courses</div>
                <div class="stat-value">${reportData.totalCourses || 0}</div>
                <div class="stat-subtitle">Published: ${reportData.publishedCourses || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Course Allocations</div>
                <div class="stat-value">${reportData.totalAllocations || 0}</div>
            </div>
        `;
    }

    renderEngagementStatistics() {
        const reportData = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Lab Submissions</div>
                <div class="stat-value">${reportData.totalLabSubmissions || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Completion Rate</div>
                <div class="stat-value">${(reportData.averageCompletionRate || 0).toFixed(1)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lab Score</div>
                <div class="stat-value">${reportData.averageLabScore ? reportData.averageLabScore.toFixed(1) : 'N/A'}</div>
            </div>
        `;
    }

    renderQuickInsights() {
        if (!this.reportData.quickInsights || this.reportData.quickInsights.length === 0) {
            return '<div class="insight-item">No insights available</div>';
        }

        return this.reportData.quickInsights.map(insight => `
            <div class="insight-item">
                <div class="insight-icon">${insight.icon || '📌'}</div>
                <div class="insight-content">
                    <div class="insight-title">${this.escapeHtml(insight.title || 'Insight')}</div>
                    <div class="insight-description">${this.escapeHtml(insight.description || '')}</div>
                </div>
            </div>
        `).join('');
    }

    attachEventListeners() {
        // Quick access cards are handled by router
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

export default AdminDashboard;

