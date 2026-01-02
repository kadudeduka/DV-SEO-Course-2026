-- Quick Fix: Setup RLS Policies for Lab Submissions Storage Bucket
-- Run this if you get "new row violates row-level security policy" when uploading lab submissions
--
-- IMPORTANT: Create the bucket first in Supabase Dashboard:
-- 1. Go to Storage > New Bucket
-- 2. Name: lab-submissions (exact match)
-- 3. Set to: Private
-- 4. Then run this script

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Learners can upload own submissions" ON storage.objects;
DROP POLICY IF EXISTS "Learners can read own submissions" ON storage.objects;
DROP POLICY IF EXISTS "Learners can delete own submissions" ON storage.objects;
DROP POLICY IF EXISTS "Trainers can read assigned learner submissions" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all submissions" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete all submissions" ON storage.objects;

-- Policy: Learners can upload files to their own folder
-- Path structure: {userId}/{courseId}/{labId}/{timestamp}_{filename}.docx
CREATE POLICY "Learners can upload own submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lab-submissions' AND
  split_part(name, '/', 1) = auth.uid()::text
);

-- Policy: Learners can read their own submission files
CREATE POLICY "Learners can read own submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lab-submissions' AND
  split_part(name, '/', 1) = auth.uid()::text
);

-- Policy: Learners can delete their own submission files
CREATE POLICY "Learners can delete own submissions"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lab-submissions' AND
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

-- Verify policies
SELECT 
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%submission%'
ORDER BY policyname;

