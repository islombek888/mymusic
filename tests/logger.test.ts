import { jest } from '@jest/globals';

describe('Logger (Unit)', () => {
    test('should have all required methods', async () => {
        const { Logger } = await import('../src/utils/logger.js');
        
        expect(typeof Logger.info).toBe('function');
        expect(typeof Logger.error).toBe('function');
        expect(typeof Logger.warn).toBe('function');
        expect(typeof Logger.debug).toBe('function');
    });

    test('should handle different message types', async () => {
        const { Logger } = await import('../src/utils/logger.js');
        
        expect(() => Logger.info('string message')).not.toThrow();
        expect(() => Logger.info('string message', { data: 'object' })).not.toThrow();
        expect(() => Logger.info('string message', null)).not.toThrow();
        expect(() => Logger.info('string message', undefined)).not.toThrow();
    });
});
