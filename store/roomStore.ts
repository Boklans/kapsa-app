import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { resolveSignedMediaUrls, uploadRoundPhoto } from '@/lib/media';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  DeckTag,
  LoreItem,
  PromptFormat,
  Room,
  RoomType,
  RoundCard,
  RoundHistoryItem,
  RoundLifecycleState,
  TodayRound,
  computeRoundLifecycleState,
} from '@/types/kapsa';

const DEMO_STORAGE_KEY = 'kapsa_demo_rooms_state_v1';

const getDeviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
  } catch {
    return 'Europe/Kyiv';
  }
};

const triggerHaptic = (type: 'light' | 'medium' | 'success' = 'light') => {
  try {
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // ignore on web/unsupported devices
  }
};

interface DemoMemberSecret {
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  has_answered: boolean;
  answered_at: string | null;
  response_id: string | null;
  text_content: string | null;
  media_path: string | null;
  voted_for_user_id: string | null;
  voted_for_name: string | null;
  reactions: Record<string, string[]>;
  is_nudged?: boolean;
}

interface DemoPromptOption {
  id: string;
  format: PromptFormat;
  deck: DeckTag;
  question_text: string;
}

interface DemoRoomBundle {
  room: Room;
  promptsByFormat: Record<PromptFormat, { id: string; question_text: string }>;
  deckPrompts: DemoPromptOption[];
  activeFormat: PromptFormat;
  customQuestionText?: string;
  members: DemoMemberSecret[];
  lore: LoreItem[];
}

const getTodayNinePmIso = (): string => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(21, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setHours(23, 59, 0, 0);
  }
  return target.toISOString();
};

const FRIENDS_DECK_PROMPTS: DemoPromptOption[] = [
  {
    id: 'fp-1',
    format: 'vote',
    deck: 'core',
    question_text:
      'Хто з нашої компанії найімовірніше заблукає навіть з увімкненим Google Maps? 🗺️',
  },
  {
    id: 'fp-2',
    format: 'vote',
    deck: 'spicy',
    question_text:
      'Хто з нас першим би вибовкав секрет через 5 хвилин після слів "тільки нікому"? 🤫',
  },
  {
    id: 'fp-3',
    format: 'answer',
    deck: 'spicy',
    question_text:
      'Який найбільш крінжовий підкат або повідомлення ти коли-небудь отримував(ла) в дірект? 💀',
  },
  {
    id: 'fp-4',
    format: 'answer',
    deck: 'nostalgia',
    question_text:
      'Який день або вечір нашої компанії ти б хотів(ла) прожити ще раз від початку до кінця? 📼',
  },
  {
    id: 'fp-5',
    format: 'vote',
    deck: 'nostalgia',
    question_text:
      'Хто з нас найбільше змінився з моменту нашого першого знайомства? ⏳',
  },
  {
    id: 'fp-6',
    format: 'show',
    deck: 'core',
    question_text:
      'Сфотографуй те, що прямо зараз перед твоїми очима (без підготовки!) 📸',
  },
];

const COUPLE_DECK_PROMPTS: DemoPromptOption[] = [
  {
    id: 'cp-1',
    format: 'vote',
    deck: 'core',
    question_text: 'Хто з нас двох довше збирається перед виходом з дому? 🪞',
  },
  {
    id: 'cp-2',
    format: 'answer',
    deck: 'deep',
    question_text:
      'У який момент ти вперше зрозумів(ла), що закохався(лася) в мене по-справжньому? 🌙',
  },
  {
    id: 'cp-3',
    format: 'vote',
    deck: 'deep',
    question_text:
      'Хто з нас двох більше переживає через дрібниці, але приховує це за усмішкою? 🫂',
  },
  {
    id: 'cp-4',
    format: 'answer',
    deck: 'spicy',
    question_text:
      'Яке місце або ідею для побачення лише для нас двох ти давно хочеш спробувати? 🔥',
  },
  {
    id: 'cp-5',
    format: 'show',
    deck: 'core',
    question_text:
      'Покажи свій вид з вікна або робочого місця прямо в цю секунду 🌤️',
  },
];

