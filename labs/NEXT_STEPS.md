# Next Steps - Lab Submission DOCX Template System

## Implementation Checklist

### ✅ Completed

- [x] Created parser script for markdown to DOCX conversion
- [x] Created automation script for batch template generation
- [x] Updated database schema for file storage
- [x] Updated lab submission service for DOCX uploads
- [x] Updated lab viewer UI for download/upload workflow
- [x] Moved templates to course-specific directory
- [x] Created cleanup script for 30-day retention policy
- [x] Added user notifications about retention policy

### 📋 Next Steps

#### 1. Install Python Dependencies

```bash
cd labs
pip install -r requirements.txt
```

For cleanup script:
```bash
pip install supabase
```

#### 2. Generate DOCX Templates

Generate templates for all labs:

```bash
python generate_all_templates.py data/courses/seo-master-2026/content/labs
```

This will create templates in: `data/courses/seo-master-2026/assets/templates/`

**Verify Output:**
- Check that templates are generated: `ls data/courses/seo-master-2026/assets/templates/`
- Should see files like: `Day01_Lab01_Submission_Template.docx`, etc.

#### 3. Run Database Migration

```bash
# Connect to your Supabase database
psql -h <your-supabase-host> -U postgres -d postgres

# Run the migration
\i backend/migrations/002_add_lab_submission_file_storage.sql
```

**Verify Migration:**
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lab_submissions' 
AND column_name IN ('file_url', 'file_name', 'file_size');
```

#### 4. Setup Supabase Storage

**4.1 Create Storage Bucket**

1. Go to Supabase Dashboard > Storage
2. Click "New bucket"
3. Name: `lab-submissions`
4. Set to: **Private**
5. Click "Create bucket"

**4.2 Configure RLS Policies**

Run these SQL commands in Supabase SQL Editor:

```sql
-- Learners can upload to their own folder
CREATE POLICY "Learners can upload own submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lab-submissions' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Learners can read their own submissions
CREATE POLICY "Learners can read own submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lab-submissions' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Trainers can read submissions from assigned learners
CREATE POLICY "Trainers can read assigned learner submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lab-submissions' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = (storage.foldername(name))[1]
    AND trainer_id = auth.uid()
  )
);

-- Admins can read all submissions
CREATE POLICY "Admins can read all submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lab-submissions' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

**4.3 Test Storage Access**

Test upload/download permissions with a test file.

#### 5. Configure Static File Serving

Ensure your web server can serve templates from:
```
/data/courses/seo-master-2026/assets/templates/
```

**For Development (Python HTTP Server):**
```bash
# From project root
python3 -m http.server 8000
# Templates accessible at: http://localhost:8000/data/courses/seo-master-2026/assets/templates/
```

**For Production:**
- Configure web server (nginx, Apache, etc.) to serve static files
- Ensure proper MIME types for .docx files
- Set appropriate cache headers

#### 6. Setup Automated Cleanup

**6.1 Set Environment Variables**

Create `.env` file in project root:
```bash
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**6.2 Test Cleanup Script**

```bash
# Dry run (no actual deletions)
python backend/scripts/cleanup_old_submissions.py --dry-run

# Actual run (be careful!)
python backend/scripts/cleanup_old_submissions.py
```

**6.3 Schedule Daily Execution**

**Linux/Mac (Cron):**
```bash
crontab -e
```

Add:
```
0 2 * * * cd /path/to/project && /path/to/python3 backend/scripts/cleanup_old_submissions.py >> /var/log/lab-submission-cleanup.log 2>&1
```

**Windows (Task Scheduler):**
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 2:00 AM
4. Action: Start program
5. Program: `python`
6. Arguments: `backend/scripts/cleanup_old_submissions.py`
7. Start in: `C:\path\to\project`

**Alternative: Use Supabase Edge Functions**

You can also create a Supabase Edge Function that runs daily:
- Create function in `supabase/functions/cleanup-submissions/`
- Schedule via Supabase Cron or external scheduler

#### 7. Deploy Frontend Changes

Ensure these files are deployed:
- `lms/components/lab-viewer.js` (updated UI)
- `lms/services/lab-submission-service.js` (file upload support)

**Verify:**
- Download template button works
- File upload accepts .docx files
- Retention policy message is displayed
- Submission status shows filename

#### 8. Testing Checklist

**Template Generation:**
- [ ] All lab templates generated successfully
- [ ] Templates have correct structure
- [ ] Download links work correctly
- [ ] Templates open correctly in Word

**File Upload:**
- [ ] Can upload .docx files
- [ ] Non-.docx files are rejected
- [ ] Files upload to Supabase Storage
- [ ] File URLs are generated correctly

**Access Control:**
- [ ] Learners can upload their own submissions
- [ ] Learners can download their own submissions
- [ ] Trainers can download assigned learner submissions
- [ ] Admins can download all submissions

**Retention Policy:**
- [ ] Warning message displayed to users
- [ ] Cleanup script runs successfully
- [ ] Old files are deleted after 30 days
- [ ] Database records are cleaned up

**Notifications:**
- [ ] Trainers notified on submission
- [ ] Learners notified on review
- [ ] Retention policy mentioned in notifications

#### 9. User Communication

**Notify Users About:**
1. New submission process (DOCX templates)
2. 30-day retention policy
3. Importance of saving their own copies
4. How to download templates

**Communication Channels:**
- LMS announcement
- Email to all learners
- Update course documentation

#### 10. Monitor and Maintain

**Daily:**
- Check cleanup script logs
- Monitor storage usage
- Review any errors

**Weekly:**
- Verify templates are accessible
- Check submission upload success rate
- Review user feedback

**Monthly:**
- Review storage costs
- Analyze submission patterns
- Update documentation as needed

## Troubleshooting

### Templates Not Downloading

**Check:**
- File paths are correct
- Web server can serve static files
- File permissions are correct
- MIME types configured for .docx

### Upload Failures

**Check:**
- Supabase Storage bucket exists
- RLS policies are configured
- File size limits
- Network connectivity

### Cleanup Script Issues

**Check:**
- Environment variables set correctly
- Service role key has proper permissions
- Database connection works
- Storage API access works

## Support Resources

- **Documentation**: `labs/README.md`
- **Implementation Details**: `labs/IMPLEMENTATION_SUMMARY.md`
- **Script Documentation**: `backend/scripts/README.md`
- **Database Schema**: `backend/migrations/002_add_lab_submission_file_storage.sql`

## Rollback Plan

If issues occur:

1. **Disable Cleanup**: Comment out cron job
2. **Revert Frontend**: Use previous version of lab-viewer.js
3. **Keep Templates**: Templates remain accessible
4. **Database**: Migration is additive, can be reverted if needed

## Success Criteria

✅ All templates generated and accessible  
✅ File uploads working for learners  
✅ Trainers can download submissions  
✅ Cleanup script running daily  
✅ Users aware of retention policy  
✅ No storage bloat from old files  
✅ System scalable for future courses  

