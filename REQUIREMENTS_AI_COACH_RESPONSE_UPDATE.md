# Requirements: AI Coach Response Update

## Document Information
- **Created**: [Current Date]
- **Status**: Requirements Gathering
- **Purpose**: Define requirements for improving AI Coach response quality, accuracy, and comprehensiveness

---

## Executive Summary

The AI Coach currently has issues with:
1. **Reference Accuracy**: Answers point to incorrect locations in the course (e.g., referencing earlier chapters when topics are covered in depth in later chapters)
2. **Answer Comprehensiveness**: Answers are too brief and lack the depth and structure learners expect
3. **Content Context Understanding**: The system doesn't adequately understand course progression and where topics are most thoroughly covered
4. **Answer Relevance**: Answers include unnecessary details (e.g., lab assignment logistics) when questions are about concepts or techniques
5. **Context Matching**: Answers reference completely wrong content when questions mention specific references (e.g., Day 2 Lab 1 Step 3 answered with Day 15 content)
6. **Content Extraction**: "List" requests don't extract all items comprehensively, and references don't match the chapter mentioned in questions
7. **Conversation History**: Learners need better access to view and manage their previous Q&As with AI Coach

This document outlines requirements to address these issues without implementation details or design specifications.

---

## Problem Statement

### Current Issues

#### Issue 1: Incorrect Reference Locations

**Example Problem 1:**
- **Question**: "What are the key differences for success in case of Answer Engine Optimization?"
- **Current Behavior**: Answer references Day 2 → Chapter "How Search Engines Work & Search Intent Fundamentals" (an earlier, foundational chapter)
- **Expected Behavior**: Answer should reference the later chapter(s) where AEO is covered in depth

**Example Problem 2:**
- **Question**: "How's Ecommerce SEO different from a normal website SEO?"
- **Current Behavior**: Answer references Day 2 → Chapter 2 "SERP Analysis and Zero-Click Searches" (a general SEO chapter)
- **Expected Behavior**: Answer should reference the dedicated "Ecommerce SEO" chapter that exists in the course
- **Issue**: System fails to identify that there's a dedicated chapter for the topic and instead references a general chapter that mentions the topic tangentially

**Example Problem 3:**
- **Question**: "What are the key elements of success for technical SEO?"
- **Current Behavior**: Answer references Day 1 → Chapter 3 "Technical SEO Terms" (where Technical SEO is first mentioned/introduced)
- **Expected Behavior**: Answer should reference the dedicated "Technical SEO" chapter that exists later in the course
- **Issue**: System prioritizes the first mention of a topic over the dedicated chapter that comprehensively covers it

**Root Causes:**
- Chunk retrieval prioritizes semantic similarity over topic depth/completeness
- No mechanism to identify where topics are "covered in depth" vs. "introduced"
- No mechanism to identify dedicated chapters for specific topics vs. general chapters that mention topics
- **System incorrectly prioritizes "first mention" of a topic over dedicated/comprehensive chapters**
- References are extracted from all retrieved chunks without prioritizing the most comprehensive or dedicated source
- System doesn't distinguish between "topic mentioned in general context" vs. "topic is the main focus of chapter"
- System doesn't distinguish between "topic first introduced" vs. "topic comprehensively covered"

#### Issue 2: Insufficient Answer Comprehensiveness
**Example Problem:**
- **Current Answer**: Brief 2-3 bullet points with minimal detail
- **Expected Answer**: Comprehensive, structured response with:
  - Clear answer-first mindset explanation
  - Multiple key differences (7-10 points)
  - Structured format (headings, lists, comparisons)
  - Clear distinctions (e.g., "SEO = ranking pages, AEO = becoming the answer")

**Root Causes:**
- Token limits (2000 tokens for context, 500 max tokens for response) restrict answer depth
- System prompt emphasizes conciseness over completeness
- LLM not instructed to expand on course content when appropriate
- Chunk selection may miss comprehensive content sections

#### Issue 3: Lack of Course Structure Awareness
**Root Causes:**
- No metadata about topic progression (introduction vs. deep dive)
- No understanding of chapter relationships (prerequisites, advanced topics)
- Chunk prioritization doesn't consider where topics are "most thoroughly explained"

#### Issue 4: Answer Relevance and Conciseness
**Example Problem:**
- **Question**: "How to use the 'site:' operator effectively?"
- **Current Behavior**: Answer includes unnecessary details about documentation, submission templates, and lab-specific instructions
- **Expected Behavior**: Answer should be:
  - To the point and focused on what was asked
  - Point-based structure highlighting key points
  - Concise without missing essential details
  - Exclude lab-specific instructions (documentation, submission templates) unless explicitly asked
  - Focus on the core concept/technique, not assignment logistics

**Root Causes:**
- System prompt doesn't distinguish between conceptual questions vs. lab assignment questions
- Answers include context from lab chunks even when question is about the concept itself
- No filtering mechanism to exclude assignment-specific details (documentation, templates, submission steps)
- LLM doesn't understand when to provide "how-to" vs. "assignment instructions"

