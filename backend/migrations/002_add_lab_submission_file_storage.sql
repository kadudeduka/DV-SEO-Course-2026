-- Migration: Add file storage support for lab submissions
-- This migration adds a file_url column to lab_submissions for storing DOCX file references
--
-- IMPORTANT: After running this migration, you must:
-- 1. Create the 'lab-submissions' storage bucket in Supabase Dashboard (Storage > New Bucket, set to Private)
-- 2. Run migration 003_setup_lab_submissions_storage_policies.sql to configure RLS policies

-- Add file_url column to lab_submissions table
ALTER TABLE public.lab_submissions 
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add file_name column for storing original filename
ALTER TABLE public.lab_submissions 
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Add file_size column (in bytes)
ALTER TABLE public.lab_submissions 
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add index for file_url lookups
CREATE INDEX IF NOT EXISTS idx_lab_submissions_file_url ON public.lab_submissions(file_url) WHERE file_url IS NOT NULL;

-- Update submission_data to be nullable (since we now use file_url for DOCX submissions)
-- Note: Keep submission_data for backward compatibility with text submissions
ALTER TABLE public.lab_submissions 
ALTER COLUMN submission_data DROP NOT NULL;

-- Add comment explaining the new structure
COMMENT ON COLUMN public.lab_submissions.file_url IS 'URL/path to uploaded DOCX submission file (stored in Supabase Storage)';
COMMENT ON COLUMN public.lab_submissions.file_name IS 'Original filename of the uploaded DOCX file';
COMMENT ON COLUMN public.lab_submissions.file_size IS 'Size of the uploaded file in bytes';
COMMENT ON COLUMN public.lab_submissions.submission_data IS 'JSON data (legacy: text answers, new: metadata about DOCX submission)';

