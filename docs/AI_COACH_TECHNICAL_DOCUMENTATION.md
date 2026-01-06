# AI Coach Technical Documentation

## Overview

The AI Coach is an intelligent question-answering system that helps learners get answers to their course-related questions. It uses a combination of semantic search, keyword matching, metadata-based prioritization, and Large Language Models (LLMs) to generate accurate, context-aware responses.

## Architecture

The AI Coach follows a modular service-oriented architecture with the following key components:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Coach Widget (UI)                      │
│              (ai-coach-widget.js)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              AI Coach Service (Orchestrator)                 │
│              (ai-coach-service.js)                            │
└──────┬──────────┬──────────┬──────────┬──────────┬───────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Query   │ │ Context  │ │ Retrieval │ │   LLM    │ │ Metadata │
│Processor │ │ Builder  │ │  Service  │ │ Service  │ │ Service  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
       │          │          │          │          │
       └──────────┴──────────┴──────────┴──────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   Supabase Database  │
            │  (Content Chunks)    │
            └──────────────────────┘
```

## Core Services

### 1. AI Coach Service (`ai-coach-service.js`)

**Role**: Main orchestrator that coordinates all other services.

**Key Responsibilities**:
- Validates user queries
- Classifies query intent
- Coordinates content retrieval
- Builds context for LLM
- Generates final responses
- Stores queries and responses in database

**Main Method**: `processQuery(learnerId, courseId, question, options)`

**Process Flow**:
1. **Query Validation**: Checks if course is allocated, question length, etc.
2. **Intent Classification**: Determines if question is about course content, labs, navigation, etc.
3. **Out-of-Scope Validation**: Double-checks if content exists before rejecting
4. **Context Building**: Gathers learner progress, course structure
5. **Content Retrieval**: Searches for relevant content chunks
6. **Prioritization**: Ranks chunks by relevance
7. **Response Generation**: Uses LLM to generate answer
8. **Storage**: Saves query and response to database

### 2. Query Processor Service (`query-processor-service.js`)

**Role**: Preprocesses and analyzes user queries.

**Key Responsibilities**:
- Validates query format and access
- Preprocesses query (normalize, trim, remove excessive punctuation)
- Classifies intent (course_content, lab_guidance, navigation, etc.)
- Parses specific references (Day X, Chapter Y, Lab Z, Step N)
- Detects lab struggles

**Key Methods**:
- `validateQuery(learnerId, courseId, question)`: Validates query
- `classifyIntent(question, context)`: Classifies query intent
- `preprocessQuery(question)`: Normalizes query text
- `parseSpecificReferences(question)`: Extracts Day/Chapter/Lab/Step references

**Intent Types**:
- `course_content`: Questions about course material, concepts
- `list_request`: Questions asking to list/enumerate items
- `navigation`: Questions about course structure
- `lab_guidance`: Questions about labs/assignments
- `lab_struggle`: Indications of struggling with labs
- `out_of_scope`: Questions not related to course

### 3. Context Builder Service (`context-builder-service.js`)

**Role**: Builds context for queries and prioritizes content chunks.

**Key Responsibilities**:
- Extracts topic keywords from questions
- Builds learner progress context
- Filters chunks by access and progress
- Prioritizes chunks based on relevance, metadata, and topic matching
- Constructs context within token limits

**Key Methods**:
- `buildContext(learnerId, courseId, question, intent)`: Builds full context
- `extractTopicKeywords(question)`: Extracts topic keywords/phrases
- `filterChunksByAccess(chunks, progress, intent)`: Filters by access
- `prioritizeChunks(chunks, question, progress)`: Ranks chunks by priority
- `constructContextWithinTokenLimit(chunks, maxTokens)`: Selects chunks within token budget

**Topic Extraction**:
- Recognizes multi-word technical phrases (e.g., "Answer Engine Optimization", "Technical SEO")
- Extracts acronyms (e.g., "AEO", "SEO")
- Filters common words
- Returns array of topic keywords

**Prioritization Logic**:
1. **Dedicated Topic Chapters**: Minimum priority of 2.0 (always win)
2. **Comprehensive Coverage**: +0.4 boost
3. **Intermediate Coverage**: +0.15 boost
4. **Introduction Coverage**: -0.3 penalty (if comprehensive chunks exist)
5. **Current Chapter**: +0.2 boost
6. **Completed Chapters**: +0.1 boost
7. **Topic Matching**: Additional boosts for topic matches

### 4. Retrieval Service (`retrieval-service.js`)

**Role**: Retrieves relevant content chunks from database.

**Key Responsibilities**:
- Performs semantic search using embeddings
- Performs keyword search
- Searches for dedicated topic chapters
- Handles exact matches for specific references
- Retrieves all chunks from a specific chapter (for list requests)

**Key Methods**:
- `hybridSearch(question, courseId, filters, limit)`: Combines semantic + keyword search
- `searchDedicatedChaptersByTopic(topicKeywords, courseId, filters)`: Finds dedicated chapters
- `searchExactMatch(references, courseId, filters, limit)`: Exact match for Day/Chapter/Lab/Step
- `getAllChunksFromChapter(chapterRef, courseId)`: Gets all chunks from a chapter
- `keywordSearch(question, courseId, filters, limit)`: Keyword-only search

**Search Strategies**:

1. **Hybrid Search**:
   - Generates embedding for question
   - Performs vector similarity search (cosine similarity)
   - Performs keyword search (PostgreSQL full-text search)
   - Combines and deduplicates results
   - Boosts chunks with `is_dedicated_topic_chapter = true`

2. **Dedicated Chapter Search**:
   - First: Searches by metadata (`is_dedicated_topic_chapter = true`, `primary_topic` match)
   - Fallback: Searches by chapter title/content containing topic keywords
   - No day filter (dedicated chapters can be anywhere)
   - Matches against `primary_topic`, `chapter_title`, and `content`

3. **Exact Match Search**:
   - Parses Day/Chapter/Lab/Step references
   - Queries database with exact filters
   - Handles various ID formats (e.g., "day1", "day 1", "Day 1")
   - Returns chunks with `exactMatch: true` flag

### 5. LLM Service (`llm-service.js`)

**Role**: Handles interactions with OpenAI API.

**Key Responsibilities**:
- Generates embeddings for semantic search
- Classifies query intent
- Generates answers from context chunks
- Estimates confidence scores

**Key Methods**:
- `generateEmbedding(text)`: Generates embedding vector
- `classifyIntent(question, context)`: Classifies query intent
- `generateAnswer(question, contextChunks, systemPrompt, options)`: Generates answer

**Models Used**:
- **Embeddings**: `text-embedding-3-small` (1536 dimensions)
- **Intent Classification**: `gpt-3.5-turbo` (temperature: 0.1)
- **Answer Generation**: `gpt-4o-mini` or `gpt-4o` (configurable)

**Answer Generation Process**:
1. Builds system prompt with instructions
2. Constructs context from selected chunks
3. Calls OpenAI API with question + context
4. Parses response (answer, references, confidence)
5. Returns structured response object

**System Prompt Structure**:
- Course context
- Response style guidelines
- Reference format requirements
- Lab guidance rules (never provide direct answers)
- List request instructions (enumerate ALL items)

### 6. Chunk Metadata Service (`chunk-metadata-service.js`)

**Role**: Analyzes and enriches content chunks with metadata.

**Key Responsibilities**:
- Extracts coverage level (introduction, intermediate, comprehensive, advanced)
- Estimates completeness score (0-1)
- Identifies dedicated topic chapters
- Extracts primary and secondary topics
- Extracts step numbers (for labs)

**Key Methods**:
- `enrichChunkMetadata(chunk, useLLM)`: Enriches chunk with metadata
- `extractCoverageLevel(chunk)`: Determines coverage level
- `estimateCompletenessScore(chunk)`: Estimates completeness
- `isDedicatedTopicChapter(chunk, topics)`: Checks if dedicated chapter

**Metadata Fields**:
- `coverage_level`: introduction | intermediate | comprehensive | advanced
- `completeness_score`: 0.0 - 1.0
- `is_dedicated_topic_chapter`: boolean
- `primary_topic`: string (e.g., "Answer Engine Optimization")
- `secondary_topics`: array of strings
- `step_number`: integer (for lab steps)

## Query Processing Pipeline

### Step 1: Query Reception
```
User submits question → AI Coach Widget → AI Coach Service
```

### Step 2: Query Validation
- Checks if course is allocated to learner
- Validates question length (3-1000 characters)
- Returns error if validation fails

### Step 3: Query Preprocessing
- Trims whitespace
- Normalizes whitespace
- Removes excessive punctuation

### Step 4: Intent Classification
- Uses LLM to classify intent
- Validates `out_of_scope` by checking if content exists
- Falls back to keyword-based classification if LLM fails

**Out-of-Scope Validation**:
- Extracts topic keywords
- Searches for relevant content
- If content found, reclassifies as `course_content`
- Checks for SEO/AEO terms as fallback

### Step 5: Context Building
- Gets learner progress (completed chapters, current chapter)
- Gets course structure
- Extracts topic keywords from question

### Step 6: Content Retrieval

**6a. Dedicated Chapter Search** (if topics detected):
- Searches for chunks with `is_dedicated_topic_chapter = true`
- Matches `primary_topic` against extracted topics
- Fallback: Searches by chapter title/content
- No day filter (finds chapters anywhere in course)

**6b. Exact Match Search** (if specific references found):
- Parses Day/Chapter/Lab/Step references
- Queries database with exact filters
- Returns chunks with `exactMatch: true`

**6c. Hybrid Search** (default):
- Generates embedding for question
- Vector similarity search (top 20 chunks)
- Keyword search (PostgreSQL full-text)
- Combines and deduplicates results

**6d. List Request Handling** (if `list_request` intent):
- Retrieves ALL chunks from specified chapter
- No filtering or limits
- Ensures complete enumeration

### Step 7: Chunk Merging and Deduplication
- Merges dedicated chapters with regular search results
- Dedicated chunks placed FIRST in array
- Sets high similarity (0.95) and priority (2.0) for dedicated chunks
- Deduplicates by chunk ID

### Step 8: Metadata Enrichment (Optional)
- Enriches chunks missing metadata (if ≤10 chunks)
- Uses heuristic analysis (fast)
- Can use LLM analysis (slower, more accurate)

### Step 9: Chunk Filtering
- Filters by learner access and progress
- For `lab_guidance`: Only includes labs and prerequisite chapters
- For `course_content`: More lenient (allows all chunks)
- For `list_request`: No filtering (wants all chunks)

### Step 10: Chunk Prioritization
- Calculates priority score for each chunk
- Factors:
  - Similarity score (from search)
  - Coverage level (comprehensive > intermediate > introduction)
  - Dedicated topic match (minimum 2.0 priority)
  - Topic matching (word-by-word, acronym matching)
  - Current chapter boost
  - Completed chapter boost
- Sorts by priority (highest first)

### Step 11: Chunk Selection (Two-Phase)

**Phase 1: Dedicated Chapters**
- Selects dedicated chunks first
- Ensures they fit within token budget
- Includes at least one even if exceeds limit slightly

**Phase 2: Other Chunks**
- Fills remaining token budget with other chunks
- Selects in priority order
- Stops when budget exhausted

**Token Limits**:
- Normal requests: 2000 tokens
- List requests: 5000 tokens
- Lab guidance: 2000 tokens

### Step 12: Answer Generation
- Builds system prompt with:
  - Course context
  - Response style guidelines
  - Reference format requirements
  - Intent-specific instructions
- Constructs context from selected chunks
- Calls OpenAI API (`gpt-4o-mini` or `gpt-4o`)
- Parses response:
  - Answer text
  - Reference locations
  - Confidence score
  - Next steps

### Step 13: Response Validation
- Validates references match question (if specific reference requested)
- Validates list completeness (if `list_request`)
- Returns error if validation fails

### Step 14: Storage
- Saves query to `ai_coach_queries` table
- Saves response to `ai_coach_responses` table
- Links them in `ai_coach_conversation_history` table
- Stores metadata (chunk IDs used, confidence, etc.)

### Step 15: Response Return
- Returns structured response object:
  ```javascript
  {
    success: true,
    answer: "...",
    references: [...],
    confidenceScore: 0.85,
    queryId: "...",
    responseId: "...",
    chunksUsed: 5,
    ...
  }
  ```

## Technical Details

### Embeddings

**Model**: `text-embedding-3-small`
**Dimensions**: 1536
**Usage**: 
- Generated for user questions
- Stored in `ai_coach_content_chunks.embedding` column
- Used for vector similarity search (cosine similarity)

**Vector Search**:
- Uses Supabase `pgvector` extension
- Query: `embedding <-> query_embedding` (L2 distance)
- Returns top N chunks sorted by similarity
- Similarity score: `1 - (distance / 2)` (normalized to 0-1)

### Keyword Search

**Method**: PostgreSQL full-text search
**Columns Searched**:
- `content` (main text)
- `chapter_title`
- `chapter_id`
- `lab_id`

**Search Strategy**:
- Uses `ilike` for pattern matching
- Searches for topic keywords
- Combines with `OR` conditions
- Boosts chunks with topic in title

### Dedicated Chapter Detection

**Metadata-Based**:
- Checks `is_dedicated_topic_chapter = true`
- Matches `primary_topic` against extracted topics
- Uses flexible matching (exact, contains, word-by-word, acronym)

**Fallback (Title-Based)**:
- Searches chapter titles for topic keywords
- No day filter (finds chapters anywhere)
- Marks found chunks as dedicated
- Sets `primary_topic` from chapter title

**Topic Matching**:
1. Exact match: `primary_topic === topic`
2. Contains match: `primary_topic.includes(topic)` or vice versa
3. Word-by-word: Checks if significant words overlap (60% threshold)
4. Acronym: Matches acronyms (e.g., "AEO" ↔ "Answer Engine Optimization")
5. All words: Checks if all words from topic appear in title/content

### Prioritization Algorithm

**Base Priority**: `similarity_score` (from search)

**Boosts**:
- Dedicated topic chapter matching question topic: **+1.0** (minimum 2.0 floor)
- Dedicated topic match from search: **+0.6**
- Comprehensive/Advanced coverage: **+0.4**
- Intermediate coverage: **+0.15**
- Current chapter: **+0.2**
- Completed chapters: **+0.1**

**Penalties**:
- Introduction coverage (if comprehensive chunks exist): **-0.3**
- Introduction coverage (if no comprehensive chunks): **-0.1**

**Final Priority Calculation**:
```javascript
priority = similarity_score
  + (isDedicatedTopicMatch ? 1.0 : 0)
  + (isDedicatedTopicMatchFromSearch ? 0.6 : 0)
  + (coverageLevel === 'comprehensive' ? 0.4 : 0)
  + (coverageLevel === 'intermediate' ? 0.15 : 0)
  + (isCurrentChapter ? 0.2 : 0)
  + (isCompletedChapter ? 0.1 : 0)
  - (isIntroduction && hasComprehensiveChunks ? 0.3 : 0)
  - (isIntroduction && !hasComprehensiveChunks ? 0.1 : 0)

