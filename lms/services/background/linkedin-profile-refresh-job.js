/**
 * LinkedIn Profile Refresh Job
 * 
 * Refreshes LinkedIn profile data for trainers who have enabled automatic refresh.
 * Runs weekly for all trainers with auto_refresh_enabled = true.
 * 
 * Usage:
 *   - Manual: await linkedinProfileRefreshJob.run()
 *   - Weekly: Call weekly (e.g., every Sunday) from admin interface or scheduled task
 */

import { supabaseClient } from '../supabase-client.js';
import { trainerPersonalizationService } from '../trainer-personalization-service.js';

class LinkedInProfileRefreshJob {
    constructor() {
        this.name = 'LinkedIn Profile Refresh';
        this.rateLimitDelay = 2000; // 2 seconds between requests to respect LinkedIn API limits
        this.lastRequestTime = 0;
    }

    /**
     * Wait if needed to respect rate limits
     */
    async _waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Run profile refresh job
     * Finds all trainers with auto_refresh_enabled = true
     * and refreshes their LinkedIn data
     * @returns {Promise<Object>} Job execution results
     */
    async run() {
        console.log('[ProfileRefreshJob] Starting LinkedIn profile refresh job...');
        
        const results = {
            processed: 0,
            refreshed: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        try {
            // Find all trainers with auto-refresh enabled
            const { data: personalizations, error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .select('trainer_id, course_id, linkedin_extraction_status, last_refreshed_at, auto_refresh_enabled')
                .eq('auto_refresh_enabled', true)
                .not('linkedin_access_token', 'is', null);

            if (error) {
                throw new Error(`Failed to fetch personalizations: ${error.message}`);
            }

            if (!personalizations || personalizations.length === 0) {
                console.log('[ProfileRefreshJob] No trainers with auto-refresh enabled');
                return {
                    ...results,
                    message: 'No trainers with auto-refresh enabled'
                };
            }

            console.log(`[ProfileRefreshJob] Found ${personalizations.length} trainers with auto-refresh enabled`);

            // Filter out tokens that are expired (they can't be refreshed)
            const validPersonalizations = personalizations.filter(p => {
                return p.linkedin_extraction_status !== 'token_expired';
            });

            console.log(`[ProfileRefreshJob] ${validPersonalizations.length} trainers with valid tokens`);

            // Refresh each trainer's data
            for (const personalization of validPersonalizations) {
                results.processed++;
                
                try {
                    // Check if last refresh was less than 7 days ago (prevent too frequent refreshes)
                    if (personalization.last_refreshed_at) {
                        const lastRefresh = new Date(personalization.last_refreshed_at);
                        const daysSinceRefresh = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24);
                        
                        if (daysSinceRefresh < 7) {
                            results.skipped++;
                            console.log(`[ProfileRefreshJob] Skipped trainer ${personalization.trainer_id} - refreshed ${daysSinceRefresh.toFixed(1)} days ago`);
                            continue;
                        }
                    }

                    // Wait for rate limiting
                    await this._waitForRateLimit();

                    // Refresh LinkedIn data
                    await trainerPersonalizationService.refreshLinkedInData(
                        personalization.trainer_id,
                        personalization.course_id
                    );
                    
                    results.refreshed++;
                    console.log(`[ProfileRefreshJob] ✓ Refreshed data for trainer: ${personalization.trainer_id}`);
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        trainer_id: personalization.trainer_id,
                        course_id: personalization.course_id,
                        error: error.message
                    });
                    
                    // Update status to failed
                    await supabaseClient
                        .from('ai_coach_trainer_personalization')
                        .update({
                            linkedin_extraction_status: 'failed',
                            linkedin_extraction_error: error.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('trainer_id', personalization.trainer_id)
                        .eq('course_id', personalization.course_id);
                    
                    console.error(`[ProfileRefreshJob] ✗ Failed to refresh data for trainer ${personalization.trainer_id}:`, error.message);
                }
            }

            console.log('[ProfileRefreshJob] Profile refresh job completed:', {
                processed: results.processed,
                refreshed: results.refreshed,
                failed: results.failed,
                skipped: results.skipped
            });

            return {
                ...results,
                message: `Processed ${results.processed} trainers: ${results.refreshed} refreshed, ${results.failed} failed, ${results.skipped} skipped`
            };
        } catch (error) {
            console.error('[ProfileRefreshJob] Job execution error:', error);
            throw error;
        }
    }

    /**
     * Check how many trainers need refreshing
     * @returns {Promise<{needsRefresh: boolean, count: number}>}
     */
    async checkStatus() {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const { data: needsRefresh, error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .select('trainer_id, course_id')
                .eq('auto_refresh_enabled', true)
                .not('linkedin_access_token', 'is', null)
                .not('linkedin_refresh_token', 'is', null)
                .not('linkedin_extraction_status', 'eq', 'token_expired')
                .or(`last_refreshed_at.is.null,last_refreshed_at.lt.${sevenDaysAgo.toISOString()}`);

            if (error) {
                throw new Error(`Failed to check refresh status: ${error.message}`);
            }

            return {
                needsRefresh: needsRefresh && needsRefresh.length > 0,
                count: needsRefresh ? needsRefresh.length : 0
            };
        } catch (error) {
            console.error('[ProfileRefreshJob] Error checking status:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const linkedinProfileRefreshJob = new LinkedInProfileRefreshJob();

