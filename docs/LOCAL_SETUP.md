# Local Development Setup

## Quick Start

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   - Edit `config/.env` with your credentials
   - The `.env` file is gitignored and won't be committed

3. **Generate local config file**:
   ```bash
   npm run generate-config
   ```
   
   This reads `config/.env` and generates `config/app.config.local.js` for the browser.

4. **Start local server**:
   ```bash
   # Using Python (if installed)
   python -m http.server 8000
   
   # Or using Node.js http-server (if installed)
   npx http-server -p 8000
   
   # Or any other static file server
   ```

5. **Open in browser**:
   ```
   http://localhost:8000
   ```

## Environment Variables

The `config/.env` file should contain:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
OPENAI_API_KEY=your-openai-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
ADMIN_EMAIL=admin@system.local
```

## Important Notes

- **Never commit `config/.env` or `config/app.config.local.js`** - they are gitignored
- **Always run `npm run generate-config`** after updating `.env` to regenerate the browser config
- The generated `app.config.local.js` is what the browser reads
- For GitHub Pages, the config is generated automatically from GitHub Secrets via GitHub Actions

## Troubleshooting

### Config file not found error
- Run `npm run generate-config` to create the config file from `.env`

### Changes to .env not reflected
- Run `npm run generate-config` again after editing `.env`

### GitHub Pages vs Local
- **Local**: Uses `config/.env` → generates `config/app.config.local.js`
- **GitHub Pages**: Uses GitHub Secrets → generates `config/app.config.local.js` during deployment

