# Atomic Content Architecture - Quick Start Guide

**Status:** ✅ Implementation Complete  
**Date:** 2025-01-29

---

## 🎯 Overview

The atomic content architecture has been fully implemented to fix reference resolution permanently. All components are ready for use.

---

## 📋 Implementation Checklist

✅ **Database Schema** - `backend/migration-atomic-content-architecture.sql`  
✅ **Reference Resolution Service** - `lms/services/reference-resolution-service.js`  
✅ **Canonical Reference Registry** - `lms/services/canonical-reference-registry-service.js`  
✅ **Node Retrieval Service** - `lms/services/node-retrieval-service.js`  
✅ **Strict Pipeline Service** - `lms/services/strict-pipeline-service.js`  
✅ **AI Coach Integration** - `lms/services/ai-coach-service.js` (new `processQueryStrict()` method)  
✅ **LLM Prompt Updates** - `lms/services/llm-service.js`  
✅ **Content Ingestion Pipeline** - `scripts/ingest-atomic-content.js`

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

```sql
-- Execute in Supabase SQL Editor
\i backend/migration-atomic-content-architecture.sql
```

**Or copy-paste the SQL file contents into Supabase SQL Editor and run.**

**Verification:**
```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('content_nodes', 'content_containers', 'canonical_reference_registry', 'content_node_references');
```

---

### Step 2: Configure Environment (If Needed)

The script will automatically load configuration from:
1. Environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
2. `config/app.config.local.js` file
3. `config/.env` file

If you get "SUPABASE_URL and SUPABASE_ANON_KEY must be set" error, set them:

**Option 1: Environment Variables**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

**Option 2: Use Existing Config File**
The script will automatically read from `config/app.config.local.js` if it exists.

### Step 3: Ingest Content

**Dry Run (Test First):**
```bash
node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --dry-run
```

**Full Ingestion:**
```bash
node scripts/ingest-atomic-content.js --course-id=seo-master-2026
```

**Ingest Specific Day:**
```bash
node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --day=1
```

**Note:** The script will automatically load Supabase credentials from:
- Environment variables
- `config/app.config.local.js` (if exists)
- `config/.env` (if exists)

**Verification:**
```sql
-- Check nodes were created
SELECT COUNT(*) FROM content_nodes WHERE course_id = 'seo-master-2026';
SELECT COUNT(*) FROM canonical_reference_registry WHERE course_id = 'seo-master-2026';
SELECT COUNT(*) FROM content_containers WHERE course_id = 'seo-master-2026';
```

---

### Step 4: Update AI Coach to Use Strict Pipeline

**Option A: Use Strict Pipeline for All Queries (Recommended)**

Update the AI Coach widget or service to call `processQueryStrict()` instead of `processQuery()`:

```javascript
// In lms/components/ai-coach/learner/ai-coach-widget.js
// Change from:
const response = await aiCoachService.processQuery(
    this.currentUser.id,
    this.currentCourseId,
    question
);

// To:
const response = await aiCoachService.processQueryStrict(
    this.currentUser.id,
    this.currentCourseId,
    question
);
```

**Option B: Gradual Migration (A/B Testing)**

Add a feature flag to switch between old and new:

```javascript
const useStrictPipeline = true; // Feature flag

const response = useStrictPipeline
    ? await aiCoachService.processQueryStrict(learnerId, courseId, question)
    : await aiCoachService.processQuery(learnerId, courseId, question);
```

---

## 🔍 Testing the Implementation

### Test 1: Explicit Reference Resolution

**Query:** "Step 3 of Lab 1 on Day 20"

**Expected:**
- ✅ Resolves to canonical reference: `D20.L1.S3`
- ✅ Returns exact lab step content
- ✅ System-assembled reference: "Day 20 → Lab 1 → Step 3"

### Test 2: Semantic Search

**Query:** "What is AEO?"

**Expected:**
- ✅ Finds relevant nodes via semantic search
- ✅ Returns nodes from Day 20 (dedicated AEO chapter)
- ✅ System-assembled references (no LLM-generated refs)

### Test 3: No Content Found

**Query:** "How do I implement machine learning for SEO?"

