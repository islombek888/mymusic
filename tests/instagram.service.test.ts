import { jest } from '@jest/globals';

// Mock Downloader before importing service
jest.unstable_mockModule('../src/utils/downloader.js', () => {
    const DownloaderMock = {
        getInfo: jest.fn<() => Promise<any>>().mockResolvedValue({
            id: '123',
            title: 'Insta Test',
            uploader: 'User',
            duration: 15
        }),
        download: jest.fn<() => Promise<any>>().mockResolvedValue('/tmp/insta.mp4')
    };
    return { Downloader: DownloaderMock, default: DownloaderMock };
});

jest.unstable_mockModule('../src/utils/logger.js', () => {
    const LoggerMock = {
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    };
    return { Logger: LoggerMock, default: LoggerMock };
});

const { InstagramService } = await import('../src/services/instagram.service.js');
const { Downloader }: any = await import('../src/utils/downloader.js');

describe('InstagramService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('handleLink should return video info', async () => {
        const result = await InstagramService.handleLink('https://instagram.com/reel/123');
        expect(result.title).toBe('Insta Test');
        expect(result.filePath).toBe('/tmp/insta.mp4');
        expect(Downloader.getInfo).toHaveBeenCalled();
    });
});