// Ensure dedicated chapters have minimum priority of 2.0
if (isDedicatedTopicMatch) {
  priority = Math.max(priority, 2.0);
}
```

### Token Management

**Token Calculation**:
- Uses `token_count` column if available
- Estimates: `Math.ceil(content.length / 4)` (4 chars ≈ 1 token)
- Default: 200 tokens if calculation fails

**Selection Strategy**:
- Two-phase: Dedicated chunks first, then others
- Always includes at least first chunk (even if exceeds limit)
- Stops when adding next chunk would exceed limit

### Response Format

**Structure**:
```
Answer: [Direct answer to question]

Key Points:
- [Point 1]
- [Point 2]
- [Point 3]

References:
- Day X → Chapter Y: [Chapter Title]
- Day Z → Lab W: [Lab Title]

Next Steps:
1. [Action 1]
2. [Action 2]
```

**Reference Format**:
- `Day X → Chapter Y: [Title]`
- `Day X → Lab Y: [Title]`
- `Day X → Chapter Y → Lab Z: [Title]`

## Database Schema

### `ai_coach_content_chunks`
Stores course content chunks with embeddings and metadata.

**Key Columns**:
- `id`: UUID (primary key)
- `course_id`: Course identifier
- `day`: Day number
- `chapter_id`: Chapter identifier
- `chapter_title`: Chapter title
- `content`: Chunk text content
- `embedding`: Vector embedding (1536 dimensions)
- `content_type`: 'chapter' | 'lab' | 'overview'
- `token_count`: Estimated token count
- `coverage_level`: 'introduction' | 'intermediate' | 'comprehensive' | 'advanced'
- `completeness_score`: 0.0 - 1.0
- `is_dedicated_topic_chapter`: boolean
- `primary_topic`: string
- `secondary_topics`: JSONB array
- `step_number`: integer (for labs)

### `ai_coach_queries`
Stores user queries.

**Key Columns**:
- `id`: UUID (primary key)
- `learner_id`: User ID
- `course_id`: Course identifier
- `question`: Question text
- `intent`: Intent classification
- `created_at`: Timestamp

### `ai_coach_responses`
Stores AI-generated responses.

**Key Columns**:
- `id`: UUID (primary key)
- `query_id`: Foreign key to `ai_coach_queries`
- `answer`: Response text
- `reference_locations`: JSONB array of references
- `confidence_score`: 0.0 - 1.0
- `is_lab_guidance`: boolean
- `chunk_ids`: JSONB array of chunk IDs used
- `created_at`: Timestamp

### `ai_coach_conversation_history`
Links queries and responses for conversation tracking.

**Key Columns**:
- `query_id`: Foreign key to `ai_coach_queries`
- `response_id`: Foreign key to `ai_coach_responses`
- `learner_id`: User ID
- `course_id`: Course identifier
- `sequence_number`: Order in conversation
- `created_at`: Timestamp

## Error Handling

### Query Validation Errors
- Course not allocated → Returns error message
- Question too short/long → Returns validation error
- Invalid format → Returns format error

### Retrieval Errors
- No chunks found → Falls back to keyword search
- Database error → Logs error, returns empty array
- RLS policy blocked → Returns empty array

### LLM Errors
- API key missing → Falls back to keyword-based classification
- API error → Logs error, uses fallback
- Rate limit → Retries with exponential backoff

### Response Validation Errors
- Invalid references → Returns error, asks user to rephrase
- Incomplete list → Returns error, suggests checking chapter

## Performance Optimizations

1. **Caching**: Embeddings cached in memory
2. **Lazy Loading**: Services loaded on demand
3. **Batch Operations**: Multiple embeddings generated in batch
4. **Token Limits**: Limits context size to prevent API timeouts
5. **Metadata Enrichment**: Only enriches ≤10 chunks (performance)
6. **Deduplication**: Uses Map for O(1) lookup
7. **Early Returns**: Stops processing if validation fails

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: OpenAI API key
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key

### Service Configuration
- `confidenceThreshold`: 0.65 (default)
- `maxTokens`: 2000 (normal), 5000 (list requests)
- `embeddingModel`: 'text-embedding-3-small'
- `llmModel`: 'gpt-4o-mini' (default), 'gpt-4o' (optional)

## Future Enhancements

1. **Conversation Context**: Track conversation history for follow-up questions
2. **Multi-turn Dialogues**: Support for clarifying questions
3. **Personalization**: Adapt responses based on learner progress
4. **Feedback Loop**: Use learner feedback to improve responses
5. **A/B Testing**: Test different prompt strategies
6. **Analytics**: Track query patterns and response quality

## Troubleshooting

### Issue: Responses reference wrong chapters
**Solution**: Check metadata (`is_dedicated_topic_chapter`, `primary_topic`). Run metadata enrichment script.

### Issue: Out-of-scope errors for valid questions
**Solution**: Check intent classification. Verify topic extraction works. Check fallback validation.

### Issue: Incomplete list responses
**Solution**: Check if `getAllChunksFromChapter` returns all chunks. Verify token limit is high enough.

### Issue: Slow response times
**Solution**: Check embedding generation time. Reduce number of chunks retrieved. Use faster LLM model.

### Issue: High API costs
**Solution**: Reduce token limits. Use `gpt-4o-mini` instead of `gpt-4o`. Cache embeddings.

---

**Last Updated**: 2026-01-02
**Version**: 1.0

