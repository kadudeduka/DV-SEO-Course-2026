/**
 * Atomic Content Ingestion Pipeline
 * 
 * Migrates existing chunk-based content to atomic content nodes with canonical references.
 * 
 * Usage:
 *   node scripts/ingest-atomic-content.js --course-id=seo-master-2026
 *   node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --day=1
 *   node scripts/ingest-atomic-content.js --course-id=seo-master-2026 --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { aliasGeneratorService } from '../lms/services/alias-generator-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load configuration from multiple sources
 */
function loadConfig() {
    // Try environment variables first
    let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    // Try loading from config/app.config.local.js
    if (!supabaseUrl || !supabaseKey) {
        const configPath = join(__dirname, '..', 'config', 'app.config.local.js');
        if (existsSync(configPath)) {
            try {
                // Read and parse the config file
                const configContent = readFileSync(configPath, 'utf-8');
                // Extract SUPABASE_URL and SUPABASE_ANON_KEY from window.LMS_CONFIG
                const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
                const keyMatch = configContent.match(/SUPABASE_ANON_KEY:\s*['"]([^'"]+)['"]/);
                
                if (urlMatch) supabaseUrl = urlMatch[1];
                if (keyMatch) supabaseKey = keyMatch[1];
            } catch (error) {
                console.warn('[Ingestion] Could not read config file:', error.message);
            }
        }
    }
    
    // Try loading from .env file in config directory
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
                        
                        // Remove quotes
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
                console.warn('[Ingestion] Could not read .env file:', error.message);
            }
        }
    }
    
    return { supabaseUrl, supabaseKey };
}

