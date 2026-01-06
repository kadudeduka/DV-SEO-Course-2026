/**
 * Course Navigation Tabs Component
 * 
 * Provides tab-based navigation for course sections:
 * - Overview
 * - Content (Chapters & Labs)
 * - Coach (AI Coach & Trainer)
 */

class CourseNavigationTabs {
    constructor(container, courseId) {
        this.container = container;
        this.courseId = courseId;
        this.activeTab = 'overview'; // Default to overview
        this.onTabChange = null; // Callback for tab changes
    }

    /**
     * Render navigation tabs
     * @param {string} activeTab - Currently active tab ('overview', 'content', 'coach')
     */
    async render(activeTab = 'overview') {
        this.activeTab = activeTab;
        
        if (!this.container) {
            console.error('[CourseNavigationTabs] Container not found');
            return;
        }

        const tabsHTML = `
            <nav class="course-navigation-tabs" role="tablist" aria-label="Course sections">
                <button 
                    class="nav-tab ${activeTab === 'overview' ? 'active' : ''}" 
                    data-tab="overview"
                    role="tab"
                    aria-selected="${activeTab === 'overview'}"
                    aria-controls="overview-panel"
                >
                    <span class="tab-icon">📋</span>
                    <span class="tab-label">Overview</span>
                </button>
                <button 
                    class="nav-tab ${activeTab === 'content' ? 'active' : ''}" 
                    data-tab="content"
                    role="tab"
                    aria-selected="${activeTab === 'content'}"
                    aria-controls="content-panel"
                >
                    <span class="tab-icon">📚</span>
                    <span class="tab-label">Content</span>
                </button>
                <button 
                    class="nav-tab ${activeTab === 'coach' ? 'active' : ''}" 
                    data-tab="coach"
                    role="tab"
                    aria-selected="${activeTab === 'coach'}"
                    aria-controls="coach-panel"
                >
                    <span class="tab-icon">💬</span>
                    <span class="tab-label">Coach</span>
                </button>
            </nav>
        `;

        this.container.innerHTML = tabsHTML;
        this.attachEventListeners();
    }

    /**
     * Attach event listeners to tabs
     */
    attachEventListeners() {
        const tabs = this.container.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    /**
     * Switch to a different tab
     * @param {string} tabName - Tab to switch to
     */
    switchTab(tabName) {
        if (tabName === this.activeTab) {
            return; // Already on this tab
        }

        // Update active state
        const tabs = this.container.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });

        this.activeTab = tabName;

        // Trigger callback if provided
        if (this.onTabChange) {
            this.onTabChange(tabName);
        }
    }

    /**
     * Set tab change callback
     * @param {Function} callback - Callback function(tabName)
     */
    setTabChangeCallback(callback) {
        this.onTabChange = callback;
    }

    /**
     * Get current active tab
     * @returns {string} Active tab name
     */
    getActiveTab() {
        return this.activeTab;
    }
}

export default CourseNavigationTabs;

