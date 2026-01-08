/**
 * Start/Continue Learning Component
 * 
 * Smart entry point that takes learners to the right place in a course.
 * - If course not started → Show course overview/intro
 * - If course in progress → Navigate to last accessed chapter/lab
 * - If course completed → Show completion summary
 */

import { courseService } from '../services/course-service.js';
import { progressService } from '../services/progress-service.js';
import { analyticsService } from '../services/analytics-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class StartLearning {
    constructor(container) {
        this.container = container;
        this.course = null;
        this.courseId = null;
        this.currentUser = null;
        this.progress = {};
        this.progressPercentage = 0;
        this.lastAccessedContent = null;
    }

    /**
     * Show start/continue learning page
     */
    async show(courseId) {
        if (this.container) {
            this.container.style.display = 'block';
        }

        this.courseId = courseId;
        await this.renderHeader();
        await this.loadData();
        this.determineNavigation();
        
        // Initialize AI Coach widget for this course
        this._initAICoach();
    }

    /**
     * Initialize AI Coach widget
     * @private
     */
    async _initAICoach() {
        try {
            const { default: AICoachWidget } = await import('./ai-coach/learner/ai-coach-widget.js');
            if (!window.aiCoachWidgetInstance) {
                window.aiCoachWidgetInstance = new AICoachWidget();
                await window.aiCoachWidgetInstance.init();
            } else {
                // Update course context if widget already exists
                window.aiCoachWidgetInstance.currentCourseId = this.courseId;
                await window.aiCoachWidgetInstance.render();
                // Re-attach event listeners after re-rendering
                window.aiCoachWidgetInstance.attachEventListeners();
                window.aiCoachWidgetInstance.show();
            }
        } catch (error) {
            console.error('[StartLearning] Failed to initialize AI Coach:', error);
        }
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
     * Load all necessary data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            // Load course
            this.course = await courseService.getCourseById(this.courseId);
            if (!this.course) {
                router.navigate('/courses');
                return;
            }

            // Load progress
            this.progress = await progressService.getProgress(
                this.currentUser.id,
                this.courseId
            );

            // Load progress percentage using analytics service (75% labs, 25% chapters)
            const progress = await analyticsService.calculateCourseProgress(
                this.currentUser.id,
                this.courseId
            );
            this.progressPercentage = parseFloat(progress.toFixed(1));

            // Find last accessed content
            this.findLastAccessedContent();
        } catch (error) {
            console.error('[StartLearning] Error loading data:', error);
            router.navigate(`/courses/${this.courseId}`);
        }
    }

    /**
     * Find last accessed content
     */
    findLastAccessedContent() {
        if (!this.course || !this.course.courseData || !this.course.courseData.days) {
            return;
        }

        // Find the first incomplete chapter or lab
        for (const day of this.course.courseData.days) {
            // Check chapters
            if (day.chapters && day.chapters.length > 0) {
                for (const chapter of day.chapters) {
                    const chapterProgress = this.progress[chapter.id];
                    if (!chapterProgress || !chapterProgress.completed) {
                        this.lastAccessedContent = {
                            type: 'chapter',
                            id: chapter.id,
                            title: chapter.title,
                            day: day.dayNumber
                        };
                        return;
                    }
                }
            }

            // Check labs
            if (day.labs && day.labs.length > 0) {
                for (const lab of day.labs) {
                    const labProgress = this.progress[lab.id];
                    if (!labProgress || !labProgress.completed) {
                        this.lastAccessedContent = {
                            type: 'lab',
                            id: lab.id,
                            title: lab.title,
                            day: day.dayNumber
                        };
                        return;
                    }
                }
            }
        }

        // If all content is completed, mark as completed
        if (this.progressPercentage >= 100) {
            this.lastAccessedContent = { type: 'completed' };
        }
    }

    /**
     * Determine navigation based on progress
     */
    determineNavigation() {
        if (this.progressPercentage >= 100) {
            // Course completed - show completion summary
            this.renderCompletionSummary();
        } else if (this.lastAccessedContent && this.lastAccessedContent.type !== 'completed') {
            // Course in progress - show resume option
            this.renderResume();
        } else {
            // Course not started - show overview
            this.renderOverview();
        }
    }

    /**
     * Render course overview (not started)
     */
    renderOverview() {
        this.container.innerHTML = `
            <div class="start-learning-page">
                <div class="start-learning-container">
                    <div class="start-learning-header">
                        <h1 class="start-learning-title">${this.course.title || 'Untitled Course'}</h1>
                        <p class="start-learning-description">${this.course.description || 'Start your learning journey'}</p>
                    </div>

                    <div class="start-learning-content">
                        <div class="course-overview-section">
                            <h2 class="section-title">Course Overview</h2>
                            ${this.renderCourseStructure()}
                        </div>

                        <div class="start-learning-actions">
                            <button class="btn btn-primary btn-large" id="start-course-btn">
                                Start Learning
                            </button>
                            <a href="#/courses/${this.courseId}" class="btn btn-secondary btn-large">
                                View Course Details
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render resume learning (in progress)
     */
    renderResume() {
        const contentType = this.lastAccessedContent.type === 'chapter' ? 'Chapter' : 'Lab';
        const contentTitle = this.lastAccessedContent.title;

        this.container.innerHTML = `
            <div class="start-learning-page">
                <div class="start-learning-container">
                    <div class="start-learning-header-compact">
                        <div class="header-content">
                            <div>
                                <h1 class="start-learning-title-compact">Continue Learning</h1>
                                <p class="start-learning-description-compact">Continue from where you left off</p>
                            </div>
                            <div class="progress-badge-compact">
                                <div class="progress-badge-value">${this.progressPercentage.toFixed(1)}%</div>
                                <div class="progress-badge-label">Complete</div>
                            </div>
                        </div>
                        <div class="progress-bar-compact-header">
                            <div class="progress-bar-fill" style="width: ${this.progressPercentage}%"></div>
                        </div>
                    </div>

                    <div class="start-learning-content">
                        <div class="resume-section">
                            <div class="resume-card">
                                <div class="resume-card-icon">${this.lastAccessedContent.type === 'chapter' ? '📖' : '🧪'}</div>
                                <div class="resume-card-content">
                                    <div class="resume-card-label">Last Accessed</div>
                                    <div class="resume-card-title">${contentType}: ${contentTitle}</div>
                                    <div class="resume-card-subtitle">Day ${this.lastAccessedContent.day}</div>
                                </div>
                            </div>
                        </div>

                        <div class="start-learning-actions">
                            <button class="btn btn-primary btn-large" id="resume-course-btn">
                                Continue Learning
                            </button>
                            <a href="#/courses/${this.courseId}/coach/ai" class="btn btn-secondary btn-large">Study Mentor</a>
                            <a href="#/courses/${this.courseId}" class="btn btn-secondary btn-large">
                                View Course Overview
                            </a>
                        </div>

                        <div class="course-progress-section">
                            <h3 class="section-title-small">Course Progress</h3>
                            <div class="progress-bar-large">
                                <div class="progress-bar-fill" style="width: ${this.progressPercentage}%"></div>
                            </div>
                            <div class="progress-stats">
                                <span>${this.progressPercentage.toFixed(1)}% Complete</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render completion summary
     */
    renderCompletionSummary() {
        this.container.innerHTML = `
            <div class="start-learning-page">
                <div class="start-learning-container">
                    <div class="start-learning-header">
                        <div class="completion-icon">🎉</div>
                        <h1 class="start-learning-title">Course Completed!</h1>
                        <p class="start-learning-description">Congratulations! You've successfully completed this course.</p>
                    </div>

                    <div class="start-learning-content">
                        <div class="completion-stats">
                            <div class="completion-stat-card">
                                <div class="completion-stat-value">100%</div>
                                <div class="completion-stat-label">Complete</div>
                            </div>
                        </div>

                        <div class="start-learning-actions">
                            <a href="#/courses/${this.courseId}" class="btn btn-primary btn-large">
                                Review Course
                            </a>
                            <a href="#/courses/my-courses" class="btn btn-secondary btn-large">
                                View All My Courses
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render course structure
     */
    renderCourseStructure() {
        if (!this.course || !this.course.courseData || !this.course.courseData.days) {
            return '<p>No course structure available</p>';
        }

        const days = this.course.courseData.days;
        let totalChapters = 0;
        let totalLabs = 0;

        days.forEach(day => {
            totalChapters += (day.chapters || []).length;
            totalLabs += (day.labs || []).length;
        });

        return `
            <div class="course-structure-summary">
                <div class="structure-item">
                    <span class="structure-icon">📅</span>
                    <span class="structure-text">${days.length} Days</span>
                </div>
                <div class="structure-item">
                    <span class="structure-icon">📖</span>
                    <span class="structure-text">${totalChapters} Chapters</span>
                </div>
                <div class="structure-item">
                    <span class="structure-icon">🧪</span>
                    <span class="structure-text">${totalLabs} Labs</span>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Start course button
        const startBtn = document.getElementById('start-course-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.navigateToFirstContent();
            });
        }

        // Resume course button
        const resumeBtn = document.getElementById('resume-course-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                this.navigateToLastContent();
            });
        }
    }

    /**
     * Navigate to first content item
     */
    navigateToFirstContent() {
        if (!this.course || !this.course.courseData || !this.course.courseData.days) {
            router.navigate(`/courses/${this.courseId}`);
            return;
        }

        // Find first chapter or lab
        for (const day of this.course.courseData.days) {
            if (day.chapters && day.chapters.length > 0) {
                router.navigate(`/courses/${this.courseId}/content/${day.chapters[0].id}`);
                return;
            }
            if (day.labs && day.labs.length > 0) {
                router.navigate(`/courses/${this.courseId}/lab/${day.labs[0].id}`);
                return;
            }
        }

        // Fallback to course detail
        router.navigate(`/courses/${this.courseId}`);
    }

    /**
     * Navigate to last accessed content
     */
    navigateToLastContent() {
        if (!this.lastAccessedContent || this.lastAccessedContent.type === 'completed') {
            this.navigateToFirstContent();
            return;
        }

        if (this.lastAccessedContent.type === 'chapter') {
            router.navigate(`/courses/${this.courseId}/content/${this.lastAccessedContent.id}`);
        } else if (this.lastAccessedContent.type === 'lab') {
            router.navigate(`/courses/${this.courseId}/lab/${this.lastAccessedContent.id}`);
        } else {
            this.navigateToFirstContent();
        }
    }
}

export default StartLearning;