const createInitialDemoData = (): Record<string, DemoRoomBundle> => {
  const todayStr = new Date().toISOString().slice(0, 10);
  return {
    'demo-friends': {
      room: {
        id: 'demo-friends',
        name: 'Легенди двору',
        type: 'friends',
        invite_code: 'KAPS26',
        timezone: 'Europe/Kyiv',
        reveal_hour: 21,
        is_premium: false,
        streak_count: 7,
        longest_streak: 14,
        active_deck: 'core',
        created_by: 'demo-user-me',
        created_at: new Date().toISOString(),
      },
      activeFormat: 'vote',
      deckPrompts: FRIENDS_DECK_PROMPTS,
      promptsByFormat: {
        vote: {
          id: 'p-friends-vote',
          question_text:
            'Хто з нашої компанії найімовірніше заблукає навіть з увімкненим Google Maps? 🗺️',
        },
        show: {
          id: 'p-friends-show',
          question_text:
            'Сфотографуй те, що прямо зараз перед твоїми очима (без підготовки!) 📸',
        },
        answer: {
          id: 'p-friends-answer',
          question_text:
            'Яка найбільш абсурдна відмазка, яку ти колись вигадував, щоб нікуди не йти? 🛋️',
        },
      },
      members: [
        {
          user_id: 'demo-user-me',
          display_name: 'Ти',
          avatar_emoji: '😎',
          has_answered: false,
          answered_at: null,
          response_id: null,
          text_content: null,
          media_path: null,
          voted_for_user_id: null,
          voted_for_name: null,
          reactions: {},
        },
        {
          user_id: 'u-max',
          display_name: 'Макс',
          avatar_emoji: '🦊',
          has_answered: true,
          answered_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
          response_id: 'resp-max-1',
          text_content: 'Він минулого літа вийшов за кавою і опинився на іншому березі 😂',
          media_path: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
          voted_for_user_id: 'u-dima',
          voted_for_name: 'Діма',
          reactions: { '😂': ['u-olya'], '🔥': ['u-olya'] },
        },
        {
          user_id: 'u-olya',
          display_name: 'Оля',
          avatar_emoji: '⚡',
          has_answered: true,
          answered_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
          response_id: 'resp-olya-1',
          text_content: '100% Діма, бо "я знаю коротку дорогу через ліс" — це вже мем року',
          media_path: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
          voted_for_user_id: 'u-dima',
          voted_for_name: 'Діма',
          reactions: { '💀': ['u-max'] },
        },
        {
          user_id: 'u-dima',
          display_name: 'Діма',
          avatar_emoji: '🍕',
          has_answered: false,
          answered_at: null,
          response_id: null,
          text_content: null,
          media_path: null,
          voted_for_user_id: null,
          voted_for_name: null,
          reactions: {},
          is_nudged: false,
        },
      ],
      lore: [
        {
          id: 'lore-demo-1',
          room_id: 'demo-friends',
          round_id: `round-${todayStr}-old`,
          response_id: 'resp-old-1',
          pinned_by: 'u-max',
          created_at: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
          question_text:
            'Хто з нас найімовірніше випадково опиниться в іншій країні після вечірки? ✈️',
          author_name: 'Оля',
          author_emoji: '⚡',
          text_content:
            'Макс вже одного разу поїхав у Львів замість Києва, бо переплутав перон о 6 ранку 🚆',
          voted_for_name: 'Макс',
        },
      ],
    },
    'demo-couple': {
      room: {
        id: 'demo-couple',
        name: 'Наші моменти',
        type: 'couple',
        invite_code: 'LOVE02',
        timezone: 'Europe/Kyiv',
        reveal_hour: 21,
        is_premium: false,
        streak_count: 19,
        longest_streak: 19,
        active_deck: 'core',
        created_by: 'demo-user-me',
        created_at: new Date().toISOString(),
      },
      activeFormat: 'vote',
      deckPrompts: COUPLE_DECK_PROMPTS,
      promptsByFormat: {
        vote: {
          id: 'p-couple-vote',
          question_text: 'Хто з нас двох довше збирається перед виходом з дому? 🪞',
        },
        show: {
          id: 'p-couple-show',
          question_text:
            'Покажи свій вид з вікна або робочого місця прямо в цю секунду 🌤️',
        },
        answer: {
          id: 'p-couple-answer',
          question_text:
            'Яка маленька деталь у поведінці партнера цього тижня змусила тебе усміхнутися? ❤️',
        },
      },
      members: [
        {
          user_id: 'demo-user-me',
          display_name: 'Ти',
          avatar_emoji: '😎',
          has_answered: false,
          answered_at: null,
          response_id: null,
          text_content: null,
          media_path: null,
          voted_for_user_id: null,
          voted_for_name: null,
          reactions: {},
        },
        {
          user_id: 'u-partner',
          display_name: 'Сонечко',
          avatar_emoji: '❤️',
          has_answered: true,
          answered_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          response_id: 'resp-partner-1',
          text_content: 'Кажеш "я вже у взутті", коли ще навіть футболку не обрав 😘',
          media_path:
            'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
          voted_for_user_id: 'demo-user-me',
          voted_for_name: 'Ти',
          reactions: { '❤️': ['u-partner'] },
        },
      ],
      lore: [
        {
          id: 'lore-demo-couple-1',
          room_id: 'demo-couple',
          round_id: `round-${todayStr}-couple-old`,
          response_id: 'resp-couple-old-1',
          pinned_by: 'demo-user-me',
          created_at: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
          question_text: 'Який наш спільний спогад миттєво піднімає тобі настрій? ✨',
          author_name: 'Сонечко',
          author_emoji: '❤️',
          text_content:
            'Як ми потрапили під зливу з піцою в руках і сміялися під дахом кіоску 🍕🌧️',
          voted_for_name: null,
        },
      ],
    },
  };
};

let demoStore: Record<string, DemoRoomBundle> = createInitialDemoData();
let isDemoHydrated = false;

const persistDemoStore = async () => {
  try {
    await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoStore));
  } catch {
    // ignore storage errors
  }
};

const hydrateDemoStoreOnce = async () => {
  if (isDemoHydrated) return;
  isDemoHydrated = true;
  try {
    const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed['demo-friends']) {
        demoStore = parsed;
      }
    }
  } catch {
    // fallback to initial in-memory store
  }
};

