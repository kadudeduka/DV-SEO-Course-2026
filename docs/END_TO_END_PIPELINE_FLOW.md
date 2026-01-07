# End-to-End Question Handling Pipeline

## Overview

The AI Coach pipeline has been updated to include query normalization as the first step, ensuring robust concept extraction before retrieval.

## Pipeline Flow

### OLD Flow
```
User Question → NodeRetrievalService → Answer
```

### NEW Flow
```
User Question
  ↓
QueryNormalizerService (Step 0)
  ↓
NodeRetrievalService (Step 1)
  ↓
Canonical Reference Resolution (Step 1)
  ↓
LLM Explanation (Step 2)
  ↓
Answer
```

## Detailed Steps

### Step 0: Query Normalization

**Service:** `QueryNormalizerService`

**Input:**
- Raw user question: `"what is aeo?"`

**Process:**
1. Correct spelling mistakes
2. Rephrase for clarity
3. Extract key concepts
4. Identify intent type
5. Return structured JSON

**Output:**
```json
{
  "normalized_question": "What is answer engine optimization?",
  "key_concepts": ["answer engine optimization", "AEO"],
  "intent_type": "definition",
  "confidence": 1.0,
  "original_question": "what is aeo?",
  "spelling_corrections": []
}
```

**Logging:**
- Always logs: normalized question, concepts, intent, confidence
- Debug mode: Full JSON output

**Error Handling:**
- If normalization fails → Returns error response (no silent fallback)
- If no concepts extracted → Returns error response (no silent fallback)

### Step 1: Reference Resolution

**Service:** `StrictPipelineService.step1ReferenceResolution()`

**Input:**
- Original question: `"what is aeo?"`
- Normalized question: `"What is answer engine optimization?"`
- Concepts: `["answer engine optimization", "AEO"]`

**Process:**
1. Try explicit reference resolution (using original question)
2. If no explicit references found → Semantic search fallback (using normalized question + concepts)
3. Retrieve nodes using `NodeRetrievalService.hybridSearch()`
4. Resolve canonical references

**Output:**
```javascript
{
  proceed: true,
  nodes: [
    {
      canonical_reference: "D20.C1.S1",
      display_reference: "Day 20 → Chapter 1 → Concept 1",
      content: "Answer Engine Optimization (AEO) focuses on...",
      // ... other node data
    }
  ],
  source: "semantic",
  confidence: 0.95
}
```

**Error Handling:**
- If no nodes found → Returns early with helpful message (no silent fallback)
- If retrieval fails → Throws error (no silent fallback)

### Step 2: Answer Generation

**Service:** `StrictPipelineService.step2AnswerGeneration()`

**Input:**
- Normalized question: `"What is answer engine optimization?"`
- Resolved nodes: Array of node objects
- Options: confidence, source, etc.

**Process:**
1. Build context from resolved nodes
2. Generate answer using LLM with strict constraints
3. Extract and validate references
4. Return formatted response

**Output:**
```javascript
{
  success: true,
  answer: "Answer Engine Optimization (AEO) is a strategy focused on...",
  references: [
    {
      canonical_reference: "D20.C1.S1",
      display_reference: "Day 20 → Chapter 1 → Concept 1"
    }
  ],
  confidence: 0.95,
  source: "semantic",
  has_references: true
}
```

## Code Changes

### 1. Updated `strict-pipeline-service.js`

#### Added Import
```javascript
import { queryNormalizerService } from './query-normalizer-service.js';
```

#### Added Method: `normalizeQuery()`
```javascript
async normalizeQuery(question, debug = false) {
    try {
        const normalized = await queryNormalizerService.normalize(question);
        
        // Debug logging (if enabled)
        if (debug || process.env.DEBUG === 'true') {
            console.log('[StrictPipeline] [DEBUG] Normalized Query JSON:', JSON.stringify(normalized, null, 2));
        }
        
        // Log normalized data (always log key info)
        console.log(`[StrictPipeline] Normalized question: "${normalized.normalized_question}"`);
        console.log(`[StrictPipeline] Extracted concepts: [${normalized.key_concepts.join(', ')}]`);
        console.log(`[StrictPipeline] Intent type: ${normalized.intent_type}, Confidence: ${normalized.confidence}`);
        
        return normalized;
    } catch (error) {
        console.error('[StrictPipeline] Error normalizing query:', error);
        throw new Error(`Query normalization failed: ${error.message}`);
    }
}
```

