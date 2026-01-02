# AI Coach - Lab Guidance & Conciseness Requirements

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Approved

---

## Overview

This document details the requirements for:
1. **Lab Struggle Detection**: Proactively identify when learners are struggling with labs
2. **Lab Guidance (Not Answers)**: Guide learners without providing direct solutions
3. **Response Conciseness**: Provide complete but concise answers (50-150 words)

---

## 1. Lab Struggle Detection

### 1.1 Detection Criteria

AI Coach must detect when learners are struggling with labs based on:

**Indicators:**
- **Multiple Attempts**: > 2 lab submission attempts with low scores
- **Low Scores**: Average lab score < 50% for recent submissions
- **Repeated Questions**: Multiple questions about the same lab concept
- **Query Patterns**: Questions containing struggle keywords:
  - "stuck"
  - "help"
  - "don't understand"
  - "how to do"
  - "can't figure out"
  - "what should I do"
- **Time vs. Completion**: High time spent on lab but low completion rate

### 1.2 Detection Method

```javascript
async detectLabStruggle(learnerId, courseId) {
    // 1. Get recent lab submissions
    const labSubmissions = await getRecentLabSubmissions(learnerId, courseId);
    
    // 2. Calculate metrics
    const attempts = labSubmissions.length;
    const averageScore = calculateAverageScore(labSubmissions);
    const recentFailures = labSubmissions.filter(s => s.score < 50).length;
    
    // 3. Check for repeated questions
    const repeatedQuestions = await getRepeatedLabQuestions(learnerId, courseId);
    
    // 4. Analyze query patterns
    const struggleKeywords = ['stuck', 'help', 'don\'t understand', 'how to do'];
    const queryHistory = await getRecentQueries(learnerId, courseId);
    const struggleQueries = queryHistory.filter(q => 
        struggleKeywords.some(keyword => q.question.toLowerCase().includes(keyword))
    );
    
    // 5. Calculate struggle score
    const struggleScore = 
        (attempts > 2 ? 0.3 : 0) +
        (averageScore < 50 ? 0.3 : 0) +
        (recentFailures > 1 ? 0.2 : 0) +
        (repeatedQuestions > 0 ? 0.15 : 0) +
        (struggleQueries.length > 0 ? 0.05 : 0);
    
    return {
        detected: struggleScore >= 0.5,
        struggleScore,
        attempts,
        averageScore,
        recentFailures,
        repeatedQuestions: repeatedQuestions.length,
        struggleQueries: struggleQueries.length
    };
}
```

### 1.3 Proactive Guidance

When struggle is detected:

**Proactive Offer:**
> "I notice you're working on Lab X. Would you like some guidance on the concepts it covers?"

**Guidance Approach:**
- Reference relevant course chapters (not lab answers)
- Suggest prerequisite review
- Break down the problem conceptually
- Provide step-by-step thinking process (not solutions)
- Encourage without solving

**Example Proactive Response:**
> "I see you're working on the On-Page Optimization lab. This lab applies concepts from Day 1 → Chapter 2: On-Page SEO Fundamentals. Consider reviewing the sections on title tags and meta descriptions first. Then break the optimization into steps: 1) Analyze current state, 2) Identify improvements, 3) Apply best practices. Your trainer can provide more specific feedback once you submit."

---

## 2. Lab Guidance (Not Answers)

### 2.1 Strict Rules

**NEVER Provide:**
- ❌ Direct answers: "The answer is X"
- ❌ Solutions: "You should do Y"
- ❌ Complete code or implementations
- ❌ Step-by-step solutions
- ❌ Hints that give away the answer

**ALWAYS Provide:**
- ✅ Concept references: "Review Day 2 → Chapter 3 on [topic]"
- ✅ Prerequisite suggestions: "Make sure you understand [concept] first"
- ✅ Thinking process guidance: "Consider: 1) What is the goal? 2) What concepts apply? 3) How can you apply them?"
- ✅ Encouragement: "You're on the right track. Review the fundamentals and try again."

