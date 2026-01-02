-- ============================================
-- FIX: Add RLS policy for admins to delete users
-- ============================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- Admins can delete users (except themselves)
-- Check both role = 'admin' OR is_admin = TRUE for backward compatibility
-- Note: In DELETE policies, 'users' refers to the row being deleted
CREATE POLICY "Admins can delete users"
    ON public.users
    FOR DELETE
    USING (
        -- Current user must be an admin
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() 
            AND (u.role = 'admin' OR u.is_admin = TRUE)
        )
        -- And cannot delete themselves
        AND auth.uid() != users.id
    );

DO $$ 
BEGIN
    RAISE NOTICE '✅ Admin delete policy created successfully';
END $$;

-- Verify the policy was created
DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND policyname = 'Admins can delete users'
    ) INTO policy_exists;
    
    IF policy_exists THEN
        RAISE NOTICE '✅ Policy verification: Policy exists';
    ELSE
        RAISE WARNING '⚠️ Policy verification: Policy NOT found!';
    END IF;
END $$;

