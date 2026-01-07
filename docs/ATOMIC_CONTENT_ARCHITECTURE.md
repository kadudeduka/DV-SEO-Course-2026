# Atomic Content Architecture Design

## Executive Summary

This document proposes a complete redesign of the content storage architecture to eliminate reference hallucination in AI Coach responses. The core principle: **atomic content nodes with deterministic references** replace chunk-based storage.

---

## Section 1: Schema Design

### 1.1 Core Tables

#### Table: `content_nodes`
Stores atomic content units (one idea per node).

```sql
CREATE TABLE content_nodes (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_content_nodes_canonical_ref ON content_nodes(canonical_reference);
CREATE INDEX idx_content_nodes_course_day ON content_nodes(course_id, day);
CREATE INDEX idx_content_nodes_container ON content_nodes(course_id, container_type, container_id);
CREATE INDEX idx_content_nodes_topic ON content_nodes(course_id, primary_topic) WHERE primary_topic IS NOT NULL;
CREATE INDEX idx_content_nodes_dedicated ON content_nodes(course_id, is_dedicated_topic_node) WHERE is_dedicated_topic_node = true;
```

#### Table: `content_containers`
Metadata about chapters and labs (containers, not content).

```sql
CREATE TABLE content_containers (
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
    
    UNIQUE(course_id, container_type, container_id)
);

CREATE INDEX idx_content_containers_course_day ON content_containers(course_id, day);
CREATE INDEX idx_content_containers_dedicated ON content_containers(course_id, is_dedicated_topic_chapter) WHERE is_dedicated_topic_chapter = true;
```

#### Table: `content_node_references`
System-assembled references (never LLM-generated).

```sql
CREATE TABLE content_node_references (
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

CREATE INDEX idx_node_refs_query ON content_node_references(query_id);
CREATE INDEX idx_node_refs_response ON content_node_references(response_id);
```

### 1.2 Canonical Reference Format

**Format:** `D{day}.{container_type}{container_seq}.{node_type}{node_seq}`

**Examples:**
- `D1.C1.S3` = Day 1, Chapter 1, Step 3
- `D1.L1.S2` = Day 1, Lab 1, Step 2
- `D20.C1.C5` = Day 20, Chapter 1, Concept 5
- `D20.C1.E2` = Day 20, Chapter 1, Example 2

**Node Type Codes:**
- `S` = Step (procedural)
- `C` = Concept (definition/explanation)
- `E` = Example
- `D` = Definition
- `P` = Procedure
- `L` = List item (when part of a list)

**Rules:**
1. Every node MUST have a canonical reference
2. References are assigned during ingestion, never inferred
3. References are immutable (unless content is restructured)
4. References are human-readable and deterministic

---

## Section 2: Design Rationale

### 2.1 Why Atomic Nodes Prevent Reference Hallucination

#### Problem with Chunk-Based Storage:
```
Chunk: "Day 1, Chapter 1 - Entire chapter content (2000 words)"
- Contains multiple ideas
- LLM must infer which part to reference
- Ambiguity leads to wrong citations
```

#### Solution with Atomic Nodes:
```
Node D1.C1.S3: "AEO focuses on user intent alignment..."
Node D1.C1.S4: "Content should be structured for SERP features..."
Node D20.C1.C1: "AEO implementation requires three key steps..."

- Each node = one idea
- Reference is explicit (D1.C1.S3)
- No inference needed
- System assembles references from node IDs
```

### 2.2 Deterministic Reference Assignment

**During Content Ingestion:**
1. Parse markdown file
2. Identify atomic units (paragraphs, list items, steps)
3. Assign canonical reference based on structure
4. Store as separate nodes

**Example Ingestion:**
```markdown
# Day 1, Chapter 1: Introduction to SEO

Paragraph 1 → D1.C1.C1
Paragraph 2 → D1.C1.C2

## Key Concepts
- Concept 1 → D1.C1.C3
- Concept 2 → D1.C1.C4
```

### 2.3 Reference Assembly (System-Owned)

**Process:**
1. Retrieve relevant nodes via semantic search
2. Get canonical references from node IDs
3. Assemble references WITHOUT LLM involvement
4. Display references using canonical format

