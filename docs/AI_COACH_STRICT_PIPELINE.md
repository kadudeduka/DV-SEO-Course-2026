# AI Coach Strict Two-Step Pipeline

## Executive Summary

This document defines a **strict two-step pipeline** for AI Coach answer generation that eliminates reference hallucination by separating reference resolution (system logic) from answer generation (LLM with strict constraints).

**Core Principle:** LLM never invents references. Every answer either cites canonical references or explicitly states "Not covered in course material."

---

## Section 1: End-to-End Flow Diagram

### 1.1 Complete Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER QUESTION INPUT                           │
│              "What is AEO?" or "Step 3 of Lab 1"                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 1: REFERENCE RESOLUTION                  │
│                    (System Logic Only - No LLM)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────────┐          ┌──────────────────────────┐
│ 1.1: Explicit Reference│          │ 1.2: Semantic Search      │
│      Resolution        │          │      (Fallback)           │
│                       │          │                           │
│ Pattern Matching      │          │ Vector Similarity Search   │
│ Registry Lookup       │          │ Keyword Search            │
│                       │          │                           │
│ Output: Node IDs      │          │ Output: Node IDs          │
│ ["D20.C1.C1", ...]    │          │ ["D20.C1.C1", ...]         │
└───────────┬───────────┘          └───────────┬───────────────┘
            │                                   │
            └───────────────────┬───────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ 1.3: Node Validation │
                    │                       │
                    │ - Check if nodes     │
                    │   exist in registry  │
                    │ - Verify is_valid    │
                    │ - Filter by course   │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ 1.4: Content Retrieval│
                    │                       │
                    │ Fetch full content   │
                    │ for each node ID     │
                    │                       │
                    │ Output:              │
                    │ [                    │
                    │   {                  │
                    │     canonical_ref:   │
                    │       "D20.C1.C1",   │
                    │     content: "...",  │
                    │     display_ref:     │
                    │       "Day 20 → ..." │
                    │   },                 │
                    │   ...                │
                    │ ]                    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ 1.5: Decision Gate    │
                    │                       │
                    │ IF nodes.length > 0:  │
                    │   → Proceed to Step 2 │
                    │ ELSE:                 │
                    │   → Return:           │
                    │     "Not covered in   │
                    │      course material" │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌───────────────────┐   ┌──────────────────────┐
        │  Nodes Found       │   │  No Nodes Found       │
        │  → Step 2         │   │  → Return Early       │
        └───────────┬─────────┘   └──────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 2: ANSWER GENERATION                     │
│                    (LLM with Strict Constraints)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ 2.1: Build Strict System Prompt      │
        │                                       │
        │ - Forbid reference generation         │
        │ - Require citation of provided refs  │
        │ - No creative liberty                │
        │ - Use only provided content          │
        └───────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │ 2.2: Prepare Context                   │
        │                                       │
        │ - Include ONLY resolved node content  │
        │ - Include canonical references        │
        │ - Include display references          │
        │ - NO other content                    │
        └───────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │ 2.3: LLM Generation                    │
        │                                       │
        │ Input:                                │
        │ - System prompt (strict)              │
        │ - User question                       │
        │ - Resolved node content               │
        │                                       │
        │ Output:                               │
        │ - Answer text (NO references)          │
        └───────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │ 2.4: Reference Stripping              │
        │                                       │
        │ - Remove any LLM-generated refs      │
        │ - Log warnings if found              │
        │ - Proceed with system refs only      │
        └───────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │ 2.5: System Reference Assembly        │
        │                                       │
        │ - Select primary reference            │
        │ - Select secondary references         │
        │ - Format display references           │
        │ - Attach to answer                    │
        └───────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │ 2.6: Final Answer Assembly            │
        │                                       │
        │ {                                     │
        │   answer: "...",                      │
        │   references: [                       │
        │     {                                 │
        │       canonical: "D20.C1.C1",        │
        │       display: "Day 20 → ...",       │
        │       is_primary: true               │
        │     }                                 │
        │   ],                                  │
        │   confidence: 1.0,                    │
        │   source: "resolved_nodes"            │
        │ }                                     │
        └───────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────────────┐
        │              FINAL OUTPUT              │
        │                                       │
        │ Answer with system-owned references   │
        └───────────────────────────────────────┘
