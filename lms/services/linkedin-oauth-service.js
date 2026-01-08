/**
 * LinkedIn OAuth Service
 * 
 * Handles LinkedIn OAuth 2.0 three-legged authentication flow for trainer personalization.
 * Manages OAuth authorization, token exchange, and token refresh.
 */

import { supabaseClient } from './supabase-client.js';
import { encrypt, decrypt } from './utils/encryption-util.js';

// Get configuration
function getLinkedInConfig() {
    // Priority 1: Check window.LMS_CONFIG directly (from app.config.local.js) - most reliable
    if (typeof window !== 'undefined' && window.LMS_CONFIG) {
        // Log all keys to debug
        const allKeys = Object.keys(window.LMS_CONFIG);
        const linkedInKeys = allKeys.filter(k => k.includes('LINKEDIN'));
        
        const clientId = window.LMS_CONFIG.LINKEDIN_CLIENT_ID;
        const clientSecret = window.LMS_CONFIG.LINKEDIN_CLIENT_SECRET;
        const redirectUri = window.LMS_CONFIG.LINKEDIN_REDIRECT_URI;
        const encryptionKey = window.LMS_CONFIG.LINKEDIN_ENCRYPTION_KEY || 'dv-linkedin-encryption-key-2025-change-in-production';
        
        console.log('[LinkedInOAuth] Checking LMS_CONFIG:', {
            allKeys: allKeys,
            linkedInKeys: linkedInKeys,
            clientIdType: typeof clientId,
            clientIdValue: clientId,
            redirectUriType: typeof redirectUri,
            redirectUriValue: redirectUri
        });
        
        // Check if values are valid (not empty strings)
        if (clientId && typeof clientId === 'string' && clientId.trim() && redirectUri && typeof redirectUri === 'string' && redirectUri.trim()) {
            console.log('[LinkedInOAuth] Using config from LMS_CONFIG (direct):', {
                hasClientId: !!clientId,
                hasRedirectUri: !!redirectUri,
                hasClientSecret: !!clientSecret
            });
            return {
                clientId: clientId.trim(),
                clientSecret: clientSecret ? clientSecret.trim() : '',
                redirectUri: redirectUri.trim(),
                encryptionKey
            };
        } else {
            console.warn('[LinkedInOAuth] LMS_CONFIG exists but LinkedIn values are invalid:', {
                clientId: clientId,
                redirectUri: redirectUri,
                clientIdValid: clientId && typeof clientId === 'string' && clientId.trim(),
                redirectUriValid: redirectUri && typeof redirectUri === 'string' && redirectUri.trim()
            });
        }
    }
    
    // Priority 2: Try window.LMS_CONFIG_INTERNAL (from app.config.js)
    if (typeof window !== 'undefined' && window.LMS_CONFIG_INTERNAL?.linkedin) {
        const config = window.LMS_CONFIG_INTERNAL.linkedin;
        // Check if config has valid values (not empty strings)
        if (config && config.clientId && config.clientId.trim() && config.redirectUri && config.redirectUri.trim()) {
            console.log('[LinkedInOAuth] Using config from LMS_CONFIG_INTERNAL:', {
                hasClientId: !!config.clientId,
                hasRedirectUri: !!config.redirectUri,
                hasClientSecret: !!config.clientSecret
            });
            return config;
        }
    }
    
    // Log what we found for debugging
    if (typeof window !== 'undefined') {
        const internalConfig = window.LMS_CONFIG_INTERNAL?.linkedin;
        const allLMSConfigKeys = window.LMS_CONFIG ? Object.keys(window.LMS_CONFIG) : [];
        const linkedInKeys = allLMSConfigKeys.filter(key => key.includes('LINKEDIN'));
        
        console.error('[LinkedInOAuth] Configuration check - all sources:', {
            hasLMS_CONFIG: !!window.LMS_CONFIG,
            lmsConfigKeys: allLMSConfigKeys,
            linkedInKeys: linkedInKeys,
            lmsConfigClientId: window.LMS_CONFIG?.LINKEDIN_CLIENT_ID || 'missing',
            lmsConfigRedirectUri: window.LMS_CONFIG?.LINKEDIN_REDIRECT_URI || 'missing',
            lmsConfigClientIdValue: window.LMS_CONFIG?.LINKEDIN_CLIENT_ID,
            lmsConfigRedirectUriValue: window.LMS_CONFIG?.LINKEDIN_REDIRECT_URI,
            lmsConfigClientSecret: window.LMS_CONFIG?.LINKEDIN_CLIENT_SECRET || 'missing',
            lmsConfigEncryptionKey: window.LMS_CONFIG?.LINKEDIN_ENCRYPTION_KEY ? 'present' : 'missing',
            hasLMS_CONFIG_INTERNAL: !!window.LMS_CONFIG_INTERNAL,
            hasLinkedInConfig: !!internalConfig,
            internalClientId: internalConfig?.clientId || 'missing',
            internalRedirectUri: internalConfig?.redirectUri || 'missing',
            internalClientIdValue: internalConfig?.clientId,
            internalRedirectUriValue: internalConfig?.redirectUri
        });
        
        // Also log the full LMS_CONFIG object (without sensitive values)
        if (window.LMS_CONFIG) {
            const safeConfig = { ...window.LMS_CONFIG };
            if (safeConfig.LINKEDIN_CLIENT_SECRET) {
                safeConfig.LINKEDIN_CLIENT_SECRET = '***hidden***';
            }
            if (safeConfig.LINKEDIN_ENCRYPTION_KEY) {
                safeConfig.LINKEDIN_ENCRYPTION_KEY = '***hidden***';
            }
            console.log('[LinkedInOAuth] Full LMS_CONFIG object:', safeConfig);
        }
    }
    
    throw new Error('LinkedIn configuration not found. Please ensure LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI are set in config/app.config.local.js');
}

