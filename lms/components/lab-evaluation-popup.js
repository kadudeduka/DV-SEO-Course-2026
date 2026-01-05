/**
 * Lab Evaluation Popup Component
 * 
 * Displays a popup when a trainer evaluates a learner's lab submission.
 * Shows evaluation results including status, score, and feedback.
 */

import { labSubmissionService } from '../services/lab-submission-service.js';
import { authService } from '../services/auth-service.js';
import { courseService } from '../services/course-service.js';
import { router } from '../core/router.js';

class LabEvaluationPopup {
    constructor() {
        this.container = null;
        this.currentUser = null;
        this.pollingInterval = null;
        this.lastCheckedTimestamp = null;
        this.shownSubmissionIds = new Set(); // Track which submissions we've already shown
        this.isVisible = false;
        this.currentEvaluation = null;
    }

    /**
     * Initialize the popup component
     */
    async init() {
        console.log('[LabEvaluationPopup] Initializing...');
        
        // Create container if it doesn't exist
        if (!document.getElementById('lab-evaluation-popup-container')) {
            const container = document.createElement('div');
            container.id = 'lab-evaluation-popup-container';
            document.body.appendChild(container);
            console.log('[LabEvaluationPopup] Container created');
        }
        this.container = document.getElementById('lab-evaluation-popup-container');

        // Get current user
        this.currentUser = await authService.getCurrentUser();
        console.log('[LabEvaluationPopup] Current user:', this.currentUser ? { id: this.currentUser.id, role: this.currentUser.role } : 'null');
        
        // Only initialize for learners
        if (!this.currentUser || this.currentUser.role !== 'learner') {
            console.log('[LabEvaluationPopup] Not a learner, skipping initialization');
            return;
        }

        // Load last checked timestamp from localStorage or default to 24 hours ago
        const storageKey = `lab_eval_last_checked_${this.currentUser.id}`;
        const storedTimestamp = localStorage.getItem(storageKey);
        
        // Load shown submission IDs from localStorage
        const shownIdsKey = `lab_eval_shown_ids_${this.currentUser.id}`;
        const storedShownIds = localStorage.getItem(shownIdsKey);
        if (storedShownIds) {
            try {
                const ids = JSON.parse(storedShownIds);
                this.shownSubmissionIds = new Set(ids);
                console.log('[LabEvaluationPopup] Loaded shown submission IDs:', this.shownSubmissionIds.size);
            } catch (error) {
                console.warn('[LabEvaluationPopup] Failed to parse shown IDs:', error);
                this.shownSubmissionIds = new Set();
            }
        }
        
        // For testing: check if we should reset the timestamp (check all evaluations from last 7 days)
        const testMode = localStorage.getItem('lab_eval_test_mode') === 'true';
        
        if (testMode) {
            // Test mode: check last 7 days
            this.lastCheckedTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            console.log('[LabEvaluationPopup] TEST MODE: Using 7 days ago timestamp:', this.lastCheckedTimestamp);
        } else if (storedTimestamp) {
            this.lastCheckedTimestamp = storedTimestamp;
            console.log('[LabEvaluationPopup] Using stored timestamp:', this.lastCheckedTimestamp);
        } else {
            // Default to 24 hours ago for first-time users
            this.lastCheckedTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            console.log('[LabEvaluationPopup] Using default timestamp (24h ago):', this.lastCheckedTimestamp);
        }

        // Listen for hash changes to detect lab page visits
        window.addEventListener('hashchange', () => {
            this.checkIfLabPageVisited();
        });
        
        // Check on initial load if user is on a lab page
        this.checkIfLabPageVisited();

        // Check for evaluations on page load
        console.log('[LabEvaluationPopup] Checking for new evaluations on init...');
        await this.checkForNewEvaluations();

        // Start polling for new evaluations every 30 seconds
        this.startPolling();
        console.log('[LabEvaluationPopup] Polling started');

        // Check when user becomes active (handles offline/online scenarios)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('[LabEvaluationPopup] Page visible, checking for evaluations');
                this.checkForNewEvaluations();
            }
        });

        // Listen for focus events (handles multiple tabs)
        window.addEventListener('focus', () => {
            console.log('[LabEvaluationPopup] Window focused, checking for evaluations');
            this.checkForNewEvaluations();
        });

        // Listen for logout events to stop checking
        window.addEventListener('user-logged-out', () => {
            console.log('[LabEvaluationPopup] User logged out, stopping evaluation checks');
            this.currentUser = null;
            this.stopPolling();
        });
    }

    /**
     * Start polling for new evaluations
     */
    startPolling() {
        // Clear existing interval if any
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Poll every 30 seconds
        this.pollingInterval = setInterval(() => {
            if (!document.hidden && !this.isVisible) {
                this.checkForNewEvaluations();
            }
        }, 30000); // 30 seconds
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Check for new evaluations
     */
    async checkForNewEvaluations() {
        // Don't check if user is not logged in or not a learner
        if (!this.currentUser || this.currentUser.role !== 'learner') {
            console.log('[LabEvaluationPopup] Skipping check - not a learner or not logged in');
            return;
        }

        // Double-check user is still logged in (in case logout happened between checks)
        try {
            const { authService } = await import('../services/auth-service.js');
            const currentUser = await authService.getCurrentUser();
            if (!currentUser || currentUser.id !== this.currentUser.id) {
                console.log('[LabEvaluationPopup] User logged out during check, stopping');
                this.currentUser = null;
                this.stopPolling();
                return;
            }
        } catch (error) {
            console.log('[LabEvaluationPopup] Error checking auth status, stopping checks');
            this.currentUser = null;
            this.stopPolling();
            return;
        }

        try {
            console.log('[LabEvaluationPopup] Checking for evaluations since:', this.lastCheckedTimestamp);
            const recentEvaluations = await labSubmissionService.getRecentEvaluations(
                this.currentUser.id,
                this.lastCheckedTimestamp
            );
            console.log('[LabEvaluationPopup] Found evaluations:', recentEvaluations.length);

            // Filter out already shown submissions
            const newEvaluations = recentEvaluations.filter(
                evaluation => !this.shownSubmissionIds.has(evaluation.id)
            );
            console.log('[LabEvaluationPopup] New evaluations (not shown yet):', newEvaluations.length);

            if (newEvaluations.length > 0) {
                // Show the most recent evaluation first
                const latestEvaluation = newEvaluations[0];
                console.log('[LabEvaluationPopup] Showing evaluation for submission:', latestEvaluation.id);
                await this.showEvaluation(latestEvaluation);

                // Mark as shown and persist to localStorage
                this.markAsShown(latestEvaluation.id);

                // Update timestamp and persist to localStorage
                if (latestEvaluation.reviewed_at) {
                    this.lastCheckedTimestamp = latestEvaluation.reviewed_at;
                    const storageKey = `lab_eval_last_checked_${this.currentUser.id}`;
                    localStorage.setItem(storageKey, this.lastCheckedTimestamp);
                    console.log('[LabEvaluationPopup] Updated timestamp to:', this.lastCheckedTimestamp);
                }
            } else {
                console.log('[LabEvaluationPopup] No new evaluations to show');
            }
        } catch (error) {
            console.error('[LabEvaluationPopup] Error checking for new evaluations:', error);
            console.error('[LabEvaluationPopup] Error stack:', error.stack);
        }
    }

    /**
     * Show evaluation popup
     * @param {object} submission - Submission record with evaluation data
     */
    async showEvaluation(submission) {
        if (this.isVisible) {
            // If popup is already visible, queue this evaluation
            // For now, we'll just update the current one
            console.log('[LabEvaluationPopup] Popup already visible, skipping');
            return;
        }

        console.log('[LabEvaluationPopup] Showing evaluation popup for submission:', submission.id);
        this.currentEvaluation = submission;
        this.isVisible = true;

        // Load course information
        let course = null;
        try {
            course = await courseService.getCourseById(submission.course_id);
            console.log('[LabEvaluationPopup] Course loaded:', course?.title || 'not found');
        } catch (error) {
            console.warn('[LabEvaluationPopup] Failed to load course:', error);
        }

        this.render(submission, course);
        this.attachEventListeners();
        console.log('[LabEvaluationPopup] Popup rendered and event listeners attached');
    }

    /**
     * Render the popup
     * @param {object} submission - Submission record
     * @param {object} course - Course information
     */
    render(submission, course) {
        const statusConfig = this.getStatusConfig(submission.status);
        const score = submission.score !== null && submission.score !== undefined 
            ? submission.score 
            : null;
        const reviewedDate = submission.reviewed_at 
            ? new Date(submission.reviewed_at) 
            : null;
        const submittedDate = submission.submitted_at 
            ? new Date(submission.submitted_at) 
            : null;

        const courseTitle = course?.title || submission.course_id;
        const labTitle = submission.lab_id;

        // Truncate feedback for preview (first 200 characters)
        const feedbackPreview = submission.feedback 
            ? (submission.feedback.length > 200 
                ? submission.feedback.substring(0, 200) + '...' 
                : submission.feedback)
            : null;

        // Get status emoji/icon
        const statusEmoji = submission.status === 'approved' ? '🎉' : 
                           submission.status === 'needs_revision' ? '📝' : '✅';

        this.container.innerHTML = `
            <div class="lab-evaluation-popup-overlay" id="lab-evaluation-popup-overlay" role="dialog" aria-modal="true" aria-labelledby="lab-evaluation-popup-title">
                <div class="lab-evaluation-popup" id="lab-evaluation-popup">
                    <div class="lab-evaluation-popup-header ${statusConfig.class}">
                        <div class="popup-status-badge">
                            <span class="status-icon" aria-hidden="true">${statusEmoji}</span>
                            <span class="status-label" id="lab-evaluation-popup-title">${statusConfig.label}</span>
                        </div>
                        <button 
                            class="popup-close-btn" 
                            id="lab-evaluation-popup-close"
                            aria-label="Close evaluation popup"
                            type="button"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="lab-evaluation-popup-content">
                        <div class="evaluation-lab-info">
                            <div class="lab-course-name">${this.escapeHtml(courseTitle)}</div>
                            <div class="lab-title">${this.escapeHtml(labTitle)}</div>
                            ${submittedDate ? `
                                <div class="lab-submission-date">
                                    Submitted: ${submittedDate.toLocaleString()}
                                </div>
                            ` : ''}
                        </div>

                        ${score !== null ? `
                            <div class="evaluation-score-section">
                                <div class="score-label">Your Score</div>
                                <div class="score-display">
                                    <div class="score-value">${score.toFixed(1)}</div>
                                    <div class="score-max">/ 10</div>
                                </div>
                                <div class="score-bar-container">
                                    <div class="score-bar" style="width: ${(score / 10) * 100}%"></div>
                                </div>
                            </div>
                        ` : ''}

                        ${reviewedDate ? `
                            <div class="evaluation-date">
                                Evaluated: ${reviewedDate.toLocaleString()}
                            </div>
                        ` : ''}

                        ${feedbackPreview ? `
                            <div class="evaluation-feedback">
                                <div class="feedback-label">Trainer Feedback</div>
                                <div class="feedback-text">${this.escapeHtml(feedbackPreview)}</div>
                                ${submission.feedback && submission.feedback.length > 200 ? `
                                    <div class="feedback-note">View details to see full feedback</div>
                                ` : ''}
                            </div>
                        ` : ''}

                        <div class="evaluation-actions">
                            <button 
                                class="btn btn-primary btn-view-details" 
                                id="lab-evaluation-view-details"
                                data-submission-id="${submission.id}"
                                type="button"
                            >
                                <span>View Details</span>
                            </button>
                            ${submission.status === 'needs_revision' ? `
                                <button 
                                    class="btn btn-secondary btn-resubmit" 
                                    id="lab-evaluation-resubmit"
                                    data-course-id="${this.escapeHtml(submission.course_id)}"
                                    data-lab-id="${this.escapeHtml(submission.lab_id)}"
                                    type="button"
                                >
                                    <span>Resubmit Lab</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add animation class
        setTimeout(() => {
            const popup = this.container.querySelector('.lab-evaluation-popup');
            if (popup) {
                popup.classList.add('popup-visible');
            }
        }, 10);
    }

    /**
     * Get status configuration
     * @param {string} status - Submission status
     * @returns {object} Status config
     */
    getStatusConfig(status) {
        const configs = {
            'reviewed': {
                label: 'Reviewed',
                icon: '✓',
                class: 'status-reviewed'
            },
            'approved': {
                label: 'Approved',
                icon: '✓',
                class: 'status-approved'
            },
            'needs_revision': {
                label: 'Needs Revision',
                icon: '↻',
                class: 'status-revision'
            }
        };
        return configs[status] || configs['reviewed'];
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        const closeBtn = this.container.querySelector('#lab-evaluation-popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Overlay click (close on outside click)
        const overlay = this.container.querySelector('#lab-evaluation-popup-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hide();
                }
            });
        }

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // View Details button
        const viewDetailsBtn = this.container.querySelector('#lab-evaluation-view-details');
        if (viewDetailsBtn) {
            viewDetailsBtn.addEventListener('click', () => {
                const submissionId = viewDetailsBtn.getAttribute('data-submission-id');
                // Mark as shown before navigating
                if (this.currentEvaluation && this.currentEvaluation.id) {
                    this.markAsShown(this.currentEvaluation.id);
                }
                this.hide();
                router.navigate(`/submissions/${submissionId}`);
            });
        }

        // Resubmit button
        const resubmitBtn = this.container.querySelector('#lab-evaluation-resubmit');
        if (resubmitBtn) {
            resubmitBtn.addEventListener('click', () => {
                const courseId = resubmitBtn.getAttribute('data-course-id');
                const labId = resubmitBtn.getAttribute('data-lab-id');
                // Mark as shown before navigating
                if (this.currentEvaluation && this.currentEvaluation.id) {
                    this.markAsShown(this.currentEvaluation.id);
                }
                this.hide();
                router.navigate(`/courses/${courseId}/lab/${labId}`);
            });
        }

        // Focus trap
        this.setupFocusTrap();
    }

    /**
     * Setup focus trap for accessibility
     */
    setupFocusTrap() {
        const popup = this.container.querySelector('#lab-evaluation-popup');
        if (!popup) return;

        const focusableElements = popup.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const trapFocus = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        popup.addEventListener('keydown', trapFocus);
        
        // Focus first element
        setTimeout(() => {
            firstElement?.focus();
        }, 100);
    }

    /**
     * Mark a submission as shown (persist to localStorage)
     * @param {string} submissionId - Submission ID to mark as shown
     */
    markAsShown(submissionId) {
        if (!submissionId || !this.currentUser) return;
        
        this.shownSubmissionIds.add(submissionId);
        const shownIdsKey = `lab_eval_shown_ids_${this.currentUser.id}`;
        const idsArray = Array.from(this.shownSubmissionIds);
        localStorage.setItem(shownIdsKey, JSON.stringify(idsArray));
        console.log('[LabEvaluationPopup] Marked submission as shown:', submissionId);
    }

    /**
     * Check if user visited a lab page and mark related evaluations as shown
     */
    async checkIfLabPageVisited() {
        if (!this.currentUser || this.currentUser.role !== 'learner') return;
        
        const hash = window.location.hash;
        // Check if hash matches lab page pattern: /courses/:courseId/lab/:labId
        const labPageMatch = hash.match(/\/courses\/([^\/]+)\/lab\/(.+)$/);
        if (labPageMatch) {
            const courseId = labPageMatch[1];
            const labId = labPageMatch[2];
            
            // Check if there are any evaluations for this lab that haven't been shown
            try {
                const recentEvaluations = await labSubmissionService.getRecentEvaluations(
                    this.currentUser.id,
                    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // Check last 7 days
                );
                
                // Mark all evaluations for this lab as shown
                const evaluationsForThisLab = recentEvaluations.filter(
                    evaluation => evaluation.course_id === courseId && evaluation.lab_id === labId
                );
                
                evaluationsForThisLab.forEach(evaluation => {
                    if (!this.shownSubmissionIds.has(evaluation.id)) {
                        console.log('[LabEvaluationPopup] User visited lab page, marking evaluation as shown:', evaluation.id);
                        this.markAsShown(evaluation.id);
                    }
                });
            } catch (error) {
                console.warn('[LabEvaluationPopup] Error checking lab page evaluations:', error);
            }
        }
    }

    /**
     * Hide the popup
     */
    hide() {
        // Mark current evaluation as shown when closing
        if (this.currentEvaluation && this.currentEvaluation.id) {
            this.markAsShown(this.currentEvaluation.id);
        }
        
        this.isVisible = false;
        const popup = this.container.querySelector('.lab-evaluation-popup');
        if (popup) {
            popup.classList.remove('popup-visible');
            popup.classList.add('popup-hiding');
            setTimeout(() => {
                this.container.innerHTML = '';
                this.currentEvaluation = null;
            }, 300);
        } else {
            this.container.innerHTML = '';
            this.currentEvaluation = null;
        }
    }

    /**
     * Escape HTML
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Cleanup (stop polling, remove listeners)
     */
    destroy() {
        this.stopPolling();
        this.container.innerHTML = '';
        this.isVisible = false;
        this.currentEvaluation = null;
    }
}

