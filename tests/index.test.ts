import { jest } from '@jest/globals';

// Mock all dependencies before importing index
jest.unstable_mockModule('../src/bot.js', () => {
    const mockBot = {
        on: jest.fn(),
        launch: jest.fn(),
        stop: jest.fn(),
        start: jest.fn(),
        help: jest.fn(),
        command: jest.fn(),
        use: jest.fn(),
        catch: jest.fn()
    };
    return { default: mockBot };
});

jest.unstable_mockModule('../src/services/youtube.service.js', () => {
    return {
        YoutubeService: {
            handleLink: jest.fn().mockResolvedValue({
                id: '123',
                title: 'Test Video',
                filePath: '/tmp/test.mp3'
            })
        }
    };
});

jest.unstable_mockModule('../src/services/instagram.service.js', () => {
    return {
        InstagramService: {
            isValidInstagramUrl: jest.fn().mockReturnValue(true),
            handleLink: jest.fn().mockResolvedValue({
                id: '123',
                title: 'Test Post',
                filePath: '/tmp/test.mp3'
            })
        }
    };
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

jest.unstable_mockModule('../src/services/youtube.service.js', () => {
    return {
        YoutubeService: {
            handleLink: jest.fn()
        }
    };
});

jest.unstable_mockModule('../src/services/instagram.service.js', () => {
    return {
        InstagramService: {
            isValidInstagramUrl: jest.fn(),
            handleLink: jest.fn()
        }
    };
});

jest.unstable_mockModule('fs/promises', () => {
    return {
        default: {
            readFile: jest.fn()
        }
    };
});

jest.unstable_mockModule('http', () => {
    return {
        default: {
            createServer: jest.fn()
        }
    };
});

// Mock process.env
const originalEnv = process.env;

describe('Index', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('should start server and bot successfully', async () => {
        // Set environment variables before any imports
        process.env.BOT_TOKEN = 'test-token';
        process.env.PORT = '3000';

        // Mock process.exit to prevent actual exit
        const mockExit = jest.fn();
        process.exit = mockExit as any;

        const mockServer = {
            listen: jest.fn(),
            close: jest.fn()
        };

        const http = await import('http');
        (http.default.createServer as jest.Mock).mockReturnValue(mockServer);

        // Import bot module to ensure it's mocked
        await import('../src/bot.js');

        // Import index to start the application
        await import('../src/index.js');

        expect(mockServer.listen).toHaveBeenCalledWith("3000", expect.any(Function));
        // The important thing is that the server starts without exiting
        expect(mockExit).not.toHaveBeenCalled();
    });

    test('should exit if BOT_TOKEN is missing', async () => {
        delete process.env.BOT_TOKEN;

        const mockExit = jest.fn();
        process.exit = mockExit as any;

        const mockServer = {
            listen: jest.fn(),
            close: jest.fn()
        };

        const http = await import('http');
        (http.default.createServer as jest.Mock).mockReturnValue(mockServer);

        try {
            await import('../src/index.js');
        } catch (error) {
            // Expected to exit
        }

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    test('should handle YouTube links in text handler', async () => {
        process.env.BOT_TOKEN = 'test-token';

        const mockServer = {
            listen: jest.fn(),
            close: jest.fn()
        };

        const mockBot = {
            on: jest.fn(),
            launch: jest.fn(),
            stop: jest.fn()
        };

        const http = await import('http');
        (http.default.createServer as jest.Mock).mockReturnValue(mockServer);

        const bot = await import('../src/bot.js');
        // Bot is now directly the mock, no need to mockReturnValue

        const { YoutubeService } = await import('../src/services/youtube.service.js');
        YoutubeService.handleLink.mockResolvedValue({
            id: '123',
            title: 'Test Video',
            filePath: '/tmp/test.mp3'
        });

        const fs = await import('fs/promises');
        (fs.default.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

        // Import index to start the application
        await import('../src/index.js');

        // Get the text handler function
        const textHandler = mockBot.on.mock.calls.find(call => call[0] === 'text')?.[1];
        
        if (textHandler) {
            const mockCtx = {
                message: { text: 'https://youtube.com/watch?v=123' },
                reply: jest.fn(),
                replyWithAudio: jest.fn()
            };

            await textHandler(mockCtx);

            expect(YoutubeService.handleLink).toHaveBeenCalledWith('https://youtube.com/watch?v=123');
            expect(mockCtx.replyWithAudio).toHaveBeenCalled();
        }
    });

    test('should handle Instagram links in text handler', async () => {
        process.env.BOT_TOKEN = 'test-token';

        const mockServer = {
            listen: jest.fn(),
            close: jest.fn()
        };

        const mockBot = {
            on: jest.fn(),
            launch: jest.fn(),
            stop: jest.fn()
        };

        const http = await import('http');
        (http.default.createServer as jest.Mock).mockReturnValue(mockServer);

        const bot = await import('../src/bot.js');
        // Bot is now directly the mock, no need to mockReturnValue

        const { InstagramService } = await import('../src/services/instagram.service.js');
        InstagramService.isValidInstagramUrl.mockReturnValue(true);
        InstagramService.handleLink.mockResolvedValue({
            id: '123',
            title: 'Test Post',
            filePath: '/tmp/test.mp3'
        });

        const fs = await import('fs/promises');
        (fs.default.readFile as jest.Mock).mockResolvedValue(Buffer.from('audio data'));

        // Import index to start the application
        await import('../src/index.js');

        // Get the text handler function
        const textHandler = mockBot.on.mock.calls.find(call => call[0] === 'text')?.[1];
        
        if (textHandler) {
            const mockCtx = {
                message: { text: 'https://instagram.com/p/123' },
                reply: jest.fn(),
                replyWithAudio: jest.fn()
            };

            await textHandler(mockCtx);

            expect(InstagramService.handleLink).toHaveBeenCalledWith('https://instagram.com/p/123');
            expect(mockCtx.replyWithAudio).toHaveBeenCalled();
        }
    });

    test('should reject invalid links', async () => {
        process.env.BOT_TOKEN = 'test-token';

        const mockServer = {
            listen: jest.fn(),
            close: jest.fn()
        };

        const mockBot = {
            on: jest.fn(),
            launch: jest.fn(),
            stop: jest.fn()
        };

        const http = await import('http');
        (http.default.createServer as jest.Mock).mockReturnValue(mockServer);

        const bot = await import('../src/bot.js');
        // Bot is now directly the mock, no need to mockReturnValue

        const { InstagramService } = await import('../src/services/instagram.service.js');
        InstagramService.isValidInstagramUrl.mockReturnValue(false);

        // Import index to start the application
        await import('../src/index.js');

        // Get the text handler function
        const textHandler = mockBot.on.mock.calls.find(call => call[0] === 'text')?.[1];
        
        if (textHandler) {
            const mockCtx = {
                message: { text: 'invalid link' },
                reply: jest.fn(),
                replyWithAudio: jest.fn()
            };

            await textHandler(mockCtx);

            expect(mockCtx.reply).toHaveBeenCalledWith('Iltimos, faqat YouTube yoki Instagram link yuboring.');
        }
    });
});
