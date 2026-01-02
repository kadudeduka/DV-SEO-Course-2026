# AI Coach Testing Checklist

**Quick Reference for Testing**

---

## ✅ Pre-Testing Setup

- [ ] OpenAI API key added to `config/app.config.local.js`
- [ ] Database migration executed (`backend/migration-ai-coach-tables.sql`)
- [ ] At least one course indexed (use `/admin/ai-coach/indexing` or CLI)
- [ ] Learner account ready with course allocated

---

## 🧪 Basic Functionality Tests

### Test 1: Widget Appearance
- [ ] Navigate to course page: `/#/courses/seo-master-2026/learn`
- [ ] Widget appears in bottom-right corner
- [ ] Header shows "AI Coach"
- [ ] Course name displayed
- [ ] Welcome message visible

### Test 2: Send Query
- [ ] Type question: "What is SEO?"
- [ ] Click Send or press Enter
- [ ] Loading indicator appears
- [ ] Response received (2-5 seconds)
- [ ] Answer is displayed
- [ ] References shown (if applicable)

### Test 3: Reference Links
- [ ] Ask question that references content
- [ ] Reference link appears (e.g., "📖 Day 1 → Chapter 2")
- [ ] Click reference link
- [ ] Navigates to correct chapter

### Test 4: Feedback
- [ ] Click 👍 (Helpful) or 👎 (Not Helpful)
- [ ] Feedback message appears
- [ ] Check database: `SELECT * FROM ai_coach_feedback ORDER BY created_at DESC LIMIT 1;`

### Test 5: Conversation History
- [ ] Ask multiple questions
- [ ] Close widget
- [ ] Navigate away and back
- [ ] Previous messages load

---

## 🔍 Advanced Tests

### Test 6: Course Switching
- [ ] Ask question in Course A
- [ ] Navigate to Course B
- [ ] Widget updates course name
- [ ] Messages cleared (course-specific)
- [ ] Ask same question
- [ ] Response is course-specific

### Test 7: Lab Guidance
- [ ] Ask: "I need help with Day 1 lab"
- [ ] Response provides guidance (not direct answer)
- [ ] References relevant chapters
- [ ] Does NOT provide solutions

### Test 8: Widget States
- [ ] Click minimize (−)
- [ ] Widget minimizes
- [ ] Click header to expand
- [ ] Click close (×)
- [ ] Widget hides
- [ ] Navigate to course page
- [ ] Widget reappears

### Test 9: Error Handling
- [ ] Disconnect internet
- [ ] Send query
- [ ] Error message appears
- [ ] Reconnect internet
- [ ] Retry query
- [ ] Works correctly

---

## 📱 Responsive Tests

### Test 10: Mobile View
- [ ] Open DevTools → Mobile view (375px)
- [ ] Widget adapts to mobile
- [ ] Full screen overlay on mobile
- [ ] Touch-friendly buttons
- [ ] Text readable

---

## 🐛 Common Issues to Check

### Widget Not Appearing
- [ ] Check browser console (F12)
- [ ] Verify user logged in
- [ ] Verify course allocated
- [ ] Check `window.aiCoachWidgetInstance` exists

### "No relevant content found"
- [ ] Verify course indexed: `SELECT COUNT(*) FROM ai_coach_content_chunks WHERE course_id = 'seo-master-2026';`
- [ ] Check course ID matches

### API Errors
- [ ] Check OpenAI API key in config
- [ ] Verify API key is valid
- [ ] Check network tab for API calls
- [ ] Check OpenAI dashboard for rate limits

### Slow Responses
- [ ] Check response time (< 10 seconds)
- [ ] Check OpenAI API status
- [ ] Check network latency
- [ ] Verify chunk count not too high

---

## 📊 Database Verification

Run these queries to verify data:

```sql
-- Check indexed content
SELECT COUNT(*) as chunks, course_id
FROM ai_coach_content_chunks
GROUP BY course_id;

-- Check recent queries
SELECT question, created_at
FROM ai_coach_queries
ORDER BY created_at DESC
LIMIT 5;

-- Check recent responses
SELECT r.answer, r.confidence_score, r.word_count
FROM ai_coach_responses r
ORDER BY r.created_at DESC
LIMIT 5;

-- Check feedback
SELECT rating, COUNT(*) as count
FROM ai_coach_feedback
GROUP BY rating;
```

---

## ✅ Success Criteria

All basic tests (1-5) should pass:
- ✅ Widget appears and functions
- ✅ Queries work and return responses
- ✅ References are clickable
- ✅ Feedback is collected
- ✅ History loads correctly

If all pass → **Ready for Phase 3!**

---

**Last Updated:** 2025-01-29

