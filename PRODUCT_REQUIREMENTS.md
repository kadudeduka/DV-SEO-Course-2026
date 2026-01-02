# DV Learning Hub - Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Draft  
**Product Manager:** System Design Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [User Roles and Personas](#user-roles-and-personas)
4. [Functional Requirements](#functional-requirements)
5. [Non-Functional Requirements](#non-functional-requirements)
6. [Technical Architecture](#technical-architecture)
7. [Data Structure Requirements](#data-structure-requirements)
8. [File Structure Requirements](#file-structure-requirements)
9. [Security Requirements](#security-requirements)
10. [UI/UX Requirements](#uiux-requirements)
11. [Integration Requirements](#integration-requirements)
12. [Testing Requirements](#testing-requirements)
13. [Deployment Requirements](#deployment-requirements)
14. [Future Enhancements](#future-enhancements)

---

## Executive Summary

**DV Learning Hub** is a Learning Management System (LMS) designed to deliver multiple courses to learners with role-based access control, admin approval workflows, and comprehensive progress tracking. The system is built as a static frontend application that connects to Supabase as a Backend-as-a-Service (BaaS) for authentication, user management, and data persistence.

### Key Objectives
- Provide a scalable platform for hosting multiple courses
- Implement secure authentication and authorization
- Enable admin-controlled user approval and role management
- Support role-based content access (Learner, Trainer, Admin)
- Track user progress across courses
- Maintain a clean, maintainable codebase with proper separation of concerns

---

## System Overview

### Current System Description
The system is a single-page application (SPA) built with vanilla JavaScript, HTML, and CSS. It uses Supabase for backend services and is designed to be deployed on GitHub Pages or similar static hosting.

### System Goals
1. **Multi-Course Support**: Host and manage multiple courses from a single platform
2. **User Management**: Secure registration, authentication, and role-based access
3. **Content Delivery**: Structured course content with chapters, labs, and resources
4. **Progress Tracking**: Track user progress through courses
5. **Admin Control**: Comprehensive admin dashboard for user and course management

### Key Constraints
- Must work as a static site (no server-side rendering)
- Must support GitHub Pages deployment
- Must use Supabase for backend services
- Must maintain backward compatibility during redesign

---

## User Roles and Personas

### 1. Learner
**Description:** Primary end-user who accesses course content

**Learner Types:**
1. **Active Learners:**
   - Have incomplete courses they are currently learning
   - Have an assigned trainer
   - Can submit labs for evaluation
   - Can view courses assigned to them
   - Appear in trainer interface for lab evaluation
   - Can access DV Coach AI chatbot
   - Receive notifications

2. **Inactive Learners:**
   - Marked inactive by admin due to various reasons
   - Do NOT have an assigned trainer
   - Can view courses (read-only access)
   - Cannot submit labs for evaluation
   - Removed from trainer interface (not visible to trainers)
   - Cannot access DV Coach AI chatbot
   - Limited notifications

3. **Graduate Learners:**
   - Have completed all courses assigned to them
   - Have taken certification (manually marked by admin)
   - May or may not have an assigned trainer (depending on admin decision)
   - Can view completed courses
   - Cannot submit new labs
   - May appear in trainer interface for historical data only
   - Can access DV Coach AI chatbot
   - Receive completion notifications

4. **Archive Learners:**
   - Old users who no longer have access to the system
   - Marked as archived by admin
   - Cannot log in to the system
   - Cannot view courses
   - Removed from all active interfaces
   - Data retained for historical purposes

**Capabilities:**
- Register for an account
- Log in to the system (except Archive learners)
- View available courses (based on learner type)
- Access approved course content (chapters, labs) - Active learners only
- Can submit labs answersheet for evaluation, view feedback from trainer, option to resubmit - Active learners only
- Track personal progress
- Access DV Coach AI chatbot for course-related questions (Active and Graduate learners)
- Receive email notifications (welcome, course assignments, lab feedback, etc.)
- View in-app notifications
- Cannot access trainer-only content
- Cannot access admin features

**Status Flow:**
- `pending` → Cannot log in, sees approval message
- `approved` → Can log in and access content (becomes Active Learner by default)
- `rejected` → Cannot log in, sees rejection message

**Learner Type Management:**
- Admin can change learner type through admin dashboard
- Learner type affects access, trainer assignment, and visibility in trainer interface
- Active learners require a trainer assignment
- Inactive learners cannot have a trainer assignment

### 2. Trainer
**Description:** Advanced user with access to trainer-specific content and responsible for evaluating learner lab submissions

**Capabilities:**
- All Learner capabilities (can participate as learners)
- Access ALL courses available in the system (not limited to assigned courses)
- Access trainer-only content sections for each course, like teaching tips, guidelines, presentations etc.
- View trainer-specific resources
- Evaluate and provide feedback on lab submissions from assigned learners (Active learners only)
- View reports on assigned learners' submissions and evaluations
- Access DV Coach AI chatbot for course-related questions
- Receive email notifications (new learner assignments, lab submissions, etc.)
- View in-app notifications
- Cannot access admin features
- Can be assigned a trainer for their own lab evaluations (trainers can be learners too)

**Role Assignment:**
- Assigned by admin through admin dashboard
- Cannot self-assign trainer role

**Responsibilities:**
- Evaluate lab submissions from assigned Active learners only
- Provide feedback on lab submissions
- Track evaluation progress and statistics
- Participate in courses as learners (with their own trainer for lab evaluation)

**Trainer as Learner:**
- Trainers can enroll in and access all courses
- Trainers can submit labs for evaluation
- Trainers must have an assigned trainer for their lab evaluations
- Trainers' lab submissions are evaluated by their assigned trainer

### 3. Admin
**Description:** System administrator with full control

**Capabilities:**
- Admin login (separate from user login)
- Access admin dashboard
- Approve/reject user registrations
- Assign trainer to users (required before approval)
- Change trainer assignment for users (trainer must always be assigned)
- Change user roles (learner ↔ trainer)
- View all users and their status
- View user performance reports
- View trainer performance reports
- Cannot access regular course content (admin dashboard only)

**Authentication:**
- Separate admin login route (`/admin/login`)
- Credentials stored in environment variables (not exposed in frontend)
- Session management separate from user sessions

---

## Functional Requirements

### FR1: User Registration

**FR1.1: Registration Form**
- **Fields Required:**
  - Full Name (text, required)
  - Email (email format, required, unique)
  - Password (min 6 characters, required)
- **No Role Selection:** Users cannot select their role during registration
- **Default Role:** All new users are assigned `role = 'learner'` by default
- **Status:** All new users are created with `status = 'pending'`

**FR1.2: Registration Validation**
- Email format validation
- Email uniqueness check (prevent duplicate registrations)
- Password strength validation (minimum 6 characters)
- Name field validation (non-empty)
- Real-time field validation with error messages

**FR1.3: Registration Response**
- On success: Show message "Registration successful. Your account is pending admin approval."
- On error: Display specific error messages (email exists, invalid format, etc.)
- Redirect to login after successful registration

**FR1.4: Email Verification**
- Support Supabase email verification (configurable)
- Handle email verification flow
- Block login until email verified (if enabled)

### FR2: User Authentication

**FR2.1: User Login**
- Login route: `/login` 
- Fields: Email, Password
- Validate credentials against Supabase Auth
- Handle authentication errors (invalid credentials, email not verified)

**FR2.2: Status-Based Access Control**
- **Pending Users:** Block login with message "Your account is pending admin approval."
- **Approved Users:** Allow login and redirect to course listing
- **Rejected Users:** Block login with message "Your account has been rejected. Please contact support."

**FR2.3: Session Management**
- Create session on successful login
- Persist session across page refreshes
- Session timeout handling
- Secure session storage

**FR2.4: Logout**
- Logout button available on all pages (for authenticated users)
- Clear session and local storage
- Redirect to user login page ('/login')
- Never redirect to admin login on logout

### FR3: Admin Authentication

**FR3.1: Admin Login**
- Separate admin login route: `/admin/login` 
- Fields: Username, Password
- Credentials stored in environment variables (not in frontend code)
- Backend validation required

**FR3.2: Admin Session**
- Separate session from user sessions
- Admin session persistence
- Admin logout redirects to user login (not admin login)

**FR3.3: Admin Access Control**
- Only users with `role = 'admin'` in database can access admin features
- Admin credentials validated against database, not just environment variables
- Admin routes protected by route guard

### FR4: Course Management

**FR4.1: Course Listing**
- Home page displays all available courses
- Each course card shows:
  - Course thumbnail/image
  - Course title and subtitle
  - Course brief/description
  - Course metadata (duration, chapters, labs, level)
  - Category and tags
- Clickable course cards navigate to course detail page

**FR4.2: Course Detail Page**
- Display full course information:
  - Course title, subtitle, description
  - Instructor name
  - Duration, level, category
  - Statistics (days, chapters, labs, tools)
  - Tags
- "Start Learning" button to begin course
- "Back to Courses" button to return to listing

**FR4.3: Course Structure**
- Each course contains:
  - **Days:** Organized learning units
  - **Chapters:** Book/reading content (markdown files)
  - **Labs:** Hands-on exercises (markdown files)
  - **Tools:** Reference tools and resources
- Course data stored in structured format (JSON/JavaScript)

**FR4.4: Course Content Access**
- Users must be authenticated and approved to access course content
- Course content filtered by user role (learner vs trainer)
- Navigation sidebar shows course structure (days, chapters, labs)
- Content viewer displays markdown files with proper formatting

### FR5: Content Navigation

**FR5.1: Sidebar Navigation**
- Display course structure:
  - Course Overview link
  - Days (expandable/collapsible)
  - Chapters (books) under each day
  - Labs under each day
- Visual indicators:
  - Active content item highlighted
  - Completed items marked with checkmark
- Filter tabs: All, Books, Labs

**FR5.2: Content Viewer**
- Display markdown content with proper formatting
- Support for:
  - Headings, paragraphs, lists
  - Code blocks
  - Images and visual assets
  - Links (internal and external)
  - Tables
- Breadcrumb navigation
- Previous/Next navigation buttons
- Mark as complete checkbox

**FR5.3: Course Overview**
- Display course summary/overview document
- Accessible from sidebar navigation
- Shows course introduction and structure

### FR6: Progress Tracking

**FR6.1: Progress Calculation**
- Calculate progress based on completed items (chapters + labs)
- Display progress percentage in header
- Update progress bar in real-time

**FR6.2: Progress Persistence**
- Save progress to localStorage (fallback)
- Save progress to Supabase (when backend configured)
- Persist across sessions

**FR6.3: Progress Indicators**
- Visual checkmarks for completed items
- Progress bar in header
- Progress percentage display

### FR7: Role-Based Access Control (RBAC)

**FR7.1: Content Access Rules**
- **Learners:**
  - Can access learner content (chapters, labs)
  - Cannot access trainer-only content
  - Cannot see trainer navigation links
- **Trainers:**
  - Can access all learner content
  - Can access trainer-only content
  - Can see trainer navigation links
- **Admins:**
  - Can only access admin dashboard
  - Cannot access regular course content
  - Redirected to admin dashboard if trying to access courses

**FR7.2: Route Protection**
- Unauthenticated users → Redirect to `/login`
- Pending users → Block with approval message
- Rejected users → Block with rejection message
- Learners accessing trainer routes → Redirect to course overview
- Admins accessing course routes → Redirect to admin dashboard

**FR7.3: UI Filtering**
- Navigation items filtered by role
- Trainer-only links hidden from learners
- Content sections hidden based on role

### FR8: Admin Dashboard

**FR8.1: User Management**
- Display table of all users with:
  - Name
  - Email
  - Role (with dropdown to change)
  - Status (pending/approved/rejected)
  - Created At timestamp
- Sortable columns
- Search/filter functionality (future)

**FR8.2: Trainer Assignment**
- **Required for Active Learners:** Admin must assign a trainer to Active learners
- **Optional for Other Types:** Inactive, Graduate, and Archive learners do not require trainer assignment
- **Trainer Assignment Field:** Dropdown to select trainer from list of users with trainer role
- **Mandatory for Active:** System enforces that a trainer must be assigned for Active learners
- **Change Trainer:** Admin can change trainer assignment at any time
- **Trainer as Learner:** Trainers can have their own trainer assigned for lab evaluation
- **Display:** Show assigned trainer name in user table
- **Learner Type Dependency:** Trainer assignment is required only for Active learners

**FR8.3: User Approval**
- Approve user → Set status to `approved` (only if trainer is assigned)
- Reject user → Set status to `rejected`
- Action buttons for each user
- Confirmation dialogs for actions
- Validation: Cannot approve without trainer assignment

**FR8.4: Role Management**
- View current role for each user
- Change user role (learner ↔ trainer)
- Role dropdown in user table
- Confirmation for role changes
- Immediate update in UI

**FR8.5: Admin Dashboard Access**
- Only accessible to admins
- Route: `/admin/dashboard` or `#admin/dashboard`
- Protected by route guard
- Redirect non-admins to login

### FR9: Trainer Content and Lab Evaluation

**FR9.1: Trainer-Only Section**
- Dedicated route: `/trainer-content` or `#trainer-content`
- Accessible only to trainers
- Navigation link visible only to trainers
- Content blocked for learners (even via direct URL)

**FR9.2: Trainer Resources**
- Trainer-specific content and resources
- Separate from learner content
- Role-based filtering

**FR9.3: Lab Evaluation Responsibility**
- **Assigned Learners:** Trainer can only evaluate lab submissions from learners assigned to them
- **Lab Submission List:** Display list of lab submissions from assigned learners
- **Evaluation Interface:** Provide interface to review lab submissions
- **Feedback Provision:** Trainer must provide feedback on each lab submission
- **Status Management:** Update submission status (reviewed, approved, needs_revision)
- **Resubmission Handling:** Handle resubmissions from learners based on feedback

**FR9.4: Course Allocation**
- **View All Courses:** Trainer can view ALL available courses in the system (full access, not limited)
- **Participate as Learner:** Trainers can enroll in and access all courses as learners
- **Trainer's Trainer:** Trainers can have their own trainer assigned for lab evaluation
- **Allocate Courses:** Trainer can assign specific courses to specific assigned Active learners only
- **Course Assignment Interface:** Provide interface to select courses and assign to Active learners
- **Multiple Course Assignment:** Trainer can assign multiple courses to an Active learner
- **Course Removal:** Trainer can remove course assignments from Active learners
- **View Assigned Courses:** Trainer can view which courses are assigned to which Active learners
- **Learner Course Access:** Active learners can only access courses assigned to them by their trainer
- **Learner Filtering:** Trainer interface only shows Active learners (filters out Inactive, Graduate, Archive)

**FR9.5: Trainer Reports**
- **Submission Statistics:** View number of lab submissions from assigned learners
- **Evaluation Statistics:** View number of lab submissions evaluated
- **Pending Evaluations:** View list of pending evaluations
- **Completion Rate:** Track evaluation completion rate
- **Course Allocation Statistics:** View course allocation statistics per learner

### FR10: Reporting System

**FR10.1: User-Level Reports**
- **Assignment Submission Report:**
  - List of all lab submissions by the user
  - Submission dates and status
  - Feedback received from trainer
  - Resubmission history
- **Approval Report:**
  - Approval status of each submission
  - Time taken for approval
  - Number of resubmissions required
- **Access:** Available to learners for their own reports

**FR10.2: Trainer-Level Reports**
- **Submission Statistics:**
  - Total number of lab submissions from assigned learners
  - Breakdown by course and lab
  - Submission trends over time
- **Evaluation Statistics:**
  - Number of lab submissions evaluated
  - Number of pending evaluations
  - Average evaluation time
  - Completion rate
- **Access:** Available to trainers for their assigned learners

**FR10.3: Admin-Level Reports**
- **User Performance Report:**
  - Overall user performance metrics
  - Submission completion rates
  - Average time to completion
  - Users with low submission rates
  - Users requiring attention
- **Trainer Performance Report:**
  - Trainer evaluation statistics
  - Number of learners assigned per trainer
  - Average evaluation time per trainer
  - Trainer workload distribution
  - Trainers with high/low evaluation rates
- **Access:** Available only to admins
- **Export:** Option to export reports (future)

**FR9.1: Trainer-Only Section**
- Dedicated route: `/trainer-content` or `#trainer-content`
- Accessible only to trainers
- Navigation link visible only to trainers
- Content blocked for learners (even via direct URL)

**FR9.2: Trainer Resources**
- Trainer-specific content and resources
- Separate from learner content
- Role-based filtering

---

## Non-Functional Requirements

### NFR1: Performance
- **Page Load Time:** < 3 seconds on 3G connection
- **Content Rendering:** < 1 second for markdown content
- **Navigation Response:** < 500ms for route changes
- **API Response:** < 2 seconds for backend operations

### NFR2: Scalability
- Support for 100+ courses
- Support for 10,000+ users
- Efficient content loading (lazy loading for large courses)
- Optimized asset delivery

### NFR3: Browser Compatibility
- Support modern browsers (Chrome, Firefox, Safari, Edge)
- Support last 2 major versions
- Graceful degradation for older browsers
- Mobile-responsive design

### NFR4: Accessibility
- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus indicators

### NFR5: Maintainability
- Modular code structure
- Clear separation of concerns
- Comprehensive documentation
- Consistent coding standards
- Easy to add new courses

### NFR6: Reliability
- Error handling for all operations
- Graceful degradation on backend failures
- Offline support for viewing cached content
- Data validation on all inputs

---

## Technical Architecture

### TA1: Frontend Architecture

**TA1.1: Technology Stack**
- **HTML5:** Semantic markup
- **CSS3:** Modern styling with CSS variables
- **Vanilla JavaScript (ES6+):** No frameworks, pure JS
- **ES6 Modules:** For code organization
- **Marked.js:** For markdown rendering (or similar)

**TA1.2: Application Structure**
```
lms/
├── core/              # Core application logic
│   ├── app.js        # Main LMS application class
│   └── router.js     # Route handling
├── services/         # Business logic services
│   ├── auth-service.js
│   ├── user-service.js
│   ├── course-service.js
│   ├── progress-service.js
│   └── rbac-service.js
├── components/       # UI components
│   ├── course-listing.js
│   ├── course-detail.js
│   ├── content-viewer.js
│   ├── navigation-sidebar.js
│   ├── auth-ui.js
│   └── admin-ui.js
├── guards/           # Route guards and protection
│   └── route-guard.js
├── config/           # Configuration files
│   ├── config.js     # Default configuration
│   └── config.local.js # Local overrides (gitignored)
└── styles/           # Styling
    └── styles.css
```

**TA1.3: Module Organization**
- Each module should have a single responsibility
- Use ES6 imports/exports
- Avoid circular dependencies
- Clear module naming conventions

### TA2: Backend Architecture

**TA2.1: Supabase Integration**
- Supabase JS client for all backend operations
- Environment-based configuration
- Secure API key management
- Row-Level Security (RLS) policies

**TA2.2: Database Schema**
- `auth.users` (Supabase managed)
- `public.users` (user profiles)
- `public.user_progress` (progress tracking)
- Proper indexes and constraints
- RLS policies for security

**TA2.3: API Design**
- RESTful API via Supabase
- Consistent error handling
- Proper HTTP status codes
- Rate limiting (Supabase managed)

### TA3: State Management

**TA3.1: Application State**
- Current user session
- Current course data
- Filtered course data (by role)
- Progress tracking
- UI state (sidebar open/closed, active routes)

**TA3.2: State Persistence**
- Session state in Supabase
- Progress in localStorage + Supabase
- UI preferences in localStorage
- No global state pollution

---

## Data Structure Requirements

### DS1: Course Data Structure

**DS1.1: Course Metadata**
```javascript
{
  id: string,                    // Unique course identifier
  title: string,                 // Course title
  subtitle: string,               // Course subtitle
  description: string,            // Full description
  brief: string,                  // Short description for cards
  thumbnail: string,              // Course image URL
  instructor: string,              // Instructor name
  duration: string,               // e.g., "20 Days"
  level: string,                  // e.g., "Intermediate to Advanced"
  category: string,               // Course category
  tags: string[],                // Course tags
  totalDays: number,              // Total number of days
  totalChapters: number,          // Total chapters
  totalLabs: number,             // Total labs
  totalTools: number,            // Total tools
  published: boolean,            // Publication status
  createdAt: string,              // ISO date string
  courseData: CourseData         // Full course structure
}
```

**DS1.2: Course Structure**
```javascript
{
  title: string,                 // Course title
  subtitle: string,               // Course subtitle
  totalDays: number,
  totalChapters: number,
  totalLabs: number,
  days: [
    {
      day: number,               // Day number
      title: string,             // Day title
      chapters: [
        {
          id: string,            // Unique chapter ID
          title: string,         // Chapter title
          file: string,           // Path to markdown file
          type: "book"           // Content type
        }
      ],
      labs: [
        {
          id: string,            // Unique lab ID
          title: string,         // Lab title
          file: string,          // Path to markdown file
          type: "lab"            // Content type
        }
      ]
    }
  ],
  tools: [...]                   // Tools data
}
```

**DS1.3: File Organization**
- All course data files in `data/` folder
- Structure: `data/courses/{course-id}/course.json`
- Content files: `data/courses/{course-id}/content/`
- Assets: `data/courses/{course-id}/assets/`

### DS2: User Data Structure

**DS2.1: User Profile**
```javascript
{
  id: string,                    // UUID from auth.users
  email: string,                 // User email (unique)
  name: string,                  // Full name
  role: "learner" | "trainer" | "admin",   // User role
  status: "pending" | "approved" | "rejected",
  trainer_id: string,            // UUID of assigned trainer (required for learners)
  created_at: string,            // ISO timestamp
  updated_at: string             // ISO timestamp
}
```

**DS2.2: Progress Data**
```javascript
{
  user_id: string,               // User UUID
  content_id: string,             // Chapter/Lab ID
  completed: boolean,             // Completion status
  completed_at: string,           // ISO timestamp
  progress_data: object           // Additional progress data
}
```

**DS2.3: Lab Submission Data**
```javascript
{
  id: string,                     // Submission UUID
  user_id: string,                // Learner UUID
  course_id: string,              // Course identifier
  lab_id: string,                  // Lab identifier
  submission_data: object,         // Lab submission content
  submitted_at: string,           // ISO timestamp
  reviewed_by: string,            // Trainer UUID (assigned trainer)
  reviewed_at: string,            // ISO timestamp
  feedback: string,               // Trainer feedback
  status: "submitted" | "reviewed" | "approved" | "needs_revision",
  resubmission_count: number,     // Number of resubmissions
  created_at: string,             // ISO timestamp
  updated_at: string              // ISO timestamp
}
```

**DS2.4: Course Allocation Data**
```javascript
{
  id: string,                     // Allocation UUID
  user_id: string,                // Learner UUID
  course_id: string,              // Course identifier
  trainer_id: string,             // Trainer UUID who allocated
  allocated_at: string,           // ISO timestamp
  allocated_by: string,           // Trainer UUID
  status: "active" | "removed",   // Allocation status
  created_at: string,            // ISO timestamp
  updated_at: string              // ISO timestamp
}
```

**DS2.5: Chatbot Data**
```javascript
{
  id: string,                     // Chat message UUID
  user_id: string,                // User UUID
  course_id: string,              // Course identifier
  message: string,                // User message or bot response
  role: "user" | "assistant",     // Message role
  context: object,                 // Course context (chapter, lab, etc.)
  sources: string[],              // Referenced course materials
  created_at: string,            // ISO timestamp
  conversation_id: string         // Conversation identifier
}
```

**DS2.6: Report Data**
```javascript
{
  // User Performance Report
  user_id: string,
  total_submissions: number,
  approved_submissions: number,
  pending_submissions: number,
  needs_revision: number,
  average_approval_time: number,
  resubmission_rate: number,
  
  // Trainer Performance Report
  trainer_id: string,
  assigned_learners: number,
  total_submissions_received: number,
  total_evaluations_completed: number,
  pending_evaluations: number,
  average_evaluation_time: number,
  completion_rate: number
}
```

**DS2.5: Chatbot Data**
```javascript
{
  id: string,                     // Chat message UUID
  user_id: string,                // User UUID
  course_id: string,              // Course identifier
  conversation_id: string,        // Conversation identifier
  message: string,                // User message or bot response
  role: "user" | "assistant",     // Message role
  context: object,                 // Course context (chapter, lab, etc.)
  sources: string[],              // Referenced course materials
  created_at: string              // ISO timestamp
}
```

**DS2.6: Notification Data**
```javascript
{
  id: string,                     // Notification UUID
  user_id: string,                // User UUID (recipient)
  type: string,                   // Notification type (welcome, approval, course_assignment, etc.)
  title: string,                  // Notification title
  message: string,                // Notification message/content
  email_sent: boolean,            // Email sent status
  email_sent_at: string,          // Email sent timestamp
  email_delivery_status: string,  // Email delivery status (sent, delivered, failed)
  read: boolean,                  // Read status (in-app)
  read_at: string,                // Read timestamp
  metadata: object,               // Additional data (course_id, lab_id, etc.)
  created_at: string,            // ISO timestamp
  updated_at: string              // ISO timestamp
}
```

### DS3: Configuration Data

**DS3.1: Application Configuration**
```javascript
{
  SUPABASE_URL: string,          // Supabase project URL
  SUPABASE_ANON_KEY: string,     // Supabase publishable key
  ADMIN_USERNAME: string,        // Admin username (env only)
  ADMIN_PASSWORD: string,        // Admin password (env only)
  APP_NAME: string,              // Application name
  APP_VERSION: string            // Application version
}
```

---

## File Structure Requirements

### FS1: Project Root Structure

```
dv-seo-publish/
├── index.html                   # Main entry point
├── data/                        # ALL COURSE DATA (NEW)
│   ├── courses/                 # Course data files
│   │   ├── seo-master-2026/
│   │   │   ├── course.json     # Course metadata
│   │   │   ├── structure.json  # Course structure (days, chapters, labs)
│   │   │   ├── content/        # Course content files
│   │   │   │   ├── chapters/   # Chapter markdown files
│   │   │   │   └── labs/       # Lab markdown files
│   │   │   └── assets/         # Course-specific assets
│   │   └── [other-courses]/
│   └── tools.json               # Tools registry
├── config/                      # CONFIGURATION FILES (NEW)
│   ├── app.config.js            # Application configuration
│   ├── app.config.local.js      # Local overrides (gitignored)
│   ├── app.config.template.js   # Configuration template
│   └── env.example              # Environment variables example
├── lms/                         # LMS application code
│   ├── core/                    # Core application
│   ├── services/                # Business logic
│   ├── components/              # UI components
│   ├── guards/                  # Route guards
│   └── styles/                  # Styling
├── backend/                     # Backend setup scripts
│   ├── schema.sql               # Database schema
│   └── migrations/              # Database migrations
├── docs/                        # Documentation
└── tests/                       # Test files
```

### FS2: Data Folder Structure

**FS2.1: Course Data Organization**
- Each course in its own folder: `data/courses/{course-id}/`
- Course metadata in `course.json`
- Course structure in `structure.json` (or combined)
- Content files organized by type (chapters, labs)
- Assets in separate folder

**FS2.2: Content File Naming**
- Chapters: `Day_{DD}_Chapter_{CC}_{Title}.md`
- Labs: `Day_{DD}_Lab_{LL}_{Title}.md`
- Consistent naming across all courses

**FS2.3: Tools and Resources**
- Tools registry: `data/tools.json`
- Shared resources: `data/resources/`
- Visual assets: `data/assets/` or per-course

### FS3: Configuration File Structure

**FS3.1: Configuration Separation**
- **Application Config:** `config/app.config.js` (defaults)
- **Local Config:** `config/app.config.local.js` (user-specific, gitignored)
- **Template:** `config/app.config.template.js` (example)
- **Environment:** `.env` file (if needed, gitignored)

**FS3.2: Configuration Content**
- Supabase credentials
- Admin credentials (server-side only)
- Feature flags
- API endpoints
- Application settings

**FS3.3: Configuration Loading**
- Load default config first
- Override with local config if exists
- Validate required configuration
- Provide clear error messages for missing config

---

## Security Requirements

### SEC1: Authentication Security

**SEC1.1: Password Security**
- Passwords hashed by Supabase (bcrypt)
- Never store plain text passwords
- Minimum password length: 6 characters
- Password strength validation (future)

**SEC1.2: Session Security**
- Secure session tokens (JWT)
- Session expiration handling
- Secure session storage
- CSRF protection (Supabase managed)

**SEC1.3: Admin Credentials**
- Admin credentials in environment variables only
- Never exposed in frontend code
- Backend validation required
- Separate admin authentication flow

### SEC2: Authorization Security

**SEC2.1: Role-Based Access**
- Server-side role verification
- Route guards on all protected routes
- Content filtering by role
- UI elements hidden based on role

**SEC2.2: Data Access Control**
- Row-Level Security (RLS) policies
- Users can only access their own data
- Admins can access all data (via RLS policies)
- No unauthorized data exposure

**SEC2.3: API Security**
- API keys in configuration (not in code)
- Secure API endpoints
- Rate limiting (Supabase managed)
- Input validation on all inputs

### SEC3: Data Security

**SEC3.1: Data Validation**
- Input validation on all user inputs
- SQL injection prevention (Supabase managed)
- XSS prevention (content sanitization)
- File upload validation (if implemented)

**SEC3.2: Data Privacy**
- User data encrypted at rest (Supabase)
- Secure data transmission (HTTPS)
- GDPR compliance considerations
- Data retention policies

---

## UI/UX Requirements

### UX1: User Experience Flow

**UX1.1: Unauthenticated User Flow**
1. Land on login page (`#login`)
2. Option to register or login
3. After registration → Pending approval message
4. After login (if pending) → Pending approval message
5. After login (if approved) → Course listing page

**UX1.2: Authenticated User Flow**
1. Land on course listing page (`#courses`)
2. View available courses
3. Click course → Course detail page
4. Click "Start Learning" → Course overview/content
5. Navigate through chapters and labs
6. Track progress automatically

**UX1.3: Admin Flow**
1. Navigate to `/admin/login`
2. Login with admin credentials
3. Redirected to admin dashboard
4. Manage users (approve, reject, change roles)
5. Logout → Redirected to user login

### UX2: Navigation

**UX2.1: Main Navigation**
- Header with logo and progress bar
- Sidebar with course structure
- Breadcrumb navigation
- Previous/Next buttons for content

**UX2.2: Route Navigation**
- Hash-based routing (`#courses`, `#courses/:id`)
- Browser back/forward support
- Direct URL access support
- Route guards for protection

### UX3: Visual Design

**UX3.1: Design System**
- Consistent color scheme (brand colors)
- Typography system (Inter font family)
- Component library (buttons, cards, forms)
- Responsive design (mobile, tablet, desktop)

**UX3.2: Visual Feedback**
- Loading states for async operations
- Success/error messages
- Progress indicators
- Active state indicators
- Hover states

### UX4: Responsive Design

**UX4.1: Breakpoints**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

**UX4.2: Mobile Optimizations**
- Collapsible sidebar
- Touch-friendly buttons
- Optimized content layout
- Mobile navigation patterns

---

## Integration Requirements

### INT1: Supabase Integration

**INT1.1: Authentication Integration**
- Supabase Auth for user authentication
- Session management via Supabase
- Email verification support
- Password reset functionality (future)

**INT1.2: Database Integration**
- PostgreSQL database via Supabase
- Row-Level Security (RLS) policies
- Real-time subscriptions (optional)
- Database migrations support

**INT1.3: API Integration**
- Supabase REST API
- Supabase JS client
- Error handling and retries
- Connection management

### INT2: External Services

**INT2.1: Content Delivery**
- Markdown file loading
- Asset loading (images, SVGs)
- CDN support (future)
- Caching strategies

**INT2.2: Analytics (Future)**
- User engagement tracking
- Progress analytics
- Course completion rates
- Performance monitoring

---

## Testing Requirements

### TEST1: Unit Testing

**TEST1.1: Service Testing**
- Test all service functions
- Mock Supabase client
- Test error handling
- Test edge cases

**TEST1.2: Component Testing**
- Test UI components
- Test user interactions
- Test state management
- Test rendering logic

### TEST2: Integration Testing

**TEST2.1: API Integration**
- Test Supabase integration
- Test authentication flows
- Test data operations
- Test error scenarios

**TEST2.2: End-to-End Testing**
- Test complete user flows
- Test role-based access
- Test admin workflows
- Test course navigation

### TEST3: Manual Testing

**TEST3.1: Browser Testing**
- Test on multiple browsers
- Test on multiple devices
- Test responsive design
- Test accessibility

**TEST3.2: User Acceptance Testing**
- Test with real users
- Gather feedback
- Validate requirements
- Document issues

---

## Deployment Requirements

### DEP1: Static Hosting

**DEP1.1: GitHub Pages**
- Support for GitHub Pages deployment
- Proper file structure
- No server-side requirements
- CDN-friendly asset organization

**DEP1.2: Build Process**
- No build step required (vanilla JS)
- Optional minification (future)
- Asset optimization
- Cache busting strategies

### DEP2: Environment Configuration

**DEP2.1: Configuration Management**
- Environment-based configuration
- Secure credential management
- Configuration validation
- Clear setup instructions

**DEP2.2: Deployment Checklist**
- Database schema deployed
- RLS policies configured
- Environment variables set
- Configuration files in place
- Content files uploaded

---

## Future Enhancements

### FE1: Content Management

**FE1.1: Course Editor**
- Admin interface for course creation
- Visual course structure editor
- Content file upload
- Course preview

**FE1.2: Content Versioning**
- Version control for courses
- Course rollback capability
- Content change history

### FE2: User Features

**FE2.1: User Profiles**
- User profile pages
- Profile customization
- Achievement badges
- Certificates

**FE2.2: Social Features**
- Discussion forums
- User comments
- Course reviews
- Peer interaction

### FE3: Analytics and Reporting

**FE3.1: Admin Analytics**
- User engagement metrics
- Course completion rates
- Progress analytics
- Usage statistics

**FE3.2: Learner Analytics**
- Personal progress dashboard
- Learning insights
- Time spent tracking
- Completion predictions

### FE4: Advanced Features

**FE4.1: Assessments**
- Quizzes and tests
- Grading system
- Assignment submission
- Feedback system

**FE4.2: Notifications**
- Email notifications
- In-app notifications
- Progress reminders
- Course updates

---

## Appendix

### A1: Glossary

- **LMS:** Learning Management System
- **RBAC:** Role-Based Access Control
- **RLS:** Row-Level Security
- **BaaS:** Backend-as-a-Service
- **SPA:** Single Page Application
- **JWT:** JSON Web Token
- **CSRF:** Cross-Site Request Forgery
- **XSS:** Cross-Site Scripting

### A2: References

- Supabase Documentation: https://supabase.com/docs
- Marked.js Documentation: https://marked.js.org/
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/

### A3: Change Log

**Version 1.0 (2025-01-29)**
- Initial PRD creation
- Comprehensive system requirements
- File structure recommendations
- Configuration separation requirements

---

**Document Status:** Draft - Awaiting Review  
**Next Steps:** Review, approval, and implementation planning