```

### 1.2 Decision Points

**Decision 1: Explicit Reference Found?**
- YES → Use explicit resolution
- NO → Fall back to semantic search

**Decision 2: Nodes Found?**
- YES → Proceed to Step 2
- NO → Return "Not covered in course material"

**Decision 3: LLM Generated References?**
- YES → Strip them, use system references only
- NO → Proceed with system references

---

## Section 2: Step 1 - Reference Resolution (System Logic)

### 2.1 Explicit Reference Resolution

```javascript
/**
 * Step 1.1: Resolve explicit references
 */
async function resolveExplicitReferences(question, courseId) {
    const resolver = new ReferenceResolutionService(supabaseClient);
    const result = await resolver.resolve(question, courseId);
    
    if (result.resolved_nodes.length > 0) {
        console.log(`[Pipeline] Resolved ${result.resolved_nodes.length} explicit references`);
        return {
            source: 'explicit',
            nodeIds: result.resolved_nodes,
            confidence: result.confidence
        };
    }
    
    return null;
}
```

### 2.2 Semantic Search (Fallback)

```javascript
/**
 * Step 1.2: Semantic search (fallback)
 */
async function semanticSearchFallback(question, courseId, userId) {
    const retrievalService = new RetrievalService(supabaseClient, llmService);
    
    // Perform hybrid search
    const chunks = await retrievalService.hybridSearch(question, courseId, userId);
    
    if (chunks.length === 0) {
        return null;
    }
    
    // Extract canonical references from chunks
    const nodeIds = chunks
        .map(chunk => chunk.canonical_reference)
        .filter(ref => ref && ref.startsWith('D')); // Valid canonical format
    
    console.log(`[Pipeline] Found ${nodeIds.length} nodes via semantic search`);
    
    return {
        source: 'semantic',
        nodeIds: nodeIds,
        confidence: chunks[0].similarity || 0.7
    };
}
```

### 2.3 Node Validation

```javascript
/**
 * Step 1.3: Validate and filter nodes
 */
async function validateNodes(nodeIds, courseId) {
    const { data: nodes, error } = await supabaseClient
        .from('canonical_reference_registry')
        .select('*')
        .in('canonical_reference', nodeIds)
        .eq('course_id', courseId)
        .eq('is_valid', true);
    
    if (error) {
        throw new Error(`Failed to validate nodes: ${error.message}`);
    }
    
    const validNodeIds = nodes.map(n => n.canonical_reference);
    const invalidNodeIds = nodeIds.filter(id => !validNodeIds.includes(id));
    
    if (invalidNodeIds.length > 0) {
        console.warn(`[Pipeline] Invalid nodes filtered: ${invalidNodeIds.join(', ')}`);
    }
    
    return validNodeIds;
}
```

### 2.4 Content Retrieval

```javascript
/**
 * Step 1.4: Retrieve full content for nodes
 */
async function retrieveNodeContent(nodeIds, courseId) {
    const { data: nodes, error } = await supabaseClient
        .from('content_nodes')
        .select('*')
        .in('canonical_reference', nodeIds)
        .eq('course_id', courseId)
        .eq('is_valid', true)
        .order('day', { ascending: true })
        .order('sequence_number', { ascending: true });
    
    if (error) {
        throw new Error(`Failed to retrieve node content: ${error.message}`);
    }
    
    // Format for LLM context
    const formattedNodes = nodes.map(node => ({
        canonical_reference: node.canonical_reference,
        display_reference: formatDisplayReference(node),
        content: node.content,
        day: node.day,
        container_type: node.container_type,
        container_id: node.container_id,
        container_title: node.container_title,
        sequence_number: node.sequence_number,
        primary_topic: node.primary_topic
    }));
    
    return formattedNodes;
}

