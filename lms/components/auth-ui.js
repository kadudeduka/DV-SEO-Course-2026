/**
 * Authentication UI Component
 * 
 * Handles login and registration UI rendering and interactions.
 */

import { authService } from '../services/auth-service.js';
import Header from './header.js';

class AuthUI {
    constructor(container) {
        this.container = container;
        this.currentMode = 'login';
    }

    /**
     * Show login screen
     */
    async showLoginScreen() {
        this.currentMode = 'login';
        // Refresh header to show logged-out state
        await this.refreshHeader();
        this.render();
    }
    
    /**
     * Refresh header to reflect current auth state
     */
    async refreshHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    /**
     * Show register screen
     */
    async showRegisterScreen() {
        this.currentMode = 'register';
        // Refresh header to show logged-out state
        await this.refreshHeader();
        this.render();
    }

    /**
     * Render authentication UI
     */
    render() {
        if (this.currentMode === 'login') {
            this.renderLogin();
        } else {
            this.renderRegister();
        }
    }

    /**
     * Render login form
     */
    renderLogin() {
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        const logoUrl = 'https://www.digitalvidya.com/wp-content/uploads/2025/12/Digital-Vidya-Logo@2x.png';
        
        this.container.innerHTML = `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <img src="${logoUrl}" alt="Digital Vidya" class="auth-logo" onerror="this.style.display='none';">
                        <h1 class="auth-title">Welcome Back</h1>
                        <p class="auth-subtitle">Sign in to continue your learning journey</p>
                    </div>
                    <form id="login-form" class="auth-form">
                        <div class="form-group">
                            <label for="login-email" class="form-label">Email Address</label>
                            <input 
                                type="email" 
                                id="login-email" 
                                name="email" 
                                class="form-input"
                                placeholder="Enter your email"
                                required
                                autocomplete="email">
                            <span class="form-error" id="login-email-error"></span>
                        </div>
                        <div class="form-group">
                            <label for="login-password" class="form-label">Password</label>
                            <input 
                                type="password" 
                                id="login-password" 
                                name="password" 
                                class="form-input"
                                placeholder="Enter your password"
                                required
                                autocomplete="current-password">
                            <span class="form-error" id="login-password-error"></span>
                        </div>
                        <div class="form-options">
                            <label class="form-checkbox">
                                <input type="checkbox" id="remember-me" name="remember">
                                <span>Remember me</span>
                            </label>
                            <a href="#" class="form-link" id="forgot-password">Forgot password?</a>
                        </div>
                        <div id="login-error" class="error-message" style="display: none;"></div>
                        <button type="submit" id="login-submit" class="btn btn-primary btn-full">
                            <span class="btn-text">Sign In</span>
                            <span class="btn-spinner" style="display: none;">
                                <span class="spinner"></span>
                            </span>
                        </button>
                        <div class="auth-divider">
                            <span>or</span>
                        </div>
                        <p class="auth-switch">
                            Don't have an account? 
                            <a href="#" id="switch-to-register" class="auth-link">Create an account</a>
                        </p>
                    </form>
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Render registration form
     */
    renderRegister() {
        // Ensure container is visible
        if (this.container) {
            this.container.style.display = 'block';
        }
        
        const logoUrl = 'https://www.digitalvidya.com/wp-content/uploads/2025/12/Digital-Vidya-Logo@2x.png';
        
        this.container.innerHTML = `
            <div class="auth-page">
                <div class="auth-container">
                    <div class="auth-header">
                        <img src="${logoUrl}" alt="Digital Vidya" class="auth-logo" onerror="this.style.display='none';">
                        <h1 class="auth-title">Create Account</h1>
                        <p class="auth-subtitle">Join DV Learning Hub and start your learning journey</p>
                    </div>
                    <form id="register-form" class="auth-form">
                        <div class="form-group">
                            <label for="register-name" class="form-label">
                                Full Name
                                <span class="form-required">*</span>
                            </label>
                            <input 
                                type="text" 
                                id="register-name" 
                                name="name" 
                                class="form-input"
                                placeholder="Enter your full name"
                                required 
                                minlength="1"
                                autocomplete="name">
                            <span class="form-error" id="register-name-error"></span>
                        </div>
                        <div class="form-group">
                            <label for="register-email" class="form-label">Email Address</label>
                            <input 
                                type="email" 
                                id="register-email" 
                                name="email" 
                                class="form-input"
                                placeholder="Enter your email"
                                required
                                autocomplete="email">
                            <span class="form-error" id="register-email-error"></span>
                        </div>
                        <div class="form-group">
                            <label for="register-password" class="form-label">Password</label>
                            <input 
                                type="password" 
                                id="register-password" 
                                name="password" 
                                class="form-input"
                                placeholder="Create a password (min. 6 characters)"
                                required
                                minlength="6"
                                autocomplete="new-password">
                            <div class="password-strength" id="password-strength" style="display: none;">
                                <div class="password-strength-bar">
                                    <div class="password-strength-fill" id="password-strength-fill"></div>
                                </div>
                                <span class="password-strength-text" id="password-strength-text"></span>
                            </div>
                            <span class="form-error" id="register-password-error"></span>
                        </div>
                        <div id="register-error" class="error-message" style="display: none;"></div>
                        <button type="submit" id="register-submit" class="btn btn-primary btn-full">
                            <span class="btn-text">Create Account</span>
                            <span class="btn-spinner" style="display: none;">
                                <span class="spinner"></span>
                            </span>
                        </button>
                        <div class="auth-divider">
                            <span>or</span>
                        </div>
                        <p class="auth-switch">
                            Already have an account? 
                            <a href="#" id="switch-to-login" class="auth-link">Sign in here</a>
                        </p>
                    </form>
                </div>
            </div>
        `;
        this.attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (this.currentMode === 'login') {
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
            }

            // Real-time validation
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            
            if (emailInput) {
                emailInput.addEventListener('blur', () => this.validateEmail(emailInput.value, 'login-email-error'));
            }
            if (passwordInput) {
                passwordInput.addEventListener('blur', () => this.validatePassword(passwordInput.value, 'login-password-error'));
            }

            const switchLink = document.getElementById('switch-to-register');
            if (switchLink) {
                switchLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showRegisterScreen();
                });
            }

            const forgotPasswordLink = document.getElementById('forgot-password');
            if (forgotPasswordLink) {
                forgotPasswordLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    // TODO: Implement forgot password
                    alert('Forgot password feature coming soon!');
                });
            }
        } else {
            const registerForm = document.getElementById('register-form');
            if (registerForm) {
                registerForm.addEventListener('submit', (e) => this.handleRegisterSubmit(e));
            }

            // Real-time validation
            const nameInput = document.getElementById('register-name');
            const emailInput = document.getElementById('register-email');
            const passwordInput = document.getElementById('register-password');
            
            if (nameInput) {
                nameInput.addEventListener('input', () => this.validateName(nameInput.value, 'register-name-error'));
            }
            if (emailInput) {
                emailInput.addEventListener('blur', () => this.validateEmail(emailInput.value, 'register-email-error'));
            }
            if (passwordInput) {
                passwordInput.addEventListener('input', () => {
                    this.validatePassword(passwordInput.value, 'register-password-error');
                    this.updatePasswordStrength(passwordInput.value);
                });
            }

            const switchLink = document.getElementById('switch-to-login');
            if (switchLink) {
                switchLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showLoginScreen();
                });
            }
        }
    }

    /**
     * Validate name
     */
    validateName(name, errorId) {
        const errorEl = document.getElementById(errorId);
        if (!name || name.trim().length === 0) {
            if (errorEl) {
                errorEl.textContent = 'Full name is required';
                errorEl.style.display = 'block';
            }
            return false;
        }
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
        return true;
    }

    /**
     * Validate email
     */
    validateEmail(email, errorId) {
        const errorEl = document.getElementById(errorId);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email || email.trim().length === 0) {
            if (errorEl) {
                errorEl.textContent = 'Email is required';
                errorEl.style.display = 'block';
            }
            return false;
        }
        
        if (!emailRegex.test(email)) {
            if (errorEl) {
                errorEl.textContent = 'Please enter a valid email address';
                errorEl.style.display = 'block';
            }
            return false;
        }
        
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
        return true;
    }

    /**
     * Validate password
     */
    validatePassword(password, errorId) {
        const errorEl = document.getElementById(errorId);
        
        if (!password || password.length === 0) {
            if (errorEl) {
                errorEl.textContent = 'Password is required';
                errorEl.style.display = 'block';
            }
            return false;
        }
        
        if (password.length < 6) {
            if (errorEl) {
                errorEl.textContent = 'Password must be at least 6 characters';
                errorEl.style.display = 'block';
            }
            return false;
        }
        
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
        return true;
    }

    /**
     * Update password strength indicator
     */
    updatePasswordStrength(password) {
        const strengthContainer = document.getElementById('password-strength');
        const strengthFill = document.getElementById('password-strength-fill');
        const strengthText = document.getElementById('password-strength-text');
        
        if (!strengthContainer || !strengthFill || !strengthText) return;
        
        if (password.length === 0) {
            strengthContainer.style.display = 'none';
            return;
        }
        
        strengthContainer.style.display = 'block';
        
        let strength = 0;
        let strengthLabel = '';
        let strengthColor = '';
        
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z\d]/.test(password)) strength++;
        
        if (strength <= 2) {
            strengthLabel = 'Weak';
            strengthColor = 'var(--color-error)';
        } else if (strength <= 3) {
            strengthLabel = 'Fair';
            strengthColor = 'var(--color-warning)';
        } else {
            strengthLabel = 'Strong';
            strengthColor = 'var(--color-success)';
        }
        
        strengthFill.style.width = `${(strength / 5) * 100}%`;
        strengthFill.style.backgroundColor = strengthColor;
        strengthText.textContent = strengthLabel;
        strengthText.style.color = strengthColor;
    }

    /**
     * Handle login form submission
     */
    async handleLoginSubmit(event) {
        event.preventDefault();
        this.clearErrors();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitButton = document.getElementById('login-submit');
        const errorDiv = document.getElementById('login-error');

        if (!email || !password) {
            this.showError('Please enter both email and password', errorDiv);
            return;
        }

        // Show loading state
        this.setButtonLoading(submitButton, true);

        try {
            const result = await authService.login(email, password);
            
            if (result && result.user) {
                // Check user status
                const userStatus = result.user.status || result.user.user_metadata?.status;
                
                if (userStatus === 'pending') {
                    // Redirect to pending screen
                    const { router } = await import('../core/router.js');
                    router.navigate('/account/pending');
                    return;
                } else if (userStatus === 'rejected') {
                    // Redirect to rejected screen
                    const { router } = await import('../core/router.js');
                    router.navigate('/account/rejected');
                    return;
                }
                
                // Successful login - redirect to appropriate dashboard
                const { router } = await import('../core/router.js');
                const role = result.user.role || result.user.user_metadata?.role;
                
                if (role === 'admin') {
                    router.navigate('/admin/dashboard');
                } else if (role === 'trainer') {
                    router.navigate('/trainer/dashboard');
                } else {
                    router.navigate('/dashboard');
                }
            } else {
                this.showError('Login failed. Please try again.', errorDiv);
            }
        } catch (error) {
            this.showError(error.message || 'Login failed. Please try again.', errorDiv);
        } finally {
            this.setButtonLoading(submitButton, false);
        }
    }

    /**
     * Handle registration form submission
     */
    async handleRegisterSubmit(event) {
        event.preventDefault();
        this.clearErrors();

        const nameInput = document.getElementById('register-name');
        const name = nameInput ? nameInput.value.trim() : '';
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const submitButton = document.getElementById('register-submit');
        const errorDiv = document.getElementById('register-error');

        // Validate name is not empty
        if (!name || name.length === 0) {
            this.showError('Full name is required and cannot be empty', errorDiv);
            if (nameInput) {
                nameInput.focus();
            }
            return;
        }

        if (!email || !password) {
            this.showError('Please fill in all fields', errorDiv);
            return;
        }

        // Show loading state
        this.setButtonLoading(submitButton, true);

        try {
            const result = await authService.register(name, email, password);
            
            if (result && result.user) {
                // Show success message (user is already signed out by authService.register)
                const message = result.message || 'Registration successful! Your account is pending admin approval. You will be notified once approved.';
                this.showSuccess(message, errorDiv);
                
                // Redirect to login screen after short delay
                setTimeout(async () => {
                    const { router } = await import('../core/router.js');
                    router.navigate('/login');
                }, 3000);
            } else {
                this.showError('Registration failed. Please try again.', errorDiv);
            }
        } catch (error) {
            this.showError(error.message || 'Registration failed. Please try again.', errorDiv);
        } finally {
            this.setButtonLoading(submitButton, false);
        }
    }

    /**
     * Set button loading state
     */
    setButtonLoading(button, isLoading) {
        if (!button) return;
        
        const btnText = button.querySelector('.btn-text');
        const btnSpinner = button.querySelector('.btn-spinner');
        
        button.disabled = isLoading;
        
        if (btnText) {
            btnText.style.display = isLoading ? 'none' : 'inline';
        }
        if (btnSpinner) {
            btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message, errorDiv) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = 'error-message';
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Show success message
     */
    showSuccess(message, messageDiv) {
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = 'success-message';
            messageDiv.style.display = 'block';
        }
    }

    /**
     * Clear error messages
     */
    clearErrors() {
        const loginError = document.getElementById('login-error');
        const registerError = document.getElementById('register-error');
        
        if (loginError) {
            loginError.style.display = 'none';
            loginError.textContent = '';
            loginError.className = 'error-message';
        }
        
        if (registerError) {
            registerError.style.display = 'none';
            registerError.textContent = '';
            registerError.className = 'error-message';
        }
        
        // Clear field errors
        const fieldErrors = this.container.querySelectorAll('.form-error');
        fieldErrors.forEach(error => {
            error.textContent = '';
            error.style.display = 'none';
        });
    }
}

export default AuthUI;

