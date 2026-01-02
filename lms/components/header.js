/**
 * Header Component
 * 
 * Application header with navigation and notification badge.
 */

import NotificationBadge from './notification-badge.js';
import globalSearch from './search.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';

class Header {
    constructor(container) {
        this.container = container;
        this.notificationBadge = null;
        this.currentUser = null;
        this.mobileMenuOpen = false;
    }

    /**
     * Initialize and render header
     */
    async init() {
        try {
            this.currentUser = await authService.getCurrentUser();
            this.render();
            await this.initNotificationBadge();
            this.attachEventListeners();
            
            window.addEventListener('notification-read', () => this.refreshBadge());
            window.addEventListener('notifications-all-read', () => this.refreshBadge());
        } catch (error) {
            console.warn('Failed to initialize header:', error);
        }
    }

    /**
     * Render header
     */
    render() {
        const roleLabel = this.getRoleLabel(this.currentUser?.role);
        const logoUrl = 'https://www.digitalvidya.com/wp-content/uploads/2025/12/Digital-Vidya-Logo@2x.png';
        
        this.container.innerHTML = `
            <header class="app-header" role="banner">
                <div class="header-left">
                    <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="mobile-drawer">
                        <span class="hamburger-icon" aria-hidden="true">
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </button>
                    <h1 class="header-logo">
                        <a href="#/" id="header-logo" class="logo-link" aria-label="Digital Vidya Learning Hub - Home">
                            <img src="${logoUrl}" alt="Digital Vidya" class="logo-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                            <span class="logo-text" style="display: none;">DV Learning Hub</span>
                        </a>
                    </h1>
                </div>
                <nav class="header-nav" id="header-nav" role="navigation" aria-label="Main navigation">
                    ${this.currentUser ? `
                        <div class="nav-section">
                            ${this.renderRoleNavigation()}
                        </div>
                        <div class="nav-section">
                            <button class="search-trigger-btn" id="search-trigger-btn" aria-label="Open search dialog" title="Search (⌘K)" aria-keyshortcuts="Meta+K Ctrl+K">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                            </button>
                            <div id="notification-badge-container" class="notification-container" role="region" aria-label="Notifications"></div>
                            <div class="user-info" role="group" aria-label="User information">
                                <div class="user-avatar" aria-hidden="true">
                                    <span class="avatar-initial">${this.getUserInitial(this.currentUser)}</span>
                                </div>
                                <div class="user-details">
                                    <a href="#/profile" class="user-name-link" aria-label="View my profile - Logged in as ${this.escapeHtml(this.currentUser.full_name || this.currentUser.email)}">
                                        <span class="user-name">${this.escapeHtml(this.currentUser.full_name || this.currentUser.email)}</span>
                                    </a>
                                    <span class="user-role" aria-label="Role: ${roleLabel}">${roleLabel}</span>
                                </div>
                            </div>
                            <button id="logout-btn" class="btn btn-logout" aria-label="Log out of your account">Logout</button>
                        </div>
                    ` : `
                        <div class="nav-section">
                            <a href="#/login" class="nav-link" aria-label="Log in to your account">Login</a>
                            <a href="#/register" class="nav-link nav-link-primary" aria-label="Create a new account">Sign Up</a>
                        </div>
                    `}
                </nav>
            </header>
            ${this.currentUser ? `
                <div class="mobile-drawer ${this.mobileMenuOpen ? 'open' : ''}" id="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
                    <div class="mobile-drawer-backdrop" id="mobile-drawer-backdrop" aria-hidden="true"></div>
                    <div class="mobile-drawer-content">
                        <div class="mobile-drawer-header">
                            <div class="mobile-user-info" role="group" aria-label="User information">
                                <div class="user-avatar" aria-hidden="true">
                                    <span class="avatar-initial">${this.getUserInitial(this.currentUser)}</span>
                                </div>
                                <div class="user-details">
                                    <a href="#/profile" class="user-name-link" aria-label="View my profile - Logged in as ${this.escapeHtml(this.currentUser.full_name || this.currentUser.email)}">
                                        <span class="user-name">${this.escapeHtml(this.currentUser.full_name || this.currentUser.email)}</span>
                                    </a>
                                    <span class="user-role" aria-label="Role: ${roleLabel}">${roleLabel}</span>
                                </div>
                            </div>
                            <button class="mobile-drawer-close" id="mobile-drawer-close" aria-label="Close navigation menu">
                                <span aria-hidden="true">✕</span>
                            </button>
                        </div>
                        <nav class="mobile-nav" role="navigation" aria-label="Mobile navigation">
                            ${this.renderMobileNavigation()}
                        </nav>
                        <div class="mobile-drawer-footer">
                            <button id="mobile-logout-btn" class="btn btn-danger btn-full" aria-label="Log out of your account">Logout</button>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    }

