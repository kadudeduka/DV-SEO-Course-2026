/**
 * Learner Management Component
 * 
 * Admin interface for managing learner types and learner-specific settings.
 */

import { adminService } from '../services/admin-service.js';
import Header from './header.js';

class LearnerManagement {
    constructor(container) {
        this.container = container;
        this.learners = [];
        this.filteredLearners = [];
        this.filters = {
            search: '',
            learnerType: 'all',
            status: 'all'
        };
    }

    /**
     * Show learner management page
     */
    async show() {
        console.log('[LearnerManagement] show() called');
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        // Render header
        await this.renderHeader();
        
        // Load learners
        await this.loadLearners();
        
        // Render page
        this.render();
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
            const headerDiv = document.createElement('div');
            headerDiv.id = 'header-container';
            document.body.insertBefore(headerDiv, document.body.firstChild);
            const header = new Header(headerDiv);
            await header.init();
        }
    }

    /**
     * Load all learners
     */
    async loadLearners() {
        try {
            const allUsers = await adminService.getAllUsers();
            // Filter to only learners
            this.learners = allUsers.filter(user => user.role === 'learner');
            this.applyFilters();
        } catch (error) {
            console.error('[LearnerManagement] Error loading learners:', error);
            this.showError('Failed to load learners: ' + error.message);
            this.learners = [];
        }
    }

    /**
     * Apply filters to learners
     */
    applyFilters() {
        this.filteredLearners = [...this.learners];

        // Search filter
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            this.filteredLearners = this.filteredLearners.filter(learner => {
                const name = (learner.full_name || '').toLowerCase();
                const email = (learner.email || '').toLowerCase();
                return name.includes(searchTerm) || email.includes(searchTerm);
            });
        }

        // Learner type filter
        if (this.filters.learnerType !== 'all') {
            this.filteredLearners = this.filteredLearners.filter(learner => 
                learner.learner_type === this.filters.learnerType
            );
        }

        // Status filter
        if (this.filters.status !== 'all') {
            this.filteredLearners = this.filteredLearners.filter(learner => 
                learner.status === this.filters.status
            );
        }
    }

    /**
     * Render learner management page
     */
    render() {
        this.container.innerHTML = `
            <div class="learner-management-page">
                <div class="admin-container">
                    <div class="admin-header">
                        <div>
                            <h1 class="admin-title">Learner Management</h1>
                            <p class="admin-subtitle">Manage learner types and learner-specific settings</p>
                        </div>
                    </div>

                    <div id="learner-error" class="error-message" style="display: none;"></div>
                    <div id="learner-success" class="success-message" style="display: none;"></div>

                    <!-- Filters -->
                    <div class="admin-filters">
                        <div class="filter-group">
                            <label for="learner-search" class="filter-label">Search</label>
                            <input 
                                type="text" 
                                id="learner-search" 
                                class="filter-input" 
                                placeholder="Search by name or email..."
                                value="${this.filters.search}">
                        </div>
                        <div class="filter-group">
                            <label for="learner-type-filter" class="filter-label">Learner Type</label>
                            <select id="learner-type-filter" class="filter-input">
                                <option value="all" ${this.filters.learnerType === 'all' ? 'selected' : ''}>All Types</option>
                                <option value="active" ${this.filters.learnerType === 'active' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${this.filters.learnerType === 'inactive' ? 'selected' : ''}>Inactive</option>
                                <option value="graduate" ${this.filters.learnerType === 'graduate' ? 'selected' : ''}>Graduate</option>
                                <option value="archive" ${this.filters.learnerType === 'archive' ? 'selected' : ''}>Archive</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="status-filter" class="filter-label">Status</label>
                            <select id="status-filter" class="filter-input">
                                <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>All Statuses</option>
                                <option value="pending" ${this.filters.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="approved" ${this.filters.status === 'approved' ? 'selected' : ''}>Approved</option>
                                <option value="rejected" ${this.filters.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </div>
                    </div>

                    <!-- Learners Table -->
                    <div class="admin-section">
                        <div class="section-header">
                            <h2 class="section-title">Learners (${this.filteredLearners.length})</h2>
                        </div>
                        ${this.renderLearnersTable()}
                    </div>
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Render learners table
     */
    renderLearnersTable() {
        if (this.filteredLearners.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">🎓</div>
                    <div class="empty-text">No learners found</div>
                    <p class="empty-description">${this.learners.length === 0 ? 'No learners in the system yet.' : 'No learners match your filters.'}</p>
                </div>
            `;
        }

        return `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Learner Type</th>
                            <th>Status</th>
                            <th>Trainer</th>
                            <th>Registered</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredLearners.map(learner => this.renderLearnerRow(learner)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render learner row
     */
    renderLearnerRow(learner) {
        const createdDate = learner.created_at ? new Date(learner.created_at).toLocaleDateString() : 'N/A';
        const learnerType = learner.learner_type || 'active';
        const status = learner.status || 'pending';
        
        return `
            <tr data-learner-id="${learner.id}">
                <td>${this.escapeHtml(learner.full_name || 'N/A')}</td>
                <td>${this.escapeHtml(learner.email)}</td>
                <td>
                    <select class="learner-type-select form-select-sm" data-learner-id="${learner.id}">
                        <option value="active" ${learnerType === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${learnerType === 'inactive' ? 'selected' : ''}>Inactive</option>
                        <option value="graduate" ${learnerType === 'graduate' ? 'selected' : ''}>Graduate</option>
                        <option value="archive" ${learnerType === 'archive' ? 'selected' : ''}>Archive</option>
                    </select>
                </td>
                <td>
                    <span class="status-badge status-${status}">${this.getStatusLabel(status)}</span>
                </td>
                <td>${learner.trainer_id ? 'Assigned' : 'Not Assigned'}</td>
                <td>${createdDate}</td>
                <td>
                    <a href="#/admin/users/${learner.id}" class="btn btn-sm btn-secondary">View Details</a>
                </td>
            </tr>
        `;
    }

    /**
     * Get status label
     */
    getStatusLabel(status) {
        const labels = {
            'pending': 'Pending',
            'approved': 'Approved',
            'rejected': 'Rejected'
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
        // Search input
        const searchInput = document.getElementById('learner-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
                this.render();
            });
        }

        // Learner type filter
        const learnerTypeFilter = document.getElementById('learner-type-filter');
        if (learnerTypeFilter) {
            learnerTypeFilter.addEventListener('change', (e) => {
                this.filters.learnerType = e.target.value;
                this.applyFilters();
                this.render();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
                this.render();
            });
        }

        // Learner type selects
        const learnerTypeSelects = this.container.querySelectorAll('.learner-type-select');
        learnerTypeSelects.forEach(select => {
            select.addEventListener('change', async (e) => {
                const learnerId = e.target.getAttribute('data-learner-id');
                const newLearnerType = e.target.value;
                await this.handleLearnerTypeChange(learnerId, newLearnerType);
            });
        });
    }

    /**
     * Handle learner type change
     */
    async handleLearnerTypeChange(learnerId, newLearnerType) {
        const select = this.container.querySelector(`.learner-type-select[data-learner-id="${learnerId}"]`);
        if (!select) return;

        const learner = this.learners.find(l => l.id === learnerId);
        if (!learner) return;

        const oldLearnerType = learner.learner_type || 'active';

        if (oldLearnerType === newLearnerType) {
            return; // No change needed
        }

        select.disabled = true;
        const originalValue = oldLearnerType;

        try {
            await adminService.updateLearnerType(learnerId, newLearnerType);
            this.showSuccess(`Learner type updated to ${newLearnerType} successfully`);
            
            // Reload learners and refresh table
            await this.loadLearners();
            this.render();
        } catch (error) {
            console.error('[LearnerManagement] Error updating learner type:', error);
            this.showError('Failed to update learner type: ' + (error.message || 'Unknown error'));
            select.value = originalValue;
            select.disabled = false;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#learner-error');
        const successDiv = this.container.querySelector('#learner-success');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
        if (successDiv) {
            successDiv.style.display = 'none';
        }
        setTimeout(() => {
            if (errorDiv) errorDiv.style.display = 'none';
        }, 5000);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const errorDiv = this.container.querySelector('#learner-error');
        const successDiv = this.container.querySelector('#learner-success');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        setTimeout(() => {
            if (successDiv) successDiv.style.display = 'none';
        }, 5000);
    }
}

export default LearnerManagement;

