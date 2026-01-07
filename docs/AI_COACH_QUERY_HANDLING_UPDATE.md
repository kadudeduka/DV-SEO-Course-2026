# AI Coach Query Handling Update

## Overview
Updated the AI Coach system to only handle **Content queries** and provide appropriate messages for all other query types.

## Changes Made

### 1. New Query Category: `unrelated`
Added a new query category to identify questions completely outside the scope of the course.

**Examples of unrelated queries:**
- "What's the weather?"
- "Tell me a joke"
- "How to cook pasta?"
- General knowledge questions unrelated to the course

### 2. Query Category Classification
The system now classifies queries into these categories:
- **content** - Questions about course concepts/subject matter ✅ **HANDLED**
- **lab_guidance** - Questions about labs/assignments ❌ **NOT HANDLED**
- **structural** - Questions about course structure ❌ **NOT HANDLED**
- **navigation** - Questions about course navigation ❌ **NOT HANDLED**
- **planning** - Questions about time/planning ❌ **NOT HANDLED**
- **unrelated** - Questions outside the scope of the course ❌ **NOT HANDLED**

### 3. Response Messages

#### For Unrelated Queries
```
"This question is outside the scope of this course."
```

#### For Structural Queries
```
"I am not designed to handle Structural queries. Please contact your trainer for information about course structure."
```

#### For Navigation Queries
```
"I am not designed to handle Navigation queries. Please contact your trainer for guidance on course navigation."
```

#### For Planning Queries
```
"I am not designed to handle Planning queries. Please contact your trainer for help with course planning."
```

#### For Lab Guidance Queries
```
"I am not designed to handle Lab Guidance queries. Please contact your trainer for help with labs and assignments."
```

### 4. Content Query Handling
Only **content queries** proceed through the full AI Coach pipeline:
1. Query Normalization
2. Concept Expansion
3. Reference Resolution
4. Answer Generation
5. Auto-escalation (if needed)

## Files Modified

### 1. `lms/services/query-normalizer-service.js`
- Added `"unrelated"` to the query category classification rules
- Updated category detection keywords to include unrelated queries
- Updated output format to include `"unrelated"` as a valid category

### 2. `lms/services/strict-pipeline-service.js`
- Added handlers for all non-content query types
- Each handler returns an appropriate message directing users to contact their trainer
- Removed the implementation of `_handleStructuralQuery`, `_handleNavigationQuery`, and `_handlePlanningQuery` methods (no longer needed)
- Only content queries proceed through the full pipeline

## Benefits

1. **Clear Boundaries**: Users understand what the AI Coach can and cannot help with
2. **Better User Experience**: Clear guidance on where to get help for different types of questions
3. **Reduced Confusion**: No misleading responses for queries outside the AI Coach's scope
4. **Focused System**: AI Coach focuses on what it does best - answering content questions

## Testing Recommendations

Test the following query types to ensure proper categorization and responses:

### Content Queries (Should be handled)
- "What is AEO?"
- "Explain technical SEO"
- "How does keyword research work?"

### Unrelated Queries (Should show "outside the scope" message)
- "What's the weather today?"
- "Tell me a joke"
- "How to cook pasta?"

### Structural Queries (Should show "not designed to handle" message)
- "How many chapters are in the course?"
- "What's the course syllabus?"

### Navigation Queries (Should show "not designed to handle" message)
- "Can I skip chapter 2?"
- "What's the recommended order?"

### Planning Queries (Should show "not designed to handle" message)
- "How long will chapter 3 take?"
- "What's the course duration?"

### Lab Guidance Queries (Should show "not designed to handle" message)
- "I'm stuck in lab 2"
- "Help with lab submission"

## Future Considerations

If the system needs to handle other query types in the future:
1. Update the query category classification in `query-normalizer-service.js`
2. Implement the appropriate handler in `strict-pipeline-service.js`
3. Update this documentation

## Related Documents
- `docs/QUERY_NORMALIZATION_IMPROVEMENTS_REQUIREMENTS.md` - Query normalization system design
- `docs/AI_COACH_GUARDRAILS.md` - AI Coach guardrails and constraints
- `docs/ESCALATION_SYSTEM_COMPLETE.md` - Escalation system documentation

