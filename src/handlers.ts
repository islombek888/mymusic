import { Context, Markup } from 'telegraf';
import { Logger } from './utils/logger.js';
import { MusicService, SearchResult } from './services/music.service.js';
import { YoutubeService } from './services/youtube.service.js';
import { InstagramService } from './services/instagram.service.js';
import { AudioService } from './services/audio.service.js';
import { VideoSongsService } from './services/video-songs.service.js';
import { Downloader } from './utils/downloader.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const session: { [chatId: number]: { results: SearchResult[], page: number, query: string, tempVideoPath?: string, fileLink?: string } } = {};

/**
 * Creates a simple progress bar string
 */
const getProgressBar = (progress: string) => {
    const percent = parseFloat(progress);
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '🟩'.repeat(filled) + '⬜'.repeat(empty) + ` ${progress}`;
};

/**
 * Parse duration string (e.g., "3:45" or "1:23:45") to seconds
 */
const parseDuration = (durationStr: string): number => {
    if (!durationStr || durationStr === '0:00') return 0;
    
    try {
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 2) {
            // MM:SS format
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            // HH:MM:SS format
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    } catch (e) {
        Logger.warn(`Failed to parse duration: ${durationStr}`);
    }
    return 0;
};

/**
 * Unified helper to deliver both Video (if available) and Audio
 */
