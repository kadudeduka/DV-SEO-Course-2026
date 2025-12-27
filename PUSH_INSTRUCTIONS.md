# Push Instructions for dv-seo-publish

## Current Status
✅ Content has been synced and committed locally
⚠️ Push failed due to authentication - needs Personal Access Token

## Steps to Push

### 1. Create a Personal Access Token (PAT) on GitHub

1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "dv-seo-publish-push")
4. Select scopes: Check `repo` (full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### 2. Update Credentials

You have two options:

#### Option A: Use Git Credential Manager (Recommended)
```bash
cd /Users/kapilnakra/projects/dv-seo-publish
git push origin main
# When prompted:
# Username: kadudeduka
# Password: <paste your Personal Access Token here>
```

#### Option B: Update Keychain Credentials
1. Open Keychain Access app
2. Search for "github.com"
3. Find the entry for "github.com"
4. Delete it or update it with:
   - Username: `kadudeduka`
   - Password: `<your Personal Access Token>`
5. Then run: `git push origin main`

### 3. Alternative: Use Token in URL (Temporary)

```bash
cd /Users/kapilnakra/projects/dv-seo-publish
git remote set-url origin https://kadudeduka:YOUR_TOKEN@github.com/kadudeduka/DV-SEO-Course-2026.git
git push origin main
```

**Note:** This stores the token in the URL (less secure). Consider using credential helper instead.

## Verify Push

After successful push:
```bash
git log --oneline -1
git status
```

You should see your commit on GitHub at:
https://github.com/kadudeduka/DV-SEO-Course-2026

