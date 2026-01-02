# Environment Variables (.env) File Format Guide

## Overview

This project uses environment variables for configuration. The `.env` file format follows standard conventions for environment variable files.

## File Location

- **Template**: `.env.example` (committed to git)
- **Actual**: `.env` (gitignored, never committed)

## Formatting Rules

### Basic Syntax

```env
# Comments start with # and must be on their own line
VARIABLE_NAME=value
ANOTHER_VARIABLE=another_value
```

### Key Rules

1. **No spaces around `=`**
   ```env
   # ✅ Correct
   SUPABASE_URL=https://example.supabase.co
   
   # ❌ Wrong
   SUPABASE_URL = https://example.supabase.co
   ```

2. **No quotes needed** (unless value contains spaces)
   ```env
   # ✅ Correct
   API_KEY=sk-proj-abc123
   MESSAGE=Hello World
   
   # ✅ Also correct (quotes optional for values with spaces)
   MESSAGE="Hello World"
   ```

3. **One variable per line**
   ```env
   # ✅ Correct
   VAR1=value1
   VAR2=value2
   
   # ❌ Wrong
   VAR1=value1 VAR2=value2
   ```

4. **No line breaks in values**
   ```env
   # ✅ Correct
   LONG_VALUE=this-is-a-very-long-value-that-stays-on-one-line
   
   # ❌ Wrong
   LONG_VALUE=this-is-a-very-long-value-that-
   continues-on-another-line
   ```

5. **Variable names are UPPERCASE with underscores**
   ```env
   # ✅ Correct
   SUPABASE_URL=https://example.supabase.co
   OPENAI_API_KEY=sk-proj-abc123
   
   # ❌ Wrong (lowercase)
   supabase_url=https://example.supabase.co
   ```

6. **Comments use `#`**
   ```env
   # This is a comment
   VARIABLE_NAME=value
   
   # Multiple line comments
   # are allowed
   ```

7. **Empty lines are allowed**
   ```env
   # Section 1
   VAR1=value1
   
   # Section 2
   VAR2=value2
   ```

## Example .env File

```env
# ============================================
# Supabase Configuration
# ============================================

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================
# OpenAI Configuration
# ============================================

OPENAI_API_KEY=sk-proj-abc123def456

# ============================================
# Admin Credentials
# ============================================

ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password-123
ADMIN_EMAIL=admin@system.local

# ============================================
# Application Settings
# ============================================

NODE_ENV=development
PORT=3000
```

## Common Mistakes

### ❌ Wrong
```env
# Spaces around =
SUPABASE_URL = https://example.supabase.co

# Quotes around simple values (unnecessary)
API_KEY="sk-proj-abc123"

# Lowercase variable names
supabase_url=https://example.supabase.co

# Multi-line values
LONG_KEY=this-is-a-very-
long-key-value
```

### ✅ Correct
```env
# No spaces around =
SUPABASE_URL=https://example.supabase.co

# No quotes needed
API_KEY=sk-proj-abc123

# Uppercase with underscores
SUPABASE_URL=https://example.supabase.co

# Single line values
LONG_KEY=this-is-a-very-long-key-value
```

## Security Best Practices

1. **Never commit `.env` to git**
   - The `.env` file is already in `.gitignore`
   - Only commit `.env.example` as a template

2. **Use strong passwords**
   ```env
   # ✅ Good
   ADMIN_PASSWORD=MyStr0ng!P@ssw0rd
   
   # ❌ Bad
   ADMIN_PASSWORD=password123
   ```

3. **Keep secrets secret**
   - Never share `.env` files
   - Use environment variables in production
   - Rotate keys regularly

4. **Use different values for different environments**
   - Development: `.env.development`
   - Staging: `.env.staging`
   - Production: Use platform environment variables (not files)

## Loading Environment Variables

### In Node.js
```javascript
require('dotenv').config();
const apiKey = process.env.OPENAI_API_KEY;
```

### In Browser (via build tools)
Most build tools (Vite, Webpack, etc.) automatically load `.env` files:
```javascript
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
```

## Troubleshooting

### Variables not loading?
1. Check file is named exactly `.env` (not `.env.txt`)
2. Check file is in the project root
3. Check no spaces around `=`
4. Check variable names match exactly (case-sensitive)

### Values with special characters?
If your value contains special characters, you may need quotes:
```env
# Values with spaces
MESSAGE="Hello World"

# Values with special characters
PASSWORD="MyP@ssw0rd!"
```

## Quick Reference

| Rule | Example |
|------|---------|
| No spaces around `=` | `KEY=value` ✅ |
| Uppercase variable names | `API_KEY` ✅ |
| One per line | `KEY1=val1`<br>`KEY2=val2` ✅ |
| Comments with `#` | `# Comment` ✅ |
| No quotes (usually) | `KEY=value` ✅ |

