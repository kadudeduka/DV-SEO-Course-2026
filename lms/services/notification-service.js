/**
 * Notification Service
 * 
 * Handles in-app notifications for users.
 * 
 * This service provides methods to create, retrieve, and manage notifications
 * stored in the public.notifications table in Supabase.
 * 
 * CONTRACT:
 * 
 * Database Table: public.notifications
 * 
 * Table Structure:
 * - id: UUID (Primary Key) - Unique identifier for the notification
 * - user_id: UUID (Foreign Key → public.users.id) - The user who receives this notification
 * - type: TEXT - Notification type (see NOTIFICATION_TYPES below)
 * - title: TEXT - Notification title/heading
 * - message: TEXT - Notification message content
 * - read: BOOLEAN - Whether the notification has been read (default: false)
 * - created_at: TIMESTAMPTZ - When the notification was created
 * - metadata: JSONB - Additional data as JSON object (optional, can be null)
 * 
 * NOTIFICATION TYPES:
 * 
 * The following notification types are supported:
 * 
 * 1. 'user_registered'
 *    - Triggered when a new user registers
 *    - Sent to the newly registered user
 *    - Metadata may include: { registration_date, email }
 * 
 * 2. 'user_approved'
 *    - Triggered when an admin approves a pending user
 *    - Sent to the approved user
 *    - Metadata may include: { approved_by, approved_at, trainer_id }
 * 
 * 3. 'lab_submitted'
 *    - Triggered when a learner submits a lab
 *    - Sent to the assigned trainer of the learner
 *    - Metadata may include: { course_id, lab_id, submission_id, learner_id }
 * 
 * 4. 'lab_reviewed'
 *    - Triggered when a trainer reviews a lab submission
 *    - Sent to the learner who submitted the lab
 *    - Metadata may include: { course_id, lab_id, submission_id, status, feedback }
 * 
 * RULES:
 * 
 * 1. User-Specific Notifications:
 *    - All notifications are tied to a specific user via user_id
 *    - Users can only see their own notifications (enforced by RLS)
 *    - Notifications are created for individual users, not groups
 * 
 * 2. Read Status:
 *    - Default value for 'read' is false when creating a notification
 *    - Once a user views a notification, it should be marked as read (read = true)
 *    - Read status can be updated but should not be set to false after being true
 * 
 * 3. Metadata Field:
 *    - Optional JSONB field for storing additional context
 *    - Can be null or an empty object {}
 *    - Should contain structured data relevant to the notification type
 *    - Examples:
 *      * For lab_submitted: { course_id: "seo-master-2026", lab_id: "lab-1", submission_id: "uuid" }
 *      * For user_approved: { approved_by: "admin-uuid", approved_at: "2025-01-29T10:00:00Z" }
 * 
 * 4. Notification Lifecycle:
 *    - Created with read = false
 *    - Displayed to user in notification center
 *    - User marks as read (read = true)
 *    - Can be filtered by read status, type, or date
 * 
 * SERVICE METHODS (to be implemented):
 * 
 * 1. getNotifications(userId, filters = {})
 *    - Retrieves notifications for a specific user
 *    - Filters: { read: boolean, type: string, limit: number }
 *    - Returns: Array of notification objects
 *    - Order: Most recent first (created_at DESC)
 * 
 * 2. getUnreadCount(userId)
 *    - Returns count of unread notifications for a user
 *    - Returns: number (count of notifications where read = false)
 * 
 * 3. markAsRead(notificationId, userId)
 *    - Marks a specific notification as read
 *    - Validates that notification belongs to the user
 *    - Updates read = true
 *    - Returns: Updated notification object
 * 
 * 4. markAllAsRead(userId)
 *    - Marks all unread notifications for a user as read
 *    - Updates all notifications where user_id = userId AND read = false
 *    - Returns: Array of updated notification objects
 * 
 * 5. createNotification(notificationData)
 *    - Creates a new notification
 *    - Required fields: user_id, type, title, message
 *    - Optional fields: metadata
 *    - Default: read = false
 *    - Returns: Created notification object
 * 
 * ERROR HANDLING:
 * 
 * - All methods should validate user_id exists in public.users
 * - markAsRead should verify notification belongs to the user
 * - createNotification should validate notification type is one of the supported types
 * - All database errors should be caught and re-thrown with descriptive messages
 * 
 * RLS POLICIES (assumed):
 * 
 * - Users can only SELECT their own notifications (user_id = auth.uid())
 * - Users can only UPDATE their own notifications (user_id = auth.uid())
 * - Only system services can INSERT notifications (may require service role)
 * 
 * USAGE EXAMPLES (conceptual):
 * 
 * // Get all unread notifications
 * const unread = await notificationService.getNotifications(userId, { read: false });
 * 
 * // Get notification count
 * const count = await notificationService.getUnreadCount(userId);
 * 
 * // Mark notification as read
 * await notificationService.markAsRead(notificationId, userId);
 * 
 * // Create lab submission notification for trainer
 * await notificationService.createNotification({
 *   user_id: trainerId,
 *   type: 'lab_submitted',
 *   title: 'New Lab Submission',
 *   message: 'John Doe submitted Lab 1 for SEO Master Course',
 *   metadata: {
 *     course_id: 'seo-master-2026',
 *     lab_id: 'lab-1',
 *     submission_id: 'submission-uuid',
 *     learner_id: 'learner-uuid'
 *   }
 * });
 */

