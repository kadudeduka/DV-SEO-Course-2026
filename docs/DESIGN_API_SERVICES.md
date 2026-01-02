# DV Learning Hub - API/Services Design Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Draft  
**Architect:** System Design Team

---

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Authentication Services](#authentication-services)
4. [User Services](#user-services)
5. [Course Services](#course-services)
6. [Progress Services](#progress-services)
7. [Admin Services](#admin-services)
8. [Error Handling](#error-handling)
9. [Service Integration](#service-integration)

---

## Overview

### Purpose
This document defines the service layer architecture, API interfaces, and service implementations for DV Learning Hub.

### Service Layer Principles
- **Single Responsibility**: Each service handles one domain
- **Stateless**: Services don't maintain state between calls
- **Error Handling**: Consistent error handling across services
- **Async/Await**: All async operations use async/await
- **Validation**: Input validation before operations

### Service Categories
1. **Authentication Services**: Login, registration, session management
2. **User Services**: User profile operations
3. **Course Services**: Course data loading and management
4. **Progress Services**: Progress tracking and persistence
5. **Admin Services**: Admin-specific operations
6. **RBAC Services**: Role-based access control

---

## Service Architecture

### Service Layer Structure

```
services/
├── auth-service.js          # Authentication operations
├── user-service.js          # User profile operations
├── course-service.js        # Course data operations
├── progress-service.js      # Progress tracking
├── rbac-service.js          # Role-based access control
├── admin-service.js         # Admin operations
└── base-service.js          # Base service class
```

### Service Base Class

```javascript
// Base Service Pattern
class BaseService {
    constructor(supabaseClient) {
        this.client = supabaseClient;
        this.cache = new Map();
    }

    async execute(operation, params) {
        try {
            // Validate input
            this.validate(params);
            
            // Execute operation
            const result = await operation(params);
            
            // Transform result
            return this.transform(result);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    validate(params) {
        // Override in subclasses
    }

    transform(result) {
        // Override in subclasses
        return result;
    }

    handleError(error) {
        // Standard error handling
        console.error('Service error:', error);
        return new Error(error.message || 'An error occurred');
    }
}
```

---

## Authentication Services

### AuthService

**Purpose**: Handle user authentication and session management

**Methods**:

#### 1. login(email, password)
```javascript
async login(email, password) {
    // Validate input
    if (!email || !password) {
        throw new Error('Email and password are required');
    }

    // Authenticate with Supabase
    const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        throw new Error(this.mapAuthError(error));
    }

    // Get user profile
    const userProfile = await this.getUserProfile(data.user.id);
    
    // Check user status
    if (userProfile.status === 'pending') {
        await this.client.auth.signOut();
        throw new Error('Your account is pending admin approval.');
    }

    if (userProfile.status === 'rejected') {
        await this.client.auth.signOut();
        throw new Error('Your account has been rejected. Please contact support.');
    }

    return {
        user: data.user,
        session: data.session,
        profile: userProfile
    };
}
```

#### 2. register(name, email, password)
```javascript
async register(name, email, password) {
    // Validate input
    this.validateRegistration(name, email, password);

    // Register with Supabase Auth
    const { data, error } = await this.client.auth.signUp({
        email,
        password
    });

    if (error) {
        throw new Error(this.mapAuthError(error));
    }

    // Create user profile
    const profile = await this.createUserProfile({
        id: data.user.id,
        email,
        full_name: name,
        role: 'learner',
        status: 'pending'
    });

    return {
        user: data.user,
        profile
    };
}
```

#### 3. logout()
```javascript
async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) {
        throw new Error('Failed to logout');
    }
    
    // Clear local storage
    localStorage.removeItem('lms_user');
    localStorage.removeItem('lms_session');
    
    return true;
}
```

#### 4. getSession()
```javascript
async getSession() {
    const { data, error } = await this.client.auth.getSession();
    
    if (error) {
        throw new Error('Failed to get session');
    }

    if (!data.session) {
        return null;
    }

    // Get user profile
    const profile = await this.getUserProfile(data.session.user.id);
    
    return {
        session: data.session,
        user: data.session.user,
        profile
    };
}
```

#### 5. getCurrentUser()
```javascript
async getCurrentUser() {
    const session = await this.getSession();
    if (!session) {
        return null;
    }

    return {
        id: session.user.id,
        email: session.user.email,
        ...session.profile
    };
}
```

---

## User Services

### UserService

**Purpose**: Handle user profile operations

**Methods**:

#### 1. getUserProfile(userId)
```javascript
async getUserProfile(userId) {
    const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        throw new Error('Failed to get user profile');
    }

    return data;
}
```

#### 2. createUserProfile(profileData)
```javascript
async createUserProfile(profileData) {
    const { data, error } = await this.client
        .from('users')
        .insert([{
            id: profileData.id,
            email: profileData.email,
            full_name: profileData.full_name,
            role: profileData.role || 'learner',
            status: profileData.status || 'pending'
        }])
        .select()
        .single();

    if (error) {
        throw new Error('Failed to create user profile');
    }

    return data;
}
```

#### 3. updateUserProfile(userId, updates)
```javascript
async updateUserProfile(userId, updates) {
    // Only allow updating certain fields
    const allowedFields = ['full_name'];
    const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
            obj[key] = updates[key];
            return obj;
        }, {});

    const { data, error } = await this.client
        .from('users')
        .update({
            ...filteredUpdates,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to update user profile');
    }

    return data;
}
```

---

## Course Services

### CourseService

**Purpose**: Handle course data loading and management

**Methods**:

#### 1. getCourses()
```javascript
async getCourses() {
    // Check cache
    if (this.cache.has('courses')) {
        return this.cache.get('courses');
    }

    // Load from data folder
    const { getCourses } = await import('../../data/courses.js');
    const courses = await getCourses();
    
    // Filter published courses
    const publishedCourses = courses.filter(c => c.published === true);
    
    // Cache results
    this.cache.set('courses', publishedCourses);
    
    return publishedCourses;
}
```

#### 2. getCourseById(courseId)
```javascript
async getCourseById(courseId) {
    // Check cache
    const cacheKey = `course_${courseId}`;
    if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
    }

    // Load from data folder
    const { getCourseById } = await import('../../data/courses.js');
    const course = await getCourseById(courseId);
    
    if (!course) {
        throw new Error(`Course not found: ${courseId}`);
    }

    // Cache result
    this.cache.set(cacheKey, course);
    
    return course;
}
```

#### 3. getCourseContent(courseId, contentPath)
```javascript
async getCourseContent(courseId, contentPath) {
    // Load markdown file
    const response = await fetch(contentPath);
    
    if (!response.ok) {
        throw new Error(`Failed to load content: ${contentPath}`);
    }

    const markdown = await response.text();
    return markdown;
}
```

#### 4. getCourseStructure(courseId)
```javascript
async getCourseStructure(courseId) {
    const course = await this.getCourseById(courseId);
    return course.courseData || course.structure;
}
```

---

## Progress Services

### ProgressService

**Purpose**: Handle progress tracking and persistence

**Methods**:

#### 1. getProgress(userId, courseId)
```javascript
async getProgress(userId, courseId) {
    // Try Supabase first
    if (this.client) {
        try {
            const { data, error } = await this.client
                .from('user_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('course_id', courseId);

            if (!error && data) {
                return this.transformProgress(data);
            }
        } catch (error) {
            console.warn('Supabase error, using localStorage', error);
        }
    }

    // Fallback to localStorage
    return this.getProgressFromStorage(userId, courseId);
}
```

#### 2. saveProgress(userId, courseId, contentId, completed)
```javascript
async saveProgress(userId, courseId, contentId, completed) {
    const progress = {
        user_id: userId,
        course_id: courseId,
        content_id: contentId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
    };

    // Save to Supabase
    if (this.client) {
        try {
            const { error } = await this.client
                .from('user_progress')
                .upsert(progress, {
                    onConflict: 'user_id,course_id,content_id'
                });

            if (error) {
                console.warn('Supabase error, using localStorage', error);
            }
        } catch (error) {
            console.warn('Supabase error, using localStorage', error);
        }
    }

    // Always save to localStorage as fallback
    this.saveProgressToStorage(userId, courseId, contentId, completed);
    
    return progress;
}
```

#### 3. getProgressPercentage(userId, courseId)
```javascript
async getProgressPercentage(userId, courseId) {
    const progress = await this.getProgress(userId, courseId);
    const course = await this.courseService.getCourseById(courseId);
    
    // Count total content items
    const totalItems = this.countContentItems(course);
    
    // Count completed items
    const completedItems = Object.values(progress).filter(p => p.completed).length;
    
    // Calculate percentage
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
}
```

#### 4. getProgressFromStorage(userId, courseId)
```javascript
getProgressFromStorage(userId, courseId) {
    const key = `progress_${userId}_${courseId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
}
```

#### 5. saveProgressToStorage(userId, courseId, contentId, completed)
```javascript
saveProgressToStorage(userId, courseId, contentId, completed) {
    const key = `progress_${userId}_${courseId}`;
    const progress = this.getProgressFromStorage(userId, courseId);
    
    progress[contentId] = {
        completed,
        completed_at: completed ? new Date().toISOString() : null
    };
    
    localStorage.setItem(key, JSON.stringify(progress));
}
```

---

## Admin Services

### AdminService

**Purpose**: Handle admin-specific operations

**Methods**:

#### 1. adminLogin(username, password)
```javascript
async adminLogin(username, password) {
    // Validate admin credentials (server-side validation required)
    // For now, check against database
    const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('email', username) // Using email as username
        .eq('role', 'admin')
        .single();

    if (error || !data) {
        throw new Error('Invalid admin credentials');
    }

    // Verify password via Supabase Auth
    const { data: authData, error: authError } = await this.client.auth.signInWithPassword({
        email: username,
        password
    });

    if (authError) {
        throw new Error('Invalid admin credentials');
    }

    return {
        user: authData.user,
        session: authData.session,
        profile: data
    };
}
```

#### 2. getAllUsers()
```javascript
async getAllUsers() {
    const { data, error } = await this.client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error('Failed to get users');
    }

    return data;
}
```

#### 3. approveUser(userId, adminId)
```javascript
async approveUser(userId, adminId) {
    // Check if trainer is assigned
    const { data: user, error: userError } = await this.client
        .from('users')
        .select('trainer_id')
        .eq('id', userId)
        .single();

    if (userError) {
        throw new Error('User not found');
    }

    if (!user.trainer_id) {
        throw new Error('Cannot approve user without trainer assignment');
    }

    const { data, error } = await this.client
        .from('users')
        .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: adminId,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to approve user');
    }

    // Create approval record
    await this.createApprovalRecord(userId, adminId, 'approved');

    return data;
}
```

#### 4. rejectUser(userId, adminId)
```javascript
async rejectUser(userId, adminId) {
    const { data, error } = await this.client
        .from('users')
        .update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejected_by: adminId,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to reject user');
    }

    // Create approval record
    await this.createApprovalRecord(userId, adminId, 'rejected');

    return data;
}
```

#### 5. updateUserRole(userId, newRole, adminId)
```javascript
async updateUserRole(userId, newRole, adminId) {
    // Validate role
    if (!['learner', 'trainer', 'admin'].includes(newRole)) {
        throw new Error('Invalid role');
    }

    const { data, error } = await this.client
        .from('users')
        .update({
            role: newRole,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to update user role');
    }

    return data;
}
```

#### 6. assignTrainer(userId, trainerId, adminId)
```javascript
async assignTrainer(userId, trainerId, adminId) {
    // Validate trainer exists and has trainer role
    const { data: trainer, error: trainerError } = await this.client
        .from('users')
        .select('id, role')
        .eq('id', trainerId)
        .single();

    if (trainerError || !trainer || trainer.role !== 'trainer') {
        throw new Error('Invalid trainer');
    }

    // Update user with trainer assignment
    const { data, error } = await this.client
        .from('users')
        .update({
            trainer_id: trainerId,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to assign trainer');
    }

    return data;
}
```

#### 7. getTrainers()
```javascript
async getTrainers() {
    const { data, error } = await this.client
        .from('users')
        .select('id, email, full_name, role')
        .eq('role', 'trainer')
        .eq('status', 'approved')
        .order('full_name');

    if (error) {
        throw new Error('Failed to get trainers');
    }

    return data;
}
```

#### 8. getAssignedLearners(trainerId)
```javascript
async getAssignedLearners(trainerId) {
    const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error('Failed to get assigned learners');
    }

    return data;
}
```

---

## RBAC Services

### RBACService

**Purpose**: Handle role-based access control logic

**Methods**:

#### 1. hasPermission(user, permission)
```javascript
hasPermission(user, permission) {
    if (!user || !user.role) {
        return false;
    }

    const permissions = {
        admin: ['*'], // All permissions
        trainer: ['view_courses', 'view_trainer_content', 'view_labs', 'submit_labs'],
        learner: ['view_courses', 'view_labs', 'submit_labs']
    };

    const userPermissions = permissions[user.role] || [];
    
    return userPermissions.includes('*') || userPermissions.includes(permission);
}
```

#### 2. canAccessContent(user, contentItem)
```javascript
canAccessContent(user, contentItem) {
    // Check if content requires trainer role
    if (contentItem.requiresRole === 'trainer') {
        return user.role === 'trainer' || user.role === 'admin';
    }

    // Default: learners can access
    return true;
}
```

#### 3. filterContentByRole(content, userRole)
```javascript
filterContentByRole(content, userRole) {
    if (userRole === 'admin') {
        // Admins don't see course content
        return [];
    }

    return content.filter(item => {
        // Show all content to trainers
        if (userRole === 'trainer') {
            return true;
        }

        // Learners only see learner content
        return !item.requiresRole || item.requiresRole === 'learner';
    });
}
```

---

## Error Handling

### Error Types

```javascript
class ServiceError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.name = 'ServiceError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

class ValidationError extends ServiceError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR', 400);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends ServiceError {
    constructor(message) {
        super(message, 'AUTHENTICATION_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends ServiceError {
    constructor(message) {
        super(message, 'AUTHORIZATION_ERROR', 403);
        this.name = 'AuthorizationError';
    }
}

class NotFoundError extends ServiceError {
    constructor(message) {
        super(message, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}
```

### Error Mapping

```javascript
mapAuthError(error) {
    const errorMap = {
        'Invalid login credentials': 'Invalid email or password',
        'Email not confirmed': 'Please verify your email address',
        'User already registered': 'This email is already registered',
        'Password should be at least 6 characters': 'Password must be at least 6 characters'
    };

    return errorMap[error.message] || error.message || 'An error occurred';
}
```

---

## Service Integration

### Service Factory

```javascript
class ServiceFactory {
    constructor(supabaseClient) {
        this.client = supabaseClient;
        this.services = {};
    }

    getAuthService() {
        if (!this.services.auth) {
            this.services.auth = new AuthService(this.client);
        }
        return this.services.auth;
    }

    getUserService() {
        if (!this.services.user) {
            this.services.user = new UserService(this.client);
        }
        return this.services.user;
    }

    getCourseService() {
        if (!this.services.course) {
            this.services.course = new CourseService();
        }
        return this.services.course;
    }

    getProgressService() {
        if (!this.services.progress) {
            this.services.progress = new ProgressService(
                this.client,
                this.getCourseService()
            );
        }
        return this.services.progress;
    }

    getAdminService() {
        if (!this.services.admin) {
            this.services.admin = new AdminService(this.client);
        }
        return this.services.admin;
    }

    getRBACService() {
        if (!this.services.rbac) {
            this.services.rbac = new RBACService();
        }
        return this.services.rbac;
    }
}
```

### Service Usage Example

```javascript
// Initialize services
const serviceFactory = new ServiceFactory(supabaseClient);

// Use services
const authService = serviceFactory.getAuthService();
const user = await authService.login(email, password);

const courseService = serviceFactory.getCourseService();
const courses = await courseService.getCourses();

const progressService = serviceFactory.getProgressService();
await progressService.saveProgress(userId, courseId, contentId, true);
```

---

## Lab Submission Services

### LabSubmissionService

**Purpose**: Handle lab submission, feedback, and resubmission operations

**Methods**:

#### 1. submitLab(userId, courseId, labId, submissionData)
```javascript
async submitLab(userId, courseId, labId, submissionData) {
    // Validate input
    if (!userId || !courseId || !labId || !submissionData) {
        throw new ValidationError('Missing required fields');
    }

    // Get current submission count
    const existing = await this.getLatestSubmission(userId, courseId, labId);
    const resubmissionCount = existing ? existing.resubmission_count + 1 : 0;

    // Create submission
    const { data, error } = await this.client
        .from('lab_submissions')
        .insert([{
            user_id: userId,
            course_id: courseId,
            lab_id: labId,
            submission_data: submissionData,
            status: 'submitted',
            resubmission_count: resubmissionCount
        }])
        .select()
        .single();

    if (error) {
        throw new Error('Failed to submit lab');
    }

    return data;
}
```

#### 2. getLabSubmissions(userId, courseId, labId)
```javascript
async getLabSubmissions(userId, courseId, labId) {
    const { data, error } = await this.client
        .from('lab_submissions')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('lab_id', labId)
        .order('submitted_at', { ascending: false });

    if (error) {
        throw new Error('Failed to get lab submissions');
    }

    return data;
}
```

#### 3. getLatestSubmission(userId, courseId, labId)
```javascript
async getLatestSubmission(userId, courseId, labId) {
    const submissions = await this.getLabSubmissions(userId, courseId, labId);
    return submissions.length > 0 ? submissions[0] : null;
}
```

#### 4. provideFeedback(submissionId, trainerId, feedback, status)
```javascript
async provideFeedback(submissionId, trainerId, feedback, status) {
    // Validate status
    if (!['reviewed', 'approved', 'needs_revision'].includes(status)) {
        throw new ValidationError('Invalid status');
    }

    const { data, error } = await this.client
        .from('lab_submissions')
        .update({
            reviewed_by: trainerId,
            reviewed_at: new Date().toISOString(),
            feedback: feedback,
            status: status,
            updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to provide feedback');
    }

    return data;
}
```

#### 5. getSubmissionsForReview(courseId, trainerId)
```javascript
async getSubmissionsForReview(courseId, trainerId) {
    // Get submissions only from assigned learners
    const { data, error } = await this.client
        .from('lab_submissions')
        .select(`
            *,
            user:users!lab_submissions_user_id_fkey(*)
        `)
        .eq('course_id', courseId)
        .in('status', ['submitted', 'needs_revision'])
        .order('submitted_at', { ascending: false });

    if (error) {
        throw new Error('Failed to get submissions for review');
    }

    // Filter to only show submissions from assigned learners
    const assignedLearnerIds = await this.getAssignedLearnerIds(trainerId);
    return data.filter(submission => assignedLearnerIds.includes(submission.user_id));
}

async getAssignedLearnerIds(trainerId) {
    const { data, error } = await this.client
        .from('users')
        .select('id')
        .eq('trainer_id', trainerId);

    if (error) {
        return [];
    }

    return data.map(user => user.id);
}
```

---

## Trainer Content Services

### TrainerContentService

**Purpose**: Handle trainer-specific content access and management

**Methods**:

#### 1. getTrainerContent(courseId, contentType)
```javascript
async getTrainerContent(courseId, contentType) {
    // Load trainer content from course data
    const course = await this.courseService.getCourseById(courseId);
    
    // Filter trainer content
    const trainerContent = course.courseData?.trainerContent || [];
    
    if (contentType) {
        return trainerContent.filter(item => item.type === contentType);
    }
    
    return trainerContent;
}
```

#### 2. recordContentAccess(userId, courseId, contentType, contentPath)
```javascript
async recordContentAccess(userId, courseId, contentType, contentPath) {
    const { data, error } = await this.client
        .from('trainer_content_access')
        .upsert({
            user_id: userId,
            course_id: courseId,
            content_type: contentType,
            content_path: contentPath,
            accessed_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,course_id,content_type,content_path'
        })
        .select()
        .single();

    if (error) {
        console.warn('Failed to record content access', error);
        // Non-critical, don't throw
    }

    return data;
}
```

#### 3. getTrainerContentTypes(courseId)
```javascript
async getTrainerContentTypes(courseId) {
    const content = await this.getTrainerContent(courseId);
    const types = [...new Set(content.map(item => item.type))];
    return types;
}
```

---

## Course Allocation Services

### CourseAllocationService

**Purpose**: Handle course allocation from trainers to assigned learners

**Methods**:

#### 1. getAllCourses()
```javascript
async getAllCourses() {
    // Get all published courses
    const { getPublishedCourses } = await import('../../data/courses.js');
    const courses = await getPublishedCourses();
    return courses;
}
```

#### 2. getAllocatedCourses(userId)
```javascript
async getAllocatedCourses(userId) {
    const { data, error } = await this.client
        .from('course_allocations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('allocated_at', { ascending: false });

    if (error) {
        throw new Error('Failed to get allocated courses');
    }

    return data;
}
```

#### 3. allocateCourse(userId, courseId, trainerId)
```javascript
async allocateCourse(userId, courseId, trainerId) {
    // Verify trainer is assigned to user
    const { data: user, error: userError } = await this.client
        .from('users')
        .select('trainer_id')
        .eq('id', userId)
        .single();

    if (userError || !user || user.trainer_id !== trainerId) {
        throw new Error('Trainer not assigned to this learner');
    }

    // Check if course already allocated
    const { data: existing } = await this.client
        .from('course_allocations')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .single();

    if (existing) {
        // Update existing allocation to active
        const { data, error } = await this.client
            .from('course_allocations')
            .update({
                status: 'active',
                trainer_id: trainerId,
                allocated_by: trainerId,
                allocated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to allocate course');
        }

        return data;
    }

    // Create new allocation
    const { data, error } = await this.client
        .from('course_allocations')
        .insert([{
            user_id: userId,
            course_id: courseId,
            trainer_id: trainerId,
            allocated_by: trainerId,
            status: 'active'
        }])
        .select()
        .single();

    if (error) {
        throw new Error('Failed to allocate course');
    }

    return data;
}
```

#### 4. removeCourseAllocation(userId, courseId, trainerId)
```javascript
async removeCourseAllocation(userId, courseId, trainerId) {
    // Verify trainer is assigned to user
    const { data: user, error: userError } = await this.client
        .from('users')
        .select('trainer_id')
        .eq('id', userId)
        .single();

    if (userError || !user || user.trainer_id !== trainerId) {
        throw new Error('Trainer not assigned to this learner');
    }

    // Update allocation status to removed
    const { data, error } = await this.client
        .from('course_allocations')
        .update({
            status: 'removed',
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to remove course allocation');
    }

    return data;
}
```

#### 5. getAllocationsForLearner(userId, trainerId)
```javascript
async getAllocationsForLearner(userId, trainerId) {
    // Verify trainer is assigned to user
    const { data: user, error: userError } = await this.client
        .from('users')
        .select('trainer_id')
        .eq('id', userId)
        .single();

    if (userError || !user || user.trainer_id !== trainerId) {
        throw new Error('Trainer not assigned to this learner');
    }

    const { data, error } = await this.client
        .from('course_allocations')
        .select('*')
        .eq('user_id', userId)
        .order('allocated_at', { ascending: false });

    if (error) {
        throw new Error('Failed to get course allocations');
    }

    return data;
}
```

#### 6. getAllocationsForTrainer(trainerId)
```javascript
async getAllocationsForTrainer(trainerId) {
    // Get all assigned learners
    const assignedLearners = await this.getAssignedLearners(trainerId);
    const learnerIds = assignedLearners.map(l => l.id);

    if (learnerIds.length === 0) {
        return [];
    }

    const { data, error } = await this.client
        .from('course_allocations')
        .select('*, user:users!course_allocations_user_id_fkey(*)')
        .in('user_id', learnerIds)
        .eq('status', 'active')
        .order('allocated_at', { ascending: false });

    if (error) {
        throw new Error('Failed to get trainer allocations');
    }

    return data;
}
```

#### 7. canAccessCourse(userId, courseId)
```javascript
async canAccessCourse(userId, courseId) {
    // Check if course is allocated to user
    const { data, error } = await this.client
        .from('course_allocations')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'active')
        .single();

    if (error || !data) {
        return false;
    }

    return true;
}
```

#### 8. getAvailableCoursesForLearner(userId, trainerId)
```javascript
async getAvailableCoursesForLearner(userId, trainerId) {
    // Get all courses
    const allCourses = await this.getAllCourses();
    
    // Get allocated courses
    const allocatedCourses = await this.getAllocatedCourses(userId);
    const allocatedCourseIds = allocatedCourses.map(a => a.course_id);
    
    // Filter out already allocated courses
    return allCourses.filter(course => !allocatedCourseIds.includes(course.id));
}
```

---

## Chatbot Services

### ChatbotService

**Purpose**: Handle DV Coach AI chatbot interactions, message processing, and course content retrieval

**Methods**:

#### 1. sendMessage(userId, courseId, message, context = {})
```javascript
async sendMessage(userId, courseId, message, context = {}) {
    // Validate user has access to course
    if (!await this.canAccessCourse(userId, courseId)) {
        throw new Error('Course not allocated to user');
    }

    // Get or create conversation ID
    const conversationId = context.conversationId || uuid_generate_v4();

    // Save user message
    const userMessage = await this.saveMessage({
        user_id: userId,
        course_id: courseId,
        conversation_id: conversationId,
        message: message,
        role: 'user',
        context: context
    });

    // Retrieve relevant course content (RAG)
    const relevantContent = await this.retrieveRelevantContent(courseId, message);

    // Generate AI response with guidelines
    const aiResponse = await this.generateResponse({
        message: message,
        courseId: courseId,
        context: context,
        relevantContent: relevantContent,
        userId: userId
    });

    // Save assistant message
    const assistantMessage = await this.saveMessage({
        user_id: userId,
        course_id: courseId,
        conversation_id: conversationId,
        message: aiResponse.text,
        role: 'assistant',
        context: context,
        sources: aiResponse.sources
    });

    return {
        conversationId: conversationId,
        userMessage: userMessage,
        assistantMessage: assistantMessage
    };
}
```

#### 2. retrieveRelevantContent(courseId, query)
```javascript
async retrieveRelevantContent(courseId, query) {
    // Load course content
    const course = await this.courseService.getCourseById(courseId);
    
    // Search through course content (chapters, labs)
    const searchResults = await this.searchCourseContent(course, query);
    
    // Return top relevant content chunks
    return searchResults.slice(0, 5); // Top 5 relevant chunks
}

async searchCourseContent(course, query) {
    // Simple keyword search (can be enhanced with vector search)
    const results = [];
    
    // Search in chapters
    if (course.courseData?.days) {
        course.courseData.days.forEach(day => {
            day.chapters?.forEach(chapter => {
                if (this.matchesQuery(chapter, query)) {
                    results.push({
                        type: 'chapter',
                        id: chapter.id,
                        title: chapter.title,
                        content: chapter.content,
                        file: chapter.file
                    });
                }
            });
            
            day.labs?.forEach(lab => {
                if (this.matchesQuery(lab, query)) {
                    results.push({
                        type: 'lab',
                        id: lab.id,
                        title: lab.title,
                        content: lab.content,
                        file: lab.file
                    });
                }
            });
        });
    }
    
    return results.sort((a, b) => b.relevance - a.relevance);
}
```

#### 3. generateResponse(params)
```javascript
async generateResponse({ message, courseId, context, relevantContent, userId }) {
    // Build prompt with guidelines
    const prompt = this.buildPrompt({
        message: message,
        courseId: courseId,
        context: context,
        relevantContent: relevantContent,
        guidelines: this.getGuidelines()
    });

    // Call AI service (OpenAI, Anthropic, etc.)
    const response = await this.callAIService(prompt);

    // Extract sources from response
    const sources = this.extractSources(response, relevantContent);

    return {
        text: response.text,
        sources: sources
    };
}

buildPrompt({ message, courseId, context, relevantContent, guidelines }) {
    return `
You are DV Coach, an AI assistant for the ${courseId} course.

GUIDELINES:
${guidelines}

COURSE CONTENT CONTEXT:
${this.formatRelevantContent(relevantContent)}

CURRENT CONTEXT:
${JSON.stringify(context)}

USER QUESTION:
${message}

INSTRUCTIONS:
1. Answer the question using ONLY the provided course content
2. Quote course material appropriately with source references
3. If the question is not related to the course, politely decline
4. Cite sources using format: [Chapter: Title] or [Lab: Title]
5. Be helpful and educational
6. Do not provide information outside the course scope

RESPONSE:
`;
}

getGuidelines() {
    return `
1. Only respond to questions related to the course content
2. Quote course material accurately and cite sources
3. Do not provide information outside the course scope
4. If asked about topics not in the course, politely redirect
5. Use course terminology and concepts appropriately
6. Provide educational and helpful responses
7. Reference specific chapters and labs when relevant
`;
}
```

#### 4. getConversationHistory(userId, courseId, conversationId = null)
```javascript
async getConversationHistory(userId, courseId, conversationId = null) {
    let query = this.client
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .order('created_at', { ascending: true });

    if (conversationId) {
        query = query.eq('conversation_id', conversationId);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error('Failed to get conversation history');
    }

    return data;
}
```

#### 5. saveMessage(messageData)
```javascript
async saveMessage(messageData) {
    const { data, error } = await this.client
        .from('chat_messages')
        .insert([{
            user_id: messageData.user_id,
            course_id: messageData.course_id,
            conversation_id: messageData.conversation_id,
            message: messageData.message,
            role: messageData.role,
            context: messageData.context || {},
            sources: messageData.sources || []
        }])
        .select()
        .single();

    if (error) {
        throw new Error('Failed to save message');
    }

    return data;
}
```

#### 6. canAccessCourse(userId, courseId)
```javascript
async canAccessCourse(userId, courseId) {
    // Check if user is trainer (can access all courses)
    const { data: user } = await this.client
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

    if (user?.role === 'trainer' || user?.role === 'admin') {
        return true;
    }

    // Check course allocation for learners
    const { data: allocation } = await this.client
        .from('course_allocations')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'active')
        .single();

    return !!allocation;
}
```

#### 7. callAIService(prompt)
```javascript
async callAIService(prompt) {
    // Integration with AI service (OpenAI, Anthropic, etc.)
    // This is a placeholder - actual implementation depends on chosen AI service
    
    try {
        // Example with OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        const data = await response.json();
        return {
            text: data.choices[0].message.content,
            usage: data.usage
        };
    } catch (error) {
        throw new Error('AI service error: ' + error.message);
    }
}
```

#### 8. extractSources(response, relevantContent)
```javascript
extractSources(response, relevantContent) {
    const sources = [];
    const responseText = response.text.toLowerCase();

    relevantContent.forEach(content => {
        const title = content.title.toLowerCase();
        if (responseText.includes(title) || responseText.includes(content.id)) {
            sources.push(`${content.type}: ${content.title}`);
        }
    });

    return sources;
}
```

---

## Notification Services

### NotificationService

**Purpose**: Handle email notifications and in-app notifications for users and trainers

**Methods**:

#### 1. sendWelcomeEmail(userId)
```javascript
async sendWelcomeEmail(userId) {
    const user = await this.getUser(userId);
    
    const notification = await this.createNotification({
        user_id: userId,
        type: 'welcome',
        title: 'Welcome to DV Learning Hub',
        message: `Welcome ${user.full_name}! Your account has been created and is pending admin approval.`,
        metadata: {}
    });

    // Send email
    await this.sendEmail({
        to: user.email,
        subject: 'Welcome to DV Learning Hub',
        template: 'welcome',
        data: {
            name: user.full_name,
            email: user.email
        }
    });

    // Update notification
    await this.updateNotification(notification.id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_delivery_status: 'sent'
    });

    return notification;
}
```

#### 2. sendApprovalEmail(userId, approvedBy)
```javascript
async sendApprovalEmail(userId, approvedBy) {
    const user = await this.getUser(userId);
    const approver = await this.getUser(approvedBy);
    
    const notification = await this.createNotification({
        user_id: userId,
        type: 'approval',
        title: 'Account Approved',
        message: `Your account has been approved by ${approver.full_name}. You can now log in and access courses.`,
        metadata: { approved_by: approvedBy }
    });

    await this.sendEmail({
        to: user.email,
        subject: 'Your Account Has Been Approved - DV Learning Hub',
        template: 'approval',
        data: {
            name: user.full_name,
            approver_name: approver.full_name
        }
    });

    await this.updateNotification(notification.id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_delivery_status: 'sent'
    });

    return notification;
}
```

#### 3. sendRejectionEmail(userId, rejectedBy, reason = null)
```javascript
async sendRejectionEmail(userId, rejectedBy, reason = null) {
    const user = await this.getUser(userId);
    const rejector = await this.getUser(rejectedBy);
    
    const notification = await this.createNotification({
        user_id: userId,
        type: 'rejection',
        title: 'Account Rejection',
        message: `Your account has been rejected. ${reason ? 'Reason: ' + reason : 'Please contact support for more information.'}`,
        metadata: { rejected_by: rejectedBy, reason: reason }
    });

    await this.sendEmail({
        to: user.email,
        subject: 'Account Status Update - DV Learning Hub',
        template: 'rejection',
        data: {
            name: user.full_name,
            reason: reason
        }
    });

    await this.updateNotification(notification.id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_delivery_status: 'sent'
    });

    return notification;
}
```

#### 4. sendCourseAssignmentEmail(userId, courseId, trainerId)
```javascript
async sendCourseAssignmentEmail(userId, courseId, trainerId) {
    const user = await this.getUser(userId);
    const trainer = await this.getUser(trainerId);
    const course = await this.courseService.getCourseById(courseId);
    
    const notification = await this.createNotification({
        user_id: userId,
        type: 'course_assignment',
        title: `New Course Assigned: ${course.title}`,
        message: `Your trainer ${trainer.full_name} has assigned you the course "${course.title}". Start learning now!`,
        metadata: { course_id: courseId, trainer_id: trainerId }
    });

    await this.sendEmail({
        to: user.email,
        subject: `New Course Assigned: ${course.title}`,
        template: 'course_assignment',
        data: {
            name: user.full_name,
            course_title: course.title,
            course_description: course.description,
            trainer_name: trainer.full_name
        }
    });

    await this.updateNotification(notification.id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_delivery_status: 'sent'
    });

    return notification;
}
```

#### 5. sendLabSubmissionEmail(userId, labId, courseId, toTrainer = false)
```javascript
async sendLabSubmissionEmail(userId, labId, courseId, toTrainer = false) {
    const user = await this.getUser(userId);
    const course = await this.courseService.getCourseById(courseId);
    
    if (toTrainer) {
        // Send to trainer
        const trainer = await this.getTrainerForLearner(userId);
        
        const notification = await this.createNotification({
            user_id: trainer.id,
            type: 'lab_submission',
            title: `New Lab Submission from ${user.full_name}`,
            message: `${user.full_name} has submitted a lab for review in ${course.title}.`,
            metadata: { learner_id: userId, lab_id: labId, course_id: courseId }
        });

        await this.sendEmail({
            to: trainer.email,
            subject: `New Lab Submission: ${course.title}`,
            template: 'lab_submission_trainer',
            data: {
            trainer_name: trainer.full_name,
            learner_name: user.full_name,
            course_title: course.title,
            lab_id: labId
            }
        });
    } else {
        // Send to learner
        const notification = await this.createNotification({
            user_id: userId,
            type: 'lab_submission',
            title: 'Lab Submission Confirmed',
            message: `Your lab submission for ${course.title} has been received and is pending review.`,
            metadata: { lab_id: labId, course_id: courseId }
        });

        await this.sendEmail({
            to: user.email,
            subject: 'Lab Submission Confirmed',
            template: 'lab_submission_learner',
            data: {
                name: user.full_name,
                course_title: course.title,
                lab_id: labId
            }
        });
    }

    await this.updateNotification(notification.id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_delivery_status: 'sent'
    });

    return notification;
}
```

#### 6. sendLabReviewEmail(userId, labId, courseId, feedback, status)
```javascript
async sendLabReviewEmail(userId, labId, courseId, feedback, status) {
    const user = await this.getUser(userId);
    const course = await this.courseService.getCourseById(courseId);
    
    const statusText = status === 'approved' ? 'approved' : 'needs revision';
    
    const notification = await this.createNotification({
        user_id: userId,
        type: 'lab_review',
        title: `Lab Review: ${statusText}`,
        message: `Your lab submission for ${course.title} has been reviewed. Status: ${statusText}. ${feedback ? 'Feedback: ' + feedback.substring(0, 100) + '...' : ''}`,
        metadata: { lab_id: labId, course_id: courseId, status: status, feedback: feedback }
    });

    await this.sendEmail({
        to: user.email,
        subject: `Lab Review: ${statusText} - ${course.title}`,
        template: 'lab_review',
        data: {
            name: user.full_name,
            course_title: course.title,
            lab_id: labId,
            status: status,
            feedback: feedback
        }
    });

    await this.updateNotification(notification.id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_delivery_status: 'sent'
    });

    return notification;
}
```

#### 7. sendTrainerAssignmentEmail(trainerId, learnerId)
```javascript
async sendTrainerAssignmentEmail(trainerId, learnerId) {
    const trainer = await this.getUser(trainerId);
    const learner = await this.getUser(learnerId);
    
    const notification = await this.createNotification({
        user_id: trainerId,
        type: 'trainer_assignment',
        title: `New Learner Assigned: ${learner.full_name}`,
        message: `A new learner ${learner.full_name} has been assigned to you.`,
        metadata: { learner_id: learnerId }
    });

    await this.sendEmail({
        to: trainer.email,
        subject: `New Learner Assigned: ${learner.full_name}`,
        template: 'trainer_assignment',
        data: {
            trainer_name: trainer.full_name,
            learner_name: learner.full_name,
            learner_email: learner.email
        }
    });

    await this.updateNotification(notification.id, {
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_delivery_status: 'sent'
    });

    return notification;
}
```

#### 8. getNotifications(userId, filters = {})
```javascript
async getNotifications(userId, filters = {}) {
    let query = this.client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (filters.read !== undefined) {
        query = query.eq('read', filters.read);
    }

    if (filters.type) {
        query = query.eq('type', filters.type);
    }

    if (filters.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error('Failed to get notifications');
    }

    return data;
}
```

#### 9. markAsRead(notificationId, userId)
```javascript
async markAsRead(notificationId, userId) {
    const { data, error } = await this.client
        .from('notifications')
        .update({
            read: true,
            read_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to mark notification as read');
    }

    return data;
}
```

#### 10. markAllAsRead(userId)
```javascript
async markAllAsRead(userId) {
    const { data, error } = await this.client
        .from('notifications')
        .update({
            read: true,
            read_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false)
        .select();

    if (error) {
        throw new Error('Failed to mark all notifications as read');
    }

    return data;
}
```

#### 11. getUnreadCount(userId)
```javascript
async getUnreadCount(userId) {
    const { count, error } = await this.client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

    if (error) {
        throw new Error('Failed to get unread count');
    }

    return count || 0;
}
```

#### 12. sendEmail(emailData)
```javascript
async sendEmail({ to, subject, template, data }) {
    // Integration with email service (SendGrid, AWS SES, etc.)
    // This is a placeholder - actual implementation depends on chosen email service
    
    try {
        // Example with SendGrid
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.emailApiKey}`
            },
            body: JSON.stringify({
                personalizations: [{
                    to: [{ email: to }],
                    subject: subject
                }],
                from: { email: this.fromEmail },
                template_id: this.getTemplateId(template),
                dynamic_template_data: data
            })
        });

        if (!response.ok) {
            throw new Error('Email sending failed');
        }

        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send email: ' + error.message);
    }
}
```

#### 13. createNotification(notificationData)
```javascript
async createNotification(notificationData) {
    const { data, error } = await this.client
        .from('notifications')
        .insert([{
            user_id: notificationData.user_id,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            metadata: notificationData.metadata || {}
        }])
        .select()
        .single();

    if (error) {
        throw new Error('Failed to create notification');
    }

    return data;
}
```

#### 14. updateNotification(notificationId, updates)
```javascript
async updateNotification(notificationId, updates) {
    const { data, error } = await this.client
        .from('notifications')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to update notification');
    }

    return data;
}
```

---

## Conclusion

This service layer design provides:
- **Modularity**: Clear service boundaries
- **Reusability**: Services can be used across components
- **Error Handling**: Consistent error handling
- **Flexibility**: Easy to extend with new services
- **Testability**: Services can be tested independently

The service layer acts as a bridge between the UI components and the backend, providing a clean API for business logic operations.

**Service Summary**:
1. **Authentication Services**: Login, registration, session management
2. **User Services**: User profile operations
3. **Course Services**: Course data loading and management
4. **Progress Services**: Progress tracking and persistence
5. **Admin Services**: Admin-specific operations (including trainer assignment)
6. **RBAC Services**: Role-based access control
7. **Lab Submission Services**: Lab submission and feedback (trainer-assigned only)
8. **Trainer Content Services**: Trainer-specific content access
9. **Course Allocation Services**: Course allocation from trainers to learners
10. **Chatbot Services**: DV Coach AI chatbot interactions and responses
11. **Notification Services**: Email and in-app notifications for all events
12. **Reporting Services**: User, trainer, and admin performance reports

---

**Document Status:** Draft - Ready for Review  
**Next Steps:** Review, approval, and implementation

