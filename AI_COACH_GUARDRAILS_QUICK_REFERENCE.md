# AI Coach Guardrails - Quick Reference

**Version:** 1.0  
**Last Updated:** 2025-01-29

---

## 🚫 Forbidden Behaviors (Hard Rules)

### Content & Answers
1. ❌ **Hallucination**: Never generate answers without supporting chunks
2. ❌ **Out-of-Scope**: Never answer non-course questions
3. ❌ **Lab Answers**: Never provide direct lab solutions
4. ❌ **Cross-Course**: Never answer about unallocated courses
5. ❌ **Future Content**: Never provide content from inaccessible chapters

### Data & Privacy
6. ❌ **Cross-Learner Access**: Never access other learners' data
7. ❌ **Trainer Content**: Never expose trainer-only content

### System Integrity
8. ❌ **Missing Lab Content**: Never answer when specific lab content missing
9. ❌ **Topic Integrity Violation**: Never answer about topics not in chunks
10. ❌ **Reference Mismatch**: Never provide mismatched Day/Chapter/Lab content
11. ❌ **Course Scope Violation**: Never use chunks from wrong course
12. ❌ **Course Anchoring Failure**: Never answer named concepts without dedicated chapters
13. ❌ **Procedural Contract Violation**: Never answer "how-to" without step-by-step content

### Input & System
14. ❌ **Empty/Invalid Queries**: Never process invalid input
15. ❌ **Prompt Injection**: Never execute embedded instructions
16. ❌ **Silent Degradation**: Never fail silently
17. ❌ **Timeout Without Notification**: Always inform on timeout
18. ❌ **API Failure Without Fallback**: Always return explicit errors

---

## ✅ Allowed Behaviors

### Answer Generation
- ✅ Course content questions (with chunks + confidence ≥ 0.65)
- ✅ Lab guidance/hints (NOT answers)
- ✅ Navigation questions

### Escalation
- ✅ Low confidence escalation (confidence < 0.65)
- ✅ Governance-recommended escalation

### Query Processing
- ✅ Intent classification
- ✅ Query preprocessing/normalization

---

## 🔴 Failure Messages (Exact Templates)

### Validation Failures
| Code | Message |
|------|---------|
| `VALIDATION_EMPTY` | "Question too short" |
| `VALIDATION_TOO_LONG` | "Question too long (max 1000 characters)" |
| `VALIDATION_COURSE_NOT_ALLOCATED` | "This course is not allocated to you. Please contact your administrator." |
| `VALIDATION_INVALID_FORMAT` | "Invalid query format. Please ask a question about the course content." |

### Content Failures
| Code | Message |
|------|---------|
| `CONTENT_NO_CHUNKS` | "No relevant content found in the course material. Please try rephrasing your question or contact your trainer for assistance." |
| `CONTENT_LAB_MISSING` | "No content found for Day {day}, Lab {lab}. Please verify the Day and Lab numbers are correct, or contact your trainer for assistance." |
| `CONTENT_TOPIC_NOT_FOUND` | "I couldn't find comprehensive content about '{topic}' in the course material. The available content may not cover this topic in sufficient detail. Please try rephrasing your question or contact your trainer." |
| `CONTENT_REFERENCE_MISMATCH` | "I couldn't find content matching Day {day}, Chapter {chapter}. Please verify the Day and Chapter numbers are correct." |
| `CONTENT_FUTURE` | "This content is not yet available in your learning path. Please complete the prerequisite chapters first." |

### Governance Failures
| Code | Message |
|------|---------|
| `GOVERNANCE_LAB_SAFETY` | "I can provide guidance and hints for labs, but I cannot give you the direct answer. Try breaking down the problem into smaller steps, or review the relevant course chapters." |
| `GOVERNANCE_TOPIC_INTEGRITY` | "I couldn't find comprehensive content about '{topic}' in the course material. The available content may not cover this topic in sufficient detail. Please try rephrasing your question or contact your trainer." |
| `GOVERNANCE_REFERENCE_INTEGRITY` | "I couldn't find content matching the specified references. Please verify the Day, Chapter, and Lab numbers are correct." |
| `GOVERNANCE_COURSE_SCOPE` | "Content mismatch detected. This question cannot be answered with the available course material." |
| `GOVERNANCE_COURSE_ANCHORING` | "I couldn't find dedicated course content for '{concept}'. This concept may be introduced in a later chapter or may require trainer assistance." |
| `GOVERNANCE_PROCEDURAL_CONTRACT` | "I couldn't find complete step-by-step instructions for this. The available content may not cover the full procedure. Please try rephrasing your question or contact your trainer." |

### System Failures
| Code | Message |
|------|---------|
| `SYSTEM_SERVICE_UNAVAILABLE` | "AI Coach service is temporarily unavailable. Please try again later or contact support." |
| `SYSTEM_TIMEOUT` | "Query processing timed out after 120 seconds. This may happen with complex queries. Please try rephrasing your question or try again." |
| `SYSTEM_API_ERROR` | "Sorry, I encountered an error processing your question. Please try again later." |
| `SYSTEM_DATABASE_ERROR` | "Database connection error. Please try again later." |

### Access Failures
| Code | Message |
|------|---------|
| `ACCESS_DENIED` | "Access denied. You can only access your own course data." |
| `ACCESS_TRAINER_CONTENT` | "This content is not available. Please contact your trainer for assistance." |
| `ACCESS_OUT_OF_SCOPE` | "This question is outside the scope of the course. Please ask questions related to the course content." |

---

## 📋 Enforcement Checklist

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

## 🔍 Key Enforcement Points

### 1. Query Validation
**File:** `lms/services/query-processor-service.js`
- Minimum length: 3 chars
- Maximum length: 1000 chars
- Course allocation check

### 2. Governance Checks
**File:** `lms/services/answer-governance-service.js`
- Lab Safety Invariant
- Topic Integrity Invariant
- Reference Integrity Invariant
- Course Scope Invariant
- Course Anchoring Invariant
- Procedural Contract Validation

### 3. Service Layer
**File:** `lms/services/ai-coach-service.js`
- Intent validation
- Content retrieval validation
- Confidence threshold (0.65)
- Escalation triggers

### 4. Database RLS
**File:** `backend/schema.sql`
- Row-level security policies
- Learner data isolation
- Course allocation enforcement

---

## 📊 Failure Response Structure

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

## 🎯 Core Principles

1. **No Silent Failures**: Every failure must produce an explicit error message
2. **No Hallucination**: Answers must be grounded in retrieved course content
3. **No Access Violations**: Learners can only access their allocated courses
4. **No Lab Answer Leakage**: Never provide direct lab solutions
5. **No Out-of-Scope Answers**: Only answer course-related questions

---

**For detailed specifications, see:** `AI_COACH_GUARDRAILS.md`

