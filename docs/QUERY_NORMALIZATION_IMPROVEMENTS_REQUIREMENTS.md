# Query Normalization & Intent Capture Improvements - Requirements Document

## Problem Statement

The current Query Normalization Service is **weak in capturing user intent** and **fails to distinguish primary topics from contextual noise**. Additionally, the system **only handles Content and Lab Guidance queries**, but users ask many other types of questions that require different response strategies.

This leads to:
1. Poor retrieval results for content queries
2. Incorrect understanding of what users are asking
3. Inappropriate responses to non-content queries (structural, navigation, planning)
4. Missed opportunities to provide helpful course navigation and planning assistance

### Current Behavior (Problematic)

**Example 1 - Content Query**:
**Input Query**: `"What do we need to differently to win in the current state of AEO?"`

**Current Output**:
```json
{
  "normalized_question": "What do we need to do differently to win in the current state of AEO?",
  "key_concepts": ["AEO", "current state"],
  "intent_type": "procedure",
  "confidence": 0.9,
  "original_question": "What do we need to differently to win in the current state of AEO?",
  "spelling_corrections": ["differently -> do differently"]
}
```

**Example 2 - Structural Query** (NOT HANDLED):
**Input Query**: `"How many chapters are there?"`

**Current Output** (Incorrect):
```json
{
  "normalized_question": "How many chapters are there?",
  "key_concepts": ["chapters"],  // Wrong - this is not a content concept
  "intent_type": "general",
  "confidence": 0.8
}
```
**Problem**: System tries to search for "chapters" in content, but this is a structural question about course organization.

**Example 3 - Navigation Query** (NOT HANDLED):
**Input Query**: `"Can I skip chapter 2?"`

**Current Output** (Incorrect):
```json
{
  "normalized_question": "Can I skip chapter 2?",
  "key_concepts": ["chapter 2"],  // Wrong - this is navigation, not content
  "intent_type": "general",
  "confidence": 0.7
}
```
**Problem**: System doesn't recognize this as a navigation question requiring course structure knowledge.

**Example 4 - Planning Query** (NOT HANDLED):
**Input Query**: `"How much time for chapter 2?"`

**Current Output** (Incorrect):
```json
{
  "normalized_question": "How much time for chapter 2?",
  "key_concepts": ["chapter 2", "time"],  // Wrong - this is planning, not content
  "intent_type": "general",
  "confidence": 0.7
}
```
**Problem**: System doesn't recognize this as a planning question requiring course metadata.

### Problems Identified

#### 1. **Query Category Not Identified**
- ❌ **Problem**: System doesn't distinguish between Content queries and non-Content queries
- ❌ **Impact**: Non-content queries (structural, navigation, planning) are incorrectly processed as content queries
- ✅ **Expected**: System should classify queries into categories: Content, Lab Guidance, Structural, Navigation, Planning
- ✅ **Expected**: Different categories require different response strategies

#### 2. **Primary Topic Not Identified**
- ❌ **Problem**: System treats "AEO" and "current state" as equal concepts
- ❌ **Impact**: Retrieval searches for both, diluting relevance
- ✅ **Expected**: "AEO" should be identified as the PRIMARY TOPIC
- ✅ **Expected**: "current state" should be recognized as contextual noise and excluded

#### 3. **Weak Intent Classification**
- ❌ **Problem**: Intent is classified as generic "procedure" 
- ❌ **Impact**: System doesn't understand the user wants implementation/strategy guidance
- ✅ **Expected**: Intent should be more specific (e.g., "implementation", "strategy", "best_practices")
- ✅ **Expected**: Intent should capture the action verb context ("win", "differently", "implement")

#### 4. **No Concept Prioritization**
- ❌ **Problem**: All concepts are treated equally in `key_concepts` array
- ❌ **Impact**: Retrieval doesn't know which concept to prioritize
- ✅ **Expected**: Concepts should be ranked by importance (primary > secondary > contextual)

#### 5. **Contextual Phrases Not Filtered**
- ❌ **Problem**: Phrases like "current state", "win", "differently" are extracted as concepts
- ❌ **Impact**: These are not searchable topics and pollute retrieval
- ✅ **Expected**: Contextual phrases should be identified and excluded from searchable concepts

#### 6. **Non-Content Queries Not Handled**
- ❌ **Problem**: Structural, Navigation, and Planning queries are processed as content queries
- ❌ **Impact**: System provides inappropriate responses or "Not covered in course material"
- ✅ **Expected**: System should recognize non-content queries and route them to appropriate handlers
- ✅ **Expected**: System should extract relevant metadata (chapter numbers, lab numbers, time estimates) for non-content queries

---

## Requirements

### R1: Query Category Classification

**Requirement**: The system MUST classify queries into appropriate categories to determine the response strategy.

**Specifications**:

1. **Query Categories**:
   ```typescript
   type QueryCategory = 
     | "content"          // Questions about course content/concepts (e.g., "What is AEO?")
     | "lab_guidance"    // Questions about labs/assignments (e.g., "I'm stuck in lab 3")
     | "structural"      // Questions about course structure (e.g., "How many chapters are there?")
     | "navigation"      // Questions about course navigation (e.g., "Can I skip chapter 2?")
     | "planning"        // Questions about time/planning (e.g., "How much time for chapter 2?")
   ```

2. **Category Detection Rules**:
   
   **Content Category**:
   - Keywords: "what is", "explain", "how does", "tell me about", "define"
   - Contains: Subject matter terms (AEO, SEO, keywords, etc.)
   - Pattern: Questions about concepts, definitions, explanations
   
   **Lab Guidance Category**:
   - Keywords: "stuck", "help with lab", "lab", "assignment", "submission", "how to do lab"
   - Contains: Lab numbers or lab-specific terms
   - Pattern: Questions about completing labs or assignments
   
   **Structural Category**:
   - Keywords: "how many", "what chapters", "course structure", "syllabus", "outline"
   - Pattern: Questions about course organization, number of items
   
   **Navigation Category**:
   - Keywords: "skip", "can I", "should I", "order", "sequence", "prerequisite"
   - Contains: Chapter/lab numbers with navigation intent
   - Pattern: Questions about course progression, skipping, prerequisites
   
   **Planning Category**:
   - Keywords: "how much time", "how long", "duration", "schedule", "timeline", "estimate"
   - Contains: Chapter/lab numbers with time-related questions
   - Pattern: Questions about time estimates, scheduling

3. **Category Priority**:
   - If a query matches multiple categories, prioritize in this order:
     1. Lab Guidance (most specific)
     2. Content (if contains subject matter)
     3. Navigation (if contains navigation keywords)
     4. Planning (if contains time keywords)
     5. Structural (if contains structural keywords)

4. **Output Format**:
   ```json
   {
     "query_category": "content",
     "category_confidence": 0.95,
     "category_reasoning": "Query asks about a concept (AEO) with explanation intent"
   }
   ```

5. **Response Strategy by Category**:
   - **Content**: Use content retrieval pipeline (current system)
   - **Lab Guidance**: Use lab-specific guidance system
   - **Structural**: Query course structure metadata, return course organization info
   - **Navigation**: Query course structure + prerequisites, provide navigation advice
   - **Planning**: Query course metadata for time estimates, provide planning guidance

---

### R2: Primary Topic Identification

**Requirement**: The system MUST identify and extract the PRIMARY TOPIC from user queries.

**Specifications**:
1. **Primary Topic Definition**: The main subject matter the user is asking about
   - Examples: "AEO", "Technical SEO", "Keyword Research", "Link Building"
   - Can be an acronym (AEO, SEO, KPI) or a full term

2. **Primary Topic Extraction Rules**:
   - Extract the core subject matter, ignoring:
     - Action verbs ("win", "do", "implement", "optimize")
     - Temporal phrases ("current state", "now", "today")
     - Comparative phrases ("differently", "better", "improved")
     - Question words ("what", "how", "why")
   
3. **Output Format**:
   ```json
   {
     "primary_topic": "AEO",
     "primary_topic_expanded": "answer engine optimization",
     "key_concepts": ["aeo", "answer engine optimization"],
     "contextual_phrases": ["current state", "win", "differently"]
   }
   ```

4. **Validation**:
   - Primary topic MUST be a searchable concept (exists in content metadata)
   - Primary topic MUST appear in the original question
   - Primary topic MUST be a noun phrase (not a verb or adjective)

---

### R3: Enhanced Intent Classification

**Requirement**: The system MUST capture more specific and nuanced user intent.

**Specifications**:

1. **Extended Intent Types**:
   ```typescript
   type IntentType = 
     | "definition"           // What is X?
     | "explanation"         // How/Why does X work?
     | "comparison"          // Compare X and Y
     | "procedure"          // How to do X? (generic steps)
     | "implementation"     // How to implement X? (specific, actionable)
     | "strategy"            // How to win/succeed with X?
     | "best_practices"      // What are best practices for X?
     | "troubleshooting"    // How to fix X?
     | "example"            // Show examples of X
     | "general"            // General question
   ```

2. **Intent Subtype** (for complex queries):
   ```json
   {
     "intent_type": "strategy",
     "intent_subtype": "implementation",
     "intent_confidence": 0.95
   }
   ```

3. **Intent Detection Rules**:
   - **Strategy Intent**: Keywords like "win", "succeed", "beat", "outperform", "differently"
   - **Implementation Intent**: Keywords like "implement", "apply", "execute", "do", "use"
   - **Best Practices Intent**: Keywords like "best", "optimal", "recommended", "should"
   - **Troubleshooting Intent**: Keywords like "fix", "error", "problem", "issue", "not working"

