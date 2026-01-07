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
                    .maybeSingle();

                if (allocationError) {
                    console.warn(`[TrainerPersonalization] Error looking up trainer for learner ${learnerId} in course ${courseId}:`, allocationError);
                } else if (allocation && allocation.trainer_id) {
                    trainerId = allocation.trainer_id;
                    console.log(`[TrainerPersonalization] Found trainer ${trainerId} for learner ${learnerId} in course ${courseId}`);
                } else {
                    console.log(`[TrainerPersonalization] No trainer allocation found for learner ${learnerId} in course ${courseId} (allocation: ${allocation ? JSON.stringify(allocation) : 'null'})`);
                }
            }

            // Fallback: Get trainer from any allocation for this course
            if (!trainerId) {
                console.log(`[TrainerPersonalization] No specific trainer found, trying fallback: any trainer for course ${courseId}`);
                const { data: allocation, error: allocationError } = await supabaseClient
                    .from('course_allocations')
                    .select('trainer_id')
                    .eq('course_id', courseId)
                    .not('trainer_id', 'is', null)
                    .limit(1)
                    .maybeSingle();

                if (allocationError) {
                    console.warn(`[TrainerPersonalization] Error in fallback query for course ${courseId}:`, allocationError);
                } else if (allocation && allocation.trainer_id) {
                    trainerId = allocation.trainer_id;
                    console.log(`[TrainerPersonalization] Found fallback trainer ${trainerId} for course ${courseId}`);
                } else {
                    console.log(`[TrainerPersonalization] No fallback trainer found for course ${courseId}`);
                }
            }

            if (!trainerId) {
                console.warn(`[TrainerPersonalization] No trainer ID found for course ${courseId}, learner ${learnerId || 'N/A'}. Cannot fetch personalization.`);
                return null;
            }

            // Debug: Check if trainer exists in users table
            console.log(`[TrainerPersonalization] [DEBUG] Checking if trainer ${trainerId} exists in users table...`);
            const { data: trainerCheck, error: trainerCheckError } = await supabaseClient
                .from('users')
                .select('id, name, email, role')
                .eq('id', trainerId)
                .maybeSingle();
            
            if (trainerCheckError) {
                console.error(`[TrainerPersonalization] [DEBUG] ERROR checking if trainer exists:`, trainerCheckError);
            } else if (!trainerCheck) {
                console.error(`[TrainerPersonalization] [DEBUG] CRITICAL: Trainer ID ${trainerId} does NOT exist in users table!`);
                console.error(`[TrainerPersonalization] [DEBUG] This means the trainer_id in course_allocations doesn't match any user.`);
            } else {
                console.log(`[TrainerPersonalization] [DEBUG] ✓ Trainer EXISTS in users table:`, {
                    id: trainerCheck.id,
                    name: trainerCheck.name,
                    email: trainerCheck.email,
                    role: trainerCheck.role
                });
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
                
                // Debug: Check what trainer_ids exist in personalization table
                console.log(`[TrainerPersonalization] [DEBUG] Checking what trainer_ids exist in personalization table...`);
                const { data: allPersonalizations, error: debugError } = await supabaseClient
                    .from('ai_coach_trainer_personalization')
                    .select('trainer_id, course_id, coach_name, personalization_enabled')
                    .limit(10);
                
                if (debugError) {
                    console.error(`[TrainerPersonalization] [DEBUG] Error fetching personalizations:`, debugError);
                } else if (!allPersonalizations || allPersonalizations.length === 0) {
                    console.warn(`[TrainerPersonalization] [DEBUG] No personalizations found in table at all!`);
                } else {
                    console.log(`[TrainerPersonalization] [DEBUG] Found ${allPersonalizations.length} personalizations. Sample trainer_ids:`, 
                        allPersonalizations.map(p => ({ 
                            trainer_id: p.trainer_id, 
                            course_id: p.course_id,
                            coach_name: p.coach_name,
                            enabled: p.personalization_enabled
                        }))
                    );
                    console.log(`[TrainerPersonalization] [DEBUG] Looking for trainer_id: ${trainerId}`);
                    console.log(`[TrainerPersonalization] [DEBUG] Does it match any?`, 
                        allPersonalizations.some(p => p.trainer_id === trainerId) ? 'YES' : 'NO'
                    );
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
                    // Fallback: Get trainer's actual name from users table
                    return await this._getTrainerNameFallback(trainerId);
                }
            }

            // Final check - ensure personalization is enabled
            if (!personalization || !personalization.personalization_enabled) {
                console.warn(`[TrainerPersonalization] Personalization found but is disabled or null`);
                // Fallback: Get trainer's actual name from users table
                return await this._getTrainerNameFallback(trainerId);
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
     * Get trainer name as fallback when personalization is not set up
     * @param {string} trainerId - Trainer user ID
     * @returns {Promise<Object|null>} Personalization object with trainer's name, or null
     * @private
     */
    async _getTrainerNameFallback(trainerId) {
        if (!trainerId) {
            return null;
        }

        try {
            console.log(`[TrainerPersonalization] Fetching trainer name as fallback for trainer ${trainerId}`);
            
            // First, try to find user with role='trainer'
            let { data: trainer, error } = await supabaseClient
                .from('users')
                .select('id, email, name, full_name, role')
                .eq('id', trainerId)
                .eq('role', 'trainer')
                .maybeSingle();

            // If not found with trainer role, try without role filter (trainer might have different role)
            if (error || !trainer) {
                console.log(`[TrainerPersonalization] Trainer not found with role='trainer', trying without role filter for ${trainerId}`);
                const { data: user, error: userError } = await supabaseClient
                    .from('users')
                    .select('id, email, name, full_name, role')
                    .eq('id', trainerId)
                    .maybeSingle();
                
                if (!userError && user) {
                    trainer = user;
                    error = null;
                    console.log(`[TrainerPersonalization] Found user ${trainerId} with role: ${user.role}`);
                } else {
                    if (userError) {
                        console.warn(`[TrainerPersonalization] Error fetching user (without role filter):`, userError);
                    } else {
                        console.warn(`[TrainerPersonalization] User not found in users table: ${trainerId}`);
                    }
                }
            }

            if (error) {
                console.warn(`[TrainerPersonalization] Error fetching trainer name:`, error);
                return null;
            }

            if (!trainer) {
                console.warn(`[TrainerPersonalization] Trainer not found: ${trainerId}`);
                return null;
            }

            // Construct name from available fields
            // The users table has: name (NOT NULL), full_name (nullable), email
            let trainerName = 'AI Coach';
            if (trainer.name && trainer.name.trim() !== '') {
                trainerName = trainer.name.trim();
            } else if (trainer.full_name && trainer.full_name.trim() !== '') {
                trainerName = trainer.full_name.trim();
            } else if (trainer.email) {
                // Use email username as fallback
                trainerName = trainer.email.split('@')[0];
            }

            console.log(`[TrainerPersonalization] Using trainer name fallback: "${trainerName}" for trainer ${trainerId}`);

            // Return a personalization-like object with the trainer's name
            return {
                coach_name: trainerName,
                trainer_id: trainerId,
                course_id: null,
                personalization_enabled: true, // Enable it so it can be used
                trainer_info: {},
                share_level: 'name_only'
            };
        } catch (error) {
            console.error(`[TrainerPersonalization] Error in fallback:`, error);
            return null;
        }
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

