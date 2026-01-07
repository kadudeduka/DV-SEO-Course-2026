# Reference Resolution Engine

## Executive Summary

The Reference Resolution Engine is a **deterministic, rule-based system** that extracts and resolves explicit course references from user questions **before** the LLM processes them. It uses pattern matching and database lookups only—no LLM, no guessing, no inference.

---

## Section 1: Architecture Overview

### 1.1 Position in Pipeline

```
User Question
    ↓
[Reference Resolution Engine] ← Runs FIRST, before LLM
    ↓
Resolved Node IDs (or empty)
    ↓
[Retrieval Service] ← Uses resolved nodes if available
    ↓
[LLM] ← Never sees reference resolution logic
```

### 1.2 Core Principle

**Rule:** If a user explicitly mentions a reference (e.g., "Day 1, Chapter 1, Step 3"), resolve it deterministically. If no explicit reference is found, return empty result and let semantic search handle it.

---

## Section 2: Input/Output Specification

### 2.1 Input

```typescript
interface ResolutionInput {
    question: string;           // User's question
    courseId: string;           // Course context
    userId?: string;            // Optional: for progress-based hints
}
```

**Example Input:**
```json
{
  "question": "I'm stuck on Step 3 of Lab 1 on Day 20",
  "courseId": "seo-master-2026",
  "userId": "user-123"
}
```

### 2.2 Output

```typescript
interface ResolutionOutput {
    resolved_nodes: string[];   // Canonical references: ["D20.L1.S3"]
    resolution_type: 'exact' | 'partial' | 'none';
    confidence: number;          // 1.0 for exact, < 1.0 for partial
    matched_patterns: string[]; // Which patterns matched
    warnings?: string[];        // Any issues
}
```

**Example Output:**
```json
{
  "resolved_nodes": ["D20.L1.S3"],
  "resolution_type": "exact",
  "confidence": 1.0,
  "matched_patterns": ["lab_step_reference"],
  "warnings": []
}
```

---

## Section 3: Reference Patterns

### 3.1 Pattern Categories

#### Category 1: Explicit Day + Chapter + Step
**Patterns:**
- `Day {day} → Chapter {chapter} → Step {step}`
- `Day {day}, Chapter {chapter}, Step {step}`
- `Day {day} Chapter {chapter} Step {step}`
- `D{day} C{chapter} S{step}`
- `Day {day} → Chapter {chapter} → Concept {concept}`
- `Day {day} → Chapter {chapter} → Example {example}`

**Examples:**
- "Day 1 → Chapter 1 → Step 3"
- "Day 20, Chapter 1, Step 5"
- "D1 C1 S3"
- "Day 1 Chapter 1 Concept 2"

#### Category 2: Explicit Day + Lab + Step
**Patterns:**
- `Day {day} → Lab {lab} → Step {step}`
- `Day {day}, Lab {lab}, Step {step}`
- `Day {day} Lab {lab} Step {step}`
- `D{day} L{lab} S{step}`
- `Lab {lab} of Day {day}, Step {step}`
- `Step {step} of Lab {lab} on Day {day}`

**Examples:**
- "Day 1 → Lab 1 → Step 2"
- "Lab 1 of Day 20, Step 3"
- "Step 3 of Lab 1 on Day 20"
- "D20 L1 S3"

#### Category 3: Relative References (with context)
**Patterns:**
- `Step {step} of Lab {lab} on Day {day}`
- `Chapter {chapter} of Day {day}, Step {step}`
- `Lab {lab}, Day {day}, Step {step}`

**Examples:**
- "Step 3 of Lab 1 on Day 20"
- "Chapter 1 of Day 1, Step 5"

#### Category 4: Canonical Format Direct
**Patterns:**
- `D{day}.C{chapter}.{type}{seq}` (e.g., `D1.C1.S3`)
- `D{day}.L{lab}.{type}{seq}` (e.g., `D20.L1.S2`)

**Examples:**
- "D1.C1.S3"
- "D20.L1.S2"
- "D1.C1.C2"

