# NodeRetrievalService Refactoring Summary

## Overview

Refactored `NodeRetrievalService` to accept normalized input from `QueryNormalizerService` instead of processing raw user text directly.

## Changes Made

### 1. Method Signature Changes

#### `hybridSearch()` - BEFORE
```javascript
async hybridSearch(question, courseId, filters = {}, limit = 5)
```

#### `hybridSearch()` - AFTER
```javascript
async hybridSearch(normalizedQuestion, concepts, courseId, filters = {}, limit = 5)
```

**Changes:**
- ✅ Now accepts `normalizedQuestion` (pre-processed by QueryNormalizerService)
- ✅ Now accepts `concepts[]` (extracted key concepts)
- ✅ Removed direct question processing

#### `keywordSearch()` - BEFORE
```javascript
async keywordSearch(question, courseId, filters = {}, limit = 5)
```

#### `keywordSearch()` - AFTER
```javascript
async keywordSearch(concepts, courseId, filters = {}, limit = 5)
```

**Changes:**
- ✅ Now accepts `concepts[]` directly (no raw question)
- ✅ Removed all text parsing logic

### 2. Removed Code (Diff-Style)

#### REMOVED: Stop-word filtering
```diff
- const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'has', 'who', 'its', 'how', 'may', 'say', 'she', 'use', 'man', 'new', 'now', 'old', 'see', 'him', 'two', 'way', 'boy', 'did', 'let', 'put', 'too', 'tell', 'me', 'about', 'what', 'is', 'does', 'do', 'this', 'that', 'these', 'those'];
- const keywords = questionLower
-     .split(/\s+/)
-     .filter(w => w.length >= 3 && !stopWords.includes(w));
```

**Why removed:** Stop-word filtering is now handled by QueryNormalizerService.

#### REMOVED: Domain-specific phrase detection
```diff
- const commonPhrases = [
-     'technical seo', 'on page seo', 'off page seo', 'link building',
-     'keyword research', 'content optimization', 'search engine optimization',
-     'answer engine optimization', 'core web vitals', 'crawl budget',
-     'index coverage', 'canonical tags', 'meta tags', 'structured data',
-     'internal linking', 'external linking', 'backlink profile',
-     'search intent', 'serp features', 'featured snippets', 'e e a t',
-     'helpful content', 'site architecture', 'site speed', 'page speed'
- ];
- 
- const foundPhrases = [];
- commonPhrases.forEach(phrase => {
-     if (questionLower.includes(phrase)) {
-         foundPhrases.push(phrase);
-     }
- });
```

**Why removed:** Domain-specific logic violates course-agnostic requirement. Phrase extraction is now handled by QueryNormalizerService.

#### REMOVED: Acronym expansion
```diff
- const acronymExpansions = {
-     'aeo': ['answer engine optimization', 'answer engine'],
-     'seo': ['search engine optimization', 'search engine'],
-     'serp': ['search engine results page', 'search results'],
-     'ctr': ['click through rate', 'click rate'],
-     'cpc': ['cost per click'],
-     'cpm': ['cost per mille', 'cost per thousand'],
-     'eeat': ['e e a t', 'expertise experience authoritativeness trustworthiness']
- };
- 
- const expandedKeywords = [...foundPhrases, ...standaloneKeywords];
- standaloneKeywords.forEach(kw => {
-     if (acronymExpansions[kw]) {
-         expandedKeywords.push(...acronymExpansions[kw]);
-     }
- });
```

**Why removed:** Acronym expansion is domain-specific. QueryNormalizerService handles this generically via LLM.

#### REMOVED: Text parsing and keyword extraction
```diff
- const questionLower = question.toLowerCase().trim();
- // ... 50+ lines of text processing logic
- const keywords = questionLower.split(/\s+/).filter(...);
- const standaloneKeywords = keywords.filter(...);
```

**Why removed:** All text processing moved to QueryNormalizerService. NodeRetrievalService now operates on pre-extracted concepts.

### 3. Simplified Logic

#### BEFORE: Complex keyword extraction
- Lowercase conversion
- Stop-word removal
- Phrase detection
- Acronym expansion
- Keyword prioritization
- ~100 lines of text processing

#### AFTER: Direct concept usage
- Accept concepts array
- Validate concepts
- Sort by specificity (length/multi-word)
- Use primary concept for search
- ~30 lines of concept processing

### 4. What Was Preserved

✅ **Embedding logic** - Unchanged
- `searchSimilarNodes()` still uses embeddings
- `llmService.generateEmbedding()` calls unchanged

✅ **Canonical reference resolution** - Unchanged
- `canonicalReferenceRegistry.resolve()` calls unchanged
- Display reference formatting unchanged

✅ **Database queries** - Unchanged
- Supabase query structure unchanged
- Filtering logic unchanged
- Result formatting unchanged

## Migration Guide

### Updating Call Sites

#### Before:
```javascript
// In strict-pipeline-service.js
const nodes = await nodeRetrievalService.hybridSearch(question, courseId, filters, 5);
```

#### After:
```javascript
// In strict-pipeline-service.js
// First normalize the question
const normalized = await queryNormalizerService.normalize(question);

// Then use normalized input
const nodes = await nodeRetrievalService.hybridSearch(
    normalized.normalized_question,
    normalized.key_concepts,
    courseId,
    filters,
    5
);
```

### Required Updates

1. **strict-pipeline-service.js** - Update `semanticSearchFallback()`:
   ```javascript
   async semanticSearchFallback(question, courseId, userId) {
       // Normalize first
       const normalized = await queryNormalizerService.normalize(question);
       
       // Use normalized input
       const nodes = await nodeRetrievalService.hybridSearch(
           normalized.normalized_question,
           normalized.key_concepts,
           courseId,
           {},
           5
       );
       // ... rest of logic
   }
   ```

2. **Any other call sites** - Update to use normalized input

## Benefits

1. **Separation of Concerns**: Text processing separated from retrieval
2. **Course-Agnostic**: No domain-specific logic in retrieval service
3. **Reusability**: Retrieval service works with any normalized input
4. **Maintainability**: Easier to update text processing logic
5. **Testability**: Can test retrieval with mock concepts

## Code Statistics

- **Lines Removed**: ~120 lines of text processing
- **Lines Added**: ~30 lines of concept validation
- **Net Reduction**: ~90 lines
- **Complexity Reduction**: Significant (removed nested conditionals, loops)

## Testing

### Test Cases

1. **Empty concepts array**:
   ```javascript
   const result = await nodeRetrievalService.keywordSearch([], courseId);
   // Should return empty array
   ```

2. **Valid concepts**:
   ```javascript
   const result = await nodeRetrievalService.keywordSearch(
       ['technical optimization', 'crawl budget'],
       courseId
   );
   // Should search for "technical optimization" (most specific)
   ```

3. **Hybrid search with normalized input**:
   ```javascript
   const normalized = { normalized_question: "What is technical optimization?", key_concepts: ["technical optimization"] };
   const result = await nodeRetrievalService.hybridSearch(
       normalized.normalized_question,
       normalized.key_concepts,
       courseId
   );
   // Should perform both semantic and keyword search
   ```

## Backward Compatibility

⚠️ **BREAKING CHANGE**: This refactoring is NOT backward compatible.

**Required Actions:**
1. Update all call sites to use normalized input
2. Ensure QueryNormalizerService is integrated
3. Test all retrieval paths

## Next Steps

1. ✅ Update `strict-pipeline-service.js` to use normalized input
2. ✅ Update any other call sites
3. ✅ Add integration tests
4. ✅ Monitor performance metrics

