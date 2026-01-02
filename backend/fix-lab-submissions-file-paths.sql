-- Fix: Clean up file_url paths that incorrectly include 'lab-submissions/' prefix
-- This script removes the bucket name prefix from file_url if it exists

-- Update file_url to remove 'lab-submissions/' prefix if present
UPDATE public.lab_submissions
SET file_url = REPLACE(file_url, 'lab-submissions/', '')
WHERE file_url LIKE 'lab-submissions/%';

-- Verify the fix
SELECT 
    id,
    user_id,
    course_id,
    lab_id,
    file_url,
    file_name,
    CASE 
        WHEN file_url LIKE 'lab-submissions/%' THEN '❌ Still has bucket prefix'
        ELSE '✓ Clean path'
    END as path_status
FROM public.lab_submissions
WHERE file_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Report count of fixed records
DO $$
DECLARE
    fixed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fixed_count
    FROM public.lab_submissions
    WHERE file_url LIKE 'lab-submissions/%';
    
    IF fixed_count = 0 THEN
        RAISE NOTICE '✓ All file paths are clean (no bucket prefix found)';
    ELSE
        RAISE WARNING '⚠ Found % records with bucket prefix. Run UPDATE again.', fixed_count;
    END IF;
END $$;

