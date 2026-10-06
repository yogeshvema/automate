import { Platform } from 'react-native';
import { CapturedMedia, Destination, SendResult } from '../types';
import { getProvider } from '../providers';

export class MediaService {
  static async send(
    media: CapturedMedia,
    destination: Destination,
    caption?: string,
    onProgress?: (pct: number) => void,
  ): Promise<SendResult> {
    const provider = getProvider(destination);

    const result =
      media.type === 'photo'
        ? await provider.sendPhoto(media, caption, onProgress)
        : await provider.sendVideo(media, caption, onProgress);

    if (result.success && Platform.OS !== 'web') {
      try {
        const FileSystem = require('expo-file-system/legacy');
        if (FileSystem?.deleteAsync) {
          await FileSystem.deleteAsync(media.uri, { idempotent: true });
        }
      } catch (e) {
        console.warn('[MediaService] cleanup failed:', e);
      }
    }

    return result;
  }
}
