-- Migration: Add notifications and course_allocations tables
-- Also updates users table to include role, status, and trainer_id columns
-- Run this in Supabase SQL Editor after running schema.sql

-- ============================================
-- UPDATE USERS TABLE
-- Add role, status, trainer_id columns if they don't exist
-- ============================================

-- Add role column if it doesn't exist, or update constraint if it does
-- IMPORTANT: Drop old constraint FIRST before adding new one
DO $$ 
BEGIN
    -- Always drop the old constraint first (it might only allow 'learner', 'trainer')
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        -- Column doesn't exist, add it
        ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'learner';
        CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
    ELSE
        -- Column exists, just ensure index exists
        CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
    END IF;
    
    -- Add new constraint that includes 'admin'
    ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('learner', 'trainer', 'admin'));
END $$;

-- Add status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.users ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
        CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
    END IF;
END $$;

-- Add trainer_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'trainer_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN trainer_id UUID REFERENCES public.users(id);
        CREATE INDEX IF NOT EXISTS idx_users_trainer_id ON public.users(trainer_id);
    END IF;
END $$;

-- Add approved_at, approved_by, rejected_at, rejected_by if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'approved_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE public.users ADD COLUMN approved_by UUID REFERENCES public.users(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'rejected_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN rejected_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'rejected_by'
    ) THEN
        ALTER TABLE public.users ADD COLUMN rejected_by UUID REFERENCES public.users(id);
    END IF;
END $$;

-- Migrate existing is_admin to role if needed
-- Note: This must happen AFTER the constraint is updated to include 'admin'
UPDATE public.users 
SET role = 'admin' 
WHERE is_admin = TRUE AND (role IS NULL OR role = 'learner' OR role NOT IN ('learner', 'trainer', 'admin'));

-- Migrate existing approved_at to status if needed
UPDATE public.users 
SET status = 'approved' 
WHERE approved_at IS NOT NULL AND (status IS NULL OR status = 'pending');

-- ============================================

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('user_registered', 'user_approved', 'lab_submitted', 'lab_reviewed')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS Policies for notifications
CREATE POLICY "Users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can read all notifications
CREATE POLICY "Admins can read all notifications"
    ON public.notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- COURSE ALLOCATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.course_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    trainer_id UUID NOT NULL REFERENCES public.users(id),
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    allocated_by UUID NOT NULL REFERENCES public.users(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- Enable Row-Level Security
ALTER TABLE public.course_allocations ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_allocations_user_id ON public.course_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_course_allocations_course_id ON public.course_allocations(course_id);
CREATE INDEX IF NOT EXISTS idx_course_allocations_trainer_id ON public.course_allocations(trainer_id);
CREATE INDEX IF NOT EXISTS idx_course_allocations_status ON public.course_allocations(status);
CREATE INDEX IF NOT EXISTS idx_course_allocations_user_course ON public.course_allocations(user_id, course_id);

-- RLS Policies for course_allocations
-- Learners can read their own allocations
CREATE POLICY "Learners can read own allocations"
    ON public.course_allocations FOR SELECT
    USING (auth.uid() = user_id);

-- Trainers can read allocations for their assigned learners
CREATE POLICY "Trainers can read assigned learner allocations"
    ON public.course_allocations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
    );

-- Trainers can insert allocations for their assigned learners
CREATE POLICY "Trainers can allocate courses to assigned learners"
    ON public.course_allocations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
        AND trainer_id = auth.uid()
        AND allocated_by = auth.uid()
    );

-- Trainers can update allocations for their assigned learners
CREATE POLICY "Trainers can update assigned learner allocations"
    ON public.course_allocations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
    );

-- Admins can read all allocations
CREATE POLICY "Admins can read all allocations"
    ON public.course_allocations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_course_allocations_updated_at
    BEFORE UPDATE ON public.course_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- LAB SUBMISSIONS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS public.lab_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    lab_id TEXT NOT NULL,
    submission_data JSONB NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMPTZ,
    feedback TEXT,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'approved', 'needs_revision')),
    resubmission_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id, lab_id, resubmission_count)
);

-- Enable Row-Level Security
ALTER TABLE public.lab_submissions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lab_submissions_user_id ON public.lab_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_submissions_course_lab ON public.lab_submissions(course_id, lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_submissions_status ON public.lab_submissions(status);
CREATE INDEX IF NOT EXISTS idx_lab_submissions_reviewed_by ON public.lab_submissions(reviewed_by);

-- RLS Policies for lab_submissions
CREATE POLICY "Learners can read own submissions"
    ON public.lab_submissions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Learners can insert own submissions"
    ON public.lab_submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Learners can update own submissions"
    ON public.lab_submissions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Trainers can read submissions"
    ON public.lab_submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'trainer'
        )
    );

CREATE POLICY "Trainers can update submissions"
    ON public.lab_submissions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'trainer'
        )
    );

CREATE POLICY "Admins can read all submissions"
    ON public.lab_submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_lab_submissions_updated_at
    BEFORE UPDATE ON public.lab_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- UPDATE USER_PROGRESS TABLE
-- Add course_id and content_type columns if they don't exist
-- ============================================

-- Add course_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_progress' 
        AND column_name = 'course_id'
    ) THEN
        ALTER TABLE public.user_progress ADD COLUMN course_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON public.user_progress(course_id);
        CREATE INDEX IF NOT EXISTS idx_user_progress_user_course ON public.user_progress(user_id, course_id);
    END IF;
END $$;

-- Add content_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_progress' 
        AND column_name = 'content_type'
    ) THEN
        ALTER TABLE public.user_progress ADD COLUMN content_type TEXT DEFAULT 'chapter' CHECK (content_type IN ('chapter', 'lab', 'tool'));
        CREATE INDEX IF NOT EXISTS idx_user_progress_completed ON public.user_progress(completed);
    END IF;
END $$;

-- Update unique constraint to include course_id
DO $$ 
BEGIN
    -- Drop old unique constraint if it exists
    ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_user_id_content_id_key;
    
    -- Add new unique constraint with course_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_progress_user_id_course_id_content_id_key'
    ) THEN
        ALTER TABLE public.user_progress 
        ADD CONSTRAINT user_progress_user_id_course_id_content_id_key 
        UNIQUE (user_id, course_id, content_id);
    END IF;
END $$;

-- Make course_id NOT NULL after adding it (set default for existing rows)
DO $$ 
BEGIN
    -- Set default course_id for existing rows (if any)
    UPDATE public.user_progress 
    SET course_id = 'seo-master-2026' 
    WHERE course_id IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE public.user_progress 
    ALTER COLUMN course_id SET NOT NULL;
END $$;