**Example:**
```
Query: "What is AEO?"
Retrieved Nodes: [D20.C1.C1, D20.C1.S1, D20.C1.S2]
System Assembled References:
  - Primary: D20.C1.C1 (Day 20, Chapter 1, Concept 1)
  - Secondary: D20.C1.S1, D20.C1.S2
```

### 2.4 Why Containers Are Metadata Only

**Containers (chapters/labs) are organizational units, not knowledge units:**
- A chapter contains multiple nodes
- A node belongs to one container
- References point to nodes, not containers
- Containers provide context but aren't cited directly

**Benefit:**
- Precise citations (specific step/concept)
- No ambiguity about which part of a chapter
- Can reference multiple nodes from same chapter

### 2.5 Embeddings for Retrieval, Not References

**Embeddings are used ONLY for:**
- Finding relevant nodes (semantic search)
- Ranking nodes by relevance

**Embeddings are NEVER used for:**
- Generating references
- Inferring day/chapter/lab
- Determining canonical references

**References come from:**
- `content_nodes.canonical_reference` (deterministic)
- System-assembled from retrieved node IDs

---

## Section 3: Example Nodes

### 3.1 Example: AEO Chapter (Day 20)

**Container:**
```
container_id: "day20-ch1"
container_type: "chapter"
title: "Answer Engine Optimization (AEO)"
is_dedicated_topic_chapter: true
primary_topic: "AEO"
```

**Nodes:**

**Node 1:**
```
canonical_reference: "D20.C1.C1"
day: 20
container_id: "day20-ch1"
sequence_number: 1
content: "AEO, or Answer Engine Optimization, refers to the practice of optimizing content to ensure it effectively answers user queries, particularly in the context of search engines that prioritize providing direct answers to users."
primary_topic: "AEO"
reference_type: "concept"
is_dedicated_topic_node: true
```

**Node 2:**
```
canonical_reference: "D20.C1.S1"
day: 20
container_id: "day20-ch1"
sequence_number: 2
content: "Focus on User Intent: AEO emphasizes understanding what users are looking for when they search, ensuring that content aligns with their needs."
primary_topic: "AEO"
reference_type: "step"
is_dedicated_topic_node: true
```

**Node 3:**
```
canonical_reference: "D20.C1.S2"
day: 20
container_id: "day20-ch1"
sequence_number: 3
content: "Structured Content: Content should be organized in a way that makes it easy for search engines to extract and present answers, often using formats like FAQs or structured data."
primary_topic: "AEO"
reference_type: "step"
is_dedicated_topic_node: true
```

### 3.2 Example: Foundational Chapter (Day 1)

**Container:**
```
container_id: "day1-ch1"
container_type: "chapter"
title: "How Search Engines Work & Search Intent Fundamentals"
is_dedicated_topic_chapter: false
primary_topic: "SEO Fundamentals"
```

**Nodes:**

**Node 1:**
```
canonical_reference: "D1.C1.C1"
day: 1
container_id: "day1-ch1"
sequence_number: 1
content: "Search engines use algorithms to understand user queries and match them with relevant content."
primary_topic: "SEO Fundamentals"
reference_type: "concept"
is_dedicated_topic_node: false
```

### 3.3 Example: Lab (Day 1)

**Container:**
```
container_id: "day1-lab1"
container_type: "lab"
title: "Keyword Research Lab"
```

**Nodes:**

**Node 1:**
```
canonical_reference: "D1.L1.S1"
day: 1
container_id: "day1-lab1"
sequence_number: 1
content: "Step 1: Identify your target keywords using keyword research tools."
reference_type: "step"
```

**Node 2:**
```
canonical_reference: "D1.L1.S2"
day: 1
container_id: "day1-lab1"
sequence_number: 2
content: "Step 2: Analyze search volume and competition for each keyword."
reference_type: "step"
```

### 3.4 Reference Assembly Example

**Query:** "What are the key differences for success in case of Answer Engine Optimization?"

**Retrieved Nodes:**
1. `D20.C1.C1` (AEO definition) - relevance: 0.95
2. `D20.C1.S1` (User Intent) - relevance: 0.92
3. `D20.C1.S2` (Structured Content) - relevance: 0.90
4. `D20.C1.S3` (SERP Analysis) - relevance: 0.88
5. `D20.C1.S4` (Zero-Click Searches) - relevance: 0.85

