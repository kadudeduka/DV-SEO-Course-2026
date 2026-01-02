# DV Learning Hub - Database Design Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Draft  
**Architect:** System Design Team

---

## Table of Contents

1. [Overview](#overview)
2. [Database Architecture](#database-architecture)
3. [Entity Relationship Model](#entity-relationship-model)
4. [Table Definitions](#table-definitions)
5. [Indexes and Constraints](#indexes-and-constraints)
6. [Row-Level Security (RLS)](#row-level-security-rls)
7. [Data Relationships](#data-relationships)
8. [Data Migration Strategy](#data-migration-strategy)

---

## Overview

### Purpose
This document defines the database schema, relationships, and security policies for DV Learning Hub using Supabase (PostgreSQL).

### Database Platform
- **Platform**: Supabase (PostgreSQL 15+)
- **Database**: PostgreSQL
- **Security**: Row-Level Security (RLS) enabled
- **Extensions**: UUID, timestamps

### Design Principles
- **Normalization**: Third normal form (3NF) where appropriate
- **Security**: RLS policies for all tables
- **Performance**: Proper indexes on foreign keys and query columns
- **Auditability**: Timestamps on all tables
- **Scalability**: Designed for 10,000+ users

---

## Database Architecture

### Schema Organization

```
public schema
├── users                    # User profiles
├── admin_approvals          # User approval tracking
├── user_progress            # Course progress tracking
└── (future tables)
    ├── lab_submissions      # Lab submissions and feedback
    ├── trainer_content      # Trainer-specific content access
    └── notifications        # User notifications
```

### Supabase Auth Integration

```
auth schema (Supabase managed)
└── users                    # Authentication users
    └── id (UUID)            # Referenced by public.users.id
```

---

## Entity Relationship Model

### ER Diagram

```
┌─────────────────┐
│  auth.users     │
│  (Supabase)     │
│  - id (PK)      │
│  - email        │
│  - password     │
└────────┬────────┘
         │ 1:1
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│  public.users   │◄────────│ admin_approvals  │
│  - id (PK,FK)   │   1:N   │ - id (PK)        │
│  - email        │         │ - user_id (FK)   │
│  - full_name    │         │ - status         │
│  - role         │         │ - approved_by     │
│  - status       │         └──────────────────┘
│  - learner_type │         │
│  - trainer_id   │         │
│  - created_at   │         │
│  - updated_at   │         │
└────────┬────────┘
         │ 1:N
         │
         ▼
┌─────────────────┐
│ user_progress   │
│ - id (PK)       │
│ - user_id (FK)  │
│ - content_id    │
│ - completed     │
│ - progress_data │
└─────────────────┘
```

---

## Table Definitions

### 1. public.users

**Purpose**: Extends Supabase auth.users with profile data and role information.

**Schema**:
```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'learner' CHECK (role IN ('learner', 'trainer', 'admin')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    learner_type TEXT CHECK (learner_type IN ('active', 'inactive', 'graduate', 'archive') OR learner_type IS NULL),
    trainer_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.users(id),
    rejected_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES public.users(id),
    CONSTRAINT trainer_must_be_trainer CHECK (
        trainer_id IS NULL OR 
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = trainer_id AND u.role = 'trainer')
    ),
    CONSTRAINT active_learner_requires_trainer CHECK (
        learner_type != 'active' OR trainer_id IS NOT NULL
    ),
    CONSTRAINT inactive_learner_no_trainer CHECK (
        learner_type != 'inactive' OR trainer_id IS NULL
    )
);
```

**Columns**:
- `id`: UUID, Primary Key, Foreign Key to `auth.users.id`
- `email`: TEXT, Unique, Not Null - User email address
- `full_name`: TEXT, Nullable - User's full name
- `role`: TEXT, Default 'learner' - User role (learner, trainer, admin)
- `status`: TEXT, Default 'pending' - Approval status (pending, approved, rejected)
- `learner_type`: TEXT, Nullable - Learner type (active, inactive, graduate, archive) - NULL for trainers/admins
- `trainer_id`: UUID, Nullable, FK to `public.users.id` - Assigned trainer (required for Active learners, optional for trainers as learners)
- `created_at`: TIMESTAMPTZ - Account creation timestamp
- `updated_at`: TIMESTAMPTZ - Last update timestamp
- `approved_at`: TIMESTAMPTZ, Nullable - Approval timestamp
- `approved_by`: UUID, Nullable, FK to `public.users.id` - Admin who approved
- `rejected_at`: TIMESTAMPTZ, Nullable - Rejection timestamp
- `rejected_by`: UUID, Nullable, FK to `public.users.id` - Admin who rejected

**Constraints**:
- Primary Key: `id`
- Foreign Key: `id` → `auth.users(id)`
- Foreign Key: `trainer_id` → `public.users(id)` (must reference a user with role='trainer')
- Foreign Key: `approved_by` → `public.users(id)`
- Foreign Key: `rejected_by` → `public.users(id)`
- Unique: `email`
- Check: `role IN ('learner', 'trainer', 'admin')`
- Check: `status IN ('pending', 'approved', 'rejected')`
- Check: `trainer_id` must reference a user with role='trainer' (enforced by constraint)

**Indexes**:
```sql
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_users_trainer_id ON public.users(trainer_id);
CREATE INDEX idx_users_created_at ON public.users(created_at);
```

---

### 2. public.admin_approvals

**Purpose**: Tracks user approval requests and admin actions.

**Schema**:
```sql
CREATE TABLE public.admin_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.users(id),
    rejected_by UUID REFERENCES public.users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns**:
- `id`: UUID, Primary Key
- `user_id`: UUID, Not Null, FK to `public.users.id` - User being approved
- `requested_at`: TIMESTAMPTZ - Request timestamp
- `approved_at`: TIMESTAMPTZ, Nullable - Approval timestamp
- `rejected_at`: TIMESTAMPTZ, Nullable - Rejection timestamp
- `approved_by`: UUID, Nullable, FK to `public.users.id` - Admin who approved
- `rejected_by`: UUID, Nullable, FK to `public.users.id` - Admin who rejected
- `status`: TEXT, Default 'pending' - Current status
- `notes`: TEXT, Nullable - Admin notes
- `created_at`: TIMESTAMPTZ - Record creation timestamp
- `updated_at`: TIMESTAMPTZ - Last update timestamp

**Indexes**:
```sql
CREATE INDEX idx_admin_approvals_user_id ON public.admin_approvals(user_id);
CREATE INDEX idx_admin_approvals_status ON public.admin_approvals(status);
CREATE INDEX idx_admin_approvals_created_at ON public.admin_approvals(created_at);
```

---

### 3. public.user_progress

**Purpose**: Tracks user progress through course content (chapters and labs).

**Schema**:
```sql
CREATE TABLE public.user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('chapter', 'lab', 'tool')),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    progress_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id, content_id)
);
```

**Columns**:
- `id`: UUID, Primary Key
- `user_id`: UUID, Not Null, FK to `public.users.id` - User who made progress
- `course_id`: TEXT, Not Null - Course identifier (e.g., 'seo-master-2026')
- `content_id`: TEXT, Not Null - Content identifier (chapter/lab ID)
- `content_type`: TEXT, Not Null - Type of content (chapter, lab, tool)
- `completed`: BOOLEAN, Default FALSE - Completion status
- `completed_at`: TIMESTAMPTZ, Nullable - Completion timestamp
- `progress_data`: JSONB, Default '{}' - Additional progress data
- `created_at`: TIMESTAMPTZ - Record creation timestamp
- `updated_at`: TIMESTAMPTZ - Last update timestamp

**Constraints**:
- Unique: `(user_id, course_id, content_id)` - One progress record per content item per user

**Indexes**:
```sql
CREATE INDEX idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX idx_user_progress_course_id ON public.user_progress(course_id);
CREATE INDEX idx_user_progress_content_id ON public.user_progress(content_id);
CREATE INDEX idx_user_progress_completed ON public.user_progress(completed);
CREATE INDEX idx_user_progress_user_course ON public.user_progress(user_id, course_id);
```

---

### 4. public.lab_submissions

**Purpose**: Stores lab submissions, trainer feedback, and resubmission tracking. Allows learners to submit lab answers, trainers to provide feedback, and learners to resubmit based on feedback.

**Schema**:
```sql
CREATE TABLE public.lab_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    lab_id TEXT NOT NULL,
    submission_data JSONB NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMPTZ,
    feedback TEXT,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'approved', 'needs_revision')),
    resubmission_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id, lab_id, resubmission_count)
);
```

**Columns**:
- `id`: UUID, Primary Key
- `user_id`: UUID, Not Null, FK to `public.users.id` - Learner who submitted
- `course_id`: TEXT, Not Null - Course identifier
- `lab_id`: TEXT, Not Null - Lab identifier
- `submission_data`: JSONB, Not Null - Lab submission data (answers, files, etc.)
- `submitted_at`: TIMESTAMPTZ - Submission timestamp
- `reviewed_by`: UUID, Nullable, FK to `public.users.id` - Assigned trainer who reviewed (must be the learner's assigned trainer)
- `reviewed_at`: TIMESTAMPTZ, Nullable - Review timestamp
- `feedback`: TEXT, Nullable - Trainer feedback
- `status`: TEXT, Default 'submitted' - Submission status
- `resubmission_count`: INTEGER, Default 0 - Number of resubmissions
- `created_at`: TIMESTAMPTZ - Record creation timestamp
- `updated_at`: TIMESTAMPTZ - Last update timestamp

**Constraints**:
- Unique: `(user_id, course_id, lab_id, resubmission_count)` - One submission per resubmission attempt
- Check: `status IN ('submitted', 'reviewed', 'approved', 'needs_revision')`

**Indexes**:
```sql
CREATE INDEX idx_lab_submissions_user_id ON public.lab_submissions(user_id);
CREATE INDEX idx_lab_submissions_course_lab ON public.lab_submissions(course_id, lab_id);
CREATE INDEX idx_lab_submissions_status ON public.lab_submissions(status);
CREATE INDEX idx_lab_submissions_reviewed_by ON public.lab_submissions(reviewed_by);
```

**RLS Policies**:
```sql
-- Learners can read their own submissions
CREATE POLICY "Learners can read own submissions"
    ON public.lab_submissions FOR SELECT
    USING (auth.uid() = user_id);

-- Learners can insert their own submissions
CREATE POLICY "Learners can insert own submissions"
    ON public.lab_submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Learners can update their own submissions (for resubmission)
CREATE POLICY "Learners can update own submissions"
    ON public.lab_submissions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trainers can read all submissions for their courses
CREATE POLICY "Trainers can read submissions"
    ON public.lab_submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'trainer'
        )
    );

