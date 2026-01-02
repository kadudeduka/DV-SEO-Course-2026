/**
 * LMS Application Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to: config/app.config.local.js
 * 2. Replace the placeholder values with your actual configuration
 * 3. The local config file is gitignored and will not be committed
 */

window.APP_CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://your-project-id.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    
    // Admin Credentials (REQUIRED for admin login)
    // SECURITY WARNING: Never commit actual credentials to git!
    // ADMIN_USERNAME: '',
    // ADMIN_PASSWORD: '',
    // ADMIN_EMAIL: '',
    
    // Application Settings
    APP_NAME: 'DV Learning Hub',
    APP_VERSION: '1.0.0',
    
    // Feature Flags
    FEATURES: {
        EMAIL_VERIFICATION: false,
        PROGRESS_SYNC: true,
        ADMIN_APPROVAL: true
    }
};
