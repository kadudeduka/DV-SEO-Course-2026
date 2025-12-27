# LMS - Learning Management System Guide

## Overview

This project now includes a modern, interactive Learning Management System (LMS) that provides an easy way to navigate and access all course materials.

## Quick Start

### Option 1: Using the Start Script (Recommended)
```bash
./start-lms.sh
```
Then open your browser to: `http://localhost:8000/index.html`

### Option 2: Manual Python Server
```bash
python3 -m http.server 8000
```
Then visit: `http://localhost:8000/index.html`

### Option 3: Other Web Servers
- **Node.js**: `npx http-server`
- **VS Code**: Use Live Server extension
- **PHP**: `php -S localhost:8000`

**Important**: Due to browser security (CORS), you cannot open `index.html` directly with `file://`. You must use a web server.

## LMS Features

### 🎯 Main Features
1. **Course Navigation**: Browse all 20 days, 36 chapters, and 22 labs
2. **Progress Tracking**: Automatically saves progress in browser
3. **Content Filtering**: Filter by books 📚, labs 🧪, or view all
4. **Responsive Design**: Works on desktop, tablet, and mobile
5. **Keyboard Shortcuts**: Navigate with Ctrl/Cmd + Arrow keys
6. **Modern UI**: Clean, professional interface

### 📱 User Interface

**Welcome Screen**:
- Course overview and statistics
- Getting started instructions
- Quick access to start the course

**Sidebar Navigation**:
- Organized by days (1-20)
- Expandable/collapsible sections
- Shows books and labs separately
- Visual indicators for completed items

**Content Viewer**:
- Clean markdown rendering
- Previous/Next navigation
- Breadcrumb navigation
- Mark as complete checkbox
- Progress indicator

### ⌨️ Keyboard Shortcuts
- `Ctrl/Cmd + ←` : Previous content
- `Ctrl/Cmd + →` : Next content
- `Esc` : Close sidebar (mobile)

### 📊 Progress Tracking
- Automatically saved in browser localStorage
- Shows completion percentage in header
- Completed items marked with ✓
- Persists across sessions

## File Structure

```
dv-seo-publish/
├── index.html              # 🎯 Main LMS entry point - START HERE
├── start-lms.sh            # Quick start script
├── LMS_GUIDE.md           # This file
│
├── lms/                    # LMS system files
│   ├── app.js             # Application logic
│   ├── course-data.js     # Course structure
│   ├── styles.css         # Styling
│   └── README.md          # Technical documentation
│
├── books/                  # Course chapters (36 files)
├── labs/                   # Lab exercises (22 files)
├── visuals/                # Visual assets
├── resources/              # Additional resources
├── INDEX.md               # Course index (markdown)
└── Table_of_Contents.md   # Complete table of contents
```

## How to Use

### For Learners
1. Start the web server (see Quick Start above)
2. Open `index.html` in your browser
3. Click "Start Course" or browse from the sidebar
4. Read chapters and complete labs
5. Mark items as complete to track progress

### For Trainers/Administrators
1. All course content is in `books/` and `labs/` folders
2. Course structure is defined in `lms/course-data.js`
3. To add/modify content:
   - Add markdown files to appropriate folders
   - Update `course-data.js` with new entries
   - Refresh the LMS

### Customization
- **Styling**: Edit `lms/styles.css` (CSS variables at top)
- **Structure**: Edit `lms/course-data.js`
- **Behavior**: Edit `lms/app.js`

## Technical Details

### Technologies
- **HTML5**: Structure
- **CSS3**: Styling with modern features
- **JavaScript (ES6+)**: Application logic
- **Marked.js**: Markdown rendering (CDN)
- **LocalStorage**: Progress persistence

### Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

### Dependencies
- Only one external dependency: **marked.js** (loaded via CDN)
- No build process required
- No backend required
- Fully client-side

## Troubleshooting

### Content Not Loading
1. Check browser console for errors (F12)
2. Verify file paths in `course-data.js`
3. Ensure markdown files exist
4. Make sure you're using a web server (not file://)

### Progress Not Saving
1. Check browser settings (allow localStorage)
2. Not available in private/incognito mode
3. Clear browser cache and try again

### Images Not Showing
1. Check image paths in markdown files
2. Ensure images exist in `visuals/` folder
3. Verify relative paths are correct

### Server Not Starting
1. Check if Python 3 is installed: `python3 --version`
2. Try a different port: `python3 -m http.server 8080`
3. Use an alternative server (Node.js, PHP, etc.)

## Access Methods

### Local Development
```bash
# Method 1: Quick script
./start-lms.sh

# Method 2: Python
python3 -m http.server 8000

# Method 3: Node.js
npx http-server -p 8000

# Method 4: PHP
php -S localhost:8000
```

### Production Deployment
- Upload all files to a web server
- Ensure `index.html` is accessible
- All paths are relative and should work
- No server-side configuration needed

## Next Steps

1. **Start the server**: Run `./start-lms.sh`
2. **Open in browser**: Visit `http://localhost:8000/index.html`
3. **Explore**: Browse the course content
4. **Learn**: Start with Day 1 and work through the course
5. **Track Progress**: Mark items as complete as you go

## Support

For issues:
1. Check `lms/README.md` for technical details
2. Review browser console for errors
3. Verify all file paths are correct
4. Ensure you're using a web server

---

**Created**: 2025-01-27  
**Version**: 1.0.0  
**Course**: SEO Master Course 2025