    /**
     * Get user initial for avatar
     */
    getUserInitial(user) {
        if (user?.full_name) {
            const names = user.full_name.trim().split(' ');
            if (names.length >= 2) {
                return (names[0][0] + names[names.length - 1][0]).toUpperCase();
            }
            return names[0][0].toUpperCase();
        }
        if (user?.email) {
            return user.email[0].toUpperCase();
        }
        return 'U';
    }

    /**
     * Get role label for display
     */
    getRoleLabel(role) {
        const labels = {
            'admin': 'Admin',
            'trainer': 'Trainer',
            'learner': 'Learner'
        };
        return labels[role] || 'Learner';
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
     * Render role-specific navigation
     */
    renderRoleNavigation() {
        if (!this.currentUser) return '';

        const role = this.currentUser.role;
        
        if (role === 'admin') {
            return `
                <a href="#/admin/dashboard" class="nav-link">Dashboard</a>
                <a href="#/courses" class="nav-link">Courses</a>
                <div class="nav-dropdown">
                    <button class="nav-link nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true" id="admin-nav-dropdown-toggle">
                        Administration
                        <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="m3 4.5 3 3 3-3"/>
                        </svg>
                    </button>
                    <div class="nav-dropdown-menu" id="admin-nav-dropdown-menu" role="menu">
                        <a href="#/admin/users" class="nav-dropdown-item" role="menuitem">User Management</a>
                        <a href="#/admin/learners" class="nav-dropdown-item" role="menuitem">Learner Management</a>
                        <a href="#/admin/ai-coach/indexing" class="nav-dropdown-item" role="menuitem">🤖 AI Coach Indexing</a>
                    </div>
                </div>
                <a href="#/reports/admin" class="nav-link" aria-label="View system reports">
                    Reports
                </a>
                <a href="#/help" class="nav-link" aria-label="Open help and support center">Help & Support</a>
            `;
        }
        
        if (role === 'trainer') {
            return `
                <a href="#/trainer/dashboard" class="nav-link">Dashboard</a>
                <a href="#/courses" class="nav-link">Courses</a>
                <div class="nav-dropdown">
                    <button class="nav-link nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true" id="admin-dropdown-toggle">
                        Administration
                        <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="m3 4.5 3 3 3-3"/>
                        </svg>
                    </button>
                    <div class="nav-dropdown-menu" id="admin-dropdown-menu" role="menu">
                        <a href="#/trainer/learners" class="nav-dropdown-item" role="menuitem">My Learners</a>
                        <a href="#/trainer/lab-review" class="nav-dropdown-item" role="menuitem">Labs Evaluations</a>
                        <a href="#/trainer/course-allocation" class="nav-dropdown-item" role="menuitem">Course Allocation</a>
                        <a href="#/trainer/ai-coach-personalization" class="nav-dropdown-item" role="menuitem">🤖 AI Coach Setup</a>
                        <a href="#/trainer/ai-escalations" class="nav-dropdown-item" role="menuitem">🚨 AI Escalations</a>
                    </div>
                </div>
                <a href="#/reports/trainer" class="nav-link" aria-label="View learner performance reports">
                    Reports
                </a>
                <a href="#/help" class="nav-link" aria-label="Open help and support center">Help & Support</a>
            `;
        }
        
        if (role === 'learner') {
            return `
                <a href="#/dashboard" class="nav-link" aria-label="Go to my dashboard">Dashboard</a>
                <a href="#/courses/my-courses" class="nav-link" aria-label="View courses allocated to me">Courses</a>
                <a href="#/learner/lab-submissions" class="nav-link" aria-label="View labs submitted by me for evaluation">Labs</a>
                <a href="#/reports/learner" class="nav-link" aria-label="View performance reports">
                    Reports
                </a>
                <a href="#/certifications" class="nav-link nav-link-disabled" aria-label="Certifications (under implementation)" title="Certifications - Coming Soon">
                    Certifications
                    <span class="coming-soon-badge">Soon</span>
                </a>
                <a href="#/help" class="nav-link" aria-label="Open help and support center">Help & Support</a>
            `;
        }
        
        return '';
    }

    /**
     * Initialize notification badge
     */
    async initNotificationBadge() {
        if (!this.currentUser) {
            return;
        }

        const badgeContainer = this.container.querySelector('#notification-badge-container');
        if (badgeContainer) {
            this.notificationBadge = new NotificationBadge(badgeContainer);
            await this.notificationBadge.init();
        }
    }

    /**
     * Refresh notification badge
     */
    async refreshBadge() {
        if (this.notificationBadge) {
            await this.notificationBadge.refresh();
        }
    }
    
    /**
     * Refresh header (reload user and re-render)
     */
    async refresh() {
        try {
            this.currentUser = await authService.getCurrentUser();
            this.render();
            await this.initNotificationBadge();
            this.attachEventListeners();
        } catch (error) {
            // If not authenticated, clear user and render
            this.currentUser = null;
            this.render();
        }
    }

    /**
     * Render mobile navigation
     */
    renderMobileNavigation() {
        if (!this.currentUser) return '';

        const role = this.currentUser.role;
        
        if (role === 'admin') {
            return `
                <a href="#/admin/dashboard" class="mobile-nav-link" data-close-drawer aria-label="Go to admin dashboard">
                    <span class="nav-icon" aria-hidden="true">🏠</span>
                    <span>Dashboard</span>
                </a>
                <a href="#/courses" class="mobile-nav-link" data-close-drawer aria-label="View courses">
                    <span class="nav-icon" aria-hidden="true">📚</span>
                    <span>Courses</span>
                </a>
                <div class="mobile-nav-section">
                    <div class="mobile-nav-section-header">Administration</div>
                    <a href="#/admin/users" class="mobile-nav-link mobile-nav-link-indented" data-close-drawer aria-label="User Management">
                        <span class="nav-icon" aria-hidden="true">👥</span>
                        <span>User Management</span>
                    </a>
                    <a href="#/admin/learners" class="mobile-nav-link mobile-nav-link-indented" data-close-drawer aria-label="Learner Management">
                        <span class="nav-icon" aria-hidden="true">🎓</span>
                        <span>Learner Management</span>
                    </a>
                    <a href="#/admin/ai-coach/indexing" class="mobile-nav-link mobile-nav-link-indented" data-close-drawer aria-label="AI Coach Content Indexing">
                        <span class="nav-icon" aria-hidden="true">🤖</span>
                        <span>AI Coach Indexing</span>
                    </a>
                </div>
                <a href="#/reports/admin" class="mobile-nav-link" data-close-drawer aria-label="View system reports">
                    <span class="nav-icon" aria-hidden="true">📊</span>
                    <span>Reports</span>
                </a>
                <a href="#/help" class="mobile-nav-link" data-close-drawer aria-label="Open help and support center">
                    <span class="nav-icon" aria-hidden="true">❓</span>
                    <span>Help & Support</span>
                </a>
            `;
        }
        
        if (role === 'trainer') {
            return `
                <a href="#/trainer/dashboard" class="mobile-nav-link" data-close-drawer aria-label="Go to trainer dashboard">
                    <span class="nav-icon" aria-hidden="true">🏠</span>
                    <span>Dashboard</span>
                </a>
                <a href="#/courses" class="mobile-nav-link" data-close-drawer aria-label="View all courses">
                    <span class="nav-icon" aria-hidden="true">📚</span>
                    <span>Courses</span>
                </a>
                <div class="mobile-nav-section-header">Administration</div>
                <a href="#/trainer/learners" class="mobile-nav-link mobile-nav-sublink" data-close-drawer aria-label="View my assigned learners">
                    <span class="nav-icon" aria-hidden="true">👥</span>
                    <span>My Learners</span>
                </a>
                <a href="#/trainer/lab-review" class="mobile-nav-link mobile-nav-sublink" data-close-drawer aria-label="View labs evaluations">
                    <span class="nav-icon" aria-hidden="true">📝</span>
                    <span>Labs Evaluations</span>
                </a>
                <a href="#/trainer/course-allocation" class="mobile-nav-link mobile-nav-sublink" data-close-drawer aria-label="Manage course allocation">
                    <span class="nav-icon" aria-hidden="true">📋</span>
                    <span>Course Allocation</span>
                </a>
                <a href="#/trainer/ai-coach-personalization" class="mobile-nav-link mobile-nav-sublink" data-close-drawer aria-label="Setup AI Coach persona">
                    <span class="nav-icon" aria-hidden="true">🤖</span>
                    <span>AI Coach Setup</span>
                </a>
                <a href="#/trainer/ai-escalations" class="mobile-nav-link mobile-nav-sublink" data-close-drawer aria-label="View AI Coach escalations">
                    <span class="nav-icon" aria-hidden="true">🚨</span>
                    <span>AI Escalations</span>
                </a>
                <a href="#/reports/trainer" class="mobile-nav-link" data-close-drawer aria-label="View learner performance reports">
                    <span class="nav-icon" aria-hidden="true">📊</span>
                    <span>Reports</span>
                </a>
                <a href="#/help" class="mobile-nav-link" data-close-drawer aria-label="Open help and support center">
                    <span class="nav-icon" aria-hidden="true">❓</span>
                    <span>Help & Support</span>
                </a>
            `;
        }
        
        if (role === 'learner') {
            return `
                <a href="#/dashboard" class="mobile-nav-link" data-close-drawer aria-label="Go to my dashboard">
                    <span class="nav-icon" aria-hidden="true">🏠</span>
                    <span>Dashboard</span>
                </a>
                <a href="#/courses/my-courses" class="mobile-nav-link" data-close-drawer aria-label="View courses allocated to me">
                    <span class="nav-icon" aria-hidden="true">📚</span>
                    <span>Courses</span>
                </a>
                <a href="#/learner/lab-submissions" class="mobile-nav-link" data-close-drawer aria-label="View labs submitted by me for evaluation">
                    <span class="nav-icon" aria-hidden="true">📝</span>
                    <span>Labs</span>
                </a>
                <a href="#/reports/learner" class="mobile-nav-link" data-close-drawer aria-label="View performance reports">
                    <span class="nav-icon" aria-hidden="true">📊</span>
                    <span>Reports</span>
                </a>
                <a href="#/certifications" class="mobile-nav-link nav-link-disabled" data-close-drawer aria-label="Certifications (under implementation)" title="Certifications - Coming Soon">
                    <span class="nav-icon" aria-hidden="true">🎓</span>
                    <span>Certifications <span class="coming-soon-badge">Soon</span></span>
                </a>
                <a href="#/help" class="mobile-nav-link" data-close-drawer aria-label="Open help and support center">
                    <span class="nav-icon" aria-hidden="true">❓</span>
                    <span>Help & Support</span>
                </a>
            `;
        }
        
        return '';
    }

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
        const drawer = document.getElementById('mobile-drawer');
        const toggle = document.getElementById('mobile-menu-toggle');
        
        if (drawer) {
            if (this.mobileMenuOpen) {
                drawer.classList.add('open');
                document.body.style.overflow = 'hidden';
            } else {
                drawer.classList.remove('open');
                document.body.style.overflow = '';
            }
        }
        
        if (toggle) {
            toggle.setAttribute('aria-expanded', this.mobileMenuOpen.toString());
        }

        // Update drawer aria-hidden
        if (drawer) {
            drawer.setAttribute('aria-hidden', (!this.mobileMenuOpen).toString());
        }
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        this.mobileMenuOpen = false;
        const drawer = document.getElementById('mobile-drawer');
        const toggle = document.getElementById('mobile-menu-toggle');
        
        if (drawer) {
            drawer.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
        }
        
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            // Return focus to toggle button
            toggle.focus();
        }
        
