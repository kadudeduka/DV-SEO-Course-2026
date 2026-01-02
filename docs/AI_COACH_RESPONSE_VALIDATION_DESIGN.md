# AI Coach - Response Self-Validation Mechanism Design

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Design Document

---

## Overview

The Response Self-Validation mechanism ensures AI Coach responses meet quality standards before being delivered to learners. It validates responses against intent-specific rules, blocks inadequate answers, and triggers regeneration when validation fails.

**Principle**: Every response must pass validation before delivery. Failed validation triggers regeneration with explicit feedback.

**Implementation Level**: Prompt/orchestration-level logic. No new infrastructure required.

---

## Validation Strategy

### Two-Stage Validation

1. **Pre-Response Validation** (Prompt-Level)
   - System prompt includes validation checklist
   - LLM self-validates before finalizing response
   - Reduces need for post-response validation

2. **Post-Response Validation** (Orchestration-Level)
   - Service validates response against rules
   - Checks for forbidden patterns
   - Triggers regeneration if validation fails

---

## Validation Rules by Intent

### 1. FACTUAL / STRUCTURAL Intent

#### Pass Conditions

✅ **MUST HAVE**:
- Direct answer in first 1-2 sentences
- At least one course reference (📖 Day X → Chapter Y)
- Word count: 50-150 words
- Specific facts from context (not vague)
- No hedging when data exists ("According to..." not "It might be...")

#### Fail Conditions

❌ **MUST NOT HAVE**:
- Vague language ("might be", "could be", "possibly" when data exists)
- Explanations beyond what was asked
- Examples (unless explicitly requested)
- Word count > 150 words
- Missing references
- General knowledge not in context
- Assumptions or guesses

#### Validation Checks

```javascript
function validateFactualResponse(response, question, context) {
    const checks = {
        hasDirectAnswer: checkDirectAnswer(response, question),
        hasReference: /📖.*Day \d+.*Chapter/.test(response),
        wordCount: getWordCount(response) >= 50 && getWordCount(response) <= 150,
        noVagueHedging: !hasVagueHedging(response, context),
        noExamples: !hasExamples(response),
        noGeneralKnowledge: !hasGeneralKnowledge(response, context),
        hasSpecificFacts: hasSpecificFacts(response, context)
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule)
    };
}
```

---

### 2. CONCEPTUAL / EXPLANATORY Intent

#### Pass Conditions

✅ **MUST HAVE**:
- Explanation of "why" or "how" (not just definition)
- Reasoning or relationships explained
- Word count: 100-200 words
- At least one course reference
- Clear, accessible language
- Progressive disclosure (starts simple, builds complexity)

#### Fail Conditions

❌ **MUST NOT HAVE**:
- Only definition without explanation
- Overly technical jargon without explanation
- Skipped reasoning ("why" not explained)
- Word count < 100 or > 200 words
- Missing references
- Vague explanations

#### Validation Checks

```javascript
function validateConceptualResponse(response, question, context) {
    const checks = {
        hasExplanation: hasExplanation(response, question), // Not just definition
        hasReasoning: hasReasoning(response), // "Why" or "how" explained
        wordCount: getWordCount(response) >= 100 && getWordCount(response) <= 200,
        hasReference: /📖.*Day \d+.*Chapter/.test(response),
        accessibleLanguage: !hasExcessiveJargon(response),
        progressiveDisclosure: hasProgressiveDisclosure(response)
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule))
    };
}
```

---

### 3. EXAMPLE / PRACTICAL Intent

#### Pass Conditions

✅ **MUST HAVE**:
- At least one concrete, real-world example
- Example appears early in response (first 50% of words)
- Example is specific and relatable
- Explanation of what example demonstrates
- Word count: 100-200 words
- At least one course reference

#### Fail Conditions

❌ **MUST NOT HAVE**:
- No examples or abstract examples only
- Examples appear late in response
- Examples without explanation
- Word count < 100 or > 200 words
- Missing references
- Vague or hypothetical examples

