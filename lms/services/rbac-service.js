/**
 * RBAC Service
 * 
 * Handles role-based access control logic for frontend visibility.
 * Pure logic only - no Supabase calls.
 */

class RBACService {
    constructor() {
        this.validRoles = ['learner', 'trainer', 'admin'];
    }

    /**
     * Check if user has a specific role
     * @param {object|null|undefined} user - User object with role property
     * @param {string} role - Role to check ('learner', 'trainer', 'admin')
     * @returns {boolean} True if user has the role, false otherwise
     */
    hasRole(user, role) {
        if (!user || !user.role) {
            return false;
        }

        if (!this.validRoles.includes(role)) {
            return false;
        }

        return user.role === role;
    }

    /**
     * Check if user can access a content item
     * @param {object|null|undefined} user - User object with role property
     * @param {object} contentItem - Content item with optional requiresRole property
     * @returns {boolean} True if user can access the content, false otherwise
     */
    canAccessContent(user, contentItem) {
        if (!contentItem) {
            return false;
        }

        if (!user || !user.role) {
            return false;
        }

        if (!this.validRoles.includes(user.role)) {
            return false;
        }

        const requiresRole = contentItem.requiresRole;

        if (!requiresRole) {
            return true;
        }

        if (requiresRole === 'trainer') {
            return user.role === 'trainer' || user.role === 'admin';
        }

        return user.role === requiresRole || user.role === 'admin';
    }

    /**
     * Check if user is admin
     * @param {object|null|undefined} user - User object with role property
     * @returns {boolean} True if user is admin, false otherwise
     */
    isAdmin(user) {
        return this.hasRole(user, 'admin');
    }

    /**
     * Check if user is trainer
     * @param {object|null|undefined} user - User object with role property
     * @returns {boolean} True if user is trainer, false otherwise
     */
    isTrainer(user) {
        return this.hasRole(user, 'trainer');
    }

    /**
     * Check if user is learner
     * @param {object|null|undefined} user - User object with role property
     * @returns {boolean} True if user is learner, false otherwise
     */
    isLearner(user) {
        return this.hasRole(user, 'learner');
    }
}

export const rbacService = new RBACService();

