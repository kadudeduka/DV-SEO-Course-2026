# Notification Troubleshooting Guide

## Issue: Admin Not Seeing Notifications for New User Registration

### Problem
When a new user registers, admins are not seeing the notification in their notification badge or notification center.

### Root Causes

1. **INSERT Policy Too Restrictive**: The INSERT policy might not allow creating notifications for other users during registration
2. **Notification Not Created**: The notification creation might be failing silently
3. **Admin Can't Read Notifications**: The admin might not be able to read notifications (RLS policy issue)
4. **Badge Not Refreshing**: The notification badge might not be loading/refreshing

### Solutions

#### Step 1: Verify INSERT Policy

Run the updated `backend/fix-notifications-insert-policy.sql` script. The policy has been updated to allow any authenticated user to create notifications (needed for registration flow).

**Key Change**: The policy now allows `auth.uid() IS NOT NULL` instead of requiring `auth.uid() = user_id`. This is necessary because when a user registers, we're authenticated as that user but need to create notifications for admins.

#### Step 2: Check Browser Console

Open browser console (F12) and look for:
- `[AuthService] Notifying admins about new registration` - Should appear when user registers
- `[AuthService] Found X admin(s) to notify` - Should show number of admins
- `[AuthService] Notification created for admin` - Should appear for each admin
- Any error messages related to notifications

#### Step 3: Verify Database Setup

Run `backend/verify-notifications-setup.sql` in Supabase SQL Editor to check:
- Notifications table exists
- RLS policies are set up correctly
- Recent notifications exist
- Admin users exist

#### Step 4: Check Admin User Status

Ensure the admin user has:
- `role = 'admin'`
- `status = 'approved'`

Only approved admins receive notifications.

#### Step 5: Test Notification Creation

Try creating a test notification directly in Supabase:

```sql
-- Replace with your admin user ID
INSERT INTO public.notifications (user_id, type, title, message)
VALUES (
    'YOUR_ADMIN_USER_ID',
    'user_registered',
    'Test Notification',
    'This is a test notification'
);
```

If this fails, the INSERT policy is the issue.

#### Step 6: Check Notification Badge

1. **Hard Refresh**: Press Ctrl+Shift+R (or Cmd+Shift+R on Mac) to clear cache
2. **Check Console**: Look for `NotificationService.getUserNotifications` logs
3. **Verify Header**: Ensure header is initialized (check console for `[App] Header initialized`)

### Enhanced Logging

The code now includes enhanced logging:

- `[AuthService] Notifying admins about new registration` - Registration notification triggered
- `[AuthService] Found X admin(s) to notify` - Number of admins found
- `[AuthService] Notification created for admin` - Success message
- `[AuthService] Notification summary: X succeeded, Y failed` - Summary
- `NotificationService.getUserNotifications: Retrieved X notifications` - Notification count

### Admin Notification Access

Admins can now see **ALL notifications** in the system (not just their own). This is handled by the updated `getUserNotifications()` method which checks if the user is an admin and returns all notifications if they are.

### Common Issues

#### Issue: "new row violates row-level security policy"

**Solution**: Run `backend/fix-notifications-insert-policy.sql` with the updated policy.

#### Issue: No admins found

**Solution**: Ensure at least one user has `role = 'admin'` and `status = 'approved'`.

#### Issue: Notification created but not visible

**Solution**: 
1. Check if admin can read notifications (run verification script)
2. Hard refresh the page
3. Check browser console for errors

#### Issue: Badge shows 0 but notifications exist

**Solution**:
1. Check if `getUserNotifications` is being called
2. Verify admin role is correctly set
3. Check RLS policies allow admin to read all notifications

### Verification Checklist

- [ ] INSERT policy allows authenticated users to create notifications
- [ ] At least one admin user exists with `role = 'admin'` and `status = 'approved'`
- [ ] Browser console shows notification creation logs
- [ ] Verification script shows notifications in database
- [ ] Admin can see notifications in notification center
- [ ] Notification badge shows unread count

### Next Steps

1. **Run Updated INSERT Policy**: Execute `backend/fix-notifications-insert-policy.sql`
2. **Test Registration**: Register a new user and check console logs
3. **Verify Database**: Run `backend/verify-notifications-setup.sql`
4. **Check Badge**: Verify notification badge shows unread count
5. **Check Center**: Click badge and verify notifications appear

### Files Modified

- `backend/fix-notifications-insert-policy.sql` - Updated INSERT policy to allow any authenticated user
- `lms/services/auth-service.js` - Enhanced logging for notification creation
- `lms/services/notification-service.js` - Updated to allow admins to see all notifications
- `backend/verify-notifications-setup.sql` - New verification script

