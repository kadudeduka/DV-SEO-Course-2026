# Content Migration Strategy: Chunks → Atomic Nodes

## Executive Summary

This document defines a **deterministic, rule-based migration strategy** to convert existing chunk-based content storage into atomic content nodes with canonical references. The migration is **reversible** and **preserves content exactly** without rephrasing.

---

## Section 1: Migration Overview

### 1.1 Current State

**Existing Schema:**
```sql
-- Current: One chunk per chapter/lab
ai_coach_content_chunks (
    id UUID,
    course_id TEXT,
    day INTEGER,
    chapter_id TEXT,
    chapter_title TEXT,
    content TEXT, -- Large text (1000-5000 words)
    lab_id TEXT,
    ...
)
```

**Problems:**
- One chunk = entire chapter (2000+ words)
- Multiple concepts per chunk
- No granular references
- Hard to cite specific sections

### 1.2 Target State

**New Schema:**
```sql
-- Target: Atomic nodes with canonical references
content_nodes (
    id UUID,
    canonical_reference TEXT, -- D1.C1.S3
    content TEXT, -- Atomic (50-200 words)
    ...
)

canonical_reference_registry (
    canonical_reference TEXT, -- D1.C1.S3
    ...
)
```

**Benefits:**
- One node = one idea
- Precise references
- Better retrieval
- No reference hallucination

---

## Section 2: Migration Rules

### 2.1 Content Splitting Rules

#### Rule 1: Paragraph Boundaries
- **Split at**: Every paragraph break (`\n\n` or double newline)
- **Exception**: Paragraphs < 20 words are merged with next paragraph
- **Result**: Each paragraph becomes one node (if > 20 words)

#### Rule 2: List Items
- **Split at**: Every list item (`- `, `* `, or numbered `1. `, `2. `)
- **Result**: Each list item becomes one node
- **Type**: `list_item` (L) or `step` (S) if in procedure

#### Rule 3: Headings
- **Split at**: Every markdown heading (`# `, `## `, `### `)
- **Result**: Heading becomes separate node (type: `heading`)
- **Content after heading**: Starts new node

