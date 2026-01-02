# AI Coach - Key Clarifications & Design Decisions

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Approved

---

## Overview

This document addresses three critical design decisions for the AI Coach feature:

1. **Course-Specific AI Coach Instances**
2. **Content Update Mechanisms (Automatic vs Manual)**
3. **Trainer Personalization & Naming**

---

## 1. Course-Specific AI Coach Instances

### Decision: ✅ YES - Each Course Has Its Own AI Coach Instance

**Rationale:**
- Better content isolation and accuracy
- Course-specific optimization
- Easier maintenance and updates
- Clearer user experience

### Implementation:

#### 1.1 Widget Behavior
- **Automatic Course Detection**: Widget detects current course from page URL/context
- **Course-Scoped Queries**: Only answers questions about the current course
- **Isolated State**: Each course maintains its own conversation history
- **Course Indicator**: Widget header shows current course name

#### 1.2 Technical Implementation
- **Content Indexing**: Each course has its own content chunks in database
- **Vector Search**: All searches are scoped to `course_id`
- **Embeddings**: Course-specific embeddings (not shared across courses)
- **Cache**: Per-course caching for better performance

#### 1.3 Database Design
```sql
-- All queries are course-scoped
SELECT * FROM ai_coach_content_chunks 
WHERE course_id = 'seo-master-2026' 
AND embedding <-> query_embedding < 0.5;

-- Conversation history is course-specific
SELECT * FROM ai_coach_conversation_history
WHERE learner_id = ? AND course_id = ?;
```

#### 1.4 Widget URL/Embedding
- **Course-Specific Widget**: Widget automatically adapts to current course
- **No Separate URLs Needed**: Single widget component, course-aware
- **Context Detection**: 
  ```javascript
  // Widget detects course from page
  const courseId = window.location.pathname.match(/\/courses\/([^\/]+)/)?.[1];
  // Or from course context if available
  const courseId = getCurrentCourseFromContext();
  ```

#### 1.5 Benefits
- ✅ **Accuracy**: Only relevant course content used
- ✅ **Performance**: Smaller search space per course
- ✅ **Maintenance**: Update one course without affecting others
- ✅ **User Experience**: Clear which course they're asking about

---

## 2. Content Update Mechanisms

### Decision: ✅ BOTH - Automatic Detection + Manual Script

**Rationale:**
- Automatic updates for convenience
- Manual script for reliability and control
- Best of both worlds

### Implementation:

#### 2.1 Automatic Updates (Preferred Method)

**How It Works:**
1. **Change Detection**:
   - Database triggers/webhooks detect course content changes
   - Hash-based comparison: Calculate SHA-256 hash of content
   - Compare with stored hash in `ai_coach_content_chunks`
   - Identify changed chunks

2. **Background Processing**:
   - Queue re-indexing job for changed chunks
   - Async processing (non-blocking)
   - Update embeddings for changed content only
   - Invalidate cache for affected course

3. **Notification**:
   - Notify admin/trainer when update completes
   - Log update status in `ai_coach_content_updates` table

**Implementation Details:**
```javascript
// Automatic detection via webhook/trigger
async onCourseContentUpdate(courseId, changeType) {
    // 1. Detect changed chunks
    const changedChunks = await detectContentChanges(courseId);
    
    // 2. Queue re-indexing
    await queueReindexing(courseId, changedChunks, 'automatic');
    
    // 3. Background processing
    await processReindexingQueue();
}

// Hash-based change detection
async detectContentChanges(courseId) {
    const currentContent = await getCourseContent(courseId);
    const indexedChunks = await getIndexedChunks(courseId);
    
    const changed = [];
    for (const chunk of currentContent) {
        const hash = await calculateHash(chunk.content);
        const indexed = indexedChunks.find(c => 
            c.chapter_id === chunk.chapter_id && 
            c.content_hash === hash
        );
        
        if (!indexed || indexed.content_hash !== hash) {
            changed.push(chunk);
        }
    }
    
    return changed;
}
```

**Database Support:**
```sql
-- Track content hash for change detection
ALTER TABLE ai_coach_content_chunks 
ADD COLUMN content_hash VARCHAR(64);

-- Index for fast hash lookups
CREATE INDEX idx_chunks_hash ON ai_coach_content_chunks(course_id, content_hash);
```

