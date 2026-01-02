# AI Coach - Intelligence Layer Integration Plan

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Integration Plan

---

## Overview

This document outlines the integration of the new intelligence layer components into the existing AI Coach flow. The integration is designed to be **minimal, safe, and modular** while maintaining cost efficiency and service separation.

**New Components to Integrate**:
1. Enhanced Intent Classification (8 intents with priority rules)
2. Response Rules (per intent)
3. New System Prompt (senior trainer behavior)
4. Response Validation (per intent)
5. Enhanced Confidence & Escalation (low confidence handling)

**Constraints**:
- ✅ No database schema changes
- ✅ No RLS/security changes
- ✅ Cost-efficient (minimal additional LLM calls)
- ✅ Modular services (keep separation)

---

## Current Flow (Before Integration)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI COACH QUERY PROCESSING                     │
└─────────────────────────────────────────────────────────────────┘

1. [QueryProcessorService] Validate Query
   └─> Check course allocation, length, format

2. [QueryProcessorService] Preprocess Query
   └─> Normalize whitespace, punctuation

3. [LabStruggleDetectionService] Detect Lab Struggle (if lab-related)
   └─> Check learner's lab performance

4. [QueryProcessorService] Classify Intent
   └─> [LLMService] classifyIntent() → 5 intents (simple)
       - course_content
       - navigation
       - lab_guidance
       - lab_struggle
       - out_of_scope

5. Check Out of Scope
   └─> Return error if out_of_scope

6. [ContextBuilderService] Build Context
   └─> Get learner progress, current chapter, etc.

7. [RetrievalService] Hybrid Search
   └─> Semantic + keyword search for chunks

8. [ContextBuilderService] Filter Chunks by Access
   └─> Filter based on progress/access

9. [ContextBuilderService] Prioritize Chunks
   └─> Rank chunks by relevance

10. [ContextBuilderService] Select Chunks (token limit)
    └─> Select top chunks within 2000 tokens

11. [AICoachService] Build System Prompt
    └─> Simple prompt with trainer personalization

12. [LLMService] Generate Answer
    └─> generateAnswer() → GPT-4o-mini
        - Basic system prompt
        - Context chunks
        - Lab guidance rules (if needed)

13. [LLMService] Estimate Confidence
    └─> Simple LLM-based confidence (0-1)

14. Extract References
    └─> Map chunks to references

15. Store Query/Response
    └─> Save to database

16. Check Escalation
    └─> If confidence < 0.65 → escalate

17. Return Response
    └─> Return answer, references, confidence, etc.
```

---

## Enhanced Flow (After Integration)

```
┌─────────────────────────────────────────────────────────────────┐
│              AI COACH QUERY PROCESSING (ENHANCED)                │
└─────────────────────────────────────────────────────────────────┘

1. [QueryProcessorService] Validate Query
   └─> ✅ REUSED (no changes)

2. [QueryProcessorService] Preprocess Query
   └─> ✅ REUSED (no changes)

3. [LabStruggleDetectionService] Detect Lab Struggle (if lab-related)
   └─> ✅ REUSED (no changes)

4. [QueryProcessorService] Classify Intent ⚡ ENHANCED
   └─> [LLMService] classifyIntent() → 8 intents (enhanced)
       - factual / structural
       - conceptual / explanatory
       - example / practical
       - how_to / guided_learning
       - navigation / where_is
       - lab_guidance (no answers)
       - struggle / confusion
       - out_of_scope
       └─> Uses priority rules and keyword signals
       └─> Fallback strategy for edge cases

5. Check Out of Scope
   └─> ✅ REUSED (no changes)

6. [ContextBuilderService] Build Context
   └─> ✅ REUSED (no changes)

7. [RetrievalService] Hybrid Search
   └─> ✅ REUSED (no changes)

8. [ContextBuilderService] Filter Chunks by Access
   └─> ✅ REUSED (no changes)

9. [ContextBuilderService] Prioritize Chunks
   └─> ✅ REUSED (no changes)

10. [ContextBuilderService] Select Chunks (token limit)
    └─> ✅ REUSED (no changes)

11. [AICoachService] Build System Prompt ⚡ ENHANCED
    └─> Load new system prompt template
        - Senior trainer persona
        - Intent-aware rules
        - Response structure templates
        - Zero hallucination rules
        - Confidence-aware language
        └─> Inject: trainer personalization, course context, intent, chunks

