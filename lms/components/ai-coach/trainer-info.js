/**
 * Trainer Info Component
 * 
 * Displays trainer information on the AI Coach page.
 * Shows trainer name, photo, bio, and LinkedIn profile link based on share level.
 */

import { trainerPersonalizationService } from '../../services/trainer-personalization-service.js';

class TrainerInfo {
    constructor(container) {
        this.container = container;
        this.personalization = null;
    }

    /**
     * Render trainer info
     * @param {string} courseId - Course ID
     * @param {string} learnerId - Optional learner ID
     */
    async render(courseId, learnerId = null) {
        if (!this.container || !courseId) {
            return;
        }

        try {
            // Load trainer personalization
            this.personalization = await trainerPersonalizationService.getPersonalizationForCourse(
                courseId,
                learnerId
            );

            if (!this.personalization || !this.personalization.personalization_enabled) {
                // Show default placeholder
                this.renderPlaceholder();
                return;
            }

            const shareLevel = this.personalization.share_level || 'name_only';
            const trainerInfo = this.personalization.trainer_info || {};
            const trainerName = trainerInfo.name || this.personalization.coach_name || 'Your Trainer';

            // Build HTML with two-column layout (Photo left, Info right)
            let html = '<div class="trainer-info-card">';
            
            // Left Column: Photo
            html += '<div class="trainer-info-photo-column">';
            if (shareLevel === 'full' && this.personalization.trainer_photo_url) {
                html += `
                    <img 
                        src="${this.escapeHtml(this.personalization.trainer_photo_url)}" 
                        alt="${this.escapeHtml(trainerName)}"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        class="trainer-avatar-img"
                    />
                    <div class="trainer-avatar-fallback" style="display: none;">
                        ${this.getInitials(trainerName)}
                    </div>
                `;
            } else if (shareLevel === 'full') {
                html += `
                    <div class="trainer-avatar-fallback">
                        ${this.getInitials(trainerName)}
                    </div>
                `;
            } else {
                html += `
                    <div class="trainer-avatar-fallback trainer-avatar-placeholder">
                        👤
                    </div>
                `;
            }
            html += '</div>'; // End Photo Column

            // Right Column: Name, Bio, Expertise (each in separate rows)
            html += '<div class="trainer-info-content-column">';
            
            // Row 1: Name
            html += `
                <div class="trainer-info-row trainer-info-row-name">
                    <div class="trainer-info-name">
                        ${this.escapeHtml(trainerName)}
                    </div>
                </div>
            `;

            // Row 2: Bio/Headline (if share level permits)
            if (shareLevel === 'name_expertise' || shareLevel === 'full') {
                const bio = this.getBio();
                if (bio) {
                    const maxBioLength = 120;
                    const displayBio = bio.length > maxBioLength ? bio.substring(0, maxBioLength) + '...' : bio;
                    html += `
                        <div class="trainer-info-row trainer-info-row-bio">
                            <div class="trainer-info-role">
                                ${this.escapeHtml(displayBio)}
                            </div>
                        </div>
                    `;
                }
            }

            // Row 3: Expertise (if available)
            if ((shareLevel === 'name_expertise' || shareLevel === 'full') && trainerInfo.expertise) {
                html += `
                    <div class="trainer-info-row trainer-info-row-expertise">
                        <div class="trainer-info-expertise">
                            <span class="trainer-info-label">Expertise:</span>
                            <span class="trainer-info-value">${this.escapeHtml(trainerInfo.expertise)}</span>
                        </div>
                    </div>
                `;
            }

            // Row 4: LinkedIn link (if full share level and URL available)
            if (shareLevel === 'full' && this.personalization.linkedin_profile_url) {
                html += `
                    <div class="trainer-info-row trainer-info-row-linkedin">
                        <div class="trainer-info-linkedin">
                            <a 
                                href="${this.escapeHtml(this.personalization.linkedin_profile_url)}" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                class="trainer-linkedin-link"
                            >
                                <span class="trainer-linkedin-icon">🔗</span>
                                <span>LinkedIn</span>
                            </a>
                        </div>
                    </div>
                `;
            }

            html += '</div>'; // End Content Column
            html += '</div>'; // End trainer-info-card
            
            this.container.innerHTML = html;
        } catch (error) {
            console.error('[TrainerInfo] Error rendering trainer info:', error);
            this.renderPlaceholder();
        }
    }

    /**
     * Get bio text (manual bio > LinkedIn headline > placeholder)
     */
    getBio() {
        if (!this.personalization) return null;

        // Priority: Manual bio > LinkedIn headline > Legacy bio > Placeholder
        if (this.personalization.trainer_bio) {
            return this.personalization.trainer_bio;
        }

        const trainerInfo = this.personalization.trainer_info || {};
        if (trainerInfo.headline) {
            return trainerInfo.headline;
        }

        if (trainerInfo.bio) {
            return trainerInfo.bio;
        }

        return null; // Will show placeholder if none available
    }

    /**
     * Get initials from name
     */
    getInitials(name) {
        if (!name || name.trim() === '') return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Render placeholder when no personalization
     */
    renderPlaceholder() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="trainer-info-card">
                <div class="trainer-info-photo-column">
                    <div class="trainer-avatar-fallback trainer-avatar-placeholder">
                        👤
                    </div>
                </div>
                <div class="trainer-info-content-column">
                    <div class="trainer-info-row trainer-info-row-name">
                        <div class="trainer-info-name">Your Trainer</div>
                    </div>
                    <div class="trainer-info-row trainer-info-row-bio">
                        <div class="trainer-info-role">Professional Trainer</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default TrainerInfo;