const handleMediaDelivery = async (url: string, ctx: any, statusMsg: any) => {
    const chatId = ctx.chat.id;
    let lastUpdate = Date.now();
    const isInstagram = url.includes('instagram.com');

    // Validate Instagram URL if it's an Instagram link
    if (isInstagram && !InstagramService.isValidInstagramUrl(url)) {
        await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, '❌ Noto\'g\'ri Instagram havolasi. Iltimos, to\'g\'ri Instagram post, reel yoki video havolasini yuboring.').catch(() => { });
        return;
    }

    const onProgress = async (progress: string) => {
        // Throttling updates to once per 3 seconds to reduce overhead (was 2 seconds)
        if (Date.now() - lastUpdate > 3000) {
            const bar = getProgressBar(progress);
            ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `⏳ Yuklanmoqda: ${bar}`).catch(() => { });
            lastUpdate = Date.now();
        }
    };

    try {
        // Normalize Instagram URL if needed
        const normalizedUrl = isInstagram ? InstagramService.normalizeUrl(url) : url;
        
        // Check info first to see file size
        const info = await Downloader.getInfo(normalizedUrl, isInstagram);
        const duration = info.duration || 0;

        // Estimation of size if not provided (yt-dlp info might have it or not)
        // If it's a very long video, we should warn or handle
        if (duration > 3600 * 2) { // 2 hours
            await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `⚠️ Video juda uzun (${Math.round(duration / 60)} min). Uni qayta ishlash imkonsiz bo'lishi mumkin.`);
        }

        let result: any;
        if (isInstagram) {
            result = await InstagramService.handleLink(normalizedUrl, onProgress);
        } else {
            result = await YoutubeService.handleLink(normalizedUrl, false, onProgress);
        }

        const stats = fs.statSync(result.filePath);
        const sizeMB = stats.size / (1024 * 1024);

        if (sizeMB > 500) {
            await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `⚠️ Fayl juda katta (${sizeMB.toFixed(1)}MB). Telegram 500MB dan katta fayllarni qabul qilmaydi.\n\nSiz uni mana bu yerda ko'rishingiz mumkin: ${url}`);
            if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
            return;
        }

        // Determine if this is a short video or full song
        // Short videos: < 2 minutes (120 seconds) - typically Instagram Reels, YouTube Shorts
        // Full songs: >= 2 minutes - typically full music videos
        const isShortVideo = duration < 120; // 2 minutes threshold
        const isFullSong = duration >= 120;

        // Extract Audio in parallel with other operations (don't wait)
        const audioExtractionPromise = AudioService.extractAudio(result.filePath);

        // Send video only if small and not a full song (to save time)
        if (sizeMB <= 50 && !isFullSong) {
            // Send Video first as native object (non-blocking)
            ctx.replyWithVideo({ source: result.filePath }, {
                caption: `🎥 ${result.title}\n\n@SonexMusicBot`
            }).catch(() => {}); // Don't wait, continue processing
        }

        // Wait for audio extraction
        const audioPath = await audioExtractionPromise;
        
        await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `✅ Tayyor! Yuborilmoqda...`).catch(() => {});

        // If it's a full song, just send the audio once (no need to search for full version)
        if (isFullSong) {
            // Send as full song (not "cut" version)
            await ctx.replyWithAudio({ source: audioPath }, {
                title: `🎵 ${result.title}`,
                performer: result.uploader,
                caption: "🎵 To'liq musiqa"
            });
            
            // Cleanup and return - no need to search for full version
            if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
            return;
        }

        // For short videos, try to find and send the full version of the song
        // Start searching immediately, send cut audio in parallel
        if (isShortVideo && (result.metadata || (!isInstagram && info.title))) {
            // Send Cut Audio from short video in parallel (non-blocking)
            const cutCaption = isInstagram ? "✂️ Vidyo dagi musiqa (Kesilgan)" : "✂️ Qisqa vidyo'dan ajratilgan musiqa";
            const sendCutAudioPromise = ctx.replyWithAudio({ source: audioPath }, {
                title: `✂️ ${result.title} (Kesilgan)`,
                performer: result.uploader,
                caption: cutCaption
            }).catch(() => {}); // Don't wait, start searching for full version immediately
            try {
                // Priority 1: Use metadata to find the full version of the song
                let searchQuery = '';
                let originalDuration = duration; // Store original video duration for comparison
                
                if (isInstagram && result.metadata) {
                    const metadata = result.metadata;
                    
                    // Try multiple metadata sources for Instagram - prioritize most accurate
                    // 1. Track + Artist (most accurate)
                    if (metadata.track && metadata.artist) {
                        searchQuery = `${metadata.artist} ${metadata.track}`;
                    } else if (metadata.track) {
                        searchQuery = metadata.track;
                    } 
                    // 2. Description'dan extract qilish
                    else if (metadata.description) {
                        // Try multiple patterns for music info
                        const patterns = [
                            /🎵\s*([^\n]+)/i,
                            /Music:\s*([^\n]+)/i,
                            /Song:\s*([^\n]+)/i,
                            /Original\s+Audio:\s*([^\n]+)/i,
                            /Track:\s*([^\n]+)/i
                        ];
                        
                        for (const pattern of patterns) {
                            const match = metadata.description.match(pattern);
                            if (match) {
                                searchQuery = match[1].trim();
                                // Remove emojis and clean up
                                searchQuery = searchQuery.replace(/[🎵🎶🎤🎧]/g, '').trim();
                                break;
                            }
                        }
                    }
                    // 3. Fulltitle'dan extract qilish
                    if (!searchQuery && metadata.fulltitle) {
                        searchQuery = metadata.fulltitle
                            .replace(/\s*-\s*Instagram.*/i, '')
                            .replace(/\s*#.*/g, '')
                            .trim();
                    }
                }
                
                // For YouTube or if Instagram metadata didn't work, try info fields
                if (!searchQuery) {
                    // 1. Track + Artist (most accurate)
                    if (info.track) {
                        searchQuery = info.artist ? `${info.artist} ${info.track}` : info.track;
                    } 
                    // 2. Description'dan extract
                    else if (info.description) {
                        const patterns = [
                            /🎵\s*([^\n]+)/i,
                            /Music:\s*([^\n]+)/i,
                            /Song:\s*([^\n]+)/i,
                            /Original\s+Audio:\s*([^\n]+)/i
                        ];
                        
                        for (const pattern of patterns) {
                            const match = info.description.match(pattern);
                            if (match) {
                                searchQuery = match[1].trim();
                                searchQuery = searchQuery.replace(/[🎵🎶🎤🎧]/g, '').trim();
                                break;
                            }
                        }
                    } 
                    // 3. Alt title
                    else if (info.alt_title) {
                        searchQuery = info.alt_title;
                    } 
                    // 4. Title'dan tozalash (YouTube uchun) - more careful cleaning
                    else if (info.title && !isInstagram) {
                        // More careful cleaning - preserve artist and song name structure
                        searchQuery = info.title
                            .replace(/\s*\(.*?official.*?\)/gi, '') // Remove (Official Video) etc
                            .replace(/\s*\(.*?lyrics.*?\)/gi, '') // Remove (Lyrics) etc
                            .replace(/\s*\(.*?audio.*?\)/gi, '') // Remove (Audio) etc
                            .replace(/\s*\[.*?\]/g, '') // Remove [HD] etc
                            .replace(/\s*-\s*Official\s*(Video|Audio|Lyrics).*/i, '') // Remove "- Official Video/Audio"
                            .replace(/\s*-\s*Lyrics.*/i, '') // Remove "- Lyrics..."
                            .replace(/\s*-\s*Audio.*/i, '') // Remove "- Audio..." (but keep artist - song format)
                            .replace(/\s*\(.*?\)/g, '') // Remove any remaining parentheses
                            .trim();
                    }
                }
                
                // Clean up search query - but preserve important characters
                if (searchQuery) {
                    searchQuery = searchQuery
                        .replace(/\s+/g, ' ') // Multiple spaces to single
                        .replace(/[^\w\s\-\u0400-\u04FF]/g, '') // Remove special chars except hyphens and Cyrillic
                        .trim();
                    
                    // Don't remove too much - preserve song name structure
                    // Only remove if query is too long
                    if (searchQuery.length > 100) {
                        searchQuery = searchQuery.substring(0, 100).trim();
                    }
                }

                if (searchQuery && searchQuery.length > 3) {
                    try {
                        Logger.info(`Searching for full version: "${searchQuery}" (original duration: ${Math.round(originalDuration)}s)`);
                        
                    // Try multiple search strategies for better results (reduced for speed)
                    const searchStrategies = [
                        searchQuery, // Original query
                        `${searchQuery} official audio` // Add "official audio" (most common)
                    ];
                    
                    let fullAudioSent = false;
                    
                    for (const strategy of searchStrategies) {
                        if (fullAudioSent) break; // Already found, no need to continue
                        
                        try {
                            Logger.info(`Trying search strategy: "${strategy}"`);
                            // Search for fewer results for speed (5 instead of 10)
                            const searchResults = await MusicService.search(strategy, 5);

                                if (searchResults.length > 0) {
                                    // Get original video title and uploader for better matching
                                    const originalTitle = (result.title || info.title || '').toLowerCase();
                                    const originalUploader = (result.uploader || info.uploader || '').toLowerCase();
                                    
                                    // Filter and rank results by:
                                    // 1. Exact title match with original (highest priority)
                                    // 2. Title similarity with search query
                                    // 3. Duration should be longer than original (full version)
                                    // 4. Uploader match
                                    // 5. Keywords that indicate full version
                                    const rankedResults = searchResults
                                        .map(searchResult => {
                                            let score = 0;
                                            const titleLower = searchResult.title.toLowerCase();
                                            const queryLower = searchQuery.toLowerCase();
                                            const uploaderLower = searchResult.uploader.toLowerCase();
                                            
                                            // 1. EXACT TITLE MATCH - Highest priority (must match original video title)
                                            // Remove common suffixes from both titles for comparison
                                            const cleanOriginalTitle = originalTitle
                                                .replace(/\s*\(.*?\)/g, '')
                                                .replace(/\s*\[.*?\]/g, '')
                                                .replace(/\s*-\s*(official|lyrics|audio|video|hd|4k|1080p|720p).*/i, '')
                                                .trim();
                                            
                                            const cleanResultTitle = titleLower
                                                .replace(/\s*\(.*?\)/g, '')
                                                .replace(/\s*\[.*?\]/g, '')
                                                .replace(/\s*-\s*(official|lyrics|audio|video|hd|4k|1080p|720p).*/i, '')
                                                .trim();
                                            
                                            // Check if titles match (allowing for minor differences)
                                            if (cleanResultTitle === cleanOriginalTitle || 
                                                cleanResultTitle.includes(cleanOriginalTitle) ||
                                                cleanOriginalTitle.includes(cleanResultTitle)) {
                                                score += 100; // Very high score for exact match
                                            }
                                            
                                            // 2. Title similarity with search query
                                            const queryWords = queryLower.split(' ').filter(w => w.length > 2);
                                            const titleWords = titleLower.split(' ');
                                            const matchingWords = queryWords.filter(qw => 
                                                titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
                                            );
                                            score += matchingWords.length * 10; // Increased weight
                                            
                                            // 3. Duration check - full version should be longer
                                            const resultDuration = parseDuration(searchResult.duration);
                                            if (resultDuration > originalDuration * 0.9) { // At least 90% of original or longer
                                                score += 15;
                                            }
                                            if (resultDuration > originalDuration * 1.2) { // 20% longer = likely full version
                                                score += 25;
                                            }
                                            if (resultDuration > originalDuration * 2) { // Much longer = definitely full version
                                                score += 30;
                                            }
                                            
                                            // 4. Uploader match (bonus if same uploader)
                                            if (originalUploader && uploaderLower.includes(originalUploader) || 
                                                originalUploader.includes(uploaderLower)) {
                                                score += 20;
                                            }
                                            
                                            // 5. Keywords that indicate full version
                                            if (titleLower.includes('official') && titleLower.includes('audio')) {
                                                score += 20; // Both keywords = very likely
                                            } else if (titleLower.includes('official') || titleLower.includes('audio')) {
                                                score += 10;
                                            }
                                            if (titleLower.includes('full') || titleLower.includes('complete')) {
                                                score += 15;
                                            }
                                            
                                            // 6. Penalize short clips, remixes, covers (unless explicitly searched)
                                            if (titleLower.includes('clip') || titleLower.includes('short') || titleLower.includes('excerpt')) {
                                                score -= 30;
                                            }
                                            if (titleLower.includes('cover') && !queryLower.includes('cover')) {
                                                score -= 25;
                                            }
                                            if (titleLower.includes('remix') && !queryLower.includes('remix')) {
                                                score -= 20;
                                            }
                                            if (titleLower.includes('live') && !queryLower.includes('live')) {
                                                score -= 15; // Prefer studio version
                                            }
                                            
                                            return { ...searchResult, score, duration: resultDuration };
                                        })
                                        .filter(r => r.score > 20) // Only keep results with meaningful score
                                        .sort((a, b) => b.score - a.score); // Sort by score descending
                                    
                                    Logger.info(`Found ${rankedResults.length} ranked results, trying top ${Math.min(3, rankedResults.length)}`);
                                    
                                // Try top 2 ranked results (reduced for speed)
                                for (const searchResult of rankedResults.slice(0, 2)) {
                                        try {
                                            const fullMusicUrl = searchResult.url;
                                            Logger.info(`Trying to download: ${searchResult.title} (score: ${searchResult.score}, duration: ${searchResult.duration}s)`);
                                            
                                            // Download full audio from Youtube (audio only, no progress for speed)
                                            const fullAudioResult = await YoutubeService.handleLink(fullMusicUrl, true);

                                            await ctx.replyWithAudio({ source: fullAudioResult.filePath }, {
                                                title: `🎵 ${searchResult.title}`,
                                                performer: searchResult.uploader,
                                                caption: "🎵 To'liq musiqa"
                                            });

                                            if (fs.existsSync(fullAudioResult.filePath)) fs.unlinkSync(fullAudioResult.filePath);
                                            fullAudioSent = true;
                                            Logger.info(`Successfully sent full version: ${searchResult.title}`);
                                            break; // Success, no need to try other results
                                        } catch (err) {
                                            Logger.warn(`Failed to download full version from ${searchResult.url}, trying next result...`);
                                            continue; // Try next result
                                        }
                                    }
                                }
                            } catch (strategyError) {
                                Logger.warn(`Search strategy "${strategy}" failed, trying next...`);
                                continue;
                            }
                        }
                        
                        // If no full audio was sent after trying all strategies
                        if (!fullAudioSent) {
                            Logger.info(`All search strategies failed for: ${searchQuery}`);
                            // User'ga xabar yuborish
                            await ctx.reply('😔 To\'liq musiqa topilmadi yoki yuklab bo\'lmadi. Uzur!').catch(() => {});
                        }
                    } catch (searchError) {
                        Logger.error('Error searching for full version', searchError);
                        // User'ga xabar yuborish
                        await ctx.reply('😔 To\'liq musiqa qidirishda xatolik yuz berdi. Uzur!').catch(() => {});
                    }
                } else {
                    Logger.info('No music metadata found, skipping full version search');
                    // User'ga xabar yuborish - metadata topilmadi (faqat agar Instagram bo'lsa)
                    if (isInstagram) {
                        await ctx.reply('😔 Video\'dan musiqa ma\'lumotlari topilmadi. To\'liq versiyani qidirib bo\'lmadi. Uzur!').catch(() => {});
                    }
                }
            } catch (searchErr: any) {
                Logger.error('Error finding full version for Instagram link', searchErr);
                // Don't fail the whole operation if music search fails
                // The extracted audio from video is already sent
            }
        }

        // Cleanup (only if we haven't returned early for full song)
        // Cleanup in parallel for speed (don't wait)
        Promise.all([
            fs.existsSync(result.filePath) ? fs.promises.unlink(result.filePath).catch(() => {}) : Promise.resolve(),
            fs.existsSync(audioPath) ? fs.promises.unlink(audioPath).catch(() => {}) : Promise.resolve(),
            ctx.deleteMessage(statusMsg.message_id).catch(() => {})
        ]).catch(() => {});
    } catch (e: any) {
        Logger.error('Media delivery error', e);
        
        // Provide user-friendly error messages
        let errorMessage = `❌ Xatolik: ${e.message || 'Noma\'lum xatolik'}`;
        
        // Clean up any partial downloads
        try {
            // This is a best-effort cleanup, errors here are not critical
        } catch (cleanupErr) {
            Logger.error('Error during cleanup', cleanupErr);
        }
        
        await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, errorMessage).catch(() => { });
    }
};

