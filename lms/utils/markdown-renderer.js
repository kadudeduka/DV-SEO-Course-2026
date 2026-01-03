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
    try {
        // Check if we're on GitHub Pages
        if (window.location.hostname.includes('github.io')) {
            // Extract base path from URL (e.g., '/DV-SEO-Course-2026/')
            const pathname = window.location.pathname;
            
            // Get the first non-empty segment (the repository name)
            const segments = pathname.split('/').filter(Boolean);
            
            if (segments.length > 0) {
                const repoName = segments[0];
                const basePath = `/${repoName}/`;
                
                // Debug logging (can be removed in production)
                console.log('[MarkdownRenderer] GitHub Pages detected:', {
                    hostname: window.location.hostname,
                    pathname: pathname,
                    segments: segments,
                    basePath: basePath
                });
                
                return basePath;
            }
            
            // Fallback: try to extract from full URL
            const fullUrl = window.location.href;
            const urlMatch = fullUrl.match(/https?:\/\/[^\/]+\/([^\/]+)/);
            if (urlMatch && urlMatch[1]) {
                const basePath = `/${urlMatch[1]}/`;
                console.log('[MarkdownRenderer] Extracted base path from URL:', basePath);
                return basePath;
            }
        }
        
        // Localhost or other environments
        console.log('[MarkdownRenderer] Localhost detected, using root path');
        return '';
    } catch (error) {
        console.error('[MarkdownRenderer] Error getting base path:', error);
        return '';
    }
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
            let fixedPath;
            
            if (basePath) {
                // Remove leading slash from imagePath and prepend basePath
                fixedPath = `${basePath}${imagePath.substring(1)}`;
            } else {
                // Use absolute path from root
                fixedPath = imagePath;
            }
            
            console.log('[MarkdownRenderer] Fixed image path:', {
                original: match,
                basePath: basePath,
                imagePath: imagePath,
                fixedPath: fixedPath
            });
            
            return `![${alt}](${fixedPath})`;
        }
    );

    const { marked } = await import('https://cdn.jsdelivr.net/npm/marked@11/+esm');
    const DOMPurify = await import('https://cdn.jsdelivr.net/npm/dompurify@3/+esm');

    const html = marked.parse(fixedMarkdown, {
        breaks: true,
        gfm: true
    });

    // Post-process HTML to fix any image paths that might have been modified
    // This ensures GitHub Pages base path is applied even if marked changes the paths
    // (basePath is already declared above, reuse it)
    let processedHtml = html;
    
    if (basePath) {
        // Fix image src attributes that start with /data/courses/ but don't have the base path
        processedHtml = processedHtml.replace(
            /<img([^>]*)\ssrc="(\/data\/courses\/[^"]+)"([^>]*)>/gi,
            (match, before, src, after) => {
                // Only fix if it doesn't already have the base path
                if (!src.startsWith(basePath)) {
                    const fixedSrc = `${basePath}${src.substring(1)}`;
                    console.log('[MarkdownRenderer] Post-processing fixed image src:', {
                        original: src,
                        fixed: fixedSrc
                    });
                    return `<img${before} src="${fixedSrc}"${after}>`;
                }
                return match;
            }
        );
    }

    const sanitized = DOMPurify.default.sanitize(processedHtml, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'del'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
    });

    return sanitized;
}

