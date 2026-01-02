/**
 * Admin UI Component
 * 
 * Handles admin dashboard UI for user management and approvals.
 */

import { adminService } from '../services/admin-service.js';
import { tagService } from '../services/tag-service.js';
import Header from './header.js';

class AdminUI {
    constructor(container) {
        this.container = container;
        this.users = [];
        this.filteredUsers = [];
        this.trainers = [];
        this.availableTags = [];
        this.selectedUserIds = new Set();
        this.statistics = {
            totalUsers: 0,
            pendingApprovals: 0,
            activeUsers: 0,
            totalTrainers: 0,
            totalLearners: 0
        };
        this.pendingUsers = [];
        this.recentActivity = [];
        this.filters = {
            search: '',
            role: '',
            status: '',
            dateFrom: '',
            dateTo: ''
        };
    }

    /**
     * Show admin dashboard
     */
    async showDashboard() {
        console.log('[AdminUI] showDashboard called');
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            console.log('[AdminUI] Container set to visible');
        } else {
            console.error('[AdminUI] Container not found!');
            return;
        }
        
        // Render header with logout
        await this.renderHeader();
        
        // Cache current user for role change checks
        try {
            const { authService } = await import('../services/auth-service.js');
            const currentUser = await authService.getCurrentUser();
            window.__currentUser = currentUser;
        } catch (error) {
            console.warn('Failed to cache current user:', error);
        }
        