12. [LLMService] Generate Answer ⚡ ENHANCED
    └─> generateAnswer() → GPT-4o-mini
        - Enhanced system prompt (from step 11)
        - Intent-specific instructions
        - Confidence-aware instructions (if low confidence expected)
        - Response structure templates

13. [LLMService] Estimate Confidence ⚡ ENHANCED
    └─> Multi-factor confidence calculation
        - Semantic similarity (40%)
        - Completeness (30%)
        - Query clarity (20%)
        - Historical accuracy (10%)
        └─> Returns 0-1 score

14. [AICoachService] Validate Response 🆕 NEW
    └─> validateResponse(response, intent, question, context)
        - Intent-specific validation rules
        - Pattern detection (vague hedging, direct answers, etc.)
        - Word count validation
        - Reference validation
        └─> Returns: { passed: boolean, failures: [] }

15. [AICoachService] Check Regeneration 🆕 NEW
    └─> shouldRegenerate(validationResult, confidence)
        - Critical failures → regenerate (max 3 attempts)
        - Multiple failures → regenerate (max 2 attempts)
        - Low confidence + failure → regenerate (max 2 attempts)
        └─> If regenerate: loop back to step 12 with enhanced prompt

16. [AICoachService] Handle Low Confidence 🆕 NEW
    └─> If confidence < 0.65:
        - Generate low-confidence response structure
        - Add partial context (if available)
        - Add uncertainty disclaimer
        - Add escalation notice
        └─> Replace answer with structured low-confidence response

17. Extract References
    └─> ✅ REUSED (no changes)

18. Store Query/Response
    └─> ✅ REUSED (no changes)

19. Check Escalation ⚡ ENHANCED
    └─> shouldEscalate(confidence, validationResult, context)
        - Low confidence (< 0.65) → escalate
        - Critical validation failures → escalate
        - Context insufficiency → escalate
        └─> Create escalation with full context

20. Return Response
    └─> Return answer, references, confidence, validation, escalated, etc.
```

---

## Component Mapping

### 1. Intent Classification

**Current**: `llmService.classifyIntent()` → 5 intents  
**Enhanced**: `llmService.classifyIntent()` → 8 intents with priority rules

**Changes**:
- ✅ **Modify**: `lms/services/llm-service.js` → `classifyIntent()` method
  - Update system prompt with 8 intent definitions
  - Add priority rules logic
  - Add keyword signal detection
  - Add fallback strategy
- ✅ **Reuse**: Same LLM call, same cost (GPT-3.5-turbo, ~10 tokens)

**Integration Point**: Step 4 in flow

---

### 2. System Prompt

**Current**: Simple prompt in `_buildSystemPrompt()`  
**Enhanced**: Full system prompt from `AI_COACH_SYSTEM_PROMPT_FINAL.txt`

**Changes**:
- ✅ **Modify**: `lms/services/ai-coach-service.js` → `_buildSystemPrompt()` method
  - Load prompt template from file or constant
  - Inject placeholders: {TRAINER_PERSONALIZATION}, {COURSE_NAME}, {INTENT_TYPE}, etc.
  - Add intent-specific rules section
  - Add confidence-aware rules (if low confidence expected)
- ✅ **Reuse**: Same prompt building logic, just enhanced template
- ✅ **No cost impact**: Same tokens, better instructions

**Integration Point**: Step 11 in flow

---

### 3. Response Validation

**Current**: Basic check for direct lab answers  
**Enhanced**: Full intent-specific validation

**Changes**:
- ✅ **New File**: `lms/services/response-validation-service.js`
  - `validateResponse(response, intent, question, context)` → validation result
  - Intent-specific validation functions
  - Pattern detection helpers
  - Word count validation
- ✅ **Modify**: `lms/services/ai-coach-service.js` → `processQuery()` method
  - Add validation step after answer generation
  - Add regeneration logic if validation fails
- ✅ **Reuse**: No LLM calls, pure pattern matching (fast, free)

**Integration Point**: Step 14 in flow

---

### 4. Confidence & Escalation

**Current**: Simple threshold check  
**Enhanced**: Multi-factor confidence + low confidence handling

**Changes**:
- ✅ **Modify**: `lms/services/llm-service.js` → `estimateConfidence()` method
  - Add multi-factor calculation
  - Add semantic similarity scoring
  - Add completeness estimation
  - Add query clarity estimation
- ✅ **Modify**: `lms/services/ai-coach-service.js` → `processQuery()` method
  - Add low confidence response generation
  - Add confidence-aware response structure
  - Enhance escalation logic
- ✅ **Reuse**: Same escalation service, enhanced decision logic
- ✅ **Cost impact**: Minimal (confidence calculation already exists, just enhanced)

**Integration Point**: Steps 13, 16, 19 in flow

---

### 5. Response Rules

**Current**: Basic lab guidance rules in system prompt  
**Enhanced**: Full intent-specific response rules

**Changes**:
- ✅ **Integrated into**: System prompt (step 11)
  - Response rules are part of system prompt template
  - Intent-specific rules injected based on classified intent
- ✅ **No separate service needed**: Rules are prompt-level
- ✅ **Reuse**: Same prompt injection mechanism

**Integration Point**: Step 11 in flow (via system prompt)

---

## Detailed Integration Points

### Integration Point 1: Enhanced Intent Classification

**File**: `lms/services/llm-service.js`  
**Method**: `classifyIntent(question, context)`

**Current Implementation**:
```javascript
// Returns: 'course_content' | 'navigation' | 'lab_guidance' | 'lab_struggle' | 'out_of_scope'
```

**Enhanced Implementation**:
```javascript
// Returns: 'factual' | 'conceptual' | 'example' | 'how_to' | 'navigation' | 
//          'lab_guidance' | 'struggle' | 'out_of_scope'

