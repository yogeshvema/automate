export type ProviderType = 'telegram';

export type MediaType = 'photo' | 'video';

export interface CapturedMedia {
  uri: string;
  type: MediaType;
  width?: number;
  height?: number;
  duration?: number;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface Destination {
  id: string;
  name: string;
  providerType: ProviderType;
  config: TelegramConfig;
  isDefault: boolean;
}

export interface SendResult {
  success: boolean;
  messageId?: string | number;
  error?: string;
}

export type SendState = 'idle' | 'capturing' | 'sending' | 'sent' | 'error';

export interface SendStatus {
  state: SendState;
  progress?: number;
  error?: string;
}