#### Issue 5: Incorrect Content Retrieval for Specific References
**Example Problem:**
- **Question**: "I am not able to do Step 3 of Lab 1 on Day 2. Please help"
- **Current Behavior**: Answer references Day 15 → Chapter 1 (completely wrong content)
- **Expected Behavior**: Answer should reference Day 2 → Lab 1 → Step 3 (the specific content mentioned in the question)
- **Issue**: System completely misses the specific context (Day 2, Lab 1, Step 3) and retrieves unrelated content from a different day/chapter

**Root Causes:**
- System doesn't parse and extract specific references from questions (Day X, Lab Y, Step Z)
- Chunk retrieval doesn't prioritize exact matches for specific lab/step references
- No validation that retrieved content matches the question context
- Semantic search may match similar concepts from wrong locations instead of exact location references
- System doesn't understand structured references like "Day 2 Lab 1 Step 3"

#### Issue 6: Incomplete Content Extraction and Listing
**Example Problem:**
- **Question**: "List the examples covered in 'Day 4, Chapter 2 — Keyword-to-Page Mapping and Cannibalization Prevention'"
- **Current Behavior**: 
  - Provides brief summary with only 3 examples (incomplete)
  - References wrong chapter (Day 1 → Chapter 4 instead of Day 4 → Chapter 2)
  - Doesn't extract and list all examples comprehensively
- **Expected Behavior**: 
  - Extract ALL examples from the specified chapter (Day 4, Chapter 2)
  - List them comprehensively and concisely
  - Reference the correct chapter (Day 4 → Chapter 2)
  - Provide complete list, not just a summary

**Root Causes:**
- System doesn't properly handle "list" requests - treats them as general questions
- Incomplete content extraction from specified chapters
- No mechanism to extract all examples/list items from a chapter when explicitly asked
- References don't match the chapter explicitly mentioned in the question
- Chunk retrieval may miss some examples or only retrieve partial content
- LLM doesn't understand that "list" means extract and enumerate all items

---

## Requirements

### R1: Enhanced Chunk Storage and Metadata

#### R1.1: Topic Depth Metadata
**Requirement**: Store metadata indicating the depth/level at which a topic is covered in each chunk.

**Details:**
- Each chunk must have a `topic_depth` or `coverage_level` field indicating:
  - `introduction`: Topic is introduced or mentioned briefly
  - `intermediate`: Topic is explained with moderate detail
  - `comprehensive`: Topic is covered in depth with full explanation
  - `advanced`: Topic is covered at an advanced level
- This metadata should be derived from:
  - Chapter position in course progression
  - Content length and detail level
  - Explicit chapter/topic metadata from course structure
  - Manual annotation during content ingestion (if available)

#### R1.2: Topic Progression Tracking
**Requirement**: Track where topics are first introduced vs. where they are covered comprehensively.

**Details:**
- Store `topic_first_introduced_at` (chapter/day where topic first appears)
- Store `topic_comprehensive_coverage_at` (chapter/day where topic is covered in depth)
- Store `topic_dedicated_chapter` (chapter/day where topic is the primary/main focus, if such a chapter exists)
- Enable query: "For topic X, where is it covered most comprehensively?"
- Enable query: "For topic X, is there a dedicated chapter?"
- This may require:
  - Topic extraction and tagging during chunk creation
  - Cross-referencing topics across chapters
  - Building a topic-to-chapter mapping
  - Identifying chapter primary topics vs. secondary mentions

#### R1.3: Enhanced Chunk Relationships
**Requirement**: Store relationships between chunks (prerequisites, related topics, advanced versions).

**Details:**
- Chunks should have fields for:
  - `prerequisite_topics`: Topics that should be understood first
  - `related_topics`: Topics covered in the same or related chapters
  - `advanced_version_of`: Reference to chunk that covers the same topic at a higher level
  - `chapter_sequence`: Position of chapter in course progression
  - `is_dedicated_topic_chapter`: Boolean indicating if the chapter is primarily dedicated to a specific topic (e.g., "Ecommerce SEO" chapter)
  - `primary_topic`: The main topic/focus of the chapter (if chapter is dedicated to a specific topic)
  - `secondary_topics`: Topics mentioned but not the primary focus

#### R1.5: Structured Reference Metadata
**Requirement**: Store structured reference information (Day, Lab, Step, Chapter) for exact matching.

**Details:**
- Chunks must have explicit fields for:
  - `day`: Day number (e.g., 1, 2, 15)
  - `lab_id`: Lab identifier (e.g., "lab1", "day2-lab1", null if not a lab)
  - `step_number`: Step number within lab (e.g., 1, 2, 3, null if not a step)
  - `chapter_id`: Chapter identifier (e.g., "day2-ch1", "chapter-3")
  - `chapter_title`: Human-readable chapter title
  - `content_type`: Type of content (e.g., "lab", "chapter", "overview")
- These fields must be searchable and filterable for exact matching
- Enable queries like: "Find chunks where day=2 AND lab_id='lab1' AND step_number=3"
- This metadata is critical for matching specific references in questions

