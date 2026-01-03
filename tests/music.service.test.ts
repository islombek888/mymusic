import { jest } from '@jest/globals';

// Mock YoutubeService before importing MusicService
jest.unstable_mockModule('../src/services/youtube.service.ts', () => {
    const mock = {
        handleLink: jest.fn<() => Promise<any>>().mockResolvedValue({ id: '123', filePath: 'test.mp3' })
    };
    return { YoutubeService: mock, default: mock };
});

// Mock youtube-search-api
jest.unstable_mockModule('youtube-search-api', () => {
    const mock = {
        GetListByKeyword: jest.fn<() => Promise<any>>().mockResolvedValue({
            items: [{ id: '123', title: 'Test result', type: 'video' }]
        })
    };
    return { default: mock };
});

const { MusicService } = await import('../src/services/music.service.js');
const { YoutubeService }: any = await import('../src/services/youtube.service.js');

describe('MusicService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should route YouTube links to YoutubeService', async () => {
        const url = 'https://www.youtube.com/watch?v=123';
        await MusicService.processInput(url);
        expect(YoutubeService.handleLink).toHaveBeenCalled();
    });
});