#### Category 5: Chapter/Lab Only (Partial)
**Patterns:**
- `Day {day} → Chapter {chapter}`
- `Day {day}, Chapter {chapter}`
- `Chapter {chapter} of Day {day}`
- `Day {day} → Lab {lab}`
- `Lab {lab} of Day {day}`

**Examples:**
- "Day 1 → Chapter 1"
- "Chapter 1 of Day 1"
- "Lab 1 of Day 20"

**Note:** Partial matches return all nodes in that chapter/lab.

---

## Section 4: Resolution Flow

### 4.1 Step-by-Step Flow

```
1. Normalize Input
   ↓
2. Extract Patterns (regex-based)
   ↓
3. Parse Components (day, container, sequence)
   ↓
4. Validate Components (range checks)
   ↓
5. Lookup in Registry
   ↓
6. Return Resolved Nodes
```

### 4.2 Detailed Steps

#### Step 1: Normalize Input
- Convert to lowercase (for pattern matching)
- Remove extra whitespace
- Preserve original for display

#### Step 2: Extract Patterns
- Try each pattern category in order
- First match wins (most specific first)
- Collect all matches (user might mention multiple references)

#### Step 3: Parse Components
- Extract day number
- Extract container type (chapter/lab) and number
- Extract node type (step/concept/example) and sequence
- Validate numeric ranges

#### Step 4: Validate Components
- Day: 1-365 (reasonable range)
- Chapter/Lab: 1-100 (reasonable range)
- Step/Concept: 1-1000 (reasonable range)

#### Step 5: Lookup in Registry
- Query `canonical_reference_registry`
- Filter by course_id, day, container_type, container_id, sequence_number
- Return exact matches only

#### Step 6: Return Result
- If matches found: return resolved nodes
- If partial match: return all nodes in container
- If no match: return empty array

---

## Section 5: Implementation (Pseudocode)

### 5.1 Main Resolution Function

```javascript
/**
 * Resolve explicit references from user question
 * @param {string} question - User's question
 * @param {string} courseId - Course ID
 * @returns {Promise<ResolutionOutput>} Resolved nodes
 */
async function resolveReferences(question, courseId) {
    // Step 1: Normalize
    const normalized = normalizeQuestion(question);
    
    // Step 2: Extract patterns
    const patterns = extractReferencePatterns(normalized);
    
    if (patterns.length === 0) {
        return {
            resolved_nodes: [],
            resolution_type: 'none',
            confidence: 0.0,
            matched_patterns: [],
            warnings: ['No explicit references found']
        };
    }
    
    // Step 3: Parse components
    const parsedRefs = patterns.map(pattern => parsePattern(pattern));
    
    // Step 4: Validate
    const validRefs = parsedRefs.filter(ref => validateReference(ref));
    
    if (validRefs.length === 0) {
        return {
            resolved_nodes: [],
            resolution_type: 'none',
            confidence: 0.0,
            matched_patterns: patterns.map(p => p.type),
            warnings: ['No valid references found after validation']
        };
    }
    
    // Step 5: Lookup in registry
    const resolvedNodes = await lookupReferences(validRefs, courseId);
    
    // Step 6: Return result
    return {
        resolved_nodes: resolvedNodes,
        resolution_type: resolvedNodes.length > 0 ? 'exact' : 'none',
        confidence: resolvedNodes.length > 0 ? 1.0 : 0.0,
        matched_patterns: patterns.map(p => p.type),
        warnings: resolvedNodes.length < validRefs.length 
            ? [`Only ${resolvedNodes.length} of ${validRefs.length} references resolved`]
            : []
    };
}
```

### 5.2 Pattern Extraction