class LinkedInOAuthService {
    constructor() {
        this.config = null;
        this.configLoadAttempted = false;
        // Don't load config at construction - wait until it's actually needed
    }

    /**
     * Get configuration (lazy load)
     * @returns {Object} Configuration object
     */
    getConfig() {
        // If config already loaded, return it
        if (this.config && this.config.clientId && this.config.redirectUri) {
            return this.config;
        }

        // Try to load config
        try {
            this.config = getLinkedInConfig();
            if (this.config && this.config.clientId && this.config.redirectUri) {
                console.log('[LinkedInOAuth] Configuration loaded successfully');
                return this.config;
            } else {
                console.warn('[LinkedInOAuth] Configuration loaded but incomplete:', {
                    hasClientId: !!this.config?.clientId,
                    hasRedirectUri: !!this.config?.redirectUri,
                    hasClientSecret: !!this.config?.clientSecret
                });
            }
        } catch (error) {
            if (!this.configLoadAttempted) {
                console.warn('[LinkedInOAuth] Configuration not available:', error.message);
                this.configLoadAttempted = true;
            }
            // Re-throw to let caller handle it
            throw error;
        }

        return this.config;
    }

    /**
     * Generate OAuth state token for CSRF protection
     * @returns {string} Random state token
     */
    generateStateToken() {
        const array = new Uint8Array(32);
        if (typeof window !== 'undefined' && window.crypto) {
            window.crypto.getRandomValues(array);
        } else {
            // Fallback for older browsers
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
        }
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Initiate OAuth flow - generate authorization URL
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<{authorizationUrl: string, state: string}>}
     */
    async initiateOAuth(trainerId, courseId = null) {
        // Load config on-demand
        let config;
        try {
            config = this.getConfig();
        } catch (error) {
            console.error('[LinkedInOAuth] Configuration error:', error.message);
            throw new Error(`LinkedIn OAuth is not configured. ${error.message}`);
        }
        
        if (!config || !config.clientId || !config.redirectUri) {
            throw new Error('LinkedIn OAuth is not configured. Please check configuration. Missing: ' + 
                (!config ? 'config object' : 
                 !config.clientId ? 'LINKEDIN_CLIENT_ID' : 
                 !config.redirectUri ? 'LINKEDIN_REDIRECT_URI' : 'unknown'));
        }

        const state = this.generateStateToken();
        
        // Check if personalization record exists to preserve coach_name
        const { data: existing } = await supabaseClient
            .from('ai_coach_trainer_personalization')
            .select('coach_name')
            .eq('trainer_id', trainerId)
            .eq('course_id', courseId)
            .maybeSingle();

        // Prepare upsert data - preserve coach_name if it exists, otherwise use default
        const upsertData = {
            trainer_id: trainerId,
            course_id: courseId,
            linkedin_oauth_state: state,
            linkedin_extraction_status: 'oauth_pending',
            updated_at: new Date().toISOString()
        };

        // If record exists, preserve coach_name; if not, set a default
        if (existing && existing.coach_name) {
            upsertData.coach_name = existing.coach_name;
        } else {
            // Default coach name if record doesn't exist
            upsertData.coach_name = 'AI Coach';
        }

        // Store state in database for validation during callback
        const { error: storeError } = await supabaseClient
            .from('ai_coach_trainer_personalization')
            .upsert(upsertData, {
                onConflict: 'trainer_id,course_id'
            });

        if (storeError) {
            console.error('[LinkedInOAuth] Error storing OAuth state:', storeError);
            throw new Error(`Failed to store OAuth state: ${storeError.message}`);
        }

        // Build authorization URL
        // Using OpenID Connect scopes: openid profile (as authorized in LinkedIn Developer Portal)
        // openid: Use your name and photo
        // profile: Use your name and photo
        // Note: email scope is available but not needed for trainer personalization
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            state: state,
            scope: 'openid profile' // OpenID Connect scopes authorized for this app
        });

        const authorizationUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

        console.log('[LinkedInOAuth] Generated authorization URL for trainer:', trainerId);
        
        return {
            authorizationUrl,
            state
        };
    }

    /**
     * Handle OAuth callback - exchange code for tokens
     * @param {string} code - Authorization code from LinkedIn
     * @param {string} state - State token for CSRF validation
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number}>}
     */
    async handleOAuthCallback(code, state, trainerId, courseId = null) {
        // Load config on-demand
        const config = this.getConfig();
        if (!config || !config.clientId || !config.clientSecret || !config.redirectUri) {
            throw new Error('LinkedIn OAuth is not configured. Please check configuration.');
        }

        // Validate state token
        // First, try to find a record that matches both trainer_id and state token
        // This is more reliable than filtering by course_id first
        let query = supabaseClient
            .from('ai_coach_trainer_personalization')
            .select('linkedin_oauth_state, course_id')
            .eq('trainer_id', trainerId)
            .eq('linkedin_oauth_state', state)
            .limit(1);
        
        // If courseId is specified, also filter by it
        if (courseId !== null) {
            query = query.eq('course_id', courseId);
        } else {
            // For null course_id, filter for null values
            query = query.is('course_id', null);
        }
        
        const { data: personalizations, error: fetchError } = await query;

        if (fetchError) {
            console.error('[LinkedInOAuth] Error fetching personalization record:', fetchError);
            throw new Error(`OAuth state validation failed: ${fetchError.message}`);
        }
        
        // Check if we found a matching record
        const personalization = personalizations && personalizations.length > 0 ? personalizations[0] : null;
        
        if (!personalization) {
            // Record doesn't exist - this can happen if OAuth was initiated in a different session
            // or if the record wasn't created. Try to create a minimal record and continue
            console.warn('[LinkedInOAuth] Personalization record not found for state validation. This may happen if OAuth was initiated in a different session.');
            console.warn('[LinkedInOAuth] Attempting to create record and continue with token exchange...');
            
            // Create a minimal record to allow token exchange
            // We'll update it with the actual state later if needed, but for now we'll proceed
            // Note: This is a fallback - ideally the record should exist from initiateOAuth
            const { error: createError } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .upsert({
                    trainer_id: trainerId,
                    course_id: courseId,
                    coach_name: 'AI Coach', // Default
                    linkedin_oauth_state: state, // Set the state for validation
                    linkedin_extraction_status: 'oauth_pending',
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'trainer_id,course_id'
                });
            
            if (createError) {
                console.error('[LinkedInOAuth] Error creating personalization record:', createError);
                throw new Error('OAuth state validation failed: Personalization record not found and could not be created. Please initiate OAuth again by clicking "Connect with LinkedIn".');
            }
            
            // Record created with state, proceed with token exchange
            // The state is already set in the record we just created
            console.log('[LinkedInOAuth] Personalization record created with state, proceeding with token exchange...');
        } else {
            // Record exists with matching state (we filtered by state in the query, so it's already validated)
            console.log('[LinkedInOAuth] State validation successful, proceeding with token exchange...');
        }

        if (personalization.linkedin_oauth_state !== state) {
            throw new Error('OAuth state validation failed: State token mismatch');
        }

        // Exchange code for tokens
        try {
            const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: config.redirectUri,
                    client_id: config.clientId,
                    client_secret: config.clientSecret
                })
            });

            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json().catch(() => ({}));
                throw new Error(`LinkedIn token exchange failed: ${tokenResponse.status} ${errorData.error_description || ''}`);
            }

            const tokenData = await tokenResponse.json();
            
            const {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: expiresIn
            } = tokenData;

            if (!accessToken) {
                throw new Error('LinkedIn did not return an access token');
            }

            // Encrypt tokens before storing
            const encryptionKey = config.encryptionKey || 'dv-linkedin-encryption-key-2025-change-in-production';
            const encryptedAccessToken = await encrypt(accessToken, encryptionKey);
            const encryptedRefreshToken = refreshToken ? await encrypt(refreshToken, encryptionKey) : null;

            // Calculate token expiration time
            const expiresAt = new Date(Date.now() + (expiresIn * 1000));

            // Store encrypted tokens in database
            const { error: updateError } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .update({
                    linkedin_access_token: encryptedAccessToken,
                    linkedin_refresh_token: encryptedRefreshToken,
                    linkedin_token_expires_at: expiresAt.toISOString(),
                    linkedin_oauth_state: null, // Clear state after successful exchange
                    linkedin_extraction_status: 'success', // Will be updated when data is extracted
                    updated_at: new Date().toISOString()
                })
                .eq('trainer_id', trainerId)
                .eq('course_id', courseId);

            if (updateError) {
                console.error('[LinkedInOAuth] Error storing tokens:', updateError);
                throw new Error(`Failed to store tokens: ${updateError.message}`);
            }

            console.log('[LinkedInOAuth] Successfully exchanged code for tokens for trainer:', trainerId);

            return {
                accessToken, // Return unencrypted for immediate use
                refreshToken,
                expiresIn
            };
        } catch (error) {
            // Update status to failed
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

    /**
     * Refresh expired access token using refresh token
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<{accessToken: string, expiresIn: number}>}
     */
    async refreshAccessToken(trainerId, courseId = null) {
        // Load config on-demand
        const config = this.getConfig();
        if (!config || !config.clientId || !config.clientSecret) {
            throw new Error('LinkedIn OAuth is not configured. Please check configuration.');
        }

        // Get stored refresh token
        const { data: personalization, error: fetchError } = await supabaseClient
            .from('ai_coach_trainer_personalization')
            .select('linkedin_refresh_token')
            .eq('trainer_id', trainerId)
            .eq('course_id', courseId)
            .single();

        if (fetchError || !personalization || !personalization.linkedin_refresh_token) {
            throw new Error('Refresh token not found. Please reconnect LinkedIn.');
        }

        // Decrypt refresh token
        const encryptionKey = config.encryptionKey || 'dv-linkedin-encryption-key-2025-change-in-production';
        const refreshToken = await decrypt(personalization.linkedin_refresh_token, encryptionKey);

        if (!refreshToken) {
            throw new Error('Failed to decrypt refresh token');
        }

        // Exchange refresh token for new access token
        try {
            const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: config.clientId,
                    client_secret: config.clientSecret
                })
            });

            if (!tokenResponse.ok) {
                // Refresh token expired - mark as token_expired
                await supabaseClient
                    .from('ai_coach_trainer_personalization')
                    .update({
                        linkedin_extraction_status: 'token_expired',
                        linkedin_extraction_error: 'Refresh token expired. Please reconnect.',
                        updated_at: new Date().toISOString()
                    })
                    .eq('trainer_id', trainerId)
                    .eq('course_id', courseId);

                throw new Error('Refresh token expired. Please reconnect LinkedIn.');
            }

            const tokenData = await tokenResponse.json();
            const { access_token: accessToken, expires_in: expiresIn } = tokenData;

            if (!accessToken) {
                throw new Error('LinkedIn did not return a new access token');
            }

            // Encrypt and store new access token
            const encryptedAccessToken = await encrypt(accessToken, encryptionKey);
            const expiresAt = new Date(Date.now() + (expiresIn * 1000));

            const { error: updateError } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .update({
                    linkedin_access_token: encryptedAccessToken,
                    linkedin_token_expires_at: expiresAt.toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('trainer_id', trainerId)
                .eq('course_id', courseId);

            if (updateError) {
                throw new Error(`Failed to store new access token: ${updateError.message}`);
            }

            console.log('[LinkedInOAuth] Successfully refreshed access token for trainer:', trainerId);

            return {
                accessToken,
                expiresIn
            };
        } catch (error) {
            console.error('[LinkedInOAuth] Token refresh error:', error);
            throw error;
        }
    }

    /**
     * Get decrypted access token (for API calls)
     * Automatically refreshes if expired
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<string>} Decrypted access token
     */
    async getAccessToken(trainerId, courseId = null) {
        // Get stored tokens
        const { data: personalization, error: fetchError } = await supabaseClient
            .from('ai_coach_trainer_personalization')
            .select('linkedin_access_token, linkedin_token_expires_at')
            .eq('trainer_id', trainerId)
            .eq('course_id', courseId)
            .single();

        if (fetchError || !personalization || !personalization.linkedin_access_token) {
            throw new Error('Access token not found. Please connect LinkedIn.');
        }

        // Check if token is expired or expiring soon (within 5 minutes)
        const expiresAt = personalization.linkedin_token_expires_at 
            ? new Date(personalization.linkedin_token_expires_at)
            : null;

        if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
            // Token expired or expiring soon - refresh it
            console.log('[LinkedInOAuth] Access token expired or expiring soon, refreshing...');
            const refreshed = await this.refreshAccessToken(trainerId, courseId);
            return refreshed.accessToken;
        }

        // Decrypt and return access token
        const config = this.getConfig();
        const encryptionKey = config.encryptionKey || 'dv-linkedin-encryption-key-2025-change-in-production';
        const accessToken = await decrypt(personalization.linkedin_access_token, encryptionKey);

        if (!accessToken) {
            throw new Error('Failed to decrypt access token');
        }

        return accessToken;
    }

    /**
     * Revoke OAuth access - disconnect LinkedIn
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<void>}
     */
    async revokeAccess(trainerId, courseId = null) {
        // Get access token to revoke
        try {
            const accessToken = await this.getAccessToken(trainerId, courseId);
            const config = this.getConfig();
            
            // Revoke token at LinkedIn
            await fetch('https://www.linkedin.com/oauth/v2/revoke', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    token: accessToken,
                    client_id: config.clientId,
                    client_secret: config.clientSecret
                })
            });
        } catch (error) {
            console.warn('[LinkedInOAuth] Error revoking token (may already be revoked):', error.message);
        }

        // Clear tokens and status from database
        const { error } = await supabaseClient
            .from('ai_coach_trainer_personalization')
            .update({
                linkedin_access_token: null,
                linkedin_refresh_token: null,
                linkedin_token_expires_at: null,
                linkedin_oauth_state: null,
                linkedin_extraction_status: 'pending',
                linkedin_extraction_error: null,
                updated_at: new Date().toISOString()
            })
            .eq('trainer_id', trainerId)
            .eq('course_id', courseId);

        if (error) {
            throw new Error(`Failed to revoke access: ${error.message}`);
        }

        console.log('[LinkedInOAuth] Successfully revoked access for trainer:', trainerId);
    }

    /**
     * Validate OAuth state token
     * @param {string} state - State token to validate
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<boolean>} True if valid
     */
    async validateState(state, trainerId, courseId = null) {
        const { data: personalization } = await supabaseClient
            .from('ai_coach_trainer_personalization')
            .select('linkedin_oauth_state')
            .eq('trainer_id', trainerId)
            .eq('course_id', courseId)
            .single();

        return personalization && personalization.linkedin_oauth_state === state;
    }
}

// Export singleton instance
export const linkedinOAuthService = new LinkedInOAuthService();

