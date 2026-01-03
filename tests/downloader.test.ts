import { jest } from '@jest/globals';

// ESM-native mocking with default and named exports
jest.unstable_mockModule('child_process', () => {
    const mocks = {
        exec: jest.fn(),
        spawn: jest.fn()
    };
    return { ...mocks, default: mocks };
});

jest.unstable_mockModule('fs', () => {
    const mocks = {
        readdirSync: jest.fn(),
        statSync: jest.fn(),
        existsSync: jest.fn(),
        mkdirSync: jest.fn()
    };
    return { ...mocks, default: mocks };
});

// Dynamic imports are required so mocks are established before code is loaded
const { Downloader } = await import('../src/utils/downloader.js');
const cp: any = await import('child_process');
const fs: any = await import('fs');

describe('Downloader', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getInfo should return video info', async () => {
        // cp is the namespace/default object now
        const mockExec = cp.exec || cp.default.exec;
        mockExec.mockImplementation((cmd: any, cb: any): any => {
            if (typeof cb === 'function') {
                cb(null, { stdout: JSON.stringify({ id: '123', title: 'Test' }), stderr: '' });
            }
            return {} as any;
        });

        const info = await Downloader.getInfo('https://youtube.com/watch?v=123');
        expect(info.id).toBe('123');
    });

    test('download should resolve with file path', async () => {
        const mockOn = jest.fn((event: string, cb: any) => {
            if (event === 'close') cb(0);
            return { on: mockOn } as any;
        });

        const mockStdoutOn = jest.fn((event: string, cb: any) => {
            if (event === 'data') cb(Buffer.from('/tmp/test.mp3\n'));
            return { on: mockStdoutOn } as any;
        });

        const mockChild = {
            stdout: { on: mockStdoutOn },
            stderr: { on: jest.fn().mockReturnValue({ on: jest.fn() }) },
            on: mockOn
        } as any;

        const mockSpawn = cp.spawn || cp.default.spawn;
        mockSpawn.mockReturnValue(mockChild);

        const mockReaddir = fs.readdirSync || fs.default.readdirSync;
        const mockStat = fs.statSync || fs.default.statSync;
        const mockExists = fs.existsSync || fs.default.existsSync;

        mockReaddir.mockReturnValue(['test.mp3']);
        mockStat.mockReturnValue({ mtime: { getTime: () => 123 }, size: 1024 });
        mockExists.mockReturnValue(true);

        const filePath = await Downloader.download('https://youtube.com/watch?v=123', {
            outputDir: '/tmp',
            audioOnly: true
        });

        expect(filePath).toContain('test.mp3');
    });
});