4. **Example Output**:
   ```json
   {
     "intent_type": "strategy",
     "intent_subtype": "implementation",
     "intent_confidence": 0.92,
     "intent_reasoning": "Query contains 'win' and 'differently', indicating strategy/implementation intent"
   }
   ```

---

### R4: Concept Prioritization & Filtering

**Requirement**: The system MUST rank concepts by importance and filter out contextual noise.

**Specifications**:

1. **Concept Categories**:
   - **Primary Concepts**: The main topic(s) user is asking about (MUST be searchable)
   - **Secondary Concepts**: Related topics that might help retrieval (optional)
   - **Contextual Phrases**: Non-searchable phrases that provide context but shouldn't be searched

2. **Output Format**:
   ```json
   {
     "primary_concepts": ["aeo", "answer engine optimization"],
     "secondary_concepts": [],
     "contextual_phrases": ["current state", "win", "differently"],
     "key_concepts": ["aeo", "answer engine optimization"]  // For backward compatibility
   }
   ```

3. **Filtering Rules**:
   - **Exclude from searchable concepts**:
     - Temporal phrases: "current state", "now", "today", "recent", "latest"
     - Action verbs: "win", "do", "implement", "optimize", "improve"
     - Comparative phrases: "differently", "better", "best", "optimal"
     - Question words: "what", "how", "why", "when", "where"
     - Generic phrases: "things", "stuff", "ways", "methods"
   
4. **Prioritization Rules**:
   - Primary concepts: Acronyms, domain-specific terms, technical concepts
   - Secondary concepts: Related but not core topics
   - Contextual phrases: Excluded from retrieval but kept for intent understanding

---

### R5: Additional Information Extraction

**Requirement**: The system MUST extract additional information from queries that is relevant to the category.

**Specifications**:

1. **Additional Information Types**:
   - **Chapter/Lab References**: Extract chapter numbers, lab numbers mentioned
   - **Time References**: Extract time-related questions
   - **Navigation Intent**: Extract skip/sequence/prerequisite information
   - **Structural Elements**: Extract what structural element is being asked about

2. **Extraction Rules**:

   **For Navigation Queries**:
   ```json
   {
     "additional_info": {
       "type": "navigation",
       "chapter_number": 2,
       "navigation_action": "skip",
       "question": "Can I skip chapter 2?"
     }
   }
   ```

   **For Planning Queries**:
   ```json
   {
     "additional_info": {
       "type": "planning",
       "chapter_number": 2,
       "planning_question": "time_estimate",
       "question": "How much time for chapter 2?"
     }
   }
   ```

   **For Structural Queries**:
   ```json
   {
     "additional_info": {
       "type": "structural",
       "structural_element": "chapters",
       "question": "How many chapters are there?"
     }
   }
   ```

   **For Lab Guidance Queries**:
   ```json
   {
     "additional_info": {
       "type": "lab_guidance",
       "lab_number": 3,
       "guidance_type": "stuck",
       "question": "I'm stuck in lab 3"
     }
   }
   ```

3. **Pattern Matching**:
   - Chapter numbers: `chapter\s+(\d+)`, `ch\s*(\d+)`, `chapter\s+(\d+)`
   - Lab numbers: `lab\s+(\d+)`, `lab\s*(\d+)`
   - Time questions: `how\s+(much|long)\s+time`, `duration`, `estimate`
   - Navigation actions: `skip`, `can i`, `should i`, `prerequisite`

---

### R6: Enhanced Output Schema

**Requirement**: The normalized output MUST include structured fields for primary topic and enhanced intent.

**New Output Schema**:
```json
{
  "normalized_question": "What do we need to do differently to win in the current state of answer engine optimization?",
  
  // QUERY CATEGORY (NEW)
  "query_category": "content",
  "category_confidence": 0.95,
  "category_reasoning": "Query asks about a concept (AEO) with explanation intent",
  
  // PRIMARY TOPIC (NEW)
  "primary_topic": "AEO",
  "primary_topic_expanded": "answer engine optimization",
  "main_topic_phrase": "AEO",  // Main topic phrase for display
  
  // CONCEPTS (ENHANCED)
  "primary_concepts": ["aeo", "answer engine optimization"],
  "secondary_concepts": [],
  "contextual_phrases": ["current state", "win", "differently"],
  "key_concepts": ["aeo", "answer engine optimization"],  // Backward compatible
  
  // INTENT (ENHANCED)
  "intent_type": "strategy",
  "intent_subtype": "implementation",
  "intent_confidence": 0.92,
  "intent_reasoning": "Query contains 'win' and 'differently', indicating strategy/implementation intent",
  
  // ADDITIONAL INFORMATION (NEW)
  "additional_info": null,  // For non-content queries, contains chapter/lab numbers, etc.
  
  // METADATA
  "confidence": 0.9,
  "original_question": "What do we need to differently to win in the current state of AEO?",
  "spelling_corrections": ["differently -> do differently"]
}
```

**Example Outputs by Category**:

**Content Query**:
```json
{
  "query_category": "content",
  "primary_topic": "AEO",
  "main_topic_phrase": "AEO",
  "intent_type": "definition",
  "additional_info": null
}
```

**Structural Query**:
```json
{
  "query_category": "structural",
  "primary_topic": null,
  "main_topic_phrase": null,
  "intent_type": "general",
  "additional_info": {
    "type": "structural",
    "structural_element": "chapters",
    "question": "How many chapters are there?"
  }
}
```

**Navigation Query**:
```json
{
  "query_category": "navigation",
  "primary_topic": null,
  "main_topic_phrase": "Chapter 2",
  "intent_type": "general",
  "additional_info": {
    "type": "navigation",
    "chapter_number": 2,
    "navigation_action": "skip",
    "question": "Can I skip chapter 2?"
  }
}
```

**Planning Query**:
```json
{
  "query_category": "planning",
  "primary_topic": null,
  "main_topic_phrase": "Chapter 2",
  "intent_type": "general",
  "additional_info": {
    "type": "planning",
    "chapter_number": 2,
    "planning_question": "time_estimate",
    "question": "How much time for chapter 2?"
  }
}
```

**Lab Guidance Query**:
```json
{
  "query_category": "lab_guidance",
  "primary_topic": null,
  "main_topic_phrase": "Lab 3",
  "intent_type": "procedure",
  "additional_info": {
    "type": "lab_guidance",
    "lab_number": 3,
    "guidance_type": "stuck",
    "question": "I'm stuck in lab 3"
  }
}
```

---

### R7: LLM Prompt Improvements

**Requirement**: The normalization prompt MUST explicitly instruct the LLM to:
1. Identify primary topics vs. contextual phrases
2. Classify intent more specifically
3. Filter out non-searchable phrases

**Prompt Additions**:

```
QUERY CATEGORY CLASSIFICATION:
- FIRST, classify the query category:
  * "content" - Questions about course concepts/subject matter (e.g., "What is AEO?", "Explain SEO")
  * "lab_guidance" - Questions about labs/assignments (e.g., "I'm stuck in lab 3", "Help with lab 2")
  * "structural" - Questions about course structure (e.g., "How many chapters?", "What's the syllabus?")
  * "navigation" - Questions about course navigation (e.g., "Can I skip chapter 2?", "What's the order?")
  * "planning" - Questions about time/planning (e.g., "How much time for chapter 2?", "How long is this?")
- If category is NOT "content", primary_topic may be null, but extract additional_info

PRIMARY TOPIC IDENTIFICATION:
- ONLY for "content" category queries:
  - Identify the MAIN SUBJECT MATTER the user is asking about
  - This is typically a noun phrase, acronym, or technical term
  - Examples: "AEO", "Technical SEO", "Keyword Research"
  - DO NOT include action verbs, temporal phrases, or comparative words as primary topics
- For non-content queries, primary_topic may be null or the referenced element (e.g., "Chapter 2")

INTENT CLASSIFICATION:
- Classify intent more specifically:
  * "strategy" - User wants to know how to win/succeed (keywords: win, succeed, beat, outperform, differently)
  * "implementation" - User wants to know how to implement/apply (keywords: implement, apply, execute, do, use)
  * "best_practices" - User wants best practices (keywords: best, optimal, recommended, should)
  * "troubleshooting" - User wants to fix something (keywords: fix, error, problem, issue)
  * "general" - For structural, navigation, planning queries

ADDITIONAL INFORMATION EXTRACTION:
- For navigation queries: Extract chapter/lab numbers and navigation action (skip, prerequisite, etc.)
- For planning queries: Extract chapter/lab numbers and time-related question type
- For structural queries: Extract what structural element is being asked about
- For lab guidance queries: Extract lab number and guidance type (stuck, help, submission, etc.)

CONCEPT FILTERING:
- EXCLUDE from key_concepts:
  * Temporal phrases: "current state", "now", "today", "recent"
  * Action verbs: "win", "do", "implement", "optimize"
  * Comparative phrases: "differently", "better", "best"
  * Question words: "what", "how", "why"
  * Structural terms: "chapters", "labs", "course" (unless part of content query)
- ONLY include searchable topics (concepts that exist in course content)
- For non-content queries, key_concepts may be empty
```

---

## Escalation Rules & Response Design

### Escalation to Trainer - Rules

**CRITICAL RULE**: Escalation to Trainer is **ONLY** for **Content queries** that meet ALL of the following criteria:

1. ✅ Query is classified as `query_category: "content"`
2. ✅ Query is **relevant** to the course (primary topic exists in course content)
3. ✅ **Sufficient answer is NOT available** in the course material (retrieval found relevant content but answer is incomplete/insufficient)
4. ✅ Confidence score is below threshold (e.g., < 40%)

**Escalation is NOT allowed for**:
- ❌ Non-content queries (structural, navigation, planning, lab guidance)
- ❌ Irrelevant content queries (topic not covered in course)
- ❌ Content queries with sufficient answers available

