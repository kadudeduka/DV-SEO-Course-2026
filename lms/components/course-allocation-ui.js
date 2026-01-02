/**
 * Course Allocation UI Component
 * 
 * Allows trainers to allocate courses to their assigned learners.
 */

import { courseAllocationService } from '../services/course-allocation-service.js';
import { courseService } from '../services/course-service.js';
import { authService } from '../services/auth-service.js';
import { supabaseClient } from '../services/supabase-client.js';
import Header from './header.js';

class CourseAllocationUI {
    constructor(container) {
        this.container = container;
        this.assignedLearners = [];
        this.allCourses = [];
        this.selectedLearner = null;
        this.allocatedCourses = [];
        this.currentUser = null;
        this.filteredLearners = [];
        this.selectedLearnerIds = new Set();
        this.searchQuery = '';
        this.filterStatus = 'all'; // 'all', 'with-courses', 'without-courses'
        this.registrationDateFrom = '';
        this.registrationDateTo = '';
    }

    /**
     * Show course allocation interface
     */
    async show() {
        try {
            console.log('[CourseAllocationUI] ===== show() STARTED =====');
            console.log('[CourseAllocationUI] Container:', this.container);
            
            // Ensure container is visible
            if (!this.container) {
                console.error('[CourseAllocationUI] Container is null!');
                throw new Error('Container not found');
            }
            
            console.log('[CourseAllocationUI] Setting container display to block');
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
            console.log('[CourseAllocationUI] Container display:', this.container.style.display);
            
            // Render header
            try {
                console.log('[CourseAllocationUI] Rendering header...');
                await this.renderHeader();
                console.log('[CourseAllocationUI] Header rendered');
            } catch (error) {
                console.error('[CourseAllocationUI] Error rendering header:', error);
                // Continue even if header fails
            }
            
            console.log('[CourseAllocationUI] Rendering loading state...');
            this.renderLoading();
            console.log('[CourseAllocationUI] Loading state rendered');
            
            console.log('[CourseAllocationUI] Getting current user...');
            this.currentUser = await authService.getCurrentUser();
            console.log('[CourseAllocationUI] Current user:', this.currentUser);
            
            if (!this.currentUser || !this.currentUser.id) {
                throw new Error('Authentication required');
            }

            console.log('[CourseAllocationUI] Loading assigned learners...');
            await this.loadAssignedLearners();
            console.log('[CourseAllocationUI] Loaded', this.assignedLearners.length, 'learners');

            console.log('[CourseAllocationUI] Loading all courses...');
            await this.loadAllCourses();
            console.log('[CourseAllocationUI] Loaded', this.allCourses.length, 'courses');

            console.log('[CourseAllocationUI] Rendering main interface...');
            await this.render();
            console.log('[CourseAllocationUI] Render completed');
            
            console.log('[CourseAllocationUI] ===== show() COMPLETED =====');
        } catch (error) {
            console.error('[CourseAllocationUI] ===== ERROR in show() =====');
            console.error('[CourseAllocationUI] Error:', error);
            console.error('[CourseAllocationUI] Error message:', error.message);
            console.error('[CourseAllocationUI] Error stack:', error.stack);
            this.renderError('Failed to load data: ' + error.message);
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
     * Load assigned learners
     */
    async loadAssignedLearners() {
        try {
            console.log('[CourseAllocationUI] Loading learners for trainer:', this.currentUser.id);
            console.log('[CourseAllocationUI] Current user:', this.currentUser);
            
            const { data, error } = await supabaseClient
                .from('users')
                .select('id, full_name, email, role, trainer_id, status, learner_type, created_at')
                .eq('trainer_id', this.currentUser.id)
                .eq('role', 'learner')
                .eq('learner_type', 'active') // Only Active learners
                .order('full_name', { ascending: true });

            if (error) {
                console.error('[CourseAllocationUI] Error loading learners:', error);
                throw new Error('Failed to load assigned learners: ' + error.message);
            }

            console.log('[CourseAllocationUI] Raw query result:', data);
            console.log('[CourseAllocationUI] Number of learners found:', data?.length || 0);
            
            // Also check if there are any learners with this trainer_id regardless of role
            const { data: allUsers, error: allUsersError } = await supabaseClient
                .from('users')
                .select('id, full_name, email, role, trainer_id, status')
                .eq('trainer_id', this.currentUser.id);
            
            console.log('[CourseAllocationUI] All users with trainer_id:', allUsers);
            
            this.assignedLearners = data || [];
            console.log('[CourseAllocationUI] Assigned learners set to:', this.assignedLearners);
        } catch (error) {
            console.error('[CourseAllocationUI] Failed to load assigned learners:', error);
            this.assignedLearners = [];
        }
    }

    /**
     * Load all available courses
     */
    async loadAllCourses() {
        try {
            this.allCourses = await courseService.getCourses();
        } catch (error) {
            console.error('Failed to load courses:', error);
            this.allCourses = [];
        }
    }

    /**
     * Load allocated courses for selected learner
     */
    async loadAllocatedCourses() {
        if (!this.selectedLearner) {
            this.allocatedCourses = [];
            return;
        }

        try {
            const allocations = await courseAllocationService.getAllocatedCourses(this.selectedLearner.id);
            this.allocatedCourses = allocations.map(a => a.course_id);
        } catch (error) {
            console.error('Failed to load allocated courses:', error);
            this.allocatedCourses = [];
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        console.log('[CourseAllocationUI] renderLoading() called, container:', this.container);
        if (!this.container) {
            console.error('[CourseAllocationUI] Container is null in renderLoading()!');
            return;
        }
        this.container.style.display = 'block';
        this.container.style.visibility = 'visible';
        this.container.style.opacity = '1';
        this.container.innerHTML = `
            <div class="course-allocation-ui" style="padding: 20px; max-width: 1400px; margin: 0 auto;">
                <h2>Course Allocation</h2>
                <p>Loading...</p>
            </div>
        `;
        console.log('[CourseAllocationUI] Loading HTML rendered, innerHTML length:', this.container.innerHTML.length);
    }

    /**
     * Render main interface
     */
    async render() {
        console.log('[CourseAllocationUI] Rendering with', this.assignedLearners.length, 'learners and', this.allCourses.length, 'courses');
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            console.log('[CourseAllocationUI] Container display set to block');
        } else {
            console.error('[CourseAllocationUI] Container is null in render()!');
            return;
        }
        
        console.log('[CourseAllocationUI] Generating HTML...');
        try {
            // Apply filters (async)
            await this.applyFilters();
            
            const learnersListHtml = this.renderLearnersList();
            const coursesSectionHtml = this.renderCoursesSection();
            const bulkActionsHtml = this.renderBulkActions();
            
            const html = `
                <div class="course-allocation-ui">
                    <h2 class="page-title">Course Allocation</h2>
                    <div id="allocation-error" class="error-message" style="display: none;"></div>
                    <div id="allocation-success" class="success-message" style="display: none;"></div>
                    
                    <!-- Search and Filter Section -->
                    <div class="filters-section">
                        <div class="filters-grid">
                            <div class="filter-group">
                                <label class="filter-label">Search Learners</label>
                                <input type="text" id="learner-search" placeholder="Search by name or email..." 
                                       value="${this.searchQuery}"
                                       class="filter-input">
                            </div>
                            <div class="filter-group">
                                <label class="filter-label">Filter by Courses</label>
                                <select id="learner-filter" class="filter-input">
                                    <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Learners</option>
                                    <option value="with-courses" ${this.filterStatus === 'with-courses' ? 'selected' : ''}>With Courses</option>
                                    <option value="without-courses" ${this.filterStatus === 'without-courses' ? 'selected' : ''}>Without Courses</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label class="filter-label">Registered From</label>
                                <input type="date" id="registration-date-from" 
                                       value="${this.registrationDateFrom}"
                                       class="filter-input">
                            </div>
                            <div class="filter-group">
                                <label class="filter-label">Registered To</label>
                                <input type="date" id="registration-date-to" 
                                       value="${this.registrationDateTo}"
                                       class="filter-input">
                            </div>
                        </div>
                        <div>
                            <button id="clear-filters" class="btn btn-secondary btn-sm">
                                Clear Filters
                            </button>
                        </div>
                    </div>
                    
                    <!-- Bulk Actions Bar -->
                    ${bulkActionsHtml}
                    
                    <div class="two-column-layout">
                        <div class="column-left">
                            <div class="section-header">
                                <h3 class="section-heading">Assigned Learners</h3>
                                <span class="section-count">
                                    ${this.filteredLearners.length} of ${this.assignedLearners.length} learners
                                </span>
                            </div>
                            <div id="learners-list">
                                ${learnersListHtml}
                            </div>
                        </div>
                        <div class="column-right">
                            <div id="courses-section">
                                ${coursesSectionHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            console.log('[CourseAllocationUI] HTML generated, length:', html.length);
            console.log('[CourseAllocationUI] Setting innerHTML...');
            this.container.innerHTML = html;
        } catch (error) {
            console.error('[CourseAllocationUI] Error generating HTML:', error);
            throw error;
        }
        console.log('[CourseAllocationUI] innerHTML set, length:', this.container.innerHTML.length);
        console.log('[CourseAllocationUI] Attaching event listeners...');
        this.attachEventListeners();
        console.log('[CourseAllocationUI] ===== render() COMPLETED =====');
    }

    /**
     * Apply filters to learners list
     */
    async applyFilters() {
        this.filteredLearners = this.assignedLearners.filter(learner => {
            // Search filter (name or email)
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                const nameMatch = (learner.full_name || '').toLowerCase().includes(query);
                const emailMatch = (learner.email || '').toLowerCase().includes(query);
                if (!nameMatch && !emailMatch) {
                    return false;
                }
            }
            
            // Registration date filter
            if (this.registrationDateFrom || this.registrationDateTo) {
                const registrationDate = learner.created_at ? new Date(learner.created_at) : null;
                if (!registrationDate) {
                    return false; // Exclude learners without registration date
                }
                
                if (this.registrationDateFrom) {
                    const fromDate = new Date(this.registrationDateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (registrationDate < fromDate) {
                        return false;
                    }
                }
                
                if (this.registrationDateTo) {
                    const toDate = new Date(this.registrationDateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (registrationDate > toDate) {
                        return false;
                    }
                }
            }
            
            return true;
        });
        
        // Apply course status filter if needed (requires async check)
        if (this.filterStatus === 'with-courses' || this.filterStatus === 'without-courses') {
            // We'll need to check allocations for each learner
            // For now, we'll filter this in a separate step after checking allocations
            const filteredWithAllocations = [];
            
            for (const learner of this.filteredLearners) {
                try {
                    const allocations = await courseAllocationService.getAllocatedCourses(learner.id);
                    const hasCourses = allocations && allocations.length > 0;
                    
                    if (this.filterStatus === 'with-courses' && hasCourses) {
                        filteredWithAllocations.push(learner);
                    } else if (this.filterStatus === 'without-courses' && !hasCourses) {
                        filteredWithAllocations.push(learner);
                    } else if (this.filterStatus === 'all') {
                        filteredWithAllocations.push(learner);
                    }
                } catch (error) {
                    console.error(`[CourseAllocationUI] Error checking allocations for learner ${learner.id}:`, error);
                    // Include learner if we can't check (fail open)
                    if (this.filterStatus === 'all') {
                        filteredWithAllocations.push(learner);
                    }
                }
            }
            
            this.filteredLearners = filteredWithAllocations;
        }
    }
    
    /**
     * Render bulk actions bar
     */
    renderBulkActions() {
        if (this.selectedLearnerIds.size === 0) {
            return '';
        }
        
        return `
            <div id="bulk-actions-bar" class="bulk-actions-bar">
                <div class="bulk-actions-content">
                    <span class="bulk-actions-count">
                        ${this.selectedLearnerIds.size} learner(s) selected
                    </span>
                    <button id="bulk-allocate-course" class="bulk-action-btn btn btn-success btn-sm">
                        Allocate Course to Selected
                    </button>
                    <button id="clear-selection" class="btn btn-secondary btn-sm">
                        Clear Selection
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render learners list
     */
    renderLearnersList() {
        if (this.assignedLearners.length === 0) {
            return '<p class="empty-state-text">No assigned learners</p>';
        }
        
        if (this.filteredLearners.length === 0) {
            return '<p class="empty-state-text">No learners match the search criteria</p>';
        }

        return `
            <div class="learners-list-container">
                <div class="select-all-section">
                    <label class="select-all-label">
                        <input type="checkbox" id="select-all-learners" class="checkbox-input">
                        <span class="select-all-text">Select All</span>
                    </label>
                </div>
                <ul class="learners-list">
                    ${this.filteredLearners.map(learner => {
                        const isSelected = this.selectedLearner && this.selectedLearner.id === learner.id;
                        const isChecked = this.selectedLearnerIds.has(learner.id);
                        return `
                            <li class="learner-item ${isSelected ? 'selected' : ''}">
                                <div class="learner-item-content">
                                    <input type="checkbox" 
                                           class="learner-checkbox checkbox-input" 
                                           data-learner-id="${learner.id}"
                                           ${isChecked ? 'checked' : ''}>
                                    <a href="#" 
                                       class="learner-link" 
                                       data-learner-id="${learner.id}">
                                        <div class="learner-name">
                                            ${learner.full_name || learner.email || 'Unknown Learner'}
                                        </div>
                                        <div class="learner-email">
                                            ${learner.email}
                                        </div>
                                    </a>
                                </div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Render courses section
     */
    renderCoursesSection() {
        if (!this.selectedLearner) {
            return '<p class="empty-state-text">Select a learner to view courses</p>';
        }

        return `
            <div class="courses-section">
                <h3 class="section-heading">
                    Courses for ${this.selectedLearner.full_name || this.selectedLearner.email}
                </h3>
                <div class="courses-subsection">
                    <h4 class="subsection-title">Allocated Courses</h4>
                    <div id="allocated-courses-list">
                        ${this.renderAllocatedCourses()}
                    </div>
                </div>
                <div class="courses-subsection">
                    <h4 class="subsection-title">Available Courses</h4>
                    <div id="available-courses-list">
                        ${this.renderAvailableCourses()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render allocated courses
     */
    renderAllocatedCourses() {
        const allocatedCourseObjects = this.allCourses.filter(course => 
            this.allocatedCourses.includes(course.id)
        );

        if (allocatedCourseObjects.length === 0) {
            return '<p class="empty-state-text-small">No courses allocated</p>';
        }

        return `
            <ul class="courses-list">
                ${allocatedCourseObjects.map(course => `
                    <li class="course-item course-item-allocated">
                        <div class="course-item-content">
                            <div class="course-item-info">
                                <div class="course-item-title">${course.title || 'Untitled Course'}</div>
                                <div class="course-item-description">${course.description || 'No description'}</div>
                            </div>
                            <button 
                                class="remove-course-btn btn btn-danger btn-xs" 
                                data-course-id="${course.id}">
                                Remove
                            </button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    /**
     * Render available courses
     */
    renderAvailableCourses() {
        const availableCourseObjects = this.allCourses.filter(course => 
            !this.allocatedCourses.includes(course.id)
        );

        if (availableCourseObjects.length === 0) {
            return '<p class="empty-state-text-small">No available courses</p>';
        }

        return `
            <ul class="courses-list">
                ${availableCourseObjects.map(course => `
                    <li class="course-item">
                        <div class="course-item-content">
                            <div class="course-item-info">
                                <div class="course-item-title">${course.title || 'Untitled Course'}</div>
                                <div class="course-item-description">${course.description || 'No description'}</div>
                            </div>
                            <button 
                                class="allocate-course-btn btn btn-success btn-xs" 
                                data-course-id="${course.id}">
                                Allocate
                            </button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        console.log('[CourseAllocationUI] Attaching event listeners...');
        
        // Search input
        const searchInput = this.container.querySelector('#learner-search');
        if (searchInput) {
            searchInput.addEventListener('input', async (e) => {
                console.log('[CourseAllocationUI] Search input changed:', e.target.value);
                this.searchQuery = e.target.value;
                await this.applyFilters();
                this.updateLearnersList();
            });
        }

        // Filter dropdown
        const filterSelect = this.container.querySelector('#learner-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', async (e) => {
                console.log('[CourseAllocationUI] Filter changed:', e.target.value);
                this.filterStatus = e.target.value;
                await this.applyFilters();
                this.updateLearnersList();
            });
        }

        // Registration date from
        const dateFromInput = this.container.querySelector('#registration-date-from');
        if (dateFromInput) {
            dateFromInput.addEventListener('change', async (e) => {
                console.log('[CourseAllocationUI] Date from changed:', e.target.value);
                this.registrationDateFrom = e.target.value;
                await this.applyFilters();
                this.updateLearnersList();
            });
        }

        // Registration date to
        const dateToInput = this.container.querySelector('#registration-date-to');
        if (dateToInput) {
            dateToInput.addEventListener('change', async (e) => {
                console.log('[CourseAllocationUI] Date to changed:', e.target.value);
                this.registrationDateTo = e.target.value;
                await this.applyFilters();
                this.updateLearnersList();
            });
        }

        // Clear filters button
        const clearFiltersBtn = this.container.querySelector('#clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', async () => {
                console.log('[CourseAllocationUI] Clear filters clicked');
                this.searchQuery = '';
                this.filterStatus = 'all';
                this.registrationDateFrom = '';
                this.registrationDateTo = '';
                if (searchInput) searchInput.value = '';
                if (filterSelect) filterSelect.value = 'all';
                if (dateFromInput) dateFromInput.value = '';
                if (dateToInput) dateToInput.value = '';
                await this.applyFilters();
                this.updateLearnersList();
            });
        }

        // Select all checkbox
        const selectAll = this.container.querySelector('#select-all-learners');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checkboxes = this.container.querySelectorAll('.learner-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    const learnerId = cb.getAttribute('data-learner-id');
                    if (e.target.checked) {
                        this.selectedLearnerIds.add(learnerId);
                    } else {
                        this.selectedLearnerIds.delete(learnerId);
                    }
                });
                this.updateBulkActions();
            });
        }

        // Individual learner checkboxes
        const learnerCheckboxes = this.container.querySelectorAll('.learner-checkbox');
        learnerCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const learnerId = checkbox.getAttribute('data-learner-id');
                if (e.target.checked) {
                    this.selectedLearnerIds.add(learnerId);
                } else {
                    this.selectedLearnerIds.delete(learnerId);
                }
                this.updateBulkActions();
            });
        });

        // Learner links (for selecting individual learner)
        const learnerLinks = this.container.querySelectorAll('.learner-link');
        learnerLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const learnerId = link.getAttribute('data-learner-id');
                await this.handleLearnerSelect(learnerId);
            });
        });

        // Bulk allocate button
        const bulkAllocateBtn = this.container.querySelector('#bulk-allocate-course');
        if (bulkAllocateBtn) {
            bulkAllocateBtn.addEventListener('click', () => {
                this.handleBulkAllocateCourse();
            });
        }

        // Clear selection button
        const clearSelectionBtn = this.container.querySelector('#clear-selection');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => {
                this.selectedLearnerIds.clear();
                const checkboxes = this.container.querySelectorAll('.learner-checkbox');
                checkboxes.forEach(cb => cb.checked = false);
                if (selectAll) selectAll.checked = false;
                this.updateBulkActions();
            });
        }

        // Allocate course buttons
        const allocateButtons = this.container.querySelectorAll('.allocate-course-btn');
        allocateButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const courseId = button.getAttribute('data-course-id');
                await this.handleAllocateCourse(courseId, button);
            });
        });

        // Remove course buttons
        const removeButtons = this.container.querySelectorAll('.remove-course-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const courseId = button.getAttribute('data-course-id');
                await this.handleRemoveCourse(courseId, button);
            });
        });
        
        console.log('[CourseAllocationUI] Event listeners attached');
    }
    
    /**
     * Update learners list without full re-render
     */
    async updateLearnersList() {
        console.log('[CourseAllocationUI] Updating learners list...');
        const learnersListContainer = this.container.querySelector('#learners-list');
        const learnerCountSpan = this.container.querySelector('.course-allocation-ui h3 + span');
        
        if (learnersListContainer) {
            // Re-apply filters before rendering
            await this.applyFilters();
            console.log('[CourseAllocationUI] Filtered learners:', this.filteredLearners.length);
            
            // Update count display
            if (learnerCountSpan) {
                learnerCountSpan.textContent = `${this.filteredLearners.length} of ${this.assignedLearners.length} learners`;
            }
            
            learnersListContainer.innerHTML = this.renderLearnersList();
            
            // Re-attach only the listeners that need to be re-attached (for new elements)
            this.attachLearnerListListeners();
        } else {
            console.error('[CourseAllocationUI] Learners list container not found!');
        }
    }
    
    /**
     * Attach listeners only for learner list elements (to avoid duplicate listeners)
     */
    attachLearnerListListeners() {
        // Select all checkbox
        const selectAll = this.container.querySelector('#select-all-learners');
        if (selectAll) {
            // Remove old listener by cloning
            const newSelectAll = selectAll.cloneNode(true);
            selectAll.parentNode.replaceChild(newSelectAll, selectAll);
            newSelectAll.addEventListener('change', (e) => {
                const checkboxes = this.container.querySelectorAll('.learner-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    const learnerId = cb.getAttribute('data-learner-id');
                    if (e.target.checked) {
                        this.selectedLearnerIds.add(learnerId);
                    } else {
                        this.selectedLearnerIds.delete(learnerId);
                    }
                });
                this.updateBulkActions();
            });
        }

        // Individual learner checkboxes
        const learnerCheckboxes = this.container.querySelectorAll('.learner-checkbox');
        learnerCheckboxes.forEach(checkbox => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            newCheckbox.addEventListener('change', (e) => {
                const learnerId = newCheckbox.getAttribute('data-learner-id');
                if (e.target.checked) {
                    this.selectedLearnerIds.add(learnerId);
                } else {
                    this.selectedLearnerIds.delete(learnerId);
                }
                this.updateBulkActions();
            });
        });

        // Learner links (for selecting individual learner)
        const learnerLinks = this.container.querySelectorAll('.learner-link');
        learnerLinks.forEach(link => {
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);
            newLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const learnerId = newLink.getAttribute('data-learner-id');
                await this.handleLearnerSelect(learnerId);
            });
        });
    }
    
    /**
     * Update bulk actions bar
     */
    updateBulkActions() {
        const bulkActionsContainer = this.container.querySelector('#bulk-actions-bar');
        const bulkActionsHtml = this.renderBulkActions();
        
        if (bulkActionsHtml && this.selectedLearnerIds.size > 0) {
            if (bulkActionsContainer) {
                bulkActionsContainer.outerHTML = bulkActionsHtml;
            } else {
                // Insert before the flex container
                const flexContainer = this.container.querySelector('.course-allocation-ui > div[style*="display: flex"]');
                if (flexContainer) {
                    flexContainer.insertAdjacentHTML('beforebegin', bulkActionsHtml);
                }
            }
            // Re-attach bulk action listeners
            const bulkAllocateBtn = this.container.querySelector('#bulk-allocate-course');
            if (bulkAllocateBtn) {
                bulkAllocateBtn.addEventListener('click', () => {
                    this.handleBulkAllocateCourse();
                });
            }
            const clearSelectionBtn = this.container.querySelector('#clear-selection');
            if (clearSelectionBtn) {
                clearSelectionBtn.addEventListener('click', () => {
                    this.selectedLearnerIds.clear();
                    const checkboxes = this.container.querySelectorAll('.learner-checkbox');
                    checkboxes.forEach(cb => cb.checked = false);
                    const selectAll = this.container.querySelector('#select-all-learners');
                    if (selectAll) selectAll.checked = false;
                    this.updateBulkActions();
                });
            }
        } else if (bulkActionsContainer) {
            bulkActionsContainer.remove();
        }
    }
    
    /**
     * Handle bulk course allocation
     */
    async handleBulkAllocateCourse() {
        const learnerIds = Array.from(this.selectedLearnerIds);
        if (learnerIds.length === 0) {
            this.showError('Please select at least one learner');
            return;
        }

        // Show course selection modal
        const courseOptions = this.allCourses.map(course => 
            `<option value="${course.id}">${course.title || 'Untitled Course'}</option>`
        ).join('');

        if (courseOptions === '') {
            this.showError('No courses available to allocate');
            return;
        }

        const courseId = prompt(`Select a course to allocate to ${learnerIds.length} learner(s):\n\n${this.allCourses.map((c, i) => `${i + 1}. ${c.title || 'Untitled Course'}`).join('\n')}\n\nEnter course number (1-${this.allCourses.length}):`);
        
        if (!courseId) {
            return; // User cancelled
        }

        const courseIndex = parseInt(courseId) - 1;
        if (isNaN(courseIndex) || courseIndex < 0 || courseIndex >= this.allCourses.length) {
            this.showError('Invalid course selection');
            return;
        }

        const selectedCourse = this.allCourses[courseIndex];
        const confirmMessage = `Allocate "${selectedCourse.title}" to ${learnerIds.length} selected learner(s)?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        // Show loading state
        const bulkAllocateBtn = this.container.querySelector('#bulk-allocate-course');
        if (bulkAllocateBtn) {
            bulkAllocateBtn.disabled = true;
            bulkAllocateBtn.textContent = 'Allocating...';
        }

        try {
            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            for (const learnerId of learnerIds) {
                try {
                    await courseAllocationService.allocateCourse(
                        this.currentUser.id,
                        learnerId,
                        selectedCourse.id
                    );
                    successCount++;
                } catch (error) {
                    errorCount++;
                    const learner = this.assignedLearners.find(l => l.id === learnerId);
                    errors.push(`${learner?.full_name || learner?.email || learnerId}: ${error.message}`);
                }
            }

            if (errorCount === 0) {
                this.showSuccess(`Successfully allocated "${selectedCourse.title}" to ${successCount} learner(s)`);
            } else {
                this.showError(`Allocated to ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
            }

            // Clear selection
            this.selectedLearnerIds.clear();
            const checkboxes = this.container.querySelectorAll('.learner-checkbox');
            checkboxes.forEach(cb => cb.checked = false);
            const selectAll = this.container.querySelector('#select-all-learners');
            if (selectAll) selectAll.checked = false;
            this.updateBulkActions();

            // Refresh the view if a learner is selected
            if (this.selectedLearner) {
                await this.loadAllocatedCourses();
                await this.render();
            }
        } catch (error) {
            this.showError('Failed to allocate courses: ' + error.message);
        } finally {
            if (bulkAllocateBtn) {
                bulkAllocateBtn.disabled = false;
                bulkAllocateBtn.textContent = 'Allocate Course to Selected';
            }
        }
    }

    /**
     * Handle learner selection
     */
    async handleLearnerSelect(learnerId) {
        this.selectedLearner = this.assignedLearners.find(l => l.id === learnerId);
        if (!this.selectedLearner) {
            return;
        }

        await this.loadAllocatedCourses();
        await this.render();
    }

    /**
     * Handle allocate course
     */
    async handleAllocateCourse(courseId, button) {
        if (!this.selectedLearner) {
            return;
        }

        button.disabled = true;
        button.textContent = 'Allocating...';

        try {
            await courseAllocationService.allocateCourse(
                this.currentUser.id,
                this.selectedLearner.id,
                courseId
            );

            this.showSuccess('Course allocated successfully');
            await this.loadAllocatedCourses();
            await this.render();
        } catch (error) {
            this.showError('Failed to allocate course: ' + error.message);
            button.disabled = false;
            button.textContent = 'Allocate';
        }
    }

    /**
     * Handle remove course allocation
     */
    async handleRemoveCourse(courseId, button) {
        if (!this.selectedLearner) {
            return;
        }

        button.disabled = true;
        button.textContent = 'Removing...';

        try {
            await courseAllocationService.removeAllocation(
                this.currentUser.id,
                this.selectedLearner.id,
                courseId
            );

            this.showSuccess('Course allocation removed successfully');
            await this.loadAllocatedCourses();
            await this.render();
        } catch (error) {
            this.showError('Failed to remove course allocation: ' + error.message);
            button.disabled = false;
            button.textContent = 'Remove';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#allocation-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;';
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const successDiv = this.container.querySelector('#allocation-success');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            successDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; border-radius: 3px;';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Render error state
     */
    renderError(message) {
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        this.container.innerHTML = `
            <div class="course-allocation-ui" style="padding: 20px; max-width: 1400px; margin: 0 auto;">
                <h2>Course Allocation</h2>
                <div class="error-message" style="padding: 15px; margin: 20px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;">
                    ${message}
                </div>
            </div>
        `;
    }
}

export default CourseAllocationUI;