#### Updated Method: `processQueryStrict()`
```javascript
async processQueryStrict(question, courseId, userId, options = {}) {
    // STEP 0: Query Normalization (NEW - First Step)
    const normalized = await this.normalizeQuery(question, options.debug);
    
    // Fail safely if no concepts found (no silent fallbacks)
    if (!normalized || !normalized.key_concepts || normalized.key_concepts.length === 0) {
        return {
            success: false,
            answer: "I couldn't understand your question. Please try rephrasing it or ask your trainer for help.",
            references: [],
            confidence: 0.0,
            source: 'normalization_failed',
            has_references: false,
            error: 'No concepts extracted from query'
        };
    }
    
    // STEP 1: Reference Resolution (using normalized concepts)
    const step1Result = await this.step1ReferenceResolution(
        question, 
        normalized.normalized_question,
        normalized.key_concepts,
        courseId, 
        userId
    );
    
    // STEP 2: Answer Generation (using normalized question)
    const step2Result = await this.step2AnswerGeneration(
        normalized.normalized_question,
        step1Result.nodes,
        {
            ...options,
            confidence: step1Result.confidence,
            source: step1Result.source,
            original_question: question,
            normalized_data: normalized
        }
    );
    
    return {
        success: true,
        ...step2Result
    };
}
```

#### Updated Method: `step1ReferenceResolution()`
```javascript
async step1ReferenceResolution(originalQuestion, normalizedQuestion, concepts, courseId, userId) {
    // Try explicit resolution first (using original question for reference patterns)
    let resolution = await this.resolveExplicitReferences(originalQuestion, courseId);
    
    // Fallback to semantic search (using normalized question and concepts)
    if (!resolution || resolution.nodeIds.length === 0) {
        resolution = await this.semanticSearchFallback(normalizedQuestion, concepts, courseId, userId);
    }
    
    // ... rest of method
}
```

#### Updated Method: `semanticSearchFallback()`
```javascript
async semanticSearchFallback(normalizedQuestion, concepts, courseId, userId, filters = {}) {
    // Validate concepts (fail safely, no silent fallbacks)
    if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
        console.error('[StrictPipeline] Semantic search failed: No concepts provided');
        return null;
    }
    
    // Perform hybrid search with normalized input
    const nodes = await nodeRetrievalService.hybridSearch(
        normalizedQuestion,
        concepts,
        courseId,
        filters,
        5
    );
    
    if (nodes.length === 0) {
        console.warn('[StrictPipeline] Semantic search found 0 nodes');
        return null;
    }
    
    // ... rest of method
}
```

## Error Handling

### No Silent Fallbacks

The pipeline explicitly fails if:

1. **Normalization fails:**
   ```javascript
   if (!normalized || !normalized.key_concepts || normalized.key_concepts.length === 0) {
       return {
           success: false,
           answer: "I couldn't understand your question...",
           error: 'No concepts extracted from query'
       };
   }
   ```

2. **No concepts provided to retrieval:**
   ```javascript
   if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
       console.error('[StrictPipeline] Semantic search failed: No concepts provided');
       return null;
   }
   ```

3. **No nodes found:**
   ```javascript
   if (!resolution || resolution.nodeIds.length === 0) {
       return {
           proceed: false,
           answer: "I don't have information about this topic...",
           confidence: 0.0
       };
   }
   ```

## Debug Mode

### Enable Debug Logging

**Option 1: Environment Variable**
```bash
DEBUG=true node server.js
```

**Option 2: Options Parameter**
```javascript
await strictPipelineService.processQueryStrict(
    question,
    courseId,
    userId,
    { debug: true }
);
```

### Debug Output

When debug mode is enabled, the full normalized JSON is logged:

```json
{
  "normalized_question": "What is answer engine optimization?",
  "key_concepts": ["answer engine optimization", "AEO"],
  "intent_type": "definition",
  "confidence": 1.0,
  "original_question": "what is aeo?",
  "spelling_corrections": []
}
```

## Example: Full Working Flow

See `docs/END_TO_END_PIPELINE_EXAMPLE.md` for a complete working example.

