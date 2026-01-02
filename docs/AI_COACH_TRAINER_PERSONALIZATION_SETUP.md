# AI Coach Trainer Personalization Setup Guide

## Overview

Trainer personalization allows each trainer to customize their AI Coach instance with:
- **Custom Coach Name**: e.g., "John's AI Coach", "Sarah's AI Assistant"
- **LinkedIn Profile**: Share your professional profile with learners
- **Trainer Information**: Bio, expertise, years of experience
- **Share Level**: Control how much information is shared (name only, name + expertise, full)

## Database Setup

The `ai_coach_trainer_personalization` table is already created by the migration. You can set personalization via SQL or through the admin interface (when implemented).

## Setting Personalization via SQL

### Course-Specific Personalization

```sql
-- Insert or update personalization for a specific course
INSERT INTO ai_coach_trainer_personalization (
    trainer_id,
    course_id,
    coach_name,
    linkedin_profile_url,
    trainer_info,
    personalization_enabled,
    share_level
) VALUES (
    'YOUR_TRAINER_USER_ID',           -- UUID of trainer user
    'seo-master-2026',                -- Course ID
    'John''s AI Coach',                -- Custom coach name
    'https://linkedin.com/in/johndoe', -- LinkedIn profile URL
    '{
        "name": "John Doe",
        "bio": "SEO expert with 10+ years of experience...",
        "expertise": "SEO, Content Marketing, Technical SEO",
        "years_experience": 10
    }'::jsonb,
    true,                              -- Enable personalization
    'full'                             -- Share level: 'name_only', 'name_expertise', 'full'
)
ON CONFLICT (trainer_id, course_id) 
DO UPDATE SET
    coach_name = EXCLUDED.coach_name,
    linkedin_profile_url = EXCLUDED.linkedin_profile_url,
    trainer_info = EXCLUDED.trainer_info,
    personalization_enabled = EXCLUDED.personalization_enabled,
    share_level = EXCLUDED.share_level,
    updated_at = NOW();
```

### Global Personalization (All Courses)

```sql
-- Insert or update global personalization (applies to all courses)
INSERT INTO ai_coach_trainer_personalization (
    trainer_id,
    course_id,                         -- NULL for global
    coach_name,
    linkedin_profile_url,
    trainer_info,
    personalization_enabled,
    share_level
) VALUES (
    'YOUR_TRAINER_USER_ID',
    NULL,                              -- NULL = global
    'John''s AI Coach',
    'https://linkedin.com/in/johndoe',
    '{
        "name": "John Doe",
        "bio": "SEO expert with 10+ years of experience...",
        "expertise": "SEO, Content Marketing",
        "years_experience": 10
    }'::jsonb,
    true,
    'name_expertise'
)
ON CONFLICT (trainer_id, course_id) 
DO UPDATE SET
    coach_name = EXCLUDED.coach_name,
    linkedin_profile_url = EXCLUDED.linkedin_profile_url,
    trainer_info = EXCLUDED.trainer_info,
    personalization_enabled = EXCLUDED.personalization_enabled,
    share_level = EXCLUDED.share_level,
    updated_at = NOW();
```

## Finding Your Trainer ID

To find your trainer user ID:

```sql
-- Find trainer user ID by email
SELECT id, email, full_name, role 
FROM users 
WHERE email = 'trainer@example.com' AND role = 'trainer';

-- Or find all trainers
SELECT id, email, full_name 
FROM users 
WHERE role = 'trainer';
```

## Share Levels

- **`name_only`**: Only the coach name is shown (e.g., "John's AI Coach")
- **`name_expertise`**: Coach name + expertise areas
- **`full`**: Coach name + expertise + bio + LinkedIn profile

## How It Works

1. **Widget Display**: The AI Coach widget header shows the personalized coach name
2. **System Prompt**: Trainer information is included in the AI's system prompt, allowing it to reference the trainer's expertise and background
3. **Course-Specific**: Each course can have its own personalization, or use a global one

## Priority

- Course-specific personalization takes priority over global
- If no personalization is set, defaults to "AI Coach"

## Example

```sql
-- Example: Set up personalization for trainer John Doe for SEO Master course
INSERT INTO ai_coach_trainer_personalization (
    trainer_id,
    course_id,
    coach_name,
    linkedin_profile_url,
    trainer_info,
    personalization_enabled,
    share_level
) VALUES (
    (SELECT id FROM users WHERE email = 'john@example.com' AND role = 'trainer'),
    'seo-master-2026',
    'John''s AI Coach',
    'https://linkedin.com/in/johndoe',
    '{
        "name": "John Doe",
        "bio": "Digital marketing strategist specializing in SEO and content marketing. 10+ years helping businesses improve their online visibility.",
        "expertise": "SEO, Technical SEO, Content Marketing, Link Building",
        "years_experience": 10
    }'::jsonb,
    true,
    'full'
)
ON CONFLICT (trainer_id, course_id) 
DO UPDATE SET
    coach_name = EXCLUDED.coach_name,
    linkedin_profile_url = EXCLUDED.linkedin_profile_url,
    trainer_info = EXCLUDED.trainer_info,
    personalization_enabled = EXCLUDED.personalization_enabled,
    share_level = EXCLUDED.share_level,
    updated_at = NOW();
```

## Testing

After setting personalization:

1. Navigate to a course page where the trainer is assigned
2. Open the AI Coach widget
3. The header should show the personalized coach name
4. Ask a question - the AI should reference the trainer's expertise if relevant

## Disabling Personalization

```sql
-- Disable personalization for a course
UPDATE ai_coach_trainer_personalization
SET personalization_enabled = false
WHERE trainer_id = 'YOUR_TRAINER_USER_ID' 
AND course_id = 'seo-master-2026';
```

