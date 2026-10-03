// ─── Provider ────────────────────────────────────────────────────────────────
export type ProviderType = 'telegram';

// ─── Media ───────────────────────────────────────────────────────────────────
export type MediaType = 'photo' | 'video';

export interface CapturedMedia {
  uri: string;
  type: MediaType;
  width?: number;
  height?: number;
  duration?: number; // seconds (video only)
}

// ─── Provider config ──────────────────────────────────────────────────────────
export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

// ─── Destination ──────────────────────────────────────────────────────────────
export interface Destination {
  id: string;
  name: string;
  providerType: ProviderType;
  config: TelegramConfig;
  isDefault: boolean;
}

// ─── Send result ──────────────────────────────────────────────────────────────
export interface SendResult {
  success: boolean;
  messageId?: string | number;
  error?: string;
}

// ─── Send status (UI state machine) ──────────────────────────────────────────
export type SendState = 'idle' | 'capturing' | 'sending' | 'sent' | 'error';

export interface SendStatus {
  state: SendState;
  progress?: number; // 0–100
  error?: string;
}
