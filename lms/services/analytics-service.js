/**
 * Analytics Service
 * 
 * Calculates metrics and performs analytics for reports.
 * Provides methods for progress calculations, lab metrics, engagement scores, etc.
 */

import { supabaseClient } from './supabase-client.js';
import { courseService } from './course-service.js';

class AnalyticsService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Calculate progress percentage
     * @param {number} completed - Number of completed items
     * @param {number} total - Total number of items
     * @returns {number} Progress percentage (0-100)
     */
    calculateProgressPercentage(completed, total) {
        if (!total || total === 0) return 0;
        return Math.round((completed / total) * 100);
    }

    /**
     * Calculate course progress for a user
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Progress percentage (0-100)
     * Note: Progress is calculated as 75% labs + 25% chapters
     */
    async calculateCourseProgress(userId, courseId) {
        if (!userId || !courseId) {
            return 0;
        }

        try {
            // Get course structure to determine total chapters and labs
            const course = await courseService.getCourseById(courseId);
            if (!course || !course.courseData) {
                return 0;
            }

            // Count total chapters and labs from course structure
            // Also collect chapter IDs and lab IDs for matching
            let totalChapters = 0;
            let totalLabs = 0;
            const chapterIds = new Set();
            const labIds = new Set();
            
            if (course.courseData.days) {
                course.courseData.days.forEach(day => {
                    if (day.chapters) {
                        day.chapters.forEach(chapter => {
                            if (chapter.id) {
                                chapterIds.add(chapter.id);
                                totalChapters++;
                            }
                        });
                    }
                    if (day.labs) {
                        day.labs.forEach(lab => {
                            if (lab.id) {
                                labIds.add(lab.id);
                                totalLabs++;
                            }
                        });
                    }
                });
            }

            // Get all completed progress records (we'll use this for both chapters and debugging)
            const { data: allProgressData, error: progressError } = await supabaseClient
                .from('user_progress')
                .select('content_id, content_type')
                .eq('user_id', userId)
                .eq('course_id', courseId)
                .eq('completed', true);

            // Get completed chapters (only count items that match chapter IDs and are marked as chapters)
            let completedChapters = 0;
            if (progressError) {
                console.warn('[AnalyticsService] Error getting progress:', progressError);
            } else {
                // Filter to only count chapters:
                // 1. content_id must be in chapterIds set (from course structure) OR
                // 2. content_type is 'chapter' (if chapterIds is empty, fall back to content_type)
                if (totalChapters > 0) {
                    // Use chapterIds from course structure
                    completedChapters = (allProgressData || []).filter(p => {
                        const isChapterId = chapterIds.has(p.content_id);
                        const isChapterType = !p.content_type || p.content_type === 'chapter' || p.content_type === null;
                        return isChapterId && isChapterType;
                    }).length;
                } else {
                    // Fallback: if no chapters in structure, count by content_type
                    completedChapters = (allProgressData || []).filter(p => {
                        return !p.content_type || p.content_type === 'chapter' || p.content_type === null;
                    }).length;
                    // If we found chapters in progress but none in structure, update totalChapters
                    if (completedChapters > 0 && totalChapters === 0) {
                        console.warn(`[AnalyticsService] Found ${completedChapters} completed chapters in progress but 0 chapters in course structure. Using completed chapters count as total.`);
                        totalChapters = completedChapters;
                    }
                }
                
                console.log(`[AnalyticsService] Chapter matching - total progress records: ${(allProgressData || []).length}, completedChapters: ${completedChapters}, totalChapters in structure: ${totalChapters}`);
            }

            // Get submitted labs (only count labs that match lab IDs from course structure)
            let submittedLabs = 0;
            const { data: labSubmissions, error: labError } = await supabaseClient
                .from('lab_submissions')
                .select('lab_id')
                .eq('user_id', userId)
                .eq('course_id', courseId);

            if (labError) {
                console.warn('[AnalyticsService] Error getting lab submissions:', labError);
            } else {
                // Count unique lab submissions that match lab IDs from course structure
                const uniqueLabIds = new Set((labSubmissions || []).map(l => l.lab_id));
                if (labIds.size > 0) {
                    // Only count labs that are in the course structure
                    submittedLabs = Array.from(uniqueLabIds).filter(labId => labIds.has(labId)).length;
                } else {
                    // If no labs in structure, count all submissions (fallback)
                    submittedLabs = uniqueLabIds.size;
                }
            }

            // If totalLabs is 0 but we have submissions, we need to estimate total labs
            // This handles cases where course structure might not have labs properly defined
            if (totalLabs === 0 && submittedLabs > 0) {
                // If we have submissions but no labs in structure, we can't know the true total
                // For progress calculation, we'll assume the submitted labs represent some progress
                // We'll use a conservative estimate: assume there are at least submittedLabs labs
                // This means progress will be at least (submittedLabs / submittedLabs) = 100% for labs
                // But this is a fallback - ideally course structure should have labs
                console.warn(`[AnalyticsService] Course ${courseId} has ${submittedLabs} lab submissions but 0 labs in structure. Using submitted labs count as minimum total.`);
                totalLabs = submittedLabs;
            }
            
            // Debug logging with detailed information (reuse allProgressData from above)
            const progressContentIds = (allProgressData || []).map(p => p.content_id);
            const matchingChapterIds = progressContentIds.filter(id => chapterIds.has(id));
            const nonMatchingContentIds = progressContentIds.filter(id => !chapterIds.has(id) && !labIds.has(id));
            
            console.log(`[AnalyticsService] Progress calculation for user ${userId}, course ${courseId}:`, {
                totalChapters,
                completedChapters,
                totalLabs,
                submittedLabs,
                chapterIds: Array.from(chapterIds),
                labIds: Array.from(labIds),
                allProgressContentIds: progressContentIds,
                matchingChapterIds: matchingChapterIds,
                nonMatchingContentIds: nonMatchingContentIds,
                chapterProgress: totalChapters > 0 ? this.calculateProgressPercentage(completedChapters, totalChapters) : 0,
                labProgress: totalLabs > 0 ? this.calculateProgressPercentage(submittedLabs, totalLabs) : 0
            });

            // Calculate chapter progress (25% weight)
            const chapterProgress = totalChapters > 0 
                ? this.calculateProgressPercentage(completedChapters, totalChapters)
                : 0;

            // Calculate lab progress (75% weight)
            const labProgress = totalLabs > 0
                ? this.calculateProgressPercentage(submittedLabs, totalLabs)
                : 0;

            console.log(`[AnalyticsService] Calculated progress - chapterProgress: ${chapterProgress}%, labProgress: ${labProgress}%`);

            // Always use weighted combination when both exist
            // If one component doesn't exist in structure but the other does, still use weighted calculation
            // This ensures consistent progress calculation across all interfaces
            
            // If both are 0, return 0
            if (totalChapters === 0 && totalLabs === 0) {
                console.log(`[AnalyticsService] No chapters or labs found in course structure, returning 0%`);
                return 0;
            }

            // If only one component exists in structure, use 100% weight for that component
            if (totalChapters === 0 && totalLabs > 0) {
                console.log(`[AnalyticsService] Only labs exist in structure, returning labProgress: ${labProgress}%`);
                return parseFloat(labProgress.toFixed(1));
            }
            if (totalLabs === 0 && totalChapters > 0) {
                console.log(`[AnalyticsService] Only chapters exist in structure, returning chapterProgress: ${chapterProgress}%`);
                return parseFloat(chapterProgress.toFixed(1));
            }

            // Both components exist: Combined progress: 25% chapters + 75% labs
            // This is the standard calculation that should be used when both chapters and labs exist
            const combinedProgress = (chapterProgress * 0.25) + (labProgress * 0.75);
            console.log(`[AnalyticsService] Combined progress calculation: (${chapterProgress}% * 0.25) + (${labProgress}% * 0.75) = ${combinedProgress}%`);
            // Return with one decimal place for consistency across all progress calculations
            return parseFloat(combinedProgress.toFixed(1));
        } catch (error) {
            console.error('[AnalyticsService] Error calculating course progress:', error);
            return 0;
        }
    }

    /**
     * Calculate overall progress across all courses for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Overall progress percentage (0-100)
     */
    async calculateOverallProgress(userId) {
        if (!userId) {
            return 0;
        }

        try {
            // Get all course allocations
            const { data: allocations, error: allocError } = await supabaseClient
                .from('course_allocations')
                .select('course_id')
                .eq('user_id', userId)
                .eq('status', 'active');

            if (allocError || !allocations || allocations.length === 0) {
                return 0;
            }

            const courseIds = allocations.map(a => a.course_id);

            // Calculate progress for each course and average
            const progressPromises = courseIds.map(courseId => 
                this.calculateCourseProgress(userId, courseId)
            );

            const progressValues = await Promise.all(progressPromises);
            const totalProgress = progressValues.reduce((sum, p) => sum + p, 0);
            
            // Return with one decimal place for consistency with other progress calculations
            return progressValues.length > 0 
                ? parseFloat((totalProgress / progressValues.length).toFixed(1))
                : 0;
        } catch (error) {
            console.error('[AnalyticsService] Error calculating overall progress:', error);
            return 0;
        }
    }

    /**
     * Calculate average lab score for a user
     * @param {string} userId - User ID
     * @param {string} courseId - Optional course ID (if provided, only scores for that course)
     * @returns {Promise<number>} Average lab score (0-100 percentage) or null if no scores
     * Note: Scores are stored as 0-10 in database, converted to 0-100 percentage for reports
     */
    async calculateAverageLabScore(userId, courseId = null) {
        if (!userId) {
            return null;
        }

        try {
            let query = supabaseClient
                .from('lab_submissions')
                .select('score')
                .eq('user_id', userId)
                .not('score', 'is', null);

            if (courseId) {
                query = query.eq('course_id', courseId);
            }

            const { data, error } = await query;

            if (error) {
                console.warn('[AnalyticsService] Error getting lab scores:', error);
                return null;
            }

            if (!data || data.length === 0) {
                return null;
            }

            // Scores are stored as 0-10, convert to 0-100 percentage for reports
            const scores = data.map(item => parseFloat(item.score)).filter(s => !isNaN(s));
            if (scores.length === 0) {
                return null;
            }

            const sum = scores.reduce((acc, score) => acc + score, 0);
            const average = sum / scores.length;
            // Convert from 0-10 scale to 0-100 percentage
            const percentage = average * 10;
            return Math.round(percentage * 100) / 100; // Round to 2 decimal places
        } catch (error) {
            console.error('[AnalyticsService] Error calculating average lab score:', error);
            return null;
        }
    }

    /**
     * Calculate lab submission rate
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Submission rate percentage (0-100)
     */
    async calculateLabSubmissionRate(userId, courseId) {
        if (!userId || !courseId) {
            return 0;
        }

        try {
            // Get course structure to determine total labs
            const course = await courseService.getCourseById(courseId);
            if (!course || !course.courseData) {
                return 0;
            }

            // Count total labs from course structure
            let totalLabs = 0;
            if (course.courseData.days) {
                course.courseData.days.forEach(day => {
                    if (day.labs) {
                        totalLabs += day.labs.length;
                    }
                });
            }

            if (totalLabs === 0) {
                return 0;
            }

            // Get submitted labs
            const { data: submissions, error } = await supabaseClient
                .from('lab_submissions')
                .select('id')
                .eq('user_id', userId)
                .eq('course_id', courseId);

            if (error) {
                console.warn('[AnalyticsService] Error getting lab submissions:', error);
                return 0;
            }

            const submittedLabs = submissions?.length || 0;
            return this.calculateProgressPercentage(submittedLabs, totalLabs);
        } catch (error) {
            console.error('[AnalyticsService] Error calculating lab submission rate:', error);
            return 0;
        }
    }

    /**
     * Calculate lab approval rate
     * @param {string} userId - User ID
     * @param {string} courseId - Optional course ID
     * @returns {Promise<number>} Approval rate percentage (0-100)
     */
    async calculateLabApprovalRate(userId, courseId = null) {
        if (!userId) {
            return 0;
        }

        try {
            let query = supabaseClient
                .from('lab_submissions')
                .select('status')
                .eq('user_id', userId);

            if (courseId) {
                query = query.eq('course_id', courseId);
            }

            const { data, error } = await query;

            if (error || !data || data.length === 0) {
                return 0;
            }

            const approved = data.filter(s => s.status === 'approved').length;
            return this.calculateProgressPercentage(approved, data.length);
        } catch (error) {
            console.error('[AnalyticsService] Error calculating lab approval rate:', error);
            return 0;
        }
    }

    /**
     * Calculate engagement score based on activity frequency
     * @param {string} userId - User ID
     * @param {Object} dateRange - { from: Date, to: Date }
     * @returns {Promise<number>} Engagement score (0-100)
     */
    async calculateEngagementScore(userId, dateRange = null) {
        if (!userId) {
            return 0;
        }

        try {
            const now = new Date();
            const fromDate = dateRange?.from || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
            const toDate = dateRange?.to || now;

            // Get activity count (progress updates, lab submissions)
            const [progressCount, labCount] = await Promise.all([
                supabaseClient
                    .from('user_progress')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gte('completed_at', fromDate.toISOString())
                    .lte('completed_at', toDate.toISOString()),
                supabaseClient
                    .from('lab_submissions')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gte('submitted_at', fromDate.toISOString())
                    .lte('submitted_at', toDate.toISOString())
            ]);

            const totalActivities = (progressCount.count || 0) + (labCount.count || 0);
            
            // Normalize to 0-100 scale (assuming 30+ activities in 30 days = 100)
            const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
            const expectedActivities = daysDiff; // 1 activity per day = good engagement
            const score = Math.min(100, (totalActivities / expectedActivities) * 100);

            return Math.round(score);
        } catch (error) {
            console.error('[AnalyticsService] Error calculating engagement score:', error);
            return 0;
        }
    }

    /**
     * Calculate consistency score (regular activity pattern)
     * @param {string} userId - User ID
     * @param {Object} dateRange - { from: Date, to: Date }
     * @returns {Promise<number>} Consistency score (0-100)
     */
    async calculateConsistencyScore(userId, dateRange = null) {
        if (!userId) {
            return 0;
        }

        try {
            const now = new Date();
            const fromDate = dateRange?.from || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const toDate = dateRange?.to || now;

            // Get all activity dates from multiple sources
            const [progressCompleted, progressAccessed, labData] = await Promise.all([
                // Chapter completions
                supabaseClient
                    .from('user_progress')
                    .select('completed_at')
                    .eq('user_id', userId)
                    .gte('completed_at', fromDate.toISOString())
                    .lte('completed_at', toDate.toISOString())
                    .not('completed_at', 'is', null),
                // Chapter access (last_accessed_at)
                supabaseClient
                    .from('user_progress')
                    .select('last_accessed_at')
                    .eq('user_id', userId)
                    .gte('last_accessed_at', fromDate.toISOString())
                    .lte('last_accessed_at', toDate.toISOString())
                    .not('last_accessed_at', 'is', null),
                // Lab submissions
                supabaseClient
                    .from('lab_submissions')
                    .select('submitted_at')
                    .eq('user_id', userId)
                    .gte('submitted_at', fromDate.toISOString())
                    .lte('submitted_at', toDate.toISOString())
            ]);

            // Collect all activity dates
            const allDates = [
                ...(progressCompleted.data || []).map(p => new Date(p.completed_at).toDateString()),
                ...(progressAccessed.data || []).map(p => new Date(p.last_accessed_at).toDateString()),
                ...(labData.data || []).map(l => new Date(l.submitted_at).toDateString())
            ];

            const uniqueDays = new Set(allDates).size;
            const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));

            // Consistency = unique activity days / total days
            // For very short periods (< 7 days), use a more lenient calculation
            if (daysDiff < 7) {
                // For short periods, consistency is based on having activity on most days
                // If user has activity on all available days, give 100%
                return uniqueDays >= daysDiff ? 100 : Math.round((uniqueDays / daysDiff) * 100);
            }

            // For longer periods, calculate as percentage of days with activity
            return daysDiff > 0 ? Math.round((uniqueDays / daysDiff) * 100) : 0;
        } catch (error) {
            console.error('[AnalyticsService] Error calculating consistency score:', error);
            return 0;
        }
    }

    /**
     * Calculate course completion rate (percentage of learners who completed)
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Completion rate percentage (0-100)
     */
    async calculateCourseCompletionRate(courseId) {
        if (!courseId) {
            return 0;
        }

        try {
            // Get total learners assigned
            const { data: allocations, error: allocError } = await supabaseClient
                .from('course_allocations')
                .select('user_id')
                .eq('course_id', courseId)
                .eq('status', 'active');

            if (allocError || !allocations || allocations.length === 0) {
                return 0;
            }

            const userIds = allocations.map(a => a.user_id);

            // Get course structure
            const course = await courseService.getCourseById(courseId);
            if (!course || !course.courseData) {
                return 0;
            }

            // Count total chapters
            let totalChapters = 0;
            if (course.courseData.days) {
                course.courseData.days.forEach(day => {
                    if (day.chapters) {
                        totalChapters += day.chapters.length;
                    }
                });
            }

            if (totalChapters === 0) {
                return 0;
            }

            // Count learners who completed all chapters
            let completedCount = 0;
            for (const userId of userIds) {
                const { data: progress } = await supabaseClient
                    .from('user_progress')
                    .select('content_id')
                    .eq('user_id', userId)
                    .eq('course_id', courseId)
                    .eq('completed', true);

                const completedChapters = progress?.length || 0;
                if (completedChapters >= totalChapters) {
                    completedCount++;
                }
            }

            return this.calculateProgressPercentage(completedCount, userIds.length);
        } catch (error) {
            console.error('[AnalyticsService] Error calculating course completion rate:', error);
            return 0;
        }
    }

    /**
     * Calculate average completion time for a course
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Average completion time in days, or null
     */
    async calculateAverageCompletionTime(courseId) {
        if (!courseId) {
            return null;
        }

        try {
            // Get completed learners
            const { data: allocations } = await supabaseClient
                .from('course_allocations')
                .select('user_id, allocated_at')
                .eq('course_id', courseId)
                .eq('status', 'active');

            if (!allocations || allocations.length === 0) {
                return null;
            }

            // Get course structure to determine total chapters
            const course = await courseService.getCourseById(courseId);
            if (!course || !course.courseData) {
                return null;
            }

            let totalChapters = 0;
            if (course.courseData.days) {
                course.courseData.days.forEach(day => {
                    if (day.chapters) {
                        totalChapters += day.chapters.length;
                    }
                });
            }

            if (totalChapters === 0) {
                return null;
            }

            // Calculate completion times
            const completionTimes = [];
            for (const allocation of allocations) {
                const { data: progress } = await supabaseClient
                    .from('user_progress')
                    .select('completed_at')
                    .eq('user_id', allocation.user_id)
                    .eq('course_id', courseId)
                    .eq('completed', true)
                    .order('completed_at', { ascending: false })
                    .limit(1);

                if (progress && progress.length > 0) {
                    const completedChapters = progress.length;
                    if (completedChapters >= totalChapters) {
                        const lastCompleted = new Date(progress[0].completed_at);
                        const allocatedAt = new Date(allocation.allocated_at);
                        const daysDiff = (lastCompleted - allocatedAt) / (1000 * 60 * 60 * 24);
                        completionTimes.push(daysDiff);
                    }
                }
            }

            if (completionTimes.length === 0) {
                return null;
            }

            const sum = completionTimes.reduce((acc, time) => acc + time, 0);
            return Math.round((sum / completionTimes.length) * 100) / 100; // Round to 2 decimal places
        } catch (error) {
            console.error('[AnalyticsService] Error calculating average completion time:', error);
            return null;
        }
    }

    /**
     * Calculate average learner progress for a trainer
     * @param {string} trainerId - Trainer ID
     * @returns {Promise<number>} Average progress percentage (0-100)
     */
    async calculateAverageLearnerProgress(trainerId) {
        if (!trainerId) {
            return 0;
        }

        try {
            // Get assigned learners
            const { data: learners } = await supabaseClient
                .from('users')
                .select('id')
                .eq('trainer_id', trainerId)
                .eq('role', 'learner')
                .eq('learner_type', 'active');

            if (!learners || learners.length === 0) {
                return 0;
            }

            const userIds = learners.map(l => l.id);
            const progressPromises = userIds.map(userId => 
                this.calculateOverallProgress(userId)
            );

            const progressValues = await Promise.all(progressPromises);
            const totalProgress = progressValues.reduce((sum, p) => sum + p, 0);

            return progressValues.length > 0 
                ? Math.round(totalProgress / progressValues.length) 
                : 0;
        } catch (error) {
            console.error('[AnalyticsService] Error calculating average learner progress:', error);
            return 0;
        }
    }

    /**
     * Calculate average response time for lab reviews (in hours)
     * @param {string} trainerId - Trainer ID
     * @param {Object} dateRange - Optional date range
     * @returns {Promise<number>} Average response time in hours, or null
     */
    async calculateResponseTime(trainerId, dateRange = null) {
        if (!trainerId) {
            return null;
        }

        try {
            let query = supabaseClient
                .from('lab_submissions')
                .select('submitted_at, reviewed_at')
                .eq('trainer_id', trainerId)
                .not('reviewed_at', 'is', null);

            if (dateRange) {
                if (dateRange.from) {
                    query = query.gte('submitted_at', dateRange.from.toISOString());
                }
                if (dateRange.to) {
                    query = query.lte('submitted_at', dateRange.to.toISOString());
                }
            }

            const { data, error } = await query;

            if (error || !data || data.length === 0) {
                return null;
            }

            const responseTimes = data
                .map(submission => {
                    const submitted = new Date(submission.submitted_at);
                    const reviewed = new Date(submission.reviewed_at);
                    return (reviewed - submitted) / (1000 * 60 * 60); // Convert to hours
                })
                .filter(time => time >= 0); // Filter out negative times (data issues)

            if (responseTimes.length === 0) {
                return null;
            }

            const sum = responseTimes.reduce((acc, time) => acc + time, 0);
            return Math.round((sum / responseTimes.length) * 100) / 100; // Round to 2 decimal places
        } catch (error) {
            console.error('[AnalyticsService] Error calculating response time:', error);
            return null;
        }
    }
}

export const analyticsService = new AnalyticsService();

