# AI Coach - Confidence & Escalation Behavior Design

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Final Design

---

## Overview

This document defines how the AI Coach handles confidence scores, communicates uncertainty to learners, and triggers escalations. The design ensures low confidence never results in vague answers, while high confidence responses are decisive and helpful.

**Core Principle**: Low confidence = Partial helpful context + Clear notification + Escalation. Never vague hedging.

---

## Confidence Score Interpretation

### Confidence Ranges

| Range | Interpretation | Response Strategy | Escalation |
|-------|---------------|-------------------|------------|
| **0.80 - 1.00** | High Confidence | Full, decisive answer | No |
| **0.65 - 0.79** | Medium Confidence | Full answer, may note limitations | No |
| **0.50 - 0.64** | Low Confidence | Partial answer + disclaimer + escalate | Yes |
| **0.00 - 0.49** | Very Low Confidence | Minimal context + escalate | Yes |

### Confidence Calculation Factors

Based on `AI_COACH_REQUIREMENTS.md` FR-5.1:

1. **Semantic Similarity** (40% weight)
   - How well retrieved chunks match the question
   - Average similarity score of top chunks
   - Higher similarity → Higher confidence

2. **Completeness of Answer** (30% weight)
   - Can the question be fully answered from context?
   - Are all aspects of the question covered?
   - Higher completeness → Higher confidence

3. **Query Clarity** (20% weight)
   - Is the question clear and specific?
   - Can intent be determined accurately?
   - Clearer query → Higher confidence

4. **Historical Accuracy** (10% weight)
   - How accurate were similar past queries?
   - Feedback from similar questions
   - Better history → Higher confidence

---

## Response Behavior by Confidence Level

### High Confidence (0.80 - 1.00)

#### Response Characteristics

✅ **MUST**:
- Sound decisive and confident
- Use definitive language ("According to...", "Based on...")
- Provide complete answer
- Include all relevant references
- Be clear and direct

❌ **MUST NOT**:
- Use hedging language unnecessarily
- Sound uncertain when data exists
- Provide incomplete information
- Skip references

#### Learner-Facing Language

**Correct Examples**:
- "According to Day 1 → Chapter 2: SEO Fundamentals, SEO stands for..."
- "Based on the course content, on-page SEO involves..."
- "The course material explains that keyword research requires..."

**Incorrect Examples**:
- ❌ "SEO might be..." (when data exists)
- ❌ "It could be that..." (when answer is clear)
- ❌ "Possibly, SEO means..." (when definition exists)

---

### Medium Confidence (0.65 - 0.79)

#### Response Characteristics

✅ **MUST**:
- Provide full answer
- Use confident language
- Note any limitations if relevant
- Include references

❌ **MUST NOT**:
- Use excessive hedging
- Sound uncertain unnecessarily
- Skip information that's available

#### Learner-Facing Language

**Correct Examples**:
- "Based on Day 2 → Chapter 3, keyword research typically involves..."
- "The course content covers this in Day 1 → Chapter 2, where it explains..."
- "According to the material, the main steps are..."

**Incorrect Examples**:
- ❌ "Keyword research might involve..." (when steps are clear)
- ❌ "It's possible that..." (when information exists)

---

### Low Confidence (0.50 - 0.64)

#### Response Characteristics

✅ **MUST**:
- Provide partial helpful context (if available)
- Clearly state uncertainty
- Explicitly notify about escalation
- Trigger trainer escalation
- Use supportive, transparent language

❌ **MUST NOT**:
- Provide vague or hedging answers
- Give incomplete answer without disclaimer
- Skip escalation notification
- Sound uncertain without explanation
- Use "might be" or "could be" language

#### Learner-Facing Language Template

```
[PARTIAL HELPFUL CONTEXT] (if available)
[Provide any relevant information from context that might help]

[UNCERTAINTY STATEMENT]
I'm not fully confident I can provide a complete answer based on the available course content.

[ESCALATION NOTIFICATION]
I've forwarded your question to your trainer, who will provide a more detailed response.

[SUPPORTIVE CLOSE]
You'll receive a notification when they respond.
```

