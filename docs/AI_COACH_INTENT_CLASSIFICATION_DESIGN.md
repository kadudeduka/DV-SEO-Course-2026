# AI Coach - Question Intent Classification System Design

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Design Document

---

## Overview

The Intent Classification system determines the type and purpose of each learner query to enable:
- **Contextual Retrieval**: Fetch relevant content based on intent
- **Response Strategy**: Tailor answer format and depth
- **Lab Guidance Rules**: Strict enforcement for lab-related queries
- **Escalation Triggers**: Identify struggling learners
- **Out-of-Scope Detection**: Filter non-course questions

**Principle**: Every query MUST be classified into exactly ONE intent.

---

## Intent Definitions

### 1. FACTUAL / STRUCTURAL
**Definition**: Questions asking for specific facts, definitions, or structural information about course content.

**Examples**:
- "What is SEO?"
- "What are the chapters in Day 1?"
- "What is the difference between on-page and off-page SEO?"
- "List the topics covered in this course"
- "What is a meta tag?"

**Characteristics**:
- Seeks concrete information
- Often starts with "What is", "What are", "Define", "List"
- Requests definitions, lists, or comparisons
- Can be answered with facts from course content

---

### 2. CONCEPTUAL / EXPLANATORY
**Definition**: Questions asking for explanations, understanding, or deeper comprehension of concepts.

**Examples**:
- "How does keyword research work?"
- "Why is on-page SEO important?"
- "Explain the relationship between content and SEO"
- "What does this concept mean?"
- "Can you help me understand X?"

**Characteristics**:
- Seeks understanding, not just facts
- Often starts with "How does", "Why", "Explain", "Help me understand"
- Requests deeper explanation or reasoning
- May ask about relationships between concepts

---

### 3. EXAMPLE / PRACTICAL
**Definition**: Questions asking for examples, use cases, or practical demonstrations.

**Examples**:
- "Can you give me an example of on-page SEO?"
- "Show me a practical example of keyword research"
- "What does good SEO look like in practice?"
- "Give me a real-world example"
- "How is this applied in practice?"

**Characteristics**:
- Seeks concrete examples or demonstrations
- Often contains "example", "show me", "demonstrate", "practical"
- Requests real-world applications
- May ask for case studies or scenarios

---

### 4. HOW-TO / GUIDED LEARNING
**Definition**: Questions asking for step-by-step instructions or guidance on how to perform a task.

**Examples**:
- "How do I optimize a webpage for SEO?"
- "How do I conduct keyword research?"
- "What are the steps to improve my site's ranking?"
- "How should I approach this topic?"
- "What's the process for X?"

**Characteristics**:
- Seeks actionable instructions
- Often starts with "How do I", "How to", "What are the steps"
- Requests procedural knowledge
- May ask for methodology or approach

---

### 5. NAVIGATION / WHERE-IS
**Definition**: Questions asking about course structure, content location, or where to find information.

**Examples**:
- "Where can I find information about keyword research?"
- "Which chapter covers on-page SEO?"
- "Where is the lab for Day 1?"
- "What day covers technical SEO?"
- "Where do I learn about X?"

**Characteristics**:
- Seeks location or structure information
- Often contains "where", "which chapter", "which day", "find"
- Requests navigation help
- May ask about course organization

---

### 6. LAB GUIDANCE (NO ANSWERS)
**Definition**: Questions asking for help with labs, but must NOT receive direct answers.

**Examples**:
- "I need help with Day 1 lab"
- "Can you help me with the lab assignment?"
- "I'm stuck on the lab"
- "How do I approach the lab?"
- "What should I focus on for the lab?"

**Characteristics**:
- Explicitly mentions "lab" or "assignment"
- May indicate struggle but must not get solutions
- Requires guidance, not answers
- Must trigger strict validation

**Critical Rule**: This intent MUST trigger lab guidance validation to prevent direct answers.

---

### 7. STRUGGLE / CONFUSION
**Definition**: Questions indicating the learner is struggling, confused, or needs extra support.