export const startHandler = async (ctx: Context) => {
    try {
        const message = `🚀 **Sonex Music Bot** – Sizning professional musiqa yordamchingiz!

Men quyidagilarni qila olaman:
🔹 YouTube, Instagram, TikTok va boshqa platformalardan yuklash
🔹 Videolardan audioni (MP3) ajratib olish
🔹 Bir vaqtning o'zida Video va Audio formatda yuklash
🔹 Yuqori tezlikda va sifatli xizmat (Real-time progress)

👉 **Boshlash uchun:** Shunchaki qoʻshiq nomini yozing yoki link yuboring.`;

        await ctx.replyWithMarkdown(message, {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🎵 Instagram Top 10 Music', 'top10_insta')]
            ]),
            ...Markup.removeKeyboard()
        });
    } catch (error) {
        Logger.error('Error in startHandler', error);
    }
};

export const helpHandler = async (ctx: Context) => {
    try {
        const helpText = `❓ **Yordam markazi**

Har qanday muammo yoki takliflar bo'lsa, adminga murojaat qiling:
👉 @Annazarov511

Botdan foydalanish mutlaqo bepul va oson!`;
        await ctx.replyWithMarkdown(helpText);
    } catch (error) {
        Logger.error('Error in helpHandler', error);
    }
};

export const songHandler = async (ctx: Context) => {
    try {
        const songText = `🎵 **Musiqa qidirish bo'yicha qo'llanma**

Siz botga quyidagilarni yuborishingiz mumkin:
1️⃣ **Qo'shiq nomi** (masalan: *Aga - Xushla mani*)
2️⃣ **Platforma Linki** (YouTube, Instagram, TikTok, Soundcloud va h.k.)
3️⃣ **Fayl** (Video yoki Audio fayl yuborsangiz, bot undan musiqani ajratib beradi)

Iltimos, qidiruv natijalaridan o'zingizga yoqqanini tanlang!`;
        await ctx.replyWithMarkdown(songText);
    } catch (error) {
        Logger.error('Error in songHandler', error);
    }
};

const sendSearchResults = async (ctx: any, results: SearchResult[], page: number) => {
    const pageSize = 5;
    const start = page * pageSize;
    const end = start + pageSize;
    const currentResults = results.slice(start, end);

    let text = `🔍 **Qidiruv natijalari** (${page + 1}/${Math.ceil(results.length / pageSize)}):\n\n`;
    const buttons = currentResults.map((res, i) => [
        Markup.button.callback(`${start + i + 1}. ${res.title} (${res.duration})`, `select_${res.id}`)
    ]);

    const navButtons = [];
    if (page > 0) navButtons.push(Markup.button.callback('⬅️ Orqaga', `page_${page - 1}`));
    if (end < results.length) navButtons.push(Markup.button.callback('Oldinga ➡️', `page_${page + 1}`));

    if (navButtons.length > 0) buttons.push(navButtons);

    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    } else {
        await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    }
};

