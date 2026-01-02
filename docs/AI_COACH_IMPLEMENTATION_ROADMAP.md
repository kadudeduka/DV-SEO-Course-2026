# AI Coach Feature - Implementation Roadmap

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Planning  
**Author:** System Design Team

---

## Overview

This document provides a step-by-step implementation roadmap for the AI Coach feature, referencing all design documents and requirements.

---

## Documentation Index

1. **AI_COACH_REQUIREMENTS.md** - Product requirements and user stories
2. **docs/AI_COACH_DESIGN.md** - Technical design and architecture
3. **docs/AI_COACH_UI_UX_DESIGN.md** - UI/UX specifications and component designs
4. **backend/migration-ai-coach-tables.sql** - Database migration script (to be created)

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

#### 1.1 Database Setup
**Tasks**:
- [ ] Review and execute `backend/migration-ai-coach-tables.sql` on Supabase
- [ ] Verify all tables created successfully
- [ ] Test RLS policies
- [ ] Verify indexes are created
- [ ] Set up pgvector extension (if not already enabled)
- [ ] Test vector similarity search

**Deliverables**:
- ✅ Database schema ready
- ✅ RLS policies active
- ✅ Vector search functional

**Files**:
- `backend/migration-ai-coach-tables.sql`

---

#### 1.2 Core Services
**Tasks**:
- [ ] Create `lms/services/ai-coach-service.js`
  - Implement main orchestration logic
  - Query processing flow
  - Response generation
  - Conversation history
- [ ] Create `lms/services/query-processor-service.js`
  - Query validation
  - Intent classification
  - Query preprocessing
- [ ] Create `lms/services/context-builder-service.js`
  - Dynamic context construction
  - Progress-aware filtering
  - Context prioritization
- [ ] Create `lms/services/retrieval-service.js`
  - Vector similarity search
  - Chunk retrieval
  - Hybrid search (semantic + keyword)
- [ ] Create `lms/services/llm-service.js`
  - OpenAI API integration
  - Answer generation
  - Confidence estimation
  - Error handling
- [ ] Create `lms/services/embedding-service.js`
  - Embedding generation
  - Batch processing
  - Caching

**Deliverables**:
- ✅ All core services functional
- ✅ LLM integration working
- ✅ Vector search operational

**Files**:
- `lms/services/ai-coach-service.js`
- `lms/services/query-processor-service.js`
- `lms/services/context-builder-service.js`
- `lms/services/retrieval-service.js`
- `lms/services/llm-service.js`
- `lms/services/embedding-service.js`

---

#### 1.3 Content Indexing
**Tasks**:
- [ ] Create content indexing script
  - Extract course content (markdown)
  - Chunk content by semantic boundaries
  - Generate embeddings
  - Store in database (course-specific)
  - Calculate content hash for change detection
- [ ] Implement automatic update detection
  - Webhook/trigger for content changes
  - Hash-based change detection
  - Background re-indexing queue
- [ ] Create manual re-indexing script
  - Full re-indexing option
  - Incremental re-indexing (only changed)
  - Progress tracking
  - Status reporting
- [ ] Test indexing for one course
- [ ] Verify chunk quality
- [ ] Test automatic updates
- [ ] Test manual re-indexing
- [ ] Optimize chunk size and overlap

**Deliverables**:
- ✅ Content indexing script functional
- ✅ Automatic update detection working
- ✅ Manual re-indexing script available
- ✅ At least one course indexed
- ✅ Embeddings generated and stored (course-specific)

**Files**:
- `lms/scripts/index-course-content.js`
- `lms/services/content-update-service.js`

---

#### 1.4 Shared Components
**Tasks**:
- [ ] Create `lms/components/ai-coach/shared/confidence-indicator.js`
- [ ] Create `lms/components/ai-coach/shared/reference-link.js`
- [ ] Create `lms/components/ai-coach/shared/loading-state.js`
- [ ] Create `lms/components/ai-coach/shared/message-bubble.js`

**Deliverables**:
- ✅ All shared components created
- ✅ Components tested in isolation

**Files**:
- `lms/components/ai-coach/shared/confidence-indicator.js`
- `lms/components/ai-coach/shared/reference-link.js`
- `lms/components/ai-coach/shared/loading-state.js`
- `lms/components/ai-coach/shared/message-bubble.js`

