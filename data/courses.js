/**
 * Courses Registry
 * Contains all available courses with their metadata
 */

let seoCourseDataCache = null;

/**
 * Transform course structure to required format
 * @param {object} rawCourseData - Raw course data from structure.js
 * @returns {object} Transformed course data
 */
function transformCourseData(rawCourseData) {
    if (!rawCourseData) {
        return { days: [] };
    }

    const transformedDays = rawCourseData.days ? rawCourseData.days.map(day => {
        const transformedDay = {
            dayNumber: day.day,
            title: day.title,
            chapters: [],
            labs: []
        };

        if (day.chapters && Array.isArray(day.chapters)) {
            transformedDay.chapters = day.chapters.map(chapter => ({
                id: chapter.id,
                title: chapter.title,
                file: chapter.file
            }));
        }

        if (day.labs && Array.isArray(day.labs)) {
            transformedDay.labs = day.labs.map(lab => ({
                id: lab.id,
                title: lab.title,
                description: lab.description || '',
                file: lab.file
            }));
        }

        return transformedDay;
    }) : [];

    const transformedCourseData = {
        days: transformedDays
    };

    if (rawCourseData.trainerContent && Array.isArray(rawCourseData.trainerContent)) {
        transformedCourseData.trainerContent = rawCourseData.trainerContent.map(item => ({
            id: item.id,
            title: item.title,
            file: item.file,
            requiresRole: item.requiresRole || 'trainer'
        }));
    }

    return transformedCourseData;
}

/**
 * Get SEO course data (lazy loaded and cached)
 * @returns {Promise<object>} Transformed course data
 */
async function getSEOCourseData() {
    if (!seoCourseDataCache) {
        const module = await import('./courses/seo-master-2026/structure.js');
        const rawData = module.courseData;
        seoCourseDataCache = transformCourseData(rawData);
    }
    return seoCourseDataCache;
}

/**
 * Get all courses
 * @returns {Promise<Array>} Array of course objects
 */
export async function getCourses() {
    const courseData = await getSEOCourseData();
    
    // Load JSON file using fetch instead of import (browsers don't support JSON imports)
    // Path is relative to the HTML file location (root of the project)
    try {
        const response = await fetch('/data/courses/seo-master-2026/course.json');
        if (!response.ok) {
            throw new Error(`Failed to load course metadata: ${response.status} ${response.statusText}`);
        }
        const courseMetadata = await response.json();
        
        const course = {
            id: courseMetadata.id,
            title: courseMetadata.title,
            subtitle: courseMetadata.subtitle || '',
            description: courseMetadata.description,
            brief: courseMetadata.brief || courseMetadata.description,
            thumbnail: courseMetadata.thumbnail || '',
            instructor: courseMetadata.instructor || 'Digital Vidya',
            duration: courseMetadata.duration || '',
            level: courseMetadata.level || '',
            totalDays: courseMetadata.totalDays || 0,
            totalChapters: courseMetadata.totalChapters || 0,
            totalLabs: courseMetadata.totalLabs || 0,
            totalTools: courseMetadata.totalTools || 0,
            category: courseMetadata.category || '',
            tags: courseMetadata.tags || [],
            published: courseMetadata.published === true,
            createdAt: courseMetadata.createdAt || new Date().toISOString(),
            courseData: courseData
        };

        return [course];
    } catch (error) {
        console.error('Error loading course metadata:', error);
        // Fallback: create course from structure data if JSON fails
        const course = {
            id: 'seo-master-2026',
            title: 'SEO Master Course 2026',
            subtitle: 'Comprehensive SEO Training Program',
            description: 'Master the art and science of Search Engine Optimization with this comprehensive course.',
            brief: 'A complete SEO training program covering fundamentals, technical SEO, content strategy, and advanced optimization techniques.',
            thumbnail: 'https://via.placeholder.com/400x300?text=SEO+Master+Course',
            instructor: 'Digital Vidya',
            duration: '20 Days',
            level: 'Intermediate to Advanced',
            totalDays: courseData?.days?.length || 20,
            totalChapters: courseData?.days?.reduce((sum, day) => sum + (day.chapters?.length || 0), 0) || 36,
            totalLabs: courseData?.days?.reduce((sum, day) => sum + (day.labs?.length || 0), 0) || 40,
            totalTools: 6,
            category: 'Digital Marketing',
            tags: ['SEO', 'Digital Marketing', 'Search Engine Optimization'],
            published: true,
            createdAt: new Date().toISOString(),
            courseData: courseData
        };
        return [course];
    }
}

/**
 * Get course by ID
 * @param {string} courseId - Course identifier
 * @returns {Promise<object|null>} Course object or null if not found
 */
export async function getCourseById(courseId) {
    if (!courseId) {
        return null;
    }

    const courses = await getCourses();
    return courses.find(course => course.id === courseId) || null;
}
