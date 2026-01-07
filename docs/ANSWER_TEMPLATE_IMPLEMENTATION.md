# Answer Template Implementation

## Overview

The AI Coach now uses a standardized, empathetic answer template that ensures every response:
- Feels personally understood
- Is clearly structured and easy to read
- Cites exact course references
- Encourages continued learning

## Template Structure

Every AI Coach response follows this structure:

### 1. Coach Identity
```
🤖 {AI Coach Name}
```

### 2. Understanding Section (MANDATORY)
```
🔍 **What I understand from your question**

You're asking about {simplified intent}. Let me break this down for you.
```

### 3. Explanation Section (MANDATORY)
```
📘 **Explanation**

{Formatted explanation with bullets/structured content}
```

### 4. Importance Section (OPTIONAL)
```
📌 **Why this matters**

{2-line importance statement - only if relevant}
```

### 5. Reference Section (MANDATORY IF AVAILABLE)
```
📍 **Course Reference(s)**

• Day X → Chapter Y → {Topic / Section}
• Day X → Lab Y → Step Z
```

### 6. Engagement Section (MANDATORY)
```
💬 **What would you like to explore next?**

• Learn more about related concepts in {topic}
• See how to apply {topic} in practice
• Explore examples of {topic}
• Understand the next steps for mastering {topic}
```

## Implementation

### AnswerRendererService

Located at: `lms/services/answer-renderer-service.js`

**Key Method:**
```javascript
answerRendererService.render({
    coachName: 'AI Coach',
    normalizedIntent: 'What is keyword research?',
    llmAnswer: 'Raw LLM explanation...',
    resolvedNodes: [...],
    canonicalReferences: [...],
    options: {}
})
```

### Integration Points

1. **StrictPipelineService** (`lms/services/strict-pipeline-service.js`)
   - `assembleFinalAnswer()` now calls `answerRendererService.render()`
   - Receives `coachName`, `normalizedIntent`, and `nodes` from options

2. **AICoachService** (`lms/services/ai-coach-service.js`)
   - Fetches `coachName` from `trainerPersonalizationService`
   - Passes `coachName` to `strictPipelineService.processQueryStrict()`

## Example Output

### Input Query
```
"Tell me more about keyword research"
```

### Normalized Intent
```
"What is keyword research?"
```

### LLM Answer (Raw)
```
Keyword research is the process of finding and analyzing search terms that users enter into search engines. It involves identifying high-value keywords that align with your content goals and target audience. The process typically includes analyzing search volume, competition, and user intent to select the most effective keywords for SEO campaigns.
```

### Formatted Output
```
🤖 AI Coach

🔍 **What I understand from your question**

You're asking about keyword research. Let me break this down for you.

📘 **Explanation**

• Keyword research is the process of finding and analyzing search terms that users enter into search engines
• It involves identifying high-value keywords that align with your content goals and target audience
• The process typically includes analyzing search volume, competition, and user intent to select the most effective keywords for SEO campaigns

📌 **Why this matters**

Keyword research is essential for creating content that matches what your audience is actually searching for, improving your chances of ranking in search results.

📍 **Course Reference(s)**

• Day 5 → Chapter 2 → Keyword Research Fundamentals
• Day 5 → Chapter 3 → Keyword Analysis Tools

💬 **What would you like to explore next?**

• Learn more about related concepts in keyword research
• See how to apply keyword research in practice
• Explore examples of keyword research
• Understand the next steps for mastering keyword research
```

## Behavioral Guardrails

### No References Case
If no references are resolved, the template returns:

```
🤖 AI Coach

🔍 **What I understand from your question**

I understand you're looking for information on this topic.

Unfortunately, this topic is not covered in the current course material. Please check with your trainer or refer to the course content directly.

💬 **What would you like to explore next?**

• Ask about a different topic covered in the course
• Review your current progress and next steps
• Get help with a specific lab or assignment
```

### Strict Rules
- **Never** say "based on the course"
- **Never** guess chapters or days
- **Never** mention internal system logic
- **Never** hallucinate references
- **Always** use exact canonical references from resolved nodes

## Benefits

1. **Learner Trust**: Consistent structure builds familiarity and trust
2. **Clarity**: Clear sections make answers easy to scan and understand
3. **Reference Safety**: System-controlled references prevent hallucination
4. **Engagement**: Encourages continued learning with specific next steps
5. **Personalization**: Coach name and understanding section feel personal

## Testing

To test the template:

1. Ask a question: "Tell me more about keyword research"
2. Verify the response includes all 6 sections
3. Check that references are exact (not guessed)
4. Confirm the tone is calm, supportive, and mentor-like

## Future Enhancements

- Customizable engagement options based on learner progress
- Dynamic importance section based on concept type
- Multi-language support for template sections
- A/B testing for engagement section effectiveness