---

#### 1.5 Routing Setup
**Tasks**:
- [ ] Add AI Coach routes to `index.html`
  - `/ai-coach` (widget - embedded)
  - `/trainer/ai-escalations`
  - `/trainer/ai-escalations/:id`
  - `/admin/ai-coach/analytics`
- [ ] Update header navigation (if needed)
- [ ] Add route guards for AI Coach access

**Deliverables**:
- ✅ All routes configured
- ✅ Access control working

**Files**:
- `index.html`
- `lms/guards/route-guard.js`

---

#### 1.6 Styling
**Tasks**:
- [ ] Create `lms/styles/ai-coach.css`
  - Import design system variables
  - Add widget styles
  - Add message styles
  - Add responsive breakpoints
- [ ] Link CSS in `index.html`

**Deliverables**:
- ✅ AI Coach stylesheet created
- ✅ Styles match design specifications

**Files**:
- `lms/styles/ai-coach.css`
- `index.html`

---

### Phase 2: Learner AI Coach Widget (Week 3-4)

#### 2.1 Widget Component
**Tasks**:
- [ ] Create `lms/components/ai-coach/learner/ai-coach-widget.js`
  - Implement widget container
  - **Course detection**: Auto-detect current course from page context
  - **Course-specific state**: Isolate state per course
  - Header with minimize/close
  - **Personalized header**: Show trainer name if enabled
  - **Course indicator**: Show current course name
  - Messages area (scrollable)
  - Input area
  - State management (expanded/minimized, course-specific)
- [ ] Implement widget positioning
- [ ] Add course context detection
- [ ] Add animations (open/close, minimize)
- [ ] Test on desktop and mobile
- [ ] Test course switching (widget updates)

**Deliverables**:
- ✅ Widget component functional
- ✅ Course-aware (detects and isolates by course)
- ✅ Personalized header working
- ✅ Responsive design working
- ✅ Animations smooth

**Files**:
- `lms/components/ai-coach/learner/ai-coach-widget.js`

---

#### 2.2 Query Input Component
**Tasks**:
- [ ] Create `lms/components/ai-coach/learner/query-input.js`
  - Text input field
  - Character counter
  - Send button
  - Validation
- [ ] Implement input handling
- [ ] Add keyboard shortcuts (Enter to send)
- [ ] Add input sanitization

**Deliverables**:
- ✅ Input component functional
- ✅ Validation working
- ✅ Keyboard shortcuts working

**Files**:
- `lms/components/ai-coach/learner/query-input.js`

---

#### 2.3 Response Display Component
**Tasks**:
- [ ] Create `lms/components/ai-coach/learner/response-display.js`
  - Display AI answers (concise format)
  - Show references
  - Display confidence (if low)
  - Show next steps
  - **Lab guidance indicator**: Show when providing lab guidance
- [ ] Implement message rendering
- [ ] Add reference link functionality
- [ ] Add feedback buttons
- [ ] **Validate responses**: Ensure no direct lab answers
- [ ] **Conciseness check**: Verify response length (50-150 words)

**Deliverables**:
- ✅ Response display functional
- ✅ References clickable
- ✅ Feedback collection working
- ✅ Lab guidance properly formatted
- ✅ Responses concise but complete

**Files**:
- `lms/components/ai-coach/learner/response-display.js`

---

#### 2.4 Integration & Testing
**Tasks**:
- [ ] Integrate widget with AI Coach service
- [ ] Test query → answer flow
- [ ] Test error handling
- [ ] Test loading states
- [ ] Test on multiple courses
- [ ] Test with different progress states

**Deliverables**:
- ✅ End-to-end flow working
- ✅ Error handling robust
- ✅ Tested with real data

---

### Phase 3: Escalation & Feedback (Week 5-6)

#### 3.1 Escalation Service
**Tasks**:
- [ ] Create `lms/services/escalation-service.js`
  - Create escalation records
  - Notify trainers
  - Track escalation status
  - Provide escalation analytics
- [ ] Integrate with notification service
- [ ] Test escalation workflow

**Deliverables**:
- ✅ Escalation service functional
- ✅ Notifications working
- ✅ Status tracking working

