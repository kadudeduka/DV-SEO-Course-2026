/**
 * Course Listing Component
 * 
 * Displays list of available courses.
 * 
 * VERSION: 3.0 - Fixed Promise issue by separating HTML insertion
 * TIMESTAMP: 2025-01-29
 */

console.log('[CourseListing] Module loaded - VERSION 3.0');

import { courseService } from '../services/course-service.js';
import { analyticsService } from '../services/analytics-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class CourseListing {
    constructor(container) {
        this.container = container;
        this.courses = [];
        this.filteredCourses = [];
        this.currentUser = null;
        this.filters = {
            status: 'all', // all, in-progress, completed, not-started
            sort: 'recent' // recent, progress, alphabetical
        };
        this.viewMode = 'grid'; // grid or list
    }

    /**
     * Show course listing page
     */
    async show() {
        console.log('[CourseListing] ========== show() called - VERSION 3.0 ==========');
        console.log('[CourseListing] Container:', this.container);
        try {
            // Ensure container is visible first
            if (this.container) {
                this.container.style.display = 'block';
            }
            
            // Render header (if method exists)
            if (this.renderHeader) {
                console.log('[CourseListing] Rendering header...');
                try {
                    await this.renderHeader();
                    console.log('[CourseListing] Header rendered');
                } catch (headerError) {
                    console.warn('[CourseListing] Error rendering header (continuing):', headerError);
                }
            }
            
            console.log('[CourseListing] Loading courses...');
            await this.loadCourses();
            console.log('[CourseListing] Courses loaded:', this.courses.length, 'calling render()...');
            await this.render();
            console.log('[CourseListing] render() completed');
        } catch (error) {
            console.error('[CourseListing] Error in show():', error);
            if (this.container) {
                this.container.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <div class="error-title">Error Loading Courses</div>
                        <div class="error-message">${error.message || 'Failed to load course listing'}</div>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Render header with navigation
     */
    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        } else {
            // Create header container if it doesn't exist
            const headerDiv = document.createElement('div');
            headerDiv.id = 'header-container';
            document.body.insertBefore(headerDiv, document.body.firstChild);
            const header = new Header(headerDiv);
            await header.init();
        }
    }

    /**
     * Load courses from CourseService
     */
    async loadCourses() {
        try {
            this.currentUser = await authService.getCurrentUser();
            const userId = this.currentUser ? this.currentUser.id : null;
            console.log('[CourseListing] Loading courses for user:', userId, 'Role:', this.currentUser?.role);
            
            // For trainers and admins, pass userId to get all courses
            // For learners, this will be handled by the service
            this.courses = await courseService.getCourses(userId);
            console.log('[CourseListing] Loaded courses:', this.courses.length, this.courses);
            
            // Debug: Log course details
            if (this.courses.length > 0) {
                console.log('[CourseListing] First course:', {
                    id: this.courses[0].id,
                    title: this.courses[0].title,
                    published: this.courses[0].published,
                    hasCourseData: !!this.courses[0].courseData
                });
            } else {
                console.warn('[CourseListing] No courses returned from service');
            }
        } catch (error) {
            console.error('[CourseListing] Error loading courses:', error);
            this.showError('Failed to load courses: ' + error.message);
            this.courses = [];
        }
    }

    /**
     * Render course listing
     */
    async render() {
        console.log('[CourseListing] render() called - VERSION 2.0');
        try {
            // Ensure container is visible
            if (this.container) {
                this.container.style.display = 'block';
            }
            
            // Apply filters
            console.log('[CourseListing] render - applying filters...');
            await this.applyFilters();
            console.log('[CourseListing] render - after applyFilters, filteredCourses:', this.filteredCourses.length);
            
            // Render courses list - directly await since it's async
            let coursesListHtml = '';
            try {
                console.log('[CourseListing] render - calling renderCoursesList()...');
                coursesListHtml = await this.renderCoursesList();
                console.log('[CourseListing] render - renderCoursesList completed, type:', typeof coursesListHtml, 'length:', coursesListHtml?.length);
                
                // Ensure it's a string - convert if necessary
                if (typeof coursesListHtml !== 'string') {
                    console.error('[CourseListing] coursesListHtml is not a string!', coursesListHtml, 'Type:', typeof coursesListHtml);
                    coursesListHtml = String(coursesListHtml) || '<div class="error-state">Error: Failed to render courses list (not a string)</div>';
                } else {
                    console.log('[CourseListing] render - coursesListHtml preview:', coursesListHtml?.substring(0, 200));
                }
            } catch (renderError) {
                console.error('[CourseListing] Error in renderCoursesList:', renderError);
                coursesListHtml = `<div class="error-state">Error: Failed to render courses list: ${renderError.message || 'Unknown error'}</div>`;
            }
            
            // Final safety check - ensure it's a string before inserting
            if (typeof coursesListHtml !== 'string') {
                console.error('[CourseListing] Final check failed - coursesListHtml is not a string:', coursesListHtml);
                coursesListHtml = '<div class="error-state">Error: coursesListHtml is not a string</div>';
            }
            
            // Build the outer HTML structure first
            const outerHtml = `
            <div class="course-listing">
                <div class="course-listing-header">
                    <div class="course-listing-title-section">
                        <h1 class="course-listing-title">All Courses</h1>
                        <p class="course-listing-subtitle">Browse and discover courses available to you</p>
                    </div>
                    <div class="course-listing-actions">
                        <div class="view-toggle">
                            <button class="view-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View">
                                <span>⊞</span>
                            </button>
                            <button class="view-toggle-btn ${this.viewMode === 'list' ? 'active' : ''}" data-view="list" title="List View">
                                <span>☰</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="course-listing-filters">
                    <div class="filter-group">
                        <label for="status-filter" class="filter-label">Status</label>
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
                            <option value="recent" ${this.filters.sort === 'recent' ? 'selected' : ''}>Recently Accessed</option>
                            <option value="progress" ${this.filters.sort === 'progress' ? 'selected' : ''}>Progress</option>
                            <option value="alphabetical" ${this.filters.sort === 'alphabetical' ? 'selected' : ''}>Alphabetical</option>
                        </select>
                    </div>
                </div>
                
                <div id="course-error" class="error-message" style="display: none;"></div>
                <div id="courses-list" class="courses-grid ${this.viewMode === 'list' ? 'list-view' : ''}">
                </div>
            </div>
        `;
            
            console.log('[CourseListing] Setting outer HTML, length:', outerHtml.length);
            this.container.innerHTML = outerHtml;
            
            // Now insert the courses list HTML into the courses-list div
            const coursesListContainer = this.container.querySelector('#courses-list');
            if (coursesListContainer) {
                console.log('[CourseListing] Inserting courses list HTML into container');
                coursesListContainer.innerHTML = coursesListHtml || '<div class="error-state">No courses to display</div>';
            } else {
                console.error('[CourseListing] courses-list container not found!');
            }
            this.attachEventListeners();
        } catch (error) {
            console.error('[CourseListing] Error in render:', error);
            if (this.container) {
                this.container.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <div class="error-title">Error Loading Courses</div>
                        <div class="error-message">${error.message || 'Failed to render course listing'}</div>
                    </div>
                `;
            }
        }
    }

    /**
     * Apply filters to courses
     */
    async applyFilters() {
        console.log('[CourseListing] applyFilters - courses:', this.courses.length, this.courses);
        this.filteredCourses = [...this.courses];
        console.log('[CourseListing] applyFilters - filteredCourses after copy:', this.filteredCourses.length);

        // Status filter (requires progress data)
        if (this.filters.status !== 'all' && this.currentUser) {
            // Load progress for filtering
            const filtered = [];
            
            for (const course of this.filteredCourses) {
                try {
                    const progress = await analyticsService.calculateCourseProgress(
                        this.currentUser.id,
                        course.id
                    );
                    
                    if (this.filters.status === 'in-progress' && progress > 0 && progress < 100) {
                        filtered.push(course);
                    } else if (this.filters.status === 'completed' && progress >= 100) {
                        filtered.push(course);
                    } else if (this.filters.status === 'not-started' && progress === 0) {
                        filtered.push(course);
                    }
                } catch (error) {
                    // If error, include course if filtering for not-started
                    if (this.filters.status === 'not-started') {
                        filtered.push(course);
                    }
                }
            }
            
            this.filteredCourses = filtered;
        }

        // Sort
        if (this.filters.sort === 'alphabetical') {
            this.filteredCourses.sort((a, b) => {
                const titleA = (a.title || '').toLowerCase();
                const titleB = (b.title || '').toLowerCase();
                return titleA.localeCompare(titleB);
            });
        } else if (this.filters.sort === 'progress' && this.currentUser) {
            // Sort by progress (requires async, simplified for now)
            this.filteredCourses.sort((a, b) => {
                // Default sort by title if progress not available
                return (a.title || '').localeCompare(b.title || '');
            });
        }
    }

    /**
     * Render courses list
     */
    async renderCoursesList() {
        try {
            console.log('[CourseListing] renderCoursesList - filteredCourses:', this.filteredCourses.length, this.filteredCourses);
            console.log('[CourseListing] renderCoursesList - courses:', this.courses.length, this.courses);
            
            if (this.filteredCourses.length === 0) {
                const userRole = this.currentUser?.role || 'unknown';
                let message = 'No courses match your filters.';
                
                if (this.courses.length === 0) {
                    if (userRole === 'learner') {
                        message = 'No courses allocated to you yet. Please contact your trainer or administrator to get courses assigned.';
                    } else if (userRole === 'admin') {
                        message = 'No courses available. <a href="#/admin/dashboard">Go to Admin Dashboard</a>';
                    } else if (userRole === 'trainer') {
                        message = 'No courses available.';
                    }
                }
                
                const emptyHtml = `
                    <div class="empty-state empty-state-courses">
                        <div class="empty-state-icon">📚</div>
                        <div class="empty-state-title">${this.courses.length === 0 ? 'No Courses Available' : 'No Courses Found'}</div>
                        <div class="empty-state-text">${message}</div>
                        ${this.courses.length > 0 ? '<button class="btn btn-secondary" id="clear-filters-btn">Clear Filters</button>' : ''}
                    </div>
                `;
                console.log('[CourseListing] renderCoursesList - returning empty state HTML');
                return emptyHtml;
            }

            // Load progress for each course
            console.log('[CourseListing] renderCoursesList - loading progress for', this.filteredCourses.length, 'courses');
            const coursesWithProgress = await Promise.all(
                this.filteredCourses.map(async (course) => {
                    let progress = 0;
                    if (this.currentUser) {
                        try {
                            const rawProgress = await analyticsService.calculateCourseProgress(
                                this.currentUser.id,
                                course.id
                            );
                            progress = parseFloat(rawProgress.toFixed(1));
                        } catch (error) {
                            console.warn('[CourseListing] Failed to load progress for course', course.id, error);
                            progress = 0;
                        }
                    }
                    return { ...course, progress };
                })
            );

            console.log('[CourseListing] renderCoursesList - coursesWithProgress:', coursesWithProgress.length);

            let html = '';
            try {
                if (this.viewMode === 'list') {
                    html = coursesWithProgress.map(course => {
                        try {
                            return this.renderCourseCardList(course) || '';
                        } catch (cardError) {
                            console.error('[CourseListing] Error rendering course card (list):', cardError, course);
                            return `<div class="course-card-error">Error rendering course: ${course.title || course.id}</div>`;
                        }
                    }).join('');
                } else {
                    html = coursesWithProgress.map(course => {
                        try {
                            return this.renderCourseCardGrid(course) || '';
                        } catch (cardError) {
                            console.error('[CourseListing] Error rendering course card (grid):', cardError, course);
                            return `<div class="course-card-error">Error rendering course: ${course.title || course.id}</div>`;
                        }
                    }).join('');
                }
                
                // Ensure html is a string
                if (typeof html !== 'string') {
                    console.error('[CourseListing] HTML is not a string!', html);
                    html = '<div class="error-state">Error: Generated HTML is not a string</div>';
                }
                
                console.log('[CourseListing] renderCoursesList - generated HTML length:', html.length);
                return html;
            } catch (mapError) {
                console.error('[CourseListing] Error mapping courses:', mapError);
                return '<div class="error-state">Error: Failed to map courses to HTML</div>';
            }
        } catch (error) {
            console.error('[CourseListing] Error in renderCoursesList:', error);
            return `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">Error Loading Courses</div>
                    <div class="error-message">${error.message || 'Failed to render courses'}</div>
                </div>
            `;
        }
    }

    /**
     * Render course card (grid view)
     */
    renderCourseCardGrid(course) {
        const progress = course.progress || 0;
        const isCompleted = progress >= 100;
        const isInProgress = progress > 0 && progress < 100;
        
        // Calculate metadata
        const days = course.days?.length || 0;
        const chapters = course.days?.reduce((sum, day) => sum + (day.chapters?.length || 0), 0) || 0;
        const labs = course.days?.reduce((sum, day) => sum + (day.labs?.length || 0), 0) || 0;
        
        // Generate thumbnail placeholder with course initial
        const courseInitial = (course.title || 'C')[0].toUpperCase();
        const thumbnailColor = this.getThumbnailColor(course.id);

        return `
            <div class="course-card-modern" data-course-id="${course.id}">
                <div class="course-card-image-modern">
                    <div class="course-thumbnail" style="background: ${thumbnailColor}">
                        <span class="thumbnail-initial">${courseInitial}</span>
                    </div>
                    <div class="course-card-badge-modern ${isCompleted ? 'completed' : isInProgress ? 'in-progress' : ''}">
                        ${isCompleted ? '✓ Completed' : isInProgress ? `${Math.round(progress)}%` : 'New'}
                    </div>
                    ${isInProgress || isCompleted ? `
                        <div class="course-card-progress-overlay">
                            <div class="progress-ring" style="--progress: ${progress}%">
                                <svg class="progress-ring-svg" viewBox="0 0 64 64">
                                    <circle class="progress-ring-circle-bg" cx="32" cy="32" r="28"></circle>
                                    <circle class="progress-ring-circle" cx="32" cy="32" r="28" style="stroke-dashoffset: ${176 - (176 * progress / 100)}"></circle>
                                </svg>
                                <span class="progress-ring-text">${Math.round(progress)}%</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="course-card-content-modern">
                    <h3 class="course-card-title-modern">${this.escapeHtml(course.title || 'Untitled Course')}</h3>
                    <p class="course-card-description-modern">${this.escapeHtml(course.description || 'No description available')}</p>
                    
                    <div class="course-card-metadata">
                        ${days > 0 ? `
                            <div class="metadata-item">
                                <span class="metadata-icon">📅</span>
                                <span class="metadata-text">${days} ${days === 1 ? 'Day' : 'Days'}</span>
                            </div>
                        ` : ''}
                        ${chapters > 0 ? `
                            <div class="metadata-item">
                                <span class="metadata-icon">📖</span>
                                <span class="metadata-text">${chapters} ${chapters === 1 ? 'Chapter' : 'Chapters'}</span>
                            </div>
                        ` : ''}
                        ${labs > 0 ? `
                            <div class="metadata-item">
                                <span class="metadata-icon">💻</span>
                                <span class="metadata-text">${labs} ${labs === 1 ? 'Lab' : 'Labs'}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${isInProgress || isCompleted ? `
                        <div class="course-card-progress-modern">
                            <div class="progress-bar progress-bar-small">
                                <div class="progress-bar-fill" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text-small">${Math.round(progress)}% Complete</span>
                        </div>
                    ` : ''}
                    <div class="course-card-footer">
                        <a href="#/courses/${course.id}" class="btn btn-ghost btn-sm">View Details</a>
                        <a href="#/courses/${course.id}/learn" class="btn btn-primary btn-sm">${isCompleted ? 'Review' : isInProgress ? 'Continue' : 'Start'}</a>
                        <a href="#/courses/${course.id}/coach/ai" class="btn btn-ghost btn-sm" title="AI Coach">💬</a>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get thumbnail color based on course ID
     */
    getThumbnailColor(courseId) {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
        ];
        // Use course ID to consistently assign a color
        const index = (courseId || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        return colors[index];
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Render course card (list view)
     */
    renderCourseCardList(course) {
        const progress = course.progress || 0;
        const isCompleted = progress >= 100;
        const isInProgress = progress > 0 && progress < 100;

        return `
            <div class="course-card-list" data-course-id="${course.id}">
                <div class="course-card-list-image">
                    <div class="course-card-badge-modern ${isCompleted ? 'completed' : isInProgress ? 'in-progress' : ''}">
                        ${isCompleted ? '✓' : isInProgress ? `${progress}%` : 'New'}
                    </div>
                </div>
                <div class="course-card-list-content">
                    <h3 class="course-card-title-modern">${course.title || 'Untitled Course'}</h3>
                    <p class="course-card-description-modern">${course.description || 'No description available'}</p>
                    ${isInProgress || isCompleted ? `
                        <div class="course-card-progress-modern">
                            <div class="progress-bar progress-bar-small">
                                <div class="progress-bar-fill" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text-small">${progress}% Complete</span>
                        </div>
                    ` : ''}
                </div>
                <div class="course-card-list-actions">
                    <a href="#/courses/${course.id}" class="btn btn-secondary btn-sm">Details</a>
                    <a href="#/courses/${course.id}/learn" class="btn btn-primary btn-sm">${isCompleted ? 'Review' : isInProgress ? 'Continue' : 'Start'}</a>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Status filter
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', async (e) => {
                this.filters.status = e.target.value;
                await this.render();
            });
        }

        // Sort filter
        const sortFilter = document.getElementById('sort-filter');
        if (sortFilter) {
            sortFilter.addEventListener('change', async (e) => {
                this.filters.sort = e.target.value;
                await this.render();
            });
        }

        // View toggle
        const viewToggleBtns = this.container.querySelectorAll('.view-toggle-btn');
        viewToggleBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const view = btn.getAttribute('data-view');
                this.viewMode = view;
                await this.render();
            });
        });

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', async () => {
                this.filters = {
                    status: 'all',
                    sort: 'recent'
                };
                await this.render();
            });
        }

        // Course cards (only for grid view, list view uses links)
        const courseCards = this.container.querySelectorAll('.course-card-modern');
        courseCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't navigate if clicking on a button
                if (e.target.closest('.btn')) {
                    return;
                }
                const courseId = card.getAttribute('data-course-id');
                this.handleCourseClick(courseId);
            });
        });
    }

    /**
     * Handle course click
     */
    handleCourseClick(courseId) {
        if (courseId) {
            router.navigate(`/courses/${courseId}`);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#course-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;';
        }
    }
}

export default CourseListing;

