#!/bin/bash

# Start LMS Development Server
# This script starts a local HTTP server for the DV Learning Hub

PORT=8000
HOST=localhost

echo "🚀 Starting DV Learning Hub..."
echo ""

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port $PORT is already in use."
    echo "   Please stop the existing server or use a different port."
    exit 1
fi

# Try Python 3 http.server
if command -v python3 &> /dev/null; then
    echo "✅ Using Python 3 HTTP server"
    echo "📡 Server starting at http://$HOST:$PORT"
    echo "   Press Ctrl+C to stop the server"
    echo ""
    python3 -m http.server $PORT
    exit 0
fi

# Try Python 2 http.server
if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1 | grep -oP '\d+' | head -1)
    if [ "$PYTHON_VERSION" = "2" ]; then
        echo "✅ Using Python 2 HTTP server"
        echo "📡 Server starting at http://$HOST:$PORT"
        echo "   Press Ctrl+C to stop the server"
        echo ""
        python -m SimpleHTTPServer $PORT
        exit 0
    fi
fi

# Try Node.js http-server
if command -v npx &> /dev/null; then
    echo "✅ Using Node.js http-server"
    echo "📡 Server starting at http://$HOST:$PORT"
    echo "   Press Ctrl+C to stop the server"
    echo ""
    npx --yes http-server -p $PORT -c-1
    exit 0
fi

# Try PHP built-in server
if command -v php &> /dev/null; then
    echo "✅ Using PHP built-in server"
    echo "📡 Server starting at http://$HOST:$PORT"
    echo "   Press Ctrl+C to stop the server"
    echo ""
    php -S $HOST:$PORT
    exit 0
fi

# No server found
echo "❌ No suitable HTTP server found."
echo ""
echo "Please install one of the following:"
echo "  - Python 3 (recommended): python3 -m http.server"
echo "  - Node.js: npx http-server"
echo "  - PHP: php -S localhost:8000"
echo ""
exit 1