// Changes:
1. Update system prompt with 8 intent definitions
2. Add priority rules (check struggle before lab_guidance, etc.)
3. Add keyword signal detection
4. Add fallback strategy
```

**Cost Impact**: ✅ None (same LLM call, same model, same tokens)

---

### Integration Point 2: Enhanced System Prompt

**File**: `lms/services/ai-coach-service.js`  
**Method**: `_buildSystemPrompt(courseId, learnerId, intent, labStruggle)`

**Current Implementation**:
```javascript
// Simple prompt with basic rules
let basePrompt = `You are an AI Coach...`;
// Add trainer personalization
// Add basic rules
```

**Enhanced Implementation**:
```javascript
// Load full system prompt template
const systemPromptTemplate = loadSystemPromptTemplate(); // From AI_COACH_SYSTEM_PROMPT_FINAL.txt

// Replace placeholders:
- {TRAINER_PERSONALIZATION} → trainerInfo
- {COURSE_NAME} → courseName
- {COURSE_ID} → courseId
- {INTENT_TYPE} → intent (factual, conceptual, etc.)
- {INTENT_RULES} → intent-specific rules section
- {CONTEXT_CHUNKS} → selected chunks (injected in LLM call)
- {LEARNER_CONTEXT} → progress context
- {LAB_STRUGGLE_CONTEXT} → lab struggle (if applicable)
- {CONFIDENCE_AWARE_RULES} → low confidence rules (if confidence expected to be low)
```

**Cost Impact**: ✅ Minimal (slightly longer prompt, but same tokens per response)

---

### Integration Point 3: Response Validation

**File**: `lms/services/response-validation-service.js` (NEW)  
**Method**: `validateResponse(response, intent, question, context)`

**Implementation**:
```javascript
// Pure JavaScript validation (no LLM calls)
// Pattern matching, word count, reference checks
// Returns: { passed: boolean, failures: [], wordCount: number }
```

**Integration in `ai-coach-service.js`**:
```javascript
// After answer generation:
const validation = await responseValidationService.validateResponse(
    answerResult.answer,
    intent,
    processedQuestion,
    { chunks: selectedChunks, context: fullContext }
);

// Check if regeneration needed:
const regeneration = shouldRegenerate(validation, answerResult.confidence);

if (regeneration.regenerate && attempts < regeneration.maxAttempts) {
    // Regenerate with enhanced prompt + validation feedback
    const enhancedPrompt = buildRegenerationPrompt(systemPrompt, validation, answerResult.answer);
    // Loop back to answer generation
}
```

**Cost Impact**: ✅ None (pure JavaScript, no LLM calls)

---

### Integration Point 4: Enhanced Confidence Calculation

**File**: `lms/services/llm-service.js`  
**Method**: `estimateConfidence(question, contextChunks, answer)`

**Current Implementation**:
```javascript
// Simple LLM-based confidence estimation
// Returns: 0-1 score
```

**Enhanced Implementation**:
```javascript
// Multi-factor confidence:
1. Semantic Similarity (40%): avgSimilarity from chunks
2. Completeness (30%): estimateCompleteness(question, answer, chunks)
3. Query Clarity (20%): estimateQueryClarity(question)
4. Historical Accuracy (10%): getHistoricalAccuracy(question) [optional, can default to 0.5]

