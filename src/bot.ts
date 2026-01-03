import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { startHandler, helpHandler, songHandler, messageHandler, callbackHandler } from './handlers.js';
import { Logger } from './utils/logger.js';

dotenv.config();

const token = process.env.BOT_TOKEN;

if (!token) {
    Logger.error('========================================');
    Logger.error('ERROR: BOT_TOKEN is missing!');
    Logger.error('========================================');
    Logger.error('Please set BOT_TOKEN environment variable.');
    Logger.error('On Render: Go to Environment tab and add BOT_TOKEN');
    Logger.error('Locally: Create .env file with BOT_TOKEN=your_token_here');
    Logger.error('========================================');
    console.error('BOT_TOKEN environment variable is required but not set.');
    console.error('The bot cannot start without a valid Telegram bot token.');
    process.exit(1);
}

const bot = new Telegraf(token);

// Middleware for logging
bot.use(async (ctx, next) => {
    Logger.debug(`Update from ${ctx.from?.username || ctx.from?.id}: ${JSON.stringify(ctx.update)}`);
    return next();
});

// Commands
bot.start(startHandler);
bot.help(helpHandler);
bot.command('song', songHandler);

// Actions/Messages
bot.on('message', messageHandler);
bot.on('callback_query', callbackHandler);

// Global Error Handler
bot.catch((err: any, ctx) => {
    Logger.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
    
    // Try to provide a more helpful error message
    let errorMessage = 'Kutilmagan xatolik yuz berdi. Iltimos birozdan so\'ng urinib ko\'ring.';
    
    if (err.message) {
        // If it's already a user-friendly error, use it
        if (err.message.includes('Instagram') || 
            err.message.includes('yopiq') || 
            err.message.includes('topilmadi') ||
            err.message.includes('noto\'g\'ri')) {
            errorMessage = err.message;
        }
    }
    
    ctx.reply(errorMessage).catch(() => {
        // If even sending the error message fails, log it
        Logger.error('Failed to send error message to user', err);
    });
});

export default bot;
