# Course-Agnostic Retrieval: Examples

## Overview

This document demonstrates how the refactored retrieval system works across different course domains **without any code changes**.

## Architecture Principle

**Retrieval matches against course-defined metadata ONLY:**
- `primary_topic` (TEXT)
- `aliases` (TEXT[])
- `keywords` (TEXT[])

**No hardcoded vocabulary in code.**

---

## Example 1: SEO Course

### Content Node

```json
{
  "canonical_reference": "D20.C1.S1",
  "course_id": "seo-master-2026",
  "primary_topic": "Answer Engine Optimization",
  "aliases": ["aeo", "answer engine optimization", "answer optimization"],
  "keywords": ["featured snippets", "zero-click searches", "voice search"],
  "content": "Answer Engine Optimization (AEO) focuses on optimizing content for featured snippets and zero-click searches...",
  "container_title": "Day 20, Chapter 1 - Answer Engine Optimization"
}
```

### User Query: "what is aeo?"

#### Step 1: QueryNormalizerService
```json
{
  "normalized_question": "What is answer engine optimization?",
  "key_concepts": ["answer engine optimization", "aeo"],
  "intent_type": "definition"
}
```

#### Step 2: NodeRetrievalService.keywordSearch()

**Search 1: primary_topic**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'seo-master-2026'
  AND is_valid = true
  AND primary_topic ILIKE '%answer engine optimization%'
```
✅ **Match!** Relevance: 1.0

**Search 2: aliases**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'seo-master-2026'
  AND is_valid = true
  AND aliases @> ARRAY['aeo']::TEXT[]
```
✅ **Match!** Relevance: 0.95

**Result:** Node D20.C1.S1 found with highest relevance (1.0)

---

## Example 2: Machine Learning Course

### Content Node

```json
{
  "canonical_reference": "D5.C2.S3",
  "course_id": "ml-fundamentals-2026",
  "primary_topic": "Neural Networks",
  "aliases": ["nn", "neural networks", "artificial neural networks", "anns"],
  "keywords": ["backpropagation", "gradient descent", "activation function"],
  "content": "Neural networks are computing systems inspired by biological neural networks...",
  "container_title": "Day 5, Chapter 2 - Deep Learning Fundamentals"
}
```

### User Query: "explain neural networks"

#### Step 1: QueryNormalizerService
```json
{
  "normalized_question": "Explain neural networks.",
  "key_concepts": ["neural networks"],
  "intent_type": "explanation"
}
```

#### Step 2: NodeRetrievalService.keywordSearch()

**Search 1: primary_topic**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'ml-fundamentals-2026'
  AND is_valid = true
  AND primary_topic ILIKE '%neural networks%'
```
✅ **Match!** Relevance: 1.0

**Search 2: aliases**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'ml-fundamentals-2026'
  AND is_valid = true
  AND aliases @> ARRAY['neural networks']::TEXT[]
```
✅ **Match!** Relevance: 0.95

**Result:** Node D5.C2.S3 found with highest relevance (1.0)

**✅ Same retrieval code, different course!**

---

## Example 3: Data Science Course

### Content Node

```json
{
  "canonical_reference": "D10.C1.S5",
  "course_id": "data-science-2026",
  "primary_topic": "Statistical Hypothesis Testing",
  "aliases": ["hypothesis testing", "statistical tests", "t-tests", "p-values"],
  "keywords": ["null hypothesis", "alternative hypothesis", "significance level", "type i error"],
  "content": "Hypothesis testing is a statistical method for making decisions using experimental data...",
  "container_title": "Day 10, Chapter 1 - Inferential Statistics"
}
```

### User Query: "what are p-values?"

#### Step 1: QueryNormalizerService
```json
{
  "normalized_question": "What are p-values?",
  "key_concepts": ["p-values"],
  "intent_type": "definition"
}
```

#### Step 2: NodeRetrievalService.keywordSearch()

**Search 1: primary_topic**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'data-science-2026'
  AND is_valid = true
  AND primary_topic ILIKE '%p-values%'
```
❌ **No match**

**Search 2: aliases**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'data-science-2026'
  AND is_valid = true
  AND aliases @> ARRAY['p-values']::TEXT[]
```
✅ **Match!** Relevance: 0.95

**Result:** Node D10.C1.S5 found via aliases match

---

## Example 4: Web Development Course

### Content Node

```json
{
  "canonical_reference": "D3.C2.S1",
  "course_id": "web-dev-2026",
  "primary_topic": "React Hooks",
  "aliases": ["hooks", "react hooks", "functional components"],
  "keywords": ["useState", "useEffect", "custom hooks", "component lifecycle"],
  "content": "React Hooks allow you to use state and other React features in functional components...",
  "container_title": "Day 3, Chapter 2 - Modern React Patterns"
}
```

### User Query: "how do hooks work?"

#### Step 1: QueryNormalizerService
```json
{
  "normalized_question": "How do hooks work?",
  "key_concepts": ["hooks"],
  "intent_type": "explanation"
}
```

#### Step 2: NodeRetrievalService.keywordSearch()

**Search 1: primary_topic**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'web-dev-2026'
  AND is_valid = true
  AND primary_topic ILIKE '%hooks%'
```
✅ **Match!** Relevance: 1.0

**Search 2: aliases**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'web-dev-2026'
  AND is_valid = true
  AND aliases @> ARRAY['hooks']::TEXT[]
```
✅ **Match!** Relevance: 0.95

**Result:** Node D3.C2.S1 found with highest relevance

---

## Example 5: Finance Course

### Content Node

```json
{
  "canonical_reference": "D7.C3.S2",
  "course_id": "finance-101-2026",
  "primary_topic": "Compound Interest",
  "aliases": ["compound interest", "compounding", "interest on interest"],
  "keywords": ["principal", "rate", "time", "future value", "present value"],
  "content": "Compound interest is interest calculated on the initial principal and accumulated interest...",
  "container_title": "Day 7, Chapter 3 - Time Value of Money"
}
```

### User Query: "explain compounding"

#### Step 1: QueryNormalizerService
```json
{
  "normalized_question": "Explain compounding.",
  "key_concepts": ["compounding"],
  "intent_type": "explanation"
}
```

#### Step 2: NodeRetrievalService.keywordSearch()

**Search 1: primary_topic**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'finance-101-2026'
  AND is_valid = true
  AND primary_topic ILIKE '%compounding%'
```
❌ **No match** (primary_topic is "Compound Interest", not "compounding")

**Search 2: aliases**
```sql
SELECT * FROM content_nodes
WHERE course_id = 'finance-101-2026'
  AND is_valid = true
  AND aliases @> ARRAY['compounding']::TEXT[]
```
✅ **Match!** Relevance: 0.95

**Result:** Node D7.C3.S2 found via aliases match

---

## Key Takeaways

1. **Zero Code Changes**: Same retrieval code works for all courses
2. **Metadata-Driven**: Courses define their own vocabulary via `primary_topic`, `aliases`, `keywords`
3. **Flexible Matching**: Aliases allow variations (acronyms, synonyms, alternative terms)
4. **Priority-Based**: Results sorted by match type (primary_topic > aliases > keywords > content)
5. **Course-Agnostic**: No hardcoded domain-specific terms in code

## Migration Checklist

For each course:

1. ✅ Run migration: `backend/migration-add-aliases-field.sql`
2. ✅ Populate metadata during content ingestion:
   - Extract `primary_topic` from content
   - Define `aliases` for common variations/acronyms
   - Add `keywords` for related terms
3. ✅ Re-ingest content with metadata
4. ✅ Test retrieval with sample queries

**No code changes required!**

