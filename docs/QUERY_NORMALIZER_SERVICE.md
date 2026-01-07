# Query Normalizer Service

## Overview

The `QueryNormalizerService` preprocesses raw user questions before node retrieval. It corrects spelling, clarifies intent, extracts key concepts, and identifies question types - all in a course-agnostic manner.

## Purpose

**Problem Solved:**
- NodeRetrievalService was parsing raw user text directly
- This caused failures with spelling mistakes, filler words, and intent noise
- Retrieval needed to become more robust and course-agnostic

**Solution:**
- Separate query normalization from retrieval logic
- Use LLM to intelligently normalize questions
- Return structured JSON for downstream processing

## Architecture

```
User Question → QueryNormalizerService → Normalized Query → NodeRetrievalService
```

## Responsibilities

1. **Spelling Correction**: Fix typos and spelling mistakes
2. **Intent Clarification**: Rephrase questions into clear learning queries
3. **Concept Extraction**: Identify key concepts as noun phrases
4. **Intent Classification**: Determine question type (definition, explanation, etc.)
5. **Structured Output**: Return JSON with all metadata

## API

### `normalize(rawQuestion: string): Promise<Object>`

Normalizes a user question and returns structured metadata.

**Parameters:**
- `rawQuestion` (string): Raw user input

**Returns:**
```typescript
{
  normalized_question: string,      // Corrected and rephrased question
  key_concepts: string[],          // Array of key concepts (noun phrases)
  intent_type: string,             // Question type
  confidence: number,              // 0.0-1.0 normalization confidence
  original_question: string,       // Original user input
  spelling_corrections: string[]   // Array of "word1 -> word2" corrections
}
```

**Intent Types:**
- `definition`: "What is X?"
- `explanation`: "How/Why does X work?"
- `comparison`: "Compare X and Y"
- `procedure`: "How do I do X?"
- `example`: "Give examples of X"
- `general`: General question

## LLM Prompt

The service uses a carefully crafted prompt that:

1. **Enforces Rules:**
   - Course-agnostic (no domain-specific hardcoding)
   - No content retrieval
   - No hallucination
   - JSON-only output

2. **Provides Examples:**
   - Shows correct input/output format
   - Demonstrates spelling correction
   - Illustrates concept extraction

3. **Defines Intent Types:**
   - Clear categories with examples
   - Helps LLM classify accurately

## JSON Schema

```json
{
  "type": "object",
  "required": ["normalized_question", "key_concepts", "intent_type", "confidence", "original_question", "spelling_corrections"],
  "properties": {
    "normalized_question": {
      "type": "string",
      "description": "Corrected and rephrased question"
    },
    "key_concepts": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Key concepts as noun phrases (2-4 words max)"
    },
    "intent_type": {
      "type": "string",
      "enum": ["definition", "explanation", "comparison", "procedure", "example", "general"]
    },
    "confidence": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0
    },
    "original_question": {
      "type": "string"
    },
    "spelling_corrections": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^.+ -> .+$"
      }
    }
  }
}
```

## Examples

### Example 1: Spelling Correction

**Input:**
```javascript
await queryNormalizerService.normalize("wat is seo?");
```

**Output:**
```json
{
  "normalized_question": "What is search engine optimization?",
  "key_concepts": ["search engine optimization"],
  "intent_type": "definition",
  "confidence": 0.95,
  "original_question": "wat is seo?",
  "spelling_corrections": ["wat -> what", "seo -> search engine optimization"]
}
```

### Example 2: Intent Clarification

**Input:**
```javascript
await queryNormalizerService.normalize("how do i do technical seo stuff");
```

**Output:**
```json
{
  "normalized_question": "How do I perform technical optimization tasks?",
  "key_concepts": ["technical optimization", "optimization tasks"],
  "intent_type": "procedure",
  "confidence": 0.9,
  "original_question": "how do i do technical seo stuff",
  "spelling_corrections": []
}
```

