/**
 * Lab Submission Service
 * 
 * Handles lab submission operations for learners.
 */

import { supabaseClient } from './supabase-client.js';
import { authService } from './auth-service.js';

class LabSubmissionService {
    constructor(client) {
        this.client = client;
    }

    /**
     * Submit a lab with DOCX file upload
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {string} labId - Lab ID
     * @param {File} docxFile - DOCX file to upload
     * @returns {Promise<object>} Created submission record
     */
    async submitLab(userId, courseId, labId, docxFile) {
        if (!userId || !courseId || !labId) {
            throw new Error('User ID, course ID, and lab ID are required');
        }

        if (!docxFile || !(docxFile instanceof File)) {
            throw new Error('DOCX file is required');
        }

        // Validate file type
        if (!docxFile.name.endsWith('.docx') && docxFile.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            throw new Error('Only DOCX files are allowed');
        }

        // Upload file to Supabase Storage
        const filePath = await this.uploadSubmissionFile(userId, courseId, labId, docxFile);

        const existing = await this.getLatestSubmission(userId, courseId, labId);
        const resubmissionCount = existing ? (existing.resubmission_count || 0) + 1 : 0;

        const now = new Date().toISOString();

        const { data, error } = await this.client
            .from('lab_submissions')
            .insert([{
                user_id: userId,
                course_id: courseId,
                lab_id: labId,
                file_url: filePath,
                file_name: docxFile.name,
                file_size: docxFile.size,
                submission_data: {
                    submission_type: 'docx',
                    uploaded_at: now,
                    resubmission_count: resubmissionCount
                },
                status: 'submitted',
                resubmission_count: resubmissionCount,
                submitted_at: now,
                created_at: now,
                updated_at: now
            }])
            .select()
            .single();

        if (error) {
            // If database insert fails, try to delete uploaded file
            this.deleteSubmissionFile(filePath).catch(err => {
                console.warn('Failed to delete uploaded file after submission error:', err);
            });
            throw new Error('Failed to submit lab: ' + error.message);
        }

        this.notifyTrainerOnSubmission(data).catch(err => {
            console.warn('Failed to notify trainer on lab submission:', err);
        });

        return data;
    }

    /**
     * Upload DOCX file to Supabase Storage
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {string} labId - Lab ID
     * @param {File} file - File to upload
     * @returns {Promise<string>} File path in storage
     * @private
     */
    async uploadSubmissionFile(userId, courseId, labId, file) {
        const timestamp = Date.now();
        // Path structure: {userId}/{courseId}/{labId}/{timestamp}_{filename}.docx
        // This matches the RLS policy that checks the first folder segment
        const fileName = `${timestamp}_${file.name}`;
        const filePath = `${userId}/${courseId}/${labId}/${fileName}`;

        console.log('[LabSubmissionService] Uploading file to path:', filePath);

        const { data, error } = await this.client.storage
            .from('lab-submissions')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('[LabSubmissionService] Upload error:', error);
            throw new Error('Failed to upload file: ' + error.message);
        }

