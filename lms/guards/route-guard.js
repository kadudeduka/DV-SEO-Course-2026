/**
 * Route Guard
 * 
 * Handles route protection and access control based on authentication and user status.
 */

import { authService } from '../services/auth-service.js';
import { rbacService } from '../services/rbac-service.js';
import { courseAllocationService } from '../services/course-allocation-service.js';

class RouteGuard {
    constructor() {
        this.protectedRoutes = [
            '/courses',
            '/admin'
        ];
    }

    /**
     * Check if a route is protected
     * @param {string} route - Route path
     * @returns {boolean} True if route is protected
     */
    isProtectedRoute(route) {
        if (!route || route === '/') {
            return false;
        }

        const normalizedRoute = route.startsWith('/') ? route : '/' + route;

        return this.protectedRoutes.some(protectedRoute => {
            if (protectedRoute.endsWith('/*')) {
                const baseRoute = protectedRoute.slice(0, -2);
                return normalizedRoute.startsWith(baseRoute);
            }
            return normalizedRoute.startsWith(protectedRoute);
        });
    }

    /**
     * Check if route is a trainer-only route
     * @param {string} route - Route path
     * @returns {boolean} True if route requires trainer role
     */
    isTrainerRoute(route) {
        if (!route) {
            return false;
        }

        const normalizedRoute = route.startsWith('/') ? route : '/' + route;
        return normalizedRoute.includes('/trainer/');
    }

    /**
     * Check if route is a course route
     * @param {string} route - Route path
     * @returns {boolean} True if route is a course route
     */
    isCourseRoute(route) {
        if (!route) {
            return false;
        }

        const normalizedRoute = route.startsWith('/') ? route : '/' + route;
        
        // Exclude specific routes that are not course detail routes
        if (normalizedRoute === '/courses/my-courses') {
            return false;
        }
        
        // Exclude /courses/:id/learn route (handled separately)
        if (normalizedRoute.match(/^\/courses\/[^\/]+\/learn$/)) {
            return false;
        }
        
        return normalizedRoute.startsWith('/courses/') && normalizedRoute !== '/courses';
    }

    /**
     * Check if route is an admin-only route
     * @param {string} route - Route path
     * @returns {boolean} True if route requires admin role
     */
    isAdminRoute(route) {
        if (!route) {
            return false;
        }

        const normalizedRoute = route.startsWith('/') ? route : '/' + route;
        return normalizedRoute.startsWith('/admin');
    }

