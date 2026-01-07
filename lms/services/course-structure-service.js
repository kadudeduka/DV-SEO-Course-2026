/**
 * Course Structure Service
 * 
 * Provides course structure information for structural queries.
 * Handles questions like "How many chapters are there?", "What chapters are in Day 5?"
 */

import { supabaseClient } from './supabase-client.js';

class CourseStructureService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Get total number of chapters in a course
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Total number of chapters
     */
    async getTotalChapters(courseId) {
        const cacheKey = `total_chapters_${courseId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const { data, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id', { count: 'exact' })
                .eq('course_id', courseId)
                .eq('container_type', 'chapter')
                .eq('is_valid', true);

            if (error) {
                console.error('[CourseStructureService] Error getting total chapters:', error);
                return null;
            }

            // Count unique chapters
            const uniqueChapters = new Set();
            if (data) {
                data.forEach(item => {
                    if (item.container_id) {
                        uniqueChapters.add(item.container_id);
                    }
                });
            }

            const count = uniqueChapters.size;
            this.cache.set(cacheKey, count);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return count;
        } catch (error) {
            console.error('[CourseStructureService] Error getting total chapters:', error);
            return null;
        }
    }

    /**
     * Get total number of labs in a course
     * @param {string} courseId - Course ID
     * @returns {Promise<number>} Total number of labs
     */
    async getTotalLabs(courseId) {
        const cacheKey = `total_labs_${courseId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const { data, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id', { count: 'exact' })
                .eq('course_id', courseId)
                .eq('container_type', 'lab')
                .eq('is_valid', true);

            if (error) {
                console.error('[CourseStructureService] Error getting total labs:', error);
                return null;
            }

            // Count unique labs
            const uniqueLabs = new Set();
            if (data) {
                data.forEach(item => {
                    if (item.container_id) {
                        uniqueLabs.add(item.container_id);
                    }
                });
            }

            const count = uniqueLabs.size;
            this.cache.set(cacheKey, count);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return count;
        } catch (error) {
            console.error('[CourseStructureService] Error getting total labs:', error);
            return null;
        }
    }

    /**
     * Get chapters for a specific day
     * @param {string} courseId - Course ID
     * @param {number} day - Day number
     * @returns {Promise<Array<Object>>} Array of chapter objects
     */
    async getChaptersByDay(courseId, day) {
        const cacheKey = `chapters_day_${courseId}_${day}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const { data, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id, container_title, container_type, day')
                .eq('course_id', courseId)
                .eq('day', day)
                .eq('container_type', 'chapter')
                .eq('is_valid', true)
                .order('sequence_number', { ascending: true });

            if (error) {
                console.error('[CourseStructureService] Error getting chapters by day:', error);
                return [];
            }

            // Deduplicate by container_id
            const uniqueChapters = [];
            const seen = new Set();
            if (data) {
                data.forEach(item => {
                    if (item.container_id && !seen.has(item.container_id)) {
                        seen.add(item.container_id);
                        uniqueChapters.push({
                            container_id: item.container_id,
                            container_title: item.container_title,
                            day: item.day
                        });
                    }
                });
            }

            this.cache.set(cacheKey, uniqueChapters);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return uniqueChapters;
        } catch (error) {
            console.error('[CourseStructureService] Error getting chapters by day:', error);
            return [];
        }
    }

    /**
     * Get labs for a specific day
     * @param {string} courseId - Course ID
     * @param {number} day - Day number
     * @returns {Promise<Array<Object>>} Array of lab objects
     */
    async getLabsByDay(courseId, day) {
        const cacheKey = `labs_day_${courseId}_${day}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const { data, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('container_id, container_title, container_type, day')
                .eq('course_id', courseId)
                .eq('day', day)
                .eq('container_type', 'lab')
                .eq('is_valid', true)
                .order('sequence_number', { ascending: true });

            if (error) {
                console.error('[CourseStructureService] Error getting labs by day:', error);
                return [];
            }

            // Deduplicate by container_id
            const uniqueLabs = [];
            const seen = new Set();
            if (data) {
                data.forEach(item => {
                    if (item.container_id && !seen.has(item.container_id)) {
                        seen.add(item.container_id);
                        uniqueLabs.push({
                            container_id: item.container_id,
                            container_title: item.container_title,
                            day: item.day
                        });
                    }
                });
            }

            this.cache.set(cacheKey, uniqueLabs);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return uniqueLabs;
        } catch (error) {
            console.error('[CourseStructureService] Error getting labs by day:', error);
            return [];
        }
    }

    /**
     * Get course structure overview
     * @param {string} courseId - Course ID
     * @returns {Promise<Object>} Course structure overview
     */
    async getCourseStructure(courseId) {
        const cacheKey = `course_structure_${courseId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Get all unique days from the registry
            // Query without limit to ensure we get all days
            const { data: daysData, error: daysError } = await supabaseClient
                .from('canonical_reference_registry')
                .select('day, container_type')
                .eq('course_id', courseId)
                .eq('is_valid', true)
                .not('day', 'is', null);

            if (daysError) {
                console.error('[CourseStructureService] Error getting course structure:', daysError);
                return null;
            }

            // Extract all day numbers and get unique sorted list
            // Also check content_nodes table as a fallback to ensure we get all days
            const allDays = (daysData || [])
                .map(d => d.day)
                .filter(d => d !== null && d !== undefined && typeof d === 'number');
            
            // Also check content_nodes table to ensure we don't miss any days
            const { data: nodesData } = await supabaseClient
                .from('content_nodes')
                .select('day')
                .eq('course_id', courseId)
                .eq('is_valid', true)
                .not('day', 'is', null);
            
            if (nodesData) {
                const nodeDays = nodesData
                    .map(n => n.day)
                    .filter(d => d !== null && d !== undefined && typeof d === 'number');
                allDays.push(...nodeDays);
            }
            
            // Get unique sorted days
            const uniqueDays = [...new Set(allDays)].sort((a, b) => a - b);
            
            // Debug: log to see what days we found
            console.log('[CourseStructureService] Found days:', uniqueDays);
            
            const structure = {
                total_days: uniqueDays.length,
                total_chapters: await this.getTotalChapters(courseId),
                total_labs: await this.getTotalLabs(courseId),
                days: []
            };

            // Get structure for each day that exists in the registry
            for (const day of uniqueDays) {
                const chapters = await this.getChaptersByDay(courseId, day);
                const labs = await this.getLabsByDay(courseId, day);
                
                structure.days.push({
                    day: day,
                    chapters: chapters,
                    labs: labs,
                    chapter_count: chapters.length,
                    lab_count: labs.length
                });
            }
            
            // Debug: log the structure
            console.log('[CourseStructureService] Structure days:', structure.days.map(d => d.day));

            this.cache.set(cacheKey, structure);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

            return structure;
        } catch (error) {
            console.error('[CourseStructureService] Error getting course structure:', error);
            return null;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export const courseStructureService = new CourseStructureService();

