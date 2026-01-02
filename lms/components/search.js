/**
 * Global Search Component
 * 
 * Provides universal search functionality with keyboard shortcut (Cmd/Ctrl + K).
 */

import { courseService } from '../services/course-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';

class GlobalSearch {
    constructor() {
        this.isOpen = false;
        this.searchQuery = '';
        this.results = {
            courses: [],
            users: [],
            submissions: []
        };
        this.searchHistory = this.loadSearchHistory();
        this.currentUser = null;
    }

    /**
     * Initialize search component
     */
    async init() {
        try {
            this.currentUser = await authService.getCurrentUser();
        } catch (error) {
            console.warn('[GlobalSearch] Failed to get current user:', error);
        }

        // Add keyboard shortcut listener
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Toggle search modal
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open search modal
     */
    open() {
        this.isOpen = true;
        this.render();
        this.attachEventListeners();
        
        // Focus search input
        setTimeout(() => {
            const input = document.getElementById('global-search-input');
            if (input) {
                input.focus();
            }
        }, 100);
    }

    /**
     * Close search modal
     */
    close() {
        this.isOpen = false;
        const modal = document.getElementById('global-search-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Render search modal
     */
    render() {
        // Remove existing modal if any
        const existing = document.getElementById('global-search-modal');
        if (existing) {
            existing.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'global-search-modal';
        modal.className = 'global-search-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Search');
        modal.innerHTML = `
            <div class="search-modal-backdrop" id="search-backdrop" aria-hidden="true"></div>
            <div class="search-modal-container">
                <div class="search-modal-header">
                    <div class="search-input-wrapper">
                        <label for="global-search-input" class="sr-only">Search</label>
                        <span class="search-icon" aria-hidden="true">🔍</span>
                        <input 
                            type="text" 
                            id="global-search-input" 
                            class="search-input-large" 
                            placeholder="Search courses, users, submissions..."
                            autocomplete="off"
                            aria-label="Search courses, users, and submissions"
                            aria-describedby="search-shortcut-hint"
                        >
                        <kbd class="search-shortcut-hint" id="search-shortcut-hint" aria-label="Press Command K or Control K to open search">⌘K</kbd>
                    </div>
                    <button class="search-close-btn" id="search-close-btn" aria-label="Close search dialog">
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>
                <div class="search-results-container" id="search-results" role="region" aria-label="Search results">
                    ${this.renderInitialState()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modal.classList.add('open');
        }, 10);
    }

    /**
     * Render initial state (before search)
     */
    renderInitialState() {
        if (this.searchHistory.length > 0) {
            return `
                <div class="search-initial-state">
                    <div class="search-section">
                        <div class="search-section-title">Recent Searches</div>
                        <div class="search-history-list">
                            ${this.searchHistory.slice(0, 5).map(term => `
                                <button class="search-history-item" data-term="${this.escapeHtml(term)}">
                                    <span class="history-icon">🕒</span>
                                    <span class="history-term">${this.escapeHtml(term)}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="search-section">
                        <div class="search-section-title">Quick Actions</div>
                        <div class="quick-actions-list">
                            <button class="quick-action-item" data-action="courses">
                                <span class="action-icon">📚</span>
                                <span class="action-label">My Courses</span>
                            </button>
                            <button class="quick-action-item" data-action="dashboard">
                                <span class="action-icon">🏠</span>
                                <span class="action-label">Go to Dashboard</span>
                            </button>
                            ${this.currentUser?.role === 'admin' ? `
                                <button class="quick-action-item" data-action="admin">
                                    <span class="action-icon">⚙️</span>
                                    <span class="action-label">Admin Dashboard</span>
                                </button>
                            ` : ''}
                            ${this.currentUser?.role === 'trainer' ? `
                                <button class="quick-action-item" data-action="trainer">
                                    <span class="action-icon">👨‍🏫</span>
                                    <span class="action-label">Trainer Dashboard</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="search-initial-state">
                <div class="search-empty-state">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-text">Start typing to search</div>
                    <p class="empty-description">Search for courses, users, or submissions</p>
                </div>
            </div>
        `;
    }

    /**
     * Render search results
     */
    renderResults() {
        const hasResults = this.results.courses.length > 0 || 
                          this.results.users.length > 0 || 
                          this.results.submissions.length > 0;

        if (!hasResults && this.searchQuery.trim()) {
            return `
                <div class="search-no-results">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-text">No results found</div>
                    <p class="empty-description">Try a different search term</p>
                </div>
            `;
        }

        if (!this.searchQuery.trim()) {
            return this.renderInitialState();
        }

        return `
            <div class="search-results">
                ${this.results.courses.length > 0 ? `
                    <div class="search-results-section">
                        <div class="results-section-header">
                            <span class="results-icon">📚</span>
                            <span class="results-title">Courses (${this.results.courses.length})</span>
                        </div>
                        <div class="results-list">
                            ${this.results.courses.map(course => `
                                <a href="#/courses/${course.id}" class="result-item" data-type="course">
                                    <div class="result-icon">📚</div>
                                    <div class="result-content">
                                        <div class="result-title">${this.highlightMatch(course.title, this.searchQuery)}</div>
                                        <div class="result-meta">Course</div>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${this.results.users.length > 0 ? `
                    <div class="search-results-section">
                        <div class="results-section-header">
                            <span class="results-icon">👥</span>
                            <span class="results-title">Users (${this.results.users.length})</span>
                        </div>
                        <div class="results-list">
                            ${this.results.users.map(user => `
                                <a href="#/admin/users/${user.id}" class="result-item" data-type="user">
                                    <div class="result-icon">👤</div>
                                    <div class="result-content">
                                        <div class="result-title">${this.highlightMatch(user.full_name || user.name || user.email, this.searchQuery)}</div>
                                        <div class="result-meta">${user.email} • ${this.getRoleLabel(user.role)}</div>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${this.results.submissions.length > 0 ? `
                    <div class="search-results-section">
                        <div class="results-section-header">
                            <span class="results-icon">📝</span>
                            <span class="results-title">Submissions (${this.results.submissions.length})</span>
                        </div>
                        <div class="results-list">
                            ${this.results.submissions.map(submission => `
                                <a href="#/submissions/${submission.id}" class="result-item" data-type="submission">
                                    <div class="result-icon">📝</div>
                                    <div class="result-content">
                                        <div class="result-title">${this.escapeHtml(submission.course_id)} - Lab ${this.escapeHtml(submission.lab_id)}</div>
                                        <div class="result-meta">${this.getSubmissionStatusLabel(submission.status)}</div>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Perform search
     */
    async performSearch(query) {
        this.searchQuery = query.trim();

        if (!this.searchQuery) {
            this.results = { courses: [], users: [], submissions: [] };
            this.updateResults();
            return;
        }

        // Save to search history
        this.addToSearchHistory(this.searchQuery);

        try {
            // Search courses
            // For learners, only search their allocated courses
            // For trainers and admins, search all courses
            let coursesToSearch = [];
            if (this.currentUser?.role === 'learner') {
                console.log('[GlobalSearch] Learner search - getting allocated courses');
                coursesToSearch = await courseService.getCourses(this.currentUser.id);
            } else {
                console.log('[GlobalSearch] Admin/Trainer search - getting all courses');
                coursesToSearch = await courseService.getAllCourses();
            }
            
            console.log('[GlobalSearch] Courses to search:', coursesToSearch.length);
            console.log('[GlobalSearch] Search query:', this.searchQuery);
            
            // Log first few course titles for debugging
            if (coursesToSearch.length > 0) {
                console.log('[GlobalSearch] Sample course titles:', coursesToSearch.slice(0, 3).map(c => c.title));
            }
            
            const query = this.searchQuery.toLowerCase().trim();
            this.results.courses = coursesToSearch.filter(course => {
                const title = (course.title || '').toLowerCase();
                const description = (course.description || '').toLowerCase();
                const matches = title.includes(query) || description.includes(query);
                if (matches) {
                    console.log('[GlobalSearch] Course match found:', course.title, 'Query:', query);
                }
                return matches;
            }).slice(0, 5);
            
            console.log('[GlobalSearch] Filtered courses count:', this.results.courses.length);
            if (this.results.courses.length === 0 && coursesToSearch.length > 0) {
                console.warn('[GlobalSearch] No courses matched query. Available courses:', coursesToSearch.map(c => c.title));
            }

            // Search users (only for admins)
            if (this.currentUser?.role === 'admin') {
                try {
                    const { adminService } = await import('../services/admin-service.js');
                    const allUsers = await adminService.getAllUsers();
                    this.results.users = allUsers.filter(user => {
                        const name = ((user.full_name || user.name || '') + ' ' + (user.email || '')).toLowerCase();
                        const query = this.searchQuery.toLowerCase();
                        return name.includes(query);
                    }).slice(0, 5);
                } catch (error) {
                    console.warn('[GlobalSearch] Failed to search users:', error);
                    this.results.users = [];
                }
            }

            // Search submissions (for learners and trainers)
            if (this.currentUser?.role === 'learner' || this.currentUser?.role === 'trainer') {
                try {
                    const { labSubmissionService } = await import('../services/lab-submission-service.js');
                    if (this.currentUser.role === 'learner') {
                        const allSubmissions = await labSubmissionService.getAllSubmissionsForLearner(this.currentUser.id);
                        this.results.submissions = allSubmissions.filter(submission => {
                            const course = (submission.course_id || '').toLowerCase();
                            const lab = (submission.lab_id || '').toLowerCase();
                            const query = this.searchQuery.toLowerCase();
                            return course.includes(query) || lab.includes(query);
                        }).slice(0, 5);
                    } else {
                        // For trainers, search their assigned learners' submissions
                        const submissions = await labSubmissionService.getSubmissionsForReview(this.currentUser.id);
                        this.results.submissions = submissions.filter(submission => {
                            const course = (submission.course_id || '').toLowerCase();
                            const lab = (submission.lab_id || '').toLowerCase();
                            const query = this.searchQuery.toLowerCase();
                            return course.includes(query) || lab.includes(query);
                        }).slice(0, 5);
                    }
                } catch (error) {
                    console.warn('[GlobalSearch] Failed to search submissions:', error);
                    this.results.submissions = [];
                }
            }

            this.updateResults();
        } catch (error) {
            console.error('[GlobalSearch] Search error:', error);
            this.updateResults();
        }
    }

    /**
     * Update results display
     */
    updateResults() {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = this.renderResults();
            this.attachResultListeners();
        }
    }

    /**
     * Highlight search match in text
     */
    highlightMatch(text, query) {
        if (!query || !text) return this.escapeHtml(text);
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return this.escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get role label
     */
    getRoleLabel(role) {
        const labels = {
            'learner': 'Learner',
            'trainer': 'Trainer',
            'admin': 'Administrator'
        };
        return labels[role] || role;
    }

    /**
     * Get submission status label
     */
    getSubmissionStatusLabel(status) {
        const labels = {
            'submitted': 'Submitted',
            'reviewed': 'Reviewed',
            'approved': 'Approved',
            'needs_revision': 'Needs Revision'
        };
        return labels[status] || status;
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
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        const closeBtn = document.getElementById('search-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Backdrop click
        const backdrop = document.getElementById('search-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.close());
        }

        // Search input
        const input = document.getElementById('global-search-input');
        if (input) {
            input.addEventListener('input', (e) => {
                this.performSearch(e.target.value);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const firstResult = document.querySelector('.result-item');
                    if (firstResult) {
                        firstResult.click();
                    }
                }
            });
        }

        // Search history items
        const historyItems = document.querySelectorAll('.search-history-item');
        historyItems.forEach(item => {
            item.addEventListener('click', () => {
                const term = item.getAttribute('data-term');
                if (input) {
                    input.value = term;
                    this.performSearch(term);
                }
            });
        });

        // Quick action items
        const quickActions = document.querySelectorAll('.quick-action-item');
        quickActions.forEach(item => {
            item.addEventListener('click', () => {
                const action = item.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });
    }

    /**
     * Attach result item listeners
     */
    attachResultListeners() {
        const resultItems = document.querySelectorAll('.result-item');
        resultItems.forEach(item => {
            item.addEventListener('click', () => {
                this.close();
            });
        });
    }

    /**
     * Handle quick action
     */
    handleQuickAction(action) {
        this.close();
        switch (action) {
            case 'courses':
                // For learners, navigate to their allocated courses
                if (this.currentUser?.role === 'learner') {
                    router.navigate('/courses/my-courses');
                } else {
                    router.navigate('/courses');
                }
                break;
            case 'dashboard':
                if (this.currentUser?.role === 'admin') {
                    router.navigate('/admin/dashboard');
                } else if (this.currentUser?.role === 'trainer') {
                    router.navigate('/trainer/dashboard');
                } else {
                    router.navigate('/dashboard');
                }
                break;
            case 'admin':
                router.navigate('/admin/dashboard');
                break;
            case 'trainer':
                router.navigate('/trainer/dashboard');
                break;
        }
    }

    /**
     * Add to search history
     */
    addToSearchHistory(term) {
        if (!term || term.trim().length === 0) return;
        
        // Remove if already exists
        this.searchHistory = this.searchHistory.filter(t => t.toLowerCase() !== term.toLowerCase());
        
        // Add to beginning
        this.searchHistory.unshift(term.trim());
        
        // Keep only last 10
        this.searchHistory = this.searchHistory.slice(0, 10);
        
        // Save to localStorage
        try {
            localStorage.setItem('search_history', JSON.stringify(this.searchHistory));
        } catch (error) {
            console.warn('[GlobalSearch] Failed to save search history:', error);
        }
    }

    /**
     * Load search history
     */
    loadSearchHistory() {
        try {
            const stored = localStorage.getItem('search_history');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('[GlobalSearch] Failed to load search history:', error);
            return [];
        }
    }
}

// Create singleton instance
const globalSearch = new GlobalSearch();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        globalSearch.init();
    });
} else {
    globalSearch.init();
}

export default globalSearch;

