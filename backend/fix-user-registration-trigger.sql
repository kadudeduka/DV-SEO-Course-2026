-- ============================================
-- FIX: Update trigger function to include 'name' column
-- This fixes registration errors when 'name' column is NOT NULL
-- ============================================

-- Update the trigger function to handle 'name' column
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_name TEXT;
    user_full_name TEXT;
BEGIN
    -- Extract name from metadata
    user_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULL
    );
    
    user_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULL
    );
    
    -- DISABLED: Let the application code handle user profile creation
    -- This ensures proper validation and prevents null name issues
    -- The trigger will NOT create the profile automatically
    -- Application code will create it with proper validation
    
    -- Only create if name is explicitly provided AND not empty
    -- This is a safety net, but application code should handle creation
    IF user_name IS NOT NULL AND LENGTH(TRIM(user_name)) > 0 THEN
        INSERT INTO public.users (id, email, name, full_name, role, status)
        VALUES (
            NEW.id,
            NEW.email,
            TRIM(user_name), -- Ensure trimmed
            user_full_name,
            COALESCE(
                NULLIF(NEW.raw_user_meta_data->>'role', '')::TEXT,
                'learner'
            ),
            'pending'
        )
        ON CONFLICT (id) DO UPDATE
        SET
            email = EXCLUDED.email,
            -- Always update name if provided, never leave it null
            name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), public.users.name, TRIM(user_name)),
            full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
            role = COALESCE(EXCLUDED.role, public.users.role),
            status = COALESCE(EXCLUDED.status, public.users.status);
    END IF;
    -- If name is not provided, do nothing - application code will create the profile with validation
    
    RETURN NEW;
END;
$$;

DO $$ 
BEGIN
    RAISE NOTICE '✅ Trigger function updated to handle name column';
END $$;

