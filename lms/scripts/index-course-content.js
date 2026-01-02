/**
 * Content Indexing Script
 * 
 * CLI script for indexing course content into AI Coach database.
 * Supports full, incremental, and force re-indexing.
 * 
 * Usage:
 *   node lms/scripts/index-course-content.js --course-id=seo-master-2026 --full
 *   node lms/scripts/index-course-content.js --course-id=seo-master-2026 --incremental
 *   node lms/scripts/index-course-content.js --course-id=seo-master-2026 --status
 */

import { embeddingService } from '../services/embedding-service.js';
import { contentUpdateService } from '../services/content-update-service.js';
import { supabaseClient } from '../services/supabase-client.js';

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        courseId: null,
        full: false,
        incremental: false,
        force: false,
        status: false,
        dryRun: false
    };

    args.forEach(arg => {
        if (arg.startsWith('--course-id=')) {
            options.courseId = arg.split('=')[1];
        } else if (arg === '--full') {
            options.full = true;
        } else if (arg === '--incremental') {
            options.incremental = true;
        } else if (arg === '--force') {
            options.force = true;
        } else if (arg === '--status') {
            options.status = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        }
    });

    return options;
}

// Display usage information
function showUsage() {
    console.log(`
Content Indexing Script for AI Coach

Usage:
  node lms/scripts/index-course-content.js --course-id=<course-id> [options]

Options:
  --course-id=<id>    Course identifier (required)
  --full              Full re-indexing (all chunks)
  --incremental       Incremental re-indexing (only changed chunks) [default]
  --force             Force re-indexing (ignore hash check)
  --status            Show indexing status for course
  --dry-run           Preview changes without applying

Examples:
  # Full re-indexing
  node lms/scripts/index-course-content.js --course-id=seo-master-2026 --full

  # Incremental re-indexing (default)
  node lms/scripts/index-course-content.js --course-id=seo-master-2026 --incremental

  # Check status
  node lms/scripts/index-course-content.js --course-id=seo-master-2026 --status

  # Dry run (preview)
  node lms/scripts/index-course-content.js --course-id=seo-master-2026 --incremental --dry-run
`);
}

// Main function
async function main() {
    const options = parseArgs();

    // Show usage if no course ID provided
    if (!options.courseId && !options.status) {
        showUsage();
        process.exit(1);
    }

    try {
        // Status check
        if (options.status) {
            if (!options.courseId) {
                console.error('Error: --course-id is required for status check');
                process.exit(1);
            }

            const status = await contentUpdateService.getUpdateStatus(options.courseId);
            
            if (!status) {
                console.log(`No indexing history found for course: ${options.courseId}`);
            } else {
                console.log(`\nIndexing Status for ${options.courseId}:`);
                console.log(`  Status: ${status.status}`);
                console.log(`  Type: ${status.update_type}`);
                console.log(`  Triggered by: ${status.triggered_by}`);
                console.log(`  Chunks updated: ${status.chunks_updated}/${status.chunks_total}`);
                console.log(`  Started: ${status.started_at || 'N/A'}`);
                console.log(`  Completed: ${status.completed_at || 'N/A'}`);
                if (status.error_message) {
                    console.log(`  Error: ${status.error_message}`);
                }
            }

            // Check current chunk count
            const { data: chunks, error } = await supabaseClient
                .from('ai_coach_content_chunks')
                .select('id', { count: 'exact' })
                .eq('course_id', options.courseId);

            if (!error) {
                console.log(`  Current chunks in database: ${chunks?.length || 0}`);
            }

            process.exit(0);
        }

        // Determine update type
        const updateType = options.full ? 'full' : 'incremental';

        console.log(`\nStarting content indexing for course: ${options.courseId}`);
        console.log(`Mode: ${updateType}${options.force ? ' (force)' : ''}${options.dryRun ? ' (dry-run)' : ''}\n`);

        // Dry run: detect changes without applying
        if (options.dryRun) {
            const changes = await contentUpdateService.detectContentChanges(options.courseId);
            
            console.log('Changes detected:');
            console.log(`  New chunks: ${changes.changed.filter(c => c.changeType === 'new').length}`);
            console.log(`  Updated chunks: ${changes.changed.filter(c => c.changeType === 'updated').length}`);
            console.log(`  Deleted chunks: ${changes.deleted?.length || 0}`);
            
            if (changes.changed.length > 0) {
                console.log('\nChanged chunks:');
                changes.changed.forEach(chunk => {
                    console.log(`  - ${chunk.changeType}: Day ${chunk.day}, ${chunk.chapter_title || chunk.chapter_id}`);
                });
            }

            process.exit(0);
        }

        // Create update record
        const updateRecord = await contentUpdateService.triggerReindexing(
            options.courseId,
            updateType,
            'manual'
        );

        console.log(`Update record created: ${updateRecord.id}`);
        console.log('Processing...\n');

        // Perform indexing
        const result = await contentUpdateService.reindexCourseContent(options.courseId, {
            full: options.full,
            incremental: options.incremental,
            force: options.force,
            updateId: updateRecord.id
        });

        console.log('\n✅ Indexing complete!');
        console.log(`  Indexed: ${result.indexed} chunks`);
        console.log(`  Updated: ${result.updated} chunks`);
        console.log(`  Total: ${result.total} chunks`);

        // Show final status
        const finalStatus = await contentUpdateService.getUpdateStatus(options.courseId);
        if (finalStatus) {
            console.log(`\nFinal status: ${finalStatus.status}`);
            if (finalStatus.status === 'completed') {
                console.log(`  Chunks updated: ${finalStatus.chunks_updated}/${finalStatus.chunks_total}`);
                console.log(`  Completed at: ${finalStatus.completed_at}`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run main function
main();

