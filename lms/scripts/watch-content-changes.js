#!/usr/bin/env node
/**
 * Content Change Watcher Script
 * 
 * Monitors data/ directory for .md file changes and triggers content ingestion pipeline.
 * 
 * Usage:
 *   node lms/scripts/watch-content-changes.js [options]
 * 
 * Options:
 *   --watch          Watch mode (continuous monitoring)
 *   --once           Process once and exit
 *   --course-id=ID   Process specific course only
 *   --dry-run        Dry run (don't actually update database)
 *   --batch-size=N   Batch size for processing (default: 10)
 *   --use-llm        Use LLM for metadata enrichment (slower but more accurate)
 * 
 * Examples:
 *   # Watch for changes continuously
 *   node lms/scripts/watch-content-changes.js --watch
 * 
 *   # Process all changes once
 *   node lms/scripts/watch-content-changes.js --once
 * 
 *   # Process specific course
 *   node lms/scripts/watch-content-changes.js --once --course-id=seo-master-2026
 * 
 *   # Dry run (test without updating database)
 *   node lms/scripts/watch-content-changes.js --once --dry-run
 * 
 * Prerequisites:
 *   - Node.js 18+
 *   - npm install chokidar (for file watching)
 *   - Configuration in config/app.config.local.js
 */

import { watch, watchFile } from 'fs';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createHash } from 'crypto';

// Try to import chokidar (optional, for better file watching)
let chokidar = null;
try {
    chokidar = (await import('chokidar')).default;
} catch (error) {
    console.warn('chokidar not installed, using basic fs.watch (install with: npm install chokidar)');
}

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    watch: args.includes('--watch'),
    once: args.includes('--once'),
    courseId: args.find(arg => arg.startsWith('--course-id='))?.split('=')[1] || null,
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10'),
    useLLM: args.includes('--use-llm'),
    dataDir: join(projectRoot, 'data')
};

// Validate options
if (!options.watch && !options.once) {
    console.error('Error: Must specify either --watch or --once');
    process.exit(1);
}

// Load content ingestion service
// Note: This script should be run from project root
// The service uses browser-compatible imports, so we need to handle this differently
// For Node.js, we'll create a wrapper that uses Node.js-compatible services

async function loadContentIngestionService() {
    try {
        // Import the service (it uses ES modules)
        const servicePath = join(__dirname, '../services/content-ingestion-service.js');
        const serviceModule = await import(`file://${servicePath}`);
        return serviceModule.contentIngestionService;
    } catch (error) {
        console.error('Error loading content ingestion service:', error);
        console.error('Make sure you are running from the project root');
        console.error('Note: This script requires Node.js 18+ with ES module support');
        throw error;
    }
}

const contentIngestionService = await loadContentIngestionService();

/**
 * Get all .md files in data directory
 * @param {string} dataDir - Data directory path
 * @param {string|null} courseId - Optional course ID filter
 * @returns {Array<string>} Array of file paths
 */
function getAllMarkdownFiles(dataDir, courseId = null) {
    const files = [];

    function walkDir(dir, baseDir = dataDir) {
        try {
            const entries = readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                const relativePath = relative(baseDir, fullPath);

                // Skip node_modules, .git, etc.
                if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }

                if (entry.isDirectory()) {
                    // Filter by course if specified
                    if (courseId && relativePath.includes(`courses/${courseId}`)) {
                        walkDir(fullPath, baseDir);
                    } else if (!courseId) {
                        walkDir(fullPath, baseDir);
                    }
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                    // Only include content files (chapters or labs)
                    if (relativePath.includes('/content/chapters/') || 
                        relativePath.includes('/content/labs/')) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            console.warn(`Error reading directory ${dir}:`, error.message);
        }
    }

    walkDir(dataDir);
    return files;
}

/**
 * Get file hash for change detection
 * @param {string} filePath - File path
 * @returns {string} File hash
 */
function getFileHash(filePath) {
    try {
        const content = readFileSync(filePath);
        return createHash('sha256').update(content).digest('hex');
    } catch (error) {
        return '';
    }
}

/**
 * Process changed files
 * @param {Array<string>} changedFiles - Array of changed file paths
 * @returns {Promise<void>}
 */
