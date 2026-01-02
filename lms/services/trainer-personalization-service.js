/**
 * Trainer Personalization Service
 * 
 * Handles fetching and managing trainer personalization settings for AI Coach.
 * Provides personalized coach names, trainer info, and system prompts.
 */

import { supabaseClient } from './supabase-client.js';

class TrainerPersonalizationService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get trainer personalization for a course
     * @param {string} courseId - Course identifier
     * @param {string} learnerId - Optional learner ID to get their specific trainer
     * @returns {Promise<Object|null>} Personalization object or null
     */
    async getPersonalizationForCourse(courseId, learnerId = null) {
        if (!courseId) {
            console.warn('[TrainerPersonalization] No courseId provided');
            return null;
        }

        // If learnerId is provided, verify it's actually a learner (not a trainer/admin)
        if (learnerId) {
            try {
                const { data: user, error: userError } = await supabaseClient
                    .from('users')
                    .select('role')
                    .eq('id', learnerId)
                    .single();

                // Only proceed if user is a learner, otherwise return null
                if (!userError && user && user.role !== 'learner') {
                    console.warn(`[TrainerPersonalization] User ${learnerId} is not a learner (role: ${user.role})`);
                    return null;
                }
            } catch (error) {
                console.warn('[TrainerPersonalization] Error checking user role:', error);
                // Continue if we can't verify, but this shouldn't happen in normal flow
            }
        }

        // Check cache
        const cacheKey = learnerId ? `course_${courseId}_learner_${learnerId}` : `course_${courseId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            console.log(`[TrainerPersonalization] Returning cached personalization for ${cacheKey}`);
            return cached.data;
        }

        try {
            let trainerId = null;

            // If learnerId is provided, get their specific trainer
            if (learnerId) {
                console.log(`[TrainerPersonalization] Looking up trainer for learner ${learnerId} in course ${courseId}`);
                const { data: allocation, error: allocationError } = await supabaseClient
                    .from('course_allocations')
                    .select('trainer_id')
                    .eq('course_id', courseId)
                    .eq('user_id', learnerId)
                    .not('trainer_id', 'is', null)
                    .single();

                if (!allocationError && allocation && allocation.trainer_id) {
                    trainerId = allocation.trainer_id;
                    console.log(`[TrainerPersonalization] Found trainer ${trainerId} for learner ${learnerId}`);
                } else {
                    console.warn(`[TrainerPersonalization] No trainer found for learner ${learnerId} in course ${courseId}:`, allocationError);
                }
            }

            // Fallback: Get trainer from any allocation for this course
            if (!trainerId) {
                const { data: allocation, error: allocationError } = await supabaseClient
                    .from('course_allocations')
                    .select('trainer_id')
                    .eq('course_id', courseId)
                    .not('trainer_id', 'is', null)
                    .limit(1)
                    .maybeSingle();

                if (!allocationError && allocation && allocation.trainer_id) {
                    trainerId = allocation.trainer_id;
                }
            }

            if (!trainerId) {
                return null;
            }

            // Get course-specific personalization first (don't filter by enabled yet - we'll check after)
            console.log(`[TrainerPersonalization] Fetching course-specific personalization for trainer ${trainerId}, course ${courseId}`);
            let { data: personalization, error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .select('*')
                .eq('trainer_id', trainerId)
                .eq('course_id', courseId)
                .maybeSingle();

            if (error) {
                console.warn(`[TrainerPersonalization] Error fetching course-specific personalization:`, error);
            } else if (personalization) {
                console.log(`[TrainerPersonalization] Found course-specific personalization:`, {
                    id: personalization.id,
                    coach_name: personalization.coach_name,
                    personalization_enabled: personalization.personalization_enabled,
                    course_id: personalization.course_id,
                    trainer_id: personalization.trainer_id
                });
            } else {
                console.log(`[TrainerPersonalization] No course-specific personalization found for trainer ${trainerId}, course ${courseId}`);
            }

            // If no course-specific personalization or it's disabled, try global (course_id is NULL)
            if (error || !personalization || !personalization.personalization_enabled) {
                if (error) {
                    console.log(`[TrainerPersonalization] Course-specific query had error, trying global personalization for trainer ${trainerId}`);
                } else if (!personalization) {
                    console.log(`[TrainerPersonalization] No course-specific personalization found, trying global personalization for trainer ${trainerId}`);
                } else if (!personalization.personalization_enabled) {
                    console.log(`[TrainerPersonalization] Course-specific personalization is disabled (enabled=${personalization.personalization_enabled}), trying global personalization for trainer ${trainerId}`);
                }
                
                const { data: globalPersonalization, error: globalError } = await supabaseClient
                    .from('ai_coach_trainer_personalization')
                    .select('*')
                    .eq('trainer_id', trainerId)
                    .is('course_id', null)
                    .maybeSingle();

                if (!globalError && globalPersonalization) {
                    console.log(`[TrainerPersonalization] Found global personalization:`, {
                        id: globalPersonalization.id,
                        coach_name: globalPersonalization.coach_name,
                        personalization_enabled: globalPersonalization.personalization_enabled,
                        course_id: globalPersonalization.course_id,
                        trainer_id: globalPersonalization.trainer_id
                    });
                    if (globalPersonalization.personalization_enabled) {
                        personalization = globalPersonalization;
                    } else {
                        console.warn(`[TrainerPersonalization] Global personalization exists but is disabled (enabled=${globalPersonalization.personalization_enabled})`);
                        return null;
                    }
                } else {
                    if (globalError) {
                        console.warn(`[TrainerPersonalization] Error fetching global personalization:`, globalError);
                    } else {
                        console.warn(`[TrainerPersonalization] No global personalization found for trainer ${trainerId}`);
                    }
                    return null;
                }
            }

            // Final check - ensure personalization is enabled
            if (!personalization || !personalization.personalization_enabled) {
                console.warn(`[TrainerPersonalization] Personalization found but is disabled or null`);
                return null;
            }

            // Cache the result
            this.cache.set(cacheKey, {
                data: personalization,
                timestamp: Date.now()
            });

            console.log(`[TrainerPersonalization] Returning personalization with coach_name: ${personalization.coach_name}`);
            return personalization;
        } catch (error) {
            console.error('[TrainerPersonalization] Error fetching personalization:', error);
            return null;
        }
    }

    /**
     * Get personalized coach name for a course
     * @param {string} courseId - Course identifier
     * @param {string} learnerId - Optional learner ID to get their specific trainer's coach name
     * @returns {Promise<string>} Coach name (default: "AI Coach")
     */
    async getCoachName(courseId, learnerId = null) {
        if (!courseId) {
            return 'AI Coach';
        }
        
        const personalization = await this.getPersonalizationForCourse(courseId, learnerId);
        
        // Check if personalization exists and is enabled
        if (!personalization || !personalization.personalization_enabled) {
            return 'AI Coach';
        }
        
        if (!personalization.coach_name || personalization.coach_name.trim() === '') {
            console.warn('[TrainerPersonalization] coach_name is empty or null');
            return 'AI Coach';
        }
        
        return personalization.coach_name.trim();
    }

    /**
     * Get trainer info for system prompt
     * @param {string} courseId - Course identifier
     * @param {string} learnerId - Optional learner ID to get their specific trainer's info
     * @returns {Promise<string|null>} Trainer info string for system prompt
     */
    async getTrainerInfoForPrompt(courseId, learnerId = null) {
        const personalization = await this.getPersonalizationForCourse(courseId, learnerId);
        
        if (!personalization || !personalization.personalization_enabled) {
            return null;
        }

        const shareLevel = personalization.share_level || 'name_only';
        const trainerInfo = personalization.trainer_info || {};
        
        let infoString = '';

        // Always include coach name
        infoString += `You are ${personalization.coach_name}. `;

        // Add trainer info based on share level
        if (shareLevel === 'name_expertise' || shareLevel === 'full') {
            if (trainerInfo.expertise) {
                infoString += `Your expertise includes: ${trainerInfo.expertise}. `;
            }
            if (trainerInfo.years_experience) {
                infoString += `You have ${trainerInfo.years_experience} years of experience. `;
            }
        }

        if (shareLevel === 'full') {
            if (trainerInfo.bio) {
                infoString += `About you: ${trainerInfo.bio} `;
            }
            if (personalization.linkedin_profile_url) {
                infoString += `Learners can learn more about you at: ${personalization.linkedin_profile_url}`;
            }
        }

        return infoString.trim() || null;
    }

    /**
     * Clear cache for a course
     * @param {string} courseId - Course identifier
     * @param {string} learnerId - Optional learner ID
     */
    clearCache(courseId, learnerId = null) {
        if (courseId) {
            if (learnerId) {
                this.cache.delete(`course_${courseId}_learner_${learnerId}`);
            } else {
                // Clear all cache entries for this course (with or without learner)
                for (const key of this.cache.keys()) {
                    if (key.startsWith(`course_${courseId}`)) {
                        this.cache.delete(key);
                    }
                }
            }
        } else {
            this.cache.clear();
        }
    }
}

export const trainerPersonalizationService = new TrainerPersonalizationService();

