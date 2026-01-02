# AI Coach Database Schema Reference

**Version:** 1.0  
**Date:** 2025-01-29

---

## Overview

This document provides a quick reference for the AI Coach database schema, including tables, relationships, and key indexes.

---

## Tables

### 1. `ai_coach_queries`
Stores learner queries to AI Coach.

**Key Columns:**
- `id` (UUID, PK)
- `learner_id` (UUID, FK → users)
- `course_id` (UUID, FK → courses)
- `question` (TEXT)
- `intent` (VARCHAR) - 'course_content', 'navigation', 'lab_guidance', 'lab_struggle', 'out_of_scope'
- `context` (JSONB) - Current chapter, day, progress
- `status` (VARCHAR) - 'pending', 'answered', 'escalated', 'resolved'

**Indexes:**
- `idx_ai_coach_queries_learner` (learner_id, course_id, created_at)
- `idx_ai_coach_queries_course` (course_id, created_at)
- `idx_ai_coach_queries_status` (status)
- `idx_ai_coach_queries_intent` (intent)

---

### 2. `ai_coach_responses`
Stores AI Coach responses to queries.

**Key Columns:**
- `id` (UUID, PK)
- `query_id` (UUID, FK → ai_coach_queries)
- `answer` (TEXT)
- `reference_locations` (JSONB) - Array of course locations
- `confidence_score` (DECIMAL 0-1)
- `tokens_used` (INTEGER)
- `model_used` (VARCHAR)
- `word_count` (INTEGER) - For conciseness tracking
- `is_lab_guidance` (BOOLEAN) - True if lab guidance

**Indexes:**
- `idx_ai_coach_responses_query` (query_id)
- `idx_ai_coach_responses_confidence` (confidence_score)
- `idx_ai_coach_responses_lab_guidance` (is_lab_guidance)

---

### 3. `ai_coach_escalations`
Stores escalations to trainers.

**Key Columns:**
- `id` (UUID, PK)
- `query_id` (UUID, FK → ai_coach_queries)
- `learner_id` (UUID, FK → users)
- `trainer_id` (UUID, FK → users)
- `original_question` (TEXT)
- `ai_context` (JSONB) - Chunks used by AI
- `ai_confidence` (DECIMAL 0-1)
- `status` (VARCHAR) - 'pending', 'responded', 'resolved', 'archived'

**Indexes:**
- `idx_ai_coach_escalations_trainer` (trainer_id, status)
- `idx_ai_coach_escalations_learner` (learner_id)
- `idx_ai_coach_escalations_status` (status)

---

### 4. `ai_coach_feedback`
Stores user feedback on responses.

**Key Columns:**
- `id` (UUID, PK)
- `response_id` (UUID, FK → ai_coach_responses)
- `learner_id` (UUID, FK → users)
- `rating` (VARCHAR) - 'helpful', 'not_helpful'
- `feedback_text` (TEXT)
- `is_lab_guidance_feedback` (BOOLEAN)

**Indexes:**
- `idx_ai_coach_feedback_response` (response_id)
- `idx_ai_coach_feedback_learner` (learner_id)
- `idx_ai_coach_feedback_rating` (rating)

---

### 5. `ai_coach_content_chunks`
Stores indexed course content for retrieval (course-specific).

**Key Columns:**
- `id` (UUID, PK)
- `course_id` (UUID, FK → courses)
- `day` (INTEGER)
- `chapter_id` (VARCHAR)
- `chapter_title` (VARCHAR)
- `lab_id` (VARCHAR, nullable)
- `content` (TEXT)
- `content_type` (VARCHAR) - 'chapter', 'lab', 'overview'
- `token_count` (INTEGER)
- `embedding` (VECTOR(1536)) - OpenAI embeddings
- `content_hash` (VARCHAR) - SHA-256 for change detection
- `content_version` (INTEGER)
- `indexed_at` (TIMESTAMP)

**Indexes:**
- `idx_ai_coach_chunks_course` (course_id)
- `idx_ai_coach_chunks_chapter` (course_id, chapter_id)
- `idx_ai_coach_chunks_type` (content_type)
- `idx_ai_coach_chunks_hash` (course_id, content_hash)
- `idx_ai_coach_chunks_embedding` (embedding) - Vector index (created separately)

