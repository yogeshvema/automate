import { Platform } from 'react-native';
import { CapturedMedia, SendResult, TelegramConfig } from '../../types';
import { MessageProvider } from '../MessageProvider';

const TELEGRAM_BASE = 'https://api.telegram.org';

export class TelegramProvider implements MessageProvider {
  private apiBase: string;

  constructor(private readonly config: TelegramConfig) {
    this.apiBase = `${TELEGRAM_BASE}/bot${config.botToken}`;
  }

  async sendPhoto(
    media: CapturedMedia,
    caption?: string,
    onProgress?: (pct: number) => void,
  ): Promise<SendResult> {
    try {
      onProgress?.(10);

      if (Platform.OS === 'web') {
        return this.sendWeb(media.uri, 'sendPhoto', 'photo', `photo_${Date.now()}.jpg`, caption, onProgress);
      }

      return this.sendNativeUpload(
        media.uri, 'sendPhoto', 'photo', 'image/jpeg', `photo_${Date.now()}.jpg`, caption, onProgress,
      );
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to send photo' };
    }
  }

  async sendVideo(
    media: CapturedMedia,
    caption?: string,
    onProgress?: (pct: number) => void,
  ): Promise<SendResult> {
    try {
      onProgress?.(5);

      if (Platform.OS === 'web') {
        const response = await fetch(media.uri);
        const blob = await response.blob();
        const isMp4 = blob.type.toLowerCase().includes('mp4');
        if (isMp4) {
          const res = await this.sendWeb(
            media.uri, 'sendVideo', 'video', `video_${Date.now()}.mp4`, caption, onProgress,
          );
          if (res.success) return res;
        }
        const ext = isMp4 ? 'mp4' : 'webm';
        return this.sendWeb(
          media.uri, 'sendDocument', 'document', `video_${Date.now()}.${ext}`, caption, onProgress,
        );
      }

      onProgress?.(15);
      const videoRes = await this.sendNativeUpload(
        media.uri, 'sendVideo', 'video', 'video/mp4', `video_${Date.now()}.mp4`, caption, onProgress,
      );
      if (videoRes.success) return videoRes;

      onProgress?.(50);
      return this.sendNativeUpload(
        media.uri, 'sendDocument', 'document', 'video/mp4', `video_doc_${Date.now()}.mp4`, caption, onProgress,
      );
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to send video' };
    }
  }

  private async sendNativeUpload(
    fileUri: string,
    endpoint: string,
    fieldName: string,
    mimeType: string,
    filename: string,
    caption?: string,
    onProgress?: (pct: number) => void,
  ): Promise<SendResult> {
    try {
      const FileSystem = require('expo-file-system/legacy');

      const info = await FileSystem.getInfoAsync(fileUri);
      console.log('[TelegramProvider] native upload file info:', JSON.stringify(info));
      if (!info.exists) {
        return { success: false, error: `File not found: ${fileUri}` };
      }

      onProgress?.(30);

      const params: Record<string, string> = { chat_id: this.config.chatId };
      if (caption) params.caption = caption;

      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      console.log('[TelegramProvider] uploadAsync →', endpoint, 'uploadType:', uploadType, 'uri:', fileUri);

      const result = await FileSystem.uploadAsync(
        `${this.apiBase}/${endpoint}`,
        fileUri,
        {
          httpMethod: 'POST',
          uploadType,
          fieldName,
          mimeType,
          parameters: params,
        },
      );

      onProgress?.(90);

      console.log('[TelegramProvider] uploadAsync status:', result.status, 'body:', result.body?.substring(0, 200));

      const data = JSON.parse(result.body);
      if (!data.ok) {
        return { success: false, error: data.description ?? 'Telegram API error' };
      }

      onProgress?.(100);
      return { success: true, messageId: data.result?.message_id };
    } catch (err: any) {
      console.error('[TelegramProvider] sendNativeUpload error:', err);
      return { success: false, error: err?.message ?? 'Failed to upload file' };
    }
  }

  private async sendWeb(
    uri: string,
    endpoint: string,
    fieldName: string,
    filename: string,
    caption?: string,
    onProgress?: (pct: number) => void,
  ): Promise<SendResult> {
    try {
      let blob: Blob;
      if (uri.startsWith('data:')) {
        const [header, b64] = uri.split(',');
        const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        blob = new Blob([bytes], { type: mime });
      } else {
        const response = await fetch(uri);
        blob = await response.blob();
      }

      onProgress?.(50);

      const formData = new FormData();
      formData.append('chat_id', this.config.chatId);
      if (caption) formData.append('caption', caption);
      formData.append(fieldName, blob, filename);

      const res = await fetch(`${this.apiBase}/${endpoint}`, { method: 'POST', body: formData });
      onProgress?.(90);

      const data = await res.json();
      if (!data.ok) {
        return { success: false, error: data.description ?? 'Telegram API error' };
      }

      onProgress?.(100);
      return { success: true, messageId: data.result?.message_id };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to upload on web' };
    }
  }

  async testConnection(): Promise<boolean> {
    const res = await this.testConnectionDetailed();
    return res.ok;
  }

  async testConnectionDetailed(): Promise<{ ok: boolean; message: string; chatTitle?: string }> {
    try {
      const botRes = await fetch(`${this.apiBase}/getMe`);
      const botData = await botRes.json();
      if (!botData.ok) {
        return { ok: false, message: `Bot token invalid: ${botData.description || 'unauthorized'}` };
      }
      const botName = botData.result?.username ? `@${botData.result.username}` : 'Bot';

      if (!this.config.chatId) {
        return { ok: false, message: `Bot ${botName} connected, but Chat ID is empty.` };
      }

      const chatRes = await fetch(
        `${this.apiBase}/getChat?chat_id=${encodeURIComponent(this.config.chatId)}`,
      );
      const chatData = await chatRes.json();
      if (!chatData.ok) {
        const desc = chatData.description || 'Chat not found';
        const hint = desc.toLowerCase().includes('chat not found')
          ? ' (For groups use the minus sign e.g. -5383662969 and ensure the bot is a group member.)'
          : '';
        return { ok: false, message: `${botName} is active, but Chat ID failed: ${desc}${hint}` };
      }

      const chatTitle =
        chatData.result?.title || chatData.result?.username || chatData.result?.first_name || 'Chat';

      return { ok: true, message: `✓ Connected! ${botName} → "${chatTitle}"`, chatTitle };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Connection failed' };
    }
  }
}