#### 2.2 Manual Updates (Fallback & Control)

**When to Use:**
- Initial course setup
- Bulk content updates
- Recovery from failed auto-updates
- Testing and validation
- When automatic detection fails

**Manual Script:**
```bash
# Full re-indexing (all chunks)
npm run index-course-content --course-id=seo-master-2026 --full

# Incremental (only changed chunks)
npm run index-course-content --course-id=seo-master-2026 --incremental

# Status check
npm run index-course-content --course-id=seo-master-2026 --status

# Force re-index (ignore hash check)
npm run index-course-content --course-id=seo-master-2026 --force
```

**Script Features:**
- Progress tracking
- Error handling and reporting
- Resume capability (if interrupted)
- Dry-run mode (preview changes)
- Logging and status updates

**Implementation:**
```javascript
// Manual re-indexing script
async function reindexCourseContent(courseId, options = {}) {
    const { full = false, incremental = true, force = false } = options;
    
    // Create update record
    const updateRecord = await createUpdateRecord(courseId, 'manual');
    
    try {
        if (full || force) {
            // Re-index all chunks
            await indexAllChunks(courseId);
        } else if (incremental) {
            // Only changed chunks
            const changed = await detectContentChanges(courseId);
            await reindexChunks(courseId, changed);
        }
        
        await markUpdateComplete(updateRecord.id);
    } catch (error) {
        await markUpdateFailed(updateRecord.id, error.message);
    }
}
```

#### 2.3 Update Status Tracking

**Database Table:**
```sql
CREATE TABLE ai_coach_content_updates (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL,
    update_type VARCHAR(20), -- 'full', 'incremental', 'manual'
    status VARCHAR(20), -- 'pending', 'processing', 'completed', 'failed'
    chunks_updated INTEGER,
    chunks_total INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    triggered_by VARCHAR(50), -- 'automatic', 'manual', 'admin'
    created_at TIMESTAMP
);
```

**Admin UI:**
- View update history per course
- Trigger manual updates
- Monitor automatic updates
- View update status and errors

#### 2.4 Recommendation

**For Production:**
- **Primary**: Automatic updates (set and forget)
- **Backup**: Manual script (for control and recovery)
- **Monitoring**: Track both automatic and manual updates

**For Development:**
- Use manual script for testing
- Test automatic detection
- Verify hash-based change detection

---

## 3. Trainer Personalization & Naming

### Decision: ✅ YES - Fully Customizable Per Trainer

**Rationale:**
- Personal connection with learners
- Brand consistency with trainer
- Enhanced learner experience
- Professional yet personal touch

### Implementation:

#### 3.1 Custom Naming

**Format**: `{Trainer Name}'s AI Coach`

**Examples:**
- "John's AI Coach"
- "Sarah's AI Assistant"
- "Dr. Smith's Learning Assistant"

**Configuration:**
- Trainer can set name in settings
- Admin can override if needed
- Per-course naming (trainer can have different names for different courses)
- Default: "AI Coach" if not personalized

**Database:**
```sql
CREATE TABLE ai_coach_trainer_personalization (
    id UUID PRIMARY KEY,
    trainer_id UUID NOT NULL,
    course_id UUID, -- NULL = global, or specific course
    coach_name VARCHAR(100) NOT NULL, -- "John's AI Coach"
    ...
);
```

#### 3.2 LinkedIn Profile Integration

