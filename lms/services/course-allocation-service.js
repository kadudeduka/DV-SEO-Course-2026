/**
 * Course Allocation Service
 * 
 * Handles course allocation from trainers to assigned learners.
 * 
 * This service provides methods to allocate courses to learners, check access,
 * and manage allocation status. Course allocations control which courses learners
 * can see and access, but do not handle enrollment logic.
 * 
 * CONTRACT:
 * 
 * Database Table: public.course_allocations
 * 
 * Table Structure:
 * - id: UUID (Primary Key) - Unique identifier for the allocation
 * - user_id: UUID (Foreign Key → public.users.id) - Learner who receives the course allocation
 * - course_id: TEXT (Not Null) - Course identifier
 * - trainer_id: UUID (Foreign Key → public.users.id) - Trainer who allocated the course (must be learner's assigned trainer)
 * - allocated_at: TIMESTAMPTZ - When the course was allocated
 * - allocated_by: UUID (Foreign Key → public.users.id) - Trainer who performed the allocation
 * - status: TEXT (Default 'active') - Allocation status ('active' or 'removed')
 * - created_at: TIMESTAMPTZ - Record creation timestamp
 * - updated_at: TIMESTAMPTZ - Last update timestamp
 * 
 * ALLOCATION RULES:
 * 
 * 1. One Learner ↔ Many Courses:
 *    - A single learner can have multiple course allocations
 *    - Each allocation is a separate record in the table
 *    - Unique constraint: (user_id, course_id) ensures one allocation per course per learner
 *    - Multiple courses can be allocated to the same learner
 * 
 * 2. Trainer Assignment Requirement:
 *    - Only trainers can allocate courses to learners
 *    - Trainer must be the assigned trainer of the learner (trainer_id must match learner's trainer_id in users table)
 *    - Trainer can only allocate courses to their assigned learners
 *    - Both trainer_id and allocated_by must reference the same trainer (the one performing the allocation)
 * 
 * 3. Status Values:
 *    - 'active': Course is currently allocated and visible to the learner
 *    - 'removed': Course allocation has been removed (soft delete, record remains for audit)
 *    - Default status is 'active' when creating a new allocation
 *    - Status can be changed from 'active' to 'removed' but not back to 'active' (use allocateCourse to reactivate)
 * 
 * 4. Visibility Control (Not Enrollment):
 *    - Allocations control which courses are VISIBLE to learners
 *    - Allocations do NOT handle enrollment, registration, or access control logic
 *    - If a course is allocated (status='active'), the learner can see and access it
 *    - If a course is not allocated or status='removed', the learner cannot see it
 *    - Trainers and admins can see all courses regardless of allocations
 *    - CourseService should filter courses based on allocations for learners
 * 
 * SERVICE METHODS (to be implemented):
 * 
 * 1. getAllCourses()
 *    - Returns all published courses available in the system
 *    - Used by trainers to see which courses they can allocate
 *    - Returns: Array of course objects
 *    - Note: This does not filter by allocations, shows all available courses
 * 
 * 2. getAllocatedCourses(userId)
 *    - Returns all courses allocated to a specific learner
 *    - Only returns allocations with status='active'
 *    - Ordered by allocated_at DESC (most recent first)
 *    - Returns: Array of allocation records with course_id
 *    - Used by learners to see their available courses
 * 
 * 3. allocateCourse(userId, courseId, trainerId)
 *    - Allocates a course to a learner
 *    - Validates that trainerId is the learner's assigned trainer
 *    - If allocation already exists, updates status to 'active' and updates trainer_id/allocated_by
 *    - If allocation doesn't exist, creates new allocation with status='active'
 *    - Sets allocated_at to current timestamp
 *    - Returns: Created or updated allocation record
 *    - Throws error if trainer is not assigned to learner
 * 
 * 4. removeCourseAllocation(userId, courseId, trainerId)
 *    - Removes a course allocation (soft delete)
 *    - Validates that trainerId is the learner's assigned trainer
 *    - Updates status to 'removed' (does not delete the record)
 *    - Updates updated_at timestamp
 *    - Returns: Updated allocation record
 *    - Throws error if trainer is not assigned to learner or allocation not found
 * 
 * 5. getAllocationsForLearner(userId, trainerId)
 *    - Gets all allocations for a specific learner (for trainer view)
 *    - Validates that trainerId is the learner's assigned trainer
 *    - Returns all allocations regardless of status (active and removed)
 *    - Ordered by allocated_at DESC
 *    - Returns: Array of allocation records
 *    - Used by trainers to see what courses they've allocated to a learner
 * 
 * 6. getAllocationsForTrainer(trainerId)
 *    - Gets all allocations made by a trainer for all their assigned learners
 *    - Only returns allocations with status='active'
 *    - Includes learner information (via join)
 *    - Ordered by allocated_at DESC
 *    - Returns: Array of allocation records with user information
 *    - Used by trainers to see all their course allocations
 * 
 * 7. canAccessCourse(userId, courseId)
 *    - Checks if a learner can access a specific course
 *    - For trainers and admins: Always returns true (they can access all courses)
 *    - For learners: Returns true if allocation exists with status='active'
 *    - Returns: boolean
 *    - Used by CourseService to filter courses for learners
 * 
 * 8. getAvailableCoursesForLearner(userId)
 *    - Gets list of courses that are available but not yet allocated to a learner
 *    - Returns all published courses minus courses already allocated (active or removed)
 *    - Used by trainers to see which courses they can still allocate
 *    - Returns: Array of course objects
 * 
 * VALIDATION RULES:
 * 
 * 1. Trainer Assignment:
 *    - Before allocating, verify trainer_id matches learner's trainer_id in users table
 *    - If trainer is not assigned, throw error: "Trainer not assigned to this learner"
 *    - This validation applies to allocateCourse, removeCourseAllocation, and getAllocationsForLearner
 * 
 * 2. Unique Constraint:
 *    - Only one allocation per (user_id, course_id) combination
 *    - If allocation exists, update it rather than creating duplicate
 *    - When reactivating removed allocation, update status to 'active' instead of creating new record
 * 
 * 3. Status Transitions:
 *    - New allocation: status = 'active'
 *    - Remove allocation: status = 'removed' (soft delete)
 *    - Reactivate: Update existing record with status = 'active' (via allocateCourse)
 * 
 * 4. Access Control:
 *    - Learners can only see courses with status='active' allocations
 *    - Trainers can see all courses and all allocations for their assigned learners
 *    - Admins can see all courses and all allocations
 * 
 * ERROR HANDLING:
 * 
 * - All methods should validate trainer assignment before operations
 * - Database errors should be caught and re-thrown with descriptive messages
 * - Missing allocations should return empty arrays, not throw errors
 * - Invalid status transitions should throw errors
 * 
 * RLS POLICIES (assumed):
 * 
 * - Learners can only SELECT their own allocations (user_id = auth.uid())
 * - Trainers can SELECT allocations for their assigned learners
 * - Trainers can INSERT allocations for their assigned learners
 * - Trainers can UPDATE allocations for their assigned learners
 * - Admins can SELECT all allocations
 * 
 * USAGE EXAMPLES (conceptual):
 * 
 * // Trainer allocates a course to their assigned learner
 * await courseAllocationService.allocateCourse(learnerId, 'seo-master-2026', trainerId);
 * 
 * // Learner gets their allocated courses
 * const myCourses = await courseAllocationService.getAllocatedCourses(userId);
 * 
 * // Check if learner can access a course
 * const canAccess = await courseAllocationService.canAccessCourse(userId, 'seo-master-2026');
 * 
 * // Trainer removes a course allocation
 * await courseAllocationService.removeCourseAllocation(learnerId, 'seo-master-2026', trainerId);
 * 
 * // Trainer sees all courses they've allocated
 * const myAllocations = await courseAllocationService.getAllocationsForTrainer(trainerId);
 * 
 * INTEGRATION WITH COURSE SERVICE:
 * 
 * - CourseService.getCourses() should filter courses based on allocations for learners
 * - For learners: Only return courses with active allocations
 * - For trainers/admins: Return all published courses
 * - CourseService should call canAccessCourse() to verify access before returning course data
 * 
 * RELATIONSHIP TO OTHER SERVICES:
 * 
 * - UserService: Provides learner and trainer information
 * - CourseService: Uses allocations to filter courses for learners
 * - AdminService: May need to view allocations for reporting
 * - NotificationService: May send notifications when courses are allocated
 */

