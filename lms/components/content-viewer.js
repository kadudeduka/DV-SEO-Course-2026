/**
 * Content Viewer Component
 * 
 * Displays markdown content for course chapters.
 */

import { courseService } from '../services/course-service.js';
import { renderMarkdown } from '../utils/markdown-renderer.js';
import NavigationSidebar from './navigation-sidebar.js';
import { progressService } from '../services/progress-service.js';
import { authService } from '../services/auth-service.js';
import { rbacService } from '../services/rbac-service.js';
import Header from './header.js';

class ContentViewer {
    constructor(container) {
        this.container = container;
        this.courseId = null;
        this.chapterId = null;
        this.course = null;
        this.chapter = null;
        this.sidebar = null;
        this.currentUser = null;
        this.isCompleted = false;
    }

    /**
     * Show content viewer
     * @param {string} courseId - Course identifier
     * @param {string} chapterId - Chapter identifier
     */
    async show(courseId, chapterId) {
        this.courseId = courseId;
        this.chapterId = chapterId;
        
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        } else {
            console.error('[ContentViewer] Container not found!');
            return;
        }
        
        // Render header
        await this.renderHeader();
        
        // Initialize AI Coach widget for this course
        await this._initAICoach();
        
        this.renderLoading();
        
        try {
            await this.loadCourse();
            await this.findChapter();
            
            if (!this.chapter) {
                console.error('[ContentViewer] Chapter not found');
                this.renderError('Chapter not found');
                return;
            }
            
            await this.loadContent();
            await this.loadProgress();
            await this.render();
        } catch (error) {
            console.error('[ContentViewer] Error in show():', error);
            this.renderError('Failed to load content: ' + error.message);
        }
    }

    /**
     * Load course data
     */
    async loadCourse() {
        if (!this.courseId) {
            throw new Error('Course ID is required');
        }
        
        this.course = await courseService.getCourseById(this.courseId);
        
        if (!this.course) {
            throw new Error('Course not found');
        }
    }

    /**
     * Find chapter in course structure
     */
    findChapter() {
        if (!this.course || !this.course.courseData || !this.course.courseData.days) {
            return;
        }

        for (const day of this.course.courseData.days) {
            if (day.chapters && Array.isArray(day.chapters)) {
                const chapter = day.chapters.find(ch => ch.id === this.chapterId);
                if (chapter) {
                    this.chapter = chapter;
                    return;
                }
            }
        }
    }

    /**
     * Load markdown content
     */
    async loadContent() {
        if (!this.chapter || !this.chapter.file) {
            throw new Error('Chapter file path not found');
        }

        this.markdown = await courseService.getCourseContent(this.chapter.file);
    }

    /**
     * Load progress status for current chapter
     */
    async loadProgress() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                this.isCompleted = false;
                return;
            }

            const progress = await progressService.getProgress(
                this.currentUser.id,
                this.courseId
            );

            const chapterProgress = progress[this.chapterId];
            this.isCompleted = chapterProgress && chapterProgress.completed === true;
        } catch (error) {
            console.warn('Failed to load progress:', error);
            this.isCompleted = false;
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }
        
        this.container.innerHTML = `
            <div class="content-viewer-layout">
                <div id="nav-sidebar-container"></div>
                <div class="content-viewer">
                    <div class="loading-state">
                        <div class="loading-state-text">Loading content...</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render content
     */
    async render() {
        
        if (!this.chapter || !this.markdown) {
            console.error('[ContentViewer] Missing chapter or markdown');
            this.renderError('Content not available');
            return;
        }

        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }

        const html = await renderMarkdown(this.markdown, this.courseId);

        // Find previous and next content
        const navigation = this.findPreviousNext();

        this.container.innerHTML = `
            <div class="content-viewer-layout">
                <div id="nav-sidebar-container" class="content-sidebar-container"></div>
                <div class="content-viewer-main">
                    <div class="content-viewer-header">
                        <div class="content-header-title-row">
                            <h1 class="content-title">${this.chapter.title || 'Untitled Chapter'}</h1>
                        </div>
                        <div class="content-header-actions-row">
                            <div class="reading-progress-bar">
                                <div class="reading-progress-fill" id="reading-progress-fill"></div>
                            </div>
                            <div id="completion-controls" class="completion-controls">
                                ${this.isCompleted ? '<span class="completion-badge">✓ Completed</span>' : ''}
                                <button id="mark-complete-btn" class="btn btn-primary btn-sm">
                                    ${this.isCompleted ? 'Unmark as Complete' : 'Mark as Complete'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="content-error" class="error-message" style="display: none;"></div>
                    <div class="content-body markdown-content" id="content-body">
                        ${html}
                    </div>
                    <div class="content-navigation">
                        ${navigation.previous ? `
                            <a href="#/courses/${this.courseId}/content/${navigation.previous.id}" class="nav-button nav-button-prev">
                                <span class="nav-button-icon">←</span>
                                <div class="nav-button-content">
                                    <span class="nav-button-label">Previous</span>
                                    <span class="nav-button-title">${navigation.previous.title}</span>
                                </div>
                            </a>
                        ` : '<div></div>'}
                        ${navigation.next ? `
                            <a href="#/courses/${this.courseId}/content/${navigation.next.id}" class="nav-button nav-button-next">
                                <div class="nav-button-content">
                                    <span class="nav-button-label">Next</span>
                                    <span class="nav-button-title">${navigation.next.title}</span>
                                </div>
                                <span class="nav-button-icon">→</span>
                            </a>
                        ` : '<div></div>'}
                    </div>
                </div>
            </div>
        `;

        await this.renderSidebar();
        this.attachEventListeners();
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
     * Render sidebar
     */
    async renderSidebar() {
        if (!this.course || !this.course.courseData) {
            console.warn('[ContentViewer] Cannot render sidebar: course or courseData missing');
            return;
        }

        const sidebarContainer = this.container.querySelector('#nav-sidebar-container');
        if (!sidebarContainer) {
            console.warn('[ContentViewer] Sidebar container not found');
            return;
        }

        this.sidebar = new NavigationSidebar(
            sidebarContainer,
            this.courseId,
            this.course.courseData,
            this.chapterId
        );
        await this.sidebar.render();
    }

    /**
     * Find previous and next chapters
     */
    findPreviousNext() {
        const navigation = { previous: null, next: null };
        
        if (!this.course || !this.course.courseData || !this.course.courseData.days) {
            return navigation;
        }

        let found = false;
        const allChapters = [];

        // Collect all chapters in order
        for (const day of this.course.courseData.days) {
            if (day.chapters && Array.isArray(day.chapters)) {
                for (const chapter of day.chapters) {
                    allChapters.push(chapter);
                    if (chapter.id === this.chapterId) {
                        found = true;
                    } else if (found && !navigation.next) {
                        navigation.next = chapter;
                    } else if (!found) {
                        navigation.previous = chapter;
                    }
                }
            }
        }

        return navigation;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Mark/Unmark complete button
        const markCompleteBtn = this.container.querySelector('#mark-complete-btn');
        if (markCompleteBtn) {
            markCompleteBtn.addEventListener('click', () => this.handleToggleComplete());
        }

        // Reading progress indicator
        this.setupReadingProgress();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    /**
     * Setup reading progress indicator
     */
    setupReadingProgress() {
        const contentBody = this.container.querySelector('#content-body');
        const progressFill = this.container.querySelector('#reading-progress-fill');
        
        if (!contentBody || !progressFill) return;

        const updateProgress = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        };

        window.addEventListener('scroll', updateProgress);
        window.addEventListener('resize', updateProgress);
        updateProgress(); // Initial update
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        const navigation = this.findPreviousNext();
        
        document.addEventListener('keydown', (e) => {
            // Only handle if not typing in input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Left arrow or 'p' for previous
            if ((e.key === 'ArrowLeft' || e.key === 'p') && navigation.previous) {
                e.preventDefault();
                router.navigate(`/courses/${this.courseId}/content/${navigation.previous.id}`);
            }

            // Right arrow or 'n' for next
            if ((e.key === 'ArrowRight' || e.key === 'n') && navigation.next) {
                e.preventDefault();
                router.navigate(`/courses/${this.courseId}/content/${navigation.next.id}`);
            }
        });
    }

    /**
     * Handle toggle complete button click (mark/unmark)
     */
    async handleToggleComplete() {
        if (!this.currentUser || !this.currentUser.id) {
            this.showError('You must be logged in to mark content as complete');
            return;
        }

        const button = this.container.querySelector('#mark-complete-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Saving...';
        }

        const newCompletedState = !this.isCompleted;

        try {
            await progressService.saveProgress(
                this.currentUser.id,
                this.courseId,
                this.chapterId,
                newCompletedState,
                'chapter'
            );

            this.isCompleted = newCompletedState;
            this.updateCompletionUI();
            await this.refreshSidebarProgress();
        } catch (error) {
            this.showError('Failed to save progress: ' + error.message);
            if (button) {
                button.disabled = false;
                button.textContent = this.isCompleted ? 'Unmark as Complete' : 'Mark as Complete';
            }
        }
    }

    /**
     * Update completion UI
     */
    updateCompletionUI() {
        const controlsContainer = this.container.querySelector('#completion-controls');
        const button = this.container.querySelector('#mark-complete-btn');
        
        if (controlsContainer && button) {
            if (this.isCompleted) {
                controlsContainer.innerHTML = `
                    <span class="completion-badge">✓ Completed</span>
                    <button id="mark-complete-btn" class="btn btn-primary btn-sm">
                        Unmark as Complete
                    </button>
                `;
            } else {
                controlsContainer.innerHTML = `
                    <button id="mark-complete-btn" class="btn btn-primary btn-sm">
                        Mark as Complete
                    </button>
                `;
            }
            
            // Re-attach event listener after updating innerHTML
            const newButton = this.container.querySelector('#mark-complete-btn');
            if (newButton) {
                newButton.addEventListener('click', () => this.handleToggleComplete());
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#content-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Render error state
     */
    async renderError(message) {
        console.error('[ContentViewer] Rendering error:', message);
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }
        
        this.container.innerHTML = `
            <div class="content-viewer-layout">
                <div id="nav-sidebar-container"></div>
                <div class="content-viewer">
                    <div class="error-message">
                        ${message}
                    </div>
                </div>
            </div>
        `;

        if (this.course && this.course.courseData) {
            await this.renderSidebar();
        }
    }

    /**
     * Refresh sidebar progress after marking complete
     */
    async refreshSidebarProgress() {
        if (this.sidebar) {
            await this.sidebar.refreshProgress();
        }
    }

    /**
     * Show trainer-only content
     * @param {string} courseId - Course identifier
     * @param {string} contentId - Trainer content identifier
     */
    async showTrainerContent(courseId, contentId) {
        this.courseId = courseId;
        this.chapterId = contentId;
        
        this.renderLoading();
        
        try {
            const currentUser = await authService.getCurrentUser();
            
            if (!rbacService.isTrainer(currentUser) && !rbacService.isAdmin(currentUser)) {
                throw new Error('Access denied: Trainer content is only available to trainers');
            }
            
            await this.loadCourse();
            await this.findTrainerContent(contentId);
            
            if (!this.chapter) {
                this.renderError('Trainer content not found');
                return;
            }
            
            await this.loadContent();
            this.renderTrainerContent();
        } catch (error) {
            this.renderError('Failed to load content: ' + error.message);
        }
    }

    /**
     * Find trainer content in course structure
     */
    findTrainerContent(contentId) {
        if (!this.course || !this.course.courseData || !this.course.courseData.trainerContent) {
            return;
        }

        const trainerContent = this.course.courseData.trainerContent;
        const content = trainerContent.find(item => item.id === contentId);
        
        if (content) {
            this.chapter = content;
        }
    }

    /**
     * Render trainer content (no progress tracking, no sidebar)
     */
    async renderTrainerContent() {
        if (!this.chapter || !this.markdown) {
            this.renderError('Content not available');
            return;
        }

        const html = await renderMarkdown(this.markdown, this.courseId);

        this.container.innerHTML = `
            <div class="content-viewer content-viewer-standalone">
                <div class="trainer-content-banner">
                    <strong>Trainer-Only Content</strong>
                </div>
                <h2 class="content-title">${this.chapter.title || 'Untitled Content'}</h2>
                <div id="content-error" class="error-message" style="display: none;"></div>
                <div class="content-body markdown-content">
                    ${html}
                </div>
            </div>
        `;
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
            }
        } catch (error) {
            console.warn('[ContentViewer] Failed to initialize AI Coach:', error);
        }
    }
}

export default ContentViewer;

