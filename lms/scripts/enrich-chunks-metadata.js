/**
 * Enrich Chunks with Metadata Script
 * 
 * CLI script to analyze and enrich existing chunks with metadata.
 * This can be run to populate metadata fields for chunks that don't have them.
 * 
 * Usage:
 *   node lms/scripts/enrich-chunks-metadata.js --course-id=seo-master-2026
 *   node lms/scripts/enrich-chunks-metadata.js --course-id=seo-master-2026 --use-llm
 *   node lms/scripts/enrich-chunks-metadata.js --course-id=seo-master-2026 --limit=100
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

// Get config from app.config.local.js
function loadConfig() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = join(__dirname, '../../config/app.config.local.js');
    
    try {
        const configContent = readFileSync(configPath, 'utf8');
        const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
        const serviceKeyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
        
        return {
            supabaseUrl: urlMatch ? urlMatch[1] : process.env.SUPABASE_URL,
            supabaseServiceKey: serviceKeyMatch ? serviceKeyMatch[1] : process.env.SUPABASE_SERVICE_KEY
        };
    } catch (error) {
        console.warn('Could not load config file, using environment variables');
        return {
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY
        };
    }
}

// Import chunk metadata service (we'll need to adapt it for Node.js)
// For now, we'll use a simplified version inline
function calculateCompletenessScore(chunk) {
    let score = 0;
    const content = chunk.content || '';
    const contentLength = content.length;

    const normalizedLength = Math.min(contentLength / 2500, 1);
    score += normalizedLength * 0.3;

    const hasHeadings = /^#{1,3}\s/m.test(content);
    const hasLists = /^[-*•]\s|^\d+\.\s/m.test(content);
    const hasExamples = /example|for instance|such as/i.test(content);
    const hasDetails = /details?|specifically|in detail/i.test(content);
    const hasComparisons = /versus|vs\.|compared to|difference/i.test(content);

    if (hasHeadings) score += 0.15;
    if (hasLists) score += 0.1;
    if (hasExamples) score += 0.15;
    if (hasDetails) score += 0.1;
    if (hasComparisons) score += 0.1;

    const comprehensiveIndicators = ['comprehensive', 'complete', 'thorough', 'in depth', 'detailed', 'extensive'];
    if (comprehensiveIndicators.some(indicator => content.toLowerCase().includes(indicator))) {
        score += 0.1;
    }

    return Math.min(score, 1.0);
}

function determineCoverageLevel(chunk, completenessScore) {
    const content = (chunk.content || '').toLowerCase();
    const chapterTitle = (chunk.chapter_title || '').toLowerCase();

    const introIndicators = ['introduction', 'overview', 'basics', 'fundamentals', 'getting started', 'terms', 'glossary'];
    if (introIndicators.some(indicator => chapterTitle.includes(indicator) || content.includes(indicator))) {
        return 'introduction';
    }

    const advancedIndicators = ['advanced', 'expert', 'master', 'deep dive', 'advanced techniques'];
    if (advancedIndicators.some(indicator => chapterTitle.includes(indicator) || content.includes(indicator))) {
        return 'advanced';
    }

    if (completenessScore >= 0.7) {
        return 'comprehensive';
    } else if (completenessScore >= 0.4) {
        return 'intermediate';
    } else {
        return 'introduction';
    }
}

function extractPrimaryTopic(chunk) {
    const chapterTitle = (chunk.chapter_title || '').toLowerCase();
    
    const topicPatterns = [
        /(?:about|on|for|guide to|introduction to)\s+([^:—\-]+)/i,
        /^([^:—\-]+?)(?:\s*[:—\-]|$)/i
    ];

    for (const pattern of topicPatterns) {
        const match = chapterTitle.match(pattern);
        if (match && match[1]) {
            let topic = match[1].trim();
            topic = topic.replace(/^(the|a|an)\s+/i, '').trim();
            if (topic) return topic;
        }
    }

    if (chapterTitle) {
        return chapterTitle.split(/[:—\-]/)[0].trim();
    }

    return null;
}

function isDedicatedTopicChapter(chunk, primaryTopic) {
    const chapterTitle = (chunk.chapter_title || '').toLowerCase();
    const topic = (primaryTopic || '').toLowerCase();

    if (topic && chapterTitle.includes(topic)) {
        return true;
    }

    const dedicatedIndicators = [
        'complete guide', 'comprehensive', 'deep dive', 'everything about', 'guide to', 'mastering'
    ];

    return dedicatedIndicators.some(indicator => chapterTitle.includes(indicator));
}

async function enrichChunks(courseId, options = {}) {
    const { useLLM = false, limit = null } = options;
    const config = loadConfig();

    if (!config.supabaseUrl || !config.supabaseServiceKey) {
        console.error('Error: Supabase configuration not found');
        process.exit(1);
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    console.log(`\n📊 Enriching chunks with metadata for course: ${courseId}`);
    console.log(`Options: useLLM=${useLLM}, limit=${limit || 'all'}\n`);

    // Fetch chunks that need metadata
    let query = supabase
        .from('ai_coach_content_chunks')
        .select('*')
        .eq('course_id', courseId)
        .is('coverage_level', null); // Only chunks without metadata

    if (limit) {
        query = query.limit(limit);
    }

    const { data: chunks, error } = await query;

    if (error) {
        console.error('Error fetching chunks:', error);
        process.exit(1);
    }

    if (!chunks || chunks.length === 0) {
        console.log('✅ No chunks found that need metadata enrichment.');
        return;
    }

    console.log(`Found ${chunks.length} chunks to enrich...\n`);

    let enriched = 0;
    let errors = 0;

    for (const chunk of chunks) {
        try {
            // Calculate metadata
            const completenessScore = calculateCompletenessScore(chunk);
            const coverageLevel = determineCoverageLevel(chunk, completenessScore);
            const primaryTopic = extractPrimaryTopic(chunk);
            const isDedicated = isDedicatedTopicChapter(chunk, primaryTopic);

            // Extract step number
            let stepNumber = null;
            if (chunk.content) {
                const stepMatch = chunk.content.match(/step\s*(\d+)/i);
                if (stepMatch) {
                    stepNumber = parseInt(stepMatch[1]);
                }
            }

            // Update chunk with metadata
            const { error: updateError } = await supabase
                .from('ai_coach_content_chunks')
                .update({
                    coverage_level: coverageLevel,
                    completeness_score: completenessScore,
                    is_dedicated_topic_chapter: isDedicated,
                    primary_topic: primaryTopic,
                    step_number: stepNumber,
                    metadata: {
                        ...(chunk.metadata || {}),
                        coverage_level: coverageLevel,
                        completeness_score: completenessScore,
                        is_dedicated_topic_chapter: isDedicated,
                        primary_topic: primaryTopic,
                        step_number: stepNumber
                    }
                })
                .eq('id', chunk.id);

            if (updateError) {
                console.error(`❌ Error updating chunk ${chunk.id}:`, updateError.message);
                errors++;
            } else {
                enriched++;
                console.log(`✅ Enriched: ${chunk.chapter_title || chunk.chapter_id} (${coverageLevel}, score: ${completenessScore.toFixed(2)})`);
            }
        } catch (error) {
            console.error(`❌ Error processing chunk ${chunk.id}:`, error.message);
            errors++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Enriched: ${enriched}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${chunks.length}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const courseIdArg = args.find(arg => arg.startsWith('--course-id='));
const useLLMArg = args.includes('--use-llm');
const limitArg = args.find(arg => arg.startsWith('--limit='));

if (!courseIdArg) {
    console.error('Usage: node enrich-chunks-metadata.js --course-id=COURSE_ID [--use-llm] [--limit=N]');
    process.exit(1);
}

const courseId = courseIdArg.split('=')[1];
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

enrichChunks(courseId, { useLLM: useLLMArg, limit })
    .then(() => {
        console.log('✅ Metadata enrichment complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });

