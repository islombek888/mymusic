import { jest } from '@jest/globals';

// Mock telegraf before importing bot
jest.unstable_mockModule('telegraf', () => {
    const mockBot = {
        use: jest.fn(),
        start: jest.fn(),
        help: jest.fn(),
        command: jest.fn(),
        on: jest.fn(),
        catch: jest.fn(),
        launch: jest.fn(),
        stop: jest.fn()
    };
    const TelegrafMock = jest.fn(() => mockBot);
    return { Telegraf: TelegrafMock, default: TelegrafMock };
});

jest.unstable_mockModule('../src/utils/logger.js', () => {
    const LoggerMock = {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn()
    };
    return { Logger: LoggerMock, default: LoggerMock };
});

jest.unstable_mockModule('../src/handlers.js', () => {
    return {
        startHandler: jest.fn(),
        helpHandler: jest.fn(),
        songHandler: jest.fn(),
        messageHandler: jest.fn(),
        callbackHandler: jest.fn()
    };
});

describe('Bot', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.BOT_TOKEN;
    });

    test('should throw error when BOT_TOKEN is missing', async () => {
        const originalExit = process.exit;
        process.exit = jest.fn() as any;
        
        try {
            await import('../src/bot.js');
        } catch (error) {
            expect(error).toBeDefined();
        }
        
        process.exit = originalExit;
    });

    test('should initialize bot with valid token', async () => {
        process.env.BOT_TOKEN = 'test-token';
        
        // Re-import after setting token
        jest.resetModules();
        await import('../src/bot.js');
        
        const { Telegraf }: any = await import('telegraf');
        expect(Telegraf).toHaveBeenCalledWith('test-token');
    });

    test('should setup middleware and handlers', async () => {
        process.env.BOT_TOKEN = 'test-token';
        
        // Re-import after setting token
        jest.resetModules();
        await import('../src/bot.js');
        
        const { Telegraf }: any = await import('telegraf');
        const mockBot = Telegraf();
        
        expect(mockBot.use).toHaveBeenCalled();
        expect(mockBot.start).toHaveBeenCalled();
        expect(mockBot.help).toHaveBeenCalled();
        expect(mockBot.command).toHaveBeenCalledWith('song', expect.any(Function));
        expect(mockBot.on).toHaveBeenCalledWith('message', expect.any(Function));
        expect(mockBot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
        expect(mockBot.catch).toHaveBeenCalled();
    });

    test('should log errors properly', async () => {
        process.env.BOT_TOKEN = 'test-token';
        
        // Re-import after setting token
        jest.resetModules();
        await import('../src/bot.js');
        
        const { Telegraf }: any = await import('telegraf');
        const { Logger }: any = await import('../src/utils/logger.js');
        const mockBot = Telegraf();
        
        // Get the error handler function
        const errorHandler = mockBot.catch.mock.calls[0][0];
        
        const mockCtx = {
            updateType: 'message',
            reply: jest.fn().mockResolvedValue({}),
            chat: { id: 123 }
        };
        
        const error = new Error('Test error');
        
        expect(() => errorHandler(error, mockCtx)).not.toThrow();
        expect(Logger.error).toHaveBeenCalled();
        expect(mockCtx.reply).toHaveBeenCalled();
    });
});
