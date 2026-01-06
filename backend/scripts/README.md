# AI Coach Data Management Scripts

## Delete Course AI Coach Data

### SQL Script (Manual)
**File:** `delete-course-ai-coach-data.sql`

Run this SQL script in Supabase SQL Editor to delete all AI Coach data for a specific course.

**Usage:**
1. Open Supabase SQL Editor
2. Replace `'seo-master-2026'` with your course ID in the script
3. Execute the script

**What it deletes:**
- Conversation history
- Feedback
- Escalations
- Responses
- Queries
- Chunk versions
- Content chunks
- Ingestion records

## Re-ingest Course Content

### Node.js Script
**File:** `lms/scripts/index-course-content-node.js`

Re-ingests course content from markdown files into the AI Coach database.
**Note:** Use the Node.js-compatible version which uses npm packages instead of CDN imports.

**Usage:**
```bash
node lms/scripts/index-course-content-node.js --course-id=<courseId> --full --force
```

**Example:**
```bash
node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --full --force
```

**What it does:**
1. Scans course directory for markdown files
2. Extracts chunks from each file
3. Generates embeddings for each chunk
4. Enriches chunks with metadata
5. Inserts/updates chunks in database

## Complete Delete and Re-ingest

### Shell Script
**File:** `delete-and-reingest-course.sh`

Combines deletion and re-ingestion in one script.

**Usage:**
```bash
./backend/scripts/delete-and-reingest-course.sh <courseId>
```

**Example:**
```bash
./backend/scripts/delete-and-reingest-course.sh seo-master-2026
```

**Note:** This script requires you to manually run the SQL deletion in Supabase SQL Editor first.

## Step-by-Step Process

1. **Delete existing data:**
   - Open Supabase SQL Editor
   - Edit `backend/scripts/delete-course-ai-coach-data.sql` to set your course ID
   - Execute the SQL script

2. **Re-ingest content:**
   ```bash
   node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --full --force
   ```

3. **Verify:**
   - Check Supabase dashboard for chunk count
   - Test AI Coach with a question

## Important Notes

- **Backup first:** Consider backing up your data before deletion
- **Metadata:** The re-ingestion script uses heuristic metadata analysis (fast but less accurate). For better metadata, you may want to run the full content ingestion service with LLM analysis.
- **Embeddings:** Generating embeddings can take time for large courses
- **RLS Policies:** Ensure your user has proper permissions to insert chunks
