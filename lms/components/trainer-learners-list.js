/**
 * Trainer Learners List Component
 * 
 * Displays all learners assigned to the trainer with search, filter, and management capabilities.
 */

import { authService } from '../services/auth-service.js';
import { labSubmissionService } from '../services/lab-submission-service.js';
import { supabaseClient } from '../services/supabase-client.js';
import { router } from '../core/router.js';
import Header from './header.js';

class TrainerLearnersList {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.learners = [];
        this.filteredLearners = [];
        this.searchQuery = '';
        this.sortBy = 'name'; // 'name', 'email', 'submissions', 'recent'
        this.sortOrder = 'asc'; // 'asc', 'desc'
    }

    /**
     * Show learners list
     */
    async show() {
        if (this.container) {
            this.container.style.display = 'block';
        }

        await this.renderHeader();
        await this.loadData();
        this.render();
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
     * Load learners data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            const trainerId = this.currentUser.id;
            const learnerIds = await labSubmissionService.getAssignedLearnerIds(trainerId);

            if (learnerIds.length === 0) {
                this.learners = [];
                this.filteredLearners = [];
                return;
            }

            // Get learner details
            const { data, error } = await supabaseClient
                .from('users')
                .select('id, full_name, name, email, created_at, status')
                .in('id', learnerIds)
                .eq('role', 'learner')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            // Load statistics for each learner
            this.learners = await Promise.all(
                (data || []).map(async (learner) => {
                    try {
                        const submissions = await labSubmissionService.getAllSubmissionsForLearner(learner.id);
                        const pendingCount = submissions.filter(s => s.status === 'submitted').length;
                        const approvedCount = submissions.filter(s => s.status === 'approved').length;
                        const needsRevisionCount = submissions.filter(s => s.status === 'needs_revision').length;

                        // Get latest submission date
                        let latestSubmissionDate = null;
                        if (submissions.length > 0) {
                            const latest = submissions[0];
                            latestSubmissionDate = latest.submitted_at ? new Date(latest.submitted_at) : null;
                        }

                        return {
                            ...learner,
                            pendingSubmissions: pendingCount,
                            approvedSubmissions: approvedCount,
                            needsRevisionSubmissions: needsRevisionCount,
                            totalSubmissions: submissions.length,
                            latestSubmissionDate: latestSubmissionDate
                        };
                    } catch (error) {
                        console.warn(`[TrainerLearnersList] Failed to load stats for learner ${learner.id}:`, error);
                        return {
                            ...learner,
                            pendingSubmissions: 0,
                            approvedSubmissions: 0,
                            needsRevisionSubmissions: 0,
                            totalSubmissions: 0,
                            latestSubmissionDate: null
                        };
                    }
                })
            );

            this.filteredLearners = [...this.learners];
            this.applyFilters();
        } catch (error) {
            console.error('[TrainerLearnersList] Error loading data:', error);
            this.renderError('Failed to load learners: ' + error.message);
        }
    }

    /**
     * Apply search and sort filters
     */
    applyFilters() {
        // Apply search
        let filtered = [...this.learners];
        
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase().trim();
            filtered = filtered.filter(learner => {
                const name = (learner.full_name || learner.name || '').toLowerCase();
                const email = (learner.email || '').toLowerCase();
                return name.includes(query) || email.includes(query);
            });
        }

        // Apply sort
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (this.sortBy) {
                case 'name':
                    aValue = (a.full_name || a.name || a.email || '').toLowerCase();
                    bValue = (b.full_name || b.name || b.email || '').toLowerCase();
                    break;
                case 'email':
                    aValue = (a.email || '').toLowerCase();
                    bValue = (b.email || '').toLowerCase();
                    break;
                case 'submissions':
                    aValue = a.totalSubmissions || 0;
                    bValue = b.totalSubmissions || 0;
                    break;
                case 'recent':
                    aValue = a.latestSubmissionDate ? a.latestSubmissionDate.getTime() : 0;
                    bValue = b.latestSubmissionDate ? b.latestSubmissionDate.getTime() : 0;
                    break;
                default:
                    aValue = a.full_name || a.name || a.email || '';
                    bValue = b.full_name || b.name || b.email || '';
            }

            if (this.sortOrder === 'asc') {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            } else {
                return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
            }
        });

        this.filteredLearners = filtered;
    }

    /**
     * Render learners list
     */
    render() {
        this.container.innerHTML = `
            <div class="trainer-learners-page">
                <div class="learners-container">
                    <div class="learners-header">
                        <div>
                            <h1 class="learners-title">My Learners</h1>
                            <p class="learners-subtitle">Manage and track your assigned learners</p>
                        </div>
                        <div class="learners-actions">
                            <a href="#/trainer/dashboard" class="btn btn-ghost">
                                <span class="btn-icon">←</span>
                                <span>Back to Dashboard</span>
                            </a>
                        </div>
                    </div>

                    <div class="learners-filters">
                        <div class="search-box">
                            <input 
                                type="text" 
                                id="search-input" 
                                class="search-input" 
                                placeholder="Search by name or email..."
                                value="${this.escapeHtml(this.searchQuery)}"
                            >
                            <span class="search-icon">🔍</span>
                        </div>
                        <div class="sort-controls">
                            <label for="sort-select" class="sort-label">Sort by:</label>
                            <select id="sort-select" class="sort-select">
                                <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
                                <option value="email" ${this.sortBy === 'email' ? 'selected' : ''}>Email</option>
                                <option value="submissions" ${this.sortBy === 'submissions' ? 'selected' : ''}>Total Submissions</option>
                                <option value="recent" ${this.sortBy === 'recent' ? 'selected' : ''}>Recent Activity</option>
                            </select>
                            <button id="sort-order-btn" class="btn-icon sort-order-btn" title="Toggle sort order">
                                ${this.sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>

                    <div class="learners-stats-bar">
                        <div class="stat-item">
                            <span class="stat-label">Total Learners:</span>
                            <span class="stat-value">${this.learners.length}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Showing:</span>
                            <span class="stat-value">${this.filteredLearners.length}</span>
                        </div>
                    </div>

                    ${this.renderLearnersList()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render learners list
     */
    renderLearnersList() {
        if (this.filteredLearners.length === 0) {
            if (this.searchQuery.trim()) {
                return `
                    <div class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <div class="empty-text">No learners found</div>
                        <p class="empty-description">Try adjusting your search query</p>
                    </div>
                `;
            } else {
                return `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <div class="empty-text">No learners assigned</div>
                        <p class="empty-description">Learners will appear here once assigned to you by an administrator.</p>
                    </div>
                `;
            }
        }

        return `
            <div class="learners-list">
                ${this.filteredLearners.map(learner => this.renderLearnerCard(learner)).join('')}
            </div>
        `;
    }

    /**
     * Render individual learner card
     */
    renderLearnerCard(learner) {
        const learnerName = learner.full_name || learner.name || learner.email || 'Unknown';
        const statusConfig = this.getStatusConfig(learner.status);

        return `
            <div class="learner-card">
                <div class="learner-card-header">
                    <div class="learner-avatar-medium">
                        <span class="avatar-initials-medium">${this.getInitials(learnerName)}</span>
                    </div>
                    <div class="learner-info">
                        <div class="learner-name-large">${this.escapeHtml(learnerName)}</div>
                        <div class="learner-email">${this.escapeHtml(learner.email)}</div>
                        <div class="learner-meta">
                            <span class="learner-status-badge ${statusConfig.class}">
                                ${statusConfig.icon} ${statusConfig.label}
                            </span>
                            ${learner.created_at ? `
                                <span class="learner-joined">Joined ${new Date(learner.created_at).toLocaleDateString()}</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="learner-stats">
                    <div class="learner-stat-item">
                        <div class="stat-icon">📝</div>
                        <div class="stat-content">
                            <div class="stat-value">${learner.totalSubmissions}</div>
                            <div class="stat-label">Total Submissions</div>
                        </div>
                    </div>
                    <div class="learner-stat-item ${learner.pendingSubmissions > 0 ? 'stat-pending' : ''}">
                        <div class="stat-icon">⏳</div>
                        <div class="stat-content">
                            <div class="stat-value">${learner.pendingSubmissions}</div>
                            <div class="stat-label">Pending</div>
                        </div>
                    </div>
                    <div class="learner-stat-item ${learner.approvedSubmissions > 0 ? 'stat-approved' : ''}">
                        <div class="stat-icon">✓</div>
                        <div class="stat-content">
                            <div class="stat-value">${learner.approvedSubmissions}</div>
                            <div class="stat-label">Approved</div>
                        </div>
                    </div>
                    ${learner.needsRevisionSubmissions > 0 ? `
                        <div class="learner-stat-item stat-revision">
                            <div class="stat-icon">↻</div>
                            <div class="stat-content">
                                <div class="stat-value">${learner.needsRevisionSubmissions}</div>
                                <div class="stat-label">Needs Revision</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="learner-actions">
                    <a href="#/reports/trainer/learner/${learner.id}" class="btn btn-primary btn-sm">
                        View Details
                    </a>
                </div>
            </div>
        `;
    }

    /**
     * Get status configuration
     */
    getStatusConfig(status) {
        const configs = {
            'active': {
                label: 'Active',
                icon: '✓',
                class: 'status-active'
            },
            'pending': {
                label: 'Pending',
                icon: '⏳',
                class: 'status-pending'
            },
            'rejected': {
                label: 'Rejected',
                icon: '✗',
                class: 'status-rejected'
            }
        };
        return configs[status] || configs['pending'];
    }

    /**
     * Get user initials
     */
    getInitials(name) {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
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
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.applyFilters();
                this.render();
            });
        }

        // Sort select
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFilters();
                this.render();
            });
        }

        // Sort order button
        const sortOrderBtn = document.getElementById('sort-order-btn');
        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                this.applyFilters();
                this.render();
            });
        }
    }

    /**
     * Render error
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="trainer-learners-page">
                <div class="learners-container">
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h2 class="error-title">Error Loading Learners</h2>
                        <p class="error-message">${this.escapeHtml(message)}</p>
                        <a href="#/trainer/dashboard" class="btn btn-primary">Back to Dashboard</a>
                    </div>
                </div>
            </div>
        `;
    }
}

export default TrainerLearnersList;