#### R1.4: Content Completeness Scoring
**Requirement**: Score each chunk based on how completely it covers its topics.

**Details:**
- Calculate a `completeness_score` (0-1) for each chunk based on:
  - Content length relative to topic complexity
  - Presence of examples, explanations, comparisons
  - Structural elements (headings, lists, detailed sections)
- Use this score to prioritize chunks that provide comprehensive coverage

---

### R2: Improved Chunk Retrieval and Prioritization

#### R2.1: Comprehensive Coverage Prioritization
**Requirement**: Prioritize chunks that provide comprehensive coverage of topics over introductory chunks, and dedicated topic chapters over general chapters.

**Details:**
- When multiple chunks cover the same topic:
  - **First Priority**: Chunks from chapters where `is_dedicated_topic_chapter = true` AND `primary_topic` matches the question topic
  - **Second Priority**: Chunks with `coverage_level: 'comprehensive'` or `'advanced'`
  - **Third Priority**: Chunks with higher `completeness_score`
  - **Fourth Priority**: Chunks from later chapters (if topic progression is known)
  - **Last Priority**: General chapters that mention the topic as a secondary topic
- Only include introductory or general chunks if:
  - No dedicated or comprehensive chunks are available
  - Question explicitly asks about basics/fundamentals
  - Comprehensive chunks require prerequisite knowledge from introductory chunks
- **Critical Rule 1**: If a dedicated chapter exists for a topic, it should ALWAYS be prioritized over general chapters that mention the topic
- **Critical Rule 2**: If a dedicated chapter exists for a topic, it should ALWAYS be prioritized over chapters where the topic is first mentioned/introduced (e.g., "Technical SEO Terms" chapter should not be referenced when a dedicated "Technical SEO" chapter exists)
- **Deprioritize**: Chapters that are marked as "first introduction" or "terms/glossary" when comprehensive or dedicated chapters exist

#### R2.2: Topic-Aware Search
**Requirement**: Enhance search to identify the specific topic being asked about and find its comprehensive coverage, with special handling for dedicated topic chapters.

**Details:**
- Extract topic/keywords from question (e.g., "Ecommerce SEO", "Answer Engine Optimization")
- Search for chunks that:
  1. Have high semantic similarity to the question
  2. Are tagged with the identified topic
  3. Have comprehensive coverage of that topic
  4. **Are from chapters where the topic is the primary focus** (dedicated chapters)
- Use topic progression metadata to find where topic is "covered in depth"
- **Special handling**: If question asks about a specific topic (e.g., "Ecommerce SEO", "Technical SEO"), first check if a dedicated chapter exists for that topic
- If dedicated chapter exists, prioritize it over:
  - General chapters that mention the topic
  - **Chapters where the topic is first introduced/mentioned** (e.g., "Technical SEO Terms" chapter)
  - Glossary/terms chapters that define the topic
- Use topic mapping to identify: "Is there a dedicated chapter for this topic?" before falling back to:
  1. Comprehensive coverage chapters
  2. General chapters
  3. First mention/introduction chapters (lowest priority)

#### R2.5: Specific Reference Parsing and Matching
**Requirement**: Parse and prioritize exact matches when questions contain specific references (Day X, Lab Y, Step Z).

**Details:**
- **Extract specific references** from questions:
  - Day references: "Day 2", "Day 15", etc.
  - Lab references: "Lab 1", "Lab 2", "day2-lab1", etc.
  - Step references: "Step 3", "Step 1", etc.
  - Chapter references: "Chapter 3", "Chapter day2-ch1", etc.
- **Priority matching**: When specific references are found:
  1. **First Priority**: Exact match on Day + Lab + Step (if all specified)
  2. **Second Priority**: Exact match on Day + Lab (if Step not specified)
  3. **Third Priority**: Exact match on Day + Chapter (if Lab not specified)
  4. **Fourth Priority**: Exact match on Day only
  5. **Last Priority**: Semantic similarity (only if no exact matches found)
- **Validation**: Before returning answer, verify that retrieved chunks match the specified context:
  - If question mentions "Day 2 Lab 1 Step 3", retrieved chunks must be from Day 2, Lab 1, Step 3
  - If retrieved chunks don't match, reject them and search for exact matches
  - Never return content from wrong day/lab/step when specific reference is provided
- **Structured reference understanding**: System must understand:
  - "Day 2 Lab 1 Step 3" = Day 2, Lab 1, Step 3
  - "Step 3 of Lab 1 on Day 2" = Day 2, Lab 1, Step 3
  - "day2-lab1" = Day 2, Lab 1
  - "day2-ch1" = Day 2, Chapter 1
  - "Day 4, Chapter 2" = Day 4, Chapter 2
  - Chapter titles: "Day 4, Chapter 2 — Keyword-to-Page Mapping" = Day 4, Chapter 2

#### R2.6: Content Extraction and Listing Requests
**Requirement**: Properly handle "list" requests and extract all relevant content from specified chapters.

