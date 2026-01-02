# AI Coach - Acceptance Test Queries

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Test Suite

---

## Overview

This document contains comprehensive acceptance test queries for validating AI Coach quality before release. Each test includes the question, expected intent classification, and criteria for correct/incorrect answers.

**Test Coverage**:
- ✅ 5 FACTUAL questions
- ✅ 5 CONCEPTUAL questions
- ✅ 5 EXAMPLE questions
- ✅ 5 LAB GUIDANCE questions
- ✅ 3 STRUGGLE questions
- ✅ 3 OUT-OF-SCOPE questions

**Total**: 26 test queries

---

## Test Format

Each test includes:
1. **Question**: The learner's query
2. **Expected Intent**: The intent classification that should be assigned
3. **Correct Answer Properties**: What a good answer MUST have
4. **Incorrect Answer Properties**: What a bad answer MUST NOT have

---

## FACTUAL / STRUCTURAL Intent Tests

### Test F1: Basic Definition Question

**Question**: "What is SEO?"

**Expected Intent**: `factual`

**Correct Answer Properties**:
- ✅ Direct answer in first 1-2 sentences
- ✅ Definition from course content (not general knowledge)
- ✅ At least one course reference (📖 Day X → Chapter Y)
- ✅ Word count: 50-150 words
- ✅ Specific and precise (no vague hedging)
- ✅ No examples (unless explicitly requested)

**Incorrect Answer Properties**:
- ❌ Vague language ("SEO might be...", "It could be...")
- ❌ General knowledge not from course content
- ❌ Missing course references
- ❌ Word count > 150 words
- ❌ Includes examples without being asked
- ❌ Starts with explanation instead of direct answer

---

### Test F2: List/Structural Question

**Question**: "What are the chapters in Day 1?"

**Expected Intent**: `factual`

**Correct Answer Properties**:
- ✅ Direct list of chapters in first sentence
- ✅ Specific chapter titles from course structure
- ✅ Course reference (📖 Day 1)
- ✅ Word count: 50-100 words
- ✅ Clear, structured format (list or numbered)
- ✅ No explanations beyond what was asked

**Incorrect Answer Properties**:
- ❌ Vague response ("There are several chapters...")
- ❌ Missing specific chapter titles
- ❌ Includes explanations about each chapter
- ❌ Word count > 100 words
- ❌ No course reference

---

### Test F3: Comparison Question

**Question**: "What is the difference between on-page SEO and off-page SEO?"

**Expected Intent**: `factual`

**Correct Answer Properties**:
- ✅ Direct comparison in first sentence
- ✅ Clear distinction between on-page and off-page
- ✅ Specific facts from course content
- ✅ At least one course reference
- ✅ Word count: 100-150 words
- ✅ Structured comparison (clear differences listed)

**Incorrect Answer Properties**:
- ❌ Vague comparison ("They are different in various ways...")
- ❌ Missing specific distinctions
- ❌ Includes examples without being asked
- ❌ Word count > 150 words
- ❌ No course reference

---

### Test F4: Specific Fact Question

**Question**: "What is a meta tag?"

**Expected Intent**: `factual`

**Correct Answer Properties**:
- ✅ Direct definition in first sentence
- ✅ Specific technical details from course content
- ✅ Course reference (📖 Day X → Chapter Y)
- ✅ Word count: 50-100 words
- ✅ Precise and accurate
- ✅ No unnecessary elaboration

**Incorrect Answer Properties**:
- ❌ Vague definition ("A meta tag is something that...")
- ❌ General knowledge not from course
- ❌ Missing course reference
- ❌ Includes examples or use cases
- ❌ Word count > 100 words

---

### Test F5: Course Structure Question

**Question**: "How many days are in this course?"

**Expected Intent**: `factual`

**Correct Answer Properties**:
- ✅ Direct numeric answer in first sentence
- ✅ Specific number from course structure
- ✅ Course reference
- ✅ Word count: 50-100 words
- ✅ Clear and concise
- ✅ No explanations beyond what was asked

**Incorrect Answer Properties**:
- ❌ Vague response ("The course has several days...")
- ❌ Missing specific number
- ❌ Includes explanations about course structure
- ❌ Word count > 100 words
- ❌ No course reference

---

## CONCEPTUAL / EXPLANATORY Intent Tests

### Test C1: How-Why Question

**Question**: "How does keyword research work?"

**Expected Intent**: `conceptual`

**Correct Answer Properties**:
- ✅ Explains the "how" and "why" (not just definition)
- ✅ Breaks down the process or concept
- ✅ Shows relationships and reasoning
- ✅ Clear, accessible language
- ✅ At least one course reference
- ✅ Word count: 100-200 words
- ✅ Progressive disclosure (starts simple, builds complexity)

**Incorrect Answer Properties**:
- ❌ Only definition without explanation
- ❌ Overly technical jargon without explanation
- ❌ Skips reasoning ("It just works this way...")
- ❌ Word count < 100 or > 200 words
- ❌ Missing course reference
- ❌ Vague explanations

---

### Test C2: Why Question

**Question**: "Why is on-page SEO important?"

**Expected Intent**: `conceptual`

**Correct Answer Properties**:
- ✅ Explains the "why" (reasoning, not just facts)
- ✅ Shows relationships (importance, impact)
- ✅ Clear reasoning and logic
- ✅ Accessible language
- ✅ Course reference
- ✅ Word count: 100-200 words
- ✅ Builds understanding gradually

**Incorrect Answer Properties**:
- ❌ Only states importance without explaining why
- ❌ Vague reasoning ("It's important because...")
- ❌ Skips explanation of relationships
- ❌ Word count < 100 or > 200 words
- ❌ Missing course reference

---

### Test C3: Relationship Question

**Question**: "What is the relationship between content and SEO?"

**Expected Intent**: `conceptual`

**Correct Answer Properties**:
- ✅ Explains the relationship (not just definitions)
- ✅ Shows how concepts connect
- ✅ Clear reasoning about connections
- ✅ Accessible language
- ✅ Course reference
- ✅ Word count: 100-200 words
- ✅ Progressive explanation

**Incorrect Answer Properties**:
- ❌ Only defines content and SEO separately
- ❌ Doesn't explain the relationship
- ❌ Vague connections ("They are related...")
- ❌ Word count < 100 or > 200 words
- ❌ Missing course reference

---

### Test C4: Understanding Question

**Question**: "Can you help me understand what backlinks are?"

**Expected Intent**: `conceptual`

**Correct Answer Properties**:
- ✅ Explains the concept (not just definition)
- ✅ Breaks down complex ideas
- ✅ Shows reasoning and relationships
- ✅ Clear, accessible language
- ✅ Course reference
- ✅ Word count: 100-200 words
- ✅ Patient, teaching tone

**Incorrect Answer Properties**:
- ❌ Only definition without explanation
- ❌ Overly technical without simplification
- ❌ Skips reasoning
- ❌ Word count < 100 or > 200 words
- ❌ Missing course reference

---

### Test C5: Complex Concept Question

**Question**: "Explain how search engines rank websites"

**Expected Intent**: `conceptual`

**Correct Answer Properties**:
- ✅ Explains the "how" (process, not just facts)
- ✅ Breaks down complex ranking process
- ✅ Shows relationships between factors
- ✅ Clear, accessible language
- ✅ Course reference
- ✅ Word count: 100-200 words
- ✅ Progressive disclosure

**Incorrect Answer Properties**:
- ❌ Only lists ranking factors without explaining how
- ❌ Overly technical jargon
- ❌ Skips reasoning about the process
- ❌ Word count < 100 or > 200 words
- ❌ Missing course reference

---

## EXAMPLE / PRACTICAL Intent Tests

### Test E1: Example Request

**Question**: "Can you give me an example of on-page SEO?"

**Expected Intent**: `example`

**Correct Answer Properties**:
- ✅ Starts with concrete, real-world example in first 50% of response
- ✅ Example is specific and relatable
- ✅ Example is explained (what it demonstrates)
- ✅ At least one course reference
- ✅ Word count: 100-200 words
- ✅ Example appears early (not at the end)