#### Validation Checks

```javascript
function validateExampleResponse(response, question, context) {
    const wordCount = getWordCount(response);
    const firstHalf = response.substring(0, Math.floor(response.length / 2));
    
    const checks = {
        hasConcreteExample: hasConcreteExample(response),
        exampleEarly: hasConcreteExample(firstHalf), // Example in first half
        exampleSpecific: hasSpecificExample(response), // Not abstract
        hasExplanation: hasExampleExplanation(response),
        wordCount: wordCount >= 100 && wordCount <= 200,
        hasReference: /📖.*Day \d+.*Chapter/.test(response)
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule)
    };
}
```

---

### 4. HOW-TO / GUIDED LEARNING Intent

#### Pass Conditions

✅ **MUST HAVE**:
- Numbered steps (1., 2., 3., etc.)
- Imperative language ("Do X", "Check Y")
- Each step is actionable
- Process overview before steps
- Word count: 150-250 words
- At least one course reference

#### Fail Conditions

❌ **MUST NOT HAVE**:
- No numbered steps
- Passive voice ("X should be done" instead of "Do X")
- Vague instructions
- Steps skipped or assumed
- Word count < 150 or > 250 words
- Missing references
- Solutions to labs (if lab-related)

#### Validation Checks

```javascript
function validateHowToResponse(response, question, context) {
    const checks = {
        hasNumberedSteps: hasNumberedSteps(response), // 1., 2., 3. pattern
        hasImperativeLanguage: hasImperativeLanguage(response), // "Do X", "Check Y"
        stepsActionable: areStepsActionable(response),
        hasProcessOverview: hasProcessOverview(response),
        wordCount: getWordCount(response) >= 150 && getWordCount(response) <= 250,
        hasReference: /📖.*Day \d+.*Chapter/.test(response),
        noLabSolutions: !hasLabSolutions(response, question)
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule)
    };
}
```

---

### 5. NAVIGATION / WHERE-IS Intent

#### Pass Conditions

