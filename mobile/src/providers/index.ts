import { Destination } from '../types';
import { MessageProvider } from './MessageProvider';
import { TelegramProvider } from './telegram/TelegramProvider';

/**
 * Provider registry — returns the correct provider for a destination.
 * Add new providers here; nothing else needs to change.
 */
export function getProvider(destination: Destination): MessageProvider {
  switch (destination.providerType) {
    case 'telegram':
      return new TelegramProvider(destination.config);
    default:
      throw new Error(`Unknown provider type: ${destination.providerType}`);
  }
}
