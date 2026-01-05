# Production Configuration Guide

## Problem

In production (GitHub Pages), the app tries to load `config/app.config.local.js` which doesn't exist in the repository (it's gitignored). This causes a 404 error.

## Solution

The configuration system now supports multiple sources and handles missing files gracefully.

---

## Configuration Loading Order

The app loads configuration from these sources (in priority order):

1. **`window.LMS_CONFIG`** (from `config/app.config.local.js`)
   - Generated automatically by GitHub Actions during deployment
   - Used in both local development and production

2. **Meta Tags** (for production injection)
   - Can be added to HTML if needed
   - Format: `<meta name="lms-supabase_url" content="...">`

3. **Data Attributes** (on `<html>` element)
   - Format: `<html data-supabase-url="...">`

4. **Environment Variables** (Node.js/build time)
   - Used during build processes

---

## GitHub Pages Setup

### 1. Set GitHub Secrets

In your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` (optional, for admin scripts)
   - `OPENAI_API_KEY` (optional, for AI Coach)
   - `ADMIN_USERNAME` (optional)
   - `ADMIN_PASSWORD` (optional)
   - `ADMIN_EMAIL` (optional)

### 2. Verify Workflow

The GitHub Actions workflow (`.github/workflows/deploy-lms.yml`) automatically:
- Generates `config/app.config.local.js` from secrets during deployment
- Includes it in the deployment artifact
- The file is created but not committed to the repository

### 3. Verify Deployment

After deployment, check:
1. The file `config/app.config.local.js` should exist in the deployed site
2. Open browser console - should see "✅ LMS Backend configured"
3. No 404 errors for the config file

---

## Troubleshooting

### Error: "SUPABASE_URL is not configured"

**Possible causes:**
1. GitHub Secrets not set
2. Workflow didn't generate the config file
3. Config file not included in deployment

**Solutions:**

1. **Check GitHub Secrets:**
   ```bash
   # In GitHub repo: Settings → Secrets → Actions
   # Verify all required secrets are set
   ```

2. **Check Workflow Logs:**
   - Go to **Actions** tab in GitHub
   - Check the latest deployment workflow
   - Look for "Generate config file" step
   - Verify it shows "✅ Config file created successfully"

3. **Verify File in Deployment:**
   - After deployment, visit: `https://your-site.github.io/config/app.config.local.js`
   - Should see the config file (not 404)
   - File should contain your Supabase credentials

4. **Manual Fix (Temporary):**
   If the workflow isn't working, you can manually add meta tags to `index.html`:
   ```html
   <meta name="lms-supabase_url" content="YOUR_SUPABASE_URL">
   <meta name="lms-supabase_anon_key" content="YOUR_ANON_KEY">
   ```
   **Note:** This is less secure as credentials are in the HTML file.

---

## Local Development Setup

For local development:

1. **Create `config/app.config.local.js`:**
   ```javascript
   window.LMS_CONFIG = {
       SUPABASE_URL: 'your-supabase-url',
       SUPABASE_ANON_KEY: 'your-anon-key',
       SUPABASE_SERVICE_KEY: 'your-service-key', // Optional
       OPENAI_API_KEY: 'your-openai-key', // Optional
       ADMIN_USERNAME: 'admin', // Optional
       ADMIN_PASSWORD: 'password', // Optional
       ADMIN_EMAIL: 'admin@example.com' // Optional
   };
   ```

2. **Verify it works:**
   - Open browser console
   - Should see "✅ LMS Backend configured"
   - No errors

---

## Security Notes

- ✅ `config/app.config.local.js` is in `.gitignore` - won't be committed
- ✅ In production, file is generated during deployment (not in repo)
- ✅ Supabase anon key is safe to expose (it's public by design)
- ⚠️ Service key should NOT be exposed in client-side code
- ⚠️ OpenAI API key should NOT be exposed in client-side code

**Important:** The service key and OpenAI API key in `window.LMS_CONFIG` are only used by server-side scripts (like indexing scripts), not by the client-side app. The client-side app only needs the Supabase URL and anon key.

---

## Verification Checklist

After deployment, verify:

- [ ] No 404 errors in browser console for `app.config.local.js`
- [ ] Console shows "✅ LMS Backend configured"
- [ ] Supabase connection works (try logging in)
- [ ] AI Coach works (if OpenAI key is set)
- [ ] Config file exists at deployed URL

---

## Alternative: Using Meta Tags

If the workflow approach doesn't work, you can use meta tags as a fallback:

1. **Add to `index.html` in `<head>`:**
   ```html
   <meta name="lms-supabase_url" content="YOUR_SUPABASE_URL">
   <meta name="lms-supabase_anon_key" content="YOUR_ANON_KEY">
   ```

2. **Update workflow to inject these:**
   ```yaml
   - name: Inject config via meta tags
     run: |
       sed -i 's|</head>|<meta name="lms-supabase_url" content="${{ secrets.SUPABASE_URL }}">\n<meta name="lms-supabase_anon_key" content="${{ secrets.SUPABASE_ANON_KEY }}">\n</head>|' index.html
   ```

However, the config file approach is preferred as it's cleaner and doesn't expose credentials in HTML.

