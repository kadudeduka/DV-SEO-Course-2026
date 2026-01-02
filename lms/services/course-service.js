/**
 * Course Service
 * 
 * Handles course data loading and content management.
 */

import { authService } from './auth-service.js';
import { courseAllocationService } from './course-allocation-service.js';

class CourseService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get all published courses
     * For learners: Only returns allocated courses
     * For trainers/admins: Returns all published courses
     * @param {string} userId - Optional user ID to filter by allocations
     * @returns {Promise<Array>} Array of published course objects
     */
    async getCourses(userId = null) {
        const cacheKey = userId ? `courses_${userId}` : 'courses_all';
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { getCourses } = await import('../../data/courses.js');
        const allCourses = await getCourses();
        
        const publishedCourses = allCourses.filter(course => course.published === true);
        
        if (!userId) {
            this.cache.set(cacheKey, publishedCourses);
            return publishedCourses;
        }

        try {
            const currentUser = await authService.getCurrentUser();
            if (!currentUser || !currentUser.id) {
                return [];
            }

            // Trainers and admins have access to ALL courses
            if (currentUser.role === 'trainer' || currentUser.role === 'admin') {
                this.cache.set(cacheKey, publishedCourses);
                return publishedCourses;
            }

            if (currentUser.role === 'learner' && currentUser.id === userId) {
                const allocatedCourses = await courseAllocationService.getAllocatedCourses(userId);
                const allocatedCourseIds = allocatedCourses.map(a => a.course_id);
                const filteredCourses = publishedCourses.filter(course => allocatedCourseIds.includes(course.id));
                this.cache.set(cacheKey, filteredCourses);
                return filteredCourses;
            }

            return [];
        } catch (error) {
            console.warn('Failed to filter courses by allocation:', error);
            return publishedCourses;
        }
    }

    /**
     * Get course by ID
     * @param {string} courseId - Course identifier
     * @returns {Promise<object>} Course object
     */
    async getCourseById(courseId) {
        if (!courseId) {
            throw new Error('Course ID is required');
        }

        const cacheKey = `course_${courseId}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const { getCourseById } = await import('../../data/courses.js');
        const course = await getCourseById(courseId);
        
        if (!course) {
            throw new Error(`Course not found: ${courseId}`);
        }

        if (!course.published) {
            throw new Error(`Course not available: ${courseId}`);
        }

        this.cache.set(cacheKey, course);
        
        return course;
    }

    /**
     * Get course content from file path
     * @param {string} filePath - Path to markdown file
     * @returns {Promise<string>} Markdown content as string
     */
    async getCourseContent(filePath) {
        if (!filePath) {
            throw new Error('File path is required');
        }

        const cacheKey = `content_${filePath}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error(`Failed to load content: ${filePath} (${response.status})`);
            }

            const markdown = await response.text();
            
            this.cache.set(cacheKey, markdown);
            
            return markdown;
        } catch (error) {
            if (error.message.includes('Failed to load')) {
                throw error;
            }
            throw new Error(`Failed to load content: ${filePath} - ${error.message}`);
        }
    }

    /**
     * Get course structure
     * @param {string} courseId - Course identifier
     * @returns {Promise<object>} Course structure (courseData)
     */
    async getCourseStructure(courseId) {
        const course = await this.getCourseById(courseId);
        return course.courseData || null;
    }

    /**
     * Get all published courses (alias for getCourses without userId)
     * @returns {Promise<Array>} Array of all published course objects
     */
    async getAllCourses() {
        return this.getCourses();
    }

    /**
     * Clear cache
     * @param {string} key - Optional cache key to clear specific entry
     */
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }
}

export const courseService = new CourseService();