**System-Assembled References:**
```json
{
  "primary_reference": {
    "canonical_reference": "D20.C1.C1",
    "day": 20,
    "container_type": "chapter",
    "container_id": "day20-ch1",
    "container_title": "Answer Engine Optimization (AEO)",
    "sequence_number": 1,
    "display": "Day 20 → Chapter 1 → Concept 1"
  },
  "secondary_references": [
    {
      "canonical_reference": "D20.C1.S1",
      "display": "Day 20 → Chapter 1 → Step 1"
    },
    {
      "canonical_reference": "D20.C1.S2",
      "display": "Day 20 → Chapter 1 → Step 2"
    }
  ]
}
```

**LLM Output:**
- Answer text (NO references)
- System adds references from node IDs

---

## Section 4: Migration Strategy

### 4.1 Content Ingestion Pipeline

**New Pipeline:**
1. Parse markdown file
2. Identify atomic units (paragraphs, list items, steps)
3. Assign canonical references
4. Create container metadata
5. Store nodes with embeddings
6. Link nodes to containers

**Script:** `scripts/ingest-atomic-content.js`

### 4.2 Retrieval Service Changes

**Current:**
```javascript
// Returns chunks
const chunks = await hybridSearch(query, courseId);
```

**New:**
```javascript
// Returns atomic nodes with canonical references
const nodes = await hybridSearch(query, courseId);
// nodes[0].canonical_reference = "D20.C1.C1"
// nodes[0].day = 20
// nodes[0].container_id = "day20-ch1"
```

### 4.3 Reference Assembly (No LLM)

**Current (Problematic):**
```javascript
// LLM generates references (WRONG)
const answer = await llm.generateAnswer(...);
// answer contains "Day X → Chapter Y" (hallucinated)
```

**New (System-Owned):**
```javascript
// 1. Retrieve nodes
const nodes = await retrievalService.searchNodes(query, courseId);

// 2. Generate answer (NO references in prompt)
const answer = await llm.generateAnswer(query, nodes, {
  ...systemPrompt,
  noReferences: true // Explicitly forbid references
});

// 3. Assemble references from node IDs (SYSTEM-OWNED)
const references = nodes.map(node => ({
  canonical_reference: node.canonical_reference,
  day: node.day,
  container_type: node.container_type,
  container_id: node.container_id,
  container_title: node.container_title,
  sequence_number: node.sequence_number
}));

// 4. Return answer + system-assembled references
return { answer, references };
```

---

## Section 5: Benefits

### 5.1 Eliminates Reference Hallucination

**Before:**
- LLM sees chunk: "Day 1, Chapter 1 - 2000 words"
- LLM infers: "This is about Day 1, Chapter 1"
- Problem: Chunk might mention Day 20 content
- Result: Wrong reference

**After:**
- System retrieves node: `D20.C1.C1`
- System knows: Day 20, Chapter 1, Concept 1
- No inference needed
- Result: Correct reference

### 5.2 Precise Citations

**Before:**
- "Day 1 → Chapter 1" (entire chapter, ambiguous)

**After:**
- "Day 20 → Chapter 1 → Concept 1" (specific idea)
- Can cite multiple concepts from same chapter

### 5.3 Better Retrieval

**Before:**
- Large chunks = mixed topics
- Hard to find specific information

**After:**
- Atomic nodes = focused topics
- Easier to find exact information
- Better semantic matching

### 5.4 Scalability

**Before:**
- Adding content = re-chunking everything
- Chunk boundaries are arbitrary

**After:**
- Adding content = adding nodes
- Node boundaries are semantic
- Easy to update individual nodes

---

## Section 6: Implementation Checklist

- [ ] Create `content_nodes` table
- [ ] Create `content_containers` table
- [ ] Create `content_node_references` table
- [ ] Build atomic content ingestion pipeline
- [ ] Update retrieval service to return nodes
- [ ] Update reference assembly to use canonical references
- [ ] Remove LLM reference generation from prompts
- [ ] Migrate existing content to atomic nodes
- [ ] Update AI Coach service to use new schema
- [ ] Add tests for reference correctness

---

## Conclusion

This architecture eliminates reference hallucination by:
1. **Atomic nodes** = one idea per node
2. **Canonical references** = deterministic, never inferred
3. **System-owned assembly** = references from node IDs, not LLM
4. **Containers as metadata** = organizational, not knowledge units

**Result:** Every reference is accurate, precise, and system-verified.

