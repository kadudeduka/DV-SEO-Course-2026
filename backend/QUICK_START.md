# Quick Start - Backend Setup

## 5-Minute Setup

### 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com)
- Click "New Project"
- Name: `seo-lms-backend`
- Save database password
- Wait 2 minutes

### 2. Get API Keys
- Settings → API
- Copy **Project URL** and **Publishable key** (replaces legacy "anon public key")

### 3. Run Database Schema
- SQL Editor → New Query
- Paste contents of `backend/schema.sql`
- Click Run

### 4. Configure Frontend
Create `lms/config.local.js`:
```javascript
window.LMS_CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // Use your Publishable key
};
```
**Note:** Use the **Publishable key** from your dashboard (not the legacy anon key).

### 5. Test
- Open `index.html` in browser
- Check console: Should see "✅ LMS Backend initialized"

## Create Admin User

1. Authentication → Users → Add user
2. Create user with email/password
3. SQL Editor → Run:
```sql
UPDATE public.users SET is_admin = TRUE WHERE email = 'admin@example.com';
```

## Done! ✅

Backend is ready. Authentication and admin approval can now be implemented.

## Troubleshooting

**"Backend not configured"**
- Check `config.local.js` exists
- Verify URL and key are correct
- Check browser console for errors

**"RLS Policy Error"**
- Ensure schema.sql was run completely
- Check user is authenticated (if required)

**Connection Issues**
- Verify Supabase project is active
- Check API keys are correct
- Ensure Supabase JS library loaded

## Next Steps

See [BACKEND_SETUP.md](../BACKEND_SETUP.md) for detailed instructions.

