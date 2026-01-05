# Database Migration Instructions

## Migration File: `migration-ai-coach-metadata-fields.sql`

This migration adds metadata fields to the `ai_coach_content_chunks` table to support Phase 4 enhancements.

---

## How to Run the Migration

### Option 1: Supabase SQL Editor (Recommended - Easiest)

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to: **SQL Editor** (in the left sidebar)

2. **Run the Migration**
   - Click **"New Query"**
   - Copy the entire contents of `backend/migration-ai-coach-metadata-fields.sql`
   - Paste into the SQL Editor
   - Click **"Run"** or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)

3. **Verify Success**
   - Check for success message: "Success. No rows returned"
   - Verify fields were added:
     ```sql
     SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = 'ai_coach_content_chunks' 
     AND column_name IN ('coverage_level', 'completeness_score', 'is_dedicated_topic_chapter', 'primary_topic', 'secondary_topics', 'step_number');
     ```

---

### Option 2: psql Command Line

If you have direct database access via psql:

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the migration
\i backend/migration-ai-coach-metadata-fields.sql

# Or paste the SQL directly
\i /full/path/to/backend/migration-ai-coach-metadata-fields.sql
```

---

### Option 3: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project (if not already linked)
supabase link --project-ref [YOUR-PROJECT-REF]

# Run the migration
supabase db push --file backend/migration-ai-coach-metadata-fields.sql
```

---

## What This Migration Does

The migration adds the following fields to `ai_coach_content_chunks`:

1. **`coverage_level`** (VARCHAR) - introduction, intermediate, comprehensive, or advanced
2. **`completeness_score`** (DECIMAL) - Score 0-1 indicating how completely the chunk covers its topic
3. **`is_dedicated_topic_chapter`** (BOOLEAN) - True if chapter is primarily dedicated to a specific topic
4. **`primary_topic`** (VARCHAR) - Main topic/focus of the chapter
5. **`secondary_topics`** (JSONB) - Array of other topics mentioned
6. **`step_number`** (INTEGER) - Step number within a lab (if applicable)

**All fields are nullable** - existing chunks will have NULL values initially.

---

## After Running the Migration

### 1. Verify Migration Success

Run this query to verify all fields were added:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_coach_content_chunks' 
AND column_name IN (
    'coverage_level', 
    'completeness_score', 
    'is_dedicated_topic_chapter', 
    'primary_topic', 
    'secondary_topics', 
    'step_number'
)
ORDER BY column_name;
```

You should see all 6 fields listed.

### 2. Populate Metadata for Existing Chunks (Optional)

After the migration, you can populate metadata for existing chunks using the enrichment script:

```bash
node lms/scripts/enrich-chunks-metadata.js --course-id=seo-master-2026
```

Or populate for all courses (if you have multiple):

```bash
# For a specific course
node lms/scripts/enrich-chunks-metadata.js --course-id=YOUR_COURSE_ID

# With limit (to test first)
node lms/scripts/enrich-chunks-metadata.js --course-id=YOUR_COURSE_ID --limit=10
```

---

## Rollback (If Needed)

If you need to rollback this migration, run:

```sql
-- Remove indexes first
DROP INDEX IF EXISTS idx_chunks_coverage_level;
DROP INDEX IF EXISTS idx_chunks_completeness;
DROP INDEX IF EXISTS idx_chunks_dedicated_topic;
DROP INDEX IF EXISTS idx_chunks_primary_topic;
DROP INDEX IF EXISTS idx_chunks_step_number;

-- Remove columns
ALTER TABLE ai_coach_content_chunks DROP COLUMN IF EXISTS coverage_level;
ALTER TABLE ai_coach_content_chunks DROP COLUMN IF EXISTS completeness_score;
ALTER TABLE ai_coach_content_chunks DROP COLUMN IF EXISTS is_dedicated_topic_chapter;
ALTER TABLE ai_coach_content_chunks DROP COLUMN IF EXISTS primary_topic;
ALTER TABLE ai_coach_content_chunks DROP COLUMN IF EXISTS secondary_topics;
ALTER TABLE ai_coach_content_chunks DROP COLUMN IF EXISTS step_number;
```

**Note**: This will remove all metadata. Only do this if you're sure you want to rollback.

---

## Important Notes

- ✅ **Safe to run multiple times**: The migration uses `IF NOT EXISTS` clauses, so it's safe to run multiple times
- ✅ **No data loss**: All new fields are nullable, existing data is not affected
- ✅ **Backward compatible**: The system works with or without these fields (graceful degradation)
- ⚠️ **Test first**: Consider running on a staging/test database first if available

---

## Troubleshooting

### Error: "permission denied"
- Ensure you're using a user with sufficient permissions (admin/service role key)
- In Supabase SQL Editor, you should have admin access by default

### Error: "relation does not exist"
- Ensure the `ai_coach_content_chunks` table exists
- Run `backend/migration-ai-coach-tables.sql` first if the table doesn't exist

### Error: "column already exists"
- This is fine - the migration uses `IF NOT EXISTS`, so it won't fail
- The column already exists, which is expected if you've run the migration before

---

## Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify table exists: `SELECT * FROM ai_coach_content_chunks LIMIT 1;`
3. Check RLS policies aren't blocking: The migration should run with service role key

