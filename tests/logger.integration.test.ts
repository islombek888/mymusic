import { jest } from '@jest/globals';

describe('Logger (Integration)', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should call console methods with correct format', async () => {
        const message = 'Test message';
        const data = { key: 'value' };
        
        // Import actual logger without mocking
        const { Logger } = await import('../src/utils/logger.js');
        
        Logger.info(message, data);
        
        expect(console.log).toHaveBeenCalledWith(
            expect.stringMatching(/\[INFO\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Test message/),
            data
        );
    });

    test('should call console.error for error messages', async () => {
        const message = 'Test error';
        const error = new Error('Test error details');
        
        const { Logger } = await import('../src/utils/logger.js');
        
        Logger.error(message, error);
        
        expect(console.error).toHaveBeenCalledWith(
            expect.stringMatching(/\[ERROR\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Test error/),
            error
        );
    });

    test('should call console.warn for warning messages', async () => {
        const message = 'Test warning';
        
        const { Logger } = await import('../src/utils/logger.js');
        
        Logger.warn(message);
        
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringMatching(/\[WARN\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Test warning/),
            ''
        );
    });

    test('should call console.debug for debug messages when DEBUG=true', async () => {
        const originalDebug = process.env.DEBUG;
        process.env.DEBUG = 'true';
        
        const message = 'Test debug';
        
        const { Logger } = await import('../src/utils/logger.js');
        
        Logger.debug(message);
        
        expect(console.log).toHaveBeenCalledWith(
            expect.stringMatching(/\[DEBUG\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Test debug/),
            ''
        );
        
        process.env.DEBUG = originalDebug;
    });

    test('should not call console.debug when DEBUG is not set', async () => {
        const originalDebug = process.env.DEBUG;
        delete process.env.DEBUG;
        
        const message = 'Test debug';
        
        const { Logger } = await import('../src/utils/logger.js');
        
        Logger.debug(message);
        
        expect(console.log).not.toHaveBeenCalled();
        
        process.env.DEBUG = originalDebug;
    });
});
