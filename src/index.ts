// import bot from './bot.js';
// import { Logger } from './utils/logger.js';
// import http from 'http';

// const PORT = process.env.PORT || 3000;



// // Create HTTP server for Render health checks
// const server = http.createServer((req, res) => {
//     if (req.url === '/health') {
//         res.writeHead(200, { 'Content-Type': 'application/json' });
//         res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
//     } else {
//         res.writeHead(200, { 'Content-Type': 'text/plain' });
//         res.end('Sonex Music Bot is running!');
//     }
// });

// const start = async () => {
//     try {
//         Logger.info('Sonex Music Bot ishga tushmoqda...');

//         // Check for required environment variables
//         if (!process.env.BOT_TOKEN) {
//             Logger.error('BOT_TOKEN environment variable is missing!');
//             Logger.error('Please set BOT_TOKEN in your environment variables or .env file.');
//             process.exit(1);
//         }

//         // Start HTTP server for Render
//         server.listen(PORT, () => {
//             Logger.info(`HTTP server listening on port ${PORT}`);
//         });

//         // Start Telegram bot
//         await bot.launch();
//         Logger.info('Bot muvaffaqiyatli ishga tushdi!');
//     } catch (error: any) {
//         Logger.error('Botni ishga tushirishda xatolik:', error);
//         if (error.message) {
//             Logger.error(`Error message: ${error.message}`);
//         }
//         if (error.stack) {
//             Logger.error(`Stack trace: ${error.stack}`);
//         }
//         process.exit(1);
//     }
// };

// // Enable graceful stop
// process.once('SIGINT', () => {
//     server.close();
//     bot.stop('SIGINT');
// });
// process.once('SIGTERM', () => {
//     server.close();
//     bot.stop('SIGTERM');
// });

// start();

import fs from 'fs/promises';
import bot from './bot.js';
import { Logger } from './utils/logger.js';
import http from 'http';
import { YoutubeService } from './services/youtube.service.js';
import { InstagramService } from './services/instagram.service.js';

const PORT = process.env.PORT || 3000;

// Health check server
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    } else if (req.url === '/bot' && req.method === 'POST') {
        // Handle webhook updates for Render
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const update = JSON.parse(body);
                await bot.handleUpdate(update);
                res.writeHead(200);
                res.end('OK');
            } catch (error) {
                Logger.error('Webhook error', error);
                res.writeHead(500);
                res.end('Error');
            }
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Sonex Music Bot is running!');
    }
});

const start = async () => {
    try {
        Logger.info('Sonex Music Bot ishga tushmoqda...');

        if (!process.env.BOT_TOKEN) {
            Logger.error('BOT_TOKEN missing!');
            process.exit(1);
        }

        // Add delay to avoid conflicts with other bots
        if (process.env.RENDER) {
            Logger.info('Waiting 5 seconds to avoid conflicts...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        server.listen(PORT, () => {
            Logger.info(`HTTP server listening on port ${PORT}`);
        });

        // Setup text handler
        bot.on('text', async (ctx) => {
            const text = ctx.message.text.trim();
            try {
                let result;

                if (InstagramService.isValidInstagramUrl(text)) {
                    result = await InstagramService.handleLink(text);
                } else if (text.includes('youtube.com') || text.includes('youtu.be')) {
                    result = await YoutubeService.handleLink(text);
                } else {
                    return ctx.reply('Iltimos, faqat YouTube yoki Instagram link yuboring.');
                }

                const audioBuffer = await fs.readFile(result.filePath);

                // Telegramga yuborish
                await ctx.replyWithAudio(
                    { source: audioBuffer } as any, // InputFile import qilish shart emas
                    { caption: result.title }
                );

            } catch (err: any) {
                Logger.error('Link processing error', err);
                ctx.reply(`Xatolik: ${err.message}`);
            }
        });

        // Use webhook mode in Render, polling mode locally
        if (process.env.RENDER) {
            // First, delete any existing webhook to avoid conflicts
            try {
                await bot.telegram.deleteWebhook();
                Logger.info('Deleted existing webhook');
            } catch (error) {
                Logger.info('No existing webhook to delete');
            }
            
            const webhookUrl = `https://${process.env.RENDER_SERVICE_SLUG}.onrender.com/bot`;
            Logger.info(`Setting webhook: ${webhookUrl}`);
            
            await bot.telegram.setWebhook(webhookUrl);
            Logger.info('Webhook mode activated');
        } else {
            // For local development, first delete webhook then use polling
            try {
                await bot.telegram.deleteWebhook();
                Logger.info('Deleted webhook for polling mode');
            } catch (error) {
                // Ignore if no webhook exists
            }
            
            await bot.launch();
            Logger.info('Polling mode activated');
        }
        
        Logger.info('Bot muvaffaqiyatli ishga tushdi!');

    } catch (err: any) {
        Logger.error('Bot start error', err);
        process.exit(1);
    }
};

// Graceful shutdown
process.once('SIGINT', () => { server.close(); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { server.close(); bot.stop('SIGTERM'); });

start();