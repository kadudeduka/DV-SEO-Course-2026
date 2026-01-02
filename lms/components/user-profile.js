/**
 * User Profile Component
 * 
 * Displays user profile information, learning statistics, account settings, and activity summary.
 */

import { authService } from '../services/auth-service.js';
import { userService } from '../services/user-service.js';
import { progressService } from '../services/progress-service.js';
import { labSubmissionService } from '../services/lab-submission-service.js';
import { courseService } from '../services/course-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class UserProfile {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.userProfile = null;
        this.statistics = {
            coursesEnrolled: 0,
            coursesCompleted: 0,
            labsSubmitted: 0,
            labsApproved: 0,
            totalProgress: 0
        };
    }

    /**
     * Show user profile page
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
     * Load all profile data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            // Load user profile
            this.userProfile = await userService.getUserProfile(this.currentUser.id);

            // Load statistics
            await this.loadStatistics();
        } catch (error) {
            console.error('[UserProfile] Error loading data:', error);
            this.renderError('Failed to load profile: ' + error.message);
        }
    }

    /**
     * Load user statistics
     */
    async loadStatistics() {
        try {
            // Get all submissions
            const submissions = await labSubmissionService.getAllSubmissionsForLearner(this.currentUser.id);
            this.statistics.labsSubmitted = submissions.length;
            this.statistics.labsApproved = submissions.filter(s => s.status === 'approved').length;

            // Get all courses (for enrolled count)
            const allCourses = await courseService.getAllCourses();
            
            // Get progress for each course
            let totalProgress = 0;
            let completedCourses = 0;
            let enrolledCourses = 0;

            for (const course of allCourses) {
                try {
                    const progressArray = await progressService.getProgress(this.currentUser.id, course.id);
                    const progressData = progressService.transformProgress(progressArray);
                    
                    if (Object.keys(progressData).length > 0) {
                        enrolledCourses++;
                        
                        // Calculate completion percentage
                        const courseData = course.courseData;
                        if (courseData && courseData.days) {
                            let totalItems = 0;
                            let completedItems = 0;
                            
                            courseData.days.forEach(day => {
                                if (day.chapters) {
                                    totalItems += day.chapters.length;
                                    day.chapters.forEach(ch => {
                                        if (progressData[ch.id] && progressData[ch.id].completed) {
                                            completedItems++;
                                        }
                                    });
                                }
                                if (day.labs) {
                                    totalItems += day.labs.length;
                                    day.labs.forEach(lab => {
                                        if (progressData[lab.id] && progressData[lab.id].completed) {
                                            completedItems++;
                                        }
                                    });
                                }
                            });
                            
                            if (totalItems > 0) {
                                const courseProgress = (completedItems / totalItems) * 100;
                                totalProgress += courseProgress;
                                
                                if (courseProgress >= 100) {
                                    completedCourses++;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`[UserProfile] Failed to load progress for course ${course.id}:`, error);
                }
            }

            this.statistics.coursesEnrolled = enrolledCourses;
            this.statistics.coursesCompleted = completedCourses;
            this.statistics.totalProgress = enrolledCourses > 0 ? totalProgress / enrolledCourses : 0;
        } catch (error) {
            console.warn('[UserProfile] Failed to load statistics:', error);
        }
    }

    /**
     * Render profile page
     */
    render() {
        if (!this.userProfile) {
            return;
        }

        const userInitials = this.getUserInitials();
        const roleLabel = this.getRoleLabel(this.userProfile.role);
        const statusConfig = this.getStatusConfig(this.userProfile.status);

        this.container.innerHTML = `
            <div class="user-profile-page">
                <div class="profile-container">
                    <div class="profile-header">
                        <div class="profile-avatar-large">
                            <span class="avatar-initials-large">${userInitials}</span>
                        </div>
                        <div class="profile-header-info">
                            <h1 class="profile-name">${this.escapeHtml(this.userProfile.full_name || this.userProfile.name || 'User')}</h1>
                            <p class="profile-email">${this.escapeHtml(this.userProfile.email)}</p>
                            <div class="profile-meta">
                                <span class="profile-role-badge ${this.userProfile.role}">${roleLabel}</span>
                                <span class="profile-status-badge ${statusConfig.class}">
                                    <span class="status-icon">${statusConfig.icon}</span>
                                    <span class="status-text">${statusConfig.label}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="profile-content">
                        <div class="profile-stats-section">
                            <h2 class="section-title">Learning Statistics</h2>
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-icon">📚</div>
                                    <div class="stat-content">
                                        <div class="stat-value">${this.statistics.coursesEnrolled}</div>
                                        <div class="stat-label">Courses Enrolled</div>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">✓</div>
                                    <div class="stat-content">
                                        <div class="stat-value">${this.statistics.coursesCompleted}</div>
                                        <div class="stat-label">Courses Completed</div>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">📝</div>
                                    <div class="stat-content">
                                        <div class="stat-value">${this.statistics.labsSubmitted}</div>
                                        <div class="stat-label">Labs Submitted</div>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">⭐</div>
                                    <div class="stat-content">
                                        <div class="stat-value">${this.statistics.labsApproved}</div>
                                        <div class="stat-label">Labs Approved</div>
                                    </div>
                                </div>
                            </div>
                            ${this.statistics.totalProgress > 0 ? `
                                <div class="progress-overview">
                                    <div class="progress-header">
                                        <span class="progress-label">Overall Progress</span>
                                        <span class="progress-percentage">${Math.round(this.statistics.totalProgress)}%</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${this.statistics.totalProgress}%"></div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <div class="profile-info-section">
                            <h2 class="section-title">Personal Information</h2>
                            <div class="info-card">
                                <div class="info-row">
                                    <span class="info-label">Full Name</span>
                                    <span class="info-value">${this.escapeHtml(this.userProfile.full_name || this.userProfile.name || 'Not set')}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Email</span>
                                    <span class="info-value">${this.escapeHtml(this.userProfile.email)}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Role</span>
                                    <span class="info-value">${roleLabel}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Account Status</span>
                                    <span class="info-value">
                                        <span class="status-badge-inline ${statusConfig.class}">
                                            ${statusConfig.icon} ${statusConfig.label}
                                        </span>
                                    </span>
                                </div>
                                ${this.userProfile.created_at ? `
                                    <div class="info-row">
                                        <span class="info-label">Member Since</span>
                                        <span class="info-value">${new Date(this.userProfile.created_at).toLocaleDateString()}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <div class="profile-actions-section">
                            <h2 class="section-title">Quick Actions</h2>
                            <div class="actions-grid">
                                <a href="#/courses/my-courses" class="action-card">
                                    <div class="action-icon">📚</div>
                                    <div class="action-content">
                                        <div class="action-title">My Courses</div>
                                        <div class="action-description">View your allocated courses</div>
                                    </div>
                                </a>
                                <a href="#/learner/lab-submissions" class="action-card">
                                    <div class="action-icon">📝</div>
                                    <div class="action-content">
                                        <div class="action-title">My Submissions</div>
                                        <div class="action-description">View lab submissions</div>
                                    </div>
                                </a>
                                <a href="#/dashboard" class="action-card">
                                    <div class="action-icon">🏠</div>
                                    <div class="action-content">
                                        <div class="action-title">Dashboard</div>
                                        <div class="action-description">Go to dashboard</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get user initials
     */
    getUserInitials() {
        const name = this.userProfile?.full_name || this.userProfile?.name || '';
        if (name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        }
        return (this.userProfile?.email || 'U')[0].toUpperCase();
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
        // If status is 'approved', treat it as 'active'
        if (status === 'approved') {
            return configs['approved'];
        }
        return configs[status] || configs['pending'];
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
     * Render error
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="user-profile-page">
                <div class="profile-container">
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h2 class="error-title">Error Loading Profile</h2>
                        <p class="error-message">${this.escapeHtml(message)}</p>
                        <a href="#/dashboard" class="btn btn-primary">Back to Dashboard</a>
                    </div>
                </div>
            </div>
        `;
    }
}

export default UserProfile;

