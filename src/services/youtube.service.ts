import { Downloader } from '../utils/downloader.js';
import { Logger } from '../utils/logger.js';
import path from 'path';
import { spawn } from 'child_process';

export class YoutubeService {
    // Multiple sources for finding full versions
    private static readonly SEARCH_SOURCES = [
        // YouTube search patterns
        (artist: string, track: string) => `${artist} ${track} official video`,
        (artist: string, track: string) => `${artist} ${track} full version`,
        (artist: string, track: string) => `${artist} ${track} complete`,
        (artist: string, track: string) => `${artist} ${track} extended`,
        (artist: string, track: string) => `${artist} ${track} album version`,
        (artist: string, track: string) => `${artist} ${track} studio version`,
        (artist: string, track: string) => `${artist} ${track} hd`,
        (artist: string, track: string) => `${artist} ${track} lyrics`,
        (artist: string, track: string) => `${artist} ${track} original`,
        (artist: string, track: string) => `${artist} "${track}" official`
    ];

    // Fast search with multiple sources
    private static async searchFullVersion(artist: string, track: string): Promise<string | null> {
        const searchPromises = this.SEARCH_SOURCES.map(async (searchPattern, index) => {
            try {
                const query = searchPattern(artist, track);
                Logger.info(`Searching source ${index + 1}/10: ${query}`);
                
                // Fast search with minimal info
                const result = await this.searchYouTube(query, true);
                return result;
            } catch (error) {
                return null;
            }
        });

        // Run all searches in parallel
        const results = await Promise.allSettled(searchPromises);
        
        // Return first successful result
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                return result.value;
            }
        }
        
        return null;
    }

    // Fast YouTube search
    private static async searchYouTube(query: string, fast: boolean = false): Promise<string | null> {
        try {
            const args = fast ? [
                '--no-config',
                '--no-cache-dir',
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                '--force-ipv4',
                '--socket-timeout', '5',
                '--max-downloads', '1',
                '--extractor-args', 'youtube:skip=dash',
                '-j',
                'ytsearch1:' + query
            ] : [
                '--no-config',
                '--no-cache-dir',
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                '--force-ipv4',
                '--socket-timeout', '10',
                '-j',
                'ytsearch1:' + query
            ];

            const ytDlpBin = Downloader.getYtDlpBin();
            const ytDlpBaseArgs = Downloader.getYtDlpArgs();
            const env = Downloader.getYtDlpEnv();

            const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
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
                    } else {
                        reject(new Error(stderr));
                    }
                });

                child.on('error', reject);
            });

            const info = JSON.parse(stdout);
            return info.webpage_url || info.url || null;
        } catch (error) {
            return null;
        }
    }

    static async handleLink(url: string, audioOnly: boolean = true, onProgress?: (progress: string) => void) {
        try {
            // First try direct URL
            const info = await Downloader.getInfo(url);
            const outputDir = path.join(process.cwd(), 'downloads', 'youtube');

            const filePath = await Downloader.download(url, {
                audioOnly,
                outputDir,
                onProgress
            });

            return {
                id: info.id,
                title: info.title,
                uploader: info.uploader,
                duration: info.duration,
                filePath,
                url
            };
        } catch (error) {
            Logger.error('Error in YoutubeService.handleLink', error);
            throw error;
        }
    }

    static async extractMultipleSongs(url: string) {
        return await this.handleLink(url, true);
    }

    // New method: Find full version of a song
    static async findFullVersion(artist: string, track: string, onProgress?: (progress: string) => void) {
        try {
            Logger.info(`🔍 Searching full version: ${artist} - ${track}`);
            
            // Search in all 10 sources in parallel
            const videoUrl = await this.searchFullVersion(artist, track);
            
            if (!videoUrl) {
                throw new Error(`Full version not found: ${artist} - ${track}`);
            }

            Logger.info(`✅ Found full version: ${videoUrl}`);
            
            // Download the found version
            return await this.handleLink(videoUrl, true, onProgress);
        } catch (error) {
            Logger.error('Error finding full version', error);
            throw error;
        }
    }
}
