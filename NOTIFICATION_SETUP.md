# Notification System Setup Guide

## Issue: Notifications Not Reflecting in Interfaces

### Problem
Notifications are not appearing in the notification badge or notification center, even though the notification system is implemented.

### Root Cause
The `notifications` table is missing an **INSERT RLS policy**, which prevents notifications from being created in the database.

### Solution

#### Step 1: Add INSERT Policy for Notifications

Run the following SQL script in your Supabase SQL Editor:

```sql
-- File: backend/fix-notifications-insert-policy.sql
```

Or copy and paste this SQL:

```sql
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create INSERT policy
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (
        -- Allow if inserting for self
        auth.uid() = user_id
        OR
        -- Allow if user is admin
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        -- Allow service role (when using service_role key, auth.uid() is null)
        auth.uid() IS NULL
    );
```

#### Step 2: Verify Policy Creation

After running the script, verify the policy was created:

```sql
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'notifications'
ORDER BY policyname;
```

You should see 4 policies:
1. `Users can read own notifications` (SELECT)
2. `Users can update own notifications` (UPDATE)
3. `Admins can read all notifications` (SELECT)
4. `System can insert notifications` (INSERT) ← **This is the new one**

#### Step 3: Test Notifications

1. **Register a new user** - Should create a notification for admins
2. **Approve a user** - Should create a notification for the approved user
3. **Submit a lab** - Should create a notification for the assigned trainer
4. **Review a lab** - Should create a notification for the learner

Check the notification badge in the header - it should show the unread count.

### Verification Checklist

- [ ] INSERT policy created successfully
- [ ] Notification badge appears in header (bell icon)
- [ ] Badge shows unread count when notifications exist
- [ ] Clicking badge navigates to `/notifications`
- [ ] Notification center displays all notifications
- [ ] Marking notifications as read updates the badge count
- [ ] "Mark All as Read" button works

---

## Email Notification Setup

### Current Status
**Email notifications are NOT yet implemented.** Only in-app notifications are working.

### Email Notification Requirements

Based on the Product Requirements Document, the following email notifications are planned:

1. **Welcome Email** - Sent when a user registers
2. **Approval Email** - Sent when an admin approves a user
3. **Rejection Email** - Sent when an admin rejects a user
4. **Course Assignment Email** - Sent when a trainer assigns a course to a learner
5. **Lab Submission Email** - Sent to trainer when a learner submits a lab
6. **Lab Review Email** - Sent to learner when a trainer reviews their lab
7. **Trainer Assignment Email** - Sent to trainer when assigned a learner

### Setup Steps (Future Implementation)

#### Option 1: Supabase Edge Functions + SendGrid

1. **Create Supabase Edge Function** for email sending
2. **Set up SendGrid account** and get API key
3. **Store SendGrid API key** in Supabase secrets
4. **Create email templates** (HTML/text)
5. **Trigger email function** from notification service

#### Option 2: Supabase Edge Functions + AWS SES

1. **Create Supabase Edge Function** for email sending
2. **Set up AWS SES** and configure domain
3. **Store AWS credentials** in Supabase secrets
4. **Create email templates** (HTML/text)
5. **Trigger email function** from notification service

#### Option 3: Third-Party Service (Resend, Postmark, etc.)

1. **Choose email service** (Resend, Postmark, Mailgun, etc.)
2. **Create Supabase Edge Function** for email sending
3. **Store API key** in Supabase secrets
4. **Create email templates** (HTML/text)
5. **Trigger email function** from notification service

### Implementation Plan

The email notification system will be implemented in **Phase 9** of the implementation plan:

1. **Email Service Setup**
   - Choose email provider
   - Set up API keys and secrets
   - Create Supabase Edge Function

2. **Email Templates**
   - Design HTML email templates
   - Create template files
   - Add dynamic content placeholders

3. **Email Service Integration**
   - Create `email-service.js`
   - Implement `sendEmail()` method
   - Add email sending to notification triggers

4. **Testing**
   - Test all email types
   - Verify email delivery
   - Test email templates

### Current Workaround

Until email notifications are implemented, users will only receive **in-app notifications**:
- Notification badge in header
- Notification center at `/notifications`
- Real-time updates when notifications are created

---

## Troubleshooting

### Notifications Still Not Appearing?

1. **Check Browser Console** for errors:
   ```javascript
   // Open browser console (F12)
   // Look for errors related to notifications
   ```

2. **Check Supabase Logs**:
   - Go to Supabase Dashboard → Logs
   - Check for RLS policy violations
   - Look for INSERT errors on `notifications` table

3. **Verify RLS Policies**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'notifications';
   ```

4. **Test Notification Creation**:
   ```sql
   -- Try creating a test notification
   INSERT INTO public.notifications (user_id, type, title, message)
   VALUES (
       (SELECT id FROM public.users WHERE email = 'your-email@example.com'),
       'user_registered',
       'Test Notification',
       'This is a test notification'
   );
   ```

5. **Check Header Initialization**:
   - Ensure header is initialized in `index.html`
   - Check that `NotificationBadge` is created
   - Verify `notification-badge-container` exists in DOM

### Common Issues

**Issue**: "new row violates row-level security policy"
- **Solution**: Run `fix-notifications-insert-policy.sql`

**Issue**: Notification badge not showing
- **Solution**: Check that header is initialized and badge container exists

**Issue**: Notifications not updating in real-time
- **Solution**: Refresh the page or click the notification badge to reload

---

## Next Steps

1. ✅ **Fix INSERT Policy** - Run `backend/fix-notifications-insert-policy.sql`
2. ✅ **Test In-App Notifications** - Verify notifications appear in UI
3. ⏳ **Implement Email Notifications** - Phase 9 of implementation plan
4. ⏳ **Add Email Templates** - Design and implement email templates
5. ⏳ **Set Up Email Service** - Configure SendGrid/AWS SES/Resend

---

## Files Modified

- `backend/fix-notifications-insert-policy.sql` - New file with INSERT policy fix
- `backend/README.md` - Updated with new fix script reference
- `NOTIFICATION_SETUP.md` - This file (setup guide)