// Load configuration
const { supabaseUrl, supabaseKey } = loadConfig();

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    console.error('\nPlease set them in one of these ways:');
    console.error('1. Environment variables:');
    console.error('   export SUPABASE_URL="your-url"');
    console.error('   export SUPABASE_ANON_KEY="your-key"');
    console.error('\n2. config/app.config.local.js file:');
    console.error('   window.LMS_CONFIG = { SUPABASE_URL: "...", SUPABASE_ANON_KEY: "..." }');
    console.error('\n3. config/.env file:');
    console.error('   SUPABASE_URL=your-url');
    console.error('   SUPABASE_ANON_KEY=your-key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const args = process.argv.slice(2);
const courseId = args.find(arg => arg.startsWith('--course-id='))?.split('=')[1];
const dayFilter = args.find(arg => arg.startsWith('--day='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

if (!courseId) {
    console.error('Error: --course-id is required');
    console.log('Usage: node scripts/ingest-atomic-content.js --course-id=seo-master-2026 [--day=N] [--dry-run]');
    process.exit(1);
}

/**
 * Extract primary topic from content
 * @param {string} content - Node content
 * @param {string} containerTitle - Container title
 * @returns {string|null} Primary topic
 */
function extractPrimaryTopic(content, containerTitle) {
    // Try to extract from first heading in content
    const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
    if (headingMatch) {
        return headingMatch[1].trim();
    }
    
    // Fallback to container title if available
    if (containerTitle) {
        // Remove "Day X, Chapter Y —" prefix
        const cleanTitle = containerTitle.replace(/^Day\s+\d+,?\s+(Chapter|Lab)\s+\d+\s*[—-]\s*/i, '').trim();
        if (cleanTitle) {
            return cleanTitle;
        }
    }
    
    return null;
}

/**
 * Extract short definition from content (first 2-3 sentences)
 * @param {string} content - Node content
 * @returns {string} Short definition (max 200 chars)
 */
function extractShortDefinition(content) {
    // Remove markdown headings
    let text = content.replace(/^#{1,6}\s+.+$/gm, '');
    
    // Remove markdown formatting
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
    text = text.replace(/\*([^*]+)\*/g, '$1'); // Italic
    text = text.replace(/`([^`]+)`/g, '$1'); // Code
    
    // Extract first 2-3 sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const firstSentences = sentences.slice(0, 3).join(' ').trim();
    
    // Limit to 200 characters
    return firstSentences.substring(0, 200);
}

/**
 * Generate aliases using AliasGenerator service
 * @param {string} primaryTopic - Primary topic
 * @param {string} content - Node content (for definition extraction)
 * @param {string} nodeType - Node type
 * @returns {Promise<Array<string>>} Array of aliases (lowercase)
 */
async function generateAliases(primaryTopic, content, nodeType) {
    if (!primaryTopic || primaryTopic.trim().length === 0) {
        return [];
    }
    
    try {
        // Extract short definition from content
        const definition = extractShortDefinition(content);
        
        // Generate aliases using LLM-based service
        const aliases = await aliasGeneratorService.generateAliases(
            primaryTopic,
            definition,
            nodeType
        );
        
        return aliases;
    } catch (error) {
        console.warn(`[Ingestion] Failed to generate aliases for "${primaryTopic}":`, error.message);
        // Fallback: return basic aliases
        return [primaryTopic.toLowerCase().trim()];
    }
}

/**
 * Extract keywords from content
 * @param {string} content - Node content
 * @returns {Array<string>} Array of keywords (lowercase)
 */
function extractKeywords(content) {
    const keywords = new Set();
    
    // Extract bold/emphasized terms (often key concepts)
    const boldMatches = content.matchAll(/\*\*([^*]+)\*\*/g);
    for (const match of boldMatches) {
        const term = match[1].trim().toLowerCase();
        if (term.length >= 3 && term.length <= 40) {
            keywords.add(term);
        }
    }
    
    // Extract terms from list items (often key points)
    const listMatches = content.matchAll(/^[-*]\s+(.+)$/gm);
    for (const match of listMatches) {
        const term = match[1].trim().toLowerCase();
        // Extract first few words (key phrase)
        const firstWords = term.split(/\s+/).slice(0, 3).join(' ');
        if (firstWords.length >= 5 && firstWords.length <= 40) {
            keywords.add(firstWords);
        }
    }
    
    // Extract capitalized terms (often proper nouns/concepts)
    const capitalizedMatches = content.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g);
    for (const match of capitalizedMatches) {
        const term = match[1].trim().toLowerCase();
        if (term.length >= 5 && term.length <= 40) {
            keywords.add(term);
        }
    }
    
    return [...keywords].slice(0, 10); // Limit to 10 keywords per node
}

/**
 * Split content into atomic nodes
 * @param {string} content - Full content text
 * @param {Object} metadata - Content metadata
 * @returns {Array<Object>} Array of atomic nodes
 */
function splitIntoAtomicNodes(content, metadata) {
    const nodes = [];
    let currentSequence = 1;
    
        // Split by double newlines (paragraphs)
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
        
        // If no paragraphs found, try splitting by single newlines
        if (paragraphs.length === 0) {
            const lines = content.split(/\n+/).filter(l => l.trim().length > 0);
            paragraphs.push(...lines);
        }
        
        for (const para of paragraphs) {
            const trimmed = para.trim();
            
            // Skip very short paragraphs (likely formatting artifacts)
            // But allow headings and list items even if short
            if (trimmed.length < 10 && !trimmed.match(/^#{1,3}\s/) && !trimmed.match(/^[-*]\s/)) {
                continue;
            }
        
        // Determine node type
        let nodeType = 'concept';
        let nodeTypeCode = 'C';
        
        if (/^Step\s+\d+[:.]/i.test(trimmed)) {
            nodeType = 'step';
            nodeTypeCode = 'S';
        } else if (/^Definition[:.]/i.test(trimmed) || /^Defined as/i.test(trimmed)) {
            nodeType = 'definition';
            nodeTypeCode = 'D';
        } else if (/^Example[:.]/i.test(trimmed) || /^For instance/i.test(trimmed)) {
            nodeType = 'example';
            nodeTypeCode = 'E';
        } else if (/^Procedure[:.]/i.test(trimmed) || /^How to/i.test(trimmed)) {
            nodeType = 'procedure';
            nodeTypeCode = 'P';
        } else if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
            nodeType = 'list_item';
            nodeTypeCode = 'L';
        } else if (/^#{1,3}\s/.test(trimmed)) {
            nodeType = 'heading';
            nodeTypeCode = 'H';
        }
        
        // Check if content is too long (split at sentence boundaries)
        const maxWords = 300;
        const words = trimmed.split(/\s+/);
        
        if (words.length > maxWords) {
            // Split at sentence boundaries
            const sentences = trimmed.split(/[.!?]+\s+/);
            let currentText = '';
            let sentenceCount = 0;
            
            for (const sentence of sentences) {
                const testText = currentText ? `${currentText}. ${sentence}` : sentence;
                const testWords = testText.split(/\s+/);
                
                if (testWords.length > maxWords && currentText) {
                    // Save current node
                    nodes.push({
                        content: currentText + '.',
                        nodeType,
                        nodeTypeCode,
                        sequenceNumber: currentSequence++,
                        wordCount: currentText.split(/\s+/).length
                    });
                    currentText = sentence;
                    sentenceCount = 1;
                } else {
                    currentText = testText;
                    sentenceCount++;
                }
            }
            
            // Add remaining text
            if (currentText) {
                nodes.push({
                    content: currentText,
                    nodeType,
                    nodeTypeCode,
                    sequenceNumber: currentSequence++,
                    wordCount: currentText.split(/\s+/).length
                });
            }
        } else {
            nodes.push({
                content: trimmed,
                nodeType,
                nodeTypeCode,
                sequenceNumber: currentSequence++,
                wordCount: words.length
            });
        }
    }
    
    return nodes;
}

/**
 * Generate canonical reference
 * @param {number} day - Day number
 * @param {string} containerType - 'chapter' or 'lab'
 * @param {number} containerSeq - Container sequence
 * @param {string} nodeTypeCode - Node type code (S, C, E, D, P, L, H)
 * @param {number} nodeSeq - Node sequence
 * @returns {string} Canonical reference (e.g., "D1.C1.S3")
 */
function generateCanonicalReference(day, containerType, containerSeq, nodeTypeCode, nodeSeq) {
    const containerCode = containerType === 'chapter' ? 'C' : 'L';
    return `D${day}.${containerCode}${containerSeq}.${nodeTypeCode}${nodeSeq}`;
}

/**
 * Generate content hash
 * @param {string} content - Content text
 * @returns {string} SHA-256 hash
 */
function generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Process a markdown file
 * @param {string} filePath - Path to markdown file
 * @param {string} courseId - Course ID
 * @returns {Promise<Object>} Processing result
 */
async function processMarkdownFile(filePath, courseId) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        
        // Extract metadata from filename
        // Expected formats:
        // - Chapters: Day_XX_Chapter_XX_Title.md
        // - Labs: Day_XX_Lab_XX_Title.md
        const filename = filePath.split('/').pop().replace('.md', '');
        
        // Try chapter pattern: Day_XX_Chapter_XX_...
        let match = filename.match(/^Day_(\d+)_Chapter_(\d+)_/i);
        let containerType = 'chapter';
        
        // Try lab pattern if chapter didn't match: Day_XX_Lab_XX_...
        if (!match) {
            match = filename.match(/^Day_(\d+)_Lab_(\d+)_/i);
            containerType = 'lab';
        }
        
        if (!match) {
            console.warn(`[Ingestion] Skipping file with unexpected format: ${filename}`);
            return { processed: false, reason: 'unexpected_format' };
        }
        
        const day = parseInt(match[1]);
        const containerSeq = parseInt(match[2]);
        // Generate container_id in format: dayX-chY or dayX-labY
        const containerId = `day${day}-${containerType === 'chapter' ? 'ch' : 'lab'}${containerSeq}`;
        
        // Apply day filter if specified
        if (dayFilter && parseInt(dayFilter) !== day) {
            return { processed: false, reason: 'day_filter' };
        }
        
        // Extract title from first heading or use filename
        const titleMatch = content.match(/^#+\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : containerId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        // Split into atomic nodes
        const atomicNodes = splitIntoAtomicNodes(content, { day, containerType, containerSeq });
        
        if (atomicNodes.length === 0) {
            console.warn(`[Ingestion] No nodes extracted from: ${filename}`);
            return { processed: false, reason: 'no_nodes' };
        }
        
        console.log(`[Ingestion] Processing ${filename}: ${atomicNodes.length} nodes`);
        
        if (dryRun) {
            console.log(`[Ingestion] DRY RUN: Would create ${atomicNodes.length} nodes for ${containerId}`);
            return { processed: true, dryRun: true, nodeCount: atomicNodes.length };
        }
        
        // Create or update container
        const { data: containerData, error: containerError } = await supabase
            .from('content_containers')
            .upsert({
                course_id: courseId,
                container_type: containerType,
                container_id: containerId,
                day: day,
                sequence_number: containerSeq,
                title: title,
                node_count: atomicNodes.length,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'course_id,container_type,container_id'
            })
            .select('id')
            .single();
        
        if (containerError) {
            throw new Error(`Failed to create container: ${containerError.message}`);
        }
        
        // Process each node
        const nodeInserts = [];
        const registryInserts = [];
        
        for (const node of atomicNodes) {
            const canonicalRef = generateCanonicalReference(
                day,
                containerType,
                containerSeq,
                node.nodeTypeCode,
                node.sequenceNumber
            );
            
            const contentHash = generateContentHash(node.content);
            
            // Extract metadata for this node
            const primaryTopic = extractPrimaryTopic(node.content, title);
            const aliases = await generateAliases(primaryTopic, node.content, node.nodeType);
            const keywords = extractKeywords(node.content);
            
            // Insert into content_nodes
            nodeInserts.push({
                course_id: courseId,
                canonical_reference: canonicalRef,
                reference_type: node.nodeType,
                day: day,
                container_type: containerType,
                container_id: containerId,
                container_title: title,
                sequence_number: node.sequenceNumber,
                content: node.content,
                content_type: 'paragraph',
                content_hash: contentHash,
                version: 1,
                is_valid: true,
                primary_topic: primaryTopic,
                aliases: aliases.length > 0 ? aliases : null,
                keywords: keywords.length > 0 ? keywords : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            
            // Insert into canonical_reference_registry
            registryInserts.push({
                canonical_reference: canonicalRef,
                course_id: courseId,
                day: day,
                container_type: containerType,
                container_id: containerId,
                container_title: title,
                sequence_number: node.sequenceNumber,
                node_type: node.nodeType,
                content_type: 'paragraph',
                content_preview: node.content.substring(0, 100),
                word_count: node.wordCount,
                character_count: node.content.length,
                is_valid: true,
                version: 1,
                primary_topic: primaryTopic,
                aliases: aliases.length > 0 ? aliases : null,
                keywords: keywords.length > 0 ? keywords : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        
        // Batch insert nodes
        // Delete existing nodes for this container first to avoid constraint violations
        if (nodeInserts.length > 0) {
            const { error: deleteError } = await supabase
                .from('content_nodes')
                .delete()
                .eq('course_id', courseId)
                .eq('container_type', containerType)
                .eq('container_id', containerId);
            
            if (deleteError) {
                console.warn(`[Ingestion] Warning: Could not delete existing nodes for ${containerId}: ${deleteError.message}`);
            }
            
            // Now insert fresh nodes
            const { error: nodesError } = await supabase
                .from('content_nodes')
                .insert(nodeInserts);
            
            if (nodesError) {
                throw new Error(`Failed to insert nodes: ${nodesError.message}`);
            }
        }
        
        // Batch insert registry entries
        // Need to handle both unique constraints:
        // 1. canonical_reference (primary)
        // 2. (course_id, container_type, container_id, sequence_number)
        if (registryInserts.length > 0) {
            // First, delete any existing entries for this container to avoid constraint violations
            const { error: deleteError } = await supabase
                .from('canonical_reference_registry')
                .delete()
                .eq('course_id', courseId)
                .eq('container_type', containerType)
                .eq('container_id', containerId);
            
            if (deleteError) {
                console.warn(`[Ingestion] Warning: Could not delete existing registry entries for ${containerId}: ${deleteError.message}`);
            }
            
            // Now insert fresh entries
            const { error: registryError } = await supabase
                .from('canonical_reference_registry')
                .insert(registryInserts);
            
            if (registryError) {
                throw new Error(`Failed to insert registry entries: ${registryError.message}`);
            }
        }
        
        console.log(`[Ingestion] ✓ Successfully processed ${filename}: ${atomicNodes.length} nodes`);
        
        return {
            processed: true,
            containerId,
            nodeCount: atomicNodes.length
        };
        
    } catch (error) {
        const filename = filePath.split('/').pop();
        console.error(`[Ingestion] ✗ Error processing ${filename}:`, error.message);
        return { 
            processed: false, 
            error: error.message,
            reason: error.message.includes('format') ? 'unexpected_format' : 
                   error.message.includes('database') ? 'database_error' :
                   error.message.includes('insert') ? 'insert_error' : 'processing_error'
        };
    }
}

/**
 * Main ingestion function
 */
async function main() {
    console.log(`[Ingestion] Starting atomic content ingestion for course: ${courseId}`);
    if (dryRun) {
        console.log('[Ingestion] DRY RUN MODE - No changes will be made');
    }
    if (dayFilter) {
        console.log(`[Ingestion] Filtering to Day ${dayFilter} only`);
    }
    
    // Find course content directory
    const courseDir = join(__dirname, '..', 'data', 'courses', courseId);
    
    try {
        const stats = statSync(courseDir);
        if (!stats.isDirectory()) {
            throw new Error(`Course directory not found: ${courseDir}`);
        }
    } catch (error) {
        console.error(`[Ingestion] Error accessing course directory: ${error.message}`);
        process.exit(1);
    }
    
    // Find all markdown files
    const markdownFiles = [];
    
    function findMarkdownFiles(dir) {
        const entries = readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // Skip certain directories
                if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') {
                    continue;
                }
                findMarkdownFiles(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                // Process files matching patterns:
                // - Day_XX_Chapter_XX_*.md (chapters)
                // - Day_XX_Lab_XX_*.md (labs)
                // Skip README.md, Submission_Format files, and other non-content files
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
    }
    
    // Start from course directory (will recursively search)
    findMarkdownFiles(courseDir);
    
    console.log(`[Ingestion] Found ${markdownFiles.length} markdown files to process`);
    
    // Process each file
    const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
        totalNodes: 0,
        failedFiles: [] // Track failed files for debugging
    };
    
    for (const file of markdownFiles) {
        const result = await processMarkdownFile(file, courseId);
        
        if (result.processed) {
            results.processed++;
            results.totalNodes += result.nodeCount || 0;
        } else if (result.reason === 'day_filter' || result.reason === 'unexpected_format') {
            results.skipped++;
        } else {
            results.failed++;
            results.failedFiles.push({
                file: file.split('/').pop(),
                reason: result.reason || 'unknown',
                error: result.error || 'No error message'
            });
        }
    }
    
    // Summary
    console.log('\n[Ingestion] Summary:');
    console.log(`  Processed: ${results.processed} files`);
    console.log(`  Failed: ${results.failed} files`);
    console.log(`  Skipped: ${results.skipped} files`);
    console.log(`  Total nodes created: ${results.totalNodes}`);
    
    // Show failed files if any
    if (results.failed > 0 && results.failedFiles.length > 0) {
        console.log('\n[Ingestion] Failed files:');
        // Group by error type
        const errorGroups = {};
        results.failedFiles.forEach(f => {
            const key = f.reason || f.error || 'unknown';
            if (!errorGroups[key]) {
                errorGroups[key] = [];
            }
            errorGroups[key].push(f.file);
        });
        
        Object.entries(errorGroups).forEach(([error, files]) => {
            console.log(`  ${error}: ${files.length} file(s)`);
            if (files.length <= 10) {
                files.forEach(f => console.log(`    - ${f}`));
            } else {
                files.slice(0, 10).forEach(f => console.log(`    - ${f}`));
                console.log(`    ... and ${files.length - 10} more`);
            }
        });
    }
    
    if (dryRun) {
        console.log('\n[Ingestion] DRY RUN complete - No changes were made');
    } else {
        console.log('\n[Ingestion] ✓ Ingestion complete!');
        if (results.failed > 0) {
            console.log(`\n⚠️  Warning: ${results.failed} files failed. Review errors above.`);
        }
    }
}

// Run main function
main().catch(error => {
    console.error('[Ingestion] Fatal error:', error);
    process.exit(1);
});