import { supabaseClient } from './supabase-client.js';
import { authService } from './auth-service.js';

class CourseAllocationService {
    constructor(client) {
        this.client = client;
    }

    /**
     * Get all allocated courses for a learner
     * @param {string} userId - Learner user ID
     * @returns {Promise<Array>} Array of allocation records with status='active'
     */
    async getAllocatedCourses(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const { data, error } = await this.client
            .from('course_allocations')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('allocated_at', { ascending: false });

        if (error) {
            throw new Error('Failed to get allocated courses: ' + error.message);
        }

        return data || [];
    }

    /**
     * Allocate a course to a learner
     * @param {string} trainerId - Trainer user ID (must be learner's assigned trainer)
     * @param {string} userId - Learner user ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<object>} Created or updated allocation record
     */
    async allocateCourse(trainerId, userId, courseId) {
        if (!trainerId || !userId || !courseId) {
            throw new Error('Trainer ID, user ID, and course ID are required');
        }

        const { data: user, error: userError } = await this.client
            .from('users')
            .select('trainer_id, role')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        // Allow trainers to allocate courses to themselves (trainers can be learners too)
        // Or if the trainer is assigned to the user
        if (user.trainer_id !== trainerId && userId !== trainerId) {
            throw new Error('Trainer not assigned to this user');
        }
        
        // If trainer is allocating to themselves, ensure they have trainer_id set (for their own lab evaluation)
        if (userId === trainerId && user.role === 'trainer' && !user.trainer_id) {
            throw new Error('Trainers must have a trainer assigned before allocating courses to themselves');
        }

        // Check if allocation already exists (use maybeSingle to avoid 406 error if not found)
        const { data: existing, error: existingError } = await this.client
            .from('course_allocations')
            .select('id')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .maybeSingle();

        const now = new Date().toISOString();

        if (existing && !existingError) {
            const { data, error } = await this.client
                .from('course_allocations')
                .update({
                    status: 'active',
                    trainer_id: trainerId,
                    allocated_by: trainerId,
                    allocated_at: now,
                    updated_at: now
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                throw new Error('Failed to allocate course: ' + error.message);
            }

            // Notify learner about course allocation
            this.notifyLearnerOnCourseAllocation(userId, courseId, trainerId, data).catch(err => {
                console.warn('Failed to notify learner on course allocation:', err);
            });

            return data;
        }

        const { data, error } = await this.client
            .from('course_allocations')
            .insert([{
                user_id: userId,
                course_id: courseId,
                trainer_id: trainerId,
                allocated_by: trainerId,
                allocated_at: now,
                status: 'active'
            }])
            .select()
            .single();

        if (error) {
            throw new Error('Failed to allocate course: ' + error.message);
        }

        // Notify learner about course allocation
        this.notifyLearnerOnCourseAllocation(userId, courseId, trainerId, data).catch(err => {
            console.warn('Failed to notify learner on course allocation:', err);
        });

        return data;
    }

    /**
     * Remove a course allocation (soft delete)
     * @param {string} trainerId - Trainer user ID (must be learner's assigned trainer)
     * @param {string} userId - Learner user ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<object>} Updated allocation record
     */
    async removeAllocation(trainerId, userId, courseId) {
        if (!trainerId || !userId || !courseId) {
            throw new Error('Trainer ID, user ID, and course ID are required');
        }

        const { data: user, error: userError } = await this.client
            .from('users')
            .select('trainer_id, role')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }
        
        // Allow trainers to remove courses from themselves or their assigned learners
        if (user.trainer_id !== trainerId && userId !== trainerId) {
            throw new Error('Trainer not assigned to this user');
        }

        // Allow trainers to remove courses from themselves or their assigned learners
        if (user.trainer_id !== trainerId && userId !== trainerId) {
            throw new Error('Trainer not assigned to this user');
        }

        const { data: allocation, error: allocationError } = await this.client
            .from('course_allocations')
            .select('id')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .single();

        if (allocationError || !allocation) {
            throw new Error('Course allocation not found');
        }

        const { data, error } = await this.client
            .from('course_allocations')
            .update({
                status: 'removed',
                updated_at: new Date().toISOString()
            })
            .eq('id', allocation.id)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to remove course allocation: ' + error.message);
        }

