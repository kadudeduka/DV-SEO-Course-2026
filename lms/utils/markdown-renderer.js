/**
 * Markdown Renderer Utility
 * 
 * Safely converts markdown to HTML with XSS protection.
 */

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

    // Fix image paths: ../visuals/ -> /data/courses/{courseId}/assets/visuals/
    // This handles the case where markdown files reference ../visuals/ but files are in assets/visuals/
    const fixedMarkdown = markdown.replace(
        /!\[([^\]]*)\]\(\.\.\/visuals\/([^\)]+)\)/g,
        (match, alt, path) => {
            const fixedPath = `/data/courses/${courseId}/assets/visuals/${path}`;
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