import { supabaseClient } from './supabase-client.js';
import { authService } from './auth-service.js';

class NotificationService {
    constructor(client) {
        this.client = client;
    }

    /**
     * Create a new notification
     * @param {string} userId - User ID to receive the notification
     * @param {string} type - Notification type (user_registered, user_approved, lab_submitted, lab_reviewed)
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {object} metadata - Optional metadata object (default: {})
     * @returns {Promise<object|null>} Created notification or null on error
     */
    async createNotification(userId, type, title, message, metadata = {}, actionUrl = null) {
        console.log(`[NotificationService] createNotification called:`, { userId, type, title, actionUrl });
        
        if (!userId || !type || !title || !message) {
            console.error('[NotificationService] Missing required parameters:', { userId: !!userId, type: !!type, title: !!title, message: !!message });
            return null;
        }

        try {
            console.log('[NotificationService] Creating notification via database function...');
            
            // Try using the database function first (bypasses RLS)
            const { data: functionData, error: functionError } = await this.client
                .rpc('create_notification', {
                    p_user_id: userId,
                    p_type: type,
                    p_title: title,
                    p_message: message,
                    p_metadata: metadata || {},
                    p_action_url: actionUrl || null
                });

            if (functionError) {
                console.warn('[NotificationService] Function call error:', {
                    message: functionError.message,
                    code: functionError.code,
                    details: functionError.details,
                    hint: functionError.hint
                });
                
                // If function doesn't exist (code P0001 or 42883), provide helpful message
                if (functionError.code === '42883' || functionError.message.includes('does not exist')) {
                    console.error('[NotificationService] ⚠️ Database function "create_notification" does not exist!');
                    console.error('[NotificationService] ⚠️ Please run: backend/fix-notification-insert-via-function.sql in Supabase SQL Editor');
                }
            }

            if (!functionError && functionData) {
                console.log('[NotificationService] ✅ Notification created via function, ID:', functionData);
                
                // Try to fetch the created notification to return full data
                // Note: This might fail due to RLS if the current user doesn't have permission
                // to read notifications for other users (e.g., learner creating notification for admin)
                const { data: notificationData, error: fetchError } = await this.client
                    .from('notifications')
                    .select('*')
                    .eq('id', functionData)
                    .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully
                
                if (!fetchError && notificationData) {
                    console.log('[NotificationService] ✅ Notification retrieved:', notificationData);
                    return notificationData;
                } else {
                    // If fetch fails (likely due to RLS), return a minimal object
                    // The notification was created successfully, we just can't read it back
                    if (fetchError) {
                        console.log('[NotificationService] Could not fetch notification after creation (RLS may block cross-user reads):', fetchError.message);
                    } else {
                        console.log('[NotificationService] Notification created but not found (may be RLS filtered)');
                    }
                    // Return a minimal object with the data we have
                    // The notification exists in the database, even if we can't read it back
                    return { 
                        id: functionData, 
                        user_id: userId, 
                        type, 
                        title, 
                        message, 
                        metadata: metadata || {}, 
                        action_url: actionUrl || null,
                        read: false,
                        created_at: new Date().toISOString()
                    };
                }
            }

            // Fallback to direct insert if function doesn't exist or fails
            if (functionError) {
                console.warn('[NotificationService] Function call failed, trying direct insert:', functionError.message);
                
                const { data, error } = await this.client
                    .from('notifications')
                    .insert([{
                        user_id: userId,
                        type: type,
                        title: title,
                        message: message,
                        metadata: metadata || {},
                        read: false
                    }])
                    .select()
                    .single();

                if (error) {
                    console.error('[NotificationService] Failed to create notification:', error.message);
                    console.error('[NotificationService] Error details:', {
                        code: error.code,
                        details: error.details,
                        hint: error.hint,
                        message: error.message
                    });
                    
                    // Check if it's a constraint violation (notification type not in allowed list)
                    if (error.code === '23514' || error.message.includes('check constraint')) {
                        console.error('[NotificationService] ⚠️ Notification type might not be in database constraint. Run migration 004_add_missing_notification_types.sql');
                    }
                    
                    // Check if it's an RLS violation
                    if (error.code === '42501' || error.message.includes('row-level security')) {
                        console.error('[NotificationService] ⚠️ RLS policy violation. Run fix-notification-insert-via-function.sql to create the database function.');
                    }
                    
                    return null;
                }

                // Direct insert succeeded
                console.log('[NotificationService] ✅ Notification created via direct insert:', data.id);
                return data;
            }

            // If we get here, neither function nor direct insert worked
            console.error('[NotificationService] ⚠️ Both function and direct insert failed');
            return null;
        } catch (error) {
            console.error('[NotificationService] Unexpected error:', error);
            return null;
        }
    }

