# Governance Rules Tests

Automated tests for AI Coach governance invariants to ensure answer quality and correctness.

## Running Tests

```bash
# Run all governance tests
npm test

# Or directly
node tests/governance-rules.test.js
```

## Test Cases

### 1. Technical SEO No Intro Chapter
**Test**: Technical SEO questions must not return introductory SEO chapters.

**Expected**: 
- Technical SEO question with only intro chunk → **BLOCKED** (Topic Integrity violation)
- Technical SEO question with dedicated technical SEO chunk → **ALLOWED**

### 2. Lab Day 20 Never Returns Day 13
**Test**: Lab Day 20 questions must never return Day 13 content.

**Expected**:
- Day 20 lab question with Day 13 chunk → **BLOCKED** (Lab Safety violation)
- Day 20 lab question with Day 20 chunk → **ALLOWED**

### 3. How to AEO Returns Steps or Blocked
**Test**: "How to do AEO?" must return step-by-step content or be blocked.

**Expected**:
- "How to do AEO" with only conceptual chunk → **BLOCKED** (Procedural Contract violation)
- "How to do AEO" with procedural chunk (steps) → **ALLOWED**

### 4. High Confidence + Weak References Escalate
**Test**: High confidence (>0.7) with weak references must trigger escalation.

**Expected**:
- Confidence > 0.7 + reference validation failed → **ESCALATE**
- Confidence downgraded to max 0.5

### 5. Lab Safety Invariant
**Test**: Lab questions must only use chunks from the specified lab.

**Expected**:
- Wrong lab chunk → **BLOCKED** (Lab Safety violation)
- Correct lab chunk → **ALLOWED**

### 6. Topic Integrity Invariant
**Test**: Questions with topic modifiers must have topic-specific chunks.

**Expected**:
- Technical SEO question with only non-technical chunk → **BLOCKED** (Topic Integrity violation)
- Technical SEO question with technical chunk → **ALLOWED**

### 7. Reference Integrity Invariant
**Test**: Answers must match specific references mentioned in question.

**Expected**:
- Question mentions "Day 4, Chapter 2" but chunk is Chapter 1 → **BLOCKED/ESCALATE** (Reference Integrity violation)
- Question mentions "Day 4, Chapter 2" and chunk is Chapter 2 → **ALLOWED**

### 8. Course Scope Invariant
**Test**: Answers must be traceable to course content.

**Expected**:
- Generic/non-course content → **BLOCKED** (Course Scope violation)

## Test Structure

Tests use Node.js built-in test capabilities (no external dependencies required).

Each test:
1. Creates mock chunks with specific properties
2. Calls governance service with test question
3. Asserts expected behavior (block/allow/escalate)
4. Verifies invariant violations are detected

## Build Integration

Tests are integrated into CI/CD pipeline:

- **GitHub Actions**: Runs on push/PR to main/develop branches
- **Exit Code**: Tests exit with code 1 if any test fails
- **Build Failure**: Build fails if governance rules are violated

## Adding New Tests

To add a new test:

1. Create a test function:
```javascript
async function testNewInvariant() {
    const question = "Test question";
    const chunks = [createMockChunk({...})];
    const result = await mockGovernanceCheck(question, chunks);
    assert(condition, 'Test description');
}
```

2. Add to test suite:
```javascript
await runTestSuite('Invariant Tests', [
    // ... existing tests
    testNewInvariant
]);
```

## Mock Data

Tests use `createMockChunk()` to create test chunks with configurable properties:
- `day`, `chapter_id`, `chapter_title`
- `coverage_level`, `completeness_score`
- `primary_topic`, `is_dedicated_topic_chapter`
- `content_type`, `lab_id`

## Debugging

Enable verbose output:
```javascript
const config = { verbose: true };
```

Tests will print:
- ✅ PASS messages for successful assertions
- ❌ FAIL messages for failed assertions
- Summary with pass/fail counts

## Continuous Integration

The GitHub Actions workflow (`.github/workflows/test-governance.yml`) runs:
- On push to main/develop
- On pull requests
- On manual trigger
- With Node.js 18.x and 20.x

Build fails if any test fails, ensuring governance rules are always enforced.

