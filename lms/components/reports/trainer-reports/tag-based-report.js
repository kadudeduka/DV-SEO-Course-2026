/**
 * Tag-Based Report Component (Trainer View)
 * 
 * Displays performance of learners grouped by admin-created tags.
 * Trainers can filter and analyze learners by tags.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import { tagService } from '../../../services/tag-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class TagBasedReport {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.reportData = null;
        this.tags = [];
        this.selectedTags = [];
    }

    async init() {
        try {
            console.log('[TagBasedReport] Initializing...');
            
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
            }

            // Initialize header
            await this.renderHeader();

            // Get current user
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || this.currentUser.role !== 'trainer') {
                throw new Error('Access denied: Trainer role required');
            }

            // Load tags
            await this.loadTags();

            // Render component
            this.render();
        } catch (error) {
            console.error('[TagBasedReport] Error initializing:', error);
            this.showError(error.message || 'Failed to load tag-based report.');
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
            console.warn('[TagBasedReport] Error loading tags:', error);
            this.tags = [];
        }
    }

    render() {
        const exportOptions = new ExportOptions();

        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <a href="#/reports/trainer" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to Dashboard
                        </a>
                        <h1>Tag-Based Performance Report</h1>
                        <p class="report-subtitle">Analyze learner performance by tags</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'tag_based_report')}
                    </div>
                </div>

                <div class="tag-selector-section">
                    <div class="tag-selector-card">
                        <h3>Select Tags</h3>
                        <p class="selector-description">Select one or more tags to view performance of tagged learners</p>
                        ${this.tags.length === 0 ? `
                            <div class="no-tags-message">
                                <p>No tags available. Tags must be created by an administrator.</p>
                            </div>
                        ` : `
                            <div class="tag-checkboxes">
                                ${this.tags.map(tag => `
                                    <label class="tag-checkbox-label">
                                        <input type="checkbox" class="tag-checkbox" value="${tag.id}" 
                                               ${this.selectedTags.includes(tag.id) ? 'checked' : ''}>
                                        <span class="tag-badge" style="background-color: ${tag.color || '#6366f1'}20; color: ${tag.color || '#6366f1'}; border: 1px solid ${tag.color || '#6366f1'};">
                                            ${this.escapeHtml(tag.name)}
                                        </span>
                                    </label>
                                `).join('')}
                            </div>
                            <button class="btn btn-primary" id="load-tag-report" style="margin-top: 16px;">
                                Load Report
                            </button>
                        `}
                    </div>
                </div>

                <div id="tag-report-content">
                    ${this.reportData ? this.renderReportData() : this.renderEmptyState()}
                </div>
            </div>
        `;

        this.attachEventListeners();
        exportOptions.attachEventListeners(this.container);
    }

    renderReportData() {
        const reportCharts = new ReportCharts();
        const { summary, learners } = this.reportData;

        return `
            <div class="tag-report-results">
                <div class="summary-section">
                    <h2>Summary Statistics</h2>
                    <div class="statistics-cards">
                        <div class="stat-card">
                            <div class="stat-label">Total Learners</div>
                            <div class="stat-value">${summary.totalLearners || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Average Progress</div>
                            <div class="stat-value">${(summary.averageProgress || 0).toFixed(1)}%</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Average Lab Score</div>
                            <div class="stat-value">${summary.averageLabScore ? summary.averageLabScore.toFixed(1) : 'N/A'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Completion Rate</div>
                            <div class="stat-value">${(summary.completionRate || 0).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>

                <div class="learners-section">
                    <h2>Learner Breakdown</h2>
                    ${learners.length === 0 ? `
                        <div class="report-empty">
                            <div class="report-empty-icon">👥</div>
                            <div class="report-empty-title">No Learners Found</div>
                            <div class="report-empty-message">No learners match the selected tags.</div>
                        </div>
                    ` : `
                        <div class="table-container">
                            <table class="report-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Progress</th>
                                        <th>Courses</th>
                                        <th>Labs</th>
                                        <th>Avg Score</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${learners.map(learner => `
                                        <tr>
                                            <td><strong>${this.escapeHtml(learner.full_name || learner.email || 'Unknown')}</strong></td>
                                            <td>${this.escapeHtml(learner.email || 'N/A')}</td>
                                            <td>${reportCharts.renderProgressBar(learner.overallProgress || 0, '', 'sm')}</td>
                                            <td>${learner.totalCourses || 0}</td>
                                            <td>${learner.labsSubmitted || 0}</td>
                                            <td>${learner.averageLabScore ? learner.averageLabScore.toFixed(1) : 'N/A'}</td>
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
                    `}
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="report-empty">
                <div class="report-empty-icon">🏷️</div>
                <div class="report-empty-title">No Report Loaded</div>
                <div class="report-empty-message">Select one or more tags above and click "Load Report" to view performance data.</div>
            </div>
        `;
    }

    attachEventListeners() {
        const loadBtn = this.container.querySelector('#load-tag-report');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadReport());
        }
    }

    async loadReport() {
        try {
            // Get selected tags
            const checkboxes = this.container.querySelectorAll('.tag-checkbox:checked');
            this.selectedTags = Array.from(checkboxes).map(cb => cb.value);

            if (this.selectedTags.length === 0) {
                alert('Please select at least one tag.');
                return;
            }

            // Show loading state
            const loadBtn = this.container.querySelector('#load-tag-report');
            if (loadBtn) {
                loadBtn.disabled = true;
                loadBtn.textContent = 'Loading...';
            }

            // Show loading in content area
            const contentArea = this.container.querySelector('#tag-report-content');
            if (contentArea) {
                contentArea.innerHTML = '<div class="report-loading">Loading report data...</div>';
            }

            // Load tag-based report
            this.reportData = await reportService.getTagBasedReport(
                this.selectedTags,
                {},
                'trainer',
                this.currentUser.id
            );

            // Update content area with report data
            if (contentArea) {
                contentArea.innerHTML = this.renderReportData();
            } else {
                // Fallback: re-render entire component
                this.render();
            }

            // Reset button
            if (loadBtn) {
                loadBtn.disabled = false;
                loadBtn.textContent = 'Load Report';
            }
        } catch (error) {
            console.error('[TagBasedReport] Error loading report:', error);
            alert('Failed to load report: ' + error.message);
            
            // Reset button
            const loadBtn = this.container.querySelector('#load-tag-report');
            if (loadBtn) {
                loadBtn.disabled = false;
                loadBtn.textContent = 'Load Report';
            }

            // Show error in content area
            const contentArea = this.container.querySelector('#tag-report-content');
            if (contentArea) {
                contentArea.innerHTML = this.renderEmptyState();
            }
        }
    }

    formatStatus(status) {
        const statusMap = {
            'on_track': 'On Track',
            'needs_attention': 'Needs Attention',
            'at_risk': 'At Risk'
        };
        return statusMap[status] || status;
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

export default TagBasedReport;