    /**
     * Extract course ID from route
     * @param {string} route - Route path
     * @returns {string|null} Course ID or null if not found
     */
    extractCourseId(route) {
        if (!route) {
            return null;
        }

        const normalizedRoute = route.startsWith('/') ? route : '/' + route;
        
        // Don't extract course ID for special routes
        if (normalizedRoute === '/courses/my-courses') {
            return null;
        }
        
        const match = normalizedRoute.match(/^\/courses\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * Check route access
     * @param {string} route - Route path
     * @returns {Promise<object>} Guard result with allowed, redirect, and message
     */
    async checkRoute(route) {
        try {
            // Check session first (source of truth) - this is what matters for authentication
            const session = await authService.getSession();
            
            // If no session, user is logged out
            if (!session || !session.profile) {
                // Check if localStorage was cleared (fast-path check for logout)
                const storedUser = localStorage.getItem('lms_user');
                if (!storedUser) {
                    // Definitely logged out - allow public routes only
                    if (this.isProtectedRoute(route) || this.isTrainerRoute(route) || this.isCourseRoute(route) || this.isAdminRoute(route)) {
                        return {
                            allowed: false,
                            redirect: '/login',
                            message: 'Please login to access this page'
                        };
                    }
                    return { allowed: true };
                }
                // Session expired but localStorage still has data - treat as logged out
                if (this.isProtectedRoute(route) || this.isTrainerRoute(route) || this.isCourseRoute(route) || this.isAdminRoute(route)) {
                    return {
                        allowed: false,
                        redirect: '/login',
                        message: 'Please login to access this page'
                    };
                }
                return { allowed: true };
            }

            // Session exists - user is authenticated, get full user data
            const currentUser = await authService.getCurrentUser();

            if (!currentUser) {
                if (this.isProtectedRoute(route) || this.isTrainerRoute(route) || this.isCourseRoute(route) || this.isAdminRoute(route)) {
                    return {
                        allowed: false,
                        redirect: '/login',
                        message: 'Please login to access this page'
                    };
                }
                return { allowed: true };
            }

            // Only allow approved users (admins are always allowed)
            const isAdmin = currentUser.is_admin === true || currentUser.role === 'admin';
            
            if (!isAdmin && currentUser.status !== 'approved') {
                // Block all routes for non-approved users
                if (currentUser.status === 'pending') {
                    return {
                        allowed: false,
                        redirect: '/account-status',
                        message: 'Your account is pending admin approval. Please wait for approval before accessing the LMS.'
                    };
                }

                if (currentUser.status === 'rejected') {
                    return {
                        allowed: false,
                        redirect: '/account-status',
                        message: 'Your account has been rejected. Please contact support for assistance.'
                    };
                }

                // Status is NULL or something else - not approved
                return {
                    allowed: false,
                    redirect: '/account-status',
                    message: 'Your account is not approved. Please contact support for assistance.'
                };
            }

            // User is approved (or admin) - continue with route checks
            // Check if user is archived (cannot access system)
            if (currentUser.role === 'learner' && currentUser.learner_type === 'archive') {
                return {
                    allowed: false,
                    redirect: '/login',
                    message: 'Your account has been archived. Please contact support for assistance.'
                };
            }

            // Check admin routes first
            if (this.isAdminRoute(route)) {
                if (rbacService.isAdmin(currentUser)) {
                    return { allowed: true };
                } else {
                    return {
                        allowed: false,
                        redirect: '/courses',
                        message: 'Access denied: Admin dashboard is only available to administrators'
                    };
                }
            }

            // Redirect learners from general course listing to their allocated courses
            if (route === '/courses' && rbacService.isLearner(currentUser)) {
                return {
                    allowed: false,
                    redirect: '/courses/my-courses',
                    message: 'Redirecting to your allocated courses'
                };
            }

            if (this.isTrainerRoute(route)) {
                if (rbacService.isTrainer(currentUser) || rbacService.isAdmin(currentUser)) {
                    return { allowed: true };
                } else {
                    return {
                        allowed: false,
                        redirect: '/courses/my-courses',
                        message: 'Access denied: Trainer content is only available to trainers'
                    };
                }
            }

            // Check for /courses/:id/learn route (should allow access if course is allocated)
            if (route.match(/^\/courses\/[^\/]+\/learn$/)) {
                const match = route.match(/^\/courses\/([^\/]+)\/learn$/);
                if (match) {
                    const courseId = match[1];
                    if (rbacService.isTrainer(currentUser) || rbacService.isAdmin(currentUser)) {
                        return { allowed: true };
                    }
                    if (rbacService.isLearner(currentUser)) {
                        // Inactive and Archive learners have limited access
                        if (currentUser.learner_type === 'inactive' || currentUser.learner_type === 'archive') {
                            return {
                                allowed: false,
                                redirect: '/courses/my-courses',
                                message: 'You have limited access. Please contact your administrator.'
                            };
                        }
                        
                        const canAccess = await courseAllocationService.canAccessCourse(currentUser.id, courseId);
                        if (!canAccess) {
                            return {
                                allowed: false,
                                redirect: '/courses/my-courses',
                                message: 'You do not have access to this course'
                            };
                        }
                        return { allowed: true };
                    }
                }
            }

            if (this.isCourseRoute(route)) {
                const courseId = this.extractCourseId(route);
                if (courseId) {
                    // Skip access check for special routes like "my-courses"
                    if (courseId === 'my-courses') {
                        return { allowed: true };
                    }
                    
                    if (rbacService.isTrainer(currentUser) || rbacService.isAdmin(currentUser)) {
                        return { allowed: true };
                    }

                    if (rbacService.isLearner(currentUser)) {
                        const canAccess = await courseAllocationService.canAccessCourse(currentUser.id, courseId);
                        if (!canAccess) {
                            return {
                                allowed: false,
                                redirect: '/courses/my-courses',
                                message: 'You do not have access to this course'
                            };
                        }
                    }
                }
            }

            return { allowed: true };
        } catch (error) {
            console.error('Route guard error:', error);
            if (this.isProtectedRoute(route) || this.isTrainerRoute(route) || this.isCourseRoute(route) || this.isAdminRoute(route)) {
                return {
                    allowed: false,
                    redirect: '/login',
                    message: 'Authentication error. Please login again.'
                };
            }
            return { allowed: true };
        }
    }

    /**
     * Get default route for user based on role
     * @param {object} user - User object with role
     * @returns {string} Default route path
     */
    getDefaultRoute(user) {
        if (!user) {
            return '/login';
        }

        if (user.role === 'admin') {
            return '/admin/dashboard';
        }

        if (user.role === 'trainer') {
            return '/courses';
        }

        if (user.role === 'learner') {
            return '/courses/my-courses';
        }

        return '/courses';
    }
}

export const routeGuard = new RouteGuard();

