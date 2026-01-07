# Course-Agnostic Retrieval Architecture

## Overview

The retrieval layer has been completely refactored to remove all hardcoded course-specific vocabulary. Retrieval now operates **exclusively** on course-defined metadata fields, making the system fully reusable across any course domain.

## Problem Statement

### Before Refactoring

The retrieval layer contained hardcoded course-specific terms:
- ❌ `commonPhrases[]` - 18 SEO-specific phrases
- ❌ `acronymExpansions{}` - 7 SEO acronyms
- ❌ `stopWords[]` - Domain-agnostic but hardcoded
- ❌ Text parsing logic that assumed specific vocabulary

**Impact:** System was non-reusable. Adding a new course (e.g., "Machine Learning") would require code changes.

### After Refactoring

✅ **Zero hardcoded vocabulary**
✅ **Metadata-driven retrieval**
✅ **Fully course-agnostic**

## Solution Architecture

### Metadata Fields Used

Retrieval now matches against these **course-defined** metadata fields only:

1. **`primary_topic`** (TEXT)
   - Main topic the node covers
   - Example: "Technical SEO", "Link Building", "Machine Learning Basics"

2. **`aliases`** (TEXT[])
   - Alternative terms/variations for this node
   - Example: `["SEO", "search engine optimization", "search optimization"]`
   - Example: `["ML", "machine learning", "AI learning"]`

3. **`keywords`** (TEXT[])
   - Search keywords for this node
   - Example: `["crawl budget", "indexing", "robots.txt"]`
   - Example: `["neural networks", "backpropagation", "gradient descent"]`

