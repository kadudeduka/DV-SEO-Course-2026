# DV Learning Hub - System Architecture Design Document

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Draft  
**Architect:** System Design Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [System Architecture](#system-architecture)
4. [Technology Stack](#technology-stack)
5. [Architecture Layers](#architecture-layers)
6. [Component Architecture](#component-architecture)
7. [Data Architecture](#data-architecture)
8. [Integration Architecture](#integration-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Scalability Considerations](#scalability-considerations)

---

## Overview

### Purpose
This document defines the high-level system architecture for DV Learning Hub, a static frontend LMS application that leverages Supabase as a Backend-as-a-Service (BaaS) for authentication, user management, and data persistence.

### Architecture Goals
- **Simplicity**: Minimal dependencies, vanilla JavaScript
- **Scalability**: Support for 100+ courses and 10,000+ users
- **Maintainability**: Clear separation of concerns, modular design
- **Security**: Role-based access control, secure authentication
- **Performance**: Fast page loads, efficient content delivery
- **Portability**: Static site deployment (GitHub Pages compatible)

### System Context
```
┌─────────────────────────────────────────────────────────────┐
│                    DV Learning Hub                          │
│                  (Static Frontend SPA)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Supabase   │ │   GitHub     │ │   CDN/       │
│   (BaaS)     │ │   Pages      │ │   Assets     │
│              │ │   (Hosting)  │ │   (Static)   │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Architecture Principles

### 1. Static-First Architecture
- All frontend code is static HTML/CSS/JavaScript
- No server-side rendering or build-time compilation required
- Content served directly from file system or CDN
- Backend operations via Supabase API only

### 2. Separation of Concerns
- **Presentation Layer**: UI components and views
- **Business Logic Layer**: Services and business rules
- **Data Access Layer**: Supabase client and data operations
- **Configuration Layer**: Environment and app configuration

### 3. Modular Design
- Each module has a single responsibility
- ES6 modules for code organization
- Clear module boundaries and interfaces
- Minimal coupling between modules

### 4. Progressive Enhancement
- Core functionality works without JavaScript (basic)
- Enhanced experience with JavaScript enabled
- Graceful degradation for older browsers
- Offline support for cached content

### 5. Security by Design
- Authentication at the edge (route guards)
- Authorization at multiple layers (UI, route, API)
- Row-Level Security (RLS) in database
- Secure credential management

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Presentation Layer (UI)                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Pages   │  │Components│  │  Styles  │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Application Layer (Core Logic)                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Router  │  │   App    │  │  Guards  │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Service Layer (Business Logic)                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │   Auth   │  │  Course  │  │ Progress │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Data Layer (Supabase Client)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Client  │  │  Cache   │  │  Storage │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (BaaS)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │    Auth      │  │  Database    │  │   Storage    │         │
│  │  (JWT/Session)│  │ (PostgreSQL)  │  │   (Assets)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Layers

#### 1. Presentation Layer
- **Responsibility**: User interface rendering and interaction
- **Components**: HTML pages, UI components, CSS styles
- **Technologies**: HTML5, CSS3, Vanilla JavaScript
- **Key Files**: `index.html`, `lms/components/*`, `lms/styles/*`

#### 2. Application Layer
- **Responsibility**: Application orchestration, routing, state management
- **Components**: Router, App controller, Route guards
- **Technologies**: ES6 modules, Hash-based routing
- **Key Files**: `lms/core/app.js`, `lms/core/router.js`, `lms/guards/*`

#### 3. Service Layer
- **Responsibility**: Business logic, data operations, API communication
- **Components**: Auth service, Course service, Progress service, RBAC service
- **Technologies**: Supabase JS client, LocalStorage API
- **Key Files**: `lms/services/*`

#### 4. Data Layer
- **Responsibility**: Data persistence, caching, storage
- **Components**: Supabase client, LocalStorage, Session storage
- **Technologies**: Supabase SDK, Browser Storage APIs
- **Key Files**: `lms/services/*-service.js`

---

## Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | Latest | Semantic markup |
| CSS3 | Latest | Styling and layout |
| JavaScript | ES6+ | Application logic |
| ES6 Modules | Native | Code organization |
| Marked.js | Latest | Markdown rendering |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | Latest | BaaS platform |
| PostgreSQL | 15+ | Database (via Supabase) |
| Row-Level Security | Native | Data access control |
| JWT | Native | Authentication tokens |

### Development Tools

| Tool | Purpose |
|------|---------|
| Git | Version control |
| GitHub Pages | Static hosting |
| Local HTTP Server | Development server |

### No Build Tools Required
- No webpack, vite, or bundlers
- No transpilation (ES6+ native support)
- No minification (optional for production)
- Direct file serving

---

## Architecture Layers

### Layer 1: Presentation Layer

**Purpose**: Render UI and handle user interactions

**Components**:
- **Pages**: Login, Register, Course Listing, Course Detail, Course Content, Admin Dashboard
- **Components**: CourseCard, ContentViewer, NavigationSidebar, AuthForm, AdminTable
- **Styles**: Global styles, component styles, responsive design

**Responsibilities**:
- DOM manipulation
- Event handling
- UI state management (local)
- Visual feedback (loading, errors, success)

**Key Principles**:
- Declarative UI updates
- Component reusability
- Responsive design
- Accessibility compliance

### Layer 2: Application Layer

**Purpose**: Orchestrate application flow and manage global state

**Components**:
- **App Controller**: Main application class (`lms/core/app.js`)
- **Router**: Hash-based routing (`lms/core/router.js`)
- **Route Guards**: Access control (`lms/guards/route-guard.js`)

**Responsibilities**:
- Route management
- Application initialization
- Global state management
- Route protection
- Error handling

**Key Principles**:
- Single source of truth for app state
- Centralized routing
- Route-based code splitting (lazy loading)
- Guard-based security

### Layer 3: Service Layer

**Purpose**: Implement business logic and data operations

**Components**:
- **Auth Service**: Authentication and session management
- **User Service**: User profile operations
- **Course Service**: Course data loading and management
- **Progress Service**: Progress tracking and persistence
- **RBAC Service**: Role-based access control logic
- **Admin Service**: Admin-specific operations

**Responsibilities**:
- Business rule enforcement
- Data validation
- API communication
- Error handling
- Data transformation

**Key Principles**:
- Single responsibility per service
- Stateless services (where possible)
- Consistent error handling
- Async/await for async operations

### Layer 4: Data Layer

**Purpose**: Data persistence and retrieval

**Components**:
- **Supabase Client**: Backend API client
- **LocalStorage**: Client-side caching
- **Session Storage**: Session data
- **IndexedDB**: (Future) Large data storage

**Responsibilities**:
- Data persistence
- Data retrieval
- Caching strategies
- Offline support

**Key Principles**:
- Cache-first strategy
- Offline fallback
- Data synchronization
- Secure storage

---

## Component Architecture

### Core Components

```
lms/
├── core/
│   ├── app.js              # Main application controller
│   └── router.js           # Hash-based router
│
├── services/
│   ├── auth-service.js    # Authentication operations
│   ├── user-service.js    # User profile operations
│   ├── course-service.js  # Course data operations
│   ├── progress-service.js # Progress tracking
│   ├── rbac-service.js    # Role-based access control
│   └── admin-service.js   # Admin operations
│
├── components/
│   ├── auth-ui.js         # Login/Register UI
│   ├── course-listing.js  # Course list component
│   ├── course-detail.js   # Course detail component
│   ├── content-viewer.js  # Markdown content renderer
│   ├── navigation-sidebar.js # Course navigation
│   └── admin-ui.js        # Admin dashboard UI
│
├── guards/
│   └── route-guard.js     # Route protection logic
│
├── utils/
│   ├── markdown-renderer.js # Markdown to HTML
│   ├── storage.js         # Storage utilities
│   └── validators.js      # Input validation
│
└── styles/
    └── styles.css         # Global styles
```

### Component Dependencies

```
┌─────────────┐
│  index.html │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   app.js    │ ◄───┐
└──────┬──────┘     │
       │            │
       ├────────────┘
       │
       ├──► router.js
       ├──► route-guard.js
       ├──► services/* (via dependency injection)
       └──► components/* (via dynamic imports)
```

---

## Data Architecture

### Data Flow

```
User Action
    │
    ▼
Component (UI)
    │
    ▼
Service (Business Logic)
    │
    ▼
Supabase Client (Data Access)
    │
    ▼
Supabase API (Backend)
    │
    ▼
PostgreSQL Database
    │
    ▼
Response
    │
    ▼
Service (Transform)
    │
    ▼
Component (Update UI)
```

### Data Storage Strategy

1. **Session Data**: Supabase session (JWT tokens)
2. **User Profile**: Supabase `public.users` table
3. **Progress Data**: 
   - Primary: Supabase `public.user_progress` table
   - Fallback: LocalStorage
4. **Course Data**: Static JSON/MD files in `data/` folder
5. **Configuration**: `config/app.config.js` + `config/app.config.local.js`

### Caching Strategy

- **Course Metadata**: Loaded once, cached in memory
- **Course Content**: Lazy-loaded, cached after first load
- **User Session**: Cached in memory, persisted in Supabase
- **Progress Data**: Cached in memory, synced with Supabase

---

## Integration Architecture

### Supabase Integration

```
┌─────────────────────────────────────┐
│      Frontend Application           │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Supabase JS Client          │  │
│  │   @supabase/supabase-js       │  │
│  └───────────────┬───────────────┘  │
└──────────────────┼──────────────────┘
                   │ HTTPS/REST
                   ▼
┌─────────────────────────────────────┐
│         Supabase Platform           │
│                                     │
│  ┌──────────┐  ┌──────────┐       │
│  │   Auth   │  │ Database  │       │
│  │  Service │  │  Service  │       │
│  └──────────┘  └──────────┘       │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Row-Level Security (RLS)   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### API Integration Points

1. **Authentication API**
   - `supabase.auth.signUp()`
   - `supabase.auth.signIn()`
   - `supabase.auth.signOut()`
   - `supabase.auth.getSession()`

2. **Database API**
   - `supabase.from('users').select()`
   - `supabase.from('users').update()`
   - `supabase.from('user_progress').select()`
   - `supabase.from('user_progress').upsert()`

3. **Admin API**
   - `supabase.from('users').update()` (with admin privileges)
   - `supabase.rpc('approve_user')` (if using functions)

---

## Deployment Architecture

### Static Hosting Architecture

```
┌─────────────────────────────────────┐
│      GitHub Repository              │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Static Files               │  │
│  │   - HTML, CSS, JS           │  │
│  │   - Course Data (JSON/MD)    │  │
│  │   - Assets (Images, SVGs)   │  │
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      GitHub Pages (CDN)             │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Global CDN Distribution     │  │
│  │   - Fast content delivery     │  │
│  │   - HTTPS enabled             │  │
│  │   - No server required        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Environment Configuration

- **Development**: Local HTTP server, `config/app.config.local.js`
- **Production**: GitHub Pages, environment variables via GitHub Secrets
- **Configuration**: Merged from `app.config.js` + `app.config.local.js`

---

## Scalability Considerations

### Horizontal Scalability

- **Static Files**: Served via CDN (GitHub Pages)
- **Backend**: Supabase handles scaling automatically
- **Database**: Supabase PostgreSQL scales automatically
- **No Server**: No server-side scaling needed

### Vertical Scalability

- **Client-Side Caching**: Reduce API calls
- **Lazy Loading**: Load content on demand
- **Code Splitting**: Load modules as needed
- **Asset Optimization**: Compress images, minify code (optional)

### Performance Optimizations

1. **Content Delivery**
   - CDN for static assets
   - Lazy loading for course content
   - Caching headers for static files

2. **API Optimization**
   - Batch API calls where possible
   - Cache API responses
   - Use Supabase real-time subscriptions (optional)

3. **Client-Side Optimization**
   - Debounce user input
   - Virtual scrolling for long lists (future)
   - Service Worker for offline support (future)

---

## Security Architecture

### Security Layers

1. **Authentication Layer**
   - Supabase Auth (JWT tokens)
   - Secure session management
   - Password hashing (bcrypt via Supabase)

2. **Authorization Layer**
   - Route guards (client-side)
   - Role-based access control (RBAC)
   - Row-Level Security (RLS) in database

3. **Data Security Layer**
   - HTTPS only
   - Secure API keys (not in code)
   - Input validation
   - XSS prevention (content sanitization)

### Security Best Practices

- Never expose admin credentials in frontend
- Use environment variables for sensitive config
- Validate all user inputs
- Sanitize markdown content before rendering
- Use Supabase RLS policies for data access
- Implement CSRF protection (Supabase managed)

---

## Conclusion

This architecture provides a solid foundation for DV Learning Hub with:
- **Simplicity**: Minimal dependencies, easy to understand
- **Scalability**: Can handle growth in users and courses
- **Security**: Multiple layers of protection
- **Maintainability**: Clear separation of concerns
- **Performance**: Optimized for fast loading and delivery

The static-first approach ensures easy deployment and low operational overhead, while Supabase provides enterprise-grade backend services without the complexity of managing infrastructure.

---

**Document Status:** Draft - Ready for Review  
**Next Steps:** Review, approval, and detailed design documents

