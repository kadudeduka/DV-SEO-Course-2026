# Canonical Reference Registry

## Executive Summary

The Canonical Reference Registry is the **single source of truth** for all course content references. Every atomic content node has exactly one canonical reference that is human-readable, machine-resolvable, and stable over time.

---

## Section 1: Registry Schema

### 1.1 Core Registry Table

```sql
CREATE TABLE canonical_reference_registry (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Canonical Reference (UNIQUE, IMMUTABLE)
    canonical_reference TEXT NOT NULL UNIQUE,
    
    -- Course Context
    course_id TEXT NOT NULL,
    
    -- Hierarchical Structure (DETERMINISTIC)
    day INTEGER NOT NULL,
    container_type VARCHAR(20) NOT NULL, -- 'chapter' or 'lab'
    container_id TEXT NOT NULL, -- e.g., "day1-ch1", "day1-lab1"
    container_title TEXT NOT NULL, -- Human-readable title
    sequence_number INTEGER NOT NULL, -- Order within container (1, 2, 3...)
    
    -- Node Classification
    node_type VARCHAR(20) NOT NULL, -- 'step', 'concept', 'example', 'definition', 'procedure', 'list_item'
    content_type VARCHAR(30), -- 'paragraph', 'heading', 'code_block', 'table', 'diagram_caption'
    
    -- Content Metadata
    content_preview TEXT, -- First 100 chars for identification
    word_count INTEGER,
    character_count INTEGER,
    
    -- Relationships
    parent_reference TEXT, -- Parent node's canonical_reference (for nested structures)
    sibling_sequence INTEGER, -- Order among siblings
    
    -- Semantic Metadata (for search, NOT for references)
    primary_topic TEXT,
    secondary_topics TEXT[],
    keywords TEXT[],
    
    -- Flags
    is_dedicated_topic_node BOOLEAN DEFAULT false,
    is_foundational BOOLEAN DEFAULT false,
    requires_prerequisites TEXT[], -- Array of canonical_references
    
    -- Validation
    is_valid BOOLEAN DEFAULT true,
    validation_checksum TEXT, -- SHA-256 of (course_id + day + container_id + sequence_number)
    
    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT, -- System or user who created
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    
    -- Constraints
    CONSTRAINT chk_reference_format CHECK (
        canonical_reference ~ '^D\d+\.(C|L)\d+\.([SCEDPL])\d+$'
    ),
    CONSTRAINT chk_sequence_positive CHECK (sequence_number > 0),
    CONSTRAINT chk_day_positive CHECK (day > 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_registry_canonical_ref ON canonical_reference_registry(canonical_reference);
CREATE UNIQUE INDEX idx_registry_course_container_seq ON canonical_reference_registry(course_id, container_type, container_id, sequence_number);
CREATE INDEX idx_registry_course_day ON canonical_reference_registry(course_id, day);
CREATE INDEX idx_registry_container ON canonical_reference_registry(course_id, container_type, container_id);
CREATE INDEX idx_registry_topic ON canonical_reference_registry(course_id, primary_topic) WHERE primary_topic IS NOT NULL;
CREATE INDEX idx_registry_dedicated ON canonical_reference_registry(course_id, is_dedicated_topic_node) WHERE is_dedicated_topic_node = true;
```

### 1.2 Reference Resolution Table

```sql
CREATE TABLE reference_resolution_cache (
    canonical_reference TEXT PRIMARY KEY REFERENCES canonical_reference_registry(canonical_reference),
    
    -- Resolved Values (DENORMALIZED for performance)
    day INTEGER NOT NULL,
    container_type VARCHAR(20) NOT NULL,
    container_id TEXT NOT NULL,
    container_title TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    node_type VARCHAR(20) NOT NULL,
    
    -- Display Format (pre-computed)
    display_reference TEXT NOT NULL, -- "Day 1 → Chapter 1 → Step 3"
    short_reference TEXT NOT NULL, -- "D1.C1.S3"
    
    -- Cache Metadata
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cache_version INTEGER DEFAULT 1
);

CREATE INDEX idx_resolution_cache_container ON reference_resolution_cache(container_id);
```

---

## Section 2: Reference ID Naming Convention

### 2.1 Format Specification

**Pattern:** `D{day}.{container_type}{container_seq}.{node_type}{node_seq}`

**Components:**
- `D{day}` - Day number (1, 2, 3...)
- `{container_type}` - `C` for Chapter, `L` for Lab
- `{container_seq}` - Container sequence within day (1, 2, 3...)
- `{node_type}` - Node type code (see below)
- `{node_seq}` - Node sequence within container (1, 2, 3...)

### 2.2 Node Type Codes

| Code | Type | Description | Example |
|------|------|-------------|---------|
| `S` | Step | Procedural step or instruction | `D1.L1.S2` |
| `C` | Concept | Definition or explanation | `D1.C1.C3` |
| `E` | Example | Concrete example or case study | `D1.C1.E1` |
| `D` | Definition | Formal definition | `D1.C1.D1` |
| `P` | Procedure | Multi-step procedure | `D1.C1.P1` |
| `L` | List Item | Item in a list | `D1.C1.L1` |
| `H` | Heading | Section heading | `D1.C1.H1` |
| `T` | Table | Table content | `D1.C1.T1` |
| `B` | Code Block | Code snippet | `D1.C1.B1` |

### 2.3 Naming Rules

1. **Sequential Numbering**: Within each container, nodes are numbered sequentially starting from 1
2. **No Gaps**: Sequence numbers must be consecutive (1, 2, 3, not 1, 3, 5)
3. **Type Consistency**: All nodes of same type in same container share the type code
4. **Immutable**: Once assigned, canonical references never change
5. **Case Sensitive**: All references are uppercase (D1.C1.S3, not d1.c1.s3)

### 2.4 Examples

```
D1.C1.C1    → Day 1, Chapter 1, Concept 1
D1.C1.C2    → Day 1, Chapter 1, Concept 2
D1.C1.S1    → Day 1, Chapter 1, Step 1
D1.L1.S1    → Day 1, Lab 1, Step 1
D1.L1.S2    → Day 1, Lab 1, Step 2
D20.C1.C1   → Day 20, Chapter 1, Concept 1
D20.C1.S1   → Day 20, Chapter 1, Step 1
```

---

## Section 3: Sample Registry - Full Chapter

### 3.1 Chapter: Day 1, Chapter 1 - "How Search Engines Work & Search Intent Fundamentals"

**Container Metadata:**
```json
{
  "container_id": "day1-ch1",
  "container_type": "chapter",
  "container_title": "How Search Engines Work & Search Intent Fundamentals",
  "day": 1,
  "sequence_number": 1,
  "course_id": "seo-master-2026"
}
```

**Registry Entries:**

```sql
-- Node 1: Introduction Paragraph
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational
) VALUES (
    'D1.C1.C1',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    1,
    'concept',
    'paragraph',
    'Search engines are sophisticated systems that help users find information on the internet...',
    45,
    'SEO Fundamentals',
    true
);

-- Node 2: Definition - Search Engine
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational
) VALUES (
    'D1.C1.D1',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    2,
    'definition',
    'paragraph',
    'A search engine is a software system designed to search for information on the World Wide Web...',
    38,
    'SEO Fundamentals',
    true
);

-- Node 3: Concept - Crawling
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational
) VALUES (
    'D1.C1.C2',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    3,
    'concept',
    'paragraph',
    'Crawling is the process by which search engines discover and retrieve web pages...',
    52,
    'SEO Fundamentals',
    true
);

-- Node 4: Concept - Indexing
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational
) VALUES (
    'D1.C1.C3',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    4,
    'concept',
    'paragraph',
    'Indexing is the process of storing and organizing discovered web pages in a searchable database...',
    48,
    'SEO Fundamentals',
    true
);

-- Node 5: Heading - Search Intent
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational
) VALUES (
    'D1.C1.H1',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    5,
    'heading',
    'heading',
    'Understanding Search Intent',
    2,
    'SEO Fundamentals',
    true
);

-- Node 6: Concept - Informational Intent
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational,
    parent_reference
) VALUES (
    'D1.C1.C4',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    6,
    'concept',
    'paragraph',
    'Informational intent occurs when users seek to learn or understand something...',
    42,
    'SEO Fundamentals',
    true,
    'D1.C1.H1'
);

-- Node 7: Concept - Navigational Intent
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational,
    parent_reference
) VALUES (
    'D1.C1.C5',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    7,
    'concept',
    'paragraph',
    'Navigational intent occurs when users want to find a specific website or page...',
    35,
    'SEO Fundamentals',
    true,
    'D1.C1.H1'
);

-- Node 8: Concept - Commercial Intent
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational,
    parent_reference
) VALUES (
    'D1.C1.C6',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    8,
    'concept',
    'paragraph',
    'Commercial intent occurs when users are researching products or services before making a purchase...',
    41,
    'SEO Fundamentals',
    true,
    'D1.C1.H1'
);

-- Node 9: Concept - Transactional Intent
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational,
    parent_reference
) VALUES (
    'D1.C1.C7',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    9,
    'concept',
    'paragraph',
    'Transactional intent occurs when users are ready to make a purchase or complete an action...',
    38,
    'SEO Fundamentals',
    true,
    'D1.C1.H1'
);

-- Node 10: Example - Search Intent Example
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic, is_foundational
) VALUES (
    'D1.C1.E1',
    'seo-master-2026',
    1,
    'chapter',
    'day1-ch1',
    'How Search Engines Work & Search Intent Fundamentals',
    10,
    'example',
    'paragraph',
    'Example: A user searching for "how to optimize images for SEO" has informational intent...',
    28,
    'SEO Fundamentals',
    true
);
```

**Summary:**
- Total nodes: 10
- Types: Concepts (C), Definitions (D), Headings (H), Examples (E)
- Sequence: C1, D1, C2, C3, H1, C4, C5, C6, C7, E1
- All foundational: true

---

## Section 4: Sample Registry - Full Lab

### 4.1 Lab: Day 1, Lab 1 - "Keyword Research Lab"

**Container Metadata:**
```json
{
  "container_id": "day1-lab1",
  "container_type": "lab",
  "container_title": "Keyword Research Lab",
  "day": 1,
  "sequence_number": 1,
  "course_id": "seo-master-2026"
}
```

**Registry Entries:**

```sql
-- Node 1: Lab Introduction
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.C1',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    1,
    'concept',
    'paragraph',
    'In this lab, you will learn how to conduct keyword research using industry-standard tools...',
    35,
    'Keyword Research'
);

-- Node 2: Step 1 - Identify Target Keywords
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.S1',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    2,
    'step',
    'paragraph',
    'Step 1: Identify your target keywords. Start by brainstorming a list of 10-15 keywords related to your business or topic...',
    48,
    'Keyword Research'
);

-- Node 3: Step 2 - Analyze Search Volume
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.S2',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    3,
    'step',
    'paragraph',
    'Step 2: Analyze search volume for each keyword using Google Keyword Planner or similar tools...',
    42,
    'Keyword Research'
);

-- Node 4: Step 3 - Evaluate Competition
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.S3',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    4,
    'step',
    'paragraph',
    'Step 3: Evaluate competition level for each keyword. Check the top 10 results to assess difficulty...',
    38,
    'Keyword Research'
);

-- Node 5: Step 4 - Select Primary Keywords
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.S4',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    5,
    'step',
    'paragraph',
    'Step 4: Select 3-5 primary keywords based on search volume, competition, and relevance to your goals...',
    41,
    'Keyword Research'
);

-- Node 6: Example - Keyword Selection
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.E1',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    6,
    'example',
    'paragraph',
    'Example: For a local bakery, good primary keywords might be "best bakery near me", "fresh bread", "custom cakes"...',
    32,
    'Keyword Research'
);

-- Node 7: Procedure - Using Keyword Tools
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.P1',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    7,
    'procedure',
    'paragraph',
    'Procedure for using Google Keyword Planner: 1) Sign in to Google Ads account, 2) Navigate to Tools > Keyword Planner...',
    55,
    'Keyword Research'
);

-- Node 8: Step 5 - Document Findings
INSERT INTO canonical_reference_registry (
    canonical_reference, course_id, day, container_type, container_id,
    container_title, sequence_number, node_type, content_type,
    content_preview, word_count, primary_topic
) VALUES (
    'D1.L1.S5',
    'seo-master-2026',
    1,
    'lab',
    'day1-lab1',
    'Keyword Research Lab',
    8,
    'step',
    'paragraph',
    'Step 5: Document your findings in a spreadsheet with columns for keyword, search volume, competition, and priority...',
    44,
    'Keyword Research'
);
```

