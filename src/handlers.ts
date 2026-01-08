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

        // Extract Audio in parallel with other operations (don't wait)
        const audioExtractionPromise = AudioService.extractAudio(result.filePath);

        // 1. ALWAYS send video first if size is reasonable
        if (sizeMB <= 50) {
            await ctx.replyWithVideo({ source: result.filePath }, {
                caption: `🎥 ${result.title}\n\n@SonexMusicBot`
            }).catch(() => { });
        } else {
            await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `⚠️ Video juda katta (${sizeMB.toFixed(1)}MB). Faqat audio yuboriladi.`).catch(() => { });
        }

        // 2. Wait for audio extraction
        const audioPath = await audioExtractionPromise;

        await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `✅ Tayyor! Audio yuborilmoqda...`).catch(() => { });

        // 3. ALWAYS send audio from the video first (Fast)
        await ctx.replyWithAudio({ source: audioPath }, {
            title: `🎵 ${result.title}`,
            performer: result.uploader,
            caption: "🎵 Musiqa (@SonexMusicBot)"
        });

        // 4. Smart Full Song Recovery (Senior Logic)
        // If it's a short video (< 3 mins), try to find the actual full song
        const isShortVideo = duration > 0 && duration < 180;

        if (isShortVideo) {
            try {
                await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `🔍 To'liq versiyasi qidirilmoqda...`).catch(() => { });

                // Clean title logic
                let cleanTitle = result.title
                    .replace(/#\S+/g, '') // Remove hashtags
                    .replace(/\(shorts?\)/gi, '') // Remove (shorts)
                    .replace(/shorts?/gi, '') // Remove "shorts" word
                    .replace(/official video/gi, '')
                    .replace(/music video/gi, '')
                    .replace(/video by [^\s]+/gi, '') // Remove "Video by username"
                    .replace(/reel by [^\s]+/gi, '') // Remove "Reel by username"
                    .replace(/video by/gi, '')
                    .replace(/reel by/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                let searchArtist = result.uploader || '';

                // If cleaned title is too short, use uploader name as fallback
                if (cleanTitle.length < 2) {
                    Logger.info('Clean title is empty, falling back to uploader name');
                    if (result.uploader && result.uploader.length > 2) {
                        cleanTitle = result.uploader;
                        // If we fallback to uploader, don't use artist in query to avoid duplication "Artist Artist"
                        searchArtist = '';
                    } else {
                        Logger.info('Uploader name is also too short, skipping full song search');
                        // We can cleanup early here since we are done
                        if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
                        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                        await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
                        return;
                    }
                }

                Logger.info(`Attempting to find full version for: ${searchArtist} ${cleanTitle}`);

                // We use findFullVersion which tries multiple patterns
                const fullVersion = await YoutubeService.findFullVersion(searchArtist, cleanTitle);

                if (fullVersion) {
                    await ctx.replyWithAudio({ source: fullVersion.filePath }, {
                        title: `⭐️ ${fullVersion.title}`,
                        performer: fullVersion.uploader,
                        caption: "⭐️ To'liq versiyasi (@SonexMusicBot)"
                    });
                    // Cleanup full version file
                    if (fs.existsSync(fullVersion.filePath)) fs.unlinkSync(fullVersion.filePath);
                } else {
                    // Silent fail - user already has the short version
                    Logger.info('Full version not found (silent)');
                }
            } catch (err) {
                Logger.warn('Full version search failed', err);
                // We don't spam the user with errors for this optional step
            }
        }

        // Cleanup
        if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

        await ctx.deleteMessage(statusMsg.message_id).catch(() => { });

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
        // Extract video ID - handle IDs that contain underscores
        const id = data.substring('select_'.length); // Get everything after 'select_'
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
                await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
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
            await ctx.reply(`❌ Xatolik: ${error.message || 'Noma\'lum xatolik'}`).catch(() => { });
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
                await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
            }

            // Extract audio
            const audioPath = await AudioService.extractAudio(tempFilePath);
            await ctx.replyWithAudio({ source: audioPath });

            // Cleanup
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            await ctx.deleteMessage().catch(() => { });

            delete session[chatId].tempVideoPath;
            delete session[chatId].fileLink;

        } catch (error: any) {
            Logger.error('Error extracting single audio', error);
            await ctx.reply(`❌ Xatolik: ${error.message || 'Noma\'lum xatolik'}`).catch(() => { });
        }
    }
};
