import { jest } from '@jest/globals';

// Mock ffmpeg before importing service
jest.unstable_mockModule('fluent-ffmpeg', () => {
    const mockSave = jest.fn();
    const mockOn = jest.fn((event: string, cb: any) => {
        if (event === 'end') setTimeout(cb, 0);
        return { on: mockOn, save: mockSave };
    });
    const mockAudioBitrate = jest.fn().mockReturnThis();
    const mockAudioCodec = jest.fn().mockReturnThis();
    const mockAudioChannels = jest.fn().mockReturnThis();
    const mockAudioFrequency = jest.fn().mockReturnThis();
    const mockOutputOptions = jest.fn().mockReturnThis();
    const mockToFormat = jest.fn(() => ({
        audioBitrate: mockAudioBitrate,
        audioCodec: mockAudioCodec,
        audioChannels: mockAudioChannels,
        audioFrequency: mockAudioFrequency,
        outputOptions: mockOutputOptions,
        on: mockOn,
        save: mockSave
    }));
    const ffmpegMock = jest.fn(() => ({
        toFormat: mockToFormat,
        on: mockOn,
        save: mockSave
    }));
    return { default: ffmpegMock };
});

jest.unstable_mockModule('fs', () => {
    const mocks = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
    };
    return { ...mocks, default: mocks };
});

jest.unstable_mockModule('../src/utils/logger.js', () => {
    const LoggerMock = {
        info: jest.fn(),
        error: jest.fn()
    };
    return { Logger: LoggerMock, default: LoggerMock };
});

const { AudioService } = await import('../src/services/audio.service.js');

describe('AudioService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('extractAudio should resolve with mp3 path', async () => {
        const audioPath = await AudioService.extractAudio('/tmp/test.mp4');
        expect(audioPath).toContain('test.mp3');
    });
});
