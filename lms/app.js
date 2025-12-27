// LMS Application Logic

class LMS {
    constructor() {
        this.currentContentId = null;
        this.completedItems = this.loadProgress();
        this.filterType = 'all';
        this.init();
    }

    init() {
        this.renderNavigation();
        this.attachEventListeners();
        this.updateProgress();
        this.checkURLParams();
    }

    // Load progress from localStorage
    loadProgress() {
        const saved = localStorage.getItem('lms-progress');
        return saved ? JSON.parse(saved) : [];
    }

    // Save progress to localStorage
    saveProgress() {
        localStorage.setItem('lms-progress', JSON.stringify(this.completedItems));
    }

    // Mark item as complete
    markComplete(contentId, completed) {
        if (completed) {
            if (!this.completedItems.includes(contentId)) {
                this.completedItems.push(contentId);
            }
        } else {
            this.completedItems = this.completedItems.filter(id => id !== contentId);
        }
        this.saveProgress();
        this.updateProgress();
        this.updateNavigationState();
    }

    // Check if item is complete
    isComplete(contentId) {
        return this.completedItems.includes(contentId);
    }

    // Calculate progress percentage
    calculateProgress() {
        const allItems = getAllContentItems();
        const total = allItems.length;
        const completed = this.completedItems.length;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    // Update progress display
    updateProgress() {
        const percentage = this.calculateProgress();
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = `${percentage}% Complete`;
        }
    }

