-- Add aliases field to content_nodes for course-agnostic retrieval
-- This allows courses to define their own vocabulary without hardcoding

ALTER TABLE content_nodes 
ADD COLUMN IF NOT EXISTS aliases TEXT[];

-- Add index for aliases array search
CREATE INDEX IF NOT EXISTS idx_content_nodes_aliases 
ON content_nodes USING GIN (aliases) 
WHERE aliases IS NOT NULL AND array_length(aliases, 1) > 0;

-- Add aliases to canonical_reference_registry for consistency
ALTER TABLE canonical_reference_registry 
ADD COLUMN IF NOT EXISTS aliases TEXT[];

-- Add index for aliases in registry
CREATE INDEX IF NOT EXISTS idx_registry_aliases 
ON canonical_reference_registry USING GIN (aliases) 
WHERE aliases IS NOT NULL AND array_length(aliases, 1) > 0;

-- Comment explaining usage
COMMENT ON COLUMN content_nodes.aliases IS 'Alternative terms/variations for this node (e.g., ["SEO", "search engine optimization", "search optimization"]). Used for course-agnostic retrieval.';
COMMENT ON COLUMN canonical_reference_registry.aliases IS 'Alternative terms/variations for this reference. Used for course-agnostic retrieval.';