**Correct Examples**:

**Example 1: Partial Context Available**
```
The course content mentions that technical SEO involves optimizing website structure, but the specific details about [specific aspect] aren't fully covered in the available material.

I'm not fully confident I can provide a complete answer based on the available course content. I've forwarded your question to your trainer, who will provide a more detailed response. You'll receive a notification when they respond.

📖 Day 3 → Chapter 7: Technical SEO Basics
```

**Example 2: Minimal Context Available**
```
I found some related information about [topic] in the course content, but it doesn't fully address your specific question.

I'm not fully confident I can provide a complete answer based on the available course content. I've forwarded your question to your trainer, who will provide a more detailed response. You'll receive a notification when they respond.

📖 Day 2 → Chapter 4: [Related Chapter]
```

**Incorrect Examples**:
- ❌ "This might be related to technical SEO, but I'm not sure..." (vague hedging)
- ❌ "It could be that technical SEO involves..." (uncertain language without escalation notice)
- ❌ "I think technical SEO might..." (vague, no escalation notice)

---

### Very Low Confidence (0.00 - 0.49)

#### Response Characteristics

✅ **MUST**:
- Acknowledge the question
- Clearly state inability to answer
- Explicitly notify about escalation
- Trigger trainer escalation immediately
- Provide minimal context only if directly relevant

❌ **MUST NOT**:
- Guess or make assumptions
- Provide vague answers
- Skip escalation
- Use hedging language

#### Learner-Facing Language Template

```
[ACKNOWLEDGMENT]
Thank you for your question about [topic].

[INABILITY STATEMENT]
I don't have enough information in the course content to provide a complete answer to this question.

[ESCALATION NOTIFICATION]
I've forwarded your question to your trainer, who will provide a detailed response. You'll receive a notification when they respond.

[SUPPORTIVE CLOSE]
I'm here to help with other questions about the course content!
```

**Correct Examples**:

**Example 1: No Relevant Context**
```
Thank you for your question about [specific advanced topic].

I don't have enough information in the course content to provide a complete answer to this question. I've forwarded your question to your trainer, who will provide a detailed response. You'll receive a notification when they respond.

I'm here to help with other questions about the course content!
```

**Example 2: Minimal Related Context**
```
Thank you for your question about [topic].

While the course touches on related concepts in Day 2 → Chapter 3, it doesn't fully address your specific question. I've forwarded your question to your trainer, who will provide a detailed response. You'll receive a notification when they respond.

📖 Day 2 → Chapter 3: [Related Chapter]
```

**Incorrect Examples**:
- ❌ "I'm not sure, but it might be..." (guessing)
- ❌ "This could possibly be..." (vague hedging)
- ❌ "I think the answer might be..." (uncertain without escalation)

---

## Escalation Trigger Logic

### Primary Triggers

1. **Confidence Below Threshold** (Primary)
   - Confidence < 0.65 → Always escalate
   - Confidence 0.65-0.79 → No escalation (unless other triggers)

2. **Critical Validation Failures** (Secondary)
   - Lab guidance provided direct answers
   - Out-of-scope question answered
   - General knowledge used instead of context
   - These trigger escalation regardless of confidence

3. **Context Insufficiency** (Tertiary)
   - No relevant chunks found
   - Chunks found but don't answer question
   - Context is incomplete or unclear

### Escalation Decision Logic

