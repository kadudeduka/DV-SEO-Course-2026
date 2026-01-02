-- Quick Fix: Update role constraint to include 'admin'
-- Run this FIRST if you're getting constraint violation errors

-- Drop the old constraint (might only allow 'learner', 'trainer')
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint that includes 'admin'
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('learner', 'trainer', 'admin'));

-- Now you can safely update users to have role='admin'
-- Example:
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@system.local';

