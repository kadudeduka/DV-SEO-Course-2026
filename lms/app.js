// LMS Application Logic

class LMS {
    constructor() {
        this.currentContentId = null;
        this.completedItems = this.loadProgress();
        this.filterType = 'all';
        this.init();
    }

    init() {
        this.renderNavigation();
        this.attachEventListeners();
        this.checkURLParams();
    }

    // Load progress from localStorage
    loadProgress() {
        const saved = localStorage.getItem('lms-progress');
        return saved ? JSON.parse(saved) : [];
    }

    // Save progress to localStorage
    saveProgress() {
        localStorage.setItem('lms-progress', JSON.stringify(this.completedItems));
    }

    // Mark item as complete
    markComplete(contentId, completed) {
        if (completed) {
            if (!this.completedItems.includes(contentId)) {
                this.completedItems.push(contentId);
            }
        } else {
            this.completedItems = this.completedItems.filter(id => id !== contentId);
        }
        this.saveProgress();
        this.updateProgress();
        this.updateNavigationState();
    }

    // Check if item is complete
    isComplete(contentId) {
        return this.completedItems.includes(contentId);
    }

    // Calculate progress percentage
    calculateProgress() {
        const allItems = getAllContentItems();
        const total = allItems.length;
        const completed = this.completedItems.length;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    // Update progress display (removed - progress indicator removed from UI)
    updateProgress() {
        // Progress indicator removed from header
    }

    // Render navigation sidebar
    renderNavigation() {
        const nav = document.getElementById('courseNav');
        if (!nav) return;

        nav.innerHTML = '';

        courseData.days.forEach(day => {
            const daySection = document.createElement('div');
            daySection.className = 'day-section';
            daySection.dataset.day = day.day;

            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.innerHTML = `
                <h3>
                    <span class="day-number">Day ${day.day}</span>
                    ${day.title}
                </h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            dayHeader.addEventListener('click', () => {
                daySection.classList.toggle('expanded');
            });

            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';

            // Add chapters
            day.chapters.forEach(chapter => {
                if (this.shouldShowItem(chapter)) {
                    const navItem = this.createNavItem(chapter, day);
                    dayContent.appendChild(navItem);
                }
            });

            // Add labs
            day.labs.forEach(lab => {
                if (this.shouldShowItem(lab)) {
                    const navItem = this.createNavItem(lab, day);
                    dayContent.appendChild(navItem);
                }
            });

            // Only show day section if it has visible content
            if (dayContent.children.length > 0) {
                daySection.appendChild(dayHeader);
                daySection.appendChild(dayContent);
                nav.appendChild(daySection);
            }
        });

        // Expand first day by default
        const firstDay = nav.querySelector('.day-section');
        if (firstDay) {
            firstDay.classList.add('expanded');
        }

        this.updateNavigationState();
    }

    // Create navigation item
    createNavItem(item, day) {
        const navItem = document.createElement('a');
        navItem.className = 'nav-item';
        navItem.href = '#';
        navItem.dataset.id = item.id;
        navItem.dataset.type = item.type;
        navItem.textContent = item.title;

        if (this.isComplete(item.id)) {
            navItem.classList.add('completed');
        }

        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadContent(item.id);
        });

        return navItem;
    }

    // Check if item should be shown based on filter
    shouldShowItem(item) {
        if (this.filterType === 'all') return true;
        // Handle plural filter names (books -> book, labs -> lab)
        const normalizedFilter = this.filterType === 'books' ? 'book' : 
                                this.filterType === 'labs' ? 'lab' : 
                                this.filterType;
        return item.type === normalizedFilter;
    }

    // Update navigation state (active, completed)
    updateNavigationState() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const itemId = item.dataset.id;
            item.classList.remove('active');
            
            if (itemId === this.currentContentId) {
                item.classList.add('active');
            }

            if (this.isComplete(itemId)) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }
        });
    }

    // Load content by ID
    async loadContent(contentId) {
        const content = getContentById(contentId);
        if (!content) {
            console.error('Content not found:', contentId);
            return;
        }

        this.currentContentId = contentId;
        this.updateNavigationState();

        // Hide welcome screen, show content viewer
        const welcomeScreen = document.getElementById('welcomeScreen');
        const contentViewer = document.getElementById('contentViewer');
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (contentViewer) contentViewer.style.display = 'block';

        // Update URL
        window.history.pushState({ contentId }, '', `#${contentId}`);

        // Show loading
        const contentBody = document.getElementById('contentBody');
        if (contentBody) {
            contentBody.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading content...</p>
                </div>
            `;
        }

        try {
            // Load markdown file
            const response = await fetch(content.file);
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.statusText}`);
            }

            const markdown = await response.text();
            const html = marked.parse(markdown);

            // Update content
            if (contentBody) {
                contentBody.innerHTML = html;
            }

            // Fix image paths (relative to visuals folder)
            this.fixImagePaths(contentBody);
            
            // Fix markdown links to work with LMS
            this.fixMarkdownLinks(contentBody);

            // Update breadcrumb
            this.updateBreadcrumb(content, contentBody);

            // Restore navigation buttons
            this.restoreNavigationButtons();

            // Update navigation buttons
            this.updateNavigationButtons();

            // Update checkbox
            this.updateCompleteCheckbox();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Error loading content:', error);
            if (contentBody) {
                contentBody.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--error-color);">
                        <h2>Error Loading Content</h2>
                        <p>${error.message}</p>
                        <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
                            Please check that the file exists: <code>${content.file}</code>
                        </p>
                    </div>
                `;
            }
        }
    }

    // Fix image paths in content
    fixImagePaths(contentBody) {
        if (!contentBody) return;

        const images = contentBody.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('../')) {
                // Convert relative paths
                const newSrc = src.replace('../', '');
                img.setAttribute('src', newSrc);
            }
        });
    }

    // Helper function to normalize file names for matching
    normalizeFileName(fileName) {
        // Remove path prefixes
        let normalized = fileName.replace(/^.*\//, '');
        // Normalize Day_1 to Day_01, Lab_1 to Lab_01, etc.
        normalized = normalized.replace(/Day_(\d+)/gi, (match, num) => {
            const dayNum = num.padStart(2, '0');
            return `Day_${dayNum}`;
        });
        normalized = normalized.replace(/Lab_(\d+)/gi, (match, num) => {
            const labNum = num.padStart(2, '0');
            return `Lab_${labNum}`;
        });
        normalized = normalized.replace(/Chapter_(\d+)/gi, (match, num) => {
            const chNum = num.padStart(2, '0');
            return `Chapter_${chNum}`;
        });
        // Normalize common variations
        normalized = normalized.replace(/_/g, '_'); // Ensure consistent underscores
        normalized = normalized.replace(/format/gi, 'Format'); // Normalize format capitalization
        normalized = normalized.replace(/submission/gi, 'Submission'); // Normalize submission capitalization
        return normalized.toLowerCase();
    }

    // Helper function to generate possible submission format file names
    generateSubmissionFormatPaths(linkPath) {
        const paths = [];
        // Remove .html or .md extension for processing
        const basePath = linkPath.replace(/\.(html|md)$/, '');
        const fileName = basePath.replace(/^.*\//, '');
        const extension = linkPath.match(/\.(html|md)$/)?.[1] || 'html'; // Default to .html for MkDocs
        
        // Extract day and lab numbers if present - handle both underscore and space
        const dayMatch = fileName.match(/day[_\s]?(\d+)/i);
        const labMatch = fileName.match(/lab[_\s]?(\d+)/i);
        
        if (dayMatch && labMatch) {
            const dayNum = dayMatch[1].padStart(2, '0');
            const labNum = labMatch[1].padStart(2, '0');
            const dayRaw = dayMatch[1];
            const labRaw = labMatch[1];
            
            // For HTML links (MkDocs), prioritize .html extension
            if (extension === 'html') {
                // Prioritize zero-padded versions with .html extension (MkDocs output)
                paths.push(`labs/Day_${dayNum}_Lab_${labNum}_Submission_Format.html`);
                paths.push(`Day_${dayNum}_Lab_${labNum}_Submission_Format.html`);
                
                // Then try non-padded versions
                if (dayNum !== dayRaw || labNum !== labRaw) {
                    paths.push(`labs/Day_${dayRaw}_Lab_${labRaw}_Submission_Format.html`);
                    paths.push(`Day_${dayRaw}_Lab_${labRaw}_Submission_Format.html`);
                }
            }
            
            // Also include .md versions for backwards compatibility
            paths.push(`labs/Day_${dayNum}_Lab_${labNum}_Submission_Format.md`);
            paths.push(`Day_${dayNum}_Lab_${labNum}_Submission_Format.md`);
            
            // Try with original filename
            if (!paths.includes(`labs/${fileName}.${extension}`)) {
                paths.push(`labs/${fileName}.${extension}`);
            }
        }
        
        // Also try with original path patterns
        if (!paths.includes(`labs/${fileName}.${extension}`)) {
            paths.push(`labs/${fileName}.${extension}`);
        }
        if (!paths.includes(`${fileName}.${extension}`)) {
            paths.push(`${fileName}.${extension}`);
        }
        if (!paths.includes(linkPath)) {
            paths.push(linkPath);
        }
        
        // Remove duplicates while preserving order
        const seen = new Set();
        return paths.filter(path => {
            if (seen.has(path.toLowerCase())) {
                return false;
            }
            seen.add(path.toLowerCase());
            return true;
        });
    }

    // Helper function to find matching file
    findMatchingFile(linkPath) {
        // Extract just the filename (remove .html or .md extension for matching)
        const fileName = linkPath.replace(/^.*\//, '').replace(/\.(html|md)$/, '');
        const normalizedLinkName = this.normalizeFileName(fileName);
        
        // Check if it's a submission format file
        const isSubmissionFormat = /submission.*format|format.*submission/i.test(fileName);
        
        // Try exact match first in course data
        const allItems = getAllContentItems();
        let matchingItem = allItems.find(item => {
            const itemFileName = item.file.replace(/^.*\//, '');
            return itemFileName.toLowerCase() === fileName.toLowerCase() || 
                   item.file === linkPath;
        });
        
        if (matchingItem) {
            return { item: matchingItem, type: 'course' };
        }
        
        // Try normalized match
        matchingItem = allItems.find(item => {
            const itemFileName = item.file.replace(/^.*\//, '');
            return this.normalizeFileName(itemFileName) === normalizedLinkName;
        });
        
        if (matchingItem) {
            return { item: matchingItem, type: 'course' };
        }
        
        // Try to find file with similar name pattern
        const partialMatch = allItems.find(item => {
            const itemFileName = item.file.replace(/^.*\//, '').toLowerCase();
            // Extract base pattern (Day_XX_Lab_XX or Day_XX_Chapter_XX)
            const linkPattern = normalizedLinkName.match(/(day_\d+_(?:lab|chapter)_\d+)/);
            if (linkPattern) {
                return itemFileName.includes(linkPattern[1]);
            }
            return false;
        });
        
        if (partialMatch) {
            return { item: partialMatch, type: 'course' };
        }
        
        // Generate possible paths
        let possiblePaths = [];
        
        // If it's a submission format file, prioritize submission format paths
        if (isSubmissionFormat) {
            const submissionPaths = this.generateSubmissionFormatPaths(linkPath);
            possiblePaths = [...submissionPaths];
            console.log('Generated submission format paths:', submissionPaths);
        }
        
        // Add general paths (but don't duplicate submission format paths)
        const generalPaths = [
            linkPath,
            linkPath.replace(/^\.\.\//, ''),
            linkPath.replace(/^\.\//, ''),
            `labs/${fileName}`,
            `books/${fileName}`,
            `resources/${fileName}`,
            fileName
        ];
        
        // Only add general paths that aren't already in possiblePaths
        generalPaths.forEach(path => {
            if (!possiblePaths.includes(path)) {
                possiblePaths.push(path);
            }
        });
        
        // Remove duplicates while preserving order
        const seen = new Set();
        const uniquePaths = possiblePaths.filter(path => {
            const key = path.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
        
        console.log('Final unique paths:', uniquePaths);
        return { paths: uniquePaths, type: 'file', isSubmissionFormat };
    }

    // Fix markdown links to work with LMS
    fixMarkdownLinks(contentBody) {
        if (!contentBody) return;

        const links = contentBody.querySelectorAll('a[href]');
        console.log(`Found ${links.length} links to process`);
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            
            // Skip external links and anchors
            if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
                return;
            }

            // Handle markdown file links and HTML links (for submission formats)
            const isHtmlLink = href.endsWith('.html') || href.match(/\.html[?#]/);
            const isMdLink = href.endsWith('.md') || href.match(/\.md[?#]/);
            
            if (isMdLink || isHtmlLink) {
                // Extract the file path
                let filePath = href.replace(/^\.\.\//, '').replace(/^\//, '').split('?')[0].split('#')[0];
                console.log(`Processing ${isHtmlLink ? 'HTML' : 'markdown'} link: ${filePath}`);
                
                // For submission format files (.md or .html), handle based on context
                if (/Submission.*Format/i.test(filePath)) {
                    const fileName = filePath.replace(/^.*\//, '').replace(/\.(md|html)$/, '');
                    const dayMatch = fileName.match(/day[_\s]?(\d+)/i);
                    const labMatch = fileName.match(/lab[_\s]?(\d+)/i);
                    
                    if (dayMatch && labMatch) {
                        const dayNum = dayMatch[1].padStart(2, '0');
                        const labNum = labMatch[1].padStart(2, '0');
                        const normalizedBaseName = fileName
                            .replace(/day[_\s]?\d+/i, `Day_${dayNum}`)
                            .replace(/lab[_\s]?\d+/i, `Lab_${labNum}`);
                        
                        // Check if we're on GitHub Pages (MkDocs) or local
                        const isGitHubPages = window.location.hostname.includes('github.io');
                        
                        if (isGitHubPages || isHtmlLink) {
                            // For MkDocs/GitHub Pages: use directory path (pretty URLs)
                            // MkDocs creates: labs/Day_XX_Lab_XX_Submission_Format/
                            const htmlPath = `labs/${normalizedBaseName}/`;
                            link.href = htmlPath;
                            link.setAttribute('title', `Open submission format: ${normalizedBaseName}`);
                            console.log(`✅ Set HTML path for submission format: ${htmlPath}`);
                            // Don't intercept - let browser handle HTML page load
                            return;
                        } else {
                            // For local LMS: use normalized .md path
                            // normalizedBaseName already includes "Submission_Format"
                            const mdPath = `labs/${normalizedBaseName}.md`;
                            link.href = mdPath;
                            console.log(`✅ Set markdown path for submission format: ${mdPath}`);
                            // Continue with normal markdown link handling - will be intercepted below
                        }
                    }
                }
                
                // Find matching file
                const matchResult = this.findMatchingFile(filePath);
                console.log(`Match result:`, matchResult);
                
                if (matchResult.type === 'course' && matchResult.item) {
                    // Convert to LMS navigation link
                    link.href = '#';
                    link.onclick = (e) => {
                        e.preventDefault();
                        this.loadContent(matchResult.item.id);
                    };
                    link.style.cursor = 'pointer';
                    link.style.color = 'var(--primary-color)';
                    link.style.textDecoration = 'underline';
                } else {
                    // Try to fetch from various possible locations
                    // Find the best path to set as href (for right-click, hover, browser navigation, etc.)
                    const pathsToTry = matchResult.paths || [filePath];
                    let resolvedHref = null;
                    
                    console.log('Setting href for link:', filePath, 'Paths available:', pathsToTry);
                    
                    // For submission format files, prioritize the zero-padded labs path
                    if (matchResult.isSubmissionFormat && pathsToTry.length > 0) {
                        // Find the zero-padded labs path (e.g., labs/Day_01_Lab_02_Submission_Format.md)
                        const labsPath = pathsToTry.find(p => 
                            p.startsWith('labs/Day_') && 
                            p.match(/Day_\d{2}_Lab_\d{2}_Submission_Format\.md$/)
                        );
                        if (labsPath) {
                            resolvedHref = labsPath;
                            console.log('Found zero-padded labs path:', labsPath);
                        } else {
                            // Fallback to first labs path
                            const firstLabsPath = pathsToTry.find(p => p.startsWith('labs/'));
                            resolvedHref = firstLabsPath || pathsToTry[0];
                            console.log('Using fallback path:', resolvedHref);
                        }
                    } else if (pathsToTry.length > 0) {
                        // For other files, prefer labs/ or books/ paths
                        const preferredPath = pathsToTry.find(p => p.startsWith('labs/') || p.startsWith('books/'));
                        resolvedHref = preferredPath || pathsToTry[0];
                    }
                    
                    // ALWAYS set href to a valid path - never leave it as #
                    // Default to first path in array if resolvedHref is still null
                    if (!resolvedHref && pathsToTry.length > 0) {
                        resolvedHref = pathsToTry[0];
                        console.log('Defaulting to first path:', resolvedHref);
                    }
                    
                    // If we still don't have a path, generate one for submission formats
                    if (!resolvedHref && matchResult.isSubmissionFormat) {
                        const fileName = filePath.replace(/^.*\//, '');
                        const dayMatch = fileName.match(/day[_\s]?(\d+)/i);
                        const labMatch = fileName.match(/lab[_\s]?(\d+)/i);
                        if (dayMatch && labMatch) {
                            const dayNum = dayMatch[1].padStart(2, '0');
                            const labNum = labMatch[1].padStart(2, '0');
                            resolvedHref = `labs/Day_${dayNum}_Lab_${labNum}_Submission_Format.md`;
                            console.log('Generated submission format path:', resolvedHref);
                        }
                    }
                    
                    // For submission format files with .html extension, open as HTML page
                    if (matchResult.isSubmissionFormat && isHtmlLink && resolvedHref) {
                        // Convert .md path to .html path for MkDocs-generated pages
                        const htmlPath = resolvedHref.replace(/\.md$/, '.html');
                        link.href = htmlPath;
                        link.setAttribute('title', `Open submission format: ${htmlPath}`);
                        link.target = '_self'; // Open in same window/tab
                        console.log('✅ Set HTML link for submission format:', htmlPath);
                        // Don't intercept - let browser handle HTML page load
                        link.style.fontWeight = '600';
                        link.style.cursor = 'pointer';
                        link.style.color = 'var(--secondary-color, #f59e0b)';
                        link.style.textDecoration = 'underline';
                    } else if (matchResult.isSubmissionFormat && !isHtmlLink && resolvedHref) {
                        // For .md submission format links, convert to .html
                        const htmlPath = resolvedHref.replace(/\.md$/, '.html');
                        link.href = htmlPath;
                        link.setAttribute('title', `Open submission format: ${htmlPath}`);
                        link.target = '_self';
                        console.log('✅ Converted .md to .html for submission format:', htmlPath);
                        link.style.fontWeight = '600';
                        link.style.cursor = 'pointer';
                        link.style.color = 'var(--secondary-color, #f59e0b)';
                        link.style.textDecoration = 'underline';
                    } else {
                        // For non-submission format files, set normal href
                        if (resolvedHref) {
                            link.href = resolvedHref;
                            link.setAttribute('title', `Open: ${resolvedHref}`);
                            console.log('✅ Set link href to:', resolvedHref);
                        } else {
                            // Last resort: use original filePath
                            link.href = filePath;
                            console.log('⚠️ Using original filePath as href:', filePath);
                        }
                        
                        link.style.cursor = 'pointer';
                        link.style.color = 'var(--primary-color)';
                        link.style.textDecoration = 'underline';
                    }
                    
                    // For submission format files, don't intercept clicks - let them download
                    if (!matchResult.isSubmissionFormat) {
                        // Store data on the link element for click handler (only for non-submission files)
                        link.dataset.filePath = filePath;
                        link.dataset.isSubmissionFormat = 'false';
                        link.dataset.paths = JSON.stringify(pathsToTry);
                        if (resolvedHref) {
                            link.dataset.resolvedHref = resolvedHref;
                        }
                        
                        // Create click handler that uses stored data (only for non-submission files)
                        const handleClick = async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const storedFilePath = e.currentTarget.dataset.filePath;
                            const isSubmissionFormat = false;
                            const pathsToTry = JSON.parse(e.currentTarget.dataset.paths || '[]');
                        let loaded = false;
                        let loadedPath = null;
                        
                        // Show loading indicator
                        const contentBody = document.getElementById('contentBody');
                        if (contentBody) {
                            contentBody.innerHTML = `
                                <div class="loading-spinner">
                                    <div class="spinner"></div>
                                    <p>Loading ${isSubmissionFormat ? 'submission format' : 'file'}...</p>
                                </div>
                            `;
                        }
                        
                        // Debug logging
                        console.log(`🔗 Link clicked: ${storedFilePath}`);
                        if (isSubmissionFormat) {
                            console.log(`📋 Attempting to load submission format: ${storedFilePath}`);
                            console.log('Paths to try:', pathsToTry.slice(0, 5));
                        }
                        
                        for (const path of pathsToTry) {
                            try {
                                console.log(`Trying path: ${path}`);
                                const response = await fetch(path);
                                if (response.ok) {
                                    const markdown = await response.text();
                                    const html = marked.parse(markdown);
                                    const contentBody = document.getElementById('contentBody');
                                    if (contentBody) {
                                        contentBody.innerHTML = html;
                                        this.fixImagePaths(contentBody);
                                        this.fixMarkdownLinks(contentBody);
                                        
                                        // Add special styling for submission format files
                                        if (isSubmissionFormat) {
                                            const contentHeader = contentBody.querySelector('h1');
                                            if (contentHeader) {
                                                contentHeader.style.color = 'var(--secondary-color)';
                                                contentHeader.insertAdjacentHTML('afterend', '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; margin: 1rem 0; border-radius: 4px;"><strong>📋 Submission Format Template</strong><br>This is a template file for completing your lab submission. Fill out all sections as instructed in the corresponding lab exercise.</div>');
                                            }
                                        }
                                        
                                        // Hide navigation buttons for external content
                                        const prevBtn = document.getElementById('prevContent');
                                        const nextBtn = document.getElementById('nextContent');
                                        const checkboxContainer = document.querySelector('.content-footer');
                                        if (prevBtn) prevBtn.style.display = 'none';
                                        if (nextBtn) nextBtn.style.display = 'none';
                                        if (checkboxContainer) checkboxContainer.style.display = 'none';
                                        
                                        // Update breadcrumb
                                        const breadcrumb = document.getElementById('breadcrumb');
                                        if (breadcrumb) {
                                            const linkText = e.currentTarget.textContent.replace('📋 ', '') || storedFilePath;
                                            const breadcrumbText = isSubmissionFormat ? 
                                                `📋 ${linkText}` : linkText;
                                            breadcrumb.innerHTML = `
                                                <a href="#" onclick="event.preventDefault(); lms.showWelcomeScreen();">Home</a>
                                                <span> / </span>
                                                <span>${breadcrumbText}</span>
                                            `;
                                        }
                                        
                                        // Show content viewer
                                        const welcomeScreen = document.getElementById('welcomeScreen');
                                        const contentViewer = document.getElementById('contentViewer');
                                        if (welcomeScreen) welcomeScreen.style.display = 'none';
                                        if (contentViewer) contentViewer.style.display = 'block';
                                        
                                        loaded = true;
                                        loadedPath = path;
                                        console.log(`✅ Successfully loaded: ${path}`);
                                        break;
                                    }
                                } else {
                                    console.log(`❌ Path failed (${response.status}): ${path}`);
                                }
                            } catch (error) {
                                console.log(`❌ Path error: ${path}`, error.message);
                                // Continue to next path
                                continue;
                            }
                        }
                        
                        if (!loaded) {
                            console.error('Could not load file from any location:', pathsToTry);
                            console.error('Original file path:', storedFilePath);
                            const errorMsg = `Could not load the requested file: ${storedFilePath}\n\nTried:\n${pathsToTry.slice(0, 10).join('\n')}${pathsToTry.length > 10 ? '\n... and more' : ''}`;
                            alert(errorMsg);
                            
                            // Show error in content area
                            const contentBody = document.getElementById('contentBody');
                            if (contentBody) {
                                contentBody.innerHTML = `
                                    <div style="text-align: center; padding: 3rem; color: var(--error-color);">
                                        <h2>Error Loading File</h2>
                                        <p>Could not load: <code>${storedFilePath}</code></p>
                                        <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
                                            Check the browser console (F12) for details.
                                        </p>
                                    </div>
                                `;
                            }
                        } else if (loadedPath && loadedPath !== storedFilePath) {
                            console.log(`✅ File loaded from: ${loadedPath} (original: ${storedFilePath})`);
                        }
                        };
                        
                        // Attach the click handler (only for non-submission format files)
                        link.addEventListener('click', handleClick);
                    }
                    // For submission format files, the href is already set to download URL
                    // No click handler needed - browser will handle the download
                }
            } else {
                // For relative paths without .md extension, try to resolve them
                if (href.startsWith('../') || href.startsWith('./')) {
                    const resolvedPath = new URL(href, window.location.href).pathname;
                    link.href = resolvedPath;
                }
            }
        });
    }

    // Update breadcrumb
    updateBreadcrumb(content, contentBody) {
        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        const nav = getNavigationItems(content.id);
        
        breadcrumb.innerHTML = `
            <a href="#" onclick="event.preventDefault(); lms.showWelcomeScreen();">Home</a>
            <span> / </span>
            <span>Day ${content.day}</span>
            <span> / </span>
            <span>${content.type === 'book' ? '📚 Book' : '🧪 Lab'}</span>
            <span> / </span>
            <span>${content.title}</span>
        `;
    }

    // Update navigation buttons
    updateNavigationButtons() {
        if (!this.currentContentId) return;

        const nav = getNavigationItems(this.currentContentId);
        const prevBtn = document.getElementById('prevContent');
        const nextBtn = document.getElementById('nextContent');

        if (prevBtn) {
            prevBtn.disabled = !nav.previous;
            prevBtn.onclick = () => {
                if (nav.previous) {
                    this.loadContent(nav.previous.id);
                }
            };
        }

        if (nextBtn) {
            nextBtn.disabled = !nav.next;
            nextBtn.onclick = () => {
                if (nav.next) {
                    this.loadContent(nav.next.id);
                }
            };
        }
    }

    // Update complete checkbox
    updateCompleteCheckbox() {
        const checkbox = document.getElementById('markComplete');
        if (!checkbox) return;

        checkbox.checked = this.isComplete(this.currentContentId);
        checkbox.onchange = (e) => {
            this.markComplete(this.currentContentId, e.target.checked);
        };
    }

    // Show welcome screen
    showWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const contentViewer = document.getElementById('contentViewer');
        if (welcomeScreen) welcomeScreen.style.display = 'block';
        if (contentViewer) contentViewer.style.display = 'none';
        
        this.currentContentId = null;
        this.updateNavigationState();
        window.history.pushState({}, '', window.location.pathname);
    }

    // Show tools view
    showToolsView() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const contentViewer = document.getElementById('contentViewer');
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (contentViewer) contentViewer.style.display = 'block';

        const contentBody = document.getElementById('contentBody');
        if (!contentBody) return;

        const categorized = getToolsByCategory();
        let html = `
            <div class="tools-viewer">
                <h1>🛠️ Tools & When to Use Them</h1>
                <p class="tools-intro">Complete reference guide for all tools used throughout the SEO Master Course 2026.</p>
                
                <div class="tools-summary">
                    <div class="summary-stat">
                        <strong>${toolsData.tools.length}</strong> Tools Registered
                    </div>
                    <div class="summary-stat">
                        <strong>${Object.keys(categorized).length}</strong> Categories
                    </div>
                </div>

                <div class="tools-container">
        `;

        Object.keys(categorized).sort().forEach(category => {
            html += `
                <section class="tool-category">
                    <h2>${category}</h2>
                    <div class="tools-table-wrapper">
                        <table class="tools-table">
                            <thead>
                                <tr>
                                    <th>Tool Name</th>
                                    <th>Access Type</th>
                                    <th>When to Use</th>
                                    <th>Used In</th>
                                    <th>Link</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            categorized[category].forEach(tool => {
                html += `
                    <tr>
                        <td><strong>${tool.name}</strong></td>
                        <td><span class="access-badge access-${tool.accessType.toLowerCase().replace(/\s+/g, '-')}">${tool.accessType}</span></td>
                        <td>${tool.whenToUse}</td>
                        <td>
                            <ul class="used-in-list">
                                ${tool.usedIn.map(usage => `<li>${usage}</li>`).join('')}
                            </ul>
                        </td>
                        <td>
                            ${tool.url.startsWith('http') ? 
                                `<a href="${tool.url}" target="_blank" rel="noopener noreferrer" class="tool-link">Visit →</a>` : 
                                `<span class="tool-link-inline">${tool.url}</span>`
                            }
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        });

        html += `
                </div>
            </div>
        `;

        contentBody.innerHTML = html;

        // Update breadcrumb
        const breadcrumb = document.getElementById('breadcrumb');
        if (breadcrumb) {
            breadcrumb.innerHTML = `
                <a href="#" onclick="event.preventDefault(); lms.showWelcomeScreen();">Home</a>
                <span> / </span>
                <span>Tools & When to Use Them</span>
            `;
        }

        // Hide navigation buttons
        const prevBtn = document.getElementById('prevContent');
        const nextBtn = document.getElementById('nextContent');
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';

        // Hide complete checkbox
        const checkboxContainer = document.querySelector('.content-footer');
        if (checkboxContainer) checkboxContainer.style.display = 'none';

        this.currentContentId = null;
        window.history.pushState({ view: 'tools' }, '', '#tools');
    }

    // Check URL parameters for direct content loading
    checkURLParams() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#')) {
            const contentId = hash.substring(1);
            if (contentId === 'tools') {
                this.showToolsView();
            } else {
                const content = getContentById(contentId);
                if (content) {
                    this.loadContent(contentId);
                }
            }
        }
    }

    // Restore navigation buttons after loading content
    restoreNavigationButtons() {
        const prevBtn = document.getElementById('prevContent');
        const nextBtn = document.getElementById('nextContent');
        const checkboxContainer = document.querySelector('.content-footer');
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
        if (checkboxContainer) checkboxContainer.style.display = 'block';
    }

    // Attach event listeners
    attachEventListeners() {
        // Sidebar close button (for mobile)
        const closeBtn = document.getElementById('closeSidebar');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebar?.classList.add('closed');
                overlay?.classList.remove('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar?.classList.add('closed');
                overlay.classList.remove('active');
            });
        }
        
        // On mobile, allow clicking the logo to open sidebar if closed
        const logoSection = document.querySelector('.logo-section');
        if (logoSection && window.innerWidth <= 768) {
            logoSection.style.cursor = 'pointer';
            logoSection.addEventListener('click', () => {
                if (sidebar?.classList.contains('closed')) {
                    sidebar.classList.remove('closed');
                    overlay?.classList.add('active');
                }
            });
        }

        // Filter tabs
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterType = tab.dataset.filter;
                this.renderNavigation();
            });
        });

        // Start course button
        const startBtn = document.getElementById('startCourse');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const firstItem = getAllContentItems()[0];
                if (firstItem) {
                    this.loadContent(firstItem.id);
                }
            });
        }

        // Tools link
        const toolsLink = document.getElementById('toolsLink');
        if (toolsLink) {
            toolsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showToolsView();
            });
        }

        // Tools stat card link (on welcome screen)
        const toolsStatCard = document.getElementById('toolsStatCard');
        if (toolsStatCard) {
            toolsStatCard.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showToolsView();
            });
        }

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.contentId) {
                this.loadContent(e.state.contentId);
            } else {
                this.showWelcomeScreen();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Left arrow - previous
            if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const prevBtn = document.getElementById('prevContent');
                if (prevBtn && !prevBtn.disabled) {
                    prevBtn.click();
                }
            }
            // Right arrow - next
            if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const nextBtn = document.getElementById('nextContent');
                if (nextBtn && !nextBtn.disabled) {
                    nextBtn.click();
                }
            }
            // Escape - close sidebar on mobile
            if (e.key === 'Escape') {
                sidebar?.classList.add('closed');
                overlay?.classList.remove('active');
            }
        });
    }
}

// Initialize LMS when DOM is ready
let lms;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        lms = new LMS();
    });
} else {
    lms = new LMS();
}

