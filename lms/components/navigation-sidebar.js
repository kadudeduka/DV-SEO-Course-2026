/**
 * Navigation Sidebar Component
 * 
 * Displays course structure navigation with days and chapters.
 */

import { router } from '../core/router.js';
import { progressService } from '../services/progress-service.js';
import { authService } from '../services/auth-service.js';
import { rbacService } from '../services/rbac-service.js';

class NavigationSidebar {
    constructor(container, courseId, courseData, activeChapterId = null, activeLabId = null) {
        this.container = container;
        this.courseId = courseId;
        this.courseData = courseData;
        this.activeChapterId = activeChapterId;
        this.activeLabId = activeLabId;
        this.progress = {};
        this.currentUser = null;
    }

    /**
     * Render navigation sidebar
     */
    async render() {
        if (!this.courseData || !this.courseData.days) {
            this.container.innerHTML = '<div class="nav-sidebar"><p>No course structure available</p></div>';
            return;
        }

        await this.loadProgress();

        this.container.innerHTML = `
            <div class="nav-sidebar">
                <div class="nav-sidebar-header">
                    <h3 class="nav-sidebar-title">Course Navigation</h3>
                </div>
                <div class="nav-sidebar-content">
                    ${this.renderCourseStructure()}
                    ${this.renderTrainerContent()}
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Load progress for current user
     */
    async loadProgress() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                this.progress = {};
                return;
            }

            this.progress = await progressService.getProgress(
                this.currentUser.id,
                this.courseId
            );
        } catch (error) {
            console.warn('Failed to load progress:', error);
            this.progress = {};
        }
    }

    /**
     * Render course structure (days, chapters, and labs)
     */
    renderCourseStructure() {
        const days = this.courseData.days;

        if (days.length === 0) {
            return '<p>No days available</p>';
        }

        return days.map(day => `
            <div class="day-section" data-day-number="${day.dayNumber}">
                <button class="day-section-header" data-day-toggle="${day.dayNumber}">
                    <span class="day-section-title">Day ${day.dayNumber}: ${day.title || 'Untitled Day'}</span>
                    <span class="day-section-chevron" data-day-chevron="${day.dayNumber}">▼</span>
                </button>
                <div class="day-section-content" data-day-content="${day.dayNumber}">
                    ${this.renderChapters(day.chapters)}
                    ${this.renderLabs(day.labs)}
                </div>
            </div>
        `).join('');
    }

    /**
     * Render chapters list
     */
    renderChapters(chapters) {
        if (!chapters || chapters.length === 0) {
            return '<p style="color: #666; font-size: 12px; font-style: italic; margin-left: 10px;">No chapters</p>';
        }

        return `
            <ul class="chapter-list">
                ${chapters.map(chapter => {
                    const isActive = chapter.id === this.activeChapterId;
                    const chapterProgress = this.progress[chapter.id];
                    const isCompleted = chapterProgress && chapterProgress.completed === true;
                    
                    return `
                        <li class="chapter-item">
                            <a href="#" 
                               class="chapter-link ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                               data-chapter-id="${chapter.id}">
                                <span class="chapter-icon">📖</span>
                                <span class="chapter-title">${chapter.title || 'Untitled Chapter'}</span>
                                ${isCompleted ? '<span class="chapter-check">✓</span>' : ''}
                            </a>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
    }

    /**
     * Render labs list
     */
    renderLabs(labs) {
        if (!labs || labs.length === 0) {
            return '';
        }

        return `
            <div class="labs-section">
                <p class="labs-section-title">Labs</p>
                <ul class="lab-list">
                    ${labs.map(lab => {
                        const isActive = lab.id === this.activeLabId;
                        
                        return `
                            <li class="lab-item">
                                <a href="#" 
                                   class="lab-link ${isActive ? 'active' : ''}" 
                                   data-lab-id="${lab.id}">
                                    <span class="lab-icon">🧪</span>
                                    <span class="lab-title">${lab.title || 'Untitled Lab'}</span>
                                </a>
                            </li>
                        `;
                    }).join('')}
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

        if (!this.courseData || !this.courseData.trainerContent) {
            return '';
        }

        const trainerContent = this.courseData.trainerContent;

        if (!Array.isArray(trainerContent) || trainerContent.length === 0) {
            return '';
        }

        return `
            <div class="trainer-content-section">
                <h4 class="trainer-content-title">Trainer Resources</h4>
                <ul class="trainer-content-list">
                    ${trainerContent.map(item => {
                        const isActive = item.id === this.activeChapterId;
                        return `
                            <li class="trainer-content-item">
                                <a href="#" 
                                   class="trainer-content-link ${isActive ? 'active' : ''}" 
                                   data-content-id="${item.id}">
                                    <span class="trainer-content-icon">📚</span>
                                    <span class="trainer-content-title-text">${item.title || 'Untitled Resource'}</span>
                                </a>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Day section toggles
        const dayToggles = this.container.querySelectorAll('[data-day-toggle]');
        dayToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const dayNumber = toggle.getAttribute('data-day-toggle');
                this.toggleDaySection(dayNumber);
            });
        });

        // Chapter links
        const chapterLinks = this.container.querySelectorAll('.chapter-link');
        chapterLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const chapterId = link.getAttribute('data-chapter-id');
                this.handleChapterClick(chapterId);
            });
        });

        // Lab links
        const labLinks = this.container.querySelectorAll('.lab-link');
        labLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const labId = link.getAttribute('data-lab-id');
                this.handleLabClick(labId);
            });
        });

        // Trainer content links
        const trainerContentLinks = this.container.querySelectorAll('.trainer-content-link');
        trainerContentLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const contentId = link.getAttribute('data-content-id');
                this.handleTrainerContentClick(contentId);
            });
        });
    }

    /**
     * Toggle day section
     */
    toggleDaySection(dayNumber) {
        const content = this.container.querySelector(`[data-day-content="${dayNumber}"]`);
        const chevron = this.container.querySelector(`[data-day-chevron="${dayNumber}"]`);
        
        if (content && chevron) {
            const isExpanded = content.style.display !== 'none';
            content.style.display = isExpanded ? 'none' : 'block';
            chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
        }
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
     * Handle lab click
     */
    handleLabClick(labId) {
        if (this.courseId && labId) {
            router.navigate(`/courses/${this.courseId}/lab/${labId}`);
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
     * Update active chapter
     */
    async updateActiveChapter(chapterId) {
        this.activeChapterId = chapterId;
        this.activeLabId = null;
        await this.render();
    }

    /**
     * Update active lab
     */
    async updateActiveLab(labId) {
        this.activeLabId = labId;
        this.activeChapterId = null;
        await this.render();
    }

    /**
     * Refresh progress and re-render
     */
    async refreshProgress() {
        await this.loadProgress();
        await this.render();
    }
}

export default NavigationSidebar;

