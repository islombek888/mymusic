import { Downloader } from '../utils/downloader.js';
import { Logger } from '../utils/logger.js';
import path from 'path';

export class YoutubeService {
    static async handleLink(url: string, audioOnly: boolean = true, onProgress?: (progress: string) => void) {
        try {
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
}