**Incorrect Answer Properties**:
- ❌ No example or abstract example only
- ❌ Example appears late in response
- ❌ Example without explanation
- ❌ Vague or hypothetical example
- ❌ Word count < 100 or > 200 words
- ❌ Missing course reference

---

### Test E2: Practical Application Question

**Question**: "Show me a practical example of keyword research"

**Expected Intent**: `example`

**Correct Answer Properties**:
- ✅ Concrete example in first half of response
- ✅ Specific, real-world scenario
- ✅ Example demonstrates the concept
- ✅ Explanation of what example shows
- ✅ Course reference
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Abstract example ("Imagine you have...")
- ❌ Example appears late
- ❌ No explanation of example
- ❌ Vague or hypothetical
- ❌ Word count < 100 or > 200 words

---

### Test E3: Real-World Question

**Question**: "What does good SEO look like in practice?"

**Expected Intent**: `example`

**Correct Answer Properties**:
- ✅ Concrete, real-world example(s) early in response
- ✅ Specific scenarios or case studies
- ✅ Examples show practical application
- ✅ Explanation of what makes it "good"
- ✅ Course reference
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Only theoretical explanation
- ❌ No concrete examples
- ❌ Vague descriptions
- ❌ Word count < 100 or > 200 words
- ❌ Missing course reference

---

### Test E4: Use Case Question

**Question**: "Give me a real-world example of how to use meta tags"

**Expected Intent**: `example`

**Correct Answer Properties**:
- ✅ Concrete example in first half
- ✅ Specific, relatable scenario
- ✅ Shows practical use case
- ✅ Example explained
- ✅ Course reference
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Abstract or hypothetical example
- ❌ Example appears late
- ❌ No explanation
- ❌ Word count < 100 or > 200 words

---

### Test E5: Demonstration Question

**Question**: "How is keyword research applied in practice? Show me an example"

**Expected Intent**: `example`

**Correct Answer Properties**:
- ✅ Concrete example starts response or appears in first 50%
- ✅ Specific, real-world application
- ✅ Example demonstrates practical use
- ✅ Explanation of application
- ✅ Course reference
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Only theoretical explanation
- ❌ No concrete example
- ❌ Example appears late
- ❌ Vague or abstract
- ❌ Word count < 100 or > 200 words

---

## LAB GUIDANCE (NO ANSWERS) Intent Tests

### Test L1: Lab Help Question

**Question**: "I'm working on Day 1 Lab 1. Can you help me understand what I need to do?"

**Expected Intent**: `lab_guidance`

**Correct Answer Properties**:
- ✅ Encouragement/supportive language
- ✅ Hints or guidance (NOT solutions)
- ✅ References to relevant chapters
- ✅ Suggests breaking down the problem
- ✅ No direct answers or solutions
- ✅ No code snippets
- ✅ Word count: 100-200 words
- ✅ Course reference

**Incorrect Answer Properties**:
- ❌ Direct answers or solutions
- ❌ Code snippets or templates
- ❌ Step-by-step solutions
- ❌ Reveals expected outcomes
- ❌ "You should do X" or "The answer is Y"
- ❌ Word count < 100 or > 200 words

---

### Test L2: Lab Approach Question

**Question**: "How should I approach the keyword research lab?"

**Expected Intent**: `lab_guidance`

**Correct Answer Properties**:
- ✅ Guidance on approach (not solution)
- ✅ References to relevant chapters
- ✅ Suggests methodology
- ✅ Encouragement
- ✅ No direct answers
- ✅ No code or solutions
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Provides solution or answer
- ❌ Code snippets
- ❌ Direct instructions on what to do
- ❌ Reveals expected results
- ❌ Word count < 100 or > 200 words

---

### Test L3: Lab Stuck Question

**Question**: "I'm stuck on the on-page SEO lab. What should I check?"

**Expected Intent**: `lab_guidance`

**Correct Answer Properties**:
- ✅ Supportive, encouraging tone
- ✅ Hints on what to check (not answers)
- ✅ References to relevant chapters
- ✅ Suggests review of prerequisites
- ✅ No solutions or direct answers
- ✅ No code
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Provides solution
- ❌ Direct answers ("Check X, Y, Z")
- ❌ Code snippets
- ❌ Reveals what's wrong
- ❌ Word count < 100 or > 200 words

