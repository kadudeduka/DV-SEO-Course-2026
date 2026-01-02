-- Fix: Ensure admin users have status = 'approved'
-- Run this in Supabase SQL Editor

-- Check current admin users
SELECT 
    id,
    email,
    role,
    status,
    is_admin
FROM public.users
WHERE role = 'admin' OR is_admin = TRUE;

-- Update admin users to have status = 'approved' if not set
UPDATE public.users
SET status = 'approved'
WHERE (role = 'admin' OR is_admin = TRUE)
AND (status IS NULL OR status != 'approved');

-- Verify the update
SELECT 
    id,
    email,
    role,
    status,
    is_admin,
    CASE 
        WHEN status = 'approved' THEN '✅ Approved'
        WHEN status IS NULL THEN '⚠️ Status NULL'
        ELSE '❌ ' || status
    END AS status_check
FROM public.users
WHERE role = 'admin' OR is_admin = TRUE;

-- Count admins by status
SELECT 
    COALESCE(status, 'NULL') AS status,
    COUNT(*) AS count
FROM public.users
WHERE role = 'admin' OR is_admin = TRUE
GROUP BY status;

