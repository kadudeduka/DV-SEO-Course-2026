# AI Coach Safety & Reliability Guardrails

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Enforceable  
**Author:** Safety & Reliability Engineering

---

## Table of Contents

1. [Overview](#overview)
2. [Forbidden Behaviors](#forbidden-behaviors)
3. [Allowed Behaviors](#allowed-behaviors)
4. [Failure Modes & Messages](#failure-modes--messages)
5. [Enforcement Mechanisms](#enforcement-mechanisms)
6. [Examples](#examples)

---

## Overview

This document defines **hard guardrails** for the AI Coach system. These rules are:
- **Non-negotiable**: Cannot be bypassed or overridden
- **Enforceable**: Implemented in code or prompt engineering
- **Fail-fast**: System must fail explicitly, never silently degrade
- **Auditable**: All violations must be logged

### Core Principles

1. **No Silent Failures**: Every failure must produce an explicit error message
2. **No Hallucination**: Answers must be grounded in retrieved course content
3. **No Access Violations**: Learners can only access their allocated courses
4. **No Lab Answer Leakage**: Never provide direct lab solutions
5. **No Out-of-Scope Answers**: Only answer course-related questions

---

## Forbidden Behaviors

### 1. Content & Answer Generation

#### 1.1 Hallucination
**Rule:** AI Coach MUST NOT generate answers without supporting content chunks.

**Enforcement:**
- Minimum 1 chunk required (enforced in `answer-governance-service.js`)
- Confidence score must be calculated from chunk similarity
- If no chunks found → BLOCK answer generation

**Failure Message:**
```
"No relevant content found in the course material. Please try rephrasing your question or contact your trainer for assistance."
```

**Code Location:** `lms/services/answer-governance-service.js` → `_checkMinimumChunks()`

---

#### 1.2 Out-of-Scope Answers
**Rule:** AI Coach MUST NOT answer questions outside course scope.

**Enforcement:**
- Intent classification must be validated
- If `intent === 'out_of_scope'` → REJECT query
- Additional validation: Check if content exists for topic keywords

**Failure Message:**
```
"This question is outside the scope of the course. Please ask questions related to the course content."
```

**Code Location:** `lms/services/ai-coach-service.js` → Lines 127-134

---

#### 1.3 Lab Answer Provision
**Rule:** AI Coach MUST NOT provide direct lab answers or solutions.

**Enforcement:**
- Detect lab-specific questions
- Provide guidance/hints only, never solutions
- Block if question explicitly asks for answers

**Failure Message:**
```
"I can provide guidance and hints for labs, but I cannot give you the direct answer. Try breaking down the problem into smaller steps, or review the relevant course chapters."
```

**Code Location:** `lms/services/answer-governance-service.js` → `_invariantLabSafety()`

---

#### 1.4 Cross-Course Access
**Rule:** AI Coach MUST NOT answer questions about unallocated courses.

**Enforcement:**
- Validate course allocation before processing
- Check `course_allocations` table
- Reject if course not allocated to learner

**Failure Message:**
```
"This course is not allocated to you. Please contact your administrator."
```

**Code Location:** `lms/services/query-processor-service.js` → `validateQuery()`

---

#### 1.5 Future Content Access
**Rule:** AI Coach MUST NOT provide content from chapters not yet accessible to learner.

**Enforcement:**
- Filter chunks by learner progress
- Exclude future chapters from context
- Block if question explicitly references future content

**Failure Message:**
```
"This content is not yet available in your learning path. Please complete the prerequisite chapters first."
```

**Code Location:** `lms/services/context-builder-service.js` → Progress filtering

---

### 2. Data & Privacy

#### 2.1 Cross-Learner Data Access
**Rule:** AI Coach MUST NOT access or expose other learners' data.

**Enforcement:**
- Row-Level Security (RLS) policies on all tables
- All queries filtered by `learner_id`
- No cross-learner queries in database

**Failure Message:**
```
"Access denied. You can only access your own course data."
```

**Code Location:** Database RLS policies in `backend/schema.sql`

---

#### 2.2 Trainer-Only Content Exposure
**Rule:** AI Coach MUST NOT expose trainer-only content to learners.

**Enforcement:**
- Filter chunks by `content_type` and access level
- Exclude trainer notes from retrieval
- Validate content visibility before inclusion

**Failure Message:**
```
"This content is not available. Please contact your trainer for assistance."
```

**Code Location:** `lms/services/retrieval-service.js` → Content filtering

---

### 3. System Integrity

#### 3.1 Missing Lab Content
**Rule:** AI Coach MUST NOT generate answers when specific lab content is missing.

**Enforcement:**
- If question references "Day X, Lab Y" → Must find exact lab content
- No fallback to similar labs
- Block answer generation if exact match not found

**Failure Message:**
```
"No content found for Day {day}, Lab {lab}. Please verify the Day and Lab numbers are correct, or contact your trainer for assistance."
```

**Code Location:** `lms/services/ai-coach-service.js` → Lines 279-344

---

#### 3.2 Topic Integrity Violation
**Rule:** AI Coach MUST NOT answer questions about topics not present in retrieved chunks.

**Enforcement:**
- Validate topic keywords against chunk content
- If topic modifiers present (e.g., "comprehensive", "advanced") → Require matching coverage level
- Block if topic not found in chunks

**Failure Message:**
```
"I couldn't find comprehensive content about '{topic}' in the course material. The available content may not cover this topic in sufficient detail. Please try rephrasing your question or contact your trainer."
```

**Code Location:** `lms/services/answer-governance-service.js` → `_invariantTopicIntegrity()`

---

#### 3.3 Reference Mismatch
**Rule:** AI Coach MUST NOT provide content that doesn't match specific references (Day, Chapter, Lab).

**Enforcement:**
- If question specifies "Day X, Chapter Y" → Chunks must match exactly
- Validate chunk metadata against parsed references
- Block if mismatch detected

**Failure Message:**
```
"I couldn't find content matching Day {day}, Chapter {chapter}. Please verify the Day and Chapter numbers are correct."
```

**Code Location:** `lms/services/answer-governance-service.js` → `_invariantReferenceIntegrity()`

---

#### 3.4 Course Scope Violation
**Rule:** AI Coach MUST NOT use chunks from wrong course.

**Enforcement:**
- All chunks must have matching `course_id`
- Filter chunks by course before retrieval
- Block if chunks from wrong course detected

**Failure Message:**
```
"Content mismatch detected. This question cannot be answered with the available course material."
```

**Code Location:** `lms/services/answer-governance-service.js` → `_invariantCourseScope()`

---

#### 3.5 Course Anchoring Failure
**Rule:** AI Coach MUST NOT answer questions about named concepts without dedicated course chapters.

**Enforcement:**
- Detect named concepts (e.g., "AEO", "Technical SEO")
- Require dedicated chapter chunks for named concepts
- Block if no dedicated chapters found

**Failure Message:**
```
"I couldn't find dedicated course content for '{concept}'. This concept may be introduced in a later chapter or may require trainer assistance."
```

**Code Location:** `lms/services/answer-governance-service.js` → `_invariantCourseAnchoring()`

---

#### 3.6 Procedural Contract Violation
**Rule:** AI Coach MUST NOT answer "how-to" questions without step-by-step content.

**Enforcement:**
- Detect procedural queries (depth classification)
- Require both conceptual AND implementation chunks
- Block if procedural contract not met

**Failure Message:**
```
"I couldn't find complete step-by-step instructions for this. The available content may not cover the full procedure. Please try rephrasing your question or contact your trainer."
```

**Code Location:** `lms/services/answer-governance-service.js` → `_validateProceduralContract()`

---

### 4. Input Validation

#### 4.1 Empty or Invalid Queries
**Rule:** AI Coach MUST NOT process empty, too short, or too long queries.

**Enforcement:**
- Minimum length: 3 characters
- Maximum length: 1000 characters
- Reject if invalid

**Failure Message:**
```
"Question too short" (if < 3 chars)
"Question too long (max 1000 characters)" (if > 1000 chars)
```

**Code Location:** `lms/services/query-processor-service.js` → `validateQuery()`

---

#### 4.2 Prompt Injection
**Rule:** AI Coach MUST NOT execute instructions embedded in user queries.

**Enforcement:**
- Sanitize user input before sending to LLM
- Use system prompts to prevent manipulation
- Monitor for suspicious patterns

**Failure Message:**
```
"Invalid query format. Please ask a question about the course content."
```

**Code Location:** `lms/services/query-processor-service.js` → `preprocessQuery()`

---

### 5. System Failures

#### 5.1 Silent Degradation
**Rule:** AI Coach MUST NOT silently fail or degrade functionality.

**Enforcement:**
- All errors must be logged
- All failures must return explicit error messages
- No fallback to degraded mode without notification

**Failure Message:**
```
"AI Coach service is temporarily unavailable. Please try again later or contact support."
```

**Code Location:** All service methods must have try-catch with explicit error handling

---

#### 5.2 Timeout Without Notification
**Rule:** AI Coach MUST NOT timeout without informing the user.

**Enforcement:**
- Set timeout: 120 seconds
- Return timeout error message
- Log timeout for monitoring

**Failure Message:**
```
"Query processing timed out after 120 seconds. This may happen with complex queries. Please try rephrasing your question or try again."
```

**Code Location:** `lms/components/ai-coach/learner/ai-coach-widget.js` → Lines 612-616

---

#### 5.3 API Failure Without Fallback
**Rule:** AI Coach MUST NOT fail silently when LLM API fails.

**Enforcement:**
- Catch all API errors
- Return explicit error message
- Log error details for debugging

**Failure Message:**
```
"Sorry, I encountered an error processing your question. Please try again later."
```

**Code Location:** `lms/services/llm-service.js` → Error handling

---

## Allowed Behaviors

### 1. Answer Generation

#### 1.1 Course Content Questions
**Allowed:** Answer questions about course content using retrieved chunks.

**Requirements:**
- At least 1 relevant chunk found
- Confidence score ≥ 0.65 (configurable threshold)
- Chunks match course scope
- References included in response

**Success Response Format:**
```json
{
  "success": true,
  "answer": "Answer text...",
  "references": [
    {
      "day": 1,
      "chapter": 2,
      "chapter_title": "Chapter Title",
      "lab_id": null
    }
  ],
  "confidence": 0.85,
  "escalated": false
}
```

---

#### 1.2 Lab Guidance (Not Answers)
**Allowed:** Provide hints, guidance, and references for labs.

**Requirements:**
- Never provide direct solutions
- Reference relevant course chapters
- Suggest review of prerequisites
- Encourage without solving

**Success Response Format:**
```json
{
  "success": true,
  "answer": "For this lab, review Day 2 → Chapter 3 on [topic]. Focus on [specific aspect]. Try breaking the problem into smaller steps.",
  "references": [...],
  "isLabGuidance": true,
  "confidence": 0.75
}
```

---

#### 1.3 Navigation Questions
**Allowed:** Answer questions about course structure and navigation.

**Requirements:**
- Use course structure metadata
- Reference day/chapter locations
- Guide to relevant content

**Success Response Format:**
```json
{
  "success": true,
  "answer": "Information about [topic] can be found in Day 5 → Chapter 2: [Chapter Title].",
  "references": [...],
  "intent": "navigation"
}
```

---

### 2. Escalation

#### 2.1 Low Confidence Escalation
**Allowed:** Escalate to trainer when confidence < threshold.

**Requirements:**
- Confidence < 0.65 (configurable)
- Create escalation record
- Notify trainer
- Inform learner

**Success Response Format:**
```json
{
  "success": true,
  "answer": "I'm not fully confident about this answer. I'll forward this to your trainer for a more detailed response.",
  "escalated": true,
  "escalationId": "uuid",
  "confidence": 0.45
}
```

---

#### 2.2 Governance-Recommended Escalation
**Allowed:** Escalate when governance rules recommend it.

**Requirements:**
- Governance flags for escalation
- Create escalation record
- Still allow answer generation (if confidence allows)
- Notify trainer

**Success Response Format:**
```json
{
  "success": true,
  "answer": "Answer text...",
  "escalated": true,
  "escalationId": "uuid",
  "confidence": 0.70,
  "governanceDetails": {
    "warnings": [...],
    "recommendations": ["escalate"]
  }
}
```

---

### 3. Query Processing

#### 3.1 Intent Classification
**Allowed:** Classify query intent (course_content, lab_guidance, navigation, out_of_scope).

**Requirements:**
- Use LLM for classification
- Validate classification with content search
- Reclassify if validation fails

**Success Response:**
- Intent classification returned
- Used for routing to appropriate handler

---

#### 3.2 Query Preprocessing
**Allowed:** Normalize and preprocess queries.

**Requirements:**
- Trim whitespace
- Normalize punctuation
- Remove excessive characters
- Preserve query meaning

**Success Response:**
- Preprocessed query string
- Original query preserved for logging

---

## Failure Modes & Messages

### Failure Mode Categories

#### Category 1: Validation Failures
**Trigger:** Input validation fails

| Failure Type | Error Code | Message | HTTP Status |
|-------------|------------|---------|-------------|
| Empty Query | `VALIDATION_EMPTY` | "Question too short" | 400 |
| Too Long | `VALIDATION_TOO_LONG` | "Question too long (max 1000 characters)" | 400 |
| Course Not Allocated | `VALIDATION_COURSE_NOT_ALLOCATED` | "This course is not allocated to you. Please contact your administrator." | 403 |
| Invalid Format | `VALIDATION_INVALID_FORMAT` | "Invalid query format. Please ask a question about the course content." | 400 |

---

#### Category 2: Content Failures
**Trigger:** Required content not found

| Failure Type | Error Code | Message | HTTP Status |
|-------------|------------|---------|-------------|
| No Chunks Found | `CONTENT_NO_CHUNKS` | "No relevant content found in the course material. Please try rephrasing your question or contact your trainer for assistance." | 404 |
| Lab Content Missing | `CONTENT_LAB_MISSING` | "No content found for Day {day}, Lab {lab}. Please verify the Day and Lab numbers are correct, or contact your trainer for assistance." | 404 |
| Topic Not Found | `CONTENT_TOPIC_NOT_FOUND` | "I couldn't find comprehensive content about '{topic}' in the course material. The available content may not cover this topic in sufficient detail. Please try rephrasing your question or contact your trainer." | 404 |
| Reference Mismatch | `CONTENT_REFERENCE_MISMATCH` | "I couldn't find content matching Day {day}, Chapter {chapter}. Please verify the Day and Chapter numbers are correct." | 404 |
| Future Content | `CONTENT_FUTURE` | "This content is not yet available in your learning path. Please complete the prerequisite chapters first." | 403 |

---

#### Category 3: Governance Failures
**Trigger:** Governance invariants violated

| Failure Type | Error Code | Message | HTTP Status |
|-------------|------------|---------|-------------|
| Lab Safety Violation | `GOVERNANCE_LAB_SAFETY` | "I can provide guidance and hints for labs, but I cannot give you the direct answer. Try breaking down the problem into smaller steps, or review the relevant course chapters." | 403 |
| Topic Integrity Violation | `GOVERNANCE_TOPIC_INTEGRITY` | "I couldn't find comprehensive content about '{topic}' in the course material. The available content may not cover this topic in sufficient detail. Please try rephrasing your question or contact your trainer." | 403 |
| Reference Integrity Violation | `GOVERNANCE_REFERENCE_INTEGRITY` | "I couldn't find content matching the specified references. Please verify the Day, Chapter, and Lab numbers are correct." | 403 |
| Course Scope Violation | `GOVERNANCE_COURSE_SCOPE` | "Content mismatch detected. This question cannot be answered with the available course material." | 403 |
| Course Anchoring Failure | `GOVERNANCE_COURSE_ANCHORING` | "I couldn't find dedicated course content for '{concept}'. This concept may be introduced in a later chapter or may require trainer assistance." | 403 |
| Procedural Contract Violation | `GOVERNANCE_PROCEDURAL_CONTRACT` | "I couldn't find complete step-by-step instructions for this. The available content may not cover the full procedure. Please try rephrasing your question or contact your trainer." | 403 |

---

#### Category 4: System Failures
**Trigger:** System errors or timeouts

| Failure Type | Error Code | Message | HTTP Status |
|-------------|------------|---------|-------------|
| Service Unavailable | `SYSTEM_SERVICE_UNAVAILABLE` | "AI Coach service is temporarily unavailable. Please try again later or contact support." | 503 |
| Timeout | `SYSTEM_TIMEOUT` | "Query processing timed out after 120 seconds. This may happen with complex queries. Please try rephrasing your question or try again." | 504 |
| API Error | `SYSTEM_API_ERROR` | "Sorry, I encountered an error processing your question. Please try again later." | 500 |
| Database Error | `SYSTEM_DATABASE_ERROR` | "Database connection error. Please try again later." | 503 |

---

#### Category 5: Access Failures
**Trigger:** Access control violations

| Failure Type | Error Code | Message | HTTP Status |
|-------------|------------|---------|-------------|
| Access Denied | `ACCESS_DENIED` | "Access denied. You can only access your own course data." | 403 |
| Trainer Content | `ACCESS_TRAINER_CONTENT` | "This content is not available. Please contact your trainer for assistance." | 403 |
| Out of Scope | `ACCESS_OUT_OF_SCOPE` | "This question is outside the scope of the course. Please ask questions related to the course content." | 403 |

---

### Failure Response Template

All failures MUST return this structure:

```json
{
  "success": false,
  "error": "Error message text",
  "errorCode": "ERROR_CODE",
  "errorCategory": "validation|content|governance|system|access",
  "queryId": "uuid or null",
  "escalationId": "uuid or null",
  "governanceDetails": {
    "violations": [],
    "warnings": [],
    "recommendations": []
  },
  "timestamp": "ISO 8601 timestamp"
}
```

---

## Enforcement Mechanisms

### 1. Code-Level Enforcement

#### 1.1 Validation Layer
**Location:** `lms/services/query-processor-service.js`

**Enforced Rules:**
- Query length validation
- Course allocation check
- Input sanitization

**Failure Action:** Return error immediately, do not proceed

---

#### 1.2 Governance Layer
**Location:** `lms/services/answer-governance-service.js`

**Enforced Rules:**
- Lab safety invariant
- Topic integrity invariant
- Reference integrity invariant
- Course scope invariant
- Course anchoring invariant
- Procedural contract validation

**Failure Action:** Block answer generation, return error or escalate

---

#### 1.3 Service Layer
**Location:** `lms/services/ai-coach-service.js`

**Enforced Rules:**
- Intent validation
- Content retrieval validation
- Confidence threshold enforcement
- Escalation triggers

**Failure Action:** Return error or escalate, never proceed with invalid state

---

### 2. Prompt-Level Enforcement

#### 2.1 System Prompt Constraints
**Location:** `lms/services/llm-service.js`

**Enforced Rules:**
- "Only use provided context chunks"
- "Never provide lab answers"
- "Say 'I don't know' if uncertain"
- "Include exact references"

**Failure Action:** LLM response validation, reject if constraints violated

---

#### 2.2 Response Validation
**Location:** `lms/services/ai-coach-service.js`

**Enforced Rules:**
- Response must include references
- Response must not contain forbidden patterns
- Response length limits

**Failure Action:** Reject response, retry or escalate

---

### 3. Database-Level Enforcement

#### 3.1 Row-Level Security (RLS)
**Location:** `backend/schema.sql`

**Enforced Rules:**
- Learners can only access their own queries/responses
- Trainers can only access assigned learners
- Course allocation enforcement

**Failure Action:** Database query fails, returns empty result

---

### 4. Monitoring & Alerting

#### 4.1 Error Logging
**Requirements:**
- All failures logged with error code
- Governance violations logged with details
- System errors logged with stack traces

**Location:** All service methods

---

#### 4.2 Metrics Collection
**Requirements:**
- Track failure rates by category
- Track governance violation rates
- Track escalation rates
- Track timeout rates

**Location:** Analytics service

---

## Examples

### Example 1: Correct Behavior - Valid Course Question

**Input:**
```
Question: "What is on-page SEO?"
Course: "seo-master-2026"
Learner: Has course allocated
```

**Processing:**
1. ✅ Validation passes
2. ✅ Intent classified as `course_content`
3. ✅ Chunks retrieved (Day 1, Chapter 2)
4. ✅ Governance check passes
5. ✅ Confidence: 0.85
6. ✅ Answer generated

**Output:**
```json
{
  "success": true,
  "answer": "On-page SEO refers to optimization techniques applied directly to your website...",
  "references": [
    {
      "day": 1,
      "chapter": 2,
      "chapter_title": "On-Page SEO Fundamentals"
    }
  ],
  "confidence": 0.85,
  "escalated": false
}
```

---

### Example 2: Correct Behavior - Lab Guidance (Not Answer)

**Input:**
```
Question: "I'm stuck on Day 2 Lab 1"
Course: "seo-master-2026"
Learner: Has course allocated, has lab submissions
```

**Processing:**
1. ✅ Validation passes
2. ✅ Intent classified as `lab_guidance`
3. ✅ Lab struggle detected
4. ✅ Chunks retrieved (Day 2, Lab 1 - guidance only)
5. ✅ Governance check: Lab safety passes (no answers provided)
6. ✅ Confidence: 0.75
7. ✅ Guidance generated

**Output:**
```json
{
  "success": true,
  "answer": "For Day 2 Lab 1, review Day 2 → Chapter 3 on keyword research. Focus on understanding how to identify target keywords. Try breaking the problem into smaller steps: 1) Identify your target audience, 2) Research keywords they use, 3) Analyze competition.",
  "references": [
    {
      "day": 2,
      "chapter": 3,
      "chapter_title": "Keyword Research Fundamentals"
    }
  ],
  "isLabGuidance": true,
  "confidence": 0.75,
  "escalated": false
}
```

---

### Example 3: Correct Failure - Out of Scope

**Input:**
```
Question: "What is the weather today?"
Course: "seo-master-2026"
Learner: Has course allocated
```

**Processing:**
1. ✅ Validation passes
2. ❌ Intent classified as `out_of_scope`
3. ❌ Validation confirms: No course content matches
4. ❌ Query rejected

**Output:**
```json
{
  "success": false,
  "error": "This question is outside the scope of the course. Please ask questions related to the course content.",
  "errorCode": "ACCESS_OUT_OF_SCOPE",
  "errorCategory": "access",
  "queryId": null,
  "timestamp": "2025-01-29T10:00:00Z"
}
```

---

### Example 4: Correct Failure - Missing Lab Content

**Input:**
```
Question: "Help with Day 99 Lab 99"
Course: "seo-master-2026"
Learner: Has course allocated
```

**Processing:**
1. ✅ Validation passes
2. ✅ Intent classified as `lab_guidance`
3. ✅ Specific references parsed: Day 99, Lab 99
4. ❌ No chunks found for Day 99, Lab 99
5. ❌ Governance: Lab safety violation (no content)
6. ❌ Answer generation BLOCKED
7. ✅ Escalation created

**Output:**
```json
{
  "success": false,
  "error": "No content found for Day 99, Lab 99. Please verify the Day and Lab numbers are correct, or contact your trainer for assistance.",
  "errorCode": "CONTENT_LAB_MISSING",
  "errorCategory": "content",
  "queryId": "uuid",
  "escalationId": "uuid",
  "governanceDetails": {
    "violations": [
      {
        "type": "invariant_lab_safety",
        "severity": "critical",
        "message": "No content found for specified lab",
        "invariant": "Lab Safety"
      }
    ]
  },
  "timestamp": "2025-01-29T10:00:00Z"
}
```

---

### Example 5: Correct Failure - Low Confidence Escalation

**Input:**
```
Question: "Explain advanced AEO strategies for enterprise clients"
Course: "seo-master-2026"
Learner: Has course allocated, completed Day 1-5
```

**Processing:**
1. ✅ Validation passes
2. ✅ Intent classified as `course_content`
3. ✅ Chunks retrieved (but limited coverage)
4. ✅ Governance check passes (but with warnings)
5. ❌ Confidence: 0.45 (below threshold 0.65)
6. ✅ Escalation created
7. ✅ Partial answer provided with disclaimer

**Output:**
```json
{
  "success": true,
  "answer": "I'm not fully confident about this answer. Based on the available content, AEO strategies involve... However, I'll forward this to your trainer for a more detailed response.",
  "references": [
    {
      "day": 20,
      "chapter": 1,
      "chapter_title": "Answer Engine Optimization"
    }
  ],
  "confidence": 0.45,
  "escalated": true,
  "escalationId": "uuid",
  "governanceDetails": {
    "warnings": [
      {
        "type": "low_confidence",
        "severity": "high",
        "message": "Confidence below threshold"
      }
    ]
  }
}
```

---

### Example 6: Incorrect Behavior - Silent Degradation (FORBIDDEN)

**Input:**
```
Question: "What is on-page SEO?"
Course: "seo-master-2026"
Learner: Has course allocated
```

**Incorrect Processing:**
1. ✅ Validation passes
2. ✅ Intent classified
3. ❌ Chunk retrieval fails (database error)
4. ❌ System silently falls back to general knowledge
5. ❌ Answer generated without chunks
6. ❌ No error message shown

**Why This Is Forbidden:**
- Violates "No Hallucination" rule
- Violates "No Silent Degradation" rule
- User receives incorrect/unverified answer

**Correct Behavior:**
- Must return error: `SYSTEM_DATABASE_ERROR`
- Must not generate answer
- Must log error for monitoring

---

### Example 7: Incorrect Behavior - Lab Answer Leakage (FORBIDDEN)

**Input:**
```
Question: "What is the answer to Day 2 Lab 1?"
Course: "seo-master-2026"
Learner: Has course allocated
```

**Incorrect Processing:**
1. ✅ Validation passes
2. ✅ Intent classified as `lab_guidance`
3. ✅ Lab content retrieved
4. ❌ Governance check bypassed or fails
5. ❌ Direct lab answer provided

**Why This Is Forbidden:**
- Violates "No Lab Answer Provision" rule
- Defeats learning objectives
- Academic integrity violation

**Correct Behavior:**
- Must block answer generation
- Must return: `GOVERNANCE_LAB_SAFETY` error
- Must provide guidance only
- Must escalate if needed

---

## Implementation Checklist

### Code Enforcement

- [ ] All validation checks return explicit errors
- [ ] All governance checks block invalid answers
- [ ] All system errors are caught and logged
- [ ] All failures return structured error responses
- [ ] No silent fallbacks to degraded modes
- [ ] All timeouts are handled with explicit messages
- [ ] All API failures are caught and reported

### Testing

- [ ] Unit tests for all validation rules
- [ ] Unit tests for all governance invariants
- [ ] Integration tests for failure scenarios
- [ ] End-to-end tests for error handling
- [ ] Load tests for timeout scenarios

### Monitoring

- [ ] Error logging with error codes
- [ ] Metrics for failure rates by category
- [ ] Alerts for high failure rates
- [ ] Dashboard for governance violations
- [ ] Audit trail for all blocked queries

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-29 | Safety & Reliability Engineering | Initial guardrails specification |

---

## Approval

**Safety & Reliability Lead**: _________________  
**Engineering Lead**: _________________  
**Product Owner**: _________________  
**Date**: _________________

---

**Document Status**: ✅ Enforceable - All rules must be implemented in code

