/**
 * Pending Approvals Component
 * 
 * Dedicated page for reviewing and approving/rejecting pending user registrations.
 */

import { adminService } from '../services/admin-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class PendingApprovals {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.pendingUsers = [];
        this.trainers = [];
        this.selectedUserIds = new Set();
        this.filters = {
            search: '',
            role: ''
        };
    }

    /**
     * Show pending approvals page
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
     * Load pending users and trainers
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            // Load all users and filter for pending
            const allUsers = await adminService.getAllUsers();
            this.pendingUsers = allUsers.filter(u => (u.status || 'pending') === 'pending');
            
            // Load trainers for assignment
            this.trainers = await adminService.getAllTrainers();
        } catch (error) {
            console.error('[PendingApprovals] Error loading data:', error);
            this.renderError('Failed to load pending approvals: ' + error.message);
        }
    }

    /**
     * Apply filters
     */
    applyFilters() {
        let filtered = [...this.pendingUsers];

        if (this.filters.search.trim()) {
            const query = this.filters.search.toLowerCase().trim();
            filtered = filtered.filter(user => {
                const name = (user.full_name || user.name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                return name.includes(query) || email.includes(query);
            });
        }

        if (this.filters.role) {
            filtered = filtered.filter(user => user.role === this.filters.role);
        }

        return filtered;
    }

    /**
     * Render pending approvals page
     */
    render() {
        const filteredUsers = this.applyFilters();

        this.container.innerHTML = `
            <div class="pending-approvals-page">
                <div class="approvals-container">
                    <div class="approvals-header">
                        <div>
                            <h1 class="approvals-title">Pending Approvals</h1>
                            <p class="approvals-subtitle">Review and approve user registrations</p>
                        </div>
                        <div class="approvals-actions">
                            <a href="#/admin/dashboard" class="btn btn-ghost">
                                <span class="btn-icon">←</span>
                                <span>Back to Dashboard</span>
                            </a>
                        </div>
                    </div>

                    <div id="approvals-error" class="error-message" style="display: none;"></div>
                    <div id="approvals-success" class="success-message" style="display: none;"></div>

                    <!-- Filters -->
                    <div class="approvals-filters">
                        <div class="search-box">
                            <input 
                                type="text" 
                                id="search-input" 
                                class="search-input" 
                                placeholder="Search by name or email..."
                                value="${this.escapeHtml(this.filters.search)}"
                            >
                            <span class="search-icon">🔍</span>
                        </div>
                        <div class="filter-controls">
                            <label for="role-filter" class="filter-label">Role:</label>
                            <select id="role-filter" class="filter-select">
                                <option value="">All Roles</option>
                                <option value="learner" ${this.filters.role === 'learner' ? 'selected' : ''}>Learner</option>
                                <option value="trainer" ${this.filters.role === 'trainer' ? 'selected' : ''}>Trainer</option>
                                <option value="admin" ${this.filters.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                    </div>

                    <!-- Bulk Actions -->
                    ${this.selectedUserIds.size > 0 ? `
                        <div class="bulk-actions-bar">
                            <div class="bulk-actions-content">
                                <span class="bulk-actions-count">${this.selectedUserIds.size} selected</span>
                                <button id="bulk-approve" class="btn btn-success btn-sm">Approve Selected</button>
                                <button id="bulk-reject" class="btn btn-danger btn-sm">Reject Selected</button>
                                <button id="bulk-assign-trainer" class="btn btn-primary btn-sm">Assign Trainer</button>
                                <button id="clear-selection" class="btn btn-ghost btn-sm">Clear Selection</button>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Pending Users List -->
                    ${filteredUsers.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-icon">✓</div>
                            <div class="empty-text">No pending approvals</div>
                            <p class="empty-description">All users have been reviewed!</p>
                        </div>
                    ` : `
                        <div class="approvals-stats-bar">
                            <div class="stat-item">
                                <span class="stat-label">Total Pending:</span>
                                <span class="stat-value">${this.pendingUsers.length}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Showing:</span>
                                <span class="stat-value">${filteredUsers.length}</span>
                            </div>
                        </div>

                        <div class="pending-users-list">
                            ${filteredUsers.map(user => this.renderPendingUserCard(user)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render pending user card
     */
    renderPendingUserCard(user) {
        const userName = user.full_name || user.name || user.email || 'Unknown';
        const createdDate = user.created_at ? new Date(user.created_at) : null;
        const daysAgo = createdDate ? Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const isSelected = this.selectedUserIds.has(user.id);
        const needsTrainer = user.role === 'learner' && !user.trainer_id;

        return `
            <div class="pending-user-card ${isSelected ? 'selected' : ''}">
                <div class="user-card-checkbox">
                    <input 
                        type="checkbox" 
                        class="user-checkbox" 
                        data-user-id="${user.id}"
                        ${isSelected ? 'checked' : ''}
                    >
                </div>
                <div class="user-card-content">
                    <div class="user-card-header">
                        <div class="user-avatar-medium">
                            <span class="avatar-initials-medium">${this.getInitials(userName)}</span>
                        </div>
                        <div class="user-info">
                            <div class="user-name-large">${this.escapeHtml(userName)}</div>
                            <div class="user-email">${this.escapeHtml(user.email)}</div>
                            <div class="user-meta">
                                <span class="user-role-badge ${user.role}">${this.getRoleLabel(user.role)}</span>
                                ${createdDate ? `<span class="user-registered">Registered ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago</span>` : ''}
                                ${needsTrainer ? `<span class="trainer-warning">⚠️ Needs Trainer Assignment</span>` : ''}
                            </div>
                        </div>
                        ${daysAgo > 0 ? `
                            <div class="approval-priority priority-${daysAgo >= 7 ? 'high' : daysAgo >= 3 ? 'medium' : 'low'}">
                                ${daysAgo}d
                            </div>
                        ` : ''}
                    </div>
                    <div class="user-card-actions">
                        ${needsTrainer ? `
                            <button class="btn btn-primary btn-sm assign-trainer-btn" data-user-id="${user.id}">
                                Assign Trainer
                            </button>
                        ` : ''}
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
     * Attach event listeners
     */
    attachEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.render();
            });
        }

        // Role filter
        const roleFilter = document.getElementById('role-filter');
        if (roleFilter) {
            roleFilter.addEventListener('change', (e) => {
                this.filters.role = e.target.value;
                this.render();
            });
        }

        // Checkboxes
        const checkboxes = this.container.querySelectorAll('.user-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const userId = checkbox.getAttribute('data-user-id');
                if (checkbox.checked) {
                    this.selectedUserIds.add(userId);
                } else {
                    this.selectedUserIds.delete(userId);
                }
                this.render();
            });
        });

        // Select all checkbox (if exists)
        const selectAll = this.container.querySelector('#select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const filteredUsers = this.applyFilters();
                if (selectAll.checked) {
                    filteredUsers.forEach(user => this.selectedUserIds.add(user.id));
                } else {
                    filteredUsers.forEach(user => this.selectedUserIds.delete(user.id));
                }
                this.render();
            });
        }

        // Approve buttons
        const approveButtons = this.container.querySelectorAll('.approve-user-btn');
        approveButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = button.getAttribute('data-user-id');
                await this.handleApprove(userId);
            });
        });

        // Reject buttons
        const rejectButtons = this.container.querySelectorAll('.reject-user-btn');
        rejectButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = button.getAttribute('data-user-id');
                await this.handleReject(userId);
            });
        });

        // Assign trainer buttons
        const assignTrainerButtons = this.container.querySelectorAll('.assign-trainer-btn');
        assignTrainerButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = button.getAttribute('data-user-id');
                await this.handleAssignTrainer(userId);
            });
        });

        // Bulk actions
        const bulkApprove = document.getElementById('bulk-approve');
        if (bulkApprove) {
            bulkApprove.addEventListener('click', async () => {
                await this.handleBulkApprove();
            });
        }

        const bulkReject = document.getElementById('bulk-reject');
        if (bulkReject) {
            bulkReject.addEventListener('click', async () => {
                await this.handleBulkReject();
            });
        }

        const bulkAssignTrainer = document.getElementById('bulk-assign-trainer');
        if (bulkAssignTrainer) {
            bulkAssignTrainer.addEventListener('click', async () => {
                await this.handleBulkAssignTrainer();
            });
        }

        const clearSelection = document.getElementById('clear-selection');
        if (clearSelection) {
            clearSelection.addEventListener('click', () => {
                this.selectedUserIds.clear();
                this.render();
            });
        }
    }

    /**
     * Handle approve action
     */
    async handleApprove(userId) {
        const button = this.container.querySelector(`.approve-user-btn[data-user-id="${userId}"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Approving...';
        }

        try {
            await adminService.approveUser(userId);
            this.showSuccess('User approved successfully');
            await this.loadData();
            this.render();
        } catch (error) {
            this.showError('Failed to approve user: ' + error.message);
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
        if (!confirm('Are you sure you want to reject this user? This action cannot be undone.')) {
            return;
        }

        const button = this.container.querySelector(`.reject-user-btn[data-user-id="${userId}"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Rejecting...';
        }

        try {
            await adminService.rejectUser(userId);
            this.showSuccess('User rejected successfully');
            await this.loadData();
            this.render();
        } catch (error) {
            this.showError('Failed to reject user: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Reject';
            }
        }
    }

    /**
     * Handle assign trainer
     */
    async handleAssignTrainer(userId) {
        if (this.trainers.length === 0) {
            this.showError('No trainers available. Please create trainers first.');
            return;
        }

        const trainerOptions = this.trainers.map(t => 
            `<option value="${t.id}">${this.escapeHtml(t.full_name || t.name || t.email)}</option>`
        ).join('');

        const trainerId = prompt(`Select a trainer:\n\n${this.trainers.map((t, i) => `${i + 1}. ${t.full_name || t.name || t.email}`).join('\n')}\n\nEnter trainer number (1-${this.trainers.length}):`);
        
        if (!trainerId) return;

        const trainerIndex = parseInt(trainerId) - 1;
        if (trainerIndex < 0 || trainerIndex >= this.trainers.length) {
            this.showError('Invalid trainer selection');
            return;
        }

        const selectedTrainer = this.trainers[trainerIndex];

        const button = this.container.querySelector(`.assign-trainer-btn[data-user-id="${userId}"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Assigning...';
        }

        try {
            await adminService.assignTrainer(userId, selectedTrainer.id);
            this.showSuccess('Trainer assigned successfully');
            await this.loadData();
            this.render();
        } catch (error) {
            this.showError('Failed to assign trainer: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Assign Trainer';
            }
        }
    }

    /**
     * Handle bulk approve
     */
    async handleBulkApprove() {
        if (this.selectedUserIds.size === 0) return;

        if (!confirm(`Approve ${this.selectedUserIds.size} user(s)?`)) {
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of this.selectedUserIds) {
            try {
                await adminService.approveUser(userId);
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(error.message);
            }
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully approved ${successCount} user(s)`);
        } else {
            this.showError(`Approved ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadData();
        this.render();
    }

    /**
     * Handle bulk reject
     */
    async handleBulkReject() {
        if (this.selectedUserIds.size === 0) return;

        if (!confirm(`Reject ${this.selectedUserIds.size} user(s)? This action cannot be undone.`)) {
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of this.selectedUserIds) {
            try {
                await adminService.rejectUser(userId);
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(error.message);
            }
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully rejected ${successCount} user(s)`);
        } else {
            this.showError(`Rejected ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadData();
        this.render();
    }

    /**
     * Handle bulk assign trainer
     */
    async handleBulkAssignTrainer() {
        if (this.selectedUserIds.size === 0) return;

        if (this.trainers.length === 0) {
            this.showError('No trainers available. Please create trainers first.');
            return;
        }

        const trainerOptions = this.trainers.map((t, i) => `${i + 1}. ${t.full_name || t.name || t.email}`).join('\n');
        const trainerId = prompt(`Select a trainer for all selected users:\n\n${trainerOptions}\n\nEnter trainer number (1-${this.trainers.length}):`);
        
        if (!trainerId) return;

        const trainerIndex = parseInt(trainerId) - 1;
        if (trainerIndex < 0 || trainerIndex >= this.trainers.length) {
            this.showError('Invalid trainer selection');
            return;
        }

        const selectedTrainer = this.trainers[trainerIndex];

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const userId of this.selectedUserIds) {
            try {
                await adminService.assignTrainer(userId, selectedTrainer.id);
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(error.message);
            }
        }

        if (errorCount === 0) {
            this.showSuccess(`Successfully assigned trainer to ${successCount} user(s)`);
        } else {
            this.showError(`Assigned ${successCount}, failed ${errorCount}. Errors: ${errors.join('; ')}`);
        }

        this.selectedUserIds.clear();
        await this.loadData();
        this.render();
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.getElementById('approvals-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const successDiv = document.getElementById('approvals-success');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Render error
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="pending-approvals-page">
                <div class="approvals-container">
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h2 class="error-title">Error Loading Approvals</h2>
                        <p class="error-message">${this.escapeHtml(message)}</p>
                        <a href="#/admin/dashboard" class="btn btn-primary">Back to Dashboard</a>
                    </div>
                </div>
            </div>
        `;
    }
}

export default PendingApprovals;

