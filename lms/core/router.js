/**
 * Router
 * 
 * Handles hash-based routing with route protection.
 */

import { routeGuard } from '../guards/route-guard.js';

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.messageContainer = null;
    }

    /**
     * Initialize router
     * @param {HTMLElement} messageContainer - Container for displaying route guard messages
     */
    init(messageContainer = null) {
        this.messageContainer = messageContainer;
        window.addEventListener('hashchange', () => this.handleRouteChange());
        this.handleRouteChange();
    }

    /**
     * Add route
     * @param {string} pattern - Route pattern (e.g., '/courses', '/courses/:id')
     * @param {Function} handler - Route handler function
     */
    addRoute(pattern, handler) {
        this.routes.set(pattern, handler);
    }

    /**
     * Navigate to route
     * @param {string} route - Route path
     */
    async navigate(route) {
        // Prevent duplicate navigations to the same route
        const targetHash = route.startsWith('#') ? route.slice(1) : route;
        const currentHash = window.location.hash.slice(1) || '/';
        
        // Normalize both hashes for comparison
        const normalizedTarget = targetHash.replace(/^\/+|\/+$/g, '') || '/';
        const normalizedCurrent = currentHash.replace(/^\/+|\/+$/g, '') || '/';
        
        if (normalizedTarget === normalizedCurrent && this._isNavigating) {
            console.log('[Router] Already navigating to', normalizedTarget, '- skipping duplicate navigation');
            return;
        }
        
        this._isNavigating = true;
        const normalizedRoute = route.startsWith('/') ? route : '/' + route;
        if (window.location.hash.slice(1) !== normalizedRoute) {
            window.location.hash = normalizedRoute;
        } else {
            await this.handleRouteChange();
        }
    }

    /**
     * Handle route change
     */
    async handleRouteChange() {
        try {
            const hash = window.location.hash.slice(1) || '/';
            const route = this.parseRoute(hash);

            console.log('[Router] Handling route change:', hash, '→', route.path);

            this.clearMessage();

            const guardResult = await routeGuard.checkRoute(route.path);
            console.log('[Router] Guard result:', guardResult);

            if (!guardResult.allowed) {
                if (guardResult.redirect) {
                    console.log('[Router] Redirecting to:', guardResult.redirect);
                    await this.navigate(guardResult.redirect);
                    if (guardResult.message) {
                        this.showMessage(guardResult.message);
                    }
                    return;
                }

                if (guardResult.message) {
                    this.showMessage(guardResult.message);
                }
                return;
            }

            // If parseRoute already found a handler, use it
            let routeConfig = route.handler;
            
            // Otherwise, try findRoute
            if (!routeConfig) {
                routeConfig = this.findRoute(route.path);
            }
            
            console.log('[Router] Route config found:', !!routeConfig, 'for path:', route.path);
            
            if (routeConfig) {
                this.currentRoute = route;
                try {
                    // Add page transition
                    const container = document.getElementById('app-container');
                    if (container) {
                        container.classList.add('page-transition-out');
                        await new Promise(resolve => setTimeout(resolve, 150));
                    }
                    
                    console.log('[Router] Calling route handler with route:', route);
                    console.log('[Router] Route handler function:', routeConfig);
                    await routeConfig(route);
                    console.log('[Router] Route handler executed successfully');
                    
                    // Fade in new page
                    if (container) {
                        container.classList.remove('page-transition-out');
                        container.classList.add('page-transition-in');
                        setTimeout(() => {
                            container.classList.remove('page-transition-in');
                        }, 300);
                    }
                } catch (error) {
                    console.error('[Router] Error executing route handler:', error);
                }
            } else {
                console.log('[Router] No route config found for:', route.path);
                if (route.path === '/') {
                    const currentUser = await this.getCurrentUser();
                    if (currentUser) {
                        // Redirect to dashboard based on role
                        const role = currentUser.role;
                        if (role === 'admin') {
                            await this.navigate('/admin/dashboard');
                        } else if (role === 'trainer') {
                            await this.navigate('/trainer/dashboard');
                        } else {
                            await this.navigate('/dashboard');
                        }
                    } else {
                        await this.navigate('/login');
                    }
                }
            }
        } finally {
            // Reset navigation flag after route change completes
            this._isNavigating = false;
        }
    }

    /**
     * Parse route from hash
     * @param {string} hash - Hash string (e.g., '/courses/seo-master-2026')
     * @returns {object} Parsed route object
     */
    parseRoute(hash) {
        // Normalize hash: remove leading/trailing slashes, remove any # characters, and handle empty hash
        // Remove all # characters and leading/trailing slashes
        let normalizedHash = hash.replace(/#/g, '').replace(/^\/+|\/+$/g, '') || '';
        
        // Extract query parameters (e.g., ?queryId=123)
        const queryParams = {};
        const queryIndex = normalizedHash.indexOf('?');
        if (queryIndex !== -1) {
            const queryString = normalizedHash.substring(queryIndex + 1);
            normalizedHash = normalizedHash.substring(0, queryIndex);
            
            // Parse query string
            queryString.split('&').forEach(param => {
                const [key, value] = param.split('=');
                if (key && value) {
                    queryParams[decodeURIComponent(key)] = decodeURIComponent(value);
                }
            });
        }
        
        const parts = normalizedHash.split('/').filter(part => part.length > 0);
        
        if (parts.length === 0) {
            return { path: '/', params: {}, query: queryParams };
        }

        const path = '/' + parts.join('/');
        const params = {};

        // For course sub-routes (lab, content, trainer), don't match generic /courses
        // Check for specific patterns first
        if (path.startsWith('/courses/')) {
            // Check for lab, content, or trainer routes - these should not match /courses
            const hasSubRoute = /^\/courses\/[^\/]+\/(lab|content|trainer)\//.test(path);
            if (hasSubRoute) {
                // Don't try to match registered routes for sub-routes, let findRoute handle it
                return { path: path, params: {} };
            }
        }

        for (const [pattern, handler] of this.routes.entries()) {
            const match = this.matchRoute(path, pattern);
            if (match) {
                return {
                    path: match.path,
                    pattern: pattern,
                    params: match.params,
                    query: queryParams,
                    handler: handler
                };
            }
        }

        return { path: path, params: {}, query: queryParams };
    }

    /**
     * Match route against pattern
     * @param {string} route - Route path
     * @param {string} pattern - Route pattern
     * @returns {object|null} Match result or null
     */
    matchRoute(route, pattern) {
        const routeParts = route.split('/').filter(part => part.length > 0);
        const patternParts = pattern.split('/').filter(part => part.length > 0);

        if (routeParts.length !== patternParts.length) {
            if (!pattern.includes('*')) {
                return null;
            }
        }

        const params = {};
        let matches = true;

        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const routePart = routeParts[i];

            if (patternPart.startsWith(':')) {
                const paramName = patternPart.slice(1);
                params[paramName] = routePart;
            } else if (patternPart === '*') {
                break;
            } else if (patternPart !== routePart) {
                matches = false;
                break;
            }
        }

        if (pattern.endsWith('/*')) {
            const basePattern = pattern.slice(0, -2);
            if (route.startsWith(basePattern)) {
                matches = true;
            }
        }

        return matches ? { path: route, params: params } : null;
    }

    /**
     * Find route handler
     * @param {string} routePath - Route path
     * @returns {Function|null} Route handler or null
     */
    findRoute(routePath) {
        // First, check for specific course sub-routes (lab, content, trainer) BEFORE checking registered routes
        // This ensures more specific routes are matched first
        if (routePath.startsWith('/courses')) {
            // Check for most specific routes first (my-courses, lab, content, trainer) before generic /courses
            
            // 0. Check for /courses/my-courses first (before /courses/:id)
            if (routePath === '/courses/my-courses') {
                const myCoursesHandler = this.routes.get('/courses/my-courses');
                if (myCoursesHandler) {
                    return myCoursesHandler;
                }
            }
            
            // 0.5. Check for /courses/:id/learn route (before /courses/:id)
            const learnMatch = routePath.match(/^\/courses\/([^\/]+)\/learn$/);
            if (learnMatch) {
                const courseId = learnMatch[1];
                const learnHandler = this.routes.get('/courses/:id/learn');
                if (learnHandler) {
                    return (route) => learnHandler({ ...route, params: { id: courseId } });
                }
                return async (route) => {
                    const { default: StartLearning } = await import('../components/start-learning.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const startLearning = new StartLearning(container);
                        await startLearning.show(courseId);
                    }
                };
            }
            
            // 1. Check for lab routes: /courses/:id/lab/:labId
            const labMatch = routePath.match(/^\/courses\/([^\/]+)\/lab\/(.+)$/);
            console.log('[Router] findRoute - Checking lab route for:', routePath);
            console.log('[Router] findRoute - Lab regex match result:', labMatch);
            if (labMatch) {
                console.log('[Router] findRoute - Lab route MATCHED! courseId:', labMatch[1], 'labId:', labMatch[2]);
                const courseId = labMatch[1];
                const labId = labMatch[2];
                const labHandler = this.routes.get('/courses/:id/lab/:labId');
                if (labHandler) {
                    return (route) => labHandler({ ...route, params: { id: courseId, labId: labId } });
                }
                return async (route) => {
                    const { default: LabViewer } = await import('../components/lab-viewer.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const labViewer = new LabViewer(container);
                        await labViewer.show(courseId, labId);
                    }
                };
            }
            
            // 2. Check for chapter content routes: /courses/:id/content/:chapterId
            const courseContentMatch = routePath.match(/^\/courses\/([^\/]+)\/content\/(.+)$/);
            if (courseContentMatch) {
                const courseId = courseContentMatch[1];
                const chapterId = courseContentMatch[2];
                const contentHandler = this.routes.get('/courses/:id/content/:chapterId');
                if (contentHandler) {
                    return (route) => contentHandler({ ...route, params: { id: courseId, chapterId: chapterId } });
                }
                return async (route) => {
                    const { default: ContentViewer } = await import('../components/content-viewer.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const contentViewer = new ContentViewer(container);
                        await contentViewer.show(courseId, chapterId);
                    }
                };
            }
            
            // 3. Check for trainer content routes: /courses/:id/trainer/:contentId
            const trainerContentMatch = routePath.match(/^\/courses\/([^\/]+)\/trainer\/(.+)$/);
            if (trainerContentMatch) {
                const courseId = trainerContentMatch[1];
                const contentId = trainerContentMatch[2];
                const trainerHandler = this.routes.get('/courses/:id/trainer/:contentId');
                if (trainerHandler) {
                    return (route) => trainerHandler({ ...route, params: { id: courseId, contentId: contentId } });
                }
                return async (route) => {
                    const { default: ContentViewer } = await import('../components/content-viewer.js');
                    const { rbacService } = await import('../services/rbac-service.js');
                    const { authService } = await import('../services/auth-service.js');
                    const container = document.getElementById('app-container');
                    
                    if (container) {
                        const currentUser = await authService.getCurrentUser();
                        
                        if (!rbacService.isTrainer(currentUser) && !rbacService.isAdmin(currentUser)) {
                            await this.navigate('/courses');
                            this.showMessage('Access denied: Trainer content is only available to trainers');
                            return;
                        }
                        
                        const contentViewer = new ContentViewer(container);
                        await contentViewer.showTrainerContent(courseId, contentId);
                    }
                };
            }
            
            // 4. Check for course detail routes: /courses/:id
            const courseDetailMatch = routePath.match(/^\/courses\/([^\/]+)$/);
            if (courseDetailMatch) {
                const courseId = courseDetailMatch[1];
                const courseDetailHandler = this.routes.get('/courses/:id');
                if (courseDetailHandler) {
                    return (route) => courseDetailHandler({ ...route, params: { id: courseId } });
                }
                return async (route) => {
                    const { default: CourseDetail } = await import('../components/course-detail.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const courseDetail = new CourseDetail(container);
                        await courseDetail.show(courseId);
                    }
                };
            }
            
            // 5. Check for generic /courses route (least specific)
            const coursesHandler = this.routes.get('/courses');
            if (coursesHandler) {
                return coursesHandler;
            }
            
            // 6. Fallback to CourseListing
            return async (route) => {
                const { default: CourseListing } = await import('../components/course-listing.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const courseListing = new CourseListing(container);
                    await courseListing.show();
                }
            };
        }

        if (routePath.startsWith('/trainer/course-allocation')) {
            const courseAllocationHandler = this.routes.get('/trainer/course-allocation');
            if (courseAllocationHandler) {
                console.log('[Router] Found registered handler for /trainer/course-allocation');
                return courseAllocationHandler;
            }
            console.log('[Router] No registered handler, using fallback for /trainer/course-allocation');
            return async (route) => {
                console.log('[Router] Fallback handler for /trainer/course-allocation called');
                try {
                    const { default: CourseAllocationUI } = await import('../components/course-allocation-ui.js');
                    console.log('[Router] CourseAllocationUI imported');
                    const container = document.getElementById('app-container');
                    if (container) {
                        console.log('[Router] Container found, creating CourseAllocationUI instance');
                        const courseAllocationUI = new CourseAllocationUI(container);
                        console.log('[Router] Calling courseAllocationUI.show()');
                        await courseAllocationUI.show();
                        console.log('[Router] courseAllocationUI.show() completed');
                    } else {
                        console.error('[Router] Container not found in fallback handler!');
                    }
                } catch (error) {
                    console.error('[Router] Error in fallback handler:', error);
                    throw error;
                }
            };
        }

        if (routePath.startsWith('/notifications')) {
            const notificationsHandler = this.routes.get('/notifications');
            if (notificationsHandler) {
                return notificationsHandler;
            }
            return async (route) => {
                const { default: NotificationCenter } = await import('../components/notification-center.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const notificationCenter = new NotificationCenter(container);
                    await notificationCenter.show();
                }
            };
        }

        if (routePath.startsWith('/trainer/lab-review')) {
            const trainerReviewHandler = this.routes.get('/trainer/lab-review');
            if (trainerReviewHandler) {
                return trainerReviewHandler;
            }
            return async (route) => {
                const { default: TrainerLabReview } = await import('../components/trainer-lab-review.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const trainerLabReview = new TrainerLabReview(container);
                    await trainerLabReview.show();
                }
            };
        }

        // Submission Detail Route
        if (routePath.startsWith('/submissions/')) {
            const submissionMatch = routePath.match(/^\/submissions\/(.+)$/);
            if (submissionMatch) {
                const submissionId = submissionMatch[1];
                const submissionHandler = this.routes.get('/submissions/:id');
                if (submissionHandler) {
                    return (route) => submissionHandler({ ...route, params: { id: submissionId } });
                }
                return async (route) => {
                    const { default: SubmissionDetail } = await import('../components/submission-detail.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const submissionDetail = new SubmissionDetail(container);
                        await submissionDetail.show(submissionId);
                    }
                };
            }
        }

        // Account Status Routes
        if (routePath === '/account/pending') {
            const handler = this.routes.get('/account/pending');
            if (handler) return handler;
            return async (route) => {
                const { default: AccountStatus } = await import('../components/account-status.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const accountStatus = new AccountStatus(container);
                    await accountStatus.showPending();
                }
            };
        }

        if (routePath === '/account/rejected') {
            const handler = this.routes.get('/account/rejected');
            if (handler) return handler;
            return async (route) => {
                const { default: AccountStatus } = await import('../components/account-status.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const accountStatus = new AccountStatus(container);
                    await accountStatus.showRejected();
                }
            };
        }

        // Learner Dashboard Route
        if (routePath === '/' || routePath === '/dashboard') {
            const dashboardHandler = this.routes.get('/dashboard') || this.routes.get('/');
            if (dashboardHandler) {
                return dashboardHandler;
            }
            return async (route) => {
                const { default: LearnerDashboard } = await import('../components/learner-dashboard.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const learnerDashboard = new LearnerDashboard(container);
                    await learnerDashboard.show();
                }
            };
        }

        // Learner Routes
        if (routePath === '/courses/my-courses') {
            const handler = this.routes.get('/courses/my-courses');
            if (handler) return handler;
            return async (route) => {
                const { default: MyCourses } = await import('../components/my-courses.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const myCourses = new MyCourses(container);
                    await myCourses.show();
                }
            };
        }

        if (routePath.match(/^\/courses\/([^\/]+)\/learn$/)) {
            const match = routePath.match(/^\/courses\/([^\/]+)\/learn$/);
            if (match) {
                const courseId = match[1];
                const handler = this.routes.get('/courses/:id/learn');
                if (handler) {
                    return (route) => handler({ ...route, params: { id: courseId } });
                }
                return async (route) => {
                    const { default: StartLearning } = await import('../components/start-learning.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const startLearning = new StartLearning(container);
                        await startLearning.show(courseId);
                    }
                };
            }
        }

        if (routePath.match(/^\/submissions\/(.+)$/)) {
            const match = routePath.match(/^\/submissions\/(.+)$/);
            if (match) {
                const submissionId = match[1];
                const handler = this.routes.get('/submissions/:id');
                if (handler) {
                    return (route) => handler({ ...route, params: { id: submissionId } });
                }
                return async (route) => {
                    const { default: SubmissionDetail } = await import('../components/submission-detail.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const submissionDetail = new SubmissionDetail(container);
                        await submissionDetail.show(submissionId);
                    }
                };
            }
        }

        if (routePath === '/profile') {
            const handler = this.routes.get('/profile');
            if (handler) return handler;
            return async (route) => {
                const { default: UserProfile } = await import('../components/user-profile.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const userProfile = new UserProfile(container);
                    await userProfile.show();
                }
            };
        }

        // Trainer Routes
        if (routePath === '/trainer/dashboard') {
            const handler = this.routes.get('/trainer/dashboard');
            if (handler) return handler;
            return async (route) => {
                const { default: TrainerDashboard } = await import('../components/trainer-dashboard.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const trainerDashboard = new TrainerDashboard(container);
                    await trainerDashboard.show();
                }
            };
        }

        if (routePath === '/trainer/learners') {
            const handler = this.routes.get('/trainer/learners');
            if (handler) return handler;
            return async (route) => {
                const { default: TrainerLearnersList } = await import('../components/trainer-learners-list.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const learnersList = new TrainerLearnersList(container);
                    await learnersList.show();
                }
            };
        }

        if (routePath.match(/^\/trainer\/learners\/([^\/]+)$/)) {
            const match = routePath.match(/^\/trainer\/learners\/([^\/]+)$/);
            if (match) {
                const learnerId = match[1];
                const handler = this.routes.get('/trainer/learners/:id');
                if (handler) {
                    return (route) => handler({ ...route, params: { id: learnerId } });
                }
                // Redirect to reports page for learner details
                return async (route) => {
                    window.location.hash = `#/reports/trainer/learner/${learnerId}`;
                };
            }
        }

        if (routePath.match(/^\/trainer\/learners\/([^\/]+)\/progress$/)) {
            const match = routePath.match(/^\/trainer\/learners\/([^\/]+)\/progress$/);
            if (match) {
                const learnerId = match[1];
                const handler = this.routes.get('/trainer/learners/:id/progress');
                if (handler) {
                    return (route) => handler({ ...route, params: { id: learnerId } });
                }
                // Redirect to reports page for learner details
                return async (route) => {
                    window.location.hash = `#/reports/trainer/learner/${learnerId}`;
                };
            }
        }

        if (routePath === '/trainer/evaluations' || routePath.startsWith('/trainer/evaluations/')) {
            const handler = this.routes.get('/trainer/evaluations') || this.routes.get('/trainer/evaluations/pending');
            if (handler) return handler;
            return async (route) => {
                const { default: EvaluationQueue } = await import('../components/evaluation-queue.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const evaluationQueue = new EvaluationQueue(container);
                    await evaluationQueue.show();
                }
            };
        }

        if (routePath.match(/^\/trainer\/lab-review\/(.+)$/)) {
            const match = routePath.match(/^\/trainer\/lab-review\/(.+)$/);
            if (match) {
                const submissionId = match[1];
                const handler = this.routes.get('/trainer/lab-review/:id');
                if (handler) {
                    return (route) => handler({ ...route, params: { id: submissionId } });
                }
                return async (route) => {
                    const { default: TrainerLabReview } = await import('../components/trainer-lab-review.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const trainerLabReview = new TrainerLabReview(container);
                        await trainerLabReview.showSubmission(submissionId);
                    }
                };
            }
        }

        // Admin Routes
        if (routePath === '/admin/users/pending') {
            const handler = this.routes.get('/admin/users/pending');
            if (handler) return handler;
            return async (route) => {
                const { default: PendingApprovals } = await import('../components/pending-approvals.js');
                const container = document.getElementById('app-container');
                if (container) {
                    const pendingApprovals = new PendingApprovals(container);
                    await pendingApprovals.show();
                }
            };
        }

        if (routePath.match(/^\/admin\/users\/([^\/]+)$/)) {
            const match = routePath.match(/^\/admin\/users\/([^\/]+)$/);
            if (match) {
                const userId = match[1];
                const handler = this.routes.get('/admin/users/:id');
                if (handler) {
                    return (route) => handler({ ...route, params: { id: userId } });
                }
                return async (route) => {
                    const { default: UserDetail } = await import('../components/user-detail.js');
                    const container = document.getElementById('app-container');
                    if (container) {
                        const userDetail = new UserDetail(container);
                        await userDetail.show(userId);
                    }
                };
            }
        }

        if (routePath.startsWith('/admin')) {
            const adminHandler = this.routes.get('/admin/*');
            if (adminHandler) {
                return adminHandler;
            }
            
            const dashboardHandler = this.routes.get('/admin/dashboard');
            if (dashboardHandler) {
                return dashboardHandler;
            }
        }

        return null;
    }

    /**
     * Get current user (helper method)
     * @returns {Promise<object|null>} Current user or null
     */
    async getCurrentUser() {
        try {
            const { authService } = await import('../services/auth-service.js');
            return await authService.getCurrentUser();
        } catch (error) {
            return null;
        }
    }

    /**
     * Show message
     * @param {string} message - Message to display
     */
    showMessage(message) {
        if (!this.messageContainer) {
            const container = document.getElementById('app-container');
            if (container) {
                this.messageContainer = document.createElement('div');
                this.messageContainer.id = 'route-message';
                this.messageContainer.style.cssText = 'padding: 15px; margin: 20px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; color: #856404;';
                container.insertBefore(this.messageContainer, container.firstChild);
            } else {
                console.warn('Route guard message:', message);
                return;
            }
        }

        this.messageContainer.textContent = message;
        this.messageContainer.style.display = 'block';
    }

    /**
     * Clear message
     */
    clearMessage() {
        if (this.messageContainer) {
            this.messageContainer.style.display = 'none';
            this.messageContainer.textContent = '';
        }
    }

    /**
     * Get current route
     * @returns {object|null} Current route object
     */
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    /**
     * Refresh header component
     */
    async refreshHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            try {
                const { default: Header } = await import('../components/header.js');
                const header = new Header(headerContainer);
                await header.refresh();
            } catch (error) {
                console.warn('Failed to refresh header:', error);
            }
        }
    }
}

export const router = new Router();

