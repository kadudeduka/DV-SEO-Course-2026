# Reports Feature - Product Requirements Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Draft  
**Author:** System Design Team

---

## Table of Contents

1. [Overview](#overview)
2. [User Roles and Requirements](#user-roles-and-requirements)
3. [Data Requirements](#data-requirements)
4. [Metrics and KPIs](#metrics-and-kpis)
5. [User Interface Requirements](#user-interface-requirements)
6. [Technical Requirements](#technical-requirements)
7. [Database Schema](#database-schema)
8. [Implementation Phases](#implementation-phases)

---

## Overview

### Purpose
The Reports feature provides comprehensive performance tracking and analytics for learners, trainers, and administrators. It enables data-driven decision-making, performance monitoring, and progress tracking across the learning management system.

### Scope
- **Learner Reports**: Self-performance tracking across all assigned courses
- **Trainer Reports**: Performance tracking for assigned learners (individual and group)
- **Admin Reports**: System-wide analytics including course performance, trainer effectiveness, and learner analytics with tagging capabilities

### Key Features
- Performance dashboards for each user role
- Course-level and cross-course analytics
- User tagging system for grouping and analysis
- Export capabilities (CSV, PDF)
- Filtering and date range selection
- Comparative analytics

---

## User Roles and Requirements

### 1. Learner Reports

#### 1.1 Overview Dashboard
**User Story**: As a learner, I want to see my overall performance across all my assigned courses so I can track my learning progress.

**Requirements**:
- **Overall Statistics**:
  - Total courses assigned
  - Courses in progress
  - Courses completed
  - Overall completion percentage
  - Total chapters completed
  - Total labs submitted
  - Average lab score
  - Certificates earned

- **Performance Trends**:
  - Progress over time (line chart)
  - Activity timeline (last 30 days, 90 days, 6 months, 1 year)
  - Completion rate trend

- **Course Breakdown**:
  - List of all assigned courses with:
    - Course name
    - Progress percentage
    - Status (Not Started, In Progress, Completed)
    - Last accessed date
    - Time spent
    - Labs submitted/completed
    - Average lab score

#### 1.2 Course-Specific Report
**User Story**: As a learner, I want to see detailed performance for a specific course so I can identify areas that need improvement.

**Requirements**:
- **Course Overview**:
  - Course name and description
  - Overall progress percentage
  - Time spent in course
  - Days since course started
  - Estimated completion date (based on current pace)

- **Chapter Progress**:
  - List of all chapters with:
    - Chapter name
    - Completion status
    - Completed date
    - Time spent
    - Last accessed date

- **Lab Performance**:
  - List of all labs with:
    - Lab name
    - Submission status
    - Submission date
    - Score/grade
    - Trainer feedback
    - Resubmission count
    - Status (Pending Review, Approved, Needs Revision)

- **Activity Timeline**:
  - Chronological list of activities:
    - Chapter completions
    - Lab submissions
    - Lab feedback received
    - Course milestones

- **Performance Metrics**:
  - Average time per chapter
  - Average time per lab
  - Consistency score (regular activity)
  - Engagement score

#### 1.3 Export Options
- Export own report as PDF
- Export own report as CSV
- Share report link (optional, future)

---

### 2. Trainer Reports

#### 2.1 Learner Performance Overview
**User Story**: As a trainer, I want to see the performance of all my assigned learners so I can identify who needs additional support.

**Requirements**:
- **Summary Statistics**:
  - Total assigned learners
  - Active learners (with activity in last 30 days)
  - Learners at risk (low progress, no recent activity)
  - Average completion rate across all learners
  - Total courses allocated
  - Total labs pending review
  - Average lab score across all learners

- **Learner List View**:
  - Table/grid of all assigned learners with:
    - Learner name and email
    - Total courses assigned
    - Overall progress percentage
    - Courses completed
    - Labs submitted
    - Average lab score
    - Last activity date
    - Status indicator (On Track, At Risk, Needs Attention)
    - Quick actions (View Details, Send Message)

- **Filtering Options**:
  - Filter by learner type (Active, Inactive, Graduate, Archive)
  - Filter by performance status
  - Filter by tags (admin-created tags)
  - Search by name/email

#### 2.2 Individual Learner Report
**User Story**: As a trainer, I want to see detailed performance of a specific learner across all their courses so I can provide targeted support.

**Requirements**:
- **Learner Profile**:
  - Name, email, learner type
  - Registration date
  - Days since registration
  - Overall statistics (same as learner's own view)

- **Course Performance**:
  - List of all courses assigned to the learner with:
    - Course name
    - Progress percentage
    - Status
    - Time spent
    - Labs submitted/pending
    - Average lab score
    - Last activity date

- **Lab Evaluation Summary**:
  - Total labs submitted
  - Labs pending review
  - Labs approved
  - Labs needing revision
  - Average score
  - Response time (time to review)
  - Quality of submissions trend

- **Activity Timeline**:
  - Recent activity (last 30 days)
  - Engagement pattern
  - Milestones achieved

#### 2.3 Course Performance Report
**User Story**: As a trainer, I want to see how all my learners are performing in a specific course so I can identify course-wide issues.

**Requirements**:
- **Course Overview**:
  - Course name and description
  - Total learners assigned to this course
  - Average progress percentage
  - Average completion time
  - Drop-off points (chapters where learners stop)

- **Learner Performance in Course**:
  - Table of all learners with:
    - Learner name
    - Progress percentage
    - Chapters completed
    - Labs submitted
    - Lab scores
    - Time spent
    - Last accessed date
    - Status (On Track, Behind, At Risk)

- **Chapter Analysis**:
  - For each chapter:
    - Chapter name
    - Completion rate (% of learners who completed)
    - Average time to complete
    - Common issues/comments

- **Lab Analysis**:
  - For each lab:
    - Lab name
    - Submission rate
    - Average score
    - Common mistakes/feedback themes
    - Resubmission rate

- **Comparative Analytics**:
  - Progress distribution (histogram)
  - Score distribution
  - Time spent distribution

#### 2.4 Cross-Course Performance Report
**User Story**: As a trainer, I want to compare learner performance across multiple courses to identify patterns and strengths/weaknesses.

**Requirements**:
- **Course Comparison**:
  - Select multiple courses
  - Compare:
    - Average progress per course
    - Average lab scores per course
    - Completion rates per course
    - Engagement levels per course

- **Learner Comparison**:
  - Select multiple learners
  - Compare:
    - Progress across courses
    - Lab scores across courses
    - Time spent per course
    - Consistency across courses

- **Visualizations**:
  - Bar charts for course comparison
  - Line charts for progress trends
  - Heat maps for course vs learner performance

#### 2.5 Tag-Based Reports
**User Story**: As a trainer, I want to see performance of learners grouped by admin-created tags so I can analyze specific learner segments.

**Requirements**:
- **Tag Selection**:
  - Dropdown of all admin-created tags
  - Multi-select for multiple tags
  - Filter learners by selected tags

- **Tag Performance Report**:
  - Summary statistics for tagged learners
  - Average metrics for the group
  - Individual learner breakdown
  - Comparison with overall averages

#### 2.6 Export Options
- Export learner report as PDF/CSV
- Export course report as PDF/CSV
- Export comparison report as PDF/CSV
- Schedule automated reports (future)

---

### 3. Admin Reports

#### 3.1 System Overview Dashboard
**User Story**: As an admin, I want to see system-wide statistics and trends so I can monitor overall platform health.

**Requirements**:
- **System Statistics**:
  - Total users (by role: learners, trainers, admins)
  - Active users (last 30 days)
  - Total courses
  - Published courses
  - Total course allocations
  - Total lab submissions
  - Average system-wide completion rate
  - Average lab score

- **Trends**:
  - User growth over time
  - Course completion trends
  - Lab submission trends
  - Engagement trends

- **Quick Insights**:
  - Top performing courses
  - Most active trainers
  - Learners needing attention
  - Courses with low completion rates

#### 3.2 Course Performance Report
**User Story**: As an admin, I want to see how each course is performing across all learners so I can identify courses that need improvement.

**Requirements**:
- **Course List**:
  - All courses with:
    - Course name
    - Total learners assigned
    - Average progress percentage
    - Completion rate
    - Average completion time
    - Average lab score
    - Drop-off rate
    - Engagement score

- **Course Detail View**:
  - Select a course to see:
    - Course metadata
    - Total allocations
    - Active learners count
    - Completed learners count
    - Progress distribution
    - Chapter-level analytics
    - Lab-level analytics
    - Learner feedback/comments
    - Performance trends over time

- **Comparative Analysis**:
  - Compare multiple courses side-by-side
  - Identify best/worst performing courses
  - Course effectiveness ranking

#### 3.3 Trainer Performance Report
**User Story**: As an admin, I want to see how each trainer is performing so I can identify training needs and recognize top performers.

**Requirements**:
- **Trainer List**:
  - All trainers with:
    - Trainer name and email
    - Total assigned learners
    - Active learners count
    - Average learner progress
    - Average lab score (for their learners)
    - Response time (lab review time)
    - Total labs reviewed
    - Pending reviews count
    - Learner satisfaction (if available)

- **Trainer Detail View**:
  - Select a trainer to see:
    - Trainer profile
    - Assigned learners list
    - Course allocation summary
    - Lab review statistics
    - Average response time
    - Review quality metrics
    - Learner progress trends
    - Performance over time

- **Trainer Comparison**:
  - Compare multiple trainers
  - Identify top performers
  - Identify trainers needing support

#### 3.4 Individual Learner Report
**User Story**: As an admin, I want to see detailed performance of any learner in the system for support and analysis purposes.

**Requirements**:
- Same as Trainer's Individual Learner Report (Section 2.2)
- Additional admin-only information:
  - Account status
  - Learner type
  - Trainer assignment history
  - System access logs (future)
  - Support tickets (future)

#### 3.5 Tag Management and Tag-Based Reports
**User Story**: As an admin, I want to create tags for learners and analyze performance by tags so I can segment and analyze learner groups.

**Requirements**:
- **Tag Management**:
  - Create tags (e.g., "Cohort 2025", "Enterprise Clients", "Premium", "Scholarship")
  - Edit tag names
  - Delete tags (with confirmation)
  - Assign tags to learners (single or bulk)
  - Remove tags from learners
  - View all tags and their usage

- **Tag-Based Performance Report**:
  - Select one or multiple tags
  - View aggregated statistics for tagged learners:
    - Total learners with tag
    - Average progress
    - Average lab scores
    - Completion rates
    - Engagement metrics
  - Individual learner breakdown
  - Comparison with system averages
  - Comparison between different tags

- **Tag Analytics**:
  - Tag usage statistics
  - Most common tag combinations
  - Performance correlation with tags

#### 3.6 Advanced Filtering and Analytics
**Requirements**:
- **Multi-Dimensional Filtering**:
  - Filter by:
    - Date range
    - Learner type
    - Status
    - Tags (multiple)
    - Trainer
    - Course
    - Performance thresholds

- **Custom Report Builder** (Future):
  - Select metrics to include
  - Choose visualization types
  - Save custom report templates

#### 3.7 Export Options
- Export any report as PDF
- Export any report as CSV
- Schedule automated reports
- Email reports (future)

---

## Data Requirements

### 3.1 Data Sources

#### User Progress Data
- `user_progress` table
  - `user_id`
  - `content_id` (chapter/lab ID)
  - `completed` (boolean)
  - `completed_at` (timestamp)
  - `progress_data` (JSONB - additional progress info)

#### Course Allocations
- `course_allocations` table
  - `user_id`
  - `course_id`
  - `status` (active/removed)
  - `allocated_at`
  - `trainer_id`

#### Lab Submissions
- `lab_submissions` table
  - `id`
  - `user_id`
  - `course_id`
  - `lab_id`
  - `submitted_at`
  - `status` (pending, approved, needs_revision)
  - `score` (if available)
  - `trainer_feedback`
  - `trainer_id` (reviewer)

#### User Information
- `users` table
  - `id`
  - `email`
  - `full_name`
  - `role`
  - `learner_type`
  - `trainer_id`
  - `status`
  - `created_at`

#### Course Information
- Course metadata from `data/courses/` directory
- Course structure (days, chapters, labs)

### 3.2 Calculated Metrics

#### Learner Metrics
- **Progress Percentage**: (Completed chapters / Total chapters) × 100
- **Completion Rate**: (Completed courses / Assigned courses) × 100
- **Average Lab Score**: Sum of lab scores / Number of labs with scores
- **Time Spent**: Sum of time spent on all chapters/labs
- **Engagement Score**: Based on activity frequency and consistency
- **Consistency Score**: Regular activity pattern indicator

#### Course Metrics
- **Average Progress**: Average of all learner progress percentages
- **Completion Rate**: (Learners who completed / Total learners assigned) × 100
- **Drop-off Rate**: Percentage of learners who stopped at a specific chapter
- **Average Completion Time**: Average time from allocation to completion
- **Engagement Score**: Average activity frequency

#### Trainer Metrics
- **Average Learner Progress**: Average progress of all assigned learners
- **Response Time**: Average time to review labs
- **Review Quality**: Based on feedback length and detail (future)
- **Learner Satisfaction**: Based on feedback (future)

---

## Metrics and KPIs

### Learner KPIs
1. **Overall Progress**: Percentage of assigned courses completed
2. **Chapter Completion Rate**: Chapters completed / Total chapters
3. **Lab Submission Rate**: Labs submitted / Total labs
4. **Average Lab Score**: Average score across all submitted labs
5. **Time to Complete**: Average time to complete a course
6. **Engagement Level**: Activity frequency and consistency
7. **Certification Rate**: Certificates earned / Courses completed

### Trainer KPIs
1. **Learner Progress Rate**: Average progress of assigned learners
2. **Lab Review Response Time**: Average time to review and provide feedback
3. **Learner Completion Rate**: Percentage of learners who complete courses
4. **Average Lab Score**: Average lab scores of assigned learners
5. **Learner Retention**: Percentage of active learners
6. **Support Effectiveness**: Based on learner progress improvement (future)

### Admin KPIs
1. **System Completion Rate**: Overall course completion rate across all learners
2. **Course Effectiveness**: Completion rate and learner satisfaction per course
3. **Trainer Effectiveness**: Average learner progress and completion rates per trainer
4. **User Engagement**: Active users, activity frequency
5. **Course Utilization**: Courses with active learners / Total courses
6. **Tag Performance**: Performance metrics by tag groups

---

## User Interface Requirements

### 4.1 Common UI Elements

#### Navigation
- Reports link in main navigation (all roles)
- Sub-navigation for different report types
- Breadcrumbs for navigation

#### Filters Panel
- Date range picker (from/to)
- Dropdown filters (role, status, type, etc.)
- Search input
- Tag selector (multi-select)
- Apply/Reset buttons

#### Data Visualization
- **Charts**:
  - Line charts (trends over time)
  - Bar charts (comparisons)
  - Pie charts (distributions)
  - Heat maps (course vs learner performance)
  - Progress bars (individual progress)

- **Tables**:
  - Sortable columns
  - Pagination
  - Row selection (for bulk actions)
  - Expandable rows (for details)

#### Export Options
- Export button (PDF/CSV)
- Print option
- Share link (future)

### 4.2 Learner Report UI

#### Dashboard Layout
- **Top Section**: Overall statistics cards (4-6 cards)
- **Middle Section**: 
  - Progress trend chart (line chart)
  - Activity timeline
- **Bottom Section**: 
  - Course list with progress indicators
  - Quick actions

#### Course Detail Page
- **Header**: Course name, overall progress
- **Tabs**: 
  - Overview
  - Chapters
  - Labs
  - Activity Timeline
- **Sidebar**: Quick stats

### 4.3 Trainer Report UI

#### Dashboard Layout
- **Top Section**: Summary statistics
- **Middle Section**: 
  - Learner performance table
  - Filters panel
- **Bottom Section**: 
  - Quick insights
  - Recent activity

#### Report Views
- **Learner List View**: Table with filters
- **Individual Learner View**: Detailed breakdown
- **Course Performance View**: Course-specific analytics
- **Comparison View**: Side-by-side comparisons

### 4.4 Admin Report UI

#### Dashboard Layout
- **Top Section**: System-wide statistics
- **Middle Section**: 
  - Key metrics cards
  - Trend charts
- **Bottom Section**: 
  - Quick access to detailed reports
  - Alerts/notifications

#### Report Views
- **System Overview**: High-level metrics
- **Course Performance**: Course analytics
- **Trainer Performance**: Trainer analytics
- **Learner Performance**: Individual learner details
- **Tag Management**: Tag creation and assignment
- **Tag-Based Reports**: Performance by tags

---

## Technical Requirements

### 5.1 Performance Requirements
- Reports should load within 3 seconds
- Support for up to 10,000 learners
- Efficient data aggregation
- Caching for frequently accessed reports
- Lazy loading for large datasets

### 5.2 Data Aggregation
- Pre-calculate common metrics (daily/hourly jobs)
- Use database views for complex queries
- Index optimization for report queries
- Materialized views for heavy aggregations (future)

### 5.3 Security Requirements
- Role-based access control
- Learners can only see their own data
- Trainers can only see their assigned learners
- Admins can see all data
- Audit logging for report access (future)

### 5.4 Scalability
- Support for growing user base
- Efficient querying for large datasets
- Pagination for large result sets
- Progressive loading for charts

---

## Database Schema

### 6.1 New Tables

#### user_tags
```sql
CREATE TABLE public.user_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT, -- For UI display
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name)
);

CREATE INDEX idx_user_tags_name ON public.user_tags(name);
```

#### user_tag_assignments
```sql
CREATE TABLE public.user_tag_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.user_tags(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tag_id)
);

CREATE INDEX idx_user_tag_assignments_user_id ON public.user_tag_assignments(user_id);
CREATE INDEX idx_user_tag_assignments_tag_id ON public.user_tag_assignments(tag_id);
```

#### report_cache (Optional - for performance)
```sql
CREATE TABLE public.report_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    report_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_cache_key ON public.report_cache(cache_key);
CREATE INDEX idx_report_cache_expires ON public.report_cache(expires_at);
```

### 6.2 Enhanced Existing Tables

#### lab_submissions (if not exists)
- Ensure `score` column exists (NUMERIC)
- Ensure `trainer_feedback` column exists (TEXT)
- Ensure `reviewed_at` timestamp exists

#### user_progress
- Ensure `time_spent` can be calculated or stored
- Ensure `progress_data` JSONB can store additional metrics

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Set up basic reporting infrastructure

**Tasks**:
1. Create database schema for tags
2. Create report service structure
3. Implement basic data aggregation functions
4. Create report route handlers
5. Set up basic UI components

**Deliverables**:
- Tag management system
- Basic report service
- Report navigation structure

### Phase 2: Learner Reports (Week 3-4)
**Goal**: Complete learner self-reporting

**Tasks**:
1. Implement learner dashboard
2. Implement course-specific learner report
3. Add progress visualizations
4. Add export functionality
5. Testing and refinement

**Deliverables**:
- Learner report dashboard
- Course detail report
- Export functionality

### Phase 3: Trainer Reports (Week 5-7)
**Goal**: Complete trainer reporting capabilities

**Tasks**:
1. Implement learner performance overview
2. Implement individual learner report
3. Implement course performance report
4. Implement cross-course comparison
5. Add tag-based filtering
6. Testing and refinement

**Deliverables**:
- Trainer dashboard
- All trainer report views
- Tag integration

### Phase 4: Admin Reports (Week 8-10)
**Goal**: Complete admin reporting and analytics

**Tasks**:
1. Implement system overview dashboard
2. Implement course performance report
3. Implement trainer performance report
4. Implement tag management UI
5. Implement tag-based reports
6. Add advanced filtering
7. Testing and refinement

**Deliverables**:
- Admin dashboard
- All admin report views
- Tag management system
- Advanced analytics

### Phase 5: Enhancements (Week 11-12)
**Goal**: Polish and optimize

**Tasks**:
1. Performance optimization
2. Caching implementation
3. Additional visualizations
4. Export enhancements
5. Mobile responsiveness
6. Final testing

**Deliverables**:
- Optimized reports
- Enhanced UI/UX
- Mobile support

---

## Success Criteria

### Functional Criteria
- ✅ All user roles can access their respective reports
- ✅ All metrics are calculated correctly
- ✅ Reports load within performance requirements
- ✅ Export functionality works for all report types
- ✅ Tag system functions correctly
- ✅ Filters work as expected

### Non-Functional Criteria
- Reports load within 3 seconds
- System supports 10,000+ users
- Mobile-responsive design
- Accessible (WCAG 2.1 AA)
- Secure (role-based access)

---

## Future Enhancements

### Phase 6+ (Future)
1. **Automated Reports**: Schedule and email reports
2. **Custom Report Builder**: Drag-and-drop report creation
3. **Predictive Analytics**: ML-based predictions
4. **Real-time Dashboards**: Live updates
5. **API Access**: Programmatic report access
6. **Advanced Visualizations**: More chart types
7. **Collaborative Reports**: Share and comment on reports
8. **Report Templates**: Pre-built report templates
9. **Benchmarking**: Compare against industry standards
10. **Gamification**: Leaderboards and achievements

---

## Dependencies

### External Libraries
- Chart.js or D3.js (for visualizations)
- Date-fns (for date manipulation)
- PDF generation library (jsPDF or similar)
- CSV export library

### Internal Dependencies
- Progress Service (for progress data)
- Course Allocation Service (for allocation data)
- Lab Submission Service (for lab data)
- User Service (for user data)
- Course Service (for course metadata)

---

## Open Questions

1. **Time Tracking**: How do we track time spent on chapters/labs?
   - Option A: Client-side tracking (JavaScript)
   - Option B: Server-side session tracking
   - Option C: Manual entry (future)

2. **Score Calculation**: How are lab scores calculated?
   - Numeric score (0-100)?
   - Letter grades?
   - Pass/Fail?

3. **Engagement Score Formula**: What factors contribute to engagement?
   - Activity frequency
   - Consistency
   - Time spent
   - Completion rate

4. **Report Refresh Frequency**: How often should cached reports be refreshed?
   - Real-time (on-demand)
   - Hourly
   - Daily

5. **Tag Permissions**: Can trainers create their own tags or only use admin tags?
   - Recommendation: Only admin-created tags for consistency

---

## Approval

**Product Owner**: _________________  
**Technical Lead**: _________________  
**Date**: _________________

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-29 | System Design Team | Initial requirements document |