```javascript
/**
 * Extract reference patterns from question
 * @param {string} normalized - Normalized question
 * @returns {Array<Object>} Matched patterns
 */
function extractReferencePatterns(normalized) {
    const patterns = [];
    
    // Pattern 1: Canonical format (D1.C1.S3)
    const canonicalPattern = /D(\d+)\.(C|L)(\d+)\.([SCEDPLHTB])(\d+)/gi;
    let match;
    while ((match = canonicalPattern.exec(normalized)) !== null) {
        patterns.push({
            type: 'canonical_format',
            day: parseInt(match[1]),
            containerType: match[2] === 'C' ? 'chapter' : 'lab',
            containerSeq: parseInt(match[3]),
            nodeType: match[4],
            nodeSeq: parseInt(match[5]),
            fullMatch: match[0]
        });
    }
    
    // Pattern 2: Day → Chapter → Step
    const chapterStepPattern = /day\s+(\d+)\s*[→,]\s*chapter\s+(\d+)\s*[→,]\s*(?:step|concept|example)\s+(\d+)/gi;
    while ((match = chapterStepPattern.exec(normalized)) !== null) {
        patterns.push({
            type: 'chapter_step_reference',
            day: parseInt(match[1]),
            containerType: 'chapter',
            containerSeq: parseInt(match[2]),
            nodeSeq: parseInt(match[3]),
            fullMatch: match[0]
        });
    }
    
    // Pattern 3: Day → Lab → Step
    const labStepPattern = /day\s+(\d+)\s*[→,]\s*lab\s+(\d+)\s*[→,]\s*step\s+(\d+)/gi;
    while ((match = labStepPattern.exec(normalized)) !== null) {
        patterns.push({
            type: 'lab_step_reference',
            day: parseInt(match[1]),
            containerType: 'lab',
            containerSeq: parseInt(match[2]),
            nodeSeq: parseInt(match[3]),
            fullMatch: match[0]
        });
    }
    
    // Pattern 4: Step of Lab on Day
    const stepOfLabPattern = /step\s+(\d+)\s+of\s+lab\s+(\d+)\s+on\s+day\s+(\d+)/gi;
    while ((match = stepOfLabPattern.exec(normalized)) !== null) {
        patterns.push({
            type: 'step_of_lab',
            day: parseInt(match[3]),
            containerType: 'lab',
            containerSeq: parseInt(match[2]),
            nodeSeq: parseInt(match[1]),
            fullMatch: match[0]
        });
    }
    
    // Pattern 5: Lab of Day, Step
    const labOfDayPattern = /lab\s+(\d+)\s+of\s+day\s+(\d+)[,\s]+step\s+(\d+)/gi;
    while ((match = labOfDayPattern.exec(normalized)) !== null) {
        patterns.push({
            type: 'lab_of_day_step',
            day: parseInt(match[2]),
            containerType: 'lab',
            containerSeq: parseInt(match[1]),
            nodeSeq: parseInt(match[3]),
            fullMatch: match[0]
        });
    }
    
    // Pattern 6: Day Chapter (partial)
    const dayChapterPattern = /day\s+(\d+)\s*[→,]\s*chapter\s+(\d+)(?!\s*[→,])/gi;
    while ((match = dayChapterPattern.exec(normalized)) !== null) {
        patterns.push({
            type: 'chapter_partial',
            day: parseInt(match[1]),
            containerType: 'chapter',
            containerSeq: parseInt(match[2]),
            fullMatch: match[0]
        });
    }
    
    // Pattern 7: Day Lab (partial)
    const dayLabPattern = /day\s+(\d+)\s*[→,]\s*lab\s+(\d+)(?!\s*[→,])/gi;
    while ((match = dayLabPattern.exec(normalized)) !== null) {
        patterns.push({
            type: 'lab_partial',
            day: parseInt(match[1]),
            containerType: 'lab',
            containerSeq: parseInt(match[2]),
            fullMatch: match[0]
        });
    }
    
    return patterns;
}
```

### 5.3 Pattern Parsing

```javascript
/**
 * Parse pattern into reference components
 * @param {Object} pattern - Matched pattern
 * @returns {Object} Parsed reference
 */
function parsePattern(pattern) {
    // For canonical format, already parsed
    if (pattern.type === 'canonical_format') {
        return {
            day: pattern.day,
            containerType: pattern.containerType,
            containerSeq: pattern.containerSeq,
            nodeType: pattern.nodeType,
            nodeSeq: pattern.nodeSeq,
            isPartial: false
        };
    }
    
    // For step references, default to 'step' type
    if (pattern.nodeSeq !== undefined) {
        return {
            day: pattern.day,
            containerType: pattern.containerType,
            containerSeq: pattern.containerSeq,
            nodeType: 'step', // Default for step references
            nodeSeq: pattern.nodeSeq,
            isPartial: false
        };
    }
    
    // For partial references (chapter/lab only)
    return {
        day: pattern.day,
        containerType: pattern.containerType,
        containerSeq: pattern.containerSeq,
        nodeType: null,
        nodeSeq: null,
        isPartial: true
    };
}
```

