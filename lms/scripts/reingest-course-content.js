/**
 * Script to re-ingest course content into AI Coach
 * 
 * IMPORTANT: This script redirects to the Node.js-compatible version.
 * The browser services use CDN imports which don't work in Node.js.
 * 
 * Usage:
 *   node lms/scripts/reingest-course-content.js <courseId>
 * 
 * Example:
 *   node lms/scripts/reingest-course-content.js seo-master-2026
 * 
 * This script is a convenience wrapper that calls:
 *   node lms/scripts/index-course-content-node.js --course-id=<courseId> --full --force
 */

// Get course ID from command line
const courseId = process.argv[2];

if (!courseId) {
    console.error('Error: Course ID is required');
    console.log('Usage: node lms/scripts/reingest-course-content.js <courseId>');
    console.log('Example: node lms/scripts/reingest-course-content.js seo-master-2026');
    console.log('');
    console.log('This script calls the Node.js-compatible indexing script.');
    console.log('For more options, use directly:');
    console.log('  node lms/scripts/index-course-content-node.js --course-id=<courseId> --full --force');
    process.exit(1);
}

console.log(`[Reingest] Starting full re-indexing for course: ${courseId}`);
console.log(`[Reingest] This will re-process all content chunks and regenerate embeddings`);
console.log('');
console.log('[Reingest] Calling Node.js-compatible indexing script...\n');

// Import and use the Node.js-compatible script
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nodeScript = join(__dirname, 'index-course-content-node.js');

// Spawn the Node.js-compatible script
const child = spawn('node', [nodeScript, `--course-id=${courseId}`, '--full', '--force'], {
    stdio: 'inherit',
    shell: false
});

child.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ Re-ingestion complete!');
        process.exit(0);
    } else {
        console.error(`\n❌ Re-ingestion failed with exit code ${code}`);
        process.exit(code);
    }
});

child.on('error', (error) => {
    console.error('[Reingest] Error spawning indexing script:', error);
    console.error('');
    console.error('Make sure you have the required dependencies installed:');
    console.error('  npm install @supabase/supabase-js openai dotenv');
    console.error('');
    console.error('And that config/app.config.local.js is configured with:');
    console.error('  - SUPABASE_URL');
    console.error('  - SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY');
    console.error('  - OPENAI_API_KEY');
    process.exit(1);
});
