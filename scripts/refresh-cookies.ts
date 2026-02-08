import { spawn } from 'child_process';
import { Logger } from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

/**
 * YouTube OAuth is currently disabled by Google.
 * The best alternative for Mac users is extracting cookies from the local browser.
 */
async function refreshCookies() {
    console.log('\n--- YouTube & Instagram Cookies Refresh ---');
    console.log('YouTube OAuth ishlamayapti (Google taqiqlagan).');
    console.log('Eng oson yo\'li - Mac\'ingizdagi Safari yoki Chrome brauzeridan cookies olish.\n');

    const ytDlpBin = process.env.YT_DLP_BIN || 'yt-dlp';
    const targetFile = '/tmp/temp_cookies.txt';

    console.log('🔄 Safari brauzeridan cookies olinmoqda...');

    // Command to extract cookies from Safari
    const args = ['--cookies-from-browser', 'safari', '--cookies', targetFile, '--no-download', 'https://www.youtube.com/watch?v=7wyJ_9pX61U'];

    const child = spawn(ytDlpBin, args);

    child.on('close', (code) => {
        if (code === 0 && fs.existsSync(targetFile)) {
            const cookies = fs.readFileSync(targetFile, 'utf8');
            const b64 = Buffer.from(cookies).toString('base64');

            // Update .env
            if (fs.existsSync(envPath)) {
                let currentEnv = fs.readFileSync(envPath, 'utf8');
                if (currentEnv.includes('YT_COOKIES_B64=')) {
                    currentEnv = currentEnv.replace(/YT_COOKIES_B64=.*/, `YT_COOKIES_B64=${b64}`);
                } else {
                    currentEnv += `\nYT_COOKIES_B64=${b64}`;
                }
                fs.writeFileSync(envPath, currentEnv);
                console.log('✅ YT_COOKIES_B64 o\'zgartirildi!');
                console.log('✅ Botni "npm run start" qilib qayta ishga tushiring.');
            }
        } else {
            console.log('\n❌ Safari-dan olib bo\'lmadi. Iltimos, Chrome bilan urinib ko\'ring:');
            console.log('npx tsx scripts/refresh-cookies.ts chrome');
        }
    });
}

refreshCookies().catch(err => {
    Logger.error('Cookie refresh error:', err);
});