**Details:**
- **Detect "list" intent**: Identify when question asks to "list", "enumerate", "show all", "what are all", etc.
- **For "list" requests**:
  - Extract ALL items/examples from the specified chapter (not just a summary)
  - Retrieve all chunks from the specified chapter that contain examples/list items
  - Ensure complete extraction - don't stop at first few items
  - Present in clear, enumerated format (numbered or bulleted list)
- **Chapter-specific extraction**: When a specific chapter is mentioned:
  - Retrieve ALL chunks from that exact chapter (Day X, Chapter Y)
  - Don't retrieve from other chapters even if semantically similar
  - Extract all examples, list items, or requested content comprehensively
- **Validation**: 
  - Verify that all retrieved chunks are from the specified chapter
  - If question mentions "Day 4, Chapter 2", ensure ALL chunks are from Day 4, Chapter 2
  - Reject chunks from wrong chapters (e.g., Day 1, Chapter 4 when Day 4, Chapter 2 is specified)
- **Complete extraction**: 
  - Don't summarize - extract and list all items
  - If chapter has 10 examples, list all 10 (not just 3-4)
  - Use structured format for easy reading

#### R2.3: Multi-Chunk Context Building
**Requirement**: When a topic spans multiple chapters, intelligently combine chunks from different chapters.

**Details:**
- Identify when a question requires information from multiple chapters
- Combine:
  - Prerequisite knowledge (from earlier chapters)
  - Comprehensive coverage (from later chapters)
  - Related topics (from adjacent chapters)
- Ensure references point to the most relevant/comprehensive source for each aspect

#### R2.4: Reference Accuracy Validation
**Requirement**: Validate that references point to the most appropriate location for the answer content, with special handling for dedicated topic chapters.

**Details:**
- Before returning references, verify:
  - The referenced chunk actually contains the information used in the answer
  - The reference points to the most comprehensive source (not just the first mention)
  - **If a dedicated chapter exists for the topic, it must be included in references** (even if general chapters are also referenced)
  - If answer uses information from multiple chunks, references should reflect all relevant sources
- Filter out references to:
  - Introductory chapters when comprehensive chapters are available
  - **General chapters when dedicated topic chapters exist** (unless both are needed for context)
- **Validation Rule**: If question asks about a specific topic and a dedicated chapter exists, the dedicated chapter reference must be present and prioritized

---

### R3: Enhanced LLM Prompting and Answer Generation

#### R3.1: Comprehensive Answer Generation
**Requirement**: Instruct LLM to generate comprehensive, structured answers that fully address the question, while staying relevant and concise.

**Details:**
- Update system prompt to:
  - Prioritize completeness over brevity when appropriate
  - Generate structured responses with clear sections
  - Expand on course content to provide full context
  - Use formatting (headings, lists, comparisons) for clarity
  - **Stay focused on what was asked - don't include unrelated details**
  - **Exclude lab assignment logistics (documentation, submission templates) unless explicitly asked**
- Remove or relax strict word count limits for comprehensive questions
- Allow answers to be 150-300 words (or more) when the question requires depth
- **For "how-to" questions, provide concise, point-based answers highlighting key steps**

#### R3.2: Content Expansion Instructions
**Requirement**: Instruct LLM to expand on course content when generating answers, not just summarize, while maintaining relevance.

**Details:**
- System prompt should include:
  - "Expand on the course content to provide comprehensive understanding"
  - "If the course content mentions a concept, explain it fully using the context provided"
  - "Structure your answer to cover all key aspects mentioned in the course content"
  - "Use the course content as a foundation, but provide a complete explanation"
  - **"Focus on answering what was asked - exclude assignment-specific details (documentation, templates, submission steps) unless the question explicitly asks about them"**
  - **"For conceptual questions, provide the concept explanation, not lab instructions"**
  - **"For 'how-to' questions, provide concise, point-based steps highlighting key actions"**

#### R3.3: Reference-Aware Answer Generation
**Requirement**: Generate answers that align with the most comprehensive source material.

**Details:**
- LLM should be instructed to:
  - Prioritize information from chunks marked as "comprehensive"
  - Reference the most appropriate chapter for each piece of information
  - Acknowledge when information comes from multiple sources
  - Ensure references match the depth of information provided

#### R3.4: Structured Answer Format
**Requirement**: Generate answers in a consistent, structured format that is concise and to the point.

**Details:**
- Answers should follow this structure:
  1. **Direct Answer** (1-2 sentences summarizing the key point)
  2. **Key Points/Details** (structured list of important aspects in point-based format)
  3. **Comparisons/Context** (if applicable, e.g., "SEO vs. AEO")
  4. **References** (embedded in answer, pointing to specific locations)
  5. **Next Steps** (suggestions for further learning, only if relevant)
- Use markdown formatting (headings, lists, bold) for clarity
- **For "how-to" questions**: Use concise, point-based structure highlighting key steps
- **Exclude**: Lab assignment logistics (documentation instructions, submission templates, assignment-specific steps) unless explicitly asked

