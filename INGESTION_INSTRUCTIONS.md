# Ingestion Instructions - Complete the Metadata Population

## Current Status

✅ **Metadata extraction is working!**
- Day 3 successfully ingested with metadata (461 nodes)
- `primary_topic`, `aliases`, `keywords` are now populated for Day 3

❌ **Remaining days need re-ingestion**
- Days 1-2, 4-30 still have NULL metadata (6,633 nodes)

## What Happened

1. **Updated ingestion script** (`scripts/ingest-atomic-content.js`)
   - Added `extractPrimaryTopic()` - Extracts topic from headings/titles
   - Added `extractAliases()` - Extracts variations, acronyms
   - Added `extractKeywords()` - Extracts emphasized terms, list items
   - Modified node insertion to include metadata fields

2. **Test ingestion completed** (Day 3 only)
   - 461 nodes created with full metadata
   - Verified metadata is correctly populated

## Next Step: Complete Full Re-ingestion

### Option 1: Re-ingest All Days (Recommended)

```bash
cd /Users/kapilnakra/projects/dv-seo-publish
node scripts/ingest-atomic-content.js --course-id=seo-master-2026
```

**Expected:**
- ~7,094 nodes will be re-created with metadata
- Takes ~5-10 minutes
- All existing nodes will be replaced (safe operation)

### Option 2: Re-ingest Specific Days

```bash
# Re-ingest Day 1
node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --day=1

# Re-ingest Day 2
node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --day=2

# ... continue for each day
```

### Option 3: Re-ingest in Batches (If Network Issues)

If you encounter `fetch failed` errors, run outside sandbox:

```bash
# Days 1-5
for day in {1..5}; do
  node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --day=$day
done

# Days 6-10
for day in {6..10}; do
  node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --day=$day
done

# Continue for remaining days...
```

## Verification

After re-ingestion, verify metadata:

```bash
node scripts/verify-metadata.js
```

**Expected output:**
```
Total nodes: 7094
Nodes with primary_topic: 7094 (100%)
Nodes with aliases: 7094 (100%)
Nodes with keywords: ~6800 (95%+)
```

## Testing Retrieval

After full re-ingestion, test the query that previously failed:

**Query:** `"Tell me more about keyword research?"`

**Expected behavior:**
1. Normalization: `"keyword research"` → `"keyword research"` (no typo)
2. Retrieval: Finds Day 3 nodes with:
   - `primary_topic` = "Keyword Research Foundations..."
   - `aliases` = `["keyword research", ...]`
3. Response: Answer with references to Day 3 content

## Why This Fixes the Issue

### Before (No Metadata)
```
User: "Tell me more about keyword research?"
→ Normalized: concepts = ["keyword research"]
→ Retrieval: Searches metadata fields → ALL NULL
→ Result: 0 nodes found
→ Response: "Not covered in course material"
```

### After (With Metadata)
```
User: "Tell me more about keyword research?"
→ Normalized: concepts = ["keyword research"]
→ Retrieval: Searches metadata fields:
   - primary_topic ILIKE '%keyword research%' → MATCH (Day 3)
   - aliases @> ARRAY['keyword research'] → MATCH (Day 3)
→ Result: 119+ nodes found (Day 3 chapters)
→ Response: Answer with Day 3 references
```

## Files Modified

1. ✅ `scripts/ingest-atomic-content.js`
   - Added metadata extraction functions
   - Updated node insertion to include metadata

2. ✅ `scripts/verify-metadata.js` (NEW)
   - Verifies metadata population

3. ✅ `docs/METADATA_EXTRACTION_GUIDE.md` (NEW)
   - Documents extraction logic

## Summary

- **Action Required:** Re-run ingestion for all days
- **Command:** `node scripts/ingest-atomic-content.js --course-id=seo-master-2026`
- **Time:** ~5-10 minutes
- **Result:** All 7,094 nodes will have metadata for course-agnostic retrieval

Once complete, the new retrieval system will work as designed! 🎉

