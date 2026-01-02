/**
 * Notification Configuration
 * 
 * This file defines all notifications in the system.
 * You can add, edit, or delete notifications by modifying this configuration.
 * 
 * Structure:
 * - id: Unique identifier for the notification type
 * - type: Database notification type (must match database CHECK constraint)
 * - title: Default notification title
 * - message: Default notification message template (supports {variable} placeholders)
 * - triggers: Array of service methods that should trigger this notification
 * - enabled: Whether this notification is currently enabled
 * - metadata: Default metadata structure
 */

export const NOTIFICATION_CONFIG = {
    // User Registration Notifications
    user_registered: {
        id: 'user_registered',
        type: 'user_registered',
        title: 'New User Registration',
        message: '{user_name} has registered and is pending approval.',
        triggers: [
            {
                service: 'auth-service',
                method: 'notifyAdminsOnRegistration',
                description: 'Notifies all admins when a new user registers'
            }
        ],
        enabled: true,
        recipients: ['admin'],
        metadata: {
            user_id: '{user_id}',
            email: '{email}',
            full_name: '{full_name}'
        }
    },

    // User Approval Notifications
    user_approved: {
        id: 'user_approved',
        type: 'user_approved',
        title: 'Account Approved',
        message: 'Your account has been approved. You can now access the learning platform.',
        triggers: [
            {
                service: 'admin-service',
                method: 'notifyUserOnApproval',
                description: 'Notifies user when their account is approved'
            }
        ],
        enabled: true,
        recipients: ['user'],
        metadata: {
            approved_by: '{approved_by}',
            approved_at: '{approved_at}',
            trainer_id: '{trainer_id}'
        }
    },

    // Trainer Assignment Notifications
    trainer_assigned: {
        id: 'trainer_assigned',
        type: 'trainer_assigned',
        title: 'New Learner Assigned',
        message: '{learner_name} has been assigned to you as a learner.',
        triggers: [
            {
                service: 'admin-service',
                method: 'notifyTrainerOnAssignment',
                description: 'Notifies trainer when a learner is assigned to them'
            }
        ],
        enabled: true,
        recipients: ['trainer'],
        metadata: {
            learner_id: '{learner_id}',
            learner_name: '{learner_name}',
            learner_email: '{learner_email}',
            assigned_by: '{assigned_by}',
            assigned_at: '{assigned_at}'
        }
    },

    // Course Allocation Notifications
    course_allocated: {
        id: 'course_allocated',
        type: 'course_allocated',
        title: 'New Course Assigned',
        message: 'Course "{course_title}" has been assigned to you by your trainer.',
        triggers: [
            {
                service: 'course-allocation-service',
                method: 'notifyLearnerOnCourseAllocation',
                description: 'Notifies learner when a course is allocated to them'
            }
        ],
        enabled: true,
        recipients: ['learner'],
        metadata: {
            course_id: '{course_id}',
            course_title: '{course_title}',
            trainer_id: '{trainer_id}',
            trainer_name: '{trainer_name}',
            allocated_at: '{allocated_at}'
        }
    },

    // Lab Submission Notifications
    lab_submitted: {
        id: 'lab_submitted',
        type: 'lab_submitted',
        title: 'New Lab Submission',
        message: '{learner_name} submitted Lab {lab_id} for {course_id}.',
        triggers: [
            {
                service: 'lab-submission-service',
                method: 'notifyTrainerOnSubmission',
                description: 'Notifies trainer when a learner submits a lab'
            }
        ],
        enabled: true,
        recipients: ['trainer'],
        metadata: {
            course_id: '{course_id}',
            lab_id: '{lab_id}',
            submission_id: '{submission_id}',
            learner_id: '{learner_id}',
            learner_name: '{learner_name}'
        }
    },

    // Lab Review Notifications
    lab_reviewed: {
        id: 'lab_reviewed',
        type: 'lab_reviewed',
        title: 'Lab Submission Reviewed',
        message: 'Your lab submission for {lab_id} has been reviewed. Status: {status}.',
        triggers: [
            {
                service: 'lab-submission-service',
                method: 'notifyLearnerOnReview',
                description: 'Notifies learner when their lab submission is reviewed'
            }
        ],
        enabled: true,
        recipients: ['learner'],
        metadata: {
            course_id: '{course_id}',
            lab_id: '{lab_id}',
            submission_id: '{submission_id}',
            status: '{status}',
            feedback: '{feedback}'
        }
    }
};

/**
 * Get notification configuration by type
 * @param {string} type - Notification type
 * @returns {object|null} Notification configuration or null
 */
export function getNotificationConfig(type) {
    return NOTIFICATION_CONFIG[type] || null;
}

/**
 * Get all enabled notifications
 * @returns {Array} Array of enabled notification configurations
 */
export function getEnabledNotifications() {
    return Object.values(NOTIFICATION_CONFIG).filter(config => config.enabled);
}

/**
 * Get all notifications for a specific recipient type
 * @param {string} recipientType - Recipient type ('admin', 'user', 'trainer', 'learner')
 * @returns {Array} Array of notification configurations
 */
export function getNotificationsForRecipient(recipientType) {
    return Object.values(NOTIFICATION_CONFIG).filter(
        config => config.enabled && config.recipients.includes(recipientType)
    );
}

/**
 * Check if a notification type is enabled
 * @param {string} type - Notification type
 * @returns {boolean} True if enabled
 */
export function isNotificationEnabled(type) {
    const config = getNotificationConfig(type);
    return config ? config.enabled : false;
}

/**
 * Format notification message with variables
 * @param {string} template - Message template with {variable} placeholders
 * @param {object} variables - Variables to replace in template
 * @returns {string} Formatted message
 */
export function formatNotificationMessage(template, variables = {}) {
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        message = message.replace(new RegExp(placeholder, 'g'), value || '');
    }
    return message;
}

