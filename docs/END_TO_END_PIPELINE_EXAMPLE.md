# End-to-End Pipeline: Complete Working Example

## Example Query

**User Question:** `"what is aeo?"`

## Step-by-Step Execution

### Step 0: Query Normalization

**Input:**
```javascript
question = "what is aeo?"
```

**Service Call:**
```javascript
const normalized = await queryNormalizerService.normalize("what is aeo?");
```

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

**Console Logs:**
```
[StrictPipeline] Step 0: Query Normalization
[StrictPipeline] Normalized question: "What is answer engine optimization?"
[StrictPipeline] Extracted concepts: [answer engine optimization, AEO]
[StrictPipeline] Intent type: definition, Confidence: 1.0
[StrictPipeline] [DEBUG] Normalized Query JSON: {
  "normalized_question": "What is answer engine optimization?",
  "key_concepts": ["answer engine optimization", "AEO"],
  "intent_type": "definition",
  "confidence": 1.0,
  "original_question": "what is aeo?",
  "spelling_corrections": []
}
```

**Validation:**
```javascript
// Check if concepts exist
if (!normalized.key_concepts || normalized.key_concepts.length === 0) {
    // FAIL: Return error response
}
// PASS: Continue to Step 1
```

---

### Step 1: Reference Resolution

**Input:**
```javascript
originalQuestion = "what is aeo?"
normalizedQuestion = "What is answer engine optimization?"
concepts = ["answer engine optimization", "AEO"]
courseId = "seo-master-2026"
userId = "user-123"
```

**Service Call:**
```javascript
const step1Result = await strictPipelineService.step1ReferenceResolution(
    "what is aeo?",
    "What is answer engine optimization?",
    ["answer engine optimization", "AEO"],
    "seo-master-2026",
    "user-123"
);
```

#### Sub-step 1.1: Explicit Reference Resolution

**Service Call:**
```javascript
const explicitResult = await referenceResolutionService.resolve(
    "what is aeo?",
    "seo-master-2026"
);
```

**Output:**
```javascript
{
    resolved_nodes: [], // No explicit references found
    confidence: 0.0,
    resolution_type: "none"
}
```

**Result:** No explicit references → Proceed to semantic search

#### Sub-step 1.2: Semantic Search Fallback

**Service Call:**
```javascript
const semanticResult = await strictPipelineService.semanticSearchFallback(
    "What is answer engine optimization?",
    ["answer engine optimization", "AEO"],
    "seo-master-2026",
    "user-123",
    {}
);
```

**Validation:**
```javascript
// Check concepts exist
if (!concepts || concepts.length === 0) {
    // FAIL: Return null
}
// PASS: Continue to retrieval
```

**Retrieval Call:**
```javascript
const nodes = await nodeRetrievalService.hybridSearch(
    "What is answer engine optimization?", // normalized_question
    ["answer engine optimization", "AEO"], // concepts
    "seo-master-2026",
    {},
    5
);
```

**Retrieved Nodes:**
```javascript
[
    {
        canonical_reference: "D20.C1.S1",
        content: "Answer Engine Optimization (AEO) focuses on optimizing content for featured snippets and zero-click searches...",
        primary_topic: "Answer Engine Optimization",
        aliases: ["AEO", "answer engine optimization"],
        similarity: 0.95,
        // ... other fields
    }
]
```

**Canonical Reference Resolution:**
```javascript
const resolved = await canonicalReferenceRegistry.resolve("D20.C1.S1");
// Returns: {
//   canonical_reference: "D20.C1.S1",
//   display_reference: "Day 20 → Chapter 1 → Concept 1",
//   ...
// }
```

**Step 1 Output:**
```javascript
{
    proceed: true,
    nodes: [
        {
            canonical_reference: "D20.C1.S1",
            display_reference: "Day 20 → Chapter 1 → Concept 1",
            content: "Answer Engine Optimization (AEO) focuses on...",
            primary_topic: "Answer Engine Optimization",
            similarity: 0.95
        }
    ],
    source: "semantic",
    confidence: 0.95
}
```

**Console Logs:**
```
[StrictPipeline] Step 1: Reference Resolution
[StrictPipeline] Resolved 0 explicit references
[StrictPipeline] Semantic search fallback: Found 1 nodes
[StrictPipeline] Step 1 complete: 1 nodes resolved via semantic
```

---

### Step 2: Answer Generation

