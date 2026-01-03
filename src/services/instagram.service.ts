import { Downloader } from '../utils/downloader.js';
import { Logger } from '../utils/logger.js';
import path from 'path';

export class InstagramService {
    /**
     * Normalizes Instagram URLs to ensure they work with yt-dlp
     * Handles various formats: instagram.com/p/, instagram.com/reel/, instagram.com/tv/, etc.
     */
    static normalizeUrl(url: string): string {
        try {
            // Remove query parameters and fragments that might cause issues
            const urlObj = new URL(url);
            urlObj.search = '';
            urlObj.hash = '';
            
            // Ensure we have www. prefix for better compatibility
            if (!urlObj.hostname.startsWith('www.')) {
                urlObj.hostname = 'www.' + urlObj.hostname;
            }
            
            // Normalize /reels/ to /reel/ (Instagram uses both)
            let normalizedPath = urlObj.pathname.replace(/\/reels\//, '/reel/');
            urlObj.pathname = normalizedPath;
            
            return urlObj.toString();
        } catch (error) {
            Logger.error('Error normalizing Instagram URL', error);
            return url; // Return original if normalization fails
        }
    }

    /**
     * Validates if the URL is a valid Instagram URL
     */
    static isValidInstagramUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Check if it's an Instagram domain
            if (!hostname.includes('instagram.com')) {
                return false;
            }
            
            // Check if it's a valid Instagram post/reel/tv path
            const path = urlObj.pathname.toLowerCase();
            return path.includes('/p/') || 
                   path.includes('/reel/') || 
                   path.includes('/tv/') ||
                   path.includes('/reels/');
        } catch {
            return false;
        }
    }

    static async handleLink(url: string, onProgress?: (progress: string) => void) {
        try {
            // Validate URL first
            if (!this.isValidInstagramUrl(url)) {
                throw new Error('Noto\'g\'ri Instagram havolasi. Iltimos, to\'g\'ri Instagram post, reel yoki video havolasini yuboring.');
            }

            // Normalize the URL
            const normalizedUrl = this.normalizeUrl(url);
            Logger.info(`Processing Instagram URL: ${normalizedUrl}`);

            // Get video info with better error handling
            let info;
            try {
                info = await Downloader.getInfo(normalizedUrl, true); // Pass isInstagram flag
            } catch (error: any) {
                const errorMsg = error.message || error.toString() || '';
                
                // Handle specific Instagram errors
                if (errorMsg.includes('Private') || errorMsg.includes('private')) {
                    throw new Error('Bu post yopiq (private). Faqat ochiq postlardan yuklab olish mumkin.');
                }
                if (errorMsg.includes('not found') || errorMsg.includes('404') || errorMsg.includes('unavailable')) {
                    throw new Error('Post topilmadi yoki o\'chirilgan. Iltimos, boshqa havolani yuboring.');
                }
                if (errorMsg.includes('login') || errorMsg.includes('authentication')) {
                    throw new Error('Instagram postiga kirish uchun autentifikatsiya kerak. Bu post yopiq bo\'lishi mumkin.');
                }
                if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
                    throw new Error('Juda ko\'p so\'rovlar. Iltimos, birozdan so\'ng urinib ko\'ring.');
                }
                
                Logger.error('Error getting Instagram info', error);
                throw new Error(`Instagram postini tahlil qilishda xatolik: ${errorMsg}`);
            }

            // Validate that we got valid info
            if (!info || !info.id) {
                throw new Error('Instagram postidan ma\'lumot olish imkonsiz. Post yopiq yoki o\'chirilgan bo\'lishi mumkin.');
            }

            const outputDir = path.join(process.cwd(), 'downloads', 'instagram');

            // Download with Instagram-specific options
            let filePath;
            try {
                filePath = await Downloader.download(normalizedUrl, {
                    audioOnly: false,
                    outputDir,
                    onProgress,
                    isInstagram: true // Pass flag for Instagram-specific handling
                });
            } catch (error: any) {
                const errorMsg = error.message || error.toString() || '';
                
                if (errorMsg.includes('Private') || errorMsg.includes('private')) {
                    throw new Error('Bu post yopiq (private). Faqat ochiq postlardan yuklab olish mumkin.');
                }
                if (errorMsg.includes('not found') || errorMsg.includes('404')) {
                    throw new Error('Post topilmadi yoki o\'chirilgan.');
                }
                
                Logger.error('Error downloading Instagram video', error);
                throw new Error(`Yuklab olishda xatolik: ${errorMsg}`);
            }

            // Extract metadata with fallbacks
            const title = info.title || 
                         info.fulltitle || 
                         info.description?.split('\n')[0] || 
                         'Instagram Video';
            
            const uploader = info.uploader || 
                           info.uploader_id || 
                           info.channel || 
                           'Instagram User';

            return {
                title: title.substring(0, 200), // Limit title length
                uploader: uploader.substring(0, 100),
                duration: info.duration || 0,
                filePath,
                url: normalizedUrl,
                // Store additional metadata for music search
                metadata: {
                    track: info.track || info.description?.match(/🎵\s*(.+)/)?.[1] || null,
                    artist: info.artist || null,
                    description: info.description || '',
                    fulltitle: info.fulltitle || title
                }
            };
        } catch (error: any) {
            Logger.error('Error in InstagramService.handleLink', error);
            
            // Re-throw with user-friendly message if it's already our custom error
            if (error.message && !error.message.includes('Error in InstagramService')) {
                throw error;
            }
            
            // Otherwise, provide a generic but helpful error
            throw new Error(`Instagram postini qayta ishlashda xatolik: ${error.message || 'Noma'lum xatolik'}`);
        }
    }
}