function formatDisplayReference(node) {
    const day = node.day;
    const containerType = node.container_type;
    const containerId = node.container_id;
    
    // Extract container number
    const match = containerId.match(/(?:ch|lab)(\d+)/);
    const containerNum = match ? match[1] : '?';
    
    // Format node type
    const nodeTypeLabel = {
        'step': 'Step',
        'concept': 'Concept',
        'example': 'Example',
        'definition': 'Definition',
        'procedure': 'Procedure',
        'list_item': 'Item',
        'heading': 'Section'
    }[node.node_type] || 'Section';
    
    if (containerType === 'chapter') {
        return `Day ${day} → Chapter ${containerNum} → ${nodeTypeLabel} ${node.sequence_number}`;
    } else if (containerType === 'lab') {
        return `Day ${day} → Lab ${containerNum} → Step ${node.sequence_number}`;
    }
    
    return `${node.container_title} → ${nodeTypeLabel} ${node.sequence_number}`;
}
```

### 2.5 Decision Gate

```javascript
/**
 * Step 1.5: Decision gate
 */
async function step1ReferenceResolution(question, courseId, userId) {
    // Try explicit resolution first
    let resolution = await resolveExplicitReferences(question, courseId);
    
    // Fallback to semantic search
    if (!resolution || resolution.nodeIds.length === 0) {
        resolution = await semanticSearchFallback(question, courseId, userId);
    }
    
    // No nodes found
    if (!resolution || resolution.nodeIds.length === 0) {
        return {
            proceed: false,
            answer: "I don't have information about this topic in the course material. Please check with your trainer or refer to the course content directly.",
            references: [],
            confidence: 0.0
        };
    }
    
    // Validate nodes
    const validNodeIds = await validateNodes(resolution.nodeIds, courseId);
    
    if (validNodeIds.length === 0) {
        return {
            proceed: false,
            answer: "I don't have information about this topic in the course material. Please check with your trainer or refer to the course content directly.",
            references: [],
            confidence: 0.0
        };
    }
    
    // Retrieve content
    const nodes = await retrieveNodeContent(validNodeIds, courseId);
    
    return {
        proceed: true,
        nodes: nodes,
        source: resolution.source,
        confidence: resolution.confidence
    };
}
```

---

## Section 3: Step 2 - Answer Generation (LLM Strict Mode)

### 3.1 Strict System Prompt

```javascript
/**
 * Build strict system prompt
 */
function buildStrictSystemPrompt(nodes) {
    const nodeList = nodes.map((node, index) => {
        return `[Reference ${index + 1}]
Canonical ID: ${node.canonical_reference}
Display: ${node.display_reference}
Content: ${node.content}`;
    }).join('\n\n');
    
    return `You are an AI Coach helping learners understand course material.

CRITICAL RULES (NON-NEGOTIABLE):

1. REFERENCE GENERATION IS FORBIDDEN
   - You MUST NOT include any references (Day X, Chapter Y, Lab Z) in your answer
   - You MUST NOT mention specific course locations
   - You MUST NOT create or infer references
   - The system will automatically add references based on the content you use

2. CONTENT RESTRICTION
   - You MUST use ONLY the provided content below
   - You MUST NOT add information not present in the provided content
   - You MUST NOT make assumptions beyond what is explicitly stated
   - If the provided content doesn't answer the question, say: "The provided course material doesn't cover this specific aspect. Please refer to the course content or ask your trainer."

3. ANSWER STRUCTURE
   - Provide a clear, direct answer
   - Use the exact terminology from the course material
   - Maintain the course's teaching style and framework
   - If multiple concepts are relevant, organize them logically

4. CITATION REQUIREMENT
   - You do NOT need to cite references (system will add them)
   - Focus ONLY on explaining the content clearly
   - Do NOT include phrases like "as mentioned in", "refer to", "see Chapter X"

5. OUT-OF-SCOPE HANDLING
   - If the question cannot be answered with the provided content, explicitly state:
     "This topic is not covered in the provided course material. Please check with your trainer or refer to the course content directly."
   - Do NOT attempt to answer using general knowledge if it's not in the provided content

PROVIDED COURSE CONTENT:
${nodeList}

Remember: Your answer will be automatically paired with the correct references by the system. Focus only on explaining the content clearly and accurately.`;
}
```

### 3.2 User Prompt

```javascript
/**
 * Build user prompt
 */