### Example 3: Acronym Expansion

**Input:**
```javascript
await queryNormalizerService.normalize("tell me about aeo and serp features");
```

**Output:**
```json
{
  "normalized_question": "What are answer engine optimization and search engine results page features?",
  "key_concepts": ["answer engine optimization", "search engine results page", "serp features"],
  "intent_type": "explanation",
  "confidence": 0.85,
  "original_question": "tell me about aeo and serp features",
  "spelling_corrections": ["aeo -> answer engine optimization", "serp -> search engine results page"]
}
```

### Example 4: Comparison Intent

**Input:**
```javascript
await queryNormalizerService.normalize("whats the difference between on page and off page");
```

**Output:**
```json
{
  "normalized_question": "What is the difference between on-page optimization and off-page optimization?",
  "key_concepts": ["on-page optimization", "off-page optimization"],
  "intent_type": "comparison",
  "confidence": 0.88,
  "original_question": "whats the difference between on page and off page",
  "spelling_corrections": ["whats -> what is"]
}
```

## Integration

### With NodeRetrievalService

```javascript
// Before normalization
const nodes = await nodeRetrievalService.hybridSearch(question, courseId);

// After normalization
const normalized = await queryNormalizerService.normalize(question);
const nodes = await nodeRetrievalService.hybridSearch(
    normalized.normalized_question,
    courseId,
    {
        keyConcepts: normalized.key_concepts,
        intentType: normalized.intent_type
    }
);
```

### With StrictPipelineService

```javascript
// In strict-pipeline-service.js
async semanticSearchFallback(question, courseId, userId) {
    // Normalize question first
    const normalized = await queryNormalizerService.normalize(question);
    
    // Use normalized question and extracted concepts
    const nodes = await nodeRetrievalService.hybridSearch(
        normalized.normalized_question,
        courseId,
        {
            keyConcepts: normalized.key_concepts,
            intentType: normalized.intent_type
        }
    );
    
    // ... rest of logic
}
```

## Caching

The service implements in-memory caching:
- Cache key: Lowercased, trimmed question
- Cache timeout: 5 minutes
- Cache size: ~1000 entries (approximate)

**Cache Management:**
```javascript
// Clear cache
queryNormalizerService.clearCache();

// Get cache stats
const stats = queryNormalizerService.getCacheStats();
```

## Error Handling

The service includes robust error handling:

1. **Invalid Input**: Returns empty result structure
2. **LLM Failure**: Falls back to basic normalization (keyword extraction + intent inference)
3. **JSON Parse Error**: Falls back to basic normalization
4. **Network Errors**: Logged and fallback used

## Performance

- **Average Latency**: 200-500ms (LLM call)
- **Cache Hit Rate**: ~30-40% (typical user behavior)
- **Fallback Latency**: <10ms (keyword extraction only)

## Strict Rules

✅ **DO:**
- Correct spelling mistakes
- Extract generic concepts
- Classify intent types
- Return structured JSON

❌ **DON'T:**
- Reference specific course content
- Use hardcoded domain terms
- Retrieve nodes
- Hallucinate concepts
- Add markdown formatting to output

## Testing

```javascript
// Test spelling correction
const result1 = await queryNormalizerService.normalize("wat is seo?");
console.assert(result1.normalized_question.includes("search engine optimization"));

// Test intent classification
const result2 = await queryNormalizerService.normalize("how do I do X?");
console.assert(result2.intent_type === "procedure");

// Test concept extraction
const result3 = await queryNormalizerService.normalize("tell me about technical optimization");
console.assert(result3.key_concepts.includes("technical optimization"));
```

## Future Enhancements

1. **Multi-language Support**: Normalize questions in different languages
2. **Context Awareness**: Use conversation history for better normalization
3. **Confidence Thresholds**: Reject low-confidence normalizations
4. **Custom Intent Types**: Allow domain-specific intent types
5. **Batch Normalization**: Normalize multiple questions at once

