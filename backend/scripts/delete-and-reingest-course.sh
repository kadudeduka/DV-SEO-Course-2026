#!/bin/bash

# Script to delete and re-ingest AI Coach data for a course
# Usage: ./backend/scripts/delete-and-reingest-course.sh <courseId>
# Example: ./backend/scripts/delete-and-reingest-course.sh seo-master-2026

set -e

COURSE_ID=$1

if [ -z "$COURSE_ID" ]; then
    echo "Error: Course ID is required"
    echo "Usage: ./backend/scripts/delete-and-reingest-course.sh <courseId>"
    echo "Example: ./backend/scripts/delete-and-reingest-course.sh seo-master-2026"
    exit 1
fi

echo "=========================================="
echo "Delete and Re-ingest Course: $COURSE_ID"
echo "=========================================="
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "Warning: Supabase CLI not found. You'll need to run the SQL manually."
    echo ""
    echo "Step 1: Delete course data"
    echo "Run this SQL in Supabase SQL Editor:"
    echo "  sed 's/:'\"'\"'course_id'\"'\"'/:'\"'\"'$COURSE_ID'\"'\"'/g' backend/scripts/delete-course-ai-coach-data.sql"
    echo ""
    echo "Step 2: Re-ingest content"
    echo "Run: node lms/scripts/reingest-course-content.js $COURSE_ID"
    exit 1
fi

# Step 1: Delete course data
echo "Step 1: Deleting AI Coach data for course: $COURSE_ID"
echo ""

# Replace course_id in SQL file
TEMP_SQL=$(mktemp)
sed "s/:'course_id'/:'$COURSE_ID'/g" backend/scripts/delete-course-ai-coach-data.sql > "$TEMP_SQL"

# Execute SQL (requires Supabase project link)
echo "Note: You need to run the SQL manually in Supabase SQL Editor"
echo "SQL file: $TEMP_SQL"
echo ""
read -p "Press Enter after you've deleted the data in Supabase SQL Editor..."

# Step 2: Re-ingest content
echo ""
echo "Step 2: Re-ingesting course content..."
echo ""

node lms/scripts/reingest-course-content.js "$COURSE_ID"

echo ""
echo "=========================================="
echo "Done! Course $COURSE_ID has been re-ingested."
echo "=========================================="

