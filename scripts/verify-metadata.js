/**
 * Verify Metadata Population
 * 
 * Checks if content_nodes have metadata populated (primary_topic, aliases, keywords)
 * 
 * Usage:
 *   node scripts/verify-metadata.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration (same as ingest script)
function loadConfig() {
    let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        const configPath = join(__dirname, '..', 'config', 'app.config.local.js');
        if (existsSync(configPath)) {
            try {
                const configContent = readFileSync(configPath, 'utf-8');
                const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
                const keyMatch = configContent.match(/SUPABASE_ANON_KEY:\s*['"]([^'"]+)['"]/);
                
                if (urlMatch) supabaseUrl = urlMatch[1];
                if (keyMatch) supabaseKey = keyMatch[1];
            } catch (error) {
                // Ignore
            }
        }
    }
    
    return { supabaseUrl, supabaseKey };
}

const { supabaseUrl, supabaseKey } = loadConfig();

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('[Verify] Checking metadata population...\n');
    
    // Get total node count
    const { count: totalCount } = await supabase
        .from('content_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', 'seo-master-2026');
    
    console.log(`Total nodes: ${totalCount}`);
    
    // Check primary_topic
    const { count: topicCount } = await supabase
        .from('content_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', 'seo-master-2026')
        .not('primary_topic', 'is', null);
    
    console.log(`Nodes with primary_topic: ${topicCount} (${Math.round(topicCount / totalCount * 100)}%)`);
    
    // Check aliases
    const { count: aliasesCount } = await supabase
        .from('content_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', 'seo-master-2026')
        .not('aliases', 'is', null);
    
    console.log(`Nodes with aliases: ${aliasesCount} (${Math.round(aliasesCount / totalCount * 100)}%)`);
    
    // Check keywords
    const { count: keywordsCount } = await supabase
        .from('content_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', 'seo-master-2026')
        .not('keywords', 'is', null);
    
    console.log(`Nodes with keywords: ${keywordsCount} (${Math.round(keywordsCount / totalCount * 100)}%)\n`);
    
    // Show sample nodes
    console.log('[Verify] Sample nodes with metadata:\n');
    
    const { data: samples } = await supabase
        .from('content_nodes')
        .select('canonical_reference, primary_topic, aliases, keywords, content')
        .eq('course_id', 'seo-master-2026')
        .not('primary_topic', 'is', null)
        .limit(3);
    
    if (samples && samples.length > 0) {
        samples.forEach((node, idx) => {
            console.log(`${idx + 1}. ${node.canonical_reference}`);
            console.log(`   Primary Topic: ${node.primary_topic || 'NULL'}`);
            console.log(`   Aliases: ${node.aliases ? JSON.stringify(node.aliases) : 'NULL'}`);
            console.log(`   Keywords: ${node.keywords ? JSON.stringify(node.keywords) : 'NULL'}`);
            console.log(`   Content: ${node.content.substring(0, 80)}...`);
            console.log('');
        });
    } else {
        console.log('   ❌ No nodes with metadata found!');
        console.log('\n[Verify] ACTION REQUIRED: Re-run ingestion to populate metadata');
        console.log('   Command: node scripts/ingest-atomic-content.js --course-id=seo-master-2026\n');
    }
    
    // Check if aliases column exists
    const { data: aliasesCheck, error: aliasesError } = await supabase
        .from('content_nodes')
        .select('aliases')
        .limit(1);
    
    if (aliasesError && aliasesError.message.includes('column')) {
        console.log('[Verify] ❌ aliases column does not exist!');
        console.log('   ACTION REQUIRED: Run migration-add-aliases-field.sql\n');
    } else {
        console.log('[Verify] ✓ aliases column exists\n');
    }
    
    console.log('[Verify] Complete!');
}

main().catch(console.error);

