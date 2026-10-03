import { CapturedMedia, SendResult } from '../types';

/**
 * Common interface every messaging provider must implement.
 * The Camera and MediaService NEVER import provider-specific code.
 */
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

  /** Returns true if credentials are valid and service is reachable. */
  testConnection(): Promise<boolean>;
}
