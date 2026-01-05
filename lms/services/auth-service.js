/**
 * Authentication Service
 * 
 * Handles user authentication, registration, and session management.
 */

import { supabaseClient } from './supabase-client.js';
import { userService } from './user-service.js';
import { progressService } from './progress-service.js';

class AuthService {
    constructor(client, userService) {
        this.client = client;
        this.userService = userService;
    }

    /**
     * Map Supabase auth errors to user-friendly messages
     * @param {object} error - Supabase error object
     * @returns {string} User-friendly error message
     */
    mapAuthError(error) {
        const errorMap = {
            'Invalid login credentials': 'Invalid email or password',
            'Email not confirmed': 'Please verify your email address',
            'User already registered': 'This email is already registered',
            'Password should be at least 6 characters': 'Password must be at least 6 characters',
            'Signup is disabled': 'Registration is currently disabled'
        };

        return errorMap[error.message] || error.message || 'An authentication error occurred';
    }

    /**
     * Validate registration input
     * @param {string} name - User full name
     * @param {string} email - User email
     * @param {string} password - User password
     */
    validateRegistration(name, email, password) {
        if (!name || name.trim().length === 0) {
            throw new Error('Full name is required');
        }

        if (!email || email.trim().length === 0) {
            throw new Error('Email is required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
    }

    /**
     * Register a new user
     * Creates Supabase auth user and public.users profile with status='pending'
     * @param {string} name - User full name
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<object>} Registration result with user and profile
     */
    async register(name, email, password) {
        this.validateRegistration(name, email, password);

        // Pass full_name in metadata so the trigger can use it
        const { data: authData, error: authError } = await this.client.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    full_name: name.trim(),
                    name: name.trim() // Also pass as 'name' for trigger compatibility
                }
            }
        });

        if (authError) {
            throw new Error(this.mapAuthError(authError));
        }

        if (!authData.user) {
            throw new Error('Registration failed: No user data returned');
        }

        try {
            // Use upsert to update the profile created by trigger, or create if trigger didn't run
            const profile = await this.userService.createUserProfile({
                id: authData.user.id,
                email: email.trim(),
                full_name: name.trim(),
                name: name.trim(), // Explicitly set name field - MUST NOT BE NULL
                role: 'learner',
                status: 'pending'
            });

            // Sign out the user immediately since they're not approved yet
            // Supabase signUp automatically creates a session, but we don't want pending users logged in
            await this.client.auth.signOut();
            
            // Clear any session data from localStorage to ensure user is fully logged out
            localStorage.removeItem('lms_user');
            localStorage.removeItem('lms_session');

            this.notifyAdminsOnRegistration(profile).catch(err => {
                console.warn('Failed to notify admins on registration:', err);
            });

            return {
                user: authData.user,
                profile: profile,
                message: 'Registration successful! Your account is pending admin approval. You will be notified once approved.'
            };
        } catch (profileError) {
            console.error('[AuthService] Profile creation failed, cleaning up auth user:', profileError);
            // Clean up: Delete the auth user if profile creation failed
            // This allows the user to try registering again
            try {
                // Note: We can't delete auth.users directly, but we can delete the public.users record if it exists
                // The auth user will remain but can be cleaned up manually if needed
                await this.client
                    .from('users')
                    .delete()
                    .eq('id', authData.user.id);
            } catch (cleanupError) {
                console.warn('[AuthService] Failed to cleanup user record:', cleanupError);
            }
            
            await this.client.auth.signOut();
            throw new Error('Registration failed: ' + profileError.message);
        }
    }

    /**
     * Login user
     * Authenticates with Supabase and checks user status
     * Blocks login if status is 'pending' or 'rejected'
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<object>} Login result with user, session, and profile
     */
    async login(email, password) {
        if (!email || email.trim().length === 0) {
            throw new Error('Email is required');
        }

        if (!password) {
            throw new Error('Password is required');
        }

        const { data: authData, error: authError } = await this.client.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (authError) {
            throw new Error(this.mapAuthError(authError));
        }

        if (!authData.user) {
            throw new Error('Login failed: No user data returned');
        }

        try {
            const userProfile = await this.userService.getUserProfile(authData.user.id);

            if (!userProfile) {
                await this.client.auth.signOut();
                throw new Error('User profile not found. Please contact support.');
            }

            // Only allow login if user is approved
            // Admins are always allowed (they can approve themselves)
            const isAdmin = userProfile.is_admin === true || userProfile.role === 'admin';
            
            if (!isAdmin && userProfile.status !== 'approved') {
                await this.client.auth.signOut();
                
                if (userProfile.status === 'pending') {
                    throw new Error('Your account is pending admin approval. Please wait for approval before logging in.');
                }
                
                if (userProfile.status === 'rejected') {
                    throw new Error('Your account has been rejected. Please contact support for assistance.');
                }
                
                // Status is NULL or something else - not approved
                throw new Error('Your account is not approved. Please contact support for assistance.');
            }

            return {
                user: authData.user,
                session: authData.session,
                profile: userProfile
            };
        } catch (profileError) {
            console.error('[AuthService] Profile error during login:', profileError);
            if (profileError.message.includes('pending') || 
                profileError.message.includes('rejected') || 
                profileError.message.includes('not approved')) {
                throw profileError;
            }
            await this.client.auth.signOut();
            throw new Error('Login failed: ' + profileError.message);
        }
    }

    /**
     * Logout user
     * Signs out from Supabase and clears local session data
     * Handles cases where session is already expired or missing
     * @returns {Promise<boolean>} Success status
     */
    async logout() {
        // Prevent multiple simultaneous logout calls
        if (this._isLoggingOut) {
            console.log('[AuthService] Logout already in progress, skipping...');
            return false;
        }
        
        this._isLoggingOut = true;
        
        try {
            // Check if there's an active session before attempting signOut
            const { data: sessionData } = await this.client.auth.getSession();
            
            // Only attempt signOut if there's an active session
            if (sessionData?.session) {
                const { error } = await this.client.auth.signOut();
                
                if (error) {
                    // If error is about missing session, treat as successful logout
                    // (user is already logged out)
                    const isSessionMissingError = 
                        error.message?.toLowerCase().includes('session missing') ||
                        error.message?.toLowerCase().includes('auth session missing') ||
                        error.status === 403;
                    
                    if (!isSessionMissingError) {
                        console.warn('[AuthService] Logout error (non-critical):', error.message);
                        // Continue with cleanup even if signOut failed
                    }
                }
            } else {
                // No active session - user is already logged out
                console.log('[AuthService] No active session found, proceeding with local cleanup');
            }
        } catch (error) {
            // If getSession fails or signOut fails with unexpected error,
            // still proceed with local cleanup
            console.warn('[AuthService] Error during logout (proceeding with cleanup):', error.message);
        } finally {
            // Always clear local storage and cache, regardless of signOut result
            localStorage.removeItem('lms_user');
            localStorage.removeItem('lms_session');

            progressService.clearCache();

            // Dispatch logout event
            window.dispatchEvent(new CustomEvent('user-logged-out'));
            
            // Reset flag after a short delay to allow cleanup to complete
            setTimeout(() => {
                this._isLoggingOut = false;
            }, 1000);
        }

        return true;
    }

    /**
     * Get current session
     * Retrieves active session and user profile
     * @returns {Promise<object|null>} Session data with user and profile, or null if no session
     */
    async getSession() {
        const { data: sessionData, error } = await this.client.auth.getSession();

        if (error) {
            console.error('[AuthService] Session error:', error);
            throw new Error('Failed to get session: ' + error.message);
        }

        if (!sessionData || !sessionData.session) {
            return null;
        }

        try {
            const profile = await this.userService.getUserProfile(sessionData.session.user.id);
            
            if (!profile) {
                // Profile not found - sign out
                await this.client.auth.signOut();
                return null;
            }

            // Check if user is approved (admins are always allowed)
            const isAdmin = profile.is_admin === true || profile.role === 'admin';
            
            if (!isAdmin && profile.status !== 'approved') {
                // User is not approved - sign them out
                await this.client.auth.signOut();
                return null;
            }

            return {
                session: sessionData.session,
                user: sessionData.session.user,
                profile: profile
            };
        } catch (profileError) {
            console.error('[AuthService] Failed to load user profile:', profileError);
            // If we can't verify the profile, sign out for security
            await this.client.auth.signOut();
            return null;
        }
    }

    /**
     * Get current user
     * Convenience method to get current user with profile
     * @returns {Promise<object|null>} Current user with profile, or null if not authenticated
     */
    async getCurrentUser() {
        try {
            // Check session first (source of truth)
            const session = await this.getSession();
            if (!session || !session.profile) {
                // No session - check if localStorage was cleared (fast-path for logout)
                const storedUser = localStorage.getItem('lms_user');
                if (!storedUser) {
                    // Definitely logged out
                    return null;
                }
                // Session expired but localStorage still has data - treat as logged out
                return null;
            }

            // Session exists - user is authenticated
            const user = {
                id: session.user.id,
                email: session.user.email,
                ...session.profile
            };
            
            return user;
        } catch (error) {
            console.error('[AuthService] Error in getCurrentUser:', error);
            return null;
        }
    }

    /**
     * Notify admins when a new user registers
     * @param {object} userProfile - Newly registered user profile
     * @private
     */
    async notifyAdminsOnRegistration(userProfile) {
        try {
            console.log('[AuthService] Notifying admins about new registration:', userProfile.email);
            const { notificationService } = await import('./notification-service.js');
            
            // Get all admins - check role = 'admin' first (most common)
            // If none found, also check is_admin = TRUE as fallback
            console.log('[AuthService] Fetching admins with role = "admin"...');
            console.log('[AuthService] Current user context:', await authService.getCurrentUser());
            
            let { data: admins, error } = await this.client
                .from('users')
                .select('id, email, status, role, is_admin')
                .eq('role', 'admin');
            
            console.log('[AuthService] Query result - admins found:', admins?.length || 0);
            console.log('[AuthService] Query result - admins data:', admins);
            console.log('[AuthService] Query result - error:', error);
            
            if (error) {
                console.error('[AuthService] Query error details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
            }
            
            // If no admins found by role, try is_admin flag as fallback
            if ((!admins || admins.length === 0) && !error) {
                console.log('[AuthService] No admins found by role, trying is_admin = TRUE...');
                const result = await this.client
                    .from('users')
                    .select('id, email, status, role, is_admin')
                    .eq('is_admin', true);
                admins = result.data;
                error = result.error;
                console.log('[AuthService] is_admin query result - admins found:', admins?.length || 0);
                console.log('[AuthService] is_admin query result - error:', error);
            }

            if (error) {
                console.error('[AuthService] Failed to fetch admins:', error);
                return;
            }

            if (!admins || admins.length === 0) {
                console.warn('[AuthService] No admins found to notify');
                console.warn('[AuthService] Make sure at least one user has role = "admin" OR is_admin = TRUE');
                
                // Debug: Check what users exist
                try {
                    const { data: allUsers } = await this.client
                        .from('users')
                        .select('id, email, role, is_admin, status')
                        .limit(10);
                    console.warn('[AuthService] Sample users in database:', allUsers);
                } catch (debugError) {
                    console.warn('[AuthService] Could not fetch users for debugging:', debugError);
                }
                
                return;
            }

            // Filter to only approved admins (if status column exists and is set)
            // If status is NULL or 'approved', include the admin
            const approvedAdmins = admins.filter(admin => {
                // If status is not set or is 'approved', include the admin
                return !admin.status || admin.status === 'approved';
            });

            if (approvedAdmins.length === 0) {
                console.warn('[AuthService] No approved admins found to notify');
                console.warn('[AuthService] Admin users found but none are approved:', admins.map(a => ({ email: a.email, status: a.status })));
                console.warn('[AuthService] Run backend/fix-admin-status.sql to fix admin status');
                return;
            }

            console.log(`[AuthService] Found ${approvedAdmins.length} approved admin(s) out of ${admins.length} total admin(s)`);

            const userDisplayName = userProfile.full_name || userProfile.name || userProfile.email;
            let successCount = 0;
            let failCount = 0;

            for (const admin of approvedAdmins) {
                try {
                    const result = await notificationService.createNotification(
                        admin.id,
                        'user_registered',
                        'New User Registration',
                        `${userDisplayName} has registered and is pending approval.`,
                        {
                            user_id: userProfile.id,
                            email: userProfile.email,
                            full_name: userProfile.full_name || userProfile.name
                        },
                        '/admin/dashboard' // Navigate to admin dashboard to approve users
                    );

                    if (result) {
                        successCount++;
                        console.log(`[AuthService] Notification created for admin ${admin.email}`);
                    } else {
                        failCount++;
                        console.warn(`[AuthService] Failed to create notification for admin ${admin.email}`);
                    }
                } catch (err) {
                    failCount++;
                    console.error(`[AuthService] Error creating notification for admin ${admin.email}:`, err);
                }
            }

            console.log(`[AuthService] Notification summary: ${successCount} succeeded, ${failCount} failed`);
        } catch (error) {
            console.error('[AuthService] Failed to notify admins on registration:', error);
        }
    }
}

export const authService = new AuthService(supabaseClient, userService);