function buildUserPrompt(question) {
    return `Question: ${question}

Instructions:
- Answer the question using ONLY the provided course content
- Do NOT include any references in your answer
- If the content doesn't answer the question, state that explicitly
- Use clear, direct language`;
}
```

### 3.3 LLM Generation

```javascript
/**
 * Step 2.3: Generate answer with LLM
 */
async function generateAnswerStrict(question, nodes, llmService) {
    const systemPrompt = buildStrictSystemPrompt(nodes);
    const userPrompt = buildUserPrompt(question);
    
    const answer = await llmService.generateAnswer({
        systemPrompt: systemPrompt,
        userPrompt: userPrompt,
        maxTokens: 1000,
        temperature: 0.3 // Lower temperature for more deterministic answers
    });
    
    return answer;
}
```

### 3.4 Reference Stripping

```javascript
/**
 * Step 2.4: Strip any LLM-generated references
 */
function stripLLMReferences(answer) {
    let cleaned = answer;
    const patterns = [
        /Day\s+\d+\s*→\s*Chapter\s+[\w\d-]+/gi,
        /Chapter\s+[\w\d-]+/gi,
        /Day\s+\d+/gi,
        /Lab\s+[\w\d-]+/gi,
        /\b(refer to|see|consult|as mentioned in|according to)\s+(Day|Chapter|Lab)\s+[\w\d-]+/gi,
        /\(Day\s+\d+[^)]*\)/gi,
        /\[Day\s+\d+[^\]]*\]/gi
    ];
    
    const foundRefs = [];
    for (const pattern of patterns) {
        const matches = cleaned.match(pattern);
        if (matches) {
            foundRefs.push(...matches);
            cleaned = cleaned.replace(pattern, '');
        }
    }
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    cleaned = cleaned.replace(/(\s*[,.;:]\s*){2,}/g, (match) => {
        return match.trim();
    });
    
    if (foundRefs.length > 0) {
        console.warn(`[Pipeline] Stripped ${foundRefs.length} LLM-generated references:`, foundRefs);
    }
    
    return cleaned;
}
```

### 3.5 System Reference Assembly

```javascript
/**
 * Step 2.5: Assemble system-owned references
 */
function assembleSystemReferences(nodes) {
    if (nodes.length === 0) {
        return {
            primary: null,
            secondary: []
        };
    }
    
    // Select primary reference (first node, or most relevant)
    const primary = {
        canonical_reference: nodes[0].canonical_reference,
        display_reference: nodes[0].display_reference,
        day: nodes[0].day,
        container_type: nodes[0].container_type,
        container_id: nodes[0].container_id,
        container_title: nodes[0].container_title,
        sequence_number: nodes[0].sequence_number,
        is_primary: true
    };
    
    // Secondary references (rest of nodes, limit to 5)
    const secondary = nodes.slice(1, 6).map(node => ({
        canonical_reference: node.canonical_reference,
        display_reference: node.display_reference,
        day: node.day,
        container_type: node.container_type,
        container_id: node.container_id,
        container_title: node.container_title,
        is_primary: false
    }));
    
    return {
        primary: primary,
        secondary: secondary
    };
}
```

### 3.6 Final Answer Assembly

```javascript
/**
 * Step 2.6: Assemble final answer
 */