**How It Works:**
1. **Profile Input**: Trainer provides LinkedIn profile URL
2. **Information Extraction**:
   - Extract: Name, bio, expertise, years of experience
   - Store in `trainer_info` JSONB field
   - Cache extraction (don't re-extract frequently)
3. **Usage in AI Coach**:
   - Include trainer info in system prompt
   - Reference trainer background when relevant
   - Maintain professional tone

**Extraction Process:**
```javascript
async extractTrainerInfo(linkedinUrl) {
    // Option 1: Manual input (trainer fills form)
    // Option 2: Web scraping (if allowed by LinkedIn)
    // Option 3: LinkedIn API (if available)
    // Option 4: Trainer manual entry (recommended for privacy)
    
    // For now: Trainer manually enters info, LinkedIn URL is for reference
    return {
        name: trainer.full_name,
        bio: trainer.bio, // From trainer profile in LMS
        expertise: trainer.expertise_areas, // From trainer profile
        years_experience: trainer.years_experience,
        linkedin_url: linkedinUrl
    };
}
```

**Privacy Considerations:**
- Trainer controls what information is shared
- LinkedIn URL stored but not automatically scraped
- Trainer manually provides information they want to share
- Respects privacy settings

#### 3.3 Information Sharing Levels

**Level 1: Name Only**
- Widget header: "John's AI Coach"
- Responses: "I'm John's AI Coach..."
- No additional trainer info shared

**Level 2: Name + Expertise**
- Widget header: "John's AI Coach"
- Responses: "Your trainer, John, specializes in SEO and content marketing..."
- Shares expertise areas only

**Level 3: Full Profile**
- Widget header: "John's AI Coach"
- Responses: "Your trainer, John, has 10+ years of SEO experience. He's worked with..."
- Shares full background and experience

**Configuration:**
```javascript
{
    trainer_id: "uuid",
    course_id: "seo-master-2026",
    coach_name: "John's AI Coach",
    share_level: "name_expertise", // 'name_only', 'name_expertise', 'full'
    personalization_enabled: true
}
```

#### 3.4 Response Personalization

**System Prompt Enhancement:**
```
You are {coach_name}, an AI assistant helping learners in {course_name}.

{trainer_info_section}

Rules:
1. Answer ONLY using the provided course content
2. Reference specific course locations (Day X → Chapter Y)
...
```

**Example Responses:**

**With Personalization (Level 2):**
> "Hi! I'm John's AI Coach. Your trainer, John, specializes in SEO and content marketing. Based on Day 1 → Chapter 2: On-Page SEO Fundamentals, on-page SEO refers to..."

**Without Personalization:**
> "Based on Day 1 → Chapter 2: On-Page SEO Fundamentals, on-page SEO refers to..."

#### 3.5 Trainer Settings UI

**Location**: Trainer Dashboard → AI Coach Settings

**Features:**
- Set coach name
- Provide LinkedIn URL (optional)
- Enter trainer information (name, bio, expertise, experience)
- Select share level
- Enable/disable personalization
- Per-course settings (if trainer teaches multiple courses)

**UI Mockup:**
```
┌─────────────────────────────────────┐
│  AI Coach Personalization           │
├─────────────────────────────────────┤
│  Coach Name:                        │
│  [John's AI Coach____________]      │
│                                     │
│  LinkedIn Profile (optional):       │
│  [https://linkedin.com/in/...]     │
│                                     │
│  Trainer Information:               │
│  Bio: [10+ years of SEO...]         │
│  Expertise: [SEO, Content Marketing]│
│  Years of Experience: [10]           │
│                                     │
│  Share Level:                       │
│  ( ) Name Only                      │
│  (•) Name + Expertise               │
│  ( ) Full Profile                   │
│                                     │
│  [Save Settings]                    │
└─────────────────────────────────────┘
```

#### 3.6 Per-Course Personalization

**Use Case**: Trainer teaches multiple courses, wants different personalization per course

**Example:**
- Course 1 (SEO): "John's SEO Coach"
- Course 2 (Content): "John's Content Coach"
- Course 3 (Analytics): "AI Coach" (no personalization)

**Implementation:**
- `course_id` in personalization table can be NULL (global) or specific course
- Widget checks course-specific personalization first, then global
- Allows flexibility for trainers

---

## Summary

### ✅ Course-Specific Instances
- **YES**: Each course has its own AI Coach instance
- Widget automatically detects current course
- All queries and content are course-scoped
- Isolated conversation history per course

### ✅ Content Updates
- **BOTH**: Automatic detection + Manual script
- **Automatic**: Hash-based change detection, background re-indexing
- **Manual**: CLI script for full control (`npm run index-course-content`)
- Update status tracking and monitoring

### ✅ Trainer Personalization
- **YES**: Fully customizable
- Custom naming: "{Trainer Name}'s AI Coach"
- LinkedIn profile integration (manual info entry)
- Three share levels: name only, name + expertise, full
- Per-course personalization supported

---

## Implementation Priority

1. **Phase 1**: Course-specific instances (required for MVP)
2. **Phase 1**: Manual re-indexing script (required for setup)
3. **Phase 2**: Trainer personalization (enhancement)
4. **Phase 2**: Automatic content updates (enhancement)

---

**Document Status**: ✅ Approved for Implementation

