/**
 * Trainer Dashboard Component
 * 
 * Displays overview of all assigned learners' performance.
 * Shows summary statistics, learner performance table, and filters.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import { tagService } from '../../../services/tag-service.js';
import ReportFilters from '../shared/report-filters.js';
import ReportTable from '../shared/report-table.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class TrainerDashboard {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.reportData = null;
        this.tags = [];
        this.filters = {
            dateRange: { from: null, to: null },
            period: '30d',
            search: '',
            tags: [],
            learnerType: 'all',
            status: 'all'
        };
    }

    async init() {
        try {
            console.log('[TrainerDashboard] Initializing...');
            
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
            }

            // Initialize header
            console.log('[TrainerDashboard] Rendering header...');
            await this.renderHeader();

            // Get current user
            console.log('[TrainerDashboard] Getting current user...');
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }
            if (this.currentUser.role !== 'trainer') {
                throw new Error('Access denied: Trainer role required');
            }
            console.log('[TrainerDashboard] Current user:', this.currentUser.id);

            // Load tags (for filtering)
            console.log('[TrainerDashboard] Loading tags...');
            await this.loadTags();

            // Load report data
            console.log('[TrainerDashboard] Loading report data...');
            await this.loadData();
            console.log('[TrainerDashboard] Report data loaded:', this.reportData);

            // Render dashboard
            console.log('[TrainerDashboard] Rendering dashboard...');
            this.render();
            console.log('[TrainerDashboard] Dashboard rendered successfully');
        } catch (error) {
            console.error('[TrainerDashboard] Error initializing:', error);
            console.error('[TrainerDashboard] Error stack:', error.stack);
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

    async loadTags() {
        try {
            this.tags = await tagService.getAllTags();
        } catch (error) {
            console.warn('[TrainerDashboard] Error loading tags:', error);
            this.tags = [];
        }
    }

    async loadData() {
        try {
            this.container.innerHTML = '<div class="report-loading">Loading...</div>';
            
            // Convert period to date range if needed
            if (this.filters.period && !this.filters.dateRange.from) {
                this.filters.dateRange = this.getDateRangeFromPeriod(this.filters.period);
            }

            console.log('[TrainerDashboard] Calling reportService.getTrainerLearnerOverview with:', {
                trainerId: this.currentUser.id,
                filters: this.filters
            });

            this.reportData = await reportService.getTrainerLearnerOverview(
                this.currentUser.id,
                this.filters
            );

            console.log('[TrainerDashboard] Report data received:', this.reportData);
        } catch (error) {
            console.error('[TrainerDashboard] Error loading data:', error);
            console.error('[TrainerDashboard] Error stack:', error.stack);
            throw error;
        }
    }

    getDateRangeFromPeriod(period) {
        const now = new Date();
        const from = new Date();

        switch (period) {
            case '7d':
                from.setDate(now.getDate() - 7);
                break;
            case '30d':
                from.setDate(now.getDate() - 30);
                break;
            case '90d':
                from.setDate(now.getDate() - 90);
                break;
            case '6m':
                from.setMonth(now.getMonth() - 6);
                break;
            case '1y':
                from.setFullYear(now.getFullYear() - 1);
                break;
            default:
                from.setDate(now.getDate() - 30);
        }

        return {
            from: from.toISOString().split('T')[0],
            to: now.toISOString().split('T')[0]
        };
    }

    render() {
        if (!this.reportData) {
            this.container.innerHTML = '<div class="report-loading">Loading...</div>';
            return;
        }

        const exportOptions = new ExportOptions();
        const reportFilters = new ReportFilters({
            dateRange: true,
            period: true,
            search: true,
            tags: true,
            learnerType: true,
            status: true
        });

        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <h1>Learner Performance Overview</h1>
                        <p class="report-subtitle">Track and monitor your assigned learners' progress</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'trainer_learner_overview')}
                    </div>
                </div>

                <div class="statistics-cards">
                    ${this.renderSummaryStatistics()}
                </div>

                <div class="report-filters-section">
                    ${reportFilters.render(this.filters, (filters) => this.applyFilters(filters))}
                </div>

                <div class="learner-performance-section">
                    <h2>Learner Performance</h2>
                    ${this.renderLearnerTable()}
                </div>
            </div>
        `;

        // Attach event listeners
        this.attachEventListeners();
        
        // Initialize export options
        exportOptions.attachEventListeners(this.container);
        
        // Initialize filters
        const filtersContainer = this.container.querySelector('.report-filters');
        if (filtersContainer) {
            reportFilters.attachEventListeners(filtersContainer);
            this.populateTagSelector(filtersContainer);
        }
    }

    renderSummaryStatistics() {
        const { summary } = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Learners</div>
                <div class="stat-value">${summary.totalLearners || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Learners</div>
                <div class="stat-value">${summary.activeLearners || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">At Risk</div>
                <div class="stat-value">${summary.atRiskLearners || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Completion Rate</div>
                <div class="stat-value">${(summary.averageCompletionRate || 0).toFixed(1)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Courses</div>
                <div class="stat-value">${summary.totalCoursesAllocated || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Labs Pending Review</div>
                <div class="stat-value">${summary.totalLabsPending || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lab Score</div>
                <div class="stat-value">${summary.averageLabScore ? summary.averageLabScore.toFixed(1) : 'N/A'}</div>
            </div>
        `;
    }

    renderLearnerTable() {
        if (!this.reportData.learners || this.reportData.learners.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">👥</div>
                    <div class="report-empty-title">No Learners Found</div>
                    <div class="report-empty-message">No learners match your current filters. Try adjusting your search criteria.</div>
                </div>
            `;
        }

        const reportCharts = new ReportCharts();

        return `
            <div class="table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Courses</th>
                            <th>Progress</th>
                            <th>Status</th>
                            <th>Labs</th>
                            <th>Avg Score</th>
                            <th>Last Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.learners.map(learner => `
                            <tr>
                                <td>
                                    <strong>${this.escapeHtml(learner.full_name || learner.email || 'Unknown')}</strong>
                                </td>
                                <td>${this.escapeHtml(learner.email || 'N/A')}</td>
                                <td>${learner.totalCourses || 0}</td>
                                <td>
                                    ${reportCharts.renderProgressBar(learner.overallProgress || 0, '', 'sm')}
                                </td>
                                <td>
                                    <span class="status-badge status-${learner.status || 'needs_attention'}" 
                                          ${learner.statusReason ? `title="${this.escapeHtml(learner.statusReason)}"` : ''}>
                                        ${this.formatStatus(learner.status)}
                                    </span>
                                    ${learner.status === 'at_risk' && learner.statusReason ? `
                                        <div class="status-reason" style="font-size: 11px; color: #dc2626; margin-top: 4px;">
                                            ${this.escapeHtml(learner.statusReason)}
                                        </div>
                                    ` : ''}
                                </td>
                                <td>${learner.labsSubmitted || 0}</td>
                                <td>${learner.averageLabScore ? learner.averageLabScore.toFixed(1) : 'N/A'}</td>
                                <td>${this.formatDate(learner.lastActivityDate)}</td>
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

    populateTagSelector(container) {
        const tagSelect = container.querySelector('#filter-tags');
        if (tagSelect && this.tags.length > 0) {
            tagSelect.innerHTML = this.tags.map(tag => `
                <option value="${tag.id}">${this.escapeHtml(tag.name)}</option>
            `).join('');
        }
    }

    async applyFilters(filters) {
        this.filters = { ...this.filters, ...filters };
        
        if (filters.period) {
            this.filters.dateRange = this.getDateRangeFromPeriod(filters.period);
        } else if (filters.dateRange) {
            this.filters.dateRange = filters.dateRange;
        }

        await this.loadData();
        this.render();
    }

    attachEventListeners() {
        // Event listeners are handled by ReportFilters component
    }

    formatStatus(status) {
        const statusMap = {
            'on_track': 'On Track',
            'needs_attention': 'Needs Attention',
            'at_risk': 'At Risk'
        };
        return statusMap[status] || status;
    }

    formatDate(date) {
        if (!date) return 'N/A';
        try {
            const dateObj = new Date(date);
            const daysAgo = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo === 0) return 'Today';
            if (daysAgo === 1) return 'Yesterday';
            if (daysAgo < 7) return `${daysAgo} days ago`;
            return dateObj.toLocaleDateString();
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

export default TrainerDashboard;