```javascript
/**
 * Determine if escalation is needed
 * @param {number} confidence - AI confidence score (0-1)
 * @param {Object} validationResult - Response validation result
 * @param {Object} context - Context information
 * @returns {Object} Escalation decision
 */
function shouldEscalate(confidence, validationResult, context) {
    // Primary trigger: Low confidence
    if (confidence < 0.65) {
        return {
            escalate: true,
            reason: 'low_confidence',
            priority: confidence < 0.50 ? 'high' : 'medium',
            message: 'Confidence below threshold'
        };
    }
    
    // Secondary trigger: Critical validation failures
    const criticalFailures = [
        'noDirectAnswers', // Lab guidance gave answers
        'hasCodeSnippets', // Code in lab guidance
        'hasSolutions', // Solutions provided
        'doesNotAnswer', // Out-of-scope question answered
        'noGeneralKnowledge' // Used general knowledge
    ];
    
    const hasCriticalFailure = validationResult?.failures?.some(f => 
        criticalFailures.includes(f)
    );
    
    if (hasCriticalFailure) {
        return {
            escalate: true,
            reason: 'critical_validation_failure',
            priority: 'high',
            message: 'Critical validation failure detected'
        };
    }
    
    // Tertiary trigger: Context insufficiency
    if (!context.chunks || context.chunks.length === 0) {
        return {
            escalate: true,
            reason: 'no_context',
            priority: 'high',
            message: 'No relevant context found'
        };
    }
    
    // No escalation needed
    return {
        escalate: false,
        reason: 'confidence_adequate'
    };
}
```

---

## Response Generation for Low Confidence

### Low Confidence Response Structure

When confidence < 0.65, the response MUST follow this structure:

```
[PARTIAL CONTEXT SECTION] (if available)
- Extract any helpful information from context
- Provide specific facts that are clear
- Reference specific chapters if relevant
- Keep this section factual and direct

[UNCERTAINTY DISCLAIMER]
- Explicit statement about uncertainty
- Clear explanation of limitation
- No vague hedging

[ESCALATION NOTICE]
- Explicit notification that question is forwarded
- Information about trainer response
- Supportive, reassuring tone

[REFERENCES] (if any partial context provided)
- Include references to any content mentioned
```

### System Prompt Enhancement for Low Confidence

Add to system prompt when confidence is expected to be low:

```
[LOW CONFIDENCE RESPONSE RULES]

If your confidence in answering this question is below 0.65, you MUST:

1. **Provide Partial Context** (if available):
   - Extract any helpful information from the provided context
   - Be specific and factual about what IS in the context
   - Reference specific chapters if relevant

2. **State Uncertainty Clearly**:
   - Use explicit language: "I'm not fully confident I can provide a complete answer..."
   - Do NOT use vague hedging ("might be", "could be")
   - Explain what information is missing or unclear

3. **Notify About Escalation**:
   - Explicitly state: "I've forwarded your question to your trainer..."
   - Inform about notification: "You'll receive a notification when they respond"
   - Be supportive and reassuring

4. **Maintain Quality**:
   - Even with low confidence, provide value where possible
   - Be specific about what you CAN share
   - Don't guess or make assumptions
```

---

## Examples: Correct vs Incorrect Behavior

### Example 1: Low Confidence - FACTUAL Question

**Question**: "What is the exact formula for calculating keyword difficulty?"

**Context**: Course mentions keyword difficulty but doesn't provide exact formula.

#### ❌ INCORRECT (Vague Hedging)
```
Keyword difficulty might be calculated using various factors. It could involve 
search volume, competition, and other metrics. The formula possibly includes 
these elements, but I'm not entirely sure about the exact calculation method.
```

**Problems**:
- Uses vague hedging ("might be", "could involve", "possibly")
- No escalation notice
- Doesn't provide partial helpful context
- Sounds uncertain without explanation

#### ✅ CORRECT (Partial Context + Clear Notification)
```
The course content explains that keyword difficulty considers search volume, 
competition level, and domain authority, but the exact calculation formula 
isn't detailed in the available material.

I'm not fully confident I can provide a complete answer based on the available 
course content. I've forwarded your question to your trainer, who will provide 
a more detailed response. You'll receive a notification when they respond.

📖 Day 2 → Chapter 3: Keyword Research Fundamentals
```

