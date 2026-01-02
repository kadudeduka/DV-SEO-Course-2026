/**
 * Learner List Component (Admin View)
 * 
 * Displays a list of all learners with links to individual learner performance reports.
 */

import { adminService } from '../../../services/admin-service.js';
import { authService } from '../../../services/auth-service.js';
import { reportService } from '../../../services/report-service.js';
import ReportCharts from '../shared/report-charts.js';
import Header from '../../header.js';

class AdminLearnerList {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.learners = [];
        this.learnerStats = [];
    }

    async init() {
        try {
            console.log('[AdminLearnerList] Initializing...');
            
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
            console.error('[AdminLearnerList] Error initializing:', error);
            this.showError(error.message || 'Failed to load learner list.');
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
            
            // Get all learners
            const allUsers = await adminService.getAllUsers();
            this.learners = allUsers.filter(user => user.role === 'learner');
            
            // Get basic stats for each learner
            this.learnerStats = await Promise.all(
                this.learners.map(async (learner) => {
                    try {
                        const overview = await reportService.getLearnerOverview(learner.id);
                        return {
                            learnerId: learner.id,
                            totalCourses: overview.totalCourses || 0,
                            averageProgress: overview.averageProgress || 0,
                            averageLabScore: overview.averageLabScore || null,
                            status: overview.status || 'needs_attention'
                        };
                    } catch (error) {
                        console.warn(`[AdminLearnerList] Error loading stats for learner ${learner.id}:`, error);
                        return {
                            learnerId: learner.id,
                            totalCourses: 0,
                            averageProgress: 0,
                            averageLabScore: null,
                            status: 'needs_attention'
                        };
                    }
                })
            );
        } catch (error) {
            console.error('[AdminLearnerList] Error loading data:', error);
            throw error;
        }
    }

    render() {
        const reportCharts = new ReportCharts();

        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <a href="#/reports/admin" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to Dashboard
                        </a>
                        <h1>Learner Performance</h1>
                        <p class="report-subtitle">View performance analytics for all learners</p>
                    </div>
                </div>

                ${this.learners.length === 0 ? `
                    <div class="report-empty">
                        <div class="report-empty-icon">👥</div>
                        <div class="report-empty-title">No Learners</div>
                        <div class="report-empty-message">No learners are available in the system.</div>
                    </div>
                ` : `
                    <div class="course-list-grid">
                        ${this.learners.map((learner, index) => {
                            const stats = this.learnerStats[index] || {};
                            const statusConfig = this.getStatusConfig(stats.status);
                            return `
                                <div class="course-card">
                                    <div class="course-card-header">
                                        <h3 class="course-card-title">${this.escapeHtml(learner.full_name || learner.name || learner.email || 'Unknown Learner')}</h3>
                                        <span class="status-badge status-${stats.status || 'needs_attention'}">
                                            ${statusConfig.label}
                                        </span>
                                    </div>
                                    <p class="course-card-description">${this.escapeHtml(learner.email || 'No email')}</p>
                                    <div class="course-card-stats">
                                        <div class="course-stat-item">
                                            <span class="course-stat-label">Courses:</span>
                                            <span class="course-stat-value">${stats.totalCourses || 0}</span>
                                        </div>
                                        <div class="course-stat-item">
                                            <span class="course-stat-label">Avg Progress:</span>
                                            <span class="course-stat-value">${(stats.averageProgress || 0).toFixed(1)}%</span>
                                        </div>
                                        <div class="course-stat-item">
                                            <span class="course-stat-label">Avg Lab Score:</span>
                                            <span class="course-stat-value">${stats.averageLabScore ? stats.averageLabScore.toFixed(1) + '%' : 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div class="course-card-actions">
                                        <a href="#/reports/admin/learner/${learner.id}" class="btn btn-primary btn-sm">
                                            View Detailed Report
                                        </a>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
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

export default AdminLearnerList;

