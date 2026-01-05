import { jest } from '@jest/globals';

// Mock all services before importing handlers
jest.unstable_mockModule('../src/services/music.service.js', () => {
    return {
        MusicService: {
            searchMusic: jest.fn(),
            getVideoInfo: jest.fn()
        }
    };
});

jest.unstable_mockModule('../src/services/youtube.service.js', () => {
    return {
        YoutubeService: {
            handleLink: jest.fn(),
            extractMultipleSongs: jest.fn()
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

jest.unstable_mockModule('../src/services/audio.service.js', () => {
    return {
        AudioService: {
            extractAudio: jest.fn()
        }
    };
});

jest.unstable_mockModule('../src/services/video-songs.service.js', () => {
    return {
        VideoSongsService: {
            extractSongsFromVideo: jest.fn()
        }
    };
});

jest.unstable_mockModule('../src/utils/downloader.js', () => {
    return {
        Downloader: {
            getInfo: jest.fn(),
            download: jest.fn()
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

jest.unstable_mockModule('fs', () => {
    return {
        default: {
            existsSync: jest.fn(),
            mkdirSync: jest.fn(),
            unlinkSync: jest.fn()
        }
    };
});

jest.unstable_mockModule('axios', () => {
    return {
        default: {
            get: jest.fn()
        }
    };
});

describe('Handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should import handlers module', async () => {
        const handlers = await import('../src/handlers.js');
        expect(handlers).toBeDefined();
        expect(typeof handlers.startHandler).toBe('function');
        expect(typeof handlers.helpHandler).toBe('function');
        expect(typeof handlers.songHandler).toBe('function');
        expect(typeof handlers.messageHandler).toBe('function');
        expect(typeof handlers.callbackHandler).toBe('function');
    });

    test('startHandler should be defined', async () => {
        const handlers = await import('../src/handlers.js');
        expect(handlers.startHandler).toBeDefined();
    });

    test('helpHandler should be defined', async () => {
        const handlers = await import('../src/handlers.js');
        expect(handlers.helpHandler).toBeDefined();
    });

    test('messageHandler should be defined', async () => {
        const handlers = await import('../src/handlers.js');
        expect(handlers.messageHandler).toBeDefined();
    });

    test('callbackHandler should be defined', async () => {
        const handlers = await import('../src/handlers.js');
        expect(handlers.callbackHandler).toBeDefined();
    });

    test('songHandler should be defined', async () => {
        const handlers = await import('../src/handlers.js');
        expect(handlers.songHandler).toBeDefined();
    });
});