function assembleFinalAnswer(answer, references, confidence, source) {
    return {
        answer: answer,
        references: [
            references.primary,
            ...references.secondary
        ].filter(ref => ref !== null),
        confidence: confidence,
        source: source,
        has_references: references.primary !== null,
        reference_count: references.secondary.length + (references.primary ? 1 : 0)
    };
}
```

### 3.7 Complete Step 2 Function

```javascript
/**
 * Step 2: Generate answer with strict constraints
 */
async function step2AnswerGeneration(question, nodes, llmService) {
    // Build strict prompts
    const systemPrompt = buildStrictSystemPrompt(nodes);
    const userPrompt = buildUserPrompt(question);
    
    // Generate answer
    let answer = await llmService.generateAnswer({
        systemPrompt: systemPrompt,
        userPrompt: userPrompt,
        maxTokens: 1000,
        temperature: 0.3
    });
    
    // Strip any LLM-generated references
    answer = stripLLMReferences(answer);
    
    // Assemble system references
    const references = assembleSystemReferences(nodes);
    
    // Assemble final answer
    const finalAnswer = assembleFinalAnswer(
        answer,
        references,
        1.0, // High confidence when using resolved nodes
        'resolved_nodes'
    );
    
    return finalAnswer;
}
```

---

## Section 4: Complete Pipeline Integration

### 4.1 Main Pipeline Function

```javascript
/**
 * Complete strict two-step pipeline
 */
async function processQueryStrict(question, courseId, userId, llmService, supabaseClient) {
    console.log(`[Pipeline] Processing query: "${question}"`);
    
    try {
        // STEP 1: Reference Resolution
        console.log('[Pipeline] Step 1: Reference Resolution');
        const step1Result = await step1ReferenceResolution(question, courseId, userId);
        
        if (!step1Result.proceed) {
            // No nodes found - return early
            console.log('[Pipeline] No nodes found, returning early response');
            return {
                answer: step1Result.answer,
                references: [],
                confidence: 0.0,
                source: 'no_nodes',
                has_references: false
            };
        }
        
        console.log(`[Pipeline] Step 1 complete: ${step1Result.nodes.length} nodes resolved via ${step1Result.source}`);
        
        // STEP 2: Answer Generation
        console.log('[Pipeline] Step 2: Answer Generation');
        const step2Result = await step2AnswerGeneration(
            question,
            step1Result.nodes,
            llmService
        );
        
        console.log(`[Pipeline] Step 2 complete: Answer generated with ${step2Result.reference_count} references`);
        
        return step2Result;
        
    } catch (error) {
        console.error('[Pipeline] Error processing query:', error);
        return {
            answer: "I encountered an error processing your question. Please try again or contact your trainer.",
            references: [],
            confidence: 0.0,
            source: 'error',
            has_references: false,
            error: error.message
        };
    }
}
```

---

## Section 5: Example Q → Nodes → Answer

### 5.1 Example 1: Explicit Reference

**Input Question:**
```
"Step 3 of Lab 1 on Day 20"
```

**Step 1: Reference Resolution**
```javascript
// Explicit reference resolution
{
    source: 'explicit',
    nodeIds: ['D20.L1.S3'],
    confidence: 1.0
}

// Node content retrieved
[
    {
        canonical_reference: 'D20.L1.S3',
        display_reference: 'Day 20 → Lab 1 → Step 3',
        content: 'Step 3: Analyze the SERP features for your target keyword. Identify which features are present (featured snippets, People Also Ask, etc.) and note their characteristics.',
        day: 20,
        container_type: 'lab',
        container_id: 'day20-lab1',
        container_title: 'AEO Lab 1',
        sequence_number: 3,
        primary_topic: 'AEO'
    }
]
```

**Step 2: Answer Generation**

**System Prompt:**
```
You are an AI Coach helping learners understand course material.

CRITICAL RULES (NON-NEGOTIABLE):

1. REFERENCE GENERATION IS FORBIDDEN
   - You MUST NOT include any references (Day X, Chapter Y, Lab Z) in your answer
   ...

