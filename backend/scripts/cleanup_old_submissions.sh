#!/bin/bash
# Daily cleanup script for old lab submissions
# This script should be added to cron for daily execution

# Set working directory
cd "$(dirname "$0")/.."

# Load environment variables (adjust path as needed)
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run cleanup script
python3 backend/scripts/cleanup_old_submissions.py --days 30

# Log execution
echo "$(date): Cleanup script executed" >> /var/log/lab-submission-cleanup.log