### 2.2 Response Examples

**Good Lab Guidance:**
> "For this lab, focus on the concepts from Day 1 → Chapter 2: On-Page SEO Fundamentals. Review the section on meta tags and header optimization. Break the lab into steps: first identify the key elements, then apply the optimization principles you learned. If you're still stuck, your trainer can provide more specific guidance."

**Bad Lab Guidance (Too Direct):**
> "For this lab, you need to add a title tag with the keyword 'SEO' and a meta description of 155 characters. The header should be H1 with the main keyword."

**Bad Lab Guidance (Too Vague):**
> "Just read the chapter and you'll figure it out."

### 2.3 Intent Classification

When a lab question is detected:

```javascript
async classifyIntent(question, context) {
    // Check if question is about labs
    const labKeywords = ['lab', 'assignment', 'exercise', 'practice'];
    const isLabQuestion = labKeywords.some(keyword => 
        question.toLowerCase().includes(keyword)
    ) || context.currentLab !== null;
    
    if (isLabQuestion) {
        return 'lab_guidance'; // Not 'lab_answer'
    }
    
    // ... other intent classifications
}
```

### 2.4 System Prompt Enhancement

For lab questions, add strict guidance rules:

```
LAB GUIDANCE RULES (CRITICAL):
- NEVER provide direct answers, solutions, or code
- Guide learners to understand concepts, not solve problems
- Reference course chapters that cover the lab topic
- Suggest breaking down the problem into steps
- Encourage review of prerequisites
- Example good response: "Review Day 2 → Chapter 3 on [topic]. This lab tests your understanding of [concept]. Consider: 1) What is the goal? 2) What concepts apply? 3) How can you apply them?"
- Example bad response: "The answer is X" or "You should do Y"
```

### 2.5 Response Validation

Before returning a response, validate it:

```javascript
async validateLabResponse(response, question) {
    // Check for direct answers
    const directAnswerPatterns = [
        /the answer is/i,
        /you should do/i,
        /the solution is/i,
        /here's how to/i,
        /just do this/i
    ];
    
    const hasDirectAnswer = directAnswerPatterns.some(pattern => 
        pattern.test(response)
    );
    
    if (hasDirectAnswer) {
        throw new Error('Response contains direct answer. Regenerate with guidance only.');
    }
    
    // Check for code blocks (if lab involves coding)
    const hasCodeBlock = /```[\s\S]*```/.test(response);
    if (hasCodeBlock) {
        // Allow code examples from course content, but not solutions
        // Validate that code is from course material, not generated
    }
    
    return true;
}
```

---

## 3. Response Conciseness

### 3.1 Conciseness Requirements

**Optimal Length**: 50-150 words  
**Maximum Length**: 300 words  
**Minimum Length**: 30 words (for simple questions)

**Structure:**
1. **Direct Answer** (first sentence)
2. **Supporting Details** (2-3 sentences)
3. **References** (course locations)
4. **Next Steps** (optional, 1-2 sentences)

### 3.2 Response Quality Guidelines

**Good (Concise but Complete):**
> "On-page SEO optimizes elements on your website. Key areas include title tags, meta descriptions, and header tags. See Day 1 → Chapter 2 for details. Practice with the On-Page Optimization lab."

**Bad (Too Verbose):**
> "Well, on-page SEO is a really important concept that many people find confusing, but it's actually quite simple when you think about it. It involves optimizing various elements on your website, which can include many different things like title tags, which are very important, and meta descriptions, which are also important, and header tags, which play a crucial role in helping search engines understand your content structure. There are many other elements too, but these are the most important ones. You should definitely read the chapter on this topic to get a full understanding, and then practice with the lab to reinforce your learning."

**Bad (Too Brief/Incomplete):**
> "On-page SEO is about optimizing your website."

### 3.3 System Prompt Instructions

Add conciseness instructions to system prompt:

