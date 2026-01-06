/**
 * User Service
 * 
 * Handles user profile operations and user data management.
 */

import { supabaseClient } from './supabase-client.js';

class UserService {
    constructor(client) {
        this.client = client;
        // Cache user profiles to avoid repeated database calls
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        this.pendingRequests = new Map(); // Track pending requests to avoid duplicate calls
    }

    /**
     * Get user profile by user ID (with caching)
     * @param {string} userId - User UUID
     * @param {boolean} forceRefresh - Force refresh from database (bypass cache)
     * @returns {Promise<object>} User profile
     */
    async getUserProfile(userId, forceRefresh = false) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = this.cache.get(userId);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                console.log('[UserService] Returning cached user profile for ID:', userId);
                return cached.data;
            }
        }

        // Check if there's already a pending request for this user
        if (this.pendingRequests.has(userId)) {
            console.log('[UserService] Waiting for pending request for ID:', userId);
            return await this.pendingRequests.get(userId);
        }

        // Create new request
        const requestPromise = (async () => {
            try {
                console.log('[UserService] Fetching user profile from database for ID:', userId);

                // Use maybeSingle() to handle cases where user might not exist
                const { data, error } = await this.client
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();

                if (error) {
                    console.error('[UserService] Error fetching user profile:', error);
                    throw new Error('Failed to get user profile: ' + error.message);
                }

                if (!data) {
                    console.warn('[UserService] User profile not found for ID:', userId);
                    throw new Error('User profile not found. Please contact support.');
                }

                // Cache the result
                this.cache.set(userId, {
                    data,
                    timestamp: Date.now()
                });

                console.log('[UserService] User profile found:', { id: data.id, email: data.email, role: data.role, status: data.status });
                return data;
            } finally {
                // Remove from pending requests
                this.pendingRequests.delete(userId);
            }
        })();

        // Store pending request
        this.pendingRequests.set(userId, requestPromise);

        return await requestPromise;
    }

    /**
     * Clear cache for a specific user (call after profile updates)
     * @param {string} userId - User UUID
     */
    clearCache(userId) {
        if (userId) {
            this.cache.delete(userId);
        } else {
            // Clear all cache
            this.cache.clear();
        }
    }

    /**
     * Create user profile in public.users table
     * @param {object} profileData - User profile data
     * @param {string} profileData.id - User UUID (from auth.users)
     * @param {string} profileData.email - User email
     * @param {string} profileData.full_name - User full name
     * @param {string} profileData.role - User role (default: 'learner')
     * @param {string} profileData.status - User status (default: 'pending')
     * @returns {Promise<object>} Created user profile
     */
    async createUserProfile(profileData) {
        if (!profileData || !profileData.id || !profileData.email) {
            throw new Error('User ID and email are required');
        }

        // Ensure name is never null or empty
        const userName = profileData.name || profileData.full_name || '';
        if (!userName || userName.trim().length === 0) {
            throw new Error('Name is required and cannot be empty');
        }

        const userProfile = {
            id: profileData.id,
            email: profileData.email,
            name: userName.trim(), // name is NOT NULL, ensure it's always set
            full_name: profileData.full_name || profileData.name || null, // Keep full_name for backward compatibility
            role: profileData.role || 'learner',
            status: profileData.status || 'pending',
            updated_at: new Date().toISOString()
        };

        // Check if user exists (might have been created by trigger)
        const { data: existingUser, error: checkError } = await this.client
            .from('users')
            .select('created_at, name, email')
            .eq('id', profileData.id)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('[UserService] Error checking existing user:', checkError);
        }

        if (!existingUser) {
            // User doesn't exist, set created_at
            userProfile.created_at = new Date().toISOString();
            console.log('[UserService] Creating new user profile:', profileData.id, 'with name:', userName);
        } else {
            // User exists (created by trigger), ensure name is set correctly
            console.log('[UserService] User exists, updating profile. Current name:', existingUser.name, 'New name:', userName);
            if (!existingUser.name || existingUser.name.trim().length === 0 || existingUser.name === '-' || existingUser.name === '') {
                console.warn('[UserService] User has invalid name, will update:', existingUser.name);
            }
        }

        // Try to update first if user exists, then insert if not
        // This ensures we always set the name field correctly
        console.log('[UserService] Upserting user profile:', {
            id: userProfile.id,
            email: userProfile.email,
            name: userProfile.name,
            nameLength: userProfile.name ? userProfile.name.length : 0
        });
        
        let data, error;
        
        if (existingUser) {
            // User exists, update it (especially important if name was null)
            console.log('[UserService] Updating existing user profile');
            const updateResult = await this.client
                .from('users')
                .update(userProfile)
                .eq('id', profileData.id)
                .select()
                .single();
            data = updateResult.data;
            error = updateResult.error;
        } else {
            // User doesn't exist, insert it
            console.log('[UserService] Inserting new user profile');
            const insertResult = await this.client
                .from('users')
                .insert([userProfile])
                .select()
                .single();
            data = insertResult.data;
            error = insertResult.error;
        }

        if (error) {
            console.error('[UserService] Upsert error:', error);
            throw new Error('Failed to create user profile: ' + error.message);
        }

        // Verify the name was set correctly
        if (!data || !data.name || data.name.trim().length === 0) {
            console.error('[UserService] Name was not set correctly after upsert. Data:', data);
            throw new Error('Failed to set user name. Please try again.');
        }

        console.log('[UserService] User profile created/updated successfully:', { id: data.id, name: data.name, email: data.email });
        
        // Clear cache after create/update
        this.clearCache(profileData.id);
        
        return data;
    }

    /**
     * Update user profile
     * @param {string} userId - User UUID
     * @param {object} updates - Fields to update
     * @returns {Promise<object>} Updated user profile
     */
    async updateUserProfile(userId, updates) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const allowedFields = ['full_name'];
        const filteredUpdates = Object.keys(updates)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});

        if (Object.keys(filteredUpdates).length === 0) {
            throw new Error('No valid fields to update');
        }

        filteredUpdates.updated_at = new Date().toISOString();

        const { data, error } = await this.client
            .from('users')
            .update(filteredUpdates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error('Failed to update user profile: ' + error.message);
        }

        // Clear cache after update
        this.clearCache(userId);

        return data;
    }
}

export const userService = new UserService(supabaseClient);

