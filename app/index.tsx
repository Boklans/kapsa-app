import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  Image,
  ImageBackground,
  Platform,
  Share,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  colors,
  fonts,
  getAvatarPhotoUri,
  PORTRAIT_AVATARS,
  stitch,
} from '@/constants/colors';
import { AVATAR_EMOJIS, useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { DeckTag, RoomType } from '@/types/kapsa';

// Атмосферне фото узбережжя та дороги з правого боку колажу (як на шаблоні)
const HERO_COAST_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=80';
const FRIENDS_THUMB_IMAGE =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80';
const COUPLE_THUMB_IMAGE =
  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&q=80';

const DECK_LIST: { tag: DeckTag; label: string }[] = [
  { tag: 'core', label: 'База' },
  { tag: 'spicy', label: 'Гострі 🔥' },
  { tag: 'deep', label: 'Глибокі 🌙' },
  { tag: 'nostalgia', label: 'Спогади 📼' },
];

const CANDIDATES_SCREEN3 = [
  {
    id: 'maks',
    name: 'Макс',
    defaultRole: 'УЧАСНИК',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB2g6TJjAxHbVjdL8CyOoSkg7rEBd_hSRrmGDucQEDO-jyWblWN5TlVkoFR16UhTyFQ51qKAuOAXsK4owuf7sx1q5-oBBNZVhDqFUKmz9Jj9mzjCE8nvUStneHdVYgRNy-2xl5nkIGU8zLW5GDWukZQlDZ0-7glG0F9qCkzaWYRpVtqd_Mh02uFHvtJNJNILdjs3DrmgiN3zGX7S164clalkganf3Z60AQiCDeZzDOcxBcnd8Jd7jjyrA',
  },
  {
    id: 'olya',
    name: 'Оля',
    defaultRole: 'УЧАСНИЦЯ',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDxF_kJY7gkytdKek0PUzAEn1mFSGw29L9mjY2atwrgc6ikQgTADFqQ2E0FqS4CxXlhzYGkIUmTREDT2idVyvma5XLjhff4HSHB0Y11Lh0odpq4Mtg98muRpwe958pQ6YPo4YnE2RhcNcBVawxL9jE2sFdVR9RvsJ9djPuP1T_h-A-6lnXoIuZkm1kHhuLCboK8aSVaK1COyF7NO4fjibaFDpiLOV_SjbxJPxuQs0emE_uxDASwc8hroA',
  },
  {
    id: 'dima',
    name: 'Діма',
    defaultRole: 'УЧАСНИК',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAsBQc5ca0OUVPYeJzkD7Z4EX50nOi5qLj-_zAFKbD5WJGmoGB0Ox20zgsAP5UEHswitq28s6PC5lRe3qFobyPN9_A6bMaA52tGVrEIt4J234n0xUvuh7di2mr1RQ0sHxVdkx1uOmSyzhn5vG0rYb3r1moco7XV3YrUV5VfAx0O8NU2ZNOGBLnujgtoT73IkdWO7WgQmQdAiQAZWuzygxZZwVPSHIyFUUbmX93unVr39gR5rd_ei_cb4w',
  },
  {
    id: 'kateryna',
    name: 'Катерина',
    defaultRole: 'УЧАСНИЦЯ',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC9kAMJJSaWSy23laTbCUmsvE7xiJmvRcEesDzx039NGOYfZo6Vi0cmmMf8NCqj0l9raaKRPyxyl4GFHoknk-D7U1n47TOBYCjVn1TrtlciP-JrQXn4kfC3tELzDLHgJSrILfCPme0_PLwsqlmTtNv-MuUNz-6GgrthAptc1GnaeexZmhCXoF7eG0ziO-u1_AL95MKjpOqi4Jq-1fQG14vAaG5p_C6gN0zxNrDTH14w_pwn_3aTgFtyaQ',
  },
];

const PULSE_MEMBERS_SCREEN3 = [
  {
    id: 'anya',
    name: 'Аня',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBqXBbF1OEK_sIQiDDU5zNmYgAkyB8TQgXN68Fw0Y92nbunA5jw9KtbIiZfRSkpQlKGfye6r4LZmuSZNPpNJbx1Jkn0FFXoRERcGPbf-f5NlNzRNKfmL8AdiwgFmusHY5g9yEPVtKmrCLNsdOeJfuVn1NF1RU18tHQoteBApcAa3psNScIlbQ_LPG8sojbtsoNyT3x8fZ0om9j0kK3dUBv5GTKhJzBZbyh3rgd-zVT1b2pRYW7d4i1HzQ',
    status: 'locked' as const,
  },
  {
    id: 'taras',
    name: 'Тарас',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDWeU_3DVP1edG6XXFn3DDLZHlnnrZnwKgcFyNgbEdrQhyAmW1u9W9Ad8kSHOIOu8W7h9GoMc0m5fwcgobHYMSuPBS7_YTZy3mbpqYPJnuffbc521woWp13Q9IJwCUlXaO3ANjHR9vWeP9r6RvQOQOYKl6ZoUrmaCJMNdJB_s6eMcmqpS-Jne8VHVaDU08tqSkpFqb7kJfvkitQ0WpT8dRQfhJ5rZ2LySQ36--GEnzIdNyyP17mIyTAlg',
    status: 'locked' as const,
  },
  {
    id: 'me',
    name: 'Ти',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTgDUSIQbDsZ_nqpnuDlUgpniEZY98glp7A2RpgnjAgggzpaUXOnzVm67_B4exesY8dMdPE0zPEcOxU0xpVCS65VR3DAQn5gdKA0BdXWRBPKJioSt1sXELjK4qKdcnhG1e2DV87rLjT-e2qP9eRA3-RXBM-wfiCfqno_gI4RjrQOAzL3bwJG_8OiCO_iyCVYKCdOL-LlAMqiitRarB73CTPGpEx7vMmiT2tCyKVR-bJ2TFqHnPsxWtNg',
    status: 'me' as const,
  },
  {
    id: 'olya',
    name: 'Оля',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDxF_kJY7gkytdKek0PUzAEn1mFSGw29L9mjY2atwrgc6ikQgTADFqQ2E0FqS4CxXlhzYGkIUmTREDT2idVyvma5XLjhff4HSHB0Y11Lh0odpq4Mtg98muRpwe958pQ6YPo4YnE2RhcNcBVawxL9jE2sFdVR9RvsJ9djPuP1T_h-A-6lnXoIuZkm1kHhuLCboK8aSVaK1COyF7NO4fjibaFDpiLOV_SjbxJPxuQs0emE_uxDASwc8hroA',
    status: 'waiting' as const,
  },
  {
    id: 'dima',
    name: 'Діма',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAsBQc5ca0OUVPYeJzkD7Z4EX50nOi5qLj-_zAFKbD5WJGmoGB0Ox20zgsAP5UEHswitq28s6PC5lRe3qFobyPN9_A6bMaA52tGVrEIt4J234n0xUvuh7di2mr1RQ0sHxVdkx1uOmSyzhn5vG0rYb3r1moco7XV3YrUV5VfAx0O8NU2ZNOGBLnujgtoT73IkdWO7WgQmQdAiQAZWuzygxZZwVPSHIyFUUbmX93unVr39gR5rd_ei_cb4w',
    status: 'waiting' as const,
  },
];

const REVEAL_HOURS = [20, 21, 22];

type HomeTab = 'today' | 'circles' | 'fond' | 'memories' | 'create';

export default function HomeScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { displayName, avatarEmoji, updateProfile } = useAuthStore();
  const {
    rooms,
    activeRoom,
    todayRound,
    cards,
    loreItems,
    fetchMyRooms,
    loadRoomDashboard,
    submitRoundResponse,
    togglePinToLore,
    toggleCardReaction,
    rerollTodayQuestion,
    resetDemoMyResponse,
    createRoom,
  } = useRoomStore();

  const [activeTab, setActiveTab] = useState<HomeTab>('today');
  type TodayStage = 'hub' | 'vote' | 'waiting' | 'revealed';
  const [todayStage, setTodayStage] = useState<TodayStage>('hub');
  const [countdownText, setCountdownText] = useState('05:18:42');

  const [roomType, setRoomType] = useState<RoomType>('friends');
  const [roomName, setRoomName] = useState('');
  const [selectedDeck, setSelectedDeck] = useState<DeckTag>('core');
  const [revealHourIdx, setRevealHourIdx] = useState(1); // 21:00
  const [inviteCode, setInviteCode] = useState('');
  const [profileNameInput, setProfileNameInput] = useState(
    displayName === 'Ти' ? 'Маша' : displayName
  );
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [friendMoveNotificationEnabled, setFriendMoveNotificationEnabled] = useState(true);
  const [isCopiedProfileCode, setIsCopiedProfileCode] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showQuickJoinInput, setShowQuickJoinInput] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Стан для Екрана 3 (Голосування дня)
  const [selectedCandidate, setSelectedCandidate] = useState<'you' | 'maks'>('maks');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('maks');
  const [candidNoteText, setCandidNoteText] = useState('');
  const [isAnswerSealed, setIsAnswerSealed] = useState(false);
  const [fondFilter, setFondFilter] = useState<'all' | 'photo' | 'quote' | 'vote'>('all');
  const [homeReactions, setHomeReactions] = useState<Record<string, number>>({
    '😂': 4,
    '🔥': 2,
    '❤️': 2,
    '🥺': 1,
  });
  const [userHomeReacted, setUserHomeReacted] = useState<Record<string, boolean>>({});
  const [hasSavedLoreHome, setHasSavedLoreHome] = useState(false);
  const [quickReplyHome, setQuickReplyHome] = useState('');
  const [isPlayingAudioHome, setIsPlayingAudioHome] = useState(false);

  // Стан для Екрана 4 (Lore: Архів спогадів / Золотий фонд)
  const [loreRoomFilter, setLoreRoomFilter] = useState<'all' | 'friends' | 'couple'>('all');
  const [loreBookmarkSaved, setLoreBookmarkSaved] = useState(false);
  const [loreAudioPlaying, setLoreAudioPlaying] = useState(false);
  const [loreReactions, setLoreReactions] = useState<Record<string, number>>({
    '🍕': 4,
    '🌧️': 6,
    '❤️': 8,
  });
  const [userLoreReacted, setUserLoreReacted] = useState<Record<string, boolean>>({});
  const [showPhotobookModal, setShowPhotobookModal] = useState(false);

  const toggleLoreEmojiReaction = (emoji: string) => {
    setUserLoreReacted((prev) => {
      const already = prev[emoji];
      setLoreReactions((counts) => ({
        ...counts,
        [emoji]: already ? Math.max(0, (counts[emoji] || 0) - 1) : (counts[emoji] || 0) + 1,
      }));
      return { ...prev, [emoji]: !already };
    });
  };

  useEffect(() => {
    fetchMyRooms();
  }, [fetchMyRooms]);

  const currentRoom = activeRoom || rooms[0] || null;

  useEffect(() => {
    if (currentRoom) {
      loadRoomDashboard(currentRoom.id);
    }
  }, [currentRoom?.id]);

  useEffect(() => {
    const formatCountdown = (revealAtIso?: string): string => {
      if (!revealAtIso) return '05:18:42';
      const diffMs = new Date(revealAtIso).getTime() - Date.now();
      if (Number.isNaN(diffMs) || diffMs <= 0) return '00:00:00';
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    };

    const updateTimer = () => {
      const targetIso = todayRound?.reveal_at || new Date(new Date().setHours(21, 0, 0, 0)).toISOString();
      setCountdownText(formatCountdown(targetIso));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [todayRound?.reveal_at]);

  // Автоматична синхронізація стейту екрана зі стейт-машиною життєвого циклу раунду (Scheduled -> Open -> Revealed -> Archived)
  useEffect(() => {
    if (todayRound?.lifecycle_state === 'revealed' || todayRound?.is_fully_revealed) {
      setTodayStage('revealed');
    }
  }, [todayRound?.lifecycle_state, todayRound?.is_fully_revealed]);

  const myMember = cards.find(
    (c) => c.user_id === 'demo-user-me' || c.display_name === 'Ти' || c.display_name === displayName
  ) || {
    user_id: 'demo-user-me',
    display_name: 'Катерина (Ти)',
    avatar_emoji: '👩‍🦰',
    has_answered: false,
  };

  const partnerMember = cards.find(
    (c) => c.user_id !== myMember.user_id && c.display_name !== 'Ти'
  ) || cards[1] || {
    user_id: 'u-max',
    display_name: 'Макс',
    avatar_emoji: '🦊',
    has_answered: true,
  };

  const handleSealAnswer = async () => {
    const rId = currentRoom?.id || 'demo-couple';
    const roundId = todayRound?.round_id || `round-${rId}-vote`;
    const targetVotedId = selectedCandidateId || (selectedCandidate === 'maks' ? partnerMember.user_id : myMember.user_id);

    try {
      await submitRoundResponse({
        roomId: rId,
        roundId,
        textContent: candidNoteText.trim(),
        votedForUserId: targetVotedId,
      });
    } catch {}

    setIsAnswerSealed(true);
    setTodayStage('waiting');
  };

  const handleSelectDeck = async (deck: DeckTag) => {
    setSelectedDeck(deck);
    if (currentRoom) {
      await rerollTodayQuestion(currentRoom.id, deck);
    }
  };

  const handleToggleLoreSave = async () => {
    setHasSavedLoreHome((prev) => !prev);
    const targetCard = cards.find((c) => c.has_answered) || cards[0];
    if (targetCard && currentRoom && todayRound) {
      await togglePinToLore(currentRoom.id, todayRound.round_id, targetCard);
    }
  };

  const toggleHomeEmojiReaction = async (emoji: string) => {
    setHomeReactions((prev) => {
      const already = userHomeReacted[emoji];
      const cur = prev[emoji] || 0;
      return {
        ...prev,
        [emoji]: already ? Math.max(0, cur - 1) : cur + 1,
      };
    });
    setUserHomeReacted((prev) => ({
      ...prev,
      [emoji]: !prev[emoji],
    }));

    const targetCard = cards.find((c) => c.response_id) || cards[0];
    if (targetCard?.response_id && currentRoom && todayRound) {
      await toggleCardReaction(currentRoom.id, todayRound.round_id, targetCard.response_id, emoji);
    }
  };

  const handleCopyProfileInviteCode = async () => {
    const code = 'KAPS-8492';
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        setIsCopiedProfileCode(true);
        setTimeout(() => setIsCopiedProfileCode(false), 2200);
        return;
      } catch {}
    }
    try {
      await Share.share({
        message: `Залітай у мою приватну капсулу в KAPSA! Мій інвайт-код: ${code}`,
      });
      setIsCopiedProfileCode(true);
      setTimeout(() => setIsCopiedProfileCode(false), 2200);
    } catch {}
  };

  // Синхронізуємо вкладку при переході з параметрами (?tab=...)
  useEffect(() => {
    if (tab === 'today' || tab === 'home') setActiveTab('today');
    else if (tab === 'circles' || tab === 'rooms') setActiveTab('circles');
    else if (tab === 'fond' || tab === 'lore') setActiveTab('fond');
    else if (tab === 'memories' || tab === 'profile') setActiveTab('memories');
    else if (tab === 'create') setActiveTab('create');
  }, [tab]);

  const featuredRoom = currentRoom;
  const featuredQuestion =
    todayRound?.question_text ||
    'Хто з нас найімовірніше спонтанно купить квитки й зникне на вікенд? ✨';

  const getUkrainianDateLine = () => {
    const days = [
      'Неділя',
      'Понеділок',
      'Вівторок',
      'Середа',
      'Четвер',
      'Пʼятниця',
      'Субота',
    ];
    const months = [
      'січня',
      'лютого',
      'березня',
      'квітня',
      'травня',
      'червня',
      'липня',
      'серпня',
      'вересня',
      'жовтня',
      'листопада',
      'грудня',
    ];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dayNum = now.getDate();
    const monthName = months[now.getMonth()];
    const roundNum = todayRound?.round_number || 182;
    return `${dayName}, ${dayNum} ${monthName} • Раунд #${roundNum}`;
  };
  const featuredFormatLabel =
    todayRound?.prompt_format === 'show'
      ? 'Фото-момент'
      : todayRound?.prompt_format === 'answer'
      ? 'Історія дня'
      : 'Голосування';

  const userPortraitUri = getAvatarPhotoUri(avatarEmoji, 0);
  const friendlyName = displayName === 'Ти' ? 'Маша' : displayName;
  const isCustomPhotoAvatar =
    avatarEmoji.startsWith('http') || avatarEmoji.startsWith('data:image');

  const handleCreateRoom = async () => {
    setFormError(null);
    if (!roomName.trim()) {
      setFormError('Введи назву для нової кімнати');
      return;
    }

    try {
      const created = await createRoom(roomName, roomType);
      if (selectedDeck !== 'core') {
        await rerollTodayQuestion(created.id, selectedDeck);
      }
      setRoomName('');
      setActiveTab('today');
      router.push(`/room/${created.id}`);
    } catch (err: any) {
      setFormError(err?.message || 'Помилка створення кімнати');
    }
  };

  const handleOpenJoinScreen = () => {
    const clean = inviteCode.trim().toUpperCase();
    router.push(`/join/${clean || 'KAPS26'}`);
  };

  const handleSaveProfile = async (emoji?: string) => {
    await updateProfile(profileNameInput.trim() || 'Маша', emoji || avatarEmoji);
  };

  const handlePickCustomAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const customUri = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        if (customUri) {
          await handleSaveProfile(customUri);
        }
      }
    } catch {
      // ignore picker cancellation
    }
  };

  // =========================================================================
  // ЕКРАН 5 З ШАБЛОНУ: «Створи свою кімнату»
  // =========================================================================
  if (activeTab === 'create') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.createContainer}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backIconBtn}
            onPress={() => setActiveTab('today')}
          >
            <Feather name="chevron-left" size={20} color={colors.inkPrimary} />
          </TouchableOpacity>

          <Text style={styles.createTitle}>{'Створи\nсвою кімнату'}</Text>

          <Text style={styles.sectionBlockLabel}>Обери тип</Text>

          <View style={styles.typeCardsCol}>
            <TouchableOpacity
              style={[
                styles.typeEditorialCard,
                roomType === 'friends' && styles.typeEditorialCardActive,
              ]}
              onPress={() => setRoomType('friends')}
              activeOpacity={0.88}
            >
              <Image
                source={{ uri: FRIENDS_THUMB_IMAGE }}
                style={styles.typeCardThumb}
              />
              <View style={styles.typeCardContent}>
                <Text style={styles.typeCardTitle}>Банда 🔥</Text>
                <Text style={styles.typeCardCount}>3–8 людей</Text>
                <Text style={styles.typeCardHint}>Друзі, колеги, вайб</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeEditorialCard,
                roomType === 'couple' && styles.typeEditorialCardActive,
              ]}
              onPress={() => setRoomType('couple')}
              activeOpacity={0.88}
            >
              <Image
                source={{ uri: COUPLE_THUMB_IMAGE }}
                style={styles.typeCardThumb}
              />
              <View style={styles.typeCardContent}>
                <Text style={styles.typeCardTitle}>Пара ❤️</Text>
                <Text style={styles.typeCardCount}>2 людини</Text>
                <Text style={styles.typeCardHint}>Близькі, теплі, завжди</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionBlockLabel, { marginTop: 8 }]}>
            Налаштуй кімнату
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Назва кімнати</Text>
            <TextInput
              style={styles.editorialInput}
              placeholder={
                roomType === 'friends'
                  ? 'Наприклад: Банда з КПІ'
                  : 'Наприклад: Наші моменти'
              }
              placeholderTextColor={colors.inkMuted}
              value={roomName}
              onChangeText={(t) => {
                setRoomName(t);
                if (formError) setFormError(null);
              }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Час відкриття</Text>
            <TouchableOpacity
              style={styles.selectorRow}
              onPress={() =>
                setRevealHourIdx((prev) => (prev + 1) % REVEAL_HOURS.length)
              }
            >
              <Text style={styles.selectorValue}>
                {REVEAL_HOURS[revealHourIdx]}:00
              </Text>
              <Feather name="chevron-right" size={18} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Колода питань</Text>
            <TouchableOpacity
              style={styles.selectorRow}
              onPress={() => {
                const idx = DECK_LIST.findIndex((d) => d.tag === selectedDeck);
                const next = DECK_LIST[(idx + 1) % DECK_LIST.length];
                setSelectedDeck(next.tag);
              }}
            >
              <Text style={styles.selectorValue}>
                {DECK_LIST.find((d) => d.tag === selectedDeck)?.label || 'База'}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>

          {formError ? <Text style={styles.errorText}>⚠️ {formError}</Text> : null}

          <TouchableOpacity
            style={styles.charcoalPrimaryBtn}
            onPress={handleCreateRoom}
          >
            <Text style={styles.charcoalPrimaryBtnText}>Створити кімнату</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================= */}
        {/* TOP CONTEXT BAR (1-в-1 з Google Stitch TopAppBar)                 */}
        {/* ================================================================= */}
        {activeTab === 'today' && todayStage === 'hub' && (
          <View style={styles.hubHeader}>
            <View style={styles.hubHeaderLeft}>
              <TouchableOpacity
                accessibilityLabel="Конфіденційність"
                style={styles.hubHeaderIconBtn}
                onPress={() => {}}
                activeOpacity={0.8}
              >
                <Feather name="lock" size={17} color={stitch.onSurfaceVariant} />
              </TouchableOpacity>
              <Text style={styles.hubHeaderRoundTag}>
                РАУНД #{todayRound?.round_number || 182}
              </Text>
            </View>

            <View style={styles.hubHeaderCenter}>
              <Text style={styles.hubBrandTitle}>KAPSA</Text>
            </View>

            <View style={styles.hubHeaderRight}>
              <TouchableOpacity
                accessibilityLabel="Профіль користувача"
                style={styles.hubHeaderAvatarBtn}
                onPress={() => setActiveTab('memories')}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: userPortraitUri }}
                  style={styles.hubHeaderAvatarImg}
                />
                <View style={styles.hubHeaderOnlineDot} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 1: TODAY — ЕКРАН 1 (HOME HUB) / ЕКРАН 3 (ГОЛОСУВАННЯ) / ЕКРАН 2 (РОЗКРИТТЯ) */}
        {/* ================================================================= */}
        {activeTab === 'today' && (
          todayStage === 'hub' ? (
            /* ============================================================= */
            /* SCREEN 1: ГОЛОВНИЙ ЕКРАН ДНЯ (HOME HUB) — GOOGLE STITCH       */
            /* ============================================================= */
            <View style={styles.hubContainer}>
              {/* Editorial Dateline & Sub-header */}
              <View style={styles.hubDatelineRow}>
                <Text style={styles.hubDatelineText}>
                  {getUkrainianDateLine()}
                </Text>
                <View style={styles.hubDatelineTimer}>
                  <Feather name="clock" size={13} color={stitch.onSurfaceVariant} />
                  <Text style={styles.hubDatelineTimerText}>До 21:00</Text>
                </View>
              </View>

              {/* Visual Focal Point: Daily Prompt Card (Editorial Living Photobook Frame) */}
              <View style={styles.hubFocalCard}>
                {/* Header Info within Prompt */}
                <View style={styles.hubFocalHeader}>
                  <Text style={styles.hubFocalRoomTag}>
                    {featuredRoom
                      ? `${featuredRoom.name} • ${featuredRoom.type === 'couple' ? 'Пара' : 'Компанія'}`
                      : 'ЧСМ ❤️ • Пара'}
                  </Text>
                  <View
                    style={[
                      styles.hubFocalTurnBadge,
                      (isAnswerSealed || myMember.has_answered) && styles.hubFocalSealedBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.hubFocalTurnBadgeText,
                        (isAnswerSealed || myMember.has_answered) && styles.hubFocalSealedBadgeText,
                      ]}
                    >
                      {isAnswerSealed || myMember.has_answered ? 'ЗАПЕЧАТАНО' : 'ТВІЙ ХІД'}
                    </Text>
                  </View>
                </View>

                {/* The Central Prompt Typography */}
                <View style={styles.hubFocalQuestionWrap}>
                  <Text style={styles.hubFocalQuestionMeta}>ПИТАННЯ ДНЯ</Text>
                  <Text style={styles.hubFocalQuestionText}>
                    «{featuredQuestion}»
                  </Text>
                </View>

                {/* Participant Pulse & Status */}
                <View style={styles.hubFocalPulseSection}>
                  <View style={styles.hubFocalPulseHeader}>
                    <Text style={styles.hubFocalPulseTitle}>
                      ПУЛЬС КАПСУЛИ • {isAnswerSealed || myMember.has_answered ? '2 з 2 відповіли' : '1 з 2 відповіли'}
                    </Text>
                    <Text style={styles.hubFocalPulseSub}>
                      Макс запечатав о 19:42
                    </Text>
                  </View>

                  {/* Avatars Row with Interaction Feedback */}
                  <View style={styles.hubFocalAvatarsRow}>
                    {/* Partner Avatar (Completed) */}
                    <View style={styles.hubFocalAvatarCol}>
                      <View style={styles.hubFocalAvatarWrap}>
                        <Image
                          source={{ uri: PORTRAIT_AVATARS['🦊'] }}
                          style={styles.hubFocalAvatarImg}
                        />
                        <View style={styles.hubFocalCheckBadge}>
                          <Feather name="check" size={11} color={stitch.primary} />
                        </View>
                      </View>
                      <Text style={styles.hubFocalAvatarName}>Макс</Text>
                      <Text style={styles.hubFocalAvatarSubDone}>хід зроблено</Text>
                    </View>

                    {/* Current User Avatar */}
                    <View style={styles.hubFocalAvatarCol}>
                      <View
                        style={[
                          styles.hubFocalAvatarWrap,
                          !(isAnswerSealed || myMember.has_answered) && styles.hubFocalAvatarWrapActive,
                        ]}
                      >
                        <Image
                          source={{ uri: userPortraitUri }}
                          style={styles.hubFocalAvatarImg}
                        />
                        {isAnswerSealed || myMember.has_answered ? (
                          <View style={styles.hubFocalCheckBadge}>
                            <Feather name="check" size={11} color={stitch.primary} />
                          </View>
                        ) : (
                          <View style={styles.hubFocalYouBadge}>
                            <Text style={styles.hubFocalYouBadgeText}>ТИ</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.hubFocalAvatarName,
                          !(isAnswerSealed || myMember.has_answered) && styles.hubFocalAvatarNameActive,
                        ]}
                      >
                        Ти
                      </Text>
                      <Text
                        style={[
                          styles.hubFocalAvatarSubDone,
                          !(isAnswerSealed || myMember.has_answered) && styles.hubFocalAvatarSubAction,
                        ]}
                      >
                        {isAnswerSealed || myMember.has_answered ? 'хід зроблено' : 'твій хід 🔥'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Primary Action Call to Action Button */}
                {isAnswerSealed || myMember.has_answered ? (
                  <TouchableOpacity
                    style={styles.hubFocalWaitingBtn}
                    onPress={() => setTodayStage('waiting')}
                    activeOpacity={0.88}
                  >
                    <Feather name="lock" size={15} color={stitch.onSurfaceVariant} />
                    <Text style={styles.hubFocalWaitingBtnText}>
                      Капсулу запечатано • Розкриття о 21:00
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.hubFocalPrimaryBtn}
                    onPress={() => setTodayStage('vote')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.hubFocalPrimaryBtnText}>Відповісти на питання</Text>
                    <Feather name="arrow-right" size={17} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Secondary Section: My Rooms (Мої кімнати (2)) */}
              <View style={styles.hubRoomsSection}>
                <View style={styles.hubRoomsHeader}>
                  <Text style={styles.hubRoomsTitle}>
                    МОЇ КІМНАТИ ({Math.max(rooms.length, 2)})
                  </Text>
                  <TouchableOpacity
                    style={styles.hubRoomsCreateBtn}
                    onPress={() => setActiveTab('create')}
                    activeOpacity={0.8}
                  >
                    <Feather name="plus" size={13} color={stitch.secondary} />
                    <Text style={styles.hubRoomsCreateBtnText}>Створити</Text>
                  </TouchableOpacity>
                </View>

                {/* Room 1: Банда з КПІ 🔥 */}
                <TouchableOpacity
                  style={styles.hubRoomCard}
                  onPress={() => {
                    const r = rooms.find((item) => item.name.includes('КПІ')) || rooms[1] || rooms[0];
                    if (r) {
                      loadRoomDashboard(r.id);
                      router.push(`/room/${r.id}`);
                    } else {
                      setActiveTab('circles');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.hubRoomCardLeft}>
                    <View style={styles.hubRoomCardImgWrap}>
                      <Image
                        source={{
                          uri: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
                        }}
                        style={styles.hubRoomCardImg}
                      />
                    </View>
                    <View style={styles.hubRoomCardInfo}>
                      <Text style={styles.hubRoomCardTitle}>Банда з КПІ 🔥</Text>
                      <View style={styles.hubRoomCardStatusRow}>
                        <View style={styles.hubRoomStatusDot} />
                        <Text style={styles.hubRoomCardStatusText}>
                          2 з 5 відповіли • Розкриття о 21:00
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.hubRoomCardRight}>
                    <Text style={styles.hubRoomMembersMeta}>5 учасників</Text>
                    <Feather name="arrow-up-right" size={16} color={stitch.outline} />
                  </View>
                </TouchableOpacity>

                {/* Room 2: Подільські кавомани ☕ */}
                <TouchableOpacity
                  style={styles.hubRoomCard}
                  onPress={() => {
                    const r = rooms.find((item) => item.name.includes('кавомани')) || rooms[2] || rooms[0];
                    if (r) {
                      loadRoomDashboard(r.id);
                      router.push(`/room/${r.id}`);
                    } else {
                      setActiveTab('circles');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.hubRoomCardLeft}>
                    <View style={styles.hubRoomCardImgWrap}>
                      <Image
                        source={{
                          uri: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80',
                        }}
                        style={styles.hubRoomCardImg}
                      />
                    </View>
                    <View style={styles.hubRoomCardInfo}>
                      <Text style={styles.hubRoomCardTitle}>Подільські кавомани ☕</Text>
                      <View style={styles.hubRoomCardStatusRow}>
                        <View style={[styles.hubRoomStatusDot, { backgroundColor: stitch.secondary }]} />
                        <Text style={[styles.hubRoomCardStatusText, { color: stitch.secondary, fontWeight: '600' }]}>
                          Очікуємо твою відповідь
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.hubRoomCardRight}>
                    <Text style={styles.hubRoomMembersMeta}>4 учасники</Text>
                    <Feather name="arrow-up-right" size={16} color={stitch.outline} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Quiet Card at the Bottom: Memory of the Day from Lore */}
              <View style={styles.hubLoreCard}>
                <View style={styles.hubLoreCardHeader}>
                  <View style={styles.hubLoreCardHeaderLeft}>
                    <Feather name="bookmark" size={14} color={stitch.secondary} />
                    <Text style={styles.hubLoreCardTag}>СПОГАД ЦЬОГО ДНЯ З LORE</Text>
                  </View>
                  <Text style={styles.hubLoreCardTime}>Рік тому</Text>
                </View>

                <View style={styles.hubLoreCardBody}>
                  <View style={styles.hubLoreCardImgWrap}>
                    <Image
                      source={{
                        uri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80',
                      }}
                      style={styles.hubLoreCardImg}
                    />
                  </View>
                  <View style={styles.hubLoreCardContent}>
                    <Text style={styles.hubLoreCardQuote}>
                      «Той вечір у Львові: піца під дощем...»
                    </Text>
                    <Text style={styles.hubLoreCardExcerpt} numberOfLines={2}>
                      Забігли в найближчу браму біля площі Ринок, ділили одну салямі на двох і рахували спалахи блискавок над ратушею.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveTab('fond')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.hubLoreCardLink}>
                        Гортати фотокапсулу →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ) : todayStage === 'vote' ? (
            /* ============================================================= */
            /* SCREEN 3: РАУНД: ГОЛОСУВАННЯ (BEFORE SUBMISSION)              */
            /* ============================================================= */
            <View style={styles.voteScreenWrapper}>
              {/* Top Bar Component */}
              <View style={styles.voteTopBarHeader}>
                <TouchableOpacity
                  style={styles.voteBackToRoomsBtn}
                  onPress={() => setTodayStage('hub')}
                  activeOpacity={0.8}
                >
                  <Feather name="arrow-left" size={17} color={stitch.onSurfaceVariant} />
                  <Text style={styles.voteBackToRoomsText}>До кімнат</Text>
                </TouchableOpacity>

                <View style={styles.voteTopRightPills}>
                  <View style={styles.voteRoomBadge}>
                    <Text style={styles.voteRoomBadgeName} numberOfLines={1}>
                      {currentRoom?.name || 'Банда з КПІ 🔥'}
                    </Text>
                    <Feather name="lock" size={12} color={stitch.onSurfaceVariant} />
                  </View>

                  <View style={styles.voteTimerBadge}>
                    <Feather name="clock" size={12} color={stitch.secondary} />
                    <Text style={styles.voteTimerBadgeText}>До 21:00</Text>
                  </View>
                </View>
              </View>

              <View style={styles.voteMainContent}>
                {/* Category Chip & Meta */}
                <View style={styles.voteCategoryMetaRow}>
                  <View style={styles.voteCategoryPill}>
                    <View style={styles.voteCategoryDot} />
                    <Text style={styles.voteCategoryPillText}>
                      Голосування дня • Раунд #{todayRound?.round_number || 182}
                    </Text>
                  </View>
                  <Text style={styles.voteProgressText}>2/5 ГОТОВО</Text>
                </View>

                {/* Main Daily Prompt */}
                <View style={styles.votePromptSection}>
                  <Text style={styles.votePromptTitle}>
                    «{featuredQuestion || 'Хто з нас найімовірніше заснув би просто посеред гучної вечірки? ✨'}»
                  </Text>
                  <Text style={styles.votePromptSubtext}>
                    Обери одного учасника. Твій вибір залишиться таємницею до моменту запечатування о 21:00.
                  </Text>
                </View>

                {/* Delicate Monograph Rule Divider */}
                <View style={styles.voteDividerRule} />

                {/* Interactive Participant Voting Grid (2x2) */}
                <View style={styles.voteGridSection}>
                  <View style={styles.voteGridHeaderRow}>
                    <Text style={styles.voteGridHeaderTitle}>Твій кандидат</Text>
                    <View style={styles.voteGridVotesCountRow}>
                      <Feather name="check-circle" size={13} color={stitch.secondary} />
                      <Text style={styles.voteGridVotesCountText}>1 голос</Text>
                    </View>
                  </View>

                  <View style={styles.vote2x2Grid}>
                    {CANDIDATES_SCREEN3.map((candidate) => {
                      const isSelected = selectedCandidateId === candidate.id;
                      return (
                        <TouchableOpacity
                          key={candidate.id}
                          style={[
                            styles.voteCandidateCard,
                            isSelected && styles.voteCandidateCardSelected,
                          ]}
                          onPress={() => {
                            setSelectedCandidateId(candidate.id);
                            setSelectedCandidate(candidate.id === 'maks' ? 'maks' : 'you');
                          }}
                          activeOpacity={0.88}
                        >
                          {isSelected && (
                            <View style={styles.voteCandidateActiveBadge}>
                              <Feather name="check" size={12} color="#FFFFFF" />
                            </View>
                          )}

                          <View
                            style={[
                              styles.voteCandidateAvatarWrap,
                              isSelected && styles.voteCandidateAvatarWrapSelected,
                            ]}
                          >
                            <Image
                              source={{ uri: candidate.avatar }}
                              style={styles.voteCandidateAvatarImg}
                            />
                          </View>

                          <Text style={styles.voteCandidateName}>{candidate.name}</Text>
                          <Text
                            style={[
                              styles.voteCandidateRoleText,
                              isSelected && styles.voteCandidateRoleTextSelected,
                            ]}
                          >
                            {isSelected ? 'ТВІЙ ВИБІР' : candidate.defaultRole}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Optional Comment / Inside Joke Field */}
                <View style={styles.voteCommentSection}>
                  <Text style={styles.voteCommentLabel}>
                    ЧОМУ САМЕ ВІН/ВОНА? <Text style={styles.voteCommentLabelSub}>(необовʼязково)</Text>
                  </Text>
                  <View style={styles.voteCommentInputBox}>
                    <TextInput
                      style={styles.voteCommentTextInput}
                      placeholder="Додай жарт або спогад..."
                      placeholderTextColor={stitch.outline}
                      multiline
                      maxLength={140}
                      value={candidNoteText}
                      onChangeText={setCandidNoteText}
                    />
                    <View style={styles.voteCommentFooterRow}>
                      <View style={styles.voteCommentLockRow}>
                        <Feather name="lock" size={12} color={stitch.outline} />
                        <Text style={styles.voteCommentLockText}>Збережеться у літописі</Text>
                      </View>
                      <Text style={styles.voteCommentCounterText}>{candidNoteText.length}/140</Text>
                    </View>
                  </View>
                </View>

                {/* Blind Submission Room Status Section (Пульс кімнати) */}
                <View style={styles.votePulseCard}>
                  <View style={styles.votePulseHeaderRow}>
                    <View style={styles.votePulseTitleLeft}>
                      <View style={styles.votePulseLiveDot} />
                      <Text style={styles.votePulseCardTitle}>Пульс кімнати</Text>
                    </View>
                    <Text style={styles.votePulseRatioText}>2 з 5 зробили хід</Text>
                  </View>

                  <View style={styles.votePulseMembersRow}>
                    {PULSE_MEMBERS_SCREEN3.map((m) => {
                      const isMe = m.status === 'me';
                      const isWaiting = m.status === 'waiting';
                      const isLocked = m.status === 'locked';

                      return (
                        <View
                          key={m.id}
                          style={[
                            styles.votePulseMemberCol,
                            isWaiting && { opacity: 0.5 },
                          ]}
                        >
                          <View
                            style={[
                              styles.votePulseMemberAvatarWrap,
                              isLocked && styles.votePulseMemberAvatarWrapLocked,
                              isMe && styles.votePulseMemberAvatarWrapMe,
                            ]}
                          >
                            <Image
                              source={{ uri: m.avatar }}
                              style={styles.votePulseMemberAvatarImg}
                            />
                            {isLocked && (
                              <View style={styles.votePulseLockBadge}>
                                <Feather name="lock" size={9} color="#FFFFFF" />
                              </View>
                            )}
                            {isMe && (
                              <View style={styles.votePulseEditBadge}>
                                <Feather name="edit-2" size={9} color="#FFFFFF" />
                              </View>
                            )}
                            {isWaiting && (
                              <View style={styles.votePulseWaitingBadge}>
                                <Feather name="clock" size={9} color={stitch.outline} />
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.votePulseMemberName,
                              isMe && styles.votePulseMemberNameBold,
                            ]}
                          >
                            {m.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.votePulseBlurFooterRow}>
                    <Feather name="eye-off" size={13} color={stitch.outline} />
                    <Text style={styles.votePulseBlurFooterText}>
                      Відповіді розмиті до загального відкриття
                    </Text>
                  </View>
                </View>

                {/* Primary Action CTA */}
                <View style={styles.voteSealActionWrap}>
                  <TouchableOpacity
                    style={styles.voteSealActionBtn}
                    onPress={handleSealAnswer}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.voteSealActionBtnText}>Запечатати свій хід</Text>
                    <Feather name="lock" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.voteSealActionNotice}>
                    Після запечатування вибір змінити не можна
                  </Text>
                </View>
              </View>
            </View>
          ) : todayStage === 'waiting' ? (
            /* ============================================================= */
            /* SCREEN 2: ЗАПЕЧАТАНО СУРГУЧЕМ (WAITING STATE ДО 21:00)        */
            /* ============================================================= */
            <View style={styles.stitchSealedWaitingCanvas}>
              {/* Back to Home Hub button */}
              <TouchableOpacity
                style={styles.voteBackButton}
                onPress={() => setTodayStage('hub')}
                activeOpacity={0.8}
              >
                <Feather name="arrow-left" size={15} color={colors.inkPrimary} />
                <Text style={styles.voteBackButtonText}>На головну</Text>
              </TouchableOpacity>
              {/* Ribbon */}
              <View style={styles.stitchRibbonRow}>
                <View style={styles.stitchRibbonLeft}>
                  <Text style={styles.stitchRibbonMeta}>
                    {featuredRoom?.name || 'ЧСМ Duo'} · РАУНД #19
                  </Text>
                  <View style={styles.stitchRibbonDot} />
                  <Text style={styles.stitchRibbonSub}>Запечатано</Text>
                </View>

                <TouchableOpacity
                  style={styles.stitchRibbonRight}
                  onPress={() => setActiveTab('fond')}
                >
                  <Feather name="star" size={12} color={colors.terracotta} />
                  <Text style={styles.stitchRibbonLoreLink}>Lore ({loreItems.length || 6}) ★</Text>
                </TouchableOpacity>
              </View>

              {/* Wax Seal Hero Card */}
              <View style={styles.stitchWaxSealHeroCard}>
                <View style={styles.stitchWaxSealEmblem}>
                  <Feather name="lock" size={26} color="#FFFFFF" />
                </View>

                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={styles.stitchWaxSealHeroTitle}>
                    Твій голос під сургучем
                  </Text>
                  <Text style={styles.stitchWaxSealHeroSub}>
                    Відповідь надійно зашифрована й не розкриється до 21:00.
                  </Text>
                </View>

                {/* Question Quote */}
                <Text style={{ fontFamily: fonts.serif, fontSize: 16, fontStyle: 'italic', textAlign: 'center', color: colors.inkPrimary, paddingHorizontal: 8 }}>
                  «{featuredQuestion}»
                </Text>

                {/* Countdown Timer Box */}
                <View style={styles.stitchCountdownTimerBox}>
                  <Text style={styles.stitchCountdownLabel}>ТАЄМНИЦЯ ВІДКРИЄТЬСЯ ЧЕРЕЗ</Text>
                  <Text style={styles.stitchCountdownDigits}>{countdownText}</Text>
                  <Text style={{ fontSize: 11, color: colors.inkMuted, textAlign: 'center' }}>
                    О 21:00 або коли ви обидва зробите хід — сургуч розплавиться для вас обох
                  </Text>
                </View>

                {/* Your sealed choice preview */}
                <View style={styles.stitchMySealedChoiceCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.stitchMyChoiceLabel}>ТВІЙ ЗАПЕЧАТАНИЙ ВИБІР</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="shield" size={11} color={colors.terracotta} />
                      <Text style={{ fontSize: 10, color: colors.terracotta, fontWeight: '700' }}>ПРИХОВАНО</Text>
                    </View>
                  </View>
                  <Text style={styles.stitchMyChoiceCandidate}>
                    {selectedCandidate === 'maks' ? `👑 ${partnerMember.display_name}` : `🙋 ${myMember.display_name}`}
                  </Text>
                  {candidNoteText.trim().length > 0 && (
                    <Text style={styles.stitchMyChoiceNote}>
                      «{candidNoteText.trim()}»
                    </Text>
                  )}
                </View>
              </View>

              {/* Chamber Pulse */}
              <View style={styles.stitchPulseBox}>
                <View style={styles.stitchPulseHeaderRow}>
                  <Text style={styles.stitchPulseHeaderTitle}>ПУЛЬС КІМНАТИ</Text>
                  <Text style={styles.stitchPulseHeaderCount}>
                    {partnerMember.has_answered ? '2/2 В СИНКУ 🔥' : '1/2 В СИНКУ'}
                  </Text>
                </View>

                <View style={styles.stitchPulseTilesRow}>
                  {/* You */}
                  <View style={styles.stitchPulseTile}>
                    <View style={styles.stitchPulseAvatarWrap}>
                      <Image
                        source={{ uri: userPortraitUri }}
                        style={styles.stitchPulseAvatar}
                      />
                      <View style={styles.stitchPulseCheckBadge}>
                        <Feather name="check" size={9} color="#FFFFFF" />
                      </View>
                    </View>
                    <View>
                      <Text style={styles.stitchPulseMemberName}>Ти</Text>
                      <Text style={styles.stitchPulseMemberStatusDone}>Запечатано ✓</Text>
                    </View>
                  </View>

                  {/* Partner */}
                  <View style={styles.stitchPulseTile}>
                    <View style={styles.stitchPulseAvatarWrap}>
                      <Image
                        source={{ uri: PORTRAIT_AVATARS['🦊'] }}
                        style={styles.stitchPulseAvatar}
                      />
                      {partnerMember.has_answered ? (
                        <View style={styles.stitchPulseCheckBadge}>
                          <Feather name="check" size={9} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.stitchPulseWaitingBadge}>
                          <Text style={{ fontSize: 9, color: colors.inkSecondary, fontWeight: '700' }}>⏳</Text>
                        </View>
                      )}
                    </View>
                    <View>
                      <Text style={styles.stitchPulseMemberName}>{partnerMember.display_name}</Text>
                      <Text style={partnerMember.has_answered ? styles.stitchPulseMemberStatusDone : styles.stitchPulseMemberStatusPending}>
                        {partnerMember.has_answered ? 'Запечатано ✓' : 'Очікуємо хід ⏳'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={styles.stitchSimulateRevealBtn}
                  onPress={() => setTodayStage('revealed')}
                  activeOpacity={0.88}
                >
                  <Ionicons name="sparkles" size={17} color="#FFFFFF" />
                  <Text style={styles.stitchSimulateRevealBtnText}>
                    Розпечатати таємницю (Екран 21:00) →
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stitchEditChoiceBtn}
                  onPress={() => setTodayStage('vote')}
                  activeOpacity={0.88}
                >
                  <Feather name="edit-2" size={14} color={colors.inkPrimary} />
                  <Text style={styles.stitchEditChoiceBtnText}>
                    Змінити свій голос (поки не 21:00)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ============================================================= */
            /* SCREEN 2: РАУНД РОЗПЕЧАТАНО О 21:00 (REVEALED) — GOOGLE STITCH */
            /* ============================================================= */
            <View style={styles.stitchRevealedCanvas}>
              {/* Top Navigation Row */}
              <View style={styles.revealedTopNavRow}>
                <TouchableOpacity
                  style={styles.revealedBackBtn}
                  onPress={() => setTodayStage('hub')}
                  activeOpacity={0.8}
                >
                  <Feather name="arrow-left" size={17} color={stitch.primary} />
                  <Text style={styles.revealedBackBtnText}>На головну</Text>
                </TouchableOpacity>

                <View style={styles.revealedRoomBadge}>
                  <View style={styles.revealedRoomBadgeDot} />
                  <Text style={styles.revealedRoomBadgeName}>
                    {featuredRoom?.name || 'Банда з КПІ 🔥'}
                  </Text>
                </View>
              </View>

              {/* 1. Unveiling Celebration Badge & Tags */}
              <View style={styles.stitchUnveilSection}>
                <View style={styles.stitchUnveilTopRow}>
                  <View style={styles.stitchWaxSealPill}>
                    <Feather name="unlock" size={13} color="#FFFFFF" />
                    <Text style={styles.stitchWaxSealPillText}>РОЗПЕЧАТАНО О 21:00</Text>
                  </View>

                  <View style={styles.stitchTagsRow}>
                    <View style={styles.stitchTagPill}>
                      <Text style={styles.stitchTagPillText}>#База</Text>
                    </View>
                    <View style={styles.stitchTagPill}>
                      <Text style={styles.stitchTagPillText}>#Спогади</Text>
                    </View>
                  </View>
                </View>

                {/* Daily Question / Prompt */}
                <View style={styles.revealedQuestionWrap}>
                  <Text style={styles.revealedQuestionMeta}>ПИТАННЯ ДНЯ</Text>
                  <Text style={styles.stitchRevealedQuestion}>
                    «{featuredQuestion || 'Хто з нас найімовірніше заснув би просто посеред гучної вечірки? ✨'}»
                  </Text>
                  <View style={styles.stitchMonographRule} />
                </View>
              </View>

              {/* 2. The Consensus Match Banner */}
              <View style={styles.stitchMatchBanner}>
                <View style={styles.stitchMatchIconWrap}>
                  <Ionicons name="sparkles" size={20} color={stitch.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.stitchMatchBadgeRow}>
                    <Text style={styles.stitchMatchBadgeText}>ОДНОГОЛОСНО</Text>
                    <Text style={styles.stitchMatchRatioText}>• 4 з 5 збіглися</Text>
                  </View>
                  <Text style={styles.stitchMatchTitle}>
                    80% ЗБІГ! Всі вказали на Макса 😂
                  </Text>
                  <Text style={styles.stitchMatchDesc}>
                    Жодних сумнівів: титул «соні вечора» беззаперечно переходить до Максима. Навіть диван у клубі пам'ятає цей тріумф.
                  </Text>
                </View>
              </View>

              {/* 3. Voting Breakdown Cards (Asymmetric Bento Grid) */}
              <View style={styles.stitchBreakdownSection}>
                <View style={styles.stitchBreakdownHeaderRow}>
                  <Text style={styles.stitchBreakdownHeaderTitle}>РЕЗУЛЬТАТИ ГОЛОСУВАННЯ</Text>
                  <Text style={styles.stitchBreakdownCountText}>5 учасників</Text>
                </View>

                <View style={styles.stitchBreakdownGrid}>
                  {/* Winner Card (Макс) */}
                  <View style={styles.stitchWinnerCard}>
                    <View style={styles.stitchWinnerBadge}>
                      <Feather name="check" size={10} color="#FFFFFF" />
                      <Text style={styles.stitchWinnerBadgeText}>ПЕРЕМОЖЕЦЬ</Text>
                    </View>

                    <View style={styles.stitchBreakdownAvatarWrap}>
                      <Image
                        source={{ uri: PORTRAIT_AVATARS['🦊'] }}
                        style={styles.stitchBreakdownAvatarImg}
                      />
                      <View style={styles.stitchWinnerCheckCircle}>
                        <Feather name="check" size={11} color="#FFFFFF" />
                      </View>
                    </View>

                    <Text style={styles.stitchBreakdownCandidateName}>Макс</Text>
                    <Text style={styles.stitchBreakdownWinnerPct}>4 голоси (80%)</Text>

                    <View style={styles.winnerProgressBarBg}>
                      <View style={[styles.winnerProgressBarFill, { width: '80%' }]} />
                    </View>

                    <Text style={styles.stitchBreakdownVotersSub}>
                      Ти, Катерина, Оля, Влад
                    </Text>
                  </View>

                  {/* Runner-up Card (Діма) */}
                  <View style={styles.stitchRunnerUpCard}>
                    <View style={styles.stitchBreakdownAvatarWrap}>
                      <Image
                        source={{ uri: PORTRAIT_AVATARS['🔥'] || getAvatarPhotoUri(undefined, 2) }}
                        style={styles.stitchBreakdownAvatarImg}
                      />
                    </View>

                    <Text style={styles.stitchBreakdownCandidateName}>Діма</Text>
                    <Text style={styles.stitchBreakdownMutedPct}>1 голос (20%)</Text>

                    <View style={styles.winnerProgressBarBg}>
                      <View style={[styles.runnerUpProgressBarFill, { width: '20%' }]} />
                    </View>

                    <Text style={styles.stitchBreakdownVotersSub}>
                      Проголосував сам Макс
                    </Text>
                  </View>
                </View>
              </View>

              {/* 4. Revealed Comments & Stories Feed */}
              <View style={styles.stitchStoriesSection}>
                <View style={styles.stitchStoriesHeaderRow}>
                  <Text style={styles.stitchStoriesSectionTitle}>РОЗПЕЧАТАНІ КОМЕНТАРІ ТА ІСТОРІЇ</Text>
                  <Text style={styles.stitchStoriesCountText}>2 нотатки</Text>
                </View>

                {/* Story 1: Maks (Self confession & Voice note) */}
                <View style={styles.stitchStoryCard}>
                  <View style={styles.stitchStoryHeaderRow}>
                    <View style={styles.stitchStoryAuthorRow}>
                      <Image
                        source={{ uri: PORTRAIT_AVATARS['🦊'] }}
                        style={styles.stitchStoryMiniAvatar}
                      />
                      <Text style={styles.stitchStoryAuthorName}>Макс</Text>
                      <Text style={styles.stitchStoryTime}>• Внесено о 19:42</Text>
                    </View>
                    <Feather name="unlock" size={14} color={stitch.outline} />
                  </View>

                  <Text style={styles.stitchStoryQuote}>
                    «Я навіть не сперечаюся. Моє ліжко — це святе місце, а вечірки після 23:00 — це вже подвиг. Здався сам! 😴»
                  </Text>

                  {/* Mini Voice Note Component */}
                  <View style={styles.stitchVoiceArtifactCard}>
                    <TouchableOpacity
                      style={styles.stitchVoicePlayBtn}
                      onPress={() => setIsPlayingAudioHome((prev) => !prev)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isPlayingAudioHome ? 'pause' : 'play'}
                        size={18}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>

                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.stitchVoiceWaveformRow}>
                        {[8, 14, 20, 24, 16, 22, 26, 18, 20, 12, 16, 24, 14, 10, 18, 12].map((h, i) => (
                          <View
                            key={i}
                            style={[
                              styles.stitchWaveBar,
                              { height: h },
                              isPlayingAudioHome && i % 2 === 0 && { backgroundColor: stitch.secondary },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.stitchVoiceMetaRow}>
                        <Text style={styles.stitchVoiceTitle}>Голосове зізнання Макса</Text>
                        <Text style={styles.stitchVoiceDuration}>0:14</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Story 2: Kateryna (Story & Matting Photo Artifact) */}
                <View style={styles.stitchStoryCard}>
                  <View style={styles.stitchStoryHeaderRow}>
                    <View style={styles.stitchStoryAuthorRow}>
                      <Image
                        source={{ uri: userPortraitUri }}
                        style={styles.stitchStoryMiniAvatar}
                      />
                      <Text style={styles.stitchStoryAuthorName}>Катерина</Text>
                      <View style={styles.stitchAuthorTag}>
                        <Text style={styles.stitchAuthorTagText}>АВТОР</Text>
                      </View>
                      <Text style={styles.stitchStoryTime}>• Внесено о 20:14</Text>
                    </View>
                    <Feather name="unlock" size={14} color={stitch.outline} />
                  </View>

                  <Text style={styles.stitchStoryQuote}>
                    «{candidNoteText || 'Пам\'ятаєш ту поїздку до Львова, коли ти заснув на дивані в клубі о першій ночі з келихом сидру в руці? 😂 Це було легендарно.'}»
                  </Text>

                  {/* Matting Photo Artifact */}
                  <View style={styles.revealedPhotoArtifact}>
                    <View style={styles.revealedPhotoWrap}>
                      <Image
                        source={{
                          uri: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
                        }}
                        style={styles.revealedPhotoImg}
                      />
                    </View>
                    <View style={styles.revealedPhotoFooter}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Feather name="map-pin" size={11} color={stitch.onSurfaceVariant} />
                        <Text style={styles.revealedPhotoLocation}>Львів, листопад 2023</Text>
                      </View>
                      <Text style={styles.revealedPhotoArchive}>Архів #49</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 5. Duet Reactions & Quick Chat */}
              <View style={styles.stitchReactionsSection}>
                <View style={styles.stitchEmojiChipsRow}>
                  {Object.entries(homeReactions).map(([em, cnt]) => {
                    const isActive = Boolean(userHomeReacted[em]);
                    return (
                      <TouchableOpacity
                        key={em}
                        style={[
                          styles.stitchEmojiChip,
                          isActive && styles.stitchEmojiChipActive,
                        ]}
                        onPress={() => toggleHomeEmojiReaction(em)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.stitchEmojiText}>{em}</Text>
                        <Text style={[styles.stitchEmojiCount, isActive && { color: stitch.secondary }]}>
                          {cnt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Quick chat reply */}
                <View style={styles.stitchQuickReplyRow}>
                  <TextInput
                    style={styles.stitchQuickReplyInput}
                    placeholder="Напиши щось Максу..."
                    placeholderTextColor={stitch.onSurfaceVariant}
                    value={quickReplyHome}
                    onChangeText={setQuickReplyHome}
                  />
                  <TouchableOpacity
                    style={styles.stitchQuickSendBtn}
                    onPress={() => {
                      if (quickReplyHome.trim()) {
                        setQuickReplyHome('');
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather name="send" size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 6. Primary Action Group: Golden Lore & Share */}
              <View style={styles.stitchActionsRow}>
                {/* Golden Lore Button */}
                <TouchableOpacity
                  style={[
                    styles.goldenLoreBtn,
                    hasSavedLoreHome && styles.goldenLoreBtnSaved,
                  ]}
                  onPress={handleToggleLoreSave}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name="star"
                    size={18}
                    color={hasSavedLoreHome ? '#5C4715' : '#1B1C1A'}
                  />
                  <Text style={styles.goldenLoreBtnText}>
                    {hasSavedLoreHome ? 'Збережено в Lore ★' : 'Зберегти в Lore (Золотий фонд)'}
                  </Text>
                </TouchableOpacity>

                {/* Secondary Share Button */}
                <TouchableOpacity
                  style={styles.stitchShareStoryBtn}
                  onPress={handleCopyProfileInviteCode}
                  activeOpacity={0.88}
                >
                  <Feather name="share-2" size={15} color={stitch.primary} />
                  <Text style={styles.stitchShareStoryBtnText}>Поділитися карткою спогаду</Text>
                </TouchableOpacity>

                <Text style={styles.revealedAutoCloseText}>
                  Капсула закриється автоматично через 18 годин
                </Text>
              </View>

              {/* Return to Hub */}
              <TouchableOpacity
                style={styles.returnToHubBtn}
                onPress={() => setTodayStage('hub')}
                activeOpacity={0.85}
              >
                <Feather name="arrow-left" size={14} color={stitch.primary} />
                <Text style={styles.returnToHubBtnText}>Повернутися до огляду дня</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 2: CIRCLES — ЕКРАН 3 З GOOGLE STITCH (Кімнати та спілки)   */}
        {/* ================================================================= */}
        {activeTab === 'circles' && (
          <View style={styles.stitchCirclesContainer}>
            {/* Header Intro */}
            <View style={styles.stitchCirclesIntro}>
              <View style={styles.stitchSectionHeaderRow}>
                <Text style={styles.stitchSectionTagMuted}>ПРОСТОРИ ТА СПІЛКИ</Text>
                <Text style={styles.stitchSectionTagSecondary}>3 АКТИВНІ КІМНАТИ</Text>
              </View>
              <Text style={styles.stitchScreenTitle}>Кімнати</Text>
              <Text style={styles.stitchCirclesSubtitle}>
                Приватні осередки для пари та невеликих компаній до 8 друзів.
              </Text>
            </View>

            {/* Quick Join Code Strip */}
            <View style={styles.stitchQuickJoinStrip}>
              <View style={styles.stitchQuickJoinLeft}>
                <View style={styles.stitchQuickJoinIconWrap}>
                  <Feather name="key" size={15} color={colors.inkSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stitchQuickJoinTitle}>МАЄШ КОД ЗАПРОШЕННЯ?</Text>
                  <Text style={styles.stitchQuickJoinSub}>Приєднатися до кола друзів</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.stitchQuickJoinBtn}
                onPress={() => setShowQuickJoinInput((prev) => !prev)}
                activeOpacity={0.85}
              >
                <Text style={styles.stitchQuickJoinBtnText}>ВВЕСТИ КОД</Text>
              </TouchableOpacity>
            </View>

            {showQuickJoinInput && (
              <View style={styles.stitchJoinInputRow}>
                <TextInput
                  style={[styles.editorialInput, { flex: 1, textTransform: 'uppercase' }]}
                  placeholder="KAPS26"
                  placeholderTextColor={colors.inkMuted}
                  autoCapitalize="characters"
                  maxLength={6}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                />
                <TouchableOpacity
                  style={styles.saveProfileBtn}
                  onPress={handleOpenJoinScreen}
                >
                  <Text style={styles.saveProfileBtnText}>Увійти →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Duo Capsule: Category 1 (Featured Intimate Pair) */}
            <View style={styles.stitchCapsuleSection}>
              <View style={styles.stitchCapsuleSectionHeader}>
                <View style={styles.stitchCapsuleHeaderLeft}>
                  <Ionicons name="heart" size={15} color={colors.terracotta} />
                  <Text style={styles.stitchCapsuleSectionTitle}>
                    ОСОБИСТА КАПСУЛА · ПАРА
                  </Text>
                </View>
                <Text style={styles.stitchSectionTagSecondary}>ТВІЙ ХІД</Text>
              </View>

              {/* Duo Card */}
              <TouchableOpacity
                style={styles.stitchDuoCard}
                activeOpacity={0.9}
                onPress={() => setActiveTab('today')}
              >
                <View style={styles.stitchDuoTopRow}>
                  <View style={styles.stitchDuoAvatarsAndName}>
                    <View style={styles.stitchOverlappingAvatarsWrap}>
                      <Image
                        source={{ uri: userPortraitUri }}
                        style={styles.stitchOverlapAvatar1}
                      />
                      <Image
                        source={{ uri: getAvatarPhotoUri(undefined, 2) }}
                        style={styles.stitchOverlapAvatar2}
                      />
                    </View>
                    <View>
                      <Text style={styles.stitchDuoRoomName}>ЧСМ ❤️</Text>
                      <Text style={styles.stitchDuoRoomSub}>Катерина & Макс</Text>
                    </View>
                  </View>

                  <View style={styles.stitchStreakBadge}>
                    <Text style={styles.stitchStreakBadgeText}>14 ДНІВ В СИНКУ 🔥</Text>
                  </View>
                </View>

                <View style={styles.stitchDuoQuestionBlock}>
                  <Text style={styles.stitchDuoQuestionLabel}>ДЕННЕ ПИТАННЯ #182 • ДО 21:00</Text>
                  <Text style={styles.stitchDuoQuestionText}>
                    «Хто з нас найімовірніше заснув би просто посеред гучної вечірки? ✨»
                  </Text>
                </View>

                <View style={styles.stitchDuoStatusRow}>
                  <View style={styles.stitchDuoPulseLeft}>
                    <View style={styles.stitchPulseDot} />
                    <Text style={styles.stitchDuoPulseText}>
                      Макс уже запечатав відповідь ⏳
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stitchAnswerNowBtn}
                    onPress={() => setActiveTab('today')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.stitchAnswerNowBtnText}>ВІДПОВІСТИ →</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>

            {/* Circles / Groups: Category 2 */}
            <View style={styles.stitchCapsuleSection}>
              <View style={styles.stitchCapsuleSectionHeader}>
                <View style={styles.stitchCapsuleHeaderLeft}>
                  <Feather name="users" size={15} color={colors.inkPrimary} />
                  <Text style={styles.stitchCapsuleSectionTitle}>
                    КОМПАНІЇ ДРУЗІВ · СПІЛКИ
                  </Text>
                </View>
                <Text style={styles.stitchSectionTagMuted}>2 КІМНАТИ</Text>
              </View>

              {/* Group Card 1: Банда з КПІ */}
              <TouchableOpacity
                style={styles.stitchGroupCard}
                activeOpacity={0.88}
                onPress={() => {
                  const friendsRoom = rooms.find((r) => r.type === 'friends') || rooms[0];
                  if (friendsRoom) router.push(`/room/${friendsRoom.id}`);
                }}
              >
                <View style={styles.stitchGroupCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stitchGroupNameRow}>
                      <Text style={styles.stitchGroupName}>Банда з КПІ 🔥</Text>
                      <View style={styles.stitchCountTag}>
                        <Text style={styles.stitchCountTagText}>5 ДРУЗІВ</Text>
                      </View>
                    </View>
                    <Text style={styles.stitchGroupSub}>Раунд #42: «Вечір на даху: коли забули ключі...»</Text>
                  </View>

                  <View style={styles.stitchStatusPillOpen}>
                    <Feather name="unlock" size={12} color={colors.terracotta} />
                    <Text style={styles.stitchStatusPillOpenText}>ВІДКРИТО</Text>
                  </View>
                </View>

                <View style={styles.stitchGroupFooter}>
                  <View style={styles.stitchGroupAvatarStack}>
                    <Image source={{ uri: getAvatarPhotoUri(undefined, 1) }} style={styles.stitchStackImg} />
                    <Image source={{ uri: getAvatarPhotoUri(undefined, 2) }} style={[styles.stitchStackImg, { marginLeft: -8 }]} />
                    <Image source={{ uri: getAvatarPhotoUri(undefined, 3) }} style={[styles.stitchStackImg, { marginLeft: -8 }]} />
                  </View>
                  <Text style={styles.stitchGroupFeedbackText}>3 нові реакції від друзів</Text>
                </View>
              </TouchableOpacity>

              {/* Group Card 2: Подільські кавомани */}
              <TouchableOpacity
                style={styles.stitchGroupCard}
                activeOpacity={0.88}
                onPress={() => {
                  const room = rooms[1] || rooms[0];
                  if (room) router.push(`/room/${room.id}`);
                }}
              >
                <View style={styles.stitchGroupCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.stitchGroupNameRow}>
                      <Text style={styles.stitchGroupName}>Подільські кавомани ☕</Text>
                      <View style={styles.stitchCountTag}>
                        <Text style={styles.stitchCountTagText}>4 ДРУЗІВ</Text>
                      </View>
                    </View>
                    <Text style={styles.stitchGroupSub}>«Яку річ ти давно хотів спробувати разом?»</Text>
                  </View>

                  <View style={styles.stitchStatusPillPending}>
                    <Text style={styles.stitchStatusPillPendingText}>2/4 ГОТОВО · ДО 21:00</Text>
                  </View>
                </View>

                <View style={styles.stitchGroupFooter}>
                  <View style={styles.stitchGroupAvatarStack}>
                    <Image source={{ uri: getAvatarPhotoUri(undefined, 4) }} style={styles.stitchStackImg} />
                    <Image source={{ uri: getAvatarPhotoUri(undefined, 5) }} style={[styles.stitchStackImg, { marginLeft: -8 }]} />
                  </View>
                  <Text style={styles.stitchGroupFeedbackText}>Очікуємо ще 2 відповіді</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Bottom Create Room Action */}
            <TouchableOpacity
              style={styles.stitchCreateRoomDashedBtn}
              onPress={() => setActiveTab('create')}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={16} color={colors.inkPrimary} />
              <Text style={styles.stitchCreateRoomDashedBtnText}>+ СТВОРИТИ КІМНАТУ</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 3: LORE — ЕКРАН 4 З GOOGLE STITCH (Золотий фонд / Архів)    */}
        {/* ================================================================= */}
        {activeTab === 'fond' && (
          <View style={styles.loreScreenContainer}>
            {/* Top Navigation Bar Component (Shared Stitch Header) */}
            <View style={styles.loreTopNavBar}>
              <TouchableOpacity
                accessibilityLabel="Статус архіву"
                style={styles.loreNavClockBtn}
                onPress={() => {}}
                activeOpacity={0.8}
              >
                <Feather name="clock" size={19} color={stitch.primary} />
              </TouchableOpacity>

              <Text style={styles.loreBrandWordmark}>KAPSA</Text>

              <View style={styles.loreNavRightActions}>
                <TouchableOpacity
                  accessibilityLabel="Пошук у хроніці"
                  style={styles.loreSearchBtn}
                  onPress={() => {}}
                  activeOpacity={0.8}
                >
                  <Feather name="search" size={20} color={stitch.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel="Профіль користувача"
                  style={styles.loreNavAvatarBtn}
                  onPress={() => setActiveTab('memories')}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: userPortraitUri }}
                    style={styles.loreNavAvatarImg}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Editorial Canvas Container */}
            <View style={styles.loreContentCanvas}>
              {/* Title & Editorial Subtitle */}
              <View style={styles.loreHeaderSection}>
                <View style={styles.loreMetaHeaderRow}>
                  <Text style={styles.loreChronicleLabel}>ХРОНІКА ПАМʼЯТІ</Text>
                  <TouchableOpacity
                    style={styles.lorePhotobookLink}
                    onPress={() => setShowPhotobookModal(true)}
                    activeOpacity={0.8}
                  >
                    <Feather name="book-open" size={14} color={stitch.onSurfaceVariant} />
                    <Text style={styles.lorePhotobookLinkText}>Фотокнига</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.loreHeadlineTitle}>Золотий фонд</Text>
                <Text style={styles.loreHeadlineSubtitle}>Живий літопис ваших кімнат</Text>
              </View>

              {/* Room Switcher Filter (Tactile Tabs) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.loreRoomTabsRow}
              >
                <TouchableOpacity
                  style={[
                    styles.loreRoomTab,
                    loreRoomFilter === 'all' && styles.loreRoomTabActive,
                  ]}
                  onPress={() => setLoreRoomFilter('all')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.loreRoomTabText,
                      loreRoomFilter === 'all' && styles.loreRoomTabTextActive,
                    ]}
                  >
                    Всі простори
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.loreRoomTab,
                    loreRoomFilter === 'friends' && styles.loreRoomTabActive,
                  ]}
                  onPress={() => setLoreRoomFilter('friends')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.loreRoomTabText,
                      loreRoomFilter === 'friends' && styles.loreRoomTabTextActive,
                    ]}
                  >
                    Банда з КПІ 🔥
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.loreRoomTab,
                    loreRoomFilter === 'couple' && styles.loreRoomTabActive,
                  ]}
                  onPress={() => setLoreRoomFilter('couple')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.loreRoomTabText,
                      loreRoomFilter === 'couple' && styles.loreRoomTabTextActive,
                    ]}
                  >
                    ЧСМ ❤️
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Media Filter Tabs */}
              <View style={styles.loreMediaFiltersRow}>
                {(['all', 'photo', 'quote', 'vote'] as const).map((key) => {
                  const labels: Record<string, string> = {
                    all: 'Усі (24)',
                    photo: 'Фото (14)',
                    quote: 'Цитати (6)',
                    vote: 'Голосування (4)',
                  };
                  const isActive = fondFilter === key;

                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.loreMediaFilterTab,
                        isActive && styles.loreMediaFilterTabActive,
                      ]}
                      onPress={() => setFondFilter(key)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.loreMediaFilterText,
                          isActive && styles.loreMediaFilterTextActive,
                        ]}
                      >
                        {labels[key]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Living Journal Stream */}
              <View style={styles.loreStreamSpace}>
                {/* 1. Large 35mm Film Photo Memory Card */}
                {(fondFilter === 'all' || fondFilter === 'photo') &&
                  (loreRoomFilter === 'all' || loreRoomFilter === 'friends') && (
                    <View style={styles.loreArticleCard}>
                      {/* Card Header Info */}
                      <View style={styles.loreArticleHeader}>
                        <View style={styles.loreArticleHeaderLeft}>
                          <View style={styles.loreRoomBadgeChip}>
                            <Text style={styles.loreRoomBadgeChipText}>Банда з КПІ 🔥</Text>
                          </View>
                          <Text style={styles.loreBulletDot}>•</Text>
                          <Text style={styles.loreDateStamp}>14 листопада</Text>
                        </View>

                        <View style={styles.loreGoldenRecordPill}>
                          <Ionicons name="star" size={13} color={stitch.secondary} />
                          <Text style={styles.loreGoldenRecordText}>Золотий запис</Text>
                        </View>
                      </View>

                      {/* Film Photo with generous white matting/frame */}
                      <View style={styles.lorePhotoMatting}>
                        <View style={styles.lorePhotoFrame}>
                          <Image
                            source={{
                              uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0qpBpw5l9Os6ZxasZ9DBmaU0h7RBOrvQpYp3JFzGvxFrIrvQqJas3XYyyO-ep1lGsHp1BDknNAOktybB-BD1gGH8f6uWtHKfZIT7CJT1sQkclPjnpB28Oosu70dumryPvhOyxZVXUgQpmd_qzqt6MvYCYfWDPfa8CaVPWciOHEHCrbyl8PMFEv2_z3z4CITDNA4IgRwZVxLXUCmfFneboFIlW3BUhADSCB0EICY37FtzhvUMwkDwwZw',
                            }}
                            style={styles.lorePhotoImg}
                          />
                          <View style={styles.loreFilmFormatBadge}>
                            <Text style={styles.loreFilmFormatBadgeText}>35MM FILM</Text>
                          </View>
                        </View>
                      </View>

                      {/* Headline & Note */}
                      <View style={styles.loreArticleBody}>
                        <Text style={styles.loreArticleHeadline}>
                          Той вечір у Львові: піца під дощем
                        </Text>

                        <View style={styles.loreQuoteCalloutBox}>
                          <Text style={styles.loreQuoteCalloutText}>
                            <Text style={styles.loreQuoteAuthorName}>Катерина: </Text>
                            «Забігли в найближчу браму, ділили одну салямі на чотирьох, промокли до нитки, але сміялися так, що чуло все місто».
                          </Text>
                        </View>

                        {/* Interaction and Reaction Pills */}
                        <View style={styles.loreArticleFooter}>
                          <View style={styles.loreReactionsRow}>
                            {(['🍕', '🌧️', '❤️'] as const).map((em) => {
                              const cnt = loreReactions[em] || 0;
                              const isReacted = userLoreReacted[em];

                              return (
                                <TouchableOpacity
                                  key={em}
                                  style={[
                                    styles.loreReactionPill,
                                    isReacted && styles.loreReactionPillActive,
                                  ]}
                                  onPress={() => toggleLoreEmojiReaction(em)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.loreReactionEmoji}>{em}</Text>
                                  <Text
                                    style={[
                                      styles.loreReactionCount,
                                      isReacted && { color: stitch.secondary },
                                    ]}
                                  >
                                    {cnt}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <TouchableOpacity
                            accessibilityLabel="Зберегти в закладки"
                            style={styles.loreBookmarkBtn}
                            onPress={() => setLoreBookmarkSaved((prev) => !prev)}
                            activeOpacity={0.8}
                          >
                            <Feather
                              name="bookmark"
                              size={18}
                              color={loreBookmarkSaved ? stitch.secondary : stitch.onSurfaceVariant}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}

                {/* 2. Distinctive Quote Keepsake Card */}
                {(fondFilter === 'all' || fondFilter === 'quote') &&
                  (loreRoomFilter === 'all' || loreRoomFilter === 'couple') && (
                    <View style={styles.loreQuoteKeepsakeCard}>
                      <View style={styles.loreArticleHeader}>
                        <View style={styles.loreArticleHeaderLeft}>
                          <View style={styles.loreRoomBadgeChipLowest}>
                            <Text style={styles.loreRoomBadgeChipText}>ЧСМ ❤️</Text>
                          </View>
                          <Text style={styles.loreBulletDot}>•</Text>
                          <Text style={styles.loreDateStamp}>8 травня</Text>
                        </View>

                        <View style={styles.lorePinnedByTag}>
                          <Feather name="map-pin" size={12} color={stitch.secondary} />
                          <Text style={styles.lorePinnedByText}>Закріплено Алексом</Text>
                        </View>
                      </View>

                      {/* Typography Quote Layout */}
                      <View style={styles.loreBigQuoteBlock}>
                        <Text style={styles.loreDecorativeBigQuote}>“</Text>
                        <Text style={styles.loreItalicQuoteText}>
                          «Ти — моя улюблена неконтрольована катастрофа»
                        </Text>
                      </View>

                      <View style={styles.loreQuoteCardFooter}>
                        <Text style={styles.loreQuoteContextText}>Сказано на кухні о 03:12</Text>

                        <View style={styles.loreForeverBadge}>
                          <Ionicons name="heart" size={14} color={stitch.secondary} />
                          <Text style={styles.loreForeverBadgeText}>Назавжди</Text>
                        </View>
                      </View>
                    </View>
                  )}

                {/* 3. Compact Vote Highlight Card */}
                {(fondFilter === 'all' || fondFilter === 'vote') &&
                  (loreRoomFilter === 'all' || loreRoomFilter === 'friends') && (
                    <View style={styles.loreVoteHighlightCard}>
                      <View style={styles.loreArticleHeader}>
                        <View style={styles.loreArticleHeaderLeft}>
                          <View style={styles.loreRoomBadgeChip}>
                            <Text style={styles.loreRoomBadgeChipText}>Банда з КПІ 🔥</Text>
                          </View>
                          <Text style={styles.loreBulletDot}>•</Text>
                          <Text style={styles.loreDateStamp}>15 квітня</Text>
                        </View>

                        <TouchableOpacity
                          accessibilityLabel="Експорт результату"
                          style={styles.loreExportBtn}
                          onPress={handleCopyProfileInviteCode}
                          activeOpacity={0.8}
                        >
                          <Feather name="share-2" size={16} color={stitch.onSurfaceVariant} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.loreVoteCardBody}>
                        <View style={styles.loreVoteTitleRow}>
                          <Feather name="check-circle" size={18} color={stitch.secondary} />
                          <Text style={styles.loreVoteQuestionText}>
                            Хто з нас найімовірніше виживе в зомбі-апокаліпсисі?
                          </Text>
                        </View>

                        {/* Progress Indicators with Monograph Styling */}
                        <View style={styles.lorePollBarsContainer}>
                          {/* Winner */}
                          <View style={styles.lorePollBarGroup}>
                            <View style={styles.lorePollBarLabelRow}>
                              <View style={styles.lorePollCandidateNameRow}>
                                <Text style={styles.lorePollWinnerName}>Діма</Text>
                                <View style={styles.loreWinnerMiniPill}>
                                  <Text style={styles.loreWinnerMiniPillText}>ПЕРЕМОЖЕЦЬ</Text>
                                </View>
                              </View>
                              <Text style={styles.lorePollWinnerPct}>60%</Text>
                            </View>
                            <View style={styles.lorePollTrack}>
                              <View style={[styles.lorePollFillBar, { width: '60%', backgroundColor: stitch.primary }]} />
                            </View>
                          </View>

                          {/* Runner-up */}
                          <View style={styles.lorePollBarGroup}>
                            <View style={styles.lorePollBarLabelRow}>
                              <Text style={styles.lorePollRunnerName}>Оля</Text>
                              <Text style={styles.lorePollRunnerPct}>25%</Text>
                            </View>
                            <View style={styles.lorePollTrack}>
                              <View style={[styles.lorePollFillBar, { width: '25%', backgroundColor: stitch.outlineVariant }]} />
                            </View>
                          </View>
                        </View>

                        <View style={styles.loreVoteCardFooter}>
                          <Text style={styles.loreTotalVotedText}>Всього проголосувало: 8 друзів</Text>
                          <Text style={styles.loreVoteClosedNotice}>Голосування закрито</Text>
                        </View>
                      </View>
                    </View>
                  )}

                {/* 4. Voice Memory Snippet Card */}
                {(fondFilter === 'all' || fondFilter === 'quote') && (
                  <View style={styles.loreVoiceSnippetCard}>
                    <View style={styles.loreArticleHeader}>
                      <View style={styles.loreArticleHeaderLeft}>
                        <View style={styles.loreRoomBadgeChipLowest}>
                          <Text style={styles.loreRoomBadgeChipText}>Аудіозапис</Text>
                        </View>
                        <Text style={styles.loreBulletDot}>•</Text>
                        <Text style={styles.loreDateStamp}>23:40 після концерту</Text>
                      </View>

                      <Text style={styles.loreVoiceDurationText}>0:14</Text>
                    </View>

                    <Text style={styles.loreVoiceHeadline}>
                      Нічне голосове зізнання Макса
                    </Text>

                    {/* Interactive Audio Waveform Artifact */}
                    <View style={styles.loreWaveformArtifactBox}>
                      <TouchableOpacity
                        style={styles.loreAudioPlayBtn}
                        onPress={() => setLoreAudioPlaying((prev) => !prev)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={loreAudioPlaying ? 'pause' : 'play'}
                          size={18}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>

                      {/* Tactile Waveform Bars */}
                      <View style={styles.loreWaveformBarsRow}>
                        {[10, 18, 26, 14, 22, 8, 18, 22, 12, 16, 26, 18, 12, 8, 14, 6].map((h, idx) => {
                          const barBg =
                            idx < 4
                              ? stitch.secondary
                              : idx < 7
                              ? stitch.primary
                              : stitch.outlineVariant;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.loreWaveBar,
                                {
                                  height: loreAudioPlaying ? Math.max(6, (h * 1.2) % 28) : h,
                                  backgroundColor: barBg,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>

                      <TouchableOpacity
                        accessibilityLabel="Завантажити аудіо"
                        style={styles.loreDownloadAudioBtn}
                        onPress={() => {}}
                        activeOpacity={0.8}
                      >
                        <Feather name="download" size={17} color={stitch.onSurfaceVariant} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Editorial Export Action Bar (Друкована книга спогадів) */}
              <View style={styles.loreExportBookCard}>
                <View style={styles.loreExportIconCircle}>
                  <Feather name="book" size={20} color={stitch.secondary} />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={styles.loreExportBookTitle}>Зібрати друковану книгу спогадів</Text>
                  <Text style={styles.loreExportBookDesc}>
                    Створіть унікальне видання у твердій палітурці з вибраних моментів ваших просторів.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.loreExportCtaBtn}
                  onPress={() => setShowPhotobookModal(true)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.loreExportCtaBtnText}>
                    Сформувати PDF або замовити друк
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 4: MEMORIES — ЕКРАН 4 З GOOGLE STITCH (Профіль та налаштування) */}
        {/* ================================================================= */}
        {activeTab === 'memories' && (
          <View style={styles.stitchProfileContainer}>
            {/* Screen Section Header */}
            <View style={styles.stitchSectionHeaderRow}>
              <Text style={styles.stitchScreenTitle}>Профіль</Text>
              <Text style={styles.stitchSectionTagSecondary}>ОСОБИСТИЙ ПРОСТІР</Text>
            </View>

            {/* Editorial User Identity Card */}
            <View style={styles.stitchIdentityCard}>
              <View style={styles.stitchAvatarFrameWrap}>
                <TouchableOpacity
                  style={styles.stitchAvatarFrame}
                  onPress={handlePickCustomAvatar}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: userPortraitUri }}
                    style={styles.stitchAvatarImg}
                  />
                  <View style={styles.stitchCameraBadge}>
                    <Feather name="camera" size={13} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={styles.stitchIdentityName}>{friendlyName}</Text>
              <Text style={styles.stitchIdentityQuote}>
                «Твоя щоденна капсула спогадів з тими, хто поруч ♡»
              </Text>

              {/* Key Shared Stats Trio */}
              <View style={styles.stitchStatsTrio}>
                <View style={styles.stitchStatCol}>
                  <Text style={styles.stitchStatNum}>2</Text>
                  <Text style={styles.stitchStatLabel}>Кімнати</Text>
                </View>
                <View style={styles.stitchStatDivider} />
                <View style={styles.stitchStatCol}>
                  <Text style={[styles.stitchStatNum, { color: colors.terracotta }]}>14</Text>
                  <Text style={styles.stitchStatLabel}>Днів у синку</Text>
                </View>
                <View style={styles.stitchStatDivider} />
                <View style={styles.stitchStatCol}>
                  <Text style={styles.stitchStatNum}>32</Text>
                  <Text style={styles.stitchStatLabel}>У Lore ★</Text>
                </View>
              </View>

              {/* Quick Action: Edit Profile */}
              <TouchableOpacity
                style={styles.stitchEditProfileBtn}
                onPress={() => setIsEditingProfile((prev) => !prev)}
                activeOpacity={0.85}
              >
                <Feather name="edit-3" size={15} color={colors.inkPrimary} />
                <Text style={styles.stitchEditProfileBtnText}>
                  {isEditingProfile ? 'Сховати редагування' : 'Редагувати профіль'}
                </Text>
              </TouchableOpacity>

              {isEditingProfile && (
                <View style={styles.stitchEditPanel}>
                  <Text style={styles.stitchPanelSubhead}>Обери свій портрет</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.portraitsRow}
                  >
                    <TouchableOpacity
                      style={[
                        styles.uploadPortraitBtn,
                        isCustomPhotoAvatar && styles.portraitOptionWrapActive,
                      ]}
                      onPress={handlePickCustomAvatar}
                    >
                      <Feather name="camera" size={16} color={colors.inkPrimary} />
                      <Text style={styles.uploadPortraitBtnText}>Своє</Text>
                    </TouchableOpacity>

                    {AVATAR_EMOJIS.map((em) => {
                      const uri = PORTRAIT_AVATARS[em];
                      const isSelected = avatarEmoji === em;
                      return (
                        <TouchableOpacity
                          key={em}
                          style={[
                            styles.portraitOptionWrap,
                            isSelected && styles.portraitOptionWrapActive,
                          ]}
                          onPress={() => handleSaveProfile(em)}
                        >
                          <Image source={{ uri }} style={styles.portraitOptionImg} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={[styles.stitchPanelSubhead, { marginTop: 12 }]}>
                    Твоє ім’я у кімнатах
                  </Text>
                  <View style={styles.profileInputRow}>
                    <TextInput
                      style={[styles.editorialInput, { flex: 1 }]}
                      value={profileNameInput}
                      onChangeText={setProfileNameInput}
                      placeholder="Наприклад: Маша"
                      placeholderTextColor={colors.inkMuted}
                      maxLength={32}
                    />
                    <TouchableOpacity
                      style={styles.saveProfileBtn}
                      onPress={() => {
                        handleSaveProfile();
                        setIsEditingProfile(false);
                      }}
                    >
                      <Text style={styles.saveProfileBtnText}>Зберегти</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* My Invite Code & Pairing Card */}
            <View style={styles.stitchInviteCodeCard}>
              <View style={styles.stitchCardHeaderRow}>
                <Text style={styles.stitchCardHeaderLabel}>
                  ТВІЙ ПЕРСОНАЛЬНИЙ ІНВАЙТ-КОД
                </Text>
                <View style={styles.stitchActiveBadge}>
                  <Text style={styles.stitchActiveBadgeText}>АКТИВНИЙ</Text>
                </View>
              </View>

              <View style={styles.stitchCodeBoxRow}>
                <View style={styles.stitchCodeLeftPart}>
                  <Feather name="key" size={17} color={colors.terracotta} />
                  <Text style={styles.stitchCodeText}>KAPS-8492</Text>
                </View>

                <View style={styles.stitchCodeActionsRow}>
                  <TouchableOpacity
                    style={styles.stitchCopyBtn}
                    onPress={handleCopyProfileInviteCode}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name={isCopiedProfileCode ? 'check' : 'copy'}
                      size={13}
                      color={colors.inkPrimary}
                    />
                    <Text style={styles.stitchCopyBtnText}>
                      {isCopiedProfileCode ? 'Скопійовано' : 'Скопіювати'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.stitchShareIconBtn}
                    onPress={handleCopyProfileInviteCode}
                    activeOpacity={0.8}
                  >
                    <Feather name="share-2" size={16} color={colors.inkPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.stitchInviteDesc}>
                За цим кодом близькі друзі або партнер можуть приєднатися до твоєї закритої капсули без зайвих анкет.
              </Text>
            </View>

            {/* Capsule & Rhythm Preferences */}
            <View style={styles.stitchPreferencesSection}>
              <View style={styles.stitchPrefHeaderRow}>
                <Text style={styles.stitchPrefHeaderTitle}>РИТМ КАПСУЛИ</Text>
                <Text style={styles.stitchSectionTagSecondary}>ЩОДЕННИЙ РИТУАЛ</Text>
              </View>

              <View style={styles.stitchPrefList}>
                {/* Item 1: Reveal Time */}
                <View style={styles.stitchPrefItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.stitchPrefItemTitleRow}>
                      <Feather name="clock" size={15} color={colors.inkPrimary} />
                      <Text style={styles.stitchPrefItemTitle}>Час розкриття відповідей</Text>
                    </View>
                    <Text style={styles.stitchPrefItemSub}>
                      Капсула відкривається одночасно для всіх учасників
                    </Text>
                  </View>
                  <View style={styles.stitchTimeTag}>
                    <Text style={styles.stitchTimeTagText}>21:00 (Київ)</Text>
                  </View>
                </View>

                {/* Item 2: Reminder Toggle */}
                <View style={styles.stitchPrefItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.stitchPrefItemTitleRow}>
                      <Feather name="bell" size={15} color={colors.inkPrimary} />
                      <Text style={styles.stitchPrefItemTitle}>Щоденне нагадування</Text>
                    </View>
                    <Text style={styles.stitchPrefItemSub}>
                      М'який пуш о 19:30, якщо хід ще не запечатано
                    </Text>
                  </View>
                  <Switch
                    value={dailyReminderEnabled}
                    onValueChange={setDailyReminderEnabled}
                    trackColor={{ false: colors.paperBorder, true: colors.terracotta }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Item 3: Move Notification */}
                <View style={styles.stitchPrefItem}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.stitchPrefItemTitleRow}>
                      <Feather name="activity" size={15} color={colors.inkPrimary} />
                      <Text style={styles.stitchPrefItemTitle}>Сповіщення про хід друзів</Text>
                    </View>
                    <Text style={styles.stitchPrefItemSub}>
                      Коли партнер або друзі запечатують відповідь
                    </Text>
                  </View>
                  <Switch
                    value={friendMoveNotificationEnabled}
                    onValueChange={setFriendMoveNotificationEnabled}
                    trackColor={{ false: colors.paperBorder, true: colors.terracotta }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            </View>

            {/* Digital Archive & Lore Export */}
            <View style={styles.stitchLoreExportCard}>
              <View style={styles.stitchLoreExportTop}>
                <View style={styles.stitchLoreExportIconWrap}>
                  <Feather name="book-open" size={18} color={colors.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stitchLoreExportTitle}>Створити PDF-книгу Lore</Text>
                  <Text style={styles.stitchLoreExportSub}>
                    Згенерувати персональний альбом із фотографіями, цитатами та раундами за весь час.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.stitchLoreExportBtn}
                activeOpacity={0.85}
                onPress={() => setActiveTab('fond')}
              >
                <Text style={styles.stitchLoreExportBtnText}>Експортувати цифровий архів</Text>
              </TouchableOpacity>
            </View>

            {/* Privacy Stamp Banner */}
            <View style={styles.stitchPrivacyBanner}>
              <Feather name="shield" size={16} color={colors.terracotta} />
              <Text style={styles.stitchPrivacyBannerText}>
                <Text style={{ fontWeight: '700', color: colors.inkPrimary }}>100% ПРИВАТНІСТЬ: </Text>
                Твої відповіді зашифровані та ніколи не потраплять у відкриті стрічки чи пошукові системи.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ===================================================================== */}
      {/* SHARED BOTTOM NAVIGATION BAR (1-в-1 з Google Stitch JSON & Макету)     */}
      {/* ===================================================================== */}
      <View style={styles.stitchBottomNavBar}>
        {/* Item 1: Сьогодні */}
        <TouchableOpacity
          style={styles.stitchNavTabItem}
          onPress={() => setActiveTab('today')}
          activeOpacity={0.8}
        >
          <Feather
            name="book-open"
            size={19}
            color={activeTab === 'today' ? colors.inkPrimary : colors.inkMuted}
          />
          <Text
            style={[
              styles.stitchNavTabLabel,
              activeTab === 'today' && styles.stitchNavTabLabelActive,
            ]}
          >
            Сьогодні
          </Text>
        </TouchableOpacity>

        {/* Item 2: Кімнати */}
        <TouchableOpacity
          style={styles.stitchNavTabItem}
          onPress={() => setActiveTab('circles')}
          activeOpacity={0.8}
        >
          <Feather
            name="users"
            size={19}
            color={activeTab === 'circles' ? colors.inkPrimary : colors.inkMuted}
          />
          <Text
            style={[
              styles.stitchNavTabLabel,
              activeTab === 'circles' && styles.stitchNavTabLabelActive,
            ]}
          >
            Кімнати
          </Text>
        </TouchableOpacity>

        {/* Item 3: Lore */}
        <TouchableOpacity
          style={styles.stitchNavTabItem}
          onPress={() => setActiveTab('fond')}
          activeOpacity={0.8}
        >
          <Feather
            name="bookmark"
            size={19}
            color={activeTab === 'fond' ? colors.inkPrimary : colors.inkMuted}
          />
          <Text
            style={[
              styles.stitchNavTabLabel,
              activeTab === 'fond' && styles.stitchNavTabLabelActive,
            ]}
          >
            Lore
          </Text>
        </TouchableOpacity>

        {/* Item 4: Профіль */}
        <TouchableOpacity
          style={styles.stitchNavTabItem}
          onPress={() => setActiveTab('memories')}
          activeOpacity={0.8}
        >
          <Feather
            name="user"
            size={19}
            color={activeTab === 'memories' ? colors.inkPrimary : colors.inkMuted}
          />
          <Text
            style={[
              styles.stitchNavTabLabel,
              activeTab === 'memories' && styles.stitchNavTabLabelActive,
            ]}
          >
            Профіль
          </Text>
        </TouchableOpacity>
      </View>

      {/* Photobook Modal */}
      <Modal
        visible={showPhotobookModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPhotobookModal(false)}
      >
        <View style={styles.photobookModalOverlay}>
          <View style={styles.photobookModalCard}>
            <View style={styles.photobookModalHeader}>
              <View>
                <Text style={styles.photobookModalLabel}>ФОТОКНИГА СПОГАДІВ</Text>
                <Text style={styles.photobookModalTitle}>Друкований літопис KAPSA</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPhotobookModal(false)}
                style={styles.photobookModalCloseBtn}
              >
                <Feather name="x" size={20} color={stitch.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.photobookPreviewMatting}>
              <Image
                source={{
                  uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0qpBpw5l9Os6ZxasZ9DBmaU0h7RBOrvQpYp3JFzGvxFrIrvQqJas3XYyyO-ep1lGsHp1BDknNAOktybB-BD1gGH8f6uWtHKfZIT7CJT1sQkclPjnpB28Oosu70dumryPvhOyxZVXUgQpmd_qzqt6MvYCYfWDPfa8CaVPWciOHEHCrbyl8PMFEv2_z3z4CITDNA4IgRwZVxLXUCmfFneboFIlW3BUhADSCB0EICY37FtzhvUMwkDwwZw',
                }}
                style={styles.photobookPreviewImg}
              />
              <View style={styles.photobookPreviewOverlay}>
                <Text style={styles.photobookPreviewTitle}>Банда з КПІ • 2025</Text>
                <Text style={styles.photobookPreviewSubtitle}>Том I: 32 золоті спогади</Text>
              </View>
            </View>

            <View style={styles.photobookModalOptions}>
              <TouchableOpacity
                style={styles.photobookPdfBtn}
                onPress={() => {
                  setShowPhotobookModal(false);
                  Alert.alert('PDF сформовано', 'Цифрову версію літопису підготовлено для експорту.');
                }}
                activeOpacity={0.88}
              >
                <Feather name="download" size={16} color={stitch.primary} />
                <Text style={styles.photobookPdfBtnText}>Завантажити цифровий PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photobookPrintBtn}
                onPress={() => {
                  setShowPhotobookModal(false);
                  Alert.alert('Замовлення друку', 'Менеджер звʼяжеться для уточнення доставки твердої палітурки.');
                }}
                activeOpacity={0.88}
              >
                <Feather name="book" size={16} color="#FFFFFF" />
                <Text style={styles.photobookPrintBtnText}>Замовити преміум друк</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paperBg,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 100,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DA',
  },
  mastheadMeta: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  logoText: {
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '600',
    color: colors.inkPrimary,
    letterSpacing: 0.5,
  },
  avatarProfileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.paperBorder,
  },
  avatarProfilePhoto: {
    width: '100%',
    height: '100%',
  },

  // ЖИВИЙ ЖУРНАЛ СПІЛЬНОГО ЖИТТЯ (EDITORIAL SPREAD)
  journalSpread: {
    marginBottom: 26,
  },
  journalIssueMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  journalRoomBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '70%',
  },
  journalRoomBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.coralAccent,
    letterSpacing: 0.2,
  },
  journalMetaDot: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  journalFormatTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  journalTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  journalTimerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  journalLeadHeadline: {
    fontFamily: fonts.serif,
    fontSize: 29,
    fontWeight: '600',
    color: colors.inkPrimary,
    lineHeight: 38,
    marginVertical: 10,
  },
  livingPulseContainer: {
    marginVertical: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EBE5DA',
  },
  livingPulseHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkSecondary,
    marginBottom: 12,
  },
  livingPulseRow: {
    flexDirection: 'row',
    gap: 16,
    paddingRight: 10,
  },
  pulseMemberItem: {
    alignItems: 'center',
    width: 66,
  },
  pulseAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    position: 'relative',
    marginBottom: 6,
  },
  pulseAvatarWaiting: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D4CBBF',
    borderRadius: 26,
    padding: 2,
  },
  pulseAvatarYou: {
    borderWidth: 2,
    borderColor: colors.coralAccent,
    borderRadius: 26,
    padding: 2,
  },
  pulseAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  pulseStatusBadgeDone: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2FB380',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.paperBg,
  },
  pulseStatusBadgeWaiting: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EAE3D6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.paperBg,
  },
  pulseStatusBadgeYou: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: colors.coralAccent,
    borderWidth: 1.5,
    borderColor: colors.paperBg,
  },
  pulseYouText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  pulseMemberName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  pulseMemberAction: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.inkSecondary,
    textAlign: 'center',
    marginTop: 1,
  },
  journalMainCta: {
    backgroundColor: colors.inkPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    shadowColor: '#1A1816',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  journalMainCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  roomsSection: {
    gap: 12,
  },
  roomsTabIntro: {
    marginBottom: 4,
  },
  roomsTabBigTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    fontWeight: '500',
    color: colors.inkPrimary,
  },
  roomsTabHandwritten: {
    fontFamily: fonts.handwritten,
    fontSize: 20,
    color: colors.inkSecondary,
    marginTop: -2,
  },
  roomsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomsHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  createInlineBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  createInlineText: {
    color: colors.inkPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  joinCodeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    gap: 10,
  },
  joinCodeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinCodeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  editorialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  editorialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EBE5DA',
  },
  editorialDividerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  journalIndexList: {
    borderTopWidth: 1,
    borderColor: '#EBE5DA',
    marginTop: 4,
  },
  journalRoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#EBE5DA',
    gap: 14,
  },
  journalRoomThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.paperElevated,
  },
  journalRoomInfo: {
    flex: 1,
    gap: 3,
  },
  journalRoomTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journalRoomTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  journalRoomCount: {
    fontSize: 11,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  journalRoomStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  journalRoomStatusPending: {
    color: colors.coralAccent,
  },
  journalRoomStatusDone: {
    color: colors.success,
  },
  emptyRoomsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  emptyRoomsTitle: {
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '600',
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  emptyRoomsSubtitle: {
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center',
  },

  // ЕКРАН ПРОФІЛЮ
  profileScreenWrap: {
    gap: 14,
  },
  profileHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  profileBigPortraitWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  profileBigPortrait: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  profileCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileHeroName: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  profileHeroSub: {
    fontFamily: fonts.handwritten,
    fontSize: 19,
    color: colors.inkSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  profileStatsRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.paperBg,
    borderRadius: 16,
    paddingVertical: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  profileStatBox: {
    alignItems: 'center',
  },
  profileStatVal: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  profileStatLabel: {
    fontSize: 11,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  profileStatDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.paperBorder,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    gap: 12,
  },
  profileCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  portraitsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  uploadPortraitBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.paperBg,
    borderWidth: 1.5,
    borderColor: colors.paperBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  uploadPortraitBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  portraitOptionWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  portraitOptionWrapActive: {
    borderColor: colors.coralAccent,
  },
  portraitOptionImg: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  profileInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editorialInput: {
    backgroundColor: colors.paperBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.inkPrimary,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  codeInput: {
    flex: 1,
    letterSpacing: 3,
    fontWeight: '700',
    textAlign: 'center',
  },
  saveProfileBtn: {
    backgroundColor: colors.inkPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // НИЖНІЙ ТАБ-БАР ІЗ ТОНКИМИ ВЕКТОРНИМИ ІКОНКАМИ
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paperBg,
    borderTopWidth: 1,
    borderTopColor: colors.paperBorder,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 9,
  },
  tabItem: {
    alignItems: 'center',
    gap: 3,
    minWidth: 56,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.inkSecondary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.inkPrimary,
    fontWeight: '700',
  },
  centerPlusFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  // ЕКРАН СТВОРЕННЯ КІМНАТИ
  createContainer: {
    padding: 20,
    gap: 14,
  },
  backIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  createTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    fontWeight: '500',
    color: colors.inkPrimary,
    lineHeight: 38,
  },
  sectionBlockLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  typeCardsCol: {
    gap: 12,
  },
  typeEditorialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: colors.paperBorder,
  },
  typeEditorialCardActive: {
    borderColor: colors.inkPrimary,
    backgroundColor: '#FDFBF7',
  },
  typeCardThumb: {
    width: 78,
    height: 68,
    borderRadius: 14,
  },
  typeCardContent: {
    flex: 1,
    gap: 2,
  },
  typeCardTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  typeCardCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  typeCardHint: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  selectorRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  charcoalPrimaryBtn: {
    backgroundColor: colors.inkPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  charcoalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // =========================================================================
  // GOOGLE STITCH SCREEN 4: PROFILE & SETTINGS STYLES
  // =========================================================================
  stitchProfileContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 20,
  },
  stitchSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  stitchScreenTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    fontWeight: '400',
    color: colors.inkPrimary,
    letterSpacing: -0.5,
  },
  stitchSectionTagSecondary: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.terracotta,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stitchSectionTagMuted: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stitchIdentityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  stitchAvatarFrameWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  stitchAvatarFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    padding: 3,
    backgroundColor: colors.paperElevated,
    position: 'relative',
  },
  stitchAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  stitchCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stitchIdentityName: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '600',
    color: colors.inkPrimary,
    marginTop: 2,
  },
  stitchIdentityQuote: {
    fontFamily: fonts.serif,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.inkSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
  },
  stitchStatsTrio: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  stitchStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  stitchStatNum: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSecondary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  stitchStatDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.paperBorder,
  },
  stitchEditProfileBtn: {
    width: '100%',
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.paperSurface,
  },
  stitchEditProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchEditPanel: {
    width: '100%',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.paperBorder,
  },
  stitchPanelSubhead: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  stitchInviteCodeCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  stitchCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchCardHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchActiveBadge: {
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stitchActiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.terracotta,
  },
  stitchCodeBoxRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchCodeLeftPart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stitchCodeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
    color: colors.inkPrimary,
  },
  stitchCodeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stitchCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    backgroundColor: colors.paperContainerLow,
  },
  stitchCopyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchShareIconBtn: {
    padding: 5,
  },
  stitchInviteDesc: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 17,
  },
  stitchPreferencesSection: {
    gap: 8,
  },
  stitchPrefHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 2,
  },
  stitchPrefHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 1,
  },
  stitchPrefList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    overflow: 'hidden',
  },
  stitchPrefItem: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.paperBorder,
  },
  stitchPrefItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stitchPrefItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchPrefItemSub: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 16,
  },
  stitchTimeTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchTimeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchLoreExportCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  stitchLoreExportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stitchLoreExportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchLoreExportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchLoreExportSub: {
    fontSize: 11,
    color: colors.inkSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  stitchLoreExportBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stitchLoreExportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stitchPrivacyBanner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stitchPrivacyBannerText: {
    fontSize: 11,
    color: colors.inkSecondary,
    lineHeight: 16,
    flex: 1,
  },

  // =========================================================================
  // GOOGLE STITCH SCREEN 3: CIRCLES & ROOMS STYLES
  // =========================================================================
  stitchCirclesContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 18,
  },
  stitchCirclesIntro: {
    gap: 4,
  },
  stitchCirclesSubtitle: {
    fontSize: 13,
    color: colors.inkSecondary,
    lineHeight: 18,
  },
  stitchQuickJoinStrip: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  stitchQuickJoinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  stitchQuickJoinIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchQuickJoinTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkPrimary,
    letterSpacing: 0.8,
  },
  stitchQuickJoinSub: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchQuickJoinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.paperContainerHighest,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 8,
  },
  stitchQuickJoinBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkPrimary,
    letterSpacing: 0.8,
  },
  stitchJoinInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  stitchCapsuleSection: {
    gap: 10,
  },
  stitchCapsuleSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.paperBorder,
    paddingBottom: 6,
  },
  stitchCapsuleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stitchCapsuleSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkPrimary,
    letterSpacing: 0.8,
  },
  stitchDuoCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  stitchDuoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchDuoAvatarsAndName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stitchOverlappingAvatarsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 48,
    height: 32,
  },
  stitchOverlapAvatar1: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.paperContainerLow,
    position: 'absolute',
    left: 0,
    zIndex: 2,
  },
  stitchOverlapAvatar2: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.paperContainerLow,
    position: 'absolute',
    left: 18,
    zIndex: 1,
  },
  stitchDuoRoomName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchDuoRoomSub: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchStreakBadge: {
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchStreakBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.terracotta,
  },
  stitchDuoQuestionBlock: {
    borderLeftWidth: 2,
    borderLeftColor: colors.terracotta,
    paddingLeft: 10,
    gap: 2,
  },
  stitchDuoQuestionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchDuoQuestionText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.inkPrimary,
    lineHeight: 19,
  },
  stitchDuoStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.4)',
  },
  stitchDuoPulseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  stitchPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.terracotta,
  },
  stitchDuoPulseText: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchAnswerNowBtn: {
    backgroundColor: colors.terracotta,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stitchAnswerNowBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  stitchGroupCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  stitchGroupCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  stitchGroupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stitchGroupName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchCountTag: {
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stitchCountTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  stitchGroupSub: {
    fontSize: 12,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  stitchStatusPillOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchStatusPillOpenText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkPrimary,
    letterSpacing: 0.5,
  },
  stitchStatusPillPending: {
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchStatusPillPendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  stitchGroupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  stitchGroupAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stitchStackImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.paperContainerLow,
  },
  stitchGroupFeedbackText: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchCreateRoomDashedBtn: {
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  stitchCreateRoomDashedBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkPrimary,
    letterSpacing: 1,
  },
  stitchPollPct: {
    fontSize: 12,
    color: colors.inkSecondary,
  },
  stitchPollTrack: {
    height: 6,
    backgroundColor: colors.paperBorder,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  stitchPollFill: {
    height: '100%',
    borderRadius: 3,
  },
  stitchVoteArtifactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.paperBorder,
  },
  stitchVoteRoomSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  stitchVoteExportLink: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.terracotta,
  },
  stitchBottomNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.paperBg,
    borderTopWidth: 1,
    borderTopColor: colors.paperBorder,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingHorizontal: 8,
  },
  stitchNavTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
    gap: 3,
  },
  stitchNavTabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.inkMuted,
  },
  stitchNavTabLabelActive: {
    fontWeight: '700',
    color: colors.inkPrimary,
  },

  // =========================================================================
  // HOME HUB (SCREEN 1) STYLES — 1-В-1 З GOOGLE STITCH DESIGN
  // =========================================================================
  hubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  hubHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hubHeaderIconBtn: {
    padding: 2,
  },
  hubHeaderRoundTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  hubHeaderCenter: {
    alignItems: 'center',
  },
  hubBrandTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    letterSpacing: 4,
    color: stitch.primary,
    fontWeight: '400',
  },
  hubHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hubHeaderAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    position: 'relative',
  },
  hubHeaderAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  hubHeaderOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: stitch.secondary,
    borderWidth: 1.5,
    borderColor: stitch.surface,
  },
  hubContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 24,
  },
  hubDatelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    paddingBottom: 10,
  },
  hubDatelineText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  hubDatelineTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hubDatelineTimerText: {
    fontSize: 11,
    fontWeight: '500',
    color: stitch.onSurfaceVariant,
  },
  hubFocalCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 20,
    gap: 16,
  },
  hubFocalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubFocalRoomTag: {
    fontSize: 11,
    fontWeight: '700',
    color: stitch.primary,
    letterSpacing: 0.5,
  },
  hubFocalTurnBadge: {
    backgroundColor: stitch.secondaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  hubFocalTurnBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: stitch.secondary,
    letterSpacing: 0.8,
  },
  hubFocalSealedBadge: {
    backgroundColor: stitch.surfaceContainerHighest,
  },
  hubFocalSealedBadgeText: {
    color: stitch.onSurfaceVariant,
  },
  hubFocalQuestionWrap: {
    gap: 6,
  },
  hubFocalQuestionMeta: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  hubFocalQuestionText: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontStyle: 'italic',
    lineHeight: 30,
    color: stitch.primary,
  },
  hubFocalPulseSection: {
    borderTopWidth: 1,
    borderTopColor: stitch.outlineVariant,
    paddingTop: 14,
    gap: 12,
  },
  hubFocalPulseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubFocalPulseTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  hubFocalPulseSub: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
  },
  hubFocalAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  hubFocalAvatarCol: {
    alignItems: 'center',
    gap: 4,
  },
  hubFocalAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    position: 'relative',
    backgroundColor: stitch.surface,
  },
  hubFocalAvatarWrapActive: {
    borderWidth: 2,
    borderColor: stitch.secondary,
  },
  hubFocalAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  hubFocalCheckBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubFocalYouBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: stitch.secondary,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  hubFocalYouBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  hubFocalAvatarName: {
    fontSize: 12,
    fontWeight: '500',
    color: stitch.onSurface,
  },
  hubFocalAvatarNameActive: {
    fontWeight: '600',
    color: stitch.primary,
  },
  hubFocalAvatarSubDone: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  hubFocalAvatarSubAction: {
    color: stitch.secondary,
    fontWeight: '600',
  },
  hubFocalPrimaryBtn: {
    backgroundColor: stitch.secondary,
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  hubFocalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  hubFocalWaitingBtn: {
    backgroundColor: stitch.surfaceContainer,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    marginTop: 4,
  },
  hubFocalWaitingBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
  },
  hubRoomsSection: {
    gap: 12,
  },
  hubRoomsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    paddingBottom: 8,
  },
  hubRoomsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurface,
  },
  hubRoomsCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hubRoomsCreateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.secondary,
  },
  hubRoomCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hubRoomCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  hubRoomCardImgWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    overflow: 'hidden',
    backgroundColor: stitch.surfaceContainer,
  },
  hubRoomCardImg: {
    width: '100%',
    height: '100%',
  },
  hubRoomCardInfo: {
    gap: 3,
    flex: 1,
  },
  hubRoomCardTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: stitch.primary,
  },
  hubRoomCardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hubRoomStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitch.secondary,
  },
  hubRoomCardStatusText: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
  },
  hubRoomCardRight: {
    alignItems: 'flex-end',
    gap: 4,
    paddingLeft: 8,
  },
  hubRoomMembersMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
    letterSpacing: 0.4,
  },
  hubLoreCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  hubLoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubLoreCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hubLoreCardTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  hubLoreCardTime: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
  },
  hubLoreCardBody: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  hubLoreCardImgWrap: {
    width: 76,
    height: 92,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    overflow: 'hidden',
    backgroundColor: stitch.surface,
  },
  hubLoreCardImg: {
    width: '100%',
    height: '100%',
  },
  hubLoreCardContent: {
    flex: 1,
    gap: 5,
  },
  hubLoreCardQuote: {
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '500',
    color: stitch.primary,
    lineHeight: 20,
  },
  hubLoreCardExcerpt: {
    fontSize: 12,
    lineHeight: 17,
    color: stitch.onSurfaceVariant,
  },
  hubLoreCardLink: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
    color: stitch.primary,
    marginTop: 4,
  },
  voteBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  voteBackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkPrimary,
  },

  // TOP CONTEXT BAR
  stitchTopContextBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperBorder,
    backgroundColor: colors.paperBg,
  },
  stitchKapsaBrand: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.inkPrimary,
  },
  stitchContextDivider: {
    color: colors.paperBorder,
    fontSize: 14,
  },
  stitchContextSub: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 1,
  },
  stitchCapsuleIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchDotSecondary: {
    fontSize: 8,
    color: colors.terracotta,
  },
  stitchCapsuleIndicatorName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchCapsuleIndicatorStreak: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.terracotta,
  },
  stitchHeaderAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchHeaderAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },

  // SCREEN 1 (VOTING RITUAL)
  stitchVoteCanvas: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 20,
  },
  stitchRibbonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchRibbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stitchRibbonMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stitchRibbonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.paperBorder,
  },
  stitchRibbonSub: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchRibbonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stitchRibbonLoreLink: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.terracotta,
  },
  stitchQuestionCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 20,
    gap: 14,
  },
  stitchQuestionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchFormatTag: {
    backgroundColor: colors.paperBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stitchFormatTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stitchBlindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stitchBlindBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchQuestionTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '400',
    color: colors.inkPrimary,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  stitchDeckPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.4)',
  },
  stitchDeckPill: {
    backgroundColor: colors.paperBg,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  stitchDeckPillActive: {
    backgroundColor: colors.inkPrimary,
    borderColor: colors.inkPrimary,
  },
  stitchDeckPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchDeckPillTextActive: {
    color: '#FFFFFF',
  },
  stitchBlindNoticeCard: {
    backgroundColor: colors.paperContainerHighest,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stitchBlindNoticeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchBlindNoticeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.terracotta,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  stitchBlindNoticeText: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 17,
  },
  stitchCandidateSection: {
    gap: 10,
  },
  stitchCandidateSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  stitchCandidateSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchCandidateSectionSub: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchCandidateGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  stitchCandidateCard: {
    flex: 1,
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 14,
    height: 165,
    justifyContent: 'space-between',
  },
  stitchCandidateCardSelected: {
    borderWidth: 2,
    borderColor: colors.terracotta,
    backgroundColor: '#FFFFFF',
  },
  stitchCandidateCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stitchCandidateAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    padding: 2,
    backgroundColor: '#FFFFFF',
  },
  stitchCandidateAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  stitchCandidateRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.paperBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchCandidateRadioCircleSelected: {
    borderColor: colors.terracotta,
  },
  stitchCandidateRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.terracotta,
  },
  stitchCandidateCardBottom: {
    gap: 2,
  },
  stitchCandidateName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchCandidateRole: {
    fontSize: 10,
    color: colors.inkSecondary,
  },
  stitchNoteSection: {
    gap: 6,
  },
  stitchNoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchNoteInputBox: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  stitchNoteInput: {
    fontSize: 14,
    color: colors.inkPrimary,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  stitchNoteFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.4)',
  },
  stitchNoteLockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stitchNoteLockedNoticeText: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchNoteCounterText: {
    fontSize: 11,
    color: colors.inkSecondary,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  stitchPulseBox: {
    backgroundColor: colors.paperContainerHighest,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  stitchPulseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchPulseHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchPulseHeaderCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchPulseTilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stitchPulseTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stitchPulseAvatarWrap: {
    position: 'relative',
  },
  stitchPulseAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  stitchPulseCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchPulseWaitingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchPulseMemberName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchPulseMemberStatusDone: {
    fontSize: 10,
    color: colors.terracotta,
    fontWeight: '600',
  },
  stitchPulseMemberStatusPending: {
    fontSize: 10,
    color: colors.inkSecondary,
  },
  stitchSealActionWrap: {
    paddingTop: 4,
    gap: 8,
  },
  stitchSealPrimaryBtn: {
    backgroundColor: colors.terracotta,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stitchSealPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stitchSealSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.inkSecondary,
    lineHeight: 16,
  },

  // =========================================================================
  // SCREEN 3: РАУНД ГОЛОСУВАННЯ (BEFORE SUBMISSION)
  // =========================================================================
  voteScreenWrapper: {
    paddingBottom: 28,
  },
  voteTopBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204, 197, 189, 0.4)',
    backgroundColor: stitch.surface,
  },
  voteBackToRoomsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  voteBackToRoomsText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  voteTopRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voteRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: stitch.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 140,
  },
  voteRoomBadgeName: {
    fontSize: 12,
    fontWeight: '500',
    color: stitch.onSurface,
  },
  voteTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  voteTimerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: stitch.secondary,
    textTransform: 'uppercase',
  },
  voteMainContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 20,
  },
  voteCategoryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: stitch.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  voteCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitch.secondary,
  },
  voteCategoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: stitch.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  voteProgressText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: stitch.outline,
  },
  votePromptSection: {
    gap: 8,
  },
  votePromptTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '400',
    color: stitch.primary,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  votePromptSubtext: {
    fontSize: 13,
    color: stitch.onSurfaceVariant,
    lineHeight: 18,
  },
  voteDividerRule: {
    height: 1,
    backgroundColor: 'rgba(204, 197, 189, 0.6)',
  },
  voteGridSection: {
    gap: 12,
  },
  voteGridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteGridHeaderTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  voteGridVotesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteGridVotesCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.secondary,
  },
  vote2x2Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  voteCandidateCard: {
    width: '48%',
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.6)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    position: 'relative',
  },
  voteCandidateCardSelected: {
    borderWidth: 2,
    borderColor: stitch.secondary,
    backgroundColor: stitch.surfaceContainerLowest,
  },
  voteCandidateActiveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: stitch.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCandidateAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.6)',
    backgroundColor: stitch.surfaceVariant,
    marginBottom: 8,
    overflow: 'hidden',
  },
  voteCandidateAvatarWrapSelected: {
    borderColor: stitch.secondary,
    backgroundColor: stitch.surfaceContainer,
  },
  voteCandidateAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  voteCandidateName: {
    fontSize: 14,
    fontWeight: '600',
    color: stitch.onSurface,
  },
  voteCandidateRoleText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: stitch.outline,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  voteCandidateRoleTextSelected: {
    color: stitch.secondary,
    fontWeight: '600',
  },
  voteCommentSection: {
    gap: 8,
  },
  voteCommentLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  voteCommentLabelSub: {
    fontWeight: '400',
    textTransform: 'none',
    color: stitch.outline,
  },
  voteCommentInputBox: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.7)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  voteCommentTextInput: {
    fontSize: 14,
    color: stitch.onSurface,
    minHeight: 52,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  voteCommentFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.3)',
  },
  voteCommentLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  voteCommentLockText: {
    fontSize: 11,
    color: stitch.outline,
  },
  voteCommentCounterText: {
    fontSize: 11,
    color: stitch.outline,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  votePulseCard: {
    backgroundColor: 'rgba(245, 243, 240, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.4)',
    padding: 16,
    gap: 12,
  },
  votePulseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  votePulseTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  votePulseLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitch.secondary,
  },
  votePulseCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: stitch.onSurface,
    textTransform: 'uppercase',
  },
  votePulseRatioText: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
  },
  votePulseMembersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  votePulseMemberCol: {
    alignItems: 'center',
    gap: 4,
  },
  votePulseMemberAvatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 1,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  votePulseMemberAvatarWrapLocked: {
    borderColor: 'rgba(171, 52, 37, 0.6)',
  },
  votePulseMemberAvatarWrapMe: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: stitch.primary,
  },
  votePulseMemberAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  votePulseLockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: stitch.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  votePulseEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: stitch.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  votePulseWaitingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: stitch.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  votePulseMemberName: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  votePulseMemberNameBold: {
    fontWeight: '700',
    color: stitch.primary,
  },
  votePulseBlurFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.3)',
  },
  votePulseBlurFooterText: {
    fontSize: 11,
    color: stitch.outline,
  },
  voteSealActionWrap: {
    gap: 8,
    marginTop: 4,
  },
  voteSealActionBtn: {
    width: '100%',
    backgroundColor: stitch.secondary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  voteSealActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  voteSealActionNotice: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: stitch.outline,
    textTransform: 'uppercase',
  },

  // =========================================================================
  // SCREEN 2: РАУНД РОЗПЕЧАТАНО О 21:00 (REVEALED) STYLES
  // =========================================================================
  revealedTopNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  revealedBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  revealedBackBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.primary,
  },
  revealedRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: stitch.surfaceContainer,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  revealedRoomBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitch.secondary,
  },
  revealedRoomBadgeName: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.onSurface,
  },
  revealedQuestionWrap: {
    gap: 6,
    marginTop: 6,
  },
  revealedQuestionMeta: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  stitchBreakdownCountText: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
  },
  winnerProgressBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: stitch.surfaceContainerHigh,
    marginTop: 10,
    overflow: 'hidden',
  },
  winnerProgressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: stitch.secondary,
  },
  runnerUpProgressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: stitch.outline,
  },
  stitchBreakdownVotersSub: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
    marginTop: 8,
    textAlign: 'center',
  },
  stitchStoriesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stitchStoriesCountText: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
  },
  stitchAuthorTag: {
    backgroundColor: stitch.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  stitchAuthorTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: stitch.secondary,
    letterSpacing: 0.5,
  },
  revealedPhotoArtifact: {
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  revealedPhotoWrap: {
    width: '100%',
    height: 180,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: stitch.surfaceContainerHigh,
  },
  revealedPhotoImg: {
    width: '100%',
    height: '100%',
  },
  revealedPhotoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  revealedPhotoLocation: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  revealedPhotoArchive: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  goldenLoreBtn: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#EAD8A6',
    borderWidth: 1,
    borderColor: '#D1BE85',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goldenLoreBtnSaved: {
    backgroundColor: '#E0CC94',
  },
  goldenLoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B1C1A',
    letterSpacing: 0.3,
  },
  revealedAutoCloseText: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  returnToHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  returnToHubBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.primary,
  },
  stitchRevealedCanvas: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 22,
  },
  stitchUnveilSection: {
    gap: 12,
  },
  stitchUnveilTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchWaxSealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.terracotta,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stitchWaxSealPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stitchTagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stitchTagPill: {
    backgroundColor: colors.paperContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stitchTagPillText: {
    fontSize: 11,
    color: colors.inkSecondary,
    fontWeight: '600',
  },
  stitchRevealedQuestion: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.inkPrimary,
    lineHeight: 30,
    fontWeight: '400',
  },
  stitchMonographRule: {
    height: 1,
    backgroundColor: colors.paperBorder,
  },
  stitchMatchBanner: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stitchMatchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.terracottaLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchMatchBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stitchMatchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.terracotta,
    letterSpacing: 0.8,
  },
  stitchMatchRatioText: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchMatchTitle: {
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '600',
    color: colors.inkPrimary,
    lineHeight: 22,
  },
  stitchMatchDesc: {
    fontSize: 12,
    color: colors.inkSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
  stitchBreakdownSection: {
    gap: 10,
  },
  stitchBreakdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  stitchBreakdownHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchBreakdownHeaderTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.terracotta,
    letterSpacing: 0.8,
  },
  stitchBreakdownGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  stitchWinnerCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.terracotta,
    borderRadius: 14,
    padding: 14,
    justifyContent: 'space-between',
    position: 'relative',
  },
  stitchWinnerBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.terracotta,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stitchWinnerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stitchBreakdownCenterCol: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
  },
  stitchBreakdownAvatarWrap: {
    position: 'relative',
    width: 60,
    height: 60,
    marginBottom: 4,
  },
  stitchBreakdownAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchWinnerCheckCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchBreakdownCandidateName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchBreakdownWinnerPct: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.terracotta,
    letterSpacing: 0.5,
  },
  stitchBreakdownFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.paperBorder,
    paddingTop: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  stitchBreakdownFooterText: {
    fontSize: 10,
    color: colors.inkSecondary,
    textAlign: 'center',
  },
  stitchRunnerUpCard: {
    flex: 1,
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 14,
    justifyContent: 'space-between',
    opacity: 0.85,
  },
  stitchBreakdownMutedPct: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSecondary,
    letterSpacing: 0.5,
  },
  stitchStoriesSection: {
    gap: 12,
  },
  stitchStoriesSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchStoryCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  stitchStoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchStoryAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stitchStoryMiniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  stitchStoryAuthorName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchStoryTime: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
  stitchStoryLocationTag: {
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stitchStoryLocationText: {
    fontSize: 10,
    color: colors.inkSecondary,
  },
  stitchStoryQuote: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.inkPrimary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  stitchVoiceArtifactCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stitchVoicePlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchVoiceWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  stitchWaveBar: {
    width: 3,
    backgroundColor: colors.paperBorder,
    borderRadius: 2,
  },
  stitchVoiceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchVoiceTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchVoiceDuration: {
    fontSize: 10,
    color: colors.inkSecondary,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  stitchReactionsSection: {
    gap: 10,
  },
  stitchReactionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchEmojiChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stitchEmojiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  stitchEmojiChipActive: {
    borderColor: colors.terracotta,
    backgroundColor: '#FFFFFF',
  },
  stitchEmojiText: {
    fontSize: 15,
  },
  stitchEmojiCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchQuickReplyRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stitchQuickReplyInput: {
    flex: 1,
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.inkPrimary,
  },
  stitchQuickSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stitchActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stitchSaveLoreBtn: {
    flex: 2,
    backgroundColor: colors.goldCream,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stitchSaveLoreBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  stitchSaveLoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldInk,
  },
  stitchShareStoryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stitchShareStoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkPrimary,
  },

  // =========================================================================
  // SCREEN 4: LORE — АРХІВ СПОГАДІВ (ЗОЛОТИЙ ФОНД)
  // =========================================================================
  loreScreenContainer: {
    paddingBottom: 24,
  },
  loreTopNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  loreNavClockBtn: {
    padding: 4,
  },
  loreBrandWordmark: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: -0.5,
    color: stitch.primary,
  },
  loreNavRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loreSearchBtn: {
    padding: 2,
  },
  loreNavAvatarBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  loreNavAvatarImg: {
    width: '100%',
    height: '100%',
  },
  loreContentCanvas: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 20,
  },
  loreHeaderSection: {
    gap: 6,
  },
  loreMetaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loreChronicleLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: stitch.secondary,
    textTransform: 'uppercase',
  },
  lorePhotobookLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lorePhotobookLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
  },
  loreHeadlineTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -0.3,
    color: stitch.primary,
  },
  loreHeadlineSubtitle: {
    fontSize: 14,
    color: stitch.onSurfaceVariant,
  },
  loreRoomTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  loreRoomTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  loreRoomTabActive: {
    backgroundColor: stitch.primary,
    borderColor: stitch.primary,
  },
  loreRoomTabText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: stitch.onSurface,
  },
  loreRoomTabTextActive: {
    color: stitch.surface,
  },
  loreMediaFiltersRow: {
    flexDirection: 'row',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    paddingBottom: 8,
  },
  loreMediaFilterTab: {
    paddingBottom: 4,
  },
  loreMediaFilterTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: stitch.primary,
  },
  loreMediaFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
    letterSpacing: 0.4,
  },
  loreMediaFilterTextActive: {
    color: stitch.primary,
  },
  loreStreamSpace: {
    gap: 18,
  },
  loreArticleCard: {
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  loreArticleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loreArticleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loreRoomBadgeChip: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  loreRoomBadgeChipLowest: {
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  loreRoomBadgeChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
  },
  loreBulletDot: {
    fontSize: 10,
    color: stitch.outline,
  },
  loreDateStamp: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
  },
  loreGoldenRecordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: stitch.secondaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  loreGoldenRecordText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: stitch.secondary,
  },
  lorePhotoMatting: {
    backgroundColor: stitch.surfaceContainerLow,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.6)',
  },
  lorePhotoFrame: {
    position: 'relative',
    width: '100%',
    height: 220,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: stitch.surfaceContainer,
  },
  lorePhotoImg: {
    width: '100%',
    height: '100%',
  },
  loreFilmFormatBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  loreFilmFormatBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#FFFFFF',
  },
  loreArticleBody: {
    gap: 10,
  },
  loreArticleHeadline: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '500',
    color: stitch.primary,
    letterSpacing: -0.2,
  },
  loreQuoteCalloutBox: {
    backgroundColor: 'rgba(245, 243, 240, 0.7)',
    borderLeftWidth: 2,
    borderLeftColor: stitch.secondary,
    padding: 10,
    borderRadius: 4,
  },
  loreQuoteCalloutText: {
    fontSize: 13,
    color: stitch.onSurface,
    lineHeight: 18,
  },
  loreQuoteAuthorName: {
    fontWeight: '600',
    color: stitch.primary,
  },
  loreArticleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  loreReactionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  loreReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  loreReactionPillActive: {
    borderColor: stitch.secondary,
    backgroundColor: stitch.surfaceContainerLowest,
  },
  loreReactionEmoji: {
    fontSize: 12,
  },
  loreReactionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.onSurface,
  },
  loreBookmarkBtn: {
    padding: 4,
  },
  loreQuoteKeepsakeCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 18,
    gap: 12,
  },
  lorePinnedByTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lorePinnedByText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: stitch.secondary,
  },
  loreBigQuoteBlock: {
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  loreDecorativeBigQuote: {
    fontSize: 36,
    lineHeight: 36,
    fontFamily: fonts.serif,
    color: 'rgba(171, 52, 37, 0.35)',
  },
  loreItalicQuoteText: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    color: stitch.primary,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  loreQuoteCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.6)',
  },
  loreQuoteContextText: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  loreForeverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 218, 212, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(171, 52, 37, 0.2)',
  },
  loreForeverBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: stitch.secondary,
  },
  loreVoteHighlightCard: {
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  loreExportBtn: {
    padding: 2,
  },
  loreVoteCardBody: {
    gap: 12,
  },
  loreVoteTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  loreVoteQuestionText: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '500',
    color: stitch.primary,
    lineHeight: 22,
  },
  lorePollBarsContainer: {
    gap: 10,
  },
  lorePollBarGroup: {
    gap: 4,
  },
  lorePollBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lorePollCandidateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lorePollWinnerName: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.primary,
  },
  loreWinnerMiniPill: {
    backgroundColor: stitch.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  loreWinnerMiniPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.secondary,
  },
  lorePollWinnerPct: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.primary,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  lorePollRunnerName: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
  },
  lorePollRunnerPct: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  lorePollTrack: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: stitch.surfaceContainer,
    overflow: 'hidden',
  },
  lorePollFillBar: {
    height: '100%',
    borderRadius: 4,
  },
  loreVoteCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  loreTotalVotedText: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
  },
  loreVoteClosedNotice: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.secondary,
  },
  loreVoiceSnippetCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 16,
    gap: 10,
  },
  loreVoiceDurationText: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.secondary,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  loreVoiceHeadline: {
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '500',
    color: stitch.primary,
  },
  loreWaveformArtifactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    padding: 10,
    borderRadius: 6,
  },
  loreAudioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: stitch.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loreWaveformBarsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 30,
    paddingHorizontal: 4,
  },
  loreWaveBar: {
    flex: 1,
    borderRadius: 2,
    maxWidth: 4,
  },
  loreDownloadAudioBtn: {
    padding: 4,
  },
  loreExportBookCard: {
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 18,
    backgroundColor: stitch.surfaceContainerLow,
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  loreExportIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loreExportBookTitle: {
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '600',
    color: stitch.primary,
    textAlign: 'center',
  },
  loreExportBookDesc: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  loreExportCtaBtn: {
    width: '100%',
    backgroundColor: stitch.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loreExportCtaBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: stitch.surface,
    textTransform: 'uppercase',
  },

  // PHOTOBOOK MODAL STYLES
  photobookModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 28, 26, 0.65)',
    justifyContent: 'flex-end',
  },
  photobookModalCard: {
    backgroundColor: stitch.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  photobookModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  photobookModalLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: stitch.secondary,
    textTransform: 'uppercase',
  },
  photobookModalTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    fontWeight: '500',
    color: stitch.primary,
    marginTop: 2,
  },
  photobookModalCloseBtn: {
    padding: 4,
  },
  photobookPreviewMatting: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    padding: 10,
    borderRadius: 8,
  },
  photobookPreviewImg: {
    width: '100%',
    height: 180,
    borderRadius: 4,
  },
  photobookPreviewOverlay: {
    paddingTop: 10,
    alignItems: 'center',
    gap: 2,
  },
  photobookPreviewTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: stitch.primary,
  },
  photobookPreviewSubtitle: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
  },
  photobookModalOptions: {
    gap: 10,
    marginTop: 4,
  },
  photobookPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingVertical: 13,
    borderRadius: 8,
  },
  photobookPdfBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.primary,
  },
  photobookPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: stitch.primary,
    paddingVertical: 13,
    borderRadius: 8,
  },
  photobookPrintBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.surface,
  },

  // WAITING SCREEN (SEALED TIL 21:00)
  stitchSealedWaitingCanvas: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
  },
  stitchWaxSealHeroCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 14,
  },
  stitchWaxSealEmblem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  stitchWaxSealHeroTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '600',
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  stitchWaxSealHeroSub: {
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  stitchCountdownTimerBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  stitchCountdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.terracotta,
    textTransform: 'uppercase',
  },
  stitchCountdownDigits: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
    color: colors.inkPrimary,
    letterSpacing: 2,
  },
  stitchMySealedChoiceCard: {
    width: '100%',
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.terracotta,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  stitchMyChoiceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stitchMyChoiceCandidate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchMyChoiceNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.inkSecondary,
    marginTop: 2,
  },
  stitchSimulateRevealBtn: {
    backgroundColor: colors.terracotta,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stitchSimulateRevealBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stitchEditChoiceBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stitchEditChoiceBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
});
