-- SEO LMS Backend Database Schema
-- Run this in Supabase SQL Editor after creating your project

-- Enable UUID extension (usually enabled by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- Extends Supabase auth.users with additional profile data
-- ============================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id)
);

-- Enable Row-Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ADMIN APPROVALS TABLE
-- Tracks approval requests and status
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_approvals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    rejected_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE public.admin_approvals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER PROGRESS TABLE (Future use)
-- Stores user progress for course content
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content_id TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    progress_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);

-- Enable Row-Level Security
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================

-- USERS TABLE POLICIES

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;


-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (except admin fields)
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    AND is_admin = FALSE
    AND approved_at IS NULL
    AND approved_by IS NULL
);


-- Admins can read all users
CREATE POLICY "Admins can read all users"
    ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Admins can update all users
CREATE POLICY "Admins can update all users"
    ON public.users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ADMIN APPROVALS POLICIES

-- Users can read their own approval requests
CREATE POLICY "Users can read own approvals"
    ON public.admin_approvals
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own approval requests
CREATE POLICY "Users can create own approvals"
    ON public.admin_approvals
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can read all approval requests
CREATE POLICY "Admins can read all approvals"
    ON public.admin_approvals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Admins can update approval requests
CREATE POLICY "Admins can update approvals"
    ON public.admin_approvals
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- USER PROGRESS POLICIES

-- Users can read their own progress
CREATE POLICY "Users can read own progress"
    ON public.user_progress
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress"
    ON public.user_progress
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
    ON public.user_progress
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete own progress"
    ON public.user_progress
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_approvals_updated_at
    BEFORE UPDATE ON public.admin_approvals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON public.user_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- INDEXES (for performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin);
CREATE INDEX IF NOT EXISTS idx_admin_approvals_user_id ON public.admin_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_approvals_status ON public.admin_approvals(status);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_content_id ON public.user_progress(content_id);

-- ============================================
-- INITIAL ADMIN USER SETUP
-- ============================================
-- After creating your first admin user via Supabase Auth,
-- run this query (replace EMAIL with admin email):
--
-- UPDATE public.users
-- SET is_admin = TRUE
-- WHERE email = 'admin@example.com';
--
-- Or use the Supabase dashboard to manually set is_admin = true