### 5.4 Validation

```javascript
/**
 * Validate reference components
 * @param {Object} ref - Parsed reference
 * @returns {boolean} True if valid
 */
function validateReference(ref) {
    // Day range: 1-365
    if (ref.day < 1 || ref.day > 365) {
        return false;
    }
    
    // Container sequence: 1-100
    if (ref.containerSeq < 1 || ref.containerSeq > 100) {
        return false;
    }
    
    // Node sequence: 1-1000 (if not partial)
    if (!ref.isPartial && (ref.nodeSeq < 1 || ref.nodeSeq > 1000)) {
        return false;
    }
    
    // Container type must be 'chapter' or 'lab'
    if (ref.containerType !== 'chapter' && ref.containerType !== 'lab') {
        return false;
    }
    
    return true;
}
```

### 5.5 Registry Lookup

```javascript
/**
 * Lookup references in canonical_reference_registry
 * @param {Array<Object>} refs - Parsed references
 * @param {string} courseId - Course ID
 * @returns {Promise<Array<string>>} Resolved canonical references
 */
async function lookupReferences(refs, courseId) {
    const resolvedNodes = [];
    
    for (const ref of refs) {
        if (ref.isPartial) {
            // Partial match: get all nodes in container
            const containerId = `day${ref.day}-${ref.containerType === 'chapter' ? 'ch' : 'lab'}${ref.containerSeq}`;
            
            const { data, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('canonical_reference')
                .eq('course_id', courseId)
                .eq('day', ref.day)
                .eq('container_type', ref.containerType)
                .eq('container_id', containerId)
                .eq('is_valid', true)
                .order('sequence_number', { ascending: true });
            
            if (!error && data) {
                resolvedNodes.push(...data.map(r => r.canonical_reference));
            }
        } else {
            // Exact match: lookup specific node
            const containerId = `day${ref.day}-${ref.containerType === 'chapter' ? 'ch' : 'lab'}${ref.containerSeq}`;
            const nodeTypeCode = ref.nodeType.toUpperCase();
            
            // Build expected canonical reference
            const expectedRef = `D${ref.day}.${ref.containerType === 'chapter' ? 'C' : 'L'}${ref.containerSeq}.${nodeTypeCode}${ref.nodeSeq}`;
            
            // Verify it exists
            const { data, error } = await supabaseClient
                .from('canonical_reference_registry')
                .select('canonical_reference')
                .eq('canonical_reference', expectedRef)
                .eq('course_id', courseId)
                .eq('is_valid', true)
                .single();
            
            if (!error && data) {
                resolvedNodes.push(data.canonical_reference);
            }
        }
    }
    
    // Remove duplicates
    return [...new Set(resolvedNodes)];
}
```

---

## Section 6: SQL-Based Alternative

### 6.1 Pattern Matching in SQL

