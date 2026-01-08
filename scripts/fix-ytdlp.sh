#!/bin/bash

# Fix yt-dlp configuration
echo "🔧 Fixing yt-dlp configuration..."

# Update .env file to use direct yt-dlp binary instead of python module
if [ -f ".env" ]; then
    # Check if YT_DLP_BIN exists in .env
    if grep -q "^YT_DLP_BIN=" .env; then
        # Update existing line
        sed -i '' 's|^YT_DLP_BIN=.*|YT_DLP_BIN=yt-dlp|' .env
        echo "✅ Updated YT_DLP_BIN in .env to use direct binary"
    else
        # Add new line
        echo "YT_DLP_BIN=yt-dlp" >> .env
        echo "✅ Added YT_DLP_BIN to .env"
    fi
else
    echo "❌ .env file not found!"
    exit 1
fi

echo ""
echo "✅ Fix complete! Restart your bot with: npm run dev"
