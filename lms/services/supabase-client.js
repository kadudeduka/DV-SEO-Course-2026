/**
 * Supabase Client Module
 * 
 * Provides a singleton Supabase client instance for the application.
 * Reads configuration from the app config system.
 * 
 * Usage:
 *   import { supabaseClient } from './lms/services/supabase-client.js';
 *   const { data, error } = await supabaseClient.from('users').select();
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/**
 * Get configuration from app config system
 * Reads from window.LMS_CONFIG_INTERNAL (set by app.config.js)
 * @returns {object} Configuration object
 */
function getConfig() {
    if (typeof window !== 'undefined' && window.LMS_CONFIG_INTERNAL) {
        return window.LMS_CONFIG_INTERNAL;
    }
    
    throw new Error('Configuration not loaded. Ensure config/app.config.js is loaded before this module.');
}

/**
 * Get Supabase URL from configuration
 * @returns {string} Supabase project URL
 */
function getSupabaseUrl() {
    const config = getConfig();
    const url = config.supabase?.url;
    if (!url) {
        throw new Error('SUPABASE_URL is not configured. Please set it in config/app.config.local.js');
    }
    return url;
}

/**
 * Get Supabase anon key from configuration
 * @returns {string} Supabase anon key
 */
function getSupabaseAnonKey() {
    const config = getConfig();
    const key = config.supabase?.anonKey;
    if (!key) {
        throw new Error('SUPABASE_ANON_KEY is not configured. Please set it in config/app.config.local.js');
    }
    return key;
}

/**
 * Create and return Supabase client instance
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client
 */
function createSupabaseClient() {
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    
    return createClient(url, anonKey);
}

/**
 * Singleton Supabase client instance
 * Created once and reused throughout the application
 */
let supabaseClientInstance = null;

/**
 * Get the singleton Supabase client instance
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client
 */
export function getSupabaseClient() {
    if (!supabaseClientInstance) {
        supabaseClientInstance = createSupabaseClient();
    }
    return supabaseClientInstance;
}

/**
 * Default export: Singleton Supabase client instance
 * This is the primary way to access the Supabase client
 */
export const supabaseClient = getSupabaseClient();

