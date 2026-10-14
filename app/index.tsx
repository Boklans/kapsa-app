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
  type TodayStage = 'vote' | 'waiting' | 'revealed';
  const [todayStage, setTodayStage] = useState<TodayStage>('vote');
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

  // Стан для Екрана 1 (Today)
  const [selectedCandidate, setSelectedCandidate] = useState<'you' | 'maks'>('maks');
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
    const targetVotedId = selectedCandidate === 'maks' ? partnerMember.user_id : myMember.user_id;

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
    'Хто з нас найімовірніше заблукає навіть з Google Maps?';
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
        {/* TOP CONTEXT BAR (Чистий лаконічний хедер у стилі Google Stitch)   */}
        {/* ================================================================= */}
        {activeTab === 'today' && (
          <View style={styles.stitchTopContextBar}>
            <Text style={styles.stitchKapsaBrand}>KAPSA</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={styles.stitchCapsuleIndicatorPill}
                onPress={() => setActiveTab('circles')}
                activeOpacity={0.8}
              >
                <Text style={styles.stitchDotSecondary}>●</Text>
                <Text style={styles.stitchCapsuleIndicatorName}>
                  {featuredRoom ? featuredRoom.name : 'ЧСМ ❤️'}
                </Text>
                <Text style={styles.stitchCapsuleIndicatorStreak}>🔥 14</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stitchHeaderAvatarBtn}
                onPress={() => setActiveTab('memories')}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: userPortraitUri }}
                  style={styles.stitchHeaderAvatarImg}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 1: TODAY — ЕКРАН 1 (ГОЛОСУВАННЯ) / ЕКРАН 5 (РОЗКРИТТЯ)    */}
        {/* ================================================================= */}
        {activeTab === 'today' && (
          todayStage === 'vote' ? (
            /* SCREEN 1: РАУНД: ГОЛОСУВАННЯ ТА ВІДПОВІДЬ */
            <View style={styles.stitchVoteCanvas}>
              {/* Ritual Number & Date Ribbon */}
              <View style={styles.stitchRibbonRow}>
                <View style={styles.stitchRibbonLeft}>
                  <Text style={styles.stitchRibbonMeta}>
                    Капсула #19 · 24 жовтня
                  </Text>
                  <View style={styles.stitchRibbonDot} />
                  <Text style={styles.stitchRibbonSub}>Дует (2)</Text>
                </View>

                <TouchableOpacity
                  style={styles.stitchRibbonRight}
                  onPress={() => setActiveTab('fond')}
                >
                  <Feather name="star" size={12} color={colors.terracotta} />
                  <Text style={styles.stitchRibbonLoreLink}>Lore (6) ★</Text>
                </TouchableOpacity>
              </View>

              {/* Expressive Monograph Question Card */}
              <View style={styles.stitchQuestionCard}>
                <View style={styles.stitchQuestionTopRow}>
                  <View style={styles.stitchFormatTag}>
                    <Text style={styles.stitchFormatTagText}>ПИТАННЯ ДНЯ</Text>
                  </View>
                  <View style={styles.stitchBlindBadge}>
                    <Feather name="lock" size={11} color={colors.inkSecondary} />
                    <Text style={styles.stitchBlindBadgeText}>НАОСЛІП</Text>
                  </View>
                </View>

                <Text style={styles.stitchQuestionTitle}>
                  «{featuredQuestion}»
                </Text>

                {/* Deck chips */}
                <View style={styles.stitchDeckPillsRow}>
                  {DECK_LIST.map((d) => {
                    const isCur = selectedDeck === d.tag;
                    return (
                      <TouchableOpacity
                        key={d.tag}
                        style={[styles.stitchDeckPill, isCur && styles.stitchDeckPillActive]}
                        onPress={() => handleSelectDeck(d.tag)}
                      >
                        <Text style={[styles.stitchDeckPillText, isCur && styles.stitchDeckPillTextActive]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Blind Submission Notice */}
              <View style={styles.stitchBlindNoticeCard}>
                <View style={styles.stitchBlindNoticeIconWrap}>
                  <Feather name="lock" size={15} color={colors.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stitchBlindNoticeTitle}>
                    Таємний вибір.
                  </Text>
                  <Text style={styles.stitchBlindNoticeText}>
                    Твоя відповідь залишається запечатаною в капсулі, доки ви обидва не зробите свій хід або не настане 21:00.
                  </Text>
                </View>
              </View>

              {/* Candid Choice Selection (Two candidate cards) */}
              <View style={styles.stitchCandidateSection}>
                <View style={styles.stitchCandidateSectionHeader}>
                  <Text style={styles.stitchCandidateSectionTitle}>ТВІЙ ВИБІР</Text>
                  <Text style={styles.stitchCandidateSectionSub}>Оберіть одну особу</Text>
                </View>

                <View style={styles.stitchCandidateGrid}>
                  {/* Option 1: You */}
                  <TouchableOpacity
                    style={[
                      styles.stitchCandidateCard,
                      selectedCandidate === 'you' && styles.stitchCandidateCardSelected,
                    ]}
                    onPress={() => setSelectedCandidate('you')}
                    activeOpacity={0.88}
                  >
                    <View style={styles.stitchCandidateCardTop}>
                      <View style={styles.stitchCandidateAvatarWrap}>
                        <Image
                          source={{ uri: userPortraitUri }}
                          style={styles.stitchCandidateAvatarImg}
                        />
                      </View>
                      <View style={[
                        styles.stitchCandidateRadioCircle,
                        selectedCandidate === 'you' && styles.stitchCandidateRadioCircleSelected,
                      ]}>
                        {selectedCandidate === 'you' && (
                          <View style={styles.stitchCandidateRadioDot} />
                        )}
                      </View>
                    </View>

                    <View style={styles.stitchCandidateCardBottom}>
                      <Text style={styles.stitchCandidateName}>Ти</Text>
                      <Text style={styles.stitchCandidateRole}>Катерина · Автор капсули</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: Maks (Partner - Selected by default) */}
                  <TouchableOpacity
                    style={[
                      styles.stitchCandidateCard,
                      selectedCandidate === 'maks' && styles.stitchCandidateCardSelected,
                    ]}
                    onPress={() => setSelectedCandidate('maks')}
                    activeOpacity={0.88}
                  >
                    <View style={styles.stitchCandidateCardTop}>
                      <View style={styles.stitchCandidateAvatarWrap}>
                        <Image
                          source={{ uri: PORTRAIT_AVATARS['🦊'] }}
                          style={styles.stitchCandidateAvatarImg}
                        />
                      </View>
                      <View style={[
                        styles.stitchCandidateRadioCircle,
                        selectedCandidate === 'maks' && styles.stitchCandidateRadioCircleSelected,
                      ]}>
                        {selectedCandidate === 'maks' && (
                          <Feather name="check" size={11} color="#FFFFFF" />
                        )}
                      </View>
                    </View>

                    <View style={styles.stitchCandidateCardBottom}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={styles.stitchCandidateName}>Макс</Text>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.terracotta }} />
                      </View>
                      <Text style={styles.stitchCandidateRole}>Співучасник дуету</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Optional Memory / Candid Note Field */}
              <View style={styles.stitchNoteSection}>
                <Text style={styles.stitchNoteLabel}>
                  КОМЕНТАР АБО ІСТОРІЯ <Text style={{ textTransform: 'none', fontWeight: '400', color: colors.inkSecondary }}>(необов'язково)</Text>
                </Text>
                <View style={styles.stitchNoteInputBox}>
                  <TextInput
                    style={styles.stitchNoteInput}
                    placeholder="Додай коротку репліку або спогад до вибору: наприклад, про випадок у поїзді..."
                    placeholderTextColor={colors.inkMuted}
                    multiline
                    maxLength={140}
                    value={candidNoteText}
                    onChangeText={setCandidNoteText}
                  />
                  <View style={styles.stitchNoteFooterRow}>
                    <View style={styles.stitchNoteLockedNotice}>
                      <Feather name="lock" size={11} color={colors.inkSecondary} />
                      <Text style={styles.stitchNoteLockedNoticeText}>
                        Залишиться прихованим до 21:00
                      </Text>
                    </View>
                    <Text style={styles.stitchNoteCounterText}>
                      {candidNoteText.length}/140
                    </Text>
                  </View>
                </View>
              </View>

              {/* Room Pulse / Participation Status */}
              <View style={styles.stitchPulseBox}>
                <View style={styles.stitchPulseHeaderRow}>
                  <Text style={styles.stitchPulseHeaderTitle}>ПУЛЬС КІМНАТИ</Text>
                  <Text style={styles.stitchPulseHeaderCount}>1 з 2 запечатано</Text>
                </View>

                <View style={styles.stitchPulseTilesRow}>
                  {/* Status: Maks */}
                  <View style={styles.stitchPulseTile}>
                    <View style={styles.stitchPulseAvatarWrap}>
                      <Image
                        source={{ uri: getAvatarPhotoUri(undefined, 2) }}
                        style={styles.stitchPulseAvatar}
                      />
                      <View style={styles.stitchPulseCheckBadge}>
                        <Feather name="check" size={9} color="#FFFFFF" />
                      </View>
                    </View>
                    <View>
                      <Text style={styles.stitchPulseMemberName}>Макс</Text>
                      <Text style={styles.stitchPulseMemberStatusDone}>Запечатав відповідь</Text>
                    </View>
                  </View>

                  {/* Status: You */}
                  <View style={styles.stitchPulseTile}>
                    <View style={styles.stitchPulseAvatarWrap}>
                      <Image
                        source={{ uri: userPortraitUri }}
                        style={[styles.stitchPulseAvatar, { opacity: 0.7 }]}
                      />
                      <View style={styles.stitchPulseWaitingBadge}>
                        <Text style={{ fontSize: 9, color: colors.inkSecondary, fontWeight: '700' }}>…</Text>
                      </View>
                    </View>
                    <View>
                      <Text style={styles.stitchPulseMemberName}>Ти</Text>
                      <Text style={styles.stitchPulseMemberStatusPending}>Очікуємо твій хід</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action Button: Seal Answer */}
              <View style={styles.stitchSealActionWrap}>
                <TouchableOpacity
                  style={styles.stitchSealPrimaryBtn}
                  onPress={handleSealAnswer}
                  activeOpacity={0.88}
                >
                  <Feather name="lock" size={17} color="#FFFFFF" />
                  <Text style={styles.stitchSealPrimaryBtnText}>Запечатати відповідь</Text>
                </TouchableOpacity>
                <Text style={styles.stitchSealSubtext}>
                  Відповіді стануть доступними в розділі <Text style={{ fontWeight: '600', color: colors.inkPrimary }}>Сьогодні</Text> одразу о 21:00
                </Text>
              </View>
            </View>
          ) : todayStage === 'waiting' ? (
            /* ============================================================= */
            /* SCREEN 2: ЗАПЕЧАТАНО СУРГУЧЕМ (WAITING STATE ДО 21:00)        */
            /* ============================================================= */
            <View style={styles.stitchSealedWaitingCanvas}>
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
                  <Text style={{ fontSize: 11, color: colors.inkMuted }}>
                    О 21:00 сургуч розплавиться для вас обох
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
                        source={{ uri: getAvatarPhotoUri(undefined, 2) }}
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
            /* SCREEN 5: РОЗКРИТТЯ ВІДПОВІДЕЙ 21:00 */
            <View style={styles.stitchRevealedCanvas}>
              {/* 1. Unveiling Celebration Badge & Prompt */}
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

                <Text style={styles.stitchRevealedQuestion}>
                  «Хто з нас найімовірніше заснув би просто посеред гучної вечірки? ✨»
                </Text>
                <View style={styles.stitchMonographRule} />
              </View>

              {/* 2. The Reveal Banner (Match Status) */}
              <View style={styles.stitchMatchBanner}>
                <View style={styles.stitchMatchIconWrap}>
                  <Ionicons name="sparkles" size={20} color={colors.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.stitchMatchBadgeRow}>
                    <Text style={styles.stitchMatchBadgeText}>ОДНОГОЛОСНО</Text>
                    <Text style={styles.stitchMatchRatioText}>· 2 з 2 співпали</Text>
                  </View>
                  <Text style={styles.stitchMatchTitle}>
                    100% ЗБІГ! Всі проголосували за Макса 😂
                  </Text>
                  <Text style={styles.stitchMatchDesc}>
                    Жодних сумнівів: титул «соні вечора» беззаперечно переходить до Максима.
                  </Text>
                </View>
              </View>

              {/* 3. Voting Breakdown Cards */}
              <View style={styles.stitchBreakdownSection}>
                <View style={styles.stitchBreakdownHeaderRow}>
                  <Text style={styles.stitchBreakdownHeaderTitle}>РЕЗУЛЬТАТИ ГОЛОСУВАННЯ</Text>
                </View>

                <View style={styles.stitchBreakdownGrid}>
                  {/* Winner Card */}
                  <View style={styles.stitchWinnerCard}>
                    <View style={styles.stitchBreakdownCenterCol}>
                      <View style={styles.stitchBreakdownAvatarWrap}>
                        <Image
                          source={{ uri: PORTRAIT_AVATARS['🦊'] }}
                          style={styles.stitchBreakdownAvatarImg}
                        />
                        <View style={styles.stitchWinnerCheckCircle}>
                          <Feather name="check" size={12} color="#FFFFFF" />
                        </View>
                      </View>
                      <Text style={styles.stitchBreakdownCandidateName}>Макс</Text>
                      <Text style={styles.stitchBreakdownWinnerPct}>100% ГОЛОСІВ</Text>
                    </View>

                    <View style={styles.stitchBreakdownFooter}>
                      <Text style={styles.stitchBreakdownFooterText}>
                        Ти + Макс обрали його
                      </Text>
                    </View>
                  </View>

                  {/* Runner-up Card */}
                  <View style={styles.stitchRunnerUpCard}>
                    <View style={styles.stitchBreakdownCenterCol}>
                      <View style={styles.stitchBreakdownAvatarWrap}>
                        <Image
                          source={{ uri: userPortraitUri }}
                          style={[styles.stitchBreakdownAvatarImg, { opacity: 0.7 }]}
                        />
                      </View>
                      <Text style={styles.stitchBreakdownCandidateName}>Катерина (Ти)</Text>
                      <Text style={styles.stitchBreakdownMutedPct}>0 ГОЛОСІВ</Text>
                    </View>

                    <View style={styles.stitchBreakdownFooter}>
                      <Text style={styles.stitchBreakdownFooterText}>0 голосів</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 4. Unsealed Responses & Stories */}
              <View style={styles.stitchStoriesSection}>
                <Text style={styles.stitchStoriesSectionTitle}>РОЗПЕЧАТАНІ КОМЕНТАРІ ТА ІСТОРІЇ</Text>

                {/* Story 1: You */}
                <View style={styles.stitchStoryCard}>
                  <View style={styles.stitchStoryHeaderRow}>
                    <View style={styles.stitchStoryAuthorRow}>
                      <Image
                        source={{ uri: userPortraitUri }}
                        style={styles.stitchStoryMiniAvatar}
                      />
                      <Text style={styles.stitchStoryAuthorName}>Ти (Катерина) <Text style={{ color: colors.terracotta }}>АВТОР</Text></Text>
                      <Text style={styles.stitchStoryTime}>• Внесено о 20:14</Text>
                    </View>
                    <View style={styles.stitchStoryLocationTag}>
                      <Text style={styles.stitchStoryLocationText}>🔒</Text>
                    </View>
                  </View>

                  <Text style={styles.stitchStoryQuote}>
                    «{candidNoteText || 'Пам\'ятаєш ту поїздку до Львова, коли ти заснув на дивані в клубі о першій ночі з келихом сидру в руці? 😂 Це було легендарно.'}»
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.inkMuted, marginTop: 4 }}>📍 Львів, листопад 2023</Text>
                </View>

                {/* Story 2: Maks */}
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
                    <View style={styles.stitchStoryLocationTag}>
                      <Text style={styles.stitchStoryLocationText}>🔒</Text>
                    </View>
                  </View>

                  <Text style={styles.stitchStoryQuote}>
                    «Я навіть не сперечаюся. Моє ліжко — це святе місце, а вечірки після 23:00 — це вже подвиг. Здався сам! 😴»
                  </Text>
                </View>

                {/* Voice Note Snippet Artifact */}
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
                      {[6, 12, 18, 24, 14, 20, 26, 16, 22, 10, 18, 25, 12, 8, 19, 14].map((h, i) => (
                        <View
                          key={i}
                          style={[
                            styles.stitchWaveBar,
                            { height: h },
                            isPlayingAudioHome && i % 2 === 0 && { backgroundColor: colors.terracotta },
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

              {/* 5. Emotional Reactions & Discussion */}
              <View style={styles.stitchReactionsSection}>
                <Text style={styles.stitchReactionsTitle}>РЕАКЦІЇ ДУЕТУ</Text>

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
                        <Text style={[styles.stitchEmojiCount, isActive && { color: colors.terracotta }]}>
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
                    placeholderTextColor={colors.inkMuted}
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

              {/* 6. Editorial Actions: Save to Lore & Share */}
              <View style={styles.stitchActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.stitchSaveLoreBtn,
                    hasSavedLoreHome && styles.stitchSaveLoreBtnActive,
                  ]}
                  onPress={handleToggleLoreSave}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name={hasSavedLoreHome ? 'star' : 'star-outline'}
                    size={16}
                    color={hasSavedLoreHome ? '#C4A46C' : colors.inkPrimary}
                  />
                  <Text style={styles.stitchSaveLoreBtnText}>
                    {hasSavedLoreHome ? 'Збережено в Lore ★' : 'Зберегти в Lore ★'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stitchShareStoryBtn}
                  onPress={handleCopyProfileInviteCode}
                  activeOpacity={0.88}
                >
                  <Feather name="share-2" size={15} color={colors.inkPrimary} />
                  <Text style={styles.stitchShareStoryBtnText}>Поділитися</Text>
                </TouchableOpacity>
              </View>

              {/* Bottom Test Controls */}
              <View style={{ gap: 8, marginTop: 6 }}>
                <TouchableOpacity
                  style={{
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: colors.paperElevated,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.paperBorder,
                  }}
                  onPress={() => setTodayStage('waiting')}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkPrimary }}>
                    🔒 Повернутися до запечатаного стану (Очікування 21:00)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    if (currentRoom) resetDemoMyResponse(currentRoom.id);
                    setIsAnswerSealed(false);
                    setTodayStage('vote');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSecondary }}>
                    🔄 Скинути хід та проголосувати заново
                  </Text>
                </TouchableOpacity>
              </View>
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
        {/* ВКЛАДКА 3: LORE — ЕКРАН АРХІВУ СПОГАДІВ (Lore / Артефакти)        */}
        {/* ================================================================= */}
        {activeTab === 'fond' && (
          <View style={styles.stitchLoreCanvas}>
            {/* Subheader / Room Switcher & Collection Meta */}
            <View style={styles.stitchLoreSubheader}>
              <View>
                <Text style={styles.stitchLoreMetaLabel}>АРХІВ СПОГАДІВ</Text>
                <Text style={styles.stitchLoreScreenTitle}>Lore</Text>
              </View>
              <TouchableOpacity
                style={styles.stitchLoreRoomPill}
                onPress={() => setActiveTab('circles')}
                activeOpacity={0.8}
              >
                <Text style={styles.stitchLoreRoomPillText}>
                  {featuredRoom ? featuredRoom.name : 'ЧСМ ❤️'}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.inkSecondary} />
              </TouchableOpacity>
            </View>

            {/* Editorial Filter Tabs */}
            <View style={styles.stitchLoreFiltersRow}>
              {(['all', 'photo', 'quote', 'vote'] as const).map((key) => {
                const labels: Record<string, string> = {
                  all: 'Усі (24)',
                  photo: 'Фото (12)',
                  quote: 'Цитати (8)',
                  vote: 'Голоси (4)',
                };
                const isAct = fondFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.stitchLoreFilterPill, isAct && styles.stitchLoreFilterPillActive]}
                    onPress={() => setFondFilter(key)}
                  >
                    <Text style={[styles.stitchLoreFilterPillText, isAct && styles.stitchLoreFilterPillTextActive]}>
                      {labels[key]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Artifact 1: Candid 35mm Photo Card */}
            {(fondFilter === 'all' || fondFilter === 'photo') && (
              <View style={styles.stitchPhotoArtifactCard}>
                <View style={styles.stitchPhotoArtifactTopRow}>
                  <Text style={styles.stitchPhotoArtifactMeta}>
                    РАУНД #14 · {featuredRoom ? featuredRoom.name : 'ЧСМ DUO'}
                  </Text>
                  <Text style={styles.stitchPhotoArtifactDate}>12 ТРАВНЯ 2025</Text>
                </View>

                <View style={styles.stitchPhotoArtifactImgWrap}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80' }}
                    style={styles.stitchPhotoArtifactImg}
                  />
                  <View style={styles.stitchPhotoArtifactStarBadge}>
                    <Ionicons name="star" size={13} color="#FFFFFF" />
                    <Text style={styles.stitchPhotoArtifactStarText}>LORE</Text>
                  </View>
                </View>

                <Text style={styles.stitchPhotoArtifactTitle}>
                  «Той вечір у Львові: піца під дощем та нескінченні розмови»
                </Text>
                <Text style={styles.stitchPhotoArtifactDesc}>
                  Коли раптова злива змусила нас сховатися під старовинною аркою біля Ратуші. Найкращі спільні спогади завжди трапляються не за планом.
                </Text>

                <View style={styles.stitchPhotoArtifactFooter}>
                  <View style={styles.stitchPhotoReactionsRow}>
                    <Text style={styles.stitchPhotoReactionBadge}>❤️ 7</Text>
                    <Text style={styles.stitchPhotoReactionBadge}>😂 5</Text>
                  </View>
                  <TouchableOpacity style={styles.stitchPhotoShareLink} onPress={handleCopyProfileInviteCode}>
                    <Feather name="share-2" size={13} color={colors.inkSecondary} />
                    <Text style={styles.stitchPhotoShareText}>Поділитися</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Artifact 2: Typographic Quote Card */}
            {(fondFilter === 'all' || fondFilter === 'quote') && (
              <View style={styles.stitchQuoteArtifactCard}>
                <View style={styles.stitchQuoteArtifactTopRow}>
                  <Text style={styles.stitchQuoteArtifactMeta}>ЦИТАТА ДНЯ • ЧСМ ♥ Duo</Text>
                  <Text style={styles.stitchQuoteArtifactDate}>8 ТРАВНЯ</Text>
                </View>

                <Text style={styles.stitchQuoteArtifactText}>
                  «Ти — моя улюблена неконтрольована катастрофа»
                </Text>

                <View style={styles.stitchQuoteArtifactAuthorRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Image
                      source={{ uri: userPortraitUri }}
                      style={styles.stitchQuoteAuthorAvatar}
                    />
                    <Text style={styles.stitchQuoteAuthorName}>Маша</Text>
                  </View>
                  <Ionicons name="star" size={14} color="#C4A46C" />
                </View>
              </View>
            )}

            {/* Artifact 3: Collective Consensus / Vote Poll Artifact */}
            {(fondFilter === 'all' || fondFilter === 'vote') && (
              <View style={styles.stitchVoteArtifactCard}>
                <View style={styles.stitchVoteArtifactTopRow}>
                  <Text style={styles.stitchVoteArtifactMeta}>ГОЛОСУВАННЯ · ЛОНГЛІСТ</Text>
                  <Text style={styles.stitchVoteArtifactDate}>15 КВІТНЯ</Text>
                </View>

                <Text style={styles.stitchVoteArtifactQuestion}>
                  Хто з нас найімовірніше виживе в зомбі-апокаліпсисі?
                </Text>

                {/* Poll bars */}
                <View style={styles.stitchPollBarsWrap}>
                  <View style={styles.stitchPollItem}>
                    <View style={styles.stitchPollRowText}>
                      <Text style={[styles.stitchPollName, { fontWeight: '700' }]}>👑 Діма</Text>
                      <Text style={[styles.stitchPollPct, { fontWeight: '700' }]}>60%</Text>
                    </View>
                    <View style={styles.stitchPollTrack}>
                      <View style={[styles.stitchPollFill, { width: '60%', backgroundColor: colors.terracotta }]} />
                    </View>
                  </View>

                  <View style={styles.stitchPollItem}>
                    <View style={styles.stitchPollRowText}>
                      <Text style={styles.stitchPollName}>Оля</Text>
                      <Text style={styles.stitchPollPct}>25%</Text>
                    </View>
                    <View style={styles.stitchPollTrack}>
                      <View style={[styles.stitchPollFill, { width: '25%', backgroundColor: colors.inkSecondary }]} />
                    </View>
                  </View>
                </View>

                <View style={styles.stitchVoteArtifactFooter}>
                  <Text style={styles.stitchVoteRoomSub}>Банда з КПІ 🔥</Text>
                  <Text style={styles.stitchVoteExportLink}>ЕКСПОРТ</Text>
                </View>
              </View>
            )}
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
        {/* Item 1: Today */}
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
            Today
          </Text>
        </TouchableOpacity>

        {/* Item 2: Circles */}
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
            Circles
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

        {/* Item 4: Memories */}
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
            Memories
          </Text>
        </TouchableOpacity>
      </View>
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

  // SCREEN 5 (REVEALED MATCH)
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

  // SCREEN 2 (ФОНД / LORE)
  stitchLoreCanvas: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 20,
  },
  stitchLoreSubheader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stitchLoreMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.inkSecondary,
    textTransform: 'uppercase',
  },
  stitchLoreScreenTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '400',
    color: colors.inkPrimary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  stitchLoreRoomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paperContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchLoreRoomPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkPrimary,
  },
  stitchLoreFiltersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stitchLoreFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchLoreFilterPillActive: {
    backgroundColor: colors.inkPrimary,
    borderColor: colors.inkPrimary,
  },
  stitchLoreFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  stitchLoreFilterPillTextActive: {
    color: '#FFFFFF',
  },
  stitchPhotoArtifactCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  stitchPhotoArtifactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchPhotoArtifactMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchPhotoArtifactDate: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  stitchPhotoArtifactImgWrap: {
    position: 'relative',
    width: '100%',
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stitchPhotoArtifactImg: {
    width: '100%',
    height: '100%',
  },
  stitchPhotoArtifactStarBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stitchPhotoArtifactStarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  stitchPhotoArtifactTitle: {
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '600',
    color: colors.inkPrimary,
    lineHeight: 22,
  },
  stitchPhotoArtifactDesc: {
    fontSize: 13,
    color: colors.inkSecondary,
    lineHeight: 18,
  },
  stitchPhotoArtifactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.paperBorder,
  },
  stitchPhotoReactionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stitchPhotoReactionBadge: {
    fontSize: 11,
    backgroundColor: colors.paperContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    color: colors.inkPrimary,
  },
  stitchPhotoShareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stitchPhotoShareText: {
    fontSize: 11,
    color: colors.inkSecondary,
    fontWeight: '600',
  },
  stitchQuoteArtifactCard: {
    backgroundColor: colors.paperContainerLow,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  stitchQuoteArtifactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchQuoteArtifactMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.terracotta,
    letterSpacing: 0.8,
  },
  stitchQuoteArtifactDate: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  stitchQuoteArtifactText: {
    fontFamily: fonts.serif,
    fontSize: 19,
    fontStyle: 'italic',
    color: colors.inkPrimary,
    lineHeight: 26,
  },
  stitchQuoteArtifactAuthorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.paperBorder,
  },
  stitchQuoteAuthorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  stitchQuoteAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  stitchVoteArtifactCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  stitchVoteArtifactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchVoteArtifactMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 0.8,
  },
  stitchVoteArtifactDate: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  stitchVoteArtifactQuestion: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.inkPrimary,
    lineHeight: 22,
  },
  stitchPollBarsWrap: {
    gap: 10,
  },
  stitchPollItem: {
    gap: 4,
  },
  stitchPollRowText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stitchPollName: {
    fontSize: 13,
    color: colors.inkPrimary,
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
