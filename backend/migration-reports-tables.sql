-- Migration: Reports Feature Tables
-- Description: Creates tables for user tags, tag assignments, and optional report caching
-- Date: 2025-01-29
-- Author: System Design Team

-- ============================================================================
-- 1. USER TAGS TABLE
-- ============================================================================
-- Stores tags that can be assigned to users for grouping and analysis
CREATE TABLE IF NOT EXISTS public.user_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#6366f1', -- Default indigo color for UI display
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_tags_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
    CONSTRAINT user_tags_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Indexes for user_tags
CREATE INDEX IF NOT EXISTS idx_user_tags_name ON public.user_tags(name);
CREATE INDEX IF NOT EXISTS idx_user_tags_created_by ON public.user_tags(created_by);
CREATE INDEX IF NOT EXISTS idx_user_tags_created_at ON public.user_tags(created_at);

-- ============================================================================
-- 2. USER TAG ASSIGNMENTS TABLE
-- ============================================================================
-- Junction table linking users to tags (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.user_tag_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.user_tags(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tag_id) -- Prevent duplicate assignments
);

-- Indexes for user_tag_assignments
CREATE INDEX IF NOT EXISTS idx_user_tag_assignments_user_id ON public.user_tag_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_assignments_tag_id ON public.user_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_assignments_assigned_by ON public.user_tag_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_user_tag_assignments_assigned_at ON public.user_tag_assignments(assigned_at);

-- ============================================================================
-- 3. REPORT CACHE TABLE (Optional - for performance)
-- ============================================================================
-- Caches expensive report calculations for faster retrieval
CREATE TABLE IF NOT EXISTS public.report_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    report_type TEXT NOT NULL,
    report_data JSONB NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT report_cache_key_length CHECK (char_length(cache_key) >= 1 AND char_length(cache_key) <= 500),
    CONSTRAINT report_cache_type_check CHECK (report_type IN (
        'learner_overview',
        'learner_course',
        'trainer_learner_overview',
        'trainer_course_performance',
        'admin_system_overview',
        'admin_course_performance',
        'admin_trainer_performance',
        'tag_based_report'
    ))
);

-- Indexes for report_cache
CREATE INDEX IF NOT EXISTS idx_report_cache_key ON public.report_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_report_cache_expires ON public.report_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_report_cache_user_id ON public.report_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_report_cache_type ON public.report_cache(report_type);
CREATE INDEX IF NOT EXISTS idx_report_cache_created_at ON public.report_cache(created_at);

-- ============================================================================
-- 4. ENHANCE EXISTING TABLES
-- ============================================================================

-- Enhance lab_submissions table if columns don't exist
DO $$ 
BEGIN
    -- Add score column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_submissions' 
        AND column_name = 'score'
    ) THEN
        ALTER TABLE public.lab_submissions
        ADD COLUMN score NUMERIC(5,2) CHECK (score >= 0 AND score <= 100);
    END IF;

    -- Add trainer_feedback column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_submissions' 
        AND column_name = 'trainer_feedback'
    ) THEN
        ALTER TABLE public.lab_submissions
        ADD COLUMN trainer_feedback TEXT;
    END IF;

    -- Add reviewed_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_submissions' 
        AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE public.lab_submissions
        ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Indexes for lab_submissions (for report queries)
CREATE INDEX IF NOT EXISTS idx_lab_submissions_score ON public.lab_submissions(score);
CREATE INDEX IF NOT EXISTS idx_lab_submissions_reviewed_at ON public.lab_submissions(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_lab_submissions_user_course ON public.lab_submissions(user_id, course_id);

-- Enhance user_progress table if columns don't exist
DO $$ 
BEGIN
    -- Add time_spent column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_progress' 
        AND column_name = 'time_spent'
    ) THEN
        ALTER TABLE public.user_progress
        ADD COLUMN time_spent INTEGER DEFAULT 0 CHECK (time_spent >= 0);
    END IF;

    -- Add last_accessed_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_progress' 
        AND column_name = 'last_accessed_at'
    ) THEN
        ALTER TABLE public.user_progress
        ADD COLUMN last_accessed_at TIMESTAMPTZ;
    END IF;

    -- Add progress_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_progress' 
        AND column_name = 'progress_data'
    ) THEN
        ALTER TABLE public.user_progress
        ADD COLUMN progress_data JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Indexes for user_progress (for report queries)
