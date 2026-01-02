# AI Coach Feature - Technical Design Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Design  
**Author:** System Design Team

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [Database Design](#database-design)
4. [Service Layer Design](#service-layer-design)
5. [Component Architecture](#component-architecture)
6. [Data Flow](#data-flow)
7. [API Design](#api-design)
8. [LLM Integration](#llm-integration)
9. [Vector Search Design](#vector-search-design)
10. [Performance Considerations](#performance-considerations)
11. [Security Design](#security-design)
12. [Caching Strategy](#caching-strategy)
13. [Error Handling](#error-handling)
14. [Implementation Details](#implementation-details)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Learner    │  │   Trainer    │  │    Admin     │      │
│  │   AI Coach   │  │  Escalation  │  │   Analytics  │      │
│  │    Widget    │  │     View     │  │   Dashboard   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                   │
│              ┌────────────▼────────────┐                     │
│              │   AI Coach Components  │                     │
│              │  (Shared UI Components) │                     │
│              └────────────┬────────────┘                     │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   AI Coach   │  │   Query      │  │  Escalation  │      │
│  │   Service    │  │  Processor   │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │                │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐         │
│  │   Context   │  │ Retrieval   │  │  Feedback   │         │
│  │   Builder   │  │   Service   │  │   Service   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                   │
│              ┌────────────▼────────────┐                     │
│              │   LLM Integration      │                     │
│              │   (OpenAI/Anthropic)   │                     │
│              └────────────┬────────────┘                     │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Supabase   │  │   Vector     │  │   Cache      │      │
│  │   Database   │  │   Database   │  │   Layer      │      │
│  │              │  │  (pgvector)  │  │  (Redis/     │      │
│  │              │  │              │  │   Memory)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Context-Aware**: Responses based on learner's current progress and course content
2. **Cost-Optimized**: Aggressive token usage optimization and caching
3. **Hallucination-Free**: Strict adherence to provided context, explicit uncertainty
4. **Trainer-Integrated**: Seamless escalation workflow
5. **Scalable**: Designed to handle 100+ concurrent queries
6. **Observable**: Comprehensive logging and analytics

---

## System Components

### 1. Frontend Components

#### 1.1 AI Coach Components Structure

```
lms/components/ai-coach/
├── learner/
│   ├── ai-coach-widget.js          # Main widget component
│   ├── query-input.js               # Query input field
│   ├── response-display.js          # Answer display
│   ├── references-list.js           # Course references
│   ├── feedback-form.js             # User feedback
│   └── conversation-history.js     # History view
├── trainer/
│   ├── escalation-list.js           # List of escalations
│   ├── escalation-detail.js          # Escalation detail view
│   ├── escalation-response.js       # Response form
│   └── escalation-analytics.js     # Escalation metrics
├── admin/
│   ├── ai-coach-analytics.js        # Usage analytics
│   ├── cost-dashboard.js            # Cost tracking
│   ├── query-analytics.js           # Query patterns
│   └── configuration.js             # System configuration
└── shared/
    ├── confidence-indicator.js      # Confidence visualization
    ├── reference-link.js            # Course reference link
    └── loading-state.js             # Loading indicators
```

### 2. Backend Services

#### 2.1 Service Layer Structure

```
lms/services/
├── ai-coach-service.js              # Main orchestration service
├── query-processor-service.js        # Query validation & intent
├── context-builder-service.js        # Dynamic context construction
├── retrieval-service.js              # Vector search & chunk retrieval
├── llm-service.js                    # LLM integration (OpenAI)
├── embedding-service.js              # Embedding generation
├── escalation-service.js             # Trainer escalation workflow
├── feedback-service.js               # User feedback handling
└── ai-coach-analytics-service.js    # Analytics & metrics
```

---

## Database Design

### 1. Core Tables

#### 1.1 `ai_coach_queries`

Stores all learner queries.

```sql
CREATE TABLE ai_coach_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    intent VARCHAR(50) NOT NULL, -- 'course_content', 'navigation', 'lab_guidance', 'out_of_scope'
    context JSONB, -- Current chapter, day, progress snapshot
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'answered', 'escalated', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_queries_learner ON ai_coach_queries(learner_id);
CREATE INDEX idx_ai_coach_queries_course ON ai_coach_queries(course_id);
CREATE INDEX idx_ai_coach_queries_status ON ai_coach_queries(status);
CREATE INDEX idx_ai_coach_queries_created ON ai_coach_queries(created_at DESC);
```

#### 1.2 `ai_coach_responses`

Stores AI-generated responses.

```sql
CREATE TABLE ai_coach_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES ai_coach_queries(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    references JSONB, -- Array of {day, chapter, chapter_title, lab_id}
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    next_steps TEXT[], -- Array of suggested next steps
    tokens_used INTEGER NOT NULL,
    model_used VARCHAR(50) NOT NULL, -- 'gpt-4-turbo', 'gpt-4o-mini', etc.
    response_time_ms INTEGER, -- Response time in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_responses_query ON ai_coach_responses(query_id);
CREATE INDEX idx_ai_coach_responses_confidence ON ai_coach_responses(confidence_score);
```

#### 1.3 `ai_coach_escalations`

Stores escalated queries to trainers.

```sql
CREATE TABLE ai_coach_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES ai_coach_queries(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_question TEXT NOT NULL,
    ai_context JSONB, -- Chunk IDs and context used by AI
    ai_confidence DECIMAL(3,2) NOT NULL,
    learner_progress JSONB, -- Progress snapshot at time of escalation
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'responded', 'resolved', 'archived'
    trainer_response TEXT,
    trainer_responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ai_coach_escalations_trainer ON ai_coach_escalations(trainer_id, status);
CREATE INDEX idx_ai_coach_escalations_learner ON ai_coach_escalations(learner_id);
CREATE INDEX idx_ai_coach_escalations_status ON ai_coach_escalations(status);
```

#### 1.4 `ai_coach_feedback`

Stores user feedback on responses.

```sql
CREATE TABLE ai_coach_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES ai_coach_responses(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating VARCHAR(20) NOT NULL, -- 'helpful', 'not_helpful'
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_feedback_response ON ai_coach_feedback(response_id);
CREATE INDEX idx_ai_coach_feedback_learner ON ai_coach_feedback(learner_id);
CREATE INDEX idx_ai_coach_feedback_rating ON ai_coach_feedback(rating);
```

#### 1.5 `ai_coach_content_chunks`

Stores indexed course content for retrieval. **Course-specific isolation**: Each course has its own chunks.

```sql
CREATE TABLE ai_coach_content_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    day INTEGER,
    chapter_id VARCHAR(100) NOT NULL,
    chapter_title VARCHAR(255),
    lab_id VARCHAR(100),
    content TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL, -- 'chapter', 'lab', 'overview'
    token_count INTEGER NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimensions
    content_hash VARCHAR(64), -- SHA-256 hash for change detection
    content_version INTEGER DEFAULT 1, -- Version number for tracking updates
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Last indexing time
    metadata JSONB, -- Additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_chunks_course ON ai_coach_content_chunks(course_id);
CREATE INDEX idx_ai_coach_chunks_chapter ON ai_coach_content_chunks(course_id, chapter_id);
CREATE INDEX idx_ai_coach_chunks_type ON ai_coach_content_chunks(content_type);
CREATE INDEX idx_ai_coach_chunks_hash ON ai_coach_content_chunks(course_id, content_hash); -- For change detection

-- Vector similarity search index (pgvector) - course-scoped
CREATE INDEX idx_ai_coach_chunks_embedding ON ai_coach_content_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### 1.7 `ai_coach_trainer_personalization`

Stores trainer personalization settings for AI Coach.

```sql
CREATE TABLE ai_coach_trainer_personalization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE, -- NULL = global, or specific course
    coach_name VARCHAR(100) NOT NULL, -- e.g., "John's AI Coach"
    linkedin_profile_url TEXT,
    trainer_info JSONB, -- Extracted trainer information
    personalization_enabled BOOLEAN DEFAULT true,
    share_level VARCHAR(20) DEFAULT 'name_only', -- 'name_only', 'name_expertise', 'full'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trainer_id, course_id) -- One personalization per trainer per course
);

CREATE INDEX idx_ai_coach_personalization_trainer ON ai_coach_trainer_personalization(trainer_id);
CREATE INDEX idx_ai_coach_personalization_course ON ai_coach_trainer_personalization(course_id);
```

#### 1.8 `ai_coach_content_updates`

Tracks content updates for automatic re-indexing.

```sql
CREATE TABLE ai_coach_content_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    update_type VARCHAR(20) NOT NULL, -- 'full', 'incremental', 'manual'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    chunks_updated INTEGER DEFAULT 0,
    chunks_total INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    triggered_by VARCHAR(50), -- 'automatic', 'manual', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_updates_course ON ai_coach_content_updates(course_id, status);
CREATE INDEX idx_ai_coach_updates_status ON ai_coach_content_updates(status);
```

#### 1.6 `ai_coach_conversation_history`

Stores conversation history for context.

```sql
CREATE TABLE ai_coach_conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    query_id UUID REFERENCES ai_coach_queries(id) ON DELETE SET NULL,
    response_id UUID REFERENCES ai_coach_responses(id) ON DELETE SET NULL,
    escalation_id UUID REFERENCES ai_coach_escalations(id) ON DELETE SET NULL,
    sequence_number INTEGER NOT NULL, -- Order in conversation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_history_learner ON ai_coach_conversation_history(learner_id, course_id, created_at DESC);
CREATE INDEX idx_ai_coach_history_query ON ai_coach_conversation_history(query_id);
```

### 2. RLS Policies

```sql
-- Learners can only see their own queries
CREATE POLICY "Learners can view own queries"
ON ai_coach_queries FOR SELECT
USING (auth.uid() = learner_id);

-- Learners can only create queries for their allocated courses
CREATE POLICY "Learners can create queries for allocated courses"
ON ai_coach_queries FOR INSERT
WITH CHECK (
    auth.uid() = learner_id AND
    EXISTS (
        SELECT 1 FROM course_allocations
        WHERE user_id = auth.uid() AND course_id = ai_coach_queries.course_id
    )
);

-- Trainers can view escalations for assigned learners
CREATE POLICY "Trainers can view assigned escalations"
ON ai_coach_escalations FOR SELECT
USING (
    trainer_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Trainers can respond to escalations
CREATE POLICY "Trainers can respond to escalations"
ON ai_coach_escalations FOR UPDATE
USING (trainer_id = auth.uid());
```

---

## Service Layer Design

### 1. AI Coach Service

**File**: `lms/services/ai-coach-service.js`

**Responsibilities**:
- Main orchestration of query processing
- Coordinate between query processor, context builder, retrieval, and LLM
- Handle confidence scoring and escalation decisions
- Manage conversation history

**Key Methods**:
```javascript
class AICoachService {
    async processQuery(learnerId, courseId, question, context)
    async getResponse(queryId)
    async escalateQuery(queryId, reason)
    async getConversationHistory(learnerId, courseId, limit)
    async submitFeedback(responseId, learnerId, rating, feedbackText)
}
```

### 2. Query Processor Service

**File**: `lms/services/query-processor-service.js`

**Responsibilities**:
- Validate queries (scope, access, answerability)
- Classify intent (course_content, navigation, lab_guidance, lab_struggle, out_of_scope)
- Preprocess queries (normalize, detect typos)
- Route queries based on intent
- **Detect lab struggles**: Analyze lab submission history and query patterns

**Key Methods**:
```javascript
class QueryProcessorService {
    async validateQuery(learnerId, courseId, question)
    async classifyIntent(question, context)
    async preprocessQuery(question)
    async isCourseRelated(question, courseId)
    async detectLabStruggle(learnerId, courseId) // New: Detect if struggling
    async isLabQuestion(question) // Detect if question is about labs
    async shouldProvideLabGuidance(learnerId, courseId, question) // Determine guidance level
}
```

### 3. Context Builder Service

**File**: `lms/services/context-builder-service.js`

**Responsibilities**:
- Build dynamic context based on learner progress
- Prioritize content chunks
- Filter by access and progress
- Construct context within token limits

**Key Methods**:
```javascript
class ContextBuilderService {
    async buildContext(learnerId, courseId, question, intent)
    async getCurrentContext(learnerId, courseId)
    async getProgressContext(learnerId, courseId)
    async prioritizeChunks(chunks, question, progress)
}
```

### 4. Retrieval Service

**File**: `lms/services/retrieval-service.js`

**Responsibilities**:
- Perform vector similarity search
- Retrieve relevant content chunks
- Filter by course, progress, and access
- Combine semantic and keyword search

**Key Methods**:
```javascript
class RetrievalService {
    async searchSimilarChunks(queryEmbedding, courseId, filters, limit)
    async getChunksByIds(chunkIds)
    async getChunksByChapter(courseId, chapterId)
    async updateChunkEmbeddings(courseId)
}
```

### 5. LLM Service

**File**: `lms/services/llm-service.js`

**Responsibilities**:
- Integrate with OpenAI API (or alternatives)
- Generate answers from context
- Calculate confidence scores
- Handle API errors and retries

**Key Methods**:
```javascript
class LLMService {
    async generateAnswer(question, context, systemPrompt)
    async estimateConfidence(question, context, answer)
    async classifyIntent(question) // Using cheap model
    async generateEmbedding(text)
}
```

### 6. Embedding Service

**File**: `lms/services/embedding-service.js`

**Responsibilities**:
- Generate embeddings for course content
- Batch process content chunks
- Cache embeddings
- Update embeddings on content changes

**Key Methods**:
```javascript
class EmbeddingService {
    async generateEmbedding(text)
    async generateEmbeddingsBatch(texts)
    async indexCourseContent(courseId)
    async updateCourseEmbeddings(courseId)
}
```

### 7. Escalation Service

**File**: `lms/services/escalation-service.js`

**Responsibilities**:
- Create escalation records
- Notify trainers
- Track escalation status
- Provide escalation analytics

**Key Methods**:
```javascript
class EscalationService {
    async createEscalation(queryId, reason, context)
    async notifyTrainer(escalationId)
    async respondToEscalation(escalationId, trainerId, response)
    async getEscalations(trainerId, filters)
}
```

---

## Component Architecture

### 1. Frontend Component Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ Query Input     │ → Validate → Submit
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Coach Widget │ → Show Loading
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response Display│ → Show Answer + References
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Feedback Form   │ → Collect Rating
└─────────────────┘
```

### 2. Backend Service Flow

```
Query Received
    │
    ▼
┌─────────────────┐
│ Query Processor │ → Validate & Classify Intent
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Builder │ → Build Dynamic Context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Retrieval       │ → Vector Search → Get Chunks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LLM Service     │ → Generate Answer
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Confidence      │ → Calculate Score
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────┐
│ Answer │ │ Escalation   │
│ (High) │ │ (Low Conf)   │
└────────┘ └──────────────┘
```

---

## Data Flow

### 1. Query Processing Flow

```
1. Learner submits query
   ↓
2. Query validated (scope, access, answerability)
   ↓
3. Intent classified (course_content, navigation, etc.)
   ↓
4. If out-of-scope → Reject with message
   ↓
5. Build context (progress, current chapter, etc.)
   ↓
6. Generate query embedding
   ↓
7. Vector search for similar chunks
   ↓
8. Filter chunks by access and progress
   ↓
9. Select top 3-5 chunks
   ↓
10. Construct prompt with context
   ↓
11. Call LLM API
   ↓
12. Calculate confidence score
   ↓
13. If confidence < threshold → Escalate
   ↓
14. If confidence >= threshold → Return answer
   ↓
15. Store query, response, and history
```

### 2. Escalation Flow

```
1. Low confidence detected
   ↓
2. Create escalation record
   ↓
3. Notify trainer (in-app + optional email)
   ↓
4. Trainer views escalation
   ↓
5. Trainer responds
   ↓
6. Learner receives trainer response
   ↓
7. Mark escalation as resolved
   ↓
8. Optionally use response as future reference
```

---

## API Design

### 1. Query Submission

**Endpoint**: `POST /api/ai-coach/query`

**Request**:
```json
{
  "question": "What is the difference between on-page and off-page SEO?",
  "course_id": "seo-master-2026",
  "context": {
    "current_chapter": "day1-ch2",
    "current_day": 1
  }
}
```

**Response**:
```json
{
  "query_id": "uuid",
  "answer": "On-page SEO refers to...",
  "references": [
    {
      "day": 1,
      "chapter": "day1-ch2",
      "chapter_title": "On-Page SEO Fundamentals",
      "lab_id": null
    }
  ],
  "confidence": 0.85,
  "next_steps": [
    "Review Chapter 3 for off-page SEO details"
  ],
  "escalated": false,
  "response_time_ms": 2341
}
```

### 2. Escalation Retrieval

**Endpoint**: `GET /api/ai-coach/escalations`

**Query Parameters**:
- `trainer_id`: UUID (required)
- `status`: Enum (pending, responded, resolved)
- `course_id`: UUID (optional)
- `limit`: Number (default: 20)
- `offset`: Number (default: 0)

**Response**:
```json
{
  "escalations": [
    {
      "id": "uuid",
      "learner_name": "John Doe",
      "course_name": "SEO Master Course 2026",
      "question": "How do I optimize for featured snippets?",
      "ai_confidence": 0.45,
      "status": "pending",
      "created_at": "2025-01-29T10:00:00Z"
    }
  ],
  "total": 15,
  "pending_count": 8
}
```

### 3. Trainer Response

**Endpoint**: `POST /api/ai-coach/escalations/:id/respond`

**Request**:
```json
{
  "response": "Featured snippets are optimized by...",
  "use_as_reference": true
}
```

**Response**:
```json
{
  "success": true,
  "escalation_id": "uuid",
  "response_id": "uuid"
}
```

---

## LLM Integration

### 1. Model Selection Strategy

**Intent Classification**: GPT-3.5-turbo
- Cost: ~$0.001 per query
- Purpose: Quick intent classification
- Temperature: 0.1

**Answer Generation**: GPT-4o-mini (primary) or GPT-4-turbo (fallback)
- Cost: ~$0.01-0.03 per query
- Purpose: High-quality answers
- Temperature: 0.3

**Embeddings**: text-embedding-3-small
- Cost: ~$0.00002 per 1K tokens
- Dimensions: 1536

### 2. Prompt Engineering

**System Prompt Template**:
```
You are an AI Coach for Digital Vidya's LMS. Your role is to help learners understand course content.

Rules:
1. Answer ONLY using the provided course content
2. Reference specific course locations (Day X → Chapter Y)
3. If uncertain, explicitly state uncertainty
4. Maintain a supportive, instructional tone
5. Never provide lab answers directly
6. Suggest next steps when relevant

Course Context:
{course_name}
{learner_progress}

Available Content:
{context_chunks}
```

**User Prompt Template**:
```
Question: {question}

Context from course:
{formatted_chunks}

Answer the question using only the provided context. Include references to specific course locations.
```

### 3. Response Format

**Structured Response**:
```json
{
  "answer": "string",
  "references": [
    {
      "day": 1,
      "chapter": "day1-ch2",
      "chapter_title": "On-Page SEO",
      "lab_id": null
    }
  ],
  "confidence": 0.85,
  "next_steps": ["string"],
  "uncertainty_reason": null
}
```

---

## Vector Search Design

### 1. Embedding Generation

**Process**:
1. Extract course content (markdown files)
2. Chunk content by semantic boundaries (chapters, sections)
3. Generate embeddings for each chunk
4. Store in `ai_coach_content_chunks` table
5. Create vector index (HNSW)

**Chunking Strategy**:
- **Size**: 200-500 tokens per chunk
- **Overlap**: 50 tokens between chunks
- **Boundaries**: Chapter boundaries, section headers
- **Metadata**: Day, chapter, lab, content type

### 2. Search Algorithm

**Hybrid Search**:
1. **Semantic Search**: Vector similarity (cosine)
2. **Keyword Search**: BM25 or full-text search
3. **Combine**: Weighted combination of both
4. **Filter**: By course, progress, access
5. **Rank**: By relevance score

**Query Processing**:
```javascript
async searchSimilarChunks(query, courseId, filters) {
    // 1. Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    
    // 2. Vector similarity search
    const vectorResults = await vectorSearch(queryEmbedding, courseId);
    
    // 3. Keyword search
    const keywordResults = await keywordSearch(query, courseId);
    
    // 4. Combine and rank
    const combined = combineResults(vectorResults, keywordResults);
    
    // 5. Filter by access and progress
    const filtered = filterByAccess(combined, filters);
    
    // 6. Return top N
    return filtered.slice(0, 5);
}
```

---

## Performance Considerations

### 1. Response Time Targets

- **P50**: < 2 seconds
- **P95**: < 3 seconds
- **P99**: < 5 seconds
- **Timeout**: 10 seconds max

### 2. Optimization Strategies

**Caching**:
- Query cache (identical queries)
- Embedding cache (permanent)
- Context cache (5 minutes)
- Chunk cache (frequently accessed)

**Async Processing**:
- Embedding generation (background)
- Analytics updates (async)
- Notification sending (queue)

**Database Optimization**:
- Indexes on all query paths
- Vector index (HNSW)
- Connection pooling
- Query optimization

### 3. Scalability

**Horizontal Scaling**:
- Stateless services
- Load balancing
- Database read replicas
- Caching layer (Redis)

**Concurrent Queries**:
- Support 100 concurrent queries
- Rate limiting per learner
- Queue management

---

## Security Design

### 1. Access Control

**RBAC Enforcement**:
- Learners: Only their queries and allocated courses
- Trainers: Only assigned learners' escalations
- Admins: Analytics only (no individual conversations)

**Query Validation**:
- Verify course allocation
- Check content access
- Validate user identity

### 2. Data Privacy

**PII Minimization**:
- Use learner IDs, not names in API calls
- Anonymize in analytics
- Secure storage of conversations

**Data Retention**:
- Conversations: 90 days
- Escalations: 180 days
- Analytics: Aggregated, anonymized

### 3. API Security

**Authentication**:
- JWT tokens required
- Role verification
- Token expiration

**Rate Limiting**:
- Per learner: 50 queries/hour
- Per course: 200 queries/hour
- Global: 1000 queries/hour

**Input Sanitization**:
- Sanitize all inputs
- Prevent injection attacks
- Validate data types

---

## Caching Strategy

### 1. Cache Layers

**L1: In-Memory Cache (Service Level)**
- Query responses (identical queries)
- Contexts (5 min TTL)
- Hit rate target: > 30%

**L2: Database Cache (Optional Redis)**
- Embeddings (permanent)
- Frequently accessed chunks
- Query patterns

**L3: Browser Cache**
- Static assets
- UI components

### 2. Cache Invalidation

**Triggers**:
- Course content updates
- Cache TTL expiration
- Manual invalidation (admin)

**Strategy**:
- Lazy invalidation (on access)
- Background refresh
- Version-based keys

---

## Error Handling

### 1. Error Types

**Validation Errors**:
- Invalid query format
- Out-of-scope questions
- Access denied

**LLM API Errors**:
- Rate limiting
- Timeout
- Invalid response

**Database Errors**:
- Connection failures
- Query timeouts
- Constraint violations

### 2. Error Responses

**User-Facing**:
- Clear error messages
- Retry suggestions
- Escalation option

**System**:
- Logging with context
- Alerting for critical errors
- Graceful degradation

---

## Implementation Details

### 1. Technology Stack

**Frontend**:
- JavaScript (ES6+)
- Existing LMS components
- CSS (existing design system)

**Backend**:
- Node.js/JavaScript
- Supabase (database + pgvector)
- OpenAI API

**Infrastructure**:
- Existing LMS infrastructure
- Optional: Redis for caching

### 2. Dependencies

**External**:
- OpenAI SDK
- Supabase client
- Vector database (pgvector)

**Internal**:
- Course service
- User service
- Progress service
- Notification service
- Auth service

### 3. File Structure

```
lms/
├── components/
│   └── ai-coach/
│       ├── learner/
│       ├── trainer/
│       ├── admin/
│       └── shared/
├── services/
│   ├── ai-coach-service.js
│   ├── query-processor-service.js
│   ├── context-builder-service.js
│   ├── retrieval-service.js
│   ├── llm-service.js
│   ├── embedding-service.js
│   ├── escalation-service.js
│   └── ai-coach-analytics-service.js
├── styles/
│   └── ai-coach.css
└── utils/
    └── ai-coach-helpers.js

backend/
└── migrations/
    └── migration-ai-coach-tables.sql
```

---

## Next Steps

1. Review and approve design
2. Create database migration script
3. Implement service layer
4. Build frontend components
5. Integration testing
6. Performance optimization
7. Security audit
8. Deployment

---

**Document Status**: ✅ Ready for Implementation Review