---

### Test L4: Lab Concept Question

**Question**: "I don't understand what the meta tags lab is asking me to do"

**Expected Intent**: `lab_guidance`

**Correct Answer Properties**:
- ✅ Clarifies the lab's purpose (not solution)
- ✅ References relevant chapters
- ✅ Encourages review of concepts
- ✅ Supportive tone
- ✅ No direct answers
- ✅ No code
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Provides solution or answer
- ❌ Code snippets
- ❌ Direct instructions
- ❌ Reveals expected outcome
- ❌ Word count < 100 or > 200 words

---

### Test L5: Lab Review Question

**Question**: "Can you review my approach to the backlinks lab?"

**Expected Intent**: `lab_guidance`

**Correct Answer Properties**:
- ✅ Provides feedback on approach (not solution)
- ✅ Suggests improvements or considerations
- ✅ References relevant chapters
- ✅ Encouragement
- ✅ No direct answers
- ✅ No code
- ✅ Word count: 100-200 words

**Incorrect Answer Properties**:
- ❌ Provides solution
- ❌ Code snippets
- ❌ Direct answers
- ❌ Reveals correct approach
- ❌ Word count < 100 or > 200 words

---

## STRUGGLE / CONFUSION Intent Tests

### Test S1: Confusion Question

**Question**: "I'm really confused about keyword research. I don't understand it at all."

**Expected Intent**: `struggle`

**Correct Answer Properties**:
- ✅ Empathetic acknowledgment FIRST
- ✅ Validates feelings ("It's normal to feel confused...")
- ✅ Simplified explanation
- ✅ Step-by-step understanding building
- ✅ Reassurance and encouragement
- ✅ Course reference
- ✅ Word count: 150-250 words
- ✅ Supportive, patient tone

**Incorrect Answer Properties**:
- ❌ Dismissive language
- ❌ Complex language without simplification
- ❌ Rushed explanations
- ❌ Skips empathy
- ❌ Word count < 150 or > 250 words
- ❌ Missing course reference

---

### Test S2: Stuck Question

**Question**: "I'm stuck and don't know what to do. I've been trying to understand SEO for days but nothing makes sense."

**Expected Intent**: `struggle`

**Correct Answer Properties**:
- ✅ Empathetic acknowledgment first
- ✅ Validates struggle ("Many learners find this challenging...")
- ✅ Simplified, step-by-step approach
- ✅ Breaks down into manageable parts
- ✅ Reassurance
- ✅ Course reference
- ✅ Word count: 150-250 words
- ✅ Supportive tone

**Incorrect Answer Properties**:
- ❌ Dismissive ("Just keep trying...")
- ❌ Complex explanations
- ❌ No empathy
- ❌ Rushed response
- ❌ Word count < 150 or > 250 words

---

### Test S3: Overwhelmed Question

**Question**: "This is too much. I feel overwhelmed by all the SEO concepts. Help!"

**Expected Intent**: `struggle`

**Correct Answer Properties**:
- ✅ Empathetic acknowledgment first
- ✅ Validates feelings ("It's normal to feel overwhelmed...")
- ✅ Simplifies and breaks down
- ✅ Suggests manageable approach
- ✅ Reassurance and encouragement
- ✅ Course reference
- ✅ Word count: 150-250 words
- ✅ Very supportive tone

**Incorrect Answer Properties**:
- ❌ Dismissive ("Just focus...")
- ❌ Complex explanations
- ❌ No empathy
- ❌ Doesn't address overwhelm
- ❌ Word count < 150 or > 250 words

---

## OUT-OF-SCOPE Intent Tests

### Test O1: Different Course Question

**Question**: "How do I learn Python programming?"

**Expected Intent**: `out_of_scope`

**Correct Answer Properties**:
- ✅ Polite but clear rejection
- ✅ Scope clarification (what AI Coach can help with)
- ✅ Redirection to appropriate resources
- ✅ Escalation notice (question forwarded to trainer)
- ✅ Word count: 50-100 words
- ✅ Professional, helpful tone

