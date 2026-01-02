/**
 * Admin Service
 * 
 * Handles admin-specific operations including user management.
 */

import { supabaseClient } from './supabase-client.js';
import { authService } from './auth-service.js';

class AdminService {
    constructor(client) {
        this.client = client;
    }

    /**
     * Get current admin ID from session
     * @returns {Promise<string>} Admin user ID
     */
    async getCurrentAdminId() {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) {
            throw new Error('Not authenticated');
        }
        if (currentUser.role !== 'admin') {
            throw new Error('Unauthorized: Admin access required');
        }
        return currentUser.id;
    }

    /**
     * Get all users
     * @returns {Promise<Array>} Array of all users
     */
    async getAllUsers() {
        const { data, error } = await this.client
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error('Failed to get users: ' + error.message);
        }

        return data || [];
    }

    /**
     * Approve user
     * Updates user status to 'approved' and creates admin_approvals record
     * @param {string} userId - User ID to approve
     * @returns {Promise<object>} Updated user object
     */
    async approveUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const adminId = await this.getCurrentAdminId();

        const { data: user, error: userError } = await this.client
            .from('users')
            .select('trainer_id, status, role, learner_type')
            .eq('id', userId)
            .single();

        if (userError) {
            throw new Error('User not found: ' + userError.message);
        }

        if (!user) {
            throw new Error('User not found');
        }

        if (user.status === 'approved') {
            throw new Error('User is already approved');
        }

        // Only Active learners require trainer assignment before approval
        // Inactive, Graduate, Archive learners don't need trainer
        // Trainers and admins don't need a trainer assigned
        if (user.role === 'learner' && user.learner_type === 'active' && !user.trainer_id) {
            throw new Error('Cannot approve Active learner without trainer assignment');
        }

        const now = new Date().toISOString();
        
        // Set learner_type to 'active' by default for approved learners (if not already set)
        const updateData = {
            status: 'approved',
            approved_at: now,
            approved_by: adminId,
            updated_at: now
        };
        
        // Set learner_type to 'active' for learners if not set
        if (user.role === 'learner' && !user.learner_type) {
            updateData.learner_type = 'active';
        }

        const { data, error } = await this.client
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to approve user: ' + error.message);
        }

        // Create approval record (non-blocking - don't fail if this fails)
        this.createApprovalRecord(userId, adminId, 'approved', now).catch(err => {
            console.warn('[AdminService] Failed to create approval record (non-critical):', err);
            // User is already approved, this is just for audit trail
        });

        this.notifyUserOnApproval(userId, data).catch(err => {
            console.warn('Failed to notify user on approval:', err);
        });

        return data;
    }

    /**
     * Reject user
     * Updates user status to 'rejected' and creates admin_approvals record
     * @param {string} userId - User ID to reject
     * @returns {Promise<object>} Updated user object
     */
    async rejectUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const adminId = await this.getCurrentAdminId();

        const { data: existingUser, error: userError } = await this.client
            .from('users')
            .select('status')
            .eq('id', userId)
            .single();

        if (userError) {
            throw new Error('User not found: ' + userError.message);
        }

        if (!existingUser) {
            throw new Error('User not found');
        }

        if (existingUser.status === 'rejected') {
            throw new Error('User is already rejected');
        }

        const now = new Date().toISOString();

        const { data, error } = await this.client
            .from('users')
            .update({
                status: 'rejected',
                rejected_at: now,
                rejected_by: adminId,
                updated_at: now
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to reject user: ' + error.message);
        }

        // Create approval record (non-blocking - don't fail if this fails)
        this.createApprovalRecord(userId, adminId, 'rejected', now).catch(err => {
            console.warn('[AdminService] Failed to create approval record (non-critical):', err);
            // User is already rejected, this is just for audit trail
        });

        return data;
    }

    /**
     * Create admin approval record
     * @param {string} userId - User ID
     * @param {string} adminId - Admin ID who performed the action
     * @param {string} status - Approval status ('approved' or 'rejected')
     * @param {string} actionAt - Timestamp of the action
     * @returns {Promise<object>} Created approval record
     */
    async createApprovalRecord(userId, adminId, status, actionAt) {
        const now = new Date().toISOString();

        const approvalData = {
            user_id: userId,
            status: status,
            requested_at: now,
            created_at: now,
            updated_at: now
        };

        if (status === 'approved') {
            approvalData.approved_at = actionAt;
            approvalData.approved_by = adminId;
        } else if (status === 'rejected') {
            approvalData.rejected_at = actionAt;
            approvalData.rejected_by = adminId;
        }

        const { data, error } = await this.client
            .from('admin_approvals')
            .insert([approvalData])
            .select()
            .single();

        if (error) {
            console.error('[AdminService] Failed to create approval record:', error);
            console.error('[AdminService] Approval data:', approvalData);
            // Don't throw error - approval record creation is not critical
            // The user is already approved, this is just for audit trail
            console.warn('[AdminService] Continuing despite approval record creation failure');
            // Return a mock record so the flow continues
            return {
                id: null,
                user_id: userId,
                status: status,
                ...approvalData
            };
        }

        return data;
    }

    /**
     * Update learner type for a user
     * @param {string} userId - User ID
     * @param {string} learnerType - Learner type ('active', 'inactive', 'graduate', 'archive', or null)
     * @returns {Promise<object>} Updated user object
     */
    async updateLearnerType(userId, learnerType) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Validate learner type
        if (learnerType !== null && !['active', 'inactive', 'graduate', 'archive'].includes(learnerType)) {
            throw new Error('Invalid learner type. Must be "active", "inactive", "graduate", "archive", or null');
        }

        await this.getCurrentAdminId(); // Verify admin access

        // Get current user data
        const { data: user, error: userError } = await this.client
            .from('users')
            .select('role, trainer_id, learner_type')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        // Only learners can have learner_type (trainers/admins should have null)
        if (user.role !== 'learner' && learnerType !== null) {
            throw new Error('Learner type can only be set for learners');
        }

        // Validation: Active learners must have trainer_id
        if (learnerType === 'active' && !user.trainer_id) {
            throw new Error('Active learners must have a trainer assigned');
        }

        // Validation: Inactive learners cannot have trainer_id
        if (learnerType === 'inactive' && user.trainer_id) {
            // Remove trainer_id when setting to inactive
            const { data, error } = await this.client
                .from('users')
                .update({
                    learner_type: learnerType,
                    trainer_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select()
                .single();

            if (error) {
                throw new Error('Failed to update learner type: ' + error.message);
            }

            return data;
        }

        // Update learner_type
        const { data, error } = await this.client
            .from('users')
            .update({
                learner_type: learnerType,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to update learner type: ' + error.message);
        }

        return data;
    }

    /**
     * Update user role
     * Allows admin to change user role between 'learner' and 'trainer'
     * @param {string} userId - User ID to update
     * @param {string} newRole - New role ('learner' or 'trainer')
     * @returns {Promise<object>} Updated user object
     */
    async updateUserRole(userId, newRole) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (!newRole || !['learner', 'trainer', 'admin'].includes(newRole)) {
            throw new Error('Invalid role. Must be "learner", "trainer", or "admin"');
        }

        await this.getCurrentAdminId(); // Verify admin access

        const { data: existingUser, error: userError } = await this.client
            .from('users')
            .select('role, id')
            .eq('id', userId)
            .single();

        if (userError || !existingUser) {
            throw new Error('User not found: ' + (userError?.message || 'Unknown error'));
        }

        // Prevent changing own role (safety check)
        const currentUser = await authService.getCurrentUser();
        if (currentUser && currentUser.id === userId && newRole !== 'admin') {
            throw new Error('Cannot change your own role');
        }

        const now = new Date().toISOString();
        
        // If changing to non-learner role, set learner_type to null
        // If changing to learner role, set learner_type to 'active' if not set and has trainer_id
        const { data: currentUserData } = await this.client
            .from('users')
            .select('learner_type, trainer_id')
            .eq('id', userId)
            .single();
        
        const updateData = {
            role: newRole,
            updated_at: now
        };
        
        if (newRole !== 'learner') {
            updateData.learner_type = null;
        } else if (newRole === 'learner' && !currentUserData?.learner_type && currentUserData?.trainer_id) {
            // Set to 'active' by default for new learners with trainer_id
            updateData.learner_type = 'active';
        }

        const { data, error } = await this.client
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to update user role: ' + error.message);
        }

        return data;
    }

    /**
     * Assign or update trainer for a user
     * @param {string} userId - User ID to assign trainer to
     * @param {string} trainerId - Trainer ID (must be a user with role='trainer')
     * @returns {Promise<object>} Updated user object
     */
    async assignTrainer(userId, trainerId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (!trainerId) {
            throw new Error('Trainer ID is required');
        }

        await this.getCurrentAdminId(); // Verify admin access

        // Verify trainer exists and has trainer role
        const { data: trainer, error: trainerError } = await this.client
            .from('users')
            .select('id, role, status')
            .eq('id', trainerId)
            .single();

        if (trainerError || !trainer) {
            throw new Error('Trainer not found: ' + (trainerError?.message || 'Unknown error'));
        }

        if (trainer.role !== 'trainer') {
            throw new Error('Selected user is not a trainer');
        }

        if (trainer.status !== 'approved') {
            throw new Error('Selected trainer is not approved');
        }

        // Verify user exists and get current learner_type
        const { data: user, error: userError } = await this.client
            .from('users')
            .select('id, role, learner_type, status')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('User not found: ' + (userError?.message || 'Unknown error'));
        }

        console.log('[AdminService] assignTrainer - User:', { id: user.id, role: user.role, learner_type: user.learner_type });

        // Prevent assigning trainer to themselves
        if (userId === trainerId) {
            throw new Error('User cannot be assigned as their own trainer');
        }

        // Prevent assigning trainer to admins
        if (user.role === 'admin') {
            throw new Error('Cannot assign trainer to admin users');
        }

        // If user is inactive learner, can't assign trainer
        if (user.role === 'learner' && user.learner_type === 'inactive') {
            throw new Error('Cannot assign trainer to inactive learners. Change learner type to active first.');
        }

        // Trainers can have trainers assigned (for their own lab evaluation)
        // This is allowed, so we don't need to check for trainer role here

        const now = new Date().toISOString();
        const updateData = {
            trainer_id: trainerId,
            updated_at: now
        };
        
        // If assigning trainer to a learner, set learner_type to 'active' if not set
        if (user.role === 'learner' && !user.learner_type) {
            updateData.learner_type = 'active';
        }
        
        // Trainers can also have trainers assigned (for their own lab evaluation)
        // No learner_type change needed for trainers

        const { data, error } = await this.client
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to assign trainer: ' + error.message);
        }

        // Notify trainer about the assignment
        this.notifyTrainerOnAssignment(userId, trainerId, data).catch(err => {
            console.warn('Failed to notify trainer on assignment:', err);
        });

        return data;
    }

    /**
     * Get all trainers (users with role='trainer' and status='approved')
     * @returns {Promise<Array>} Array of trainer users
     */
    async getAllTrainers() {
        const { data, error } = await this.client
            .from('users')
            .select('id, full_name, email, role, status')
            .eq('role', 'trainer')
            .eq('status', 'approved')
            .order('full_name', { ascending: true });

        if (error) {
            throw new Error('Failed to get trainers: ' + error.message);
        }

        return data || [];
    }

    /**
     * Delete user
     * Permanently deletes a user from the system
     * @param {string} userId - User ID to delete
     * @returns {Promise<void>}
     */
    async deleteUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const currentAdminId = await this.getCurrentAdminId(); // Verify admin access
        console.log('[AdminService] Current admin ID:', currentAdminId);

        // Verify user exists and get their role
        const { data: user, error: userError } = await this.client
            .from('users')
            .select('id, role, email, full_name, is_admin')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('User not found: ' + (userError?.message || 'Unknown error'));
        }

        console.log('[AdminService] User to delete:', user);

        // Prevent deleting admin users (check both role and is_admin)
        if (user.role === 'admin' || user.is_admin === true) {
            throw new Error('Cannot delete admin users');
        }

        // Prevent deleting yourself
        if (currentAdminId === userId) {
            throw new Error('Cannot delete your own account');
        }

        // Verify current user is actually an admin
        const { data: currentAdmin, error: adminCheckError } = await this.client
            .from('users')
            .select('id, role, is_admin')
            .eq('id', currentAdminId)
            .single();

        if (adminCheckError || !currentAdmin) {
            throw new Error('Failed to verify admin status');
        }

        console.log('[AdminService] Current admin user:', currentAdmin);
        
        if (currentAdmin.role !== 'admin' && currentAdmin.is_admin !== true) {
            throw new Error('Unauthorized: Admin access required');
        }

        // Delete user (CASCADE will handle related records)
        console.log('[AdminService] Attempting to delete user:', userId);
        const { data: deletedData, error: deleteError } = await this.client
            .from('users')
            .delete()
            .eq('id', userId)
            .select();

        if (deleteError) {
            console.error('[AdminService] Delete error:', deleteError);
            console.error('[AdminService] Error details:', JSON.stringify(deleteError, null, 2));
            throw new Error('Failed to delete user: ' + deleteError.message + ' (Code: ' + (deleteError.code || 'unknown') + ', Details: ' + (deleteError.details || 'none') + ')');
        }

        if (!deletedData || deletedData.length === 0) {
            console.warn('[AdminService] No rows deleted');
            console.warn('[AdminService] This usually means RLS policy blocked the deletion');
            console.warn('[AdminService] Current user role:', currentAdmin.role, 'is_admin:', currentAdmin.is_admin);
            throw new Error('User was not deleted. RLS policy may be blocking deletion. Please ensure "Admins can delete users" policy exists and allows deletion. Current user role: ' + currentAdmin.role + ', is_admin: ' + currentAdmin.is_admin);
        }

        console.log('[AdminService] User deleted successfully:', deletedData);
    }

    /**
     * Notify trainer when a learner is assigned to them
     * @param {string} learnerId - Learner user ID
     * @param {string} trainerId - Trainer user ID
     * @param {object} learnerData - Learner user data
     * @private
     */
    async notifyTrainerOnAssignment(learnerId, trainerId, learnerData) {
        try {
            console.log('[AdminService] Notifying trainer about learner assignment:', { learnerId, trainerId });
            const { notificationService } = await import('./notification-service.js');
            
            // Get learner details
            const { data: learner, error: learnerError } = await this.client
                .from('users')
                .select('id, email, full_name, name')
                .eq('id', learnerId)
                .single();

            if (learnerError || !learner) {
                console.warn('[AdminService] Failed to get learner details for notification:', learnerError);
                return;
            }

            const learnerName = learner.full_name || learner.name || learner.email;
            const adminId = await this.getCurrentAdminId();

            console.log('[AdminService] Creating notification for trainer:', trainerId);
            const result = await notificationService.createNotification(
                trainerId,
                'trainer_assigned',
                'New Learner Assigned',
                `${learnerName} has been assigned to you as a learner.`,
                {
                    learner_id: learnerId,
                    learner_name: learnerName,
                    learner_email: learner.email,
                    assigned_by: adminId,
                    assigned_at: new Date().toISOString()
                },
                '/trainer/course-allocation' // Navigate to course allocation page
            );

            if (result) {
                console.log('[AdminService] ✅ Notification created successfully for trainer:', trainerId);
            } else {
                console.warn('[AdminService] ❌ Failed to create notification for trainer:', trainerId);
            }
        } catch (error) {
            console.error('[AdminService] Error notifying trainer on assignment:', error);
        }
    }

    /**
     * Notify user when their account is approved
     * @param {string} userId - Approved user ID
     * @param {object} userData - Updated user data
     * @private
     */
    async notifyUserOnApproval(userId, userData) {
        try {
            const { notificationService } = await import('./notification-service.js');
            
            await notificationService.createNotification(
                userId,
                'user_approved',
                'Account Approved',
                'Your account has been approved. You can now access the learning platform.',
                {
                    approved_by: userData.approved_by,
                    approved_at: userData.approved_at,
                    trainer_id: userData.trainer_id
                },
                '/courses' // Navigate to courses page
            );
        } catch (error) {
            console.warn('Failed to notify user on approval:', error);
        }
    }
}

export const adminService = new AdminService(supabaseClient);

