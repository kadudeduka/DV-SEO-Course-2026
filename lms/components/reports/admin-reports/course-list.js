/**
 * Course List Component (Admin View)
 * 
 * Displays a list of all courses with links to individual course performance reports.
 */

import { courseService } from '../../../services/course-service.js';
import { authService } from '../../../services/auth-service.js';
import { reportService } from '../../../services/report-service.js';
import ReportCharts from '../shared/report-charts.js';
import Header from '../../header.js';

class AdminCourseList {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.courses = [];
        this.courseStats = [];
    }

    async init() {
        try {
            console.log('[AdminCourseList] Initializing...');
            
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
            console.error('[AdminCourseList] Error initializing:', error);
            this.showError(error.message || 'Failed to load course list.');
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
            
            // Get all courses
            this.courses = await courseService.getCourses();
            
            // Get basic stats for each course
            this.courseStats = await Promise.all(
                this.courses.map(async (course) => {
                    try {
                        const report = await reportService.getAdminCoursePerformanceReport(course.id);
                        return {
                            courseId: course.id,
                            totalEnrollments: report.overview.totalEnrollments || 0,
                            averageProgress: report.overview.averageProgress || 0,
                            completionRate: report.overview.completionRate || 0
                        };
                    } catch (error) {
                        console.warn(`[AdminCourseList] Error loading stats for course ${course.id}:`, error);
                        return {
                            courseId: course.id,
                            totalEnrollments: 0,
                            averageProgress: 0,
                            completionRate: 0
                        };
                    }
                })
            );
        } catch (error) {
            console.error('[AdminCourseList] Error loading data:', error);
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
                        <h1>Course Performance</h1>
                        <p class="report-subtitle">View performance analytics for all courses</p>
                    </div>
                </div>

                ${this.courses.length === 0 ? `
                    <div class="report-empty">
                        <div class="report-empty-icon">📚</div>
                        <div class="report-empty-title">No Courses</div>
                        <div class="report-empty-message">No courses are available in the system.</div>
                    </div>
                ` : `
                    <div class="course-list-grid">
                        ${this.courses.map((course, index) => {
                            const stats = this.courseStats[index] || {};
                            return `
                                <div class="course-card">
                                    <div class="course-card-header">
                                        <h3 class="course-card-title">${this.escapeHtml(course.title || 'Untitled Course')}</h3>
                                        ${course.published ? `
                                            <span class="course-badge published">Published</span>
                                        ` : `
                                            <span class="course-badge draft">Draft</span>
                                        `}
                                    </div>
                                    ${course.description ? `
                                        <p class="course-card-description">${this.escapeHtml(course.description)}</p>
                                    ` : ''}
                                    <div class="course-card-stats">
                                        <div class="course-stat-item">
                                            <span class="course-stat-label">Enrollments:</span>
                                            <span class="course-stat-value">${stats.totalEnrollments || 0}</span>
                                        </div>
                                        <div class="course-stat-item">
                                            <span class="course-stat-label">Avg Progress:</span>
                                            <span class="course-stat-value">${(stats.averageProgress || 0).toFixed(1)}%</span>
                                        </div>
                                        <div class="course-stat-item">
                                            <span class="course-stat-label">Completion Rate:</span>
                                            <span class="course-stat-value">${(stats.completionRate || 0).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div class="course-card-actions">
                                        <a href="#/reports/admin/course/${course.id}" class="btn btn-primary btn-sm">
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

export default AdminCourseList;