#### R3.5: Dynamic Token Limits
**Requirement**: Adjust token limits based on question complexity and available context.

**Details:**
- Increase context token limit (from 2000 to 3000-4000) when:
  - Question requires comprehensive answer
  - Multiple related chunks are needed
  - Topic spans multiple chapters
- Increase response token limit (from 500 to 800-1200) when:
  - Question asks for detailed explanation
  - Question asks for comparisons or multiple aspects
  - Available context is comprehensive

#### R3.6: Answer Relevance and Filtering
**Requirement**: Ensure answers are relevant to the question asked and exclude unnecessary details.

**Details:**
- System prompt must include instructions to:
  - **Distinguish between conceptual questions and lab assignment questions**
  - **For conceptual questions**: Provide concept explanation, exclude lab instructions
  - **For "how-to" questions**: Provide concise, point-based steps highlighting key actions
  - **Exclude lab assignment logistics** unless explicitly asked:
    - Documentation instructions
    - Submission template references
    - Assignment-specific steps
    - Lab submission requirements
  - **Focus on core concept/technique**, not assignment logistics
- Implement intent classification to detect:
  - Conceptual questions (explain concept)
  - How-to questions (provide steps)
  - Lab assignment questions (provide lab guidance)
- Filter chunks to exclude lab-specific instructions when question is about the concept itself
- Post-process answers to remove assignment-specific references if not relevant to the question

#### R3.7: List and Extraction Request Handling
**Requirement**: Properly handle "list" requests and extract all content comprehensively from specified chapters.

**Details:**
- **Detect "list" intent**: System prompt must recognize when question asks to:
  - "List", "enumerate", "show all", "what are all", "list all examples", etc.
- **For "list" requests**:
  - Extract ALL items/examples from the specified chapter (not just a summary)
  - Don't summarize - provide complete enumeration
  - Use clear, structured format (numbered or bulleted list)
  - If chapter has 10 examples, list all 10 (not just 3-4)
- **Chapter-specific extraction**: When specific chapter is mentioned:
  - Extract content ONLY from that chapter
  - Ensure references match the chapter mentioned in question
  - If question says "Day 4, Chapter 2", reference must be "Day 4 → Chapter 2" (not Day 1 → Chapter 4)
- **System prompt instructions**:
  - "When asked to 'list' items from a specific chapter, extract and enumerate ALL items, not just a summary"
  - "When a specific chapter is mentioned, extract content ONLY from that chapter"
  - "Ensure references in your answer match the chapter explicitly mentioned in the question"
  - "For listing requests, provide complete enumeration, not partial lists"
- **Validation**: 
  - Verify that all examples/items listed are from the specified chapter
  - Verify that references match the chapter mentioned in question
  - If question mentions "Day 4, Chapter 2", answer must reference "Day 4 → Chapter 2"

---

### R4: Course Structure Understanding

#### R4.1: Chapter Progression Awareness
**Requirement**: System must understand course progression and chapter relationships.

**Details:**
- Build a course structure map that includes:
  - Day/Chapter sequence
  - Topic progression (which topics are introduced when, covered comprehensively when)
  - Prerequisite relationships between chapters
  - Advanced topic locations
- Use this map to:
  - Identify where topics are "most thoroughly explained"
  - Avoid referencing introductory chapters when comprehensive chapters exist
  - Understand course flow for better context building

#### R4.2: Topic Mapping
**Requirement**: Create and maintain a mapping of topics to their coverage locations.

**Details:**
- For each major topic in the course:
  - Identify where it's first introduced
  - Identify where it's covered comprehensively
  - Identify where it's covered at an advanced level
  - Store relationships (prerequisites, related topics)
- Use this mapping during retrieval to find the best source for each topic

#### R4.3: Content Analysis
**Requirement**: Analyze course content to identify topic coverage depth automatically.

**Details:**
- During chunk creation/ingestion:
  - Extract topics from each chunk
  - Analyze content depth (word count, structure, detail level)
  - Compare with other chunks covering the same topic
  - Automatically assign coverage levels
- This may require:
  - Topic extraction using NLP/LLM
  - Content analysis to determine depth
  - Cross-chunk comparison

---

### R5: Response Quality Validation

#### R5.1: Reference Accuracy Validation
**Requirement**: Validate that references in the response accurately point to where information is found.

**Details:**
- Before returning response:
  - Verify each reference actually contains the information cited
  - Ensure references point to comprehensive sources (not just first mention)
  - Check that all major points in the answer have corresponding references
  - Filter out incorrect or misleading references

#### R5.2: Answer Completeness Validation
**Requirement**: Validate that answers are comprehensive enough for the question type.

**Details:**
- For questions asking for "key differences," "comprehensive explanation," etc.:
  - Verify answer covers all major aspects
  - Check that answer structure matches question requirements
  - Ensure answer expands on course content appropriately
- If answer is too brief, regenerate with expanded instructions

#### R5.3: Topic Coverage Validation
**Requirement**: Validate that answers use the most appropriate source material, prioritizing dedicated topic chapters.