**Files**:
- `lms/services/escalation-service.js`

---

#### 3.2 Trainer Escalation View
**Tasks**:
- [ ] Create `lms/components/ai-coach/trainer/escalation-list.js`
  - List of escalations
  - Filtering and sorting
  - Status indicators
- [ ] Create `lms/components/ai-coach/trainer/escalation-detail.js`
  - Escalation details
  - AI context display
  - Learner progress snapshot
  - Response form
- [ ] Create `lms/components/ai-coach/trainer/escalation-response.js`
  - Response input
  - "Use as reference" option
  - Submit response

**Deliverables**:
- ✅ Trainer escalation UI functional
- ✅ Response workflow working
- ✅ Notifications integrated

**Files**:
- `lms/components/ai-coach/trainer/escalation-list.js`
- `lms/components/ai-coach/trainer/escalation-detail.js`
- `lms/components/ai-coach/trainer/escalation-response.js`

---

#### 3.3 Feedback Service
**Tasks**:
- [ ] Create `lms/services/feedback-service.js`
  - Store feedback
  - Update confidence weights
  - Track satisfaction metrics
- [ ] Integrate feedback into response display
- [ ] Test feedback collection

**Deliverables**:
- ✅ Feedback service functional
- ✅ Feedback collection working
- ✅ Analytics tracking

**Files**:
- `lms/services/feedback-service.js`

---

#### 3.4 Escalation Integration
**Tasks**:
- [ ] Integrate escalation into query flow
- [ ] Test low-confidence escalation
- [ ] Test trainer response delivery
- [ ] Test escalation status updates

**Deliverables**:
- ✅ Escalation flow complete
- ✅ Trainer responses visible to learners
- ✅ Status tracking accurate

---

### Phase 4: Optimization & Analytics (Week 7-8)

#### 4.1 Caching Implementation
**Tasks**:
- [ ] Implement query cache
  - Cache identical queries
  - TTL management
  - Cache invalidation
- [ ] Implement embedding cache
- [ ] Implement context cache
- [ ] Monitor cache hit rates

**Deliverables**:
- ✅ Caching functional
- ✅ Cache hit rate > 30%
- ✅ Performance improved

---

#### 4.2 Performance Optimization
**Tasks**:
- [ ] Optimize database queries
- [ ] Optimize vector search
- [ ] Implement async processing
- [ ] Add connection pooling
- [ ] Load testing

**Deliverables**:
- ✅ Response time < 3 seconds (P95)
- ✅ Supports 100 concurrent queries
- ✅ No performance degradation

---

#### 4.3 Analytics Service
**Tasks**:
- [ ] Create `lms/services/ai-coach-analytics-service.js`
  - Usage metrics
  - Cost tracking
  - Quality metrics
  - Escalation analytics
- [ ] Implement analytics collection
- [ ] Create analytics dashboard

**Deliverables**:
- ✅ Analytics service functional
- ✅ Metrics tracked
- ✅ Dashboard displaying data

**Files**:
- `lms/services/ai-coach-analytics-service.js`

---

#### 4.4 Admin Analytics Dashboard
**Tasks**:
- [ ] Create `lms/components/ai-coach/admin/ai-coach-analytics.js`
  - Usage overview
  - Cost dashboard
  - Query analytics
  - Quality metrics
- [ ] Implement charts and visualizations
- [ ] Add export functionality

**Deliverables**:
- ✅ Admin dashboard functional
- ✅ Analytics displayed correctly
- ✅ Export working

**Files**:
- `lms/components/ai-coach/admin/ai-coach-analytics.js`

---

### Phase 5: Advanced Features (Week 9-10, Optional)

#### 5.1 Conversation History
**Tasks**:
- [ ] Create `lms/components/ai-coach/learner/conversation-history.js`
  - History list
  - Search history
  - Continue conversation
- [ ] Implement history UI
- [ ] Test history functionality

**Deliverables**:
- ✅ History component functional
- ✅ History accessible to learners
- ✅ Continue conversation working

**Files**:
- `lms/components/ai-coach/learner/conversation-history.js`

---

#### 5.2 Progress-Aware Nudges
**Tasks**:
- [ ] Implement smart guidance
- [ ] Progress-aware suggestions
- [ ] Lab hints (not answers)
- [ ] Contextual recommendations

