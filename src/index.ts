import bot from './bot.js';
import { Logger } from './utils/logger.js';
import http from 'http';

const PORT = process.env.PORT || 3000;

// Create HTTP server for Render health checks
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Sonex Music Bot is running!');
    }
});

const start = async () => {
    try {
        Logger.info('Sonex Music Bot ishga tushmoqda...');

        // Start HTTP server for Render
        server.listen(PORT, () => {
            Logger.info(`HTTP server listening on port ${PORT}`);
        });

        // Start Telegram bot
        await bot.launch();
        Logger.info('Bot muvaffaqiyatli ishga tushdi!');
    } catch (error) {
        Logger.error('Botni ishga tushirishda xatolik:', error);
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