const buildDemoView = (
  bundle: DemoRoomBundle,
  currentUserId: string,
  userDisplayName: string,
  userEmoji: string
): { todayRound: TodayRound; cards: RoundCard[]; loreItems: LoreItem[] } => {
  const format = bundle.activeFormat;
  const prompt = bundle.promptsByFormat[format];
  const todayStr = new Date().toISOString().slice(0, 10);
  const roundId = `round-${bundle.room.id}-${todayStr}-${format}`;

  const members = bundle.members.map((m) =>
    m.user_id === currentUserId
      ? { ...m, display_name: userDisplayName, avatar_emoji: userEmoji }
      : m
  );

  const myMember = members.find((m) => m.user_id === currentUserId);
  const iHaveAnswered = Boolean(myMember?.has_answered);
  const allAnswered = members.length >= 2 && members.every((m) => m.has_answered);
  const canReveal = iHaveAnswered || allAnswered;

  const revealAt = allAnswered ? new Date().toISOString() : getTodayNinePmIso();
  const lifecycle_state = computeRoundLifecycleState({
    round_date: todayStr,
    reveal_at: revealAt,
    is_fully_revealed: allAnswered,
  });

  const todayRound: TodayRound = {
    round_id: roundId,
    round_date: todayStr,
    reveal_at: revealAt,
    is_fully_revealed: allAnswered,
    lifecycle_state,
    prompt_id: prompt.id,
    prompt_format: format,
    question_text: bundle.customQuestionText || prompt.question_text,
    deck_tag: bundle.room.active_deck || 'core',
  };

  const cards: RoundCard[] = members.map((m) => {
    const isRevealed = m.has_answered && (canReveal || m.user_id === currentUserId);
    const isPinned = Boolean(
      m.response_id && bundle.lore.some((l) => l.response_id === m.response_id)
    );

    return {
      user_id: m.user_id,
      display_name: m.display_name,
      avatar_emoji: m.avatar_emoji,
      has_answered: m.has_answered,
      is_skipped: false,
      answered_at: m.answered_at,
      is_revealed: isRevealed,
      response_id: m.response_id,
      text_content: isRevealed ? m.text_content : null,
      has_media: format === 'show' && m.has_answered,
      media_path: isRevealed && format === 'show' ? m.media_path : null,
      voted_for_user_id: isRevealed && format === 'vote' ? m.voted_for_user_id : null,
      voted_for_name: isRevealed && format === 'vote' ? m.voted_for_name : null,
      is_pinned_to_lore: isPinned,
      reactions: isRevealed ? { ...m.reactions } : {},
      is_nudged: m.is_nudged,
    };
  });

  return {
    todayRound,
    cards,
    loreItems: [...bundle.lore],
  };
};

interface SubmitResponseParams {
  roomId: string;
  roundId: string;
  textContent?: string;
  mediaPath?: string | null;
  votedForUserId?: string | null;
}

interface RoomState {
  rooms: Room[];
  activeRoom: Room | null;
  todayRound: TodayRound | null;
  cards: RoundCard[];
  loreItems: LoreItem[];
  roundHistory: RoundHistoryItem[];
  selectedHistoryRoundId: string | null;
  historyRoundCards: RoundCard[];
  isLoadingHistoryCards: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  fetchMyRooms: () => Promise<void>;
  createRoom: (name: string, type: RoomType) => Promise<Room>;
  joinRoomByCode: (
    inviteCode: string,
    displayName?: string,
    avatarEmoji?: string
  ) => Promise<string>;
  loadRoomDashboard: (roomId: string) => Promise<void>;
  submitRoundResponse: (params: SubmitResponseParams) => Promise<void>;
  togglePinToLore: (roomId: string, roundId: string, card: RoundCard) => Promise<void>;
  toggleCardReaction: (
    roomId: string,
    roundId: string,
    responseId: string,
    emoji: string
  ) => Promise<void>;
  nudgeMember: (roomId: string, roundId: string, targetUserId: string) => Promise<void>;
  rerollTodayQuestion: (roomId: string, deckTag?: DeckTag) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  loadRoomLore: (roomId: string) => Promise<void>;
  loadRoomRoundHistory: (roomId: string) => Promise<void>;
  loadHistoryRoundCards: (roomId: string, roundId: string) => Promise<void>;
  subscribeToRoomRealtime: (roomId: string) => () => void;
  switchDemoPromptFormat: (roomId: string, format: PromptFormat) => void;
  resetDemoMyResponse: (roomId: string) => void;
  simulateDemoFriendMove: (roomId: string) => void;
  simulateDemoFriendLeave: (roomId: string) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: Object.values(demoStore).map((b) => b.room),
  activeRoom: null,
  todayRound: null,
  cards: [],
  loreItems: [],
  roundHistory: [],
  selectedHistoryRoundId: null,
  historyRoundCards: [],
  isLoadingHistoryCards: false,
  isLoading: false,
  isSubmitting: false,
  error: null,

