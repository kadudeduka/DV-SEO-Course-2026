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
        } catch (error) {
            console.error('[TrainerAICoachPersonalization] Error loading personalizations:', error);
            this.personalizations = {};
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
                        <label for="global-linkedin" style="display: block; margin-bottom: 5px; font-weight: 600;">
                            LinkedIn Profile URL
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
                            Share your LinkedIn profile with learners (optional)
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
                        </label>
                        <textarea 
                            id="global-bio" 
                            class="form-control" 
                            rows="4"
                            placeholder="Brief description of your background, experience, and what makes you unique..."
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
                        >${this.escapeHtml(trainerInfo.bio || '')}</textarea>
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
                            LinkedIn Profile URL
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
                        </label>
                        <textarea 
                            class="form-control course-bio" 
                            rows="3"
                            placeholder="Leave blank to use global setting"
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"
                        >${this.escapeHtml(trainerInfo.bio || '')}</textarea>
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
            trainer_info: {
                expertise: document.getElementById('global-expertise').value.trim() || null,
                years_experience: parseInt(document.getElementById('global-years').value) || null,
                bio: document.getElementById('global-bio').value.trim() || null
            },
            personalization_enabled: document.getElementById('global-enabled').checked,
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
            trainer_info: {
                expertise: form.querySelector('.course-expertise').value.trim() || globalTrainerInfo.expertise || null,
                years_experience: parseInt(form.querySelector('.course-years').value) || globalTrainerInfo.years_experience || null,
                bio: form.querySelector('.course-bio').value.trim() || globalTrainerInfo.bio || null
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
                trainer_info: formData.trainer_info,
                personalization_enabled: formData.personalization_enabled,
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

