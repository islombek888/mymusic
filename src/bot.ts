import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { startHandler, helpHandler, songHandler, messageHandler, callbackHandler } from './handlers.js';
import { Logger } from './utils/logger.js';

dotenv.config();

const token = process.env.BOT_TOKEN;

if (!token) {
    Logger.error('BOT_TOKEN is missing in .env file');
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
    ctx.reply('Kutilmagan xatolik yuz berdi. Iltimos birozdan so\'ng urinib ko\'ring.');
});

export default bot;