// Weighted average
const confidence = (
    similarityScore * 0.4 +
    completenessScore * 0.3 +
    clarityScore * 0.2 +
    historicalScore * 0.1
);
```

**Cost Impact**: ✅ Minimal (can keep existing LLM-based estimation or use pure JS)

---

### Integration Point 5: Low Confidence Response Handling

**File**: `lms/services/ai-coach-service.js`  
**Method**: `processQuery()` → Add new method `_generateLowConfidenceResponse()`

**Implementation**:
```javascript
// After confidence calculation:
if (answerResult.confidence < 0.65) {
    // Generate low confidence response structure
    const lowConfidenceResponse = this._generateLowConfidenceResponse(
        answerResult.answer,  // Partial context (if any)
        processedQuestion,
        answerResult.confidence,
        selectedChunks
    );
    
    // Replace answer
    answerResult.answer = lowConfidenceResponse;
    answerResult.isLowConfidence = true;
}
```

**Cost Impact**: ✅ None (pure string manipulation, no LLM calls)

---

### Integration Point 6: Enhanced Escalation Logic

**File**: `lms/services/ai-coach-service.js`  
**Method**: `processQuery()` → Enhance escalation check

**Current Implementation**:
```javascript
const shouldEscalate = answerResult.confidence < this.confidenceThreshold;
```

**Enhanced Implementation**:
```javascript
const shouldEscalate = this._shouldEscalate(
    answerResult.confidence,
    validation,  // From response validation
    { chunks: selectedChunks, context: fullContext }
);

