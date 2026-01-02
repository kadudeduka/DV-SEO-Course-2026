/**
 * LMS Configuration
 * 
 * This file contains configuration for the LMS, including backend API credentials.
 * 
 * Configuration is loaded from:
 * 1. window.LMS_CONFIG (set in config.local.js - gitignored)
 * 2. Environment variables (if using build tools)
 * 
 * For local development:
 * - Create lms/config.local.js with your Supabase credentials
 * - See BACKEND_SETUP.md for instructions
 * 
 * For GitHub Pages:
 * - These values should be injected at build time from GitHub Secrets
 * - Or use a separate config file that's not committed
 */

// Supabase Configuration
// These will be populated from window.LMS_CONFIG or environment variables
const SUPABASE_URL = (typeof window !== 'undefined' && window.LMS_CONFIG?.SUPABASE_URL) || 
                     (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 
                     '';

const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.LMS_CONFIG?.SUPABASE_ANON_KEY) || 
                          (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || 
                          '';

// Configuration object
const config = {
    supabase: {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        isConfigured: !!(SUPABASE_URL && SUPABASE_ANON_KEY)
    },
    // Feature flags
    features: {
        authentication: false, // Set to true when auth is implemented
        progressSync: false,  // Set to true when progress sync is implemented
        adminApproval: false  // Set to true when admin approval is implemented
    }
};

// Export configuration (for ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { config };
}

// Also make available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.LMS_CONFIG_INTERNAL = config;
}

// Log configuration status (helpful for debugging)
if (config.supabase.isConfigured) {
    console.log('✅ LMS Backend configured');
} else {
    console.log('ℹ️ LMS Backend not configured - using localStorage only');
    console.log('   Create lms/config.local.js to enable backend features');
}