**Expected:**
- ✅ Returns: "I don't have information about this topic in the course material..."
- ✅ No hallucinated references
- ✅ Clear error message

---

## 📊 Architecture Benefits

### Before (Chunk-Based)
- ❌ Large chunks (2000+ words)
- ❌ LLM infers references → hallucination
- ❌ Vague citations ("Day 1 → Chapter 1")
- ❌ Multiple concepts per chunk

### After (Atomic Nodes)
- ✅ Atomic nodes (50-200 words)
- ✅ System-assembled references → no hallucination
- ✅ Precise citations ("Day 20 → Chapter 1 → Concept 1")
- ✅ One idea per node

---

## 🔧 Configuration

### Supabase Credentials

The ingestion script automatically loads credentials from (in order):
1. **Environment Variables:**
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_ANON_KEY="your-anon-key"
   ```

2. **config/app.config.local.js** (if exists):
   ```javascript
   window.LMS_CONFIG = {
       SUPABASE_URL: 'https://your-project.supabase.co',
       SUPABASE_ANON_KEY: 'your-anon-key'
   };
   ```

3. **config/.env** (if exists):
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

### Feature Flags

You can control pipeline behavior via options:

```javascript
const response = await aiCoachService.processQueryStrict(
    learnerId,
    courseId,
    question,
    {
        model: 'gpt-4o-mini', // or 'gpt-4-turbo'
        isLabGuidance: false,
        trainerPersonalization: null
    }
);
```

---

## 📝 Key Files Reference

| File | Purpose |
|------|---------|
| `backend/migration-atomic-content-architecture.sql` | Database schema |
| `lms/services/reference-resolution-service.js` | Explicit reference pattern matching |
| `lms/services/canonical-reference-registry-service.js` | Reference lookup and formatting |
| `lms/services/node-retrieval-service.js` | Semantic search for nodes |
| `lms/services/strict-pipeline-service.js` | Complete two-step pipeline |
| `lms/services/ai-coach-service.js` | Main service (has `processQueryStrict()` method) |
| `scripts/ingest-atomic-content.js` | Content migration script |

---

## 🐛 Troubleshooting

### Issue: "Reference not found" errors

**Solution:** Run content ingestion for the course:
```bash
node scripts/ingest-atomic-content.js --course-id=seo-master-2026
```

### Issue: "No nodes found" for valid questions

**Solution:** 
1. Check if content was ingested: `SELECT COUNT(*) FROM content_nodes WHERE course_id = 'seo-master-2026';`
2. Verify embeddings were generated (if using semantic search)
3. Check course_id matches between ingestion and queries

### Issue: LLM still generating references

**Solution:** 
1. Verify `processQueryStrict()` is being called (not `processQuery()`)
2. Check LLM service reference stripping is working
3. Review system prompts in `strict-pipeline-service.js`

---

## ✅ Success Criteria

After deployment, verify:

1. ✅ **Reference Accuracy:** 100% of references are correct (no hallucination)
2. ✅ **Reference Precision:** References point to specific nodes, not entire chapters
3. ✅ **System Ownership:** All references are system-assembled, never LLM-generated
4. ✅ **Deterministic Resolution:** Same question → same references (no randomness)
5. ✅ **Performance:** Reference resolution < 100ms

---

## 📚 Next Steps

1. **Run Database Migration** - Execute SQL migration in Supabase
2. **Ingest Content** - Run ingestion script for all courses
3. **Update AI Coach** - Switch to `processQueryStrict()` method
4. **Test & Monitor** - Verify reference accuracy
5. **Gradual Rollout** - Use feature flags for A/B testing

---

## 🔗 Related Documentation

- `ATOMIC_CONTENT_ARCHITECTURE_IMPLEMENTATION_STATUS.md` - Full implementation status
- `docs/ATOMIC_CONTENT_ARCHITECTURE.md` - Architecture design
- `docs/REFERENCE_RESOLUTION_ENGINE.md` - Reference resolution design
- `docs/AI_COACH_STRICT_PIPELINE.md` - Pipeline design

---

**Implementation Status:** ✅ **COMPLETE** - Ready for deployment!

