# Production Deployment Checklist

## Pre-Deployment Steps

### 1. Database Migrations
Run these SQL migrations in order on your production Supabase database:

1. **Main AI Coach Tables** (if not already run):
   ```sql
   -- Run: backend/migration-ai-coach-tables.sql
   ```

2. **Fix RLS Policies for Responses and Escalations**:
   ```sql
   -- Run: backend/migration-ai-coach-fix-rls-policies.sql
   ```

3. **Fix RLS Policy for Personalization** (CRITICAL - fixes learner access):
   ```sql
   -- Run: backend/migration-ai-coach-fix-personalization-rls.sql
   ```

### 2. Configuration Files

#### On Production Server:
Create `config/app.config.local.js` with production values:

```javascript
window.LMS_CONFIG = {
    // Production Supabase Project URL
    SUPABASE_URL: 'YOUR_PRODUCTION_SUPABASE_URL',
    
    // Production Supabase Publishable Key
    SUPABASE_ANON_KEY: 'YOUR_PRODUCTION_SUPABASE_ANON_KEY',
    
    // Production OpenAI API Key
    OPENAI_API_KEY: 'YOUR_PRODUCTION_OPENAI_API_KEY',
    
    // Production Supabase Service Role Key (for indexing scripts)
    SUPABASE_SERVICE_KEY: 'YOUR_PRODUCTION_SUPABASE_SERVICE_KEY',
    
    // Admin credentials (if needed)
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'YOUR_SECURE_PASSWORD',
    ADMIN_EMAIL: 'admin@yourdomain.com'
};
```

**⚠️ IMPORTANT:**
- `config/app.config.local.js` should be gitignored (already in .gitignore)
- Never commit production API keys to version control
- Use environment variables or secure configuration management on production server

### 3. Environment Variables (Alternative to config file)

If using a build process or server-side rendering, set these environment variables:

```bash
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_supabase_anon_key
OPENAI_API_KEY=your_production_openai_api_key
SUPABASE_SERVICE_KEY=your_production_supabase_service_key
```

### 4. Content Indexing

After deployment, index course content for AI Coach:

```bash
# Install dependencies (if not already done)
npm install

# Index course content
npm run index-course -- --course-id=seo-master-2026 --full
```

Or manually run:
```bash
node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --full
```

### 5. Verify Supabase Settings

In your production Supabase dashboard:

1. **Enable RLS** on all AI Coach tables (should be enabled by migrations)
2. **Check API Settings**:
   - Verify CORS is configured for your production domain
   - Check that RLS policies are active
3. **Verify Extensions**:
   - `pgvector` extension should be enabled (for vector search)
   - Check: `SELECT * FROM pg_extension WHERE extname = 'vector';`

### 6. Content Security Policy (CSP)

Verify `index.html` has the correct CSP for OpenAI API:

```html
<meta http-equiv="Content-Security-Policy" 
      content="... connect-src 'self' https://*.supabase.co https://api.openai.com ...">
```

### 7. File Structure

Ensure these files are present on production:

- `index.html` (with correct CSP)
- `config/app.config.js` (base config)
- `config/app.config.local.js` (production config - NOT in git)
- All `lms/` directory files
- All `backend/` migration files (for reference)

### 8. Testing Checklist

After deployment, test:

- [ ] User login/registration works
- [ ] Admin approval flow works
- [ ] AI Coach widget appears on course pages
- [ ] AI Coach can answer questions
- [ ] Trainer personalization displays correctly for learners
- [ ] Trainer can set up AI Coach personalization
- [ ] Trainer can view escalations
- [ ] Content indexing works (if needed)
- [ ] Course content loads correctly
- [ ] Lab submissions work
- [ ] Progress tracking works

### 9. Security Checklist

- [ ] All API keys are in `app.config.local.js` (gitignored)
- [ ] No hardcoded credentials in committed files
- [ ] RLS policies are active on all tables
- [ ] CORS is configured correctly in Supabase
- [ ] Admin passwords are strong
- [ ] HTTPS is enabled on production server

### 10. Performance Optimization

- [ ] Enable caching for static assets
- [ ] Minify JavaScript/CSS (if not using build tools)
- [ ] Enable gzip compression on server
- [ ] Set appropriate cache headers

## Post-Deployment

### 1. Monitor Logs

Check browser console and server logs for:
- Configuration errors
- API connection issues
- RLS policy violations
- OpenAI API errors

### 2. Verify Database

Run these queries to verify setup:

```sql
-- Check if personalization RLS policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'ai_coach_trainer_personalization' 
AND policyname = 'Learners can read assigned trainer personalization';

-- Check if content chunks are indexed
SELECT COUNT(*) FROM ai_coach_content_chunks 
WHERE course_id = 'seo-master-2026';

-- Check if trainers have personalization set up
SELECT tp.*, u.email, u.full_name 
FROM ai_coach_trainer_personalization tp
JOIN users u ON tp.trainer_id = u.id;
```

### 3. Initial Setup Tasks

1. **Create Admin User** (if not exists):
   - Register admin user
   - Approve in database: `UPDATE users SET role = 'admin', status = 'approved' WHERE email = 'admin@yourdomain.com';`

2. **Set Up Trainer Personalization**:
   - Trainers should log in and go to "AI Coach Setup"
   - Configure their personalization settings

3. **Index Course Content**:
   - Run indexing script for each course
   - Verify chunks are created in database

## Rollback Plan

If issues occur:

1. **Database Rollback**:
   - Keep backup of database before migrations
   - Can restore from Supabase dashboard

2. **Code Rollback**:
   - Revert to previous git commit
   - Restore previous `app.config.local.js` if changed

3. **Disable Features**:
   - Can temporarily disable AI Coach by removing widget initialization
   - Can disable personalization by setting `personalization_enabled = false` in database

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Supabase logs for RLS violations
3. Verify all migrations ran successfully
4. Check that API keys are correct
5. Verify CORS settings in Supabase

## Notes

- The `config/app.config.local.js` file is gitignored and should NOT be committed
- All sensitive keys should be in `app.config.local.js` or environment variables
- Database migrations should be run in order
- Test thoroughly in staging before production deployment

