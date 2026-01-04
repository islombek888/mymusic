#!/bin/bash
# Check if required dependencies are installed

echo "Checking dependencies..."

# Check for yt-dlp
if ! command -v yt-dlp &> /dev/null; then
    echo "WARNING: yt-dlp is not installed. Installing..."
    pip3 install yt-dlp || echo "ERROR: Failed to install yt-dlp"
fi

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "WARNING: ffmpeg is not installed"
    echo "Please install ffmpeg: apt-get install -y ffmpeg"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    exit 1
fi

echo "Dependencies check complete"


