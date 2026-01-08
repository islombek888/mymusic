import { Downloader } from '../utils/downloader.js';
import { Logger } from '../utils/logger.js';
import { YoutubeService } from './youtube.service.js';
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
            const pathname = urlObj.pathname.toLowerCase();
            return pathname.includes('/p/') || 
                   pathname.includes('/reel/') || 
                   pathname.includes('/tv/') ||
                   pathname.includes('/reels/');
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
                         `Instagram Video - ${new Date().toLocaleDateString()}`;
            
            const uploader = info.uploader || 
                           info.uploader_id || 
                           info.channel || 
                           'Instagram User';

            // Enhanced metadata extraction for better music search
            let track = info.track || null;
            let artist = info.artist || null;
            const description = info.description || info.fulltitle || '';
            
            // Try to extract from description if not in track/artist fields
            if (!track && description) {
                // Pattern 1: "🎵 Song Name - Artist"
                const pattern1 = description.match(/🎵\s*([^-]+?)\s*-\s*([^\n]+)/i);
                if (pattern1) {
                    track = pattern1[1].trim();
                    artist = pattern1[2].trim();
                } else {
                    // Pattern 2: "Music: Song Name by Artist"
                    const pattern2 = description.match(/Music[:\s]+([^by]+?)\s+by\s+([^\n]+)/i);
                    if (pattern2) {
                        track = pattern2[1].trim();
                        artist = pattern2[2].trim();
                    } else {
                        // Pattern 3: Just "🎵 Song Name"
                        const pattern3 = description.match(/🎵\s*([^\n]+)/i);
                        if (pattern3) {
                            const musicInfo = pattern3[1].trim();
                            // Try to split by " - " or " by "
                            const splitByDash = musicInfo.split(/\s*-\s*/);
                            if (splitByDash.length >= 2) {
                                track = splitByDash[0].trim();
                                artist = splitByDash.slice(1).join(' - ').trim();
                            } else {
                                track = musicInfo;
                            }
                        } else {
                            // Pattern 4: Extract hashtags that might contain song info
                            const hashtags = description.match(/#\w+/g) || [];
                            const musicHashtags = hashtags.filter((tag: string) => 
                                tag.toLowerCase().includes('music') || 
                                tag.toLowerCase().includes('song') ||
                                tag.toLowerCase().includes('audio')
                            );
                            
                            if (musicHashtags.length > 0 && description.length > 20) {
                                // Use first part of description as track if no specific music info found
                                track = description.split('\n')[0].substring(0, 50).trim();
                            }
                        }
                    }
                }
            }
            
            // If still no track, try to extract from title
            if (!track && title && title !== 'Instagram Video') {
                // Remove common prefixes and use as track
                track = title
                    .replace(/^reel\s+/i, '')
                    .replace(/^video\s+/i, '')
                    .replace(/by\s+[^\s]+$/i, '')
                    .trim();
            }
            
            // Clean up track and artist
            if (track) {
                track = track.replace(/[🎵🎶🎤🎧]/g, '').trim();
            }
            if (artist) {
                artist = artist.replace(/[🎵🎶🎤🎧]/g, '').trim();
            }

            // If we found track and artist, try to find full version on YouTube
            let fullVersionResult = null;
            if (track && artist) {
                try {
                    Logger.info(`🔍 Searching full version on YouTube: ${artist} - ${track}`);
                    fullVersionResult = await YoutubeService.findFullVersion(artist, track, onProgress);
                    Logger.info(`✅ Found full version on YouTube!`);
                } catch (error) {
                    Logger.info(`⚠️ Full version not found on YouTube, using Instagram version`);
                }
            }

            // Return Instagram version or YouTube full version
            const finalResult = fullVersionResult || {
                title: title.substring(0, 200),
                uploader: uploader.substring(0, 100),
                duration: info.duration || 0,
                filePath,
                url: normalizedUrl,
                metadata: {
                    track: track,
                    artist: artist,
                    description: description,
                    fulltitle: info.fulltitle || title
                }
            };

            Logger.info(`📊 Instagram metadata extracted: track="${track}", artist="${artist}", title="${title}"`);
            return finalResult;
        } catch (error: any) {
            Logger.error('Error in InstagramService.handleLink', error);
            
            // Re-throw with user-friendly message if it's already our custom error
            if (error.message && !error.message.includes('Error in InstagramService')) {
                throw error;
            }
            
            // Otherwise, provide a generic but helpful error
            throw new Error(`Instagram postini qayta ishlashda xatolik: ${error.message || "Noma'lum xatolik"}`);
        }
    }
}