/**
 * Verification script to check if content chunks exist in the database
 * Usage: node lms/scripts/verify-content-chunks.js --course-id=seo-master-2026
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
function loadConfig() {
    const configPath = join(__dirname, '../../config/app.config.local.js');
    try {
        const configContent = readFileSync(configPath, 'utf-8');
        // Extract SUPABASE_URL and SUPABASE_SERVICE_KEY from window.LMS_CONFIG
        const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
        const serviceKeyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
        const anonKeyMatch = configContent.match(/SUPABASE_ANON_KEY:\s*['"]([^'"]+)['"]/);
        
        const supabaseUrl = urlMatch ? urlMatch[1] : process.env.SUPABASE_URL;
        // Use service key to bypass RLS, fallback to anon key
        const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1] : 
                           (anonKeyMatch ? anonKeyMatch[1] : process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be configured');
        }
        
        return { supabaseUrl, supabaseKey };
    } catch (error) {
        console.error('Error loading config:', error.message);
        process.exit(1);
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const courseId = args.find(arg => arg.startsWith('--course-id='))?.split('=')[1];
    return { courseId: courseId || 'seo-master-2026' };
}

async function main() {
    const { courseId } = parseArgs();
    const { supabaseUrl, supabaseKey } = loadConfig();
    
    console.log(`\n🔍 Verifying content chunks for course: ${courseId}\n`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check total chunks
    const { data: allChunks, error: allError } = await supabase
        .from('ai_coach_content_chunks')
        .select('id, course_id, content_type, chapter_title, day, embedding')
        .eq('course_id', courseId);
    
    if (allError) {
        console.error('❌ Error querying chunks:', allError);
        return;
    }
    
    console.log(`📊 Total chunks found: ${allChunks?.length || 0}`);
    
    if (!allChunks || allChunks.length === 0) {
        console.log('\n⚠️  No chunks found! Content may not be indexed.');
        console.log('   Run: node lms/scripts/index-course-content-node.js --course-id=' + courseId + ' --full\n');
        return;
    }
    
    // Check chunks with embeddings
    const chunksWithEmbeddings = allChunks.filter(c => c.embedding);
    const chunksWithoutEmbeddings = allChunks.filter(c => !c.embedding);
    
    console.log(`✅ Chunks with embeddings: ${chunksWithEmbeddings.length}`);
    console.log(`⚠️  Chunks without embeddings: ${chunksWithoutEmbeddings.length}`);
    
    // Show sample chunks
    console.log('\n📝 Sample chunks:');
    allChunks.slice(0, 5).forEach((chunk, idx) => {
        console.log(`   ${idx + 1}. Day ${chunk.day} - ${chunk.chapter_title || 'N/A'} (${chunk.content_type})`);
        console.log(`      Embedding: ${chunk.embedding ? '✅' : '❌'}`);
    });
    
    // Check content types
    const contentTypes = {};
    allChunks.forEach(chunk => {
        contentTypes[chunk.content_type] = (contentTypes[chunk.content_type] || 0) + 1;
    });
    
    console.log('\n📚 Content types:');
    Object.entries(contentTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
    });
    
    // Test a simple search
    console.log('\n🔎 Testing search for "SEO"...');
    const { data: searchResults, error: searchError } = await supabase
        .from('ai_coach_content_chunks')
        .select('id, chapter_title, content')
        .eq('course_id', courseId)
        .ilike('content', '%SEO%')
        .limit(5);
    
    if (searchError) {
        console.error('❌ Search error:', searchError);
    } else {
        console.log(`   Found ${searchResults?.length || 0} chunks containing "SEO"`);
        if (searchResults && searchResults.length > 0) {
            console.log('   Sample:', searchResults[0].chapter_title);
        }
    }
    
    console.log('\n✅ Verification complete!\n');
}

main().catch(console.error);

