import ffmpeg from 'fluent-ffmpeg';
import { Logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

export class AudioService {
    static async extractAudio(inputPath: string): Promise<string> {
        const outputDir = path.join(process.cwd(), 'downloads', 'extracted');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFileName = `${path.basename(inputPath, path.extname(inputPath))}.mp3`;
        const outputPath = path.join(outputDir, outputFileName);

        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('mp3')
                .audioBitrate(128)
                .audioCodec('libmp3lame')
                .audioChannels(2)
                .audioFrequency(44100)
                .outputOptions([
                    '-preset fast',
                    '-threads 2'
                ])
                .on('end', () => {
                    Logger.info(`Audio extracted to ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    Logger.error('FFmpeg error', err);
                    reject(err);
                })
                .save(outputPath);
        });
    }

    // Simplified song detection inside video (shazam-like detection would be ideal)
    // For now, let's just extract the whole audio. 
    // Advanced detection could use 'auditok' or similar libraries if they were available.
}