// Create singleton instance
let labEvaluationPopupInstance = null;

/**
 * Initialize lab evaluation popup globally
 */
export async function initLabEvaluationPopup() {
    if (!labEvaluationPopupInstance) {
        labEvaluationPopupInstance = new LabEvaluationPopup();
        await labEvaluationPopupInstance.init();
    }
    return labEvaluationPopupInstance;
}

/**
 * Get the popup instance (for debugging/testing)
 */
export function getLabEvaluationPopupInstance() {
    return labEvaluationPopupInstance;
}

/**
 * Manually trigger a check for new evaluations (for testing)
 */
export async function triggerEvaluationCheck() {
    if (labEvaluationPopupInstance) {
        console.log('[LabEvaluationPopup] Manual check triggered');
        await labEvaluationPopupInstance.checkForNewEvaluations();
    } else {
        console.warn('[LabEvaluationPopup] Instance not initialized');
    }
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.labEvaluationPopup = {
        triggerCheck: triggerEvaluationCheck,
        getInstance: getLabEvaluationPopupInstance,
        enableTestMode: () => {
            localStorage.setItem('lab_eval_test_mode', 'true');
            console.log('[LabEvaluationPopup] Test mode enabled - will check last 7 days');
        },
        disableTestMode: () => {
            localStorage.removeItem('lab_eval_test_mode');
            console.log('[LabEvaluationPopup] Test mode disabled');
        },
        resetTimestamp: () => {
            const instance = getLabEvaluationPopupInstance();
            if (instance && instance.currentUser) {
                const storageKey = `lab_eval_last_checked_${instance.currentUser.id}`;
                localStorage.removeItem(storageKey);
                instance.lastCheckedTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                console.log('[LabEvaluationPopup] Timestamp reset to 7 days ago');
            }
        }
    };
}

export default LabEvaluationPopup;