```sql
-- Function to extract day from question
CREATE OR REPLACE FUNCTION extract_day_from_question(
    p_question TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_day INTEGER;
BEGIN
    -- Try canonical format: D1.C1.S3
    SELECT regexp_replace(p_question, '.*D(\d+)\..*', '\1')::INTEGER INTO v_day
    WHERE p_question ~ 'D\d+\.';
    
    IF v_day IS NOT NULL THEN
        RETURN v_day;
    END IF;
    
    -- Try "Day X"
    SELECT regexp_replace(p_question, '.*day\s+(\d+).*', '\1', 'gi')::INTEGER INTO v_day
    WHERE p_question ~* 'day\s+\d+';
    
    RETURN v_day;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve references
CREATE OR REPLACE FUNCTION resolve_references_from_question(
    p_question TEXT,
    p_course_id TEXT
) RETURNS TABLE (
    canonical_reference TEXT,
    resolution_type TEXT,
    confidence NUMERIC
) AS $$
DECLARE
    v_day INTEGER;
    v_container_type VARCHAR(20);
    v_container_seq INTEGER;
    v_node_seq INTEGER;
    v_canonical_ref TEXT;
BEGIN
    -- Extract day
    v_day := extract_day_from_question(p_question);
    
    IF v_day IS NULL THEN
        RETURN; -- No day found, return empty
    END IF;
    
    -- Try canonical format: D1.C1.S3
    IF p_question ~ 'D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+' THEN
        SELECT 
            regexp_replace(p_question, '.*D(\d+)\.(C|L)(\d+)\.([SCEDPLHTB])(\d+).*', '\1')::INTEGER,
            CASE regexp_replace(p_question, '.*D\d+\.(C|L)\d+\..*', '\1')
                WHEN 'C' THEN 'chapter'
                WHEN 'L' THEN 'lab'
            END,
            regexp_replace(p_question, '.*D\d+\.(C|L)(\d+)\..*', '\2')::INTEGER,
            regexp_replace(p_question, '.*D\d+\.(C|L)\d+\.([SCEDPLHTB])(\d+).*', '\3')::INTEGER
        INTO v_day, v_container_type, v_container_seq, v_node_seq;
        
        v_canonical_ref := format('D%s.%s%s.%s%s',
            v_day,
            CASE v_container_type WHEN 'chapter' THEN 'C' ELSE 'L' END,
            v_container_seq,
            regexp_replace(p_question, '.*D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+.*', '\2'),
            v_node_seq
        );
        
        -- Verify exists
        RETURN QUERY
        SELECT 
            r.canonical_reference,
            'exact'::TEXT,
            1.0::NUMERIC
        FROM canonical_reference_registry r
        WHERE r.canonical_reference = v_canonical_ref
          AND r.course_id = p_course_id
          AND r.is_valid = true;
        
        RETURN;
    END IF;
    
    -- Try "Step X of Lab Y on Day Z"
    IF p_question ~* 'step\s+\d+\s+of\s+lab\s+\d+\s+on\s+day\s+\d+' THEN
        SELECT 
            regexp_replace(p_question, '.*step\s+(\d+)\s+of\s+lab\s+(\d+)\s+on\s+day\s+(\d+).*', '\3', 'gi')::INTEGER,
            'lab',
            regexp_replace(p_question, '.*step\s+(\d+)\s+of\s+lab\s+(\d+)\s+on\s+day\s+(\d+).*', '\2', 'gi')::INTEGER,
            regexp_replace(p_question, '.*step\s+(\d+)\s+of\s+lab\s+(\d+)\s+on\s+day\s+(\d+).*', '\1', 'gi')::INTEGER
        INTO v_day, v_container_type, v_container_seq, v_node_seq;
        
        v_canonical_ref := format('D%s.L%s.S%s', v_day, v_container_seq, v_node_seq);
        
        RETURN QUERY
        SELECT 
            r.canonical_reference,
            'exact'::TEXT,
            1.0::NUMERIC
        FROM canonical_reference_registry r
        WHERE r.canonical_reference = v_canonical_ref
          AND r.course_id = p_course_id
          AND r.is_valid = true;
        
        RETURN;
    END IF;
    
    -- Try "Day X → Chapter Y" (partial)
    IF p_question ~* 'day\s+\d+\s*[→,]\s*chapter\s+\d+' THEN
        SELECT 
            regexp_replace(p_question, '.*day\s+(\d+)\s*[→,]\s*chapter\s+(\d+).*', '\1', 'gi')::INTEGER,
            regexp_replace(p_question, '.*day\s+(\d+)\s*[→,]\s*chapter\s+(\d+).*', '\2', 'gi')::INTEGER
        INTO v_day, v_container_seq;
        
        RETURN QUERY
        SELECT 
            r.canonical_reference,
            'partial'::TEXT,
            0.8::NUMERIC
        FROM canonical_reference_registry r
        WHERE r.course_id = p_course_id
          AND r.day = v_day
          AND r.container_type = 'chapter'
          AND r.container_id = format('day%s-ch%s', v_day, v_container_seq)
          AND r.is_valid = true
        ORDER BY r.sequence_number;
        
        RETURN;
    END IF;
    
    -- No match found
    RETURN;
END;
$$ LANGUAGE plpgsql;
```

