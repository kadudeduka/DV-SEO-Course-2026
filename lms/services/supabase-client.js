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

// Use npm package in Node.js, CDN URL in browser
let createClient;
if (typeof window === 'undefined') {
    // Node.js environment - use npm package
    try {
        const supabaseModule = await import('@supabase/supabase-js');
        createClient = supabaseModule.createClient;
    } catch (error) {
        // Fallback: try dynamic import with require if available
        console.error('[SupabaseClient] Failed to import @supabase/supabase-js:', error);
        throw new Error('@supabase/supabase-js package not found. Please install: npm install @supabase/supabase-js');
    }
} else {
    // Browser environment - use CDN URL
    try {
        const supabaseModule = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        createClient = supabaseModule.createClient;
    } catch (error) {
        console.error('[SupabaseClient] Failed to import from CDN:', error);
        throw new Error('Failed to load Supabase client from CDN');
    }
}

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
    try {
        const config = getConfig();
        const url = config.supabase?.url;
        if (!url) {
            console.error('SUPABASE_URL is not configured.');
            console.error('Configuration sources checked:');
            console.error('  - window.LMS_CONFIG:', typeof window !== 'undefined' && !!window.LMS_CONFIG ? 'found' : 'not found');
            console.error('  - Meta tags: checked');
            console.error('  - Data attributes: checked');
            console.error('Please set SUPABASE_URL in one of these ways:');
            console.error('  1. Create config/app.config.local.js with window.LMS_CONFIG');
            console.error('  2. Set meta tag: <meta name="lms-supabase_url" content="...">');
            console.error('  3. Set data attribute: <html data-supabase-url="...">');
            throw new Error('SUPABASE_URL is not configured. See console for details.');
        }
        return url;
    } catch (error) {
        if (error.message.includes('Configuration not loaded')) {
            // Config system not initialized yet - provide helpful error
            console.error('Configuration system not initialized. Ensure config/app.config.js is loaded before this module.');
            throw new Error('Configuration not loaded. Ensure config/app.config.js is loaded in index.html before supabase-client.js');
        }
        throw error;
    }
}

/**
 * Get Supabase anon key from configuration
 * @returns {string} Supabase anon key
 */
function getSupabaseAnonKey() {
    try {
        const config = getConfig();
        const key = config.supabase?.anonKey;
        if (!key) {
            console.error('SUPABASE_ANON_KEY is not configured.');
            console.error('Please set SUPABASE_ANON_KEY in one of these ways:');
            console.error('  1. Create config/app.config.local.js with window.LMS_CONFIG');
            console.error('  2. Set meta tag: <meta name="lms-supabase_anon_key" content="...">');
            console.error('  3. Set data attribute: <html data-supabase-anon-key="...">');
            throw new Error('SUPABASE_ANON_KEY is not configured. See console for details.');
        }
        return key;
    } catch (error) {
        if (error.message.includes('Configuration not loaded')) {
            console.error('Configuration system not initialized. Ensure config/app.config.js is loaded before this module.');
            throw new Error('Configuration not loaded. Ensure config/app.config.js is loaded in index.html before supabase-client.js');
        }
        throw error;
    }
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
 * 
 * Note: If config is not loaded when this module is imported,
 * the client creation will be deferred until first access via getSupabaseClient()
 */
let _defaultClient = null;

// Lazy initialization for default export
// This allows the module to be imported even if config isn't ready yet
export const supabaseClient = new Proxy({}, {
    get(target, prop) {
        // Lazy initialization - only create client when first accessed
        if (!_defaultClient) {
            try {
                _defaultClient = getSupabaseClient();
            } catch (error) {
                // If initialization fails, throw a helpful error
                console.error('[SupabaseClient] Failed to initialize:', error.message);
                throw new Error(
                    'Supabase client not initialized. ' +
                    'Configuration is missing. ' +
                    'Please ensure:\n' +
                    '1. config/app.config.js is loaded in index.html\n' +
                    '2. config/app.config.local.js exists (or meta tags/data attributes are set)\n' +
                    '3. SUPABASE_URL and SUPABASE_ANON_KEY are configured\n\n' +
                    'Original error: ' + error.message
                );
            }
        }
        return _defaultClient[prop];
    }
});

