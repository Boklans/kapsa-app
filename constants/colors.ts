import { Platform } from 'react-native';
import { DeckTag } from '@/types/kapsa';

export const fonts = {
  // Playfair Display та Lora мають 100% підтримку української кирилиці,
  // тому український і англійський текст рендеряться одним і тим самим журнальним шрифтом
  serif: Platform.select({
    web: '"Playfair Display", "Lora", Georgia, serif',
    ios: 'Georgia',
    default: 'serif',
  }),
  handwritten: Platform.select({
    web: '"Caveat", "Marck Script", cursive',
    ios: 'Snell Roundhand',
    default: 'serif',
  }),
  sans: Platform.select({
    web: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    default: undefined,
  }),
};

// Куровані портретні фото-аватари в теплій палітрі Golden Hour (як на шаблоні)
export const PORTRAIT_AVATARS: Record<string, string> = {
  '😎': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&q=80', // Катерина
  '🦊': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&q=80', // Макс (хлопець із теплою усмішкою)
  '🔥': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&q=80', // Діма
  '🐱': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&q=80', // Оля
  '⚡': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&q=80', // Артем
  '🍕': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&q=80',
  '🚀': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=240&q=80',
  '🦄': 'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=240&q=80',
  '❤️': 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=240&q=80',
  '🌟': 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=240&q=80',
};

export const getAvatarPhotoUri = (emojiOrKey?: string, fallbackIdx = 0): string => {
  // Якщо користувач завантажив власне фото в профілі (data:image/... або https://...)
  if (
    emojiOrKey &&
    (emojiOrKey.startsWith('http') || emojiOrKey.startsWith('data:image'))
  ) {
    return emojiOrKey;
  }
  const values = Object.values(PORTRAIT_AVATARS);
  // Якщо у кількох учасників кімнати стоїть дефолтний '😎', використовуємо їхній індекс у кімнаті, щоб не було клонів
  if (emojiOrKey === '😎' && fallbackIdx > 0) {
    return values[fallbackIdx % values.length];
  }
  if (emojiOrKey && PORTRAIT_AVATARS[emojiOrKey]) {
    return PORTRAIT_AVATARS[emojiOrKey];
  }
  return values[fallbackIdx % values.length];
};

export const colors = {
  // Brand Kit з Google Stitch & Warm Editorial Palette
  backdrop: '#E5DEC9',          // Теплий пісочний фон навколо мобільного фрейму на Web
  paperBg: '#FBF9F6',           // Surface / Background з Google Stitch (#FBF9F6)
  paperSurface: '#FFFFFF',      // Білі картки та Polaroid (#FFFFFF)
  paperElevated: '#EFEEEB',     // Surface Container (#EFEEEB)
  paperContainerLow: '#F5F3F0', // Surface Container Low (#F5F3F0)
  paperContainerHigh: '#EAE8E5',// Surface Container High (#EAE8E5)
  paperContainerHighest: '#E4E2DF', // Surface Container Highest (#E4E2DF)
  paperBorder: '#CCC5BD',       // Outline Variant з Google Stitch (#CCC5BD)
  taupe: '#7C766F',             // Outline з Google Stitch (#7C766F)
  inkPrimary: '#1B1C1A',        // On Surface з Google Stitch (#1B1C1A)
  inkSecondary: '#4A4640',      // On Surface Variant з Google Stitch (#4A4640)
  inkMuted: '#7C766F',          // Muted text (#7C766F)
  coralAccent: '#AB3425',       // Secondary / Terracotta Wax Seal з Google Stitch (#AB3425)
  terracotta: '#AB3425',        // Wax Seal (#AB3425)
  terracottaLight: '#FFDAD4',   // Secondary Fixed (#FFDAD4)
  goldCream: '#F5E8C7',         // Кремово-золота заливка («У золотий фонд»)
  goldBorder: '#DFC47F',        // Золота рамка пігулки Lore
  goldCreamBorder: '#DFC47F',
  goldInk: '#5C4715',           // Темно-золотий текст на золотій пігулці

  // Immersive Dark Round & Bento Palette
  background: '#161412',        // Глибокий теплий графітовий фон раунду
  surface: '#222222',           // Матовий графіт карток цитат і голосувань (#222222)
  surfaceElevated: '#2C2926',   // Піднята темна поверхня
  surfaceGlass: 'rgba(34, 34, 34, 0.78)',
  border: '#36322E',
  borderSubtle: '#2A2723',

  // Семантичні акценти
  primary: '#000000',
  secondary: '#AB3425',
  coupleAccent: '#AB3425',      // Терракотовий для Пари
  purpleAccent: '#7C5CFF',
  gold: '#E5B84B',
  success: '#2FB380',           // Зелене кільце «Хто вже відповів» ✓
  danger: '#AB3425',
  textPrimary: '#1B1C1A',
  textSecondary: '#4A4640',
  textMuted: '#7C766F',
};

// Google Stitch token aliases
export const stitch = {
  background: '#FBF9F6',
  surface: '#FBF9F6',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F5F3F0',
  surfaceContainer: '#EFEEEB',
  surfaceContainerHigh: '#EAE8E5',
  surfaceContainerHighest: '#E4E2DF',
  surfaceVariant: '#E4E2DF',
  surfaceDim: '#DBDDA7',
  onSurface: '#1B1C1A',
  onSurfaceVariant: '#4A4640',
  primary: '#000000',
  secondary: '#AB3425',
  secondaryContainer: '#FC6F5A',
  secondaryFixed: '#FFDAD4',
  outline: '#605E5C',
  outlineVariant: '#CCC5BD',
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  goldStar: '#D97706',
};

export const editorial = colors;

export const DECK_THEMES: Record<
  DeckTag,
  {
    accent: string;
    bgTint: string;
    borderTint: string;
    badgeLabel: string;
    title: string;
  }
> = {
  core: {
    accent: '#FF6F61',
    bgTint: 'rgba(255, 111, 97, 0.12)',
    borderTint: 'rgba(255, 111, 97, 0.45)',
    badgeLabel: '⚡ База',
    title: 'База',
  },
  spicy: {
    accent: '#E84A5F',
    bgTint: 'rgba(232, 74, 95, 0.12)',
    borderTint: 'rgba(232, 74, 95, 0.45)',
    badgeLabel: '🔥 Гострі',
    title: 'Гострі',
  },
  deep: {
    accent: '#6366F1',
    bgTint: 'rgba(99, 102, 241, 0.12)',
    borderTint: 'rgba(99, 102, 241, 0.45)',
    badgeLabel: '🌙 Глибокі',
    title: 'Глибокі',
  },
  nostalgia: {
    accent: '#D97706',
    bgTint: 'rgba(217, 119, 6, 0.12)',
    borderTint: 'rgba(217, 119, 6, 0.45)',
    badgeLabel: '📼 Спогади',
    title: 'Спогади',
  },
};