PROVIDED COURSE CONTENT:
[Reference 1]
Canonical ID: D20.L1.S3
Display: Day 20 → Lab 1 → Step 3
Content: Step 3: Analyze the SERP features for your target keyword. Identify which features are present (featured snippets, People Also Ask, etc.) and note their characteristics.
```

**LLM Answer (before stripping):**
```
To complete Step 3, you need to analyze the SERP features for your target keyword. This involves identifying which features are present on the search results page, such as featured snippets and People Also Ask sections, and noting their specific characteristics.
```

**After Reference Stripping:**
```
To complete Step 3, you need to analyze the SERP features for your target keyword. This involves identifying which features are present on the search results page, such as featured snippets and People Also Ask sections, and noting their specific characteristics.
```

**Final Output:**
```json
{
    "answer": "To complete Step 3, you need to analyze the SERP features for your target keyword. This involves identifying which features are present on the search results page, such as featured snippets and People Also Ask sections, and noting their specific characteristics.",
    "references": [
        {
            "canonical_reference": "D20.L1.S3",
            "display_reference": "Day 20 → Lab 1 → Step 3",
            "day": 20,
            "container_type": "lab",
            "container_id": "day20-lab1",
            "container_title": "AEO Lab 1",
            "sequence_number": 3,
            "is_primary": true
        }
    ],
    "confidence": 1.0,
    "source": "resolved_nodes",
    "has_references": true,
    "reference_count": 1
}
```

### 5.2 Example 2: Semantic Search

**Input Question:**
```
"What is AEO?"
```

**Step 1: Reference Resolution**
```javascript
// Explicit reference resolution fails
{
    source: 'explicit',
    nodeIds: [],
    confidence: 0.0
}

// Fallback to semantic search
{
    source: 'semantic',
    nodeIds: ['D20.C1.C1', 'D20.C1.C2', 'D20.C1.L1'],
    confidence: 0.85
}

// Node content retrieved
[
    {
        canonical_reference: 'D20.C1.C1',
        display_reference: 'Day 20 → Chapter 1 → Concept 1',
        content: 'AEO, or "Answer Engine Optimization," refers to the practice of optimizing content to ensure it effectively answers user queries, particularly in the context of search engines that prioritize providing direct answers to users.',
        day: 20,
        container_type: 'chapter',
        container_id: 'day20-ch1',
        container_title: 'Answer Engine Optimization (AEO)',
        sequence_number: 1,
        primary_topic: 'AEO'
    },
    {
        canonical_reference: 'D20.C1.C2',
        display_reference: 'Day 20 → Chapter 1 → Concept 2',
        content: 'AEO emphasizes understanding what users are looking for when they search, ensuring that content aligns with their needs.',
        day: 20,
        container_type: 'chapter',
        container_id: 'day20-ch1',
        container_title: 'Answer Engine Optimization (AEO)',
        sequence_number: 2,
        primary_topic: 'AEO'
    },
    {
        canonical_reference: 'D20.C1.L1',
        display_reference: 'Day 20 → Chapter 1 → Item 1',
        content: 'Focus on User Intent: AEO emphasizes understanding what users are looking for when they search, ensuring that content aligns with their needs.',
        day: 20,
        container_type: 'chapter',
        container_id: 'day20-ch1',
        container_title: 'Answer Engine Optimization (AEO)',
        sequence_number: 3,
        primary_topic: 'AEO'
    }
]
```

**Step 2: Answer Generation**

**LLM Answer:**
```
AEO, or Answer Engine Optimization, is the practice of optimizing content to ensure it effectively answers user queries. Search engines prioritize providing direct answers to users, and AEO focuses on aligning content with user needs and intent. The key is understanding what users are looking for when they search and ensuring your content directly addresses those needs.
```

**Final Output:**
```json
{
    "answer": "AEO, or Answer Engine Optimization, is the practice of optimizing content to ensure it effectively answers user queries. Search engines prioritize providing direct answers to users, and AEO focuses on aligning content with user needs and intent. The key is understanding what users are looking for when they search and ensuring your content directly addresses those needs.",
    "references": [
        {
            "canonical_reference": "D20.C1.C1",
            "display_reference": "Day 20 → Chapter 1 → Concept 1",
            "day": 20,
            "container_type": "chapter",
            "container_id": "day20-ch1",
            "container_title": "Answer Engine Optimization (AEO)",
            "sequence_number": 1,
            "is_primary": true
        },
        {
            "canonical_reference": "D20.C1.C2",
            "display_reference": "Day 20 → Chapter 1 → Concept 2",
            "day": 20,
            "container_type": "chapter",
            "container_id": "day20-ch1",
            "container_title": "Answer Engine Optimization (AEO)",
            "sequence_number": 2,
            "is_primary": false
        },
        {
            "canonical_reference": "D20.C1.L1",
            "display_reference": "Day 20 → Chapter 1 → Item 1",
            "day": 20,
            "container_type": "chapter",
            "container_id": "day20-ch1",
            "container_title": "Answer Engine Optimization (AEO)",
            "sequence_number": 3,
            "is_primary": false
        }
    ],
    "confidence": 0.85,
    "source": "resolved_nodes",
    "has_references": true,
    "reference_count": 3
}
```

### 5.3 Example 3: No Nodes Found

**Input Question:**
```
"How do I implement machine learning for SEO?"
```

**Step 1: Reference Resolution**
```javascript
// Explicit reference resolution fails
{
    source: 'explicit',
    nodeIds: [],
    confidence: 0.0
}