**Examples**:
- "I don't understand this concept"
- "I'm confused about X"
- "This doesn't make sense"
- "I'm struggling with Y"
- "Can you help me, I'm lost"
- "I don't get it"

**Characteristics**:
- Expresses confusion or difficulty
- Often contains "don't understand", "confused", "struggling", "lost", "don't get"
- May indicate frustration
- Requires supportive, patient response

**Note**: This may overlap with other intents but takes priority for escalation consideration.

---

### 8. OUT-OF-SCOPE
**Definition**: Questions that are not related to the course content or are outside the AI Coach's purpose.

**Examples**:
- "What's the weather today?"
- "Tell me a joke"
- "How do I reset my password?" (system question)
- "What courses are available?" (general question)
- "Who is the instructor?" (if not in course content)

**Characteristics**:
- Not related to course content
- General knowledge questions
- System/administrative questions
- Off-topic conversations

**Critical Rule**: Must be rejected with standardized message.

---

## Intent Classification Decision Table

| Priority | Intent | Primary Signals | Secondary Signals | Exclusion Signals |
|----------|--------|----------------|-------------------|-------------------|
| 1 | OUT-OF-SCOPE | No course keywords, general questions, system questions | "weather", "joke", "password", "courses available" | Course-specific terms |
| 2 | LAB GUIDANCE | "lab", "assignment", "exercise" + help request | "stuck on lab", "lab help", "lab question" | "give me answer", "solution" (should still be lab guidance but flagged) |
| 3 | STRUGGLE / CONFUSION | "don't understand", "confused", "struggling", "lost", "don't get" | "help me", "I'm stuck", "makes no sense" | None (can overlap with others) |
| 4 | NAVIGATION / WHERE-IS | "where", "which chapter", "which day", "find information" | "location", "where is", "where can I" | None |
| 5 | HOW-TO / GUIDED LEARNING | "how do I", "how to", "steps", "process", "approach" | "method", "way to", "guide me" | "example" (if present, may be EXAMPLE) |
| 6 | EXAMPLE / PRACTICAL | "example", "show me", "demonstrate", "practical", "real-world" | "case study", "instance", "sample" | None |
| 7 | CONCEPTUAL / EXPLANATORY | "how does", "why", "explain", "help me understand", "meaning" | "relationship", "connection", "reason" | "what is" (if just definition, may be FACTUAL) |
| 8 | FACTUAL / STRUCTURAL | "what is", "what are", "define", "list", "difference between" | "tell me", "give me", "information about" | None (fallback) |

**Priority Order**: Check intents in priority order (1-8). First match wins.

---

## Classification Algorithm (Pseudocode)

