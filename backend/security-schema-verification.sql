-- Security Schema Verification
-- Run this to verify your schema has all required fields

-- Check if users table has all required fields
DO $$
DECLARE
    has_name BOOLEAN;
    has_status BOOLEAN;
    has_role BOOLEAN;
BEGIN
    -- Check for 'name' field
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'name'
    ) INTO has_name;
    
    -- Check for 'status' field
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'status'
    ) INTO has_status;
    
    -- Check for 'role' field
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) INTO has_role;
    
    -- Report findings
    RAISE NOTICE 'Schema Verification Results:';
    RAISE NOTICE '  name field: %', CASE WHEN has_name THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '  status field: %', CASE WHEN has_status THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '  role field: %', CASE WHEN has_role THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    
    -- Add missing fields if needed
    IF NOT has_name THEN
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
        RAISE NOTICE '  → Added name field';
    END IF;
    
    IF NOT has_status THEN
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
        RAISE NOTICE '  → Added status field';
    END IF;
    
    IF NOT has_role THEN
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'learner' CHECK (role IN ('learner', 'trainer'));
        RAISE NOTICE '  → Added role field';
    END IF;
    
    RAISE NOTICE 'Schema verification complete!';
END $$;

-- Verify RLS is enabled
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'admin_approvals', 'user_progress');

-- List all RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

