/**
 * Markdown Renderer Utility
 * 
 * Safely converts markdown to HTML with XSS protection.
 */

/**
 * Get base path for GitHub Pages or localhost
 * @returns {string} Base path (e.g., '/DV-SEO-Course-2026/' or '')
 */
function getBasePath() {
    // Check if we're on GitHub Pages
    if (window.location.hostname.includes('github.io')) {
        // Extract base path from URL (e.g., '/DV-SEO-Course-2026/')
        const pathname = window.location.pathname;
        // Get the first non-empty segment (the repository name)
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
            const basePath = `/${segments[0]}`;
            return basePath.endsWith('/') ? basePath : `${basePath}/`;
        }
    }
    // Localhost or other environments - return empty string (paths will start with /)
    return '';
}

/**
 * Render markdown to HTML with sanitization
 * @param {string} markdown - Markdown content
 * @param {string} courseId - Optional course ID for fixing image paths
 * @returns {Promise<string>} Sanitized HTML
 */
export async function renderMarkdown(markdown, courseId = 'seo-master-2026') {
    if (!markdown) {
        return '';
    }

    // Get base path for GitHub Pages compatibility
    const basePath = getBasePath();
    
    // Fix image paths: ../visuals/ -> {basePath}/data/courses/{courseId}/assets/visuals/
    // This handles the case where markdown files reference ../visuals/ but files are in assets/visuals/
    // Also handles GitHub Pages base path requirement
    const fixedMarkdown = markdown.replace(
        /!\[([^\]]*)\]\(\.\.\/visuals\/([^\)]+)\)/g,
        (match, alt, path) => {
            // Build the full path: basePath + /data/courses/...
            // basePath is either '/DV-SEO-Course-2026/' (for GitHub Pages) or '' (for localhost)
            // For localhost: /data/courses/...
            // For GitHub Pages: /DV-SEO-Course-2026/data/courses/...
            const imagePath = `/data/courses/${courseId}/assets/visuals/${path}`;
            const fixedPath = basePath ? `${basePath}${imagePath.substring(1)}` : imagePath;
            return `![${alt}](${fixedPath})`;
        }
    );

    const { marked } = await import('https://cdn.jsdelivr.net/npm/marked@11/+esm');
    const DOMPurify = await import('https://cdn.jsdelivr.net/npm/dompurify@3/+esm');

    const html = marked.parse(fixedMarkdown, {
        breaks: true,
        gfm: true
    });

    const sanitized = DOMPurify.default.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'del'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
    });

    return sanitized;
}

