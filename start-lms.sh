#!/bin/bash
# Simple script to start a local web server for the LMS

echo "🚀 Starting LMS Web Server..."
echo ""
echo "The LMS will be available at:"
echo "  http://localhost:8000/index.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8000
else
    echo "❌ Error: Python is not installed"
    echo "Please install Python 3 to run the local server"
    exit 1
fi