**Why Correct**:
- Provides partial helpful context (what IS covered)
- States uncertainty explicitly
- Notifies about escalation
- No vague hedging
- Includes reference

---

### Example 2: Low Confidence - CONCEPTUAL Question

**Question**: "How does Google's algorithm actually work?"

**Context**: Course covers SEO principles but not Google's internal algorithm details.

#### ❌ INCORRECT (Vague Answer)
```
Google's algorithm is quite complex and might work in various ways. It could 
possibly consider many factors like relevance, authority, and user experience. 
The exact workings are somewhat unclear, but these elements likely play a role.
```

**Problems**:
- Excessive hedging ("might", "could possibly", "somewhat unclear", "likely")
- No escalation
- Doesn't provide what IS known
- Vague throughout

#### ✅ CORRECT (Partial Context + Clear Notification)
```
The course content explains SEO principles that align with how search engines 
work—including relevance, authority signals, and user experience factors. However, 
Google's specific internal algorithm details aren't covered in the available 
course material.

I'm not fully confident I can provide a complete answer based on the available 
course content. I've forwarded your question to your trainer, who will provide 
a more detailed response. You'll receive a notification when they respond.

📖 Day 1 → Chapter 1: SEO Fundamentals and The Modern Search Landscape
```

**Why Correct**:
- Provides what IS covered (SEO principles)
- Clearly states what's NOT covered (algorithm details)
- Explicit uncertainty statement
- Escalation notification
- No vague hedging

---

### Example 3: High Confidence - FACTUAL Question

**Question**: "What is SEO?"

**Context**: Clear definition in Day 1, Chapter 1.

#### ❌ INCORRECT (Unnecessary Hedging)
```
SEO might be the practice of improving website visibility. It could involve 
optimizing content and possibly improving rankings. The concept is likely 
related to search engines.
```

**Problems**:
- Uses hedging when data exists
- Sounds uncertain despite clear answer
- Doesn't sound decisive

#### ✅ CORRECT (Decisive Answer)
```
SEO (Search Engine Optimization) is the practice of improving a website's 
visibility in search engine results pages through organic, unpaid methods.

It involves optimizing various elements including content, technical structure, 
and off-page factors to rank higher for relevant search queries.

📖 Day 1 → Chapter 1: SEO Fundamentals and The Modern Search Landscape
```

**Why Correct**:
- Direct, definitive answer
- No hedging
- Sounds confident and decisive
- Complete information
- Includes reference

---

### Example 4: Very Low Confidence - No Context

**Question**: "What is the latest Google algorithm update?"

**Context**: No relevant chunks found.

#### ❌ INCORRECT (Guessing)
```
The latest Google algorithm update might be related to core updates that 
happen periodically. It could involve changes to ranking factors, possibly 
focusing on user experience or content quality. These updates typically 
occur a few times per year.
```

**Problems**:
- Guesses when no context exists
- Uses vague hedging
- Provides information not in course
- No escalation notice

#### ✅ CORRECT (Clear Inability + Escalation)
```
Thank you for your question about the latest Google algorithm update.

I don't have enough information in the course content to provide a complete 
answer to this question. I've forwarded your question to your trainer, who 
will provide a detailed response. You'll receive a notification when they respond.

I'm here to help with other questions about the course content!
```

**Why Correct**:
- Acknowledges question
- Clearly states inability
- No guessing
- Explicit escalation notice
- Supportive close

---

## Escalation Payload Requirements

### Required Escalation Data

Based on `AI_COACH_REQUIREMENTS.md` FR-5.3:

