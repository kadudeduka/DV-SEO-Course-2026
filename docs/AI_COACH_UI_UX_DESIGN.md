# AI Coach Feature - UI/UX Design Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Design  
**Author:** System Design Team

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Visual Design System](#visual-design-system)
3. [Component Specifications](#component-specifications)
4. [Widget Design](#widget-design)
5. [User Flows](#user-flows)
6. [Responsive Design](#responsive-design)
7. [Accessibility](#accessibility)
8. [Interactions and Animations](#interactions-and-animations)
9. [States and Feedback](#states-and-feedback)

---

## Design Principles

### 1. Conversational & Natural
- Chat-like interface that feels familiar
- Natural language interactions
- Clear, friendly tone
- Contextual responses

### 2. Trustworthy & Transparent
- Clear indication of AI-generated content
- Show confidence levels when relevant
- Explicit references to course content
- Transparent escalation process

### 3. Context-Aware
- Widget adapts to current page context
- Shows relevant suggestions
- References current chapter/course
- Progress-aware guidance

### 4. Non-Intrusive
- Floating widget that doesn't block content
- Collapsible/minimizable
- Respects user's focus
- Optional, not mandatory

### 5. Helpful & Actionable
- Clear, concise answers
- Actionable next steps
- Direct links to course content
- Escalation when needed

---

## Visual Design System

### Color Palette

#### Primary Colors
```css
--color-ai-coach-primary: #6366f1;      /* Indigo - Primary actions */
--color-ai-coach-secondary: #8b5cf6;     /* Purple - Secondary actions */
--color-ai-coach-success: #10b981;     /* Green - Positive feedback */
--color-ai-coach-warning: #f59e0b;       /* Amber - Low confidence */
--color-ai-coach-error: #ef4444;         /* Red - Errors */
--color-ai-coach-info: #3b82f6;          /* Blue - Informational */
```

#### Status Colors
```css
--color-ai-coach-answered: #10b981;      /* Successfully answered */
--color-ai-coach-escalated: #f59e0b;     /* Escalated to trainer */
--color-ai-coach-pending: #6b7280;       /* Pending response */
--color-ai-coach-trainer: #8b5cf6;       /* Trainer response */
```

#### Background Colors
```css
--color-ai-coach-bg: #ffffff;            /* Widget background */
--color-ai-coach-bg-hover: #f9fafb;     /* Hover state */
--color-ai-coach-bg-input: #f3f4f6;     /* Input background */
--color-ai-coach-bg-message: #f9fafb;    /* Message background */
--color-ai-coach-bg-ai: #eef2ff;         /* AI message background */
--color-ai-coach-bg-trainer: #f3e8ff;    /* Trainer message background */
```

### Typography

```css
--font-ai-coach-title: 18px / 24px 'Inter', sans-serif;      /* Widget title */
--font-ai-coach-body: 14px / 20px 'Inter', sans-serif;       /* Message text */
--font-ai-coach-caption: 12px / 16px 'Inter', sans-serif;     /* Captions, timestamps */
--font-ai-coach-input: 14px / 20px 'Inter', sans-serif;      /* Input text */
--font-ai-coach-reference: 13px / 18px 'Inter', sans-serif;  /* Reference links */
```

### Spacing

```css
--spacing-ai-coach-xs: 4px;
--spacing-ai-coach-sm: 8px;
--spacing-ai-coach-md: 12px;
--spacing-ai-coach-lg: 16px;
--spacing-ai-coach-xl: 24px;
```

### Shadows and Elevation

```css
--shadow-ai-coach-widget: 0 4px 12px rgba(0, 0, 0, 0.15);
--shadow-ai-coach-hover: 0 6px 16px rgba(0, 0, 0, 0.2);
--shadow-ai-coach-message: 0 1px 2px rgba(0, 0, 0, 0.1);
```

### Border Radius

```css
--radius-ai-coach-widget: 12px;
--radius-ai-coach-message: 8px;
--radius-ai-coach-input: 8px;
--radius-ai-coach-button: 6px;
```

---

## Component Specifications

### 1. AI Coach Widget

**Purpose**: Main container for AI Coach interface

**Visual Design**:
```
┌─────────────────────────────────────┐
│  John's AI Coach            [−] [×]  │  ← Header (personalized name)
│  SEO Master Course 2026              │  ← Course indicator
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │  AI: On-page SEO refers...  │   │  ← AI Message
│  │  📖 Day 1 → Chapter 2       │   │  ← Reference
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  You: What is on-page SEO?  │   │  ← User Message
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Ask a question...            │   │  ← Input Field
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Specifications**:
- **Dimensions**: 
  - Desktop: 400px × 600px (max)
  - Mobile: Full screen overlay
- **Position**: 
  - Desktop: Fixed bottom-right (20px from edges)
  - Mobile: Full screen overlay
- **Z-index**: 1000 (above content, below modals)
- **Background**: #ffffff
- **Border**: 1px solid #e5e7eb
- **Border Radius**: 12px
- **Shadow**: 0 4px 12px rgba(0, 0, 0, 0.15)

**States**:
- **Expanded**: Full widget visible
- **Minimized**: Icon only (bottom-right)
- **Loading**: Show spinner in message area
- **Error**: Show error message with retry

**Code Example**:
```html
<div class="ai-coach-widget" id="ai-coach-widget">
    <div class="ai-coach-header">
        <h3>AI Coach</h3>
        <div class="ai-coach-actions">
            <button class="btn-minimize" aria-label="Minimize">−</button>
            <button class="btn-close" aria-label="Close">×</button>
        </div>
    </div>
    <div class="ai-coach-messages" id="ai-coach-messages">
        <!-- Messages will be inserted here -->
    </div>
    <div class="ai-coach-input-container">
        <input type="text" 
               class="ai-coach-input" 
               placeholder="Ask a question about this course..."
               id="ai-coach-input">
        <button class="btn-send" aria-label="Send">Send</button>
    </div>
</div>
```

### 2. Message Bubble

**Purpose**: Display individual messages (user or AI)

**Visual Design**:
```
AI Message:
┌─────────────────────────────────────┐
│  On-page SEO refers to optimizing   │
│  elements on your website...         │
│                                     │
│  📖 Day 1 → Chapter 2: On-Page SEO  │  ← Reference
│                                     │
│  [👍 Helpful] [👎 Not Helpful]     │  ← Feedback
└─────────────────────────────────────┘

User Message:
                    ┌─────────────────┐
                    │ What is on-page │
                    │ SEO?            │
                    └─────────────────┘
```

**Specifications**:
- **AI Message**:
  - Background: #eef2ff (light indigo)
  - Alignment: Left
  - Max width: 85%
  - Padding: 12px
  - Border radius: 8px (rounded on right)
  
- **User Message**:
  - Background: #6366f1 (primary)
  - Text color: #ffffff
  - Alignment: Right
  - Max width: 75%
  - Padding: 12px
  - Border radius: 8px (rounded on left)

- **Trainer Message**:
  - Background: #f3e8ff (light purple)
  - Border: 2px solid #8b5cf6
  - Alignment: Left
  - Badge: "Trainer Response"

**Code Example**:
```html
<div class="ai-coach-message ai-coach-message-ai">
    <div class="message-content">
        <p>On-page SEO refers to optimizing elements on your website...</p>
    </div>
    <div class="message-references">
        <a href="#/courses/seo-master-2026/content/day1-ch2" class="reference-link">
            📖 Day 1 → Chapter 2: On-Page SEO Fundamentals
        </a>
    </div>
    <div class="message-feedback">
        <button class="btn-feedback helpful" aria-label="Helpful">👍</button>
        <button class="btn-feedback not-helpful" aria-label="Not Helpful">👎</button>
    </div>
    <div class="message-timestamp">2 minutes ago</div>
</div>
```

### 3. Reference Link

**Purpose**: Link to specific course content referenced in answer

**Visual Design**:
```
📖 Day 1 → Chapter 2: On-Page SEO Fundamentals
```

**Specifications**:
- **Icon**: 📖 (book emoji or SVG icon)
- **Text**: "Day X → Chapter Y: [Title]"
- **Style**: 
  - Color: #6366f1 (primary)
  - Font size: 13px
  - Underline on hover
  - Cursor: pointer
- **Hover**: 
  - Color: #4f46e5 (darker)
  - Underline

**Code Example**:
```html
<a href="#/courses/seo-master-2026/content/day1-ch2" 
   class="reference-link">
    <span class="reference-icon">📖</span>
    <span class="reference-text">Day 1 → Chapter 2: On-Page SEO Fundamentals</span>
</a>
```

### 4. Confidence Indicator

**Purpose**: Show AI's confidence in answer (subtle, optional)

**Visual Design**:
```
Answer: ...
[●●●○○] 60% confident
```

**Specifications**:
- **Display**: Only for low-medium confidence (0.5-0.7)
- **Style**: 
  - Dots: Filled (high) / Empty (low)
  - Text: "X% confident"
  - Color: Amber for medium, gray for low
- **Position**: Below answer, subtle

**Code Example**:
```html
<div class="confidence-indicator confidence-medium">
    <span class="confidence-dots">
        <span class="dot filled"></span>
        <span class="dot filled"></span>
        <span class="dot filled"></span>
        <span class="dot"></span>
        <span class="dot"></span>
    </span>
    <span class="confidence-text">60% confident</span>
</div>
```

### 5. Escalation Notice

**Purpose**: Inform user that query was escalated to trainer

**Visual Design**:
```
┌─────────────────────────────────────┐
│  ⚠️ I'm not fully confident about    │
│  this answer. I've forwarded your   │
│  question to your trainer.          │
│                                     │
│  You'll receive a response soon.    │
└─────────────────────────────────────┘
```

**Specifications**:
- **Background**: #fef3c7 (light amber)
- **Border**: 1px solid #f59e0b
- **Icon**: ⚠️
- **Text**: Clear explanation
- **Style**: Info box format

### 6. Input Field

**Purpose**: Text input for user queries

**Visual Design**:
```
┌─────────────────────────────────────┐
│ Ask a question about this course... │  ← Placeholder
└─────────────────────────────────────┘
```

**Specifications**:
- **Height**: 44px (touch-friendly)
- **Padding**: 12px 16px
- **Border**: 1px solid #e5e7eb
- **Border Radius**: 8px
- **Background**: #f9fafb
- **Font**: 14px Inter
- **Focus**: 
  - Border: 2px solid #6366f1
  - Background: #ffffff
- **Character Limit**: 500 (show counter)

**Code Example**:
```html
<div class="ai-coach-input-container">
    <input type="text" 
           class="ai-coach-input" 
           placeholder="Ask a question about this course..."
           maxlength="500"
           id="ai-coach-input">
    <span class="char-counter">0/500</span>
    <button class="btn-send" aria-label="Send">
        <svg>...</svg>
    </button>
</div>
```

### 7. Loading State

**Purpose**: Show AI is processing query

**Visual Design**:
```
┌─────────────────────────────────────┐
│  Thinking...                        │
│  ●●●                                │  ← Animated dots
└─────────────────────────────────────┘
```

**Specifications**:
- **Message**: "Thinking..."
- **Animation**: Three dots pulsing
- **Duration**: Show until response received
- **Style**: 
  - Background: #eef2ff
  - Text: Gray
  - Dots: Primary color

**Code Example**:
```html
<div class="ai-coach-message ai-coach-message-loading">
    <div class="loading-content">
        <span>Thinking</span>
        <span class="loading-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </span>
    </div>
</div>
```

### 8. Feedback Buttons

**Purpose**: Collect user feedback on AI responses

**Visual Design**:
```
[👍 Helpful] [👎 Not Helpful]
```

**Specifications**:
- **Size**: 32px × 32px (touch-friendly)
- **Spacing**: 8px between buttons
- **Style**: 
  - Border: 1px solid #e5e7eb
  - Background: #ffffff
  - Border radius: 6px
  - Padding: 4px
- **Hover**: 
  - Background: #f9fafb
  - Border: 1px solid #6366f1
- **Active**: 
  - Background: #eef2ff
  - Border: 2px solid #6366f1

---

## Widget Design

### 1. Desktop Widget

**Layout**:
```
┌─────────────────────────────────────┐
│  AI Coach                    [−] [×] │  ← Header (24px height)
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │  AI: Answer text...          │   │  ← Messages Area
│  │  📖 Reference                │   │     (flexible height)
│  │  [👍] [👎]                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  You: Question text...       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Ask a question...      [→]  │   │  ← Input Area
│  └─────────────────────────────┘   │     (fixed 60px height)
│                                     │
└─────────────────────────────────────┘
```

**Dimensions**:
- **Width**: 400px (fixed)
- **Height**: 600px (max), 400px (min)
- **Position**: Fixed bottom-right (20px from edges)

### 2. Mobile Widget

**Layout**: Full screen overlay

```
┌─────────────────────────────────────┐
│  AI Coach                    [×]     │  ← Header
├─────────────────────────────────────┤
│                                     │
│  [Messages Area - Scrollable]       │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  [Input Area - Fixed]               │
└─────────────────────────────────────┘
```

**Dimensions**:
- **Width**: 100vw
- **Height**: 100vh
- **Position**: Fixed overlay

### 3. Minimized State

**Visual Design**:
```
┌─────┐
│  💬 │  ← Icon only
└─────┘
```

**Specifications**:
- **Size**: 56px × 56px
- **Position**: Fixed bottom-right (20px from edges)
- **Background**: #6366f1
- **Color**: #ffffff
- **Border Radius**: 50% (circle)
- **Shadow**: 0 4px 12px rgba(0, 0, 0, 0.15)
- **Badge**: Show unread count if > 0

---

## User Flows

### 1. Asking a Question

```
1. User clicks AI Coach widget (or minimized icon)
   ↓
2. Widget expands (if minimized)
   ↓
3. User types question in input field
   ↓
4. User clicks "Send" or presses Enter
   ↓
5. Input clears, question appears as user message
   ↓
6. Loading state appears ("Thinking...")
   ↓
7. AI response appears with references
   ↓
8. User can:
   - Click reference to navigate
   - Provide feedback (👍/👎)
   - Ask follow-up question
```

### 2. Escalation Flow

```
1. User asks question
   ↓
2. AI determines low confidence
   ↓
3. Escalation notice appears
   ↓
4. Query forwarded to trainer
   ↓
5. Trainer receives notification
   ↓
6. Trainer responds
   ↓
7. User receives trainer response
   ↓
8. Response marked as "Trainer Response"
```

### 3. Viewing History

```
1. User clicks "History" button (if available)
   ↓
2. Conversation history loads
   ↓
3. User can scroll through past conversations
   ↓
4. User can click on past question to see answer
   ↓
5. User can continue conversation from history
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 767px) {
    .ai-coach-widget {
        width: 100vw;
        height: 100vh;
        position: fixed;
        top: 0;
        left: 0;
        border-radius: 0;
    }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
    .ai-coach-widget {
        width: 380px;
        height: 550px;
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .ai-coach-widget {
        width: 400px;
        height: 600px;
    }
}
```

### Mobile Optimizations

- **Full Screen**: Widget becomes full-screen overlay
- **Touch Targets**: Minimum 44px × 44px
- **Keyboard Handling**: Adjust layout when keyboard appears
- **Swipe Gestures**: Swipe down to close (optional)
- **Input Focus**: Scroll input into view when focused

---

## Accessibility

### 1. ARIA Labels

```html
<div class="ai-coach-widget" 
     role="dialog" 
     aria-label="AI Coach"
     aria-live="polite">
    <button class="btn-minimize" 
            aria-label="Minimize AI Coach">−</button>
    <button class="btn-close" 
            aria-label="Close AI Coach">×</button>
    <input type="text" 
           aria-label="Ask a question about the course"
           aria-describedby="input-help">
    <button class="btn-send" 
            aria-label="Send question">Send</button>
</div>
```

### 2. Keyboard Navigation

- **Tab**: Navigate through interactive elements
- **Enter**: Submit query (when input focused)
- **Escape**: Close/minimize widget
- **Arrow Keys**: Navigate history (if implemented)

### 3. Screen Reader Support

- Announce widget open/close
- Announce new messages
- Announce escalation status
- Announce errors

### 4. Focus Management

- Focus input when widget opens
- Maintain focus during loading
- Return focus after response
- Trap focus within widget (modal mode)

---

## Interactions and Animations

### 1. Widget Animations

**Open/Close**:
- **Duration**: 300ms
- **Easing**: ease-out
- **Transform**: Scale from 0.9 to 1.0, fade in

**Minimize**:
- **Duration**: 200ms
- **Transform**: Scale down, fade out
- **Position**: Move to bottom-right corner

### 2. Message Animations

**New Message**:
- **Duration**: 200ms
- **Easing**: ease-out
- **Transform**: Slide in from bottom, fade in

**Loading**:
- **Duration**: 1s (loop)
- **Animation**: Pulsing dots

### 3. Button Interactions

**Hover**:
- **Duration**: 150ms
- **Transform**: Slight scale (1.05)
- **Background**: Color change

**Click**:
- **Duration**: 100ms
- **Transform**: Scale down (0.95) then back

### 4. Input Interactions

**Focus**:
- **Duration**: 200ms
- **Border**: Color change, width increase
- **Background**: Color change

**Typing**:
- Character counter updates in real-time
- No animation (performance)

---

## States and Feedback

### 1. Widget States

**Idle**:
- Widget minimized or open with no activity
- Show "Ask a question..." placeholder

**Loading**:
- Show "Thinking..." message
- Disable input
- Show spinner/animation

**Error**:
- Show error message
- Provide retry option
- Log error for debugging

**Success**:
- Show answer with references
- Enable feedback buttons
- Ready for next question

### 2. Input States

**Empty**:
- Placeholder visible
- Send button disabled

**Typing**:
- Placeholder hidden
- Character counter visible
- Send button enabled

**Max Length**:
- Character counter shows red
- Input disabled
- Warning message

**Submitting**:
- Input disabled
- Send button shows spinner
- Character counter hidden

### 3. Message States

**User Message**:
- Right-aligned
- Primary color background
- White text

**AI Message**:
- Left-aligned
- Light indigo background
- Dark text
- References below
- Feedback buttons

**Trainer Message**:
- Left-aligned
- Light purple background
- Border accent
- "Trainer Response" badge

**Escalation Notice**:
- Amber background
- Warning icon
- Clear explanation

---

## Trainer Escalation View

### 1. Escalation List

**Layout**:
```
┌─────────────────────────────────────┐
│  AI Escalations              [Filter]│
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ John Doe                    │   │
│  │ SEO Master Course 2026      │   │
│  │ How do I optimize for...    │   │
│  │ 45% confidence              │   │
│  │ [View Details] [Respond]    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Jane Smith                   │   │
│  │ ...                          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 2. Escalation Detail

**Layout**:
```
┌─────────────────────────────────────┐
│  ← Back to Escalations              │
├─────────────────────────────────────┤
│  Learner: John Doe                  │
│  Course: SEO Master Course 2026      │
│  Question: How do I optimize...     │
│  AI Confidence: 45%                 │
│                                     │
│  AI Context Used:                   │
│  • Day 1 → Chapter 2                │
│  • Day 1 → Chapter 3                │
│                                     │
│  Learner Progress:                  │
│  • Completed: 5 chapters             │
│  • In Progress: Day 2 → Chapter 1   │
│                                     │
│  [Response Text Area]               │
│  [ ] Use as future reference        │
│  [Send Response]                    │
└─────────────────────────────────────┘
```

---

## Admin Analytics Dashboard

### 1. Overview

**Layout**:
```
┌─────────────────────────────────────┐
│  AI Coach Analytics                 │
├─────────────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐        │
│  │ 1.2K│  │ 85% │  │ $45 │        │
│  │Queries│ │Helpful│ │Cost │        │
│  └─────┘  └─────┘  └─────┘        │
│                                     │
│  [Usage Chart]                      │
│  [Cost Chart]                       │
│  [Top Questions]                    │
└─────────────────────────────────────┘
```

---

## Implementation Notes

### 1. CSS Variables

All design tokens should use CSS variables for consistency and theming.

### 2. Component Reusability

Design components to be reusable across different contexts (widget, full page, etc.).

### 3. Performance

- Lazy load widget (only when needed)
- Virtualize long message lists
- Debounce input validation
- Optimize animations (use transform, not position)

### 4. Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Graceful degradation for older browsers

---

**Document Status**: ✅ Ready for Implementation

