import { useState, useCallback, useRef } from 'react';
import { CapturedMedia, SendStatus } from '../types';
import { MediaService } from '../services/MediaService';
import { useSettingsStore } from '../store/settingsStore';

export function useMediaSend() {
  const [sendStatus, setSendStatus] = useState<SendStatus>({ state: 'idle' });
  const lastMedia = useRef<CapturedMedia | null>(null);
  const { destination } = useSettingsStore();

  const send = useCallback(
    async (media: CapturedMedia, caption?: string) => {
      if (!destination) {
        setSendStatus({ state: 'error', error: 'No destination configured. Go to Settings.' });
        return;
      }

      lastMedia.current = media;
      setSendStatus({ state: 'sending', progress: 0 });

      const result = await MediaService.send(
        media,
        destination,
        caption,
        (pct) => setSendStatus((prev) => ({ ...prev, progress: pct })),
      );

      if (result.success) {
        setSendStatus({ state: 'sent' });
      } else {
        setSendStatus({ state: 'error', error: result.error ?? 'Unknown error' });
      }
    },
    [destination],
  );

  const retry = useCallback(() => {
    if (lastMedia.current) send(lastMedia.current);
  }, [send]);

  const reset = useCallback(() => {
    setSendStatus({ state: 'idle' });
    lastMedia.current = null;
  }, []);

  return { sendStatus, send, retry, reset };
}
