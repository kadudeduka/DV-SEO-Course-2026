/**
 * Content Indexing Script (Node.js Compatible)
 * 
 * CLI script for indexing course content into AI Coach database.
 * This version uses npm packages instead of CDN imports for Node.js compatibility.
 * 
 * Usage:
 *   node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --full
 *   node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --incremental
 *   node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --status
 * 
 * Prerequisites:
 *   npm install @supabase/supabase-js openai
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';

// Load environment variables
config();

// Get config from app.config.local.js
function loadConfig() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Script is in lms/scripts/, config is in config/ (2 levels up)
    const configPath = join(__dirname, '../../config/app.config.local.js');
    
    try {
        const configContent = readFileSync(configPath, 'utf8');
        // Extract config values using regex (simple approach)
        const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
        const keyMatch = configContent.match(/SUPABASE_ANON_KEY:\s*['"]([^'"]+)['"]/);
        const serviceKeyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
        const openaiKeyMatch = configContent.match(/OPENAI_API_KEY:\s*['"]([^'"]+)['"]/);
        
        return {
            supabaseUrl: urlMatch ? urlMatch[1] : process.env.SUPABASE_URL,
            supabaseKey: keyMatch ? keyMatch[1] : process.env.SUPABASE_ANON_KEY,
            supabaseServiceKey: serviceKeyMatch ? serviceKeyMatch[1] : process.env.SUPABASE_SERVICE_KEY,
            openaiKey: openaiKeyMatch ? openaiKeyMatch[1] : process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
        };
    } catch (error) {
        console.warn('Could not load config file, using environment variables');
        return {
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseKey: process.env.SUPABASE_ANON_KEY,
            supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
            openaiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
        };
    }
}

// Initialize Supabase client
const appConfig = loadConfig();
if (!appConfig.supabaseUrl) {
    console.error('Error: SUPABASE_URL must be configured');
    console.error('Set it in config/app.config.local.js or as environment variable');
    process.exit(1);
}

// Use service role key if available (bypasses RLS), otherwise use anon key
const supabaseKey = appConfig.supabaseServiceKey || appConfig.supabaseKey;
if (!supabaseKey) {
    console.error('Error: SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY must be configured');
    console.error('Set it in config/app.config.local.js or as environment variable');
    console.error('Note: SUPABASE_SERVICE_KEY is recommended for server-side scripts (bypasses RLS)');
    process.exit(1);
}

if (appConfig.supabaseServiceKey) {
    console.log('Using service role key (RLS bypassed)');
} else {
    console.log('Using anon key (RLS enforced - may require policy updates)');
}

const supabaseClient = createClient(appConfig.supabaseUrl, supabaseKey);

// Initialize OpenAI client
if (!appConfig.openaiKey) {
    console.error('Error: OPENAI_API_KEY must be configured');
    console.error('Set it in config/app.config.local.js or as environment variable');
    process.exit(1);
}

const openai = new OpenAI({ apiKey: appConfig.openaiKey });

// Simple embedding service for Node.js
class NodeEmbeddingService {
    async generateEmbedding(text) {
        try {
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: text
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('Error generating embedding:', error.message);
            throw error;
        }
    }

    async generateEmbeddingsBatch(texts) {
        try {
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: texts
            });
            return response.data.map(item => item.embedding);
        } catch (error) {
            console.error('Error generating batch embeddings:', error.message);
            throw error;
        }
    }
}

const embeddingService = new NodeEmbeddingService();

// Course service (simplified for Node.js)
async function getCourseData(courseId) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // Load course structure directly from file system
    // Script is in lms/scripts/, need to go up 2 levels to project root
    const structurePath = join(__dirname, `../../data/courses/${courseId}/structure.js`);
    
    try {
        // Import structure file
        const structureModule = await import(`file://${structurePath}`);
        const rawData = structureModule.courseData;
        
        if (!rawData || !rawData.days) {
            throw new Error(`Course ${courseId} has invalid structure`);
        }
        
        // Transform to match expected format
        const transformedDays = rawData.days.map(day => {
            const transformedDay = {
                day: day.day || day.dayNumber,
                title: day.title,
                chapters: [],
                labs: []
            };

            if (day.chapters && Array.isArray(day.chapters)) {
                transformedDay.chapters = day.chapters.map(chapter => ({
                    id: chapter.id,
                    chapter: chapter.id, // alias
                    title: chapter.title,
                    file: chapter.file, // Preserve file path
                    content: null // Will be loaded from file
                }));
            }

            if (day.labs && Array.isArray(day.labs)) {
                transformedDay.labs = day.labs.map(lab => ({
                    id: lab.id,
                    lab: lab.id, // alias
                    title: lab.title,
                    file: lab.file, // Preserve file path
                    chapter: lab.chapter || null,
                    content: lab.description || null,
                    description: lab.description || null
                }));
            }

            return transformedDay;
        });
        
        return { days: transformedDays };
    } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
            throw new Error(`Course structure file not found: ${structurePath}`);
        }
        throw error;
    }
}

// Content update service (simplified for Node.js)
class NodeContentUpdateService {
    async triggerReindexing(courseId, updateType, triggeredBy) {
        const { data, error } = await supabaseClient
            .from('ai_coach_content_updates')
            .insert({
                course_id: courseId,
                update_type: updateType,
                triggered_by: triggeredBy,
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async getUpdateStatus(courseId) {
        const { data, error } = await supabaseClient
            .from('ai_coach_content_updates')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data;
    }

    async reindexCourseContent(courseId, options = {}) {
        const { full = false, updateId = null } = options;

        console.log('Loading course data...');
        const courseData = await getCourseData(courseId);

        if (!courseData || !courseData.days) {
            throw new Error('Invalid course data structure');
        }

        // Get existing chunks
        const { data: existingChunks } = await supabaseClient
            .from('ai_coach_content_chunks')
            .select('*')
            .eq('course_id', courseId);

        const existingChunksMap = new Map();
        if (existingChunks) {
            existingChunks.forEach(chunk => {
                const key = `${chunk.day}-${chunk.chapter_id || chunk.chapter}-${chunk.lab_id || ''}`;
                existingChunksMap.set(key, chunk);
            });
        }

        let indexed = 0;
        let updated = 0;
        const chunksToProcess = [];

        // Helper function to load content from file
        async function loadContentFromFile(filePath) {
            if (!filePath) return null;
            
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            // Script is in lms/scripts/, filePath is relative to project root
            const fullPath = join(__dirname, '../../', filePath);
            
            try {
                const content = readFileSync(fullPath, 'utf8');
                return content;
            } catch (error) {
                console.warn(`Warning: Could not load content from ${filePath}: ${error.message}`);
                return null;
            }
        }

        // Process course structure
        for (const day of courseData.days) {
            // Process chapters
            if (day.chapters) {
                for (const chapter of day.chapters) {
                    // Load content from file if not already loaded
                    let content = chapter.content;
                    if (!content && chapter.file) {
                        content = await loadContentFromFile(chapter.file);
                    }
                    
                    if (content) {
                        const key = `${day.day}-${chapter.id || chapter.chapter}-`;
                        const existing = existingChunksMap.get(key);

                        // Skip if exists and not full mode
                        if (existing && !full) {
                            continue;
                        }

                        chunksToProcess.push({
                            course_id: courseId,
                            day: day.day,
                            chapter_id: chapter.id || chapter.chapter,
                            chapter_title: chapter.title,
                            content: content,
                            content_type: 'chapter',
                            existingId: existing?.id
                        });
                    }
                }
            }

            // Process labs
            if (day.labs) {
                for (const lab of day.labs) {
                    // Load content from file if not already loaded
                    let content = lab.content || lab.description;
                    if (!content && lab.file) {
                        content = await loadContentFromFile(lab.file);
                    }
                    
                    if (content) {
                        const key = `${day.day}-${lab.chapter || ''}-${lab.id || lab.lab}`;
                        const existing = existingChunksMap.get(key);

                        if (existing && !full) {
                            continue;
                        }

                        chunksToProcess.push({
                            course_id: courseId,
                            day: day.day,
                            chapter_id: lab.chapter || `day${day.day}-lab`, // Default for labs without chapter
                            lab_id: lab.id || lab.lab,
                            chapter_title: lab.title || lab.name,
                            content: content,
                            content_type: 'lab',
                            existingId: existing?.id
                        });
                    }
                }
            }
        }

        console.log(`Processing ${chunksToProcess.length} chunks...`);

        // Process in batches
        const batchSize = 10;
        for (let i = 0; i < chunksToProcess.length; i += batchSize) {
            const batch = chunksToProcess.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunksToProcess.length / batchSize)}...`);

            for (const chunk of batch) {
                try {
                    // Generate embedding
                    const embedding = await embeddingService.generateEmbedding(chunk.content);
                    
                    // Calculate token count (rough estimate: ~4 characters per token)
                    const tokenCount = Math.ceil(chunk.content.length / 4);

                    if (chunk.existingId) {
                        // Update existing
                        const { error } = await supabaseClient
                            .from('ai_coach_content_chunks')
                            .update({
                                content: chunk.content,
                                embedding: embedding,
                                token_count: tokenCount,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', chunk.existingId);

                        if (error) throw error;
                        updated++;
                    } else {
                        // Insert new - chapter_id can be null for labs
                        const insertData = {
                            course_id: chunk.course_id,
                            day: chunk.day,
                            chapter_title: chunk.chapter_title,
                            content: chunk.content,
                            content_type: chunk.content_type,
                            embedding: embedding,
                            token_count: tokenCount
                        };
                        
                        // Only include chapter_id if it exists
                        if (chunk.chapter_id) {
                            insertData.chapter_id = chunk.chapter_id;
                        }
                        
                        // Only include lab_id if it exists
                        if (chunk.lab_id) {
                            insertData.lab_id = chunk.lab_id;
                        }

                        const { error } = await supabaseClient
                            .from('ai_coach_content_chunks')
                            .insert(insertData);

                        if (error) throw error;
                        indexed++;
                    }
                } catch (error) {
                    console.error(`Error processing chunk ${chunk.chapter_id || chunk.lab_id}:`, error.message);
                }
            }
        }

        // Update status
        if (updateId) {
            await supabaseClient
                .from('ai_coach_content_updates')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    chunks_updated: indexed + updated,
                    chunks_total: chunksToProcess.length
                })
                .eq('id', updateId);
        }

        return {
            indexed,
            updated,
            total: indexed + updated
        };
    }
}

const contentUpdateService = new NodeContentUpdateService();

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
Content Indexing Script for AI Coach (Node.js)

Usage:
  node lms/scripts/index-course-content-node.js --course-id=<course-id> [options]

Options:
  --course-id=<id>    Course identifier (required)
  --full              Full re-indexing (all chunks)
  --incremental       Incremental re-indexing (only changed chunks) [default]
  --force             Force re-indexing (ignore hash check)
  --status            Show indexing status for course
  --dry-run           Preview changes without applying

Prerequisites:
  npm install @supabase/supabase-js openai dotenv

Examples:
  # Full re-indexing
  node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --full

  # Incremental re-indexing (default)
  node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --incremental

  # Check status
  node lms/scripts/index-course-content-node.js --course-id=seo-master-2026 --status
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
                console.log(`  Chunks updated: ${status.chunks_updated || 0}/${status.chunks_total || 0}`);
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

        if (options.dryRun) {
            console.log('Dry-run mode: Preview only (not implemented in Node.js version)');
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