```javascript
/**
 * Classify learner query intent
 * @param {string} question - Raw learner question
 * @param {Object} context - Additional context (current chapter, course, etc.)
 * @returns {string} Intent classification
 */
function classifyIntent(question, context = {}) {
    // Step 1: Normalize question
    const normalized = normalizeQuestion(question);
    
    // Step 2: Extract features
    const features = extractFeatures(normalized, context);
    
    // Step 3: Check intents in priority order
    
    // Priority 1: OUT-OF-SCOPE
    if (isOutOfScope(normalized, features, context)) {
        return 'out_of_scope';
    }
    
    // Priority 2: LAB GUIDANCE (critical - must check early)
    if (isLabGuidance(normalized, features, context)) {
        return 'lab_guidance';
    }
    
    // Priority 3: STRUGGLE / CONFUSION
    if (isStruggle(normalized, features)) {
        return 'struggle';
    }
    
    // Priority 4: NAVIGATION / WHERE-IS
    if (isNavigation(normalized, features)) {
        return 'navigation';
    }
    
    // Priority 5: HOW-TO / GUIDED LEARNING
    if (isHowTo(normalized, features)) {
        return 'how_to';
    }
    
    // Priority 6: EXAMPLE / PRACTICAL
    if (isExample(normalized, features)) {
        return 'example';
    }
    
    // Priority 7: CONCEPTUAL / EXPLANATORY
    if (isConceptual(normalized, features)) {
        return 'conceptual';
    }
    
    // Priority 8: FACTUAL / STRUCTURAL (fallback)
    return 'factual';
}

/**
 * Normalize question for analysis
 */
function normalizeQuestion(question) {
    // Trim whitespace
    let normalized = question.trim();
    
    // Convert to lowercase
    normalized = normalized.toLowerCase();
    
    // Remove excessive punctuation
    normalized = normalized.replace(/[!?]{2,}/g, (match) => match[0]);
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ');
    
    return normalized;
}

/**
 * Extract features from question
 */
function extractFeatures(question, context) {
    const words = question.split(/\s+/);
    const bigrams = generateBigrams(words);
    const trigrams = generateTrigrams(words);
    
    return {
        words: words,
        bigrams: bigrams,
        trigrams: trigrams,
        questionLength: question.length,
        wordCount: words.length,
        startsWith: words[0] || '',
        containsLab: /lab|assignment|exercise|task/i.test(question),
        containsQuestionWords: /what|how|why|where|which|when|who/i.test(question),
        currentChapter: context.currentChapter,
        currentDay: context.currentDay,
        isLabPage: context.isLabPage || false
    };
}

/**
 * Check if question is out of scope
 */
function isOutOfScope(question, features, context) {
    // Check for course-specific keywords
    const courseKeywords = [
        'chapter', 'day', 'lab', 'course', 'seo', 'content',
        'keyword', 'optimization', 'ranking', 'search engine'
    ];
    
    const hasCourseKeywords = courseKeywords.some(keyword => 
        question.includes(keyword)
    );
    
    // If no course keywords and question is very short or generic
    if (!hasCourseKeywords && features.wordCount < 5) {
        return true;
    }
    
    // Check for explicit out-of-scope patterns
    const outOfScopePatterns = [
        /^(what's|what is) the weather/i,
        /tell me a joke/i,
        /how do i (reset|change) (my )?password/i,
        /what courses are available/i,
        /who is the (instructor|trainer|teacher)/i
    ];
    
    return outOfScopePatterns.some(pattern => pattern.test(question));
}

/**
 * Check if question is lab guidance request
 */
function isLabGuidance(question, features, context) {
    // Explicit lab mentions
    const labPatterns = [
        /\b(lab|assignment|exercise|task)\b/i,
        /day \d+ (lab|assignment)/i,
        /(help|stuck|struggling).*(lab|assignment)/i
    ];
    
    const hasLabMention = labPatterns.some(pattern => pattern.test(question));
    
    // Context-based: if on lab page
    if (context.isLabPage && (features.containsQuestionWords || /help|stuck|how/i.test(question))) {
        return true;
    }
    
    return hasLabMention;
}

/**
 * Check if question indicates struggle
 */
function isStruggle(question, features) {
    const strugglePatterns = [
        /\b(don'?t|do not) (understand|get|know|see)\b/i,
        /\b(confused|confusing|confusion)\b/i,
        /\b(struggling|struggle|stuck)\b/i,
        /\b(lost|don'?t get it|makes no sense)\b/i,
        /\b(help me|i need help)\b/i,
        /\b(this|that|it) (doesn'?t|does not) make sense\b/i
    ];
    
    return strugglePatterns.some(pattern => pattern.test(question));
}

/**
 * Check if question is navigation/where-is
 */
function isNavigation(question, features) {
    const navigationPatterns = [
        /^where (can i|do i|is|are)/i,
        /which (chapter|day|section|part)/i,
        /where (to find|can i find|is the|are the)/i,
        /(find|locate|search for).*(information|content|chapter|day)/i
    ];
    
    return navigationPatterns.some(pattern => pattern.test(question));
}

/**
 * Check if question is how-to/guided learning
 */
function isHowTo(question, features) {
    const howToPatterns = [
        /^how (do i|to|can i|should i)/i,
        /what (are|is) the (steps|process|method|way|approach)/i,
        /(guide|walk) me (through|on)/i,
        /(steps|process|method|procedure) (to|for|of)/i
    ];
    
    // Exclude if it's asking for an example
    if (/example|show me|demonstrate/i.test(question)) {
        return false;
    }
    
    return howToPatterns.some(pattern => pattern.test(question));
}

/**
 * Check if question is example/practical
 */
function isExample(question, features) {
    const examplePatterns = [
        /\b(example|examples|instance|sample)\b/i,
        /show me (an|a|some)/i,
        /(demonstrate|demonstration)/i,
        /\b(practical|real-world|real world|case study)\b/i,
        /what does (this|that|it) look like/i
    ];
    
    return examplePatterns.some(pattern => pattern.test(question));
}

/**
 * Check if question is conceptual/explanatory
 */
function isConceptual(question, features) {
    const conceptualPatterns = [
        /^how does/i,
        /^why (is|are|do|does|would)/i,
        /^explain/i,
        /help me understand/i,
        /what (does|do) (this|that|it|X) mean/i,
        /(relationship|connection|relate) (between|to|with)/i,
        /what is the (reason|purpose|meaning)/i
    ];
    
    // Exclude simple "what is" questions (those are factual)
    if (/^what is [a-z]+(\?|$)/i.test(question) && features.wordCount < 8) {
        return false;
    }
    
    return conceptualPatterns.some(pattern => pattern.test(question));
}

/**
 * Generate bigrams from words
 */
function generateBigrams(words) {
    const bigrams = [];
    for (let i = 0; i < words.length - 1; i++) {
        bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
}

/**
 * Generate trigrams from words
 */
function generateTrigrams(words) {
    const trigrams = [];
    for (let i = 0; i < words.length - 2; i++) {
        trigrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    return trigrams;
}
```