        // Always use our constructed path (not data.path) to ensure consistency
        // Supabase upload() may return data.path with or without bucket prefix
        // Our path is: {userId}/{courseId}/{labId}/{fileName} (no bucket name)
        console.log('[LabSubmissionService] File uploaded successfully. Upload response path:', data?.path);
        console.log('[LabSubmissionService] Using stored path:', filePath);
        return filePath;
    }

    /**
     * Get download URL for a submission file
     * @param {string} filePath - File path in storage
     * @returns {Promise<string>} Download URL
     */
    async getSubmissionFileUrl(filePath) {
        if (!filePath) {
            return null;
        }

        // Ensure filePath doesn't include 'lab-submissions/' prefix
        const cleanPath = filePath.startsWith('lab-submissions/') 
            ? filePath.replace('lab-submissions/', '') 
            : filePath;

        console.log('[LabSubmissionService] Getting signed URL for:', cleanPath);

        const { data, error } = await this.client.storage
            .from('lab-submissions')
            .createSignedUrl(cleanPath, 3600); // 1 hour expiry

        if (error) {
            console.error('[LabSubmissionService] Error getting signed URL:', error);
            throw new Error('Failed to get file URL: ' + error.message);
        }

        return data.signedUrl;
    }

    /**
     * Delete a submission file from storage
     * @param {string} filePath - File path in storage
     * @returns {Promise<void>}
     * @private
     */
    async deleteSubmissionFile(filePath) {
        if (!filePath) {
            return;
        }

        // Ensure filePath doesn't include 'lab-submissions/' prefix
        const cleanPath = filePath.startsWith('lab-submissions/') 
            ? filePath.replace('lab-submissions/', '') 
            : filePath;

        console.log('[LabSubmissionService] Deleting file:', cleanPath);

        const { error } = await this.client.storage
            .from('lab-submissions')
            .remove([cleanPath]);

        if (error) {
            console.warn('Failed to delete file:', error);
        }
    }

    /**
     * Get lab submissions for a user
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {string} labId - Lab ID
     * @returns {Promise<Array>} Array of submission records
     */
    async getLabSubmissions(userId, courseId, labId) {
        if (!userId || !courseId || !labId) {
            throw new Error('User ID, course ID, and lab ID are required');
        }

        const { data, error } = await this.client
            .from('lab_submissions')
            .select('*')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .eq('lab_id', labId)
            .order('submitted_at', { ascending: false });

        if (error) {
            throw new Error('Failed to get lab submissions: ' + error.message);
        }

        return data || [];
    }

    /**
     * Get latest submission for a lab
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {string} labId - Lab ID
     * @returns {Promise<object|null>} Latest submission or null
     */
    async getLatestSubmission(userId, courseId, labId) {
        const submissions = await this.getLabSubmissions(userId, courseId, labId);
        return submissions.length > 0 ? submissions[0] : null;
    }

    /**
     * Get a submission by ID
     * @param {string} submissionId - Submission ID
     * @returns {Promise<object|null>} Submission record or null
     */
    async getSubmissionById(submissionId) {
        if (!submissionId) {
            throw new Error('Submission ID is required');
        }

        const { data, error } = await this.client
            .from('lab_submissions')
            .select('*')
            .eq('id', submissionId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error('Failed to get submission: ' + error.message);
        }

        return data;
    }

    /**
     * Get all lab submissions for a learner (across all courses and labs)
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of all submission records
     */
    async getAllSubmissionsForLearner(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const { data, error } = await this.client
            .from('lab_submissions')
            .select('*')
            .eq('user_id', userId)
            .order('submitted_at', { ascending: false });

        if (error) {
            throw new Error('Failed to get lab submissions: ' + error.message);
        }

        return data || [];
    }

    /**
     * Get assigned learner IDs for a trainer
     * Only returns Active learners (filters out Inactive, Graduate, Archive)
     * @param {string} trainerId - Trainer ID
     * @returns {Promise<Array>} Array of assigned Active learner IDs
     */
    async getAssignedLearnerIds(trainerId) {
        if (!trainerId) {
            return [];
        }

        const { data, error } = await this.client
            .from('users')
            .select('id')
            .eq('trainer_id', trainerId)
            .eq('role', 'learner')
            .eq('learner_type', 'active'); // Only Active learners

        if (error) {
            console.warn('Failed to get assigned learners:', error);
            return [];
        }

        return (data || []).map(user => user.id);
    }

    /**
     * Get submissions for review (only from assigned learners)
     * @param {string} trainerId - Trainer ID
     * @returns {Promise<Array>} Array of submission records with user info
     */
    async getSubmissionsForReview(trainerId) {
        if (!trainerId) {
            throw new Error('Trainer ID is required');
        }

        const assignedLearnerIds = await this.getAssignedLearnerIds(trainerId);

        if (assignedLearnerIds.length === 0) {
            return [];
        }

        const { data, error } = await this.client
            .from('lab_submissions')
            .select(`
                *,
                user:users!lab_submissions_user_id_fkey(*)
            `)
            .in('user_id', assignedLearnerIds)
            .eq('status', 'submitted')  // Only show new submissions that haven't been reviewed yet
            .order('submitted_at', { ascending: false });

        if (error) {
            throw new Error('Failed to get submissions for review: ' + error.message);
        }

        return data || [];
    }

    /**
     * Provide feedback on a submission
     * @param {string} submissionId - Submission ID
     * @param {string} feedback - Trainer feedback text
     * @param {string} status - Status ('reviewed', 'approved', 'needs_revision')
     * @param {number} score - Score (0-10, required)
     * @returns {Promise<object>} Updated submission record
     */
    async provideFeedback(submissionId, feedback, status, score) {
        if (!submissionId) {
            throw new Error('Submission ID is required');
        }

        // Validate score (mandatory, 0-10)
        if (score === null || score === undefined || score === '') {
            throw new Error('Score is required. Please provide a score between 0 and 10.');
        }

        const scoreNum = parseFloat(score);
        if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
            throw new Error('Score must be a number between 0 and 10.');
        }

        const allowedStatuses = ['approved', 'needs_revision'];
        if (!allowedStatuses.includes(status)) {
            throw new Error(`Invalid status. Allowed values: ${allowedStatuses.join(', ')}`);
        }

        const currentUser = await authService.getCurrentUser();
        if (!currentUser || !currentUser.id) {
            throw new Error('Authentication required');
        }

        const trainerId = currentUser.id;

        const { data: submission, error: submissionError } = await this.client
            .from('lab_submissions')
            .select('user_id')
            .eq('id', submissionId)
            .single();

        if (submissionError || !submission) {
            throw new Error('Submission not found');
        }

        const { data: learner, error: learnerError } = await this.client
            .from('users')
            .select('trainer_id')
            .eq('id', submission.user_id)
            .single();

        if (learnerError || !learner) {
            throw new Error('Learner not found');
        }

        if (learner.trainer_id !== trainerId) {
            throw new Error('You can only review submissions from your assigned learners');
        }

        const now = new Date().toISOString();

        // Convert score from 0-10 scale to 0-100 for database storage (if needed)
        // Or store as 0-10 directly if database supports it
        // For now, we'll store as 0-10 and convert to percentage when needed
        const scoreToStore = scoreNum; // Store as 0-10

        const { data, error } = await this.client
            .from('lab_submissions')
            .update({
                reviewed_by: trainerId,
                reviewed_at: now,
                feedback: feedback || null,
                status: status,
                score: scoreToStore,
                updated_at: now
            })
            .eq('id', submissionId)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to provide feedback: ' + error.message);
        }

        this.notifyLearnerOnReview(data, feedback, status).catch(err => {
            console.warn('Failed to notify learner on lab review:', err);
        });

        return data;
    }

    /**
     * Get past evaluations by a trainer (submissions that have been reviewed)
     * @param {string} trainerId - Trainer ID
     * @param {object} filters - Optional filters { dateFrom, dateTo, searchQuery }
     * @returns {Promise<Array>} Array of reviewed submission records with user info
     */
    async getPastEvaluations(trainerId, filters = {}) {
        if (!trainerId) {
            throw new Error('Trainer ID is required');
        }

        let query = this.client
            .from('lab_submissions')
            .select(`
                *,
                user:users!lab_submissions_user_id_fkey(*)
            `)
            .eq('reviewed_by', trainerId)
            .in('status', ['reviewed', 'approved', 'needs_revision']);

        // Apply date range filter
        if (filters.dateFrom) {
            query = query.gte('reviewed_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            // Add one day to include the entire end date
            const endDate = new Date(filters.dateTo);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('reviewed_at', endDate.toISOString());
        }

        query = query.order('reviewed_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            throw new Error('Failed to get past evaluations: ' + error.message);
        }

        let results = data || [];

        // Apply search filter on user name/email if provided
        if (filters.searchQuery) {
            const searchTerm = filters.searchQuery.toLowerCase().trim();
            results = results.filter(submission => {
                const user = submission.user || {};
                const userName = (user.full_name || user.name || '').toLowerCase();
                const userEmail = (user.email || '').toLowerCase();
                return userName.includes(searchTerm) || userEmail.includes(searchTerm);
            });
        }

        return results;
    }

    /**
     * Notify trainer when a learner submits a lab
     * @param {object} submission - Submission record
     * @private
     */
    async notifyTrainerOnSubmission(submission) {
        try {
            console.log('[LabSubmissionService] Notifying trainer about lab submission:', submission.id);
            const { notificationService } = await import('./notification-service.js');
            
            const { data: learner, error } = await this.client
                .from('users')
                .select('trainer_id, full_name, email')
                .eq('id', submission.user_id)
                .single();

            if (error || !learner || !learner.trainer_id) {
                console.warn('[LabSubmissionService] Cannot notify trainer - learner not found or no trainer assigned:', { error, learner });
                return;
            }

            const learnerName = learner.full_name || learner.email || 'A learner';
            
            console.log('[LabSubmissionService] Creating notification for trainer:', learner.trainer_id);
            const result = await notificationService.createNotification(
                learner.trainer_id,
                'lab_submitted',
                'New Lab Submission',
                `${learnerName} submitted Lab ${submission.lab_id} for ${submission.course_id}.`,
                {
                    course_id: submission.course_id,
                    lab_id: submission.lab_id,
                    submission_id: submission.id,
                    learner_id: submission.user_id,
                    learner_name: learnerName
                },
                '/trainer/lab-review' // Navigate to lab review page
            );

            if (result) {
                console.log('[LabSubmissionService] ✅ Notification created successfully for trainer:', learner.trainer_id);
            } else {
                console.warn('[LabSubmissionService] ❌ Failed to create notification for trainer:', learner.trainer_id);
            }
        } catch (error) {
            console.error('[LabSubmissionService] Error notifying trainer on lab submission:', error);
        }
    }

    /**
     * Notify learner when their lab is reviewed
     * @param {object} submission - Updated submission record
     * @param {string} feedback - Trainer feedback
     * @param {string} status - Review status
     * @private
     */
    async notifyLearnerOnReview(submission, feedback, status) {
        try {
            console.log('[LabSubmissionService] Notifying learner about lab review:', { submissionId: submission.id, userId: submission.user_id, status });
            const { notificationService } = await import('./notification-service.js');
            
            const statusMessages = {
                'reviewed': 'Your lab submission has been reviewed.',
                'approved': 'Your lab submission has been approved!',
                'needs_revision': 'Your lab submission needs revision. Please review the feedback and resubmit.'
            };

            const message = statusMessages[status] || 'Your lab submission has been reviewed.';
            const feedbackPreview = feedback && feedback.length > 100 
                ? feedback.substring(0, 100) + '...' 
                : feedback;

            console.log('[LabSubmissionService] Creating notification for learner:', submission.user_id);
            const result = await notificationService.createNotification(
                submission.user_id,
                'lab_reviewed',
                'Lab Submission Reviewed',
                `${message}${feedbackPreview ? '\n\nFeedback: ' + feedbackPreview : ''}`,
                {
                    course_id: submission.course_id,
                    lab_id: submission.lab_id,
                    submission_id: submission.id,
                    status: status,
                    feedback: feedback || null
                },
                '/learner/lab-submissions' // Navigate to lab submissions page
            );

            if (result) {
                console.log('[LabSubmissionService] ✅ Notification created successfully for learner:', submission.user_id);
            } else {
                console.warn('[LabSubmissionService] ❌ Failed to create notification for learner:', submission.user_id);
            }
        } catch (error) {
            console.error('[LabSubmissionService] Error notifying learner on lab review:', error);
        }
    }
}

export const labSubmissionService = new LabSubmissionService(supabaseClient);

