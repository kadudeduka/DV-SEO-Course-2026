# Reports Feature - UI/UX Design Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Design  
**Author:** System Design Team

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Visual Design System](#visual-design-system)
3. [Component Specifications](#component-specifications)
4. [Page Layouts](#page-layouts)
5. [User Flows](#user-flows)
6. [Responsive Design](#responsive-design)
7. [Accessibility](#accessibility)
8. [Interactions and Animations](#interactions-and-animations)

---

## Design Principles

### 1. Clarity First
- Clear visual hierarchy
- Easy-to-understand metrics
- Intuitive navigation
- Minimal cognitive load

### 2. Data-Driven
- Prominent display of key metrics
- Visual representations (charts, graphs)
- Comparative views where relevant
- Actionable insights

### 3. Performance Visibility
- Real-time or near-real-time updates
- Loading states for async operations
- Progress indicators
- Error states with recovery options

### 4. Role-Appropriate
- Tailored views for each role
- Relevant metrics per role
- Appropriate level of detail
- Contextual actions

---

## Visual Design System

### Color Palette

#### Primary Colors
```css
--color-report-primary: #6366f1;      /* Indigo - Primary actions */
--color-report-secondary: #8b5cf6;     /* Purple - Secondary actions */
--color-report-success: #10b981;       /* Green - Positive metrics */
--color-report-warning: #f59e0b;       /* Amber - Warnings */
--color-report-error: #ef4444;          /* Red - Errors/At Risk */
--color-report-info: #3b82f6;           /* Blue - Informational */
```

#### Status Colors
```css
--color-status-on-track: #10b981;       /* On Track status */
--color-status-needs-attention: #f59e0b; /* Needs Attention */
--color-status-at-risk: #ef4444;         /* At Risk */
--color-status-completed: #10b981;      /* Completed */
--color-status-in-progress: #3b82f6;     /* In Progress */
--color-status-not-started: #6b7280;     /* Not Started */
```

#### Background Colors
```css
--color-bg-report: #ffffff;              /* Report background */
--color-bg-card: #f9fafb;               /* Card background */
--color-bg-hover: #f3f4f6;              /* Hover state */
--color-bg-selected: #eef2ff;            /* Selected state */
```

### Typography

```css
--font-report-title: 24px / 32px 'Inter', sans-serif;      /* Page titles */
--font-report-heading: 20px / 28px 'Inter', sans-serif;    /* Section headings */
--font-report-subheading: 16px / 24px 'Inter', sans-serif; /* Subheadings */
--font-report-body: 14px / 20px 'Inter', sans-serif;       /* Body text */
--font-report-caption: 12px / 16px 'Inter', sans-serif;     /* Captions, labels */
--font-report-metric: 32px / 40px 'Inter', sans-serif;      /* Large numbers */
```

### Spacing

```css
--spacing-report-xs: 4px;
--spacing-report-sm: 8px;
--spacing-report-md: 16px;
--spacing-report-lg: 24px;
--spacing-report-xl: 32px;
--spacing-report-2xl: 48px;
```

### Shadows and Elevation

```css
--shadow-report-card: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-report-hover: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-report-modal: 0 10px 25px rgba(0, 0, 0, 0.15);
```

---

## Component Specifications

### 1. Statistics Card

**Purpose**: Display a single metric with label

**Visual Design**:
```
┌─────────────────────┐
│   Total Courses     │  ← Label (14px, gray)
│        12           │  ← Value (32px, bold, primary color)
│                     │
│   ↑ 15% from last   │  ← Optional trend indicator
│      month          │
└─────────────────────┘
```

**Specifications**:
- **Dimensions**: Flexible width, min 200px, max 300px
- **Padding**: 24px
- **Border**: 1px solid #e5e7eb
- **Border Radius**: 8px
- **Background**: #ffffff
- **Hover**: Slight elevation increase

**States**:
- Default: White background, gray border
- Hover: Shadow increase, border color change
- Loading: Skeleton loader
- Error: Red border, error icon

**Code Example**:
```html
<div class="stat-card">
    <div class="stat-label">Total Courses</div>
    <div class="stat-value">12</div>
    <div class="stat-trend">
        <span class="trend-icon">↑</span>
        <span class="trend-text">15% from last month</span>
    </div>
</div>
```

### 2. Progress Bar

**Purpose**: Visual representation of completion percentage

**Visual Design**:
```
Progress: 75%
┌─────────────────────────────────────┐
│████████████████████░░░░░░░░░░░░░░░░│  ← Filled portion
└─────────────────────────────────────┘
```

**Specifications**:
- **Height**: 8px (default), 4px (compact), 12px (large)
- **Border Radius**: 4px
- **Background**: #e5e7eb (unfilled)
- **Fill Color**: #6366f1 (primary) or status-based color
- **Animation**: Smooth fill animation on load

**Variants**:
- **Default**: 8px height, full width
- **Compact**: 4px height, for tables
- **Large**: 12px height, for emphasis
- **With Label**: Shows percentage text
- **With Steps**: Shows milestone markers

### 3. Data Table

**Purpose**: Display tabular data with sorting and pagination

**Visual Design**:
```
┌──────────┬──────────┬──────────┬──────────┐
│ Name ▲   │ Progress │ Status   │ Actions  │  ← Header (sortable)
├──────────┼──────────┼──────────┼──────────┤
│ User 1   │  75%     │ On Track │ [View]   │  ← Row
│ User 2   │  45%     │ At Risk  │ [View]   │
│ User 3   │  90%     │ On Track │ [View]   │
└──────────┴──────────┴──────────┴──────────┘
         ← 1 2 3 4 5 →              ← Pagination
```

**Specifications**:
- **Header**: 14px, semibold, gray text, sortable icons
- **Rows**: 14px, alternating background (#ffffff, #f9fafb)
- **Hover**: Background change (#f3f4f6)
- **Padding**: 12px vertical, 16px horizontal
- **Border**: 1px solid #e5e7eb between rows
- **Sortable**: Arrow indicators (▲ ▼)

**Features**:
- Column sorting (ascending/descending)
- Pagination (10, 25, 50, 100 per page)
- Row selection (checkbox)
- Expandable rows (for details)
- Responsive: Horizontal scroll on mobile

### 4. Chart Container

**Purpose**: Wrapper for data visualizations

**Visual Design**:
```
┌─────────────────────────────────────┐
│  Progress Over Time          [⚙]    │  ← Title and actions
├─────────────────────────────────────┤
│                                     │
│         [Chart Area]                │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  Legend: Course A, Course B, ...   │  ← Optional legend
└─────────────────────────────────────┘
```

**Specifications**:
- **Padding**: 24px
- **Background**: #ffffff
- **Border**: 1px solid #e5e7eb
- **Border Radius**: 8px
- **Min Height**: 300px
- **Aspect Ratio**: 16:9 (for line/bar charts)

**Chart Types**:
- **Line Chart**: Trends over time
- **Bar Chart**: Comparisons
- **Pie Chart**: Distributions
- **Heat Map**: Performance matrices

### 5. Filter Panel

**Purpose**: Allow users to filter report data

**Visual Design**:
```
┌─────────────────────────────────────┐
│  Filters                    [Reset] │
├─────────────────────────────────────┤
│  Date Range: [From] [To]           │
│  Learner Type: [Dropdown ▼]        │
│  Tags: [Multi-select ▼]            │
│  Search: [___________]              │
│  [Apply Filters]                   │
└─────────────────────────────────────┘
```

**Specifications**:
- **Layout**: Vertical stack of filter controls
- **Spacing**: 16px between filters
- **Inputs**: Standard form inputs (text, select, date)
- **Actions**: Apply and Reset buttons
- **Collapsible**: Can be collapsed on mobile

**Filter Types**:
- Date range picker
- Dropdown (single select)
- Multi-select dropdown
- Search input
- Checkbox group

### 6. Status Badge

**Purpose**: Display status with color coding

**Visual Design**:
```
[On Track]  [At Risk]  [Needs Attention]
```

**Specifications**:
- **Padding**: 4px 12px
- **Border Radius**: 12px
- **Font Size**: 12px
- **Font Weight**: 500
- **Colors**: Status-based (see color palette)

**Variants**:
- **On Track**: Green background (#d1fae5), green text (#065f46)
- **At Risk**: Red background (#fee2e2), red text (#991b1b)
- **Needs Attention**: Amber background (#fef3c7), amber text (#92400e)

---

## Page Layouts

### 1. Learner Dashboard

**Layout Structure**:
```
┌─────────────────────────────────────────────────────┐
│  My Performance Report              [Export] [Print] │  ← Header
├─────────────────────────────────────────────────────┤
│  [Filters Panel]                                     │  ← Filters
├─────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │Total │ │In    │ │Compl.│ │Prog. │ │Labs  │    │  ← Stats Cards
│  │Cours.│ │Prog. │ │      │ │      │ │      │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────────────────────────┤
│  Progress Over Time                                  │  ← Chart
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │         [Line Chart]                        │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  Course Breakdown                                   │  ← Table
│  ┌─────────────────────────────────────────────┐   │
│  │ Course │ Progress │ Status │ Labs │ Actions│   │
│  ├─────────────────────────────────────────────┤   │
│  │ ...    │ ...      │ ...    │ ...  │ ...   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Breakpoints**:
- **Desktop (>1024px)**: 3-column stats cards, full-width chart, full table
- **Tablet (768-1024px)**: 2-column stats cards, full-width chart, scrollable table
- **Mobile (<768px)**: 1-column stats cards, full-width chart, card-based table

### 2. Trainer Dashboard

**Layout Structure**:
```
┌─────────────────────────────────────────────────────┐
│  Learner Performance Overview      [Export] [Print] │  ← Header
├─────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│  │Total │ │Activ │ │At   │ │Avg   │                 │  ← Summary Stats
│  │Learn.│ │Learn.│ │Risk │ │Score │                 │
│  └──────┘ └──────┘ └─────┘ └──────┘                 │
├─────────────────────────────────────────────────────┤
│  [Filters: Type, Tags, Search]                       │  ← Filters
├─────────────────────────────────────────────────────┤
│  Learner Performance                                 │  ← Table
│  ┌─────────────────────────────────────────────┐   │
│  │ Name │ Courses │ Progress │ Status │ Actions│   │
│  ├─────────────────────────────────────────────┤   │
│  │ ...  │ ...     │ ...      │ ...    │ ...   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 3. Admin Dashboard

**Layout Structure**:
```
┌─────────────────────────────────────────────────────┐
│  System Overview                   [Export] [Print]  │  ← Header
├─────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Total │ │Activ │ │Total │ │Total │ │Avg   │      │  ← System Stats
│  │Users │ │Users │ │Cours.│ │Labs  │ │Score │      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐       │
│  │ User Growth      │  │ Course Completion │       │  ← Charts
│  │ [Line Chart]     │  │ [Bar Chart]      │       │
│  └──────────────────┘  └──────────────────┘       │
├─────────────────────────────────────────────────────┤
│  Quick Insights                                     │  ← Insights
│  • Top performing courses                          │
│  • Most active trainers                            │
│  • Learners needing attention                      │
└─────────────────────────────────────────────────────┘
```

### 4. Tag Management Page

**Layout Structure**:
```
┌─────────────────────────────────────────────────────┐
│  Tag Management                    [+ Create Tag]    │  ← Header
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │ Tag Name │ Description │ Color │ Usage │ Actions│  ← Tags Table
│  ├─────────────────────────────────────────────┤   │
│  │ Cohort   │ 2025 Cohort │ [🔵] │ 45    │ [Edit] │   │
│  │ ...      │ ...         │ ...  │ ...   │ ...   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Learner Views Performance Report

```
1. Learner clicks "Reports" in navigation
   ↓
2. Learner Dashboard loads
   - Shows overall statistics
   - Displays progress chart
   - Lists course breakdown
   ↓
3. Learner clicks "View Details" on a course
   ↓
4. Course-Specific Report loads
   - Shows course overview
   - Displays chapter progress
   - Shows lab performance
   - Activity timeline
   ↓
5. Learner can export report (PDF/CSV)
```

### Flow 2: Trainer Views Learner Performance

```
1. Trainer clicks "Reports" in navigation
   ↓
2. Trainer Dashboard loads
   - Shows summary statistics
   - Displays learner performance table
   ↓
3. Trainer applies filters (type, tags, search)
   ↓
4. Table updates with filtered results
   ↓
5. Trainer clicks on a learner
   ↓
6. Individual Learner Report loads
   - Shows learner profile
   - Displays course performance
   - Shows lab evaluation summary
   ↓
7. Trainer can export report
```

### Flow 3: Admin Creates Tag and Views Tag-Based Report

```
1. Admin clicks "Reports" → "Tag Management"
   ↓
2. Tag Management page loads
   - Shows existing tags
   ↓
3. Admin clicks "+ Create Tag"
   ↓
4. Create Tag modal opens
   - Enter name, description, color
   ↓
5. Tag is created
   ↓
6. Admin assigns tag to learners
   ↓
7. Admin navigates to Tag-Based Report
   ↓
8. Admin selects tag(s)
   ↓
9. Report displays performance for tagged learners
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 767px) {
    /* Single column layout */
    /* Stacked cards */
    /* Collapsible filters */
    /* Horizontal scroll for tables */
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
    /* 2-column layout */
    /* Side-by-side charts */
    /* Scrollable tables */
}

/* Desktop */
@media (min-width: 1024px) {
    /* 3+ column layout */
    /* Full-width charts */
    /* Full tables */
}
```

### Mobile Optimizations

1. **Statistics Cards**: Stack vertically, full width
2. **Charts**: Full width, touch-friendly controls
3. **Tables**: Convert to card-based layout or horizontal scroll
4. **Filters**: Collapsible panel, bottom sheet on mobile
5. **Navigation**: Tab-based navigation for report sections

### Tablet Optimizations

1. **Statistics Cards**: 2-column grid
2. **Charts**: Side-by-side where appropriate
3. **Tables**: Full table with horizontal scroll if needed
4. **Filters**: Always visible sidebar or top panel

---

## Accessibility

### WCAG 2.1 AA Compliance

1. **Color Contrast**:
   - Text: Minimum 4.5:1 ratio
   - Large text: Minimum 3:1 ratio
   - Interactive elements: Minimum 3:1 ratio

2. **Keyboard Navigation**:
   - All interactive elements keyboard accessible
   - Tab order logical
   - Focus indicators visible
   - Skip links for main content

3. **Screen Readers**:
   - Semantic HTML
   - ARIA labels for charts
   - Alt text for icons
   - Live regions for dynamic updates

4. **Visual Indicators**:
   - Status not conveyed by color alone
   - Icons accompany color coding
   - Clear error messages
   - Loading states announced

### ARIA Labels

```html
<!-- Chart -->
<div role="img" aria-label="Progress over time chart showing course completion trends">
    <!-- Chart content -->
</div>

<!-- Status Badge -->
<span role="status" aria-label="Status: On Track">
    On Track
</span>

<!-- Filter Panel -->
<div role="region" aria-label="Report filters">
    <!-- Filter controls -->
</div>
```

---

## Interactions and Animations

### Loading States

1. **Skeleton Loaders**: Show placeholder structure while loading
2. **Progress Indicators**: Spinner or progress bar for async operations
3. **Shimmer Effect**: Subtle animation on loading cards

### Transitions

1. **Page Transitions**: Fade in (200ms)
2. **Chart Animations**: Smooth data entry (500ms)
3. **Filter Updates**: Smooth table update (300ms)
4. **Modal Open/Close**: Slide and fade (250ms)

### Micro-interactions

1. **Hover States**: Subtle elevation increase, color change
2. **Click Feedback**: Brief scale animation (100ms)
3. **Sort Indicators**: Arrow rotation on sort
4. **Progress Bar Fill**: Smooth width animation

### Performance

- **Debounce**: Search inputs (300ms)
- **Throttle**: Scroll events (100ms)
- **Lazy Load**: Charts load on viewport entry
- **Virtual Scrolling**: For large tables (future)

---

## Component Library

### Shared Components

1. **ReportHeader**: Title, actions, breadcrumbs
2. **ReportFilters**: Filter panel with all filter types
3. **StatisticsGrid**: Grid of stat cards
4. **ReportChart**: Wrapper for Chart.js charts
5. **ReportTable**: Data table with sorting, pagination
6. **StatusBadge**: Color-coded status indicator
7. **ProgressBar**: Visual progress indicator
8. **ExportButton**: Export dropdown (PDF/CSV)
9. **DateRangePicker**: Date selection component
10. **TagSelector**: Multi-select tag picker

---

## Implementation Notes

### CSS Classes

```css
/* Report Container */
.report-container { }
.report-header { }
.report-content { }
.report-footer { }

/* Statistics */
.stat-card { }
.stat-label { }
.stat-value { }
.stat-trend { }

/* Charts */
.chart-container { }
.chart-title { }
.chart-legend { }

/* Tables */
.report-table { }
.table-header { }
.table-row { }
.table-cell { }

/* Filters */
.filter-panel { }
.filter-group { }
.filter-input { }

/* Status */
.status-badge { }
.status-on-track { }
.status-at-risk { }
.status-needs-attention { }
```

### JavaScript Structure

```javascript
// Component initialization
class ReportComponent {
    constructor(container, options) {
        this.container = container;
        this.options = options;
        this.data = null;
    }

    async init() {
        await this.loadData();
        this.render();
        this.attachEventListeners();
    }

    async loadData() { }
    render() { }
    attachEventListeners() { }
}
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-29 | System Design Team | Initial UI/UX design document |

