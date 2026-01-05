/**
 * LMS Configuration
 * 
 * This file contains configuration for the LMS, including backend API credentials.
 * 
 * Configuration is loaded from (in order of priority):
 * 1. window.LMS_CONFIG (set in config/app.config.local.js - gitignored, generated in production)
 * 2. Meta tags (for production environments where env vars are injected)
 * 3. Data attributes on <html> element
 * 4. Environment variables (if using build tools)
 * 
 * For local development:
 * - Create config/app.config.local.js with your Supabase credentials
 * - See BACKEND_SETUP.md for instructions
 * 
 * For GitHub Pages:
 * - GitHub Actions generates config/app.config.local.js from secrets
 * - If that fails, can use meta tags or data attributes
 */

/**
 * Get configuration value from multiple sources
 * @param {string} key - Configuration key
 * @returns {string|null} Configuration value
 */
function getConfigValue(key) {
    // 1. Check window.LMS_CONFIG (from config file)
    if (typeof window !== 'undefined' && window.LMS_CONFIG?.[key]) {
        return window.LMS_CONFIG[key];
    }
    
    // 2. Check meta tags (for production injection)
    // Convert key to meta tag format: SUPABASE_URL -> lms-supabase-url
    if (typeof document !== 'undefined') {
        const metaName = `lms-${key.toLowerCase().replace(/_/g, '-')}`;
        const metaTag = document.querySelector(`meta[name="${metaName}"]`);
        if (metaTag && metaTag.content && metaTag.content.trim()) {
            return metaTag.content.trim();
        }
    }
    
    // 3. Check data attributes on <html> element
    if (typeof document !== 'undefined' && document.documentElement) {
        const dataAttrName = `data-${key.toLowerCase().replace(/_/g, '-')}`;
        const dataAttr = document.documentElement.getAttribute(dataAttrName);
        if (dataAttr && dataAttr.trim()) {
            return dataAttr.trim();
        }
    }
    
    // 4. Check environment variables (Node.js/build time)
    if (typeof process !== 'undefined' && process.env?.[key]) {
        return process.env[key];
    }
    
    return null;
}

// Supabase Configuration
// Load from multiple sources with fallback
const SUPABASE_URL = getConfigValue('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = getConfigValue('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_KEY = getConfigValue('SUPABASE_SERVICE_KEY') || '';
const OPENAI_API_KEY = getConfigValue('OPENAI_API_KEY') || '';

// Configuration object
const config = {
    supabase: {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        serviceKey: SUPABASE_SERVICE_KEY,
        isConfigured: !!(SUPABASE_URL && SUPABASE_ANON_KEY)
    },
    openai: {
        apiKey: OPENAI_API_KEY,
        isConfigured: !!OPENAI_API_KEY
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
    console.log('   Supabase URL:', config.supabase.url ? '✓' : '✗');
    console.log('   Supabase Key:', config.supabase.anonKey ? '✓' : '✗');
} else {
    console.warn('⚠️ LMS Backend not configured - some features will be unavailable');
    console.log('   Configuration sources checked:');
    console.log('   - window.LMS_CONFIG:', typeof window !== 'undefined' && !!window.LMS_CONFIG ? 'found' : 'not found');
    if (typeof window !== 'undefined' && window.LMS_CONFIG) {
        console.log('     Keys in window.LMS_CONFIG:', Object.keys(window.LMS_CONFIG));
        console.log('     SUPABASE_URL value:', window.LMS_CONFIG.SUPABASE_URL ? 'present' : 'missing');
        console.log('     SUPABASE_ANON_KEY value:', window.LMS_CONFIG.SUPABASE_ANON_KEY ? 'present' : 'missing');
    }
    // Check meta tags
    const metaUrl = typeof document !== 'undefined' ? document.querySelector('meta[name="lms-supabase-url"]') : null;
    const metaKey = typeof document !== 'undefined' ? document.querySelector('meta[name="lms-supabase-anon-key"]') : null;
    console.log('   - Meta tags:', (metaUrl || metaKey) ? 'found' : 'not found');
    if (metaUrl) console.log('     lms-supabase-url:', metaUrl.content ? 'present' : 'empty');
    if (metaKey) console.log('     lms-supabase-anon-key:', metaKey.content ? 'present' : 'empty');
    // Check data attributes
    const dataUrl = typeof document !== 'undefined' && document.documentElement ? document.documentElement.getAttribute('data-supabase-url') : null;
    const dataKey = typeof document !== 'undefined' && document.documentElement ? document.documentElement.getAttribute('data-supabase-anon-key') : null;
    console.log('   - Data attributes:', (dataUrl || dataKey) ? 'found' : 'not found');
    console.log('   To configure: Create config/app.config.local.js with window.LMS_CONFIG = { SUPABASE_URL: "...", SUPABASE_ANON_KEY: "..." }');
}