**Note:** The vector index must be created separately after data is inserted:
```sql
CREATE INDEX idx_ai_coach_chunks_embedding ON ai_coach_content_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

### 6. `ai_coach_conversation_history`
Stores conversation history for context.

**Key Columns:**
- `id` (UUID, PK)
- `learner_id` (UUID, FK → users)
- `course_id` (UUID, FK → courses)
- `query_id` (UUID, FK → ai_coach_queries, nullable)
- `response_id` (UUID, FK → ai_coach_responses, nullable)
- `escalation_id` (UUID, FK → ai_coach_escalations, nullable)
- `sequence_number` (INTEGER)

**Indexes:**
- `idx_ai_coach_history_learner` (learner_id, course_id, created_at)
- `idx_ai_coach_history_query` (query_id)
- `idx_ai_coach_history_course` (course_id, created_at)

---

### 7. `ai_coach_trainer_personalization`
Stores trainer personalization settings.

**Key Columns:**
- `id` (UUID, PK)
- `trainer_id` (UUID, FK → users)
- `course_id` (UUID, FK → courses, nullable) - NULL = global
- `coach_name` (VARCHAR) - e.g., "John's AI Coach"
- `linkedin_profile_url` (TEXT, nullable)
- `trainer_info` (JSONB) - Extracted trainer information
- `personalization_enabled` (BOOLEAN)
- `share_level` (VARCHAR) - 'name_only', 'name_expertise', 'full'

**Unique Constraint:**
- `(trainer_id, course_id)` - One personalization per trainer per course

**Indexes:**
- `idx_ai_coach_personalization_trainer` (trainer_id)
- `idx_ai_coach_personalization_course` (course_id)

---

### 8. `ai_coach_content_updates`
Tracks content updates for automatic re-indexing.

**Key Columns:**
- `id` (UUID, PK)
- `course_id` (UUID, FK → courses)
- `update_type` (VARCHAR) - 'full', 'incremental', 'manual'
- `status` (VARCHAR) - 'pending', 'processing', 'completed', 'failed'
- `chunks_updated` (INTEGER)
- `chunks_total` (INTEGER)
- `triggered_by` (VARCHAR) - 'automatic', 'manual', 'admin'

**Indexes:**
- `idx_ai_coach_updates_course` (course_id, status)
- `idx_ai_coach_updates_status` (status)
- `idx_ai_coach_updates_triggered` (triggered_by)

---

### 9. `ai_coach_lab_struggle_detection`
Tracks lab struggle detection for proactive guidance.

**Key Columns:**
- `id` (UUID, PK)
- `learner_id` (UUID, FK → users)
- `course_id` (UUID, FK → courses)
- `lab_id` (VARCHAR, nullable) - NULL = overall
- `struggle_score` (DECIMAL 0-1)
- `indicators` (JSONB) - {attempts, average_score, recent_failures, repeated_questions, time_spent}
- `detected_at` (TIMESTAMP)
- `acknowledged` (BOOLEAN)

**Unique Constraint:**
- `(learner_id, course_id, lab_id)` - One record per learner/course/lab

**Indexes:**
- `idx_ai_coach_struggle_learner` (learner_id, course_id)
- `idx_ai_coach_struggle_score` (struggle_score DESC)
- `idx_ai_coach_struggle_detected` (detected_at DESC)

---

## Relationships

```
users (learners)
  ├── ai_coach_queries (1:N)
  ├── ai_coach_escalations (1:N as learner)
  ├── ai_coach_feedback (1:N)
  ├── ai_coach_conversation_history (1:N)
  └── ai_coach_lab_struggle_detection (1:N)

users (trainers)
  ├── ai_coach_escalations (1:N as trainer)
  └── ai_coach_trainer_personalization (1:N)

courses
  ├── ai_coach_queries (1:N)
  ├── ai_coach_content_chunks (1:N)
  ├── ai_coach_conversation_history (1:N)
  ├── ai_coach_trainer_personalization (1:N)
  ├── ai_coach_content_updates (1:N)
  └── ai_coach_lab_struggle_detection (1:N)

ai_coach_queries
  ├── ai_coach_responses (1:1)
  ├── ai_coach_escalations (1:1)
  └── ai_coach_conversation_history (1:N)
```

---

## Row Level Security (RLS)

All tables have RLS enabled with policies for:
- **Learners**: Can only access their own data
- **Trainers**: Can access data for their assigned learners
- **Admins**: Can access all data

See migration file for detailed policies.

---

## Vector Search

The `ai_coach_content_chunks` table uses pgvector for semantic search.

**Embedding Model**: OpenAI text-embedding-3-small (1536 dimensions)

**Index Type**: IVFFlat (Inverted File Index)

**Create Index** (after data is inserted):
```sql
CREATE INDEX idx_ai_coach_chunks_embedding ON ai_coach_content_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Note**: The `lists` parameter should be adjusted based on data size:
- Small datasets (< 10K chunks): lists = 10-50
- Medium datasets (10K-100K chunks): lists = 50-100
- Large datasets (> 100K chunks): lists = 100-200

---

## Usage Examples

### Query with Vector Search
```sql
-- Find similar chunks for a query embedding
SELECT 
    id,
    chapter_title,
    content,
    1 - (embedding <=> $1::vector) AS similarity
FROM ai_coach_content_chunks
WHERE course_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

### Get Learner's Recent Queries
```sql
SELECT 
    q.*,
    r.answer,
    r.confidence_score
FROM ai_coach_queries q
LEFT JOIN ai_coach_responses r ON r.query_id = q.id
WHERE q.learner_id = $1
ORDER BY q.created_at DESC
LIMIT 20;
```

### Check Lab Struggle
```sql
SELECT *
FROM ai_coach_lab_struggle_detection
WHERE learner_id = $1
  AND course_id = $2
  AND struggle_score >= 0.5
ORDER BY detected_at DESC;
```

---

## Migration Notes

1. **Run migration**: Execute `backend/migration-ai-coach-tables.sql`
2. **Create vector index**: After inserting some content chunks, create the vector index
3. **Verify RLS**: Test that RLS policies are working correctly
4. **Test queries**: Verify all indexes are being used efficiently

---

**Document Status**: ✅ Complete

