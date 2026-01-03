import { jest } from '@jest/globals';

// Mock Downloader before importing service
jest.unstable_mockModule('../src/utils/downloader.js', () => {
    const DownloaderMock = {
        getInfo: jest.fn<() => Promise<any>>().mockResolvedValue({
            id: 'yt123',
            title: 'YT Test',
            uploader: 'Uploader',
            duration: 120
        }),
        download: jest.fn<() => Promise<any>>().mockResolvedValue('/tmp/yt.mp4')
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

const { YoutubeService } = await import('../src/services/youtube.service.js');
const { Downloader }: any = await import('../src/utils/downloader.js');

describe('YoutubeService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('handleLink should return music info', async () => {
        const result = await YoutubeService.handleLink('https://youtube.com/watch?v=yt123', false);
        expect(result.id).toBe('yt123');
        expect(result.filePath).toBe('/tmp/yt.mp4');
        expect(Downloader.getInfo).toHaveBeenCalled();
    });
});
