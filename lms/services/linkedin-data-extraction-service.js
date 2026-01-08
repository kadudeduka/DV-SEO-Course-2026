/**
 * LinkedIn Data Extraction Service
 * 
 * Extracts trainer profile information from LinkedIn API using OAuth access tokens.
 * Handles API calls, rate limiting, error handling, and data parsing.
 */

import { linkedinOAuthService } from './linkedin-oauth-service.js';

class LinkedInDataExtractionService {
    constructor() {
        this.rateLimitDelay = 1000; // 1 second delay between requests to respect rate limits
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
     * Make LinkedIn API request with retry logic
     * @param {string} url - API endpoint URL
     * @param {string} accessToken - OAuth access token
     * @param {number} retries - Number of retry attempts
     * @returns {Promise<Response>}
     */
    async _makeAPIRequest(url, accessToken, retries = 3) {
        await this._waitForRateLimit();

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                });

                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter ? parseInt(retryAfter) * 1000 : (attempt + 1) * 2000;
                    console.warn(`[LinkedInExtraction] Rate limited. Waiting ${delay}ms before retry ${attempt + 1}/${retries}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // Handle token expiration
                if (response.status === 401) {
                    throw new Error('Access token expired. Please refresh token.');
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`LinkedIn API error: ${response.status} ${errorData.message || response.statusText}`);
                }

                return response;
            } catch (error) {
                if (attempt === retries - 1) {
                    throw error;
                }
                // Exponential backoff for retries
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`[LinkedInExtraction] Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Get profile data from LinkedIn API using OpenID Connect
     * @param {string} accessToken - OAuth access token
     * @returns {Promise<Object>} Profile data
     */
    async getProfileData(accessToken) {
        try {
            // LinkedIn OpenID Connect UserInfo endpoint
            // Returns: sub (user ID), name, given_name, family_name, picture, email (if scope requested)
            const url = 'https://api.linkedin.com/v2/userinfo';
            
            const response = await this._makeAPIRequest(url, accessToken);
            const profileData = await response.json();

            console.log('[LinkedInExtraction] Successfully retrieved profile data via OpenID Connect');
            
            // Transform OpenID Connect response to our expected format
            return {
                id: profileData.sub, // OpenID Connect uses 'sub' for user ID
                localizedFirstName: profileData.given_name || '',
                localizedLastName: profileData.family_name || '',
                name: profileData.name || `${profileData.given_name || ''} ${profileData.family_name || ''}`.trim(),
                profilePicture: profileData.picture ? {
                    'displayImage~': {
                        elements: [{
                            identifiers: [{
                                identifier: profileData.picture
                            }]
                        }]
                    }
                } : null,
                headline: null // OpenID Connect profile scope doesn't include headline
            };
        } catch (error) {
            console.error('[LinkedInExtraction] Error getting profile data:', error);
            throw error;
        }
    }

    /**
     * Extract full name from profile data
     * @param {Object} profileData - Profile data from LinkedIn API (OpenID Connect or legacy format)
     * @returns {string} Full name (first + last)
     */
    extractName(profileData) {
        try {
            // OpenID Connect format: name, given_name, family_name
            if (profileData.name) {
                return profileData.name.trim();
            }
            
            // Legacy format: localizedFirstName, localizedLastName
            const firstName = profileData.localizedFirstName || profileData.given_name || '';
            const lastName = profileData.localizedLastName || profileData.family_name || '';
            const fullName = `${firstName} ${lastName}`.trim();
            
            if (!fullName) {
                throw new Error('Name not found in profile data');
            }
            
            return fullName;
        } catch (error) {
            console.error('[LinkedInExtraction] Error extracting name:', error);
            throw error;
        }
    }

    /**
     * Extract headline from profile data
     * @param {Object} profileData - Profile data from LinkedIn API
     * @returns {string|null} Professional headline (null for OpenID Connect as it's not available)
     */
    extractHeadline(profileData) {
        try {
            // OpenID Connect profile scope doesn't include headline
            // Headline is only available with r_liteprofile or r_basicprofile (deprecated)
            const headline = profileData.headline || '';
            return headline.trim() || null;
        } catch (error) {
            console.warn('[LinkedInExtraction] Headline not available - OpenID Connect profile scope does not include headline:', error.message);
            return null;
        }
    }

    /**
     * Extract profile photo URL from profile data
     * @param {Object} profileData - Profile data from LinkedIn API (OpenID Connect or legacy format)
     * @returns {string|null} Profile photo URL or null if not available
     */
    extractPhotoUrl(profileData) {
        try {
            // OpenID Connect format: direct 'picture' field
            if (profileData.picture) {
                return profileData.picture;
            }
            
            // Legacy format: nested profilePicture structure
            if (!profileData.profilePicture) {
                return null;
            }

            const displayImage = profileData.profilePicture['displayImage~'];
            if (!displayImage || !displayImage.elements || !displayImage.elements.length) {
                return null;
            }

            // Get the largest available image
            // elements array is sorted by size (ascending), so get the last one
            const elements = displayImage.elements;
            const largestImage = elements[elements.length - 1];
            
            if (!largestImage || !largestImage.identifiers || !largestImage.identifiers.length) {
                return null;
            }

            // Get the first identifier (contains the URL)
            const photoUrl = largestImage.identifiers[0].identifier;
            return photoUrl || null;
        } catch (error) {
            console.warn('[LinkedInExtraction] Photo URL not available:', error.message);
            return null;
        }
    }

    /**
     * Extract profile ID from profile data
     * @param {Object} profileData - Profile data from LinkedIn API (OpenID Connect or legacy format)
     * @returns {string} LinkedIn profile ID
     */
    extractProfileId(profileData) {
        try {
            // OpenID Connect uses 'sub' for user ID, legacy API uses 'id'
            const profileId = profileData.sub || profileData.id || '';
            
            if (!profileId) {
                throw new Error('Profile ID not found in profile data');
            }
            
            return profileId;
        } catch (error) {
            console.error('[LinkedInExtraction] Error extracting profile ID:', error);
            throw error;
        }
    }

    /**
     * Extract profile URL from profile data
     * Note: LinkedIn API may not directly provide vanity URL in free tier
     * @param {Object} profileData - Profile data from LinkedIn API
     * @returns {string|null} Profile URL or null
     */
    extractProfileUrl(profileData) {
        try {
            // In free tier, we may not get vanity URL directly
            // We can construct it if we have profile ID, or use stored linkedin_profile_url
            const profileId = this.extractProfileId(profileData);
            
            // LinkedIn profile URL format: https://www.linkedin.com/in/{vanityName}
            // But we may only have numeric ID, so we can't construct it directly
            // This will be stored when trainer provides URL manually
            return null; // Return null - will use stored linkedin_profile_url from database
        } catch (error) {
            console.warn('[LinkedInExtraction] Profile URL not available:', error.message);
            return null;
        }
    }

    /**
     * Extract all available data from profile
     * @param {string} accessToken - OAuth access token
     * @returns {Promise<Object>} Extracted profile data
     */
    async extractAll(accessToken) {
        try {
            const profileData = await this.getProfileData(accessToken);
            
            const extracted = {
                name: this.extractName(profileData),
                headline: this.extractHeadline(profileData),
                photoUrl: this.extractPhotoUrl(profileData),
                profileId: this.extractProfileId(profileData),
                profileUrl: this.extractProfileUrl(profileData)
            };

            console.log('[LinkedInExtraction] Successfully extracted all profile data');
            return extracted;
        } catch (error) {
            console.error('[LinkedInExtraction] Error extracting all data:', error);
            throw error;
        }
    }

    /**
     * Extract and store LinkedIn data for a trainer
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<Object>} Extracted and stored data
     */
    async extractAndStore(trainerId, courseId = null) {
        try {
            // Get access token (will auto-refresh if needed)
            const accessToken = await linkedinOAuthService.getAccessToken(trainerId, courseId);
            
            // Extract all data
            const extracted = await this.extractAll(accessToken);
            
            // Update database with extracted data
            const { supabaseClient } = await import('./supabase-client.js');
            
            const updateData = {
                linkedin_profile_id: extracted.profileId,
                linkedin_data_extracted_at: new Date().toISOString(),
                linkedin_extraction_status: 'success',
                linkedin_extraction_error: null,
                last_refreshed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Update trainer_info JSONB field
            // Get existing trainer_info or create new
            const { data: existing } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .select('trainer_info')
                .eq('trainer_id', trainerId)
                .eq('course_id', courseId)
                .single();

            const existingInfo = existing?.trainer_info || {};
            updateData.trainer_info = {
                ...existingInfo,
                name: extracted.name,
                headline: extracted.headline,
                linkedin_id: extracted.profileId,
                extracted_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .update(updateData)
                .eq('trainer_id', trainerId)
                .eq('course_id', courseId);

            if (error) {
                throw new Error(`Failed to store extracted data: ${error.message}`);
            }

            console.log('[LinkedInExtraction] Successfully extracted and stored data for trainer:', trainerId);
            
            return {
                ...extracted,
                stored: true
            };
        } catch (error) {
            // Update status to failed
            const { supabaseClient } = await import('./supabase-client.js');
            await supabaseClient
                .from('ai_coach_trainer_personalization')
                .update({
                    linkedin_extraction_status: 'failed',
                    linkedin_extraction_error: error.message,
                    updated_at: new Date().toISOString()
                })
                .eq('trainer_id', trainerId)
                .eq('course_id', courseId);

            throw error;
        }
    }
}

// Export singleton instance
export const linkedinDataExtractionService = new LinkedInDataExtractionService();

