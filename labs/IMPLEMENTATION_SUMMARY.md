# Lab Submission DOCX Template System - Implementation Summary

## Overview

This document summarizes the complete implementation of the lab submission DOCX template system, which converts markdown submission formats into structured DOCX templates and updates the LMS to handle DOCX file uploads instead of inline text submissions.

## Components Created

### 1. Python Parser (`parse_lab_submission.py`)

**Purpose**: Parses individual lab submission markdown files and generates DOCX templates.

**Features**:
- Extracts metadata (Day, Lab Title, Course Name)
- Identifies sections (instructions, questions, self-assessment, trainer feedback)
- Classifies section types automatically
- Generates structured DOCX with proper styling

**Usage**:
```bash
python parse_lab_submission.py <submission_markdown_file> [output_dir]
```

### 2. Automation Script (`generate_all_templates.py`)

**Purpose**: Automatically processes all lab submission markdown files and generates templates.

**Features**:
- Finds all submission format files matching pattern `Day_XX_Lab_XX_Submission_Format.md`
- Sorts by day and lab number
- Generates all templates in batch
- Provides progress feedback

**Usage**:
```bash
python generate_all_templates.py [base_dir] [output_dir]
```

### 3. Database Migration (`002_add_lab_submission_file_storage.sql`)

**Purpose**: Extends `lab_submissions` table to support file storage.

**Changes**:
- Added `file_url` column (TEXT) - Path to uploaded DOCX in Supabase Storage
- Added `file_name` column (TEXT) - Original filename
- Added `file_size` column (BIGINT) - File size in bytes
- Made `submission_data` nullable (for backward compatibility)
- Added indexes for performance

### 4. Updated Lab Submission Service (`lab-submission-service.js`)

**Changes**:
- **New `submitLab()` method**: Now accepts a `File` object instead of text data
- **File validation**: Checks for .docx file type
- **Supabase Storage integration**: Uploads files to `lab-submissions` bucket
- **New `uploadSubmissionFile()` method**: Handles file upload to storage
- **New `getSubmissionFileUrl()` method**: Generates signed URLs for file downloads
- **New `deleteSubmissionFile()` method**: Cleans up files on error

**API Changes**:
```javascript
// Old (deprecated)
await labSubmissionService.submitLab(userId, courseId, labId, { answer: 'text' });

// New
await labSubmissionService.submitLab(userId, courseId, labId, docxFile);
```

### 5. Updated Lab Viewer Component (`lab-viewer.js`)

**Changes**:
- **Removed**: Textarea for inline text submission
- **Added**: Download template button with proper file path
- **Added**: File upload input for DOCX files
- **Added**: File validation (only .docx accepted)
- **Added**: Submission status display showing uploaded filename
- **Added**: Metadata extraction for template download links
- **Updated**: Form submission handler to process file uploads
- **Added**: Success/error message display

**UI Features**:
- Clear instructions on submission process
- Download template button (green)
- File upload input with validation
- Display of previously submitted files
- Revision status indicators

## File Structure

```
labs/
├── parse_lab_submission.py            # Individual file parser
├── generate_all_templates.py          # Batch automation script
├── requirements.txt                   # Python dependencies
├── README.md                          # User documentation
└── IMPLEMENTATION_SUMMARY.md          # This file

data/courses/{course-name}/assets/
└── templates/                          # Generated DOCX templates (course-specific)
    ├── Day01_Lab01_Submission_Template.docx
    ├── Day01_Lab02_Submission_Template.docx
    └── ...

backend/
├── migrations/
│   └── 002_add_lab_submission_file_storage.sql  # Database migration
└── scripts/
    ├── cleanup_old_submissions.py     # Daily cleanup script
    ├── cleanup_old_submissions.sh    # Cron wrapper script
    └── README.md                      # Script documentation
```

## DOCX Template Structure

### A. Cover Section (Read-Only)
- Course Name
- Day Title
- Lab Title
- Learner Name (editable, highlighted)
- Email (editable, highlighted)
- Submission Attempt (auto-incremented)
- Date (editable, highlighted)

### B. Instructions Section (Read-Only)
- All instructions from markdown
- Preserved formatting
- Grayed out text

### C. Question Sections (Editable)
- Section headers (H2)
- Questions (H3)
- Answer areas (yellow highlight)
- Tables and checklists preserved

### D. Self-Assessment Section (Editable)
- Rating scales
- Justification fields
- Reflection questions
- All editable with highlights

### E. Trainer Feedback Section (Locked)
- Feedback field (read-only, italic, gray)
- Status field (Pending / Approved / Needs Revision)
- Score field

### F. Submission Declaration (Editable)
- Checklist items
- Signature fields
- Date fields

## Styling Rules

