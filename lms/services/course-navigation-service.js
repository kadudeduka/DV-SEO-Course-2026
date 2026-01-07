/**
 * Course Navigation Service
 * 
 * Provides navigation advice for navigation queries.
 * Handles questions like "Can I skip chapter 2?", "What should I study before chapter 10?"
 */

import { supabaseClient } from './supabase-client.js';
import { courseStructureService } from './course-structure-service.js';

class CourseNavigationService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Get prerequisites for a chapter
     * @param {string} courseId - Course ID
     * @param {number} chapterNumber - Chapter number (extracted from container_id)
     * @returns {Promise<Array<Object>>} Array of prerequisite chapters
     */
    async getPrerequisites(courseId, chapterNumber) {
        const cacheKey = `prerequisites_${courseId}_ch${chapterNumber}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Find the chapter by number
            const chapterId = `day${chapterNumber}-ch${chapterNumber}`;
            const { data: chapterData, error: chapterError } = await supabaseClient
                .from('canonical_reference_registry')
                .select('day, container_id, container_title')
                .eq('course_id', courseId)
                .or(`container_id.ilike.%ch${chapterNumber}%,container_id.ilike.%chapter${chapterNumber}%`)
                .eq('container_type', 'chapter')
                .eq('is_valid', true)
                .limit(1)
                .maybeSingle();

            if (chapterError || !chapterData) {
                console.warn('[CourseNavigationService] Chapter not found:', chapterNumber);
                return [];
            }

            const chapterDay = chapterData.day;

            // Prerequisites are typically chapters from previous days
            // Get all chapters from days before this chapter's day
            const { data: prereqData, error: prereqError } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id, container_title, day')
                .eq('course_id', courseId)
                .eq('container_type', 'chapter')
                .lt('day', chapterDay)
                .eq('is_valid', true)
                .order('day', { ascending: true })
                .order('sequence_number', { ascending: true });

            if (prereqError) {
                console.error('[CourseNavigationService] Error getting prerequisites:', prereqError);
                return [];
            }

            // Deduplicate and format
            const prerequisites = [];
            const seen = new Set();
            if (prereqData) {
                prereqData.forEach(item => {
                    if (item.container_id && !seen.has(item.container_id)) {
                        seen.add(item.container_id);
                        prerequisites.push({
                            container_id: item.container_id,
                            container_title: item.container_title,
                            day: item.day
                        });
                    }
                });
            }

            this.cache.set(cacheKey, prerequisites);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return prerequisites;
        } catch (error) {
            console.error('[CourseNavigationService] Error getting prerequisites:', error);
            return [];
        }
    }

    /**
     * Check if a chapter can be skipped
     * @param {string} courseId - Course ID
     * @param {number} chapterNumber - Chapter number
     * @returns {Promise<Object>} Skip advice object
     */
    async canSkipChapter(courseId, chapterNumber) {
        const prerequisites = await this.getPrerequisites(courseId, chapterNumber);
        
        // Find the chapter
        const { data: chapterData } = await supabaseClient
            .from('canonical_reference_registry')
            .select('container_id, container_title, day')
            .eq('course_id', courseId)
            .or(`container_id.ilike.%ch${chapterNumber}%,container_id.ilike.%chapter${chapterNumber}%`)
            .eq('container_type', 'chapter')
            .eq('is_valid', true)
            .limit(1)
            .maybeSingle();

        if (!chapterData) {
            return {
                can_skip: false,
                reason: 'Chapter not found',
                prerequisites: [],
                recommendation: 'Please verify the chapter number.'
            };
        }

        // Check if this chapter is a prerequisite for later chapters
        const chapterDay = chapterData.day;
        const { data: dependentChapters } = await supabaseClient
            .from('canonical_reference_registry')
            .select('container_id, container_title, day')
            .eq('course_id', courseId)
            .eq('container_type', 'chapter')
            .gt('day', chapterDay)
            .eq('is_valid', true)
            .limit(5);

        const hasDependents = dependentChapters && dependentChapters.length > 0;

        return {
            can_skip: prerequisites.length === 0 && !hasDependents,
            reason: hasDependents 
                ? `This chapter provides foundational knowledge needed for later chapters.`
                : prerequisites.length > 0
                    ? `This chapter builds on previous chapters.`
                    : `This chapter appears to be standalone.`,
            prerequisites: prerequisites,
            dependent_chapters: dependentChapters || [],
            recommendation: hasDependents || prerequisites.length > 0
                ? 'I recommend completing this chapter before moving forward, as it provides foundational knowledge needed for later chapters.'
                : 'You can review the chapter summary and take the quiz to verify your understanding before proceeding.'
        };
    }

    /**
     * Get learning path (sequence of chapters)
     * @param {string} courseId - Course ID
     * @param {number} fromChapter - Starting chapter number (optional)
     * @param {number} toChapter - Ending chapter number (optional)
     * @returns {Promise<Array<Object>>} Learning path
     */
    async getLearningPath(courseId, fromChapter = null, toChapter = null) {
        try {
            const { data, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id, container_title, day, sequence_number')
                .eq('course_id', courseId)
                .eq('container_type', 'chapter')
                .eq('is_valid', true)
                .order('day', { ascending: true })
                .order('sequence_number', { ascending: true });

            if (error) {
                console.error('[CourseNavigationService] Error getting learning path:', error);
                return [];
            }

            // Deduplicate
            const path = [];
            const seen = new Set();
            if (data) {
                data.forEach(item => {
                    if (item.container_id && !seen.has(item.container_id)) {
                        seen.add(item.container_id);
                        path.push({
                            container_id: item.container_id,
                            container_title: item.container_title,
                            day: item.day,
                            sequence_number: item.sequence_number
                        });
                    }
                });
            }

            // Filter if from/to specified
            if (fromChapter !== null || toChapter !== null) {
                return path.filter((item, index) => {
                    if (fromChapter !== null && index < fromChapter - 1) return false;
                    if (toChapter !== null && index >= toChapter) return false;
                    return true;
                });
            }

            return path;
        } catch (error) {
            console.error('[CourseNavigationService] Error getting learning path:', error);
            return [];
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export const courseNavigationService = new CourseNavigationService();

