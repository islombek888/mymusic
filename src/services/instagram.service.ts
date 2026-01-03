import { Downloader } from '../utils/downloader.js';
import { Logger } from '../utils/logger.js';
import path from 'path';

export class InstagramService {
    static async handleLink(url: string, onProgress?: (progress: string) => void) {
        try {
            const info = await Downloader.getInfo(url);
            const outputDir = path.join(process.cwd(), 'downloads', 'instagram');

            const filePath = await Downloader.download(url, {
                audioOnly: false,
                outputDir,
                onProgress
            });

            return {
                title: info.title || 'Instagram Video',
                uploader: info.uploader || 'Instagram User',
                duration: info.duration || 0,
                filePath,
                url
            };
        } catch (error) {
            Logger.error('Error in InstagramService.handleLink', error);
            throw error;
        }
    }
}