```
RESPONSE STYLE:
- Be CONCISE: Get to the point quickly, avoid unnecessary words
- Be COMPLETE: Answer fully, don't leave gaps
- Optimal length: 50-150 words
- Structure: Answer → Details → References → Next Steps
- Use bullet points for lists
- Avoid filler words and repetition
- Don't repeat information already in references
```

### 3.4 Response Validation

Validate response length:

```javascript
function validateResponseLength(response) {
    const wordCount = response.split(/\s+/).length;
    
    if (wordCount < 30) {
        return { valid: false, reason: 'Too brief. Provide more details.' };
    }
    
    if (wordCount > 300) {
        return { valid: false, reason: 'Too verbose. Condense to 50-150 words.' };
    }
    
    if (wordCount >= 50 && wordCount <= 150) {
        return { valid: true, reason: 'Optimal length.' };
    }
    
    // 30-50 or 150-300: acceptable but not optimal
    return { valid: true, reason: 'Acceptable length, but could be optimized.' };
}
```

---

## 4. Integration Points

### 4.1 Query Processing Flow

```
1. Learner submits query
   ↓
2. Query validated
   ↓
3. Intent classified
   ↓
4. **Lab Struggle Detection** (if lab-related)
   - Check lab submission history
   - Analyze struggle indicators
   - Determine if proactive guidance needed
   ↓
5. Build context
   - Include lab struggle context if detected
   ↓
6. Generate response
   - Add lab guidance rules if lab question
   - Add struggle context if detected
   - Add conciseness instructions
   ↓
7. **Validate Response**
   - Check for direct lab answers (reject if found)
   - Ensure conciseness (50-150 words)
   - Verify guidance (not solutions) for labs
   ↓
8. Return response
```

### 4.2 Database Schema

```sql
CREATE TABLE ai_coach_lab_struggle_detection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lab_id VARCHAR(100), -- Specific lab or NULL for overall
    struggle_score DECIMAL(3,2) NOT NULL CHECK (struggle_score >= 0 AND struggle_score <= 1),
    indicators JSONB NOT NULL, -- {attempts, average_score, recent_failures, repeated_questions, time_spent}
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false, -- If learner acknowledged guidance
    UNIQUE(learner_id, course_id, lab_id)
);
```

### 4.3 Service Implementation

**New Service**: `lms/services/lab-struggle-detection-service.js`

```javascript
class LabStruggleDetectionService {
    async detectStruggle(learnerId, courseId)
    async analyzeLabHistory(learnerId, courseId)
    async getStruggleIndicators(learnerId, courseId)
    async getLabPerformanceMetrics(learnerId, courseId)
    async shouldOfferProactiveGuidance(learnerId, courseId)
}
```

---

## 5. Testing Checklist

### 5.1 Lab Struggle Detection
- [ ] Detects multiple failed attempts
- [ ] Detects low average scores
- [ ] Detects repeated questions
- [ ] Detects struggle keywords in queries
- [ ] Calculates accurate struggle score
- [ ] Offers proactive guidance when detected

### 5.2 Lab Guidance
- [ ] Never provides direct answers
- [ ] Never provides solutions
- [ ] References course chapters
- [ ] Suggests prerequisites
- [ ] Provides thinking process guidance
- [ ] Encourages without solving
- [ ] Validates responses before returning

### 5.3 Response Conciseness
- [ ] Responses are 50-150 words (optimal)
- [ ] Responses are complete (answer all parts)
- [ ] Responses are structured (answer → details → references)
- [ ] No unnecessary verbosity
- [ ] No filler words
- [ ] Clear and scannable

---

## 6. Success Metrics

- **Lab Guidance Effectiveness**: > 80% of lab guidance rated as "helpful without giving away answer"
- **Struggle Detection Accuracy**: > 85% of detected struggles are accurate
- **Response Conciseness**: > 90% of responses within 50-150 words
- **Lab Answer Prevention**: 0% of responses contain direct lab answers
- **Learner Satisfaction**: > 75% of learners find lab guidance helpful

---

**Document Status**: ✅ Approved for Implementation