**Incorrect Answer Properties**:
- ❌ Answers the out-of-scope question
- ❌ Dismissive or rude language
- ❌ Missing scope explanation
- ❌ No redirection
- ❌ Word count < 50 or > 100 words

---

### Test O2: Personal Question

**Question**: "What's the weather like today?"

**Expected Intent**: `out_of_scope`

**Correct Answer Properties**:
- ✅ Polite rejection
- ✅ Scope clarification
- ✅ Redirection
- ✅ Escalation notice
- ✅ Word count: 50-100 words
- ✅ Professional tone

**Incorrect Answer Properties**:
- ❌ Answers the question
- ❌ Rude or dismissive
- ❌ Missing scope explanation
- ❌ No redirection

---

### Test O3: Technical Support Question

**Question**: "The website is not loading. Can you fix it?"

**Expected Intent**: `out_of_scope`

**Correct Answer Properties**:
- ✅ Polite rejection
- ✅ Scope clarification (AI Coach helps with course content)
- ✅ Redirection to technical support
- ✅ Escalation notice
- ✅ Word count: 50-100 words
- ✅ Helpful tone

**Incorrect Answer Properties**:
- ❌ Tries to help with technical issue
- ❌ Dismissive
- ❌ Missing scope explanation
- ❌ No redirection

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Course content indexed in `ai_coach_content_chunks`
- [ ] Test user account created and allocated to course
- [ ] AI Coach widget accessible on course pages
- [ ] OpenAI API key configured
- [ ] Escalation service configured

### Test Execution
For each test query:
- [ ] Submit query through AI Coach widget
- [ ] Verify intent classification matches expected intent
- [ ] Verify answer contains all correct answer properties
- [ ] Verify answer does NOT contain incorrect answer properties
- [ ] Verify course references are included
- [ ] Verify word count is within limits
- [ ] Verify confidence score is calculated
- [ ] Verify escalation triggered if confidence < 0.65

### Post-Test Validation
- [ ] All 26 tests pass
- [ ] Intent classification accuracy: 100%
- [ ] Response quality: All correct properties present
- [ ] No incorrect properties present
- [ ] Escalation works correctly for low confidence
- [ ] Response validation catches failures
- [ ] Regeneration works when validation fails

---

## Test Results Template

```
Test ID: F1
Question: "What is SEO?"
Expected Intent: factual
Actual Intent: [recorded]
Confidence: [recorded]

Correct Properties Check:
✅ Direct answer in first sentence: [PASS/FAIL]
✅ Course reference included: [PASS/FAIL]
✅ Word count within limits: [PASS/FAIL]
✅ No vague hedging: [PASS/FAIL]
✅ No examples: [PASS/FAIL]

Incorrect Properties Check:
❌ No vague language: [PASS/FAIL]
❌ No general knowledge: [PASS/FAIL]
❌ No missing references: [PASS/FAIL]

Overall Result: [PASS/FAIL]
Notes: [any observations]
```

---

## Success Criteria

### Intent Classification
- ✅ 100% accuracy (26/26 tests correctly classified)

### Response Quality
- ✅ 100% of responses contain all correct properties
- ✅ 0% of responses contain incorrect properties
- ✅ 100% of responses include course references
- ✅ 100% of responses are within word count limits

### Special Cases
- ✅ LAB GUIDANCE: 0% provide direct answers or solutions
- ✅ STRUGGLE: 100% show empathy and simplified explanations
- ✅ OUT-OF-SCOPE: 100% politely reject and redirect

### Performance
- ✅ Average response time < 5 seconds
- ✅ Confidence scores calculated for all responses
- ✅ Escalation triggered when confidence < 0.65

---

## Regression Testing

After any changes to AI Coach, re-run:
- ✅ All FACTUAL tests (5 tests)
- ✅ All CONCEPTUAL tests (5 tests)
- ✅ All EXAMPLE tests (5 tests)
- ✅ All LAB GUIDANCE tests (5 tests)
- ✅ All STRUGGLE tests (3 tests)
- ✅ All OUT-OF-SCOPE tests (3 tests)

**Total**: 26 tests for full regression

---

**Document Status**: ✅ Ready for Testing

