/**
 * Course Planning Service
 * 
 * Provides time estimates and planning guidance for planning queries.
 * Handles questions like "How much time for chapter 2?", "How long is the entire course?"
 */

import { supabaseClient } from './supabase-client.js';
import { courseStructureService } from './course-structure-service.js';

class CoursePlanningService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
        
        // Default time estimates (in minutes)
        this.defaultEstimates = {
            chapter: {
                reading: 45,
                exercises: 30,
                quiz: 10,
                total: 90
            },
            lab: {
                completion: 90,
                review: 15,
                total: 105
            }
        };
    }

    /**
     * Get time estimate for a specific chapter
     * @param {string} courseId - Course ID
     * @param {number} chapterNumber - Chapter number
     * @returns {Promise<Object>} Time estimate object
     */
    async getTimeEstimate(courseId, chapterNumber) {
        const cacheKey = `time_estimate_${courseId}_ch${chapterNumber}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Find the chapter
            const { data: chapterData, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id, container_title, day')
                .eq('course_id', courseId)
                .or(`container_id.ilike.%ch${chapterNumber}%,container_id.ilike.%chapter${chapterNumber}%`)
                .eq('container_type', 'chapter')
                .eq('is_valid', true)
                .limit(1)
                .maybeSingle();

            if (error || !chapterData) {
                console.warn('[CoursePlanningService] Chapter not found:', chapterNumber);
                // Return default estimate
                return {
                    chapter_number: chapterNumber,
                    chapter_title: null,
                    estimates: {
                        reading: this.defaultEstimates.chapter.reading,
                        exercises: this.defaultEstimates.chapter.exercises,
                        quiz: this.defaultEstimates.chapter.quiz,
                        total: this.defaultEstimates.chapter.total
                    },
                    note: 'Estimated time based on average chapter length'
                };
            }

            // Count content nodes in this chapter to estimate complexity
            const { data: nodesData } = await supabaseClient
                .from('content_nodes')
                .select('node_id')
                .eq('course_id', courseId)
                .eq('container_id', chapterData.container_id)
                .eq('is_valid', true);

            const nodeCount = nodesData ? nodesData.length : 0;
            
            // Adjust estimates based on content volume
            // More nodes = more reading time
            const readingTime = Math.max(30, Math.min(90, this.defaultEstimates.chapter.reading + (nodeCount * 2)));
            const totalTime = readingTime + this.defaultEstimates.chapter.exercises + this.defaultEstimates.chapter.quiz;

            const estimate = {
                chapter_number: chapterNumber,
                chapter_title: chapterData.container_title,
                day: chapterData.day,
                estimates: {
                    reading: readingTime,
                    exercises: this.defaultEstimates.chapter.exercises,
                    quiz: this.defaultEstimates.chapter.quiz,
                    total: totalTime
                },
                content_volume: nodeCount,
                note: nodeCount > 20 
                    ? 'This chapter has substantial content. Plan extra time for thorough understanding.'
                    : 'Standard chapter length.'
            };

            this.cache.set(cacheKey, estimate);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return estimate;
        } catch (error) {
            console.error('[CoursePlanningService] Error getting time estimate:', error);
            // Return default estimate
            return {
                chapter_number: chapterNumber,
                chapter_title: null,
                estimates: {
                    reading: this.defaultEstimates.chapter.reading,
                    exercises: this.defaultEstimates.chapter.exercises,
                    quiz: this.defaultEstimates.chapter.quiz,
                    total: this.defaultEstimates.chapter.total
                },
                note: 'Estimated time based on average chapter length'
            };
        }
    }

    /**
     * Get time estimate for a specific lab
     * @param {string} courseId - Course ID
     * @param {number} labNumber - Lab number
     * @returns {Promise<Object>} Time estimate object
     */
    async getLabTimeEstimate(courseId, labNumber) {
        const cacheKey = `lab_time_estimate_${courseId}_lab${labNumber}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Find the lab
            const { data: labData, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id, container_title, day')
                .eq('course_id', courseId)
                .or(`container_id.ilike.%lab${labNumber}%,container_id.ilike.%lab${labNumber}%`)
                .eq('container_type', 'lab')
                .eq('is_valid', true)
                .limit(1)
                .maybeSingle();

            if (error || !labData) {
                console.warn('[CoursePlanningService] Lab not found:', labNumber);
                return {
                    lab_number: labNumber,
                    lab_title: null,
                    estimates: {
                        completion: this.defaultEstimates.lab.completion,
                        review: this.defaultEstimates.lab.review,
                        total: this.defaultEstimates.lab.total
                    },
                    note: 'Estimated time based on average lab length'
                };
            }

            const estimate = {
                lab_number: labNumber,
                lab_title: labData.container_title,
                day: labData.day,
                estimates: {
                    completion: this.defaultEstimates.lab.completion,
                    review: this.defaultEstimates.lab.review,
                    total: this.defaultEstimates.lab.total
                },
                note: 'Labs typically require hands-on practice. Allow extra time if you encounter issues.'
            };

            this.cache.set(cacheKey, estimate);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return estimate;
        } catch (error) {
            console.error('[CoursePlanningService] Error getting lab time estimate:', error);
            return {
                lab_number: labNumber,
                lab_title: null,
                estimates: {
                    completion: this.defaultEstimates.lab.completion,
                    review: this.defaultEstimates.lab.review,
                    total: this.defaultEstimates.lab.total
                },
                note: 'Estimated time based on average lab length'
            };
        }
    }

    /**
     * Get course duration estimate
     * @param {string} courseId - Course ID
     * @returns {Promise<Object>} Course duration object
     */
    async getCourseDuration(courseId) {
        const cacheKey = `course_duration_${courseId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const structure = await courseStructureService.getCourseStructure(courseId);
            if (!structure) {
                return null;
            }

            // Calculate total time
            let totalChapterTime = 0;
            let totalLabTime = 0;

            for (const day of structure.days) {
                // Estimate time for each chapter in this day
                for (const chapter of day.chapters) {
                    const chapterNum = this._extractNumber(chapter.container_id);
                    if (chapterNum) {
                        const estimate = await this.getTimeEstimate(courseId, chapterNum);
                        totalChapterTime += estimate.estimates.total;
                    }
                }

                // Estimate time for each lab in this day
                for (const lab of day.labs) {
                    const labNum = this._extractNumber(lab.container_id);
                    if (labNum) {
                        const estimate = await this.getLabTimeEstimate(courseId, labNum);
                        totalLabTime += estimate.estimates.total;
                    }
                }
            }

            // If we couldn't calculate, use defaults
            if (totalChapterTime === 0) {
                totalChapterTime = (structure.total_chapters || 0) * this.defaultEstimates.chapter.total;
            }
            if (totalLabTime === 0) {
                totalLabTime = (structure.total_labs || 0) * this.defaultEstimates.lab.total;
            }

            const totalMinutes = totalChapterTime + totalLabTime;
            const totalHours = Math.round(totalMinutes / 60);

            const duration = {
                total_minutes: totalMinutes,
                total_hours: totalHours,
                chapter_time_minutes: totalChapterTime,
                lab_time_minutes: totalLabTime,
                total_chapters: structure.total_chapters,
                total_labs: structure.total_labs,
                total_days: structure.total_days,
                schedules: {
                    full_time: {
                        hours_per_day: 8,
                        days: Math.ceil(totalHours / 8),
                        description: 'Full-time (8 hours/day)'
                    },
                    part_time: {
                        hours_per_day: 4,
                        days: Math.ceil(totalHours / 4),
                        description: 'Part-time (4 hours/day)'
                    },
                    weekend_only: {
                        hours_per_weekend: 8,
                        weeks: Math.ceil(totalHours / 8),
                        description: 'Weekend only (8 hours/weekend)'
                    }
                }
            };

            this.cache.set(cacheKey, duration);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return duration;
        } catch (error) {
            console.error('[CoursePlanningService] Error getting course duration:', error);
            return null;
        }
    }

    /**
     * Extract number from container_id (e.g., "day20-ch1" -> 1)
     * @param {string} containerId - Container ID
     * @returns {number|null} Extracted number
     * @private
     */
    _extractNumber(containerId) {
        if (!containerId) return null;
        
        // Try patterns: day20-ch1, ch1, chapter1, lab2, etc.
        const match = containerId.match(/(?:ch|chapter|lab)(\d+)/i);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export const coursePlanningService = new CoursePlanningService();

