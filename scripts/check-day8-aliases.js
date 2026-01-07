/**
 * Check Day 8 Aliases
 * 
 * Verifies what aliases were generated for Day 8 nodes
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    console.log('Checking Day 8 aliases...\n');
    
    // Get Day 8 nodes with "Technical SEO" in primary_topic
    const { data: nodes, error } = await supabase
        .from('content_nodes')
        .select('canonical_reference, day, primary_topic, aliases, keywords')
        .eq('course_id', 'seo-master-2026')
        .eq('day', 8)
        .ilike('primary_topic', '%technical%')
        .limit(10);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log(`Found ${nodes.length} Day 8 nodes with "technical" in primary_topic:\n`);
    
    nodes.forEach((node, idx) => {
        console.log(`${idx + 1}. ${node.canonical_reference}`);
        console.log(`   Primary Topic: ${node.primary_topic}`);
        console.log(`   Aliases: ${node.aliases ? JSON.stringify(node.aliases) : 'NULL'}`);
        console.log(`   Keywords: ${node.keywords ? JSON.stringify(node.keywords) : 'NULL'}`);
        console.log('');
    });
    
    // Test search for the exact concept from query
    const searchConcept = 'technical search engine optimization';
    console.log(`\nTesting search for: "${searchConcept}"\n`);
    
    // Test primary_topic match
    const { count: topicCount } = await supabase
        .from('content_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', 'seo-master-2026')
        .eq('day', 8)
        .ilike('primary_topic', `%${searchConcept}%`);
    console.log(`Primary Topic matches: ${topicCount}`);
    
    // Test aliases match
    const { count: aliasesCount } = await supabase
        .from('content_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', 'seo-master-2026')
        .eq('day', 8)
        .contains('aliases', [searchConcept.toLowerCase()]);
    console.log(`Aliases matches: ${aliasesCount}`);
    
    // Test keywords match
    const { count: keywordsCount } = await supabase
        .from('content_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', 'seo-master-2026')
        .eq('day', 8)
        .contains('keywords', [searchConcept.toLowerCase()]);
    console.log(`Keywords matches: ${keywordsCount}`);
    
    // Test partial matches
    const partialConcepts = [
        'technical seo',
        'technical optimization',
        'technical search optimization'
    ];
    
    console.log('\nTesting partial concept matches:');
    for (const concept of partialConcepts) {
        const { count: partialCount } = await supabase
            .from('content_nodes')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', 'seo-master-2026')
            .eq('day', 8)
            .contains('aliases', [concept.toLowerCase()]);
        console.log(`  "${concept}": ${partialCount} matches`);
    }
}

main().catch(console.error);

