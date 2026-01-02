-- ============================================
-- FIX: Ensure admin user has a profile in public.users
-- Run this if admin login fails with "user profile not found"
-- ============================================

-- Check if admin user exists in public.users
DO $$
DECLARE
    admin_email TEXT := 'admin@system.local';
    admin_auth_id UUID;
    admin_exists BOOLEAN;
BEGIN
    -- Get admin user ID from auth.users
    SELECT id INTO admin_auth_id
    FROM auth.users
    WHERE email = admin_email
    LIMIT 1;
    
    IF admin_auth_id IS NULL THEN
        RAISE NOTICE '⚠️  Admin user not found in auth.users with email: %', admin_email;
        RAISE NOTICE 'Please create the admin user in Supabase Dashboard → Authentication → Users first.';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ Found admin user in auth.users with ID: %', admin_auth_id;
    
    -- Check if profile exists in public.users
    SELECT EXISTS(
        SELECT 1 FROM public.users WHERE id = admin_auth_id
    ) INTO admin_exists;
    
    IF NOT admin_exists THEN
        RAISE NOTICE '⚠️  Admin profile not found in public.users. Creating...';
        
        -- Create admin profile
        INSERT INTO public.users (id, email, name, full_name, role, status, is_admin, created_at, updated_at)
        VALUES (
            admin_auth_id,
            admin_email,
            'Admin User',
            'Admin User',
            'admin',
            'approved',
            TRUE,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET
            email = EXCLUDED.email,
            name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name, 'Admin User'),
            role = COALESCE(EXCLUDED.role, public.users.role, 'admin'),
            status = COALESCE(EXCLUDED.status, public.users.status, 'approved'),
            is_admin = TRUE,
            updated_at = NOW();
        
        RAISE NOTICE '✅ Admin profile created/updated successfully';
    ELSE
        RAISE NOTICE '✅ Admin profile already exists in public.users';
        
        -- Ensure admin has correct role and status
        UPDATE public.users
        SET
            role = 'admin',
            status = 'approved',
            is_admin = TRUE,
            name = COALESCE(NULLIF(TRIM(name), ''), 'Admin User'),
            updated_at = NOW()
        WHERE id = admin_auth_id
          AND (role != 'admin' OR status != 'approved' OR is_admin != TRUE OR name IS NULL OR TRIM(name) = '');
        
        IF FOUND THEN
            RAISE NOTICE '✅ Admin profile updated with correct role and status';
        END IF;
    END IF;
END $$;

