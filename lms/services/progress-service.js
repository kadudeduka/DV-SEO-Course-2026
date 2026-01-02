/**
 * Progress Service
 * 
 * Handles progress tracking and persistence for course content.
 * 
 * ALIGNMENT WITH DATABASE SCHEMA (public.user_progress):
 * 
 * 1. PROGRESS KEY STRUCTURE:
 *    - Primary Key (Unique Constraint): (user_id, course_id, content_id)
 *    - Each progress record uniquely identified by these three fields
 *    - One record per user per course per content item
 * 
 * 2. COMPLETION TRACKING:
 *    - completed: BOOLEAN (default: FALSE)
 *      - true = content item is completed
 *      - false = content item is not completed
 * 
 * 3. COMPLETION TIMESTAMP:
 *    - completed_at: TIMESTAMPTZ (nullable)
 *      - Set to current timestamp when completed = true
 *      - Set to null when completed = false
 *      - Format: ISO 8601 string (e.g., "2025-01-29T10:30:00.000Z")
 * 
 * 4. LOCALSTORAGE FALLBACK:
 *    - Key Format: "progress_<userId>_<courseId>"
 *      - Example: "progress_123e4567-e89b-12d3-a456-426614174000_seo-master-2026"
 *    - Value Structure: JSON object mapping contentId to progress data
 *      {
 *        "day1-ch1": {
 *          "completed": true,
 *          "completed_at": "2025-01-29T10:30:00.000Z"
 *        },
 *        "day1-ch2": {
 *          "completed": false,
 *          "completed_at": null
 *        }
 *      }
 * 
 * 5. DATA FLOW:
 *    - Primary: Save to Supabase user_progress table (upsert on conflict)
 *    - Fallback: Save to localStorage using key format above
 *    - Retrieval: Try Supabase first, fallback to localStorage
 * 
 * 6. CONTENT TYPE:
 *    - content_type: TEXT (required)
 *    - Values: 'chapter', 'lab', 'tool'
 *    - Determines type of content being tracked
 * 
 * 7. ADDITIONAL DATA:
 *    - progress_data: JSONB (default: '{}')
 *    - Can store additional progress metadata if needed
 * 
 * IMPLEMENTATION NOTES:
 * - Use upsert with onConflict: 'user_id,course_id,content_id' for Supabase
 * - Always save to localStorage as fallback (even if Supabase succeeds)
 * - Transform Supabase array response to object keyed by content_id
 * - Handle errors gracefully with localStorage fallback
 */

import { supabaseClient } from './supabase-client.js';
import { courseService } from './course-service.js';

class ProgressService {
    constructor(client, courseService) {
        this.client = client;
        this.courseService = courseService;
        this.cache = new Map();
    }

    /**
     * Transform Supabase progress array to object keyed by content_id
     * @param {Array} progressArray - Array of progress records from Supabase
     * @returns {object} Progress object keyed by content_id
     */
    transformProgress(progressArray) {
        if (!Array.isArray(progressArray)) {
            return {};
        }

        const progressObject = {};
        progressArray.forEach(record => {
            progressObject[record.content_id] = {
                completed: record.completed || false,
                completed_at: record.completed_at || null,
                content_type: record.content_type || 'chapter'
            };
        });

        return progressObject;
    }

    /**
     * Get progress for user in a course
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @returns {Promise<object>} Progress object keyed by content_id
     */
    async getProgress(userId, courseId) {
        if (!userId || !courseId) {
            return {};
        }

        const cacheKey = `progress_${userId}_${courseId}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let progress = {};

        if (this.client) {
            try {
                // Try querying with course_id first (new schema)
                let query = this.client
                    .from('user_progress')
                    .select('*')
                    .eq('user_id', userId);
                
                // Only add course_id filter if the column exists
                // If it doesn't exist, we'll get an error and fall back to localStorage
                const { data, error } = await query.eq('course_id', courseId);

                if (!error && data) {
                    progress = this.transformProgress(data);
                    this.cache.set(cacheKey, progress);
                    this.syncSupabaseToLocalStorage(userId, courseId, progress);
                    return progress;
                } else if (error && error.message && error.message.includes('course_id')) {
                    // Column doesn't exist yet, use localStorage only
                    console.warn('course_id column not found in user_progress table. Please run migration.');
                }
            } catch (error) {
                // Check if it's a column error
                if (error.message && (error.message.includes('course_id') || error.message.includes('column'))) {
                    console.warn('user_progress table missing course_id column. Using localStorage only. Please run migration.');
                } else {
                    console.warn('Supabase error, using localStorage', error);
                }
            }
        }

        const localStorageProgress = this.getProgressFromStorage(userId, courseId);
        progress = localStorageProgress;
        this.cache.set(cacheKey, progress);
        
        if (this.client && Object.keys(localStorageProgress).length > 0) {
            await this.syncLocalStorageToSupabase(userId, courseId, localStorageProgress);
        }
        
        return progress;
    }

    /**
     * Save progress for a content item
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {string} contentId - Content ID (chapter/lab ID)
     * @param {boolean} completed - Completion status
     * @param {string} contentType - Content type ('chapter', 'lab', 'tool'), defaults to 'chapter'
     * @returns {Promise<object>} Saved progress record
     */
    async saveProgress(userId, courseId, contentId, completed, contentType = 'chapter') {
        if (!userId || !courseId || !contentId) {
            throw new Error('User ID, course ID, and content ID are required');
        }

        const now = new Date().toISOString();
        const progressRecord = {
            user_id: userId,
            course_id: courseId,
            content_id: contentId,
            content_type: contentType,
            completed: completed === true,
            completed_at: completed ? now : null,
            updated_at: now
        };

        if (this.client) {
            try {
                const { error } = await this.client
                    .from('user_progress')
                    .upsert(progressRecord, {
                        onConflict: 'user_id,course_id,content_id'
                    });

                if (error) {
                    console.warn('Supabase error, using localStorage', error);
                }
            } catch (error) {
                console.warn('Supabase error, using localStorage', error);
            }
        }

        this.saveProgressToStorage(userId, courseId, contentId, completed);

        const cacheKey = `progress_${userId}_${courseId}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            cached[contentId] = {
                completed: completed === true,
                completed_at: completed ? now : null,
                content_type: contentType
            };
            this.cache.set(cacheKey, cached);
        }

