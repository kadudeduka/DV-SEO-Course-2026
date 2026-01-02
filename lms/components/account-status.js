/**
 * Account Status Component
 * 
 * Displays account status screens for pending and rejected accounts.
 */

import { router } from '../core/router.js';
import Header from './header.js';

class AccountStatus {
    constructor(container) {
        this.container = container;
        this.status = null; // 'pending' or 'rejected'
    }

    /**
     * Show pending account screen
     */
    async showPending() {
        this.status = 'pending';
        await this.refreshHeader();
        this.render();
    }

    /**
     * Show rejected account screen
     */
    async showRejected() {
        this.status = 'rejected';
        await this.refreshHeader();
        this.render();
    }

    /**
     * Refresh header
     */
    async refreshHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    /**
     * Render account status screen
     */
    render() {
        if (this.container) {
            this.container.style.display = 'block';
        }

        const logoUrl = 'https://www.digitalvidya.com/wp-content/uploads/2025/12/Digital-Vidya-Logo@2x.png';

        if (this.status === 'pending') {
            this.renderPending(logoUrl);
        } else if (this.status === 'rejected') {
            this.renderRejected(logoUrl);
        }

        this.attachEventListeners();
    }

    /**
     * Render pending account screen
     */
    renderPending(logoUrl) {
        this.container.innerHTML = `
            <div class="account-status-page">
                <div class="account-status-container">
                    <div class="account-status-header">
                        <img src="${logoUrl}" alt="Digital Vidya" class="account-status-logo" onerror="this.style.display='none';">
                        <div class="account-status-icon pending">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/>
                                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </div>
                        <h1 class="account-status-title">Account Pending Approval</h1>
                        <p class="account-status-message">
                            Thank you for registering! Your account is currently pending admin approval.
                        </p>
                    </div>
                    <div class="account-status-content">
                        <div class="account-status-info">
                            <h2>What happens next?</h2>
                            <ul class="info-list">
                                <li>
                                    <span class="info-icon">✓</span>
                                    <span>Your registration has been received</span>
                                </li>
                                <li>
                                    <span class="info-icon">✓</span>
                                    <span>An admin will review your account</span>
                                </li>
                                <li>
                                    <span class="info-icon">✓</span>
                                    <span>You'll receive an email notification once approved</span>
                                </li>
                            </ul>
                        </div>
                        <div class="account-status-actions">
                            <button class="btn btn-secondary" id="check-status-btn">Check Status</button>
                            <a href="#/login" class="btn btn-primary">Back to Login</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render rejected account screen
     */
    renderRejected(logoUrl) {
        this.container.innerHTML = `
            <div class="account-status-page">
                <div class="account-status-container">
                    <div class="account-status-header">
                        <img src="${logoUrl}" alt="Digital Vidya" class="account-status-logo" onerror="this.style.display='none';">
                        <div class="account-status-icon rejected">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </div>
                        <h1 class="account-status-title">Account Not Approved</h1>
                        <p class="account-status-message">
                            We're sorry, but your account registration has not been approved at this time.
                        </p>
                    </div>
                    <div class="account-status-content">
                        <div class="account-status-info">
                            <h2>Need help?</h2>
                            <p>If you believe this is an error or have questions about your account status, please contact our support team.</p>
                            <div class="contact-info">
                                <p><strong>Email:</strong> support@digitalvidya.com</p>
                                <p><strong>Phone:</strong> +91-XXXXXXXXXX</p>
                            </div>
                        </div>
                        <div class="account-status-actions">
                            <a href="#/login" class="btn btn-primary">Back to Login</a>
                            <button class="btn btn-secondary" id="contact-support-btn">Contact Support</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const checkStatusBtn = document.getElementById('check-status-btn');
        if (checkStatusBtn) {
            checkStatusBtn.addEventListener('click', async () => {
                // Try to check current user status
                try {
                    const { authService } = await import('../services/auth-service.js');
                    const user = await authService.getCurrentUser();
                    if (user) {
                        const status = user.status || user.user_metadata?.status;
                        if (status === 'approved') {
                            // User is approved, redirect to dashboard
                            const role = user.role || user.user_metadata?.role;
                            if (role === 'admin') {
                                router.navigate('/admin/dashboard');
                            } else if (role === 'trainer') {
                                router.navigate('/trainer/dashboard');
                            } else {
                                router.navigate('/dashboard');
                            }
                        } else {
                            alert('Your account is still pending approval. Please wait for admin approval.');
                        }
                    } else {
                        router.navigate('/login');
                    }
                } catch (error) {
                    console.error('Error checking status:', error);
                    alert('Unable to check status. Please try again later.');
                }
            });
        }

        const contactSupportBtn = document.getElementById('contact-support-btn');
        if (contactSupportBtn) {
            contactSupportBtn.addEventListener('click', () => {
                window.location.href = 'mailto:support@digitalvidya.com?subject=Account Rejection Inquiry';
            });
        }
    }
}

export default AccountStatus;

