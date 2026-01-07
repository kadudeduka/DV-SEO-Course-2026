# Query Normalizer Service - Prompt & Examples

## LLM Normalization Prompt

```text
You are a Query Normalization Assistant. Your task is to preprocess user questions for a learning management system.

CRITICAL RULES:
1. CORRECT SPELLING: Fix all spelling mistakes and typos
2. CLARIFY INTENT: Rephrase questions into clear, unambiguous learning queries
3. PRESERVE TERMS: Do NOT replace the user's terminology with different terms/synonyms. Keep the user's key phrases (after spelling fixes).
4. EXTRACT CONCEPTS: Identify key concepts as noun phrases (2-4 words max per phrase). Prefer phrases that appear in the user's question.
5. ACRONYMS: If you expand an acronym, include BOTH forms in key_concepts (the acronym form and the expanded form) when applicable.
4. IDENTIFY INTENT: Classify the question type
5. BE GENERIC: Do NOT reference specific courses, domains, or topics
6. NO HALLUCINATION: Only work with what the user provided

INTENT TYPES:
- "definition": User wants to know what something is
- "explanation": User wants to understand how/why something works
- "comparison": User wants to compare two or more things
- "procedure": User wants to know steps/how-to
- "example": User wants examples or use cases
- "general": General question that doesn't fit other categories

OUTPUT FORMAT (JSON only):
{
  "normalized_question": "Corrected and rephrased question",
  "key_concepts": ["concept 1", "concept 2", "concept 3"],
  "intent_type": "definition|explanation|comparison|procedure|example|general",
  "confidence": 0.0-1.0,
  "original_question": "original user input",
  "spelling_corrections": ["word1 -> word2", "word3 -> word4"]
}

EXAMPLES:

Input: "wat is kpi?"
Output: {
  "normalized_question": "What is a key performance indicator?",
  "key_concepts": ["kpi", "key performance indicator"],
  "intent_type": "definition",
  "confidence": 0.95,
  "original_question": "wat is kpi?",
  "spelling_corrections": ["wat -> what"]
}

Input: "can you explain onpage seo?"
Output: {
  "normalized_question": "Can you explain onpage seo?",
  "key_concepts": ["onpage seo"],
  "intent_type": "explanation",
  "confidence": 0.9,
  "original_question": "can you explain onpage seo?",
  "spelling_corrections": []
}

Input: "tell me about api rate limits"
Output: {
  "normalized_question": "What are api rate limits?",
  "key_concepts": ["api", "rate limits"],
  "intent_type": "explanation",
  "confidence": 0.85,
  "original_question": "tell me about api rate limits",
  "spelling_corrections": []
}

Remember:
- Return ONLY valid JSON
- Do NOT include markdown formatting
- Do NOT add explanations outside JSON
- Do NOT over-generalize concepts (avoid collapsing specific phrases into a single broad term)
- Confidence should reflect certainty of normalization quality
```

## JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Query Normalization Result",
  "required": [
    "normalized_question",
    "key_concepts",
    "intent_type",
    "confidence",
    "original_question",
    "spelling_corrections"
  ],
  "properties": {
    "normalized_question": {
      "type": "string",
      "description": "Corrected and rephrased question in clear, unambiguous form",
      "minLength": 1
    },
    "key_concepts": {
      "type": "array",
      "description": "Key concepts extracted as noun phrases (2-4 words max per phrase)",
      "items": {
        "type": "string",
        "minLength": 2
      },
      "minItems": 0
    },
    "intent_type": {
      "type": "string",
      "enum": [
        "definition",
        "explanation",
        "comparison",
        "procedure",
        "example",
        "general"
      ],
      "description": "Classification of the user's intent"
    },
    "confidence": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Confidence score for normalization quality (0.0 = low, 1.0 = high)"
    },
    "original_question": {
      "type": "string",
      "description": "Original user input (preserved for reference)",
      "minLength": 1
    },
    "spelling_corrections": {
      "type": "array",
      "description": "List of spelling corrections made, format: 'word1 -> word2'",
      "items": {
        "type": "string",
        "pattern": "^.+ -> .+$"
      },
      "minItems": 0
    }
  }
}
```

## Example Input → Output

### Example 1: Spelling Correction + Acronym Expansion

**Input:**
```
"wat is aeo?"
```

**Output:**
```json
{
  "normalized_question": "What is answer engine optimization?",
  "key_concepts": ["answer engine optimization"],
  "intent_type": "definition",
  "confidence": 0.95,
  "original_question": "wat is aeo?",
  "spelling_corrections": [
    "wat -> what",
    "aeo -> answer engine optimization"
  ]
}
```

### Example 2: Intent Clarification + Concept Extraction

**Input:**
```
"how do i do technical seo stuff"
```

**Output:**
```json
{
  "normalized_question": "How do I perform technical optimization tasks?",
  "key_concepts": [
    "technical optimization",
    "optimization tasks"
  ],
  "intent_type": "procedure",
  "confidence": 0.9,
  "original_question": "how do i do technical seo stuff",
  "spelling_corrections": []
}
```

### Example 3: Multiple Concepts + Acronym Expansion

**Input:**
```
"tell me about aeo and serp features"
```

**Output:**
```json
{
  "normalized_question": "What are answer engine optimization and search engine results page features?",
  "key_concepts": [
    "answer engine optimization",
    "search engine results page",
    "serp features"
  ],
  "intent_type": "explanation",
  "confidence": 0.85,
  "original_question": "tell me about aeo and serp features",
  "spelling_corrections": [
    "aeo -> answer engine optimization",
    "serp -> search engine results page"
  ]
}
```

### Example 4: Comparison Intent

**Input:**
```
"whats the difference between on page and off page"
```

**Output:**
```json
{
  "normalized_question": "What is the difference between on-page optimization and off-page optimization?",
  "key_concepts": [
    "on-page optimization",
    "off-page optimization"
  ],
  "intent_type": "comparison",
  "confidence": 0.88,
  "original_question": "whats the difference between on page and off page",
  "spelling_corrections": [
    "whats -> what is"
  ]
}
```

### Example 5: Procedure Intent

**Input:**
```
"steps to optimize my website"
```

**Output:**
```json
{
  "normalized_question": "What are the steps to optimize a website?",
  "key_concepts": [
    "website optimization",
    "optimization steps"
  ],
  "intent_type": "procedure",
  "confidence": 0.87,
  "original_question": "steps to optimize my website",
  "spelling_corrections": []
}
```

### Example 6: Example Intent

**Input:**
```
"give me examples of keyword research"
```

**Output:**
```json
{
  "normalized_question": "What are examples of keyword research?",
  "key_concepts": [
    "keyword research",
    "research examples"
  ],
  "intent_type": "example",
  "confidence": 0.92,
  "original_question": "give me examples of keyword research",
  "spelling_corrections": []
}
```

### Example 7: Complex Question with Multiple Corrections

**Input:**
```
"explain how serp fetures work and wat makes them important"
```

**Output:**
```json
{
  "normalized_question": "Explain how search engine results page features work and what makes them important",
  "key_concepts": [
    "search engine results page",
    "serp features",
    "feature importance"
  ],
  "intent_type": "explanation",
  "confidence": 0.83,
  "original_question": "explain how serp fetures work and wat makes them important",
  "spelling_corrections": [
    "serp -> search engine results page",
    "fetures -> features",
    "wat -> what"
  ]
}
```

## Usage in Code

```javascript
import { queryNormalizerService } from './query-normalizer-service.js';

// Normalize a question
const result = await queryNormalizerService.normalize("wat is seo?");

console.log(result.normalized_question);
// "What is search engine optimization?"

console.log(result.key_concepts);
// ["search engine optimization"]

console.log(result.intent_type);
// "definition"

console.log(result.confidence);
// 0.95

// Use normalized question for retrieval
const nodes = await nodeRetrievalService.hybridSearch(
    result.normalized_question,
    courseId,
    {
        keyConcepts: result.key_concepts,
        intentType: result.intent_type
    }
);
```

## Integration Points

1. **Before NodeRetrievalService**: Normalize question before semantic/keyword search
2. **Before StrictPipelineService**: Normalize in `semanticSearchFallback`
3. **In AI Coach Widget**: Normalize before sending to service

## Benefits

1. **Robustness**: Handles typos, slang, and unclear questions
2. **Accuracy**: Better concept extraction improves retrieval
3. **Intent Awareness**: Intent type helps prioritize results
4. **Course-Agnostic**: Works for any course content
5. **Structured**: JSON output enables downstream processing

