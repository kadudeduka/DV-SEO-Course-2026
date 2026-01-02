-- User Schema Update
-- Updates the users table to match the required data model
-- Run this AFTER running the main schema.sql

-- Add role and status columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'learner' CHECK (role IN ('learner', 'trainer')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update existing users to have default values
UPDATE public.users
SET 
    name = COALESCE(full_name, ''),
    role = COALESCE(role, 'learner'),
    status = CASE 
        WHEN approved_at IS NOT NULL THEN 'approved'
        WHEN status IS NULL THEN 'pending'
        ELSE status
    END
WHERE name IS NULL OR role IS NULL OR status IS NULL;

-- Make name NOT NULL (after setting defaults)
ALTER TABLE public.users
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN role SET NOT NULL,
ALTER COLUMN status SET NOT NULL;

-- Create index on email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Create index on role for filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Update the trigger function to handle new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, name, full_name, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            ''
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            ''
        ),
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::TEXT,
            'learner'
        ),
        'pending'
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
        role = COALESCE(EXCLUDED.role, public.users.role),
        status = COALESCE(EXCLUDED.status, public.users.status);
    
    RETURN NEW;
END;
$$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Note: Password hashing is handled by Supabase Auth
-- Passwords are stored in auth.users table, not in public.users
-- This is a security best practice - we never store password hashes in our application tables

