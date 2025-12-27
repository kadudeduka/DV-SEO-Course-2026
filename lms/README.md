# LMS - Learning Management System

A modern, interactive Learning Management System for the SEO Master Course 2025.

## Features

- 📚 **Course Navigation**: Browse all 20 days, 36 chapters, and 22 labs
- 🎯 **Progress Tracking**: Automatically saves your progress in the browser
- 🔍 **Content Filtering**: Filter by books, labs, or view all
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- ⚡ **Fast Loading**: Lightweight and fast markdown rendering
- ⌨️ **Keyboard Shortcuts**: Navigate with keyboard (Ctrl/Cmd + Arrow keys)
- 🎨 **Modern UI**: Clean, professional interface with smooth animations

## Quick Start

1. **Open the LMS**: Open `index.html` in a web browser
   ```bash
   # Using Python
   python3 -m http.server 8000
   # Then visit: http://localhost:8000/index.html
   
   # Or simply double-click index.html (may have CORS issues with file://)
   ```

2. **Start Learning**: 
   - Click "Start Course" on the welcome screen
   - Or navigate using the sidebar to any day/chapter/lab
   - Your progress is automatically saved

3. **Navigate**:
   - Use the sidebar to browse course content
   - Use Previous/Next buttons to move through content
   - Use keyboard shortcuts (Ctrl/Cmd + Left/Right arrows)

## File Structure

```
dv-seo-publish/
├── index.html          # Main LMS entry point
├── lms/
│   ├── app.js          # LMS application logic
│   ├── course-data.js  # Course structure and metadata
│   ├── styles.css      # Styling and responsive design
│   └── README.md       # This file
├── books/              # Course chapters (markdown files)
├── labs/               # Lab exercises (markdown files)
├── visuals/            # Visual assets (SVG files)
└── resources/          # Additional resources
```

## How It Works

### Course Data (`course-data.js`)
- Contains the complete course structure
- Defines all days, chapters, and labs
- Includes file paths and metadata
- Helper functions for navigation

### Application Logic (`app.js`)
- Handles content loading and rendering
- Manages progress tracking (localStorage)
- Controls navigation and UI interactions
- Renders markdown using marked.js library

### Styling (`styles.css`)
- Modern, responsive design
- Mobile-friendly interface
- Smooth animations and transitions
- Accessible color scheme

## Features Explained

### Progress Tracking
- Progress is saved in browser localStorage
- Check "Mark as complete" to track finished items
- Progress percentage shown in header
- Completed items marked with ✓ in navigation

### Content Filtering
- **All**: Shows all books and labs
- **📚 Books**: Shows only chapters/books
- **🧪 Labs**: Shows only lab exercises

### Navigation
- **Sidebar**: Browse all course content organized by day
- **Breadcrumb**: See your current location
- **Previous/Next**: Navigate sequentially through content
- **Keyboard Shortcuts**:
  - `Ctrl/Cmd + ←` : Previous content
  - `Ctrl/Cmd + →` : Next content
  - `Esc` : Close sidebar (mobile)

### Mobile Support
- Responsive design adapts to screen size
- Collapsible sidebar for mobile
- Touch-friendly interface
- Optimized for small screens

## Customization

### Adding New Content
1. Add the markdown file to `books/` or `labs/`
2. Update `course-data.js` with the new content entry
3. Refresh the LMS to see the new content

### Changing Styles
- Edit `lms/styles.css`
- Modify CSS variables at the top for colors and spacing
- All styling is modular and easy to customize

### Modifying Course Structure
- Edit `lms/course-data.js`
- Follow the existing structure format
- Ensure file paths are correct relative to `index.html`

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Note**: Due to CORS restrictions, you may need to serve files via a web server rather than opening directly (file://). Use a local server like:
- Python: `python3 -m http.server 8000`
- Node.js: `npx http-server`
- VS Code: Live Server extension

## Troubleshooting

### Content Not Loading
- **Check file paths**: Ensure markdown files exist at specified paths
- **Check browser console**: Look for errors in developer tools
- **CORS issues**: Use a web server, not file:// protocol

### Progress Not Saving
- **Check localStorage**: Open browser dev tools > Application > Local Storage
- **Browser settings**: Ensure cookies/localStorage are enabled
- **Private/Incognito**: Progress may not persist in private mode

### Images Not Showing
- **Path issues**: Check image paths in markdown files
- **Relative paths**: Ensure paths are relative to the markdown file location
- **File existence**: Verify image files exist

## Technical Details

- **No Backend Required**: Fully client-side application
- **No Build Process**: Pure HTML/CSS/JavaScript
- **Markdown Rendering**: Uses [marked.js](https://marked.js.org/)
- **Storage**: Uses browser localStorage for progress
- **Dependencies**: Only marked.js (loaded via CDN)

## Future Enhancements

Potential features to add:
- Search functionality
- Bookmarking favorite content
- Note-taking within content
- Export progress report
- Dark mode toggle
- Offline support (Service Worker)
- Print-friendly view

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify all file paths are correct
3. Ensure you're using a web server (not file://)
4. Check that all dependencies load correctly

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-27  
**Course**: SEO Master Course 2025

