# Content Ingestion Pipeline

## Overview

The Content Ingestion Pipeline automatically processes changes to course content files (`.md` files in `data/` directory) and updates the AI Coach database with:

1. **Re-chunked content** - Content is split into optimal chunks for retrieval
2. **Re-generated embeddings** - Vector embeddings are generated for semantic search
3. **Re-enriched metadata** - Metadata (coverage level, topics, etc.) is extracted
4. **Versioned embeddings** - Old vectors are archived for rollback safety

## Architecture

```
data/ (MD files)
    ↓
watch-content-changes.js (File watcher)
    ↓
content-ingestion-service.js (Pipeline orchestrator)
    ↓
├── Embedding Service (Generate vectors)
├── Chunk Metadata Service (Extract metadata)
└── Supabase (Store chunks with versioning)
```

## Features

- ✅ **Automatic change detection** - Monitors `data/` directory for `.md` file changes
- ✅ **Batch processing** - Processes chunks in configurable batches
- ✅ **Transaction safety** - Rollback capability via version archiving
- ✅ **Version management** - Tracks content versions for each chunk
- ✅ **Comprehensive logging** - Detailed logs for monitoring and debugging
- ✅ **Zero manual steps** - Fully automated pipeline

## Setup

### 1. Database Migration

Run the migration to create tracking tables:

```sql
-- Run in Supabase SQL Editor
\i backend/migration-content-ingestion-tables.sql
```

This creates:
- `ai_coach_content_ingestions` - Tracks ingestion batches
- `ai_coach_content_chunk_versions` - Archives old chunk versions for rollback

### 2. Install Dependencies (Optional)

For better file watching performance, install `chokidar`:

```bash
npm install chokidar
```

### 3. Configuration

Ensure `config/app.config.local.js` contains:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_KEY` for server-side)
- `OPENAI_API_KEY`

## Usage

### Watch Mode (Continuous Monitoring)

```bash
# Watch for changes continuously
node lms/scripts/watch-content-changes.js --watch

# Watch specific course
node lms/scripts/watch-content-changes.js --watch --course-id=seo-master-2026
```

### One-Time Processing

```bash
# Process all files once
node lms/scripts/watch-content-changes.js --once

# Process specific course
node lms/scripts/watch-content-changes.js --once --course-id=seo-master-2026

# Dry run (test without updating database)
node lms/scripts/watch-content-changes.js --once --dry-run
```

### Advanced Options

```bash
# Use LLM for metadata enrichment (slower but more accurate)
node lms/scripts/watch-content-changes.js --once --use-llm