export const messageHandler = async (ctx: any) => {
    try {
        const text = ctx.message?.text;
        const document = ctx.message?.document;
        const video = ctx.message?.video;
        const audio = ctx.message?.audio;

        if (text) {
            if (text.startsWith('/')) return;

            // Link Detection (Support almost anything yt-dlp supports)
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = text.match(urlRegex);

            if (matches && matches.length > 0) {
                const url = matches[0];
                
                // Validate Instagram URLs before processing
                if (url.includes('instagram.com') && !InstagramService.isValidInstagramUrl(url)) {
                    await ctx.reply('❌ Noto\'g\'ri Instagram havolasi. Iltimos, to\'g\'ri Instagram post, reel yoki video havolasini yuboring.\n\nMasalan:\n• https://www.instagram.com/reel/...\n• https://www.instagram.com/p/...\n• https://www.instagram.com/tv/...');
                    return;
                }
                
                const statusMsg = await ctx.reply('🚀 Havola tahlil qilinmoqda...');
                await handleMediaDelivery(url, ctx, statusMsg);
                return;
            }

            const statusMsg = await ctx.reply('🔍 Qidirilmoqda...');
            try {
                const results = await MusicService.search(text);
                session[ctx.chat.id] = { results, page: 0, query: text };
                await ctx.deleteMessage(statusMsg.message_id);
                await sendSearchResults(ctx, results, 0);
            } catch (error: any) {
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `❌ Xato: ${error.message}`);
            }
            return;
        }

        if (video || audio || document) {
            const statusMsg = await ctx.reply('📥 Fayl yuklab olinmoqda...');
            try {
                const fileId = video?.file_id || audio?.file_id || document?.file_id;
                const fileInfo = await ctx.telegram.getFile(fileId);
                const fileSizeBytes = fileInfo.file_size || 0;
                const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);
                
                // Check if it's a video file and size is > 2GB
                if ((video || (document && document.mime_type?.startsWith('video/'))) && fileSizeGB > 2) {
                    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, 
                        `❌ Video juda katta (${fileSizeGB.toFixed(2)}GB). 2GB dan oshib ketdi. Iltimos, kichikroq video yuboring.`
                    );
                    return;
                }
                
                // If video is between 1GB and 2GB, ask user if they want to extract all songs
                if ((video || (document && document.mime_type?.startsWith('video/'))) && fileSizeGB >= 1 && fileSizeGB <= 2) {
                    const link = await ctx.telegram.getFileLink(fileId);
                    const tempDir = path.join(process.cwd(), 'downloads', 'temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    const fileName = (document?.file_name || video?.file_name || 'temp_media') + (video ? '.mp4' : '');
                    const tempFilePath = path.join(tempDir, fileName);
                    
                    // Store file path in session for later processing
                    if (!session[ctx.chat.id]) {
                        session[ctx.chat.id] = { results: [], page: 0, query: '' };
                    }
                    session[ctx.chat.id].tempVideoPath = tempFilePath;
                    session[ctx.chat.id].fileLink = link.href;
                    
                    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined,
                        `📹 Video hajmi: ${fileSizeGB.toFixed(2)}GB\n\n` +
                        `Rostan ham shu video'dagi barcha musiqalarni topmoqchimisiz?`,
                        Markup.inlineKeyboard([
                            [Markup.button.callback('✅ Ha, barcha musiqalarni top', `extract_all_songs_${ctx.chat.id}`)],
                            [Markup.button.callback('❌ Yo\'q, faqat audioni ajrat', `extract_single_audio_${ctx.chat.id}`)]
                        ])
                    );
                    return;
                }
                
                // For smaller videos or audio files, process normally
                const link = await ctx.telegram.getFileLink(fileId);
                const tempDir = path.join(process.cwd(), 'downloads', 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const fileName = (document?.file_name || video?.file_name || 'temp_media') + (video ? '.mp4' : '');
                const tempFilePath = path.join(tempDir, fileName);

                const response = await axios.get(link.href, { responseType: 'stream' });
                const writer = fs.createWriteStream(tempFilePath);
                response.data.pipe(writer);
                await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });

                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, '🎵 Musiqa ajratib olinmoqda...');
                const audioPath = await AudioService.extractAudio(tempFilePath);
                await ctx.replyWithAudio({ source: audioPath });

                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
            } catch (error: any) {
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `❌ Xatolik: ${error.message}`).catch(() => { });
            }
        }
    } catch (error) {
        Logger.error('Error in messageHandler', error);
    }
};

