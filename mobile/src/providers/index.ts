import { Destination } from '../types';
import { MessageProvider } from './MessageProvider';
import { TelegramProvider } from './telegram/TelegramProvider';

export function getProvider(destination: Destination): MessageProvider {
  switch (destination.providerType) {
    case 'telegram':
      return new TelegramProvider(destination.config);
    default:
      throw new Error(`Unknown provider type: ${destination.providerType}`);
  }
}