CREATE INDEX IF NOT EXISTS idx_user_progress_time_spent ON public.user_progress(time_spent);
CREATE INDEX IF NOT EXISTS idx_user_progress_last_accessed ON public.user_progress(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_course ON public.user_progress(user_id, course_id);

-- ============================================================================
-- 5. DATABASE VIEWS (for performance)
-- ============================================================================

-- View: Learner Progress Summary
-- Provides aggregated progress data for all learners
CREATE OR REPLACE VIEW public.learner_progress_summary AS
SELECT 
    u.id AS user_id,
    u.full_name,
    u.email,
    u.learner_type,
    u.trainer_id,
    COUNT(DISTINCT ca.course_id) AS total_courses_assigned,
    COUNT(DISTINCT CASE WHEN up.completed = true THEN up.content_id END) AS chapters_completed,
    COUNT(DISTINCT ls.id) AS labs_submitted,
    AVG(ls.score) AS average_lab_score,
    MAX(up.last_accessed_at) AS last_activity_date,
    MIN(ca.allocated_at) AS first_course_allocated_at
FROM public.users u
LEFT JOIN public.course_allocations ca ON u.id = ca.user_id AND ca.status = 'active'
LEFT JOIN public.user_progress up ON u.id = up.user_id
LEFT JOIN public.lab_submissions ls ON u.id = ls.user_id
WHERE u.role = 'learner'
GROUP BY u.id, u.full_name, u.email, u.learner_type, u.trainer_id;

-- View: Course Performance Summary
-- Provides aggregated performance data for all courses
CREATE OR REPLACE VIEW public.course_performance_summary AS
SELECT 
    ca.course_id,
    COUNT(DISTINCT ca.user_id) AS total_learners,
    COUNT(DISTINCT CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.user_progress up2 
            WHERE up2.user_id = ca.user_id 
            AND up2.course_id = ca.course_id 
            AND up2.completed = true
        ) THEN ca.user_id 
    END) AS learners_completed,
    AVG(
        CASE 
            WHEN total_chapters > 0 
            THEN (completed_chapters::NUMERIC / total_chapters::NUMERIC) * 100 
            ELSE 0 
        END
    ) AS average_progress,
    AVG(ls.score) AS average_lab_score,
    COUNT(DISTINCT ls.id) AS total_lab_submissions,
    COUNT(DISTINCT CASE WHEN ls.status = 'pending' THEN ls.id END) AS pending_lab_reviews
FROM public.course_allocations ca
LEFT JOIN (
    SELECT 
        user_id, 
        course_id,
        COUNT(DISTINCT CASE WHEN completed = true THEN content_id END) AS completed_chapters
    FROM public.user_progress
    GROUP BY user_id, course_id
) up ON ca.user_id = up.user_id AND ca.course_id = up.course_id
LEFT JOIN public.lab_submissions ls ON ca.user_id = ls.user_id AND ca.course_id = ls.course_id
LEFT JOIN (
    -- This would ideally come from course metadata, but for now we'll calculate from progress
    SELECT 
        course_id, 
        COUNT(DISTINCT content_id) AS total_chapters
    FROM public.user_progress
    GROUP BY course_id
) course_stats ON ca.course_id = course_stats.course_id
WHERE ca.status = 'active'
GROUP BY ca.course_id;

-- View: Trainer Performance Summary
-- Provides aggregated performance data for all trainers
CREATE OR REPLACE VIEW public.trainer_performance_summary AS
SELECT 
    t.id AS trainer_id,
    t.full_name AS trainer_name,
    t.email AS trainer_email,
    COUNT(DISTINCT l.id) AS total_assigned_learners,
    COUNT(DISTINCT CASE 
        WHEN l.learner_type = 'active' THEN l.id 
    END) AS active_learners,
    AVG(lps.average_lab_score) AS average_learner_lab_score,
    COUNT(DISTINCT ls.id) AS total_labs_reviewed,
    COUNT(DISTINCT CASE WHEN ls.status = 'submitted' THEN ls.id END) AS pending_lab_reviews,
    AVG(EXTRACT(EPOCH FROM (ls.reviewed_at - ls.submitted_at)) / 3600) AS avg_response_time_hours
FROM public.users t
LEFT JOIN public.users l ON t.id = l.trainer_id AND l.role = 'learner'
LEFT JOIN public.learner_progress_summary lps ON l.id = lps.user_id
LEFT JOIN public.lab_submissions ls ON t.id = ls.reviewed_by
WHERE t.role = 'trainer'
GROUP BY t.id, t.full_name, t.email;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on user_tags
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view tags
CREATE POLICY "Users can view tags" ON public.user_tags
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Only admins can create/update/delete tags
CREATE POLICY "Admins can manage tags" ON public.user_tags
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Enable RLS on user_tag_assignments
ALTER TABLE public.user_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tag assignments
CREATE POLICY "Users can view own tag assignments" ON public.user_tag_assignments
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (role = 'admin' OR role = 'trainer')
        )
    );

-- Policy: Only admins can assign/remove tags
CREATE POLICY "Admins can manage tag assignments" ON public.user_tag_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Enable RLS on report_cache
ALTER TABLE public.report_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own cached reports
CREATE POLICY "Users can view own cached reports" ON public.report_cache
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Policy: Users can create/update their own cached reports
CREATE POLICY "Users can manage own cached reports" ON public.report_cache
    FOR ALL
    USING (user_id = auth.uid());

-- ============================================================================
-- 7. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at for user_tags
CREATE TRIGGER update_user_tags_updated_at
    BEFORE UPDATE ON public.user_tags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function: Clean expired cache entries
CREATE OR REPLACE FUNCTION public.clean_expired_report_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.report_cache
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.user_tags IS 'Tags that can be assigned to users for grouping and analysis in reports';
COMMENT ON TABLE public.user_tag_assignments IS 'Junction table linking users to tags (many-to-many relationship)';
COMMENT ON TABLE public.report_cache IS 'Optional cache table for expensive report calculations';

COMMENT ON COLUMN public.user_tags.color IS 'Hex color code for UI display (e.g., #6366f1)';
COMMENT ON COLUMN public.user_tag_assignments.assigned_by IS 'User who assigned the tag (typically admin)';
COMMENT ON COLUMN public.report_cache.cache_key IS 'Unique key identifying the cached report (e.g., learner_overview_userId_dateRange)';
COMMENT ON COLUMN public.report_cache.report_data IS 'JSONB containing the cached report data';

COMMENT ON VIEW public.learner_progress_summary IS 'Aggregated progress data for all learners';
COMMENT ON VIEW public.course_performance_summary IS 'Aggregated performance data for all courses';
COMMENT ON VIEW public.trainer_performance_summary IS 'Aggregated performance data for all trainers';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

