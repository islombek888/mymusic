import { YoutubeService } from './youtube.service.js';
import { InstagramService } from './instagram.service.js';
import { Logger } from '../utils/logger.js';
// @ts-ignore
import youtubeSearch from 'youtube-search-api';

export interface SearchResult {
    id: string;
    title: string;
    uploader: string;
    duration: string;
    url: string;
}

export class MusicService {
    static async search(query: string, limit: number = 20): Promise<SearchResult[]> {
        try {
            const results = await youtubeSearch.GetListByKeyword(query, false, limit);
            if (!results.items || results.items.length === 0) {
                throw new Error('Hech narsa topilmadi');
            }

            return results.items
                .filter((item: any) => item.type === 'video') // Filter out channels/playlists for speed
                .map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    uploader: item.username || item.channelTitle || 'Unknown',
                    duration: item.length?.simpleText || '0:00',
                    url: `https://www.youtube.com/watch?v=${item.id}`
                }));
        } catch (error) {
            Logger.error(`Error searching for ${query}`, error);
            throw error;
        }
    }

    static async getTop10Instagram(): Promise<SearchResult[]> {
        // Curated top 10 songs popular on Instagram currently
        return this.search('trending instagram music 2024', 10);
    }

    static async processInput(input: string) {
        if (input.includes('youtube.com') || input.includes('youtu.be')) {
            return await YoutubeService.handleLink(input, true);
        }
        if (input.includes('instagram.com')) {
            return await InstagramService.handleLink(input);
        }
        // For general text, we default to the first search result in existing handlers,
        // but new handlers will use search() directly.
        const results = await this.search(input, 1);
        return await YoutubeService.handleLink(results[0].url, true);
    }
}
