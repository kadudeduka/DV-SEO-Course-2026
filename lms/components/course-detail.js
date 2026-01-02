/**
 * Course Detail Component
 * 
 * Displays course structure with days and chapters.
 */

import { courseService } from '../services/course-service.js';
import { router } from '../core/router.js';
import { progressService } from '../services/progress-service.js';
import { analyticsService } from '../services/analytics-service.js';
import { authService } from '../services/auth-service.js';
import { rbacService } from '../services/rbac-service.js';
import Header from './header.js';

class CourseDetail {
    constructor(container) {
        this.container = container;
        this.course = null;
        this.courseId = null;
        this.progressPercentage = 0;
        this.currentUser = null;
    }

    /**
     * Show course detail page
     * @param {string} courseId - Course identifier
     */
    async show(courseId) {
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        } else {
            console.error('[CourseDetail] Container not found!');
            return;
        }
        
        // Render header
        await this.renderHeader();
        
        this.courseId = courseId;
        await this.loadCourse();
        await this.loadProgressPercentage();
        this.render();
        
        // Initialize AI Coach widget for this course
        await this._initAICoach();
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
            console.error('[CourseDetail] Failed to initialize AI Coach:', error);
        }
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
     * Load course by ID
     */
    async loadCourse() {
        if (!this.courseId) {
            throw new Error('Course ID is required');
        }

        try {
            this.course = await courseService.getCourseById(this.courseId);
        } catch (error) {
            this.showError('Failed to load course: ' + error.message);
            this.course = null;
        }
    }

    /**
     * Load progress percentage
     */
    async loadProgressPercentage() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                this.progressPercentage = 0;
                return;
            }

            // Use analytics service which calculates progress with 75% labs / 25% chapters weighting
            const progress = await analyticsService.calculateCourseProgress(
                this.currentUser.id,
                this.courseId
            );
            this.progressPercentage = parseFloat(progress.toFixed(1));
        } catch (error) {
            console.warn('Failed to load progress percentage:', error);
            this.progressPercentage = 0;
            // Don't throw - allow page to render without progress
        }
    }

    /**
     * Render course detail
     */
    render() {
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        if (!this.course) {
            this.container.innerHTML = `
                <div class="course-detail">
                    <div id="course-error" class="error-message" style="display: block;"></div>
                </div>
            `;
            return;
        }

        this.container.innerHTML = `
            <div class="course-detail">
                <div class="course-detail-hero">
                    <div class="course-detail-hero-content">
                        <h1 class="course-detail-title">${this.course.title || 'Untitled Course'}</h1>
                        <p class="course-detail-subtitle">${this.course.description || 'Start your learning journey'}</p>
                        ${this.currentUser ? `
                            <div class="course-detail-progress-hero">
                                <div class="progress-bar-hero">
                                    <div class="progress-bar-fill" style="width: ${this.progressPercentage}%"></div>
                                </div>
                                <div class="progress-text-hero">${this.progressPercentage.toFixed(1)}% Complete</div>
                            </div>
                        ` : ''}
                        <div class="course-detail-actions-hero">
                            <a href="#/courses/${this.courseId}/learn" class="btn btn-primary btn-large">
                                ${this.progressPercentage >= 100 ? 'Review Course' : this.progressPercentage > 0 ? 'Continue Learning' : 'Start Learning'}
                            </a>
                            <a href="#/courses/my-courses" class="btn btn-secondary btn-large">Back to My Courses</a>
                        </div>
                    </div>
                </div>

                <div class="course-detail-content">
                    <div id="course-error" class="error-message" style="display: none;"></div>
                    
                    <div class="course-metadata-cards">
                        ${this.renderMetadataCards()}
                    </div>

                    <div id="course-structure" class="course-structure">
                        <h2 class="section-title">Course Structure</h2>
                        ${this.renderCourseStructure()}
                    </div>
                    
                    ${this.renderTrainerContent()}
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Render metadata cards
     */
    renderMetadataCards() {
        if (!this.course || !this.course.courseData || !this.course.courseData.days) {
            return '';
        }

        const days = this.course.courseData.days;
        let totalChapters = 0;
        let totalLabs = 0;

        days.forEach(day => {
            totalChapters += (day.chapters || []).length;
            totalLabs += (day.labs || []).length;
        });

        return `
            <div class="metadata-card">
                <div class="metadata-icon">📅</div>
                <div class="metadata-content">
                    <div class="metadata-value">${days.length}</div>
                    <div class="metadata-label">Days</div>
                </div>
            </div>
            <div class="metadata-card">
                <div class="metadata-icon">📖</div>
                <div class="metadata-content">
                    <div class="metadata-value">${totalChapters}</div>
                    <div class="metadata-label">Chapters</div>
                </div>
            </div>
            <div class="metadata-card">
                <div class="metadata-icon">🧪</div>
                <div class="metadata-content">
                    <div class="metadata-value">${totalLabs}</div>
                    <div class="metadata-label">Labs</div>
                </div>
            </div>
        `;
    }

    /**
     * Render course structure (days and chapters)
     */
    renderCourseStructure() {
        if (!this.course.courseData || !this.course.courseData.days) {
            return '<p>No course structure available</p>';
        }

        const days = this.course.courseData.days;

        if (days.length === 0) {
            return '<p>No days available</p>';
        }

        return days.map(day => `
            <div class="day-section">
                <h3 class="day-title">Day ${day.dayNumber}: ${day.title || 'Untitled Day'}</h3>
                ${this.renderChapters(day.chapters)}
                ${this.renderLabs(day.labs)}
            </div>
        `).join('');
    }

    /**
     * Render chapters list
     */
    renderChapters(chapters) {
        if (!chapters || chapters.length === 0) {
            return '<p style="color: #666; font-style: italic;">No chapters available</p>';
        }

        return `
            <div class="chapters-section">
                <h4 class="section-title">Chapters</h4>
                <ul class="content-list">
                    ${chapters.map(chapter => `
                        <li class="content-item">
                            <a href="#" 
                               class="chapter-link content-link" 
                               data-chapter-id="${chapter.id}">
                                ${chapter.title || 'Untitled Chapter'}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Render labs list
     */
    renderLabs(labs) {
        if (!labs || labs.length === 0) {
            return `
                <div class="labs-section">
                    <h4 class="section-title">Labs</h4>
                    <div class="empty-state empty-state-labs">
                        <div class="empty-state-icon">🧪</div>
                        <div class="empty-state-text">No labs available for this day</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="labs-section">
                <h4 class="section-title">Labs</h4>
                <ul class="content-list">
                    ${labs.map(lab => `
                        <li class="content-item">
                            <a href="#" 
                               class="lab-link content-link" 
                               data-lab-id="${lab.id}">
                                ${lab.title || 'Untitled Lab'}
                            </a>
                            ${lab.description ? `<p class="lab-description">${lab.description}</p>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Render trainer content section (only for trainers)
     */
    renderTrainerContent() {
        if (!rbacService.isTrainer(this.currentUser) && !rbacService.isAdmin(this.currentUser)) {
            return '';
        }

        if (!this.course.courseData || !this.course.courseData.trainerContent) {
            return '';
        }

        const trainerContent = this.course.courseData.trainerContent;

        if (!Array.isArray(trainerContent) || trainerContent.length === 0) {
            return '';
        }

        return `
            <div class="trainer-content-section">
                <h3 class="trainer-content-title">Trainer Resources</h3>
                <ul class="content-list">
                    ${trainerContent.map(item => `
                        <li class="content-item">
                            <a href="#" 
                               class="trainer-content-link content-link" 
                               data-content-id="${item.id}">
                                ${item.title || 'Untitled Resource'}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const chapterLinks = this.container.querySelectorAll('.chapter-link');
        chapterLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const chapterId = link.getAttribute('data-chapter-id');
                this.handleChapterClick(chapterId);
            });
        });

        const trainerContentLinks = this.container.querySelectorAll('.trainer-content-link');
        trainerContentLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const contentId = link.getAttribute('data-content-id');
                this.handleTrainerContentClick(contentId);
            });
        });

        const labLinks = this.container.querySelectorAll('.lab-link');
        labLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const labId = link.getAttribute('data-lab-id');
                this.handleLabClick(labId);
            });
        });
    }

    /**
     * Handle chapter click
     */
    handleChapterClick(chapterId) {
        if (this.courseId && chapterId) {
            router.navigate(`/courses/${this.courseId}/content/${chapterId}`);
        }
    }

    /**
     * Handle trainer content click
     */
    handleTrainerContentClick(contentId) {
        if (this.courseId && contentId) {
            router.navigate(`/courses/${this.courseId}/trainer/${contentId}`);
        }
    }

    /**
     * Handle lab click
     */
    handleLabClick(labId) {
        if (this.courseId && labId) {
            router.navigate(`/courses/${this.courseId}/lab/${labId}`);
        }
    }

    /**
     * Refresh progress percentage
     */
    async refreshProgress() {
        await this.loadProgressPercentage();
        const progressDisplay = this.container.querySelector('#progress-display');
        if (progressDisplay && this.currentUser) {
            const progressValue = progressDisplay.querySelector('.course-progress-value');
            if (progressValue) {
                progressValue.textContent = `${this.progressPercentage.toFixed(1)}%`;
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#course-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;';
        } else {
            this.container.innerHTML = `
                <div class="course-detail">
                    <div class="error-message" style="padding: 10px; margin: 10px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;">
                        ${message}
                    </div>
                </div>
            `;
        }
    }
}

export default CourseDetail;