  fetchMyRooms: async () => {
    const { isDemoMode } = useAuthStore.getState();

    if (isDemoMode || !isSupabaseConfigured) {
      await hydrateDemoStoreOnce();
      set({ rooms: Object.values(demoStore).map((b) => b.room), error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ rooms: (data as Room[]) || [], isLoading: false });
    } catch (err: any) {
      set({
        error: err?.message || 'Не вдалося завантажити кімнати',
        isLoading: false,
      });
    }
  },

  createRoom: async (name: string, type: RoomType) => {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Введіть назву капсули');
    }

    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();
    const tz = getDeviceTimezone();
    triggerHaptic('medium');

    if (isDemoMode || !isSupabaseConfigured) {
      await hydrateDemoStoreOnce();
      const id = `demo-${Date.now()}`;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newRoom: Room = {
        id,
        name: cleanName,
        type,
        invite_code: code,
        timezone: tz,
        reveal_hour: 21,
        is_premium: false,
        streak_count: 1,
        longest_streak: 1,
        active_deck: 'core',
        created_by: userId,
        created_at: new Date().toISOString(),
      };

      const defaultFriendsPrompts = demoStore['demo-friends'].promptsByFormat;
      const defaultCouplePrompts = demoStore['demo-couple'].promptsByFormat;

      demoStore[id] = {
        room: newRoom,
        activeFormat: 'vote',
        deckPrompts: type === 'friends' ? FRIENDS_DECK_PROMPTS : COUPLE_DECK_PROMPTS,
        promptsByFormat: type === 'friends' ? defaultFriendsPrompts : defaultCouplePrompts,
        members: [
          {
            user_id: userId,
            display_name: displayName,
            avatar_emoji: avatarEmoji,
            has_answered: false,
            answered_at: null,
            response_id: null,
            text_content: null,
            media_path: null,
            voted_for_user_id: null,
            voted_for_name: null,
            reactions: {},
          },
          type === 'couple'
            ? {
                user_id: `partner-${id}`,
                display_name: 'Партнер',
                avatar_emoji: '❤️',
                has_answered: true,
                answered_at: new Date().toISOString(),
                response_id: `resp-partner-${id}`,
                text_content: 'Очікую на твою відповідь, щоб відкрити капсулу дня! ✨',
                media_path:
                  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80',
                voted_for_user_id: userId,
                voted_for_name: displayName,
                reactions: {},
              }
            : {
                user_id: `friend-${id}`,
                display_name: 'Алекс',
                avatar_emoji: '🚀',
                has_answered: true,
                answered_at: new Date().toISOString(),
                response_id: `resp-friend-${id}`,
                text_content: 'Перший пішов! Зроби свій хід, щоб побачити мій голос 🔥',
                media_path:
                  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80',
                voted_for_user_id: userId,
                voted_for_name: displayName,
                reactions: {},
              },
        ],
        lore: [],
      };

      await persistDemoStore();
      set({ rooms: Object.values(demoStore).map((b) => b.room) });
      return newRoom;
    }