// Semantic search also fails (no relevant content)
{
    source: 'semantic',
    nodeIds: [],
    confidence: 0.0
}

// Decision gate: No nodes found
{
    proceed: false,
    answer: "I don't have information about this topic in the course material. Please check with your trainer or refer to the course content directly.",
    references: [],
    confidence: 0.0
}
```

**Final Output:**
```json
{
    "answer": "I don't have information about this topic in the course material. Please check with your trainer or refer to the course content directly.",
    "references": [],
    "confidence": 0.0,
    "source": "no_nodes",
    "has_references": false,
    "reference_count": 0
}
```

---

## Section 6: Implementation Checklist

- [ ] Implement `ReferenceResolutionService` (Step 1.1)
- [ ] Implement semantic search fallback (Step 1.2)
- [ ] Implement node validation (Step 1.3)
- [ ] Implement content retrieval (Step 1.4)
- [ ] Implement decision gate (Step 1.5)
- [ ] Build strict system prompt (Step 2.1)
- [ ] Implement LLM generation with strict constraints (Step 2.3)
- [ ] Implement reference stripping (Step 2.4)
- [ ] Implement system reference assembly (Step 2.5)
- [ ] Integrate complete pipeline
- [ ] Add logging and monitoring
- [ ] Add error handling
- [ ] Add tests for each step
- [ ] Add integration tests

---

## Section 7: Key Differences from Current System

### 7.1 Current System Issues

1. **LLM generates references** → Causes hallucination
2. **No strict separation** → References mixed with content
3. **Vague citations** → "Day 1 → Chapter 1" when should be "Day 20 → Chapter 1"
4. **Creative liberty** → LLM adds information not in course

### 7.2 New System Benefits

1. **System-owned references** → No LLM involvement
2. **Strict two-step separation** → Resolution → Generation
3. **Explicit citations** → Canonical references only
4. **No creative liberty** → LLM uses only provided content
5. **Early exit** → "Not covered" when no nodes found

---

## Conclusion

The strict two-step pipeline ensures:
1. **No reference hallucination** - LLM never generates references
2. **Deterministic resolution** - System logic only
3. **Explicit citations** - Canonical references only
4. **Clear boundaries** - Either cites references or says "Not covered"
5. **No vague citations** - Every reference is explicit and verifiable

**Result**: Permanent solution to reference correctness issues.

