-- Fix RLS Policy Infinite Recursion Issue
-- Run this in Supabase SQL Editor to fix the admin policies

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can read all approvals" ON public.admin_approvals;
DROP POLICY IF EXISTS "Admins can update approvals" ON public.admin_approvals;

-- Create a security definer function to check admin status
-- This function can bypass RLS to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = user_id AND is_admin = TRUE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- Recreate admin policies using the function (avoids recursion)
CREATE POLICY "Admins can read all users"
    ON public.users
    FOR SELECT
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all users"
    ON public.users
    FOR UPDATE
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read all approvals"
    ON public.admin_approvals
    FOR SELECT
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update approvals"
    ON public.admin_approvals
    FOR UPDATE
    USING (public.is_admin(auth.uid()));

-- Verify the fix
-- This should now work without recursion errors
SELECT 'RLS policies fixed successfully!' as status;

