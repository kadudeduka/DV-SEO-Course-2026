# Configuration Directory

This directory contains all application configuration files.

## Files

- `app.config.js` - Default application configuration
- `app.config.local.js` - Local configuration overrides (gitignored)
- `app.config.template.js` - Configuration template for new setups

## Setup

1. Copy `app.config.template.js` to `app.config.local.js`
2. Fill in your Supabase credentials
3. Add admin credentials (if needed)
4. The local config file is gitignored and will not be committed

## Configuration Structure

```javascript
{
  SUPABASE_URL: string,        // Supabase project URL
  SUPABASE_ANON_KEY: string,   // Supabase publishable key
  ADMIN_USERNAME: string,      // Admin username (optional)
  ADMIN_PASSWORD: string,      // Admin password (optional)
  APP_NAME: string,            // Application name
  APP_VERSION: string,         // Application version
  FEATURES: {                   // Feature flags
    EMAIL_VERIFICATION: boolean,
    PROGRESS_SYNC: boolean,
    ADMIN_APPROVAL: boolean
  }
}
```