export const callbackHandler = async (ctx: any) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;

    if (data === 'top10_insta') {
        await ctx.answerCbQuery('Trendlar yuklanmoqda...');
        try {
            const results = await MusicService.getTop10Instagram();
            session[chatId] = { results, page: 0, query: 'Top 10 Instagram' };
            await sendSearchResults(ctx, results, 0);
        } catch (e: any) {
            await ctx.reply(`❌ Xato: ${e.message}`);
        }
        return;
    }

    if (data.startsWith('page_')) {
        const page = parseInt(data.split('_')[1]);
        if (session[chatId]) {
            session[chatId].page = page;
            await sendSearchResults(ctx, session[chatId].results, page);
            await ctx.answerCbQuery();
        }
        return;
    }

    if (data.startsWith('select_')) {
        const id = data.split('_')[1];
        const url = `https://www.youtube.com/watch?v=${id}`;
        await ctx.answerCbQuery('Musiqa tayyorlanmoqda...');
        const statusMsg = await ctx.reply('🚀 Yuklab olinmoqda...');
        await handleMediaDelivery(url, ctx, statusMsg);
    }
    
    if (data.startsWith('extract_all_songs_')) {
        const targetChatId = parseInt(data.split('_')[3]);
        if (targetChatId !== chatId) {
            await ctx.answerCbQuery('Bu sizning xabaringiz emas!');
            return;
        }
        
        await ctx.answerCbQuery('Kutilib turing...');
        await ctx.editMessageText('⏳ Video tahlil qilinmoqda, kutilib turing...');
        
        try {
            const sessionData = session[chatId];
            if (!sessionData?.tempVideoPath || !sessionData?.fileLink) {
                await ctx.reply('❌ Xatolik: Video ma\'lumotlari topilmadi. Iltimos, qayta yuboring.');
                return;
            }
            
            const tempFilePath = sessionData.tempVideoPath;
            const fileLink = sessionData.fileLink;
            
            // Download video if not already downloaded
            if (!fs.existsSync(tempFilePath)) {
                const statusMsg = await ctx.reply('📥 Video yuklab olinmoqda...');
                const response = await axios.get(fileLink, { responseType: 'stream' });
                const writer = fs.createWriteStream(tempFilePath);
                response.data.pipe(writer);
                await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });
                await ctx.deleteMessage(statusMsg.message_id).catch(() => {});
            }
            
            const statusMsg = await ctx.reply('🔍 Videodagi musiqalar topilmoqda, kutilib turing...');
            
            // Extract songs from video
            const detectedSongs = await VideoSongsService.extractSongsFromVideo(tempFilePath);
            
            if (detectedSongs.length === 0) {
            await ctx.telegram.editMessageText(
                chatId,
                statusMsg.message_id,
                undefined,
                '😔 Videodan hech qanday musiqa topilmadi.\n\n' +
                'Bu video metadata yoki descriptionda musiqa ma\'lumotlari bo\'lmasligi mumkin.\n\n' +
                'Faqat audioni ajratish uchun quyidagi tugmani bosing:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🎵 Faqat audioni ajrat', `extract_single_audio_${chatId}`)]
                ])
            );
                return;
            }
            
            await ctx.telegram.editMessageText(
                chatId,
                statusMsg.message_id,
                undefined,
                `✅ ${detectedSongs.length} ta musiqa topildi!\n\n` +
                'Endi ularning to\'liq versiyalarini yuklab olamiz...'
            );
            
            // Find and download full versions
            await VideoSongsService.findAndDownloadFullSongs(detectedSongs, ctx, statusMsg);
            
            // Cleanup
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            delete session[chatId].tempVideoPath;
            delete session[chatId].fileLink;
            
        } catch (error: any) {
            Logger.error('Error extracting all songs', error);
            await ctx.reply(`❌ Xatolik: ${error.message || 'Noma\'lum xatolik'}`).catch(() => {});
        }
    }
    
    if (data.startsWith('extract_single_audio_')) {
        const targetChatId = parseInt(data.split('_')[3]);
        if (targetChatId !== chatId) {
            await ctx.answerCbQuery('Bu sizning xabaringiz emas!');
            return;
        }
        
        await ctx.answerCbQuery('Kutilib turing...');
        await ctx.editMessageText('🎵 Musiqa ajratib olinmoqda...');
        
        try {
            const sessionData = session[chatId];
            if (!sessionData?.tempVideoPath || !sessionData?.fileLink) {
                await ctx.reply('❌ Xatolik: Video ma\'lumotlari topilmadi. Iltimos, qayta yuboring.');
                return;
            }
            
            const tempFilePath = sessionData.tempVideoPath;
            const fileLink = sessionData.fileLink;
            
            // Download video if not already downloaded
            if (!fs.existsSync(tempFilePath)) {
                const statusMsg = await ctx.reply('📥 Video yuklab olinmoqda...');
                const response = await axios.get(fileLink, { responseType: 'stream' });
                const writer = fs.createWriteStream(tempFilePath);
                response.data.pipe(writer);
                await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });
                await ctx.deleteMessage(statusMsg.message_id).catch(() => {});
            }
            
            // Extract audio
            const audioPath = await AudioService.extractAudio(tempFilePath);
            await ctx.replyWithAudio({ source: audioPath });
            
            // Cleanup
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            await ctx.deleteMessage().catch(() => {});
            
            delete session[chatId].tempVideoPath;
            delete session[chatId].fileLink;
            
        } catch (error: any) {
            Logger.error('Error extracting single audio', error);
            await ctx.reply(`❌ Xatolik: ${error.message || 'Noma\'lum xatolik'}`).catch(() => {});
        }
    }
};
