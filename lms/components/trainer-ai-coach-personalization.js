/**
 * Trainer AI Coach Personalization Component
 * 
 * Form for trainers to set up their AI Coach persona.
 * Allows trainers to customize coach name, LinkedIn profile, and trainer information.
 */

import { authService } from '../services/auth-service.js';
import { trainerPersonalizationService } from '../services/trainer-personalization-service.js';
import { supabaseClient } from '../services/supabase-client.js';
import { router } from '../core/router.js';
import Header from './header.js';

class TrainerAICoachPersonalization {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.personalizations = []; // Array of {course_id, personalization}
        this.courses = [];
    }

    /**
     * Show personalization page
     */
    async show() {
        if (this.container) {
            this.container.style.display = 'block';
        }

        await this.renderHeader();
        await this.loadData();
        this.render();
    }

    /**
     * Render header
     */
    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    /**
     * Load all data
     */
    async loadData() {
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                router.navigate('/login');
                return;
            }

            // Load courses assigned to this trainer
            await this.loadCourses();
            
            // Load existing personalizations
            await this.loadPersonalizations();
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error loading data:', error);
            this.renderError('Failed to load data: ' + error.message);
        }
    }

    /**
     * Load courses assigned to trainer
     */
    async loadCourses() {
        try {
            const { data, error } = await supabaseClient
                .from('course_allocations')
                .select('course_id, trainer_id')
                .eq('trainer_id', this.currentUser.id)
                .eq('status', 'active');

            if (error) throw error;

            const courseIds = [...new Set((data || []).map(a => a.course_id))];
            
            // Get course details
            const { getCourses } = await import('../../data/courses.js');
            const allCourses = await getCourses();
            this.courses = allCourses.filter(c => courseIds.includes(c.id));
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error loading courses:', error);
            this.courses = [];
        }
    }

    /**
     * Load existing personalizations
     */
    async loadPersonalizations() {
        try {
            const { data, error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .select('*')
                .eq('trainer_id', this.currentUser.id);

            if (error) throw error;

            // Create a map of course_id -> personalization
            this.personalizations = {};
            (data || []).forEach(p => {
                const key = p.course_id || 'global';
                this.personalizations[key] = p;
            });

            // Check for OAuth callback
            await this.handleOAuthCallbackIfPresent();
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error loading personalizations:', error);
            this.personalizations = {};
        }
    }

    /**
     * Handle OAuth callback if present in URL
     */
    async handleOAuthCallbackIfPresent() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            
            // Check for standard OAuth callback (code & state)
            const code = urlParams.get('code') || hashParams.get('code');
            const state = urlParams.get('state') || hashParams.get('state');
            const error = urlParams.get('error') || hashParams.get('error');
            const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
            
            // Check for WordPress callback format (auth=linkedin&token=...&uid=...)
            const authType = urlParams.get('auth') || hashParams.get('auth');
            const wpToken = urlParams.get('token') || hashParams.get('token');
            const wpUid = urlParams.get('uid') || hashParams.get('uid');

            // Check if this is a LinkedIn OAuth callback
            if (code || error || (authType === 'linkedin' && wpToken)) {
                // Remove OAuth params from URL
                const newUrl = window.location.pathname + (window.location.hash.split('?')[0] || '');
                window.history.replaceState({}, document.title, newUrl);

                if (error) {
                    // OAuth error
                    let errorMessage = 'LinkedIn authorization failed.';
                    if (error === 'user_cancelled') {
                        errorMessage = 'LinkedIn authorization was cancelled. Please try again.';
                    } else if (errorDescription) {
                        errorMessage = `LinkedIn authorization failed: ${errorDescription}`;
                    }
                    this.showMessage(`❌ ${errorMessage}`, 'error');
                    return;
                }

                // Handle WordPress callback format
                if (authType === 'linkedin' && wpToken && wpUid) {
                    console.log('[TrainerAICoachPersonalization] WordPress callback detected. LinkedIn OAuth was handled server-side.');
                    console.log('[TrainerAICoachPersonalization] WordPress token:', wpToken, 'UID:', wpUid);
                    
                    // WordPress has already handled the OAuth exchange
                    // The WordPress token is for WordPress authentication, not LinkedIn OAuth
                    // We need to check if WordPress stored LinkedIn tokens in our database
                    // or if we need to fetch them from WordPress API
                    
                    this.showMessage('⏳ LinkedIn connection detected. Processing...', 'info');
                    
                    try {
                        // First, clear the oauth_pending status since WordPress handled the OAuth
                        // Update all personalization records for this trainer to clear oauth_pending
                        const { error: updateError } = await supabaseClient
                            .from('ai_coach_trainer_personalization')
                            .update({
                                linkedin_extraction_status: null, // Clear oauth_pending
                                linkedin_oauth_state: null,
                                updated_at: new Date().toISOString()
                            })
                            .eq('trainer_id', this.currentUser.id)
                            .eq('linkedin_extraction_status', 'oauth_pending');
                        
                        if (updateError) {
                            console.warn('[TrainerAICoachPersonalization] Error clearing oauth_pending status:', updateError);
                        }
                        
                        // Reload personalizations to get updated status
                        await this.loadPersonalizations();
                        
                        // Check if we have LinkedIn tokens stored (WordPress might have stored them)
                        // this.personalizations is an object, not an array
                        const personalizationsArray = Object.values(this.personalizations || {});
                        const hasLinkedInTokens = personalizationsArray.some(p => 
                            p && p.linkedin_access_token
                        );
                        
                        if (hasLinkedInTokens) {
                            // Try to extract LinkedIn data using stored tokens
                            console.log('[TrainerAICoachPersonalization] LinkedIn tokens found, extracting profile data...');
                            await trainerPersonalizationService.extractLinkedInData(this.currentUser.id, null);
                            await this.loadPersonalizations();
                            this.render();
                            this.showMessage('✅ LinkedIn connected successfully! Your profile data has been extracted.', 'success');
                        } else {
                            // WordPress handled OAuth but tokens aren't in our database
                            // This means WordPress is storing tokens separately
                            // We need to either:
                            // 1. Have WordPress store tokens in our DB (requires WordPress plugin update)
                            // 2. Fetch tokens from WordPress API (requires WordPress API endpoint)
                            // 3. Show message that manual setup is needed
                            console.warn('[TrainerAICoachPersonalization] LinkedIn OAuth completed via WordPress, but tokens not found in database.');
                            console.warn('[TrainerAICoachPersonalization] WordPress may be storing tokens separately. Manual extraction may be needed.');
                            
                            // Clear the pending status so the UI doesn't show "waiting"
                            this.render();
                            this.showMessage('⚠️ LinkedIn authorization completed, but profile data extraction may need to be done manually. Please use "Refresh LinkedIn Data" button if available.', 'warning');
                        }
                    } catch (error) {
                        console.error('[TrainerAICoachPersonalization] Error processing WordPress callback:', error);
                        
                        // Clear oauth_pending status even on error to prevent stuck state
                        try {
                            await supabaseClient
                                .from('ai_coach_trainer_personalization')
                                .update({
                                    linkedin_extraction_status: null,
                                    linkedin_oauth_state: null,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('trainer_id', this.currentUser.id)
                                .eq('linkedin_extraction_status', 'oauth_pending');
                        } catch (clearError) {
                            console.error('[TrainerAICoachPersonalization] Error clearing oauth_pending:', clearError);
                        }
                        
                        await this.loadPersonalizations();
                        this.render();
                        this.showMessage('⚠️ LinkedIn connection detected, but data extraction failed. Please try refreshing or reconnecting.', 'warning');
                    }
                    return;
                }

                // Handle standard OAuth callback (code & state)
                if (!code || !state) {
                    this.showMessage('❌ Invalid OAuth callback. Missing code or state.', 'error');
                    return;
                }

                // Determine course_id from state or use global (null)
                const courseId = null; // Can be enhanced to extract from state

                // Show loading
                this.showMessage('⏳ Connecting LinkedIn and extracting data...', 'info');

                try {
                    // Handle OAuth callback
                    await trainerPersonalizationService.handleLinkedInCallback(
                        code,
                        state,
                        this.currentUser.id,
                        courseId
                    );

                    // Reload personalizations to show updated data
                    await this.loadPersonalizations();
                    this.render();

                    this.showMessage('✅ LinkedIn connected successfully! Your profile data has been extracted.', 'success');
                } catch (error) {
                    console.error('[TrainerAICoachPersonalization] OAuth callback error:', error);
                    this.showMessage(`❌ Failed to connect LinkedIn: ${error.message}`, 'error');
                }
            }
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error handling OAuth callback:', error);
        }
    }

    /**
     * Render the page
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="container" style="max-width: 900px; margin: 20px auto; padding: 20px;">
                <div class="card">
                    <div class="card-header" style="padding: 20px; border-bottom: 1px solid #e0e0e0;">
                        <h2 style="margin: 0;">🤖 AI Coach Persona Setup</h2>
                        <p style="margin: 10px 0 0 0; color: #666;">
                            Customize your AI Coach to reflect your personality and expertise. 
                            Learners will see your personalized coach when they ask questions.
                        </p>
                    </div>
                    <div class="card-body" style="padding: 20px;">
                        ${this.renderGlobalPersonalization()}
                        ${this.renderCoursePersonalizations()}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render global personalization form
     */
    renderGlobalPersonalization() {
        const global = this.personalizations['global'] || {};
        const trainerInfo = global.trainer_info || {};

        return `
            <div class="personalization-section" style="margin-bottom: 30px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h3 style="margin-top: 0;">🌐 Global Settings (All Courses)</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    These settings apply to all courses. You can override them with course-specific settings below.
                </p>
                <form id="global-personalization-form" class="personalization-form">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="global-coach-name" style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Coach Name <span style="color: red;">*</span>
                        </label>
                        <input 
                            type="text" 
                            id="global-coach-name" 
                            class="form-control" 
                            placeholder="e.g., John's AI Coach, Sarah's Assistant"
                            value="${this.escapeHtml(global.coach_name || '')}"
                            required
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                        <small style="color: #666; display: block; margin-top: 5px;">
                            This name will appear in the AI Coach widget header
                        </small>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            LinkedIn Connection
                        </label>
                        ${this.renderLinkedInConnectionSection(global, 'global')}
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="global-linkedin" style="display: block; margin-bottom: 5px; font-weight: 600;">
                            LinkedIn Profile URL (Optional - Manual Entry)
                        </label>
                        <input 
                            type="url" 
                            id="global-linkedin" 
                            class="form-control" 
                            placeholder="https://linkedin.com/in/yourprofile"
                            value="${this.escapeHtml(global.linkedin_profile_url || '')}"
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                        <small style="color: #666; display: block; margin-top: 5px;">
                            Enter manually if you prefer not to use OAuth connection above
                        </small>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="global-expertise" style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Expertise Areas
                        </label>
                        <input 
                            type="text" 
                            id="global-expertise" 
                            class="form-control" 
                            placeholder="e.g., SEO, Content Marketing, Technical SEO, Link Building"
                            value="${this.escapeHtml(trainerInfo.expertise || '')}"
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                        <small style="color: #666; display: block; margin-top: 5px;">
                            Comma-separated list of your expertise areas
                        </small>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="global-years" style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Years of Experience
                        </label>
                        <input 
                            type="number" 
                            id="global-years" 
                            class="form-control" 
                            placeholder="10"
                            value="${trainerInfo.years_experience || ''}"
                            min="0"
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="global-bio" style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Bio / About You
                            <small style="color: #666; font-weight: normal;"> (Optional - supplements LinkedIn headline)</small>
                        </label>
                        <textarea 
                            id="global-bio" 
                            class="form-control" 
                            rows="4"
                            maxlength="500"
                            placeholder="Enter additional information about yourself to supplement your LinkedIn headline..."
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
                        >${this.escapeHtml(global.trainer_bio || trainerInfo.bio || '')}</textarea>
                        <small style="color: #666; display: block; margin-top: 5px;">
                            This will be displayed along with your LinkedIn headline (if connected via OAuth). Character limit: 500.
                        </small>
                        <div id="global-bio-count" style="text-align: right; color: #666; font-size: 12px; margin-top: 5px;"></div>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="global-share-level" style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Share Level
                        </label>
                        <select 
                            id="global-share-level" 
                            class="form-control"
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"
                        >
                            <option value="name_only" ${global.share_level === 'name_only' ? 'selected' : ''}>
                                Name Only - Just show the coach name
                            </option>
                            <option value="name_expertise" ${global.share_level === 'name_expertise' ? 'selected' : ''}>
                                Name + Expertise - Show name and expertise areas
                            </option>
                            <option value="full" ${global.share_level === 'full' || !global.share_level ? 'selected' : ''}>
                                Full - Show name, expertise, bio, and LinkedIn
                            </option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input 
                                type="checkbox" 
                                id="global-enabled" 
                                ${global.personalization_enabled !== false ? 'checked' : ''}
                                style="margin-right: 8px;"
                            />
                            <span>Enable personalization</span>
                        </label>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input 
                                type="checkbox" 
                                id="global-auto-refresh" 
                                ${global.auto_refresh_enabled === true ? 'checked' : ''}
                                style="margin-right: 8px;"
                            />
                            <span>Enable automatic weekly refresh from LinkedIn</span>
                        </label>
                        <small style="color: #666; display: block; margin-top: 5px; margin-left: 24px;">
                            Automatically refresh your LinkedIn data once per week
                        </small>
                    </div>

                    <button 
                        type="submit" 
                        class="btn btn-primary"
                        style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;"
                    >
                        Save Global Settings
                    </button>
                </form>
            </div>
        `;
    }

    /**
     * Render LinkedIn connection section
     * @param {Object} personalization - Personalization object
     * @param {string} prefix - Prefix for form element IDs ('global' or course ID)
     * @returns {string} HTML for LinkedIn connection section
     */
    renderLinkedInConnectionSection(personalization, prefix) {
        const isConnected = personalization.linkedin_profile_id && 
                           personalization.linkedin_extraction_status === 'success';
        const status = personalization.linkedin_extraction_status || 'pending';
        const trainerInfo = personalization.trainer_info || {};
        const linkedinName = trainerInfo.name || '';
        const lastRefreshed = personalization.last_refreshed_at 
            ? new Date(personalization.last_refreshed_at).toLocaleString() 
            : null;
        const linkedinUrl = personalization.linkedin_profile_url || '';

        return `
            <div class="linkedin-connection-section" style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background: #f9f9f9;">
                ${isConnected ? `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div>
                                <span style="color: #28a745; font-weight: 600;">✓ Connected to LinkedIn</span>
                                ${linkedinName ? `<div style="color: #666; font-size: 14px; margin-top: 5px;">Profile: ${this.escapeHtml(linkedinName)}</div>` : ''}
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-link linkedin-disconnect-btn" 
                                data-prefix="${prefix}"
                                style="padding: 5px 10px; color: #dc3545; text-decoration: none; border: none; background: none; cursor: pointer; font-size: 14px;"
                            >
                                Disconnect
                            </button>
                        </div>
                        ${lastRefreshed ? `
                            <div style="color: #666; font-size: 12px; margin-bottom: 10px;">
                                Last synced: ${lastRefreshed}
                            </div>
                        ` : ''}
                        <div style="display: flex; gap: 10px;">
                            <button 
                                type="button" 
                                class="btn btn-secondary linkedin-refresh-btn" 
                                data-prefix="${prefix}"
                                style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;"
                            >
                                🔄 Refresh from LinkedIn
                            </button>
                        </div>
                    </div>
                ` : `
                    <div>
                        <button 
                            type="button" 
                            class="btn btn-primary linkedin-connect-btn" 
                            data-prefix="${prefix}"
                            style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600;"
                        >
                            🔗 Connect with LinkedIn
                        </button>
                        <small style="color: #666; display: block; margin-top: 8px;">
                            Connect your LinkedIn profile to automatically extract your name, headline, and photo
                        </small>
                        ${status === 'oauth_pending' ? `
                            <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404;">
                                ⏳ Waiting for LinkedIn authorization...
                            </div>
                        ` : status === 'failed' ? `
                            <div style="margin-top: 10px; padding: 10px; background: #f8d7da; border: 1px solid #dc3545; border-radius: 4px; color: #721c24;">
                                ❌ Connection failed: ${this.escapeHtml(personalization.linkedin_extraction_error || 'Unknown error')}
                            </div>
                        ` : status === 'token_expired' ? `
                            <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404;">
                                ⚠️ Connection expired. Please reconnect.
                            </div>
                        ` : ''}
                    </div>
                `}
                ${isConnected && trainerInfo.headline ? `
                    <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 4px; border-left: 3px solid #007bff;">
                        <div style="font-weight: 600; margin-bottom: 5px;">LinkedIn Headline:</div>
                        <div style="color: #666; font-size: 14px;">${this.escapeHtml(trainerInfo.headline)}</div>
                        <small style="color: #999; display: block; margin-top: 5px;">
                            Full bio not available on free tier. You can add a manual bio below.
                        </small>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render course-specific personalizations
     */
    renderCoursePersonalizations() {
        if (this.courses.length === 0) {
            return `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <p>No courses assigned. Course-specific personalization will appear here once you're assigned to courses.</p>
                </div>
            `;
        }

        return `
            <div class="course-personalizations">
                <h3 style="margin-top: 0;">📚 Course-Specific Settings</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Override global settings for specific courses. Leave blank to use global settings.
                </p>
                ${this.courses.map(course => this.renderCourseForm(course)).join('')}
            </div>
        `;
    }

    /**
     * Render form for a specific course
     */
    renderCourseForm(course) {
        const personalization = this.personalizations[course.id] || {};
        const trainerInfo = personalization.trainer_info || {};

        return `
            <div class="course-personalization" style="margin-bottom: 20px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h4 style="margin-top: 0;">${this.escapeHtml(course.title || course.id)}</h4>
                <form class="personalization-form" data-course-id="${course.id}">
                    <input type="hidden" name="course_id" value="${course.id}" />
                    
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Coach Name
                        </label>
                        <input 
                            type="text" 
                            class="form-control course-coach-name" 
                            placeholder="Leave blank to use global setting"
                            value="${this.escapeHtml(personalization.coach_name || '')}"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            LinkedIn Connection
                        </label>
                        ${this.renderLinkedInConnectionSection(personalization, course.id)}
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            LinkedIn Profile URL (Optional - Manual Entry)
                        </label>
                        <input 
                            type="url" 
                            class="form-control course-linkedin" 
                            placeholder="Leave blank to use global setting"
                            value="${this.escapeHtml(personalization.linkedin_profile_url || '')}"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Expertise Areas
                        </label>
                        <input 
                            type="text" 
                            class="form-control course-expertise" 
                            placeholder="Leave blank to use global setting"
                            value="${this.escapeHtml(trainerInfo.expertise || '')}"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Years of Experience
                        </label>
                        <input 
                            type="number" 
                            class="form-control course-years" 
                            placeholder="Leave blank to use global setting"
                            value="${trainerInfo.years_experience || ''}"
                            min="0"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Bio
                            <small style="color: #666; font-weight: normal;"> (Optional - supplements LinkedIn headline)</small>
                        </label>
                        <textarea 
                            class="form-control course-bio" 
                            rows="3"
                            maxlength="500"
                            placeholder="Leave blank to use global setting"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
                        >${this.escapeHtml(personalization.trainer_bio || trainerInfo.bio || '')}</textarea>
                        <small style="color: #666; display: block; margin-top: 5px;">
                            Character limit: 500
                        </small>
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                            Share Level
                        </label>
                        <select 
                            class="form-control course-share-level"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                        >
                            <option value="">Use Global Setting</option>
                            <option value="name_only" ${personalization.share_level === 'name_only' ? 'selected' : ''}>
                                Name Only
                            </option>
                            <option value="name_expertise" ${personalization.share_level === 'name_expertise' ? 'selected' : ''}>
                                Name + Expertise
                            </option>
                            <option value="full" ${personalization.share_level === 'full' ? 'selected' : ''}>
                                Full
                            </option>
                        </select>
                    </div>

                    <button 
                        type="submit" 
                        class="btn btn-secondary save-course-btn"
                        style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;"
                    >
                        Save for ${this.escapeHtml(course.title || course.id)}
                    </button>
                </form>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Global form
        const globalForm = document.getElementById('global-personalization-form');
        if (globalForm) {
            globalForm.addEventListener('submit', (e) => this.handleGlobalSubmit(e));
        }

        // Course forms
        const courseForms = document.querySelectorAll('.personalization-form[data-course-id]');
        courseForms.forEach(form => {
            form.addEventListener('submit', (e) => this.handleCourseSubmit(e));
        });

        // LinkedIn connection buttons
        const connectButtons = document.querySelectorAll('.linkedin-connect-btn');
        connectButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLinkedInConnect(e));
        });

        // LinkedIn refresh buttons
        const refreshButtons = document.querySelectorAll('.linkedin-refresh-btn');
        refreshButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLinkedInRefresh(e));
        });

        // LinkedIn disconnect buttons
        const disconnectButtons = document.querySelectorAll('.linkedin-disconnect-btn');
        disconnectButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleLinkedInDisconnect(e));
        });

        // Bio character counter
        const bioFields = document.querySelectorAll('textarea[id*="bio"], textarea.course-bio');
        bioFields.forEach(field => {
            field.addEventListener('input', (e) => this.updateBioCounter(e.target));
            this.updateBioCounter(field); // Initial update
        });

        // Auto-refresh checkbox
        const autoRefreshCheckbox = document.getElementById('global-auto-refresh');
        if (autoRefreshCheckbox) {
            autoRefreshCheckbox.addEventListener('change', (e) => {
                this.handleAutoRefreshToggle(null, e.target.checked);
            });
        }
    }

    /**
     * Update bio character counter
     */
    updateBioCounter(textarea) {
        const length = textarea.value.length;
        const maxLength = textarea.maxLength || 500;
        const counterId = textarea.id ? `${textarea.id}-count` : null;
        const counter = counterId ? document.getElementById(counterId) : 
                       textarea.nextElementSibling?.querySelector('[id$="-count"]');
        
        if (counter) {
            counter.textContent = `${length}/${maxLength} characters`;
            counter.style.color = length > maxLength * 0.9 ? '#dc3545' : '#666';
        }
    }

    /**
     * Handle LinkedIn connect button click
     */
    async handleLinkedInConnect(e) {
        e.preventDefault();
        const prefix = e.target.dataset.prefix;
        const courseId = prefix === 'global' ? null : prefix;

        try {
            const button = e.target;
            const originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '⏳ Connecting...';

            // Initiate OAuth flow
            const result = await trainerPersonalizationService.connectLinkedIn(
                this.currentUser.id,
                courseId
            );

            // Redirect to LinkedIn authorization page
            window.location.href = result.authorizationUrl;
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error connecting LinkedIn:', error);
            this.showMessage(`❌ Failed to connect LinkedIn: ${error.message}`, 'error');
            e.target.disabled = false;
            e.target.innerHTML = '🔗 Connect with LinkedIn';
        }
    }

    /**
     * Handle LinkedIn refresh button click
     */
    async handleLinkedInRefresh(e) {
        e.preventDefault();
        const prefix = e.target.dataset.prefix;
        const courseId = prefix === 'global' ? null : prefix;

        try {
            const button = e.target;
            const originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '⏳ Refreshing...';

            this.showMessage('⏳ Refreshing LinkedIn data...', 'info');

            // Refresh LinkedIn data
            await trainerPersonalizationService.refreshLinkedInData(
                this.currentUser.id,
                courseId
            );

            // Reload personalizations
            await this.loadPersonalizations();
            this.render();

            this.showMessage('✅ LinkedIn data refreshed successfully!', 'success');
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error refreshing LinkedIn:', error);
            this.showMessage(`❌ Failed to refresh LinkedIn data: ${error.message}`, 'error');
        } finally {
            e.target.disabled = false;
            e.target.innerHTML = originalText;
        }
    }

    /**
     * Handle LinkedIn disconnect button click
     */
    async handleLinkedInDisconnect(e) {
        e.preventDefault();
        const prefix = e.target.dataset.prefix;
        const courseId = prefix === 'global' ? null : prefix;

        // Confirm disconnect
        if (!confirm('Are you sure you want to disconnect LinkedIn? Your extracted data will be removed.')) {
            return;
        }

        try {
            const button = e.target;
            button.disabled = true;
            button.innerHTML = 'Disconnecting...';

            this.showMessage('⏳ Disconnecting LinkedIn...', 'info');

            // Disconnect LinkedIn
            await trainerPersonalizationService.disconnectLinkedIn(
                this.currentUser.id,
                courseId
            );

            // Reload personalizations
            await this.loadPersonalizations();
            this.render();

            this.showMessage('✅ LinkedIn disconnected successfully!', 'success');
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error disconnecting LinkedIn:', error);
            this.showMessage(`❌ Failed to disconnect LinkedIn: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = 'Disconnect';
        }
    }

    /**
     * Handle auto-refresh toggle
     */
    async handleAutoRefreshToggle(courseId, enabled) {
        try {
            await trainerPersonalizationService.updatePersonalization(
                this.currentUser.id,
                courseId,
                { auto_refresh_enabled: enabled }
            );

            this.showMessage(`✅ Auto-refresh ${enabled ? 'enabled' : 'disabled'}`, 'success');
            
            // Reload to show updated status
            await this.loadPersonalizations();
            this.render();
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error toggling auto-refresh:', error);
            this.showMessage(`❌ Failed to update auto-refresh: ${error.message}`, 'error');
        }
    }

    /**
     * Handle global form submission
     */
    async handleGlobalSubmit(e) {
        e.preventDefault();

        const formData = {
            trainer_id: this.currentUser.id,
            course_id: null, // Global
            coach_name: document.getElementById('global-coach-name').value.trim(),
            linkedin_profile_url: document.getElementById('global-linkedin').value.trim() || null,
            trainer_bio: document.getElementById('global-bio').value.trim() || null,
            trainer_info: {
                expertise: document.getElementById('global-expertise').value.trim() || null,
                years_experience: parseInt(document.getElementById('global-years').value) || null,
                bio: document.getElementById('global-bio').value.trim() || null // Legacy field
            },
            personalization_enabled: document.getElementById('global-enabled').checked,
            auto_refresh_enabled: document.getElementById('global-auto-refresh')?.checked || false,
            share_level: document.getElementById('global-share-level').value
        };

        // Remove null values from trainer_info
        Object.keys(formData.trainer_info).forEach(key => {
            if (formData.trainer_info[key] === null) {
                delete formData.trainer_info[key];
            }
        });

        await this.savePersonalization(formData, 'Global');
    }

    /**
     * Handle course form submission
     */
    async handleCourseSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const courseId = form.dataset.courseId;
        const courseName = this.courses.find(c => c.id === courseId)?.title || courseId;

        // Get global values as defaults
        const global = this.personalizations['global'] || {};
        const globalTrainerInfo = global.trainer_info || {};

        const formData = {
            trainer_id: this.currentUser.id,
            course_id: courseId,
            coach_name: form.querySelector('.course-coach-name').value.trim() || global.coach_name || null,
            linkedin_profile_url: form.querySelector('.course-linkedin').value.trim() || global.linkedin_profile_url || null,
            trainer_bio: form.querySelector('.course-bio').value.trim() || null,
            trainer_info: {
                expertise: form.querySelector('.course-expertise').value.trim() || globalTrainerInfo.expertise || null,
                years_experience: parseInt(form.querySelector('.course-years').value) || globalTrainerInfo.years_experience || null,
                bio: form.querySelector('.course-bio').value.trim() || globalTrainerInfo.bio || null // Legacy field
            },
            personalization_enabled: true,
            share_level: form.querySelector('.course-share-level').value || global.share_level || 'full'
        };

        // Remove null values
        Object.keys(formData.trainer_info).forEach(key => {
            if (formData.trainer_info[key] === null) {
                delete formData.trainer_info[key];
            }
        });

        await this.savePersonalization(formData, courseName);
    }

    /**
     * Save personalization to database
     */
    async savePersonalization(formData, displayName) {
        try {
            // Ensure trainer_info is properly formatted as JSONB
            const dataToSave = {
                trainer_id: formData.trainer_id,
                course_id: formData.course_id,
                coach_name: formData.coach_name,
                linkedin_profile_url: formData.linkedin_profile_url,
                trainer_bio: formData.trainer_bio || null,
                trainer_info: formData.trainer_info,
                personalization_enabled: formData.personalization_enabled,
                auto_refresh_enabled: formData.auto_refresh_enabled !== undefined ? formData.auto_refresh_enabled : null,
                share_level: formData.share_level,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('ai_coach_trainer_personalization')
                .upsert(dataToSave, {
                    onConflict: 'trainer_id,course_id'
                })
                .select()
                .single();

            if (error) throw error;

            // Update local cache
            const key = formData.course_id || 'global';
            this.personalizations[key] = data;

            // Clear service cache
            trainerPersonalizationService.clearCache(formData.course_id);

            // Show success message
            this.showMessage(`✅ ${displayName} personalization saved successfully!`, 'success');
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error saving personalization:', error);
            this.showMessage(`❌ Failed to save: ${error.message}`, 'error');
        }
    }

    /**
     * Show message
     */
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `alert alert-${type}`;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        messageEl.textContent = message;
        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }

    /**
     * Render error
     */
    renderError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="alert alert-danger" style="margin: 20px; padding: 15px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;">
                <strong>Error:</strong> ${this.escapeHtml(message)}
            </div>
        `;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default TrainerAICoachPersonalization;

