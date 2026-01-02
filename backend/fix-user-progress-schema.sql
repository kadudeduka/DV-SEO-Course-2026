-- ============================================
-- QUICK FIX: Add missing columns to user_progress table
-- Run this if you're getting 400 errors on user_progress queries
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
        RAISE NOTICE '✅ Added course_id column to user_progress';
    ELSE
        RAISE NOTICE 'ℹ️ course_id column already exists';
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
        RAISE NOTICE '✅ Added content_type column to user_progress';
    ELSE
        RAISE NOTICE 'ℹ️ content_type column already exists';
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
        RAISE NOTICE '✅ Updated unique constraint to include course_id';
    ELSE
        RAISE NOTICE 'ℹ️ Unique constraint already includes course_id';
    END IF;
END $$;

-- Set default course_id for existing rows (if any)
UPDATE public.user_progress 
SET course_id = 'seo-master-2026' 
WHERE course_id IS NULL;

-- Make course_id NOT NULL
DO $$ 
BEGIN
    ALTER TABLE public.user_progress 
    ALTER COLUMN course_id SET NOT NULL;
    RAISE NOTICE '✅ Set course_id to NOT NULL';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Could not set course_id to NOT NULL: %', SQLERRM;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON public.user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_course ON public.user_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_completed ON public.user_progress(completed);

DO $$ 
BEGIN
    RAISE NOTICE '✅ Created indexes on user_progress';
END $$;

