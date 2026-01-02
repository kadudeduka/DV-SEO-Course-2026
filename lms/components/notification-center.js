/**
 * Notification Center Component
 * 
 * Displays a list of notifications with read/unread status.
 */

import { notificationService } from '../services/notification-service.js';
import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';

class NotificationCenter {
    constructor(container) {
        console.log('[NotificationCenter] Constructor called with container:', container);
        this.container = container;
        this.notifications = [];
        this.currentUser = null;
        console.log('[NotificationCenter] Instance created');
    }

    /**
     * Show notification center
     */
    async show() {
        console.log('[NotificationCenter] show() called, container:', this.container);
        
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
        }
        
        this.renderLoading();
        
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || !this.currentUser.id) {
                console.warn('[NotificationCenter] No current user found');
                this.renderError('Please log in to view notifications');
                return;
            }

            console.log('[NotificationCenter] Loading notifications for user:', this.currentUser.id);
            await this.loadNotifications();
            console.log('[NotificationCenter] Loaded notifications:', this.notifications.length);
            console.log('[NotificationCenter] Notifications data:', this.notifications);
            
            // Debug: Check which notifications have action_url
            const withActionUrl = this.notifications.filter(n => {
                const url = n.action_url || n.actionUrl || (n.metadata && n.metadata.action_url);
                return url && String(url).trim() !== '';
            });
            console.log('[NotificationCenter] Notifications with action_url:', withActionUrl.length);
            withActionUrl.forEach(n => {
                console.log('[NotificationCenter] - Notification:', n.title, 'action_url:', n.action_url || n.actionUrl || (n.metadata && n.metadata.action_url));
            });
            
            this.render();
        } catch (error) {
            console.error('[NotificationCenter] Error in show():', error);
            this.renderError('Failed to load notifications: ' + error.message);
        }
    }

    /**
     * Load notifications
     */
    async loadNotifications() {
        try {
            this.notifications = await notificationService.getUserNotifications(this.currentUser.id);
            // Sort notifications by created_at date (newest first)
            this.notifications.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA; // Descending order (newest first)
            });
        } catch (error) {
            console.error('Failed to load notifications:', error);
            this.notifications = [];
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        console.log('[NotificationCenter] renderLoading() called');
        if (!this.container) {
            console.error('[NotificationCenter] Container is null in renderLoading()');
            return;
        }
        this.container.innerHTML = `
            <div class="notification-center">
                <h2 class="page-title">Notifications</h2>
                <div class="loading-state">
                    <div class="loading-state-text">Loading notifications...</div>
                </div>
            </div>
        `;
        console.log('[NotificationCenter] Loading state rendered');
    }

    /**
     * Render notification center
     */
    render() {
        console.log(`[NotificationCenter] render() called with ${this.notifications.length} notifications`);
        console.log(`[NotificationCenter] Container exists:`, !!this.container);
        
        if (!this.container) {
            console.error('[NotificationCenter] Container is null!');
            return;
        }
        
        const unreadCount = this.notifications.filter(n => !n.read).length;
        console.log(`[NotificationCenter] Unread count: ${unreadCount}`);

        // Ensure container is visible
        this.container.style.display = 'block';
        this.container.style.visibility = 'visible';
        this.container.style.opacity = '1';
        this.container.style.minHeight = '200px';

        const notificationsListHtml = this.renderNotificationsList();
        console.log(`[NotificationCenter] Notifications list HTML length: ${notificationsListHtml.length}`);

        const htmlContent = `
            <div class="notification-center-page">
                <div class="notification-center-container">
                    <div class="notification-center-header">
                        <div>
                            <h1 class="notification-center-title">Notifications</h1>
                            <p class="notification-center-subtitle">Stay updated with your activity</p>
                        </div>
                        ${unreadCount > 0 ? `
                            <button id="mark-all-read-btn" class="btn btn-primary btn-sm">
                                <span class="btn-icon">✓</span>
                                <span>Mark All as Read</span>
                            </button>
                        ` : ''}
                    </div>
                    <div id="notification-error" class="error-message" style="display: none;"></div>
                    <div id="notifications-list" class="notifications-list-container">
                        ${notificationsListHtml}
                    </div>
                </div>
            </div>
        `;
        
        console.log('[NotificationCenter] Setting innerHTML, length:', htmlContent.length);
        this.container.innerHTML = htmlContent;
        console.log('[NotificationCenter] innerHTML set, container.innerHTML length:', this.container.innerHTML.length);
        
        // Force container to be visible
        const computedStyle = window.getComputedStyle(this.container);
        console.log('[NotificationCenter] Container computed styles:', {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            height: computedStyle.height,
            width: computedStyle.width
        });
        
        // Double-check visibility
        this.container.style.display = 'block';
        this.container.style.visibility = 'visible';
        this.container.style.opacity = '1';
        this.container.style.minHeight = '200px';
        this.container.style.width = '100%';
        
        console.log('[NotificationCenter] Container visible after force:', this.container.offsetParent !== null);
        console.log('[NotificationCenter] Container has content:', this.container.innerHTML.length > 0);
        
        this.attachEventListeners();
        console.log('[NotificationCenter] Render complete');
    }

    /**
     * Render notifications list
     */
    renderNotificationsList() {
        console.log(`[NotificationCenter] renderNotificationsList() called with ${this.notifications.length} notifications`);
        
        if (!this.notifications || this.notifications.length === 0) {
            console.log('[NotificationCenter] No notifications to render');
            return `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <div class="empty-text">No Notifications</div>
                    <p class="empty-description">You're all caught up! Notifications will appear here when users register, submit labs, or when courses are assigned.</p>
                </div>
            `;
        }

        // Group notifications by category
        const grouped = this.groupNotificationsByCategory();

        console.log('[NotificationCenter] Mapping notifications to HTML');
        let html = '';

        // Define category display order (course first, then others)
        const categoryOrder = ['course', 'lab', 'approval', 'system', 'other'];
        const orderedCategories = categoryOrder.filter(cat => grouped[cat] && grouped[cat].length > 0);

        // Render each category in the specified order
        orderedCategories.forEach(category => {
            const categoryNotifications = grouped[category];
            const categoryConfig = this.getCategoryConfig(category);

            html += `
                <div class="notification-category">
                    <div class="category-header">
                        <div class="category-icon">${categoryConfig.icon}</div>
                        <div class="category-title">${categoryConfig.label}</div>
                        <div class="category-count">${categoryNotifications.length}</div>
                    </div>
                    <div class="category-notifications">
                        ${categoryNotifications.map((notification, index) => {
                            return this.renderNotificationCard(notification);
                        }).join('')}
                    </div>
                </div>
            `;
        });

        return html;
    }

    /**
     * Group notifications by category/type
     */
    groupNotificationsByCategory() {
        const grouped = {
            'lab': [],
            'approval': [],
            'course': [],
            'system': [],
            'other': []
        };

        this.notifications.forEach(notification => {
            const type = (notification.type || 'other').toLowerCase();
            // Check course/allocation FIRST before approval, to avoid mis-categorizing course assignments
            if (type.includes('course') || type.includes('allocation') || type.includes('assignment')) {
                grouped.course.push(notification);
            } else if (type.includes('lab') || type.includes('submission')) {
                grouped.lab.push(notification);
            } else if (type.includes('approval') || type.includes('approved') || type.includes('rejected')) {
                // Only categorize as approval if it's NOT a course-related notification
                // Check if it's actually about account approval, not course assignment
                if (!type.includes('course') && !type.includes('allocation') && !type.includes('assignment')) {
                    grouped.approval.push(notification);
                } else {
                    // If it has approval but also course/allocation, it's a course notification
                    grouped.course.push(notification);
                }
            } else if (type.includes('system') || type.includes('admin')) {
                grouped.system.push(notification);
            } else {
                grouped.other.push(notification);
            }
        });

        // Sort notifications within each category by created_at (newest first)
        Object.keys(grouped).forEach(key => {
            grouped[key].sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA; // Descending order (newest first)
            });
        });

        // Remove empty categories
        Object.keys(grouped).forEach(key => {
            if (grouped[key].length === 0) {
                delete grouped[key];
            }
        });

        return grouped;
    }

    /**
     * Get category configuration
     */
    getCategoryConfig(category) {
        const configs = {
            'lab': {
                label: 'Lab Submissions',
                icon: '📝',
                color: 'var(--color-info)'
            },
            'approval': {
                label: 'Approvals',
                icon: '✓',
                color: 'var(--color-success)'
            },
            'course': {
                label: 'Courses',
                icon: '📚',
                color: 'var(--color-brand-primary)'
            },
            'system': {
                label: 'System',
                icon: '⚙️',
                color: 'var(--color-text-secondary)'
            },
            'other': {
                label: 'Other',
                icon: '🔔',
                color: 'var(--color-text-secondary)'
            }
        };
        return configs[category] || configs['other'];
    }

    /**
     * Render individual notification card
     */
    renderNotificationCard(notification) {
        const isUnread = !notification.read;
        const date = notification.created_at ? new Date(notification.created_at) : null;
        
        // Check multiple possible field names for action URL
        const actionUrl = (notification.action_url || 
                          notification.actionUrl || 
                          (notification.metadata && notification.metadata.action_url) ||
                          '').toString().trim();
        const hasActionUrl = actionUrl !== '';
        const typeConfig = this.getCategoryConfig(this.getNotificationCategory(notification.type));
        
        // Debug logging
        if (hasActionUrl) {
            console.log('[NotificationCenter] Notification has action URL:', {
                id: notification.id,
                title: notification.title,
                action_url: actionUrl
            });
        } else {
            console.log('[NotificationCenter] Notification has NO action URL:', {
                id: notification.id,
                title: notification.title,
                action_url: notification.action_url,
                actionUrl: notification.actionUrl,
                metadata: notification.metadata
            });
        }

        return `
            <div class="notification-card ${isUnread ? 'unread' : ''} ${hasActionUrl ? 'has-action' : ''}" 
                 data-notification-id="${notification.id}">
                <div class="notification-card-content">
                    <div class="notification-icon ${this.getNotificationTypeClass(notification.type)}">
                        ${typeConfig.icon}
                    </div>
                    <div class="notification-body">
                        <div class="notification-header">
                            <div class="notification-title ${isUnread ? 'unread' : ''}">${this.escapeHtml(notification.title || 'Notification')}</div>
                            ${isUnread ? `
                                <div class="notification-unread-dot"></div>
                            ` : ''}
                        </div>
                        <div class="notification-message">${this.escapeHtml(notification.message || '')}</div>
                        <div class="notification-meta">
                            <span class="notification-date">${date ? this.formatRelativeTime(date) : 'Recently'}</span>
                        </div>
                        ${hasActionUrl ? `
                            <div class="notification-actions">
                                <a href="${actionUrl.startsWith('#') ? actionUrl : '#' + actionUrl}" 
                                   class="notification-know-more-link"
                                   data-notification-id="${notification.id}"
                                   data-action-url="${this.escapeHtml(actionUrl)}">
                                    <span class="know-more-text">Know more</span>
                                    <span class="know-more-icon">→</span>
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get notification category from type
     */
    getNotificationCategory(type) {
        if (!type) return 'other';
        const typeLower = type.toLowerCase();
        // Check course/allocation FIRST before approval, to avoid mis-categorizing course assignments
        if (typeLower.includes('course') || typeLower.includes('allocation') || typeLower.includes('assignment')) {
            return 'course';
        }
        if (typeLower.includes('lab') || typeLower.includes('submission')) {
            return 'lab';
        }
        if (typeLower.includes('approval') || typeLower.includes('approved') || typeLower.includes('rejected')) {
            // Only categorize as approval if it's NOT a course-related notification
            if (!typeLower.includes('course') && !typeLower.includes('allocation') && !typeLower.includes('assignment')) {
                return 'approval';
            } else {
                // If it has approval but also course/allocation, it's a course notification
                return 'course';
            }
        }
        if (typeLower.includes('system') || typeLower.includes('admin')) {
            return 'system';
        }
        return 'other';
    }

    /**
     * Get notification type class
     */
    getNotificationTypeClass(type) {
        const category = this.getNotificationCategory(type);
        return `type-${category}`;
    }

    /**
     * Format relative time
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
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
     * Attach event listeners
     */
    attachEventListeners() {
        // Attach click handlers to "Know more" links
        const knowMoreLinks = this.container.querySelectorAll('.notification-know-more-link');
        console.log('[NotificationCenter] Found know more links:', knowMoreLinks.length);
        knowMoreLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const notificationId = link.getAttribute('data-notification-id');
                const actionUrl = link.getAttribute('data-action-url');
                console.log('[NotificationCenter] Know more link clicked, notification ID:', notificationId, 'action URL:', actionUrl);
                
                if (notificationId) {
                    // Mark as read first
                    await this.handleNotificationClick(notificationId);
                    // Navigation will happen in handleNotificationClick if action_url exists
                }
            });
        });

        // Attach click handlers to notification cards (for marking as read when clicking elsewhere)
        const notificationCards = this.container.querySelectorAll('.notification-card');
        console.log('[NotificationCenter] Found notification cards:', notificationCards.length);
        notificationCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on a link or button inside the card
                if (e.target.closest('a, button')) {
                    return;
                }
                const notificationId = card.getAttribute('data-notification-id');
                console.log('[NotificationCenter] Card clicked, notification ID:', notificationId);
                if (notificationId) {
                    // Just mark as read, don't navigate (navigation is handled by "Know more" link)
                    this.handleNotificationClick(notificationId, false);
                }
            });
        });

        // Mark all as read button
        const markAllReadBtn = this.container.querySelector('#mark-all-read-btn');
        if (markAllReadBtn) {
            console.log('[NotificationCenter] Mark all read button found');
            markAllReadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                console.log('[NotificationCenter] Mark all read button clicked');
                await this.handleMarkAllRead();
            });
        } else {
            console.warn('[NotificationCenter] Mark all read button not found');
        }
    }

    /**
     * Handle notification click
     */
    async handleNotificationClick(notificationId, shouldNavigate = true) {
        console.log('[NotificationCenter] handleNotificationClick called for ID:', notificationId, 'shouldNavigate:', shouldNavigate);
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) {
            console.warn('[NotificationCenter] Notification not found:', notificationId);
            return;
        }

        console.log('[NotificationCenter] Notification found:', { id: notification.id, read: notification.read, action_url: notification.action_url });

        // Mark as read if unread
        if (!notification.read) {
            try {
                console.log('[NotificationCenter] Marking notification as read...');
                const updatedNotification = await notificationService.markAsRead(notificationId);
                if (updatedNotification) {
                    notification.read = true;
                    console.log('[NotificationCenter] Notification marked as read');
                } else {
                    console.warn('[NotificationCenter] Failed to mark as read, reloading notifications');
                    await this.loadNotifications();
                    this.render();
                    // Still navigate if there's an action URL and shouldNavigate is true
                    if (shouldNavigate && notification.action_url) {
                        const actionUrl = notification.action_url.trim();
                        const url = actionUrl.startsWith('#') ? actionUrl : `#${actionUrl}`;
                        router.navigate(url);
                    }
                    return;
                }
            } catch (error) {
                console.error('[NotificationCenter] Failed to mark notification as read:', error);
                // Still try to navigate even if marking as read failed
                if (shouldNavigate && notification.action_url) {
                    const actionUrl = notification.action_url.trim();
                    // Remove any leading # or /# to avoid double hashes
                    let cleanUrl = actionUrl.replace(/^#+\/?/, '');
                    // Ensure it starts with /
                    if (!cleanUrl.startsWith('/')) {
                        cleanUrl = '/' + cleanUrl;
                    }
                    console.log(`[NotificationCenter] Cleaned URL for navigation (error case): ${cleanUrl}`);
                    router.navigate(cleanUrl);
                }
                await this.loadNotifications();
                this.render();
                return;
            }
        }

        // Navigate to action URL if present and shouldNavigate is true
        if (shouldNavigate && notification.action_url && notification.action_url.trim() !== '') {
            const actionUrl = notification.action_url.trim();
            console.log(`[NotificationCenter] Navigating to action URL: ${actionUrl}`);
            
            // Ensure URL starts with / for hash routing (router.navigate will add #)
            // Remove any leading # or /# to avoid double hashes
            let cleanUrl = actionUrl.replace(/^#+\/?/, '');
            // Ensure it starts with /
            if (!cleanUrl.startsWith('/')) {
                cleanUrl = '/' + cleanUrl;
            }
            console.log(`[NotificationCenter] Cleaned URL for navigation: ${cleanUrl}`);
            router.navigate(cleanUrl);
            
            // Dispatch event for notification badge update
            const event = new CustomEvent('notification-read', { detail: { notificationId } });
            window.dispatchEvent(event);
        } else {
            console.log('[NotificationCenter] No navigation needed, just refreshing');
            // No action URL or navigation not needed, just refresh to show updated read status
            await this.loadNotifications();
            this.render();
            const event = new CustomEvent('notification-read', { detail: { notificationId } });
            window.dispatchEvent(event);
        }
    }

    /**
     * Handle mark all as read
     */
    async handleMarkAllRead() {
        const button = this.container.querySelector('#mark-all-read-btn');
        if (button) {
            button.disabled = true;
            button.textContent = 'Marking...';
        }

        try {
            const updatedNotifications = await notificationService.markAllAsRead(this.currentUser.id);
            if (updatedNotifications && updatedNotifications.length > 0) {
                await this.loadNotifications();
                this.render();
                
                const event = new CustomEvent('notifications-all-read');
                window.dispatchEvent(event);
            } else {
                await this.loadNotifications();
                this.render();
            }
        } catch (error) {
            this.showError('Failed to mark all notifications as read: ' + error.message);
            await this.loadNotifications();
            this.render();
            if (button) {
                button.disabled = false;
                button.textContent = 'Mark All as Read';
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = this.container.querySelector('#notification-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.cssText += 'padding: 10px; margin: 10px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;';
        }
    }

    /**
     * Render error state
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="notification-center" style="padding: 20px; max-width: 800px; margin: 0 auto;">
                <h2>Notifications</h2>
                <div class="error-message" style="padding: 15px; margin: 20px 0; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; border-radius: 3px;">
                    ${message}
                </div>
            </div>
        `;
    }
}

export default NotificationCenter;