**Deliverables**:
- ✅ Smart guidance functional
- ✅ Nudges relevant and helpful

---

#### 5.3 Voice Input (Optional)
**Tasks**:
- [ ] Implement voice input
- [ ] Speech-to-text conversion
- [ ] Voice UI controls
- [ ] Test on mobile devices

**Deliverables**:
- ✅ Voice input functional
- ✅ Works on mobile browsers

---

## Dependencies

### External Libraries
- [ ] OpenAI SDK
  ```bash
  npm install openai
  ```
- [ ] Supabase client (existing)
- [ ] pgvector extension (Supabase)

### Internal Dependencies
- ✅ `supabase-client.js` - Database access
- ✅ `auth-service.js` - Authentication
- ✅ `course-service.js` - Course data
- ✅ `user-service.js` - User data
- ✅ `progress-service.js` - Progress tracking
- ✅ `notification-service.js` - Notifications

---

## Testing Checklist

### Functional Testing
- [ ] Learner can ask course-related questions
- [ ] AI provides accurate answers with references
- [ ] Out-of-scope questions are rejected
- [ ] Low-confidence queries are escalated
- [ ] Trainers can respond to escalations
- [ ] Feedback is collected and stored
- [ ] Conversation history works
- [ ] Widget works on mobile and desktop

### Performance Testing
- [ ] Response time < 3 seconds (P95)
- [ ] Supports 100 concurrent queries
- [ ] Cache hit rate > 30%
- [ ] No memory leaks
- [ ] Database queries optimized

### Security Testing
- [ ] Learners cannot access other learners' queries
- [ ] Trainers can only see assigned learners
- [ ] RLS policies enforced
- [ ] Input validation working
- [ ] API keys secure

### Accessibility Testing
- [ ] Screen reader compatible
- [ ] Keyboard navigation works
- [ ] Color contrast meets standards
- [ ] Focus indicators visible

---

## Rollout Plan

### Phase 1: Internal Testing (Week 11)
- Deploy to staging environment
- Internal team testing
- Bug fixes
- Performance tuning

### Phase 2: Beta Testing (Week 12)
- Select learners for beta
- Gather feedback
- Iterate on feedback
- Monitor costs and performance

### Phase 3: Production Release (Week 13)
- Deploy to production
- Monitor performance
- Gather user feedback
- Address issues
- Optimize costs

---

## Success Metrics

### Performance Metrics
- ✅ Response time < 3 seconds (95th percentile)
- ✅ System supports 100+ concurrent queries
- ✅ Cache hit rate > 30%
- ✅ No performance degradation

### Quality Metrics
- ✅ > 90% of answers rated as "helpful"
- ✅ < 20% escalation rate
- ✅ > 80% learner trust
- ✅ Zero hallucination incidents

### Cost Metrics
- ✅ ≤ $0.05 per active learner per month
- ✅ Token usage optimized
- ✅ Cost predictable and stable

### Adoption Metrics
- ✅ > 60% of active learners use AI Coach
- ✅ Average 5+ queries per active learner
- ✅ High satisfaction scores

---

## Risk Mitigation

### Technical Risks
1. **High Token Costs**
   - Mitigation: Aggressive caching, model selection, context optimization
   - Monitoring: Daily cost tracking, alerts

2. **Hallucination**
   - Mitigation: Strict context-only answers, confidence thresholds, escalation
   - Monitoring: Feedback tracking, escalation analysis

3. **Performance Issues**
   - Mitigation: Caching, async processing, horizontal scaling
   - Monitoring: Response time tracking, load testing

### Business Risks
1. **Low Adoption**
   - Mitigation: Clear value proposition, easy UI, marketing
   - Monitoring: Usage analytics, user feedback

2. **Trainer Overload**
   - Mitigation: High confidence threshold, quality answers, clear escalation process
   - Monitoring: Escalation rate, trainer feedback

3. **Cost Overruns**
   - Mitigation: Strict token limits, cost alerts, usage monitoring
   - Monitoring: Daily cost tracking, budget alerts

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-29 | System Design Team | Initial implementation roadmap |

---

**Document Status**: ✅ Ready for Implementation

