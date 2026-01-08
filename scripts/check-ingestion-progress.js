/**
 * Check Ingestion Progress
 * 
 * Compares files that should be ingested vs what's already in the database
 * 
 * Usage:
 *   node scripts/check-ingestion-progress.js --course-id=seo-master-2026
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load configuration
 */
function loadConfig() {
    let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    // Try loading from config/app.config.local.js
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
                console.warn('[Progress] Could not read config file:', error.message);
            }
        }
    }
    
    // Try loading from .env file
    if (!supabaseUrl || !supabaseKey) {
        const envPath = join(__dirname, '..', 'config', '.env');
        if (existsSync(envPath)) {
            try {
                const envContent = readFileSync(envPath, 'utf-8');
                const lines = envContent.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    
                    const match = trimmed.match(/^([^=]+)=(.*)$/);
                    if (match) {
                        const key = match[1].trim();
                        let value = match[2].trim();
                        
                        if ((value.startsWith('"') && value.endsWith('"')) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        
                        if (key === 'SUPABASE_URL' || key === 'VITE_SUPABASE_URL') {
                            supabaseUrl = value;
                        } else if (key === 'SUPABASE_ANON_KEY' || key === 'VITE_SUPABASE_ANON_KEY') {
                            supabaseKey = value;
                        }
                    }
                }
            } catch (error) {
                console.warn('[Progress] Could not read .env file:', error.message);
            }
        }
    }
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or configure in config/app.config.local.js');
    }
    
    return { supabaseUrl, supabaseKey };
}

const { supabaseUrl, supabaseKey } = loadConfig();
const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const args = process.argv.slice(2);
const courseId = args.find(arg => arg.startsWith('--course-id='))?.split('=')[1];

if (!courseId) {
    console.error('Error: --course-id is required');
    console.log('Usage: node scripts/check-ingestion-progress.js --course-id=seo-master-2026');
    process.exit(1);
}

/**
 * Find all markdown files that should be ingested
 */
