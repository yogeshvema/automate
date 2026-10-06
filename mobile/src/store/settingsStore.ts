import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Destination } from '../types';

const STORAGE_KEY = 'snapsend_destination_v1';
const AUTOSEND_KEY = 'snapsend_autosend_v1';

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    try {
      const SecureStore = require('expo-secure-store');
      const val = await SecureStore.getItemAsync(key);
      if (val !== null) return val;
    } catch (e) {
      console.warn('[settingsStore] SecureStore getItem failed, falling back to AsyncStorage:', e);
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') localStorage.setItem(key, value);
      } catch (e) {
        console.warn('localStorage setItem failed:', e);
      }
      return;
    }
    try {
      const SecureStore = require('expo-secure-store');
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (e) {
      console.warn('[settingsStore] SecureStore setItem failed, falling back to AsyncStorage:', e);
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error('[settingsStore] AsyncStorage setItem failed:', e);
    }
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') localStorage.removeItem(key);
      } catch (e) {
        console.warn('localStorage removeItem failed:', e);
      }
      return;
    }
    try {
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('[settingsStore] SecureStore deleteItem failed:', e);
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

interface SettingsState {
  destination: Destination | null;
  autoSendEnabled: boolean;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setDestination: (d: Destination) => Promise<void>;
  clearDestination: () => Promise<void>;
  setAutoSendEnabled: (enabled: boolean) => Promise<void>;
  toggleAutoSend: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  destination: null,
  autoSendEnabled: true,
  isLoading: true,

  loadSettings: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      const destination = raw ? (JSON.parse(raw) as Destination) : null;
      const rawAutoSend = await storage.getItem(AUTOSEND_KEY);
      const autoSendEnabled = rawAutoSend !== null ? rawAutoSend === 'true' : true;
      set({ destination, autoSendEnabled, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setDestination: async (destination) => {
    await storage.setItem(STORAGE_KEY, JSON.stringify(destination));
    set({ destination });
  },

  clearDestination: async () => {
    await storage.deleteItem(STORAGE_KEY);
    set({ destination: null });
  },

  setAutoSendEnabled: async (enabled: boolean) => {
    await storage.setItem(AUTOSEND_KEY, String(enabled));
    set({ autoSendEnabled: enabled });
  },

  toggleAutoSend: async () => {
    const next = !get().autoSendEnabled;
    await storage.setItem(AUTOSEND_KEY, String(next));
    set({ autoSendEnabled: next });
  },
}));
