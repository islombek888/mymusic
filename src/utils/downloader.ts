import { spawn } from 'child_process';
import { Logger } from './logger.js';
import path from 'path';
import fs from 'fs';

export interface DownloadOptions {
    audioOnly?: boolean;
    outputDir: string;
    onProgress?: (progress: string) => void;
    isInstagram?: boolean;
    skipCookies?: boolean;
}

export class Downloader {
    // Public methods for external access
    public static getYtDlpBin(): string {
        return process.env.YT_DLP_BIN || 'yt-dlp';
    }

    public static getYtDlpArgs(): string[] {
        // Use python3 -m yt-dlp if direct binary doesn't work
        const ytDlpBin = process.env.YT_DLP_BIN || 'yt-dlp';
        return ytDlpBin.includes('python')
            ? ytDlpBin.split(' ') // ['python3', '-m', 'yt-dlp']
            : ['yt-dlp'];
    }

    public static getYtDlpEnv(): any {
        const home = '/tmp';
        const cacheHome = '/tmp/.cache';
        const configHome = '/tmp/.config';

        try {
            if (!fs.existsSync(cacheHome)) fs.mkdirSync(cacheHome, { recursive: true });
        } catch {
            // ignore
        }

        try {
            if (!fs.existsSync(configHome)) fs.mkdirSync(configHome, { recursive: true });
        } catch {
            // ignore
        }

        return {
            ...process.env,
            HOME: home,
            XDG_CACHE_HOME: cacheHome,
            XDG_CONFIG_HOME: configHome,
            PYTHONUNBUFFERED: '1'
        };
    }

    private static getInstagramCookiesPath(): string | null {
        const explicitPath = process.env.IG_COOKIES_PATH;
        if (explicitPath && explicitPath.trim()) {
            return explicitPath.trim();
        }

        const b64 = process.env.IG_COOKIES_B64;
        if (!b64 || !b64.trim()) return null;

        try {
            const decoded = Buffer.from(b64, 'base64').toString('utf8');
            const targetPath = '/tmp/ig-cookies.txt';
            fs.writeFileSync(targetPath, decoded, { encoding: 'utf8' });
            return targetPath;
        } catch (e) {
            Logger.error('Failed to decode IG_COOKIES_B64', e);
            return null;
        }
    }

    private static getYouTubeCookiesPath(): string | null {
        const explicitPath = process.env.YT_COOKIES_PATH;
        if (explicitPath && explicitPath.trim()) {
            return explicitPath.trim();
        }

        const b64 = process.env.YT_COOKIES_B64;
        if (!b64 || !b64.trim()) return null;

        try {
            const decoded = Buffer.from(b64, 'base64').toString('utf8');
            const targetPath = '/tmp/yt-cookies.txt';
            fs.writeFileSync(targetPath, decoded, { encoding: 'utf8' });
            return targetPath;
        } catch (e) {
            Logger.error('Failed to decode YT_COOKIES_B64', e);
            return null;
        }
    }

