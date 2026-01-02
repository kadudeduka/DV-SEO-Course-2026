# Backend Scripts

## cleanup_old_submissions.py

Automated cleanup script for old lab submission files.

### Purpose

Deletes lab submission files from Supabase Storage that are older than 30 days. This helps manage storage costs and ensures compliance with data retention policies.

### Setup

1. **Install Dependencies**

```bash
pip install supabase
```

2. **Set Environment Variables**

```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Or create a `.env` file:
```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. **Test Run (Dry Run)**

```bash
python backend/scripts/cleanup_old_submissions.py --dry-run
```

4. **Schedule Daily Execution**

### Cron Setup (Linux/Mac)

Add to crontab:
```bash
crontab -e
```

Add this line (runs daily at 2 AM):
```
0 2 * * * /path/to/project/backend/scripts/cleanup_old_submissions.sh >> /var/log/lab-submission-cleanup.log 2>&1
```

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 2:00 AM
4. Set action: Start a program
5. Program: `python`
6. Arguments: `backend/scripts/cleanup_old_submissions.py`
7. Start in: Project directory path

### Options

- `--days N`: Delete submissions older than N days (default: 30)
- `--dry-run`: Show what would be deleted without actually deleting

### What Gets Deleted

- Files in Supabase Storage bucket `lab-submissions` older than 30 days
- Corresponding database records in `lab_submissions` table

### Safety

- The script only deletes submissions with `file_url` set (DOCX submissions)
- Text-based submissions (legacy) are not affected
- Dry-run mode allows testing without deletion
- Logs all operations for audit trail

### Monitoring

Check logs at: `/var/log/lab-submission-cleanup.log`

Or redirect output:
```bash
python backend/scripts/cleanup_old_submissions.py >> cleanup.log 2>&1
```

