/**
 * Notification Badge Component
 * 
 * Displays a bell icon with unread notification count.
 */

import { notificationService } from '../services/notification-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';

class NotificationBadge {
    constructor(container) {
        this.container = container;
        this.unreadCount = 0;
        this.currentUser = null;
    }

    /**
     * Initialize and render the badge
     */
    async init() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                this.container.innerHTML = '';
                return;
            }

            await this.loadUnreadCount();
            this.render();
            this.attachEventListeners();
        } catch (error) {
            console.warn('Failed to initialize notification badge:', error);
            this.container.innerHTML = '';
        }
    }

    /**
     * Load unread notification count
     */
    async loadUnreadCount() {
        try {
            const notifications = await notificationService.getUserNotifications(this.currentUser.id);
            this.unreadCount = notifications.filter(n => !n.read).length;
        } catch (error) {
            console.warn('Failed to load unread count:', error);
            this.unreadCount = 0;
        }
    }

    /**
     * Render the badge
     */
    render() {
        const unreadText = this.unreadCount > 0 
            ? `${this.unreadCount} unread notification${this.unreadCount === 1 ? '' : 's'}`
            : 'No unread notifications';
        
        this.container.innerHTML = `
            <button 
                class="notification-badge-btn" 
                aria-label="${unreadText}"
                aria-describedby="notification-badge-description"
            >
                <div class="notification-badge-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </div>
                ${this.unreadCount > 0 ? `
                    <span 
                        class="notification-badge-count ${this.unreadCount > 9 ? 'notification-badge-count-large' : ''}"
                        aria-label="${this.unreadCount} unread"
                    >
                        ${this.unreadCount > 99 ? '99+' : this.unreadCount}
                    </span>
                ` : ''}
                <span id="notification-badge-description" class="sr-only">${unreadText}</span>
            </button>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const badge = this.container.querySelector('.notification-badge-btn');
        if (badge) {
            badge.addEventListener('click', () => {
                console.log('[NotificationBadge] Badge clicked, navigating to /notifications');
                router.navigate('/notifications');
            });
        } else {
            console.warn('[NotificationBadge] Badge button not found in container');
        }
    }

    /**
     * Refresh the badge (update unread count)
     */
    async refresh() {
        await this.loadUnreadCount();
        this.render();
        this.attachEventListeners();
    }
}

export default NotificationBadge;

