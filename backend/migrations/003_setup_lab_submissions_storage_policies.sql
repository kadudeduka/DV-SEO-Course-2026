-- Migration: Setup RLS Policies for Lab Submissions Storage Bucket
-- This migration creates the storage bucket and configures RLS policies for file uploads/downloads

-- Note: The bucket must be created manually in Supabase Dashboard first:
-- 1. Go to Storage > New Bucket
-- 2. Name: lab-submissions
-- 3. Set to: Private
-- 4. Then run this migration

-- ============================================
-- STORAGE BUCKET POLICIES
-- ============================================

-- Policy: Learners can upload files to their own folder
-- Path structure: {userId}/{courseId}/{labId}/{timestamp}_{filename}.docx
CREATE POLICY "Learners can upload own submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lab-submissions' AND
  -- Extract first folder from path (e.g., "userId/courseId/labId/file.docx" -> "userId")
  split_part(name, '/', 1) = auth.uid()::text
);

-- Policy: Learners can read their own submission files
CREATE POLICY "Learners can read own submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lab-submissions' AND
  -- Extract first folder from path
  split_part(name, '/', 1) = auth.uid()::text
);

-- Policy: Learners can delete their own submission files (for resubmission)
CREATE POLICY "Learners can delete own submissions"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lab-submissions' AND
  -- Extract first folder from path
  split_part(name, '/', 1) = auth.uid()::text
);

-- Policy: Trainers can read submissions from their assigned learners
CREATE POLICY "Trainers can read assigned learner submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lab-submissions' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = split_part(name, '/', 1)
    AND trainer_id = auth.uid()
    AND role = 'learner'
  )
);

-- Policy: Admins can read all submission files
CREATE POLICY "Admins can read all submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lab-submissions' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = TRUE)
  )
);

-- Policy: Admins can delete any submission files
CREATE POLICY "Admins can delete all submissions"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lab-submissions' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = TRUE)
  )
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%submission%';
  
  IF policy_count >= 6 THEN
    RAISE NOTICE '✓ Successfully created % storage policies for lab-submissions bucket', policy_count;
  ELSE
    RAISE WARNING '⚠ Only % policies found. Expected 6 policies.', policy_count;
  END IF;
END $$;

-- List all policies for verification
SELECT 
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%submission%'
ORDER BY policyname;

