import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { Stack, ThemeProvider, DefaultTheme } from 'expo-router';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';

const kapsaEditorialTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paperBg,
    card: colors.paperBg,
    text: colors.inkPrimary,
    border: colors.paperBorder,
  },
};

export default function KapsaRootLayout() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const fetchMyRooms = useRoomStore((s) => s.fetchMyRooms);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const existing = document.getElementById('kapsa-editorial-fonts');
      const href =
        'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,500;0,600;1,500&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap&subset=cyrillic,cyrillic-ext,latin';
      if (!existing) {
        const link = document.createElement('link');
        link.id = 'kapsa-editorial-fonts';
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      } else {
        (existing as HTMLLinkElement).href = href;
      }

      // Прибираємо стандартну чорну браузерну рамку фокуса (focus outline) при кліках
      const styleId = 'kapsa-clean-web-reset';
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          * {
            outline: none !important;
            -webkit-tap-highlight-color: transparent;
          }
          input, textarea, button {
            outline: none !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    }

    initializeAuth().then(() => {
      fetchMyRooms();
    });
  }, [initializeAuth, fetchMyRooms]);

  return (
    <ThemeProvider value={kapsaEditorialTheme}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.outerBackdrop}>
        <View style={styles.mobileShell}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paperBg },
            }}
          />
        </View>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  outerBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileShell: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    backgroundColor: colors.paperBg,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: colors.paperBorder,
    overflow: 'hidden',
  },
});
