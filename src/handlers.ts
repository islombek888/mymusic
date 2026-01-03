import { Context, Markup } from 'telegraf';
import { Logger } from './utils/logger.js';
import { MusicService, SearchResult } from './services/music.service.js';
import { YoutubeService } from './services/youtube.service.js';
import { InstagramService } from './services/instagram.service.js';
import { AudioService } from './services/audio.service.js';
import { Downloader } from './utils/downloader.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const session: { [chatId: number]: { results: SearchResult[], page: number, query: string } } = {};

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
 * Unified helper to deliver both Video (if available) and Audio
 */
const handleMediaDelivery = async (url: string, ctx: any, statusMsg: any) => {
    const chatId = ctx.chat.id;
    let lastUpdate = Date.now();
    const isInstagram = url.includes('instagram.com');

    const onProgress = async (progress: string) => {
        // Throttling updates to once per 2 seconds to avoid Telegram rate limits
        if (Date.now() - lastUpdate > 2000) {
            const bar = getProgressBar(progress);
            await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `⏳ Yuklanmoqda: ${bar}`).catch(() => { });
            lastUpdate = Date.now();
        }
    };

    try {
        // Check info first to see file size
        const info = await Downloader.getInfo(url);
        const duration = info.duration || 0;

        // Estimation of size if not provided (yt-dlp info might have it or not)
        // If it's a very long video, we should warn or handle
        if (duration > 3600 * 2) { // 2 hours
            await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `⚠️ Video juda uzun (${Math.round(duration / 60)} min). Uni qayta ishlash imkonsiz bo'lishi mumkin.`);
        }

        let result: any;
        if (isInstagram) {
            result = await InstagramService.handleLink(url, onProgress);
        } else {
            result = await YoutubeService.handleLink(url, false, onProgress);
        }

        const stats = fs.statSync(result.filePath);
        const sizeMB = stats.size / (1024 * 1024);

        if (sizeMB > 500) {
            await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `⚠️ Fayl juda katta (${sizeMB.toFixed(1)}MB). Telegram 500MB dan katta fayllarni qabul qilmaydi.\n\nSiz uni mana bu yerda ko'rishingiz mumkin: ${url}`);
            if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
            return;
        }

        await ctx.telegram.editMessageText(chatId, statusMsg.message_id, undefined, `✅ Yuklash tugadi! Fayllar yuborilmoqda...`);

        if (sizeMB <= 50) {
            // Send Video first as native object
            await ctx.replyWithVideo({ source: result.filePath }, {
                caption: `🎥 ${result.title}\n\n@SonexMusicBot`
            });
        }

        // Extract Audio locally (Cut version)
        const audioPath = await AudioService.extractAudio(result.filePath);
        const cutCaption = isInstagram ? "✂️ Vidyo dagi musiqa (Kesilgan)" : undefined;

        // Send Cut Audio
        await ctx.replyWithAudio({ source: audioPath }, {
            title: `✂️ ${result.title} (Kesilgan)`,
            performer: result.uploader,
            caption: cutCaption
        });

        // If Instagram, also search for and send the full version
        if (isInstagram) {
            try {
                // Priority 1: Use Instagram's native track metadata (most accurate)
                let searchQuery = '';
                if (info.track) {
                    // Instagram Reels often have 'track' field with the actual song name
                    searchQuery = info.track;
                } else if (info.artist && info.track) {
                    searchQuery = `${info.artist} ${info.track}`;
                } else if (info.alt_title) {
                    // Sometimes alt_title contains the music info
                    searchQuery = info.alt_title;
                } else {
                    // If no music metadata found, skip full version search
                    Logger.info('No music metadata found in Instagram video, skipping full version search');
                    return;
                }

                if (searchQuery) {
                    Logger.info(`Searching for full version: ${searchQuery}`);
                    const searchResults = await MusicService.search(searchQuery, 1);

                    if (searchResults.length > 0) {
                        const fullMusicUrl = searchResults[0].url;
                        // Download full audio from Youtube
                        const fullAudioResult = await YoutubeService.handleLink(fullMusicUrl, true);

                        await ctx.replyWithAudio({ source: fullAudioResult.filePath }, {
                            title: `🎵 ${searchResults[0].title}`,
                            performer: searchResults[0].uploader,
                            caption: "🎵 To'liq musiqa"
                        });

                        if (fs.existsSync(fullAudioResult.filePath)) fs.unlinkSync(fullAudioResult.filePath);
                    }
                }
            } catch (searchErr) {
                Logger.error('Error finding full version for Instagram link', searchErr);
            }
        }

        // Cleanup
        if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        await ctx.deleteMessage(statusMsg.message_id).catch(() => { });
    } catch (e: any) {
        Logger.error('Media delivery error', e);
        const errorMessage = `❌ Xatolik: ${e.message}`;
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
};
