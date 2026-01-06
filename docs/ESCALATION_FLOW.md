# Escalation Flow Documentation

## Overview

The escalation flow ensures that every blocked answer, low confidence response, or invariant violation is escalated to trainers for review. This provides transparency, quality assurance, and enables trainers to help learners when the AI Coach cannot provide adequate answers.

## Escalation Triggers

Escalations are created in the following scenarios:

### 1. Blocked Answers (`blocked`)
- **Trigger**: Answer generation is blocked by governance rules
- **Confidence**: 0.0 (no answer generated)
- **When**: 
  - Lab Safety violation (strict lab search finds no content)
  - Topic Integrity violation (no topic-specific chunks found)
  - Reference Integrity violation (references don't match)
  - Course Scope violation (generic content not traceable to course)
- **Action**: Answer is blocked, escalation is created immediately

### 2. Low Confidence (`low_confidence`)
- **Trigger**: Answer confidence < 0.65 (default threshold)
- **Confidence**: Actual confidence score (0.0 - 0.65)
- **When**: AI generates answer but confidence is below threshold
- **Action**: Answer is returned to learner, escalation is created for trainer review

### 3. Invariant Violations (`invariant_violation`)
- **Trigger**: Governance detects invariant violations
- **Confidence**: Varies (0.0 - 1.0)
- **When**: 
  - Procedural contract violation
  - Topic integrity issues
  - Reference integrity issues
  - Other governance violations
- **Action**: Answer may still be generated, but escalation is created

### 4. Reference Validation Failed (`reference_validation_failed`)
- **Trigger**: High confidence (>0.7) but reference validation fails
- **Confidence**: Downgraded to max 0.5
- **When**: Answer references don't match question context
- **Action**: Answer is returned, confidence is downgraded, escalation is forced

### 5. Strict Lab Missing (`strict_lab_missing`)
- **Trigger**: Strict lab search finds no content
- **Confidence**: 0.0 (no answer possible)
- **When**: Learner asks about specific Day X + Lab Y but no content exists
- **Action**: Answer is blocked, escalation is created

## Escalation Data

Each escalation stores:

### Required Fields
- `query_id` - Query ID (can be null if answer was blocked before query storage)
- `learner_id` - Learner who asked the question
- `trainer_id` - Assigned trainer for the course
- `original_question` - The learner's question
- `ai_confidence` - AI confidence score (0.0 - 1.0)
- `escalation_reason` - Reason for escalation (see triggers above)
- `status` - Escalation status: 'pending', 'responded', 'resolved'

### Detailed Information
- `violated_invariants` - Array of violated invariant objects:
  ```json
  [{
    "type": "invariant_lab_safety",
    "severity": "critical",
    "message": "No chunks found for Day 2, Lab 1",
    "invariant": "Lab Safety"
  }]
  ```

- `chunks_used` - Full chunk details (not just IDs):
  ```json
  [{
    "id": "chunk-uuid",
    "day": 2,
    "chapter_id": "day2-ch1",
    "chapter_title": "Chapter Title",
    "content_type": "chapter",
    "content_preview": "First 500-1000 chars...",
    "similarity": 0.85,
    "coverage_level": "comprehensive",
    "primary_topic": "AEO"
  }]
  ```

- `governance_details` - Full governance check results:
  ```json
  {
    "violations": [...],
    "warnings": [...],
    "recommendations": [...],
    "actionDetails": {...}
  }
  ```

- `learner_progress` - Snapshot of learner progress:
  ```json
  {
    "completedChapters": [...],
    "inProgressChapters": [...],
    "currentDay": 5,
    "currentChapter": "day5-ch2"
  }
  ```

- `reference_validation_failed` - Boolean flag
- `confidence_downgraded` - Boolean flag

## Trainer Workflow

### View Escalations

Trainers can view escalations assigned to them:

```javascript
const escalations = await escalationService.getEscalationsForTrainer(trainerId, {
    status: 'pending', // Filter by status
    courseId: 'seo-master-2026', // Filter by course
    limit: 50
});
```

### View Escalation Details

Get full escalation details including chunks and violations:

```javascript
const escalation = await escalationService.getEscalationById(escalationId);
```

### Respond to Escalation

Trainers can respond to escalations:

```javascript
await escalationService.respondToEscalation(
    escalationId,
    trainerId,
    "Here's a detailed explanation...",
    false // useAsReference
);
```

This:
- Updates escalation status to 'responded'
- Stores trainer response
- Notifies the learner
- Optionally stores response as reference for future AI answers

### Resolve Escalation

Mark escalation as resolved:

```javascript
await escalationService.resolveEscalation(escalationId, trainerId);
```

This:
- Updates escalation status to 'resolved'
- Sets `resolved_at` timestamp
- Closes the escalation

## Database Schema

### Escalation Table

```sql
CREATE TABLE ai_coach_escalations (
    id UUID PRIMARY KEY,
    query_id UUID REFERENCES ai_coach_queries(id),
    learner_id UUID REFERENCES users(id),
    trainer_id UUID REFERENCES users(id),
    original_question TEXT NOT NULL,
    ai_confidence DECIMAL(3,2) NOT NULL,
    escalation_reason VARCHAR(50), -- 'blocked', 'low_confidence', etc.
    violated_invariants JSONB DEFAULT '[]',
    chunks_used JSONB,
    governance_details JSONB,
    reference_validation_failed BOOLEAN DEFAULT false,
    confidence_downgraded BOOLEAN DEFAULT false,
    learner_progress JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    trainer_response TEXT,
    trainer_responded_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Escalation Summary View

A summary view provides quick access to escalation statistics:

```sql
SELECT * FROM ai_coach_escalations_summary
WHERE trainer_id = 'trainer-uuid'
ORDER BY created_at DESC;
```

This view includes:
- Escalation details
- Learner and trainer names
- Violation counts
- Critical violation counts

## Notification Flow

### Trainer Notification

When an escalation is created, trainers receive a notification:
- **Type**: `ai_coach_escalation`
- **Title**: Includes escalation reason
- **Message**: Learner name and question preview
- **Link**: Direct link to escalation details page

### Learner Notification

When a trainer responds:
- **Type**: `ai_coach_trainer_response`
- **Title**: "Trainer Response"
- **Message**: "Your trainer has responded to your question"
- **Link**: Link to view response

## Best Practices

### For Trainers

1. **Review escalations regularly** - Check pending escalations daily
2. **Prioritize critical violations** - Focus on escalations with critical severity violations
3. **Provide detailed responses** - Help learners understand why the AI couldn't answer
4. **Use as reference** - Mark helpful responses as references for future AI answers
5. **Resolve promptly** - Mark resolved after responding to keep queue clean

### For System Administrators

1. **Monitor escalation volume** - High volume may indicate content gaps
2. **Review violation patterns** - Common violations suggest systemic issues
3. **Track resolution time** - Ensure trainers respond in timely manner
4. **Analyze confidence scores** - Low confidence patterns may indicate model issues

## Escalation Statistics

Get escalation statistics for a trainer:

```javascript
const stats = await escalationService.getEscalationStats(trainerId);
// Returns: { total, pending, responded, resolved }
```

## Migration

Run the migration to add new escalation fields:

```sql
\i backend/migration-escalation-enhancements.sql
```

This adds:
- `escalation_reason` column
- `violated_invariants` column
- `chunks_used` column
- `governance_details` column
- `reference_validation_failed` column
- `confidence_downgraded` column
- Indexes for performance
- Summary view for trainers

## Troubleshooting

### Escalations Not Created

- Check if trainer is assigned to course
- Verify RLS policies allow escalation creation
- Check console logs for errors
- Ensure query is stored before escalation (if answer was generated)

### Missing Chunk Details

- Verify `selectedChunks` are passed to escalation service
- Check if chunks are properly formatted
- Ensure chunk content is accessible (not filtered by RLS)

### Trainer Not Notified

- Check notification service is working
- Verify trainer has notification preferences enabled
- Check notification table for failed notifications

## Future Enhancements

- [ ] Bulk escalation resolution
- [ ] Escalation templates for common issues
- [ ] Auto-resolution for certain violation types
- [ ] Escalation analytics dashboard
- [ ] Integration with trainer calendar for scheduling responses

