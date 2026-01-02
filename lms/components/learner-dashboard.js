/**
 * Learner Dashboard Component
 * 
 * Central hub for learners to see their learning progress, quick access to courses, and recent activity.
 */

import { courseService } from '../services/course-service.js';
import { progressService } from '../services/progress-service.js';
import { analyticsService } from '../services/analytics-service.js';
import { authService } from '../services/auth-service.js';
import { labSubmissionService } from '../services/lab-submission-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class LearnerDashboard {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.courses = [];
        this.progressData = {};
        this.stats = {
            activeCourses: 0,
            completedCourses: 0,
            totalProgress: 0,
            pendingSubmissions: 0
        };
        this.lastAccessedCourse = null;
        this.recentActivity = [];
    }

    /**
     * Show learner dashboard
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

            // Load courses
            this.courses = await courseService.getCourses(this.currentUser.id);

            // Load progress for all courses
            await this.loadProgressData();

            // Calculate statistics
            this.calculateStats();

            // Find last accessed course
            this.findLastAccessedCourse();

            // Load recent activity
            await this.loadRecentActivity();

            // Load pending submissions count
            await this.loadPendingSubmissionsCount();
        } catch (error) {
            console.error('[LearnerDashboard] Error loading data:', error);
        }
    }

    /**
     * Load progress data for all courses
     */
    async loadProgressData() {
        for (const course of this.courses) {
            try {
                // Use analytics service which calculates progress with 75% labs / 25% chapters weighting
                const progress = await analyticsService.calculateCourseProgress(
                    this.currentUser.id,
                    course.id
                );
                this.progressData[course.id] = progress;
            } catch (error) {
                console.warn(`[LearnerDashboard] Failed to load progress for course ${course.id}:`, error);
                this.progressData[course.id] = 0;
            }
        }
    }

    /**
     * Calculate dashboard statistics
     */
    calculateStats() {
        this.stats.activeCourses = this.courses.filter(course => {
            const progress = this.progressData[course.id] || 0;
            return progress > 0 && progress < 100;
        }).length;

        this.stats.completedCourses = this.courses.filter(course => {
            const progress = this.progressData[course.id] || 0;
            return progress >= 100;
        }).length;

        // Calculate total progress across all courses
        if (this.courses.length > 0) {
            const totalProgress = this.courses.reduce((sum, course) => {
                return sum + (this.progressData[course.id] || 0);
            }, 0);
            // Use toFixed(1) to match reports display, then parse to number for display
            this.stats.totalProgress = parseFloat((totalProgress / this.courses.length).toFixed(1));
        }

        // Pending submissions count is loaded separately in loadPendingSubmissionsCount()
    }

    /**
     * Load pending submissions count
     */
    async loadPendingSubmissionsCount() {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                this.stats.pendingSubmissions = 0;
                return;
            }

            // Get all submissions for the learner
            const allSubmissions = await labSubmissionService.getAllSubmissionsForLearner(this.currentUser.id);
            
            // Count submissions with status 'submitted' (pending review)
            this.stats.pendingSubmissions = allSubmissions.filter(
                submission => submission.status === 'submitted'
            ).length;

            console.log('[LearnerDashboard] Pending submissions count:', this.stats.pendingSubmissions);
        } catch (error) {
            console.warn('[LearnerDashboard] Failed to load pending submissions count:', error);
            this.stats.pendingSubmissions = 0;
        }
    }

    /**
     * Find last accessed course
     */
    findLastAccessedCourse() {
        // Find course with highest progress that's not completed
        let maxProgress = 0;
        this.lastAccessedCourse = null;

        for (const course of this.courses) {
            const progress = this.progressData[course.id] || 0;
            if (progress > maxProgress && progress < 100) {
                maxProgress = progress;
                this.lastAccessedCourse = course;
            }
        }

        // If no in-progress course, use first course
        if (!this.lastAccessedCourse && this.courses.length > 0) {
            this.lastAccessedCourse = this.courses[0];
        }
    }

    /**
     * Load recent activity
     */
    async loadRecentActivity() {
        // TODO: Implement recent activity loading
        // This could include:
        // - Recent submissions
        // - Feedback received
        // - Course completions
        this.recentActivity = [];
    }

    /**
     * Render dashboard
     */
    render() {
        const userName = this.currentUser?.full_name || this.currentUser?.email || 'Learner';
        const firstName = userName.split(' ')[0];

        this.container.innerHTML = `
            <div class="learner-dashboard">
                <div class="dashboard-header">
                    <div class="dashboard-welcome">
                        <h1 class="dashboard-title">Welcome, ${firstName}</h1>
                        <p class="dashboard-subtitle">Continue your learning journey</p>
                    </div>
                </div>

                <div class="dashboard-stats">
                    ${this.renderStatCard('Active Courses', this.stats.activeCourses, '', 'primary')}
                    ${this.renderStatCard('Completed', this.stats.completedCourses, '', 'success')}
                    ${this.renderStatCard('Total Progress', `${this.stats.totalProgress}%`, '', 'info')}
                    ${this.renderStatCard('Pending Reviews', this.stats.pendingSubmissions, '', 'warning')}
                </div>

                ${this.lastAccessedCourse ? this.renderContinueLearning() : ''}

                <div class="dashboard-section">
                    <div class="section-header">
                        <h2 class="section-title">My Courses</h2>
                        <a href="#/courses/my-courses" class="section-link">View All</a>
                    </div>
                    <div class="courses-grid">
                        ${this.renderMyCourses()}
                    </div>
                </div>

                ${this.recentActivity.length > 0 ? this.renderRecentActivity() : ''}

                <div class="dashboard-quick-actions">
                    <h2 class="section-title">Quick Actions</h2>
                    <div class="quick-actions-grid">
                        <a href="#/courses/my-courses" class="quick-action-card">
                            <span class="quick-action-icon">📖</span>
                            <span class="quick-action-text">My Courses</span>
                        </a>
                        <a href="#/learner/lab-submissions" class="quick-action-card">
                            <span class="quick-action-icon">📝</span>
                            <span class="quick-action-text">View Submissions</span>
                        </a>
                        <a href="#/notifications" class="quick-action-card">
                            <span class="quick-action-icon">🔔</span>
                            <span class="quick-action-text">Notifications</span>
                        </a>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render stat card
     */
    renderStatCard(label, value, icon, variant = 'primary') {
        return `
            <div class="stat-card stat-card-${variant}">
                <div class="stat-card-icon">${icon}</div>
                <div class="stat-card-content">
                    <div class="stat-card-value">${value}</div>
                    <div class="stat-card-label">${label}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render continue learning section
     */
    renderContinueLearning() {
        if (!this.lastAccessedCourse) return '';

        const progress = parseFloat((this.progressData[this.lastAccessedCourse.id] || 0).toFixed(1));

        return `
            <div class="continue-learning-section">
                <div class="continue-learning-header">
                    <h2 class="section-title">Continue Learning</h2>
                </div>
                <div class="continue-learning-card">
                    <div class="continue-learning-content">
                        <h3 class="continue-learning-title">${this.lastAccessedCourse.title || 'Untitled Course'}</h3>
                        <p class="continue-learning-description">${this.lastAccessedCourse.description || 'Continue where you left off'}</p>
                        <div class="continue-learning-progress">
                            <div class="progress-bar">
                                <div class="progress-bar-fill" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text">${progress}% Complete</span>
                        </div>
                        <button class="btn btn-primary" data-course-id="${this.lastAccessedCourse.id}" data-action="continue">
                            Continue Learning
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render my courses grid
     */
    renderMyCourses() {
        if (this.courses.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-title">No Courses Yet</div>
                    <div class="empty-state-text">You don't have any courses assigned yet. Contact your trainer to get started.</div>
                    <a href="#/courses/my-courses" class="btn btn-primary">View My Courses</a>
                </div>
            `;
        }

        // Show up to 6 courses
        const coursesToShow = this.courses.slice(0, 6);

        return coursesToShow.map(course => {
            const progress = parseFloat((this.progressData[course.id] || 0).toFixed(1));
            const isCompleted = progress >= 100;

            return `
                <div class="course-card-dashboard" data-course-id="${course.id}">
                    <div class="course-card-image">
                        <div class="course-card-badge ${isCompleted ? 'completed' : ''}">
                            ${isCompleted ? '✓ Completed' : `${progress}%`}
                        </div>
                    </div>
                    <div class="course-card-content">
                        <h3 class="course-card-title">${course.title || 'Untitled Course'}</h3>
                        <p class="course-card-description">${course.description || 'No description available'}</p>
                        <div class="course-card-progress">
                            <div class="progress-bar progress-bar-small">
                                <div class="progress-bar-fill" style="width: ${progress}%"></div>
                            </div>
                        </div>
                        <div class="course-card-actions">
                            <a href="#/courses/${course.id}" class="btn btn-secondary btn-sm">View Details</a>
                            <a href="#/courses/${course.id}/learn" class="btn btn-primary btn-sm">${isCompleted ? 'Review' : 'Continue'}</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render recent activity
     */
    renderRecentActivity() {
        return `
            <div class="dashboard-section">
                <div class="section-header">
                    <h2 class="section-title">Recent Activity</h2>
                </div>
                <div class="activity-feed">
                    ${this.recentActivity.map(activity => `
                        <div class="activity-item">
                            <span class="activity-icon">${activity.icon}</span>
                            <div class="activity-content">
                                <div class="activity-text">${activity.text}</div>
                                <div class="activity-time">${activity.time}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Continue learning button
        const continueBtn = this.container.querySelector('[data-action="continue"]');
        if (continueBtn) {
            continueBtn.addEventListener('click', (e) => {
                const courseId = continueBtn.getAttribute('data-course-id');
                if (courseId) {
                    router.navigate(`/courses/${courseId}/learn`);
                }
            });
        }

        // Course cards
        const courseCards = this.container.querySelectorAll('.course-card-dashboard');
        courseCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't navigate if clicking on a button
                if (e.target.closest('.btn')) {
                    return;
                }
                const courseId = card.getAttribute('data-course-id');
                if (courseId) {
                    router.navigate(`/courses/${courseId}`);
                }
            });
        });
    }
}

export default LearnerDashboard;