```javascript
{
    query_id: string,              // Original query ID
    learner_id: string,            // Learner ID
    trainer_id: string,            // Assigned trainer ID
    course_id: string,             // Course ID
    original_question: string,      // Exact learner question
    ai_confidence: number,         // Confidence score (0-1)
    ai_context: {
        chunk_ids: string[],      // IDs of chunks used
        chunks_used: Array<{      // Actual chunk content
            id: string,
            content: string,
            day: number,
            chapter_id: string,
            chapter_title: string
        }>,
        intent: string,           // Classified intent
        model_used: string,       // LLM model used
        similarity_scores: number[] // Similarity scores
    },
    learner_progress: {
        current_course: string,
        completed_chapters: string[],
        in_progress_chapters: string[],
        recent_lab_submissions: Array<{
            lab_id: string,
            status: string,
            score: number
        }>,
        current_chapter: string,  // If on specific chapter
        current_day: number       // If on specific day
    },
    status: 'pending',            // Initial status
    created_at: timestamp
}
```

---

## Integration with Existing System

### Current Flow Enhancement

**Current Flow**:
```
Generate Answer → Calculate Confidence → Check Threshold → Escalate if < 0.65
```

**Enhanced Flow**:
```
Generate Answer → Calculate Confidence → Validate Response → 
  ├─ High Confidence (≥ 0.80) → Return Decisive Answer
  ├─ Medium Confidence (0.65-0.79) → Return Full Answer
  └─ Low Confidence (< 0.65) → 
      ├─ Generate Low-Confidence Response (partial + disclaimer + escalation notice)
      ├─ Create Escalation Record
      └─ Return Response to Learner
```

### Code Integration Points

1. **AI Coach Service** (`lms/services/ai-coach-service.js`)
   - Enhance `processQuery()` to handle low confidence responses
   - Add response generation logic for low confidence
   - Integrate escalation creation

2. **LLM Service** (`lms/services/llm-service.js`)
   - Enhance `estimateConfidence()` to be more accurate
   - Add confidence factors calculation

3. **System Prompt** (`docs/AI_COACH_SYSTEM_PROMPT_FINAL.txt`)
   - Add low confidence response rules
   - Add confidence-aware language guidelines

---

## Confidence Calculation Enhancement

### Improved Confidence Estimation

```javascript
/**
 * Calculate confidence score with multiple factors
 * @param {string} question - Learner question
 * @param {Array} chunks - Retrieved context chunks
 * @param {string} answer - Generated answer
 * @param {Object} context - Additional context
 * @returns {Promise<number>} Confidence score (0-1)
 */
async function calculateConfidence(question, chunks, answer, context) {
    // Factor 1: Semantic Similarity (40% weight)
    const avgSimilarity = chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length;
    const similarityScore = Math.min(avgSimilarity * 1.2, 1.0); // Normalize to 0-1
    
    // Factor 2: Completeness (30% weight)
    const completenessScore = estimateCompleteness(question, answer, chunks);
    
    // Factor 3: Query Clarity (20% weight)
    const clarityScore = estimateQueryClarity(question);
    
    // Factor 4: Historical Accuracy (10% weight)
    const historicalScore = await getHistoricalAccuracy(question, context);
    
    // Weighted average
    const confidence = (
        similarityScore * 0.4 +
        completenessScore * 0.3 +
        clarityScore * 0.2 +
        historicalScore * 0.1
    );
    
    return Math.max(0, Math.min(1, confidence));
}

/**
 * Estimate how completely the answer addresses the question
 */
function estimateCompleteness(question, answer, chunks) {
    const questionKeywords = extractKeywords(question);
    const answerKeywords = extractKeywords(answer);
    
    // Check if answer addresses all aspects of question
    const coverage = questionKeywords.filter(kw => 
        answerKeywords.some(akw => akw.includes(kw) || kw.includes(akw))
    ).length / questionKeywords.length;
    
    // Check if answer length is appropriate (not too short)
    const lengthScore = Math.min(answer.split(/\s+/).length / 50, 1.0);
    
    return (coverage * 0.7 + lengthScore * 0.3);
}

/**
 * Estimate query clarity
 */
function estimateQueryClarity(question) {
    // Longer, more specific questions are clearer
    const wordCount = question.split(/\s+/).length;
    const hasQuestionWords = /what|how|why|where|which|when|who/i.test(question);
    const hasSpecificTerms = /(day|chapter|lab|concept|process|method)/i.test(question);
    
    let clarity = 0.5; // Base clarity
    
    if (wordCount >= 5 && wordCount <= 20) clarity += 0.2;
    if (hasQuestionWords) clarity += 0.2;
    if (hasSpecificTerms) clarity += 0.1;
    
    return Math.min(1.0, clarity);
}
```