        await this.loadUsers();
        await this.loadTrainers();
        this.applyFilters();
        this.render();
    }
    
    /**
     * Show users management page
     */
    async showUsersPage() {
        console.log('[AdminUI] showUsersPage called');
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        // Render header
        await this.renderHeader();
        
        // Cache current user for role change checks
        try {
            const { authService } = await import('../services/auth-service.js');
            const currentUser = await authService.getCurrentUser();
            window.__currentUser = currentUser;
        } catch (error) {
            console.warn('Failed to cache current user:', error);
        }
        
        await this.loadUsers();
        await this.loadTrainers();
        this.applyFilters();
        this.renderUsersPage();
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
     * Load all users
     */
    async loadUsers() {
        try {
            this.users = await adminService.getAllUsers();
            // Load available tags for bulk operations
            try {
                this.availableTags = await tagService.getAllTags();
            } catch (error) {
                console.warn('[AdminUI] Failed to load tags:', error);
                this.availableTags = [];
            }
            this.calculateStatistics();
            this.loadPendingUsers();
            this.loadRecentActivity();
        } catch (error) {
            this.showError('Failed to load users: ' + error.message);
            this.users = [];
        }
    }

    /**
     * Calculate dashboard statistics
     */
    calculateStatistics() {
        this.statistics.totalUsers = this.users.length;
        this.statistics.pendingApprovals = this.users.filter(u => (u.status || 'pending') === 'pending').length;
        this.statistics.activeUsers = this.users.filter(u => (u.status || 'pending') === 'approved').length;
        this.statistics.totalTrainers = this.users.filter(u => u.role === 'trainer').length;
        this.statistics.totalLearners = this.users.filter(u => u.role === 'learner').length;
    }

    /**
     * Load pending users (for queue)
     */
    loadPendingUsers() {
        this.pendingUsers = this.users
            .filter(u => (u.status || 'pending') === 'pending')
            .sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateA - dateB; // Oldest first
            })
            .slice(0, 10); // Top 10
    }

    /**
     * Load recent activity (recently approved/rejected users)
     */
    loadRecentActivity() {
        this.recentActivity = this.users
            .filter(u => u.approved_at || u.rejected_at)
            .sort((a, b) => {
                const dateA = a.approved_at || a.rejected_at || '';
                const dateB = b.approved_at || b.rejected_at || '';
                return new Date(dateB).getTime() - new Date(dateA).getTime(); // Latest first
            })
            .slice(0, 10); // Top 10
    }

    /**
     * Load all trainers
     */
    async loadTrainers() {
        try {
            this.trainers = await adminService.getAllTrainers();
        } catch (error) {
            console.warn('Failed to load trainers:', error);
            this.trainers = [];
        }
    }

    /**
     * Render admin dashboard
     * Note: Admin dashboard does NOT include "Continue Learning" block - admins don't take courses
     */
    render() {
        console.log('[AdminUI] Rendering dashboard with', this.users.length, 'users');
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        this.container.innerHTML = `
            <div class="admin-dashboard-page">
                <div class="admin-container">
                    <div class="admin-header">
                        <div>
                            <h1 class="admin-title">Admin Dashboard</h1>
                            <p class="admin-subtitle">Manage users, approvals, and system settings</p>
                        </div>
                        <div class="admin-actions">
                            <a href="#/admin/users/pending" class="btn btn-primary">
                                <span class="btn-icon">✓</span>
                                <span>Pending Approvals (${this.statistics.pendingApprovals})</span>
                            </a>
                        </div>
                    </div>

                    <div id="admin-error" class="error-message" style="display: none;"></div>
                    <div id="admin-success" class="success-message" style="display: none;"></div>

                    <!-- Statistics Cards -->
                    <div class="admin-stats">
                        ${this.renderStatisticsCards()}
                    </div>

                    <div class="admin-content-layout">
                        <div class="admin-main">
                            <!-- Pending Approvals Queue -->
                            <div class="admin-section">
                                <div class="section-header">
                                    <h2 class="section-title">Pending Approvals</h2>
                                    ${this.statistics.pendingApprovals > 10 ? `
                                        <a href="#/admin/users/pending" class="section-link">View All (${this.statistics.pendingApprovals})</a>
                                    ` : ''}
                                </div>
                                ${this.renderPendingApprovalsQueue()}
                            </div>

                            <!-- User Management Section -->
                            <div class="admin-section">
                                <div class="section-header">
                                    <h2 class="section-title">User Management</h2>
                                </div>
                                ${this.renderUserManagement()}
                            </div>
                        </div>

                        <div class="admin-sidebar">
                            <!-- Recent Activity -->
                            <div class="admin-section">
                                <div class="section-header">
                                    <h2 class="section-title">Recent Activity</h2>
                                </div>
                                ${this.renderRecentActivity()}
                            </div>

                            <!-- Quick Actions -->
                            <div class="admin-section">
                                <div class="section-header">
                                    <h2 class="section-title">Quick Actions</h2>
                                </div>
                                ${this.renderQuickActions()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Render statistics cards
     */
    renderStatisticsCards() {
        return `
            <div class="stat-card">
                <div class="stat-icon stat-icon-users">👥</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.totalUsers}</div>
                    <div class="stat-label">Total Users</div>
                </div>
            </div>
            <div class="stat-card stat-card-priority">
                <div class="stat-icon stat-icon-pending">⏳</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.pendingApprovals}</div>
                    <div class="stat-label">Pending Approvals</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon-active">✓</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.activeUsers}</div>
                    <div class="stat-label">Active Users</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon-trainers">👨‍🏫</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.totalTrainers}</div>
                    <div class="stat-label">Trainers</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon-learners">📚</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.totalLearners}</div>
                    <div class="stat-label">Learners</div>
                </div>
            </div>
        `;
    }

    /**
     * Render pending approvals queue
     */
    renderPendingApprovalsQueue() {
        if (this.pendingUsers.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">✓</div>
                    <div class="empty-text">No pending approvals</div>
                    <p class="empty-description">All users have been reviewed!</p>
                </div>
            `;
        }

        return `
            <div class="pending-approvals-list">
                ${this.pendingUsers.map(user => {
                    const createdDate = user.created_at ? new Date(user.created_at) : null;
                    const daysAgo = createdDate ? Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    const userName = user.full_name || user.name || user.email || 'Unknown';
                    
                    return `
                        <div class="pending-approval-card">
                            <div class="approval-card-header">
                                <div class="approval-user">
                                    <div class="user-avatar-mini">
                                        <span class="avatar-initials-mini">${this.getInitials(userName)}</span>
                                    </div>
                                    <div class="user-info">
                                        <div class="user-name">${this.escapeHtml(userName)}</div>
                                        <div class="user-email">${this.escapeHtml(user.email)}</div>
                                        <div class="user-meta">
                                            <span class="user-role-badge ${user.role}">${this.getRoleLabel(user.role)}</span>
                                            ${createdDate ? `<span class="user-registered">Registered ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                ${daysAgo > 0 ? `
                                    <div class="approval-priority priority-${daysAgo >= 7 ? 'high' : daysAgo >= 3 ? 'medium' : 'low'}">
                                        ${daysAgo}d
                                    </div>
                                ` : ''}
                            </div>
                            <div class="approval-card-actions">
                                <button class="btn btn-success btn-sm approve-user-btn" data-user-id="${user.id}">
                                    Approve
                                </button>
                                <button class="btn btn-danger btn-sm reject-user-btn" data-user-id="${user.id}">
                                    Reject
                                </button>
                                <a href="#/admin/users/${user.id}" class="btn btn-ghost btn-sm">
                                    View Details
                                </a>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render recent activity
     */
    renderRecentActivity() {
        if (this.recentActivity.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-text">No recent activity</div>
                </div>
            `;
        }

        return `
            <div class="activity-list">
                ${this.recentActivity.map(user => {
                    const userName = user.full_name || user.name || user.email || 'Unknown';
                    const actionDate = user.approved_at || user.rejected_at;
                    const actionType = user.approved_at ? 'approved' : 'rejected';
                    const actionIcon = actionType === 'approved' ? '✓' : '✗';
                    const actionClass = actionType === 'approved' ? 'status-approved' : 'status-rejected';
                    
                    return `
                        <div class="activity-item">
                            <div class="activity-icon ${actionClass}">${actionIcon}</div>
                            <div class="activity-content">
                                <div class="activity-text">
                                    <strong>${this.escapeHtml(userName)}</strong> was ${actionType}
                                </div>
                                <div class="activity-meta">
                                    <span class="activity-date">${actionDate ? new Date(actionDate).toLocaleString() : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render quick actions
     */
    renderQuickActions() {
        return `
            <div class="quick-actions-list">
                <a href="#/admin/users/pending" class="action-card">
                    <div class="action-icon">⏳</div>
                    <div class="action-content">
                        <div class="action-title">Pending Approvals</div>
                        <div class="action-description">Review and approve users</div>
                    </div>
                </a>
                <a href="#/admin/users" class="action-card">
                    <div class="action-icon">👥</div>
                    <div class="action-content">
                        <div class="action-title">All Users</div>
                        <div class="action-description">View all users</div>
                    </div>
                </a>
                <a href="#/admin/courses" class="action-card">
                    <div class="action-icon">📚</div>
                    <div class="action-content">
                        <div class="action-title">Courses</div>
                        <div class="action-description">Manage courses</div>
                    </div>
                </a>
                <a href="#/admin/settings" class="action-card">
                    <div class="action-icon">⚙️</div>
                    <div class="action-content">
                        <div class="action-title">Settings</div>
                        <div class="action-description">System settings</div>
                    </div>
                </a>
            </div>
        `;
    }

    /**
     * Get user initials
     */
    getInitials(name) {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
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
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Render users management page (full page view)
     */
    renderUsersPage() {
        console.log('[AdminUI] Rendering users page with', this.users.length, 'users');
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        this.container.innerHTML = `
            <div class="admin-dashboard-page">
                <div class="admin-container">
                    <div class="admin-header">
                        <div>
                            <h1 class="admin-title">User Management</h1>
                            <p class="admin-subtitle">Manage all users, roles, and permissions</p>
                        </div>
                    </div>

                    <div id="admin-error" class="error-message" style="display: none;"></div>
                    <div id="admin-success" class="success-message" style="display: none;"></div>

                    ${this.renderUserManagement()}
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Render user management section
     */
    renderUserManagement() {
        return `
            <div id="users-section">
                        
                        <!-- Filters Section -->
                        <div id="filters-section" class="filters-section">
                            <h3 class="filters-title">Filters</h3>
                            <div class="filters-grid">
                                <div class="filter-group">
                                    <label class="filter-label">Search (Name/Email)</label>
                                    <input type="text" id="filter-search" placeholder="Search..." 
                                           class="filter-input"
                                           value="${this.filters.search}">
                                </div>
                                <div class="filter-group">
                                    <label class="filter-label">Role</label>
                                    <select id="filter-role" class="filter-input">
                                        <option value="">All Roles</option>
                                        <option value="learner" ${this.filters.role === 'learner' ? 'selected' : ''}>Learner</option>
                                        <option value="trainer" ${this.filters.role === 'trainer' ? 'selected' : ''}>Trainer</option>
                                        <option value="admin" ${this.filters.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label class="filter-label">Status</label>
                                    <select id="filter-status" class="filter-input">
                                        <option value="">All Statuses</option>
                                        <option value="pending" ${this.filters.status === 'pending' ? 'selected' : ''}>Pending</option>
                                        <option value="approved" ${this.filters.status === 'approved' ? 'selected' : ''}>Approved</option>
                                        <option value="rejected" ${this.filters.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label class="filter-label">Registered From</label>
                                    <input type="date" id="filter-date-from" 
                                           class="filter-input"
                                           value="${this.filters.dateFrom}">
                                </div>
                                <div class="filter-group">
                                    <label class="filter-label">Registered To</label>
                                    <input type="date" id="filter-date-to" 
                                           class="filter-input"
                                           value="${this.filters.dateTo}">
                                </div>
                            </div>
                            <button id="clear-filters" class="btn btn-secondary btn-sm">
                                Clear Filters
                            </button>
                        </div>

                        <!-- Bulk Actions Section -->
                        <div id="bulk-actions" class="bulk-actions-bar" style="display: none;">
                            <div class="bulk-actions-content">
                                <span id="selected-count" class="bulk-actions-count"></span>
                                <button id="bulk-approve" class="bulk-action-btn btn btn-success btn-sm">Approve Selected</button>
                                <button id="bulk-reject" class="bulk-action-btn btn btn-danger btn-sm">Reject Selected</button>
                                <button id="bulk-assign-trainer" class="bulk-action-btn btn btn-primary btn-sm">Assign Trainer</button>
                                <div class="bulk-tag-actions">
                                    <select id="bulk-tag-select" class="bulk-tag-select">
                                        <option value="">Select Tag...</option>
                                    </select>
                                    <button id="bulk-add-tag" class="bulk-action-btn btn btn-primary btn-sm">Add Tag</button>
                                    <button id="bulk-remove-tag" class="bulk-action-btn btn btn-secondary btn-sm">Remove Tag</button>
                                </div>
                                <button id="bulk-delete" class="bulk-action-btn btn btn-danger btn-sm">Delete Selected</button>
                                <button id="clear-selection" class="btn btn-secondary btn-sm">Clear Selection</button>
                            </div>
                        </div>

                        ${this.filteredUsers.length === 0 ? `
                            <div id="no-results" class="no-results">
                                No users found matching the filters.
                            </div>
                        ` : `
                            <div class="table-container">
                                <table id="users-table" class="data-table">
                                    <thead>
                                        <tr>
                                            <th class="table-checkbox">
                                                <input type="checkbox" id="select-all" class="checkbox-input">
                                            </th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Learner Type</th>
                                            <th>Trainer</th>
                                            <th>Registered</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="users-table-body">
                                        ${this.renderUsersTable()}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                    
                    <div id="reports-section" class="reports-section" style="display: none;">
                        <h2 class="section-title">Reports</h2>
                        <p class="reports-placeholder">Reports feature coming soon. This will include:</p>
                        <ul class="reports-list">
                            <li>User Performance Reports</li>
                            <li>Trainer Performance Reports</li>
                            <li>Assignment Submission Reports</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Apply filters to users list
     */
    applyFilters() {
        this.filteredUsers = this.users.filter(user => {
            // Search filter (name or email)
            if (this.filters.search) {
                const searchLower = this.filters.search.toLowerCase();
                const nameMatch = (user.full_name || '').toLowerCase().includes(searchLower);
                const emailMatch = (user.email || '').toLowerCase().includes(searchLower);
                if (!nameMatch && !emailMatch) {
                    return false;
                }
            }

            // Role filter
            if (this.filters.role && user.role !== this.filters.role) {
                return false;
            }

            // Status filter
            if (this.filters.status && (user.status || 'pending') !== this.filters.status) {
                return false;
            }

            // Date range filter
            if (this.filters.dateFrom || this.filters.dateTo) {
                const userDate = new Date(user.created_at);
                if (this.filters.dateFrom) {
                    const fromDate = new Date(this.filters.dateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (userDate < fromDate) {
                        return false;
                    }
                }
                if (this.filters.dateTo) {
                    const toDate = new Date(this.filters.dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (userDate > toDate) {
                        return false;
                    }
                }
            }

            return true;
        });
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    /**
     * Render users table rows
     */
    renderUsersTable() {
        if (this.filteredUsers.length === 0) {
            return '<tr><td colspan="9">No users found</td></tr>';
        }

        return this.filteredUsers.map(user => {
            const statusCell = this.renderStatusCell(user);
            const actionsCell = this.renderActionsCell(user);
            const trainerCell = this.renderTrainerCell(user);
            const learnerTypeCell = this.renderLearnerTypeCell(user);
            const isSelected = this.selectedUserIds.has(user.id);
            const canSelect = user.role !== 'admin' && (!this.getCurrentUserSync() || this.getCurrentUserSync().id !== user.id);
            
            return `
                <tr data-user-id="${user.id}" class="table-row">
                    <td class="table-checkbox">
                        ${canSelect ? `<input type="checkbox" class="user-checkbox checkbox-input" data-user-id="${user.id}" ${isSelected ? 'checked' : ''}>` : ''}
                    </td>
                    <td class="table-cell">${user.full_name || '-'}</td>
                    <td class="table-cell">${user.email || '-'}</td>
                    <td class="table-cell">${user.role || 'learner'}</td>
                    <td class="table-cell">${statusCell}</td>
                    <td class="table-cell">${learnerTypeCell}</td>
                    <td class="table-cell">${trainerCell}</td>
                    <td class="table-cell">${this.formatDate(user.created_at)}</td>
                    <td class="table-cell table-actions">${actionsCell}</td>
                </tr>
            `;
        }).join('');
    }
    
    /**
     * Render learner type cell
     */
    renderLearnerTypeCell(user) {
        // Only show for learners
        if (user.role !== 'learner') {
            return '<span class="na-text">N/A</span>';
        }
        
        const learnerType = user.learner_type || 'Not Set';
        const typeLabels = {
            'active': 'Active',
            'inactive': 'Inactive',
            'graduate': 'Graduate',
            'archive': 'Archive',
            'Not Set': 'Not Set'
        };
        
        const typeColors = {
            'active': '#28a745',
            'inactive': '#ffc107',
            'graduate': '#17a2b8',
            'archive': '#6c757d',
            'Not Set': '#6c757d'
        };
        
        return `<span style="color: ${typeColors[learnerType] || '#6c757d'}; font-weight: 500;">${typeLabels[learnerType] || learnerType}</span>`;
    }
    
    /**
     * Render trainer cell with dropdown for assignment
     */
    renderTrainerCell(user) {
        // Don't show trainer assignment for admins
        // Trainers can have trainers assigned (for their own lab evaluation)
        if (user.role === 'admin') {
            return '<span class="na-text">N/A</span>';
        }
        
        // For inactive learners, show message that trainer assignment is not allowed
        if (user.role === 'learner' && user.learner_type === 'inactive') {
            return '<span class="na-text" style="color: #ffc107;">N/A (Inactive)</span>';
        }

        const currentTrainerId = user.trainer_id || '';
        // Filter out the current user from trainer options (users cannot assign themselves as their own trainer)
        const availableTrainers = this.trainers.filter(trainer => trainer.id !== user.id);
        const trainerOptions = availableTrainers.map(trainer => {
            const selected = trainer.id === currentTrainerId ? 'selected' : '';
            const displayName = trainer.full_name || trainer.email || 'Unknown';
            return `<option value="${trainer.id}" ${selected}>${displayName}</option>`;
        }).join('');

        return `
            <select class="trainer-select form-select-sm" 
                    data-user-id="${user.id}" 
                    ${user.status === 'approved' || user.role === 'trainer' ? '' : 'required'}>
                <option value="">-- Select Trainer --</option>
                ${trainerOptions}
            </select>
        `;
    }

    /**
     * Render status cell
     */
    renderStatusCell(user) {
        const status = user.status || 'pending';
        return `<span class="status-badge status-badge-${status}">${status}</span>`;
    }

    /**
     * Render actions cell
     */
    renderActionsCell(user) {
        let actions = '';
        
        // Approve/Reject buttons for pending users
        if (user.status === 'pending') {
            actions += `
                <button class="approve-btn btn btn-success btn-xs" data-user-id="${user.id}">Approve</button>
                <button class="reject-btn btn btn-danger btn-xs" data-user-id="${user.id}">Reject</button>
            `;
        }
        
        // Role change dropdown (don't allow changing own role)
        const currentUser = this.getCurrentUserSync();
        const canChangeRole = !currentUser || currentUser.id !== user.id;
        const currentRole = user.role || 'learner';
        
        if (canChangeRole) {
            actions += `
                <select class="role-select form-select-sm" data-user-id="${user.id}">
                    <option value="learner" ${currentRole === 'learner' ? 'selected' : ''}>Learner</option>
                    <option value="trainer" ${currentRole === 'trainer' ? 'selected' : ''}>Trainer</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            `;
        } else {
            actions += `<span class="role-display">${currentRole}</span>`;
        }
        
        // Delete button (don't allow deleting admins or yourself)
        const canDelete = user.role !== 'admin' && (!currentUser || currentUser.id !== user.id);
        if (canDelete) {
            actions += `
                <button class="delete-btn btn btn-danger btn-xs" data-user-id="${user.id}">Delete</button>
            `;
        }
        
        return actions || '-';
    }
    
    /**
     * Get current user synchronously (cached)
     */
    getCurrentUserSync() {
        // Try to get from auth service cache or session
        return window.__currentUser || null;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Pending approvals queue buttons
        const approveButtons = this.container.querySelectorAll('.approve-user-btn');
        approveButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = button.getAttribute('data-user-id');
                await this.handleApprove(userId);
            });
        });

        const rejectButtons = this.container.querySelectorAll('.reject-user-btn');
        rejectButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = button.getAttribute('data-user-id');
                await this.handleReject(userId);
            });
        });

        // Navigation buttons (if they exist)
        const navButtons = this.container.querySelectorAll('.admin-nav-btn');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');
                if (!e.target.disabled) {
                    this.switchSection(section);
                }
            });
        });

        // Attach table event listeners
        this.attachTableEventListeners();

        // Filter inputs
        const filterSearch = this.container.querySelector('#filter-search');
        if (filterSearch) {
            filterSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
                this.updateTableBody();
            });
        }

        const filterRole = this.container.querySelector('#filter-role');
        if (filterRole) {
            filterRole.addEventListener('change', (e) => {
                this.filters.role = e.target.value;
                this.applyFilters();
                this.updateTableBody();
            });
        }

        const filterStatus = this.container.querySelector('#filter-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
                this.updateTableBody();
            });
        }

        const filterDateFrom = this.container.querySelector('#filter-date-from');
        if (filterDateFrom) {
            filterDateFrom.addEventListener('change', (e) => {
                this.filters.dateFrom = e.target.value;
                this.applyFilters();
                this.updateTableBody();
            });
        }

        const filterDateTo = this.container.querySelector('#filter-date-to');
        if (filterDateTo) {
            filterDateTo.addEventListener('change', (e) => {
                this.filters.dateTo = e.target.value;
                this.applyFilters();
                this.updateTableBody();
            });
        }

        const clearFilters = this.container.querySelector('#clear-filters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.filters = { search: '', role: '', status: '', dateFrom: '', dateTo: '' };
                // Reset filter inputs
                if (filterSearch) filterSearch.value = '';
                if (filterRole) filterRole.value = '';
                if (filterStatus) filterStatus.value = '';
                if (filterDateFrom) filterDateFrom.value = '';
                if (filterDateTo) filterDateTo.value = '';
                this.applyFilters();
                this.updateTableBody();
            });
        }

        // Select all checkbox
        const selectAll = this.container.querySelector('#select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checked = e.target.checked;
                const checkboxes = this.container.querySelectorAll('.user-checkbox');
                checkboxes.forEach(cb => {
                    if (cb.checked !== checked) {
                        cb.checked = checked;
                        const userId = cb.getAttribute('data-user-id');
                        if (checked) {
                            this.selectedUserIds.add(userId);
                        } else {
                            this.selectedUserIds.delete(userId);
                        }
                    }
                });
                this.updateBulkActions();
            });
        }

        // Individual user checkboxes
        const userCheckboxes = this.container.querySelectorAll('.user-checkbox');
        userCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                if (e.target.checked) {
                    this.selectedUserIds.add(userId);
                } else {
                    this.selectedUserIds.delete(userId);
                }
                this.updateBulkActions();
            });
        });

        // Bulk action buttons
        const bulkApprove = this.container.querySelector('#bulk-approve');
        if (bulkApprove) {
            bulkApprove.addEventListener('click', () => this.handleBulkApprove());
        }

        const bulkReject = this.container.querySelector('#bulk-reject');
        if (bulkReject) {
            bulkReject.addEventListener('click', () => this.handleBulkReject());
        }

        const bulkAssignTrainer = this.container.querySelector('#bulk-assign-trainer');
        if (bulkAssignTrainer) {
            bulkAssignTrainer.addEventListener('click', () => this.handleBulkAssignTrainer());
        }

        const bulkDelete = this.container.querySelector('#bulk-delete');
        if (bulkDelete) {
            bulkDelete.addEventListener('click', () => this.handleBulkDelete());
        }

        // Bulk tag operations
        const bulkAddTag = this.container.querySelector('#bulk-add-tag');
        if (bulkAddTag) {
            bulkAddTag.addEventListener('click', () => this.handleBulkAddTag());
        }

        const bulkRemoveTag = this.container.querySelector('#bulk-remove-tag');
        if (bulkRemoveTag) {
            bulkRemoveTag.addEventListener('click', () => this.handleBulkRemoveTag());
        }

        const clearSelection = this.container.querySelector('#clear-selection');
        if (clearSelection) {
            clearSelection.addEventListener('click', () => {
                this.selectedUserIds.clear();
                this.updateBulkActions();
                // Update checkboxes in table
                const checkboxes = this.container.querySelectorAll('.user-checkbox');
                checkboxes.forEach(cb => cb.checked = false);
                const selectAll = this.container.querySelector('#select-all');
                if (selectAll) selectAll.checked = false;
            });
        }

        // Update bulk actions visibility
        this.updateBulkActions();
    }

    /**
     * Update bulk actions section visibility and count
     */
    updateBulkActions() {
        const bulkActions = this.container.querySelector('#bulk-actions');
        const selectedCount = this.container.querySelector('#selected-count');
        const selectAll = this.container.querySelector('#select-all');
        const tagSelect = this.container.querySelector('#bulk-tag-select');

        if (this.selectedUserIds.size > 0) {
            if (bulkActions) bulkActions.style.display = 'block';
            if (selectedCount) selectedCount.textContent = `${this.selectedUserIds.size} user(s) selected`;
            
            // Populate tag dropdown
            if (tagSelect) {
                tagSelect.innerHTML = '<option value="">Select Tag...</option>';
                this.availableTags.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = tag.id;
                    option.textContent = tag.name;
                    tagSelect.appendChild(option);
                });
            }
        } else {
            if (bulkActions) bulkActions.style.display = 'none';
            if (selectAll) selectAll.checked = false;
            if (tagSelect) tagSelect.value = '';
        }
    }
    
    /**
     * Handle trainer assignment
     */
    async handleTrainerAssignment(userId, trainerId) {
        const select = this.container.querySelector(`.trainer-select[data-user-id="${userId}"]`);
        if (!select) return;

        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const oldTrainerId = user.trainer_id || null;

        if (oldTrainerId === trainerId) {
            return; // No change needed
        }

        if (!trainerId) {
            // If removing trainer, check if user is approved
            if (user.status === 'approved') {
                this.showError('Cannot remove trainer from approved user. Please assign a different trainer.');
                select.value = oldTrainerId || '';
                return;
            }
        }

        select.disabled = true;
        const originalValue = oldTrainerId || '';

        try {
            if (trainerId) {
                console.log('[AdminUI] Assigning trainer', trainerId, 'to user', userId, 'Role:', user.role, 'Learner Type:', user.learner_type);
                await adminService.assignTrainer(userId, trainerId);
                console.log('[AdminUI] Trainer assigned successfully');
                this.showSuccess('Trainer assigned successfully');
            } else {
                // Only Active learners require trainer assignment
                // Trainers can have trainers assigned (for their own lab evaluation)
                if (user.role === 'learner' && user.learner_type === 'active') {
                    this.showError('Trainer assignment is required for Active learners');
                } else if (user.role === 'learner' && user.learner_type === 'inactive') {
                    this.showError('Cannot assign trainer to inactive learners. Change learner type to active first.');
                } else {
                    // For trainers, allow removing trainer assignment
                    // But we need to actually remove it from the database
                    console.log('[AdminUI] Removing trainer assignment from', user.role);
                    try {
                        // Update user to remove trainer_id
                        const { supabaseClient } = await import('../services/supabase-client.js');
                        const { error: updateError } = await supabaseClient
                            .from('users')
                            .update({ trainer_id: null, updated_at: new Date().toISOString() })
                            .eq('id', userId);
                        
                        if (updateError) {
                            throw updateError;
                        }
                        
                        this.showSuccess('Trainer assignment removed');
                        // Reload users to reflect the change
                        await this.loadUsers();
                        this.applyFilters();
                        this.updateTableBody();
                        this.updateBulkActions();
                        select.disabled = false;
                        return;
                    } catch (removeError) {
                        console.error('[AdminUI] Failed to remove trainer assignment:', removeError);
                        this.showError('Failed to remove trainer assignment: ' + (removeError.message || 'Unknown error'));
                        select.value = originalValue;
                        select.disabled = false;
                        return;
                    }
                }
                select.value = originalValue;
                select.disabled = false;
                return;
            }
            
            // Reload users and refresh table without full re-render
            await this.loadUsers();
            this.applyFilters();
            this.updateTableBody();
            this.updateBulkActions();
            select.disabled = false;
        } catch (error) {
            console.error('[AdminUI] Failed to assign trainer:', error);
            this.showError('Failed to assign trainer: ' + (error.message || 'Unknown error'));
            // Reset to original value on error
            select.value = originalValue;
            select.disabled = false;
        }
    }

    /**
     * Handle bulk approve
     */
    async handleBulkApprove() {
        const userIds = Array.from(this.selectedUserIds);
        if (userIds.length === 0) return;

        // Check if any Active learners are selected without trainers
        const learnersWithoutTrainers = userIds.filter(userId => {
            const user = this.users.find(u => u.id === userId);
            return user && user.role === 'learner' && user.learner_type === 'active' && !user.trainer_id;
        });

        if (learnersWithoutTrainers.length > 0) {
            const errorMessage = `Cannot approve ${learnersWithoutTrainers.length} Active learner(s) without trainer assignment.`;
            this.showError(errorMessage);
            return;
        }

        const confirmMessage = `Approve ${userIds.length} user(s)?\n\nNote: Only learners require trainer assignment. Trainers can be approved without a trainer.`;
        if (!confirm(confirmMessage)) return;

        const button = this.container.querySelector('#bulk-approve');
        if (button) {
            button.disabled = true;
            button.textContent = 'Approving...';
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of userIds) {
            try {
                await adminService.approveUser(userId);
                successCount++;
            } catch (error) {
                errorCount++;
                const user = this.users.find(u => u.id === userId);
                errors.push(`${user?.email || userId}: ${error.message}`);
            }
        }

        if (button) {
            button.disabled = false;
            button.textContent = 'Approve Selected';
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully approved ${successCount} user(s)`);
        } else {
            this.showError(`Approved ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadUsers();
        this.applyFilters();
        this.updateTableBody();
        this.updateBulkActions();
    }

    /**
     * Handle bulk reject
     */
    async handleBulkReject() {
        const userIds = Array.from(this.selectedUserIds);
        if (userIds.length === 0) return;

        const confirmMessage = `Reject ${userIds.length} user(s)?`;
        if (!confirm(confirmMessage)) return;

        const button = this.container.querySelector('#bulk-reject');
        if (button) {
            button.disabled = true;
            button.textContent = 'Rejecting...';
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of userIds) {
            try {
                await adminService.rejectUser(userId);
                successCount++;
            } catch (error) {
                errorCount++;
                const user = this.users.find(u => u.id === userId);
                errors.push(`${user?.email || userId}: ${error.message}`);
            }
        }

        if (button) {
            button.disabled = false;
            button.textContent = 'Reject Selected';
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully rejected ${successCount} user(s)`);
        } else {
            this.showError(`Rejected ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadUsers();
        this.applyFilters();
        this.updateTableBody();
        this.updateBulkActions();
    }

    /**
     * Handle bulk trainer assignment
     */
    async handleBulkAssignTrainer() {
        const userIds = Array.from(this.selectedUserIds);
        if (userIds.length === 0) return;

        if (this.trainers.length === 0) {
            this.showError('No trainers available. Please create trainers first.');
            return;
        }

        // Create a modal/dialog for trainer selection
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;';
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background: white; padding: 20px; border-radius: 5px; max-width: 400px; width: 90%;';
        
        const trainerOptions = this.trainers.map(t => 
            `<option value="${t.id}">${t.full_name || t.email}</option>`
        ).join('');

        modalContent.innerHTML = `
            <h3 style="margin-top: 0;">Assign Trainer to ${userIds.length} User(s)</h3>
            <label style="display: block; margin-bottom: 10px; font-weight: bold;">Select Trainer:</label>
            <select id="bulk-trainer-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; margin-bottom: 15px; font-size: 14px;">
                <option value="">-- Select Trainer --</option>
                ${trainerOptions}
            </select>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="bulk-trainer-cancel" style="padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Cancel</button>
                <button id="bulk-trainer-confirm" style="padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Assign</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        return new Promise((resolve) => {
            const confirmBtn = modalContent.querySelector('#bulk-trainer-confirm');
            const cancelBtn = modalContent.querySelector('#bulk-trainer-cancel');
            const select = modalContent.querySelector('#bulk-trainer-select');

            const cleanup = () => {
                document.body.removeChild(modal);
                resolve();
            };

            cancelBtn.addEventListener('click', cleanup);

            confirmBtn.addEventListener('click', async () => {
                const trainerId = select.value;
                if (!trainerId) {
                    this.showError('Please select a trainer');
                    return;
                }

                const trainer = this.trainers.find(t => t.id === trainerId);
                if (!trainer) {
                    this.showError('Invalid trainer selected');
                    cleanup();
                    return;
                }

                cleanup();
                await this.executeBulkTrainerAssignment(userIds, trainerId, trainer);
            });
        });
    }

    /**
     * Execute bulk trainer assignment
     */
    async executeBulkTrainerAssignment(userIds, trainerId, trainer) {

        const button = this.container.querySelector('#bulk-assign-trainer');
        if (button) {
            button.disabled = true;
            button.textContent = 'Assigning...';
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of userIds) {
            try {
                await adminService.assignTrainer(userId, trainerId);
                successCount++;
            } catch (error) {
                errorCount++;
                const user = this.users.find(u => u.id === userId);
                errors.push(`${user?.email || userId}: ${error.message}`);
            }
        }

        if (button) {
            button.disabled = false;
            button.textContent = 'Assign Trainer';
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully assigned trainer to ${successCount} user(s)`);
        } else {
            this.showError(`Assigned ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadUsers();
        this.applyFilters();
        this.updateTableBody();
        this.updateBulkActions();
    }

    /**
     * Handle bulk delete
     */
    async handleBulkDelete() {
        const userIds = Array.from(this.selectedUserIds);
        if (userIds.length === 0) return;

        const confirmMessage = `Delete ${userIds.length} user(s)?\n\nThis action cannot be undone. All associated data will be permanently deleted.`;
        if (!confirm(confirmMessage)) return;

        const button = this.container.querySelector('#bulk-delete');
        if (button) {
            button.disabled = true;
            button.textContent = 'Deleting...';
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of userIds) {
            try {
                await adminService.deleteUser(userId);
                successCount++;
            } catch (error) {
                errorCount++;
                const user = this.users.find(u => u.id === userId);
                errors.push(`${user?.email || userId}: ${error.message}`);
            }
        }

        if (button) {
            button.disabled = false;
            button.textContent = 'Delete Selected';
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully deleted ${successCount} user(s)`);
        } else {
            this.showError(`Deleted ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadUsers();
        this.applyFilters();
        this.updateTableBody();
        this.updateBulkActions();
    }

    /**
     * Handle bulk add tag
     */
    async handleBulkAddTag() {
        const userIds = Array.from(this.selectedUserIds);
        if (userIds.length === 0) return;

        const tagSelect = this.container.querySelector('#bulk-tag-select');
        if (!tagSelect) return;

        const tagId = tagSelect.value;
        if (!tagId) {
            alert('Please select a tag to add');
            return;
        }

        const selectedTag = this.availableTags.find(t => t.id === tagId);
        if (!selectedTag) {
            alert('Selected tag not found');
            return;
        }

        const confirmMessage = `Add tag "${selectedTag.name}" to ${userIds.length} user(s)?`;
        if (!confirm(confirmMessage)) return;

        const button = this.container.querySelector('#bulk-add-tag');
        if (button) {
            button.disabled = true;
            button.textContent = 'Adding...';
        }

        const currentUser = this.getCurrentUserSync();
        if (!currentUser) {
            alert('You must be logged in to perform this action');
            if (button) {
                button.disabled = false;
                button.textContent = 'Add Tag';
            }
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of userIds) {
            try {
                await tagService.assignTagToUser(userId, tagId, currentUser.id);
                successCount++;
            } catch (error) {
                // If tag is already assigned, count as success
                if (error.message.includes('already assigned')) {
                    successCount++;
                } else {
                    errorCount++;
                    const user = this.users.find(u => u.id === userId);
                    errors.push(`${user?.email || userId}: ${error.message}`);
                }
            }
        }

        if (button) {
            button.disabled = false;
            button.textContent = 'Add Tag';
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully added tag "${selectedTag.name}" to ${successCount} user(s)`);
        } else {
            this.showError(`Added tag to ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadUsers();
        this.applyFilters();
        this.updateTableBody();
        this.updateBulkActions();
    }

    /**
     * Handle bulk remove tag
     */
    async handleBulkRemoveTag() {
        const userIds = Array.from(this.selectedUserIds);
        if (userIds.length === 0) return;

        const tagSelect = this.container.querySelector('#bulk-tag-select');
        if (!tagSelect) return;

        const tagId = tagSelect.value;
        if (!tagId) {
            alert('Please select a tag to remove');
            return;
        }

        const selectedTag = this.availableTags.find(t => t.id === tagId);
        if (!selectedTag) {
            alert('Selected tag not found');
            return;
        }

        const confirmMessage = `Remove tag "${selectedTag.name}" from ${userIds.length} user(s)?`;
        if (!confirm(confirmMessage)) return;

        const button = this.container.querySelector('#bulk-remove-tag');
        if (button) {
            button.disabled = true;
            button.textContent = 'Removing...';
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of userIds) {
            try {
                await tagService.removeTagFromUser(userId, tagId);
                successCount++;
            } catch (error) {
                errorCount++;
                const user = this.users.find(u => u.id === userId);
                errors.push(`${user?.email || userId}: ${error.message}`);
            }
        }

        if (button) {
            button.disabled = false;
            button.textContent = 'Remove Tag';
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully removed tag "${selectedTag.name}" from ${successCount} user(s)`);
        } else {
            this.showError(`Removed tag from ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadUsers();
        this.applyFilters();
        this.updateTableBody();
        this.updateBulkActions();
    }

    /**
     * Handle user deletion
     */
    async handleDelete(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const userName = user.full_name || user.email || 'this user';
        const confirmMessage = `Are you sure you want to delete ${userName}?\n\nThis action cannot be undone. All associated data (progress, submissions, allocations) will be permanently deleted.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        const button = this.container.querySelector(`.delete-btn[data-user-id="${userId}"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Deleting...';
        }

        try {
            console.log('[AdminUI] Attempting to delete user:', userId);
            await adminService.deleteUser(userId);
            console.log('[AdminUI] User deleted successfully');
            this.showSuccess(`User ${userName} deleted successfully`);
            await this.loadUsers();
            this.applyFilters();
            this.updateTableBody();
            this.updateBulkActions();
        } catch (error) {
            console.error('[AdminUI] Delete error:', error);
            this.showError('Failed to delete user: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Delete';
            }
        }
    }

    /**
     * Handle role change
     */
    async handleRoleChange(userId, newRole) {
        const select = this.container.querySelector(`.role-select[data-user-id="${userId}"]`);
        if (!select) return;
        
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        
        const oldRole = user.role || 'learner';
        
        if (oldRole === newRole) {
            return; // No change needed
        }
        
        const confirmChange = confirm(`Change user role from "${oldRole}" to "${newRole}"?`);
        
        if (!confirmChange) {
            // Reset to old value
            select.value = oldRole;
            return;
        }
        
        select.disabled = true;
        const originalValue = oldRole;
        
        try {
            await adminService.updateUserRole(userId, newRole);
            this.showSuccess(`User role changed from ${oldRole} to ${newRole} successfully`);
            // Reload users and refresh table without full re-render
            await this.loadUsers();
            this.applyFilters();
            this.updateTableBody();
            this.updateBulkActions();
        } catch (error) {
            this.showError('Failed to change user role: ' + error.message);
            // Reset to original value on error
            select.value = originalValue;
            select.disabled = false;
        }
    }
    
    /**
     * Switch between admin sections
     */
    switchSection(section) {
        // Update active button
        const navButtons = this.container.querySelectorAll('.admin-nav-btn');
        navButtons.forEach(btn => {
            if (btn.getAttribute('data-section') === section) {
                btn.classList.add('active');
                btn.style.backgroundColor = '#007bff';
            } else {
                btn.classList.remove('active');
                btn.style.backgroundColor = '#6c757d';
            }
        });
        
        // Show/hide sections
        const usersSection = this.container.querySelector('#users-section');
        const reportsSection = this.container.querySelector('#reports-section');
        
        if (section === 'users') {
            if (usersSection) usersSection.style.display = 'block';
            if (reportsSection) reportsSection.style.display = 'none';
        } else if (section === 'reports') {
            if (usersSection) usersSection.style.display = 'none';
            if (reportsSection) reportsSection.style.display = 'block';
        }
    }

    /**
     * Handle approve action
     */
    async handleApprove(userId) {
        this.clearMessages();
        
        const button = this.container.querySelector(`.approve-user-btn[data-user-id="${userId}"]`) || 
                       this.container.querySelector(`.approve-btn[data-user-id="${userId}"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Approving...';
        }

        try {
            await adminService.approveUser(userId);
            this.showSuccess('User approved successfully');
            // Reload users and refresh dashboard
            await this.loadUsers();
            this.applyFilters();
            this.render(); // Full re-render to update stats and queues
        } catch (error) {
            this.showError('Failed to approve user: ' + error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Approve';
            }
        }
    }

    /**
     * Handle reject action
     */
    async handleReject(userId) {
        this.clearMessages();
        
        const button = this.container.querySelector(`.reject-btn[data-user-id="${userId}"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Rejecting...';
        }

        try {
            await adminService.rejectUser(userId);
            this.showSuccess('User rejected successfully');
            // Reload users and refresh dashboard
            await this.loadUsers();
            this.applyFilters();
            this.render(); // Full re-render to update stats and queues
        } catch (error) {
            this.showError('Failed to reject user: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Reject';
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#admin-error');
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
        const successDiv = this.container.querySelector('#admin-success');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            successDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; border-radius: 3px;';
        }
    }

    /**
     * Update only the table body without re-rendering the entire UI
     * This preserves filters, selections, and event listeners
     */
    updateTableBody() {
        const tableBody = this.container.querySelector('#users-table-body');
        const noResults = this.container.querySelector('#no-results');
        const table = this.container.querySelector('#users-table');
        
        if (!tableBody && !table) {
            console.warn('[AdminUI] Table not found, falling back to full render');
            this.render();
            return;
        }

        // Update table body content if it exists
        if (tableBody) {
            tableBody.innerHTML = this.renderUsersTable();
        }
        
        // Show/hide no results message and table
        if (this.filteredUsers.length === 0) {
            if (noResults) {
                noResults.style.display = 'block';
            }
            if (table) {
                table.style.display = 'none';
            }
        } else {
            if (noResults) {
                noResults.style.display = 'none';
            }
            if (table) {
                table.style.display = 'table';
            }
        }

        // Re-attach event listeners for the updated table
        this.attachTableEventListeners();
        
        // Update select-all checkbox state
        const selectAll = this.container.querySelector('#select-all');
        if (selectAll && tableBody) {
            const allCheckboxes = tableBody.querySelectorAll('.user-checkbox');
            const checkedCheckboxes = tableBody.querySelectorAll('.user-checkbox:checked');
            selectAll.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
        }
    }

    /**
     * Attach event listeners only to table elements (not filters/navigation)
     */
    attachTableEventListeners() {
        // Approve buttons
        const approveButtons = this.container.querySelectorAll('.approve-btn');
        approveButtons.forEach(button => {
            // Remove existing listeners by cloning
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                this.handleApprove(userId);
            });
        });

        // Reject buttons
        const rejectButtons = this.container.querySelectorAll('.reject-btn');
        rejectButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                this.handleReject(userId);
            });
        });

        // Role change dropdowns
        const roleSelects = this.container.querySelectorAll('.role-select');
        roleSelects.forEach(select => {
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
            newSelect.addEventListener('change', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                const newRole = e.target.value;
                this.handleRoleChange(userId, newRole);
            });
        });

        // Trainer assignment dropdowns
        const trainerSelects = this.container.querySelectorAll('.trainer-select');
        trainerSelects.forEach(select => {
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
            newSelect.addEventListener('change', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                const trainerId = e.target.value;
                this.handleTrainerAssignment(userId, trainerId);
            });
        });

        // Delete buttons
        const deleteButtons = this.container.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                this.handleDelete(userId);
            });
        });

        // Individual user checkboxes
        const userCheckboxes = this.container.querySelectorAll('.user-checkbox');
        userCheckboxes.forEach(checkbox => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            newCheckbox.addEventListener('change', (e) => {
                const userId = e.target.getAttribute('data-user-id');
                if (e.target.checked) {
                    this.selectedUserIds.add(userId);
                } else {
                    this.selectedUserIds.delete(userId);
                }
                this.updateBulkActions();
            });
        });
    }

    /**
     * Clear messages
     */
    clearMessages() {
        const errorDiv = this.container.querySelector('#admin-error');
        const successDiv = this.container.querySelector('#admin-success');
        
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
        
        if (successDiv) {
            successDiv.style.display = 'none';
            successDiv.textContent = '';
        }
    }
}

export default AdminUI;

