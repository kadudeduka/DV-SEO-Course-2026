# AI Coach - Quick Start Guide

**Version:** 1.0  
**Date:** 2025-01-29

---

## Prerequisites

1. ✅ Database migration completed (`backend/migration-ai-coach-tables.sql`)
2. ✅ OpenAI API key (get from https://platform.openai.com/api-keys)
3. ✅ At least one course in the system
4. ✅ A learner account with course allocated

---

## Step 1: Configure OpenAI API Key

### Option A: Using Config File (Recommended for Local Development)

1. Open `config/app.config.local.js`
2. Add your OpenAI API key:

```javascript
window.LMS_CONFIG = {
    // ... existing config ...
    OPENAI_API_KEY: 'sk-proj-your-actual-api-key-here'
};
```

3. Save the file
4. Refresh the browser

### Option B: Using Environment Variables (For Production)

Set the environment variable:
```bash
export VITE_OPENAI_API_KEY=sk-proj-your-actual-api-key-here
```

Or add to `.env` file:
```
VITE_OPENAI_API_KEY=sk-proj-your-actual-api-key-here
```

---

## Step 2: Index Course Content

### Option A: Using Admin UI (Recommended)

1. Log in as admin
2. Navigate to: `/#/admin/ai-coach/indexing`
3. Select a course from the dropdown
4. Choose indexing mode:
   - **Full**: Re-indexes entire course (use for first time)
   - **Incremental**: Only indexes new/updated content
5. Click "Start Indexing"
6. Wait for completion (check progress bar)

### Option B: Using CLI Script (Node.js)

**First, install dependencies:**
```bash
npm install
```

**Then run indexing:**
```bash
# Full indexing
node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --full

# Incremental indexing
node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --incremental

# Check status
node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --status
```

**Note:** Use `index-course-content-node.js` (not `index-course-content.js`) for Node.js CLI usage.

### Verify Indexing

Run this SQL query in Supabase:

```sql
SELECT COUNT(*) as chunks, course_id
FROM ai_coach_content_chunks
GROUP BY course_id;
```

You should see at least one row with chunks > 0.

---

## Step 3: Test the Widget

1. **Log in as a learner** (user with course allocated)

2. **Navigate to a course page:**
   - `/#/courses/seo-master-2026/learn`
   - Or any chapter page: `/#/courses/seo-master-2026/content/day1-ch1`

3. **Look for the AI Coach widget** in the bottom-right corner

4. **Test a query:**
   - Type: "What is SEO?"
   - Click Send or press Enter
   - Wait for response (should take 2-5 seconds)

---

## Troubleshooting

### Widget Not Appearing

**Check:**
1. Browser console for errors (F12 → Console)
2. User is logged in
3. Course is allocated to user
4. OpenAI API key is configured

**Common Errors:**
- `[LLMService] OpenAI API key not found` → Add API key to config
- `Failed to fetch` → Check network connectivity
- `401 Unauthorized` → Invalid API key

### "No relevant content found"

**Check:**
1. Course content is indexed (Step 2)
2. Course ID matches between allocation and chunks
3. Database has chunks: `SELECT COUNT(*) FROM ai_coach_content_chunks WHERE course_id = 'seo-master-2026';`

### Slow Responses (> 10 seconds)

**Possible Causes:**
- Large course content (too many chunks)
- Network latency
- OpenAI API rate limits

**Solutions:**
- Check OpenAI dashboard for rate limits
- Reduce chunk size in indexing
- Check network connection

### Responses Not Course-Specific

**Check:**
1. Widget detects correct course ID
2. Course ID in query matches course ID in chunks
3. Context builder includes course filter

---

## Testing Checklist

- [ ] OpenAI API key configured
- [ ] Course content indexed
- [ ] Widget appears on course page
- [ ] Can send a query
- [ ] Receives response
- [ ] References are clickable
- [ ] Feedback buttons work
- [ ] Conversation history loads
- [ ] Widget updates on course change

---

## Next Steps

Once basic testing passes:
1. Test with different question types
2. Test lab guidance (should not give direct answers)
3. Test escalation (low confidence queries)
4. Test feedback collection
5. Proceed to Phase 3 (Trainer Personalization)

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs
3. Check OpenAI API dashboard
4. Review `docs/AI_COACH_TESTING_GUIDE.md` for detailed troubleshooting

---

**Ready to test!** 🚀

