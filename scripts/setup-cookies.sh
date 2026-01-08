#!/bin/bash

# Cookie Setup Script for YouTube and Instagram
# This script helps you set up cookies for yt-dlp to access YouTube and Instagram

echo "🍪 Cookie Setup Script"
echo "====================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

echo "📋 Instructions:"
echo ""
echo "1. Install browser extension 'Get cookies.txt LOCALLY'"
echo "   Chrome: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
echo "   Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/"
echo ""
echo "2. Go to YouTube (youtube.com) and make sure you're logged in"
echo "3. Click the extension icon and export cookies"
echo "4. Save the file as 'youtube_cookies.txt' in this directory"
echo ""
echo "5. Go to Instagram (instagram.com) and make sure you're logged in"
echo "6. Click the extension icon and export cookies"
echo "7. Save the file as 'instagram_cookies.txt' in this directory"
echo ""
echo -e "${YELLOW}Press Enter when you have both cookie files ready...${NC}"
read

# Process YouTube cookies
if [ -f "youtube_cookies.txt" ]; then
    echo -e "${GREEN}✅ Found youtube_cookies.txt${NC}"
    
    # Convert to base64
    YT_COOKIES_B64=$(cat youtube_cookies.txt | base64)
    
    # Update .env file
    if grep -q "^YT_COOKIES_B64=" .env; then
        # Update existing line
        sed -i '' "s|^YT_COOKIES_B64=.*|YT_COOKIES_B64=${YT_COOKIES_B64}|" .env
    else
        # Add new line
        echo "YT_COOKIES_B64=${YT_COOKIES_B64}" >> .env
    fi
    
    echo -e "${GREEN}✅ YouTube cookies added to .env${NC}"
else
    echo -e "${RED}❌ youtube_cookies.txt not found!${NC}"
    echo "Please export YouTube cookies and save as 'youtube_cookies.txt'"
fi

# Process Instagram cookies
if [ -f "instagram_cookies.txt" ]; then
    echo -e "${GREEN}✅ Found instagram_cookies.txt${NC}"
    
    # Convert to base64
    IG_COOKIES_B64=$(cat instagram_cookies.txt | base64)
    
    # Update .env file
    if grep -q "^IG_COOKIES_B64=" .env; then
        # Update existing line
        sed -i '' "s|^IG_COOKIES_B64=.*|IG_COOKIES_B64=${IG_COOKIES_B64}|" .env
    else
        # Add new line
        echo "IG_COOKIES_B64=${IG_COOKIES_B64}" >> .env
    fi
    
    echo -e "${GREEN}✅ Instagram cookies added to .env${NC}"
else
    echo -e "${RED}❌ instagram_cookies.txt not found!${NC}"
    echo "Please export Instagram cookies and save as 'instagram_cookies.txt'"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Delete the cookie files for security: rm youtube_cookies.txt instagram_cookies.txt"
echo "2. Test your bot locally: npm run dev"
echo "3. For Render deployment, add these environment variables in Render dashboard:"
echo "   - Copy YT_COOKIES_B64 value from .env"
echo "   - Copy IG_COOKIES_B64 value from .env"
echo ""