---

## Section 7: Fallback Behavior

### 7.1 When No Reference Found

**Scenario:** User question contains no explicit reference.

**Behavior:**
```javascript
{
    resolved_nodes: [],
    resolution_type: 'none',
    confidence: 0.0,
    matched_patterns: [],
    warnings: ['No explicit references found. Proceeding with semantic search.']
}
```

**Next Step:** Retrieval service falls back to semantic search.

### 7.2 When Partial Reference Found

**Scenario:** User mentions "Day 1 → Chapter 1" but no specific step.

**Behavior:**
```javascript
{
    resolved_nodes: ['D1.C1.C1', 'D1.C1.C2', 'D1.C1.H1', ...], // All nodes in chapter
    resolution_type: 'partial',
    confidence: 0.8,
    matched_patterns: ['chapter_partial'],
    warnings: ['Partial reference: returning all nodes in Day 1 → Chapter 1']
}
```

**Next Step:** Retrieval service uses all nodes, semantic search can refine.

### 7.3 When Reference Not in Registry

**Scenario:** User mentions "Day 1 → Chapter 1 → Step 100" but it doesn't exist.

**Behavior:**
```javascript
{
    resolved_nodes: [],
    resolution_type: 'none',
    confidence: 0.0,
    matched_patterns: ['chapter_step_reference'],
    warnings: ['Reference Day 1 → Chapter 1 → Step 100 not found in registry']
}
```

**Next Step:** Retrieval service falls back to semantic search.

---

## Section 8: Integration with AI Coach Service

### 8.1 Modified Flow

```javascript
// In ai-coach-service.js

async processQuery(question, courseId, userId) {
    // Step 1: Resolve explicit references (NEW)
    const referenceResolution = await referenceResolver.resolve(question, courseId);
    
    let selectedChunks = [];
    
    if (referenceResolution.resolved_nodes.length > 0) {
        // Use resolved nodes directly
        const { data: nodes } = await supabaseClient
            .from('content_nodes')
            .select('*')
            .in('canonical_reference', referenceResolution.resolved_nodes)
            .eq('course_id', courseId)
            .eq('is_valid', true);
        
        selectedChunks = nodes.map(node => ({
            id: node.id,
            canonical_reference: node.canonical_reference,
            content: node.content,
            day: node.day,
            container_type: node.container_type,
            container_id: node.container_id,
            container_title: node.container_title,
            sequence_number: node.sequence_number,
            primary_topic: node.primary_topic,
            is_dedicated_topic_node: node.is_dedicated_topic_node
        }));
        
        console.log(`[AICoachService] Resolved ${selectedChunks.length} nodes from explicit references`);
    } else {
        // Fallback to semantic search
        console.log(`[AICoachService] No explicit references found, using semantic search`);
        selectedChunks = await retrievalService.hybridSearch(question, courseId, userId);
    }
    
    // Continue with LLM processing...
}
```

### 8.2 Reference Resolution Service

```javascript
/**
 * Reference Resolution Service
 */
class ReferenceResolutionService {
    constructor(supabaseClient) {
        this.client = supabaseClient;
    }
    
    /**
     * Resolve explicit references from question
     */
    async resolve(question, courseId) {
        // Normalize
        const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Extract patterns
        const patterns = this.extractPatterns(normalized);
        
        if (patterns.length === 0) {
            return {
                resolved_nodes: [],
                resolution_type: 'none',
                confidence: 0.0,
                matched_patterns: [],
                warnings: ['No explicit references found']
            };
        }
        
        // Parse and validate
        const parsedRefs = patterns
            .map(p => this.parsePattern(p))
            .filter(ref => this.validateReference(ref));
        
        if (parsedRefs.length === 0) {
            return {
                resolved_nodes: [],
                resolution_type: 'none',
                confidence: 0.0,
                matched_patterns: patterns.map(p => p.type),
                warnings: ['No valid references found']
            };
        }
        
        // Lookup in registry
        const resolvedNodes = await this.lookupReferences(parsedRefs, courseId);
        
        return {
            resolved_nodes: resolvedNodes,
            resolution_type: resolvedNodes.length > 0 ? 'exact' : 'none',
            confidence: resolvedNodes.length > 0 ? 1.0 : 0.0,
            matched_patterns: patterns.map(p => p.type),
            warnings: resolvedNodes.length < parsedRefs.length
                ? [`Only ${resolvedNodes.length} of ${parsedRefs.length} references resolved`]
                : []
        };
    }
    
    // ... (pattern extraction, parsing, validation, lookup methods)
}

export default ReferenceResolutionService;
```