        document.body.style.overflow = '';
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Mobile menu toggle
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }

        // Mobile drawer close
        const drawerClose = document.getElementById('mobile-drawer-close');
        if (drawerClose) {
            drawerClose.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        }

        // Mobile drawer backdrop
        const drawerBackdrop = document.getElementById('mobile-drawer-backdrop');
        if (drawerBackdrop) {
            drawerBackdrop.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        }

        // Close drawer on navigation link click
        const mobileNavLinks = this.container.querySelectorAll('.mobile-nav-link[data-close-drawer]');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        });

        // Prevent navigation on disabled links
        const disabledLinks = this.container.querySelectorAll('.nav-link-disabled, .mobile-nav-link.nav-link-disabled');
        disabledLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
        });

        // Mobile logout
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', async () => {
                this.closeMobileMenu();
                try {
                    const { authService } = await import('../services/auth-service.js');
                    await authService.logout();
                    this.currentUser = null;
                    this.render();
                    router.navigate('/login');
                } catch (error) {
                    console.error('Logout failed:', error);
                }
            });
        }
        // Search trigger
        const searchBtn = document.getElementById('search-trigger-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                globalSearch.open();
            });
        }
        const logoutBtn = this.container.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    const { authService } = await import('../services/auth-service.js');
                    await authService.logout();
                    // Clear current user and re-render header
                    this.currentUser = null;
                    this.render();
                    // Navigate to login
                    router.navigate('/login');
                } catch (error) {
                    console.error('Logout failed:', error);
                }
            });
        }

        const logoLink = this.container.querySelector('#header-logo');
        if (logoLink) {
            logoLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Navigate to appropriate dashboard based on role
                if (this.currentUser) {
                    const role = this.currentUser.role;
                    if (role === 'admin') {
                        router.navigate('/admin/dashboard');
                    } else if (role === 'trainer') {
                        router.navigate('/trainer/dashboard');
                    } else {
                        router.navigate('/dashboard');
                    }
                } else {
                    router.navigate('/courses');
                }
            });
        }

        // Admin dropdown (for admin role)
        const adminNavDropdownToggle = this.container.querySelector('#admin-nav-dropdown-toggle');
        const adminNavDropdownMenu = this.container.querySelector('#admin-nav-dropdown-menu');
        if (adminNavDropdownToggle && adminNavDropdownMenu) {
            adminNavDropdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isExpanded = adminNavDropdownToggle.getAttribute('aria-expanded') === 'true';
                adminNavDropdownToggle.setAttribute('aria-expanded', (!isExpanded).toString());
                adminNavDropdownMenu.classList.toggle('open');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!adminNavDropdownToggle.contains(e.target) && !adminNavDropdownMenu.contains(e.target)) {
                    adminNavDropdownToggle.setAttribute('aria-expanded', 'false');
                    adminNavDropdownMenu.classList.remove('open');
                }
            });

            // Close dropdown when clicking on a dropdown item
            const dropdownItems = adminNavDropdownMenu.querySelectorAll('.nav-dropdown-item');
            dropdownItems.forEach(item => {
                item.addEventListener('click', () => {
                    adminNavDropdownToggle.setAttribute('aria-expanded', 'false');
                    adminNavDropdownMenu.classList.remove('open');
                });
            });
        }

        // Trainer dropdown (for trainer role - uses same ID as before)
        const adminDropdownToggle = this.container.querySelector('#admin-dropdown-toggle');
        const adminDropdownMenu = this.container.querySelector('#admin-dropdown-menu');
        if (adminDropdownToggle && adminDropdownMenu) {
            adminDropdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isExpanded = adminDropdownToggle.getAttribute('aria-expanded') === 'true';
                adminDropdownToggle.setAttribute('aria-expanded', (!isExpanded).toString());
                adminDropdownMenu.classList.toggle('open');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!adminDropdownToggle.contains(e.target) && !adminDropdownMenu.contains(e.target)) {
                    adminDropdownToggle.setAttribute('aria-expanded', 'false');
                    adminDropdownMenu.classList.remove('open');
                }
            });

            // Close dropdown when clicking on a dropdown item
            const dropdownItems = adminDropdownMenu.querySelectorAll('.nav-dropdown-item');
            dropdownItems.forEach(item => {
                item.addEventListener('click', () => {
                    adminDropdownToggle.setAttribute('aria-expanded', 'false');
                    adminDropdownMenu.classList.remove('open');
                });
            });
        }
    }
}

export default Header;