    /**
     * Get all notifications for a user
     * Returns only notifications addressed to the specified user (user_id = userId)
     * Admins only see notifications meant for them (e.g., user_registered notifications)
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of notification objects, ordered by created_at DESC
     */
    async getUserNotifications(userId) {
        if (!userId) {
            console.error('NotificationService.getUserNotifications: User ID is required');
            return [];
        }

        try {
            // Check if user is admin (for logging purposes)
            const currentUser = await authService.getCurrentUser();
            const isAdmin = currentUser && currentUser.role === 'admin';

            console.log(`NotificationService.getUserNotifications: Fetching notifications for user ${userId}, isAdmin: ${isAdmin}`);

            // Always filter by user_id - users (including admins) should only see notifications addressed to them
            // Admins receive notifications like 'user_registered' which are created with user_id = admin.id
            const { data, error } = await this.client
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            console.log(`NotificationService.getUserNotifications: Filtering by user_id: ${userId}`);

            if (error) {
                console.error('NotificationService.getUserNotifications: Failed to get notifications:', error.message);
                console.error('NotificationService.getUserNotifications: Error details:', error);
                console.error('NotificationService.getUserNotifications: Error code:', error.code);
                console.error('NotificationService.getUserNotifications: Error hint:', error.hint);
                return [];
            }

            console.log(`NotificationService.getUserNotifications: Retrieved ${data?.length || 0} notifications for user ${userId} (admin: ${isAdmin})`);
            if (data && data.length > 0) {
                console.log('NotificationService.getUserNotifications: Sample notification:', data[0]);
            }
            return data || [];
        } catch (error) {
            console.error('NotificationService.getUserNotifications: Unexpected error:', error);
            return [];
        }
    }

    /**
     * Mark a notification as read
     * @param {string} notificationId - Notification ID
     * @returns {Promise<object|null>} Updated notification or null on error
     */
    async markAsRead(notificationId) {
        if (!notificationId) {
            console.error('NotificationService.markAsRead: Notification ID is required');
            return null;
        }

        try {
            const currentUser = await authService.getCurrentUser();
            if (!currentUser || !currentUser.id) {
                console.error('NotificationService.markAsRead: User not authenticated');
                return null;
            }

            const { data, error } = await this.client
                .from('notifications')
                .update({
                    read: true
                })
                .eq('id', notificationId)
                .eq('user_id', currentUser.id)
                .select()
                .single();

            if (error) {
                console.error('NotificationService.markAsRead: Failed to mark notification as read:', error.message);
                return null;
            }

            return data;
        } catch (error) {
            console.error('NotificationService.markAsRead: Unexpected error:', error);
            return null;
        }
    }

    /**
     * Mark all notifications as read for the current user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of updated notification objects
     */
    async markAllAsRead(userId) {
        if (!userId) {
            console.error('NotificationService.markAllAsRead: User ID is required');
            return [];
        }

        try {
            console.log(`NotificationService.markAllAsRead: Marking all notifications as read for user ${userId}`);
            
            // First, get count of unread notifications
            const { count: unreadCount } = await this.client
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('read', false);
            
            console.log(`NotificationService.markAllAsRead: Found ${unreadCount || 0} unread notifications`);
            
            if (!unreadCount || unreadCount === 0) {
                console.log('NotificationService.markAllAsRead: No unread notifications to mark');
                return [];
            }

            // Update all unread notifications
            const { data, error } = await this.client
                .from('notifications')
                .update({
                    read: true
                })
                .eq('user_id', userId)
                .eq('read', false)
                .select();

            if (error) {
                console.error('NotificationService.markAllAsRead: Failed to mark all notifications as read:', error.message);
                console.error('NotificationService.markAllAsRead: Error details:', {
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
                return [];
            }

            console.log(`NotificationService.markAllAsRead: Successfully marked ${data?.length || 0} notifications as read`);
            return data || [];
        } catch (error) {
            console.error('NotificationService.markAllAsRead: Unexpected error:', error);
            return [];
        }
    }
}

export const notificationService = new NotificationService(supabaseClient);