---

## Edge Cases & Handling

### 1. Multiple Intent Signals
**Scenario**: Question contains signals for multiple intents.

**Example**: "I'm confused about how to do the Day 1 lab"

**Handling**:
- Check intents in priority order
- "lab" → LAB GUIDANCE (Priority 2)
- "confused" → STRUGGLE (Priority 3)
- **Result**: LAB GUIDANCE (higher priority)
- **Note**: Still flag for struggle detection in escalation logic

---

### 2. Ambiguous Questions
**Scenario**: Question could be multiple intents.

**Example**: "What is keyword research?"

**Handling**:
- Could be FACTUAL (definition) or CONCEPTUAL (explanation)
- Check word count and complexity
- Simple, short → FACTUAL
- Longer, asks for understanding → CONCEPTUAL
- **Fallback**: FACTUAL (default)

---

### 3. Lab Questions Without "Lab" Keyword
**Scenario**: Question about lab but doesn't mention "lab".

**Example**: "I need help with Day 1 exercise"

**Handling**:
- Check context: `context.isLabPage`
- Check for "exercise", "assignment", "task"
- Check current page context
- **Result**: LAB GUIDANCE if context indicates lab

---

### 4. Struggle + Other Intent
**Scenario**: Question expresses struggle but also asks for specific information.

**Example**: "I don't understand how keyword research works"

**Handling**:
- "don't understand" → STRUGGLE (Priority 3)
- "how does" → CONCEPTUAL (Priority 7)
- **Result**: STRUGGLE (higher priority)
- **Note**: Still extract underlying intent (CONCEPTUAL) for response strategy

---

### 5. Very Short Questions
**Scenario**: One or two word questions.

**Example**: "SEO?"

**Handling**:
- Check context (current chapter, page)
- If on course page → FACTUAL (fallback)
- If no context → OUT-OF-SCOPE (likely incomplete question)
- **Result**: Request clarification or use FACTUAL

---

### 6. Questions with Typos
**Scenario**: Misspellings or typos in question.

**Example**: "Waht is SEO?" or "How do I optimise?"

**Handling**:
- Normalize during preprocessing
- Use fuzzy matching for keywords
- Check for common typos ("waht" → "what")
- **Result**: Classify based on corrected/normalized version

