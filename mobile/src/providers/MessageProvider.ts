import { CapturedMedia, SendResult } from '../types';

export interface MessageProvider {
  sendPhoto(
    media: CapturedMedia,
    caption?: string,
    onProgress?: (pct: number) => void,
  ): Promise<SendResult>;

  sendVideo(
    media: CapturedMedia,
    caption?: string,
    onProgress?: (pct: number) => void,
  ): Promise<SendResult>;

  testConnection(): Promise<boolean>;
}