**Summary:**
- Total nodes: 8
- Types: Concepts (C), Steps (S), Examples (E), Procedures (P)
- Sequence: C1, S1, S2, S3, S4, E1, P1, S5
- All related to: Keyword Research

---

## Section 5: Reference Resolution Functions

### 5.1 Resolve Reference to Display Format

```sql
CREATE OR REPLACE FUNCTION resolve_reference_display(
    p_canonical_reference TEXT
) RETURNS TEXT AS $$
DECLARE
    v_day INTEGER;
    v_container_type VARCHAR(20);
    v_container_id TEXT;
    v_container_title TEXT;
    v_sequence_number INTEGER;
    v_node_type VARCHAR(20);
    v_display TEXT;
BEGIN
    SELECT 
        r.day,
        r.container_type,
        r.container_id,
        r.container_title,
        r.sequence_number,
        r.node_type
    INTO 
        v_day,
        v_container_type,
        v_container_id,
        v_container_title,
        v_sequence_number,
        v_node_type
    FROM canonical_reference_registry r
    WHERE r.canonical_reference = p_canonical_reference
      AND r.is_valid = true;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Build display format
    IF v_container_type = 'chapter' THEN
        v_display := format('Day %s → Chapter %s → %s %s',
            v_day,
            regexp_replace(v_container_id, '^day\d+-ch(\d+)$', '\1'),
            CASE v_node_type
                WHEN 'step' THEN 'Step'
                WHEN 'concept' THEN 'Concept'
                WHEN 'example' THEN 'Example'
                WHEN 'definition' THEN 'Definition'
                WHEN 'procedure' THEN 'Procedure'
                ELSE 'Section'
            END,
            v_sequence_number
        );
    ELSIF v_container_type = 'lab' THEN
        v_display := format('Day %s → Lab %s → Step %s',
            v_day,
            regexp_replace(v_container_id, '^day\d+-lab(\d+)$', '\1'),
            v_sequence_number
        );
    END IF;
    
    RETURN v_display;
END;
$$ LANGUAGE plpgsql;
```

### 5.2 Validate Reference Format

```sql
CREATE OR REPLACE FUNCTION validate_reference_format(
    p_reference TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Check format: D{day}.{C|L}{seq}.{type}{seq}
    RETURN p_reference ~ '^D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+$';
END;
$$ LANGUAGE plpgsql;
```

### 5.3 Get All References for Container

```sql
CREATE OR REPLACE FUNCTION get_container_references(
    p_course_id TEXT,
    p_container_type VARCHAR(20),
    p_container_id TEXT
) RETURNS TABLE (
    canonical_reference TEXT,
    sequence_number INTEGER,
    node_type VARCHAR(20),
    content_preview TEXT,
    display_reference TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.canonical_reference,
        r.sequence_number,
        r.node_type,
        r.content_preview,
        resolve_reference_display(r.canonical_reference) as display_reference
    FROM canonical_reference_registry r
    WHERE r.course_id = p_course_id
      AND r.container_type = p_container_type
      AND r.container_id = p_container_id
      AND r.is_valid = true
    ORDER BY r.sequence_number;
END;
$$ LANGUAGE plpgsql;
```

---

## Section 6: Registry Validation Rules

### 6.1 Uniqueness Constraints

1. **Canonical Reference**: Must be globally unique
2. **Container + Sequence**: Within a container, sequence numbers must be unique
3. **No Duplicates**: Same content cannot have multiple references

### 6.2 Format Validation

```sql
-- Reference must match pattern
CHECK (canonical_reference ~ '^D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+$')

-- Examples of VALID references:
-- D1.C1.S3 ✓
-- D20.C1.C1 ✓
-- D1.L1.S2 ✓

-- Examples of INVALID references:
-- d1.c1.s3 ✗ (lowercase)
-- D1.C1 ✗ (missing node part)
-- D1.C1.S3.1 ✗ (too many parts)
```