**Escalation Logic**:
```typescript
if (query_category === "content" && 
    primary_topic_exists_in_course && 
    answer_is_insufficient && 
    confidence_score < 40) {
  // Allow escalation
  escalateToTrainer();
} else {
  // Provide appropriate response based on category
  provideCategorySpecificResponse();
}
```

---

### Response Design by Query Category

#### 1. Content Queries

**Response Strategy**: Use content retrieval pipeline (existing system)

**Response Types**:
- **Sufficient Answer Found**: Provide answer with references
- **Insufficient Answer Found**: Provide partial answer + escalation option
- **No Answer Found**: "This topic is not covered in the course material. Please check with your trainer or refer to the course content directly."

**Escalation Trigger**:
- Only when: Content is relevant but answer is insufficient AND confidence < 40%
- Message: "I want to make sure you get the best possible answer. This question has been escalated to a trainer."

**Example Response** (Insufficient Answer):
```
🤖 AI Coach

📘 Explanation
Based on the course material, [partial answer from available content].

⚠️ Note: The course material provides limited information on this specific aspect. 
I've escalated this question to your trainer to ensure you get a complete answer.

📍 Course Reference(s)
• Day X → Chapter Y → [Topic]
```

---

#### 2. Structural Queries

**Response Strategy**: Query course structure metadata, provide direct answer

**Response Design**:
- Query course metadata for structural information
- Provide clear, factual answer
- **NO escalation** - This is a factual question about course structure

**Example Responses**:

**Query**: "How many chapters are there?"
```
🤖 AI Coach

📊 Course Structure

This course contains [X] chapters organized across [Y] days.

The course is structured as follows:
• Day 1-5: Foundation (Chapters 1-10)
• Day 6-15: Intermediate (Chapters 11-25)
• Day 16-20: Advanced (Chapters 26-30)

Would you like to see a detailed breakdown of any specific section?
```

**Query**: "What chapters are in Day 5?"
```
🤖 AI Coach

📊 Course Structure

Day 5 contains the following chapters:
• Chapter 9: [Chapter Title]
• Chapter 10: [Chapter Title]
• Lab 3: [Lab Title]

You can access Day 5 content from the course navigation menu.
```

**Error Handling**:
- If course structure data unavailable: "I don't have access to the course structure information at the moment. Please check the course navigation menu or contact support."

---

#### 3. Navigation Queries

**Response Strategy**: Provide navigation advice based on course structure and prerequisites

**Response Design**:
- Check prerequisites and course sequence
- Provide clear navigation advice
- **NO escalation** - This is a navigation question, not a content question

**Example Responses**:

**Query**: "Can I skip chapter 2?"
```
🤖 AI Coach

🧭 Navigation Guidance

Chapter 2 covers [Topic Name], which is a prerequisite for:
• Chapter 5: [Topic]
• Chapter 8: [Topic]
• Lab 4: [Lab Name]

**Recommendation**: I recommend completing Chapter 2 before moving forward, as it provides foundational knowledge needed for later chapters.

However, if you're already familiar with [Topic Name], you can:
1. Review the Chapter 2 summary
2. Take the Chapter 2 quiz to verify your understanding
3. Proceed to Chapter 3 if you pass

Would you like to see the Chapter 2 summary or proceed to Chapter 3?
```

**Query**: "What should I study before chapter 10?"
```
🤖 AI Coach

🧭 Navigation Guidance

Before starting Chapter 10, you should complete:
• Chapter 7: [Prerequisite Topic] (Required)
• Chapter 8: [Prerequisite Topic] (Required)
• Chapter 9: [Prerequisite Topic] (Recommended)
• Lab 5: [Lab Name] (Recommended)

**Learning Path**:
1. Complete Chapters 7-9 in order
2. Complete Lab 5 to practice the concepts
3. Then proceed to Chapter 10

This sequence ensures you have the necessary foundation for Chapter 10's advanced concepts.
```

**Error Handling**:
- If prerequisite data unavailable: "I don't have access to prerequisite information for this chapter. Please check the course navigation or contact your trainer for guidance."

---

#### 4. Planning Queries

**Response Strategy**: Provide time estimates from course metadata

**Response Design**:
- Query course metadata for time estimates
- Provide realistic planning guidance
- **NO escalation** - This is a planning question, not a content question

**Example Responses**:

**Query**: "How much time for chapter 2?"
```
🤖 AI Coach

⏱️ Time Planning

**Chapter 2: [Chapter Title]**

Estimated time to complete:
• Reading: 45-60 minutes
• Exercises: 30-45 minutes
• Quiz: 10-15 minutes
• **Total: 1.5 - 2 hours**

**Tips for efficient learning**:
• Read actively and take notes (adds ~15 minutes but improves retention)
• Complete exercises immediately after reading
• Review key concepts before taking the quiz

Would you like time estimates for other chapters or help creating a study schedule?
```