---

## Section 9: Test Cases

### 9.1 Exact Match Tests

```javascript
describe('Reference Resolution - Exact Matches', () => {
    test('resolves canonical format: D1.C1.S3', async () => {
        const result = await resolver.resolve('D1.C1.S3', 'seo-master-2026');
        expect(result.resolved_nodes).toEqual(['D1.C1.S3']);
        expect(result.confidence).toBe(1.0);
        expect(result.resolution_type).toBe('exact');
    });
    
    test('resolves "Day 1 → Chapter 1 → Step 3"', async () => {
        const result = await resolver.resolve('Day 1 → Chapter 1 → Step 3', 'seo-master-2026');
        expect(result.resolved_nodes).toEqual(['D1.C1.S3']);
        expect(result.confidence).toBe(1.0);
    });
    
    test('resolves "Step 3 of Lab 1 on Day 20"', async () => {
        const result = await resolver.resolve('Step 3 of Lab 1 on Day 20', 'seo-master-2026');
        expect(result.resolved_nodes).toEqual(['D20.L1.S3']);
        expect(result.confidence).toBe(1.0);
    });
});
```

### 9.2 Partial Match Tests

```javascript
describe('Reference Resolution - Partial Matches', () => {
    test('resolves "Day 1 → Chapter 1" to all nodes', async () => {
        const result = await resolver.resolve('Day 1 → Chapter 1', 'seo-master-2026');
        expect(result.resolved_nodes.length).toBeGreaterThan(0);
        expect(result.resolved_nodes.every(ref => ref.startsWith('D1.C1.'))).toBe(true);
        expect(result.confidence).toBe(0.8);
        expect(result.resolution_type).toBe('partial');
    });
});
```

### 9.3 No Match Tests

```javascript
describe('Reference Resolution - No Matches', () => {
    test('returns empty for question with no references', async () => {
        const result = await resolver.resolve('What is SEO?', 'seo-master-2026');
        expect(result.resolved_nodes).toEqual([]);
        expect(result.confidence).toBe(0.0);
        expect(result.resolution_type).toBe('none');
    });
    
    test('returns empty for invalid reference', async () => {
        const result = await resolver.resolve('Day 1 → Chapter 1 → Step 999', 'seo-master-2026');
        expect(result.resolved_nodes).toEqual([]);
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});
```

---

## Section 10: Performance Considerations

### 10.1 Caching

- Cache resolved references for common patterns
- TTL: 1 hour (references don't change often)

### 10.2 Query Optimization

- Use indexed lookups on `canonical_reference`
- Batch lookups for multiple references
- Limit partial matches to 100 nodes max

### 10.3 Early Exit

- If no patterns found, return immediately (no DB query)
- If validation fails, return immediately (no DB query)

---

## Section 11: Error Handling

### 11.1 Invalid Patterns

- Log warning, continue with other patterns
- Don't fail entire resolution

### 11.2 Database Errors

- Log error, return empty result
- Fallback to semantic search

### 11.3 Ambiguous References

- If multiple patterns match, prefer most specific
- Log ambiguity warning

---

## Conclusion

The Reference Resolution Engine provides:
1. **Deterministic resolution** - Rule-based, no LLM
2. **Explicit references only** - No guessing
3. **Fast lookup** - Direct database queries
4. **Graceful fallback** - Empty result → semantic search
5. **No LLM involvement** - Runs before LLM sees question

**Result**: Precise, deterministic reference resolution that eliminates reference hallucination.

