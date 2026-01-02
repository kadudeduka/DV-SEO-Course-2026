# Data Directory

This directory contains all course data and content files.

## Structure

```
data/
├── courses/              # Course data
│   └── {course-id}/      # Individual course folders
│       ├── course.json   # Course metadata
│       ├── structure.js  # Course structure (days, chapters, labs)
│       ├── tools.json    # Course-specific tools registry
│       ├── content/      # Course content files
│       │   ├── chapters/ # Chapter markdown files
│       │   └── labs/     # Lab markdown files
│       └── assets/       # Course assets (images, SVGs)
└── courses.js            # Course registry (list of all courses)
```

## Adding a New Course

1. Create folder: `data/courses/{course-id}/`
2. Add `course.json` with course metadata
3. Add `structure.js` with course structure
4. Add `tools.json` with course-specific tools (if applicable)
5. Add content files to `content/chapters/` and `content/labs/`
6. Add assets to `assets/` folder
7. Register course in `data/courses.js`