        return data;
    }

    /**
     * Check if a user can access a course
     * @param {string} userId - User ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<boolean>} True if user can access the course
     */
    /**
     * Check if a user can access a course
     * - Trainers and admins can access all courses
     * - Learners can only access allocated courses (unless they are trainers too)
     * - Trainers can also be learners and have courses allocated to them
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @returns {Promise<boolean>} True if user can access the course
     */
    async canAccessCourse(userId, courseId) {
        if (!userId || !courseId) {
            return false;
        }

        try {
            const currentUser = await authService.getCurrentUser();
            if (!currentUser || !currentUser.id) {
                return false;
            }

            if (currentUser.role === 'trainer' || currentUser.role === 'admin') {
                return true;
            }

            if (currentUser.id !== userId) {
                return false;
            }

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
        } catch (error) {
            console.warn('Failed to check course access:', error);
            return false;
        }
    }

    /**
     * Notify learner when a course is allocated to them
     * @param {string} userId - Learner user ID
     * @param {string} courseId - Course ID
     * @param {string} trainerId - Trainer user ID
     * @param {object} allocationData - Allocation record
     * @private
     */
    async notifyLearnerOnCourseAllocation(userId, courseId, trainerId, allocationData) {
        try {
            console.log('[CourseAllocationService] Notifying learner about course allocation:', { userId, courseId, trainerId });
            const { notificationService } = await import('./notification-service.js');
            
            // Get course details
            let courseTitle = courseId; // Default to courseId if we can't load course
            try {
                const { getCourseById } = await import('../../data/courses.js');
                const course = await getCourseById(courseId);
                courseTitle = course ? course.title : courseId;
            } catch (importError) {
                console.warn('[CourseAllocationService] Could not load course data, using courseId as title:', importError);
                // Continue with courseId as the title
            }

            // Get trainer details
            const { data: trainer, error: trainerError } = await this.client
                .from('users')
                .select('id, email, full_name, name')
                .eq('id', trainerId)
                .single();

            if (trainerError || !trainer) {
                console.warn('[CourseAllocationService] Failed to get trainer details for notification:', trainerError);
            }

            const trainerName = trainer ? (trainer.full_name || trainer.name || trainer.email) : 'Your trainer';

            console.log('[CourseAllocationService] Creating notification for learner:', userId);
            const result = await notificationService.createNotification(
                userId,
                'course_allocated',
                'New Course Assigned',
                `Course "${courseTitle}" has been assigned to you by ${trainerName}.`,
                {
                    course_id: courseId,
                    course_title: courseTitle,
                    trainer_id: trainerId,
                    trainer_name: trainerName,
                    allocated_at: allocationData.allocated_at || new Date().toISOString()
                },
                '/courses' // Navigate to courses page to view allocated course
            );

            if (result) {
                console.log('[CourseAllocationService] ✅ Notification created successfully for learner:', userId);
            } else {
                console.warn('[CourseAllocationService] ❌ Failed to create notification for learner:', userId);
            }
        } catch (error) {
            console.error('[CourseAllocationService] Error notifying learner on course allocation:', error);
        }
    }
}

export const courseAllocationService = new CourseAllocationService(supabaseClient);