---

## Learner Notification Messages

### Low Confidence Response Template

```javascript
function generateLowConfidenceResponse(partialContext, question, confidence) {
    let response = '';
    
    // Partial context section (if available)
    if (partialContext && partialContext.length > 0) {
        response += partialContext + '\n\n';
    }
    
    // Uncertainty statement
    if (confidence < 0.50) {
        response += 'I don\'t have enough information in the course content to provide a complete answer to this question.';
    } else {
        response += 'I\'m not fully confident I can provide a complete answer based on the available course content.';
    }
    
    // Escalation notice
    response += ' I\'ve forwarded your question to your trainer, who will provide a more detailed response. You\'ll receive a notification when they respond.';
    
    // Supportive close
    if (confidence < 0.50) {
        response += '\n\nI\'m here to help with other questions about the course content!';
    }
    
    return response;
}
```

---

## Monitoring & Quality Assurance

### Metrics to Track

1. **Confidence Distribution**
   - % of responses in each confidence range
   - Average confidence per intent type
   - Confidence trends over time

2. **Escalation Rate**
   - % of queries escalated
   - Escalation rate by intent
   - Escalation rate by confidence range

3. **Response Quality**
   - % of low confidence responses with partial context
   - % with proper escalation notices
   - % avoiding vague hedging

4. **Learner Satisfaction**
   - Feedback on low confidence responses
   - Satisfaction with escalation process
   - Time to trainer response

### Alert Thresholds

- Low confidence rate > 30% → Review retrieval/context building
- Escalation rate > 25% → Review confidence threshold
- Vague hedging detected > 5% → Review system prompt
- Missing escalation notices > 2% → Critical bug

---

## Testing Scenarios

### Test Case 1: High Confidence Response

**Input**: Clear question, high similarity chunks, complete answer possible

**Expected**:
- Confidence: 0.80-1.00
- Response: Decisive, no hedging
- Escalation: No

### Test Case 2: Low Confidence with Partial Context

**Input**: Question partially answerable, some relevant chunks

**Expected**:
- Confidence: 0.50-0.64
- Response: Partial context + disclaimer + escalation notice
- Escalation: Yes
- No vague hedging

### Test Case 3: Very Low Confidence, No Context

**Input**: Question not answerable, no relevant chunks

**Expected**:
- Confidence: 0.00-0.49
- Response: Clear inability statement + escalation notice
- Escalation: Yes
- No guessing

### Test Case 4: Medium Confidence

**Input**: Question answerable but with some limitations

**Expected**:
- Confidence: 0.65-0.79
- Response: Full answer, may note limitations
- Escalation: No

---

## Summary

### Key Rules

1. **Low Confidence (< 0.65)**:
   - ✅ Provide partial helpful context (if available)
   - ✅ Clearly state uncertainty
   - ✅ Explicitly notify about escalation
   - ✅ Trigger escalation
   - ❌ Never use vague hedging
   - ❌ Never guess or assume

2. **High Confidence (≥ 0.80)**:
   - ✅ Sound decisive and confident
   - ✅ Use definitive language
   - ✅ Provide complete answer
   - ❌ No unnecessary hedging

3. **Escalation**:
   - Always triggered when confidence < 0.65
   - Always notified to learner
   - Always includes full context for trainer

---

**Document Status**: ✅ Ready for Implementation