    // Render navigation sidebar
    renderNavigation() {
        const nav = document.getElementById('courseNav');
        if (!nav) return;

        nav.innerHTML = '';

        courseData.days.forEach(day => {
            const daySection = document.createElement('div');
            daySection.className = 'day-section';
            daySection.dataset.day = day.day;

            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.innerHTML = `
                <h3>
                    <span class="day-number">Day ${day.day}</span>
                    ${day.title}
                </h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            dayHeader.addEventListener('click', () => {
                daySection.classList.toggle('expanded');
            });

            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';

            // Add chapters
            day.chapters.forEach(chapter => {
                if (this.shouldShowItem(chapter)) {
                    const navItem = this.createNavItem(chapter, day);
                    dayContent.appendChild(navItem);
                }
            });

            // Add labs
            day.labs.forEach(lab => {
                if (this.shouldShowItem(lab)) {
                    const navItem = this.createNavItem(lab, day);
                    dayContent.appendChild(navItem);
                }
            });

            daySection.appendChild(dayHeader);
            daySection.appendChild(dayContent);
            nav.appendChild(daySection);
        });

        // Expand first day by default
        const firstDay = nav.querySelector('.day-section');
        if (firstDay) {
            firstDay.classList.add('expanded');
        }

        this.updateNavigationState();
    }

    // Create navigation item
    createNavItem(item, day) {
        const navItem = document.createElement('a');
        navItem.className = 'nav-item';
        navItem.href = '#';
        navItem.dataset.id = item.id;
        navItem.dataset.type = item.type;
        navItem.textContent = item.title;

        if (this.isComplete(item.id)) {
            navItem.classList.add('completed');
        }

        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadContent(item.id);
        });

        return navItem;
    }

    // Check if item should be shown based on filter
    shouldShowItem(item) {
        if (this.filterType === 'all') return true;
        return item.type === this.filterType;
    }

    // Update navigation state (active, completed)
    updateNavigationState() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const itemId = item.dataset.id;
            item.classList.remove('active');
            
            if (itemId === this.currentContentId) {
                item.classList.add('active');
            }

            if (this.isComplete(itemId)) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }
        });
    }

    // Load content by ID
    async loadContent(contentId) {
        const content = getContentById(contentId);
        if (!content) {
            console.error('Content not found:', contentId);
            return;
        }

        this.currentContentId = contentId;
        this.updateNavigationState();

        // Hide welcome screen, show content viewer
        const welcomeScreen = document.getElementById('welcomeScreen');
        const contentViewer = document.getElementById('contentViewer');
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (contentViewer) contentViewer.style.display = 'block';

        // Update URL
        window.history.pushState({ contentId }, '', `#${contentId}`);

        // Show loading
        const contentBody = document.getElementById('contentBody');
        if (contentBody) {
            contentBody.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading content...</p>
                </div>
            `;
        }

        try {
            // Load markdown file
            const response = await fetch(content.file);
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.statusText}`);
            }

            const markdown = await response.text();
            const html = marked.parse(markdown);

            // Update content
            if (contentBody) {
                contentBody.innerHTML = html;
            }

            // Fix image paths (relative to visuals folder)
            this.fixImagePaths(contentBody);

            // Update breadcrumb
            this.updateBreadcrumb(content, contentBody);

            // Update navigation buttons
            this.updateNavigationButtons();

            // Update checkbox
            this.updateCompleteCheckbox();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Error loading content:', error);
            if (contentBody) {
                contentBody.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--error-color);">
                        <h2>Error Loading Content</h2>
                        <p>${error.message}</p>
                        <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
                            Please check that the file exists: <code>${content.file}</code>
                        </p>
                    </div>
                `;
            }
        }
    }

    // Fix image paths in content
    fixImagePaths(contentBody) {
        if (!contentBody) return;

        const images = contentBody.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('../')) {
                // Convert relative paths
                const newSrc = src.replace('../', '');
                img.setAttribute('src', newSrc);
            }
        });
    }

    // Update breadcrumb
    updateBreadcrumb(content, contentBody) {
        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        const nav = getNavigationItems(content.id);
        
        breadcrumb.innerHTML = `
            <a href="#" onclick="event.preventDefault(); lms.showWelcomeScreen();">Home</a>
            <span> / </span>
            <span>Day ${content.day}</span>
            <span> / </span>
            <span>${content.type === 'book' ? '📚 Book' : '🧪 Lab'}</span>
            <span> / </span>
            <span>${content.title}</span>
        `;
    }

    // Update navigation buttons
    updateNavigationButtons() {
        if (!this.currentContentId) return;

        const nav = getNavigationItems(this.currentContentId);
        const prevBtn = document.getElementById('prevContent');
        const nextBtn = document.getElementById('nextContent');

        if (prevBtn) {
            prevBtn.disabled = !nav.previous;
            prevBtn.onclick = () => {
                if (nav.previous) {
                    this.loadContent(nav.previous.id);
                }
            };
        }

        if (nextBtn) {
            nextBtn.disabled = !nav.next;
            nextBtn.onclick = () => {
                if (nav.next) {
                    this.loadContent(nav.next.id);
                }
            };
        }
    }

    // Update complete checkbox
    updateCompleteCheckbox() {
        const checkbox = document.getElementById('markComplete');
        if (!checkbox) return;

        checkbox.checked = this.isComplete(this.currentContentId);
        checkbox.onchange = (e) => {
            this.markComplete(this.currentContentId, e.target.checked);
        };
    }

    // Show welcome screen
    showWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const contentViewer = document.getElementById('contentViewer');
        if (welcomeScreen) welcomeScreen.style.display = 'block';
        if (contentViewer) contentViewer.style.display = 'none';
        
        this.currentContentId = null;
        this.updateNavigationState();
        window.history.pushState({}, '', window.location.pathname);
    }

    // Check URL parameters for direct content loading
    checkURLParams() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#')) {
            const contentId = hash.substring(1);
            const content = getContentById(contentId);
            if (content) {
                this.loadContent(contentId);
            }
        }
    }

    // Attach event listeners
    attachEventListeners() {
        // Sidebar toggle
        const toggleBtn = document.getElementById('toggleSidebar');
        const closeBtn = document.getElementById('closeSidebar');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                sidebar?.classList.toggle('closed');
                overlay?.classList.toggle('active');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebar?.classList.add('closed');
                overlay?.classList.remove('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar?.classList.add('closed');
                overlay.classList.remove('active');
            });
        }

        // Filter tabs
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterType = tab.dataset.filter;
                this.renderNavigation();
            });
        });

        // Start course button
        const startBtn = document.getElementById('startCourse');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const firstItem = getAllContentItems()[0];
                if (firstItem) {
                    this.loadContent(firstItem.id);
                }
            });
        }

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.contentId) {
                this.loadContent(e.state.contentId);
            } else {
                this.showWelcomeScreen();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Left arrow - previous
            if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const prevBtn = document.getElementById('prevContent');
                if (prevBtn && !prevBtn.disabled) {
                    prevBtn.click();
                }
            }
            // Right arrow - next
            if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const nextBtn = document.getElementById('nextContent');
                if (nextBtn && !nextBtn.disabled) {
                    nextBtn.click();
                }
            }
            // Escape - close sidebar on mobile
            if (e.key === 'Escape') {
                sidebar?.classList.add('closed');
                overlay?.classList.remove('active');
            }
        });
    }
}

// Initialize LMS when DOM is ready
let lms;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        lms = new LMS();
    });
} else {
    lms = new LMS();
}