    set({ isLoading: true, error: null });
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          name: cleanName,
          type,
          timezone: tz,
          is_premium: false,
          created_by: userId,
        })
        .select('*')
        .single();

      if (roomError) throw roomError;

      const createdRoom = roomData as Room;

      const { error: memberError } = await supabase.from('room_members').insert({
        room_id: createdRoom.id,
        user_id: userId,
        display_name: displayName,
        avatar_emoji: avatarEmoji,
        status: 'active',
      });

      if (memberError) throw memberError;

      set((state) => ({
        rooms: [createdRoom, ...state.rooms],
        isLoading: false,
      }));

      return createdRoom;
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || 'Помилка створення капсули' });
      throw err;
    }
  },

  joinRoomByCode: async (inviteCode: string, customName?: string, customEmoji?: string) => {
    const cleanCode = inviteCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      throw new Error('Введіть коректний код запрошення');
    }

    const auth = useAuthStore.getState();
    const finalName = (customName || auth.displayName).trim() || 'Учасник';
    const finalEmoji = customEmoji || auth.avatarEmoji;

    if (customName || customEmoji) {
      await auth.updateProfile(finalName, finalEmoji);
    }

    triggerHaptic('medium');

    if (auth.isDemoMode || !isSupabaseConfigured) {
      await hydrateDemoStoreOnce();
      const found = Object.values(demoStore).find(
        (b) => b.room.invite_code.toUpperCase() === cleanCode
      );
      if (found) {
        return found.room.id;
      }

      return 'demo-friends';
    }

    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('join_room_by_code', {
        p_invite_code: cleanCode,
        p_display_name: finalName,
        p_avatar_emoji: finalEmoji,
      });

      if (error) throw error;
      const joinedRoomId = data as string;
      await get().fetchMyRooms();
      set({ isLoading: false });
      return joinedRoomId;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || 'Не вдалося приєднатися за кодом',
      });
      throw err;
    }
  },

  loadRoomDashboard: async (roomId: string) => {
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId] || roomId.startsWith('demo-')) {
      await hydrateDemoStoreOnce();
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
      set({
        activeRoom: { ...bundle.room },
        todayRound: view.todayRound,
        cards: view.cards,
        loreItems: view.loreItems,
        isLoading: false,
        error: null,
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomErr) throw roomErr;

      const { data: roundRows, error: roundErr } = await supabase.rpc(
        'get_or_create_today_round',
        { p_room_id: roomId }
      );
      if (roundErr) throw roundErr;

      const rawRound = (Array.isArray(roundRows) ? roundRows[0] : roundRows) as TodayRound;
      const round: TodayRound = {
        ...rawRound,
        lifecycle_state: computeRoundLifecycleState(rawRound),
      };

      const { data: cardRows, error: cardsErr } = await supabase.rpc('get_round_cards', {
        p_round_id: round.round_id,
      });
      if (cardsErr) throw cardsErr;

      const rawCards = (cardRows as RoundCard[]) || [];

      // P1: Отримуємо підписані URL для всіх відкритих фото з приватного бакета room-media
      const signedUrlMap = await resolveSignedMediaUrls(
        rawCards.map((c) => (c.is_revealed ? c.media_path : null))
      );

      const { data: reactionRows } = await supabase
        .from('card_reactions')
        .select('response_id, user_id, emoji')
        .eq('round_id', round.round_id);

      const reactionsByResp = new Map<string, Record<string, string[]>>();
      for (const r of reactionRows || []) {
        const mapObj = reactionsByResp.get(r.response_id) || {};
        const arr = mapObj[r.emoji] || [];
        if (!arr.includes(r.user_id)) arr.push(r.user_id);
        mapObj[r.emoji] = arr;
        reactionsByResp.set(r.response_id, mapObj);
      }

      const enrichedCards = rawCards.map((c) => ({
        ...c,
        media_path:
          c.media_path && signedUrlMap.has(c.media_path)
            ? signedUrlMap.get(c.media_path)!
            : c.media_path,
        reactions: c.response_id ? reactionsByResp.get(c.response_id) || {} : {},
      }));

      set({
        activeRoom: roomData as Room,
        todayRound: round,
        cards: enrichedCards,
        isLoading: false,
      });

      await get().loadRoomLore(roomId);
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || 'Помилка завантаження капсули дня',
      });
    }
  },

  submitRoundResponse: async ({
    roomId,
    roundId,
    textContent,
    mediaPath,
    votedForUserId,
  }: SubmitResponseParams) => {
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();
    set({ isSubmitting: true, error: null });
    triggerHaptic('success');

    try {
      if (isDemoMode || !isSupabaseConfigured || demoStore[roomId]) {
        const bundle = demoStore[roomId] || demoStore['demo-friends'];
        const votedTarget = bundle.members.find((m) => m.user_id === votedForUserId);

        bundle.members = bundle.members.map((m) => {
          if (m.user_id !== userId) return m;
          return {
            ...m,
            display_name: displayName,
            avatar_emoji: avatarEmoji,
            has_answered: true,
            answered_at: new Date().toISOString(),
            response_id: `resp-${userId}-${Date.now()}`,
            text_content: textContent?.trim() || null,
            media_path:
              mediaPath ||
              (bundle.activeFormat === 'show'
                ? 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'
                : null),
            voted_for_user_id: votedForUserId || null,
            voted_for_name: votedTarget ? votedTarget.display_name : null,
          };
        });

        await persistDemoStore();
        const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
        set({
          activeRoom: { ...bundle.room },
          todayRound: view.todayRound,
          cards: view.cards,
          isSubmitting: false,
        });
        return;
      }

      // P1: Якщо є локальне фото — завантажуємо його у приватний бакет room-media
      let storedMediaPath: string | null = null;
      if (mediaPath) {
        storedMediaPath = await uploadRoundPhoto({
          roomId,
          roundId,
          userId,
          localUri: mediaPath,
        });
      }

      const { error } = await supabase.from('round_responses').insert({
        round_id: roundId,
        room_id: roomId,
        user_id: userId,
        text_content: textContent?.trim() || null,
        media_path: storedMediaPath,
        voted_for_user_id: votedForUserId || null,
      });

      if (error) throw error;

      await get().loadRoomDashboard(roomId);
      set({ isSubmitting: false });
    } catch (err: any) {
      set({
        isSubmitting: false,
        error: err?.message || 'Не вдалося зберегти відповідь',
      });
      throw err;
    }
  },

  togglePinToLore: async (roomId: string, roundId: string, card: RoundCard) => {
    if (!card.response_id) return;
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();
    const currentRound = get().todayRound;
    triggerHaptic('medium');

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId]) {
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      const exists = bundle.lore.some((l) => l.response_id === card.response_id);

      if (exists) {
        bundle.lore = bundle.lore.filter((l) => l.response_id !== card.response_id);
      } else {
        const newLoreItem: LoreItem = {
          id: `lore-${Date.now()}`,
          room_id: roomId,
          round_id: roundId,
          response_id: card.response_id,
          pinned_by: userId,
          created_at: new Date().toISOString(),
          question_text: currentRound?.question_text,
          author_name: card.display_name,
          author_emoji: card.avatar_emoji,
          text_content: card.text_content,
          voted_for_name: card.voted_for_name,
          media_path: card.media_path,
        };
        bundle.lore = [newLoreItem, ...bundle.lore];
      }

      await persistDemoStore();
      const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
      set({
        cards: view.cards,
        loreItems: view.loreItems,
      });
      return;
    }

    try {
      if (card.is_pinned_to_lore) {
        await supabase
          .from('lore_items')
          .delete()
          .eq('room_id', roomId)
          .eq('response_id', card.response_id);
      } else {
        await supabase.from('lore_items').insert({
          room_id: roomId,
          round_id: roundId,
          response_id: card.response_id,
          pinned_by: userId,
        });
      }

      await get().loadRoomDashboard(roomId);
    } catch (err: any) {
      set({ error: err?.message || 'Не вдалося оновити Lore' });
    }
  },

  toggleCardReaction: async (
    roomId: string,
    roundId: string,
    responseId: string,
    emoji: string
  ) => {
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();
    triggerHaptic('light');

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId]) {
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      bundle.members = bundle.members.map((m) => {
        if (m.response_id !== responseId) return m;
        const currentList = m.reactions[emoji] || [];
        const hasReacted = currentList.includes(userId);
        const nextList = hasReacted
          ? currentList.filter((id) => id !== userId)
          : [...currentList, userId];

        const nextReactions = { ...m.reactions };
        if (nextList.length === 0) {
          delete nextReactions[emoji];
        } else {
          nextReactions[emoji] = nextList;
        }
        return { ...m, reactions: nextReactions };
      });

      await persistDemoStore();
      const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
      set({ cards: view.cards });
      return;
    }

    try {
      const existingCard = get().cards.find((c) => c.response_id === responseId);
      const alreadyReacted = existingCard?.reactions?.[emoji]?.includes(userId);

      if (alreadyReacted) {
        await supabase
          .from('card_reactions')
          .delete()
          .eq('response_id', responseId)
          .eq('user_id', userId)
          .eq('emoji', emoji);
      } else {
        await supabase.from('card_reactions').insert({
          room_id: roomId,
          round_id: roundId,
          response_id: responseId,
          user_id: userId,
          emoji,
        });
      }

      await get().loadRoomDashboard(roomId);
    } catch {
      // ignore reaction error
    }
  },

  nudgeMember: async (roomId: string, roundId: string, targetUserId: string) => {
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();
    triggerHaptic('medium');

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId]) {
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      bundle.members = bundle.members.map((m) =>
        m.user_id === targetUserId ? { ...m, is_nudged: true } : m
      );
      await persistDemoStore();
      const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
      set({ cards: view.cards });
      return;
    }

    try {
      await supabase.from('room_nudges').insert({
        room_id: roomId,
        round_id: roundId,
        from_user_id: userId,
        to_user_id: targetUserId,
      });

      set((state) => ({
        cards: state.cards.map((c) =>
          c.user_id === targetUserId ? { ...c, is_nudged: true } : c
        ),
      }));
    } catch {
      set((state) => ({
        cards: state.cards.map((c) =>
          c.user_id === targetUserId ? { ...c, is_nudged: true } : c
        ),
      }));
    }
  },

  rerollTodayQuestion: async (roomId: string, deckTag?: DeckTag) => {
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();
    triggerHaptic('medium');

    // P0: Захист від стирання відповідей друзів при повторній генерації питання
    const currentCards = get().cards;
    const anyAnswered = currentCards.some((c) => c.has_answered);

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId]) {
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      const nextDeck = deckTag || bundle.room.active_deck || 'core';
      bundle.room = { ...bundle.room, active_deck: nextDeck };

      if (anyAnswered) {
        await persistDemoStore();
        set({
          activeRoom: { ...bundle.room },
          error:
            'Колоду збережено для наступного раунду! Сьогоднішнє питання змінити не можна, бо учасники вже відповіли.',
        });
        return;
      }

      const candidates = bundle.deckPrompts.filter((p) => p.deck === nextDeck);
      const pool = candidates.length > 0 ? candidates : bundle.deckPrompts;
      const currentText =
        bundle.customQuestionText ||
        bundle.promptsByFormat[bundle.activeFormat].question_text;

      const filtered = pool.filter((p) => p.question_text !== currentText);
      const chosen =
        filtered[Math.floor(Math.random() * filtered.length)] || pool[0];

      if (chosen) {
        bundle.activeFormat = chosen.format;
        bundle.customQuestionText = chosen.question_text;
      }

      await persistDemoStore();
      const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
      set({
        activeRoom: { ...bundle.room },
        todayRound: view.todayRound,
        cards: view.cards,
        error: null,
      });
      return;
    }

    if (anyAnswered) {
      set({
        error:
          'Неможливо змінити питання: учасники вже почали відповідати в сьогоднішньому раунді',
      });
      return;
    }

    try {
      const { error } = await supabase.rpc('reroll_today_round', {
        p_room_id: roomId,
        p_deck_tag: deckTag || null,
      });
      if (error) throw error;
      await get().loadRoomDashboard(roomId);
    } catch (err: any) {
      set({ error: err?.message || 'Не вдалося оновити питання раунду' });
    }
  },

  loadRoomLore: async (roomId: string) => {
    const { isDemoMode } = useAuthStore.getState();

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId] || roomId.startsWith('demo-')) {
      await hydrateDemoStoreOnce();
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      set({ loreItems: [...bundle.lore] });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('lore_items')
        .select(
          `
          id,
          room_id,
          round_id,
          response_id,
          pinned_by,
          created_at,
          room_rounds (
            prompts ( question_text )
          ),
          round_responses (
            user_id,
            text_content,
            media_path,
            voted_for_user_id
          )
        `
        )
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: membersData } = await supabase
        .from('room_members')
        .select('user_id, display_name, avatar_emoji')
        .eq('room_id', roomId);

      const memberMap = new Map(
        (membersData || []).map((m: any) => [m.user_id, m])
      );

      const rawMediaPaths = (data || []).map(
        (row: any) => row.round_responses?.media_path || null
      );
      const signedMediaMap = await resolveSignedMediaUrls(rawMediaPaths);

      const formatted: LoreItem[] = (data || []).map((row: any) => {
        const resp = row.round_responses;
        const author = resp ? memberMap.get(resp.user_id) : null;
        const votedTarget =
          resp && resp.voted_for_user_id ? memberMap.get(resp.voted_for_user_id) : null;
        const rawPath = resp?.media_path || null;

        return {
          id: row.id,
          room_id: row.room_id,
          round_id: row.round_id,
          response_id: row.response_id,
          pinned_by: row.pinned_by,
          created_at: row.created_at,
          question_text: row.room_rounds?.prompts?.question_text,
          author_name: author?.display_name || 'Учасник',
          author_emoji: author?.avatar_emoji || '😎',
          text_content: resp?.text_content || null,
          media_path:
            rawPath && signedMediaMap.has(rawPath)
              ? signedMediaMap.get(rawPath)!
              : rawPath,
          voted_for_name: votedTarget?.display_name || null,
        };
      });

      set({ loreItems: formatted });
    } catch (err: any) {
      set({ error: err?.message || 'Помилка завантаження Lore' });
    }
  },

  loadRoomRoundHistory: async (roomId: string) => {
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId] || roomId.startsWith('demo-')) {
      await hydrateDemoStoreOnce();
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
      const yesterdayDate = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10);
      const demoHistory: RoundHistoryItem[] = [
        {
          round_id: view.todayRound.round_id,
          round_date: view.todayRound.round_date,
          reveal_at: view.todayRound.reveal_at,
          is_revealed: view.todayRound.is_fully_revealed,
          prompt_format: view.todayRound.prompt_format,
          question_text: view.todayRound.question_text,
          deck_tag: view.todayRound.deck_tag,
        },
        {
          round_id: `demo-yesterday-${roomId}`,
          round_date: yesterdayDate,
          reveal_at: new Date(Date.now() - 86400 * 1000).toISOString(),
          is_revealed: true,
          prompt_format: 'vote',
          question_text:
            bundle.lore[0]?.question_text ||
            'Хто з нас найімовірніше випадково опиниться в іншій країні після вечірки? ✈️',
          deck_tag: 'core',
        },
      ];
      set({ roundHistory: demoHistory });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('room_rounds')
        .select(
          `
          id,
          round_date,
          reveal_at,
          prompts (
            format,
            question_text,
            deck_tag
          )
        `
        )
        .eq('room_id', roomId)
        .order('round_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      const nowMs = Date.now();
      const history: RoundHistoryItem[] = (data || []).map((row: any) => {
        const promptObj = Array.isArray(row.prompts) ? row.prompts[0] : row.prompts;
        return {
          round_id: row.id,
          round_date: row.round_date,
          reveal_at: row.reveal_at,
          is_revealed: new Date(row.reveal_at).getTime() <= nowMs,
          prompt_format: (promptObj?.format as PromptFormat) || 'answer',
          question_text: promptObj?.question_text || 'Питання раунду',
          deck_tag: (promptObj?.deck_tag as DeckTag) || 'core',
        };
      });

      set({ roundHistory: history });
    } catch (err: any) {
      set({ error: err?.message || 'Не вдалося завантажити архів раундів' });
    }
  },

  loadHistoryRoundCards: async (roomId: string, roundId: string) => {
    const { userId, displayName, avatarEmoji, isDemoMode } = useAuthStore.getState();

    if (get().selectedHistoryRoundId === roundId && get().historyRoundCards.length > 0) {
      set({ selectedHistoryRoundId: null, historyRoundCards: [] });
      return;
    }

    set({ selectedHistoryRoundId: roundId, isLoadingHistoryCards: true });

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId] || roomId.startsWith('demo-')) {
      await hydrateDemoStoreOnce();
      const bundle = demoStore[roomId] || demoStore['demo-friends'];
      const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
      set({
        historyRoundCards: view.cards,
        isLoadingHistoryCards: false,
      });
      return;
    }

    try {
      const { data: cardRows, error: cardsErr } = await supabase.rpc('get_round_cards', {
        p_round_id: roundId,
      });
      if (cardsErr) throw cardsErr;

      const rawCards = (cardRows as RoundCard[]) || [];
      const signedUrlMap = await resolveSignedMediaUrls(
        rawCards.map((c) => (c.is_revealed ? c.media_path : null))
      );

      const { data: reactionRows } = await supabase
        .from('card_reactions')
        .select('response_id, user_id, emoji')
        .eq('round_id', roundId);

      const reactionsByResp = new Map<string, Record<string, string[]>>();
      for (const r of reactionRows || []) {
        const mapObj = reactionsByResp.get(r.response_id) || {};
        const arr = mapObj[r.emoji] || [];
        if (!arr.includes(r.user_id)) arr.push(r.user_id);
        mapObj[r.emoji] = arr;
        reactionsByResp.set(r.response_id, mapObj);
      }

      const enriched = rawCards.map((c) => ({
        ...c,
        media_path:
          c.media_path && signedUrlMap.has(c.media_path)
            ? signedUrlMap.get(c.media_path)!
            : c.media_path,
        reactions: c.response_id ? reactionsByResp.get(c.response_id) || {} : {},
      }));

      set({
        historyRoundCards: enriched,
        isLoadingHistoryCards: false,
      });
    } catch (err: any) {
      set({
        isLoadingHistoryCards: false,
        error: err?.message || 'Не вдалося завантажити картки раунду',
      });
    }
  },

  subscribeToRoomRealtime: (roomId: string) => {
    const { isDemoMode } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId]) {
      return () => {};
    }

    const channelTopic = `kapsa-room-${roomId}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_responses',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          triggerHaptic('light');
          get().loadRoomDashboard(roomId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_rounds',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          get().loadRoomDashboard(roomId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'card_reactions',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          get().loadRoomDashboard(roomId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          get().loadRoomDashboard(roomId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  leaveRoom: async (roomId: string) => {
    const { userId, isDemoMode } = useAuthStore.getState();
    triggerHaptic('medium');

    if (isDemoMode || !isSupabaseConfigured || demoStore[roomId]) {
      delete demoStore[roomId];
      await persistDemoStore();
      set({
        rooms: Object.values(demoStore).map((b) => b.room),
        activeRoom: null,
        todayRound: null,
        cards: [],
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('room_members')
        .update({ status: 'left' })
        .eq('room_id', roomId)
        .eq('user_id', userId);

      if (error) throw error;
      await get().fetchMyRooms();
      set({ activeRoom: null, todayRound: null, cards: [] });
    } catch (err: any) {
      set({ error: err?.message || 'Не вдалося вийти з кімнати' });
      throw err;
    }
  },

  switchDemoPromptFormat: (roomId: string, format: PromptFormat) => {
    const bundle = demoStore[roomId];
    if (!bundle) return;
    triggerHaptic('light');
    bundle.activeFormat = format;
    bundle.customQuestionText = undefined;
    persistDemoStore();
    const { userId, displayName, avatarEmoji } = useAuthStore.getState();
    const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
    set({
      todayRound: view.todayRound,
      cards: view.cards,
      error: null,
    });
  },

  resetDemoMyResponse: (roomId: string) => {
    const bundle = demoStore[roomId];
    if (!bundle) return;
    triggerHaptic('light');
    const { userId, displayName, avatarEmoji } = useAuthStore.getState();
    bundle.members = bundle.members.map((m) =>
      m.user_id === userId
        ? {
            ...m,
            has_answered: false,
            answered_at: null,
            response_id: null,
            text_content: null,
            media_path: null,
            voted_for_user_id: null,
            voted_for_name: null,
          }
        : m
    );
    persistDemoStore();
    const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
    set({
      todayRound: view.todayRound,
      cards: view.cards,
      error: null,
    });
  },

  simulateDemoFriendMove: (roomId: string) => {
    const bundle = demoStore[roomId];
    if (!bundle) return;
    triggerHaptic('success');
    const { userId, displayName, avatarEmoji } = useAuthStore.getState();

    bundle.members = bundle.members.map((m) => {
      if (m.has_answered || m.user_id === userId) return m;
      return {
        ...m,
        has_answered: true,
        answered_at: new Date().toISOString(),
        response_id: `resp-${m.user_id}-${Date.now()}`,
        text_content:
          'Та гаразд вам, один раз повернув не туди — і вже легенда на все життя 😂🗺️',
        media_path:
          'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
        voted_for_user_id: 'u-max',
        voted_for_name: 'Макс',
      };
    });

    const allDone = bundle.members.every((m) => m.has_answered);
    if (allDone) {
      bundle.room = {
        ...bundle.room,
        streak_count: (bundle.room.streak_count || 1) + 1,
      };
    }

    persistDemoStore();
    const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
    set({
      activeRoom: { ...bundle.room },
      todayRound: view.todayRound,
      cards: view.cards,
    });
  },

  simulateDemoFriendLeave: (roomId: string) => {
    const bundle = demoStore[roomId];
    if (!bundle) return;
    triggerHaptic('medium');
    const { userId, displayName, avatarEmoji } = useAuthStore.getState();

    // Видаляємо неактивного учасника (наприклад Діму, який ще не відповів) і перераховуємо кворум
    bundle.members = bundle.members.filter(
      (m) => m.user_id === userId || m.has_answered
    );

    const allDone =
      bundle.members.length >= 2 && bundle.members.every((m) => m.has_answered);
    if (allDone) {
      bundle.room = {
        ...bundle.room,
        streak_count: (bundle.room.streak_count || 1) + 1,
      };
    }

    persistDemoStore();
    const view = buildDemoView(bundle, userId, displayName, avatarEmoji);
    set({
      activeRoom: { ...bundle.room },
      todayRound: view.todayRound,
      cards: view.cards,
    });
  },
}));