function findFilesToIngest(courseDir) {
    const markdownFiles = [];
    
    function findMarkdownFiles(dir) {
        try {
            const entries = readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') {
                        continue;
                    }
                    findMarkdownFiles(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                    if (entry.name === 'README.md' || 
                        entry.name === 'SEO_Course_Summary.md' ||
                        entry.name.includes('Submission_Format')) {
                        continue;
                    }
                    
                    if (entry.name.match(/^Day_\d+_(Chapter|Lab)_\d+_/i)) {
                        markdownFiles.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't access
            console.warn(`[Progress] Warning: Could not read directory ${dir}: ${error.message}`);
        }
    }
    
    findMarkdownFiles(courseDir);
    return markdownFiles;
}

/**
 * Parse file path to extract container info
 */
function parseFile(filePath) {
    const filename = filePath.split('/').pop().replace('.md', '');
    
    // Try chapter pattern
    let match = filename.match(/^Day_(\d+)_Chapter_(\d+)_/i);
    let containerType = 'chapter';
    
    if (!match) {
        match = filename.match(/^Day_(\d+)_Lab_(\d+)_/i);
        containerType = 'lab';
    }
    
    if (!match) {
        return null;
    }
    
    const day = parseInt(match[1]);
    const containerSeq = parseInt(match[2]);
    const containerId = `day${day}-${containerType === 'chapter' ? 'ch' : 'lab'}${containerSeq}`;
    
    return {
        day,
        containerType,
        containerSeq,
        containerId,
        filename
    };
}

/**
 * Main function
 */
async function main() {
    console.log(`[Progress] Checking ingestion progress for course: ${courseId}\n`);
    
    // Find course directory
    const courseDir = join(__dirname, '..', 'data', 'courses', courseId);
    
    if (!existsSync(courseDir)) {
        console.error(`[Progress] Error: Course directory not found: ${courseDir}`);
        process.exit(1);
    }
    
    // Find all files that should be ingested
    console.log('[Progress] Scanning course directory for markdown files...');
    const allFiles = findFilesToIngest(courseDir);
    console.log(`[Progress] Found ${allFiles.length} files to ingest\n`);
    
    // Parse files into containers
    const expectedContainers = new Map();
    for (const file of allFiles) {
        const parsed = parseFile(file);
        if (parsed) {
            expectedContainers.set(parsed.containerId, parsed);
        }
    }
    
    console.log(`[Progress] Expected containers: ${expectedContainers.size}\n`);
    
    // Query database for ingested containers
    console.log('[Progress] Querying database for ingested containers...');
    const { data: ingestedContainers, error } = await supabase
        .from('content_containers')
        .select('container_id, container_type, day, sequence_number, title, node_count, updated_at')
        .eq('course_id', courseId)
        .order('day', { ascending: true })
        .order('container_type', { ascending: true })
        .order('sequence_number', { ascending: true });
    
    if (error) {
        console.error('[Progress] Error querying database:', error);
        process.exit(1);
    }
    
    const ingestedMap = new Map();
    for (const container of ingestedContainers || []) {
        ingestedMap.set(container.container_id, container);
    }
    
    console.log(`[Progress] Found ${ingestedMap.size} ingested containers\n`);
    
    // Compare
    const ingested = [];
    const missing = [];
    const orphaned = [];
    
    for (const [containerId, expected] of expectedContainers) {
        if (ingestedMap.has(containerId)) {
            ingested.push({ containerId, ...expected, ...ingestedMap.get(containerId) });
        } else {
            missing.push({ containerId, ...expected });
        }
    }
    
    for (const [containerId, container] of ingestedMap) {
        if (!expectedContainers.has(containerId)) {
            orphaned.push(container);
        }
    }
    
    // Print summary
    console.log('═'.repeat(80));
    console.log('INGESTION PROGRESS SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Total files found:        ${allFiles.length}`);
    console.log(`Total containers:         ${expectedContainers.size}`);
    console.log(`Ingested containers:      ${ingested.length} ✅`);
    console.log(`Missing containers:       ${missing.length} ❌`);
    console.log(`Orphaned containers:      ${orphaned.length} ⚠️`);
    console.log(`Progress:                 ${((ingested.length / expectedContainers.size) * 100).toFixed(1)}%`);
    console.log('═'.repeat(80));
    
    // Print breakdown by day
    const byDay = {};
    for (const item of expectedContainers.values()) {
        if (!byDay[item.day]) {
            byDay[item.day] = { expected: 0, ingested: 0, missing: 0 };
        }
        byDay[item.day].expected++;
        
        if (ingestedMap.has(item.containerId)) {
            byDay[item.day].ingested++;
        } else {
            byDay[item.day].missing++;
        }
    }
    
    console.log('\nPROGRESS BY DAY:');
    console.log('─'.repeat(80));
    console.log('Day | Expected | Ingested | Missing | Progress');
    console.log('─'.repeat(80));
    
    const sortedDays = Object.keys(byDay).sort((a, b) => parseInt(a) - parseInt(b));
    for (const day of sortedDays) {
        const stats = byDay[day];
        const progress = ((stats.ingested / stats.expected) * 100).toFixed(1);
        const status = stats.missing === 0 ? '✅' : '⏳';
        console.log(`  ${day.padStart(2)} | ${stats.expected.toString().padStart(8)} | ${stats.ingested.toString().padStart(8)} | ${stats.missing.toString().padStart(7)} | ${progress.padStart(6)}% ${status}`);
    }
    
    // Show missing containers if any
    if (missing.length > 0) {
        console.log('\n⚠️  MISSING CONTAINERS (not yet ingested):');
        console.log('─'.repeat(80));
        
        const missingByDay = {};
        for (const item of missing) {
            if (!missingByDay[item.day]) {
                missingByDay[item.day] = [];
            }
            missingByDay[item.day].push(item);
        }
        
        const sortedMissingDays = Object.keys(missingByDay).sort((a, b) => parseInt(a) - parseInt(b));
        for (const day of sortedMissingDays) {
            console.log(`\nDay ${day}:`);
            for (const item of missingByDay[day]) {
                console.log(`  - ${item.containerId} (${item.containerType}) - ${item.filename}`);
            }
        }
    }
    
    // Show orphaned containers if any
    if (orphaned.length > 0) {
        console.log('\n⚠️  ORPHANED CONTAINERS (in database but no file exists):');
        console.log('─'.repeat(80));
        for (const item of orphaned) {
            console.log(`  - ${item.container_id} (Day ${item.day}, ${item.container_type}) - ${item.node_count} nodes`);
        }
    }
    
    // Show total node count
    const totalNodes = ingested.reduce((sum, item) => sum + (item.node_count || 0), 0);
    console.log(`\n📊 Total nodes ingested: ${totalNodes}`);
    
    console.log('\n✅ Progress check complete!');
}

main().catch(error => {
    console.error('[Progress] Fatal error:', error);
    process.exit(1);
});

