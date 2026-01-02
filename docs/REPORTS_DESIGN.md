# Reports Feature - Technical Design Document

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
8. [Performance Considerations](#performance-considerations)
9. [Security Design](#security-design)
10. [Implementation Details](#implementation-details)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Learner    │  │   Trainer    │  │    Admin     │      │
│  │   Reports    │  │   Reports    │  │   Reports    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                   │
│              ┌────────────▼────────────┐                     │
│              │   Report Components     │                     │
│              │  (Shared UI Components)  │                     │
│              └────────────┬────────────┘                     │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Report     │  │     Tag      │  │  Analytics    │      │
│  │   Service    │  │   Service    │  │   Service     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                   │
│              ┌────────────▼────────────┐                     │
│              │   Data Aggregation      │                     │
│              │      Layer              │                     │
│              └────────────┬────────────┘                     │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Supabase   │  │   Course     │  │   Cache      │      │
│  │   Database   │  │   Metadata   │  │   Layer      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns**: Clear separation between UI, business logic, and data access
2. **Role-Based Access**: Each role has dedicated components with shared utilities
3. **Performance First**: Aggregation and caching at service layer
4. **Scalability**: Designed to handle 10,000+ users
5. **Reusability**: Shared components and utilities across report types

---

## System Components

### 1. Frontend Components

#### 1.1 Report Components Structure

```
lms/components/reports/
├── learner-reports/
│   ├── learner-dashboard.js          # Main learner dashboard
│   ├── learner-course-report.js       # Course-specific report
│   └── learner-progress-chart.js      # Progress visualization
├── trainer-reports/
│   ├── trainer-dashboard.js           # Main trainer dashboard
│   ├── learner-performance-overview.js # All learners overview
│   ├── individual-learner-report.js   # Single learner detail
│   ├── course-performance-report.js   # Course-specific analytics
│   ├── cross-course-comparison.js     # Multi-course comparison
│   └── tag-based-report.js            # Tag-filtered reports
├── admin-reports/
│   ├── admin-dashboard.js             # System overview
│   ├── course-performance-report.js   # Course analytics
│   ├── trainer-performance-report.js  # Trainer analytics
│   ├── learner-performance-report.js  # Individual learner
│   ├── tag-management.js              # Tag CRUD operations
│   └── tag-based-report.js            # Tag analytics
├── shared/
│   ├── report-filters.js             # Filter panel component
│   ├── report-charts.js               # Chart components
│   ├── report-table.js                # Data table component
│   ├── export-options.js              # Export functionality
│   └── date-range-picker.js           # Date selection
└── report-router.js                   # Report routing logic
```

#### 1.2 Component Responsibilities

**Learner Dashboard** (`learner-dashboard.js`):
- Display overall statistics cards
- Render progress trend chart
- Show course breakdown list
- Handle navigation to course-specific reports

**Trainer Dashboard** (`trainer-dashboard.js`):
- Display summary statistics
- Show learner performance table
- Provide filters (learner type, tags, status)
- Handle navigation to detailed reports

**Admin Dashboard** (`admin-dashboard.js`):
- Display system-wide statistics
- Show key metrics and trends
- Provide quick access to detailed reports
- Display alerts and insights

**Report Filters** (`report-filters.js`):
- Date range selection
- Multi-select dropdowns
- Search input
- Tag selector (multi-select)
- Apply/Reset functionality

**Report Charts** (`report-charts.js`):
- Line charts (trends)
- Bar charts (comparisons)
- Pie charts (distributions)
- Heat maps (performance matrices)
- Progress bars

**Report Table** (`report-table.js`):
- Sortable columns
- Pagination
- Row selection
- Expandable rows
- Export to CSV

---

### 2. Service Layer

#### 2.1 Report Service (`report-service.js`)

**Purpose**: Core service for generating and aggregating report data

**Key Methods**:

```javascript
class ReportService {
    // Learner Reports
    async getLearnerOverview(userId, dateRange)
    async getLearnerCourseReport(userId, courseId, dateRange)
    async getLearnerProgressTrend(userId, period)
    async getLearnerActivityTimeline(userId, dateRange)
    
    // Trainer Reports
    async getTrainerLearnerOverview(trainerId, filters)
    async getIndividualLearnerReport(trainerId, learnerId, dateRange)
    async getCoursePerformanceReport(trainerId, courseId, filters)
    async getCrossCourseComparison(trainerId, courseIds, learnerIds)
    
    // Admin Reports
    async getSystemOverview(dateRange)
    async getCoursePerformanceReport(courseId, filters)
    async getTrainerPerformanceReport(trainerId, filters)
    async getLearnerPerformanceReport(learnerId, dateRange)
    
    // Tag-Based Reports
    async getTagBasedReport(tagIds, filters, userRole, userId)
    
    // Data Aggregation
    async aggregateProgressData(userIds, courseIds, dateRange)
    async aggregateLabData(userIds, courseIds, dateRange)
    async calculateMetrics(data, metricType)
    
    // Export
    async exportReport(reportType, reportData, format)
}
```

#### 2.2 Tag Service (`tag-service.js`)

**Purpose**: Manage user tags and tag assignments

**Key Methods**:

```javascript
class TagService {
    // Tag CRUD
    async createTag(name, description, color, createdBy)
    async updateTag(tagId, updates)
    async deleteTag(tagId)
    async getAllTags()
    async getTagById(tagId)
    
    // Tag Assignments
    async assignTagToUser(userId, tagId, assignedBy)
    async removeTagFromUser(userId, tagId)
    async assignTagsToUsers(userIds, tagIds, assignedBy)
    async removeTagsFromUsers(userIds, tagIds)
    async getUserTags(userId)
    async getUsersByTags(tagIds)
    
    // Tag Analytics
    async getTagUsageStats()
    async getTagPerformance(tagIds, filters)
}
```

#### 2.3 Analytics Service (`analytics-service.js`)

**Purpose**: Calculate metrics and perform analytics

**Key Methods**:

```javascript
class AnalyticsService {
    // Progress Calculations
    calculateProgressPercentage(completed, total)
    calculateCourseProgress(userId, courseId)
    calculateOverallProgress(userId)
    
    // Lab Metrics
    calculateAverageLabScore(userId, courseId)
    calculateLabSubmissionRate(userId, courseId)
    calculateLabApprovalRate(userId, courseId)
    
    // Engagement Metrics
    calculateEngagementScore(userId, dateRange)
    calculateConsistencyScore(userId, dateRange)
    calculateActivityFrequency(userId, dateRange)
    
    // Course Metrics
    calculateCourseCompletionRate(courseId)
    calculateAverageCompletionTime(courseId)
    calculateDropOffRate(courseId, chapterId)
    
    // Trainer Metrics
    calculateAverageLearnerProgress(trainerId)
    calculateResponseTime(trainerId, dateRange)
    calculateReviewQuality(trainerId, dateRange)
    
    // Comparative Analytics
    compareCourses(courseIds, metrics)
    compareLearners(learnerIds, metrics)
    compareTrainers(trainerIds, metrics)
}
```

---

## Database Design

### 3.1 New Tables

#### user_tags
```sql
CREATE TABLE public.user_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#6366f1', -- Default indigo color
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_tags_name ON public.user_tags(name);
CREATE INDEX idx_user_tags_created_by ON public.user_tags(created_by);
```

#### user_tag_assignments
```sql
CREATE TABLE public.user_tag_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.user_tags(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tag_id)
);

CREATE INDEX idx_user_tag_assignments_user_id ON public.user_tag_assignments(user_id);
CREATE INDEX idx_user_tag_assignments_tag_id ON public.user_tag_assignments(tag_id);
CREATE INDEX idx_user_tag_assignments_assigned_by ON public.user_tag_assignments(assigned_by);
```

#### report_cache (Optional - for performance)
```sql
CREATE TABLE public.report_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    report_type TEXT NOT NULL,
    report_data JSONB NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_cache_key ON public.report_cache(cache_key);
CREATE INDEX idx_report_cache_expires ON public.report_cache(expires_at);
CREATE INDEX idx_report_cache_user_id ON public.report_cache(user_id);
CREATE INDEX idx_report_cache_type ON public.report_cache(report_type);
```

### 3.2 Enhanced Existing Tables

#### lab_submissions
Ensure these columns exist:
```sql
-- Add if not exists
ALTER TABLE public.lab_submissions
ADD COLUMN IF NOT EXISTS score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS trainer_feedback TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_lab_submissions_score ON public.lab_submissions(score);
CREATE INDEX IF NOT EXISTS idx_lab_submissions_reviewed_at ON public.lab_submissions(reviewed_at);
```

#### user_progress
Ensure time tracking capability:
```sql
-- Add if not exists
ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0, -- in seconds
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS progress_data JSONB DEFAULT '{}'::jsonb;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_time_spent ON public.user_progress(time_spent);
CREATE INDEX IF NOT EXISTS idx_user_progress_last_accessed ON public.user_progress(last_accessed_at);
```

### 3.3 Database Views (for performance)

#### learner_progress_summary
```sql
CREATE OR REPLACE VIEW public.learner_progress_summary AS
SELECT 
    u.id AS user_id,
    u.full_name,
    u.email,
    u.learner_type,
    COUNT(DISTINCT ca.course_id) AS total_courses_assigned,
    COUNT(DISTINCT CASE WHEN up.completed = true THEN up.content_id END) AS chapters_completed,
    COUNT(DISTINCT ls.id) AS labs_submitted,
    AVG(ls.score) AS average_lab_score,
    MAX(up.last_accessed_at) AS last_activity_date
FROM public.users u
LEFT JOIN public.course_allocations ca ON u.id = ca.user_id AND ca.status = 'active'
LEFT JOIN public.user_progress up ON u.id = up.user_id
LEFT JOIN public.lab_submissions ls ON u.id = ls.user_id
WHERE u.role = 'learner'
GROUP BY u.id, u.full_name, u.email, u.learner_type;
```

#### course_performance_summary
```sql
CREATE OR REPLACE VIEW public.course_performance_summary AS
SELECT 
    ca.course_id,
    COUNT(DISTINCT ca.user_id) AS total_learners,
    COUNT(DISTINCT CASE WHEN up.completed = true THEN up.user_id END) AS learners_completed,
    AVG(
        CASE 
            WHEN total_chapters > 0 
            THEN (completed_chapters::NUMERIC / total_chapters::NUMERIC) * 100 
            ELSE 0 
        END
    ) AS average_progress,
    AVG(ls.score) AS average_lab_score,
    COUNT(DISTINCT ls.id) AS total_lab_submissions
FROM public.course_allocations ca
LEFT JOIN (
    SELECT 
        user_id, 
        course_id,
        COUNT(DISTINCT CASE WHEN completed = true THEN content_id END) AS completed_chapters
    FROM public.user_progress
    GROUP BY user_id, course_id
) up ON ca.user_id = up.user_id AND ca.course_id = up.course_id
LEFT JOIN public.lab_submissions ls ON ca.user_id = ls.user_id AND ca.course_id = ls.course_id
LEFT JOIN (
    -- Get total chapters per course (from course metadata)
    SELECT course_id, COUNT(*) AS total_chapters
    FROM public.user_progress
    GROUP BY course_id
) course_stats ON ca.course_id = course_stats.course_id
WHERE ca.status = 'active'
GROUP BY ca.course_id;
```

---

## Service Layer Design

### 4.1 Report Service Implementation

#### File: `lms/services/report-service.js`

```javascript
import { supabaseClient } from './supabase-client.js';
import { analyticsService } from './analytics-service.js';
import { courseService } from './course-service.js';
import { tagService } from './tag-service.js';

class ReportService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Learner Reports
    async getLearnerOverview(userId, dateRange = null) {
        const cacheKey = `learner_overview_${userId}_${JSON.stringify(dateRange)}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Get course allocations
            const { data: allocations } = await supabaseClient
                .from('course_allocations')
                .select('course_id, allocated_at')
                .eq('user_id', userId)
                .eq('status', 'active');

            const courseIds = allocations?.map(a => a.course_id) || [];

            // Get progress data
            const { data: progress } = await supabaseClient
                .from('user_progress')
                .select('*')
                .eq('user_id', userId)
                .in('course_id', courseIds);

            // Get lab submissions
            const { data: labs } = await supabaseClient
                .from('lab_submissions')
                .select('*')
                .eq('user_id', userId)
                .in('course_id', courseIds);

            // Calculate metrics
            const totalCourses = courseIds.length;
            const coursesInProgress = await this._getCoursesInProgress(userId, courseIds);
            const coursesCompleted = await this._getCoursesCompleted(userId, courseIds);
            const overallProgress = await analyticsService.calculateOverallProgress(userId);
            const chaptersCompleted = progress?.filter(p => p.completed).length || 0;
            const labsSubmitted = labs?.length || 0;
            const averageLabScore = await analyticsService.calculateAverageLabScore(userId);

            const result = {
                totalCourses,
                coursesInProgress,
                coursesCompleted,
                overallProgress,
                chaptersCompleted,
                labsSubmitted,
                averageLabScore,
                certificatesEarned: coursesCompleted, // Assuming 1 cert per course
                courseBreakdown: await this._getCourseBreakdown(userId, courseIds)
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting learner overview:', error);
            throw error;
        }
    }

    async getLearnerCourseReport(userId, courseId, dateRange = null) {
        // Implementation similar to above but course-specific
        // ...
    }

    // Trainer Reports
    async getTrainerLearnerOverview(trainerId, filters = {}) {
        // Get assigned learners
        const { data: learners } = await supabaseClient
            .from('users')
            .select('id, full_name, email, learner_type, created_at')
            .eq('trainer_id', trainerId)
            .eq('role', 'learner')
            .eq('learner_type', 'active');

        // Apply filters
        let filteredLearners = learners || [];
        
        if (filters.learnerType) {
            filteredLearners = filteredLearners.filter(l => l.learner_type === filters.learnerType);
        }

        if (filters.tags && filters.tags.length > 0) {
            const taggedUserIds = await tagService.getUsersByTags(filters.tags);
            filteredLearners = filteredLearners.filter(l => taggedUserIds.includes(l.id));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredLearners = filteredLearners.filter(l =>
                (l.full_name || '').toLowerCase().includes(searchTerm) ||
                (l.email || '').toLowerCase().includes(searchTerm)
            );
        }

        // Get performance data for each learner
        const learnerPerformance = await Promise.all(
            filteredLearners.map(async (learner) => {
                const overview = await this.getLearnerOverview(learner.id);
                return {
                    ...learner,
                    ...overview,
                    status: this._determineLearnerStatus(overview)
                };
            })
        );

        // Calculate summary statistics
        const summary = {
            totalLearners: learnerPerformance.length,
            activeLearners: learnerPerformance.filter(l => this._isActive(l)).length,
            atRiskLearners: learnerPerformance.filter(l => l.status === 'at_risk').length,
            averageCompletionRate: this._calculateAverage(learnerPerformance, 'overallProgress'),
            totalCoursesAllocated: learnerPerformance.reduce((sum, l) => sum + l.totalCourses, 0),
            totalLabsPending: await this._getTotalLabsPending(trainerId),
            averageLabScore: this._calculateAverage(learnerPerformance, 'averageLabScore')
        };

        return {
            summary,
            learners: learnerPerformance
        };
    }

    // Admin Reports
    async getSystemOverview(dateRange = null) {
        // Get system-wide statistics
        const { data: users } = await supabaseClient
            .from('users')
            .select('id, role, status, created_at');

        const { data: courses } = await courseService.getCourses();
        const { data: allocations } = await supabaseClient
            .from('course_allocations')
            .select('*')
            .eq('status', 'active');

        const { data: labSubmissions } = await supabaseClient
            .from('lab_submissions')
            .select('*');

        // Calculate metrics
        const totalUsers = users?.length || 0;
        const totalLearners = users?.filter(u => u.role === 'learner').length || 0;
        const totalTrainers = users?.filter(u => u.role === 'trainer').length || 0;
        const totalAdmins = users?.filter(u => u.role === 'admin').length || 0;
        const activeUsers = await this._getActiveUsers(dateRange);
        const totalCourses = courses?.length || 0;
        const publishedCourses = courses?.filter(c => c.published).length || 0;
        const totalAllocations = allocations?.length || 0;
        const totalLabSubmissions = labSubmissions?.length || 0;
        const averageCompletionRate = await this._calculateSystemCompletionRate();
        const averageLabScore = await this._calculateSystemAverageLabScore();

        return {
            totalUsers,
            totalLearners,
            totalTrainers,
            totalAdmins,
            activeUsers,
            totalCourses,
            publishedCourses,
            totalAllocations,
            totalLabSubmissions,
            averageCompletionRate,
            averageLabScore,
            trends: await this._getSystemTrends(dateRange),
            quickInsights: await this._getQuickInsights()
        };
    }

    // Helper methods
    async _getCoursesInProgress(userId, courseIds) {
        // Implementation
    }

    async _getCoursesCompleted(userId, courseIds) {
        // Implementation
    }

    async _getCourseBreakdown(userId, courseIds) {
        // Implementation
    }

    _determineLearnerStatus(overview) {
        if (overview.overallProgress >= 80) return 'on_track';
        if (overview.overallProgress >= 50) return 'needs_attention';
        return 'at_risk';
    }

    _isActive(learner) {
        // Check if learner has activity in last 30 days
        const lastActivity = learner.lastActivityDate;
        if (!lastActivity) return false;
        const daysSinceActivity = (Date.now() - new Date(lastActivity)) / (1000 * 60 * 60 * 24);
        return daysSinceActivity <= 30;
    }

    _calculateAverage(array, field) {
        if (!array || array.length === 0) return 0;
        const sum = array.reduce((acc, item) => acc + (item[field] || 0), 0);
        return sum / array.length;
    }

    // Export methods
    async exportReport(reportType, reportData, format = 'csv') {
        if (format === 'csv') {
            return this._exportToCSV(reportType, reportData);
        } else if (format === 'pdf') {
            return this._exportToPDF(reportType, reportData);
        }
        throw new Error(`Unsupported export format: ${format}`);
    }

    _exportToCSV(reportType, reportData) {
        // Implementation using CSV library
    }

    _exportToPDF(reportType, reportData) {
        // Implementation using PDF library
    }
}

export const reportService = new ReportService();
```

### 4.2 Tag Service Implementation

#### File: `lms/services/tag-service.js`

```javascript
import { supabaseClient } from './supabase-client.js';

class TagService {
    async createTag(name, description, color, createdBy) {
        const { data, error } = await supabaseClient
            .from('user_tags')
            .insert({
                name: name.trim(),
                description: description?.trim() || null,
                color: color || '#6366f1',
                created_by: createdBy
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create tag: ${error.message}`);
        return data;
    }

    async updateTag(tagId, updates) {
        const { data, error } = await supabaseClient
            .from('user_tags')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', tagId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update tag: ${error.message}`);
        return data;
    }

    async deleteTag(tagId) {
        // Delete assignments first (CASCADE should handle this, but explicit for clarity)
        await supabaseClient
            .from('user_tag_assignments')
            .delete()
            .eq('tag_id', tagId);

        const { error } = await supabaseClient
            .from('user_tags')
            .delete()
            .eq('id', tagId);

        if (error) throw new Error(`Failed to delete tag: ${error.message}`);
    }

    async getAllTags() {
        const { data, error } = await supabaseClient
            .from('user_tags')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw new Error(`Failed to get tags: ${error.message}`);
        return data || [];
    }

    async assignTagToUser(userId, tagId, assignedBy) {
        const { data, error } = await supabaseClient
            .from('user_tag_assignments')
            .insert({
                user_id: userId,
                tag_id: tagId,
                assigned_by: assignedBy
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                throw new Error('Tag already assigned to user');
            }
            throw new Error(`Failed to assign tag: ${error.message}`);
        }
        return data;
    }

    async removeTagFromUser(userId, tagId) {
        const { error } = await supabaseClient
            .from('user_tag_assignments')
            .delete()
            .eq('user_id', userId)
            .eq('tag_id', tagId);

        if (error) throw new Error(`Failed to remove tag: ${error.message}`);
    }

    async assignTagsToUsers(userIds, tagIds, assignedBy) {
        const assignments = [];
        for (const userId of userIds) {
            for (const tagId of tagIds) {
                assignments.push({
                    user_id: userId,
                    tag_id: tagId,
                    assigned_by: assignedBy
                });
            }
        }

        const { data, error } = await supabaseClient
            .from('user_tag_assignments')
            .insert(assignments)
            .select();

        if (error) throw new Error(`Failed to assign tags: ${error.message}`);
        return data;
    }

    async getUserTags(userId) {
        const { data, error } = await supabaseClient
            .from('user_tag_assignments')
            .select(`
                tag_id,
                user_tags (*)
            `)
            .eq('user_id', userId);

        if (error) throw new Error(`Failed to get user tags: ${error.message}`);
        return (data || []).map(item => item.user_tags);
    }

    async getUsersByTags(tagIds) {
        const { data, error } = await supabaseClient
            .from('user_tag_assignments')
            .select('user_id')
            .in('tag_id', tagIds);

        if (error) throw new Error(`Failed to get users by tags: ${error.message}`);
        return [...new Set((data || []).map(item => item.user_id))];
    }

    async getTagUsageStats() {
        const { data, error } = await supabaseClient
            .from('user_tag_assignments')
            .select(`
                tag_id,
                user_tags (id, name)
            `);

        if (error) throw new Error(`Failed to get tag usage stats: ${error.message}`);

        const stats = {};
        (data || []).forEach(item => {
            const tagName = item.user_tags?.name || 'Unknown';
            stats[tagName] = (stats[tagName] || 0) + 1;
        });

        return stats;
    }
}

export const tagService = new TagService();
```

---

## Component Architecture

### 5.1 Learner Dashboard Component

#### File: `lms/components/reports/learner-reports/learner-dashboard.js`

```javascript
import { reportService } from '../../../services/report-service.js';
import { authService } from '../../../services/auth-service.js';
import ReportFilters from '../shared/report-filters.js';
import ReportCharts from '../shared/report-charts.js';
import ExportOptions from '../shared/export-options.js';

class LearnerDashboard {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.reportData = null;
        this.dateRange = {
            from: null,
            to: null
        };
    }

    async init() {
        this.currentUser = await authService.getCurrentUser();
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }
        await this.loadData();
        this.render();
    }

    async loadData() {
        try {
            this.reportData = await reportService.getLearnerOverview(
                this.currentUser.id,
                this.dateRange
            );
        } catch (error) {
            console.error('[LearnerDashboard] Error loading data:', error);
            this.showError('Failed to load report data');
        }
    }

    render() {
        if (!this.reportData) {
            this.container.innerHTML = '<div class="loading">Loading...</div>';
            return;
        }

        this.container.innerHTML = `
            <div class="learner-report-dashboard">
                <div class="report-header">
                    <h1>My Performance Report</h1>
                    <div class="report-actions">
                        ${new ExportOptions().render(this.reportData, 'learner_overview')}
                    </div>
                </div>

                <div class="report-filters-section">
                    ${new ReportFilters().render({
                        dateRange: true,
                        period: true
                    }, this.dateRange, (filters) => this.applyFilters(filters))}
                </div>

                <div class="statistics-cards">
                    ${this.renderStatisticsCards()}
                </div>

                <div class="charts-section">
                    <div class="chart-container">
                        <h2>Progress Over Time</h2>
                        ${new ReportCharts().renderLineChart(
                            'progress-trend',
                            await this.getProgressTrendData()
                        )}
                    </div>
                </div>

                <div class="course-breakdown-section">
                    <h2>Course Breakdown</h2>
                    ${this.renderCourseBreakdown()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderStatisticsCards() {
        const { reportData } = this;
        return `
            <div class="stat-card">
                <div class="stat-label">Total Courses</div>
                <div class="stat-value">${reportData.totalCourses}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">In Progress</div>
                <div class="stat-value">${reportData.coursesInProgress}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Completed</div>
                <div class="stat-value">${reportData.coursesCompleted}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Overall Progress</div>
                <div class="stat-value">${reportData.overallProgress.toFixed(1)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Labs Submitted</div>
                <div class="stat-value">${reportData.labsSubmitted}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lab Score</div>
                <div class="stat-value">${reportData.averageLabScore?.toFixed(1) || 'N/A'}</div>
            </div>
        `;
    }

    renderCourseBreakdown() {
        return `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Course</th>
                        <th>Progress</th>
                        <th>Status</th>
                        <th>Last Accessed</th>
                        <th>Labs</th>
                        <th>Avg Score</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.reportData.courseBreakdown.map(course => `
                        <tr>
                            <td>${this.escapeHtml(course.name)}</td>
                            <td>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${course.progress}%"></div>
                                </div>
                                <span>${course.progress}%</span>
                            </td>
                            <td><span class="status-badge status-${course.status}">${course.status}</span></td>
                            <td>${this.formatDate(course.lastAccessed)}</td>
                            <td>${course.labsSubmitted}/${course.totalLabs}</td>
                            <td>${course.averageScore?.toFixed(1) || 'N/A'}</td>
                            <td>
                                <a href="#/reports/learner/course/${course.id}" class="btn btn-sm btn-primary">
                                    View Details
                                </a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async applyFilters(filters) {
        this.dateRange = filters.dateRange || this.dateRange;
        await this.loadData();
        this.render();
    }

    attachEventListeners() {
        // Event listeners for filters, exports, etc.
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString();
    }

    showError(message) {
        // Error display logic
    }
}

export default LearnerDashboard;
```

---

## Data Flow

### 6.1 Learner Report Data Flow

```
User Action (View Dashboard)
    ↓
LearnerDashboard.init()
    ↓
reportService.getLearnerOverview(userId, dateRange)
    ↓
┌─────────────────────────────────────┐
│  Data Aggregation:                  │
│  1. Get course allocations         │
│  2. Get user progress              │
│  3. Get lab submissions            │
│  4. Calculate metrics              │
│  5. Cache result                   │
└─────────────────────────────────────┘
    ↓
analyticsService.calculateMetrics()
    ↓
Return aggregated data
    ↓
LearnerDashboard.render()
    ↓
Display charts, tables, statistics
```

### 6.2 Trainer Report Data Flow

```
User Action (View Learner Performance)
    ↓
TrainerDashboard.init()
    ↓
reportService.getTrainerLearnerOverview(trainerId, filters)
    ↓
┌─────────────────────────────────────┐
│  1. Get assigned learners           │
│  2. Apply filters (type, tags, etc) │
│  3. For each learner:               │
│     - Get overview data             │
│     - Calculate status              │
│  4. Calculate summary statistics    │
└─────────────────────────────────────┘
    ↓
Return learner performance data
    ↓
TrainerDashboard.render()
    ↓
Display table with filters
```

### 6.3 Tag Management Data Flow

```
Admin Action (Create Tag)
    ↓
TagManagement.createTag()
    ↓
tagService.createTag(name, description, color, createdBy)
    ↓
Insert into user_tags table
    ↓
Return tag data
    ↓
Update UI (tag list)
```

---

## API Design

### 7.1 Service Method Signatures

All service methods follow this pattern:
- **Input**: Clear parameters with types
- **Output**: Consistent data structure
- **Error Handling**: Throws errors with descriptive messages
- **Caching**: Where appropriate

### 7.2 Data Structures

#### Learner Overview Response
```javascript
{
    totalCourses: number,
    coursesInProgress: number,
    coursesCompleted: number,
    overallProgress: number, // percentage
    chaptersCompleted: number,
    labsSubmitted: number,
    averageLabScore: number,
    certificatesEarned: number,
    courseBreakdown: [
        {
            id: string,
            name: string,
            progress: number,
            status: 'not_started' | 'in_progress' | 'completed',
            lastAccessed: ISO8601,
            labsSubmitted: number,
            totalLabs: number,
            averageScore: number
        }
    ]
}
```

#### Trainer Learner Overview Response
```javascript
{
    summary: {
        totalLearners: number,
        activeLearners: number,
        atRiskLearners: number,
        averageCompletionRate: number,
        totalCoursesAllocated: number,
        totalLabsPending: number,
        averageLabScore: number
    },
    learners: [
        {
            id: string,
            full_name: string,
            email: string,
            learner_type: string,
            totalCourses: number,
            overallProgress: number,
            coursesCompleted: number,
            labsSubmitted: number,
            averageLabScore: number,
            lastActivityDate: ISO8601,
            status: 'on_track' | 'needs_attention' | 'at_risk'
        }
    ]
}
```

---

## Performance Considerations

### 8.1 Caching Strategy

1. **In-Memory Cache**: Service-level caching for frequently accessed reports (5-minute TTL)
2. **Database Cache**: Optional `report_cache` table for expensive aggregations
3. **Client-Side Cache**: Browser localStorage for user preferences

### 8.2 Query Optimization

1. **Indexes**: All foreign keys and frequently queried columns indexed
2. **Database Views**: Pre-aggregated views for common queries
3. **Pagination**: Large result sets paginated
4. **Lazy Loading**: Charts and visualizations loaded on demand

### 8.3 Data Aggregation

1. **Batch Processing**: Aggregate multiple learners in parallel
2. **Incremental Updates**: Update only changed data
3. **Background Jobs**: Pre-calculate expensive metrics (future)

---

## Security Design

### 9.1 Access Control

1. **Role-Based**: Each service method checks user role
2. **Data Isolation**: Learners only see their own data
3. **Trainer Scope**: Trainers only see assigned learners
4. **Admin Access**: Admins can see all data

### 9.2 Service-Level Security

```javascript
// Example: Trainer can only access their learners
async getIndividualLearnerReport(trainerId, learnerId, dateRange) {
    // Verify trainer has access to this learner
    const { data: learner } = await supabaseClient
        .from('users')
        .select('trainer_id')
        .eq('id', learnerId)
        .single();

    if (learner.trainer_id !== trainerId) {
        throw new Error('Access denied: Learner not assigned to trainer');
    }

    // Proceed with report generation
    // ...
}
```

---

## Implementation Details

### 10.1 File Structure

```
lms/
├── components/
│   └── reports/
│       ├── learner-reports/
│       ├── trainer-reports/
│       ├── admin-reports/
│       └── shared/
├── services/
│   ├── report-service.js
│   ├── tag-service.js
│   └── analytics-service.js
└── styles/
    └── reports.css
```

### 10.2 Dependencies

**External Libraries**:
- Chart.js (or D3.js) for visualizations
- date-fns for date manipulation
- jsPDF for PDF export
- papaparse for CSV export

**Internal Dependencies**:
- supabase-client.js
- auth-service.js
- course-service.js
- course-allocation-service.js
- lab-submission-service.js
- user-service.js

### 10.3 Routing

Add routes in `index.html`:
```javascript
// Learner Reports
router.addRoute('/reports/learner', async () => {
    const { default: LearnerDashboard } = await import('./lms/components/reports/learner-reports/learner-dashboard.js');
    const dashboard = new LearnerDashboard(container);
    await dashboard.init();
});

router.addRoute('/reports/learner/course/:courseId', async () => {
    const { default: LearnerCourseReport } = await import('./lms/components/reports/learner-reports/learner-course-report.js');
    const report = new LearnerCourseReport(container, route.params.courseId);
    await report.init();
});

// Trainer Reports
router.addRoute('/reports/trainer', async () => {
    const { default: TrainerDashboard } = await import('./lms/components/reports/trainer-reports/trainer-dashboard.js');
    const dashboard = new TrainerDashboard(container);
    await dashboard.init();
});

// Admin Reports
router.addRoute('/reports/admin', async () => {
    const { default: AdminDashboard } = await import('./lms/components/reports/admin-reports/admin-dashboard.js');
    const dashboard = new AdminDashboard(container);
    await dashboard.init();
});
```

---

## Next Steps

1. **Create Database Migration**: Implement SQL for new tables
2. **Implement Services**: Start with report-service.js and tag-service.js
3. **Create Shared Components**: Build reusable filter, chart, and table components
4. **Implement Role-Specific Components**: Start with learner dashboard
5. **Add Routing**: Integrate report routes
6. **Testing**: Unit tests for services, integration tests for components

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-29 | System Design Team | Initial design document |

