/**
 * User Detail Component
 * 
 * Comprehensive view of a single user with tabs for information, activity, and management actions.
 */

import { adminService } from '../services/admin-service.js';
import { authService } from '../services/auth-service.js';
import { labSubmissionService } from '../services/lab-submission-service.js';
import { courseAllocationService } from '../services/course-allocation-service.js';
import { tagService } from '../services/tag-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class UserDetail {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.userId = null;
        this.user = null;
        this.trainers = [];
        this.submissions = [];
        this.allocations = [];
        this.userTags = [];
        this.availableTags = [];
        this.activeTab = 'overview'; // 'overview', 'activity', 'submissions', 'courses'
    }

    /**
     * Show user detail page
     */
    async show(userId) {
        if (this.container) {
            this.container.style.display = 'block';
        }

        this.userId = userId;
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
     * Load all user data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            // Load user details
            const allUsers = await adminService.getAllUsers();
            this.user = allUsers.find(u => u.id === this.userId);

            if (!this.user) {
                throw new Error('User not found');
            }

            // Load trainers for assignment
            this.trainers = await adminService.getAllTrainers();

            // Load tags (only for admin role)
            if (this.currentUser.role === 'admin') {
                try {
                    this.userTags = await tagService.getUserTags(this.userId);
                    this.availableTags = await tagService.getAllTags();
                } catch (error) {
                    console.warn('[UserDetail] Failed to load tags:', error);
                    this.userTags = [];
                    this.availableTags = [];
                }
            } else {
                this.userTags = [];
                this.availableTags = [];
            }

            // Load submissions if learner
            if (this.user.role === 'learner') {
                try {
                    this.submissions = await labSubmissionService.getAllSubmissionsForLearner(this.userId);
                } catch (error) {
                    console.warn('[UserDetail] Failed to load submissions:', error);
                    this.submissions = [];
                }

                // Load course allocations
                try {
                    // For admins, get allocations directly without trainer validation
                    if (this.currentUser.role === 'admin') {
                        const { supabaseClient } = await import('../services/supabase-client.js');
                        const { data, error } = await supabaseClient
                            .from('course_allocations')
                            .select('*')
                            .eq('user_id', this.userId)
                            .eq('status', 'active')
                            .order('allocated_at', { ascending: false });
                        
                        if (error) {
                            console.error('[UserDetail] Error loading allocations for admin:', error);
                            throw new Error('Failed to load allocations: ' + error.message);
                        }
                        this.allocations = data || [];
                        console.log('[UserDetail] Loaded allocations for admin:', this.allocations.length, this.allocations);
                    } else {
                        // For trainers, use getAllocatedCourses which doesn't require trainer validation
                        this.allocations = await courseAllocationService.getAllocatedCourses(this.userId);
                        console.log('[UserDetail] Loaded allocations for trainer:', this.allocations.length, this.allocations);
                    }
                } catch (error) {
                    console.error('[UserDetail] Failed to load allocations:', error);
                    this.allocations = [];
                }
            }
        } catch (error) {
            console.error('[UserDetail] Error loading data:', error);
            this.renderError('Failed to load user: ' + error.message);
        }
    }

    /**
     * Render user detail page
     */
    render() {
        if (!this.user) {
            return;
        }

        const userName = this.user.full_name || this.user.name || this.user.email || 'Unknown';
        const statusConfig = this.getStatusConfig(this.user.status || 'pending');

        this.container.innerHTML = `
            <div class="user-detail-page">
                <div class="user-detail-container">
                    <div class="user-detail-header">
                        <div class="user-header-left">
                            <a href="#/admin/dashboard" class="back-link">
                                <span class="back-icon">←</span>
                                <span>Back to Dashboard</span>
                            </a>
                            <div class="user-header-info">
                                <div class="user-avatar-large">
                                    <span class="avatar-initials-large">${this.getInitials(userName)}</span>
                                </div>
                                <div class="user-header-details">
                                    <h1 class="user-detail-name">${this.escapeHtml(userName)}</h1>
                                    <p class="user-detail-email">${this.escapeHtml(this.user.email)}</p>
                                    <div class="user-header-meta">
                                        <span class="user-role-badge ${this.user.role}">${this.getRoleLabel(this.user.role)}</span>
                                        <span class="user-status-badge ${statusConfig.class}">
                                            <span class="status-icon">${statusConfig.icon}</span>
                                            <span class="status-text">${statusConfig.label}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="user-header-actions">
                            ${this.renderHeaderActions()}
                        </div>
                    </div>

                    <!-- Tabs -->
                    <div class="user-detail-tabs">
                        <button class="detail-tab ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
                            <span class="tab-icon">📋</span>
                            <span class="tab-label">Overview</span>
                        </button>
                        ${this.user.role === 'learner' ? `
                            <button class="detail-tab ${this.activeTab === 'submissions' ? 'active' : ''}" data-tab="submissions">
                                <span class="tab-icon">📝</span>
                                <span class="tab-label">Submissions (${this.submissions.length})</span>
                            </button>
                            <button class="detail-tab ${this.activeTab === 'courses' ? 'active' : ''}" data-tab="courses">
                                <span class="tab-icon">📚</span>
                                <span class="tab-label">Courses (${this.allocations.length})</span>
                            </button>
                        ` : ''}
                        <button class="detail-tab ${this.activeTab === 'activity' ? 'active' : ''}" data-tab="activity">
                            <span class="tab-icon">📊</span>
                            <span class="tab-label">Activity</span>
                        </button>
                    </div>

                    <!-- Tab Content -->
                    <div class="user-detail-content">
                        <div id="tab-overview" class="tab-content-panel" style="display: ${this.activeTab === 'overview' ? 'block' : 'none'};">
                            ${this.renderOverviewTab()}
                        </div>
                        ${this.user.role === 'learner' ? `
                            <div id="tab-submissions" class="tab-content-panel" style="display: ${this.activeTab === 'submissions' ? 'block' : 'none'};">
                                ${this.renderSubmissionsTab()}
                            </div>
                            <div id="tab-courses" class="tab-content-panel" style="display: ${this.activeTab === 'courses' ? 'block' : 'none'};">
                                ${this.renderCoursesTab()}
                            </div>
                        ` : ''}
                        <div id="tab-activity" class="tab-content-panel" style="display: ${this.activeTab === 'activity' ? 'block' : 'none'};">
                            ${this.renderActivityTab()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render header actions
     */
    renderHeaderActions() {
        const actions = [];

        if ((this.user.status || 'pending') === 'pending') {
            if (this.user.role === 'learner' && !this.user.trainer_id) {
                actions.push(`
                    <button class="btn btn-primary btn-sm assign-trainer-btn">
                        Assign Trainer
                    </button>
                `);
            }
            actions.push(`
                <button class="btn btn-success btn-sm approve-user-btn">
                    Approve
                </button>
                <button class="btn btn-danger btn-sm reject-user-btn">
                    Reject
                </button>
            `);
        }

        if (this.user.role !== 'admin' && this.currentUser.id !== this.user.id) {
            actions.push(`
                <button class="btn btn-danger btn-sm delete-user-btn">
                    Delete User
                </button>
            `);
        }

        return actions.join('');
    }

    /**
     * Render overview tab
     */
    renderOverviewTab() {
        const statusConfig = this.getStatusConfig(this.user.status || 'pending');
        const createdDate = this.user.created_at ? new Date(this.user.created_at) : null;
        const approvedDate = this.user.approved_at ? new Date(this.user.approved_at) : null;
        const rejectedDate = this.user.rejected_at ? new Date(this.user.rejected_at) : null;

        return `
            <div class="overview-section">
                <h2 class="section-title">Personal Information</h2>
                <div class="info-card">
                    <div class="info-row">
                        <span class="info-label">Full Name</span>
                        <span class="info-value">${this.escapeHtml(this.user.full_name || this.user.name || 'Not set')}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email</span>
                        <span class="info-value">${this.escapeHtml(this.user.email)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Role</span>
                        <span class="info-value">
                            <span class="role-badge-inline ${this.user.role}">${this.getRoleLabel(this.user.role)}</span>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Status</span>
                        <span class="info-value">
                            <span class="status-badge-inline ${statusConfig.class}">
                                ${statusConfig.icon} ${statusConfig.label}
                            </span>
                        </span>
                    </div>
                    ${this.user.role === 'learner' ? `
                        <div class="info-row">
                            <span class="info-label">Learner Type</span>
                            <span class="info-value">
                                <select class="learner-type-select" data-user-id="${this.user.id}" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="active" ${this.user.learner_type === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="inactive" ${this.user.learner_type === 'inactive' ? 'selected' : ''}>Inactive</option>
                                    <option value="graduate" ${this.user.learner_type === 'graduate' ? 'selected' : ''}>Graduate</option>
                                    <option value="archive" ${this.user.learner_type === 'archive' ? 'selected' : ''}>Archive</option>
                                    <option value="" ${!this.user.learner_type ? 'selected' : ''}>Not Set</option>
                                </select>
                            </span>
                        </div>
                    ` : ''}
                    ${(this.user.role === 'learner' || this.user.role === 'trainer') && this.user.trainer_id ? `
                        <div class="info-row">
                            <span class="info-label">Assigned Trainer</span>
                            <span class="info-value">
                                ${this.getTrainerName(this.user.trainer_id)}
                            </span>
                        </div>
                    ` : ''}
                    ${createdDate ? `
                        <div class="info-row">
                            <span class="info-label">Registered</span>
                            <span class="info-value">${createdDate.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${approvedDate ? `
                        <div class="info-row">
                            <span class="info-label">Approved</span>
                            <span class="info-value">${approvedDate.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${rejectedDate ? `
                        <div class="info-row">
                            <span class="info-label">Rejected</span>
                            <span class="info-value">${rejectedDate.toLocaleString()}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${this.user.role === 'learner' ? `
                <div class="overview-section">
                    <h2 class="section-title">Statistics</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">📝</div>
                            <div class="stat-content">
                                <div class="stat-value">${this.submissions.length}</div>
                                <div class="stat-label">Total Submissions</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">✓</div>
                            <div class="stat-content">
                                <div class="stat-value">${this.submissions.filter(s => s.status === 'approved').length}</div>
                                <div class="stat-label">Approved</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏳</div>
                            <div class="stat-content">
                                <div class="stat-value">${this.submissions.filter(s => s.status === 'submitted').length}</div>
                                <div class="stat-label">Pending</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📚</div>
                            <div class="stat-content">
                                <div class="stat-value">${this.allocations.length}</div>
                                <div class="stat-label">Assigned Courses</div>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            ${this.currentUser.role === 'admin' ? `
                <div class="overview-section">
                    <h2 class="section-title">Tags</h2>
                    <div class="tags-section">
                        <div class="tags-display">
                            ${this.userTags.length > 0 ? `
                                <div class="tags-list">
                                    ${this.userTags.map(tag => `
                                        <span class="user-tag" style="background-color: ${tag.color || '#6366f1'}20; color: ${tag.color || '#6366f1'}; border-color: ${tag.color || '#6366f1'};">
                                            ${this.escapeHtml(tag.name)}
                                            <button class="tag-remove-btn" data-tag-id="${tag.id}" title="Remove tag">
                                                ×
                                            </button>
                                        </span>
                                    `).join('')}
                                </div>
                            ` : `
                                <p class="tags-empty-message">No tags assigned</p>
                            `}
                        </div>
                        <div class="tags-actions">
                            <select class="tag-select" id="tag-select-${this.userId}">
                                <option value="">Select a tag to add...</option>
                                ${this.availableTags
                                    .filter(tag => !this.userTags.some(ut => ut.id === tag.id))
                                    .map(tag => `
                                        <option value="${tag.id}">${this.escapeHtml(tag.name)}</option>
                                    `).join('')}
                            </select>
                            <button class="btn btn-primary btn-sm add-tag-btn" data-user-id="${this.userId}">
                                Add Tag
                            </button>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    }

    /**
     * Render submissions tab
     */
    renderSubmissionsTab() {
        if (this.submissions.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">No submissions yet</div>
                    <p class="empty-description">This learner hasn't submitted any labs yet.</p>
                </div>
            `;
        }

        return `
            <div class="submissions-section">
                <div class="submissions-list">
                    ${this.submissions.map(submission => {
                        const statusConfig = this.getSubmissionStatusConfig(submission.status);
                        const submittedDate = submission.submitted_at ? new Date(submission.submitted_at) : null;

                        return `
                            <div class="submission-item-card">
                                <div class="submission-item-header">
                                    <div class="submission-info">
                                        <div class="submission-course-lab">
                                            <span class="submission-course">${this.escapeHtml(submission.course_id)}</span>
                                            <span class="submission-separator">•</span>
                                            <span class="submission-lab">Lab ${this.escapeHtml(submission.lab_id)}</span>
                                        </div>
                                        <div class="submission-date">${submittedDate ? submittedDate.toLocaleString() : 'N/A'}</div>
                                    </div>
                                    <div class="submission-status ${statusConfig.class}">
                                        <span class="status-icon">${statusConfig.icon}</span>
                                        <span class="status-text">${statusConfig.label}</span>
                                    </div>
                                </div>
                                ${submission.feedback ? `
                                    <div class="submission-feedback">
                                        <div class="feedback-label">Feedback:</div>
                                        <div class="feedback-text">${this.escapeHtml(submission.feedback.length > 200 ? submission.feedback.substring(0, 200) + '...' : submission.feedback)}</div>
                                    </div>
                                ` : ''}
                                <div class="submission-actions">
                                    <a href="#/submissions/${submission.id}" class="btn btn-ghost btn-sm">View Details</a>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render courses tab
     */
    renderCoursesTab() {
        if (this.allocations.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <div class="empty-text">No courses assigned</div>
                    <p class="empty-description">This learner hasn't been assigned any courses yet.</p>
                </div>
            `;
        }

        return `
            <div class="courses-section">
                <div class="courses-list">
                    ${this.allocations.map(allocation => {
                        const statusConfig = this.getAllocationStatusConfig(allocation.status);

                        return `
                            <div class="course-item-card">
                                <div class="course-item-header">
                                    <div class="course-info">
                                        <div class="course-name">${this.escapeHtml(allocation.course_id)}</div>
                                        <div class="course-meta">
                                            <span class="course-status ${statusConfig.class}">
                                                ${statusConfig.icon} ${statusConfig.label}
                                            </span>
                                            ${allocation.allocated_at ? `
                                                <span class="course-allocated">Allocated ${new Date(allocation.allocated_at).toLocaleDateString()}</span>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="course-item-actions">
                                    <a href="#/courses/${allocation.course_id}" class="btn btn-ghost btn-sm">View Course</a>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render activity tab
     */
    renderActivityTab() {
        const activities = [];

        // Registration
        if (this.user.created_at) {
            activities.push({
                type: 'registered',
                icon: '👤',
                title: 'User Registered',
                date: new Date(this.user.created_at),
                description: 'User account was created'
            });
        }

        // Approval/Rejection
        if (this.user.approved_at) {
            activities.push({
                type: 'approved',
                icon: '✓',
                title: 'User Approved',
                date: new Date(this.user.approved_at),
                description: 'Account was approved by administrator'
            });
        } else if (this.user.rejected_at) {
            activities.push({
                type: 'rejected',
                icon: '✗',
                title: 'User Rejected',
                date: new Date(this.user.rejected_at),
                description: 'Account was rejected by administrator'
            });
        }

        // Trainer assignment
        if (this.user.trainer_id && this.user.role === 'learner') {
            activities.push({
                type: 'trainer_assigned',
                icon: '👨‍🏫',
                title: 'Trainer Assigned',
                date: this.user.updated_at ? new Date(this.user.updated_at) : new Date(),
                description: `Assigned to trainer: ${this.getTrainerName(this.user.trainer_id)}`
            });
        }

        // Sort by date (latest first)
        activities.sort((a, b) => b.date.getTime() - a.date.getTime());

        if (activities.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-text">No activity recorded</div>
                </div>
            `;
        }

        return `
            <div class="activity-section">
                <div class="activity-timeline">
                    ${activities.map((activity, index) => `
                        <div class="activity-item">
                            <div class="activity-timeline-dot">
                                <span class="activity-icon">${activity.icon}</span>
                            </div>
                            ${index < activities.length - 1 ? '<div class="activity-timeline-line"></div>' : ''}
                            <div class="activity-content">
                                <div class="activity-title">${activity.title}</div>
                                <div class="activity-description">${activity.description}</div>
                                <div class="activity-date">${activity.date.toLocaleString()}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Get trainer name
     */
    getTrainerName(trainerId) {
        const trainer = this.trainers.find(t => t.id === trainerId);
        return trainer ? (trainer.full_name || trainer.name || trainer.email || 'Unknown') : 'Unknown';
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
            'approved': {
                label: 'Approved',
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
     * Get submission status configuration
     */
    getSubmissionStatusConfig(status) {
        const configs = {
            'submitted': {
                label: 'Submitted',
                icon: '📤',
                class: 'status-submitted'
            },
            'reviewed': {
                label: 'Reviewed',
                icon: '✓',
                class: 'status-reviewed'
            },
            'approved': {
                label: 'Approved',
                icon: '✓',
                class: 'status-approved'
            },
            'needs_revision': {
                label: 'Needs Revision',
                icon: '↻',
                class: 'status-revision'
            }
        };
        return configs[status] || configs['submitted'];
    }

    /**
     * Get allocation status configuration
     */
    getAllocationStatusConfig(status) {
        const configs = {
            'active': {
                label: 'Active',
                icon: '✓',
                class: 'status-active'
            },
            'completed': {
                label: 'Completed',
                icon: '✓',
                class: 'status-approved'
            },
            'inactive': {
                label: 'Inactive',
                icon: '⏸',
                class: 'status-pending'
            }
        };
        return configs[status] || configs['active'];
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
        // Tab switching
        const tabs = this.container.querySelectorAll('.detail-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.getAttribute('data-tab');
                this.render();
            });
        });

        // Approve button
        const approveBtn = this.container.querySelector('.approve-user-btn');
        if (approveBtn) {
            approveBtn.addEventListener('click', async () => {
                await this.handleApprove();
            });
        }

        // Reject button
        const rejectBtn = this.container.querySelector('.reject-user-btn');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', async () => {
                await this.handleReject();
            });
        }

        // Assign trainer button
        const assignTrainerBtn = this.container.querySelector('.assign-trainer-btn');
        if (assignTrainerBtn) {
            assignTrainerBtn.addEventListener('click', async () => {
                await this.handleAssignTrainer();
            });
        }

        // Delete button
        const deleteBtn = this.container.querySelector('.delete-user-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                await this.handleDelete();
            });
        }

        // Learner type selector
        const learnerTypeSelect = this.container.querySelector('.learner-type-select');
        if (learnerTypeSelect) {
            learnerTypeSelect.addEventListener('change', async (e) => {
                await this.handleLearnerTypeChange(e.target.value);
            });
        }

        // Tag management (admin only)
        if (this.currentUser && this.currentUser.role === 'admin') {
            // Add tag button
            const addTagBtn = this.container.querySelector('.add-tag-btn');
            if (addTagBtn) {
                addTagBtn.addEventListener('click', async () => {
                    await this.handleAddTag();
                });
            }

            // Remove tag buttons
            const removeTagBtns = this.container.querySelectorAll('.tag-remove-btn');
            removeTagBtns.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const tagId = btn.getAttribute('data-tag-id');
                    await this.handleRemoveTag(tagId);
                });
            });
        }
    }

    /**
     * Handle learner type change
     */
    async handleLearnerTypeChange(newLearnerType) {
        const oldLearnerType = this.user.learner_type || '';
        const displayType = newLearnerType || 'Not Set';
        
        if (!confirm(`Change learner type from "${oldLearnerType || 'Not Set'}" to "${displayType}"?`)) {
            // Reset to old value
            const select = this.container.querySelector('.learner-type-select');
            if (select) {
                select.value = oldLearnerType || '';
            }
            return;
        }

        const select = this.container.querySelector('.learner-type-select');
        if (select) {
            select.disabled = true;
        }

        try {
            const learnerType = newLearnerType === '' ? null : newLearnerType;
            await adminService.updateLearnerType(this.userId, learnerType);
            alert('Learner type updated successfully');
            await this.loadData();
            this.render();
        } catch (error) {
            alert('Failed to update learner type: ' + error.message);
            // Reset to old value on error
            if (select) {
                select.value = oldLearnerType || '';
                select.disabled = false;
            }
        }
    }

    /**
     * Handle add tag
     */
    async handleAddTag() {
        const tagSelect = this.container.querySelector(`#tag-select-${this.userId}`);
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

        const addBtn = this.container.querySelector('.add-tag-btn');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = 'Adding...';
        }

        try {
            await tagService.assignTagToUser(this.userId, tagId, this.currentUser.id);
            
            // Reload tags
            this.userTags = await tagService.getUserTags(this.userId);
            this.availableTags = await tagService.getAllTags();
            
            // Re-render to show updated tags
            this.render();
        } catch (error) {
            alert('Failed to add tag: ' + error.message);
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.textContent = 'Add Tag';
            }
        }
    }

    /**
     * Handle remove tag
     */
    async handleRemoveTag(tagId) {
        const tag = this.userTags.find(t => t.id === tagId);
        if (!tag) return;

        if (!confirm(`Remove tag "${tag.name}" from this user?`)) {
            return;
        }

        try {
            await tagService.removeTagFromUser(this.userId, tagId);
            
            // Reload tags
            this.userTags = await tagService.getUserTags(this.userId);
            this.availableTags = await tagService.getAllTags();
            
            // Re-render to show updated tags
            this.render();
        } catch (error) {
            alert('Failed to remove tag: ' + error.message);
        }
    }

    /**
     * Handle approve
     */
    async handleApprove() {
        if (!confirm('Approve this user?')) {
            return;
        }

        const button = this.container.querySelector('.approve-user-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Approving...';
        }

        try {
            await adminService.approveUser(this.userId);
            alert('User approved successfully');
            await this.loadData();
            this.render();
        } catch (error) {
            alert('Failed to approve user: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Approve';
            }
        }
    }

    /**
     * Handle reject
     */
    async handleReject() {
        if (!confirm('Reject this user? This action cannot be undone.')) {
            return;
        }

        const button = this.container.querySelector('.reject-user-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Rejecting...';
        }

        try {
            await adminService.rejectUser(this.userId);
            alert('User rejected successfully');
            await this.loadData();
            this.render();
        } catch (error) {
            alert('Failed to reject user: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Reject';
            }
        }
    }

    /**
     * Handle assign trainer
     */
    async handleAssignTrainer() {
        if (this.trainers.length === 0) {
            alert('No trainers available. Please create trainers first.');
            return;
        }

        const trainerOptions = this.trainers.map((t, i) => `${i + 1}. ${t.full_name || t.name || t.email}`).join('\n');
        const trainerId = prompt(`Select a trainer:\n\n${trainerOptions}\n\nEnter trainer number (1-${this.trainers.length}):`);
        
        if (!trainerId) return;

        const trainerIndex = parseInt(trainerId) - 1;
        if (trainerIndex < 0 || trainerIndex >= this.trainers.length) {
            alert('Invalid trainer selection');
            return;
        }

        const selectedTrainer = this.trainers[trainerIndex];

        const button = this.container.querySelector('.assign-trainer-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Assigning...';
        }

        try {
            await adminService.assignTrainer(this.userId, selectedTrainer.id);
            alert('Trainer assigned successfully');
            await this.loadData();
            this.render();
        } catch (error) {
            alert('Failed to assign trainer: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Assign Trainer';
            }
        }
    }

    /**
     * Handle delete
     */
    async handleDelete() {
        const userName = this.user.full_name || this.user.name || this.user.email || 'this user';
        if (!confirm(`Are you sure you want to delete ${userName}?\n\nThis action cannot be undone.`)) {
            return;
        }

        const button = this.container.querySelector('.delete-user-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Deleting...';
        }

        try {
            await adminService.deleteUser(this.userId);
            alert('User deleted successfully');
            router.navigate('/admin/dashboard');
        } catch (error) {
            alert('Failed to delete user: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = 'Delete User';
            }
        }
    }

    /**
     * Render error
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="user-detail-page">
                <div class="user-detail-container">
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h2 class="error-title">Error Loading User</h2>
                        <p class="error-message">${this.escapeHtml(message)}</p>
                        <a href="#/admin/dashboard" class="btn btn-primary">Back to Dashboard</a>
                    </div>
                </div>
            </div>
        `;
    }
}

export default UserDetail;

