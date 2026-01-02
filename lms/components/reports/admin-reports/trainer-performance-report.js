/**
 * Trainer Performance Report Component (Admin View)
 * 
 * Displays comprehensive performance analytics for all trainers.
 * Shows trainer effectiveness, learner performance, and lab review metrics.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class TrainerPerformanceReport {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.reportData = null;
    }

    async init() {
        try {
            console.log('[TrainerPerformanceReport] Initializing...');
            
            if (this.container) {
                this.container.style.display = 'block';
            }

            await this.renderHeader();

            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || this.currentUser.role !== 'admin') {
                throw new Error('Access denied: Admin role required');
            }

            await this.loadData();
            this.render();
        } catch (error) {
            console.error('[TrainerPerformanceReport] Error initializing:', error);
            this.showError(error.message || 'Failed to load trainer report.');
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
            
            this.reportData = await reportService.getTrainerPerformanceReport();
        } catch (error) {
            console.error('[TrainerPerformanceReport] Error loading data:', error);
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
                        <h1>Trainer Performance Report</h1>
                        <p class="report-subtitle">Analyze trainer effectiveness and performance</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.reportData, 'trainer_performance')}
                    </div>
                </div>

                <div class="statistics-cards">
                    ${this.renderSummaryStatistics()}
                </div>

                <div class="trainer-list-section">
                    <h2>Trainer Performance</h2>
                    ${this.renderTrainerTable()}
                </div>
            </div>
        `;

        exportOptions.attachEventListeners(this.container);
    }

    renderSummaryStatistics() {
        const { summary } = this.reportData;
        
        return `
            <div class="stat-card">
                <div class="stat-label">Total Trainers</div>
                <div class="stat-value">${summary.totalTrainers || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Trainers</div>
                <div class="stat-value">${summary.activeTrainers || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Assigned Learners</div>
                <div class="stat-value">${summary.totalAssignedLearners || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Learners per Trainer</div>
                <div class="stat-value">${summary.averageLearnersPerTrainer ? summary.averageLearnersPerTrainer.toFixed(1) : 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lab Response Time</div>
                <div class="stat-value">${summary.averageResponseTime ? this.formatResponseTime(summary.averageResponseTime) : 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Labs Reviewed</div>
                <div class="stat-value">${summary.totalLabsReviewed || 0}</div>
            </div>
        `;
    }

    renderTrainerTable() {
        if (!this.reportData.trainers || this.reportData.trainers.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">👨‍🏫</div>
                    <div class="report-empty-title">No Trainers</div>
                    <div class="report-empty-message">No trainers found in the system.</div>
                </div>
            `;
        }

        return `
            <div class="table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Trainer Name</th>
                            <th>Email</th>
                            <th>Assigned Learners</th>
                            <th>Active Learners</th>
                            <th>Labs Reviewed</th>
                            <th>Pending Reviews</th>
                            <th>Avg Response Time</th>
                            <th>Avg Learner Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reportData.trainers.map(trainer => `
                            <tr>
                                <td><strong>${this.escapeHtml(trainer.name || 'Unknown')}</strong></td>
                                <td>${this.escapeHtml(trainer.email || 'N/A')}</td>
                                <td>${trainer.totalLearners || 0}</td>
                                <td>${trainer.activeLearners || 0}</td>
                                <td>${trainer.labsReviewed || 0}</td>
                                <td>${trainer.pendingReviews || 0}</td>
                                <td>${trainer.avgResponseTime ? this.formatResponseTime(trainer.avgResponseTime) : 'N/A'}</td>
                                <td>${trainer.averageLearnerScore ? trainer.averageLearnerScore.toFixed(1) : 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
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

export default TrainerPerformanceReport;