        return progressRecord;
    }

    /**
     * Get progress percentage for a course
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Completion percentage (0-100)
     */
    async getProgressPercentage(userId, courseId) {
        if (!userId || !courseId) {
            return 0;
        }

        const progress = await this.getProgress(userId, courseId);
        const course = await this.courseService.getCourseById(courseId);

        if (!course || !course.courseData || !course.courseData.days) {
            return 0;
        }

        let totalItems = 0;
        let completedItems = 0;

        for (const day of course.courseData.days) {
            if (day.chapters && Array.isArray(day.chapters)) {
                totalItems += day.chapters.length;
                day.chapters.forEach(chapter => {
                    const progressItem = progress[chapter.id];
                    if (progressItem && progressItem.completed === true) {
                        completedItems++;
                    }
                });
            }
        }

        if (totalItems === 0) {
            return 0;
        }

        return Math.round((completedItems / totalItems) * 100);
    }

    /**
     * Get progress from localStorage
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @returns {object} Progress object keyed by content_id
     */
    getProgressFromStorage(userId, courseId) {
        const key = `progress_${userId}_${courseId}`;
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to parse localStorage progress', error);
            return {};
        }
    }

    /**
     * Save progress to localStorage
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {string} contentId - Content ID
     * @param {boolean} completed - Completion status
     */
    saveProgressToStorage(userId, courseId, contentId, completed) {
        const key = `progress_${userId}_${courseId}`;
        const progress = this.getProgressFromStorage(userId, courseId);
        
        progress[contentId] = {
            completed: completed === true,
            completed_at: completed ? new Date().toISOString() : null
        };
        
        try {
            localStorage.setItem(key, JSON.stringify(progress));
        } catch (error) {
            console.warn('Failed to save progress to localStorage', error);
        }
    }

    /**
     * Sync Supabase progress to localStorage
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {object} progress - Progress object from Supabase
     */
    syncSupabaseToLocalStorage(userId, courseId, progress) {
        if (!progress || Object.keys(progress).length === 0) {
            return;
        }

        try {
            const key = `progress_${userId}_${courseId}`;
            localStorage.setItem(key, JSON.stringify(progress));
        } catch (error) {
            console.warn('Failed to sync Supabase to localStorage:', error);
        }
    }

    /**
     * Sync localStorage progress to Supabase
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {object} progress - Progress object from localStorage
     */
    async syncLocalStorageToSupabase(userId, courseId, progress) {
        if (!this.client || !progress || Object.keys(progress).length === 0) {
            return;
        }

        try {
            const recordsToSync = Object.entries(progress).map(([contentId, progressData]) => ({
                user_id: userId,
                course_id: courseId,
                content_id: contentId,
                content_type: progressData.content_type || 'chapter',
                completed: progressData.completed === true,
                completed_at: progressData.completed_at || null,
                updated_at: new Date().toISOString()
            }));

            if (recordsToSync.length > 0) {
                const { error } = await this.client
                    .from('user_progress')
                    .upsert(recordsToSync, {
                        onConflict: 'user_id,course_id,content_id'
                    });

                if (error) {
                    console.warn('Failed to sync localStorage to Supabase:', error);
                }
            }
        } catch (error) {
            console.warn('Error syncing localStorage to Supabase:', error);
        }
    }

    /**
     * Clear cache
     * @param {string} userId - Optional user ID
     * @param {string} courseId - Optional course ID
     */
    clearCache(userId = null, courseId = null) {
        if (userId && courseId) {
            const cacheKey = `progress_${userId}_${courseId}`;
            this.cache.delete(cacheKey);
        } else {
            this.cache.clear();
        }
    }
}

export const progressService = new ProgressService(supabaseClient, courseService);