# Custom batch size
node lms/scripts/watch-content-changes.js --once --batch-size=20
```

## Pipeline Steps

### 1. Change Detection

- Monitors `data/courses/*/content/chapters/*.md` and `data/courses/*/content/labs/*.md`
- Detects file changes via file system events
- Calculates content hashes for change detection

### 2. File Validation

- Validates files exist and are readable
- Filters to `.md` files only
- Extracts course ID from file path
- Skips non-content files

### 3. Chunk Extraction

- Reads file content
- Extracts metadata (day, chapter, lab) from file path
- Chunks content into optimal sizes (max 2000 chars per chunk)
- Splits large files by paragraphs

### 4. Change Detection (Database)

- Compares content hashes with existing chunks
- Categorizes chunks as: `new`, `updated`, or `unchanged`
- Only processes changed chunks

### 5. Embedding Generation

- Generates embeddings in batches (default: 10 chunks per batch)
- Uses OpenAI `text-embedding-3-small` model
- Stores embeddings as PostgreSQL arrays

### 6. Metadata Enrichment

- Extracts coverage level (introduction, intermediate, comprehensive, advanced)
- Calculates completeness score
- Identifies primary/secondary topics
- Detects dedicated topic chapters
- Extracts step numbers (for labs)

### 7. Version Management

- Increments `content_version` for updated chunks
- Archives old versions in `ai_coach_content_chunk_versions` table
- Enables rollback to previous versions

### 8. Database Update

- Inserts new chunks
- Updates existing chunks with new version
- Updates ingestion tracking record

## Rollback Safety

### Automatic Version Archiving

When a chunk is updated, the old version is automatically archived in `ai_coach_content_chunk_versions` table.

### Manual Rollback

Roll back a chunk to a previous version:

```sql
-- Roll back chunk to version 2
SELECT rollback_chunk_to_version('chunk-uuid-here', 2);
```

### Batch Rollback

Roll back an entire ingestion batch:

```sql
-- Get chunks updated in a batch
SELECT chunk_id, content_version
FROM ai_coach_content_chunks
WHERE updated_at >= (
    SELECT started_at 
    FROM ai_coach_content_ingestions 
    WHERE batch_id = 'batch-id-here'
);

-- Roll back each chunk (execute for each chunk)
SELECT rollback_chunk_to_version('chunk-uuid', previous_version);
```

## Monitoring

### Check Ingestion Status

```sql
-- Latest ingestion for each course
SELECT 
    course_id,
    batch_id,
    status,
    chunks_processed,
    chunks_new,
    chunks_updated,
    chunks_failed,
    started_at,
    completed_at
FROM ai_coach_content_ingestions
ORDER BY created_at DESC
LIMIT 10;
```

### Check Failed Ingestions

```sql
SELECT *
FROM ai_coach_content_ingestions
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Check Chunk Versions

```sql
-- Chunks with multiple versions
SELECT 
    chunk_id,
    COUNT(*) as version_count,
    MAX(content_version) as latest_version
FROM ai_coach_content_chunk_versions
GROUP BY chunk_id
HAVING COUNT(*) > 1;
```

## Logging

The pipeline logs to console with structured messages:

```
[ContentIngestion] Starting content ingestion pipeline (Batch: batch_1234567890_abc123)
[ContentIngestion] Processing 5 changed file(s)
[ContentIngestion] Files grouped into 1 course(s)
[ContentIngestion] [seo-master-2026] Starting course processing
[ContentIngestion] [seo-master-2026] Extracted 12 chunk(s) from 5 file(s)
[ContentIngestion] [seo-master-2026] 3 new, 2 updated, 7 unchanged
[ContentIngestion] [seo-master-2026] Processing batch 1/1 (5 chunk(s))
[ContentIngestion] Content ingestion pipeline completed (Batch: batch_1234567890_abc123)
[ContentIngestion] Processed: 5, Skipped: 7, Errors: 0
[ContentIngestion] Duration: 12.34s
```

Enable debug logging:

```bash
DEBUG=true node lms/scripts/watch-content-changes.js --once
```

## Cron Integration

Set up a cron job to process changes periodically:

```bash
# Process changes every hour
0 * * * * cd /path/to/project && node lms/scripts/watch-content-changes.js --once

# Process changes every 15 minutes
*/15 * * * * cd /path/to/project && node lms/scripts/watch-content-changes.js --once
```

## Troubleshooting

### Files Not Detected

- Ensure files are in `data/courses/*/content/chapters/` or `data/courses/*/content/labs/`
- Check file extensions are `.md`
- Verify course ID matches in file path

### Embedding Generation Fails

- Check `OPENAI_API_KEY` is configured
- Verify API key has sufficient credits
- Check rate limits (batch size might be too large)

### Database Errors

- Verify Supabase connection
- Check RLS policies (use service key for server-side scripts)
- Ensure migration has been run

### Performance Issues

- Reduce batch size: `--batch-size=5`
- Disable LLM metadata: remove `--use-llm` flag
- Process specific course: `--course-id=course-id`

## Best Practices

1. **Use dry-run first** - Test changes with `--dry-run` before processing
2. **Monitor logs** - Check ingestion status regularly
3. **Version control** - Keep content files in Git for history
4. **Backup database** - Regular backups before major content updates
5. **Batch processing** - Process during off-peak hours for large updates

## API Reference

### `contentIngestionService.processContentUpdate(changedFiles, options)`

Process content update pipeline.

**Parameters:**
- `changedFiles` (Array<string>): Array of file paths
- `options` (Object):
  - `courseId` (string|null): Course ID filter
  - `dryRun` (boolean): Don't update database
  - `batchSize` (number): Chunks per batch (default: 10)
  - `useLLMForMetadata` (boolean): Use LLM for metadata (default: false)
  - `invalidateOldVectors` (boolean): Archive old vectors (default: true)

**Returns:**
- `Promise<Object>`: Processing result with statistics

## Future Enhancements

- [ ] Webhook integration for Git-based triggers
- [ ] Incremental embedding updates (only changed chunks)
- [ ] Parallel processing for multiple courses
- [ ] Content validation (schema checks, link validation)
- [ ] Automatic retry on failures
- [ ] Dashboard for monitoring ingestion status