✅ **MUST HAVE**:
- Exact course location (Day X → Chapter Y format)
- Clear navigation instructions
- Content preview (what they'll find)
- Word count: 50-100 words
- No information delivery (only location)

#### Fail Conditions

❌ **MUST NOT HAVE**:
- Vague locations ("somewhere in the course")
- Providing information instead of location
- Missing navigation path
- Word count < 50 or > 100 words
- No location format (Day X → Chapter Y)

#### Validation Checks

```javascript
function validateNavigationResponse(response, question, context) {
    const checks = {
        hasExactLocation: /Day \d+.*Chapter|📖.*Day \d+/.test(response),
        hasNavigationPath: hasNavigationInstructions(response),
        hasContentPreview: hasContentPreview(response),
        noInformationDelivery: !providesInformationInsteadOfLocation(response, question),
        wordCount: getWordCount(response) >= 50 && getWordCount(response) <= 100
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule)
    };
}
```

---

### 6. LAB GUIDANCE (NO ANSWERS) Intent

#### Pass Conditions

✅ **MUST HAVE**:
- Encouragement/supportive language
- Hints or guidance (not solutions)
- References to relevant chapters
- Word count: 100-200 words
- At least one course reference

#### Fail Conditions

❌ **MUST NOT HAVE**:
- Direct answers or solutions
- Code snippets
- Step-by-step solutions
- Expected outcomes revealed
- Templates that solve the lab
- Word count < 100 or > 200 words
- Missing references

#### Validation Checks

```javascript
function validateLabGuidanceResponse(response, question, context) {
    const checks = {
        hasEncouragement: hasEncouragement(response),
        noDirectAnswers: !hasDirectAnswers(response, question),
        noCodeSnippets: !hasCodeSnippets(response),
        noSolutions: !hasSolutions(response),
        hasGuidance: hasGuidance(response), // Hints, approaches
        hasChapterReferences: hasChapterReferences(response),
        wordCount: getWordCount(response) >= 100 && getWordCount(response) <= 200,
        hasReference: /📖.*Day \d+.*Chapter/.test(response)
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule)
    };
}
```

---

### 7. STRUGGLE / CONFUSION Intent

#### Pass Conditions

✅ **MUST HAVE**:
- Empathetic acknowledgment first
- Validation of feelings
- Simplified explanation
- Step-by-step understanding building
- Reassurance and encouragement
- Word count: 150-250 words
- At least one course reference

#### Fail Conditions

❌ **MUST NOT HAVE**:
- Dismissive language
- Complex language without simplification
- Rushed explanations
- Skipped empathy
- Word count < 150 or > 250 words
- Missing references

#### Validation Checks

```javascript
function validateStruggleResponse(response, question, context) {
    const checks = {
        hasEmpathy: hasEmpatheticAcknowledgment(response),
        validatesFeelings: validatesFeelings(response),
        hasSimplifiedExplanation: hasSimplifiedExplanation(response),
        hasStepByStep: hasStepByStepBuilding(response),
        hasReassurance: hasReassurance(response),
        wordCount: getWordCount(response) >= 150 && getWordCount(response) <= 250,
        hasReference: /📖.*Day \d+.*Chapter/.test(response),
        notDismissive: !isDismissive(response)
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule)
    };
}
```

---

### 8. OUT-OF-SCOPE Intent

#### Pass Conditions

✅ **MUST HAVE**:
- Polite but clear rejection
- Scope clarification (what AI Coach can help with)
- Redirection to appropriate resources
- Escalation notice (question forwarded to trainer)
- Word count: 50-100 words

#### Fail Conditions

❌ **MUST NOT HAVE**:
- Answering the out-of-scope question
- Dismissive or rude language
- Missing scope explanation
- No redirection
- Word count < 50 or > 100 words

#### Validation Checks

```javascript
function validateOutOfScopeResponse(response, question, context) {
    const checks = {
        hasPoliteRejection: hasPoliteRejection(response),
        hasScopeClarification: hasScopeClarification(response),
        hasRedirection: hasRedirection(response),
        hasEscalationNotice: hasEscalationNotice(response),
        doesNotAnswer: !answersOutOfScopeQuestion(response, question),
        wordCount: getWordCount(response) >= 50 && getWordCount(response) <= 100,
        notRude: !isRudeOrDismissive(response)
    };
    
    return {
        passed: Object.values(checks).every(v => v === true),
        failures: Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([rule, _]) => rule)
    };
}
```

---

## Helper Validation Functions

### Pattern Detection Functions

```javascript
/**
 * Check if response has direct answer in first sentences
 */
function checkDirectAnswer(response, question) {
    const firstTwoSentences = response.split(/[.!?]+/).slice(0, 2).join('.');
    const questionKeywords = extractKeywords(question);
    
    // Check if first sentences address the question directly
    return questionKeywords.some(keyword => 
        firstTwoSentences.toLowerCase().includes(keyword.toLowerCase())
    ) && firstTwoSentences.length > 20; // Minimum length check
}

/**
 * Check for vague hedging language when data exists
 */
function hasVagueHedging(response, context) {
    if (!context || context.chunks.length === 0) {
        return false; // No context, hedging is acceptable
    }
    
    const vaguePatterns = [
        /\b(might be|could be|possibly|perhaps|maybe|probably)\b/i,
        /\b(it seems|it appears|I think|I believe)\b/i
    ];
    
    // If context exists and answer is clear, vague hedging is bad
    return vaguePatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response contains examples
 */
function hasExamples(response) {
    const examplePatterns = [
        /\b(example|for instance|such as|like|e\.g\.)\b/i,
        /^Example:/i,
        /Here's (an|a) example/i
    ];
    
    return examplePatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response contains concrete, specific examples
 */
function hasConcreteExample(response) {
    const examplePatterns = [
        /\b(example|for instance|such as)\b/i
    ];
    
    if (!examplePatterns.some(pattern => pattern.test(response))) {
        return false;
    }
    
    // Check if example is specific (not abstract)
    const abstractPatterns = [
        /\b(imagine|suppose|hypothetically|in theory)\b/i
    ];
    
    // Has example pattern but not too abstract
    return !abstractPatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response has numbered steps
 */
function hasNumberedSteps(response) {
    const stepPatterns = [
        /^\d+\./m,  // Lines starting with "1."
        /\b(step \d+|first|second|third|then|next|finally)\b/i
    ];
    
    return stepPatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response uses imperative language
 */
function hasImperativeLanguage(response) {
    const imperativePatterns = [
        /^(Do|Check|Verify|Review|Complete|Create|Build|Use|Select|Choose|Follow)/im,
        /\b(do|check|verify|review|complete|create|build|use|select|choose|follow)\b/i
    ];
    
    return imperativePatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response has direct answers (for lab guidance)
 */
function hasDirectAnswers(response, question) {
    if (!question.toLowerCase().includes('lab')) {
        return false; // Not lab-related
    }
    
    const solutionPatterns = [
        /(solution|answer|result|output|code|script|template)/i,
        /(do this|write this|use this code|copy this)/i,
        /```[\s\S]*?```/, // Code blocks
        /<code>[\s\S]*?<\/code>/i
    ];
    
    return solutionPatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response has code snippets
 */
function hasCodeSnippets(response) {
    const codePatterns = [
        /```[\s\S]*?```/, // Markdown code blocks
        /<code>[\s\S]*?<\/code>/i, // HTML code tags
        /function\s+\w+\s*\(/, // Function definitions
        /\b(const|let|var)\s+\w+\s*=/ // Variable declarations
    ];
    
    return codePatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response has empathetic acknowledgment
 */
function hasEmpatheticAcknowledgment(response) {
    const empathyPatterns = [
        /\b(understand|I see|I know|I get it|that makes sense)\b/i,
        /\b(confusing|challenging|difficult|struggling)\b/i,
        /\b(you're not alone|many learners|it's normal)\b/i
    ];
    
    return empathyPatterns.some(pattern => pattern.test(response));
}

/**
 * Check if response provides information instead of location
 */
function providesInformationInsteadOfLocation(response, question) {
    // If question asks "where", response should give location, not information
    if (!/where|which (chapter|day|section)/i.test(question)) {
        return false;
    }
    
    // If response has long explanations without clear location, it's providing info
    const locationPattern = /Day \d+.*Chapter|📖.*Day \d+/;
    const hasLocation = locationPattern.test(response);
    
    // If no location but has long explanation, providing info instead
    return !hasLocation && getWordCount(response) > 30;
}

/**
 * Get word count
 */
function getWordCount(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Check if response has course reference
 */
function hasCourseReference(response) {
    return /📖.*Day \d+.*Chapter|Day \d+.*→.*Chapter/i.test(response);
}
```

---

## Main Validation Function (Pseudocode)

```javascript
/**
 * Validate AI Coach response based on intent
 * @param {string} response - AI-generated response
 * @param {string} intent - Classified intent
 * @param {string} question - Original learner question
 * @param {Object} context - Context object (chunks, course info, etc.)
 * @returns {Object} Validation result
 */
function validateResponse(response, intent, question, context) {
    // Basic validation (applies to all intents)
    const basicChecks = {
        hasContent: response.trim().length > 0,
        hasReference: hasCourseReference(response),
        notEmpty: response.trim().length > 10,
        noGeneralKnowledge: !hasGeneralKnowledge(response, context)
    };
    
    if (!Object.values(basicChecks).every(v => v === true)) {
        return {
            passed: false,
            intent: intent,
            failures: Object.entries(basicChecks)
                .filter(([_, passed]) => !passed)
                .map(([rule, _]) => rule),
            level: 'basic'
        };
    }
    
    // Intent-specific validation
    let intentValidation;
    
    switch (intent) {
        case 'factual':
            intentValidation = validateFactualResponse(response, question, context);
            break;
        case 'conceptual':
            intentValidation = validateConceptualResponse(response, question, context);
            break;
        case 'example':
            intentValidation = validateExampleResponse(response, question, context);
            break;
        case 'how_to':
            intentValidation = validateHowToResponse(response, question, context);
            break;
        case 'navigation':
            intentValidation = validateNavigationResponse(response, question, context);
            break;
        case 'lab_guidance':
            intentValidation = validateLabGuidanceResponse(response, question, context);
            break;
        case 'struggle':
            intentValidation = validateStruggleResponse(response, question, context);
            break;
        case 'out_of_scope':
            intentValidation = validateOutOfScopeResponse(response, question, context);
            break;
        default:
            // Fallback: basic validation only
            intentValidation = { passed: true, failures: [] };
    }
    
    return {
        passed: intentValidation.passed,
        intent: intent,
        failures: intentValidation.failures || [],
        level: 'intent-specific',
        wordCount: getWordCount(response)
    };
}
```

---

## Regeneration Trigger Logic

### When to Regenerate

```javascript
/**
 * Determine if response should be regenerated
 * @param {Object} validationResult - Result from validateResponse()
 * @param {number} confidence - AI confidence score
 * @returns {Object} Regeneration decision
 */
function shouldRegenerate(validationResult, confidence) {
    // Critical failures: always regenerate
    const criticalFailures = [
        'noDirectAnswers', // Lab guidance gave answers
        'hasCodeSnippets', // Code in lab guidance
        'hasSolutions', // Solutions provided
        'doesNotAnswer', // Out-of-scope question answered
        'noGeneralKnowledge' // Used general knowledge
    ];
    
    const hasCriticalFailure = validationResult.failures.some(f => 
        criticalFailures.includes(f)
    );
    
    if (hasCriticalFailure) {
        return {
            regenerate: true,
            reason: 'critical_failure',
            priority: 'high',
            maxAttempts: 3
        };
    }
    
    // Intent-specific failures: regenerate if multiple
    if (!validationResult.passed && validationResult.failures.length >= 2) {
        return {
            regenerate: true,
            reason: 'multiple_failures',
            priority: 'medium',
            maxAttempts: 2
        };
    }
    
    // Low confidence + validation failure: regenerate
    if (!validationResult.passed && confidence < 0.7) {
        return {
            regenerate: true,
            reason: 'low_confidence_and_validation_failure',
            priority: 'high',
            maxAttempts: 2
        };
    }
    
    // Single non-critical failure: may regenerate once
    if (!validationResult.passed && validationResult.failures.length === 1) {
        return {
            regenerate: true,
            reason: 'single_failure',
            priority: 'low',
            maxAttempts: 1
        };
    }
    
    return {
        regenerate: false,
        reason: 'passed'
    };
}
```

---

## Regeneration Prompt Enhancement

### Adding Validation Feedback to Regeneration

When regeneration is triggered, enhance the system prompt with explicit feedback:

```javascript
/**
 * Build regeneration prompt with validation feedback
 * @param {string} originalPrompt - Original system prompt
 * @param {Object} validationResult - Validation failure details
 * @param {string} originalResponse - Failed response
 * @returns {string} Enhanced prompt for regeneration
 */
function buildRegenerationPrompt(originalPrompt, validationResult, originalResponse) {
    const feedback = generateValidationFeedback(validationResult);
    
    return `${originalPrompt}

[VALIDATION FEEDBACK]

Your previous response failed validation. Please regenerate with these corrections:

${feedback}

[PREVIOUS RESPONSE (DO NOT REPEAT)]
${originalResponse.substring(0, 200)}...

[REQUIREMENTS]
- Address all validation failures listed above
- Ensure response passes all intent-specific rules
- Maintain quality and accuracy
`;
}

/**
 * Generate human-readable validation feedback
 */
function generateValidationFeedback(validationResult) {
    const feedbackMessages = {
        'hasDirectAnswer': 'Response must answer the question directly in the first 1-2 sentences.',
        'hasReference': 'Response must include at least one course reference: 📖 Day X → Chapter Y',
        'wordCount': `Response word count must be within intent limits. Current: ${validationResult.wordCount} words.`,
        'noVagueHedging': 'Do not use vague language ("might be", "could be") when information exists in context. Use definitive language.',
        'noExamples': 'This is a FACTUAL question. Do not include examples.',
        'hasConcreteExample': 'This is an EXAMPLE question. You MUST start with a concrete, real-world example.',
        'exampleEarly': 'Example must appear in the first half of the response.',
        'hasNumberedSteps': 'This is a HOW-TO question. You MUST provide numbered, step-by-step instructions.',
        'hasImperativeLanguage': 'Use imperative language ("Do X", "Check Y") not passive voice.',
        'noDirectAnswers': 'CRITICAL: This is LAB GUIDANCE. You MUST NOT provide direct answers, solutions, or code snippets.',
        'hasCodeSnippets': 'CRITICAL: Do not include code snippets in lab guidance responses.',
        'hasEmpathy': 'This learner is struggling. You MUST acknowledge their struggle with empathy first.',
        'hasPoliteRejection': 'This question is out of scope. You MUST politely reject and explain what you can help with.',
        'doesNotAnswer': 'CRITICAL: Do not answer out-of-scope questions. Reject politely and redirect.'
    };
    
    return validationResult.failures
        .map(failure => `- ${feedbackMessages[failure] || `Fix: ${failure}`}`)
        .join('\n');
}
```

---

## Integration with AI Coach Service

### Validation Flow

```javascript
/**
 * Process query with validation and regeneration
 */
async function processQueryWithValidation(learnerId, courseId, question, intent, context) {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        // Generate response
        const response = await generateResponse(question, intent, context);
        const confidence = await calculateConfidence(response, context);
        
        // Validate response
        const validation = validateResponse(response, intent, question, context);
        
        // Check if regeneration needed
        const regeneration = shouldRegenerate(validation, confidence);
        
        if (!regeneration.regenerate) {
            // Validation passed
            return {
                success: true,
                response: response,
                confidence: confidence,
                validation: validation,
                attempts: attempts + 1
            };
        }
        
        // Validation failed - regenerate
        attempts++;
        
        if (attempts >= regeneration.maxAttempts) {
            // Max attempts reached - escalate
            return {
                success: false,
                error: 'validation_failed_after_max_attempts',
                validation: validation,
                attempts: attempts,
                escalate: true
            };
        }
        
        // Build regeneration prompt with feedback
        const enhancedPrompt = buildRegenerationPrompt(
            systemPrompt,
            validation,
            response
        );
        
        // Update context for next attempt
        context.previousAttempt = response;
        context.validationFeedback = validation.failures;
    }
}
```

---

## Pre-Response Validation (Prompt-Level)

### Adding Self-Validation to System Prompt

Add this section to the system prompt:

```
[RESPONSE VALIDATION CHECKLIST]

Before finalizing your response, verify:

For {INTENT_TYPE} intent:
{INSERT_INTENT_SPECIFIC_CHECKLIST}

Universal checks:
- ✓ All information from context chunks only
- ✓ At least one course reference included (📖 Day X → Chapter Y)
- ✓ Word count within limits
- ✓ No forbidden behaviors
- ✓ Confidence assessed

If any check fails, regenerate your response before sending.
```

### Intent-Specific Checklists (for prompt)

**FACTUAL**:
- ✓ Direct answer in first sentence
- ✓ No vague hedging when data exists
- ✓ No examples
- ✓ 50-150 words

**EXAMPLE**:
- ✓ Concrete example in first half of response
- ✓ Example is specific and relatable
- ✓ Example explained
- ✓ 100-200 words

**LAB GUIDANCE**:
- ✓ Encouragement included
- ✓ NO direct answers or solutions
- ✓ NO code snippets
- ✓ Only hints and guidance
- ✓ 100-200 words

---

## Pass/Fail Conditions Summary

### Universal Pass Conditions (All Intents)

✅ Response has content (> 10 characters)  
✅ At least one course reference (📖 Day X → Chapter Y)  
✅ Word count within intent-specific limits  
✅ No general knowledge (only context chunks)  
✅ No critical errors (code in labs, answers to out-of-scope)

### Universal Fail Conditions (All Intents)

❌ Empty or too short response  
❌ Missing course references  
❌ Word count outside limits  
❌ Uses general knowledge  
❌ Critical errors present

### Intent-Specific Pass/Fail

See individual intent validation sections above for specific pass/fail conditions.

---

## Edge Cases

### 1. Validation Fails but Response is Acceptable

**Scenario**: Response fails minor validation (e.g., word count 151 vs 150 limit) but is otherwise good.

**Handling**:
- Use tolerance thresholds (e.g., ±5 words)
- Single non-critical failure may not trigger regeneration
- Log for monitoring but don't block

### 2. Multiple Regeneration Attempts Fail

**Scenario**: Response fails validation 3 times in a row.

**Handling**:
- Escalate to trainer immediately
- Provide partial response with disclaimer
- Log validation failures for analysis

### 3. Validation Too Strict

**Scenario**: Valid responses being rejected.

**Handling**:
- Monitor validation failure rates
- Adjust thresholds based on data
- Use confidence scores to inform validation strictness

### 4. Intent Misclassification

**Scenario**: Intent is wrong, so validation rules don't match.

**Handling**:
- Validation should still catch basic issues
- Intent misclassification is separate issue
- Both should be monitored

---

## Monitoring & Metrics

### Track These Metrics

1. **Validation Pass Rate**: % of responses passing validation
2. **Regeneration Rate**: % of responses requiring regeneration
3. **Critical Failure Rate**: % with critical failures (lab answers, etc.)
4. **Average Attempts**: Average regeneration attempts per query
5. **Failure Types**: Distribution of validation failure types

### Alert Thresholds

- Critical failure rate > 5% → Alert
- Regeneration rate > 30% → Review
- Average attempts > 1.5 → Investigate
- Specific intent failure rate > 20% → Review intent rules

---

## Implementation Notes

### No New Infrastructure Required

This validation can be implemented entirely in:

1. **AI Coach Service** (`lms/services/ai-coach-service.js`)
   - Add validation functions
   - Add regeneration logic
   - Integrate with existing response generation

2. **System Prompt** (enhancement)
   - Add self-validation checklist
   - Add intent-specific validation rules

3. **Helper Functions** (new file or in service)
   - Pattern detection functions
   - Validation logic
   - Feedback generation

### Performance Considerations

- Validation is fast (pattern matching, no LLM calls)
- Regeneration adds 1-2 LLM calls (if needed)
- Monitor regeneration rate to ensure cost control
- Cache validation results for similar responses

---

## Testing Strategy

### Unit Tests

Test each validation function:
- Positive cases (should pass)
- Negative cases (should fail)
- Edge cases (boundary conditions)

### Integration Tests

Test end-to-end:
- Query → Response → Validation → Regeneration → Final Response
- Verify regeneration improves response quality
- Verify escalation triggers correctly

### Validation Tests

- 100% of responses validated
- Critical failures always trigger regeneration
- Regeneration improves validation pass rate
- No valid responses incorrectly rejected

---

**Document Status**: ✅ Ready for Implementation

