# GitHub Pages Setup Guide

This guide will help you host the SEO Master Course LMS on GitHub Pages.

## Prerequisites

- GitHub account
- This repository already connected to GitHub: `git@github.com:kadudeduka/DV-SEO-Course-2026.git`

## Step-by-Step Setup

### 1. Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/kadudeduka/DV-SEO-Course-2026`
2. Click on **Settings** (top menu)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select:
   - **Branch**: `main` (or `master` if that's your default branch)
   - **Folder**: `/ (root)`
5. Click **Save**
6. GitHub will provide you with a URL like: `https://kadudeduka.github.io/DV-SEO-Course-2026/`

### 2. Wait for Deployment

- GitHub Pages typically takes 1-2 minutes to deploy
- You'll see a green checkmark ✅ next to your commit when it's ready
- You can check deployment status in the **Actions** tab

### 3. Access Your LMS

Once deployed, access your LMS at:
```
https://kadudeduka.github.io/DV-SEO-Course-2026/
```

Or if you set up a custom domain:
```
https://yourdomain.com
```

## Custom Domain (Optional)

If you want to use a custom domain:

1. In GitHub Pages settings, enter your domain under **Custom domain**
2. Follow GitHub's instructions to configure DNS
3. GitHub will create a `CNAME` file automatically

## File Structure

The repository is already set up correctly for GitHub Pages:
- `index.html` is in the root (required)
- All assets use relative paths (will work on GitHub Pages)
- `.nojekyll` file is present (prevents Jekyll processing)

## Troubleshooting

### Links Not Working
- Ensure all file paths are relative (not absolute)
- Check browser console for 404 errors
- Verify file names match exactly (case-sensitive)

### Content Not Loading
- Check that markdown files are committed to the repository
- Verify the file paths in `lms/course-data.js` match the actual file structure
- Check browser console for fetch errors

### Styling Issues
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check that CSS file is loading correctly
- Verify fonts are loading (Google Fonts should work)

## Updating Content

To update content:

1. Make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update course content"
   git push origin main
   ```
3. GitHub Pages will automatically rebuild (takes 1-2 minutes)

## Repository Settings

Recommended repository settings:
- **Repository visibility**: Public (for free GitHub Pages) or Private (requires GitHub Pro)
- **Features**: Enable Issues and Wiki if you want feedback/discussions

## Security Considerations

- All content is public if repository is public
- No sensitive data should be committed
- External resources (images, fonts) should use HTTPS

## Support

For issues:
1. Check GitHub Pages status: https://www.githubstatus.com/
2. Review deployment logs in the **Actions** tab
3. Check browser console for errors

---

**Note:** The LMS uses client-side JavaScript, so it will work perfectly on GitHub Pages without any server-side configuration.