**Input:**
```javascript
normalizedQuestion = "What is answer engine optimization?"
nodes = [
    {
        canonical_reference: "D20.C1.S1",
        display_reference: "Day 20 → Chapter 1 → Concept 1",
        content: "Answer Engine Optimization (AEO) focuses on...",
        // ...
    }
]
options = {
    confidence: 0.95,
    source: "semantic",
    original_question: "what is aeo?",
    normalized_data: { /* normalized JSON */ }
}
```

**Service Call:**
```javascript
const step2Result = await strictPipelineService.step2AnswerGeneration(
    "What is answer engine optimization?",
    nodes,
    options
);
```

**Context Building:**
```javascript
const context = {
    question: "What is answer engine optimization?",
    nodes: [
        {
            reference: "D20.C1.S1",
            content: "Answer Engine Optimization (AEO) focuses on..."
        }
    ],
    references: ["D20.C1.S1"]
};
```

**LLM Call:**
```javascript
const answer = await llmService.generateAnswer(
    "What is answer engine optimization?",
    context,
    {
        references: ["D20.C1.S1"],
        strictMode: true
    }
);
```

**LLM Output:**
```
"Answer Engine Optimization (AEO) is a strategy focused on optimizing content 
for featured snippets and zero-click searches. It involves structuring content 
to directly answer user queries, making it more likely to appear in answer boxes 
and featured snippets on search engine results pages."
```

**Step 2 Output:**
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
    has_references: true,
    reference_count: 1
}
```

**Console Logs:**
```
[StrictPipeline] Step 2: Answer Generation
[StrictPipeline] Building context from 1 nodes
[StrictPipeline] Generating answer with LLM
[StrictPipeline] Step 2 complete: Answer generated with 1 references
```

---

## Final Response

**Complete Response Object:**
```javascript
{
    success: true,
    answer: "Answer Engine Optimization (AEO) is a strategy focused on optimizing content for featured snippets and zero-click searches. It involves structuring content to directly answer user queries, making it more likely to appear in answer boxes and featured snippets on search engine results pages.",
    references: [
        {
            canonical_reference: "D20.C1.S1",
            display_reference: "Day 20 → Chapter 1 → Concept 1"
        }
    ],
    confidence: 0.95,
    source: "semantic",
    has_references: true,
    reference_count: 1
}
```

---

## Error Scenarios

### Scenario 1: Normalization Fails (No Concepts)

**Input:**
```javascript
question = "???"
```

**Step 0 Output:**
```json
{
  "normalized_question": "???",
  "key_concepts": [],
  "intent_type": "general",
  "confidence": 0.1
}
```

**Validation:**
```javascript
if (normalized.key_concepts.length === 0) {
    // FAIL: Return error
}
```

**Response:**
```javascript
{
    success: false,
    answer: "I couldn't understand your question. Please try rephrasing it or ask your trainer for help.",
    references: [],
    confidence: 0.0,
    source: "normalization_failed",
    has_references: false,
    error: "No concepts extracted from query"
}
```

---

### Scenario 2: No Nodes Found

**Input:**
```javascript
question = "what is quantum computing?"
// (assuming course doesn't cover quantum computing)
```

**Step 1 Output:**
```javascript
{
    proceed: false,
    answer: "I don't have information about this topic in the course material. Please check with your trainer or refer to the course content directly.",
    references: [],
    confidence: 0.0
}
```

**Response:**
```javascript
{
    success: true,
    answer: "I don't have information about this topic in the course material. Please check with your trainer or refer to the course content directly.",
    references: [],
    confidence: 0.0,
    source: "no_nodes",
    has_references: false
}
```

---

## Code Example: Complete Integration

```javascript
// In ai-coach-widget.js or similar
async function handleUserQuery(userQuestion) {
    try {
        const result = await strictPipelineService.processQueryStrict(
            userQuestion,
            courseId,
            userId,
            {
                debug: true // Enable debug logging
            }
        );
        
        if (result.success) {
            // Display answer and references
            displayAnswer(result.answer);
            displayReferences(result.references);
        } else {
            // Display error message
            displayError(result.answer);
        }
    } catch (error) {
        console.error('Error processing query:', error);
        displayError("I encountered an error processing your question. Please try again.");
    }
}

// Example usage
handleUserQuery("what is aeo?");
```

---

## Summary

1. **Step 0:** Normalize query → Extract concepts
2. **Step 1:** Resolve references → Retrieve nodes
3. **Step 2:** Generate answer → Return response

**Key Features:**
- ✅ Normalization happens FIRST
- ✅ Debug logging for normalized JSON
- ✅ Fail-safe error handling (no silent fallbacks)
- ✅ Concepts validated before retrieval
- ✅ Clear error messages for users

