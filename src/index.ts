import express, { Request, Response } from 'express';
import bot from './bot.js';
import { Logger } from './utils/logger.js';
import { messageHandler } from './handlers.js';
import http from 'http';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Add instance identifier to avoid conflicts
const INSTANCE_ID = process.env.RENDER_INSTANCE_ID || Date.now().toString();
Logger.info(`Bot instance ID: ${INSTANCE_ID}`);

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        instance: INSTANCE_ID,
        timestamp: new Date().toISOString()
    });
});

// Telegram bot webhook (for future use)
app.post('/webhook', (req: Request, res: Response) => {
    res.status(200).send('OK');
});

// Handle messages
bot.on('message', messageHandler);
bot.on('callback_query', messageHandler);

const start = async () => {
    try {
        Logger.info('Sonex Music Bot ishga tushmoqda...');

        // Check for required environment variables
        if (!process.env.BOT_TOKEN) {
            Logger.error('BOT_TOKEN environment variable is missing!');
            Logger.error('Please set BOT_TOKEN in your environment variables or .env file.');
            process.exit(1);
        }

        // Start HTTP server for Render
        server.listen(PORT, () => {
            Logger.info(`HTTP server listening on port ${PORT}`);
        });

        // Clean up any existing webhook and wait a bit to avoid conflicts
        try {
            Logger.info('Cleaning up any existing webhook...');
            await bot.telegram.deleteWebhook();
            Logger.info('Webhook deleted, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (webhookError) {
            Logger.warn('Webhook cleanup failed (this is usually ok):', webhookError);
        }

        // Start Telegram bot with polling
        await bot.launch();
        Logger.info('Bot muvaffaqiyatli ishga tushdi!');
    } catch (error: any) {
        Logger.error('Botni ishga tushirishda xatolik:', error);
        if (error.message) {
            Logger.error(`Error message: ${error.message}`);
        }
        if (error.stack) {
            Logger.error(`Stack trace: ${error.stack}`);
        }
        
        // If it's a 409 conflict, wait and retry once
        if (error.message && error.message.includes('409')) {
            Logger.info('409 Conflict detected, waiting 10 seconds and retrying...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            try {
                await bot.launch();
                Logger.info('Bot successfully started after retry!');
                return;
            } catch (retryError: any) {
                Logger.error('Retry failed:', retryError);
            }
        }
        
        process.exit(1);
    }
};

// Enable graceful stop
process.once('SIGINT', () => {
    server.close();
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    server.close();
    bot.stop('SIGTERM');
});

start();
