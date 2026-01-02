/**
 * Cross-Course Comparison Component (Trainer View)
 * 
 * Allows trainers to compare learner performance across multiple courses.
 * Supports both course comparison and learner comparison.
 */

import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import { courseService } from '../../../services/course-service.js';
import { supabaseClient } from '../../../services/supabase-client.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';
import { router } from '../../../core/router.js';
import Header from '../../header.js';

class CrossCourseComparison {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.comparisonData = null;
        this.availableCourses = [];
        this.availableLearners = [];
        this.selectedCourses = [];
        this.selectedLearners = [];
        this.comparisonType = 'courses'; // 'courses' or 'learners'
    }

    async init() {
        try {
            console.log('[CrossCourseComparison] Initializing...');
            
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

            // Load available courses and learners
            await this.loadAvailableData();

            // Render component
            this.render();
        } catch (error) {
            console.error('[CrossCourseComparison] Error initializing:', error);
            this.showError(error.message || 'Failed to load comparison tool.');
        }
    }

    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    async loadAvailableData() {
        try {
            // Get assigned learners
            const { data: learners } = await supabaseClient
                .from('users')
                .select('id, full_name, email')
                .eq('trainer_id', this.currentUser.id)
                .eq('role', 'learner')
                .eq('learner_type', 'active');

            this.availableLearners = learners || [];

            // Get available courses (all published courses for trainers)
            const courses = await courseService.getCourses();
            this.availableCourses = courses.filter(c => c.published) || [];
        } catch (error) {
            console.error('[CrossCourseComparison] Error loading available data:', error);
            this.availableCourses = [];
            this.availableLearners = [];
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
                        <h1>Cross-Course Comparison</h1>
                        <p class="report-subtitle">Compare performance across courses or learners</p>
                    </div>
                    <div class="report-actions">
                        ${exportOptions.render(this.comparisonData, 'cross_course_comparison')}
                    </div>
                </div>

                <div class="comparison-controls">
                    <div class="comparison-type-selector">
                        <label class="control-label">Comparison Type:</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="comparison-type" value="courses" ${this.comparisonType === 'courses' ? 'checked' : ''}>
                                Compare Courses
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="comparison-type" value="learners" ${this.comparisonType === 'learners' ? 'checked' : ''}>
                                Compare Learners
                            </label>
                        </div>
                    </div>

                    ${this.comparisonType === 'courses' ? this.renderCourseSelector() : this.renderLearnerSelector()}

                    <button class="btn btn-primary" id="run-comparison">Run Comparison</button>
                </div>

                ${this.comparisonData ? this.renderComparisonResults() : this.renderEmptyState()}
            </div>
        `;

        this.attachEventListeners();
        exportOptions.attachEventListeners(this.container);
    }

    renderCourseSelector() {
        return `
            <div class="selector-group">
                <label class="control-label">Select Courses (select 2 or more):</label>
                <div class="multi-select-container">
                    ${this.availableCourses.map(course => `
                        <label class="checkbox-label">
                            <input type="checkbox" class="course-checkbox" value="${course.id}" 
                                   ${this.selectedCourses.includes(course.id) ? 'checked' : ''}>
                            ${this.escapeHtml(course.title)}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderLearnerSelector() {
        return `
            <div class="selector-group">
                <label class="control-label">Select Learners (select 2 or more):</label>
                <div class="multi-select-container">
                    ${this.availableLearners.map(learner => `
                        <label class="checkbox-label">
                            <input type="checkbox" class="learner-checkbox" value="${learner.id}" 
                                   ${this.selectedLearners.includes(learner.id) ? 'checked' : ''}>
                            ${this.escapeHtml(learner.full_name || learner.email)}
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="report-empty">
                <div class="report-empty-icon">📊</div>
                <div class="report-empty-title">No Comparison Selected</div>
                <div class="report-empty-message">Select items above and click "Run Comparison" to see results.</div>
            </div>
        `;
    }

    renderComparisonResults() {
        const reportCharts = new ReportCharts();

        if (this.comparisonType === 'courses') {
            return `
                <div class="comparison-results">
                    <h2>Course Comparison</h2>
                    <div class="comparison-table-container">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>Course</th>
                                    <th>Avg Progress</th>
                                    <th>Avg Lab Score</th>
                                    <th>Completion Rate</th>
                                    <th>Engagement</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.comparisonData.courses.map(course => `
                                    <tr>
                                        <td><strong>${this.escapeHtml(course.name)}</strong></td>
                                        <td>${reportCharts.renderProgressBar(course.averageProgress || 0, '', 'sm')}</td>
                                        <td>${course.averageLabScore ? course.averageLabScore.toFixed(1) : 'N/A'}</td>
                                        <td>${(course.completionRate || 0).toFixed(1)}%</td>
                                        <td>${(course.engagement || 0).toFixed(1)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="comparison-results">
                    <h2>Learner Comparison</h2>
                    <div class="comparison-table-container">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th>Learner</th>
                                    <th>Overall Progress</th>
                                    <th>Avg Lab Score</th>
                                    <th>Time Spent</th>
                                    <th>Consistency</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.comparisonData.learners.map(learner => `
                                    <tr>
                                        <td><strong>${this.escapeHtml(learner.name)}</strong></td>
                                        <td>${reportCharts.renderProgressBar(learner.overallProgress || 0, '', 'sm')}</td>
                                        <td>${learner.averageLabScore ? learner.averageLabScore.toFixed(1) : 'N/A'}</td>
                                        <td>${this.formatTime(learner.timeSpent || 0)}</td>
                                        <td>${(learner.consistency || 0).toFixed(1)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }

    attachEventListeners() {
        // Comparison type selector
        const typeRadios = this.container.querySelectorAll('input[name="comparison-type"]');
        typeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.comparisonType = e.target.value;
                this.selectedCourses = [];
                this.selectedLearners = [];
                this.comparisonData = null;
                this.render();
            });
        });

        // Run comparison button
        const runBtn = this.container.querySelector('#run-comparison');
        if (runBtn) {
            runBtn.addEventListener('click', () => this.runComparison());
        }
    }

    async runComparison() {
        try {
            if (this.comparisonType === 'courses') {
                // Get selected courses
                const checkboxes = this.container.querySelectorAll('.course-checkbox:checked');
                this.selectedCourses = Array.from(checkboxes).map(cb => cb.value);

                if (this.selectedCourses.length < 2) {
                    alert('Please select at least 2 courses to compare.');
                    return;
                }

                // Run course comparison
                this.comparisonData = await reportService.getCrossCourseComparison(
                    this.currentUser.id,
                    this.selectedCourses,
                    []
                );
            } else {
                // Get selected learners
                const checkboxes = this.container.querySelectorAll('.learner-checkbox:checked');
                this.selectedLearners = Array.from(checkboxes).map(cb => cb.value);

                if (this.selectedLearners.length < 2) {
                    alert('Please select at least 2 learners to compare.');
                    return;
                }

                // Run learner comparison
                this.comparisonData = await reportService.getCrossCourseComparison(
                    this.currentUser.id,
                    [],
                    this.selectedLearners
                );
            }

            this.render();
        } catch (error) {
            console.error('[CrossCourseComparison] Error running comparison:', error);
            alert('Failed to run comparison: ' + error.message);
        }
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

export default CrossCourseComparison;

