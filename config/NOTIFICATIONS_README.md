# Notification Configuration Guide

## Overview

The notification system is configured in `config/notifications.config.js`. This file contains all notification definitions, their triggers, and settings.

## File Structure

```javascript
export const NOTIFICATION_CONFIG = {
    notification_type_id: {
        id: 'notification_type_id',
        type: 'database_type',  // Must match database CHECK constraint
        title: 'Notification Title',
        message: 'Message template with {variables}',
        triggers: [...],
        enabled: true/false,
        recipients: ['admin', 'user', 'trainer', 'learner'],
        metadata: {...}
    }
}
```

## Current Notifications

### 1. User Registration (`user_registered`)
- **Recipients**: Admins
- **Trigger**: When a new user registers
- **Status**: ✅ Enabled
- **Service**: `auth-service.js` → `notifyAdminsOnRegistration()`

### 2. User Approval (`user_approved`)
- **Recipients**: Approved user
- **Trigger**: When admin approves a user
- **Status**: ✅ Enabled
- **Service**: `admin-service.js` → `notifyUserOnApproval()`

### 3. Trainer Assignment (`trainer_assigned`)
- **Recipients**: Trainer
- **Trigger**: When admin assigns a learner to a trainer
- **Status**: ✅ Enabled
- **Service**: `admin-service.js` → `notifyTrainerOnAssignment()`

### 4. Course Allocation (`course_allocated`)
- **Recipients**: Learner
- **Trigger**: When trainer allocates a course to a learner
- **Status**: ✅ Enabled
- **Service**: `course-allocation-service.js` → `notifyLearnerOnCourseAllocation()`

### 5. Lab Submission (`lab_submitted`)
- **Recipients**: Trainer
- **Trigger**: When learner submits a lab
- **Status**: ✅ Enabled
- **Service**: `lab-submission-service.js` → `notifyTrainerOnSubmission()`

### 6. Lab Review (`lab_reviewed`)
- **Recipients**: Learner
- **Trigger**: When trainer reviews a lab submission
- **Status**: ✅ Enabled
- **Service**: `lab-submission-service.js` → `notifyLearnerOnReview()`

## Adding a New Notification

### Step 1: Update Database Constraint

Add the new notification type to the database:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'user_registered',
    'user_approved',
    'trainer_assigned',
    'course_allocated',
    'lab_submitted',
    'lab_reviewed',
    'your_new_type'  -- Add your new type here
));
```

### Step 2: Add to Configuration File

Add your notification to `config/notifications.config.js`:

```javascript
your_new_type: {
    id: 'your_new_type',
    type: 'your_new_type',
    title: 'Your Notification Title',
    message: 'Your message with {variable} placeholders',
    triggers: [
        {
            service: 'your-service',
            method: 'notifyMethod',
            description: 'Description of when this triggers'
        }
    ],
    enabled: true,
    recipients: ['admin'],  // or ['user', 'trainer', 'learner']
    metadata: {
        variable1: '{variable1}',
        variable2: '{variable2}'
    }
}
```

### Step 3: Implement Trigger Method

In the appropriate service file, add a notification trigger method:

```javascript
async notifyMethod(params) {
    try {
        const { notificationService } = await import('./notification-service.js');
        
        await notificationService.createNotification(
            recipientUserId,
            'your_new_type',
            'Your Notification Title',
            `Your message with ${params.variable}`,
            {
                variable1: params.variable1,
                variable2: params.variable2
            }
        );
    } catch (error) {
        console.warn('Failed to send notification:', error);
    }
}
```

### Step 4: Call Trigger Method

Call the notification method from the appropriate service action:

```javascript
// In your service method
this.notifyMethod(params).catch(err => {
    console.warn('Failed to notify:', err);
});
```

## Editing a Notification

1. Open `config/notifications.config.js`
2. Find the notification you want to edit
3. Update the fields:
   - `title`: Change the notification title
   - `message`: Update the message template
   - `enabled`: Set to `false` to disable
   - `metadata`: Update metadata structure
4. Update the trigger method in the service file if needed

## Disabling a Notification

Set `enabled: false` in the notification configuration:

```javascript
your_notification: {
    // ... other fields
    enabled: false,  // This disables the notification
}
```

**Note**: Disabling a notification only prevents it from being sent. The trigger method will still be called but will return early if the notification is disabled.

## Deleting a Notification

### Step 1: Remove from Configuration

Delete the notification entry from `config/notifications.config.js`.

### Step 2: Remove Trigger Method

Remove or comment out the notification trigger method from the service file.

### Step 3: Remove from Database (Optional)

If you want to remove the notification type from the database constraint:

```sql
-- Only remove if you're sure no notifications of this type exist
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    -- Remove the deleted type from this list
));
```

## Message Templates

Notification messages support variable placeholders using `{variable_name}` syntax:

```javascript
message: '{user_name} has submitted {lab_name} for {course_name}.'
```

Variables are replaced when the notification is created:

```javascript
await notificationService.createNotification(
    userId,
    'type',
    'Title',
    formatNotificationMessage(config.message, {
        user_name: 'John Doe',
        lab_name: 'Lab 1',
        course_name: 'SEO Master'
    }),
    { /* metadata */ }
);
```

## Helper Functions

The configuration file exports helper functions:

- `getNotificationConfig(type)` - Get config for a notification type
- `getEnabledNotifications()` - Get all enabled notifications
- `getNotificationsForRecipient(recipientType)` - Get notifications for a recipient type
- `isNotificationEnabled(type)` - Check if a notification is enabled
- `formatNotificationMessage(template, variables)` - Format message with variables

## Testing Notifications

1. **Test Registration Notification**:
   - Register a new user
   - Check admin notification badge

2. **Test Approval Notification**:
   - Approve a pending user
   - Check user notification badge

3. **Test Trainer Assignment**:
   - Assign a learner to a trainer
   - Check trainer notification badge

4. **Test Course Allocation**:
   - Allocate a course to a learner
   - Check learner notification badge

5. **Test Lab Submission**:
   - Submit a lab as a learner
   - Check trainer notification badge

6. **Test Lab Review**:
   - Review a lab submission as a trainer
   - Check learner notification badge

## Troubleshooting

### Notification Not Appearing

1. **Check INSERT Policy**: Ensure `fix-notifications-insert-policy.sql` has been run
2. **Check Database Constraint**: Verify notification type exists in database constraint
3. **Check Configuration**: Verify notification is `enabled: true`
4. **Check Browser Console**: Look for errors in notification creation
5. **Check Supabase Logs**: Look for RLS policy violations

### Notification Type Error

If you see "new row violates check constraint", the notification type is not in the database constraint. Run the migration script to add it.

### Notification Not Triggering

1. Check if the trigger method is being called
2. Verify the service method is called after the action
3. Check browser console for errors
4. Verify notification service is imported correctly

## Files Modified

- `config/notifications.config.js` - Notification configuration file
- `lms/services/admin-service.js` - Added `notifyTrainerOnAssignment()`
- `lms/services/course-allocation-service.js` - Added `notifyLearnerOnCourseAllocation()`
- `backend/migrations/004_add_missing_notification_types.sql` - Database migration

