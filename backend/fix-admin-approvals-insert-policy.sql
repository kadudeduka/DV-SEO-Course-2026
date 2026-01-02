-- ============================================
-- FIX: Add RLS policy for admins to insert into admin_approvals
-- This fixes the error when approving users: "new row violates row-level security policy"
-- ============================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can insert approvals" ON public.admin_approvals;

-- Admins can insert approval records for any user
CREATE POLICY "Admins can insert approvals"
    ON public.admin_approvals
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND (role = 'admin' OR is_admin = TRUE)
        )
    );

DO $$ 
BEGIN
    RAISE NOTICE '✅ Admin insert policy created for admin_approvals table';
END $$;

-- Verify the policy was created
DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'admin_approvals' 
        AND policyname = 'Admins can insert approvals'
    ) INTO policy_exists;
    
    IF policy_exists THEN
        RAISE NOTICE '✅ Policy verification: Policy exists';
    ELSE
        RAISE WARNING '⚠️ Policy verification: Policy NOT found!';
    END IF;
END $$;

