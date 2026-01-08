# YouTube Cookies Setup Instructions

## YouTube Cookies Configuration

YouTube sometimes requires authentication to download videos. To fix this, you need to provide YouTube cookies.

### Method 1: Base64 Encoded Cookies (Recommended)

1. Export YouTube cookies from your browser:
   - Chrome: Go to youtube.com, press F12, Application > Storage > Cookies > https://www.youtube.com
   - Export all cookies as Netscape format

2. Convert to base64:
   ```bash
   base64 -w 0 cookies.txt
   ```

3. Set environment variable:
   ```
   YT_COOKIES_B64=<base64_encoded_cookies>
   ```

### Method 2: File Path

1. Upload cookies.txt file to your server
2. Set environment variable:
   ```
   YT_COOKIES_PATH=/path/to/cookies.txt
   ```

### For Render Deployment

Add the base64 encoded cookies as an environment variable in your Render dashboard:
- Key: `YT_COOKIES_B64`
- Value: <base64_encoded_cookies>

### Testing

After setting up cookies, restart your bot and try downloading the YouTube video again.

## Note

- Cookies expire periodically and may need to be refreshed
- Using cookies from a logged-in account provides better access
- Android user agent is used by default for better compatibility