**Query**: "How long is the entire course?"
```
🤖 AI Coach

⏱️ Course Planning

**Course Duration Overview**

Total course content:
• Chapters: 30 chapters (~30-40 hours)
• Labs: 10 labs (~15-20 hours)
• Quizzes: 30 quizzes (~5 hours)
• **Total: 50-65 hours**

**Recommended Schedule**:
• **Full-time (8 hours/day)**: 7-8 days
• **Part-time (4 hours/day)**: 13-16 days
• **Weekend only (8 hours/weekend)**: 6-8 weeks

**Flexible Learning**:
You can complete the course at your own pace. The course is designed to be completed within 3 months, but you have access for [duration].

Would you like help creating a personalized study schedule?
```

**Error Handling**:
- If time estimates unavailable: "I don't have time estimates for this chapter. As a general guideline, most chapters take 1-2 hours to complete. Would you like to check the course navigation for more details?"

---

#### 5. Lab Guidance Queries

**Response Strategy**: Provide lab-specific guidance and troubleshooting

**Response Design**:
- Identify the specific lab and issue
- Provide targeted guidance based on lab requirements
- **NO escalation** - Lab guidance is handled by the lab guidance system

**Example Responses**:

**Query**: "I'm stuck in lab 3"
```
🤖 AI Coach

🔬 Lab Guidance

**Lab 3: [Lab Title]**

I can help you get unstuck! Let me provide some guidance:

**Common Issues in Lab 3**:
1. [Common issue 1] - Solution: [Brief solution]
2. [Common issue 2] - Solution: [Brief solution]

**Step-by-Step Checklist**:
- [ ] Have you reviewed the lab instructions carefully?
- [ ] Did you complete the prerequisite chapters (Chapters X, Y)?
- [ ] Have you checked the lab resources section?

**Next Steps**:
1. Review the lab instructions in Day [X] → Lab 3
2. Check the lab resources for examples
3. If still stuck, try the troubleshooting section

**Additional Help**:
• Lab Resources: [Link to lab resources]
• Lab Examples: [Link to examples]
• Lab Discussion: [Link to discussion forum]

What specific part of Lab 3 are you having trouble with?
```

**Query**: "Help with lab 5 submission"
```
🤖 AI Coach

🔬 Lab Guidance

**Lab 5: [Lab Title] - Submission Help**

**Submission Requirements**:
• Format: [Format requirements]
• Deadline: [Deadline]
• File size limit: [Size limit]

**Submission Checklist**:
- [ ] All required files included
- [ ] Files named correctly (see naming convention)
- [ ] Submission format matches requirements
- [ ] All questions answered (if applicable)

**How to Submit**:
1. Navigate to Day [X] → Lab 5
2. Click "Submit Lab" button
3. Upload your files
4. Review and confirm submission

**Troubleshooting**:
• If upload fails: Check file size and format
• If submission button not visible: Ensure you've completed all lab sections
• If deadline passed: Contact your trainer for extension

Need help with a specific part of the submission process?
```

**Error Handling**:
- If lab not found: "I couldn't find Lab [X] in the course. Please verify the lab number or check the course navigation."
- If lab guidance unavailable: "I don't have specific guidance for this lab at the moment. Please check the lab instructions or contact your trainer."

---

### Response Format Standards

All responses should follow this structure:

```
🤖 AI Coach

[Category-Specific Icon] [Category Title]

[Main Response Content]

[Action Items / Next Steps] (if applicable)

[Additional Resources] (if applicable)
```

**Category Icons**:
- Content: 📘 (Book icon)
- Structural: 📊 (Chart/Structure icon)
- Navigation: 🧭 (Compass icon)
- Planning: ⏱️ (Clock icon)
- Lab Guidance: 🔬 (Lab/Experiment icon)

---

## Expected Behavior (After Implementation)

### Example 1: Content Query - Strategy

**Input**: `"What do we need to differently to win in the current state of AEO?"`

**Expected Output**:
```json
{
  "query_category": "content",
  "category_confidence": 0.95,
  "category_reasoning": "Query asks about a concept (AEO) with explanation intent",
  "normalized_question": "What do we need to do differently to win in the current state of answer engine optimization?",
  "primary_topic": "AEO",
  "primary_topic_expanded": "answer engine optimization",
  "main_topic_phrase": "AEO",
  "primary_concepts": ["aeo", "answer engine optimization"],
  "secondary_concepts": [],
  "contextual_phrases": ["current state", "win", "differently"],
  "key_concepts": ["aeo", "answer engine optimization"],
  "intent_type": "strategy",
  "intent_subtype": "implementation",
  "intent_confidence": 0.92,
  "intent_reasoning": "Query contains 'win' and 'differently', indicating strategy/implementation intent",
  "additional_info": null,
  "confidence": 0.95,
  "original_question": "What do we need to differently to win in the current state of AEO?",
  "spelling_corrections": ["differently -> do differently"]
}
```

### Example 2: Content Query - Definition

