import express, { Request, Response } from 'express';
import bot from './bot.js';
import { Logger } from './utils/logger.js';
import { messageHandler } from './handlers.js';
import http from 'http';

const app = express();
const server = http.createServer(app);
const PREFERRED_PORT = parseInt(process.env.PORT || '4000', 10);

// Add instance identifier to avoid conflicts
const INSTANCE_ID = process.env.RENDER_INSTANCE_ID || Date.now().toString();

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

/**
 * Starts the server on the specified port. 
 * If the port is in use, it will recursively try the next port.
 */
const startServer = (port: number) => {
    server.listen(port, () => {
        Logger.info(`HTTP server listening on port ${port}`);
        launchBot();
    });

    server.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
            Logger.warn(`Port ${port} band ekan. ${port + 1} portini sinab ko'ryapman...`);
            setTimeout(() => {
                server.close();
                startServer(port + 1);
            }, 1000);
        } else {
            Logger.error('Server hatosi:', e);
        }
    });
};

const launchBot = async () => {
    try {
        // Clean up any existing webhook
        try {
            await bot.telegram.deleteWebhook();
            Logger.info('Webhook tozalandi.');
        } catch (webhookError) {
            // Ignore webhook cleanup errors
        }

        // Start Telegram bot with polling (non-blocking)
        bot.launch()
            .then(() => {
                Logger.info('Bot muvaffaqiyatli ishga tushdi!');
            })
            .catch((err) => {
                Logger.error('Botni launch qilishda xatolik:', err);
                // Don't exit here, maybe only if it's a fatal API error
            });

        Logger.info('Bot xabarlarni kutmoqda...');
    } catch (error: any) {
        Logger.error('Bot launch jarayonida hatolik:', error);
    }
};

const start = async () => {
    try {
        Logger.info('Sonex Music Bot ishga tushmoqda...');

        // Check for required environment variables
        if (!process.env.BOT_TOKEN) {
            Logger.error('BOT_TOKEN environment variable is missing!');
            process.exit(1);
        }

        // Start looking for a free port
        startServer(PREFERRED_PORT);

    } catch (error: any) {
        Logger.error('Startup jarayonida kutilmagan xatolik:', error);
        process.exit(1);
    }
};

// Enable graceful stop
const stop = (signal: string) => {
    server.close();
    bot.stop(signal);
    process.exit(0);
};

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    Logger.error(`Unhandled Rejection at: ${promise}`, reason);
});

process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception:', error);
    // Only exit if it's not a server error we handle
    if (!(error as any).code || (error as any).code !== 'EADDRINUSE') {
        process.exit(1);
    }
});

start();