**Details:**
- Check that:
  - Answer primarily uses comprehensive chunks (not just introductory)
  - **If a dedicated chapter exists for the topic, answer must reference it** (not just general chapters)
  - References point to where topics are covered in depth
  - Answer doesn't miss important aspects covered in later chapters
  - **General chapters are not referenced when dedicated chapters exist** (unless both provide unique value)

#### R5.4: Context Match Validation
**Requirement**: Validate that retrieved content and generated answers match the specific context mentioned in the question.

**Details:**
- **Before generating answer**, validate that retrieved chunks match question context:
  - If question mentions "Day 2 Lab 1 Step 3", verify chunks are from Day 2, Lab 1, Step 3
  - If question mentions "Day 15", verify chunks are from Day 15 (not Day 2 or other days)
  - If question mentions specific lab/chapter, verify chunks match that lab/chapter
  - **If question mentions "Day 4, Chapter 2", verify chunks are from Day 4, Chapter 2 (not Day 1, Chapter 4)**
- **Reject mismatched content**: If retrieved chunks don't match the specified context:
  - Log warning about context mismatch
  - Re-query with exact match filters
  - If exact match not found, return error: "Content for [specific reference] not found" rather than wrong content
- **Answer validation**: Before returning answer:
  - Verify references in answer match the question context
  - If answer references wrong day/lab/step, regenerate with correct context
  - Never return answer that references completely different day/chapter than mentioned in question
  - **If question mentions "Day 4, Chapter 2", answer must reference "Day 4 → Chapter 2" (not Day 1 → Chapter 4)**
- **Critical Rule**: When specific reference is provided (Day X, Lab Y, Step Z, or Day X Chapter Y), exact match is REQUIRED - semantic similarity alone is not sufficient

#### R5.5: List Completeness Validation
**Requirement**: Validate that "list" requests extract and enumerate all items comprehensively.

**Details:**
- **For "list" requests**, validate:
  - All items/examples from the specified chapter are included (not just a subset)
  - Answer provides complete enumeration, not just a summary
  - Format is clear and structured (numbered or bulleted list)
- **Reference validation**: 
  - Verify that references match the chapter mentioned in question
  - If question asks to "list examples from Day 4, Chapter 2", reference must be "Day 4 → Chapter 2"
- **Completeness check**: 
  - If retrieved chunks contain 10 examples but answer only lists 3, flag as incomplete
  - Ensure all examples from retrieved chunks are included in answer
  - Don't summarize - enumerate all items

---

### R6: Database Schema Updates (If Needed)

#### R6.1: Chunk Metadata Fields
**Requirement**: Add new fields to `ai_coach_content_chunks` table (if schema changes are needed).

**Details:**
- `coverage_level`: ENUM('introduction', 'intermediate', 'comprehensive', 'advanced')
- `completeness_score`: DECIMAL(0-1)
- `topic_tags`: JSONB array of topic identifiers
- `chapter_sequence`: INTEGER (position in course)
- `prerequisite_topics`: JSONB array
- `related_topics`: JSONB array
- `comprehensive_coverage_of`: JSONB array of topics this chunk covers comprehensively
- `is_dedicated_topic_chapter`: BOOLEAN (true if chapter is primarily dedicated to a specific topic)
- `primary_topic`: VARCHAR or JSONB (main topic/focus of the chapter, if dedicated)
- `secondary_topics`: JSONB array (topics mentioned but not primary focus)
- **Structured Reference Fields (for exact matching)**:
  - `day`: INTEGER (day number, e.g., 1, 2, 15)
  - `lab_id`: VARCHAR (lab identifier, e.g., 'lab1', 'day2-lab1', nullable)
  - `step_number`: INTEGER (step number within lab, nullable)
  - `chapter_id`: VARCHAR (chapter identifier, e.g., 'day2-ch1', 'chapter-3')
  - `chapter_title`: VARCHAR (human-readable chapter title)
  - `content_type`: ENUM('lab', 'chapter', 'overview', etc.)

#### R6.2: Topic Mapping Table (Optional)
**Requirement**: Create a table to map topics to their coverage locations (if needed).

**Details:**
- Table: `ai_coach_topic_coverage`
- Fields:
  - `topic_id` or `topic_name`
  - `course_id`
  - `first_introduced_at` (chapter_id)
  - `comprehensive_coverage_at` (chapter_id)
  - `advanced_coverage_at` (chapter_id, nullable)
  - `dedicated_chapter_at` (chapter_id, nullable) - **NEW**: Chapter dedicated to this topic
  - `is_dedicated_topic` (BOOLEAN) - **NEW**: Whether this topic has a dedicated chapter
  - `related_topics` (JSONB)

---

### R7: Backward Compatibility

#### R7.1: Gradual Migration
**Requirement**: Ensure changes don't break existing functionality.

**Details:**
- New metadata fields should be optional (nullable) initially
- System should work with existing chunks that don't have new metadata
- Fallback to current behavior when new metadata is unavailable
- Migration path for existing chunks to add new metadata