async function processChangedFiles(changedFiles) {
    if (changedFiles.length === 0) {
        console.log('No files to process');
        return;
    }

    console.log(`\n[${new Date().toISOString()}] Processing ${changedFiles.length} changed file(s)...`);

    try {
        const result = await contentIngestionService.processContentUpdate(changedFiles, {
            courseId: options.courseId,
            dryRun: options.dryRun,
            batchSize: options.batchSize,
            useLLMForMetadata: options.useLLM,
            invalidateOldVectors: true
        });

        if (result.success) {
            console.log(`✅ Processing completed successfully`);
            console.log(`   Processed: ${result.totalProcessed}, Skipped: ${result.totalSkipped}, Errors: ${result.totalErrors}`);
            console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
        } else {
            console.error(`❌ Processing completed with errors`);
            console.error(`   Processed: ${result.totalProcessed}, Skipped: ${result.totalSkipped}, Errors: ${result.totalErrors}`);
        }

    } catch (error) {
        console.error('Error processing files:', error);
        process.exit(1);
    }
}

/**
 * Watch for file changes
 */
function watchForChanges() {
    console.log(`Watching for changes in: ${options.dataDir}`);
    if (options.courseId) {
        console.log(`Filtering by course: ${options.courseId}`);
    }
    console.log('Press Ctrl+C to stop\n');

    const fileHashes = new Map();
    let processingTimeout = null;
    const changedFiles = new Set();

    // Initial scan
    const allFiles = getAllMarkdownFiles(options.dataDir, options.courseId);
    allFiles.forEach(file => {
        fileHashes.set(file, getFileHash(file));
    });
    console.log(`Initial scan: Found ${allFiles.length} markdown file(s)`);

    // Watch function
    function handleFileChange(filePath) {
        // Only process .md files in content directories
        if (!filePath.endsWith('.md') || 
            (!filePath.includes('/content/chapters/') && !filePath.includes('/content/labs/'))) {
            return;
        }

        // Filter by course if specified
        if (options.courseId && !filePath.includes(`courses/${options.courseId}`)) {
            return;
        }

        changedFiles.add(filePath);
        console.log(`[${new Date().toISOString()}] Detected change: ${relative(projectRoot, filePath)}`);

        // Debounce: wait 2 seconds before processing (in case multiple files change)
        if (processingTimeout) {
            clearTimeout(processingTimeout);
        }

        processingTimeout = setTimeout(async () => {
            const filesToProcess = Array.from(changedFiles);
            changedFiles.clear();

            if (filesToProcess.length > 0) {
                await processChangedFiles(filesToProcess);
            }
        }, 2000);
    }

    // Use chokidar if available (better performance)
    if (chokidar) {
        const watcher = chokidar.watch(options.dataDir, {
            ignored: /(^|[\/\\])\../, // Ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });

        watcher.on('change', handleFileChange);
        watcher.on('add', handleFileChange);
        watcher.on('unlink', handleFileChange);

        console.log('Using chokidar for file watching (recommended)');

    } else {
        // Fallback to basic fs.watch
        console.log('Using basic fs.watch (install chokidar for better performance)');
        
        function watchDirectory(dir) {
            try {
                watch(dir, { recursive: true }, (eventType, filename) => {
                    if (filename) {
                        const fullPath = join(dir, filename);
                        handleFileChange(fullPath);
                    }
                });
            } catch (error) {
                // Recursive watching might not be supported, fall back to non-recursive
                console.warn(`Recursive watching not supported, using non-recursive mode`);
            }
        }

        watchDirectory(options.dataDir);
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\nShutting down...');
        process.exit(0);
    });
}

/**
 * Process once and exit
 */
async function processOnce() {
    console.log(`Scanning for changes in: ${options.dataDir}`);
    if (options.courseId) {
        console.log(`Filtering by course: ${options.courseId}`);
    }
    if (options.dryRun) {
        console.log('DRY RUN MODE: No database changes will be made\n');
    }

    const allFiles = getAllMarkdownFiles(options.dataDir, options.courseId);
    console.log(`Found ${allFiles.length} markdown file(s)`);

    if (allFiles.length === 0) {
        console.log('No files to process');
        process.exit(0);
    }

    // For "once" mode, process all files (they're all considered "changed")
    await processChangedFiles(allFiles);
    process.exit(0);
}

// Main execution
if (options.once) {
    processOnce().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
} else if (options.watch) {
    watchForChanges();
}