**Input**: `"What is AEO?"`

**Expected Output**:
```json
{
  "query_category": "content",
  "category_confidence": 0.98,
  "category_reasoning": "Query asks for definition of a concept",
  "normalized_question": "What is answer engine optimization?",
  "primary_topic": "AEO",
  "primary_topic_expanded": "answer engine optimization",
  "main_topic_phrase": "AEO",
  "primary_concepts": ["aeo", "answer engine optimization"],
  "key_concepts": ["aeo", "answer engine optimization"],
  "intent_type": "definition",
  "additional_info": null,
  "confidence": 0.95
}
```

### Example 3: Structural Query

**Input**: `"How many chapters are there?"`

**Expected Output**:
```json
{
  "query_category": "structural",
  "category_confidence": 0.95,
  "category_reasoning": "Query asks about course structure (number of chapters)",
  "normalized_question": "How many chapters are there in the course?",
  "primary_topic": null,
  "main_topic_phrase": null,
  "primary_concepts": [],
  "key_concepts": [],
  "intent_type": "general",
  "additional_info": {
    "type": "structural",
    "structural_element": "chapters",
    "question": "How many chapters are there?"
  },
  "confidence": 0.9
}
```

### Example 4: Navigation Query

**Input**: `"Can I skip chapter 2?"`

**Expected Output**:
```json
{
  "query_category": "navigation",
  "category_confidence": 0.92,
  "category_reasoning": "Query asks about course navigation (skipping a chapter)",
  "normalized_question": "Can I skip chapter 2?",
  "primary_topic": null,
  "main_topic_phrase": "Chapter 2",
  "primary_concepts": [],
  "key_concepts": [],
  "intent_type": "general",
  "additional_info": {
    "type": "navigation",
    "chapter_number": 2,
    "navigation_action": "skip",
    "question": "Can I skip chapter 2?"
  },
  "confidence": 0.9
}
```

### Example 5: Planning Query

**Input**: `"How much time for chapter 2?"`

**Expected Output**:
```json
{
  "query_category": "planning",
  "category_confidence": 0.93,
  "category_reasoning": "Query asks about time estimate for a chapter",
  "normalized_question": "How much time is required for chapter 2?",
  "primary_topic": null,
  "main_topic_phrase": "Chapter 2",
  "primary_concepts": [],
  "key_concepts": [],
  "intent_type": "general",
  "additional_info": {
    "type": "planning",
    "chapter_number": 2,
    "planning_question": "time_estimate",
    "question": "How much time for chapter 2?"
  },
  "confidence": 0.9
}
```

### Example 6: Lab Guidance Query

**Input**: `"I'm stuck in lab 3"`

**Expected Output**:
```json
{
  "query_category": "lab_guidance",
  "category_confidence": 0.96,
  "category_reasoning": "Query indicates user needs help with a lab",
  "normalized_question": "I'm stuck in lab 3 and need help",
  "primary_topic": null,
  "main_topic_phrase": "Lab 3",
  "primary_concepts": [],
  "key_concepts": [],
  "intent_type": "procedure",
  "additional_info": {
    "type": "lab_guidance",
    "lab_number": 3,
    "guidance_type": "stuck",
    "question": "I'm stuck in lab 3"
  },
  "confidence": 0.9
}
```

---

## Implementation Priority

### Phase 1: Critical (Immediate)
1. ✅ **R1**: Query Category Classification (MUST HAVE - enables proper routing)
2. ✅ **R2**: Primary Topic Identification
3. ✅ **R4**: Concept Prioritization & Filtering
4. ✅ **R5**: Additional Information Extraction (for non-content queries)
5. ✅ **R6**: Enhanced Output Schema

### Phase 2: Important (Next Sprint)
6. ✅ **R3**: Enhanced Intent Classification
7. ✅ **R7**: LLM Prompt Improvements

### Phase 3: Response Handlers (After Normalization)
8. ⚠️ **Response Handler for Structural Queries**: Query course structure metadata
9. ⚠️ **Response Handler for Navigation Queries**: Provide navigation advice based on prerequisites
10. ⚠️ **Response Handler for Planning Queries**: Provide time estimates from course metadata

---

## Success Criteria

1. ✅ Query category is correctly identified in 95%+ of queries
2. ✅ Primary topic is correctly identified in 95%+ of content queries
3. ✅ Contextual phrases are filtered out in 98%+ of queries
4. ✅ Intent classification accuracy improves from ~70% to ~90%
5. ✅ Additional information (chapter/lab numbers) is extracted correctly in 90%+ of non-content queries
6. ✅ Retrieval relevance improves (measured by user feedback and escalation rates)
7. ✅ Zero false positives: No contextual phrases in `key_concepts` array
8. ✅ Non-content queries are routed to appropriate handlers (not processed as content queries)
9. ✅ Appropriate responses provided for all 5 query categories

---

## Testing Requirements

### Test Cases

#### Content Queries