---

### 7. Questions in Different Languages
**Scenario**: Question not in English (if system supports).

**Handling**:
- Detect language
- If not supported → OUT-OF-SCOPE with message
- If supported → Translate and classify
- **Result**: Classify in supported language or reject

---

### 8. Questions About System/Admin
**Scenario**: Questions about LMS functionality, not course content.

**Example**: "How do I submit a lab?" or "Where is my progress?"

**Handling**:
- Check for system keywords: "submit", "progress", "dashboard", "profile"
- If system-related → OUT-OF-SCOPE
- If course-related process → HOW-TO or NAVIGATION
- **Result**: OUT-OF-SCOPE for pure system questions

---

## Confidence Scoring (Optional Enhancement)

For each classification, calculate a confidence score:

```javascript
function calculateConfidence(intent, question, features) {
    let confidence = 0.5; // Base confidence
    
    // Strong signal match
    if (hasStrongSignal(intent, question, features)) {
        confidence += 0.3;
    }
    
    // Multiple signal matches
    const signalCount = countSignals(intent, question, features);
    confidence += Math.min(signalCount * 0.1, 0.2);
    
    // Context alignment
    if (contextMatchesIntent(intent, features)) {
        confidence += 0.1;
    }
    
    // Penalize ambiguity
    const ambiguity = detectAmbiguity(question, features);
    confidence -= ambiguity * 0.1;
    
    return Math.max(0, Math.min(1, confidence));
}
```

**Use Case**: Low confidence (< 0.6) may trigger additional validation or LLM-based classification.

---

## Integration Points

### Current System Integration

The classification should integrate with:

1. **Query Processor Service** (`lms/services/query-processor-service.js`)
   - Replace or enhance existing `classifyIntent()` method
   - Maintain same interface for backward compatibility

2. **Context Builder Service** (`lms/services/context-builder-service.js`)
   - Use intent to determine context retrieval strategy
   - Filter chunks based on intent

3. **AI Coach Service** (`lms/services/ai-coach-service.js`)
   - Use intent for response strategy
   - Trigger lab guidance validation for LAB GUIDANCE intent
   - Trigger escalation for STRUGGLE intent

4. **Lab Struggle Detection Service** (`lms/services/lab-struggle-detection-service.js`)
   - Use STRUGGLE intent as one indicator
   - Combine with other signals

---

## Testing Strategy

### Unit Tests

Test each intent classifier with:
- Positive examples (should match)
- Negative examples (should not match)
- Edge cases (ambiguous, multiple signals)
- Typo handling
- Context-based classification

### Integration Tests

Test end-to-end:
- Query → Classification → Context Retrieval → Response
- Verify intent affects response strategy
- Verify lab guidance rules enforced

### Validation Tests

- 100% of queries get exactly one intent
- No queries classified as multiple intents
- Fallback always works (FACTUAL)
- OUT-OF-SCOPE correctly identified

---

## Future Enhancements

1. **LLM-Based Classification** (Optional)
   - Use lightweight LLM call for ambiguous cases
   - Fallback to rule-based for speed

2. **Learning from Feedback**
   - Track misclassifications
   - Adjust patterns based on feedback
   - Improve accuracy over time

3. **Multi-Intent Support** (Future)
   - Allow primary + secondary intent
   - More nuanced response strategies

---

## Summary

**Classification Flow**:
1. Normalize question
2. Extract features
3. Check intents in priority order (1-8)
4. Return first match
5. Fallback to FACTUAL if no match

**Key Principles**:
- Every query → exactly one intent
- Priority order ensures consistent classification
- LAB GUIDANCE and OUT-OF-SCOPE checked early
- STRUGGLE takes priority for escalation
- FACTUAL is safe fallback

**Next Steps**:
1. Implement classification functions
2. Add unit tests
3. Integrate with existing query processor
4. Test with real learner questions
5. Refine patterns based on results

---

**Document Status**: ✅ Ready for Implementation