    private static getUserFriendlyYtDlpError(errorOutput: string): string {
        const lower = (errorOutput || '').toLowerCase();

        if (!errorOutput) {
            return 'Yuklab olish servisida xatolik yuz berdi. Iltimos, birozdan so\'ng qayta urinib ko\'ring.';
        }

        if (errorOutput.includes('Traceback') || lower.includes('runpy.py') || lower.includes('modulenotfounderror')) {
            return 'Serverda yuklab olish servisida ichki xatolik yuz berdi. Iltimos, birozdan so\'ng qayta urinib ko\'ring.';
        }

        if (lower.includes('permission denied') || lower.includes('read-only file system') || lower.includes('readonly file system')) {
            return 'Serverda fayl yozishga ruxsat yo\'q. Deploy sozlamalarini tekshiring.';
        }

        if (lower.includes('truncated_id') || lower.includes('invalid url')) {
            return 'URL noto\'g\'ri yoki qisqarib ketgan. Iltimos, to\'liq linkni yuboring.';
        }

        if (lower.includes('private') || lower.includes('this video is private')) {
            return 'Bu video/post yopiq (private). Faqat ochiq kontentdan yuklab olish mumkin.';
        }

        if (lower.includes('not found') || lower.includes('404') || lower.includes('unavailable')) {
            return 'Video/post topilmadi yoki o\'chirilgan. Iltimos, boshqa havolani yuboring.';
        }

        if (
            lower.includes('sign in') ||
            lower.includes('login') ||
            lower.includes('authentication') ||
            lower.includes('cookies-from-browser') ||
            lower.includes('use --cookies') ||
            lower.includes('login required') ||
            lower.includes('confirm you\'re not a bot') ||
            lower.includes('confirm that you are not a bot')
        ) {
            // Detect if it's YouTube or Instagram
            if (lower.includes('youtube') || lower.includes('yt-dlp')) {
                Logger.error('YouTube auth required: set YT_COOKIES_B64 or YT_COOKIES_PATH on the server to enable downloads.');
                return 'YouTube videosida vaqtinchalik cheklov bor. Iltimos, birozdan keyin qayta urinib ko\'ring yoki boshqa video yuboring.';
            } else {
                Logger.error('Instagram auth/rate-limit: set IG_COOKIES_B64 or IG_COOKIES_PATH on the server to enable downloads.');
                return 'Instagram kontentini yuklab bo\'lmadi: login/cookies kerak yoki vaqtinchalik cheklov (rate-limit). Iltimos, birozdan keyin urinib ko\'ring yoki boshqa link yuboring.';
            }
        }

        if (lower.includes('age') && (lower.includes('restricted') || lower.includes('verification'))) {
            return 'Bu video yosh cheklovi bilan himoyalangan. Iltimos, boshqa video havolasini yuboring.';
        }

        if (lower.includes('video is not available') || lower.includes('this video is unavailable')) {
            return 'Video mavjud emas yoki sizning mintaqangizda bloklangan. Iltimos, boshqa video havolasini yuboring.';
        }

        if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
            return 'Juda ko\'p so\'rovlar bo\'ldi (429). Iltimos, birozdan so\'ng urinib ko\'ring.';
        }

        if (lower.includes('temporary failure in name resolution') || lower.includes('network is unreachable') || lower.includes('connection refused') || lower.includes('timed out')) {
            return 'Server internet ulanishida muammo. Iltimos, birozdan so\'ng qayta urinib ko\'ring.';
        }

