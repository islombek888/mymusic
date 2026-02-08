// @ts-ignore
import youtubeSearch from 'youtube-search-api';
import { spawn } from 'child_process';
import { Downloader } from '../utils/downloader.js';
import { YoutubeService } from './youtube.service.js';
import { InstagramService } from './instagram.service.js';
import { Logger } from '../utils/logger.js';

export interface SearchResult {
    id: string;
    title: string;
    uploader: string;
    duration: string;
    url: string;
    source: 'youtube' | 'soundcloud' | 'audiomack' | 'bandcamp' | 'generic';
}

export class MusicService {
    /**
     * Search for music across multiple platforms with priority
     */
    static async search(query: string, limit: number = 20): Promise<SearchResult[]> {
        // Priority 1: YouTube
        try {
            const ytResults = await this.searchYouTube(query, Math.ceil(limit * 0.7));
            if (ytResults.length > 0) {
                // Also get some from SoundCloud for variety/fallback
                const scResults = await this.searchSoundCloud(query, Math.ceil(limit * 0.3));
                return [...ytResults, ...scResults];
            }
        } catch (e) {
            Logger.warn('YouTube search failed, falling back to SoundCloud', e);
        }

        // Priority 2: SoundCloud
        try {
            const scResults = await this.searchSoundCloud(query, limit);
            if (scResults.length > 0) return scResults;
        } catch (e) {
            Logger.warn('SoundCloud search failed', e);
        }

        // Priority 3: Audiomack (via yt-dlp)
        try {
            const amResults = await this.searchAudiomack(query, limit);
            if (amResults.length > 0) return amResults;
        } catch (e) {
            Logger.warn('Audiomack search failed', e);
        }

        throw new Error('Hech qanday servisdan musiqa topilmadi.');
    }

    private static async searchYouTube(query: string, limit: number): Promise<SearchResult[]> {
        const results = await youtubeSearch.GetListByKeyword(query, false, limit);
        if (!results.items) return [];
        return results.items
            .filter((item: any) => item.type === 'video')
            .map((item: any) => ({
                id: item.id,
                title: item.title,
                uploader: item.username || item.channelTitle || 'YouTube',
                duration: item.length?.simpleText || '0:00',
                url: `https://www.youtube.com/watch?v=${item.id}`,
                source: 'youtube'
            }));
    }

    private static async searchSoundCloud(query: string, limit: number): Promise<SearchResult[]> {
        return this.ytDlpSearch(`scsearch${limit}:` + query, 'soundcloud');
    }

    private static async searchAudiomack(query: string, limit: number): Promise<SearchResult[]> {
        return this.ytDlpSearch(`amsearch${limit}:` + query, 'audiomack');
    }

    /**
     * Generic search using yt-dlp extractors
     */
    private static async ytDlpSearch(searchQuery: string, source: any): Promise<SearchResult[]> {
        try {
            const args = [
                '--no-config',
                '--no-cache-dir',
                '--no-warnings',
                '--no-check-certificate',
                '--force-ipv4',
                '--flat-playlist',
                '--dump-single-json',
                searchQuery
            ];

            const ytDlpBin = Downloader.getYtDlpBin();
            const ytDlpBaseArgs = Downloader.getYtDlpArgs();
            const env = Downloader.getYtDlpEnv();

            const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
                const child = ytDlpBaseArgs.length > 1
                    ? spawn(ytDlpBaseArgs[0], [...ytDlpBaseArgs.slice(1), ...args], { env })
                    : spawn(ytDlpBin, args, { env });

                let stdout = '';
                child.stdout.on('data', (data) => stdout += data.toString());
                child.on('close', (code) => code === 0 ? resolve({ stdout }) : reject(new Error(`Exit ${code}`)));
                child.on('error', reject);
            });

            const data = JSON.parse(stdout);
            const entries = data.entries || [];

            return entries.map((item: any) => ({
                id: item.id,
                title: item.title || 'Unknown Title',
                uploader: item.uploader || item.artist || source,
                duration: this.formatDuration(item.duration),
                url: item.webpage_url || item.url,
                source: source
            }));
        } catch (error) {
            return [];
        }
    }

    private static formatDuration(seconds: number): string {
        if (!seconds) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    static async getTop10Instagram(): Promise<SearchResult[]> {
        return this.search('trending music 2024 instagram reels', 10);
    }

    static async processInput(input: string) {
        // Support more patterns
        const lower = input.toLowerCase();
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
            return await YoutubeService.handleLink(input, true);
        }
        if (lower.includes('instagram.com')) {
            return await InstagramService.handleLink(input);
        }
        if (lower.includes('soundcloud.com')) {
            return await YoutubeService.handleLink(input, true); // YoutubeService handles generic links via Downloader
        }

        const results = await this.search(input, 1);
        if (!results || results.length === 0) throw new Error('Hech narsa topilmadi');
        return await YoutubeService.handleLink(results[0].url, true);
    }
}