### 6.3 Sequence Validation

```sql
-- Sequence numbers must be positive
CHECK (sequence_number > 0)

-- Sequence numbers should be consecutive (enforced by application logic)
-- No gaps allowed: 1, 2, 3, 4 (not 1, 3, 5)
```

### 6.4 Immutability Rules

1. **Canonical Reference**: Once assigned, NEVER changes
2. **Container Assignment**: Node cannot move to different container
3. **Sequence Number**: Cannot be renumbered (would break references)

**Exception**: If content is restructured, old references are marked `is_valid = false` and new references are created.

---

## Section 7: Reference Lookup Service

### 7.1 JavaScript Service

```javascript
/**
 * Canonical Reference Registry Service
 * Single source of truth for all course references
 */
class CanonicalReferenceRegistry {
    constructor(supabaseClient) {
        this.client = supabaseClient;
        this.cache = new Map(); // In-memory cache
    }

    /**
     * Resolve canonical reference to display format
     * @param {string} canonicalRef - e.g., "D1.C1.S3"
     * @returns {Promise<Object>} Resolved reference
     */
    async resolve(canonicalRef) {
        // Check cache first
        if (this.cache.has(canonicalRef)) {
            return this.cache.get(canonicalRef);
        }

        // Validate format
        if (!this.validateFormat(canonicalRef)) {
            throw new Error(`Invalid reference format: ${canonicalRef}`);
        }

        // Query registry
        const { data, error } = await this.client
            .from('canonical_reference_registry')
            .select('*')
            .eq('canonical_reference', canonicalRef)
            .eq('is_valid', true)
            .single();

        if (error || !data) {
            throw new Error(`Reference not found: ${canonicalRef}`);
        }

        // Build display format
        const display = this.formatDisplay(data);

        const resolved = {
            canonical_reference: canonicalRef,
            day: data.day,
            container_type: data.container_type,
            container_id: data.container_id,
            container_title: data.container_title,
            sequence_number: data.sequence_number,
            node_type: data.node_type,
            display_reference: display,
            short_reference: canonicalRef
        };

        // Cache result
        this.cache.set(canonicalRef, resolved);

        return resolved;
    }

    /**
     * Format reference for display
     * @param {Object} data - Registry entry
     * @returns {string} Display format
     */
    formatDisplay(data) {
        const day = data.day;
        const containerType = data.container_type;
        const containerId = data.container_id;
        const seq = data.sequence_number;
        const nodeType = data.node_type;

        // Extract container number
        const containerMatch = containerId.match(/(?:ch|lab)(\d+)/);
        const containerNum = containerMatch ? containerMatch[1] : '?';

        // Format node type
        const nodeTypeLabel = {
            'step': 'Step',
            'concept': 'Concept',
            'example': 'Example',
            'definition': 'Definition',
            'procedure': 'Procedure',
            'list_item': 'Item',
            'heading': 'Section'
        }[nodeType] || 'Section';

        if (containerType === 'chapter') {
            return `Day ${day} → Chapter ${containerNum} → ${nodeTypeLabel} ${seq}`;
        } else if (containerType === 'lab') {
            return `Day ${day} → Lab ${containerNum} → Step ${seq}`;
        }

        return `${data.container_title} → ${nodeTypeLabel} ${seq}`;
    }

    /**
     * Validate reference format
     * @param {string} ref - Reference to validate
     * @returns {boolean} True if valid
     */
    validateFormat(ref) {
        return /^D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+$/.test(ref);
    }

    /**
     * Get all references for a container
     * @param {string} courseId - Course ID
     * @param {string} containerType - 'chapter' or 'lab'
     * @param {string} containerId - Container ID
     * @returns {Promise<Array>} Array of references
     */
    async getContainerReferences(courseId, containerType, containerId) {
        const { data, error } = await this.client
            .from('canonical_reference_registry')
            .select('*')
            .eq('course_id', courseId)
            .eq('container_type', containerType)
            .eq('container_id', containerId)
            .eq('is_valid', true)
            .order('sequence_number', { ascending: true });

        if (error) {
            throw error;
        }

        return data.map(entry => ({
            canonical_reference: entry.canonical_reference,
            sequence_number: entry.sequence_number,
            node_type: entry.node_type,
            content_preview: entry.content_preview,
            display_reference: this.formatDisplay(entry)
        }));
    }

    /**
     * Batch resolve references
     * @param {Array<string>} references - Array of canonical references
     * @returns {Promise<Array>} Array of resolved references
     */
    async batchResolve(references) {
        const uniqueRefs = [...new Set(references)];
        const results = await Promise.all(
            uniqueRefs.map(ref => this.resolve(ref).catch(err => {
                console.warn(`Failed to resolve ${ref}:`, err);
                return null;
            }))
        );
        return results.filter(r => r !== null);
    }
}

export default CanonicalReferenceRegistry;
```