1. **Strategy Query**:
   - Input: `"What do we need to differently to win in the current state of AEO?"`
   - Expected: `query_category: "content"`, `primary_topic: "AEO"`, `intent_type: "strategy"`, `contextual_phrases: ["current state", "win", "differently"]`

2. **Definition Query**:
   - Input: `"What is AEO?"`
   - Expected: `query_category: "content"`, `primary_topic: "AEO"`, `intent_type: "definition"`

3. **Implementation Query**:
   - Input: `"How to implement technical SEO?"`
   - Expected: `query_category: "content"`, `primary_topic: "Technical SEO"`, `intent_type: "implementation"`

4. **Best Practices Query**:
   - Input: `"What are best practices for keyword research?"`
   - Expected: `query_category: "content"`, `primary_topic: "Keyword Research"`, `intent_type: "best_practices"`

5. **Contextual Noise Filtering**:
   - Input: `"Tell me about current state of SEO"`
   - Expected: `query_category: "content"`, `primary_topic: "SEO"`, `contextual_phrases: ["current state"]`, `key_concepts: ["seo"]` (NOT "current state")

#### Non-Content Queries

6. **Structural Query**:
   - Input: `"How many chapters are there?"`
   - Expected: `query_category: "structural"`, `primary_topic: null`, `additional_info.type: "structural"`, `additional_info.structural_element: "chapters"`

7. **Navigation Query**:
   - Input: `"Can I skip chapter 2?"`
   - Expected: `query_category: "navigation"`, `primary_topic: null`, `additional_info.type: "navigation"`, `additional_info.chapter_number: 2`, `additional_info.navigation_action: "skip"`

8. **Planning Query**:
   - Input: `"How much time for chapter 2?"`
   - Expected: `query_category: "planning"`, `primary_topic: null`, `additional_info.type: "planning"`, `additional_info.chapter_number: 2`, `additional_info.planning_question: "time_estimate"`

9. **Lab Guidance Query**:
   - Input: `"I'm stuck in lab 3"`
   - Expected: `query_category: "lab_guidance"`, `primary_topic: null`, `additional_info.type: "lab_guidance"`, `additional_info.lab_number: 3`, `additional_info.guidance_type: "stuck"`

10. **Lab Guidance Query - Help**:
    - Input: `"Help with lab 5"`
    - Expected: `query_category: "lab_guidance"`, `additional_info.lab_number: 5`, `additional_info.guidance_type: "help"`

---

## Dependencies

- **QueryNormalizerService**: Core service to be enhanced
- **ConceptExpansionService**: May need updates to handle primary concepts differently
- **NodeRetrievalService**: Should prioritize primary concepts in search (only for content queries)
- **StrictPipelineService**: Should route queries based on category:
  - Content queries → content retrieval pipeline (with escalation support)
  - Lab Guidance queries → lab guidance system (existing)
  - Structural queries → course structure handler (NEW)
  - Navigation queries → course navigation handler (NEW)
  - Planning queries → course planning handler (NEW)
- **Course Structure Service** (NEW): Service to query course metadata (chapters, labs, structure)
  - Methods: `getTotalChapters()`, `getChaptersByDay()`, `getCourseStructure()`
- **Course Navigation Service** (NEW): Service to provide navigation advice (prerequisites, skipping, order)
  - Methods: `getPrerequisites(chapterNumber)`, `canSkipChapter(chapterNumber)`, `getLearningPath()`
- **Course Planning Service** (NEW): Service to provide time estimates and planning guidance
  - Methods: `getTimeEstimate(chapterNumber)`, `getCourseDuration()`, `createStudySchedule()`
- **Response Renderer Service** (ENHANCED): Should handle rendering for all 5 query categories
  - Methods: `renderContentResponse()`, `renderStructuralResponse()`, `renderNavigationResponse()`, `renderPlanningResponse()`, `renderLabGuidanceResponse()`

---

## Notes

- Backward compatibility: `key_concepts` array must still be populated for existing code
- The new fields (`query_category`, `primary_topic`, `primary_concepts`, `contextual_phrases`, `additional_info`) are additive, not breaking changes
- Intent classification improvements should not break existing intent-based logic
- **Critical**: Non-content queries MUST NOT be processed through content retrieval pipeline
- **Critical**: Escalation to Trainer is ONLY for content queries with insufficient answers
- **Critical**: Non-content queries (structural, navigation, planning, lab guidance) should NEVER trigger escalation
- Response handlers for Structural, Navigation, and Planning queries need to be implemented separately
- The AI Coach should gracefully handle all 5 query categories with appropriate responses
- All non-content query responses should be helpful, actionable, and never say "Not covered in course material"

---

**Document Version**: 1.1  
**Created**: 2026-01-07  
**Updated**: 2026-01-07  
**Status**: Requirements Defined - Ready for Implementation

**Changelog**:
- v1.1: Added escalation rules and response design for all query categories
- v1.0: Initial requirements document

