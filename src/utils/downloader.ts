import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Logger } from './logger.js';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export interface DownloadOptions {
    audioOnly?: boolean;
    outputDir: string;
    onProgress?: (progress: string) => void;
}

export class Downloader {
    static async getInfo(url: string): Promise<any> {
        try {
            // Use --no-playlist to ensure we only get info for the single video
            // Add --no-warnings for cleaner output and faster processing
            const { stdout } = await execPromise(`yt-dlp --no-playlist --no-warnings -j "${url}"`);
            return JSON.parse(stdout);
        } catch (error: any) {
            Logger.error(`Error getting info for ${url}`, error);
            if (error.stderr?.includes('truncated_id')) {
                throw new Error('URL noto\'g\'ri yoki qisqarib ketgan. Iltimos, to\'liq linkni yuboring.');
            }
            throw new Error('Ma\'lumot olishda xato yuz berdi. Linkni tekshirib ko\'ring.');
        }
    }

    static async download(url: string, options: DownloadOptions): Promise<string> {
        const { audioOnly, outputDir, onProgress } = options;
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Determine format
        // Audio: best mp3
        // Video: best mp4 <= 480p for Telegram compatibility
        const format = audioOnly
            ? 'bestaudio/best'
            : 'bestvideo[vcodec^=avc1][height<=480]+bestaudio[ext=m4a]/best[ext=mp4][height<=480]/best';

        const args = [
            '--no-playlist',
            '--no-check-certificate',
            '--no-warnings',
            '--extractor-retries', '1',
            '--prefer-free-formats',
            '--concurrent-fragments', '5',
            '--file-access-retries', '3',
            '--socket-timeout', '15',
            '--newline',
            '--print', 'after_move:filepath',
            '-f', format,
            '-o', path.join(outputDir, '%(title).200s.%(ext)s'),
            url
        ];

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
                        const files = fs.readdirSync(outputDir);
                        const latestFile = files
                            .map(name => ({ name, time: fs.statSync(path.join(outputDir, name)).mtime.getTime() }))
                            .sort((a, b) => b.time - a.time)[0];

                        if (latestFile) {
                            resolve(path.join(outputDir, latestFile.name));
                        } else {
                            reject(new Error('Yuklab olingan fayl topilmadi.'));
                        }
                    }
                } else {
                    reject(new Error(`yt-dlp exited with code ${code}`));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }
}
