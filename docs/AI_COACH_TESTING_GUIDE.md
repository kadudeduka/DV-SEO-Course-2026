# AI Coach Testing Guide

**Version:** 1.0  
**Date:** 2025-01-29

---

## Pre-Testing Checklist

### 1. Environment Setup

- [ ] **OpenAI API Key**: Ensure `VITE_OPENAI_API_KEY` is set in your environment
  - Check `config/app.config.local.js` or environment variables
  - The key should start with `sk-`
  
- [ ] **Database Migration**: Ensure AI Coach tables are created
  - Run `backend/migration-ai-coach-tables.sql` in Supabase
  - Verify tables exist: `ai_coach_queries`, `ai_coach_responses`, `ai_coach_content_chunks`, etc.

- [ ] **Course Content Indexed**: At least one course should be indexed
  - Use admin UI: Navigate to `/admin/ai-coach/indexing`
  - Or use CLI: `node lms/scripts/index-course-content.js --course-id=seo-master-2026 --full`
  - Verify chunks exist in `ai_coach_content_chunks` table

### 2. User Setup

- [ ] **Test User**: Have a learner account ready
  - User should be approved
  - User should have at least one course allocated
  - User should be on an active course page

---

## Testing Steps

### Test 1: Widget Initialization

**Steps:**
1. Log in as a learner
2. Navigate to a course page: `/#/courses/seo-master-2026/learn`
3. Check if AI Coach widget appears in bottom-right corner

**Expected Result:**
- Widget appears with header "AI Coach"
- Course name displayed below header
- Welcome message visible
- Input field and Send button visible

**If widget doesn't appear:**
- Check browser console for errors
- Verify user is logged in
- Verify course is allocated to user
- Check if widget container exists in DOM

---

### Test 2: Basic Query

**Steps:**
1. Type a question in the input field: "What is SEO?"
2. Click Send or press Enter
3. Wait for response

**Expected Result:**
- Loading indicator appears ("Thinking...")
- AI response appears with answer
- References to course content shown
- Feedback buttons (👍 👎) visible

**If query fails:**
- Check browser console for errors
- Verify OpenAI API key is configured
- Check network tab for API calls
- Verify course content is indexed

---

### Test 3: Course-Specific Responses

**Steps:**
1. Ask a question about current course
2. Navigate to a different course
3. Ask the same question

**Expected Result:**
- Widget updates to show new course name
- Messages are cleared (course-specific isolation)
- Response is specific to the new course

---

### Test 4: Reference Links

**Steps:**
1. Ask a question that references course content
2. Click on a reference link (e.g., "📖 Day 1 → Chapter 2")

**Expected Result:**
- Reference link is clickable
- Clicking navigates to the referenced chapter
- URL updates correctly

---

### Test 5: Lab Guidance (Not Answers)

**Steps:**
1. Ask a question about a lab: "I need help with the Day 1 lab"
2. Check the response

**Expected Result:**
- Response provides guidance, not direct answers
- References relevant course chapters
- Suggests review of prerequisites
- Does NOT provide solutions or code

**If direct answers appear:**
- Check LLM service validation
- Verify lab guidance rules in system prompt

---

### Test 6: Feedback Collection

**Steps:**
1. Ask a question and receive a response
2. Click 👍 (Helpful) or 👎 (Not Helpful)
3. Check database

**Expected Result:**
- Feedback button shows "Thanks for your feedback!"
- Feedback record created in `ai_coach_feedback` table
- Rating stored correctly

---

### Test 7: Conversation History

**Steps:**
1. Ask multiple questions
2. Close widget
3. Navigate away and come back
4. Reopen widget

**Expected Result:**
- Previous conversation history loads
- Messages appear in correct order
- User and AI messages both visible

---

### Test 8: Widget States

**Steps:**
1. Click minimize button (−)
2. Click header to expand
3. Click close button (×)
4. Navigate to course page again

**Expected Result:**
- Widget minimizes to header only
- Clicking header expands widget
- Close button hides widget
- Widget reappears on course page navigation

---

### Test 9: Mobile Responsiveness

**Steps:**
1. Open browser DevTools
2. Switch to mobile view (375px width)
3. Navigate to course page
4. Test widget interaction

**Expected Result:**
- Widget adapts to mobile layout
- Full screen overlay on mobile
- Touch-friendly buttons
- Text readable on small screens

---

### Test 10: Error Handling

**Steps:**
1. Disconnect internet
2. Try to ask a question
3. Reconnect internet
4. Try again

**Expected Result:**
- Error message displayed gracefully
- Widget doesn't crash
- Can retry after reconnection

---

## Common Issues & Solutions

### Issue: Widget Not Appearing

**Possible Causes:**
- User not logged in
- Course not allocated
- JavaScript error in console
- Widget container not created

**Solutions:**
1. Check browser console for errors
2. Verify user authentication
3. Verify course allocation
4. Check if `window.aiCoachWidgetInstance` exists

### Issue: "No relevant content found"

**Possible Causes:**
- Course content not indexed
- No chunks in database
- Course ID mismatch

**Solutions:**
1. Index course content: `/admin/ai-coach/indexing`
2. Check `ai_coach_content_chunks` table
3. Verify course ID matches

### Issue: OpenAI API Error

**Possible Causes:**
- API key not configured
- Invalid API key
- Rate limit exceeded
- Network issue

**Solutions:**
1. Check `VITE_OPENAI_API_KEY` in config
2. Verify API key is valid
3. Check OpenAI account for rate limits
4. Check network connectivity

### Issue: Responses Too Long or Too Short

**Possible Causes:**
- LLM not following conciseness instructions
- Token limits not enforced

**Solutions:**
1. Check response word count (should be 50-150 words)
2. Verify system prompt includes conciseness rules
3. Check `word_count` in database

### Issue: Direct Lab Answers Appearing

**Possible Causes:**
- Lab guidance validation not working
- System prompt not strict enough

**Solutions:**
1. Check `_checkForDirectAnswer` in LLM service
2. Verify lab guidance rules in prompt
3. Test with lab-related questions

---

## Database Verification Queries

### Check Indexed Content
```sql
SELECT COUNT(*) as total_chunks, course_id
FROM ai_coach_content_chunks
GROUP BY course_id;
```

### Check Queries
```sql
SELECT * FROM ai_coach_queries
ORDER BY created_at DESC
LIMIT 10;
```

### Check Responses
```sql
SELECT q.question, r.answer, r.confidence_score, r.word_count
FROM ai_coach_queries q
JOIN ai_coach_responses r ON r.query_id = q.id
ORDER BY q.created_at DESC
LIMIT 10;
```

### Check Feedback
```sql
SELECT rating, COUNT(*) as count
FROM ai_coach_feedback
GROUP BY rating;
```

---

## Performance Testing

### Response Time
- Target: < 3 seconds for 95% of queries
- Measure: Check `response_time_ms` in response object
- Monitor: Browser DevTools Network tab

### Token Usage
- Check `tokens_used` in response
- Monitor OpenAI usage dashboard
- Target: ≤ $0.05 per active learner per month

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Next Steps After Testing

1. **Fix any bugs** found during testing
2. **Optimize performance** if response times are slow
3. **Adjust prompts** if responses don't meet quality standards
4. **Index more courses** if needed
5. **Proceed to Phase 3** (Trainer Personalization) if all tests pass

---

**Document Status**: ✅ Ready for Testing

