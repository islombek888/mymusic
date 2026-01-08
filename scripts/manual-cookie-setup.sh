#!/bin/bash

# Manual Cookie Setup - Simple Version
# Agar avtomatik skript ishlamasa, qo'lda bajaring

echo "🍪 Manual Cookie Setup / Qo'lda Cookie O'rnatish"
echo "================================================"
echo ""

# Check if cookie files exist
if [ ! -f "youtube_cookies.txt" ] && [ ! -f "instagram_cookies.txt" ]; then
    echo "❌ Cookie fayllar topilmadi!"
    echo "❌ Cookie files not found!"
    echo ""
    echo "Iltimos, avval cookie'larni eksport qiling:"
    echo "Please export cookies first:"
    echo ""
    echo "1. Brauzerga 'Get cookies.txt LOCALLY' kengaytmasini o'rnating"
    echo "   Install 'Get cookies.txt LOCALLY' browser extension"
    echo ""
    echo "2. YouTube.com ga kiring va cookie'larni eksport qiling"
    echo "   Go to YouTube.com and export cookies as 'youtube_cookies.txt'"
    echo ""
    echo "3. Instagram.com ga kiring va cookie'larni eksport qiling"
    echo "   Go to Instagram.com and export cookies as 'instagram_cookies.txt'"
    echo ""
    exit 1
fi

# Process YouTube cookies
if [ -f "youtube_cookies.txt" ]; then
    echo "✅ YouTube cookie topildi / YouTube cookie found"
    
    # Convert to base64 (macOS compatible)
    YT_COOKIES_B64=$(cat youtube_cookies.txt | base64)
    
    echo ""
    echo "📋 YouTube Cookie (Base64):"
    echo "YT_COOKIES_B64=${YT_COOKIES_B64}"
    echo ""
    echo "Bu qatorni .env fayliga qo'shing / Add this line to .env file"
    echo ""
fi

# Process Instagram cookies
if [ -f "instagram_cookies.txt" ]; then
    echo "✅ Instagram cookie topildi / Instagram cookie found"
    
    # Convert to base64 (macOS compatible)
    IG_COOKIES_B64=$(cat instagram_cookies.txt | base64)
    
    echo ""
    echo "📋 Instagram Cookie (Base64):"
    echo "IG_COOKIES_B64=${IG_COOKIES_B64}"
    echo ""
    echo "Bu qatorni .env fayliga qo'shing / Add this line to .env file"
    echo ""
fi

echo "✅ Tayyor! / Done!"
echo ""
echo "Keyingi qadamlar / Next steps:"
echo "1. Yuqoridagi qatorlarni .env fayliga qo'shing / Add the lines above to .env"
echo "2. Cookie fayllarni o'chiring: rm *_cookies.txt"
echo "   Delete cookie files: rm *_cookies.txt"
echo "3. Botni ishga tushiring: npm run dev"
echo "   Start the bot: npm run dev"
