-- Create Admin User
-- Run this in Supabase SQL Editor after setting up the database
-- 
-- This creates an admin user with:
-- Username: admin
-- Password: dv123.com
-- Email: admin@system.local (or you can change this)

-- Step 1: Create the admin user in Supabase Auth
-- You need to do this manually in Supabase Dashboard:
-- 1. Go to Authentication → Users
-- 2. Click "Add user" → "Create new user"
-- 3. Enter:
--    Email: admin@system.local (or your preferred admin email)
--    Password: dv123.com
-- 4. Click "Create user"
--
-- Then run the SQL below to mark them as admin:

-- Step 2: Mark user as admin (replace email with the one you created)
UPDATE public.users
SET 
    is_admin = TRUE,
    status = 'approved',
    name = 'Administrator',
    role = 'trainer'
WHERE email = 'admin@system.local';

-- Verify admin user was created
SELECT id, email, name, is_admin, status, role
FROM public.users
WHERE is_admin = TRUE;

-- Note: The admin credentials (username: admin, password: dv123.com) should be:
-- - Stored in environment variables (config.local.js)
-- - Used to authenticate via Supabase Auth
-- - The email in Supabase Auth should match the email in public.users

-- For the admin login to work:
-- 1. Create user in Supabase Auth with email and password
-- 2. Run the UPDATE query above to set is_admin = TRUE
-- 3. Add credentials to config.local.js (see ADMIN_SETUP.md)