4. **`content`** (TEXT) - Fallback only
   - Full content text (used if metadata doesn't match)

5. **`container_title`** (TEXT) - Fallback only
   - Chapter/lab title (used if metadata doesn't match)

### Retrieval Priority

Retrieval follows this priority order (highest to lowest):

1. **`primary_topic`** (relevance: 1.0)
   - Exact or partial match
   - Highest confidence

2. **`aliases`** (relevance: 0.95)
   - Array contains concept
   - Course-defined vocabulary variations

3. **`keywords`** (relevance: 0.8)
   - Array contains concept
   - Related search terms

4. **`content`** (relevance: 0.6)
   - Full-text search fallback
   - Used if metadata doesn't match

5. **`container_title`** (relevance: 0.5)
   - Title search fallback
   - Lowest priority

### SQL Queries

#### Primary Topic Search
```sql
SELECT * FROM content_nodes
WHERE course_id = $1
  AND is_valid = true
  AND primary_topic ILIKE '%concept%'
LIMIT 10;
```

#### Aliases Array Search
```sql
SELECT * FROM content_nodes
WHERE course_id = $1
  AND is_valid = true
  AND aliases @> ARRAY['concept']::TEXT[]
LIMIT 10;
```

#### Keywords Array Search
```sql
SELECT * FROM content_nodes
WHERE course_id = $1
  AND is_valid = true
  AND keywords @> ARRAY['concept']::TEXT[]
LIMIT 10;
```

## Database Schema

### Migration: Add Aliases Field

```sql
-- Add aliases field to content_nodes
ALTER TABLE content_nodes 
ADD COLUMN IF NOT EXISTS aliases TEXT[];

-- Add GIN index for fast array searches
CREATE INDEX IF NOT EXISTS idx_content_nodes_aliases 
ON content_nodes USING GIN (aliases) 
WHERE aliases IS NOT NULL AND array_length(aliases, 1) > 0;

-- Add aliases to canonical_reference_registry
ALTER TABLE canonical_reference_registry 
ADD COLUMN IF NOT EXISTS aliases TEXT[];
```

### Indexes

```sql
-- Primary topic index
CREATE INDEX idx_content_nodes_topic 
ON content_nodes(course_id, primary_topic) 
WHERE primary_topic IS NOT NULL;

-- Aliases GIN index (for array contains)
CREATE INDEX idx_content_nodes_aliases 
ON content_nodes USING GIN (aliases) 
WHERE aliases IS NOT NULL;

-- Keywords GIN index
CREATE INDEX idx_content_nodes_keywords 
ON content_nodes USING GIN (keywords) 
WHERE keywords IS NOT NULL;
```

## Example: SEO Course

### Content Node Metadata

```json
{
  "canonical_reference": "D20.C1.S1",
  "primary_topic": "Answer Engine Optimization",
  "aliases": ["AEO", "answer engine optimization", "answer optimization"],
  "keywords": ["featured snippets", "zero-click searches", "voice search"],
  "content": "Answer Engine Optimization (AEO) focuses on...",
  "container_title": "Day 20, Chapter 1 - Answer Engine Optimization"
}
```

### User Query: "what is aeo?"

1. **QueryNormalizerService** normalizes:
   ```json
   {
     "normalized_question": "What is answer engine optimization?",
     "key_concepts": ["answer engine optimization", "AEO"],
     "intent_type": "definition"
   }
   ```

2. **NodeRetrievalService** searches:
   - ✅ **primary_topic**: `ILIKE '%answer engine optimization%'` → Match!
   - ✅ **aliases**: `@> ARRAY['AEO']` → Match!
   - Result: Node D20.C1.S1 found with relevance 1.0

## Example: Machine Learning Course (No Code Changes!)

### Content Node Metadata

```json
{
  "canonical_reference": "D5.C2.S3",
  "primary_topic": "Neural Networks",
  "aliases": ["NN", "neural networks", "artificial neural networks", "ANNs"],
  "keywords": ["backpropagation", "gradient descent", "activation function"],
  "content": "Neural networks are computing systems inspired by...",
  "container_title": "Day 5, Chapter 2 - Deep Learning Fundamentals"
}
```

### User Query: "explain neural networks"

1. **QueryNormalizerService** normalizes:
   ```json
   {
     "normalized_question": "Explain neural networks.",
     "key_concepts": ["neural networks"],
     "intent_type": "explanation"
   }
   ```

2. **NodeRetrievalService** searches:
   - ✅ **primary_topic**: `ILIKE '%neural networks%'` → Match!
   - ✅ **aliases**: `@> ARRAY['neural networks']` → Match!
   - Result: Node D5.C2.S3 found with relevance 1.0

**No code changes required!** The same retrieval logic works for any course.

## Example: Data Science Course

### Content Node Metadata

```json
{
  "canonical_reference": "D10.C1.S5",
  "primary_topic": "Statistical Hypothesis Testing",
  "aliases": ["hypothesis testing", "statistical tests", "t-tests", "p-values"],
  "keywords": ["null hypothesis", "alternative hypothesis", "significance level", "type I error"],
  "content": "Hypothesis testing is a statistical method...",
  "container_title": "Day 10, Chapter 1 - Inferential Statistics"
}
```

### User Query: "what are p-values?"

1. **QueryNormalizerService** normalizes:
   ```json
   {
     "normalized_question": "What are p-values?",
     "key_concepts": ["p-values"],
     "intent_type": "definition"
   }
   ```

2. **NodeRetrievalService** searches:
   - ❌ **primary_topic**: No match
   - ✅ **aliases**: `@> ARRAY['p-values']` → Match!
   - Result: Node D10.C1.S5 found with relevance 0.95

## Implementation Details

### NodeRetrievalService.keywordSearch()

```javascript
async keywordSearch(concepts, courseId, filters = {}, limit = 5) {
    // 1. Validate concepts (from QueryNormalizerService)
    const validConcepts = concepts.filter(c => c && typeof c === 'string');
    const primaryConcept = validConcepts[0]; // Most specific
    
    // 2. Search primary_topic (highest priority)
    const topicNodes = await supabaseClient
        .from('content_nodes')
        .select('*')
        .eq('course_id', courseId)
        .ilike('primary_topic', `%${primaryConcept}%`);
    
    // 3. Search aliases array
    const aliasesNodes = await supabaseClient
        .from('content_nodes')
        .select('*')
        .eq('course_id', courseId)
        .filter('aliases', 'cs', `{${primaryConcept}}`);
    
    // 4. Search keywords array
    const keywordNodes = await supabaseClient
        .from('content_nodes')
        .select('*')
        .eq('course_id', courseId)
        .filter('keywords', 'cs', `{${primaryConcept}}`);
    
    // 5. Combine and sort by relevance
    // Priority: primary_topic (1.0) > aliases (0.95) > keywords (0.8) > content (0.6)
}
```

## Benefits

1. ✅ **Zero Hardcoding**: No course-specific vocabulary in code
2. ✅ **Fully Reusable**: Works for any course domain
3. ✅ **Metadata-Driven**: Courses define their own vocabulary
4. ✅ **Maintainable**: Update vocabulary via content ingestion, not code
5. ✅ **Scalable**: Add new courses without code changes
6. ✅ **Flexible**: Courses can define aliases for any terminology

## Migration Guide

### For Existing Courses

1. **Run migration** to add `aliases` field:
   ```bash
   psql -f backend/migration-add-aliases-field.sql
   ```

2. **Update content ingestion** to populate metadata:
   ```javascript
   {
     primary_topic: "Technical SEO",
     aliases: ["technical seo", "tech SEO", "on-page optimization"],
     keywords: ["crawl budget", "indexing", "robots.txt"]
   }
   ```

3. **Re-ingest content** with metadata populated

### For New Courses

1. **Populate metadata** during content ingestion:
   - Extract `primary_topic` from content
   - Define `aliases` for common variations
   - Add `keywords` for related terms

2. **No code changes required!**

## Testing

### Test Case 1: SEO Course
```javascript
const concepts = ["answer engine optimization"];
const nodes = await nodeRetrievalService.keywordSearch(concepts, "seo-master-2026");
// Should find nodes with primary_topic or aliases matching "answer engine optimization"
```

### Test Case 2: ML Course (Same Code!)
```javascript
const concepts = ["neural networks"];
const nodes = await nodeRetrievalService.keywordSearch(concepts, "ml-fundamentals-2026");
// Should find nodes with primary_topic or aliases matching "neural networks"
```

### Test Case 3: Data Science Course (Same Code!)
```javascript
const concepts = ["p-values"];
const nodes = await nodeRetrievalService.keywordSearch(concepts, "data-science-2026");
// Should find nodes with aliases containing "p-values"
```

## Performance

- **Indexes**: GIN indexes on `aliases` and `keywords` arrays for fast searches
- **Priority Sorting**: Results sorted by match type (metadata > content)
- **Deduplication**: Nodes matched via multiple fields are deduplicated
- **Limit Optimization**: Separate limits per match type to balance relevance vs. coverage

## Future Enhancements

1. **Fuzzy Matching**: Add fuzzy matching for aliases (e.g., "SEO" matches "seo")
2. **Synonym Expansion**: Use LLM to suggest aliases during ingestion
3. **Multi-language Support**: Support aliases in multiple languages
4. **Weighted Aliases**: Prioritize certain aliases over others

