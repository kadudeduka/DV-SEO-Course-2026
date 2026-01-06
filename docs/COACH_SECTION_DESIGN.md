# Coach Section - System Design & UX

## Overview

The Coach section provides a dedicated space for learners to interact with AI Coach and trainers, with full history and context.

## Navigation Structure

### Course-Level Navigation Tabs
Each course has 3 main sections accessible via tabs:

1. **Overview** - Course introduction, objectives, structure
2. **Content** - Chapters and Labs
3. **Coach** - AI Coach and Trainer interactions

### Coach Section Sub-Tabs

Within the Coach section, there are two views:

1. **AI Coach** (Learners)
   - Query history (all past questions)
   - Ask new questions
   - Search/filter queries
   - View detailed responses

2. **Trainer** (Trainers)
   - Escalated questions
   - Trainer responses
   - Response management

## UX Design Principles

### 1. Consistency
- Match existing course navigation patterns
- Use consistent tab styling and behavior
- Maintain visual hierarchy

### 2. Discoverability
- Clear navigation tabs at course level
- Link from AI Coach widget to full Coach page
- Recent queries visible in widget

### 3. Context Preservation
- Show full conversation history
- Maintain course context
- Easy navigation back to content

### 4. Efficiency
- Quick access to recent queries
- Search and filter capabilities
- Keyboard shortcuts where appropriate

## Component Architecture

### 1. Course Navigation Component
- Tab-based navigation (Overview | Content | Coach)
- Active tab highlighting
- Responsive design

### 2. Coach-AI Page Component
- Query list (chronological, searchable)
- Query detail view
- Ask question interface
- Recent queries sidebar

### 3. Coach-Trainer Page Component
- Escalation list (filtered by status)
- Escalation detail view
- Response interface
- Status management

### 4. AI Coach Widget Updates
- Show last 3-5 recent queries
- "View All" link to Coach page
- Quick question input

## Data Flow

### Query History
```
Learner → AI Coach Widget → Query → Store in DB → Display in Coach-AI Page
```

### Escalation Flow
```
Learner Query → Escalation Triggered → Trainer Notification → Coach-Trainer Page → Response
```

## Routes

- `/courses/:id/coach` - Coach section landing (shows AI Coach for learners, Trainer for trainers)
- `/courses/:id/coach/ai` - AI Coach page (query history + ask questions)
- `/courses/:id/coach/trainer` - Trainer page (escalations + responses)

## Implementation Plan

1. Create course navigation tabs component
2. Create Coach-AI page component
3. Create Coach-Trainer page component
4. Update AI Coach widget with recent queries
5. Add routes to router
6. Create query history service
7. Update start-learning component to show navigation tabs