- **Read-only sections**: Gray text, italic
- **Editable fields**: Yellow background highlight (RGB 255, 255, 0)
- **Headings**: Consistent hierarchy (H1 for main sections, H2 for subsections, H3 for questions)
- **Tables**: Preserved from markdown
- **Lists**: Bullet points and numbered lists maintained

## Workflow

### Learner Workflow

1. **Access Lab**: Navigate to lab in LMS
2. **Download Template**: Click "Download Submission Template (.docx)"
3. **Complete Offline**: Open in Word, complete all sections
4. **Upload**: Select completed DOCX file
5. **Submit**: Click submit button
6. **Wait for Review**: Receive notification when reviewed
7. **Resubmit if Needed**: If status is "Needs Revision", download template again, update, and resubmit

### Trainer Workflow

1. **Receive Notification**: Get notified when learner submits
2. **Download Submission**: Access submitted DOCX file from LMS
3. **Review**: Open DOCX, review answers
4. **Provide Feedback**: Enter feedback in LMS
5. **Set Status**: Choose Approved or Needs Revision
6. **Submit Review**: Learner receives notification

## Storage Architecture

### Template Storage
- **Location**: `data/courses/{course-name}/assets/templates/` directory (course-specific)
- **Naming**: `DayXX_LabXX_Submission_Template.docx`
- **Access**: Static file serving via web server
- **Example**: `data/courses/seo-master-2026/assets/templates/Day01_Lab01_Submission_Template.docx`

### Submission Storage
- **Platform**: Supabase Storage
- **Bucket**: `lab-submissions`
- **Path Structure**: `{userId}/{courseId}/{labId}/{timestamp}_{filename}.docx`
- **Access**: Signed URLs (1 hour expiry)
- **RLS**: Enforced at bucket level
- **Retention Policy**: Files automatically deleted after 30 days
- **Cleanup**: Daily automated script (`backend/scripts/cleanup_old_submissions.py`)

## Supabase Storage Setup

### 1. Create Bucket

```sql
-- In Supabase Dashboard > Storage
-- Create bucket: lab-submissions
-- Set to: Private
```

### 2. RLS Policies

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

## Migration Steps

### 1. Run Database Migration

```bash
psql -h <supabase-host> -U postgres -d postgres -f backend/migrations/002_add_lab_submission_file_storage.sql
```

### 2. Setup Supabase Storage

1. Create `lab-submissions` bucket (private)
2. Configure RLS policies (see above)
3. Test upload/download permissions

### 3. Generate Templates

```bash
cd labs
pip install -r requirements.txt
python generate_all_templates.py ../data/courses/seo-master-2026/content/labs templates/
```

### 4. Deploy Templates

Copy generated templates to web-accessible location:
```bash
cp labs/templates/* /path/to/web/root/labs/templates/
```

### 5. Update Frontend

The frontend code has already been updated. Ensure:
- `lab-viewer.js` is deployed
- `lab-submission-service.js` is deployed
- Static file serving is configured for `/labs/templates/`

## Testing Checklist

- [ ] Template generation works for all labs
- [ ] Templates have correct structure and styling
- [ ] Download links work correctly
- [ ] File upload accepts only .docx files
- [ ] Files upload to Supabase Storage correctly
- [ ] File URLs are generated correctly
- [ ] Trainers can download learner submissions
- [ ] Resubmission increments count correctly
- [ ] Notifications work for submissions and reviews
- [ ] Backward compatibility with old text submissions

## Backward Compatibility

The system maintains backward compatibility:

- **Old text submissions**: Still supported via `submission_data` JSONB field
- **New DOCX submissions**: Use `file_url`, `file_name`, `file_size` fields
- **Detection**: System checks for `file_url` to determine submission type
- **Migration**: Old submissions remain accessible

## Future Enhancements

1. **Template Versioning**: Track template versions and notify learners of updates
2. **Automatic Updates**: Regenerate templates when markdown changes
3. **Validation**: Validate DOCX structure before accepting uploads
4. **Preview**: Show template preview before download
5. **Batch Operations**: Bulk download/upload for trainers
6. **Analytics**: Track submission completion rates
7. **Template Customization**: Allow trainers to customize templates

## Troubleshooting

### Template Generation Fails
- Check Python dependencies are installed
- Verify markdown file format matches expected structure
- Check file paths are correct

### Upload Fails
- Verify Supabase Storage bucket exists
- Check RLS policies are configured
- Ensure file is valid .docx format
- Check file size limits

### Download Fails
- Verify templates exist in `labs/templates/`
- Check web server can serve static files
- Verify file permissions

### File Access Denied
- Check RLS policies in Supabase Storage
- Verify user has correct role/permissions
- Check signed URL generation

## Support

For issues or questions:
1. Check `labs/README.md` for detailed documentation
2. Review migration scripts for database changes
3. Check Supabase Storage configuration
4. Verify file paths and permissions

