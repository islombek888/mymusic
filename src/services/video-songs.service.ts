import ffmpeg from 'fluent-ffmpeg';
import { Logger } from '../utils/logger.js';
import { MusicService } from './music.service.js';
import { YoutubeService } from './youtube.service.js';
import path from 'path';
import fs from 'fs';

export interface DetectedSong {
    title: string;
    artist?: string;
    searchQuery: string;
    timestamp?: string;
}

export class VideoSongsService {
    /**
     * Extract songs from video by analyzing audio segments
     * This is a simplified approach - for production, audio fingerprinting would be better
     */
    static async extractSongsFromVideo(videoPath: string): Promise<DetectedSong[]> {
        const songs: DetectedSong[] = [];
        
        try {
            // Get video duration
            const duration = await this.getVideoDuration(videoPath);
            Logger.info(`Video duration: ${duration} seconds`);
            
            // Split video into segments (every 30 seconds) and analyze each
            const segmentDuration = 30; // 30 seconds per segment
            const segments = Math.ceil(duration / segmentDuration);
            
            Logger.info(`Analyzing ${segments} segments...`);
            
            // For now, we'll try to extract from video metadata
            // In a real implementation, you'd use audio fingerprinting here
            const metadata = await this.getVideoMetadata(videoPath);
            
            // Try to extract songs from metadata
            if (metadata.description) {
                const extractedSongs = this.extractSongsFromText(metadata.description);
                songs.push(...extractedSongs);
            }
            
            // If no songs found in metadata, try to analyze audio segments
            if (songs.length === 0 && duration > 60) {
                // For longer videos, try to find songs by analyzing segments
                // This is a simplified approach - in production, use audio fingerprinting
                Logger.info('No songs found in metadata, trying segment analysis...');
                
                // Extract audio first
                const audioPath = await this.extractAudioSegment(videoPath, 0, Math.min(60, duration));
                
                // For now, we'll return empty array and let user know
                // In production, you'd use audio fingerprinting here (like Shazam API)
                
                if (fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath);
                }
            }
            
            // Remove duplicates
            const uniqueSongs = this.removeDuplicates(songs);
            
            Logger.info(`Found ${uniqueSongs.length} unique songs`);
            return uniqueSongs;
            
        } catch (error) {
            Logger.error('Error extracting songs from video', error);
            return [];
        }
    }
    
    /**
     * Get video duration in seconds
     */
    private static async getVideoDuration(videoPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                const duration = metadata.format.duration || 0;
                resolve(Math.floor(duration));
            });
        });
    }
    
    /**
     * Get video metadata
     */
    private static async getVideoMetadata(videoPath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    title: metadata.format.tags?.title || '',
                    description: metadata.format.tags?.description || metadata.format.tags?.comment || '',
                    artist: metadata.format.tags?.artist || '',
                    album: metadata.format.tags?.album || ''
                });
            });
        });
    }
    
    /**
     * Extract songs from text (description, comments, etc.)
     */
    private static extractSongsFromText(text: string): DetectedSong[] {
        const songs: DetectedSong[] = [];
        
        // Patterns to find songs in text
        const patterns = [
            // Pattern 1: "🎵 Song Name - Artist"
            /🎵\s*([^-]+?)\s*-\s*([^\n]+)/gi,
            // Pattern 2: "Music: Song Name by Artist"
            /Music[:\s]+([^by]+?)\s+by\s+([^\n]+)/gi,
            // Pattern 3: "Song: Song Name"
            /Song[:\s]+([^\n]+)/gi,
            // Pattern 4: "Track: Song Name - Artist"
            /Track[:\s]+([^-]+?)\s*-\s*([^\n]+)/gi,
            // Pattern 5: Numbered list "1. Song Name - Artist"
            /\d+[\.\)]\s*([^-]+?)\s*-\s*([^\n]+)/gi
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const title = match[1]?.trim();
                const artist = match[2]?.trim();
                
                if (title && title.length > 2) {
                    songs.push({
                        title: title.replace(/[🎵🎶🎤🎧]/g, '').trim(),
                        artist: artist?.replace(/[🎵🎶🎤🎧]/g, '').trim(),
                        searchQuery: artist ? `${artist} ${title}` : title
                    });
                }
            }
        }
        
        return songs;
    }
    
    /**
     * Extract audio segment from video
     */
    private static async extractAudioSegment(videoPath: string, start: number, duration: number): Promise<string> {
        const outputDir = path.join(process.cwd(), 'downloads', 'temp');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, `segment_${start}_${Date.now()}.mp3`);
        
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .seekInput(start)
                .duration(duration)
                .toFormat('mp3')
                .on('end', () => resolve(outputPath))
                .on('error', reject)
                .save(outputPath);
        });
    }
    
    /**
     * Remove duplicate songs
     */
    private static removeDuplicates(songs: DetectedSong[]): DetectedSong[] {
        const seen = new Set<string>();
        return songs.filter(song => {
            const key = `${song.title.toLowerCase()}_${song.artist?.toLowerCase() || ''}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
    
    /**
     * Find and download full versions of detected songs
     */
    static async findAndDownloadFullSongs(songs: DetectedSong[], ctx: any, statusMsg: any): Promise<void> {
        const chatId = ctx.chat.id;
        let foundCount = 0;
        let notFoundCount = 0;
        
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            try {
                // Update status
                await ctx.telegram.editMessageText(
                    chatId, 
                    statusMsg.message_id, 
                    undefined,
                    `🔍 Qo'shiq ${i + 1}/${songs.length} qidirilmoqda...\n\n"${song.searchQuery}"`
                ).catch(() => {});
                
                // Search for the song
                const searchResults = await MusicService.search(song.searchQuery, 3);
                
                if (searchResults.length > 0) {
                    // Try to download the first result
                    let downloaded = false;
                    for (const result of searchResults) {
                        try {
                            const fullAudioResult = await YoutubeService.handleLink(result.url, true);
                            
                            await ctx.replyWithAudio({ source: fullAudioResult.filePath }, {
                                title: `🎵 ${result.title}`,
                                performer: result.uploader,
                                caption: `🎵 ${i + 1}/${songs.length} - ${song.title}${song.artist ? ` - ${song.artist}` : ''}`
                            });
                            
                            if (fs.existsSync(fullAudioResult.filePath)) {
                                fs.unlinkSync(fullAudioResult.filePath);
                            }
                            
                            foundCount++;
                            downloaded = true;
                            break;
                        } catch (err) {
                            Logger.warn(`Failed to download ${song.searchQuery}, trying next result...`);
                            continue;
                        }
                    }
                    
                    if (!downloaded) {
                        notFoundCount++;
                        await ctx.reply(`😔 "${song.searchQuery}" topilmadi yoki yuklab bo'lmadi.`).catch(() => {});
                    }
                } else {
                    notFoundCount++;
                    await ctx.reply(`😔 "${song.searchQuery}" topilmadi.`).catch(() => {});
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                Logger.error(`Error processing song: ${song.searchQuery}`, error);
                notFoundCount++;
            }
        }
        
        // Final status
        await ctx.telegram.editMessageText(
            chatId,
            statusMsg.message_id,
            undefined,
            `✅ Tugadi!\n\nTopildi: ${foundCount}\nTopilmadi: ${notFoundCount}`
        ).catch(() => {});
    }
}

