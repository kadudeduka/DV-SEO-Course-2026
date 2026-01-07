-- Migration: Atomic Content Architecture
-- Creates tables for atomic content nodes with canonical references
-- This eliminates reference hallucination by making references deterministic

-- ============================================
-- TABLE: content_nodes
-- Stores atomic content units (one idea per node)
-- ============================================

CREATE TABLE IF NOT EXISTS content_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id TEXT NOT NULL,
    
    -- Canonical Reference (DETERMINISTIC, NEVER INFERRED)
    canonical_reference TEXT NOT NULL UNIQUE, -- e.g., "D1.C1.S3", "D1.L1.S2"
    reference_type VARCHAR(20) NOT NULL, -- 'step', 'concept', 'example', 'definition', 'procedure'
    
    -- Hierarchical Structure
    day INTEGER NOT NULL,
    container_type VARCHAR(20) NOT NULL, -- 'chapter' or 'lab'
    container_id TEXT NOT NULL, -- chapter_id or lab_id
    container_title TEXT, -- Denormalized for quick access
    sequence_number INTEGER, -- Order within container (1, 2, 3...)
    
    -- Content
    content TEXT NOT NULL, -- Atomic content (one idea, typically 50-200 words)
    content_type VARCHAR(30), -- 'paragraph', 'list_item', 'code_block', 'table', 'diagram_caption'
    
    -- Semantic Metadata (for retrieval, NOT for references)
    primary_topic TEXT, -- Main topic this node covers
    secondary_topics TEXT[], -- Related topics
    keywords TEXT[], -- Search keywords
    
    -- Relationships
    parent_node_id UUID REFERENCES content_nodes(id), -- For nested structures
    related_node_ids UUID[], -- Links to related concepts
    
    -- Metadata
    is_dedicated_topic_node BOOLEAN DEFAULT false, -- True if node is in a dedicated topic chapter
    depth_level INTEGER DEFAULT 1, -- 1=intro, 2=intermediate, 3=advanced
    requires_prerequisites UUID[], -- Node IDs that must be understood first
    
    -- Embedding (for semantic search only, NOT for references)
    embedding VECTOR(1536), -- OpenAI embedding
    
    -- Versioning
    content_hash TEXT, -- SHA-256 hash of content for change detection
    version INTEGER DEFAULT 1,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_canonical_ref_format CHECK (
        canonical_reference ~ '^D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+$'
    ),
    CONSTRAINT chk_sequence_positive CHECK (sequence_number > 0),
    CONSTRAINT chk_day_positive CHECK (day > 0),
    CONSTRAINT chk_container_type CHECK (container_type IN ('chapter', 'lab'))
);

-- Indexes for content_nodes
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_nodes_canonical_ref ON content_nodes(canonical_reference);
CREATE INDEX IF NOT EXISTS idx_content_nodes_course_day ON content_nodes(course_id, day);
CREATE INDEX IF NOT EXISTS idx_content_nodes_container ON content_nodes(course_id, container_type, container_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_topic ON content_nodes(course_id, primary_topic) WHERE primary_topic IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_nodes_dedicated ON content_nodes(course_id, is_dedicated_topic_node) WHERE is_dedicated_topic_node = true;
CREATE INDEX IF NOT EXISTS idx_content_nodes_valid ON content_nodes(course_id, is_valid) WHERE is_valid = true;

-- ============================================
-- TABLE: content_containers
-- Metadata about chapters and labs (containers, not content)
-- ============================================

CREATE TABLE IF NOT EXISTS content_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id TEXT NOT NULL,
    
    -- Container Identity
    container_type VARCHAR(20) NOT NULL, -- 'chapter' or 'lab'
    container_id TEXT NOT NULL, -- e.g., "day1-ch1", "day1-lab1"
    day INTEGER NOT NULL,
    sequence_number INTEGER, -- Order within day
    
    -- Metadata
    title TEXT NOT NULL,
    description TEXT,
    learning_objectives TEXT[],
    
    -- Topic Classification
    primary_topic TEXT,
    is_dedicated_topic_chapter BOOLEAN DEFAULT false,
    
    -- Statistics (denormalized)
    node_count INTEGER DEFAULT 0, -- Number of atomic nodes in this container
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_container_type CHECK (container_type IN ('chapter', 'lab')),
    CONSTRAINT chk_container_day_positive CHECK (day > 0),
    UNIQUE(course_id, container_type, container_id)
);

-- Indexes for content_containers
CREATE INDEX IF NOT EXISTS idx_content_containers_course_day ON content_containers(course_id, day);
CREATE INDEX IF NOT EXISTS idx_content_containers_dedicated ON content_containers(course_id, is_dedicated_topic_chapter) WHERE is_dedicated_topic_chapter = true;

-- ============================================
-- TABLE: canonical_reference_registry
-- Single source of truth for all course content references
-- ============================================

CREATE TABLE IF NOT EXISTS canonical_reference_registry (
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
        canonical_reference ~ '^D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+$'
    ),
    CONSTRAINT chk_sequence_positive_registry CHECK (sequence_number > 0),
    CONSTRAINT chk_day_positive_registry CHECK (day > 0),
    CONSTRAINT chk_container_type_registry CHECK (container_type IN ('chapter', 'lab'))
);

-- Indexes for canonical_reference_registry
CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_canonical_ref ON canonical_reference_registry(canonical_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_course_container_seq ON canonical_reference_registry(course_id, container_type, container_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_registry_course_day ON canonical_reference_registry(course_id, day);
CREATE INDEX IF NOT EXISTS idx_registry_container ON canonical_reference_registry(course_id, container_type, container_id);
CREATE INDEX IF NOT EXISTS idx_registry_topic ON canonical_reference_registry(course_id, primary_topic) WHERE primary_topic IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registry_dedicated ON canonical_reference_registry(course_id, is_dedicated_topic_node) WHERE is_dedicated_topic_node = true;
CREATE INDEX IF NOT EXISTS idx_registry_valid ON canonical_reference_registry(course_id, is_valid) WHERE is_valid = true;

-- ============================================
-- TABLE: content_node_references
-- System-assembled references (never LLM-generated)
-- ============================================

CREATE TABLE IF NOT EXISTS content_node_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES ai_coach_queries(id),
    response_id UUID NOT NULL REFERENCES ai_coach_responses(id),
    
    -- Reference (SYSTEM-OWNED)
    canonical_reference TEXT NOT NULL, -- From content_nodes.canonical_reference
    reference_type VARCHAR(20) NOT NULL, -- 'primary', 'secondary', 'supporting'
    
    -- Denormalized for display
    day INTEGER NOT NULL,
    container_type VARCHAR(20) NOT NULL,
    container_id TEXT NOT NULL,
    container_title TEXT,
    sequence_number INTEGER,
    
    -- Metadata
    node_id UUID REFERENCES content_nodes(id),
    relevance_score DECIMAL(3,2), -- How relevant this node was to the answer
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for content_node_references
CREATE INDEX IF NOT EXISTS idx_node_refs_query ON content_node_references(query_id);
CREATE INDEX IF NOT EXISTS idx_node_refs_response ON content_node_references(response_id);
CREATE INDEX IF NOT EXISTS idx_node_refs_canonical ON content_node_references(canonical_reference);

-- ============================================
-- TABLE: reference_resolution_cache
-- Cache for resolved references (performance optimization)
-- ============================================

CREATE TABLE IF NOT EXISTS reference_resolution_cache (
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

CREATE INDEX IF NOT EXISTS idx_resolution_cache_container ON reference_resolution_cache(container_id);

-- ============================================
-- FUNCTIONS: Reference Resolution
-- ============================================

-- Function to resolve canonical reference to display format
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
    v_container_num TEXT;
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
    
    -- Extract container number
    IF v_container_type = 'chapter' THEN
        v_container_num := regexp_replace(v_container_id, '^day\d+-ch(\d+)$', '\1');
    ELSIF v_container_type = 'lab' THEN
        v_container_num := regexp_replace(v_container_id, '^day\d+-lab(\d+)$', '\1');
    ELSE
        v_container_num := '?';
    END IF;
    
    -- Build display format
    IF v_container_type = 'chapter' THEN
        v_display := format('Day %s → Chapter %s → %s %s',
            v_day,
            v_container_num,
            CASE v_node_type
                WHEN 'step' THEN 'Step'
                WHEN 'concept' THEN 'Concept'
                WHEN 'example' THEN 'Example'
                WHEN 'definition' THEN 'Definition'
                WHEN 'procedure' THEN 'Procedure'
                WHEN 'list_item' THEN 'Item'
                WHEN 'heading' THEN 'Section'
                ELSE 'Section'
            END,
            v_sequence_number
        );
    ELSIF v_container_type = 'lab' THEN
        v_display := format('Day %s → Lab %s → Step %s',
            v_day,
            v_container_num,
            v_sequence_number
        );
    END IF;
    
    RETURN v_display;
END;
$$ LANGUAGE plpgsql;

-- Function to validate reference format
CREATE OR REPLACE FUNCTION validate_reference_format(
    p_reference TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Check format: D{day}.{C|L}{seq}.{type}{seq}
    RETURN p_reference ~ '^D\d+\.(C|L)\d+\.([SCEDPLHTB])\d+$';
END;
$$ LANGUAGE plpgsql;

-- Function to get all references for a container
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

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE content_nodes IS 'Atomic content units with deterministic canonical references. One idea per node.';
COMMENT ON TABLE content_containers IS 'Metadata about chapters and labs (organizational units, not knowledge units).';
COMMENT ON TABLE canonical_reference_registry IS 'Single source of truth for all course content references. Human-readable and machine-resolvable.';
COMMENT ON TABLE content_node_references IS 'System-assembled references for AI Coach responses. Never LLM-generated.';
COMMENT ON TABLE reference_resolution_cache IS 'Performance cache for resolved references.';

COMMENT ON COLUMN content_nodes.canonical_reference IS 'Deterministic reference format: D{day}.{C|L}{container_seq}.{type}{node_seq}';
COMMENT ON COLUMN canonical_reference_registry.canonical_reference IS 'Immutable reference. Never changes once assigned.';
COMMENT ON COLUMN content_node_references.canonical_reference IS 'System-owned reference. Never generated by LLM.';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_nodes') THEN
        RAISE NOTICE '✓ content_nodes table created';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_containers') THEN
        RAISE NOTICE '✓ content_containers table created';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'canonical_reference_registry') THEN
        RAISE NOTICE '✓ canonical_reference_registry table created';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_node_references') THEN
        RAISE NOTICE '✓ content_node_references table created';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reference_resolution_cache') THEN
        RAISE NOTICE '✓ reference_resolution_cache table created';
    END IF;
END $$;

