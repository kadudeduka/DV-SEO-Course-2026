# 📘 DV LMS — AI Coach (DV Coach)

## Product Requirements Specification (v1.0)

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Draft  
**Author:** Product Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Objectives & Goals](#2-objectives--goals)
3. [Non-Goals](#3-non-goals)
4. [User Roles & Access](#4-user-roles--access)
5. [Functional Requirements](#5-functional-requirements)
6. [Technical Requirements](#6-technical-requirements)
7. [Data Models](#7-data-models)
8. [API Specifications](#8-api-specifications)
9. [UI/UX Requirements](#9-uiux-requirements)
10. [Security & Privacy](#10-security--privacy)
11. [Performance & Cost Optimization](#11-performance--cost-optimization)
12. [Observability & Analytics](#12-observability--analytics)
13. [Phased Implementation](#13-phased-implementation)
14. [Success Criteria](#14-success-criteria)
15. [Dependencies & Integration Points](#15-dependencies--integration-points)

---

## 1. Executive Summary

### 1.1 Overview

The AI Coach is an **LMS-native intelligent assistant** that provides course-specific guidance to learners within the Digital Vidya LMS platform. It acts as a **guided academic assistant** that helps learners understand course content, navigate learning paths, and get contextual help without replacing human trainers.

**Key Features**:
- **Course-Specific Instances**: Each course has its own optimized AI Coach instance
- **Trainer-Personalized**: AI Coach can be named and personalized per trainer (e.g., "John's AI Coach")
- **Auto-Update Capable**: Automatically detects and indexes course content updates
- **Manual Update Option**: Script-based manual content indexing for reliability

### 1.2 Key Value Propositions

- **Course-Aware**: Answers questions using only course content, with exact references
- **Progress-Aware**: Adapts responses based on learner's current progress
- **Cost-Optimized**: Aggressive token usage optimization to keep costs predictable
- **Trainer-Integrated**: Seamless escalation to human trainers when needed
- **Hallucination-Free**: Strict "I don't know" discipline to avoid incorrect answers

### 1.3 Scope

- **In Scope**: 
  - Course content Q&A (course-specific instances)
  - Progress-aware guidance
  - Trainer escalation
  - Trainer personalization (name, profile, personality)
  - Content update mechanisms (automatic and manual)
- **Out of Scope**: General knowledge, lab answer provision, marketing chatbot, auto-learning from user data

---

## 2. Objectives & Goals

### 2.1 Primary Objectives

1. **Answer Course Questions**: Provide accurate, course-specific answers with exact location references
2. **Adapt to Progress**: Tailor responses based on learner's completed chapters and current position
3. **Prevent Hallucination**: Strict adherence to provided context, explicit "I don't know" when uncertain
4. **Seamless Escalation**: Smooth handoff to assigned trainers for complex or uncertain queries
5. **Cost Efficiency**: Optimize token usage to maintain predictable operational costs
6. **Brand Consistency**: Maintain Digital Vidya's instructional tone and brand voice

### 2.2 Success Metrics

- **Accuracy**: > 90% of answers rated as "helpful" by learners
- **Escalation Rate**: < 20% of queries escalated to trainers
- **Response Time**: < 3 seconds for 95% of queries
- **Cost**: ≤ $0.05 per active learner per month (average)
- **Trust**: > 80% of learners trust AI Coach responses
- **Trainer Satisfaction**: < 10% of escalated queries require follow-up

---

## 3. Non-Goals (STRICT)

The AI Coach **MUST NOT**:

- ❌ Answer non-course or general knowledge questions
- ❌ Provide direct lab answers or solutions
- ❌ Guess or hallucinate when uncertain
- ❌ Replace human trainers
- ❌ Act as a marketing or sales chatbot
- ❌ Train itself implicitly on user data
- ❌ Access other learners' data or progress
- ❌ Provide answers outside allocated courses
- ❌ Store or learn from conversations without explicit consent
- ❌ Make decisions about course completion or certification

---

## 4. User Roles & Access

### 4.1 Learner

**Capabilities:**
- Ask questions related to:
  - Current allocated courses
  - Completed chapters
  - In-progress chapters
  - Labs and trainer feedback
  - Course navigation and structure
- View:
  - AI Coach responses
  - Escalated questions and trainer responses
  - Response references (day, chapter, lab)

**Restrictions:**
- Cannot access trainer-only content via AI
- Cannot view other learners' questions or data
- Cannot ask questions about unallocated courses

### 4.2 Trainer

**Capabilities:**
- View escalated questions from assigned learners
- Respond to escalated queries manually
- See AI confidence scores and context used
- View escalation history per learner
- Provide feedback on AI responses (for improvement)

**Restrictions:**
- Cannot view questions from unassigned learners
- Cannot directly interact with AI Coach (only via escalations)

### 4.3 Admin

**Capabilities:**
- View usage analytics:
  - Queries per course
  - Queries per learner
  - Escalation rates
  - Token consumption summaries
  - Cost per course/learner
- Configure:
  - Confidence thresholds
  - Token limits
  - Model selection
- Monitor:
  - System health
  - Error rates
  - Performance metrics

**Restrictions:**
- No direct AI interaction required
- Cannot access individual learner conversations (privacy)

---

## 5. Functional Requirements

### 5.1 Query Intake & Validation

**FR-1.1 Query Input**
- AI Coach must accept free-text questions from learners via LMS UI
- Support multiple input methods:
  - Text input field
  - Voice input (optional, Phase 2)
  - Context-aware suggestions (optional, Phase 2)

**FR-1.2 Query Validation**
Each query must be validated to determine:
- **Scope Check**: Is it course-related?
- **Access Check**: Is it within learner's allocated courses?
- **Answerability Check**: Can it be answered from available course material?
- **Intent Classification**: 
  - Course content question
  - Navigation question
  - Lab guidance request (hints, not answers)
  - Lab struggle detection (multiple failed attempts, low scores)
  - General question (out of scope)

**FR-1.3 Lab Struggle Detection**
AI Coach must detect when learners are struggling with labs:
- **Indicators**:
  - Multiple lab submission attempts (> 2)
  - Low lab scores (< 50%)
  - Repeated questions about same lab
  - Questions containing "stuck", "help", "don't understand", "how to do"
- **Detection Method**:
  - Analyze recent lab submission history
  - Check for patterns in queries
  - Monitor lab-related question frequency
- **Response Strategy**:
  - Proactively offer guidance (not answers)
  - Reference relevant course chapters
  - Suggest review of prerequisites
  - Encourage without solving for them

**FR-1.3 Out-of-Scope Handling**
Non-course or out-of-scope queries must be rejected with a standardized message:
> "I can only help with questions about your allocated courses. For other questions, I'll forward this to your trainer."

**FR-1.4 Query Preprocessing**
- Remove unnecessary whitespace
- Detect and handle typos (fuzzy matching)
- Extract course context from query (if possible)
- Normalize question format

### 5.2 Context Construction

**FR-2.1 Dynamic Context Building**
AI Coach must construct context dynamically using:
- **Current Course ID**: From learner's active course allocation
- **Learner Progress**: 
  - Completed chapters
  - In-progress chapters
  - Last accessed content
- **Current Page Context**: 
  - Current day/chapter/lab (if applicable)
  - Recently viewed content
- **Relevant Labs**: 
  - Submitted labs
  - Trainer feedback
  - Lab requirements
- **Assigned Trainer**: Metadata for escalation

**FR-2.2 Context Bounding**
Context must be strictly bounded:
- **Max 3-5 content chunks** per query
- **Never entire documents** or full course content
- **Prioritize relevance** over completeness
- **Token limit**: ≤ 2000 tokens for context

**FR-2.3 Context Prioritization**
Context retrieval must prioritize in this order:
1. **Current chapter** (if learner is on a specific page)
2. **Last incomplete chapter** (most relevant to progress)
3. **Related lab** (if question mentions labs)
4. **Prerequisite chapters** (if question requires background)
5. **Course overview** (for navigation questions)

**FR-2.4 Progress-Aware Filtering**
- Only include content from:
  - Completed chapters (for review questions)
  - Current/in-progress chapters (for learning questions)
  - Course structure (for navigation questions)
- Exclude:
  - Future chapters (not yet accessible)
  - Unallocated courses

### 5.3 Knowledge Retrieval

**FR-3.1 Course-Specific Instances**
- **Each course has its own AI Coach instance**:
  - Separate content index per course
  - Course-specific embeddings
  - Isolated query/response history per course
  - Course-specific widget URL/embedding
- **Widget Context-Awareness**:
  - Widget automatically detects current course from page context
  - Only answers questions about the current course
  - Shows course name in widget header
  - Prevents cross-course queries

**FR-3.2 Content Indexing**
Course content must be pre-indexed into retrievable chunks:
- **Source**: Course markdown/content files
- **Chunking Strategy**: 
  - Semantic boundaries (by chapter, section)
  - Optimal size: 200-500 tokens per chunk
  - Overlap: 50 tokens between chunks (for context)
- **Metadata**: Each chunk must include:
  - Course ID (for course-specific isolation)
  - Day number
  - Chapter ID
  - Chapter title
  - Lab ID (if applicable)
  - Content type (chapter, lab, overview)
  - Content version/hash (for change detection)

**FR-3.3 Embedding Generation**
- Generate embeddings for all content chunks **per course**
- Use consistent embedding model (e.g., OpenAI text-embedding-3-small)
- Store embeddings in vector database (e.g., Supabase pgvector)
- **Course isolation**: Embeddings are course-specific, not shared

**FR-3.4 Content Update Mechanisms**

**FR-3.4.1 Automatic Updates (Preferred)**
- **Webhook/Trigger System**:
  - Detect course content changes via database triggers or webhooks
  - Automatically re-index changed content
  - Update embeddings for modified chunks
  - Invalidate cache for affected course
- **Change Detection**:
  - Track content hash/version per chunk
  - Compare on content access
  - Queue updates for background processing
- **Update Process**:
  - Async background job
  - Non-blocking (doesn't affect active queries)
  - Incremental updates (only changed chunks)
  - Notification when update completes

**FR-3.4.2 Manual Updates (Fallback)**
- **Manual Indexing Script**:
  - Admin/trainer can trigger manual re-indexing
  - Script: `npm run index-course-content --course-id=<id>`
  - Full or incremental re-indexing option
  - Progress tracking and completion notification
- **Use Cases**:
  - Initial course setup
  - Bulk content updates
  - Recovery from failed auto-updates
  - Testing and validation

**FR-3.5 Semantic Search**
- Use vector similarity search to find relevant chunks
- **Course-scoped search**: Only search within current course
- Combine with keyword matching for better precision
- Return top 3-5 most relevant chunks
- Filter by learner's progress and access

**FR-3.6 Retrieval Optimization**
- Cache frequently accessed chunks (per course)
- Pre-compute embeddings for new courses
- Batch update embeddings on content changes
- Monitor retrieval performance per course

### 5.4 Answer Generation

**FR-4.1 Context-Only Answers**
AI Coach must answer **only using provided context chunks**:
- No implicit memory or global knowledge
- No assumptions beyond provided context
- Explicit references to source material

**FR-4.2 Response Format**
Responses must include:
- **Answer**: Clear, concise answer to the question
- **References**: Specific course locations:
  - Format: "Based on Day X → Chapter Y: [Chapter Title]"
  - Include lab references if applicable
- **Next Steps**: Suggest relevant next actions:
  - "You might want to review Chapter Z"
  - "Complete Lab X to practice this concept"
- **Tone**: 
  - Maintain Digital Vidya's instructional, supportive tone
  - **Trainer-Personalized**: If trainer has enabled personalization, include trainer's name and style
  - Example: "Hi! I'm John's AI Coach. Based on Day 1 → Chapter 2..."

**FR-4.3 Trainer Personalization**

**FR-4.3.1 Custom Naming**
- AI Coach can be named per trainer (e.g., "John's AI Coach", "Sarah's AI Assistant")
- Name displayed in widget header
- Configurable by trainer or admin
- Default: "AI Coach" if not personalized
- **Per-course personalization**: Trainer can have different names for different courses

**FR-4.3.2 Trainer Profile Integration**
- **LinkedIn Profile Integration**:
  - Trainer can provide LinkedIn profile URL
  - System extracts trainer information (name, bio, expertise, years of experience)
  - Used to personalize AI Coach responses
  - Information stored securely and used only with trainer's permission
- **Trainer Information Sharing**:
  - AI Coach can share trainer background when relevant
  - Example: "Your trainer, John, has 10+ years of SEO experience..."
  - Only shared with trainer's permission
  - Respects privacy settings
  - Configurable share levels (name only, name + expertise, full profile)
- **Personality Adaptation**:
  - AI Coach adapts tone/style based on trainer's profile
  - Maintains professional instructional tone
  - Adds personal touch without being unprofessional
  - Can reference trainer's expertise when relevant

**FR-4.3.3 Personalization Settings**
- Trainer can enable/disable personalization per course
- Control what information is shared:
  - **Name only**: Just show trainer's name in coach name
  - **Name + expertise**: Include expertise areas
  - **Full**: Include background and experience
- Admin can override settings if needed
- Settings stored per trainer per course (allows different personalization per course)

**FR-4.4 Response Length**
- **Optimal**: 50-150 words
- **Maximum**: 300 words
- **Structure**: 
  - Direct answer first
  - Supporting details
  - References
  - Next steps

**FR-4.5 Uncertainty Handling**
If answer is not found with sufficient confidence:
- Explicitly state uncertainty:
  > "I'm not fully confident about this answer. I'll forward this to your trainer for a more detailed response."
- Escalate immediately (see FR-5)

### 5.5 Confidence Scoring & Escalation

**FR-5.1 Confidence Calculation**
Each AI response must include an internal confidence score (0-1):
- **Factors**:
  - Semantic similarity of retrieved chunks (0.4 weight)
  - Completeness of answer from context (0.3 weight)
  - Query clarity and specificity (0.2 weight)
  - Historical accuracy of similar queries (0.1 weight)
- **Threshold**: Configurable (default: 0.65)

**FR-5.2 Low Confidence Handling**
If confidence < threshold:
- **Do not provide full answer**
- **Escalate immediately** to assigned trainer
- **Notify learner** that escalation occurred
- **Provide partial answer** if available (with disclaimer)

**FR-5.3 Escalation Payload**
Escalation must include:
- **Original Question**: Exact learner query
- **AI-Retrieved Context**: Chunks used (for trainer reference)
- **Learner Progress Snapshot**:
  - Current course
  - Completed chapters
  - In-progress chapters
  - Recent lab submissions
- **AI Confidence Score**: For trainer awareness
- **Timestamp**: When query was made
- **Context**: Current page/chapter (if applicable)

### 5.6 Trainer Escalation Workflow

**FR-6.1 Escalation Notification**
Trainer must receive escalated queries via:
- **In-app notification**: Real-time notification in LMS
- **Dedicated "AI Escalations" view**: 
  - List of pending escalations
  - Filter by learner, course, date
  - Sort by priority/urgency
- **Email notification** (optional, configurable)

**FR-6.2 Trainer Response**
Trainer response must:
- **Be visible to learner**: Displayed in AI Coach interface
- **Be stored**: As part of course/lab history
- **Include metadata**:
  - Response timestamp
  - Trainer name
  - Marked as "Trainer Response"
- **Optional future context**: Trainer can mark response as "reference" for future AI queries (explicit opt-in)

**FR-6.3 Escalation Status**
Track escalation status:
- **Pending**: Awaiting trainer response
- **Responded**: Trainer has provided answer
- **Resolved**: Learner has viewed response
- **Archived**: Old escalations (after 30 days)

**FR-6.4 Escalation Analytics**
Trainers can view:
- Escalation rate per learner
- Common escalation topics
- Response time metrics
- Learner satisfaction with escalations

### 5.7 User Feedback Loop

**FR-7.1 Feedback Collection**
Learners must be able to rate AI responses:
- **Helpful**: Response was useful
- **Not Helpful**: Response was not useful
- **Optional**: Free-text feedback

**FR-7.2 Feedback Impact**
Negative feedback must:
- **Reduce confidence weighting** for similar future queries
- **Increase escalation likelihood** for similar patterns
- **Trigger review** if multiple negative feedbacks for same topic
- **Update retrieval strategy** if needed

**FR-7.3 Feedback Analytics**
Track:
- Overall satisfaction rate
- Common "not helpful" reasons
- Topics with low satisfaction
- Improvement opportunities

### 5.8 Conversation History

**FR-8.1 History Storage**
- Store conversation history per learner
- Include:
  - Questions asked
  - AI responses
  - Escalations
  - Trainer responses
  - Feedback
- **Retention**: 90 days (configurable)

**FR-8.2 History Access**
- Learners can view their own history
- Trainers can view history for assigned learners
- Admins can view aggregated analytics (not individual conversations)

**FR-8.3 Context from History**
- Use recent conversation context (last 3-5 exchanges) for better answers
- Avoid repeating same answers
- Reference previous conversations when relevant

---

## 6. Technical Requirements

### 6.1 Architecture

**TR-1.1 Component Architecture**
```
┌─────────────────┐
│   LMS Frontend  │
│  (AI Coach UI)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Coach API   │
│  (Node.js/JS)   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────┐
│Vector  │ │  LLM API     │
│Database│ │  (OpenAI)    │
└────────┘ └──────────────┘
```

**TR-1.2 Service Components**
- **AI Coach Service**: Main orchestration logic
- **Query Processor**: Validation, intent classification
- **Context Builder**: Dynamic context construction
- **Retrieval Service**: Vector search and chunk retrieval
- **LLM Service**: Answer generation
- **Escalation Service**: Trainer handoff
- **Analytics Service**: Usage tracking

### 6.2 Data Storage

**TR-2.1 Database Tables**
- `ai_coach_queries`: Store all queries
- `ai_coach_responses`: Store AI responses
- `ai_coach_escalations`: Store escalations
- `ai_coach_feedback`: Store user feedback
- `ai_coach_content_chunks`: Store indexed course content
- `ai_coach_embeddings`: Store vector embeddings (or use pgvector)

**TR-2.2 Caching**
- **Query Cache**: Cache frequent queries (same question, same context)
- **Embedding Cache**: Cache computed embeddings
- **Context Cache**: Cache constructed contexts
- **TTL**: 1 hour for queries, permanent for embeddings

### 6.3 LLM Integration

**TR-3.1 Model Selection**
- **Intent Classification**: Cheap model (GPT-3.5-turbo or similar)
- **Confidence Estimation**: Cheap model
- **Answer Generation**: GPT-4-turbo or GPT-4o-mini (cost-optimized)
- **Fallback**: GPT-3.5-turbo if primary model unavailable

**TR-3.2 Prompt Engineering**
- **System Prompt**: Define role, constraints, tone
- **Context Injection**: Structured context chunks
- **Response Format**: JSON schema for structured responses
- **Temperature**: 0.3 (for consistency)
- **Max Tokens**: 500 (for answer generation)

**TR-3.3 Error Handling**
- **API Failures**: Graceful degradation, fallback model
- **Rate Limiting**: Queue requests, retry with backoff
- **Timeout**: 10 seconds max per query
- **Validation**: Validate LLM responses before returning

### 6.4 Vector Database

**TR-4.1 Technology**
- **Option 1**: Supabase pgvector (recommended, already in use)
- **Option 2**: Pinecone (if needed for scale)
- **Option 3**: Weaviate (self-hosted option)

**TR-4.2 Indexing**
- **Index Type**: HNSW (Hierarchical Navigable Small World)
- **Dimensions**: Match embedding model (e.g., 1536 for OpenAI)
- **Similarity Metric**: Cosine similarity

**TR-4.3 Performance**
- **Query Time**: < 100ms for retrieval
- **Index Update**: Async, non-blocking
- **Batch Operations**: For bulk indexing

---

## 7. Data Models

### 7.1 Query Model

```javascript
{
  id: UUID,
  learner_id: UUID,
  course_id: UUID,
  question: String,
  intent: Enum('course_content', 'navigation', 'lab_guidance', 'out_of_scope'),
  context: {
    current_chapter: String,
    current_day: Number,
    completed_chapters: Array<String>,
    in_progress_chapters: Array<String>
  },
  status: Enum('pending', 'answered', 'escalated', 'resolved'),
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 7.2 Response Model

```javascript
{
  id: UUID,
  query_id: UUID,
  answer: String,
  references: Array<{
    day: Number,
    chapter: String,
    chapter_title: String,
    lab_id: String (optional)
  }>,
  confidence_score: Number (0-1),
  next_steps: Array<String>,
  tokens_used: Number,
  model_used: String,
  created_at: Timestamp
}
```

### 7.3 Escalation Model

```javascript
{
  id: UUID,
  query_id: UUID,
  learner_id: UUID,
  trainer_id: UUID,
  original_question: String,
  ai_context: Array<String>, // Chunk IDs used
  ai_confidence: Number,
  learner_progress: Object,
  status: Enum('pending', 'responded', 'resolved', 'archived'),
  trainer_response: String (optional),
  trainer_responded_at: Timestamp (optional),
  created_at: Timestamp,
  resolved_at: Timestamp (optional)
}
```

### 7.4 Content Chunk Model

```javascript
{
  id: UUID,
  course_id: UUID, // Course-specific isolation
  day: Number,
  chapter_id: String,
  chapter_title: String,
  lab_id: String (optional),
  content: String,
  content_type: Enum('chapter', 'lab', 'overview'),
  embedding: Vector (1536 dimensions),
  token_count: Number,
  content_hash: String, // SHA-256 hash for change detection
  content_version: Integer, // Version number for tracking updates
  indexed_at: Timestamp, // Last indexing time
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 7.5 Trainer Personalization Model

```javascript
{
  id: UUID,
  trainer_id: UUID,
  course_id: UUID, // Optional: NULL = global, or specific course
  coach_name: String, // e.g., "John's AI Coach"
  linkedin_profile_url: String (optional),
  trainer_info: {
    name: String,
    bio: String (optional),
    expertise: Array<String> (optional),
    years_experience: Number (optional),
    extracted_at: Timestamp
  },
  personalization_enabled: Boolean,
  share_level: Enum('name_only', 'name_expertise', 'full'), // What to share
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 7.6 Content Update Tracking Model

```javascript
{
  id: UUID,
  course_id: UUID,
  update_type: Enum('full', 'incremental', 'manual'),
  status: Enum('pending', 'processing', 'completed', 'failed'),
  chunks_updated: Number,
  chunks_total: Number,
  started_at: Timestamp,
  completed_at: Timestamp (optional),
  error_message: String (optional),
  triggered_by: Enum('automatic', 'manual', 'admin'),
  created_at: Timestamp
}
```

### 7.7 Feedback Model

```javascript
{
  id: UUID,
  response_id: UUID,
  learner_id: UUID,
  rating: Enum('helpful', 'not_helpful'),
  feedback_text: String (optional),
  created_at: Timestamp
}
```

---

## 8. API Specifications

### 8.1 Query Submission

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
    "Review Chapter 3 for off-page SEO details",
    "Complete Lab 1 to practice on-page optimization"
  ],
  "escalated": false
}
```

### 8.2 Escalation Retrieval (Trainer)

**Endpoint**: `GET /api/ai-coach/escalations`

**Query Parameters**:
- `trainer_id`: UUID
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
      "ai_context": ["chunk-id-1", "chunk-id-2"],
      "learner_progress": {
        "completed_chapters": 5,
        "in_progress": "day2-ch1"
      },
      "status": "pending",
      "created_at": "2025-01-29T10:00:00Z"
    }
  ],
  "total": 15,
  "pending_count": 8
}
```

### 8.3 Trainer Response

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

### 8.4 Feedback Submission

**Endpoint**: `POST /api/ai-coach/responses/:id/feedback`

**Request**:
```json
{
  "rating": "helpful",
  "feedback_text": "This was exactly what I needed"
}
```

**Response**:
```json
{
  "success": true,
  "feedback_id": "uuid"
}
```

### 8.5 Conversation History

**Endpoint**: `GET /api/ai-coach/history`

**Query Parameters**:
- `learner_id`: UUID
- `course_id`: UUID (optional)
- `limit`: Number (default: 20)
- `offset`: Number (default: 0)

**Response**:
```json
{
  "conversations": [
    {
      "query": "What is SEO?",
      "answer": "SEO stands for...",
      "references": [...],
      "escalated": false,
      "created_at": "2025-01-29T09:00:00Z"
    }
  ],
  "total": 45
}
```

---

## 9. UI/UX Requirements

### 9.1 AI Coach Widget

**UI-1.1 Widget Placement**
- **Floating widget**: Bottom-right corner (desktop)
- **Fixed position**: Bottom of screen (mobile)
- **Context-aware**: Shows current chapter context
- **Collapsible**: Can be minimized/maximized

**UI-1.2 Widget States**
- **Idle**: Show "Ask a question" prompt
- **Loading**: Show spinner with "Thinking..." message
- **Answer**: Display answer with references
- **Escalated**: Show "Forwarded to trainer" message
- **Error**: Show error message with retry option

**UI-1.3 Visual Design**
- **Brand colors**: Use Digital Vidya color scheme
- **Icons**: Clear, recognizable icons for states
- **Typography**: Readable, accessible fonts
- **Spacing**: Comfortable padding and margins

### 9.2 Response Display

**UI-2.1 Answer Format**
- **Answer text**: Clear, readable formatting
- **References**: 
  - Clickable links to course content
  - Format: "📖 Day 1 → Chapter 2: On-Page SEO"
- **Next steps**: Bulleted list with actionable items
- **Confidence indicator**: Subtle indicator (if low confidence)

**UI-2.2 Response Types**
- **AI Response**: Clearly labeled "AI Coach"
- **Trainer Response**: Clearly labeled "Trainer Response" with trainer name
- **Escalated**: Show escalation status and timeline

### 9.3 Input Interface

**UI-3.1 Input Field**
- **Placeholder**: "Ask a question about this course..."
- **Character limit**: 500 characters
- **Auto-resize**: Expand as user types
- **Suggestions**: Show recent questions or common questions (optional)

**UI-3.2 Input Validation**
- **Real-time validation**: Check length, detect empty queries
- **Error messages**: Clear, helpful error messages
- **Submit button**: Disabled when invalid

### 9.4 Mobile Optimization

**UI-4.1 Mobile Layout**
- **Full-screen overlay**: On mobile, open as overlay
- **Touch-friendly**: Large tap targets (44x44px minimum)
- **Keyboard handling**: Adjust layout when keyboard appears
- **Swipe gestures**: Swipe to dismiss (optional)

**UI-4.2 Responsive Design**
- **Breakpoints**: 
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
- **Adaptive sizing**: Adjust widget size based on screen

### 9.5 Accessibility

**UI-5.1 ARIA Labels**
- All interactive elements have ARIA labels
- Widget has `role="dialog"` or `role="complementary"`
- States announced to screen readers

**UI-5.2 Keyboard Navigation**
- **Tab**: Navigate through elements
- **Enter**: Submit query
- **Escape**: Close/minimize widget
- **Arrow keys**: Navigate history (if applicable)

**UI-5.3 Screen Reader Support**
- Announce query submission
- Announce answer availability
- Announce escalation status
- Announce errors

---

## 10. Security & Privacy

### 10.1 Access Control

**SEC-1.1 Role-Based Access**
- Strict RBAC enforcement
- Learners can only query their allocated courses
- Trainers can only view escalations for assigned learners
- Admins have read-only access to analytics

**SEC-1.2 Query Validation**
- Validate course allocation before processing
- Check learner access to requested content
- Reject queries for unallocated courses

### 10.2 Data Privacy

**SEC-2.1 Data Isolation**
- Learner conversations are isolated per learner
- No cross-learner data access
- Trainer-only content never exposed to learners

**SEC-2.2 Data Retention**
- Conversation history: 90 days (configurable)
- Escalations: 180 days (configurable)
- Analytics: Aggregated, anonymized

**SEC-2.3 PII Handling**
- Minimize PII in prompts sent to LLM
- Use learner IDs, not names in API calls
- Anonymize data in analytics

### 10.3 API Security

**SEC-3.1 Authentication**
- All API calls require valid JWT token
- Token validation on every request
- Role verification in middleware

**SEC-3.2 Rate Limiting**
- **Per learner**: 50 queries per hour
- **Per course**: 200 queries per hour
- **Global**: 1000 queries per hour
- Return 429 (Too Many Requests) when exceeded

**SEC-3.3 Input Sanitization**
- Sanitize all user inputs
- Prevent injection attacks
- Validate data types and formats
- Escape special characters

### 10.4 LLM Security

**SEC-4.1 Prompt Injection Prevention**
- Sanitize user queries before sending to LLM
- Use system prompts to prevent manipulation
- Monitor for suspicious patterns

**SEC-4.2 API Key Security**
- Store API keys in environment variables
- Never expose keys to frontend
- Rotate keys regularly
- Use separate keys for different environments

---

## 11. Performance & Cost Optimization

### 11.1 Token Cost Optimization

**TC-1.1 Model Selection**
- **Intent Classification**: GPT-3.5-turbo (~$0.001 per query)
- **Confidence Estimation**: GPT-3.5-turbo (~$0.001 per query)
- **Answer Generation**: GPT-4o-mini (~$0.01 per query) or GPT-4-turbo (~$0.03 per query)
- **Total Target**: ≤ $0.05 per query (average)

**TC-1.2 Context Optimization**
- **Max Context Tokens**: 2000 tokens
- **Max Response Tokens**: 500 tokens
- **Chunk Selection**: Top 3-5 most relevant chunks only
- **No Redundancy**: Avoid duplicate content in context

**TC-1.3 Caching Strategy**
- **Query Cache**: Cache identical queries (same question + same context)
  - TTL: 1 hour
  - Hit rate target: > 30%
- **Embedding Cache**: Permanent cache for embeddings
- **Context Cache**: Cache constructed contexts (5 minutes TTL)

**TC-1.4 Batch Processing**
- Batch similar queries when possible
- Use streaming for long responses
- Optimize API calls (reduce round trips)

### 11.2 Performance Targets

**PERF-1.1 Response Time**
- **P50**: < 2 seconds
- **P95**: < 3 seconds
- **P99**: < 5 seconds
- **Timeout**: 10 seconds max

**PERF-1.2 Throughput**
- **Concurrent Queries**: Support 100 concurrent queries
- **Queries per Second**: Handle 50 QPS
- **Scalability**: Horizontal scaling ready

**PERF-1.3 Database Performance**
- **Vector Search**: < 100ms
- **Query Lookup**: < 50ms
- **Escalation Retrieval**: < 200ms

### 11.3 Monitoring & Alerts

**PERF-2.1 Metrics to Monitor**
- Token usage per query
- Cost per hour/day
- Response time distribution
- Error rates
- Cache hit rates
- Escalation rates

**PERF-2.2 Alerts**
- **Cost Alert**: If daily cost exceeds threshold
- **Performance Alert**: If P95 > 5 seconds
- **Error Alert**: If error rate > 5%
- **Escalation Alert**: If escalation rate > 30%

---

## 12. Observability & Analytics

### 12.1 Usage Analytics

**OBS-1.1 Learner Metrics**
- Queries per learner
- Queries per course
- Average queries per session
- Most common questions
- Satisfaction rate

**OBS-1.2 Course Metrics**
- Queries per course
- Most queried chapters
- Most queried topics
- Course-specific escalation rate

**OBS-1.3 System Metrics**
- Total queries per day/week/month
- Peak usage times
- Average response time
- Error rate
- Cache hit rate

### 12.2 Cost Analytics

**OBS-2.1 Cost Tracking**
- Cost per query
- Cost per learner
- Cost per course
- Daily/weekly/monthly costs
- Cost trends

**OBS-2.2 Cost Optimization Insights**
- Most expensive queries
- Opportunities for caching
- Model usage distribution
- Token usage patterns

### 12.3 Quality Analytics

**OBS-3.1 Answer Quality**
- Confidence score distribution
- Feedback distribution
- Escalation rate by topic
- Feedback ratings
- Common "not helpful" reasons

**OBS-3.2 Escalation Analytics**
- Escalation rate
- Escalation reasons
- Trainer response time
- Learner satisfaction with escalations
- Topics requiring frequent escalation

### 12.4 Admin Dashboard

**OBS-4.1 Dashboard Views**
- **Overview**: Key metrics at a glance
- **Cost Analysis**: Cost breakdown and trends
- **Usage Analysis**: Query patterns and trends
- **Quality Metrics**: Confidence and feedback analysis
- **Escalation Management**: Escalation trends and patterns

**OBS-4.2 Reports**
- Daily/weekly/monthly reports
- Export to CSV/PDF
- Scheduled reports (email)

---

## 13. Phased Implementation

### Phase 1: Foundation (MVP) - 4 weeks

**Scope:**
- Basic query → answer flow
- Content indexing and retrieval
- Simple confidence scoring
- Basic UI widget
- No escalation (reject low-confidence queries)

**Deliverables:**
- ✅ Content indexing system
- ✅ Vector database setup
- ✅ Basic AI Coach service
- ✅ Simple UI widget
- ✅ Query/response storage

**Success Criteria:**
- Can answer course-related questions
- References course locations
- Rejects out-of-scope queries
- Response time < 3 seconds

### Phase 2: Escalation & Feedback - 3 weeks

**Scope:**
- Confidence-based escalation
- Trainer escalation workflow
- User feedback system
- Escalation notifications

### Phase 2.5: Trainer Personalization & Content Updates - 2 weeks

**Scope:**
- **Trainer personalization**:
  - Custom coach naming
  - LinkedIn profile integration
  - Trainer info extraction
  - Personalized responses
- **Content update system**:
  - Automatic change detection (webhooks/triggers)
  - Hash-based change detection
  - Background re-indexing queue
  - Manual re-indexing script (enhanced)

**Deliverables:**
- ✅ Escalation service
- ✅ Trainer escalation UI
- ✅ Feedback collection
- ✅ Notification system

**Success Criteria:**
- Escalations work seamlessly
- Trainers can respond
- Feedback is collected
- < 20% escalation rate

### Phase 3: Optimization & Analytics - 2 weeks

**Scope:**
- Cost optimization
- Performance tuning
- Analytics dashboard
- Caching improvements

**Deliverables:**
- ✅ Cost optimization
- ✅ Performance improvements
- ✅ Admin analytics dashboard
- ✅ Enhanced caching

**Success Criteria:**
- Cost < $0.05 per learner/month
- Response time < 2 seconds (P95)
- Analytics dashboard functional

### Phase 4: Advanced Features - 3 weeks (Optional)

**Scope:**
- Progress-aware nudges
- Lab hints (not answers)
- Conversation history UI
- Voice input (optional)

**Deliverables:**
- ✅ Smart guidance features
- ✅ Lab hint system
- ✅ History UI
- ✅ Voice input (if prioritized)

---

## 14. Success Criteria

### 14.1 Functional Success

- ✅ **Accuracy**: > 90% of answers rated as "helpful"
- ✅ **Coverage**: Can answer questions from all course chapters
- ✅ **References**: All answers include accurate course references
- ✅ **Escalation**: < 20% escalation rate
- ✅ **Response Time**: < 3 seconds for 95% of queries

### 14.2 Business Success

- ✅ **Adoption**: > 60% of active learners use AI Coach
- ✅ **Satisfaction**: > 80% of learners trust AI Coach
- ✅ **Trainer Satisfaction**: < 10% of escalations require follow-up
- ✅ **Cost**: ≤ $0.05 per active learner per month
- ✅ **Retention**: AI Coach usage correlates with course completion

### 14.3 Technical Success

- ✅ **Reliability**: 99.9% uptime
- ✅ **Performance**: P95 response time < 3 seconds
- ✅ **Scalability**: Handles 100 concurrent queries
- ✅ **Security**: Zero security incidents
- ✅ **Observability**: Full metrics and analytics

---

## 15. Dependencies & Integration Points

### 15.1 Internal Dependencies

**Dependencies:**
- ✅ **Course Service**: Access course content and structure
- ✅ **User Service**: Learner and trainer data
- ✅ **Progress Service**: Learner progress tracking
- ✅ **Notification Service**: Escalation notifications
- ✅ **Auth Service**: Authentication and authorization

**Integration Points:**
- Course content API
- User progress API
- Notification API
- Authentication middleware

### 15.2 External Dependencies

**Dependencies:**
- **OpenAI API**: LLM services (or alternative: Anthropic, Google)
- **Vector Database**: Supabase pgvector (or alternative: Pinecone)
- **Embedding Model**: OpenAI text-embedding-3-small

**Alternatives:**
- **LLM**: Anthropic Claude, Google Gemini
- **Vector DB**: Pinecone, Weaviate, Qdrant
- **Embeddings**: Cohere, Hugging Face

### 15.3 Infrastructure Requirements

**Infrastructure:**
- **Database**: Supabase (existing)
- **Backend**: Node.js/JavaScript (existing)
- **Frontend**: Existing LMS frontend
- **Caching**: Redis (optional, for query cache)
- **Monitoring**: Existing monitoring solution

---

## 16. Risk Mitigation

### 16.1 Technical Risks

**Risk 1: High Token Costs**
- **Mitigation**: Aggressive caching, model selection, context optimization
- **Monitoring**: Daily cost tracking, alerts

**Risk 2: Hallucination**
- **Mitigation**: Strict context-only answers, confidence thresholds, escalation
- **Monitoring**: Feedback tracking, escalation analysis

**Risk 3: Performance Issues**
- **Mitigation**: Caching, async processing, horizontal scaling
- **Monitoring**: Response time tracking, load testing

### 16.2 Business Risks

**Risk 1: Low Adoption**
- **Mitigation**: Clear value proposition, easy UI, marketing
- **Monitoring**: Usage analytics, user feedback

**Risk 2: Trainer Overload**
- **Mitigation**: High confidence threshold, quality answers, clear escalation process
- **Monitoring**: Escalation rate, trainer feedback

**Risk 3: Cost Overruns**
- **Mitigation**: Strict token limits, cost alerts, usage monitoring
- **Monitoring**: Daily cost tracking, budget alerts

---

## 17. Appendices

### 17.1 Glossary

- **Chunk**: A semantic unit of course content (200-500 tokens)
- **Embedding**: Vector representation of text for semantic search
- **Escalation**: Handoff of query to human trainer
- **Confidence Score**: AI's certainty in its answer (0-1)
- **Hallucination**: AI providing incorrect or made-up information
- **Intent Classification**: Determining the type/purpose of a query
- **Token**: Unit of text processed by LLM (~4 characters)

### 17.2 References

- OpenAI API Documentation
- Supabase pgvector Documentation
- Digital Vidya LMS Architecture
- Course Content Structure

### 17.3 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-29 | Product Team | Initial requirements specification |

---

## 18. Approval & Sign-Off

**Product Owner**: _________________  
**Engineering Lead**: _________________  
**Design Lead**: _________________  
**Date**: _________________

---

**Document Status**: ✅ Ready for Implementation