// _shouldEscalate() checks:
// 1. Low confidence (< 0.65) → escalate
// 2. Critical validation failures → escalate
// 3. Context insufficiency → escalate
```

**Cost Impact**: ✅ None (pure logic, no LLM calls)

---

## Service Structure (After Integration)

```
lms/services/
├── ai-coach-service.js ⚡ ENHANCED
│   ├── processQuery() → Enhanced with validation, regeneration, low confidence handling
│   ├── _buildSystemPrompt() → Enhanced with new template
│   ├── _generateLowConfidenceResponse() → NEW
│   ├── _shouldEscalate() → Enhanced
│   └── _buildRegenerationPrompt() → NEW
│
├── llm-service.js ⚡ ENHANCED
│   ├── classifyIntent() → Enhanced with 8 intents, priority rules
│   ├── generateAnswer() → Enhanced with new system prompt
│   └── estimateConfidence() → Enhanced with multi-factor calculation
│
├── response-validation-service.js 🆕 NEW
│   ├── validateResponse() → Main validation function
│   ├── validateFactualResponse() → Intent-specific
│   ├── validateConceptualResponse() → Intent-specific
│   ├── validateExampleResponse() → Intent-specific
│   ├── validateHowToResponse() → Intent-specific
│   ├── validateNavigationResponse() → Intent-specific
│   ├── validateLabGuidanceResponse() → Intent-specific
│   ├── validateStruggleResponse() → Intent-specific
│   ├── validateOutOfScopeResponse() → Intent-specific
│   └── [Helper functions] → Pattern detection, word count, etc.
│
├── query-processor-service.js ✅ REUSED (no changes)
├── context-builder-service.js ✅ REUSED (no changes)
├── retrieval-service.js ✅ REUSED (no changes)
├── escalation-service.js ✅ REUSED (no changes)
├── lab-struggle-detection-service.js ✅ REUSED (no changes)
└── trainer-personalization-service.js ✅ REUSED (no changes)
```

---

## Cost Analysis

### Current Cost Per Query

1. **Intent Classification**: 1 call to GPT-3.5-turbo (~10 tokens) = ~$0.00001
2. **Answer Generation**: 1 call to GPT-4o-mini (~500 tokens) = ~$0.00015
3. **Confidence Estimation**: 1 call to GPT-3.5-turbo (~10 tokens) = ~$0.00001
4. **Total**: ~$0.00017 per query

### Enhanced Cost Per Query

1. **Intent Classification**: 1 call to GPT-3.5-turbo (~15 tokens) = ~$0.00001 ⚡ Same
2. **Answer Generation**: 1 call to GPT-4o-mini (~600 tokens) = ~$0.00018 ⚡ +20% (longer prompt)
3. **Confidence Estimation**: 1 call to GPT-3.5-turbo (~10 tokens) = ~$0.00001 ⚡ Same (or pure JS)
4. **Response Validation**: 0 LLM calls = $0 ✅ Free
5. **Regeneration** (if needed): +1 call to GPT-4o-mini (~600 tokens) = ~$0.00018 ⚡ Only if validation fails
6. **Total**: ~$0.00020 per query (base) + $0.00018 if regeneration needed

**Cost Impact**: ✅ **Minimal** (~18% increase base, +100% only if regeneration needed)

**Regeneration Rate**: Expected < 10% of queries → Average cost increase ~25%

---

## Safety & Risk Mitigation

### 1. Backward Compatibility

✅ **Intent Classification**: Map old intents to new intents for compatibility
```javascript
const intentMap = {
    'course_content': 'factual',  // Default mapping
    'navigation': 'navigation',
    'lab_guidance': 'lab_guidance',
    'lab_struggle': 'struggle',
    'out_of_scope': 'out_of_scope'
};
```

✅ **System Prompt**: Fallback to old prompt if new template fails to load

✅ **Validation**: Validation failures don't block responses (log and continue)

### 2. Error Handling

✅ **Validation Errors**: Log and continue (don't block user)
✅ **Regeneration Failures**: Max attempts (3) then return best response
✅ **Low Confidence Handling**: Always provide partial context if available

### 3. Gradual Rollout

✅ **Feature Flags**: Enable/disable new features per environment
```javascript
const FEATURES = {
    ENHANCED_INTENT_CLASSIFICATION: true,
    RESPONSE_VALIDATION: true,
    LOW_CONFIDENCE_HANDLING: true,
    ENHANCED_ESCALATION: true
};
```

---

## Implementation Order

### Phase 1: Core Enhancements (Low Risk)
1. ✅ Enhanced Intent Classification (8 intents)
2. ✅ Enhanced System Prompt (new template)
3. ✅ Enhanced Confidence Calculation

**Risk**: Low  
**Impact**: High  
**Cost**: Minimal

### Phase 2: Validation Layer (Medium Risk)
4. ✅ Response Validation Service
5. ✅ Regeneration Logic

**Risk**: Medium (new logic)  
**Impact**: High (quality improvement)  
**Cost**: Minimal (only if validation fails)

### Phase 3: Low Confidence Handling (Low Risk)
6. ✅ Low Confidence Response Generation
7. ✅ Enhanced Escalation Logic

**Risk**: Low  
**Impact**: High (better user experience)  
**Cost**: None

---

## Testing Strategy

### Unit Tests
- ✅ Intent classification (8 intents, priority rules)
- ✅ Response validation (each intent type)
- ✅ Confidence calculation (multi-factor)
- ✅ Low confidence response generation
- ✅ Escalation logic

### Integration Tests
- ✅ End-to-end query processing with new flow
- ✅ Regeneration loop (max attempts)
- ✅ Low confidence handling
- ✅ Escalation creation

### Regression Tests
- ✅ Existing queries still work
- ✅ Backward compatibility maintained
- ✅ No performance degradation

---

## Summary

### What's Reused (No Changes)
- ✅ Query validation
- ✅ Query preprocessing
- ✅ Lab struggle detection
- ✅ Context building
- ✅ Chunk retrieval
- ✅ Chunk filtering/prioritization
- ✅ Database storage
- ✅ Escalation service (interface)

### What's Enhanced (Minimal Changes)
- ⚡ Intent classification (8 intents, priority rules)
- ⚡ System prompt (new template, same injection)
- ⚡ Confidence calculation (multi-factor, same interface)
- ⚡ Escalation logic (enhanced decision, same service)

### What's New (Modular Services)
- 🆕 Response validation service (pure JS, no LLM)
- 🆕 Regeneration logic (in ai-coach-service)
- 🆕 Low confidence response generation (in ai-coach-service)

### Cost Impact
- ✅ Base: ~18% increase (longer prompt)
- ✅ With regeneration: ~25% average increase
- ✅ Validation: Free (no LLM calls)

### Risk Level
- ✅ Low (modular, backward compatible, feature flags)

---

**Document Status**: ✅ Ready for Implementation

