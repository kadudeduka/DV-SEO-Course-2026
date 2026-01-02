# Lab Submission DOCX Template System

This directory contains tools for converting lab submission markdown files into structured DOCX templates and managing the lab submission workflow.

## Overview

The lab submission system has been redesigned to use DOCX templates instead of inline text submissions. Learners download a template, complete it offline, and upload the completed file.

## Directory Structure

```
labs/
├── parse_lab_submission.py # Parser script for individual files
├── generate_all_templates.py # Automation script for all labs
├── requirements.txt        # Python dependencies
└── README.md              # This file

data/courses/{course-name}/assets/
└── templates/              # Generated DOCX templates (course-specific)
    ├── Day01_Lab01_Submission_Template.docx
    ├── Day01_Lab02_Submission_Template.docx
    └── ...
```

## Setup

1. **Install Python Dependencies**

```bash
pip install -r requirements.txt
```

2. **Generate Templates**

Generate templates for all labs (defaults to course-specific assets directory):

```bash
python generate_all_templates.py data/courses/seo-master-2026/content/labs
```

Or specify custom output directory:

```bash
python generate_all_templates.py data/courses/seo-master-2026/content/labs data/courses/seo-master-2026/assets/templates seo-master-2026
```

Or generate a single template:

```bash
python parse_lab_submission.py data/courses/seo-master-2026/content/labs/Day_01_Lab_01_Submission_Format.md
```

## Template Structure

Generated DOCX templates include:

### A. Cover Section (Read-Only)
- Course Name
- Day
- Lab Title
- Learner Name (editable field)
- Email (editable field)
- Submission Attempt (auto-incremented)
- Date (editable field)

### B. Instructions Section (Read-Only)
- All instructions from the markdown file
- Rendered exactly as written

### C. Question Sections (Editable)
- All questions with answer areas highlighted
- Tables and checklists preserved
- Editable fields marked with yellow highlight

### D. Self-Assessment Section (Editable)
- Rating scales
- Justification fields
- Reflection questions

### E. Trainer Feedback Section (Locked)
- Feedback field (read-only, trainer fills)
- Status field (Pending / Approved / Needs Revision)
- Score field

### F. Submission Declaration (Editable)
- Submission checklist
- Declaration signature fields

## Styling

- **Read-only sections**: Normal text, grayed out
- **Editable answer areas**: Light yellow background highlight
- **Trainer sections**: Locked, clearly marked
- **Headings**: Consistent hierarchy (H1, H2, H3)

## Database Changes

The `lab_submissions` table has been extended with:

- `file_url` (TEXT): Path to uploaded DOCX file in Supabase Storage
- `file_name` (TEXT): Original filename
- `file_size` (BIGINT): File size in bytes
- `submission_data` (JSONB): Now nullable, stores metadata about DOCX submission

## Workflow

### For Learners:

1. Navigate to a lab in the LMS
2. Click "Download Submission Template (.docx)"
3. Open the template in Microsoft Word or compatible editor
4. Complete all sections offline
5. Upload the completed DOCX file
6. Submit for trainer review

### For Trainers:

1. Receive notification when learner submits
2. Download the submitted DOCX file
3. Review and provide feedback in the LMS
4. Set status (Approved / Needs Revision)
5. Learner receives notification

## File Naming Convention

Templates are named: `DayXX_LabXX_Submission_Template.docx`

Example: `Day01_Lab01_Submission_Template.docx`

## Storage

- **Templates**: Stored in `data/courses/{course-name}/assets/templates/` directory (course-specific)
- **Submissions**: Stored in Supabase Storage bucket `lab-submissions`
- **Path structure**: `{userId}/{courseId}/{labId}/{timestamp}_{filename}.docx`
- **Retention Policy**: Submission files are automatically deleted after 30 days

## Data Retention Policy

⚠️ **Important**: Submitted lab files are automatically deleted after 30 days.

- Learners should download and save their submissions for their records
- Trainers should download submissions they need to keep before the 30-day period
- The cleanup process runs daily via automated script
- See `backend/scripts/README.md` for cleanup script details

## Migration Notes

### Backward Compatibility

- Old text submissions are still supported (stored in `submission_data`)
- New DOCX submissions use `file_url` and `file_name`
- The system automatically detects submission type

### Running the Migration

```sql
-- Run the migration script
\i backend/migrations/002_add_lab_submission_file_storage.sql
```

### Supabase Storage Setup

1. Create a storage bucket named `lab-submissions`
2. Set bucket to private
3. Configure RLS policies:
   - Learners can upload to their own folder
   - Trainers can read submissions from assigned learners
   - Admins can read all submissions

## API Changes

### Lab Submission Service

**Old Method:**
```javascript
await labSubmissionService.submitLab(userId, courseId, labId, { answer: 'text answer' });
```

**New Method:**
```javascript
await labSubmissionService.submitLab(userId, courseId, labId, docxFile);
```

### Getting File URLs

```javascript
const fileUrl = await labSubmissionService.getSubmissionFileUrl(submission.file_url);
```

## Troubleshooting

### Template Generation Issues

- Ensure markdown files follow the expected format
- Check that Python dependencies are installed
- Verify file paths are correct

### Upload Issues

- Verify Supabase Storage bucket exists
- Check RLS policies are configured
- Ensure file is valid DOCX format

### Download Issues

- Verify template files exist in `labs/templates/`
- Check file permissions
- Ensure web server can serve static files

## Future Enhancements

- Template versioning
- Automatic template updates
- Batch template generation
- Template validation
- Preview before download

