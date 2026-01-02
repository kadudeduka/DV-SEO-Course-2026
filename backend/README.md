# Backend Directory

This directory contains all backend-related files including database schemas, migrations, and setup scripts.

## Structure

```
backend/
├── schema.sql              # Main database schema
├── migrations/             # Database migration files
├── *.sql                  # SQL setup and fix scripts
└── README.md              # This file
```

## Files

- `schema.sql` - Complete database schema with tables and RLS policies
- `reset-and-validate.sql` - **Reset all data and validate schema** (⚠️ Deletes all data!)
- `user-schema-update.sql` - User table schema updates
- `fix-rls-policies.sql` - RLS policy fixes
- `fix-trigger-*.sql` - Database trigger fixes
- `fix-user-progress-schema.sql` - **Fix missing course_id and content_type columns in user_progress table**
- `fix-admin-delete-policy.sql` - **Fix missing RLS policy for admins to delete users**
- `fix-trainer-read-learners-policy.sql` - **Fix missing RLS policy for trainers to read assigned learners**
- `fix-notifications-insert-policy.sql` - **Fix missing RLS policy for creating notifications**
- `fix-notifications-insert-policy-v2.sql` - **Enhanced version with verification and testing**
- `fix-notifications-insert-policy-final.sql` - **FINAL VERSION - Drops all INSERT policies and creates a clean one**
- `fix-notification-types-constraint.sql` - **Fix missing notification types in database constraint (trainer_assigned, course_allocated)**
- `verify-and-fix-notification-insert-policy.sql` - **Verify and fix notification INSERT policy (run if notifications still fail)**
- `fix-notification-insert-policy-complete.sql` - **COMPLETE FIX - Drops ALL policies and recreates them cleanly (use if other fixes don't work)**
- `fix-notification-insert-via-function.sql` - **RECOMMENDED FIX - Creates a database function that bypasses RLS (most reliable solution)**
- `fix-users-read-policy.sql` - **Fix RLS policy to allow reading admin users (needed for notifications)**
- `verify-notifications-setup.sql` - **Verify notification system setup and troubleshoot issues**
- `verify-notification-types.sql` - **Verify all notification types are in database constraint**
- `create-admin-user.sql` - Admin user creation script
- `auto-confirm-users.sql` - Auto-confirm users script
- `security-schema-verification.sql` - Schema verification script

## Usage

### Initial Setup
1. Run `schema.sql` first to create the base schema
2. **IMPORTANT**: Run `migrations/001_add_notifications_and_allocations.sql` to add:
   - `notifications` table
   - `course_allocations` table
   - `lab_submissions` table
   - Updates `users` table with `role`, `status`, `trainer_id` columns
3. **IMPORTANT**: Run `migrations/004_add_missing_notification_types.sql` to add:
   - `trainer_assigned` notification type
   - `course_allocated` notification type
4. Run other migration files in order if needed
4. Create admin user using `create-admin-user.sql` or Supabase Dashboard

### Reset Database (Development Only!)
**⚠️ WARNING: This will DELETE ALL DATA!**

To reset all data and validate the schema:
```sql
-- Run in Supabase SQL Editor
\i reset-and-validate.sql
```

Or copy and paste the contents of `reset-and-validate.sql` into the Supabase SQL Editor.

This script will:
1. Delete all data from all tables (in correct dependency order)
2. Validate table structures against design requirements
3. Validate RLS policies are enabled and configured
4. Validate indexes exist
5. Report any errors or warnings

### Fixing Issues
- Run fix scripts if encountering specific issues
- See individual SQL files for specific purposes
- Use `security-schema-verification.sql` to check schema compliance

### Common Issues

**400 Bad Request on user_progress queries:**
If you see errors like `GET .../user_progress?select=*&user_id=eq.xxx&course_id=eq.xxx 400 (Bad Request)`, the `user_progress` table is missing the `course_id` column. Run:
```sql
-- In Supabase SQL Editor
\i fix-user-progress-schema.sql
```
Or copy and paste the contents of `fix-user-progress-schema.sql` into the Supabase SQL Editor.

**Delete user not working (no errors in console):**
If delete user functionality is not working, the RLS policy for admins to delete users may be missing. Run:
```sql
-- In Supabase SQL Editor
\i fix-admin-delete-policy.sql
```
Or copy and paste the contents of `fix-admin-delete-policy.sql` into the Supabase SQL Editor.

**Trainers cannot see assigned learners:**
If trainers cannot see learners assigned to them in the Course Allocation interface, the RLS policy for trainers to read assigned learners may be missing. Run:
```sql
-- In Supabase SQL Editor
\i fix-trainer-read-learners-policy.sql
```
Or copy and paste the contents of `fix-trainer-read-learners-policy.sql` into the Supabase SQL Editor.

**Registration error: "null value in column 'name' violates not-null constraint":**
If you see this error when registering new users, the trigger function needs to be updated to include the `name` column. Run:
```sql
-- In Supabase SQL Editor
\i fix-user-registration-trigger.sql
```
Or copy and paste the contents of `fix-user-registration-trigger.sql` into the Supabase SQL Editor.

**Cannot register again with same email after failed registration:**
If registration failed and you want to retry with the same email:
1. Run the cleanup script to remove invalid user records:
```sql
-- In Supabase SQL Editor
\i cleanup-orphaned-auth-users.sql
```
2. If the auth user still exists, delete it manually from Supabase Dashboard → Authentication → Users
3. Try registering again

**Admin login error: "Cannot coerce the result to a single JSON object" or "User profile not found":**
If admin login fails, the admin user might not have a profile in `public.users`. Run:
```sql
-- In Supabase SQL Editor
\i fix-admin-user-profile.sql
```
Or copy and paste the contents of `fix-admin-user-profile.sql` into the Supabase SQL Editor. This will create/update the admin profile with the correct role and status.

**Approval error: "new row violates row-level security policy for table admin_approvals":**
If you see this error when approving users, the RLS policy for admins to insert into `admin_approvals` is missing. Run:
```sql
-- In Supabase SQL Editor
\i fix-admin-approvals-insert-policy.sql
```
Or copy and paste the contents of `fix-admin-approvals-insert-policy.sql` into the Supabase SQL Editor. This will add the missing INSERT policy for admins.

**Lab submission upload error: "new row violates row-level security policy":**
If you see this error when uploading lab submission files, the Supabase Storage bucket RLS policies are missing. Follow these steps:

1. **Create the storage bucket** (if not already created):
   - Go to Supabase Dashboard → Storage
   - Click "New bucket"
   - Name: `lab-submissions`
   - Set to: **Private**
   - Click "Create bucket"

2. **Run the storage policies migration:**
   ```sql
   -- In Supabase SQL Editor
   \i migrations/003_setup_lab_submissions_storage_policies.sql
   ```
   Or copy and paste the contents of `migrations/003_setup_lab_submissions_storage_policies.sql` into the Supabase SQL Editor.

3. **Verify policies were created:**
   ```sql
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE schemaname = 'storage' 
   AND tablename = 'objects' 
   AND policyname LIKE '%submission%';
   ```

This will create the necessary RLS policies to allow:
- Learners to upload/read/delete their own submissions
- Trainers to read submissions from assigned learners
- Admins to read/delete all submissions

**File path error: "lab-submissions/lab-submissions/..." (duplicate bucket name):**
If you see this error in the browser console or when trying to access uploaded files, it means file paths in the database include the bucket name prefix. This can happen if old submissions were created before the path fix. Run:
```sql
-- In Supabase SQL Editor
\i fix-lab-submissions-file-paths.sql
```
Or copy and paste the contents of `fix-lab-submissions-file-paths.sql` into the Supabase SQL Editor. This will clean up any existing file paths that incorrectly include the bucket name.

**Additional Troubleshooting:**
- Ensure bucket name is exactly `lab-submissions` (case-sensitive)
- Ensure bucket is set to **Private** (not Public)
- Verify user is authenticated (check `auth.uid()` is not null)
- Check that file path structure matches: `{userId}/{courseId}/{labId}/{filename}` (no bucket prefix)
