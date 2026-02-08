import { Downloader } from './src/utils/downloader.js';
import { Logger } from './src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    console.log('--- YT REDEPLOY TEST ---');
    console.log('YT_COOKIES_B64 present:', !!process.env.YT_COOKIES_B64);
    console.log('YT_COOKIES_PATH present:', !!process.env.YT_COOKIES_PATH);

    // Use a common music video link
    const testUrl = 'https://www.youtube.com/watch?v=kJQP7kiw5Fk'; // Despacito for testing

    console.log(`Testing getInfo for: ${testUrl}`);
    try {
        const info = await Downloader.getInfo(testUrl);
        console.log('✅ Success! Title:', info.title);
    } catch (error: any) {
        console.error('❌ Failed!');
        console.error('Error Message:', error.message);
    }
}

test();
