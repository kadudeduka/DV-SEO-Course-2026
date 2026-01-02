/**
 * My Assigned Courses Component
 * 
 * Filtered view showing only courses assigned to the current learner with progress focus.
 */

import { courseService } from '../services/course-service.js';
import { analyticsService } from '../services/analytics-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class MyCourses {
    constructor(container) {
        this.container = container;
        this.courses = [];
        this.filteredCourses = [];
        this.currentUser = null;
        this.progressData = {};
        this.filters = {
            status: 'all', // all, in-progress, completed, not-started
            sort: 'progress' // progress, recent, alphabetical
        };
    }

    /**
     * Show my courses page
     */
    async show() {
        try {
            console.log('[MyCourses] show() called');
            
            if (!this.container) {
                console.error('[MyCourses] Container not found!');
                return;
            }

            console.log('[MyCourses] Setting container display');
            this.container.style.display = 'block';

            console.log('[MyCourses] Rendering header');
            await this.renderHeader();

            console.log('[MyCourses] Loading courses');
            await this.loadCourses();
            console.log('[MyCourses] Courses loaded:', this.courses.length);

            console.log('[MyCourses] Loading progress');
            await this.loadProgress();

            console.log('[MyCourses] Applying filters');
            this.applyFilters();

            console.log('[MyCourses] Rendering page');
            this.render();
            console.log('[MyCourses] Page rendered successfully');
        } catch (error) {
            console.error('[MyCourses] Error in show():', error);
            if (this.container) {
                this.container.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <div class="error-title">Error Loading Courses</div>
                        <div class="error-message">${error.message || 'An unexpected error occurred'}</div>
                        <button class="btn btn-primary" onclick="location.reload()">Reload Page</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Render header
     */
    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    /**
     * Load assigned courses
     */
    async loadCourses() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            const userId = this.currentUser.id;
            this.courses = await courseService.getCourses(userId);
        } catch (error) {
            console.error('[MyCourses] Error loading courses:', error);
            this.courses = [];
        }
    }

    /**
     * Load progress for all courses
     */
    async loadProgress() {
        for (const course of this.courses) {
            try {
                const rawProgress = await analyticsService.calculateCourseProgress(
                    this.currentUser.id,
                    course.id
                );
                this.progressData[course.id] = parseFloat(rawProgress.toFixed(1));
            } catch (error) {
                console.warn(`[MyCourses] Failed to load progress for course ${course.id}:`, error);
                this.progressData[course.id] = 0;
            }
        }
    }

    /**
     * Apply filters
     */
    applyFilters() {
        this.filteredCourses = [...this.courses];

        // Status filter
        if (this.filters.status !== 'all') {
            this.filteredCourses = this.filteredCourses.filter(course => {
                const progress = this.progressData[course.id] || 0;
                
                if (this.filters.status === 'in-progress') {
                    return progress > 0 && progress < 100;
                } else if (this.filters.status === 'completed') {
                    return progress >= 100;
                } else if (this.filters.status === 'not-started') {
                    return progress === 0;
                }
                return true;
            });
        }

        // Sort
        if (this.filters.sort === 'progress') {
            this.filteredCourses.sort((a, b) => {
                const progressA = this.progressData[a.id] || 0;
                const progressB = this.progressData[b.id] || 0;
                return progressB - progressA; // Descending
            });
        } else if (this.filters.sort === 'alphabetical') {
            this.filteredCourses.sort((a, b) => {
                const titleA = (a.title || '').toLowerCase();
                const titleB = (b.title || '').toLowerCase();
                return titleA.localeCompare(titleB);
            });
        }
    }

    /**
     * Render my courses page
     */
    render() {
        if (!this.container) {
            console.error('[MyCourses] Cannot render: container is null');
            return;
        }

        try {
            console.log('[MyCourses] Rendering HTML, courses count:', this.filteredCourses.length);
            this.container.innerHTML = `
            <div class="my-courses-page">
                <div class="my-courses-header">
                    <div class="my-courses-title-section">
                        <h1 class="my-courses-title">Courses</h1>
                        <p class="my-courses-subtitle">Track your learning progress across all assigned courses</p>
                    </div>
                </div>

                <div class="my-courses-filters">
                    <div class="filter-group">
                        <label for="status-filter" class="filter-label">Filter by Status</label>
                        <select id="status-filter" class="filter-select">
                            <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>All Courses</option>
                            <option value="in-progress" ${this.filters.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${this.filters.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="not-started" ${this.filters.status === 'not-started' ? 'selected' : ''}>Not Started</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="sort-filter" class="filter-label">Sort By</label>
                        <select id="sort-filter" class="filter-select">
                            <option value="progress" ${this.filters.sort === 'progress' ? 'selected' : ''}>Progress (High to Low)</option>
                            <option value="recent" ${this.filters.sort === 'recent' ? 'selected' : ''}>Recently Accessed</option>
                            <option value="alphabetical" ${this.filters.sort === 'alphabetical' ? 'selected' : ''}>Alphabetical</option>
                        </select>
                    </div>
                </div>

                <div class="my-courses-stats">
                    ${this.renderStats()}
                </div>

                <div id="courses-list" class="courses-grid">
                    ${this.renderCoursesList()}
                </div>
            </div>
        `;

            console.log('[MyCourses] HTML rendered, attaching event listeners');
            this.attachEventListeners();
            console.log('[MyCourses] Render complete');
        } catch (error) {
            console.error('[MyCourses] Error in render():', error);
            this.container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">Error Rendering Page</div>
                    <div class="error-message">${error.message || 'An error occurred while rendering the page'}</div>
                    <button class="btn btn-primary" onclick="location.reload()">Reload Page</button>
                </div>
            `;
        }
    }

    /**
     * Render statistics
     */
    renderStats() {
        const total = this.courses.length;
        const inProgress = this.courses.filter(c => {
            const p = this.progressData[c.id] || 0;
            return p > 0 && p < 100;
        }).length;
        const completed = this.courses.filter(c => {
            const p = this.progressData[c.id] || 0;
            return p >= 100;
        }).length;
        const notStarted = total - inProgress - completed;

        return `
            <div class="my-courses-stat-card">
                <div class="stat-item">
                    <span class="stat-value">${total}</span>
                    <span class="stat-label">Total Courses</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${inProgress}</span>
                    <span class="stat-label">In Progress</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${completed}</span>
                    <span class="stat-label">Completed</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${notStarted}</span>
                    <span class="stat-label">Not Started</span>
                </div>
            </div>
        `;
    }

    /**
     * Render courses list
     */
    renderCoursesList() {
        if (this.filteredCourses.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-title">No Courses Found</div>
                    <div class="empty-state-text">
                        ${this.courses.length === 0 
                            ? 'You don\'t have any courses assigned yet. Contact your trainer to get started.'
                            : 'No courses match your current filter. Try adjusting your filters.'}
                    </div>
                    ${this.courses.length > 0 ? '<button class="btn btn-secondary" id="clear-filters-btn">Clear Filters</button>' : ''}
                </div>
            `;
        }

        return this.filteredCourses.map(course => {
            const progress = this.progressData[course.id] || 0;
            const isCompleted = progress >= 100;
            const isInProgress = progress > 0 && progress < 100;

            return `
                <div class="course-card-modern" data-course-id="${course.id}">
                    <div class="course-card-image-modern">
                        <div class="course-card-badge-modern ${isCompleted ? 'completed' : isInProgress ? 'in-progress' : ''}">
                            ${isCompleted ? '✓ Completed' : isInProgress ? `${progress}%` : 'New'}
                        </div>
                    </div>
                    <div class="course-card-content-modern">
                        <h3 class="course-card-title-modern">${course.title || 'Untitled Course'}</h3>
                        <p class="course-card-description-modern">${course.description || 'No description available'}</p>
                        <div class="course-card-progress-modern">
                            <div class="progress-bar progress-bar-small">
                                <div class="progress-bar-fill" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text-small">${progress}% Complete</span>
                        </div>
                        <div class="course-card-footer">
                            <a href="#/courses/${course.id}" class="btn btn-secondary btn-sm">View Details</a>
                            <a href="#/courses/${course.id}/learn" class="btn btn-primary btn-sm">${isCompleted ? 'Review' : isInProgress ? 'Continue' : 'Start'}</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Status filter
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
                this.render();
            });
        }

        // Sort filter
        const sortFilter = document.getElementById('sort-filter');
        if (sortFilter) {
            sortFilter.addEventListener('change', (e) => {
                this.filters.sort = e.target.value;
                this.applyFilters();
                this.render();
            });
        }

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.filters = {
                    status: 'all',
                    sort: 'progress'
                };
                this.applyFilters();
                this.render();
            });
        }

        // Course cards
        const courseCards = this.container.querySelectorAll('.course-card-modern');
        courseCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn')) {
                    return;
                }
                const courseId = card.getAttribute('data-course-id');
                if (courseId) {
                    router.navigate(`/courses/${courseId}`);
                }
            });
        });
    }
}

export default MyCourses;

