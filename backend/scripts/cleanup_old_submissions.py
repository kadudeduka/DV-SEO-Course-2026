#!/usr/bin/env python3
"""
Cleanup Old Lab Submissions

This script deletes lab submission files from Supabase Storage that are older than 30 days.
It should be run daily via a cron job or scheduled task.

Usage:
    python cleanup_old_submissions.py [--dry-run] [--days 30]

Environment Variables Required:
    SUPABASE_URL - Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Service role key for admin access
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py package not installed. Install with: pip install supabase")
    sys.exit(1)


def get_supabase_client():
    """Create Supabase client with service role key"""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
        )
    
    return create_client(supabase_url, supabase_key)


def get_old_submissions(client, days=30):
    """Get submissions older than specified days"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    cutoff_iso = cutoff_date.isoformat()
    
    # Query submissions with file_url that are older than cutoff
    response = client.table('lab_submissions')\
        .select('id, file_url, file_name, submitted_at, user_id, course_id, lab_id')\
        .not_.is_('file_url', 'null')\
        .lt('submitted_at', cutoff_iso)\
        .execute()
    
    return response.data if response.data else []


def delete_file_from_storage(client, file_path):
    """Delete file from Supabase Storage"""
    try:
        # Extract bucket and file path
        # Format: lab-submissions/{userId}/{courseId}/{labId}/{timestamp}_{filename}.docx
        if not file_path.startswith('lab-submissions/'):
            return False
        
        bucket_name = 'lab-submissions'
        file_key = file_path
        
        # Remove file from storage
        result = client.storage.from_(bucket_name).remove([file_key])
        return True
    except Exception as e:
        print(f"  Error deleting file {file_path}: {e}")
        return False


def delete_submission_record(client, submission_id):
    """Delete submission record from database"""
    try:
        client.table('lab_submissions')\
            .delete()\
            .eq('id', submission_id)\
            .execute()
        return True
    except Exception as e:
        print(f"  Error deleting record {submission_id}: {e}")
        return False


def cleanup_old_submissions(days=30, dry_run=False):
    """Main cleanup function"""
    print(f"Starting cleanup of submissions older than {days} days...")
    if dry_run:
        print("DRY RUN MODE - No files will be deleted")
    print()
    
    client = get_supabase_client()
    old_submissions = get_old_submissions(client, days)
    
    if not old_submissions:
        print("No old submissions found.")
        return
    
    print(f"Found {len(old_submissions)} old submissions to process")
    print()
    
    deleted_files = 0
    deleted_records = 0
    errors = 0
    
    for submission in old_submissions:
        submission_id = submission['id']
        file_url = submission['file_url']
        file_name = submission.get('file_name', 'unknown')
        submitted_at = submission['submitted_at']
        
        print(f"Processing: {file_name} (submitted: {submitted_at})")
        
        if dry_run:
            print(f"  [DRY RUN] Would delete file: {file_url}")
            print(f"  [DRY RUN] Would delete record: {submission_id}")
            deleted_files += 1
            deleted_records += 1
        else:
            # Delete file from storage
            if delete_file_from_storage(client, file_url):
                deleted_files += 1
                print(f"  ✓ Deleted file: {file_url}")
            else:
                errors += 1
                print(f"  ✗ Failed to delete file: {file_url}")
            
            # Delete record from database
            if delete_submission_record(client, submission_id):
                deleted_records += 1
                print(f"  ✓ Deleted record: {submission_id}")
            else:
                errors += 1
                print(f"  ✗ Failed to delete record: {submission_id}")
        
        print()
    
    print("=" * 60)
    print(f"Cleanup Summary:")
    print(f"  Files deleted: {deleted_files}")
    print(f"  Records deleted: {deleted_records}")
    print(f"  Errors: {errors}")
    if dry_run:
        print(f"  (DRY RUN - No actual deletions performed)")


def main():
    parser = argparse.ArgumentParser(
        description='Cleanup old lab submission files from Supabase Storage'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=30,
        help='Delete submissions older than this many days (default: 30)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without actually deleting'
    )
    
    args = parser.parse_args()
    
    try:
        cleanup_old_submissions(days=args.days, dry_run=args.dry_run)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

