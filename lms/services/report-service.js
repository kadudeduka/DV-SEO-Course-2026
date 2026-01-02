/**
 * Report Service
 * 
 * Generates and aggregates report data for learners, trainers, and admins.
 * Handles data aggregation, caching, and export functionality.
 */

import { supabaseClient } from './supabase-client.js';
import { analyticsService } from './analytics-service.js';
import { courseService } from './course-service.js';
import { tagService } from './tag-service.js';

class ReportService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Clear all cached data
     * Useful when calculation logic changes and old cached values need to be invalidated
     */
    clearCache() {
        this.cache.clear();
        console.log('[ReportService] Cache cleared');
    }

    // ============================================================================
    // LEARNER REPORTS
    // ============================================================================

    /**
     * Get learner overview report
     * @param {string} userId - User ID
     * @param {Object} dateRange - { from: Date, to: Date }
     * @returns {Promise<Object>} Learner overview data
     */
    async getLearnerOverview(userId, dateRange = null) {
        // Include version in cache key to invalidate old cached data after calculation fixes
        const cacheVersion = 'v3'; // Increment when calculation logic changes (v3: fixed progress calculation to use one decimal place)
        const cacheKey = `learner_overview_${cacheVersion}_${userId}_${JSON.stringify(dateRange)}`;
        
        // Check cache (5 minute timeout)
        // Note: Cache version ensures old rounded values are not used after fixes
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Get course allocations
            const { data: allocations } = await supabaseClient
                .from('course_allocations')
                .select('course_id, allocated_at')
                .eq('user_id', userId)
                .eq('status', 'active');

            const courseIds = allocations?.map(a => a.course_id) || [];

            // Get progress data
            let progress = [];
            if (courseIds.length > 0) {
                const { data } = await supabaseClient
                    .from('user_progress')
                    .select('*')
                    .eq('user_id', userId)
                    .in('course_id', courseIds);
                progress = data || [];
            }

            // Get lab submissions
            let labs = [];
            if (courseIds.length > 0) {
                const { data } = await supabaseClient
                    .from('lab_submissions')
                    .select('*')
                    .eq('user_id', userId)
                    .in('course_id', courseIds);
                labs = data || [];
            }

            // Calculate metrics
            const totalCourses = courseIds.length;
            const coursesInProgress = await this._getCoursesInProgress(userId, courseIds);
            const coursesCompleted = await this._getCoursesCompleted(userId, courseIds);
            const overallProgress = await analyticsService.calculateOverallProgress(userId);
            const chaptersCompleted = progress.filter(p => p.completed).length || 0;
            const labsSubmitted = labs.length || 0;
            const averageLabScore = await analyticsService.calculateAverageLabScore(userId);

            // Get course breakdown
            const courseBreakdown = await this._getCourseBreakdown(userId, courseIds);

            const result = {
                totalCourses,
                coursesInProgress,
                coursesCompleted,
                overallProgress,
                averageProgress: overallProgress, // Alias for consistency with other reports
                chaptersCompleted,
                labsSubmitted,
                averageLabScore: averageLabScore || 0,
                certificatesEarned: coursesCompleted, // Assuming 1 cert per course
                courseBreakdown
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting learner overview:', error);
            throw error;
        }
    }

    /**
     * Get course-specific learner report
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {Object} dateRange - { from: Date, to: Date }
     * @returns {Promise<Object>} Course-specific report data
     */
    async getLearnerCourseReport(userId, courseId, dateRange = null) {
        // Include version in cache key to invalidate old cached data after calculation fixes
        const cacheVersion = 'v3'; // Increment when calculation logic changes (v3: fixed progress calculation to use one decimal place)
        const cacheKey = `learner_course_${cacheVersion}_${userId}_${courseId}_${JSON.stringify(dateRange)}`;
        
        // Check cache (5 minute timeout)
        // Note: Cache version ensures old rounded values are not used after fixes
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Get course details
            const course = await courseService.getCourseById(courseId);
            if (!course) {
                throw new Error('Course not found');
            }

            // Get allocation info
            const { data: allocations, error: allocError } = await supabaseClient
                .from('course_allocations')
                .select('allocated_at')
                .eq('user_id', userId)
                .eq('course_id', courseId)
                .eq('status', 'active')
                .order('allocated_at', { ascending: true })
                .limit(1);

            const allocation = allocations && allocations.length > 0 ? allocations[0] : null;
            
            if (allocError) {
                console.warn('[ReportService] Error getting allocation:', allocError);
            }

            // Get progress
            const progress = await analyticsService.calculateCourseProgress(userId, courseId);
            
            // Get chapter progress
            const chapterProgress = await this._getChapterProgress(userId, courseId);
            
            // Get lab performance
            const labPerformance = await this._getLabPerformance(userId, courseId);
            
            // Get activity timeline
            const activityTimeline = await this._getActivityTimeline(userId, courseId, dateRange);

            // Calculate performance metrics
            // Use course allocation date as start date if no date range provided
            let dateRangeForMetrics = null;
            if (dateRange) {
                dateRangeForMetrics = {
                    from: dateRange.from ? new Date(dateRange.from) : null,
                    to: dateRange.to ? new Date(dateRange.to) : null
                };
            } else if (allocation?.allocated_at) {
                // Use course allocation date as start date for metrics
                dateRangeForMetrics = {
                    from: new Date(allocation.allocated_at),
                    to: new Date()
                };
            }

            const metrics = {
                averageTimePerChapter: await this._calculateAverageTimePerChapter(userId, courseId),
                averageTimePerLab: await this._calculateAverageTimePerLab(userId, courseId),
                consistencyScore: await analyticsService.calculateConsistencyScore(userId, dateRangeForMetrics),
                engagementScore: await analyticsService.calculateEngagementScore(userId, dateRangeForMetrics)
            };

            const result = {
                course: {
                    id: course.id,
                    name: course.title,
                    description: course.description
                },
                progress,
                timeSpent: await this._getTimeSpent(userId, courseId),
                daysSinceStart: allocation ? 
                    Math.floor((Date.now() - new Date(allocation.allocated_at)) / (1000 * 60 * 60 * 24)) : 0,
                estimatedCompletionDate: this._estimateCompletionDate(progress, allocation?.allocated_at),
                chapterProgress,
                labPerformance,
                activityTimeline,
                metrics
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting learner course report:', error);
            throw error;
        }
    }

    // ============================================================================
    // TRAINER REPORTS
    // ============================================================================

    /**
     * Get trainer learner overview
     * @param {string} trainerId - Trainer ID
     * @param {Object} filters - { learnerType, tags, search, dateRange }
     * @returns {Promise<Object>} Trainer learner overview data
     */
    async getTrainerLearnerOverview(trainerId, filters = {}) {
        // Include version in cache key to invalidate old cached data after calculation fixes
        const cacheVersion = 'v3'; // Increment when calculation logic changes (v3: fixed progress calculation to use one decimal place)
        const cacheKey = `trainer_learner_overview_${cacheVersion}_${trainerId}_${JSON.stringify(filters)}`;
        
        // Check cache (5 minute timeout)
        // Note: Cache version ensures old rounded values are not used after fixes
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Get assigned learners
            let query = supabaseClient
                .from('users')
                .select('id, full_name, email, learner_type, created_at')
                .eq('trainer_id', trainerId)
                .eq('role', 'learner');

            // Only filter by learner_type if specified in filters
            if (filters.learnerType && filters.learnerType !== 'all') {
                query = query.eq('learner_type', filters.learnerType);
            }

            const { data: learners, error } = await query;

            if (error) {
                throw new Error(`Failed to get learners: ${error.message}`);
            }

            // Apply filters
            let filteredLearners = learners || [];
            
            // Filter by learner type if not already filtered in query
            // Default: show active learners and learners with null learner_type (for backward compatibility)
            if (!filters.learnerType || filters.learnerType === 'all') {
                filteredLearners = filteredLearners.filter(l => 
                    l.learner_type === 'active' || l.learner_type === null || l.learner_type === undefined
                );
            }

            if (filters.tags && filters.tags.length > 0) {
                const taggedUserIds = await tagService.getUsersByTags(filters.tags);
                filteredLearners = filteredLearners.filter(l => taggedUserIds.includes(l.id));
            }

            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                filteredLearners = filteredLearners.filter(l =>
                    (l.full_name || '').toLowerCase().includes(searchTerm) ||
                    (l.email || '').toLowerCase().includes(searchTerm)
                );
            }

            // Get performance data for each learner
            const learnerPerformance = await Promise.all(
                filteredLearners.map(async (learner) => {
                    const overview = await this.getLearnerOverview(learner.id, filters.dateRange);
                    const lastActivityDate = await this._getLastActivityDate(learner.id);
                    const statusInfo = this._determineLearnerStatus(overview, lastActivityDate);
                    return {
                        ...learner,
                        ...overview,
                        status: statusInfo.status,
                        statusReason: statusInfo.reason,
                        lastActivityDate
                    };
                })
            );

            // Calculate summary statistics
            // Active learners = all assigned learners (they're already filtered to active learner_type)
            // Since we filter to only show active learners, all learners in the list are "active"
            // However, we can also count those with recent activity for more granular tracking
            // For now, count all as active since they're all active type learners
            const activeLearnersCount = learnerPerformance.length; // All are active type
            
            const summary = {
                totalLearners: learnerPerformance.length,
                activeLearners: activeLearnersCount,
                atRiskLearners: learnerPerformance.filter(l => l.status === 'at_risk').length,
                averageCompletionRate: this._calculateAverage(learnerPerformance, 'overallProgress'),
                totalCoursesAllocated: learnerPerformance.reduce((sum, l) => sum + l.totalCourses, 0),
                totalLabsPending: await this._getTotalLabsPending(trainerId),
                averageLabScore: this._calculateAverage(learnerPerformance, 'averageLabScore')
            };

            const result = {
                summary,
                learners: learnerPerformance
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting trainer learner overview:', error);
            throw error;
        }
    }

    /**
     * Get individual learner report for trainer
     * @param {string} trainerId - Trainer ID
     * @param {string} learnerId - Learner ID
     * @param {Object} dateRange - { from: Date, to: Date }
     * @returns {Promise<Object>} Individual learner report data
     */
    async getIndividualLearnerReport(trainerId, learnerId, dateRange = null) {
        // Verify trainer has access to this learner
        const { data: learner } = await supabaseClient
            .from('users')
            .select('trainer_id')
            .eq('id', learnerId)
            .single();

        if (!learner || learner.trainer_id !== trainerId) {
            throw new Error('Access denied: Learner not assigned to trainer');
        }

        // Get learner overview (same as learner's own view)
        const overview = await this.getLearnerOverview(learnerId, dateRange);
        
        // Get user profile
        const { data: userProfile } = await supabaseClient
            .from('users')
            .select('id, full_name, email, learner_type, created_at')
            .eq('id', learnerId)
            .single();

        // Get course performance
        const coursePerformance = await this._getLearnerCoursePerformance(learnerId);

        // Get lab evaluation summary
        const labEvaluation = await this._getLabEvaluationSummary(learnerId, trainerId);

        // Get activity timeline
        const activityTimeline = await this._getActivityTimeline(learnerId, null, dateRange);

        // Determine learner status
        const lastActivityDate = await this._getLastActivityDate(learnerId);
        const statusInfo = this._determineLearnerStatus(overview, lastActivityDate);

        return {
            learner: {
                ...userProfile,
                daysSinceRegistration: Math.floor((Date.now() - new Date(userProfile.created_at)) / (1000 * 60 * 60 * 24)),
                status: statusInfo.status,
                statusReason: statusInfo.reason
            },
            overview,
            coursePerformance,
            labEvaluation,
            activityTimeline
        };
    }

    /**
     * Get course performance report for trainer
     * @param {string} trainerId - Trainer ID
     * @param {string} courseId - Course ID
     * @param {Object} filters - Additional filters
     * @returns {Promise<Object>} Course performance report data
     */
    async getCoursePerformanceReport(trainerId, courseId, filters = {}) {
        const cacheKey = `trainer_course_performance_${trainerId}_${courseId}_v2_${JSON.stringify(filters)}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Get course details
            const course = await courseService.getCourseById(courseId);
            if (!course) {
                throw new Error('Course not found');
            }

            // Get assigned learners
            const { data: learners } = await supabaseClient
                .from('users')
                .select('id, full_name, email')
                .eq('trainer_id', trainerId)
                .eq('role', 'learner')
                .eq('learner_type', 'active');

            const learnerIds = learners?.map(l => l.id) || [];

            // Get course allocations for these learners
            const { data: allocations } = await supabaseClient
                .from('course_allocations')
                .select('user_id, allocated_at')
                .eq('course_id', courseId)
                .eq('status', 'active')
                .in('user_id', learnerIds.length > 0 ? learnerIds : ['']);

            // Get learner performance in this course
            const learnerPerformance = await Promise.all(
                (allocations || []).map(async (allocation) => {
                    const learner = learners.find(l => l.id === allocation.user_id);
                    const progress = await analyticsService.calculateCourseProgress(allocation.user_id, courseId);
                    
                    // Get chapters completed
                    const { data: progressData } = await supabaseClient
                        .from('user_progress')
                        .select('content_id')
                        .eq('user_id', allocation.user_id)
                        .eq('course_id', courseId)
                        .eq('completed', true);

                    // Get labs submitted
                    const { data: labs } = await supabaseClient
                        .from('lab_submissions')
                        .select('score')
                        .eq('user_id', allocation.user_id)
                        .eq('course_id', courseId);

                    const labScores = labs?.filter(l => l.score).map(l => parseFloat(l.score)) || [];

                    const lastAccessed = await this._getLastActivityDateForCourse(allocation.user_id, courseId);
                    const lastActivityDate = await this._getLastActivityDate(allocation.user_id);
                    
                    // Build overview object for status determination
                    // Scores are stored as 0-10, convert to percentage (0-100) for status determination
                    const averageScoreRaw = labScores.length > 0 
                        ? labScores.reduce((sum, s) => sum + s, 0) / labScores.length 
                        : null;
                    const averageLabScore = averageScoreRaw !== null ? averageScoreRaw * 10 : null; // Convert 0-10 to 0-100
                    
                    const overviewForStatus = {
                        overallProgress: progress,
                        labsSubmitted: labs?.length || 0,
                        averageLabScore: averageLabScore
                    };
                    
                    const statusInfo = this._determineLearnerStatus(overviewForStatus, lastActivityDate);
                    
                    return {
                        id: allocation.user_id,
                        name: learner?.full_name || learner?.email || 'Unknown',
                        progress,
                        chaptersCompleted: progressData?.length || 0,
                        labsSubmitted: labs?.length || 0,
                        labScores: labScores.length > 0 ? labScores : null,
                        timeSpent: await this._getTimeSpent(allocation.user_id, courseId),
                        lastAccessed,
                        status: statusInfo.status,
                        statusReason: statusInfo.reason
                    };
                })
            );

            // Calculate course overview
            const totalLearners = learnerPerformance.length;
            const averageProgress = totalLearners > 0
                ? learnerPerformance.reduce((sum, l) => sum + l.progress, 0) / totalLearners
                : 0;

            // Get chapter analysis
            const chapterAnalysis = await this._getChapterAnalysisForCourse(courseId, learnerIds);

            // Get lab analysis
            const labAnalysis = await this._getLabAnalysisForCourse(courseId, learnerIds);

            const result = {
                course: {
                    id: course.id,
                    name: course.title,
                    description: course.description
                },
                overview: {
                    totalLearners,
                    averageProgress,
                    averageCompletionTime: await analyticsService.calculateAverageCompletionTime(courseId),
                    averageLabScore: await this._calculateAverageLabScoreForCourse(courseId, learnerIds)
                },
                learners: learnerPerformance,
                chapterAnalysis,
                labAnalysis
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting course performance report:', error);
            throw error;
        }
    }

    async _getLastActivityDateForCourse(userId, courseId) {
        const { data } = await supabaseClient
            .from('user_progress')
            .select('last_accessed_at')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .order('last_accessed_at', { ascending: false })
            .limit(1);

        return data?.[0]?.last_accessed_at || null;
    }

    async _getChapterAnalysisForCourse(courseId, learnerIds) {
        try {
            // Get course structure
            const course = await courseService.getCourseById(courseId);
            if (!course || !course.courseData) {
                console.warn(`[ReportService] Course ${courseId} not found or has no courseData`);
                return [];
            }

            const chapters = [];
            const chapterIds = new Set();
            if (course.courseData.days) {
                course.courseData.days.forEach(day => {
                    if (day.chapters) {
                        day.chapters.forEach(chapter => {
                            if (chapter.id) {
                                chapters.push({
                                    id: chapter.id,
                                    name: chapter.title || chapter.name || 'Untitled Chapter'
                                });
                                chapterIds.add(chapter.id);
                            }
                        });
                    }
                });
            }

            if (chapters.length === 0) {
                console.warn(`[ReportService] No chapters found in course ${courseId}`);
                return [];
            }

            if (learnerIds.length === 0) {
                console.warn(`[ReportService] No learners found for course ${courseId}`);
                return chapters.map(ch => ({
                    id: ch.id,
                    name: ch.name,
                    completionRate: 0,
                    averageTimeToComplete: 0,
                    commonIssues: null
                }));
            }

            // Get all completed progress for this course and these learners
            // Filter by content_type to ensure we only count chapters, not labs
            const { data: allProgress, error: progressError } = await supabaseClient
                .from('user_progress')
                .select('user_id, content_id, content_type, time_spent, completed_at')
                .eq('course_id', courseId)
                .eq('completed', true)
                .in('user_id', learnerIds);

            if (progressError) {
                console.error('[ReportService] Error fetching progress:', progressError);
            }

            // Analyze each chapter
            const chapterAnalysis = await Promise.all(
                chapters.map(async (chapter) => {
                    // Filter progress to only this chapter
                    // Match by content_id AND ensure it's a chapter (content_type is 'chapter' or null/undefined)
                    const chapterCompletions = (allProgress || []).filter(p => {
                        const matchesId = p.content_id === chapter.id;
                        const isChapterType = !p.content_type || p.content_type === 'chapter' || p.content_type === null;
                        return matchesId && isChapterType;
                    });

                    const completionCount = chapterCompletions.length;
                    const completionRate = learnerIds.length > 0
                        ? (completionCount / learnerIds.length) * 100
                        : 0;

                    // Calculate average time to complete (if available)
                    const timeSpent = chapterCompletions.filter(p => p.time_spent && p.time_spent > 0).map(p => p.time_spent) || [];
                    const averageTimeToComplete = timeSpent.length > 0
                        ? timeSpent.reduce((sum, t) => sum + t, 0) / timeSpent.length / 60 // Convert to minutes
                        : 0;

                    console.log(`[ReportService] Chapter "${chapter.name}" (${chapter.id}): ${completionCount}/${learnerIds.length} completed (${completionRate.toFixed(1)}%)`);

                    return {
                        id: chapter.id,
                        name: chapter.name,
                        completionRate,
                        averageTimeToComplete,
                        commonIssues: null // Would need additional data to determine
                    };
                })
            );

            return chapterAnalysis;
        } catch (error) {
            console.error('[ReportService] Error getting chapter analysis:', error);
            return [];
        }
    }

    async _getLabAnalysisForCourse(courseId, learnerIds) {
        try {
            // Get course structure
            const course = await courseService.getCourseById(courseId);
            if (!course || !course.courseData) {
                return [];
            }

            const labs = [];
            if (course.courseData.days) {
                course.courseData.days.forEach(day => {
                    if (day.labs) {
                        day.labs.forEach(lab => {
                            labs.push({
                                id: lab.id,
                                name: lab.title || lab.name || 'Untitled Lab'
                            });
                        });
                    }
                });
            }

            // Analyze each lab
            const labAnalysis = await Promise.all(
                labs.map(async (lab) => {
                    // Get submissions for this lab
                    const { data: submissions } = await supabaseClient
                        .from('lab_submissions')
                        .select('*')
                        .eq('course_id', courseId)
                        .eq('lab_id', lab.id)
                        .in('user_id', learnerIds.length > 0 ? learnerIds : ['']);

                    const submissionCount = submissions?.length || 0;
                    const submissionRate = learnerIds.length > 0
                        ? (submissionCount / learnerIds.length) * 100
                        : 0;

                    // Calculate average score
                    // Scores are stored as 0-10, convert to percentage (0-100) for reports
                    const scoredSubmissions = submissions?.filter(s => s.score !== null && s.score !== undefined) || [];
                    const averageScoreRaw = scoredSubmissions.length > 0
                        ? scoredSubmissions.reduce((sum, s) => sum + parseFloat(s.score), 0) / scoredSubmissions.length
                        : null;
                    const averageScore = averageScoreRaw !== null ? averageScoreRaw * 10 : null; // Convert 0-10 to 0-100

                    // Calculate resubmission rate
                    const resubmissions = submissions?.filter(s => (s.resubmission_count || 0) > 0).length || 0;
                    const resubmissionRate = submissionCount > 0
                        ? (resubmissions / submissionCount) * 100
                        : 0;

                    return {
                        id: lab.id,
                        name: lab.name,
                        submissionRate,
                        averageScore: averageScore ? Math.round(averageScore * 100) / 100 : null,
                        commonMistakes: null, // Would need feedback analysis
                        resubmissionRate
                    };
                })
            );

            return labAnalysis;
        } catch (error) {
            console.error('[ReportService] Error getting lab analysis:', error);
            return [];
        }
    }

    async _calculateAverageLabScoreForCourse(courseId, learnerIds) {
        try {
            if (learnerIds.length === 0) {
                return null;
            }

            const { data: submissions } = await supabaseClient
                .from('lab_submissions')
                .select('score')
                .eq('course_id', courseId)
                .in('user_id', learnerIds)
                .not('score', 'is', null);

            if (!submissions || submissions.length === 0) {
                return null;
            }

            // Scores are stored as 0-10, convert to percentage (0-100) for reports
            const scores = submissions.map(s => parseFloat(s.score));
            const averageRaw = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            const average = averageRaw * 10; // Convert 0-10 to 0-100
            return Math.round(average * 100) / 100;
        } catch (error) {
            console.error('[ReportService] Error calculating average lab score for course:', error);
            return null;
        }
    }

    /**
     * Get cross-course comparison
     * @param {string} trainerId - Trainer ID
     * @param {Array<string>} courseIds - Array of course IDs to compare
     * @param {Array<string>} learnerIds - Array of learner IDs to compare
     * @returns {Promise<Object>} Comparison data
     */
    async getCrossCourseComparison(trainerId, courseIds = [], learnerIds = []) {
        try {
            if (courseIds.length > 0) {
                // Compare courses
                const courseData = await Promise.all(
                    courseIds.map(async (courseId) => {
                        const course = await courseService.getCourseById(courseId);
                        const report = await this.getCoursePerformanceReport(trainerId, courseId);
                        return {
                            id: courseId,
                            name: course?.title || 'Unknown Course',
                            averageProgress: report.overview.averageProgress || 0,
                            averageLabScore: report.overview.averageLabScore || null,
                            completionRate: await analyticsService.calculateCourseCompletionRate(courseId),
                            engagement: 0 // Would need to calculate
                        };
                    })
                );

                return { courses: courseData, learners: [] };
            } else if (learnerIds.length > 0) {
                // Compare learners
                const learnerData = await Promise.all(
                    learnerIds.map(async (learnerId) => {
                        const overview = await this.getLearnerOverview(learnerId);
                        return {
                            id: learnerId,
                            name: 'Unknown', // Will be updated below
                            overallProgress: overview.overallProgress || 0,
                            averageLabScore: overview.averageLabScore || null,
                            timeSpent: 0, // Would need to calculate
                            consistency: 0 // Would need to calculate
                        };
                    })
                );

                // Get learner names
                const { data: learners } = await supabaseClient
                    .from('users')
                    .select('id, full_name, email')
                    .in('id', learnerIds);

                learnerData.forEach(learner => {
                    const user = learners?.find(l => l.id === learner.id);
                    if (user) {
                        learner.name = user.full_name || user.email || 'Unknown';
                    }
                });

                return { courses: [], learners: learnerData };
            }

            return { courses: [], learners: [] };
        } catch (error) {
            console.error('[ReportService] Error getting cross-course comparison:', error);
            throw error;
        }
    }

    /**
     * Get tag-based performance report
     * @param {Array<string>} tagIds - Array of tag IDs
     * @param {Object} filters - Additional filters
     * @param {string} userRole - User role (trainer or admin)
     * @param {string} userId - User ID (trainer ID or admin ID)
     * @returns {Promise<Object>} Tag-based report data
     */
    async getTagBasedReport(tagIds, filters, userRole, userId) {
        if (!tagIds || tagIds.length === 0) {
            throw new Error('At least one tag must be selected');
        }

        try {
            // Get users with these tags
            const taggedUserIds = await tagService.getUsersByTags(tagIds);

            if (taggedUserIds.length === 0) {
                return {
                    summary: {
                        totalLearners: 0,
                        averageProgress: 0,
                        averageLabScore: null,
                        completionRate: 0
                    },
                    learners: []
                };
            }

            // Filter by role if trainer (only show assigned learners)
            let filteredUserIds = taggedUserIds;
            if (userRole === 'trainer') {
                const { data: assignedLearners } = await supabaseClient
                    .from('users')
                    .select('id')
                    .eq('trainer_id', userId)
                    .eq('role', 'learner')
                    .eq('learner_type', 'active')
                    .in('id', taggedUserIds);

                filteredUserIds = assignedLearners?.map(l => l.id) || [];
            }

            if (filteredUserIds.length === 0) {
                return {
                    summary: {
                        totalLearners: 0,
                        averageProgress: 0,
                        averageLabScore: null,
                        completionRate: 0
                    },
                    learners: []
                };
            }

            // Get learner performance data
            const learnerData = await Promise.all(
                filteredUserIds.map(async (learnerId) => {
                    const overview = await this.getLearnerOverview(learnerId, filters.dateRange);
                    const lastActivityDate = await this._getLastActivityDate(learnerId);
                    const statusInfo = this._determineLearnerStatus(overview, lastActivityDate);
                    return {
                        id: learnerId,
                        ...overview,
                        status: statusInfo.status,
                        statusReason: statusInfo.reason
                    };
                })
            );

            // Get user details
            const { data: users } = await supabaseClient
                .from('users')
                .select('id, full_name, email')
                .in('id', filteredUserIds);

            // Merge user details with performance data
            learnerData.forEach(learner => {
                const user = users?.find(u => u.id === learner.id);
                if (user) {
                    learner.full_name = user.full_name;
                    learner.email = user.email;
                }
            });

            // Calculate summary statistics
            const summary = {
                totalLearners: learnerData.length,
                averageProgress: this._calculateAverage(learnerData, 'overallProgress'),
                averageLabScore: this._calculateAverage(learnerData, 'averageLabScore'),
                completionRate: learnerData.length > 0
                    ? (learnerData.filter(l => l.coursesCompleted > 0).length / learnerData.length) * 100
                    : 0
            };

            return {
                summary,
                learners: learnerData
            };
        } catch (error) {
            console.error('[ReportService] Error getting tag-based report:', error);
            throw error;
        }
    }

    /**
     * Get course performance report for admin (all learners, not just trainer's)
     * @param {string} courseId - Course ID
     * @returns {Promise<Object>} Course performance report data
     */
    async getAdminCoursePerformanceReport(courseId) {
        const cacheKey = `admin_course_performance_${courseId}_v2`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Get course details
            const course = await courseService.getCourseById(courseId);
            if (!course) {
                throw new Error('Course not found');
            }

            // Get all course allocations (not filtered by trainer)
            const { data: allocations } = await supabaseClient
                .from('course_allocations')
                .select('user_id, allocated_at')
                .eq('course_id', courseId)
                .eq('status', 'active');

            const learnerIds = allocations?.map(a => a.user_id) || [];

            // Get learner performance in this course
            const learnerPerformance = await Promise.all(
                (allocations || []).map(async (allocation) => {
                    const { data: user } = await supabaseClient
                        .from('users')
                        .select('full_name, email')
                        .eq('id', allocation.user_id)
                        .single();

                    const progress = await analyticsService.calculateCourseProgress(allocation.user_id, courseId);
                    
                    // Get chapters completed
                    const { data: progressData } = await supabaseClient
                        .from('user_progress')
                        .select('content_id')
                        .eq('user_id', allocation.user_id)
                        .eq('course_id', courseId)
                        .eq('completed', true);

                    // Get labs submitted
                    const { data: labs } = await supabaseClient
                        .from('lab_submissions')
                        .select('score')
                        .eq('user_id', allocation.user_id)
                        .eq('course_id', courseId);

                    // Scores are stored as 0-10, convert to percentage (0-100) for reports
                    const labScores = labs?.filter(l => l.score).map(l => parseFloat(l.score)) || [];
                    const averageScoreRaw = labScores.length > 0
                        ? labScores.reduce((sum, s) => sum + s, 0) / labScores.length
                        : null;
                    const averageScore = averageScoreRaw !== null ? averageScoreRaw * 10 : null; // Convert 0-10 to 0-100

                    return {
                        id: allocation.user_id,
                        name: user?.full_name || user?.email || 'Unknown',
                        progress,
                        status: progress === 0 ? 'not_started' : progress >= 100 ? 'completed' : 'in_progress',
                        timeSpent: await this._getTimeSpent(allocation.user_id, courseId),
                        labsSubmitted: labs?.length || 0,
                        averageScore: averageScore 
                            ? labScores.reduce((sum, s) => sum + s, 0) / labScores.length 
                            : null,
                        enrolledAt: allocation.allocated_at
                    };
                })
            );

            // Calculate course overview
            const totalEnrollments = learnerPerformance.length;
            const activeLearners = learnerPerformance.filter(l => l.progress > 0 && l.progress < 100).length;
            const completedCount = learnerPerformance.filter(l => l.progress >= 100).length;
            const completionRate = totalEnrollments > 0 
                ? (completedCount / totalEnrollments) * 100 
                : 0;
            const averageProgress = totalEnrollments > 0
                ? learnerPerformance.reduce((sum, l) => sum + l.progress, 0) / totalEnrollments
                : 0;

            // Get chapter analysis (all learners)
            const chapterAnalysis = await this._getChapterAnalysisForCourse(courseId, learnerIds);

            // Get lab analysis (all learners)
            const labAnalysis = await this._getLabAnalysisForCourse(courseId, learnerIds);

            const result = {
                course: {
                    id: course.id,
                    name: course.title,
                    description: course.description
                },
                overview: {
                    totalEnrollments,
                    activeLearners,
                    completionRate,
                    averageProgress,
                    averageCompletionTime: await analyticsService.calculateAverageCompletionTime(courseId),
                    averageLabScore: await this._calculateAverageLabScoreForCourse(courseId, learnerIds)
                },
                learners: learnerPerformance,
                chapterAnalysis,
                labAnalysis
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting admin course performance report:', error);
            throw error;
        }
    }

    /**
     * Get trainer performance report for admin
     * @returns {Promise<Object>} Trainer performance report data
     */
    async getTrainerPerformanceReport() {
        const cacheKey = 'trainer_performance_report';
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Use the trainer_performance_summary view
            const { data: trainerData, error } = await supabaseClient
                .from('trainer_performance_summary')
                .select('*');

            if (error) {
                console.error('[ReportService] Error fetching trainer performance:', error);
                throw error;
            }

            const trainers = (trainerData || []).map(trainer => ({
                id: trainer.trainer_id,
                name: trainer.trainer_name || 'Unknown',
                email: trainer.trainer_email || 'N/A',
                totalLearners: trainer.total_assigned_learners || 0,
                activeLearners: trainer.active_learners || 0,
                labsReviewed: trainer.total_labs_reviewed || 0,
                pendingReviews: trainer.pending_lab_reviews || 0,
                avgResponseTime: trainer.avg_response_time_hours || null,
                averageLearnerScore: trainer.average_learner_lab_score 
                    ? Math.round(trainer.average_learner_lab_score * 100) / 100 
                    : null
            }));

            // Calculate summary statistics
            const totalTrainers = trainers.length;
            const activeTrainers = trainers.filter(t => t.totalLearners > 0).length;
            const totalAssignedLearners = trainers.reduce((sum, t) => sum + t.totalLearners, 0);
            const averageLearnersPerTrainer = totalTrainers > 0 
                ? totalAssignedLearners / totalTrainers 
                : 0;

            // Calculate average response time
            const responseTimes = trainers
                .filter(t => t.avgResponseTime !== null)
                .map(t => t.avgResponseTime);
            const averageResponseTime = responseTimes.length > 0
                ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
                : null;

            const totalLabsReviewed = trainers.reduce((sum, t) => sum + t.labsReviewed, 0);

            const result = {
                summary: {
                    totalTrainers,
                    activeTrainers,
                    totalAssignedLearners,
                    averageLearnersPerTrainer: Math.round(averageLearnersPerTrainer * 100) / 100,
                    averageResponseTime: averageResponseTime ? Math.round(averageResponseTime * 100) / 100 : null,
                    totalLabsReviewed
                },
                trainers
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting trainer performance report:', error);
            throw error;
        }
    }

    // ============================================================================
    // ADMIN REPORTS
    // ============================================================================

    /**
     * Get system overview report
     * @param {Object} dateRange - { from: Date, to: Date }
     * @returns {Promise<Object>} System overview data
     */
    async getSystemOverview(dateRange = null) {
        const cacheKey = `system_overview_${JSON.stringify(dateRange)}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Get system statistics
            const { data: users } = await supabaseClient
                .from('users')
                .select('id, role, status, created_at');

            const courses = await courseService.getCourses();
            const { data: allocations } = await supabaseClient
                .from('course_allocations')
                .select('*')
                .eq('status', 'active');

            const { data: labSubmissions } = await supabaseClient
                .from('lab_submissions')
                .select('*');

            // Calculate metrics
            const totalUsers = users?.length || 0;
            const totalLearners = users?.filter(u => u.role === 'learner').length || 0;
            const totalTrainers = users?.filter(u => u.role === 'trainer').length || 0;
            const totalAdmins = users?.filter(u => u.role === 'admin').length || 0;
            const activeUsers = await this._getActiveUsers(dateRange);
            const totalCourses = Array.isArray(courses) ? courses.length : 0;
            const publishedCourses = Array.isArray(courses) ? courses.filter(c => c.published).length : 0;
            const totalAllocations = allocations?.length || 0;
            const totalLabSubmissions = labSubmissions?.length || 0;
            const averageCompletionRate = await this._calculateSystemCompletionRate();
            const averageLabScore = await this._calculateSystemAverageLabScore();

            const result = {
                totalUsers,
                totalLearners,
                totalTrainers,
                totalAdmins,
                activeUsers,
                totalCourses,
                publishedCourses,
                totalAllocations,
                totalLabSubmissions,
                averageCompletionRate,
                averageLabScore,
                trends: await this._getSystemTrends(dateRange),
                quickInsights: await this._getQuickInsights()
            };

            // Cache result
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        } catch (error) {
            console.error('[ReportService] Error getting system overview:', error);
            throw error;
        }
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    async _getCoursesInProgress(userId, courseIds) {
        if (!courseIds || courseIds.length === 0) return 0;
        
        let inProgress = 0;
        for (const courseId of courseIds) {
            const progress = await analyticsService.calculateCourseProgress(userId, courseId);
            if (progress > 0 && progress < 100) {
                inProgress++;
            }
        }
        return inProgress;
    }

    async _getCoursesCompleted(userId, courseIds) {
        if (!courseIds || courseIds.length === 0) return 0;
        
        let completed = 0;
        for (const courseId of courseIds) {
            const progress = await analyticsService.calculateCourseProgress(userId, courseId);
            if (progress >= 100) {
                completed++;
            }
        }
        return completed;
    }

    async _getCourseBreakdown(userId, courseIds) {
        const breakdown = [];
        
        for (const courseId of courseIds) {
            const course = await courseService.getCourseById(courseId);
            if (!course) continue;

            const progress = await analyticsService.calculateCourseProgress(userId, courseId);
            const labs = await supabaseClient
                .from('lab_submissions')
                .select('*')
                .eq('user_id', userId)
                .eq('course_id', courseId);

            const { data: progressData } = await supabaseClient
                .from('user_progress')
                .select('last_accessed_at')
                .eq('user_id', userId)
                .eq('course_id', courseId)
                .order('last_accessed_at', { ascending: false })
                .limit(1);

            breakdown.push({
                id: courseId,
                name: course.title,
                progress,
                status: progress === 0 ? 'not_started' : progress >= 100 ? 'completed' : 'in_progress',
                lastAccessed: progressData?.[0]?.last_accessed_at || null,
                timeSpent: await this._getTimeSpent(userId, courseId),
                labsSubmitted: labs.data?.length || 0,
                totalLabs: await this._getTotalLabsForCourse(courseId),
                averageScore: await analyticsService.calculateAverageLabScore(userId, courseId) || 0
            });
        }

        return breakdown;
    }

    _determineLearnerStatus(overview, lastActivityDate = null) {
        // Determine status based on activity and engagement, not progress percentage
        // Returns an object with status and reason
        
        const reasons = [];
        
        // Check activity: if no activity in last 14 days, mark as at_risk
        if (lastActivityDate) {
            const daysSinceActivity = (Date.now() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24);
            if (daysSinceActivity > 14) {
                return {
                    status: 'at_risk',
                    reason: `No activity for ${Math.floor(daysSinceActivity)} days`
                };
            }
            if (daysSinceActivity > 7) {
                reasons.push(`No activity for ${Math.floor(daysSinceActivity)} days`);
            }
        } else {
            // No activity recorded at all
            return {
                status: 'at_risk',
                reason: 'No activity recorded'
            };
        }
        
        // Check lab performance: if multiple labs need revision or low scores
        if (overview.averageLabScore !== undefined && overview.averageLabScore !== null && overview.labsSubmitted > 0) {
            if (overview.averageLabScore < 50) {
                return {
                    status: 'at_risk',
                    reason: `Low lab score: ${overview.averageLabScore.toFixed(1)}%`
                };
            }
            if (overview.averageLabScore < 70) {
                reasons.push(`Low lab score: ${overview.averageLabScore.toFixed(1)}%`);
            }
        }
        
        // If active and performing well, mark as on_track
        if (reasons.length > 0) {
            return {
                status: 'needs_attention',
                reason: reasons.join('; ')
            };
        }
        
        return {
            status: 'on_track',
            reason: null
        };
    }

    _isActive(learner) {
        if (!learner.lastActivityDate) return false;
        const daysSinceActivity = (Date.now() - new Date(learner.lastActivityDate)) / (1000 * 60 * 60 * 24);
        return daysSinceActivity <= 30;
    }

    _calculateAverage(array, field) {
        if (!array || array.length === 0) return 0;
        const sum = array.reduce((acc, item) => acc + (item[field] || 0), 0);
        return Math.round((sum / array.length) * 100) / 100;
    }

    async _getLastActivityDate(userId) {
        // Get the most recent activity from multiple sources
        const activityDates = [];
        
        // 1. Check user_progress (chapter/content access)
        const { data: progressData } = await supabaseClient
            .from('user_progress')
            .select('last_accessed_at, completed_at')
            .eq('user_id', userId)
            .or('last_accessed_at.not.is.null,completed_at.not.is.null')
            .order('last_accessed_at', { ascending: false })
            .limit(10);
        
        if (progressData && progressData.length > 0) {
            progressData.forEach(p => {
                if (p.last_accessed_at) activityDates.push(new Date(p.last_accessed_at));
                if (p.completed_at) activityDates.push(new Date(p.completed_at));
            });
        }
        
        // 2. Check lab_submissions (lab activity)
        const { data: labData } = await supabaseClient
            .from('lab_submissions')
            .select('submitted_at, reviewed_at')
            .eq('user_id', userId)
            .or('submitted_at.not.is.null,reviewed_at.not.is.null')
            .order('submitted_at', { ascending: false })
            .limit(10);
        
        if (labData && labData.length > 0) {
            labData.forEach(l => {
                if (l.submitted_at) activityDates.push(new Date(l.submitted_at));
                if (l.reviewed_at) activityDates.push(new Date(l.reviewed_at));
            });
        }
        
        // Return the most recent activity date
        if (activityDates.length > 0) {
            const mostRecent = new Date(Math.max(...activityDates.map(d => d.getTime())));
            return mostRecent.toISOString();
        }
        
        return null;
    }

    async _getTotalLabsPending(trainerId) {
        // Get learners assigned to this trainer
        const { data: learners } = await supabaseClient
            .from('users')
            .select('id')
            .eq('trainer_id', trainerId)
            .eq('role', 'learner')
            .eq('learner_type', 'active');

        if (!learners || learners.length === 0) {
            return 0;
        }

        const learnerIds = learners.map(l => l.id);

        // Count pending labs for assigned learners
        const { count } = await supabaseClient
            .from('lab_submissions')
            .select('*', { count: 'exact', head: true })
            .in('user_id', learnerIds)
            .eq('status', 'submitted'); // 'submitted' is the status before review

        return count || 0;
    }

    async _getTimeSpent(userId, courseId) {
        const { data } = await supabaseClient
            .from('user_progress')
            .select('time_spent')
            .eq('user_id', userId)
            .eq('course_id', courseId);

        const totalSeconds = (data || []).reduce((sum, p) => sum + (p.time_spent || 0), 0);
        return Math.round(totalSeconds / 60); // Return in minutes
    }

    async _getTotalLabsForCourse(courseId) {
        const course = await courseService.getCourseById(courseId);
        if (!course || !course.courseData) return 0;

        let totalLabs = 0;
        if (course.courseData.days) {
            course.courseData.days.forEach(day => {
                if (day.labs) {
                    totalLabs += day.labs.length;
                }
            });
        }
        return totalLabs;
    }

    async _getChapterProgress(userId, courseId) {
        try {
            // Get course structure
            const course = await courseService.getCourseById(courseId);
            if (!course || !course.courseData) {
                return [];
            }

            // Get user progress for this course
            const { data: progress } = await supabaseClient
                .from('user_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('course_id', courseId);

            // Build chapter list from course structure
            const chapters = [];
            if (course.courseData.days) {
                course.courseData.days.forEach(day => {
                    if (day.chapters) {
                        day.chapters.forEach(chapter => {
                            const chapterProgress = progress?.find(p => p.content_id === chapter.id);
                            chapters.push({
                                id: chapter.id,
                                name: chapter.title || chapter.name || 'Untitled Chapter',
                                completed: chapterProgress?.completed || false,
                                completedAt: chapterProgress?.completed_at || null,
                                timeSpent: chapterProgress?.time_spent || 0,
                                lastAccessed: chapterProgress?.last_accessed_at || null
                            });
                        });
                    }
                });
            }

            return chapters;
        } catch (error) {
            console.error('[ReportService] Error getting chapter progress:', error);
            return [];
        }
    }

    async _getLabPerformance(userId, courseId) {
        try {
            const { data: submissions } = await supabaseClient
                .from('lab_submissions')
                .select('*')
                .eq('user_id', userId)
                .eq('course_id', courseId)
                .order('submitted_at', { ascending: false });

            // Get course structure to get lab names
            const course = await courseService.getCourseById(courseId);
            const labMap = {};
            if (course?.courseData?.days) {
                course.courseData.days.forEach(day => {
                    if (day.labs) {
                        day.labs.forEach(lab => {
                            labMap[lab.id] = lab.title || lab.name || 'Untitled Lab';
                        });
                    }
                });
            }

            // Group submissions by lab_id (get latest submission for each lab)
            const labPerformanceMap = {};
            (submissions || []).forEach(submission => {
                const labId = submission.lab_id;
                if (!labPerformanceMap[labId] || 
                    new Date(submission.submitted_at) > new Date(labPerformanceMap[labId].submittedAt)) {
                    labPerformanceMap[labId] = {
                        id: labId,
                        name: labMap[labId] || labId,
                        status: submission.status || 'submitted',
                        submittedAt: submission.submitted_at,
                        score: submission.score ? parseFloat(submission.score) : null,
                        feedback: submission.feedback || submission.trainer_feedback || null,
                        resubmissionCount: submission.resubmission_count || 0
                    };
                }
            });

            return Object.values(labPerformanceMap);
        } catch (error) {
            console.error('[ReportService] Error getting lab performance:', error);
            return [];
        }
    }

    async _getActivityTimeline(userId, courseId, dateRange) {
        try {
            const timeline = [];

            // Get chapter completions
            const { data: progress } = await supabaseClient
                .from('user_progress')
                .select('content_id, completed_at, course_id')
                .eq('user_id', userId)
                .eq('completed', true)
                .not('completed_at', 'is', null);

            if (courseId) {
                progress?.forEach(p => {
                    if (p.course_id === courseId && p.completed_at) {
                        timeline.push({
                            date: p.completed_at,
                            type: 'chapter_completed',
                            description: `Completed chapter: ${p.content_id}`
                        });
                    }
                });
            } else {
                progress?.forEach(p => {
                    if (p.completed_at) {
                        timeline.push({
                            date: p.completed_at,
                            type: 'chapter_completed',
                            description: `Completed chapter: ${p.content_id}`
                        });
                    }
                });
            }

            // Get lab submissions
            let labQuery = supabaseClient
                .from('lab_submissions')
                .select('lab_id, submitted_at, course_id, status')
                .eq('user_id', userId);

            if (courseId) {
                labQuery = labQuery.eq('course_id', courseId);
            }

            const { data: labs } = await labQuery;

            labs?.forEach(lab => {
                timeline.push({
                    date: lab.submitted_at,
                    type: 'lab_submitted',
                    description: `Submitted lab: ${lab.lab_id}`
                });

                if (lab.status === 'approved' || lab.status === 'reviewed') {
                    timeline.push({
                        date: lab.submitted_at, // Use submitted_at as placeholder
                        type: 'lab_approved',
                        description: `Lab ${lab.lab_id} approved`
                    });
                }
            });

            // Sort by date (newest first)
            timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Apply date range filter if provided
            if (dateRange?.from || dateRange?.to) {
                return timeline.filter(item => {
                    const itemDate = new Date(item.date);
                    if (dateRange.from && itemDate < new Date(dateRange.from)) return false;
                    if (dateRange.to && itemDate > new Date(dateRange.to)) return false;
                    return true;
                });
            }

            return timeline.slice(0, 50); // Limit to 50 most recent
        } catch (error) {
            console.error('[ReportService] Error getting activity timeline:', error);
            return [];
        }
    }

    async _calculateAverageTimePerChapter(userId, courseId) {
        try {
            const { data: progress } = await supabaseClient
                .from('user_progress')
                .select('time_spent')
                .eq('user_id', userId)
                .eq('course_id', courseId)
                .not('time_spent', 'is', null);

            if (!progress || progress.length === 0) {
                return 0;
            }

            const totalSeconds = progress.reduce((sum, p) => sum + (p.time_spent || 0), 0);
            const avgSeconds = totalSeconds / progress.length;
            return Math.round(avgSeconds / 60); // Return in minutes
        } catch (error) {
            console.error('[ReportService] Error calculating average time per chapter:', error);
            return 0;
        }
    }

    async _calculateAverageTimePerLab(userId, courseId) {
        // Lab time tracking would need to be implemented separately
        // For now, return 0 as placeholder
        return 0;
    }

    _estimateCompletionDate(progress, allocatedAt) {
        if (!allocatedAt || progress === 0) return null;
        // Simple estimation based on current progress
        const daysSinceStart = (Date.now() - new Date(allocatedAt)) / (1000 * 60 * 60 * 24);
        const estimatedDays = (daysSinceStart / progress) * 100;
        const estimatedDate = new Date(Date.now() + (estimatedDays - daysSinceStart) * 24 * 60 * 60 * 1000);
        return estimatedDate.toISOString();
    }

    async _getLearnerCoursePerformance(learnerId) {
        try {
            // Get course allocations
            const { data: allocations } = await supabaseClient
                .from('course_allocations')
                .select('course_id, allocated_at')
                .eq('user_id', learnerId)
                .eq('status', 'active');

            if (!allocations || allocations.length === 0) {
                return [];
            }

            const courseIds = allocations.map(a => a.course_id);
            const coursePerformance = [];

            for (const allocation of allocations) {
                const courseId = allocation.course_id;
                const course = await courseService.getCourseById(courseId);
                if (!course) continue;

                const progress = await analyticsService.calculateCourseProgress(learnerId, courseId);
                const labs = await supabaseClient
                    .from('lab_submissions')
                    .select('*')
                    .eq('user_id', learnerId)
                    .eq('course_id', courseId);

                const { data: progressData } = await supabaseClient
                    .from('user_progress')
                    .select('last_accessed_at')
                    .eq('user_id', learnerId)
                    .eq('course_id', courseId)
                    .order('last_accessed_at', { ascending: false })
                    .limit(1);

                // Get chapter progress to count completed chapters
                const chapterProgress = await this._getChapterProgress(learnerId, courseId);
                const chaptersCompleted = chapterProgress.filter(ch => ch.completed).length;

                coursePerformance.push({
                    id: courseId,
                    name: course.title,
                    progress,
                    status: progress === 0 ? 'not_started' : progress >= 100 ? 'completed' : 'in_progress',
                    timeSpent: await this._getTimeSpent(learnerId, courseId),
                    chaptersCompleted: chaptersCompleted,
                    labsSubmitted: labs.data?.length || 0,
                    totalLabs: await this._getTotalLabsForCourse(courseId),
                    averageScore: await analyticsService.calculateAverageLabScore(learnerId, courseId) || 0,
                    lastActivityDate: progressData?.[0]?.last_accessed_at || null
                });
            }

            return coursePerformance;
        } catch (error) {
            console.error('[ReportService] Error getting learner course performance:', error);
            return [];
        }
    }

    async _getLabEvaluationSummary(learnerId, trainerId) {
        try {
            // Get all lab submissions for this learner
            const { data: submissions } = await supabaseClient
                .from('lab_submissions')
                .select('*')
                .eq('user_id', learnerId);

            if (!submissions || submissions.length === 0) {
                return {
                    totalLabsSubmitted: 0,
                    labsPendingReview: 0,
                    labsApproved: 0,
                    labsNeedingRevision: 0,
                    averageScore: null,
                    avgResponseTime: null
                };
            }

            // Filter submissions that this trainer should review (submitted by learners assigned to this trainer)
            // For now, we'll get all submissions and calculate response time for reviewed ones
            const totalLabsSubmitted = submissions.length;
            const labsPendingReview = submissions.filter(s => s.status === 'submitted').length;
            const labsApproved = submissions.filter(s => s.status === 'approved' || s.status === 'reviewed').length;
            const labsNeedingRevision = submissions.filter(s => s.status === 'needs_revision').length;

            // Calculate average score
            const scoredLabs = submissions.filter(s => s.score !== null && s.score !== undefined);
            const averageScore = scoredLabs.length > 0
                ? scoredLabs.reduce((sum, s) => sum + parseFloat(s.score), 0) / scoredLabs.length
                : null;

            // Calculate average response time (for labs reviewed by this trainer)
            const reviewedLabs = submissions.filter(s => 
                s.reviewed_by === trainerId && 
                s.reviewed_at && 
                s.submitted_at
            );

            let avgResponseTime = null;
            if (reviewedLabs.length > 0) {
                const responseTimes = reviewedLabs.map(lab => {
                    const submitted = new Date(lab.submitted_at);
                    const reviewed = new Date(lab.reviewed_at);
                    return (reviewed - submitted) / (1000 * 60 * 60); // Convert to hours
                });
                avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            }

            return {
                totalLabsSubmitted,
                labsPendingReview,
                labsApproved,
                labsNeedingRevision,
                averageScore: averageScore ? Math.round(averageScore * 100) / 100 : null,
                avgResponseTime: avgResponseTime ? Math.round(avgResponseTime * 100) / 100 : null
            };
        } catch (error) {
            console.error('[ReportService] Error getting lab evaluation summary:', error);
            return {
                totalLabsSubmitted: 0,
                labsPendingReview: 0,
                labsApproved: 0,
                labsNeedingRevision: 0,
                averageScore: null,
                avgResponseTime: null
            };
        }
    }

    async _getActiveUsers(dateRange) {
        try {
            // Default to last 30 days if no date range provided
            const now = new Date();
            const fromDate = dateRange?.from 
                ? new Date(dateRange.from) 
                : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            const toDate = dateRange?.to ? new Date(dateRange.to) : now;

            const activeUserIds = new Set();

            // 1. Get users with activity in user_progress (last_accessed_at or completed_at)
            const { data: progressData } = await supabaseClient
                .from('user_progress')
                .select('user_id, last_accessed_at, completed_at')
                .or('last_accessed_at.not.is.null,completed_at.not.is.null');

            if (progressData && progressData.length > 0) {
                progressData.forEach(p => {
                    const lastAccessed = p.last_accessed_at ? new Date(p.last_accessed_at) : null;
                    const completed = p.completed_at ? new Date(p.completed_at) : null;
                    
                    if (lastAccessed && lastAccessed >= fromDate && lastAccessed <= toDate) {
                        activeUserIds.add(p.user_id);
                    }
                    if (completed && completed >= fromDate && completed <= toDate) {
                        activeUserIds.add(p.user_id);
                    }
                });
            }

            // 2. Get users with activity in lab_submissions (submitted_at or reviewed_at)
            const { data: labData } = await supabaseClient
                .from('lab_submissions')
                .select('user_id, submitted_at, reviewed_at')
                .or('submitted_at.not.is.null,reviewed_at.not.is.null');

            if (labData && labData.length > 0) {
                labData.forEach(l => {
                    const submitted = l.submitted_at ? new Date(l.submitted_at) : null;
                    const reviewed = l.reviewed_at ? new Date(l.reviewed_at) : null;
                    
                    if (submitted && submitted >= fromDate && submitted <= toDate) {
                        activeUserIds.add(l.user_id);
                    }
                    if (reviewed && reviewed >= fromDate && reviewed <= toDate) {
                        activeUserIds.add(l.user_id);
                    }
                });
            }

            return activeUserIds.size;
        } catch (error) {
            console.error('[ReportService] Error getting active users:', error);
            return 0;
        }
    }

    async _calculateSystemCompletionRate() {
        return 0;
    }

    async _calculateSystemAverageLabScore() {
        return 0;
    }

    async _getSystemTrends(dateRange) {
        return {};
    }

    async _getQuickInsights() {
        return [];
    }

    // ============================================================================
    // EXPORT METHODS
    // ============================================================================

    /**
     * Export report data
     * @param {string} reportType - Type of report
     * @param {Object} reportData - Report data to export
     * @param {string} format - Export format ('csv' or 'pdf')
     * @returns {Promise<Blob>} Exported file blob
     */
    async exportReport(reportType, reportData, format = 'csv') {
        if (format === 'csv') {
            return this._exportToCSV(reportType, reportData);
        } else if (format === 'pdf') {
            return this._exportToPDF(reportType, reportData);
        }
        throw new Error(`Unsupported export format: ${format}`);
    }

    _exportToCSV(reportType, reportData) {
        // TODO: Implement CSV export
        throw new Error('CSV export not yet implemented');
    }

    _exportToPDF(reportType, reportData) {
        // TODO: Implement PDF export
        throw new Error('PDF export not yet implemented');
    }
}

export const reportService = new ReportService();

