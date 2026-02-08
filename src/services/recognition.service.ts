import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { Logger } from '../utils/logger.js';

export interface RecognitionResult {
    artist: string;
    title: string;
    album?: string;
    release_date?: string;
    label?: string;
    score: number;
}

export class RecognitionService {
    private static readonly AUDD_API_URL = 'https://api.audd.io/';
    private static readonly API_TOKEN = process.env.AUDD_API_TOKEN;

    /**
     * Identify a song from a local file path
     */
    static async identify(filePath: string): Promise<RecognitionResult | null> {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('File not found for identification');
            }

            Logger.info(`🔍 Identifying audio snippet: ${filePath}`);

            const form = new FormData();
            form.append('file', fs.createReadStream(filePath));
            if (this.API_TOKEN) {
                form.append('api_token', this.API_TOKEN);
            }
            form.append('return', 'timecode,apple_music,spotify');

            const response = await axios.post(this.AUDD_API_URL, form, {
                headers: {
                    ...form.getHeaders(),
                },
                timeout: 15000
            });

            if (response.data.status === 'success' && response.data.result) {
                const res = response.data.result;
                Logger.info(`✅ Song identified: ${res.artist} - ${res.title} (Score: ${response.data.result.score || 'N/A'})`);
                return {
                    artist: res.artist,
                    title: res.title,
                    album: res.album,
                    release_date: res.release_date,
                    label: res.label,
                    score: res.score || 0
                };
            }

            Logger.warn('😔 Song identification failed: No match found');
            return null;
        } catch (error: any) {
            Logger.error('Error in RecognitionService.identify', {
                message: error.message,
                response: error.response?.data
            });
            return null;
        }
    }

    /**
     * Identify a song from a Buffer
     */
    static async identifyFromBuffer(buffer: Buffer): Promise<RecognitionResult | null> {
        try {
            Logger.info('🔍 Identifying audio snippet from buffer');

            const form = new FormData();
            form.append('file', buffer, { filename: 'snippet.mp3' });
            if (this.API_TOKEN) {
                form.append('api_token', this.API_TOKEN);
            }

            const response = await axios.post(this.AUDD_API_URL, form, {
                headers: {
                    ...form.getHeaders(),
                },
                timeout: 10000
            });

            if (response.data.status === 'success' && response.data.result) {
                const res = response.data.result;
                return {
                    artist: res.artist,
                    title: res.title,
                    score: res.score || 0
                };
            }

            return null;
        } catch (error) {
            Logger.error('Error in RecognitionService.identifyFromBuffer', error);
            return null;
        }
    }
}