#### R7.2: Performance Considerations
**Requirement**: Ensure improvements don't significantly degrade performance.

**Details:**
- New retrieval logic should be optimized
- Consider caching topic mappings and course structure
- Monitor query performance and response times
- Index new fields appropriately

---

## Success Criteria

### Reference Accuracy
- **Target**: 90%+ of references point to the most appropriate/comprehensive source
- **Measurement**: Manual review of sample responses, tracking reference accuracy

### Answer Comprehensiveness
- **Target**: Answers to comprehensive questions should be 150-300 words with structured format
- **Measurement**: Average word count for comprehensive questions, structure analysis

### Answer Relevance
- **Target**: 95%+ of answers focus on what was asked without unnecessary details
- **Target**: Answers exclude lab assignment logistics (documentation, templates) unless explicitly asked
- **Target**: "How-to" questions receive concise, point-based answers highlighting key steps
- **Measurement**: 
  - Manual review of answers for relevance
  - Tracking of answers that include unnecessary assignment details
  - User feedback on answer relevance

### Context Matching
- **Target**: 100% of answers match the specific context mentioned in questions (Day X, Lab Y, Step Z, or Day X Chapter Y)
- **Target**: Zero tolerance for answers referencing wrong day/lab/step/chapter when specific reference is provided
- **Measurement**: 
  - Manual review of answers with specific references
  - Tracking of context mismatches (e.g., Day 2 question answered with Day 15 content, Day 4 Chapter 2 answered with Day 1 Chapter 4)
  - Validation that retrieved chunks match question context

### Content Extraction and Listing
- **Target**: 100% of "list" requests extract and enumerate ALL items from specified chapters (not just summaries)
- **Target**: 100% of references in "list" answers match the chapter mentioned in question
- **Target**: Complete extraction - if chapter has 10 examples, all 10 are listed (not just 3-4)
- **Measurement**: 
  - Manual review of "list" requests for completeness
  - Tracking of incomplete extractions (e.g., 3 examples listed when 10 exist)
  - Validation that references match specified chapters
  - Comparison of listed items vs. actual items in source chapter

### User Satisfaction
- **Target**: Reduced "not helpful" feedback, increased "helpful" feedback
- **Measurement**: Feedback ratings, user surveys

### Conversation History
- **Target**: 100% of Q&As are saved and accessible to learners
- **Target**: Learners can view all previous conversations for a course
- **Target**: History persists across sessions and devices
- **Measurement**: 
  - Storage success rate (all Q&As saved)
  - History retrieval success rate
  - User feedback on history accessibility
  - Cross-session persistence verification

### Example Validation

**Example 1**: "What are the key differences for success in case of Answer Engine Optimization?"
- Answer should reference the chapter where AEO is covered in depth (not Day 2 foundational chapter)
- Answer should be comprehensive (7-10 key differences, structured format)
- Answer should expand on course content to provide full understanding

**Example 2**: "How's Ecommerce SEO different from a normal website SEO?"
- Answer should reference the dedicated "Ecommerce SEO" chapter (not Day 2 → Chapter 2 general SERP chapter)
- Answer should be comprehensive with multiple key differences
- Answer should expand on course content to provide full understanding
- **Critical**: System must identify that "Ecommerce SEO" has a dedicated chapter and prioritize it over general SEO chapters

