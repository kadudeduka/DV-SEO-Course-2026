# Metadata Extraction Guide

## Overview

The ingestion script now automatically extracts metadata (`primary_topic`, `aliases`, `keywords`) from content to enable course-agnostic retrieval.

## Extraction Logic

### 1. Primary Topic Extraction

**Sources (in priority order):**
1. First heading in node content (`# Topic Name` or `## Topic Name`)
2. Container title (cleaned of "Day X, Chapter Y —" prefix)
3. NULL if neither available

**Example:**
```markdown
## Keyword Research

Content about keyword research...
```
→ `primary_topic`: `"Keyword Research"`

### 2. Aliases Extraction

**Sources:**
1. Lowercase version of primary topic
2. Acronyms from primary topic (e.g., "Search Engine Optimization" → "seo")
3. Common spelling variations (optimization/optimisation, analyze/analyse)
4. Acronyms in parentheses (e.g., "(SEO)" → "seo")

**Example:**
```markdown
## Search Engine Optimization (SEO)

Search Engine Optimization is...
```
→ `aliases`: `["search engine optimization", "seo", "search engine optimisation"]`

**Storage:** Array of lowercase strings

### 3. Keywords Extraction

**Sources (up to 10 keywords per node):**
1. Bold/emphasized terms (`**term**`)
2. First few words from list items
3. Capitalized terms (proper nouns/concepts)

**Example:**
```markdown
**Keyword research** is the process of finding:
- Search volume
- Competition analysis
- User intent
```
→ `keywords`: `["keyword research", "search volume", "competition analysis", "user intent"]`

**Storage:** Array of lowercase strings (max 10)

## Retrieval Priority

When a user asks a question, retrieval searches in this order:

1. **primary_topic** (relevance: 1.0) - Exact/partial match
2. **aliases** (relevance: 0.95) - Array contains concept
3. **keywords** (relevance: 0.8) - Array contains concept

## Re-ingestion Required

After updating the ingestion script, you must re-ingest content:

```bash
# 1. Run aliases migration (if not done)
# (Execute migration-add-aliases-field.sql in Supabase SQL editor)

# 2. Re-ingest content
node scripts/ingest-atomic-content.js --course-id=seo-master-2026

# 3. Verify metadata populated
# (Check content_nodes table for primary_topic, aliases, keywords)
```

## Verification Query

```sql
SELECT 
  canonical_reference,
  primary_topic,
  aliases,
  keywords,
  LEFT(content, 80) as content_preview
FROM content_nodes
WHERE course_id = 'seo-master-2026'
  AND (primary_topic IS NOT NULL OR aliases IS NOT NULL OR keywords IS NOT NULL)
LIMIT 10;
```

## Expected Results

After re-ingestion:
- Most nodes should have `primary_topic` populated
- Nodes with headings/titles should have `aliases`
- Nodes with emphasized terms should have `keywords`

## Testing

After re-ingestion, test with queries:

```
"Tell me more about keyword research?"
→ Should find nodes with:
  - primary_topic LIKE '%keyword research%'
  - OR aliases @> ARRAY['keyword research']
  - OR keywords @> ARRAY['keyword research']
```

## Troubleshooting

### No metadata extracted

**Symptom:** All fields NULL after ingestion

**Causes:**
1. Content has no headings
2. Content is very short
3. No emphasized terms

**Solution:** Content should have clear structure with headings

### Retrieval still returns 0 nodes

**Symptom:** Query returns "Not covered in course material"

**Possible causes:**
1. Metadata not populated (check with verification query)
2. Query concepts don't match metadata (check normalized concepts)
3. Aliases migration not run (check if aliases column exists)

**Debug steps:**
1. Check normalized concepts: Look for `[StrictPipeline] Extracted concepts: [...]` in logs
2. Check metadata: Run verification query
3. Check aliases column: `SELECT aliases FROM content_nodes LIMIT 1;`

