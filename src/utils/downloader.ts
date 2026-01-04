import { spawn } from 'child_process';
import { Logger } from './logger.js';
import path from 'path';
import fs from 'fs';

export interface DownloadOptions {
    audioOnly?: boolean;
    outputDir: string;
    onProgress?: (progress: string) => void;
    isInstagram?: boolean;
}

export class Downloader {
    static async getInfo(url: string, isInstagram: boolean = false): Promise<any> {
        try {
            // Use spawn instead of exec for better security and reliability
            const args = [
                '--no-playlist', 
                '--no-warnings', 
                '--socket-timeout', '10', // Reduced timeout for speed
                '-j'
            ];
            
            if (isInstagram) {
                // Instagram-specific options for better compatibility
                args.push('--extractor-args', 'instagram:skip_auth_warning=True');
                args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            }
            
            args.push(url);
            
            // Use spawn and collect output
            return new Promise((resolve, reject) => {
                const child = spawn('yt-dlp', args);
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
                        if (stderr && !stderr.includes('WARNING')) {
                            Logger.debug(`yt-dlp stderr: ${stderr}`);
                        }
                        try {
                            resolve(JSON.parse(stdout));
                        } catch (parseError) {
                            Logger.error('Error parsing yt-dlp JSON output', parseError);
                            reject(new Error('Ma\'lumotlarni tahlil qilishda xatolik.'));
                        }
                    } else {
                        reject(new Error(`yt-dlp exited with code ${code}: ${stderr.substring(0, 200)}`));
                    }
                });
                
                child.on('error', (err) => {
                    Logger.error('Error spawning yt-dlp', err);
                    reject(new Error(`yt-dlp ishga tushirishda xatolik: ${err.message}`));
                });
            });
        } catch (error: any) {
            Logger.error(`Error getting info for ${url}`, error);
            
            const errorOutput = error.stderr || error.stdout || error.message || '';
            
            // Handle specific error cases
            if (errorOutput.includes('truncated_id') || errorOutput.includes('Invalid URL')) {
                throw new Error('URL noto\'g\'ri yoki qisqarib ketgan. Iltimos, to\'liq linkni yuboring.');
            }
            if (errorOutput.includes('Private') || errorOutput.includes('private')) {
                throw new Error('Bu post yopiq (private). Faqat ochiq postlardan yuklab olish mumkin.');
            }
            if (errorOutput.includes('not found') || errorOutput.includes('404') || errorOutput.includes('unavailable')) {
                throw new Error('Post topilmadi yoki o\'chirilgan. Iltimos, boshqa havolani yuboring.');
            }
            if (errorOutput.includes('login') || errorOutput.includes('authentication') || errorOutput.includes('Sign in')) {
                throw new Error('Instagram postiga kirish uchun autentifikatsiya kerak. Bu post yopiq bo\'lishi mumkin.');
            }
            if (errorOutput.includes('rate limit') || errorOutput.includes('429') || errorOutput.includes('Too Many Requests')) {
                throw new Error('Juda ko\'p so\'rovlar. Iltimos, birozdan so\'ng urinib ko\'ring.');
            }
            
            throw new Error(`Ma'lumot olishda xato yuz berdi: ${errorOutput.substring(0, 200)}`);
        }
    }

    static async download(url: string, options: DownloadOptions): Promise<string> {
        const { audioOnly, outputDir, onProgress, isInstagram = false } = options;
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
            '--no-playlist',
            '--no-check-certificate',
            '--no-warnings',
            '--extractor-retries', isInstagram ? '2' : '1', // Reduced retries for speed
            '--prefer-free-formats',
            '--concurrent-fragments', '8', // Increased for faster download
            '--file-access-retries', '2', // Reduced for speed
            '--socket-timeout', isInstagram ? '20' : '10', // Reduced timeout for speed
            '--newline',
            '--print', 'after_move:filepath',
            '--no-part', // Don't use .part files (faster)
            '-f', format,
            '-o', path.join(outputDir, '%(title).200s.%(ext)s'),
        ];

        // Add Instagram-specific options
        if (isInstagram) {
            args.push('--extractor-args', 'instagram:skip_auth_warning=True');
            args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }

        args.push(url);

        if (audioOnly) {
            args.push('-x', '--audio-format', 'mp3');
        }

        return new Promise((resolve, reject) => {
            Logger.info(`Starting download: ${url}`);
            const child = spawn('yt-dlp', args);
            let filePath = '';
            let lastProgress = '';

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
                    // Provide more helpful error messages based on exit code
                    let errorMsg = `Yuklab olishda xatolik (kod: ${code})`;
                    if (code === 1) {
                        errorMsg = 'Post topilmadi, yopiq yoki o\'chirilgan bo\'lishi mumkin.';
                    } else if (code === 2) {
                        errorMsg = 'Yuklab olishda xatolik. Internet aloqasini tekshiring.';
                    }
                    reject(new Error(errorMsg));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }
}