---

## Section 8: Integration with AI Coach

### 8.1 Reference Assembly (System-Owned)

```javascript
// In ai-coach-service.js

async _assembleReferences(retrievedNodes) {
    const registry = new CanonicalReferenceRegistry(supabaseClient);
    
    // Resolve all canonical references
    const canonicalRefs = retrievedNodes.map(node => node.canonical_reference);
    const resolvedRefs = await registry.batchResolve(canonicalRefs);
    
    // Select primary reference (highest relevance)
    const primaryNode = retrievedNodes[0]; // Already sorted by relevance
    const primaryRef = await registry.resolve(primaryNode.canonical_reference);
    
    // Build secondary references
    const secondaryRefs = resolvedRefs
        .filter(ref => ref.canonical_reference !== primaryNode.canonical_reference)
        .slice(0, 5); // Limit to top 5
    
    return {
        primary: {
            canonical_reference: primaryRef.canonical_reference,
            display: primaryRef.display_reference,
            day: primaryRef.day,
            container_type: primaryRef.container_type,
            container_id: primaryRef.container_id,
            container_title: primaryRef.container_title,
            sequence_number: primaryRef.sequence_number
        },
        secondary: secondaryRefs.map(ref => ({
            canonical_reference: ref.canonical_reference,
            display: ref.display_reference,
            day: ref.day,
            container_type: ref.container_type,
            container_id: ref.container_id,
            container_title: ref.container_title
        }))
    };
}
```

### 8.2 LLM Prompt (No References)

```javascript
// System prompt explicitly forbids references
const systemPrompt = `
You are an AI Coach. Answer questions using the provided content.

CRITICAL RULES:
1. Do NOT include any references (Day X, Chapter Y, Lab Z) in your answer
2. Do NOT mention specific course locations
3. The system will automatically add references based on the content you use
4. Focus only on explaining the concepts clearly
`;
```

---

## Section 9: Benefits

### 9.1 Eliminates Reference Hallucination

- **Before**: LLM infers "Day 1 → Chapter 1" from context
- **After**: System looks up `D20.C1.C1` → Gets exact Day 20, Chapter 1, Concept 1

### 9.2 Human-Readable & Machine-Resolvable

- **Human**: "Day 20 → Chapter 1 → Concept 1"
- **Machine**: `D20.C1.C1`
- **Both**: Same source of truth

### 9.3 Stable Over Time

- References never change (immutable)
- Content can be updated without breaking references
- Old references remain valid (marked `is_valid = false` if deprecated)

### 9.4 No Inference Needed

- Every reference is explicit
- No semantic guessing
- No ambiguity

---

## Section 10: Implementation Checklist

- [ ] Create `canonical_reference_registry` table
- [ ] Create `reference_resolution_cache` table
- [ ] Implement reference format validation
- [ ] Build reference resolution functions
- [ ] Create `CanonicalReferenceRegistry` service
- [ ] Build content ingestion pipeline (assigns references)
- [ ] Update AI Coach to use registry for references
- [ ] Migrate existing content to registry
- [ ] Add tests for reference resolution
- [ ] Document reference assignment rules

---

## Conclusion

The Canonical Reference Registry provides:
1. **Single Source of Truth**: Every reference is explicit and deterministic
2. **No Hallucination**: References come from registry, never inferred
3. **Human & Machine Readable**: `D1.C1.S3` = "Day 1 → Chapter 1 → Step 3"
4. **Stable**: References never change, ensuring long-term reliability

**Result**: Permanent solution to reference resolution issues.

