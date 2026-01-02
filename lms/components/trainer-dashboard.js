/**
 * Trainer Dashboard Component
 * 
 * Overview dashboard for trainers showing statistics, pending evaluations, recent activity, and learner summary.
 */

import { authService } from '../services/auth-service.js';
import { labSubmissionService } from '../services/lab-submission-service.js';
import { courseAllocationService } from '../services/course-allocation-service.js';
import { supabaseClient } from '../services/supabase-client.js';
import { router } from '../core/router.js';
import Header from './header.js';

class TrainerDashboard {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.statistics = {
            totalLearners: 0,
            pendingSubmissions: 0,
            reviewedToday: 0,
            activeCourses: 0
        };
        this.pendingSubmissions = [];
        this.recentActivity = [];
        this.learnersSummary = [];
    }

    /**
     * Show trainer dashboard
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
     * Load all dashboard data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            // Load statistics and data in parallel
            await Promise.all([
                this.loadStatistics(),
                this.loadPendingSubmissions(),
                this.loadRecentActivity(),
                this.loadLearnersSummary()
            ]);
        } catch (error) {
            console.error('[TrainerDashboard] Error loading data:', error);
            this.renderError('Failed to load dashboard: ' + error.message);
        }
    }

    /**
     * Load dashboard statistics
     */
    async loadStatistics() {
        try {
            const trainerId = this.currentUser.id;

            // Get assigned learners
            const learnerIds = await labSubmissionService.getAssignedLearnerIds(trainerId);
            this.statistics.totalLearners = learnerIds.length;

            // Get pending submissions
            const pendingSubs = await labSubmissionService.getSubmissionsForReview(trainerId);
            this.statistics.pendingSubmissions = pendingSubs.length;

            // Get reviewed today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const pastEvals = await labSubmissionService.getPastEvaluations(trainerId, {
                dateFrom: today.toISOString()
            });
            this.statistics.reviewedToday = pastEvals.length;

            // Get active course allocations
            const allocations = await courseAllocationService.getAllocationsForTrainer(trainerId);
            const activeAllocations = allocations.filter(a => a.status === 'active');
            const uniqueCourses = new Set(activeAllocations.map(a => a.course_id));
            this.statistics.activeCourses = uniqueCourses.size;
        } catch (error) {
            console.warn('[TrainerDashboard] Failed to load statistics:', error);
        }
    }

    /**
     * Load pending submissions (limited to 5 most recent)
     */
    async loadPendingSubmissions() {
        try {
            const trainerId = this.currentUser.id;
            const allPending = await labSubmissionService.getSubmissionsForReview(trainerId);
            
            // Sort by submitted_at (oldest first for priority)
            this.pendingSubmissions = allPending
                .sort((a, b) => {
                    const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
                    const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
                    return dateA - dateB; // Oldest first
                })
                .slice(0, 5); // Top 5
        } catch (error) {
            console.warn('[TrainerDashboard] Failed to load pending submissions:', error);
            this.pendingSubmissions = [];
        }
    }

    /**
     * Load recent activity (last 10 reviewed submissions)
     */
    async loadRecentActivity() {
        try {
            const trainerId = this.currentUser.id;
            const pastEvals = await labSubmissionService.getPastEvaluations(trainerId, {});
            
            // Sort by reviewed_at (latest first) and take top 10
            this.recentActivity = pastEvals
                .sort((a, b) => {
                    const dateA = a.reviewed_at ? new Date(a.reviewed_at).getTime() : 0;
                    const dateB = b.reviewed_at ? new Date(b.reviewed_at).getTime() : 0;
                    return dateB - dateA; // Latest first
                })
                .slice(0, 10);
        } catch (error) {
            console.warn('[TrainerDashboard] Failed to load recent activity:', error);
            this.recentActivity = [];
        }
    }

    /**
     * Load learners summary
     */
    async loadLearnersSummary() {
        try {
            const trainerId = this.currentUser.id;
            const learnerIds = await labSubmissionService.getAssignedLearnerIds(trainerId);

            if (learnerIds.length === 0) {
                this.learnersSummary = [];
                return;
            }

            // Get learner details
            const { data, error } = await supabaseClient
                .from('users')
                .select('id, full_name, name, email, created_at')
                .in('id', learnerIds)
                .eq('role', 'learner')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                throw error;
            }

            // Get submission counts for each learner
            const learnersWithStats = await Promise.all(
                (data || []).map(async (learner) => {
                    try {
                        const submissions = await labSubmissionService.getAllSubmissionsForLearner(learner.id);
                        const pendingCount = submissions.filter(s => s.status === 'submitted').length;
                        const approvedCount = submissions.filter(s => s.status === 'approved').length;

                        return {
                            ...learner,
                            pendingSubmissions: pendingCount,
                            approvedSubmissions: approvedCount,
                            totalSubmissions: submissions.length
                        };
                    } catch (error) {
                        console.warn(`[TrainerDashboard] Failed to load stats for learner ${learner.id}:`, error);
                        return {
                            ...learner,
                            pendingSubmissions: 0,
                            approvedSubmissions: 0,
                            totalSubmissions: 0
                        };
                    }
                })
            );

            this.learnersSummary = learnersWithStats;
        } catch (error) {
            console.warn('[TrainerDashboard] Failed to load learners summary:', error);
            this.learnersSummary = [];
        }
    }

    /**
     * Render dashboard
     */
    render() {
        this.container.innerHTML = `
            <div class="trainer-dashboard-page">
                <div class="dashboard-container">
                    <div class="dashboard-header">
                        <div>
                            <h1 class="dashboard-title">Trainer Dashboard</h1>
                            <p class="dashboard-subtitle">Welcome back, ${this.escapeHtml(this.currentUser?.full_name || this.currentUser?.name || 'Trainer')}</p>
                        </div>
                        <div class="dashboard-actions">
                            <a href="#/trainer/lab-review" class="btn btn-primary">
                                <span class="btn-icon">📝</span>
                                <span>Review Submissions</span>
                            </a>
                            <a href="#/trainer/ai-coach-personalization" class="btn btn-secondary" style="margin-left: 10px;">
                                <span class="btn-icon">🤖</span>
                                <span>AI Coach Setup</span>
                            </a>
                        </div>
                    </div>

                    <div class="dashboard-stats">
                        ${this.renderStatCards()}
                    </div>

                    <div class="dashboard-content">
                        <div class="dashboard-main">
                            <div class="dashboard-section">
                                <div class="section-header">
                                    <h2 class="section-title">Pending Evaluations</h2>
                                    ${this.statistics.pendingSubmissions > 5 ? `
                                        <a href="#/trainer/lab-review" class="section-link">View All (${this.statistics.pendingSubmissions})</a>
                                    ` : ''}
                                </div>
                                ${this.renderPendingSubmissions()}
                            </div>

                            <div class="dashboard-section">
                                <div class="section-header">
                                    <h2 class="section-title">Recent Activity</h2>
                                </div>
                                ${this.renderRecentActivity()}
                            </div>
                        </div>

                        <div class="dashboard-sidebar">
                            <div class="dashboard-section">
                                <div class="section-header">
                                    <h2 class="section-title">My Learners</h2>
                                    ${this.statistics.totalLearners > 10 ? `
                                        <a href="#/trainer/learners" class="section-link">View All (${this.statistics.totalLearners})</a>
                                    ` : ''}
                                </div>
                                ${this.renderLearnersSummary()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render stat cards
     */
    renderStatCards() {
        return `
            <div class="stat-card">
                <div class="stat-icon stat-icon-learners">👥</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.totalLearners}</div>
                    <div class="stat-label">Total Learners</div>
                </div>
            </div>
            <div class="stat-card stat-card-priority">
                <div class="stat-icon stat-icon-pending">📝</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.pendingSubmissions}</div>
                    <div class="stat-label">Pending Submissions</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon-reviewed">✓</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.reviewedToday}</div>
                    <div class="stat-label">Reviewed Today</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon-courses">📚</div>
                <div class="stat-content">
                    <div class="stat-value">${this.statistics.activeCourses}</div>
                    <div class="stat-label">Active Courses</div>
                </div>
            </div>
        `;
    }

    /**
     * Render pending submissions
     */
    renderPendingSubmissions() {
        if (this.pendingSubmissions.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">✓</div>
                    <div class="empty-text">No pending submissions</div>
                    <p class="empty-description">All submissions have been reviewed!</p>
                </div>
            `;
        }

        return `
            <div class="pending-submissions-list">
                ${this.pendingSubmissions.map(submission => {
                    const learner = submission.user || {};
                    const learnerName = learner.full_name || learner.name || learner.email || 'Unknown';
                    const submittedDate = submission.submitted_at ? new Date(submission.submitted_at) : null;
                    const daysAgo = submittedDate ? Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

                    return `
                        <div class="pending-submission-card">
                            <div class="submission-card-header">
                                <div class="submission-learner">
                                    <div class="learner-name">${this.escapeHtml(learnerName)}</div>
                                    <div class="submission-meta">
                                        <span class="submission-course">${this.escapeHtml(submission.course_id)}</span>
                                        <span class="submission-separator">•</span>
                                        <span class="submission-lab">Lab ${this.escapeHtml(submission.lab_id)}</span>
                                    </div>
                                </div>
                                ${daysAgo > 0 ? `
                                    <div class="submission-priority priority-${daysAgo >= 3 ? 'high' : daysAgo >= 1 ? 'medium' : 'low'}">
                                        ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago
                                    </div>
                                ` : ''}
                            </div>
                            <div class="submission-card-footer">
                                <span class="submission-date">Submitted: ${submittedDate ? submittedDate.toLocaleString() : 'N/A'}</span>
                                <a href="#/trainer/lab-review" class="btn btn-sm btn-primary">Review</a>
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
                ${this.recentActivity.map(activity => {
                    const learner = activity.user || {};
                    const learnerName = learner.full_name || learner.name || learner.email || 'Unknown';
                    const reviewedDate = activity.reviewed_at ? new Date(activity.reviewed_at) : null;
                    const statusConfig = this.getStatusConfig(activity.status);

                    return `
                        <div class="activity-item">
                            <div class="activity-icon ${statusConfig.class}">${statusConfig.icon}</div>
                            <div class="activity-content">
                                <div class="activity-text">
                                    Reviewed <strong>${this.escapeHtml(learnerName)}</strong>'s submission for 
                                    <strong>${this.escapeHtml(activity.course_id)}</strong> - Lab ${this.escapeHtml(activity.lab_id)}
                                </div>
                                <div class="activity-meta">
                                    <span class="activity-status ${statusConfig.class}">${statusConfig.label}</span>
                                    <span class="activity-date">${reviewedDate ? reviewedDate.toLocaleString() : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render learners summary
     */
    renderLearnersSummary() {
        if (this.learnersSummary.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <div class="empty-text">No learners assigned</div>
                    <p class="empty-description">Learners will appear here once assigned to you.</p>
                </div>
            `;
        }

        return `
            <div class="learners-summary-list">
                ${this.learnersSummary.map(learner => {
                    const learnerName = learner.full_name || learner.name || learner.email || 'Unknown';
                    return `
                        <div class="learner-summary-card">
                            <div class="learner-avatar-small">
                                <span class="avatar-initials-small">${this.getInitials(learnerName)}</span>
                            </div>
                            <div class="learner-summary-info">
                                <div class="learner-summary-name">${this.escapeHtml(learnerName)}</div>
                                <div class="learner-summary-stats">
                                    ${learner.pendingSubmissions > 0 ? `
                                        <span class="learner-stat pending">${learner.pendingSubmissions} pending</span>
                                    ` : ''}
                                    ${learner.approvedSubmissions > 0 ? `
                                        <span class="learner-stat approved">${learner.approvedSubmissions} approved</span>
                                    ` : ''}
                                </div>
                            </div>
                            <a href="#/trainer/learners/${learner.id}" class="learner-view-link">View</a>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Get status configuration
     */
    getStatusConfig(status) {
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
        // Event listeners can be added here if needed
    }

    /**
     * Render error
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="trainer-dashboard-page">
                <div class="dashboard-container">
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h2 class="error-title">Error Loading Dashboard</h2>
                        <p class="error-message">${this.escapeHtml(message)}</p>
                        <a href="#/trainer/dashboard" class="btn btn-primary">Retry</a>
                    </div>
                </div>
            </div>
        `;
    }
}

export default TrainerDashboard;

