#!/usr/bin/env python3
"""
Generate DOCX Templates for All Lab Submissions

This script automatically finds all lab submission format markdown files
and generates corresponding DOCX templates.

Usage:
    python generate_all_templates.py [base_dir] [output_dir]

Example:
    python generate_all_templates.py data/courses/seo-master-2026/content/labs labs/templates/
"""

import sys
import os
from pathlib import Path
from parse_lab_submission import generate_docx_template


def find_submission_files(base_dir):
    """Find all submission format markdown files"""
    base_path = Path(base_dir)
    
    if not base_path.exists():
        raise FileNotFoundError(f"Base directory not found: {base_path}")
    
    # Find all files matching pattern: Day_XX_Lab_XX_Submission_Format.md
    pattern = r'Day_\d+_Lab_\d+_Submission_Format\.md'
    import re
    
    submission_files = []
    for file_path in base_path.glob('**/*.md'):
        if re.search(pattern, file_path.name):
            submission_files.append(file_path)
    
    # Sort by day and lab number
    def sort_key(path):
        match = re.search(r'Day_(\d+)_Lab_(\d+)_', path.name)
        if match:
            return (int(match.group(1)), int(match.group(2)))
        return (999, 999)
    
    submission_files.sort(key=sort_key)
    
    return submission_files


def generate_all_templates(base_dir, output_dir=None, course_name='seo-master-2026'):
    """Generate DOCX templates for all lab submissions"""
    if output_dir is None:
        # Default to course-specific assets directory
        output_dir = Path(f'data/courses/{course_name}/assets/templates')
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    submission_files = find_submission_files(base_dir)
    
    if not submission_files:
        print(f"No submission format files found in {base_dir}")
        return
    
    print(f"Found {len(submission_files)} submission format files")
    print(f"Output directory: {output_dir}\n")
    
    success_count = 0
    error_count = 0
    
    for submission_file in submission_files:
        try:
            print(f"Processing: {submission_file.name}...", end=' ')
            generate_docx_template(submission_file, output_dir, course_name)
            print("✓")
            success_count += 1
        except Exception as e:
            print(f"✗ Error: {e}")
            error_count += 1
    
    print(f"\nCompleted: {success_count} successful, {error_count} errors")


if __name__ == '__main__':
    base_dir = sys.argv[1] if len(sys.argv) > 1 else 'data/courses/seo-master-2026/content/labs'
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    course_name = sys.argv[3] if len(sys.argv) > 3 else 'seo-master-2026'
    
    try:
        generate_all_templates(base_dir, output_dir, course_name)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