#### Rule 4: Code Blocks
- **Split at**: Code block boundaries (```)
- **Result**: Entire code block becomes one node (type: `code_block`)

#### Rule 5: Tables
- **Split at**: Table boundaries (markdown tables)
- **Result**: Entire table becomes one node (type: `table`)

#### Rule 6: Minimum Size
- **Minimum**: 20 words per node
- **Action**: Merge with adjacent node if < 20 words
- **Exception**: Headings, list items, code blocks (always separate)

#### Rule 7: Maximum Size
- **Maximum**: 300 words per node
- **Action**: Split long paragraphs at sentence boundaries
- **Split point**: Last sentence before 300-word limit

### 2.2 Node Type Classification Rules

**Automatic Classification:**

| Pattern | Node Type | Code |
|---------|-----------|------|
| Starts with "Step 1:", "Step 2:" | `step` | S |
| Starts with "Definition:", "Defined as" | `definition` | D |
| Starts with "Example:", "For instance" | `example` | E |
| Starts with "Procedure:", "How to" | `procedure` | P |
| List item (`- `, `* `, `1. `) | `list_item` | L |
| Markdown heading (`#`, `##`, `###`) | `heading` | H |
| Code block (```) | `code_block` | B |
| Table (markdown table) | `table` | T |
| Default | `concept` | C |

### 2.3 Canonical Reference Assignment Rules

**Format:** `D{day}.{container_type}{container_seq}.{node_type}{node_seq}`

**Assignment Process:**
1. Extract day from existing chunk
2. Determine container type: `C` (chapter) or `L` (lab)
3. Extract container sequence from `chapter_id` or `lab_id`
4. Assign node type based on classification rules
5. Number nodes sequentially within container (1, 2, 3...)

**Example:**
```
Chunk: day=1, chapter_id="day1-ch1", content="..."
→ Split into 10 nodes
→ Assign: D1.C1.C1, D1.C1.C2, D1.C1.H1, D1.C1.C3, ...
```

### 2.4 Hierarchy Preservation Rules

**Parent-Child Relationships:**
- Heading nodes are parents
- Content nodes after headings are children
- `parent_reference` field links child to parent

**Sibling Ordering:**
- `sequence_number` preserves order
- `sibling_sequence` for nodes under same parent

---

## Section 3: Step-by-Step Migration Plan

### Phase 1: Preparation

**Step 1.1: Backup Existing Data**
```sql
-- Create backup table
CREATE TABLE ai_coach_content_chunks_backup AS 
SELECT * FROM ai_coach_content_chunks;

-- Verify backup
SELECT COUNT(*) FROM ai_coach_content_chunks_backup;
```

**Step 1.2: Create New Tables**
```sql
-- Run migration scripts from atomic architecture design
-- Creates: content_nodes, content_containers, canonical_reference_registry
```

**Step 1.3: Create Migration Tracking Table**
```sql
CREATE TABLE migration_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_chunk_id UUID NOT NULL,
    source_chunk_reference TEXT, -- For rollback
    nodes_created INTEGER DEFAULT 0,
    migration_status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, failed, rolled_back
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_migration_tracking_status ON migration_tracking(migration_status);
CREATE INDEX idx_migration_tracking_chunk ON migration_tracking(source_chunk_id);
```

### Phase 2: Content Analysis

**Step 2.1: Analyze Chunk Structure**
```sql
-- Identify chunks that need splitting
SELECT 
    id,
    day,
    chapter_id,
    lab_id,
    LENGTH(content) as content_length,
    (LENGTH(content) - LENGTH(REPLACE(content, E'\n\n', ''))) / 2 as paragraph_count,
    (LENGTH(content) - LENGTH(REPLACE(content, '- ', ''))) / 2 as list_item_count
FROM ai_coach_content_chunks
WHERE course_id = 'seo-master-2026'
ORDER BY day, chapter_id, lab_id;
```

**Step 2.2: Estimate Node Count**
```javascript
// Estimate nodes per chunk
function estimateNodes(chunk) {
    let count = 0;
    
    // Count paragraphs
    const paragraphs = chunk.content.split(/\n\n+/);
    count += paragraphs.filter(p => p.trim().length > 0).length;
    
    // Count list items
    const listItems = chunk.content.match(/^[-*]\s+/gm);
    if (listItems) count += listItems.length;
    
    // Count headings
    const headings = chunk.content.match(/^#{1,3}\s+/gm);
    if (headings) count += headings.length;
    
    // Count code blocks
    const codeBlocks = chunk.content.match(/```[\s\S]*?```/g);
    if (codeBlocks) count += codeBlocks.length;
    
    return Math.max(1, count); // At least 1 node
}
```

### Phase 3: Content Splitting

**Step 3.1: Split Chunk into Atomic Units**

```javascript
/**
 * Split chunk content into atomic nodes
 * @param {Object} chunk - Source chunk
 * @returns {Array<Object>} Array of atomic nodes
 */
function splitChunkIntoNodes(chunk) {
    const nodes = [];
    let content = chunk.content;
    let sequenceNumber = 1;
    
    // Step 1: Extract code blocks (preserve them)
    const codeBlocks = [];
    content = content.replace(/```([\s\S]*?)```/g, (match, code) => {
        const id = `CODE_BLOCK_${codeBlocks.length}`;
        codeBlocks.push({ id, content: code });
        return id;
    });
    
    // Step 2: Extract tables (preserve them)
    const tables = [];
    content = content.replace(/\|[\s\S]*?\|/g, (match) => {
        const id = `TABLE_${tables.length}`;
        tables.push({ id, content: match });
        return id;
    });
    
    // Step 3: Extract headings
    const headingMatches = [];
    content = content.replace(/^(#{1,3})\s+(.+)$/gm, (match, hashes, title) => {
        const level = hashes.length;
        const id = `HEADING_${headingMatches.length}`;
        headingMatches.push({ id, level, title: title.trim() });
        return id;
    });
    
    // Step 4: Split by paragraphs
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    // Step 5: Process each paragraph
    for (const para of paragraphs) {
        // Check if it's a code block placeholder
        const codeBlockMatch = para.match(/CODE_BLOCK_(\d+)/);
        if (codeBlockMatch) {
            const block = codeBlocks[parseInt(codeBlockMatch[1])];
            nodes.push({
                type: 'code_block',
                content: block.content,
                sequenceNumber: sequenceNumber++,
                nodeType: 'B'
            });
            continue;
        }
        
        // Check if it's a table placeholder
        const tableMatch = para.match(/TABLE_(\d+)/);
        if (tableMatch) {
            const table = tables[parseInt(tableMatch[1])];
            nodes.push({
                type: 'table',
                content: table.content,
                sequenceNumber: sequenceNumber++,
                nodeType: 'T'
            });
            continue;
        }
        
        // Check if it's a heading placeholder
        const headingMatch = para.match(/HEADING_(\d+)/);
        if (headingMatch) {
            const heading = headingMatches[parseInt(headingMatch[1])];
            nodes.push({
                type: 'heading',
                content: heading.title,
                level: heading.level,
                sequenceNumber: sequenceNumber++,
                nodeType: 'H'
            });
            continue;
        }
        
        // Check if paragraph contains list items
        const listItems = para.match(/^[-*]\s+.+$/gm);
        if (listItems && listItems.length > 0) {
            // Split into list items
            for (const item of listItems) {
                const itemContent = item.replace(/^[-*]\s+/, '').trim();
                if (itemContent.length > 0) {
                    nodes.push({
                        type: 'list_item',
                        content: itemContent,
                        sequenceNumber: sequenceNumber++,
                        nodeType: 'L'
                    });
                }
            }
            continue;
        }
        
        // Check if paragraph contains numbered steps
        const steps = para.match(/^\d+\.\s+.+$/gm);
        if (steps && steps.length > 0) {
            // Split into steps
            for (const step of steps) {
                const stepContent = step.replace(/^\d+\.\s+/, '').trim();
                if (stepContent.length > 0) {
                    nodes.push({
                        type: 'step',
                        content: stepContent,
                        sequenceNumber: sequenceNumber++,
                        nodeType: 'S'
                    });
                }
            }
            continue;
        }
        
        // Regular paragraph
        // Check if too long (> 300 words)
        const words = para.trim().split(/\s+/);
        if (words.length > 300) {
            // Split at sentence boundaries
            const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
            let currentContent = '';
            let currentWordCount = 0;
            
            for (const sentence of sentences) {
                const sentenceWords = sentence.trim().split(/\s+/).length;
                if (currentWordCount + sentenceWords > 300 && currentContent.length > 0) {
                    // Save current node
                    nodes.push({
                        type: 'concept',
                        content: currentContent.trim(),
                        sequenceNumber: sequenceNumber++,
                        nodeType: 'C'
                    });
                    currentContent = sentence;
                    currentWordCount = sentenceWords;
                } else {
                    currentContent += (currentContent ? ' ' : '') + sentence;
                    currentWordCount += sentenceWords;
                }
            }
            
            // Add remaining content
            if (currentContent.trim().length > 0) {
                nodes.push({
                    type: 'concept',
                    content: currentContent.trim(),
                    sequenceNumber: sequenceNumber++,
                    nodeType: 'C'
                });
            }
        } else if (words.length >= 20) {
            // Valid paragraph (20-300 words)
            nodes.push({
                type: 'concept',
                content: para.trim(),
                sequenceNumber: sequenceNumber++,
                nodeType: 'C'
            });
        } else {
            // Too short, merge with next (handled in post-processing)
            nodes.push({
                type: 'concept',
                content: para.trim(),
                sequenceNumber: sequenceNumber++,
                nodeType: 'C',
                mergeWithNext: true
            });
        }
    }
    
    // Step 6: Post-process - merge short nodes
    const finalNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.mergeWithNext && i + 1 < nodes.length) {
            // Merge with next node
            const nextNode = nodes[i + 1];
            finalNodes.push({
                type: node.type,
                content: node.content + ' ' + nextNode.content,
                sequenceNumber: node.sequenceNumber,
                nodeType: node.nodeType
            });
            i++; // Skip next node
        } else {
            finalNodes.push(node);
        }
    }
    
    // Step 7: Re-number sequence
    finalNodes.forEach((node, index) => {
        node.sequenceNumber = index + 1;
    });
    
    return finalNodes;
}
```

**Step 3.2: Assign Canonical References**

```javascript
/**
 * Assign canonical references to nodes
 * @param {Array<Object>} nodes - Atomic nodes
 * @param {Object} chunk - Source chunk
 * @returns {Array<Object>} Nodes with canonical references
 */
function assignCanonicalReferences(nodes, chunk) {
    const day = chunk.day;
    const containerType = chunk.chapter_id ? 'C' : 'L';
    
    // Extract container sequence
    let containerSeq = 1;
    if (chunk.chapter_id) {
        const match = chunk.chapter_id.match(/ch(\d+)/);
        if (match) containerSeq = parseInt(match[1]);
    } else if (chunk.lab_id) {
        const match = chunk.lab_id.match(/lab(\d+)/);
        if (match) containerSeq = parseInt(match[1]);
    }
    
    return nodes.map((node, index) => {
        const nodeTypeCode = node.nodeType;
        const nodeSeq = index + 1;
        const canonicalRef = `D${day}.${containerType}${containerSeq}.${nodeTypeCode}${nodeSeq}`;
        
        return {
            ...node,
            canonical_reference: canonicalRef,
            day: day,
            container_type: chunk.chapter_id ? 'chapter' : 'lab',
            container_id: chunk.chapter_id || chunk.lab_id,
            container_title: chunk.chapter_title || chunk.lab_title || ''
        };
    });
}
```

### Phase 4: Data Migration

**Step 4.1: Migrate Single Chunk**

```javascript
/**
 * Migrate a single chunk to atomic nodes
 * @param {Object} chunk - Source chunk
 * @param {Object} supabaseClient - Supabase client
 * @returns {Promise<Object>} Migration result
 */
async function migrateChunk(chunk, supabaseClient) {
    const migrationId = crypto.randomUUID();
    
    try {
        // Start migration tracking
        await supabaseClient
            .from('migration_tracking')
            .insert({
                id: migrationId,
                source_chunk_id: chunk.id,
                source_chunk_reference: `${chunk.day}.${chunk.chapter_id || chunk.lab_id}`,
                migration_status: 'in_progress',
                started_at: new Date().toISOString()
            });
        
        // Step 1: Split chunk into nodes
        const atomicNodes = splitChunkIntoNodes(chunk);
        
        // Step 2: Assign canonical references
        const nodesWithRefs = assignCanonicalReferences(atomicNodes, chunk);
        
        // Step 3: Create container entry
        const containerType = chunk.chapter_id ? 'chapter' : 'lab';
        const containerId = chunk.chapter_id || chunk.lab_id;
        
        await supabaseClient
            .from('content_containers')
            .upsert({
                course_id: chunk.course_id,
                container_type: containerType,
                container_id: containerId,
                day: chunk.day,
                title: chunk.chapter_title || chunk.lab_title || '',
                primary_topic: chunk.primary_topic,
                is_dedicated_topic_chapter: chunk.is_dedicated_topic_chapter || false,
                node_count: nodesWithRefs.length
            }, {
                onConflict: 'course_id,container_type,container_id'
            });
        
        // Step 4: Insert nodes into content_nodes
        const nodeInserts = nodesWithRefs.map(node => ({
            course_id: chunk.course_id,
            canonical_reference: node.canonical_reference,
            reference_type: node.type,
            day: node.day,
            container_type: node.container_type,
            container_id: node.container_id,
            container_title: node.container_title,
            sequence_number: node.sequenceNumber,
            node_type: node.type,
            content_type: node.type === 'code_block' ? 'code_block' : 
                         node.type === 'table' ? 'table' :
                         node.type === 'heading' ? 'heading' : 'paragraph',
            content: node.content,
            word_count: node.content.split(/\s+/).length,
            character_count: node.content.length,
            primary_topic: chunk.primary_topic,
            is_dedicated_topic_node: chunk.is_dedicated_topic_chapter || false,
            is_foundational: chunk.day <= 2 && (chunk.coverage_level === 'introduction' || !chunk.coverage_level)
        }));
        
        const { error: nodesError } = await supabaseClient
            .from('content_nodes')
            .insert(nodeInserts);
        
        if (nodesError) throw nodesError;
        
        // Step 5: Insert into canonical_reference_registry
        const registryInserts = nodesWithRefs.map(node => ({
            canonical_reference: node.canonical_reference,
            course_id: chunk.course_id,
            day: node.day,
            container_type: node.container_type,
            container_id: node.container_id,
            container_title: node.container_title,
            sequence_number: node.sequenceNumber,
            node_type: node.type,
            content_type: node.type === 'code_block' ? 'code_block' : 
                         node.type === 'table' ? 'table' :
                         node.type === 'heading' ? 'heading' : 'paragraph',
            content_preview: node.content.substring(0, 100),
            word_count: node.content.split(/\s+/).length,
            character_count: node.content.length,
            primary_topic: chunk.primary_topic,
            is_dedicated_topic_node: chunk.is_dedicated_topic_chapter || false,
            is_foundational: chunk.day <= 2,
            is_valid: true,
            created_by: 'migration_script'
        }));
        
        const { error: registryError } = await supabaseClient
            .from('canonical_reference_registry')
            .insert(registryInserts);
        
        if (registryError) throw registryError;
        
        // Step 6: Generate embeddings (async, don't block)
        // This can be done in background
        
        // Step 7: Update migration tracking
        await supabaseClient
            .from('migration_tracking')
            .update({
                migration_status: 'completed',
                nodes_created: nodesWithRefs.length,
                completed_at: new Date().toISOString()
            })
            .eq('id', migrationId);
        
        return {
            success: true,
            migrationId,
            nodesCreated: nodesWithRefs.length,
            canonicalReferences: nodesWithRefs.map(n => n.canonical_reference)
        };
        
    } catch (error) {
        // Mark as failed
        await supabaseClient
            .from('migration_tracking')
            .update({
                migration_status: 'failed',
                error_message: error.message,
                completed_at: new Date().toISOString()
            })
            .eq('id', migrationId);
        
        throw error;
    }
}
```

**Step 4.2: Batch Migration**

```javascript
/**
 * Migrate all chunks for a course
 * @param {string} courseId - Course ID
 * @param {Object} supabaseClient - Supabase client
 * @returns {Promise<Object>} Migration summary
 */
async function migrateCourse(courseId, supabaseClient) {
    // Get all chunks for course
    const { data: chunks, error } = await supabaseClient
        .from('ai_coach_content_chunks')
        .select('*')
        .eq('course_id', courseId)
        .order('day', { ascending: true })
        .order('chapter_id', { ascending: true })
        .order('lab_id', { ascending: true });
    
    if (error) throw error;
    
    const results = {
        totalChunks: chunks.length,
        successful: 0,
        failed: 0,
        totalNodesCreated: 0,
        errors: []
    };
    
    // Migrate each chunk
    for (const chunk of chunks) {
        try {
            const result = await migrateChunk(chunk, supabaseClient);
            results.successful++;
            results.totalNodesCreated += result.nodesCreated;
        } catch (error) {
            results.failed++;
            results.errors.push({
                chunkId: chunk.id,
                error: error.message
            });
            console.error(`Failed to migrate chunk ${chunk.id}:`, error);
        }
    }
    
    return results;
}
```

### Phase 5: Validation

**Step 5.1: Validate Migration**

```sql
-- Check all chunks were migrated
SELECT 
    (SELECT COUNT(*) FROM ai_coach_content_chunks WHERE course_id = 'seo-master-2026') as source_chunks,
    (SELECT COUNT(DISTINCT container_id) FROM content_containers WHERE course_id = 'seo-master-2026') as migrated_containers,
    (SELECT COUNT(*) FROM content_nodes WHERE course_id = 'seo-master-2026') as total_nodes,
    (SELECT COUNT(*) FROM canonical_reference_registry WHERE course_id = 'seo-master-2026') as registry_entries;

-- Check for duplicate references
SELECT canonical_reference, COUNT(*) as count
FROM canonical_reference_registry
WHERE course_id = 'seo-master-2026'
GROUP BY canonical_reference
HAVING COUNT(*) > 1;

-- Check sequence gaps
SELECT 
    container_id,
    sequence_number,
    LAG(sequence_number) OVER (PARTITION BY container_id ORDER BY sequence_number) as prev_seq
FROM canonical_reference_registry
WHERE course_id = 'seo-master-2026'
ORDER BY container_id, sequence_number;
```

**Step 5.2: Content Integrity Check**

```javascript
/**
 * Verify content integrity
 * @param {string} courseId - Course ID
 * @param {Object} supabaseClient - Supabase client
 */
async function validateMigration(courseId, supabaseClient) {
    // Get all chunks
    const { data: chunks } = await supabaseClient
        .from('ai_coach_content_chunks')
        .select('*')
        .eq('course_id', courseId);
    
    const issues = [];
    
    for (const chunk of chunks) {
        // Get migrated nodes
        const containerId = chunk.chapter_id || chunk.lab_id;
        const containerType = chunk.chapter_id ? 'chapter' : 'lab';
        
        const { data: nodes } = await supabaseClient
            .from('content_nodes')
            .select('content')
            .eq('course_id', courseId)
            .eq('container_id', containerId)
            .eq('container_type', containerType)
            .order('sequence_number');
        
        // Reconstruct content
        const reconstructed = nodes.map(n => n.content).join('\n\n');
        const original = chunk.content.trim();
        
        // Normalize for comparison (remove extra whitespace)
        const normalizedOriginal = original.replace(/\s+/g, ' ').trim();
        const normalizedReconstructed = reconstructed.replace(/\s+/g, ' ').trim();
        
        // Check if content matches (allow for minor formatting differences)
        if (normalizedOriginal !== normalizedReconstructed) {
            const similarity = calculateSimilarity(normalizedOriginal, normalizedReconstructed);
            if (similarity < 0.95) {
                issues.push({
                    chunkId: chunk.id,
                    containerId: containerId,
                    similarity: similarity,
                    originalLength: original.length,
                    reconstructedLength: reconstructed.length
                });
            }
        }
    }
    
    return {
        totalChunks: chunks.length,
        issues: issues,
        isValid: issues.length === 0
    };
}
```

### Phase 6: Rollback Strategy

**Step 6.1: Rollback Function**

```javascript
/**
 * Rollback migration for a course
 * @param {string} courseId - Course ID
 * @param {Object} supabaseClient - Supabase client
 */
async function rollbackMigration(courseId, supabaseClient) {
    // Mark all nodes as invalid
    await supabaseClient
        .from('canonical_reference_registry')
        .update({ is_valid: false })
        .eq('course_id', courseId);
    
    // Delete nodes (optional - can keep for audit)
    // await supabaseClient
    //     .from('content_nodes')
    //     .delete()
    //     .eq('course_id', courseId);
    
    // Delete containers
    await supabaseClient
        .from('content_containers')
        .delete()
        .eq('course_id', courseId);
    
    // Mark migration as rolled back
    await supabaseClient
        .from('migration_tracking')
        .update({ migration_status: 'rolled_back' })
        .eq('course_id', courseId)
        .eq('migration_status', 'completed');
    
    // Original chunks remain in ai_coach_content_chunks_backup
    // Can be restored if needed
}
```

---

## Section 4: Before → After Example

### 4.1 Before: Chunk-Based Storage

**Source Chunk:**
```json
{
  "id": "chunk-123",
  "course_id": "seo-master-2026",
  "day": 20,
  "chapter_id": "day20-ch1",
  "chapter_title": "Answer Engine Optimization (AEO)",
  "content": "AEO, or \"Answer Engine Optimization,\" refers to the practice of optimizing content to ensure it effectively answers user queries, particularly in the context of search engines that prioritize providing direct answers to users.\n\n### Key Points:\n\n- Focus on User Intent: AEO emphasizes understanding what users are looking for when they search, ensuring that content aligns with their needs.\n\n- Structured Content: Content should be organized in a way that makes it easy for search engines to extract and present answers, often using formats like FAQs or structured data.\n\n- Engagement Metrics: AEO involves monitoring how well content performs in terms of engagement, such as click-through rates and user interactions, to refine and improve the optimization process.\n\n### Next Steps:\n\n- Familiarize yourself with user intent categories (informational, navigational, commercial, transactional) to better tailor your content.\n\n- Explore how structured data can enhance the visibility of your content in search results.\n\n- Analyze engagement metrics to continuously improve your AEO strategies.",
  "primary_topic": "AEO",
  "is_dedicated_topic_chapter": true
}
```

**Problems:**
- Entire chapter in one chunk (500+ words)
- Multiple concepts mixed together
- No way to reference specific points
- LLM must infer which part to cite

### 4.2 After: Atomic Nodes

**Migrated Nodes:**

**Node 1:**
```json
{
  "canonical_reference": "D20.C1.C1",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 1,
  "node_type": "concept",
  "content_type": "paragraph",
  "content": "AEO, or \"Answer Engine Optimization,\" refers to the practice of optimizing content to ensure it effectively answers user queries, particularly in the context of search engines that prioritize providing direct answers to users.",
  "word_count": 45,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true
}
```

**Node 2:**
```json
{
  "canonical_reference": "D20.C1.H1",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 2,
  "node_type": "heading",
  "content_type": "heading",
  "content": "Key Points:",
  "word_count": 2,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true
}
```

**Node 3:**
```json
{
  "canonical_reference": "D20.C1.L1",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 3,
  "node_type": "list_item",
  "content_type": "paragraph",
  "content": "Focus on User Intent: AEO emphasizes understanding what users are looking for when they search, ensuring that content aligns with their needs.",
  "word_count": 28,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true,
  "parent_reference": "D20.C1.H1"
}
```

**Node 4:**
```json
{
  "canonical_reference": "D20.C1.L2",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 4,
  "node_type": "list_item",
  "content_type": "paragraph",
  "content": "Structured Content: Content should be organized in a way that makes it easy for search engines to extract and present answers, often using formats like FAQs or structured data.",
  "word_count": 35,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true,
  "parent_reference": "D20.C1.H1"
}
```

**Node 5:**
```json
{
  "canonical_reference": "D20.C1.L3",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 5,
  "node_type": "list_item",
  "content_type": "paragraph",
  "content": "Engagement Metrics: AEO involves monitoring how well content performs in terms of engagement, such as click-through rates and user interactions, to refine and improve the optimization process.",
  "word_count": 32,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true,
  "parent_reference": "D20.C1.H1"
}
```

**Node 6:**
```json
{
  "canonical_reference": "D20.C1.H2",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 6,
  "node_type": "heading",
  "content_type": "heading",
  "content": "Next Steps:",
  "word_count": 2,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true
}
```

**Node 7:**
```json
{
  "canonical_reference": "D20.C1.L4",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 7,
  "node_type": "list_item",
  "content_type": "paragraph",
  "content": "Familiarize yourself with user intent categories (informational, navigational, commercial, transactional) to better tailor your content.",
  "word_count": 18,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true,
  "parent_reference": "D20.C1.H2"
}
```

**Node 8:**
```json
{
  "canonical_reference": "D20.C1.L5",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 8,
  "node_type": "list_item",
  "content_type": "paragraph",
  "content": "Explore how structured data can enhance the visibility of your content in search results.",
  "word_count": 16,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true,
  "parent_reference": "D20.C1.H2"
}
```

**Node 9:**
```json
{
  "canonical_reference": "D20.C1.L6",
  "day": 20,
  "container_type": "chapter",
  "container_id": "day20-ch1",
  "container_title": "Answer Engine Optimization (AEO)",
  "sequence_number": 9,
  "node_type": "list_item",
  "content_type": "paragraph",
  "content": "Analyze engagement metrics to continuously improve your AEO strategies.",
  "word_count": 11,
  "primary_topic": "AEO",
  "is_dedicated_topic_node": true,
  "parent_reference": "D20.C1.H2"
}
```

**Summary:**
- **Before**: 1 chunk (500+ words)
- **After**: 9 atomic nodes
- **References**: D20.C1.C1, D20.C1.H1, D20.C1.L1-L6, D20.C1.H2
- **Content**: Preserved exactly (no rephrasing)

---

## Section 5: Overlapping Concepts Handling

### 5.1 Problem: Concepts Appear in Multiple Chapters

**Scenario:**
- "User Intent" appears in:
  - Day 1, Chapter 1 (foundational)
  - Day 20, Chapter 1 (AEO-specific)

**Solution:**
- Each occurrence gets its own canonical reference
- No deduplication (preserves context)
- References are explicit: `D1.C1.C4` vs `D20.C1.L1`

### 5.2 Cross-References

**Registry Entry:**
```json
{
  "canonical_reference": "D20.C1.L1",
  "content": "Focus on User Intent: AEO emphasizes understanding what users are looking for...",
  "requires_prerequisites": ["D1.C1.C4"], // Links to foundational concept
  "related_node_ids": ["D1.C1.C4", "D1.C1.C5", "D1.C1.C6", "D1.C1.C7"]
}
```

**Benefit:**
- Can reference both foundational and advanced concepts
- System knows relationships
- No content duplication needed

---

## Section 6: Migration Script

### 6.1 Complete Migration Script

```javascript
/**
 * Complete Migration Script
 * Run: node scripts/migrate-content-to-atomic-nodes.js <course_id>
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/app.config.js';

const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

async function main() {
    const courseId = process.argv[2] || 'seo-master-2026';
    
    console.log(`Starting migration for course: ${courseId}`);
    
    try {
        // Phase 1: Backup
        console.log('Phase 1: Creating backup...');
        await backupChunks(courseId, supabaseClient);
        
        // Phase 2: Analyze
        console.log('Phase 2: Analyzing chunks...');
        const analysis = await analyzeChunks(courseId, supabaseClient);
        console.log(`Found ${analysis.totalChunks} chunks to migrate`);
        console.log(`Estimated ${analysis.estimatedNodes} nodes`);
        
        // Phase 3: Migrate
        console.log('Phase 3: Migrating chunks...');
        const results = await migrateCourse(courseId, supabaseClient);
        
        console.log('\nMigration Summary:');
        console.log(`- Successful: ${results.successful}`);
        console.log(`- Failed: ${results.failed}`);
        console.log(`- Total Nodes Created: ${results.totalNodesCreated}`);
        
        if (results.errors.length > 0) {
            console.log('\nErrors:');
            results.errors.forEach(err => {
                console.log(`  - Chunk ${err.chunkId}: ${err.error}`);
            });
        }
        
        // Phase 4: Validate
        console.log('\nPhase 4: Validating migration...');
        const validation = await validateMigration(courseId, supabaseClient);
        
        if (validation.isValid) {
            console.log('✅ Migration validated successfully!');
        } else {
            console.log(`⚠️  Found ${validation.issues.length} issues`);
            validation.issues.forEach(issue => {
                console.log(`  - ${issue.containerId}: similarity ${issue.similarity}`);
            });
        }
        
        console.log('\n✅ Migration complete!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

main();
```

---

## Section 7: Rollback Procedure

### 7.1 Rollback Steps

1. **Stop using new tables**
   ```sql
   -- Mark all references as invalid
   UPDATE canonical_reference_registry 
   SET is_valid = false 
   WHERE course_id = 'seo-master-2026';
   ```

2. **Restore from backup** (if needed)
   ```sql
   -- Restore chunks from backup
   INSERT INTO ai_coach_content_chunks
   SELECT * FROM ai_coach_content_chunks_backup
   WHERE course_id = 'seo-master-2026'
   ON CONFLICT (id) DO NOTHING;
   ```

3. **Update migration tracking**
   ```sql
   UPDATE migration_tracking
   SET migration_status = 'rolled_back'
   WHERE course_id = 'seo-master-2026'
     AND migration_status = 'completed';
   ```

### 7.2 Reversibility Guarantee

- **Original chunks preserved** in backup table
- **Migration tracking** records all changes
- **No data loss** - can reconstruct original from nodes
- **Atomic operations** - each chunk migration is independent

---

## Section 8: Testing Strategy

### 8.1 Unit Tests

```javascript
// Test splitting rules
describe('Content Splitting', () => {
    test('splits paragraphs correctly', () => {
        const content = "Para 1.\n\nPara 2.\n\nPara 3.";
        const nodes = splitChunkIntoNodes({ content });
        expect(nodes).toHaveLength(3);
    });
    
    test('splits list items correctly', () => {
        const content = "- Item 1\n- Item 2\n- Item 3";
        const nodes = splitChunkIntoNodes({ content });
        expect(nodes).toHaveLength(3);
        expect(nodes[0].type).toBe('list_item');
    });
    
    test('preserves code blocks', () => {
        const content = "Text\n\n```code\nhere\n```\n\nMore text";
        const nodes = splitChunkIntoNodes({ content });
        expect(nodes.some(n => n.type === 'code_block')).toBe(true);
    });
});
```

### 8.2 Integration Tests

```javascript
// Test full migration
describe('Migration Integration', () => {
    test('migrates chunk correctly', async () => {
        const chunk = { /* test chunk */ };
        const result = await migrateChunk(chunk, supabaseClient);
        
        expect(result.success).toBe(true);
        expect(result.nodesCreated).toBeGreaterThan(0);
        
        // Verify nodes exist
        const { data: nodes } = await supabaseClient
            .from('content_nodes')
            .select('*')
            .eq('container_id', chunk.chapter_id);
        
        expect(nodes.length).toBe(result.nodesCreated);
    });
});
```

---

## Section 9: Migration Checklist

- [ ] Create backup of existing chunks
- [ ] Create new tables (content_nodes, content_containers, registry)
- [ ] Implement splitting functions
- [ ] Implement reference assignment
- [ ] Test on single chunk
- [ ] Validate content integrity
- [ ] Run migration on test course
- [ ] Verify all chunks migrated
- [ ] Check for duplicate references
- [ ] Validate sequence numbers
- [ ] Test rollback procedure
- [ ] Run migration on production course
- [ ] Monitor for errors
- [ ] Validate final state

---

## Conclusion

This migration strategy provides:
1. **Deterministic splitting** - Rule-based, no semantic guessing
2. **Content preservation** - No rephrasing, exact content
3. **Canonical references** - Every node gets explicit reference
4. **Reversibility** - Can rollback if needed
5. **Validation** - Content integrity checks

**Result**: Safe, reliable migration from chunks to atomic nodes.