**Example 3**: "What are the key elements of success for technical SEO?"
- Answer should reference the dedicated "Technical SEO" chapter (not Day 1 → Chapter 3 where it's first mentioned)
- Answer should be comprehensive with all key elements
- Answer should expand on course content to provide full understanding
- **Critical**: System must identify that "Technical SEO" has a dedicated chapter and prioritize it over the first mention/introduction chapter

**Example 4**: "How to use the 'site:' operator effectively?"
- Answer should be concise and to the point, focusing on the technique itself
- Answer should use point-based structure highlighting key steps
- Answer should NOT include lab assignment logistics (documentation, submission templates, assignment steps)
- Answer should focus on the core concept/technique, not assignment instructions
- **Critical**: System must distinguish between conceptual/how-to questions and lab assignment questions

**Example 5**: "I am not able to do Step 3 of Lab 1 on Day 2. Please help"
- Answer MUST reference Day 2 → Lab 1 → Step 3 (the exact content mentioned)
- Answer should NOT reference Day 15 or any other day/chapter
- Answer should provide help specific to Step 3 of Day 2 Lab 1
- **Critical**: System must parse specific references (Day 2, Lab 1, Step 3) and retrieve exact matches
- **Critical**: System must validate that retrieved content matches the specified context before generating answer
- **Critical**: If exact match not found, return error rather than wrong content

**Example 6**: "List the examples covered in 'Day 4, Chapter 2 — Keyword-to-Page Mapping and Cannibalization Prevention'"
- Answer MUST extract and list ALL examples from Day 4, Chapter 2 (not just a summary with 3 examples)
- Answer MUST reference Day 4 → Chapter 2 (not Day 1 → Chapter 4 or any other chapter)
- Answer should provide complete enumeration in structured format (numbered or bulleted list)
- Answer should NOT summarize - must list all examples comprehensively
- **Critical**: System must retrieve ALL chunks from Day 4, Chapter 2 that contain examples
- **Critical**: System must validate that references match the chapter mentioned in question (Day 4, Chapter 2)
- **Critical**: If chapter has 10 examples, all 10 must be listed (not just 3-4)

---

### R8: Conversation History Persistence and Viewing

#### R8.1: Complete Conversation History Storage
**Requirement**: Ensure all learner questions and AI Coach responses are permanently saved to the database.

**Details:**
- All Q&A pairs must be stored in the database (currently implemented via `ai_coach_conversation_history` table)
- Storage must be reliable and not fail silently
- Each conversation entry must include:
  - Learner ID
  - Course ID
  - Question (from `ai_coach_queries` table)
  - Answer (from `ai_coach_responses` table)
  - Timestamp
  - Sequence number (to maintain conversation order)
  - References (if applicable)
  - Confidence score (if applicable)
- Storage should happen immediately after response generation (not deferred)
- Error handling must ensure storage failures don't prevent users from seeing their answers

#### R8.2: Conversation History Retrieval
**Requirement**: Learners must be able to view all their previous questions and answers for a course.

**Details:**
- Load conversation history when AI Coach widget initializes (currently loads last 20 messages)
- Support loading more than 20 messages (pagination or "load more" functionality)
- History should be organized chronologically (newest first or oldest first, user preference)
- History should be filterable/searchable by:
  - Date range
  - Keywords in question/answer
  - Topic/tags (if available)
- History should be accessible across sessions (persist when learner returns to course)

#### R8.3: Conversation History Display
**Requirement**: Provide a clear, accessible interface for learners to view their conversation history.

**Details:**
- Display conversation history within the AI Coach widget or a dedicated history view
- Show conversation in chronological order (question → answer pairs)
- Display metadata for each conversation:
  - Date and time
  - Course context (if viewing across multiple courses)
  - References (if applicable)
  - Confidence indicator (if applicable)
- Support expanding/collapsing conversation threads
- Allow learners to:
  - Scroll through full conversation history
  - Jump to specific dates or conversations
  - Copy questions/answers
  - Re-ask similar questions
- Visual distinction between:
  - Current session conversations
  - Previous session conversations
  - Archived/older conversations

#### R8.4: Cross-Session Persistence
**Requirement**: Conversation history must persist across browser sessions and device changes.

**Details:**
- History must be stored server-side (not just in browser/localStorage)
- History must be accessible when learner:
  - Closes and reopens browser
  - Switches devices
  - Clears browser cache
  - Uses different browser
- History should be tied to learner account, not browser session

#### R8.5: History Organization
**Requirement**: Organize conversation history in a way that makes it easy for learners to find previous Q&As.

**Details:**
- Group conversations by:
  - Course (if learner has access to multiple courses)
  - Date (today, yesterday, this week, this month, older)
  - Topic (if topic extraction is available)
- Provide search functionality to find specific questions/answers
- Allow bookmarking/favoriting important Q&As
- Support exporting conversation history (optional)

#### R8.6: History Limits and Retention
**Requirement**: Define and implement policies for conversation history retention.

**Details:**
- Determine maximum number of conversations to store per learner per course
- Define retention period (e.g., keep for 1 year, 6 months, etc.)
- Implement archival strategy for old conversations (if needed)
- Consider storage costs and performance implications
- Provide clear policy to learners about history retention

#### R8.7: Privacy and Data Access
**Requirement**: Ensure conversation history respects learner privacy and data access rights.

**Details:**
- History should only be accessible to the learner who created it
- History should not be visible to other learners or trainers (unless explicitly shared)
- Support data export for learner's own data (GDPR compliance)
- Support deletion of conversation history (learner-initiated)
- Clear privacy policy regarding conversation storage

---

## Out of Scope (For Now)

- UI/UX changes to display responses
- Real-time response streaming
- Multi-language support
- Response caching strategies
- A/B testing framework
- Detailed design specifications
- Implementation details

---

## Notes

- These requirements focus on improving response quality, not changing the user interface
- Database schema changes may be optional if metadata can be derived/computed
- LLM prompt improvements may be sufficient for some requirements without schema changes
- Topic extraction and mapping may require manual annotation or automated analysis
- Consider phased implementation: start with prompt improvements, then add metadata, then enhance retrieval

---

## Open Questions

1. Do we have access to course structure metadata (chapter sequence, topic progression)?
2. Can we automatically extract topics and coverage levels, or does this require manual annotation?
3. What is the current chunk creation/ingestion process? Can we enhance it?
4. Are there existing topic tags or metadata we can leverage?
5. What is the acceptable response time increase for more comprehensive answers?
6. Should we prioritize certain question types (comprehensive questions) for enhanced answers?

---

## Approval

- **Stakeholder Review**: [Pending]
- **Technical Review**: [Pending]
- **Approval**: [Pending]

