# Content Ingestion Pipeline - Quick Start

## Prerequisites

1. **Node.js 18+** installed
2. **Configuration** in `config/app.config.local.js`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_KEY`)
   - `OPENAI_API_KEY`
3. **Database migration** run (see below)

## Quick Setup (5 minutes)

### 1. Run Database Migration

```sql
-- In Supabase SQL Editor, run:
\i backend/migration-content-ingestion-tables.sql
```

Or copy-paste the SQL from `backend/migration-content-ingestion-tables.sql`.

### 2. Install Optional Dependencies (Recommended)

```bash
npm install chokidar
```

This improves file watching performance.

### 3. Test with Dry Run

```bash
npm run ingest-content:dry-run
```

This processes files without updating the database.

### 4. Process All Content

```bash
npm run ingest-content
```

This processes all `.md` files in `data/courses/*/content/` directories.

### 5. Watch for Changes (Continuous)

```bash
npm run watch-content
```

This monitors the `data/` directory and automatically processes changes.

## Common Commands

```bash
# Process once
npm run ingest-content

# Watch for changes
npm run watch-content

# Dry run (test)
npm run ingest-content:dry-run

# Process specific course
node lms/scripts/watch-content-changes.js --once --course-id=seo-master-2026

# Use LLM for metadata (slower but more accurate)
node lms/scripts/watch-content-changes.js --once --use-llm
```

## What Gets Processed?

The pipeline processes:
- ✅ `data/courses/*/content/chapters/*.md` - Chapter files
- ✅ `data/courses/*/content/labs/*.md` - Lab files
- ❌ Other `.md` files (skipped)
- ❌ Non-markdown files (skipped)

## What Happens?

1. **File Detection** - Scans for `.md` files in content directories
2. **Change Detection** - Compares content hashes with database
3. **Chunking** - Splits content into optimal chunks (max 2000 chars)
4. **Embedding** - Generates vector embeddings (OpenAI)
5. **Metadata** - Extracts topics, coverage level, completeness
6. **Versioning** - Archives old versions for rollback
7. **Database Update** - Inserts/updates chunks in Supabase

## Monitoring

### Check Status

```sql
-- Latest ingestion status
SELECT * FROM ai_coach_content_ingestions 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Chunks

```sql
-- Count chunks per course
SELECT course_id, COUNT(*) as chunk_count
FROM ai_coach_content_chunks
GROUP BY course_id;
```

## Troubleshooting

### "Error loading content ingestion service"

- Ensure you're running from project root
- Check Node.js version: `node --version` (should be 18+)
- Verify `lms/services/content-ingestion-service.js` exists

### "SUPABASE_URL is not configured"

- Create `config/app.config.local.js` with Supabase credentials
- Or set environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`

### "No files to process"

- Check files are in `data/courses/*/content/chapters/` or `data/courses/*/content/labs/`
- Verify file extensions are `.md`
- Check course ID matches in file path

### Embedding generation fails

- Verify `OPENAI_API_KEY` is set
- Check API key has credits
- Reduce batch size: `--batch-size=5`

## Next Steps

- Read full documentation: [CONTENT_INGESTION_PIPELINE.md](./CONTENT_INGESTION_PIPELINE.md)
- Set up cron job for automatic processing
- Monitor ingestion status regularly
- Use rollback if needed (see documentation)

## Support

For issues or questions:
1. Check logs for error messages
2. Review [CONTENT_INGESTION_PIPELINE.md](./CONTENT_INGESTION_PIPELINE.md)
3. Check database migration was run
4. Verify configuration is correct

