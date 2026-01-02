# DV Learning Hub - Frontend Architecture Design Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Draft  
**Architect:** System Design Team

---

## Table of Contents

1. [Overview](#overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Module Structure](#module-structure)
4. [Component Design](#component-design)
5. [State Management](#state-management)
6. [Routing Architecture](#routing-architecture)
7. [Service Layer](#service-layer)
8. [UI/UX Patterns](#uiux-patterns)
9. [Performance Optimization](#performance-optimization)

---

## Overview

### Purpose
This document defines the frontend architecture, component design, and implementation patterns for DV Learning Hub.

### Technology Stack
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS variables
- **Vanilla JavaScript (ES6+)**: No frameworks
- **ES6 Modules**: Code organization
- **Marked.js**: Markdown rendering

### Design Principles
- **No Frameworks**: Pure vanilla JavaScript
- **Modular Design**: ES6 modules with clear boundaries
- **Progressive Enhancement**: Works without JS (basic)
- **Component-Based**: Reusable UI components
- **Separation of Concerns**: Clear layer separation

---

## Frontend Architecture

### Architecture Layers

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  ┌──────────┐  ┌──────────┐          │
│  │  Pages   │  │Components │          │
│  └──────────┘  └──────────┘          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│        Application Layer                 │
│  ┌──────────┐  ┌──────────┐          │
│  │   App    │  │  Router  │          │
│  └──────────┘  └──────────┘          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│         Service Layer                   │
│  ┌──────────┐  ┌──────────┐          │
│  │ Services │  │   Utils  │          │
│  └──────────┘  └──────────┘          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│          Data Layer                     │
│  ┌──────────┐  ┌──────────┐          │
│  │ Supabase │  │  Storage │          │
│  └──────────┘  └──────────┘          │
└─────────────────────────────────────────┘
```

---

## Module Structure

### Directory Structure

```
lms/
├── core/                          # Core application logic
│   ├── app.js                    # Main LMS application class
│   └── router.js                 # Hash-based router
│
├── services/                      # Business logic services
│   ├── auth-service.js          # Authentication operations
│   ├── user-service.js          # User profile operations
│   ├── course-service.js        # Course data operations
│   ├── progress-service.js      # Progress tracking
│   ├── rbac-service.js          # Role-based access control
│   └── admin-service.js         # Admin operations
│
├── components/                    # UI components
│   ├── auth-ui.js               # Login/Register UI
│   ├── course-listing.js        # Course list component
│   ├── course-detail.js         # Course detail component
│   ├── content-viewer.js        # Markdown content renderer
│   ├── navigation-sidebar.js    # Course navigation
│   ├── admin-ui.js              # Admin dashboard UI
│   └── header.js                # Application header
│
├── guards/                        # Route guards
│   └── route-guard.js           # Route protection logic
│
├── utils/                         # Utility functions
│   ├── markdown-renderer.js     # Markdown to HTML
│   ├── storage.js               # Storage utilities
│   ├── validators.js            # Input validation
│   └── helpers.js               # General helpers
│
└── styles/                        # Styling
    ├── styles.css               # Global styles
    ├── components.css           # Component styles
    └── variables.css            # CSS variables
```

---

## Component Design

### Component Architecture

Each component follows this structure:

```javascript
// Component Pattern
class ComponentName {
    constructor(container, dependencies) {
        this.container = container;
        this.dependencies = dependencies;
        this.state = {};
    }

    async init() {
        // Initialize component
    }

    render() {
        // Render component UI
    }

    attachEventListeners() {
        // Attach event handlers
    }

    destroy() {
        // Cleanup
    }
}

export default ComponentName;
```

### Core Components

#### 1. App (core/app.js)

**Purpose**: Main application controller

**Responsibilities**:
- Application initialization
- Global state management
- Route coordination
- Service orchestration

**Key Methods**:
```javascript
class LMS {
    constructor() {
        this.currentUser = null;
        this.currentCourse = null;
        this.currentRoute = null;
        this.services = {};
    }

    async init() { }
    async handleRoute(route) { }
    showLMSContent() { }
    hideLMSContent() { }
}
```

#### 2. Router (core/router.js)

**Purpose**: Hash-based routing

**Responsibilities**:
- Route parsing
- Route matching
- Route change events
- Browser history management

**Key Methods**:
```javascript
class Router {
    constructor() {
        this.routes = [];
        this.currentRoute = null;
    }

    addRoute(pattern, handler) { }
    navigate(route) { }
    parseRoute(hash) { }
    matchRoute(route, pattern) { }
}
```

#### 3. AuthUI (components/auth-ui.js)

**Purpose**: Authentication UI (login/register)

**Responsibilities**:
- Render login form
- Render register form
- Handle form submissions
- Display error messages

**Key Methods**:
```javascript
class AuthUI {
    showLoginScreen() { }
    showRegisterScreen() { }
    handleLogin(email, password) { }
    handleRegister(name, email, password) { }
    showError(message) { }
    clearErrors() { }
}
```

#### 4. CourseListing (components/course-listing.js)

**Purpose**: Display list of available courses

**Responsibilities**:
- Load course metadata
- Render course cards
- Handle course selection
- Filter/search (future)

**Key Methods**:
```javascript
class CourseListing {
    async loadCourses() { }
    renderCourseCard(course) { }
    handleCourseClick(courseId) { }
    filterCourses(criteria) { }
}
```

#### 5. ContentViewer (components/content-viewer.js)

**Purpose**: Render markdown content

**Responsibilities**:
- Load markdown files
- Convert markdown to HTML
- Render content with styling
- Handle navigation (prev/next)

**Key Methods**:
```javascript
class ContentViewer {
    async loadContent(filePath) { }
    renderMarkdown(markdown) { }
    showContent(content) { }
    navigateToNext() { }
    navigateToPrevious() { }
}
```

#### 6. NavigationSidebar (components/navigation-sidebar.js)

**Purpose**: Course navigation sidebar

**Responsibilities**:
- Display course structure
- Handle navigation clicks
- Show progress indicators
- Filter by content type

**Key Methods**:
```javascript
class NavigationSidebar {
    renderCourseStructure(courseData) { }
    highlightActiveItem(itemId) { }
    showProgressIndicators(progress) { }
    filterByType(type) { }
}
```

#### 7. ReportViewer (components/report-viewer.js)

**Purpose**: Display reports for users, trainers, and admins

**Responsibilities**:
- Render user performance reports
- Render trainer performance reports
- Render admin reports
- Display charts and statistics
- Export reports (future)

**Key Methods**:
```javascript
class ReportViewer {
    async loadUserReport(userId) { }
    async loadTrainerReport(trainerId) { }
    async loadAdminUserReport() { }
    async loadAdminTrainerReport() { }
    renderReport(data) { }
    renderCharts(data) { }
    exportReport(format) { }
}
```

#### 8. TrainerAssignmentUI (components/trainer-assignment-ui.js)

**Purpose**: Admin interface for trainer assignment

**Responsibilities**:
- Display trainer dropdown
- Assign trainer to user
- Change trainer assignment
- Validate trainer assignment before approval
- Show assigned trainer in user table

**Key Methods**:
```javascript
class TrainerAssignmentUI {
    async loadTrainers() { }
    renderTrainerDropdown(userId, currentTrainerId) { }
    async assignTrainer(userId, trainerId) { }
    async changeTrainer(userId, newTrainerId) { }
    validateTrainerAssignment(userId) { }
}
```

#### 9. CourseAllocationUI (components/course-allocation-ui.js)

**Purpose**: Trainer interface for course allocation to assigned learners

**Responsibilities**:
- Display all available courses
- Display assigned learners
- Allocate courses to learners
- Remove course allocations
- View current allocations per learner
- Filter and search courses

**Key Methods**:
```javascript
class CourseAllocationUI {
    async loadAllCourses() { }
    async loadAssignedLearners() { }
    async loadAllocationsForLearner(userId) { }
    renderCourseList(courses) { }
    renderLearnerList(learners) { }
    renderAllocationTable(allocations) { }
    async allocateCourse(userId, courseId) { }
    async removeAllocation(userId, courseId) { }
    filterCoursesByAllocation(userId) { }
}
```

#### 10. ChatbotWidget (components/chatbot-widget.js)

**Purpose**: DV Coach AI chatbot interface - pop-up chat widget

**Responsibilities**:
- Display chat interface (pop-up widget)
- Send user messages
- Display AI responses
- Show conversation history
- Display source citations
- Handle course context
- Manage chat state (open/closed)

**Key Methods**:
```javascript
class ChatbotWidget {
    constructor(courseId, userId) {
        this.courseId = courseId;
        this.userId = userId;
        this.conversationId = null;
        this.isOpen = false;
    }

    toggleChat() { }
    async sendMessage(message) { }
    async loadConversationHistory() { }
    renderMessage(message, role) { }
    renderSources(sources) { }
    updateContext(context) { }
    handleError(error) { }
    closeChat() { }
}
```

#### 11. NotificationCenter (components/notification-center.js)

**Purpose**: In-app notification center for displaying and managing notifications

**Responsibilities**:
- Display notification list
- Show unread count badge
- Mark notifications as read
- Filter notifications by type
- Delete notifications
- Display notification details
- Real-time notification updates

**Key Methods**:
```javascript
class NotificationCenter {
    constructor(userId) {
        this.userId = userId;
        this.isOpen = false;
    }

    async loadNotifications(filters) { }
    async markAsRead(notificationId) { }
    async markAllAsRead() { }
    async deleteNotification(notificationId) { }
    renderNotificationList(notifications) { }
    renderNotificationItem(notification) { }
    getUnreadCount() { }
    toggleNotificationCenter() { }
    updateBadge() { }
}
```

#### 12. NotificationBadge (components/notification-badge.js)

**Purpose**: Notification badge component for header/navigation

**Responsibilities**:
- Display unread notification count
- Show notification icon
- Handle click to open notification center
- Update count in real-time
- Visual indicator for new notifications

**Key Methods**:
```javascript
class NotificationBadge {
    constructor(userId) {
        this.userId = userId;
        this.unreadCount = 0;
    }

    async updateCount() { }
    render() { }
    attachClickHandler() { }
}
```

---

## State Management

### State Architecture

```
Application State
├── User State
│   ├── currentUser (object)
│   ├── session (object)
│   └── permissions (array)
│
├── Course State
│   ├── currentCourse (object)
│   ├── courseData (object)
│   └── filteredContent (array)
│
├── Progress State
│   ├── progress (object)
│   └── completedItems (array)
│
└── UI State
    ├── activeRoute (string)
    ├── sidebarOpen (boolean)
    ├── chatOpen (boolean)
    └── loading (boolean)
    
├── Chatbot State
    ├── currentConversation (string)
    ├── messages (array)
    ├── courseContext (object)
    └── isLoading (boolean)
    
└── Notification State
    ├── notifications (array)
    ├── unreadCount (number)
    ├── notificationCenterOpen (boolean)
    └── filters (object)
```

### State Management Pattern

```javascript
// State Manager Pattern
class StateManager {
    constructor() {
        this.state = {
            user: null,
            course: null,
            progress: {},
            ui: {}
        };
        this.listeners = [];
    }

    setState(key, value) {
        this.state[key] = value;
        this.notifyListeners(key, value);
    }

    getState(key) {
        return this.state[key];
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notifyListeners(key, value) {
        this.listeners.forEach(listener => listener(key, value));
    }
}
```

### State Persistence

- **Session State**: Supabase session (JWT)
- **Progress State**: Supabase + LocalStorage (fallback)
- **UI Preferences**: LocalStorage
- **Course Data**: In-memory cache

---

## Routing Architecture

### Route Structure

```
Routes:
├── /login                    # User login page
├── /register                 # User registration page
├── /admin/login              # Admin login page
├── /courses                  # Course listing page
├── /courses/:id              # Course detail page
├── /courses/:id/content      # Course content (overview)
├── /courses/:id/content/:day/:type/:id  # Specific content item
├── /admin/dashboard          # Admin dashboard
├── /trainer-content          # Trainer-only content
├── /trainer/course-allocation # Trainer course allocation interface
├── /reports/user             # User performance report
├── /reports/trainer          # Trainer performance report
├── /reports/admin            # Admin reports (user & trainer)
├── /chat                     # Chatbot interface (pop-up widget, accessible from all pages)
└── /notifications            # Notification center (accessible from header)
```

### Route Guard Pattern

```javascript
// Route Guard
class RouteGuard {
    async checkRoute(route, user) {
        // Check authentication
        if (!user && this.isProtectedRoute(route)) {
            return { allowed: false, redirect: '/login' };
        }

        // Check authorization
        if (user && !this.hasPermission(route, user)) {
            return { allowed: false, redirect: this.getDefaultRoute(user) };
        }

        // Check user status
        if (user && user.status === 'pending') {
            return { allowed: false, message: 'Account pending approval' };
        }

        return { allowed: true };
    }

    isProtectedRoute(route) { }
    hasPermission(route, user) { }
    getDefaultRoute(user) { }
}
```

### Hash-Based Routing

```javascript
// Router Implementation
class Router {
    constructor() {
        this.routes = new Map();
        window.addEventListener('hashchange', () => this.handleRouteChange());
    }

    addRoute(pattern, handler, guard) {
        this.routes.set(pattern, { handler, guard });
    }

    async navigate(route) {
        window.location.hash = route;
        await this.handleRouteChange();
    }

    async handleRouteChange() {
        const hash = window.location.hash.slice(1) || '/';
        const route = this.parseRoute(hash);
        
        // Check route guard
        const guardResult = await this.checkGuard(route);
        if (!guardResult.allowed) {
            this.navigate(guardResult.redirect);
            return;
        }

        // Execute route handler
        const routeConfig = this.findRoute(route);
        if (routeConfig) {
            await routeConfig.handler(route);
        }
    }

    parseRoute(hash) {
        // Parse hash into route object
        // Example: #courses/seo-master-2026 -> { path: 'courses', id: 'seo-master-2026' }
    }
}
```

---

## Service Layer

### Service Pattern

```javascript
// Service Pattern
class Service {
    constructor(dependencies) {
        this.dependencies = dependencies;
    }

    async execute(params) {
        try {
            // Validate input
            this.validate(params);
            
            // Execute operation
            const result = await this.performOperation(params);
            
            // Transform result
            return this.transform(result);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    validate(params) { }
    async performOperation(params) { }
    transform(result) { }
    handleError(error) { }
}
```

### Service Examples

#### AuthService

```javascript
class AuthService {
    constructor(supabaseClient) {
        this.client = supabaseClient;
    }

    async login(email, password) {
        const { data, error } = await this.client.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        return data;
    }

    async register(name, email, password) {
        // Register user
        const { data, error } = await this.client.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        // Create user profile
        await this.createUserProfile(data.user.id, name, email);
        
        return data;
    }

    async logout() {
        await this.client.auth.signOut();
    }

    async getSession() {
        const { data } = await this.client.auth.getSession();
        return data.session;
    }
}
```

#### CourseService

**Purpose**: Handle course data loading and management with course allocation filtering

```javascript
class CourseService {
    constructor(allocationService = null) {
        this.cache = new Map();
        this.allocationService = allocationService;
    }

    async getCourses(userId = null) {
        // Check cache
        const cacheKey = userId ? `courses_${userId}` : 'courses';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { getCourses } = await import('../../data/courses.js');
        const courses = await getCourses();
        
        // Filter published courses
        let publishedCourses = courses.filter(c => c.published === true);
        
        // If userId provided, filter by allocations
        if (userId && this.allocationService) {
            const allocatedCourses = await this.allocationService.getAllocatedCourses(userId);
            const allocatedCourseIds = allocatedCourses.map(a => a.course_id);
            publishedCourses = publishedCourses.filter(c => allocatedCourseIds.includes(c.id));
        }
        
        this.cache.set(cacheKey, publishedCourses);
        return publishedCourses;
    }

    async getCourseById(courseId, userId = null) {
        // Check allocation if userId provided
        if (userId && this.allocationService) {
            const canAccess = await this.allocationService.canAccessCourse(userId, courseId);
            if (!canAccess) {
                throw new Error('Course not allocated to user');
            }
        }

        const courses = await this.getCourses(userId);
        return courses.find(c => c.id === courseId);
    }

    async getCourseContent(courseId, contentPath) {
        // Load markdown file
        const response = await fetch(contentPath);
        const markdown = await response.text();
        return markdown;
    }
}
```

#### ProgressService

```javascript
class ProgressService {
    constructor(supabaseClient, localStorage) {
        this.client = supabaseClient;
        this.storage = localStorage;
    }

    async getProgress(userId, courseId) {
        // Try Supabase first
        if (this.client) {
            try {
                const { data } = await this.client
                    .from('user_progress')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('course_id', courseId);
                return this.transformProgress(data);
            } catch (error) {
                console.warn('Supabase error, using localStorage', error);
            }
        }

        // Fallback to localStorage
        return this.getProgressFromStorage(userId, courseId);
    }

    async saveProgress(userId, courseId, contentId, completed) {
        const progress = {
            user_id: userId,
            course_id: courseId,
            content_id: contentId,
            completed,
            completed_at: completed ? new Date().toISOString() : null
        };

        // Save to Supabase
        if (this.client) {
            try {
                await this.client
                    .from('user_progress')
                    .upsert(progress);
            } catch (error) {
                console.warn('Supabase error, using localStorage', error);
            }
        }

        // Always save to localStorage as fallback
        this.saveProgressToStorage(userId, courseId, contentId, completed);
    }
}
```

---

## UI/UX Patterns

### Component Rendering Pattern

```javascript
// Render Pattern
class Component {
    render() {
        this.container.innerHTML = this.getTemplate();
        this.attachEventListeners();
    }

    getTemplate() {
        return `
            <div class="component">
                ${this.renderHeader()}
                ${this.renderContent()}
                ${this.renderFooter()}
            </div>
        `;
    }

    renderHeader() { }
    renderContent() { }
    renderFooter() { }
}
```

### Error Handling Pattern

```javascript
// Error Handling
class ErrorHandler {
    static showError(message, container) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        container.appendChild(errorEl);
        
        setTimeout(() => errorEl.remove(), 5000);
    }

    static handleAPIError(error) {
        if (error.message.includes('email')) {
            return 'Invalid email address';
        }
        if (error.message.includes('password')) {
            return 'Invalid password';
        }
        return 'An error occurred. Please try again.';
    }
}
```

### Loading State Pattern

```javascript
// Loading State
class LoadingState {
    static show(container) {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    static hide(container) {
        const loading = container.querySelector('.loading');
        if (loading) loading.remove();
    }
}
```

---

## Performance Optimization

### Lazy Loading

```javascript
// Lazy Load Components
async function loadComponent(componentName) {
    const module = await import(`./components/${componentName}.js`);
    return module.default;
}

// Lazy Load Course Data
async function loadCourseData(courseId) {
    const module = await import(`../../data/courses/${courseId}/structure.js`);
    return module.courseData;
}
```

### Caching Strategy

```javascript
// Cache Manager
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.maxSize = 100;
    }

    get(key) {
        return this.cache.get(key);
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}
```

### Debouncing

```javascript
// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

---

## Conclusion

This frontend architecture provides:
- **Modularity**: Clear component boundaries
- **Maintainability**: Easy to understand and modify
- **Performance**: Optimized loading and rendering
- **Scalability**: Can grow with new features
- **Testability**: Clear interfaces for testing

The vanilla JavaScript approach ensures:
- No build step required
- Fast development cycle
- Easy debugging
- Small bundle size
- Framework independence

---

**Document Status:** Draft - Ready for Review  
**Next Steps:** Review, approval, and implementation