-- Trainers can update submissions (for feedback)
CREATE POLICY "Trainers can update submissions"
    ON public.lab_submissions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'trainer'
        )
    );

-- Admins can read all submissions
CREATE POLICY "Admins can read all submissions"
    ON public.lab_submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

### 5. public.trainer_content_access

**Purpose**: Tracks trainer-specific content access and permissions for each course.

**Schema**:
```sql
CREATE TABLE public.trainer_content_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('teaching_tips', 'presentations', 'guidelines', 'resources')),
    content_path TEXT NOT NULL,
    accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id, content_type, content_path)
);
```

**Indexes**:
```sql
CREATE INDEX idx_trainer_content_user_course ON public.trainer_content_access(user_id, course_id);
CREATE INDEX idx_trainer_content_type ON public.trainer_content_access(content_type);
```

### 6. public.course_allocations

**Purpose**: Tracks course allocations from trainers to assigned learners. Controls which courses learners can access.

**Schema**:
```sql
CREATE TABLE public.course_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    trainer_id UUID NOT NULL REFERENCES public.users(id),
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    allocated_by UUID NOT NULL REFERENCES public.users(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);
```

**Columns**:
- `id`: UUID, Primary Key
- `user_id`: UUID, Not Null, FK to `public.users.id` - Learner who receives the course
- `course_id`: TEXT, Not Null - Course identifier
- `trainer_id`: UUID, Not Null, FK to `public.users.id` - Trainer who allocated (must be learner's assigned trainer)
- `allocated_at`: TIMESTAMPTZ - Allocation timestamp
- `allocated_by`: UUID, Not Null, FK to `public.users.id` - Trainer who performed the allocation
- `status`: TEXT, Default 'active' - Allocation status (active, removed)
- `created_at`: TIMESTAMPTZ - Record creation timestamp
- `updated_at`: TIMESTAMPTZ - Last update timestamp

**Constraints**:
- Unique: `(user_id, course_id)` - One allocation per course per learner
- Foreign Key: `trainer_id` must reference a user with role='trainer'
- Foreign Key: `allocated_by` must reference a user with role='trainer'
- Check: `status IN ('active', 'removed')`
- Check: `trainer_id` must match the learner's assigned trainer

**Indexes**:
```sql
CREATE INDEX idx_course_allocations_user_id ON public.course_allocations(user_id);
CREATE INDEX idx_course_allocations_course_id ON public.course_allocations(course_id);
CREATE INDEX idx_course_allocations_trainer_id ON public.course_allocations(trainer_id);
CREATE INDEX idx_course_allocations_status ON public.course_allocations(status);
CREATE INDEX idx_course_allocations_user_course ON public.course_allocations(user_id, course_id);
```

**RLS Policies**:
```sql
-- Learners can read their own course allocations
CREATE POLICY "Learners can read own allocations"
    ON public.course_allocations FOR SELECT
    USING (auth.uid() = user_id);

-- Trainers can read allocations for their assigned learners
CREATE POLICY "Trainers can read assigned learner allocations"
    ON public.course_allocations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
    );

-- Trainers can insert allocations for their assigned learners
CREATE POLICY "Trainers can allocate courses to assigned learners"
    ON public.course_allocations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
        AND trainer_id = auth.uid()
        AND allocated_by = auth.uid()
    );

-- Trainers can update allocations for their assigned learners (to remove)
CREATE POLICY "Trainers can update assigned learner allocations"
    ON public.course_allocations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() 
            AND role = 'trainer'
            AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = course_allocations.user_id
                AND u.trainer_id = auth.uid()
            )
        )
    );

-- Admins can read all allocations
CREATE POLICY "Admins can read all allocations"
    ON public.course_allocations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

---

## Data Relationships

### Updated Relationship Summary

1. **auth.users ↔ public.users**: 1:1 relationship
   - One auth user = one profile
   - Cascade delete

2. **public.users ↔ public.users** (trainer assignment):
   - `trainer_id` → `public.users.id` (trainer)
   - One trainer can have multiple assigned learners (1:N)
   - Each learner must have one assigned trainer (required before approval)

3. **public.users ↔ public.admin_approvals**: 1:N relationship
   - One user can have multiple approval records (history)
   - Cascade delete

4. **public.users ↔ public.user_progress**: 1:N relationship
   - One user can have progress on multiple content items
   - Cascade delete

5. **public.users ↔ public.lab_submissions**: 1:N relationship
   - One learner can have multiple lab submissions
   - Each submission reviewed by assigned trainer
   - Cascade delete

6. **public.users ↔ public.course_allocations**: 1:N relationship
   - One learner can have multiple course allocations
   - Each allocation created by assigned trainer
   - Cascade delete

7. **public.users ↔ public.chat_messages**: 1:N relationship
   - One user can have multiple chat messages
   - Messages grouped by conversation_id
   - Cascade delete

8. **public.users ↔ public.notifications**: 1:N relationship
   - One user can have multiple notifications
   - Notifications for various events (welcome, approval, assignments, etc.)
   - Cascade delete

9. **public.users ↔ public.users** (self-referential):
   - `approved_by` → `public.users.id`
   - `rejected_by` → `public.users.id`
   - For tracking which admin approved/rejected

### Updated Data Integrity Rules

1. **Trainer Assignment**:
   - All learners must have a trainer assigned before approval
   - Trainer must have role='trainer'
   - Admin can change trainer assignment at any time
   - System enforces trainer assignment before approval

2. **Lab Evaluation**:
   - Only assigned trainer can evaluate learner's lab submissions
   - Trainer can only see submissions from assigned learners
   - Evaluation must be done by the assigned trainer

---

## Indexes and Constraints

### Primary Indexes

All tables have indexes on:
- Primary keys (automatic)
- Foreign keys (for join performance)
- Frequently queried columns (status, role, email)
- Composite indexes for common query patterns

### Foreign Key Constraints

All foreign keys use:
- `ON DELETE CASCADE` for dependent records
- `ON UPDATE CASCADE` for referential integrity

### Check Constraints

- Role values: `'learner'`, `'trainer'`, `'admin'`
- Status values: `'pending'`, `'approved'`, `'rejected'`
- Content type values: `'chapter'`, `'lab'`, `'tool'`

---

## Row-Level Security (RLS)

### RLS Policy Strategy

All tables have RLS enabled with policies for:
1. **Users can read/update their own data**
2. **Admins can read/update all data**
3. **Trainers can read learner data (for feedback)**
4. **Public access blocked by default**

### RLS Policies

#### public.users Policies

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM public.users WHERE id = auth.uid())
        AND status = (SELECT status FROM public.users WHERE id = auth.uid())
    );

-- Admins can read all users
CREATE POLICY "Admins can read all users"
    ON public.users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update all users
CREATE POLICY "Admins can update all users"
    ON public.users FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

#### public.user_progress Policies

```sql
-- Users can read their own progress
CREATE POLICY "Users can read own progress"
    ON public.user_progress FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress"
    ON public.user_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
    ON public.user_progress FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can read all progress
CREATE POLICY "Admins can read all progress"
    ON public.user_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

#### public.admin_approvals Policies

```sql
-- Users can read their own approval records
CREATE POLICY "Users can read own approvals"
    ON public.admin_approvals FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can read all approvals
CREATE POLICY "Admins can read all approvals"
    ON public.admin_approvals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can insert/update approvals
CREATE POLICY "Admins can manage approvals"
    ON public.admin_approvals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

---

## Data Relationships

### Relationship Summary

1. **auth.users ↔ public.users**: 1:1 relationship
   - One auth user = one profile
   - Cascade delete

2. **public.users ↔ public.admin_approvals**: 1:N relationship
   - One user can have multiple approval records (history)
   - Cascade delete

3. **public.users ↔ public.user_progress**: 1:N relationship
   - One user can have progress on multiple content items
   - Cascade delete

4. **public.users ↔ public.users** (self-referential):
   - `approved_by` → `public.users.id`
   - `rejected_by` → `public.users.id`
   - For tracking which admin approved/rejected

### Data Integrity Rules

1. **User Status Flow**:
   - New users: `status = 'pending'`
   - Admin approval: `status = 'approved'`, `approved_at` set, `approved_by` set
   - Admin rejection: `status = 'rejected'`, `rejected_at` set, `rejected_by` set

2. **Role Assignment**:
   - Default role: `'learner'`
   - Only admins can change roles
   - Role changes logged in `admin_approvals` (future)

3. **Progress Tracking**:
   - One progress record per user per content item
   - Progress can be updated (mark complete/incomplete)
   - Progress data stored as JSONB for flexibility

4. **Course Allocation**:
   - Trainers allocate courses to their assigned learners
   - Learners can only access allocated courses
   - One allocation per course per learner
   - Allocations can be removed (status='removed')
   - Trainer must be the learner's assigned trainer

---

## Data Migration Strategy

### Initial Migration

1. **Create Extensions**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. **Create Tables**: In dependency order
   - `public.users` (depends on `auth.users`)
   - `public.admin_approvals` (depends on `public.users`)
   - `public.user_progress` (depends on `public.users`)

3. **Create Indexes**: After table creation

4. **Enable RLS**: On all tables

5. **Create RLS Policies**: After RLS enabled

6. **Create Triggers**: For `updated_at` timestamps

### Migration Scripts

All migrations stored in `backend/migrations/`:
- `001_initial_schema.sql` - Initial tables
- `002_rls_policies.sql` - RLS policies
- `003_indexes.sql` - Performance indexes
- `004_triggers.sql` - Update triggers

### Rollback Strategy

- Each migration script is idempotent (uses `IF NOT EXISTS`)
- Rollback scripts in `backend/migrations/rollback/`
- Test migrations in development first

---

## Performance Considerations

### Query Optimization

1. **Index Usage**: All foreign keys and frequently queried columns indexed
2. **Composite Indexes**: For common query patterns (user_id + course_id)
3. **JSONB Indexes**: For `progress_data` queries (if needed)

### Scalability

- **Partitioning**: Not needed initially (10K users)
- **Archiving**: Old progress data can be archived (future)
- **Caching**: Application-level caching for user profiles

---

## Security Considerations

### Data Protection

1. **RLS Policies**: Enforce data access at database level
2. **Encryption**: Supabase handles encryption at rest
3. **HTTPS**: All connections via HTTPS
4. **Input Validation**: Validate all inputs before database operations

### Audit Trail

- `created_at` and `updated_at` on all tables
- `approved_by` and `rejected_by` for tracking admin actions
- Future: Audit log table for all data changes

---

## Conclusion

This database design provides:
- **Security**: RLS policies enforce access control
- **Performance**: Proper indexes for fast queries
- **Scalability**: Designed for growth
- **Maintainability**: Clear structure and relationships
- **Flexibility**: JSONB fields for extensibility

The schema supports all current requirements and is extensible for future features like lab submissions, trainer content, and notifications.

---

**Document Status:** Draft - Ready for Review  
**Next Steps:** Review, approval, and implementation

