import { jest } from '@jest/globals';

describe('Index (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        delete process.env.BOT_TOKEN;
    });

    test('should have proper module structure', async () => {
        // Test that index.ts exists and can be analyzed
        const fs = await import('fs');
        const path = await import('path');
        
        const indexPath = path.join(process.cwd(), 'src', 'index.ts');
        expect(fs.existsSync(indexPath)).toBe(true);
    });

    test('should import modules without server start', async () => {
        // Test that modules can be imported without starting server
        process.env.BOT_TOKEN = 'test-token';
        
        const botModule = await import('../src/bot.js');
        expect(botModule.default).toBeDefined();
        
        const { Logger } = await import('../src/utils/logger.js');
        expect(Logger).toBeDefined();
        
        const { YoutubeService } = await import('../src/services/youtube.service.js');
        expect(YoutubeService).toBeDefined();
        
        const { InstagramService } = await import('../src/services/instagram.service.js');
        expect(InstagramService).toBeDefined();
    });
});
