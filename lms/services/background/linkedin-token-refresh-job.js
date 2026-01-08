/**
 * LinkedIn Token Refresh Job
 * 
 * Refreshes expired or expiring LinkedIn OAuth access tokens.
 * Can be run manually or scheduled to run periodically.
 * 
 * Usage:
 *   - Manual: await linkedinTokenRefreshJob.run()
 *   - Scheduled: Call periodically (e.g., daily) from admin interface or app initialization
 */

import { supabaseClient } from '../supabase-client.js';
import { linkedinOAuthService } from '../linkedin-oauth-service.js';

class LinkedInTokenRefreshJob {
    constructor() {
        this.name = 'LinkedIn Token Refresh';
        this.expirationBufferMinutes = 24 * 60; // Refresh tokens expiring within 24 hours
    }

    /**
     * Run token refresh job
     * Finds all trainers with LinkedIn connections whose tokens are expiring soon
     * and refreshes them
     * @returns {Promise<Object>} Job execution results
     */
    async run() {
        console.log('[TokenRefreshJob] Starting LinkedIn token refresh job...');
        
        const results = {
            processed: 0,
            refreshed: 0,
            failed: 0,
            expired: 0,
            errors: []
        };

        try {
            // Find all trainers with LinkedIn connections and tokens
            // Check for tokens expiring within 24 hours
            const expirationThreshold = new Date(Date.now() + this.expirationBufferMinutes * 60 * 1000);

            const { data: personalizations, error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .select('trainer_id, course_id, linkedin_token_expires_at, linkedin_extraction_status')
                .not('linkedin_access_token', 'is', null)
                .not('linkedin_refresh_token', 'is', null);

            if (error) {
                throw new Error(`Failed to fetch personalizations: ${error.message}`);
            }

            if (!personalizations || personalizations.length === 0) {
                console.log('[TokenRefreshJob] No LinkedIn connections found');
                return {
                    ...results,
                    message: 'No LinkedIn connections found'
                };
            }

            console.log(`[TokenRefreshJob] Found ${personalizations.length} LinkedIn connections to check`);

            // Filter for tokens expiring soon
            const expiringTokens = personalizations.filter(p => {
                if (!p.linkedin_token_expires_at) return false;
                const expiresAt = new Date(p.linkedin_token_expires_at);
                return expiresAt <= expirationThreshold;
            });

            console.log(`[TokenRefreshJob] Found ${expiringTokens.length} tokens expiring within 24 hours`);

            // Refresh each token
            for (const personalization of expiringTokens) {
                results.processed++;
                
                try {
                    await linkedinOAuthService.refreshAccessToken(
                        personalization.trainer_id,
                        personalization.course_id
                    );
                    
                    results.refreshed++;
                    console.log(`[TokenRefreshJob] ✓ Refreshed token for trainer: ${personalization.trainer_id}`);
                } catch (error) {
                    results.failed++;
                    
                    // Check if it's a token expiration error
                    if (error.message && error.message.includes('expired')) {
                        results.expired++;
                        // Update status to token_expired
                        await supabaseClient
                            .from('ai_coach_trainer_personalization')
                            .update({
                                linkedin_extraction_status: 'token_expired',
                                linkedin_extraction_error: error.message,
                                updated_at: new Date().toISOString()
                            })
                            .eq('trainer_id', personalization.trainer_id)
                            .eq('course_id', personalization.course_id);
                    }
                    
                    results.errors.push({
                        trainer_id: personalization.trainer_id,
                        course_id: personalization.course_id,
                        error: error.message
                    });
                    
                    console.error(`[TokenRefreshJob] ✗ Failed to refresh token for trainer ${personalization.trainer_id}:`, error.message);
                }
            }

            console.log('[TokenRefreshJob] Token refresh job completed:', {
                processed: results.processed,
                refreshed: results.refreshed,
                failed: results.failed,
                expired: results.expired
            });

            return {
                ...results,
                message: `Processed ${results.processed} tokens: ${results.refreshed} refreshed, ${results.failed} failed`
            };
        } catch (error) {
            console.error('[TokenRefreshJob] Job execution error:', error);
            throw error;
        }
    }

    /**
     * Check if any tokens need refreshing
     * @returns {Promise<{needsRefresh: boolean, count: number}>}
     */
    async checkStatus() {
        try {
            const expirationThreshold = new Date(Date.now() + this.expirationBufferMinutes * 60 * 1000);

            const { data: expiringTokens, error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .select('trainer_id, course_id, linkedin_token_expires_at')
                .not('linkedin_access_token', 'is', null)
                .not('linkedin_refresh_token', 'is', null)
                .lte('linkedin_token_expires_at', expirationThreshold.toISOString());

            if (error) {
                throw new Error(`Failed to check token status: ${error.message}`);
            }

            return {
                needsRefresh: expiringTokens && expiringTokens.length > 0,
                count: expiringTokens ? expiringTokens.length : 0
            };
        } catch (error) {
            console.error('[TokenRefreshJob] Error checking status:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const linkedinTokenRefreshJob = new LinkedInTokenRefreshJob();