        return 'Yuklab olishda xatolik yuz berdi. Iltimos, boshqa link bilan urinib ko\'ring.';
    }

    static async getInfo(url: string, isInstagram: boolean = false, retryWithoutCookies: boolean = false): Promise<any> {
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

        const args = [
            '--no-config',
            '--no-cache-dir',
            '--no-playlist',
            '--no-warnings',
            '--no-check-certificate',
            '--force-ipv4',
            '--socket-timeout', '15',
            '-j'
        ];

        if (isInstagram) {
            args.push('--extractor-args', 'instagram:skip_auth_warning=True,skip_api_login=True');
            args.push('--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
            args.push('--add-header', 'accept-language:en-US,en;q=0.9');
            args.push('--add-header', 'accept-encoding:gzip, deflate, br');
            args.push('--add-header', 'dnt:1');

            const cookiesPath = this.getInstagramCookiesPath();
            if (cookiesPath) {
                args.push('--cookies', cookiesPath);
            }
        } else if (isYouTube) {
            // YouTube - Try multiple strategies to avoid "Sign in" errors
            // If retryWithoutCookies is true, force skipping cookies
            const cookiesPath = !retryWithoutCookies ? this.getYouTubeCookiesPath() : null;

            if (cookiesPath) {
                args.push('--extractor-args', 'youtube:player_client=android,ios,web;player_skip=configs,webpage');
                args.push('--cookies', cookiesPath);
            } else {
                // Aggressive cookie-free strategy
                args.push('--extractor-args', 'youtube:player_client=android,ios;player_skip=webpage,js,configs');
                // Use mobile user agent to avoid bot detection
                args.push('--user-agent', 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
                // Add additional headers to look more like a real mobile client
                args.push('--add-header', 'accept-language:en-US,en;q=0.9');
                args.push('--add-header', 'accept-encoding:gzip, deflate, br');
                args.push('--add-header', 'dnt:1');
                args.push('--add-header', 'sec-fetch-dest:video');
                args.push('--add-header', 'sec-fetch-mode:navigate');
                args.push('--add-header', 'sec-fetch-site:same-origin');
                args.push('--add-header', 'sec-fetch-user:?1');
            }
        }

        args.push(url);

        const ytDlpBin = this.getYtDlpBin();
        const ytDlpBaseArgs = this.getYtDlpArgs();
        const env = this.getYtDlpEnv();

        try {
            const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
                const child = ytDlpBaseArgs.length > 1
                    ? spawn(ytDlpBaseArgs[0], [...ytDlpBaseArgs.slice(1), ...args], { env })
                    : spawn(ytDlpBin, args, { env });
                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve({ stdout, stderr });
                        return;
                    }

                    const err: any = new Error(`yt-dlp exited with code ${code}`);
                    err.code = code;
                    err.stdout = stdout;
                    err.stderr = stderr;
                    reject(err);
                });

                child.on('error', (err) => {
                    const spawnErr: any = new Error(`yt-dlp ishga tushirishda xatolik: ${err.message}`);
                    spawnErr.original = err;
                    reject(spawnErr);
                });
            });

            if (stderr && !stderr.includes('WARNING')) {
                Logger.debug(`yt-dlp stderr: ${stderr}`);
            }

            try {
                return JSON.parse(stdout);
            } catch (parseError) {
                Logger.error('Error parsing yt-dlp JSON output', parseError);
                throw new Error('Ma\'lumotlarni tahlil qilishda xatolik.');
            }
        } catch (error: any) {
            const errorOutput = (error?.stderr || error?.stdout || error?.message || '').toString();

            // RETRY MECHANISM: If YouTube auth failed and we haven't retried without cookies yet
            if (!retryWithoutCookies && !isInstagram && isYouTube &&
                (errorOutput.includes('Sign in') || errorOutput.includes('cookies') || errorOutput.includes('bot'))) {
                Logger.warn('YouTube auth failed with cookies, retrying without cookies...');
                return this.getInfo(url, isInstagram, true);
            }

            Logger.error(`Error getting info for ${url}`, error);
            Logger.debug(`yt-dlp getInfo raw error: ${errorOutput.substring(0, 1000)}`);
            throw new Error(this.getUserFriendlyYtDlpError(errorOutput));
        }
    }

    static async download(url: string, options: DownloadOptions): Promise<string> {
        const { audioOnly, outputDir, onProgress, isInstagram = false, skipCookies = false } = options;
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Determine format
        // Audio: best mp3
        // Video: best mp4 <= 480p for Telegram compatibility
        // For Instagram, use simpler format selection as it often has limited formats
        const format = audioOnly
            ? 'bestaudio/best'
            : isInstagram
                ? 'best[ext=mp4]/best[height<=720]/best' // Instagram videos are usually short, allow up to 720p
                : 'bestvideo[vcodec^=avc1][height<=480]+bestaudio[ext=m4a]/best[ext=mp4][height<=480]/best';

        const args = [
            '--no-config',
            '--no-cache-dir',
            '--no-playlist',
            '--no-check-certificate',
            '--no-warnings',
            '--force-ipv4',
            '--extractor-retries', isInstagram ? '2' : '3', // More retries for YouTube
            '--prefer-free-formats',
            // '--concurrent-fragments', '8', // REMOVED: Causing HTTP 416 errors
            '--file-access-retries', '3',
            '--socket-timeout', isInstagram ? '20' : '15',
            '--newline',
            '--print', 'after_move:filepath',
            '--no-part', // Don't use .part files (faster)
            '-f', format,
            '-o', path.join(outputDir, '%(title).200s.%(ext)s'),
        ];

        // Add Instagram-specific options
        if (isInstagram) {
            args.push('--extractor-args', 'instagram:skip_auth_warning=True,skip_api_login=True');
            args.push('--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
            args.push('--add-header', 'accept-language:en-US,en;q=0.9');
            args.push('--add-header', 'accept-encoding:gzip, deflate, br');
            args.push('--add-header', 'dnt:1');

            const cookiesPath = this.getInstagramCookiesPath();
            if (cookiesPath) {
                args.push('--cookies', cookiesPath);
            }
        } else if (isYouTube) {
            // YouTube - Try multiple strategies to avoid "Sign in" errors
            // If skipCookies is true, force skipping cookies
            const cookiesPath = !skipCookies ? this.getYouTubeCookiesPath() : null;

            if (cookiesPath) {
                args.push('--extractor-args', 'youtube:player_client=android,ios,web;player_skip=configs,webpage');
                args.push('--cookies', cookiesPath);
            } else {
                // Aggressive cookie-free strategy
                args.push('--extractor-args', 'youtube:player_client=android,ios;player_skip=webpage,js,configs');
                // Use mobile user agent to avoid bot detection
                args.push('--user-agent', 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
                // Add additional headers to look more like a real mobile client
                args.push('--add-header', 'accept-language:en-US,en;q=0.9');
                args.push('--add-header', 'accept-encoding:gzip, deflate, br');
                args.push('--add-header', 'dnt:1');
                args.push('--add-header', 'sec-fetch-dest:video');
                args.push('--add-header', 'sec-fetch-mode:navigate');
                args.push('--add-header', 'sec-fetch-site:same-origin');
                args.push('--add-header', 'sec-fetch-user:?1');
            }
        }

        args.push(url);

        if (audioOnly) {
            args.push('-x', '--audio-format', 'mp3');
        }

        return new Promise((resolve, reject) => {
            Logger.info(`Starting download: ${url}, skipCookies: ${skipCookies}`);
            const ytDlpBin = this.getYtDlpBin();
            const ytDlpBaseArgs = this.getYtDlpArgs();
            const env = Downloader.getYtDlpEnv();
            const child = ytDlpBaseArgs.length > 1
                ? spawn(ytDlpBaseArgs[0], [...ytDlpBaseArgs.slice(1), ...args], { env })
                : spawn(ytDlpBin, args, { env });
            let filePath = '';
            let lastProgress = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('/')) {
                        filePath = line.trim();
                    } else if (line.includes('%')) {
                        // Extract progress percentage
                        const match = line.match(/(\d+\.\d+)%/);
                        if (match && onProgress) {
                            const progress = match[0];
                            if (progress !== lastProgress) {
                                lastProgress = progress;
                                onProgress(progress);
                            }
                        }
                    }
                }
            });

            child.stderr.on('data', (data) => {
                const msg = data.toString();
                stderr += msg;
                if (!msg.includes('WARNING')) {
                    Logger.debug(`yt-dlp stderr: ${msg}`);
                }
            });

            child.on('close', (code) => {
                if (code === 0) {
                    // In some cases (like when file already exists), --print might not trigger exactly as expected
                    // but usually it works. If filePath is empty, we try to find the latest file in the directory.
                    if (filePath && fs.existsSync(filePath)) {
                        resolve(filePath);
                    } else {
                        // Fallback: find the newest file in outputDir
                        try {
                            const files = fs.readdirSync(outputDir);
                            if (files.length === 0) {
                                reject(new Error('Yuklab olingan fayl topilmadi. Post yopiq yoki o\'chirilgan bo\'lishi mumkin.'));
                                return;
                            }

                            const latestFile = files
                                .map(name => ({ name, time: fs.statSync(path.join(outputDir, name)).mtime.getTime() }))
                                .sort((a, b) => b.time - a.time)[0];

                            if (latestFile) {
                                resolve(path.join(outputDir, latestFile.name));
                            } else {
                                reject(new Error('Yuklab olingan fayl topilmadi.'));
                            }
                        } catch (err) {
                            Logger.error('Error finding downloaded file', err);
                            reject(new Error('Yuklab olingan fayl topilmadi.'));
                        }
                    }
                } else {
                    const raw = stderr.substring(0, 2000);

                    // RETRY MECHANISM for DOWNLOAD
                    // If we haven't skipped cookies yet, and it's a YouTube Sign in error
                    if (!skipCookies && isYouTube &&
                        (raw.includes('Sign in') || raw.includes('cookies') || raw.includes('bot'))) {
                        Logger.warn('YouTube download failed with cookies, attempting retry without cookies...');
                        // Recursive retry without cookies
                        const newOptions = { ...options, skipCookies: true };
                        Downloader.download(url, newOptions)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }

                    const fallback = code === 2
                        ? 'Yuklab olishda xatolik. Internet aloqasini tekshiring.'
                        : 'Yuklab olishda xatolik yuz berdi.';

                    const friendly = raw
                        ? Downloader.getUserFriendlyYtDlpError(raw)
                        : fallback;

                    Logger.error('yt-dlp download failed', { code, stderr: raw });
                    reject(new Error(friendly));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }
}
