import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const STORAGE_PROFILE_KEY = 'kapsa_user_profile_v1';

export const AVATAR_EMOJIS = ['😎', '🔥', '🦊', '🐱', '⚡', '🍕', '🚀', '🦄', '❤️', '🌟'];

interface AuthState {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  isInitialized: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  initializeAuth: () => Promise<void>;
  updateProfile: (displayName: string, avatarEmoji?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: 'demo-user-me',
  displayName: 'Ти',
  avatarEmoji: '😎',
  isInitialized: false,
  isLoading: true,
  isDemoMode: !isSupabaseConfigured,

  initializeAuth: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true });

    try {
      const savedProfileRaw = await AsyncStorage.getItem(STORAGE_PROFILE_KEY);
      let savedName = 'Ти';
      let savedEmoji = '😎';

      if (savedProfileRaw) {
        const parsed = JSON.parse(savedProfileRaw);
        if (parsed.displayName) savedName = parsed.displayName;
        if (parsed.avatarEmoji) savedEmoji = parsed.avatarEmoji;
      }

      if (isSupabaseConfigured) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          set({
            userId: session.user.id,
            displayName: savedName,
            avatarEmoji: savedEmoji,
            isInitialized: true,
            isLoading: false,
            isDemoMode: false,
          });
          return;
        }

        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (!anonError && anonData.user) {
          set({
            userId: anonData.user.id,
            displayName: savedName,
            avatarEmoji: savedEmoji,
            isInitialized: true,
            isLoading: false,
            isDemoMode: false,
          });
          return;
        }
      }

      // Fallback до локального демо-режиму, якщо Supabase ще не підключений
      set({
        userId: 'demo-user-me',
        displayName: savedName,
        avatarEmoji: savedEmoji,
        isInitialized: true,
        isLoading: false,
        isDemoMode: true,
      });
    } catch {
      set({
        userId: 'demo-user-me',
        isInitialized: true,
        isLoading: false,
        isDemoMode: true,
      });
    }
  },

  updateProfile: async (displayName: string, avatarEmoji?: string) => {
    const cleanName = displayName.trim() || get().displayName;
    const nextEmoji = avatarEmoji || get().avatarEmoji;

    set({ displayName: cleanName, avatarEmoji: nextEmoji });

    try {
      await AsyncStorage.setItem(
        STORAGE_PROFILE_KEY,
        JSON.stringify({ displayName: cleanName, avatarEmoji: nextEmoji })
      );
    } catch {
      // ignore storage errors
    }

    if (isSupabaseConfigured && get().userId !== 'demo-user-me') {
      try {
        await supabase
          .from('room_members')
          .update({ display_name: cleanName, avatar_emoji: nextEmoji })
          .eq('user_id', get().userId);
      } catch {
        // ignore network errors
      }
    }
  },
}));

