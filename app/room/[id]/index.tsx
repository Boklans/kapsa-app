import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, editorial, fonts, getAvatarPhotoUri } from '@/constants/colors';
import { ShareStoryModal } from '@/components/ShareStoryModal';
import { VoteSummaryBanner } from '@/components/VoteSummaryBanner';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { DeckTag, PromptFormat, RoundCard } from '@/types/kapsa';

const ROUND_BG_FRIENDS =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1000&q=85';
const ROUND_BG_COUPLE =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&q=85';

const DEMO_SAMPLE_PHOTOS = [
  {
    label: '☕ Кава',
    url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  },
  {
    label: '💻 Робочий вайб',
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80',
  },
  {
    label: '🌇 Вечірнє місто',
    url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80',
  },
];

const DECK_OPTIONS: { tag: DeckTag; label: string }[] = [
  { tag: 'core', label: '⚡ База' },
  { tag: 'spicy', label: '🔥 Гострі' },
  { tag: 'deep', label: '🌙 Глибокі' },
  { tag: 'nostalgia', label: '📼 Спогади' },
];

const QUICK_REACTIONS = ['😂', '🔥', '❤️', '💀'];

const formatCountdown = (revealAtIso: string): string | null => {
  const diffMs = new Date(revealAtIso).getTime() - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return null;
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
};

const formatRelativeOrTime = (iso: string | null): string => {
  if (!iso) return 'щойно';
  try {
    const d = new Date(iso);
    const diffMin = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
    if (diffMin < 60) return `${diffMin} хв тому`;
    return `сьогодні о ${d.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return 'сьогодні';
  }
};

export default function RoomDailyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [isStoryModalVisible, setIsStoryModalVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Стан для Екрана 3 («Відкрита відповідь» — Polaroid Detail Modal)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Стан для подачі власної відповіді (Composer Modal)
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [selectedVoteUserId, setSelectedVoteUserId] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({
    '😂': 4,
    '🔥': 2,
    '❤️': 2,
    '🥺': 1,
  });
  const [userReacted, setUserReacted] = useState<Record<string, boolean>>({});
  const [quickReplyText, setQuickReplyText] = useState('');
  const [hasSavedLore, setHasSavedLore] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const toggleEmojiReaction = (emoji: string) => {
    setReactionCounts((prev) => {
      const already = userReacted[emoji];
      const cur = prev[emoji] || 0;
      return {
        ...prev,
        [emoji]: already ? Math.max(0, cur - 1) : cur + 1,
      };
    });
    setUserReacted((prev) => ({
      ...prev,
      [emoji]: !prev[emoji],
    }));
  };

  const handleToggleLoreSave = async () => {
    setHasSavedLore((prev) => !prev);
    const targetCard = cards.find((c) => c.has_answered) || cards[0];
    if (targetCard && activeRoom && todayRound) {
      await togglePinToLore(activeRoom.id, todayRound.round_id, targetCard);
    }
  };

  const { userId, isDemoMode, isInitialized } = useAuthStore();
  const {
    activeRoom,
    todayRound,
    cards,
    loreItems,
    isLoading,
    isSubmitting,
    error,
    loadRoomDashboard,
    subscribeToRoomRealtime,
    submitRoundResponse,
    togglePinToLore,
    toggleCardReaction,
    nudgeMember,
    rerollTodayQuestion,
    leaveRoom,
    switchDemoPromptFormat,
    resetDemoMyResponse,
    simulateDemoFriendMove,
  } = useRoomStore();

  useEffect(() => {
    if (!id || !isInitialized) return;
    loadRoomDashboard(id);
    const unsubscribe = subscribeToRoomRealtime(id);
    return () => {
      unsubscribe();
    };
  }, [id, isInitialized, loadRoomDashboard, subscribeToRoomRealtime]);

  useEffect(() => {
    if (!todayRound?.reveal_at) return;
    setCountdown(formatCountdown(todayRound.reveal_at));
    if (todayRound.is_fully_revealed) return;
    const timer = setInterval(() => {
      setCountdown(formatCountdown(todayRound.reveal_at));
    }, 1000);
    return () => clearInterval(timer);
  }, [todayRound?.reveal_at, todayRound?.is_fully_revealed]);

  const handleShareCode = async () => {
    if (!activeRoom) return;

    const webOrigin =
      Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://kapsa.app';
    const inviteUrl = `${webOrigin}/join/${activeRoom.invite_code}`;
    const shareMessage = `Залітай у нашу приватну капсулу «${activeRoom.name}» в KAPSA! Код входу: ${activeRoom.invite_code} 👉 ${inviteUrl}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(inviteUrl);
        }
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        return;
      } catch {
        // fallback below
      }
    }

    try {
      await Share.share({
        message: shareMessage,
        url: inviteUrl,
      });
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // ignore share error
    }
  };

  const handlePickImage = async (useCamera: boolean) => {
    setValidationError(null);
    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.75,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.75,
            base64: true,
          });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setMediaUri(`data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          setMediaUri(asset.uri);
        }
      }
    } catch {
      setMediaUri(DEMO_SAMPLE_PHOTOS[0].url);
    }
  };

  const handleComposerSubmit = async () => {
    if (!todayRound || !activeRoom) return;
    setValidationError(null);

    if (todayRound.prompt_format === 'vote' && !selectedVoteUserId) {
      setValidationError('Обери учасника зі списку');
      return;
    }
    if (todayRound.prompt_format === 'show' && !mediaUri) {
      setValidationError('Додай фото моменту перед відправкою');
      return;
    }
    if (todayRound.prompt_format === 'answer' && !textContent.trim()) {
      setValidationError('Напиши свою відповідь');
      return;
    }

    await submitRoundResponse({
      roomId: activeRoom.id,
      roundId: todayRound.round_id,
      textContent: textContent.trim() || undefined,
      mediaPath: mediaUri,
      votedForUserId: selectedVoteUserId,
    });

    setIsComposerOpen(false);
  };

  if (!isInitialized || isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={editorial.coralAccent} />
          <Text style={styles.loadingText}>Відкриваємо вечірній раунд...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeRoom || !todayRound) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.centerBox, { paddingHorizontal: 24 }]}>
          <View style={styles.errorBanner}>
            <Text style={[styles.errorText, { textAlign: 'center' }]}>
              {error || 'Не вдалося завантажити капсулу дня'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => id && loadRoomDashboard(id)}
          >
            <Text style={styles.retryBtnText}>🔄 Спробувати ще раз</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backPill} onPress={() => router.replace('/')}>
            <Text style={styles.backPillText}>← На головну</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const myCard = cards.find((c) => c.user_id === userId);
  const answeredCount = cards.filter((c) => c.has_answered).length;
  const anyAnswered = answeredCount > 0;
  const isRoundUnlocked = Boolean(
    myCard?.has_answered || todayRound.is_fully_revealed
  );
  const hasWaitingFriends = cards.some((c) => !c.has_answered && c.user_id !== userId);
  const isDemoRoom = isDemoMode || activeRoom.id.startsWith('demo-');
  const activeDeck = activeRoom.active_deck || 'core';
  const revealHourStr = `${String(activeRoom.reveal_hour ?? 21).padStart(2, '0')}:00`;
  const roundHeroBgUri =
    activeRoom.type === 'couple' ? ROUND_BG_COUPLE : ROUND_BG_FRIENDS;

  const selectedCard: RoundCard | null =
    cards.find((c) => c.user_id === selectedCardId) || null;
  const selectedCardIndex = cards.findIndex((c) => c.user_id === selectedCardId);

  const formatLabel =
    todayRound.prompt_format === 'show'
      ? 'Фото-момент'
      : todayRound.prompt_format === 'vote'
      ? 'Голосування'
      : 'Питання дня';

  const heroPreviewAvatars = cards.slice(0, 3);
  const meMember = cards.find((c) => c.user_id === userId) || cards[0];
  const partnerMember = cards.find((c) => c.user_id !== userId) || cards[1] || cards[0];
  const chosenCandidateId = selectedVoteUserId || partnerMember.user_id;

  const handleSealDirect = async () => {
    if (!todayRound || !activeRoom) return;
    await submitRoundResponse({
      roomId: activeRoom.id,
      roundId: todayRound.round_id,
      textContent: textContent.trim() || undefined,
      mediaPath: mediaUri,
      votedForUserId: chosenCandidateId,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================================== */}
        {/* TOP CONTEXT BAR (Task-focused room header with tactile editorial sensibility) */}
        {/* =================================================================== */}
        <View style={styles.stitchTopContextBar}>
          <TouchableOpacity
            style={styles.stitchBackBtn}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
          >
            <Feather name="chevron-left" size={20} color={colors.inkPrimary} />
          </TouchableOpacity>

          <View style={styles.stitchRoomMetaCenter}>
            <Text style={styles.stitchRoomContextTag}>
              {!isRoundUnlocked ? 'ЩОДЕННИЙ РАУНД' : `${activeRoom.name} · РАУНД #19`}
            </Text>
            <View style={styles.stitchRoomPill}>
              <Text style={styles.stitchRoomPillText}>
                {activeRoom.name} {activeRoom.type === 'couple' ? '❤️' : '🔥'} · 14 ДНІВ В СИНКУ
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.stitchLoreStarBtn}
            onPress={() => router.push(`/room/${activeRoom.id}/lore`)}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={13} color="#C4A46C" />
            <Text style={styles.stitchLoreStarText}>Lore ({loreItems.length + 6}) ★</Text>
          </TouchableOpacity>
        </View>

        {/* =================================================================== */}
        {/* SCREEN 1: РАУНД: ГОЛОСУВАННЯ ТА ВІДПОВІДЬ (КОЛИ ЩЕ НЕ ЗАПЕЧАТАНО)  */}
        {/* =================================================================== */}
        {!isRoundUnlocked ? (
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
                onPress={() => router.push(`/room/${activeRoom.id}/lore`)}
              >
                <Feather name="star" size={12} color={colors.terracotta} />
                <Text style={styles.stitchRibbonLoreLink}>Lore (6) ★</Text>
              </TouchableOpacity>
            </View>

            {/* Expressive Monograph Question Card */}
            <View style={styles.stitchQuestionCard}>
              <View style={styles.stitchQuestionTopRow}>
                <View style={styles.stitchFormatTag}>
                  <Text style={styles.stitchFormatTagText}>{formatLabel}</Text>
                </View>
                <View style={styles.stitchBlindBadge}>
                  <Feather name="lock" size={11} color={colors.inkSecondary} />
                  <Text style={styles.stitchBlindBadgeText}>НАОСЛІП</Text>
                </View>
              </View>

              <Text style={styles.stitchQuestionTitle}>
                {todayRound.question_text || 'Хто з нас найімовірніше заснув би просто посеред гучної вечірки? ✨'}
              </Text>

              {/* Deck chips */}
              <View style={styles.stitchDeckPillsRow}>
                {DECK_OPTIONS.map((d) => {
                  const isCur = activeDeck === d.tag;
                  return (
                    <TouchableOpacity
                      key={d.tag}
                      style={[styles.stitchDeckPill, isCur && styles.stitchDeckPillActive]}
                      onPress={() => rerollTodayQuestion(activeRoom.id, d.tag)}
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
                  НАОСЛІП · ТАЄМНИЙ ВИБІР
                </Text>
                <Text style={styles.stitchBlindNoticeText}>
                  Відповіді відкриються одночасно для всіх о 21:00. Ніхто не бачить твій вибір до розпечатування капсули.
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
                    chosenCandidateId === meMember.user_id && styles.stitchCandidateCardSelected,
                  ]}
                  onPress={() => setSelectedVoteUserId(meMember.user_id)}
                  activeOpacity={0.88}
                >
                  <View style={styles.stitchCandidateCardTop}>
                    <View style={styles.stitchCandidateAvatarWrap}>
                      <Image
                        source={{ uri: getAvatarPhotoUri(meMember.avatar_emoji, 0) }}
                        style={styles.stitchCandidateAvatarImg}
                      />
                    </View>
                    <View style={[
                      styles.stitchCandidateRadioCircle,
                      chosenCandidateId === meMember.user_id && styles.stitchCandidateRadioCircleSelected,
                    ]}>
                      {chosenCandidateId === meMember.user_id && (
                        <View style={styles.stitchCandidateRadioDot} />
                      )}
                    </View>
                  </View>

                  <View style={styles.stitchCandidateCardBottom}>
                    <Text style={styles.stitchCandidateName}>Ти</Text>
                    <Text style={styles.stitchCandidateRole}>
                      {meMember.display_name} · Автор капсули
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Maks (Partner) */}
                <TouchableOpacity
                  style={[
                    styles.stitchCandidateCard,
                    chosenCandidateId === partnerMember.user_id && styles.stitchCandidateCardSelected,
                  ]}
                  onPress={() => setSelectedVoteUserId(partnerMember.user_id)}
                  activeOpacity={0.88}
                >
                  <View style={styles.stitchCandidateCardTop}>
                    <View style={styles.stitchCandidateAvatarWrap}>
                      <Image
                        source={{ uri: getAvatarPhotoUri(partnerMember.avatar_emoji, 1) }}
                        style={styles.stitchCandidateAvatarImg}
                      />
                    </View>
                    <View style={[
                      styles.stitchCandidateRadioCircle,
                      chosenCandidateId === partnerMember.user_id && styles.stitchCandidateRadioCircleSelected,
                    ]}>
                      {chosenCandidateId === partnerMember.user_id && (
                        <View style={styles.stitchCandidateRadioDot} />
                      )}
                    </View>
                  </View>

                  <View style={styles.stitchCandidateCardBottom}>
                    <Text style={styles.stitchCandidateName}>{partnerMember.display_name}</Text>
                    <Text style={styles.stitchCandidateRole}>
                      {partnerMember.display_name} · Учасник
                    </Text>
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
                  value={textContent}
                  onChangeText={setTextContent}
                />
                <View style={styles.stitchNoteFooterRow}>
                  <View style={styles.stitchNoteLockedNotice}>
                    <Feather name="lock" size={11} color={colors.inkSecondary} />
                    <Text style={styles.stitchNoteLockedNoticeText}>
                      Залишиться прихованим до 21:00
                    </Text>
                  </View>
                  <Text style={styles.stitchNoteCounterText}>
                    {textContent.length}/140
                  </Text>
                </View>
              </View>
            </View>

            {/* Room Pulse / Participation Status */}
            <View style={styles.stitchPulseBox}>
              <View style={styles.stitchPulseHeaderRow}>
                <Text style={styles.stitchPulseHeaderTitle}>ПУЛЬС КІМНАТИ</Text>
                <Text style={styles.stitchPulseHeaderCount}>
                  {answeredCount} з {cards.length} запечатано
                </Text>
              </View>

              <View style={styles.stitchPulseTilesRow}>
                {/* Partner status */}
                <View style={styles.stitchPulseTile}>
                  <View style={styles.stitchPulseAvatarWrap}>
                    <Image
                      source={{ uri: getAvatarPhotoUri(partnerMember.avatar_emoji, 1) }}
                      style={styles.stitchPulseAvatar}
                    />
                    <View style={styles.stitchPulseCheckBadge}>
                      <Feather name="check" size={9} color="#FFFFFF" />
                    </View>
                  </View>
                  <View>
                    <Text style={styles.stitchPulseMemberName}>{partnerMember.display_name}</Text>
                    <Text style={styles.stitchPulseMemberStatusDone}>Запечатав відповідь</Text>
                  </View>
                </View>

                {/* You status */}
                <View style={styles.stitchPulseTile}>
                  <View style={styles.stitchPulseAvatarWrap}>
                    <Image
                      source={{ uri: getAvatarPhotoUri(meMember.avatar_emoji, 0) }}
                      style={[styles.stitchPulseAvatar, { opacity: 0.7 }]}
                    />
                    <View style={styles.stitchPulseWaitingBadge}>
                      <Feather name="clock" size={9} color={colors.inkSecondary} />
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
                onPress={handleSealDirect}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="lock" size={17} color="#FFFFFF" />
                    <Text style={styles.stitchSealPrimaryBtnText}>Запечатати відповідь</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.stitchSealSubtext}>
                Відповіді стануть доступними в розділі <Text style={{ fontWeight: '600', color: colors.inkPrimary }}>Сьогодні</Text> одразу о 21:00
              </Text>
            </View>
          </View>
        ) : (
          /* =================================================================== */
          /* SCREEN 5: РОЗКРИТТЯ ВІДПОВІДЕЙ 21:00 (КОЛИ ВІДПОВІДЬ ЗАПЕЧАТАНО)   */
          /* =================================================================== */
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
                «{todayRound.question_text || 'Хто з нас найімовірніше заснув би просто посеред гучної вечірки? ✨'}»
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
                  100% ЗБІГ! Всі проголосували за {partnerMember.display_name} 😂
                </Text>
                <Text style={styles.stitchMatchDesc}>
                  Жодних сумнівів: титул «соні вечора» беззаперечно переходить до {partnerMember.display_name}.
                </Text>
              </View>
            </View>

            {/* 3. Voting Breakdown Cards */}
            <View style={styles.stitchBreakdownSection}>
              <View style={styles.stitchBreakdownHeaderRow}>
                <Text style={styles.stitchBreakdownHeaderTitle}>РЕЗУЛЬТАТИ ГОЛОСУВАННЯ</Text>
                <Text style={styles.stitchBreakdownHeaderTag}>ДВОЄ ОБРАЛИ ОДНЕ І ТЕ Ж</Text>
              </View>

              <View style={styles.stitchBreakdownGrid}>
                {/* Winner Card */}
                <View style={styles.stitchWinnerCard}>
                  <View style={styles.stitchWinnerBadge}>
                    <Text style={styles.stitchWinnerBadgeText}>ОБРАНО 2/2</Text>
                  </View>

                  <View style={styles.stitchBreakdownCenterCol}>
                    <View style={styles.stitchBreakdownAvatarWrap}>
                      <Image
                        source={{ uri: getAvatarPhotoUri(partnerMember.avatar_emoji, 1) }}
                        style={styles.stitchBreakdownAvatarImg}
                      />
                      <View style={styles.stitchWinnerCheckCircle}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                    </View>
                    <Text style={styles.stitchBreakdownCandidateName}>{partnerMember.display_name}</Text>
                    <Text style={styles.stitchBreakdownWinnerPct}>100% ГОЛОСІВ</Text>
                  </View>

                  <View style={styles.stitchBreakdownFooter}>
                    <Text style={styles.stitchBreakdownFooterText}>
                      Ти + {partnerMember.display_name} обрали його
                    </Text>
                  </View>
                </View>

                {/* Runner-up Card */}
                <View style={styles.stitchRunnerUpCard}>
                  <View style={styles.stitchBreakdownCenterCol}>
                    <View style={styles.stitchBreakdownAvatarWrap}>
                      <Image
                        source={{ uri: getAvatarPhotoUri(meMember.avatar_emoji, 0) }}
                        style={[styles.stitchBreakdownAvatarImg, { opacity: 0.7 }]}
                      />
                    </View>
                    <Text style={styles.stitchBreakdownCandidateName}>Катерина (Ти)</Text>
                    <Text style={styles.stitchBreakdownMutedPct}>0 ГОЛОСІВ</Text>
                  </View>

                  <View style={styles.stitchBreakdownFooter}>
                    <Text style={styles.stitchBreakdownFooterText}>
                      0 голосів
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 4. Unsealed Responses & Stories */}
            <View style={styles.stitchStoriesSection}>
              <Text style={styles.stitchStoriesSectionTitle}>ІСТОРІЇ ТА КОМЕНТАРІ ДО ВИБОРУ</Text>

              {/* Story 1: You */}
              <View style={styles.stitchStoryCard}>
                <View style={styles.stitchStoryHeaderRow}>
                  <View style={styles.stitchStoryAuthorRow}>
                    <Image
                      source={{ uri: getAvatarPhotoUri(meMember.avatar_emoji, 0) }}
                      style={styles.stitchStoryMiniAvatar}
                    />
                    <Text style={styles.stitchStoryAuthorName}>Катерина (Ти)</Text>
                    <Text style={styles.stitchStoryTime}>• щойно</Text>
                  </View>
                  <View style={styles.stitchStoryLocationTag}>
                    <Text style={styles.stitchStoryLocationText}>📍 Львів, тераса о 02:40</Text>
                  </View>
                </View>

                <Text style={styles.stitchStoryQuote}>
                  «{textContent || myCard?.text_content || 'Пам’ятаєш, як він вирубився прямо на пуфі під колонкою в клубі? Ми ще думали, що це пранк 😂'}»
                </Text>
              </View>

              {/* Story 2: Partner */}
              <View style={styles.stitchStoryCard}>
                <View style={styles.stitchStoryHeaderRow}>
                  <View style={styles.stitchStoryAuthorRow}>
                    <Image
                      source={{ uri: getAvatarPhotoUri(partnerMember.avatar_emoji, 1) }}
                      style={styles.stitchStoryMiniAvatar}
                    />
                    <Text style={styles.stitchStoryAuthorName}>{partnerMember.display_name}</Text>
                    <Text style={styles.stitchStoryTime}>• сьогодні о 19:15</Text>
                  </View>
                </View>

                <Text style={styles.stitchStoryQuote}>
                  «{partnerMember.text_content || 'Я просто зберігав енергію для наступного дня! Але так, це правда, я засну де завгодно 😴'}»
                </Text>
              </View>

              {/* Voice Note Snippet Artifact */}
              <View style={styles.stitchVoiceArtifactCard}>
                <TouchableOpacity
                  style={styles.stitchVoicePlayBtn}
                  onPress={() => setIsPlayingAudio((prev) => !prev)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={isPlayingAudio ? 'pause' : 'play'}
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
                          isPlayingAudio && i % 2 === 0 && { backgroundColor: colors.terracotta },
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.stitchVoiceMetaRow}>
                    <Text style={styles.stitchVoiceTitle}>Голосова репліка Макса</Text>
                    <Text style={styles.stitchVoiceDuration}>0:14</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 5. Emotional Reactions & Discussion */}
            <View style={styles.stitchReactionsSection}>
              <Text style={styles.stitchReactionsTitle}>ЕМОЦІЙНІ РЕАКЦІЇ</Text>

              <View style={styles.stitchEmojiChipsRow}>
                {Object.entries(reactionCounts).map(([em, cnt]) => {
                  const isActive = Boolean(userReacted[em]);
                  return (
                    <TouchableOpacity
                      key={em}
                      style={[
                        styles.stitchEmojiChip,
                        isActive && styles.stitchEmojiChipActive,
                      ]}
                      onPress={() => toggleEmojiReaction(em)}
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
                  placeholder="Написати у капсулу..."
                  placeholderTextColor={colors.inkMuted}
                  value={quickReplyText}
                  onChangeText={setQuickReplyText}
                />
                <TouchableOpacity
                  style={styles.stitchQuickSendBtn}
                  onPress={() => {
                    if (quickReplyText.trim()) {
                      setQuickReplyText('');
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
                  hasSavedLore && styles.stitchSaveLoreBtnActive,
                ]}
                onPress={handleToggleLoreSave}
                activeOpacity={0.88}
              >
                <Ionicons
                  name={hasSavedLore ? 'star' : 'star-outline'}
                  size={16}
                  color={hasSavedLore ? '#C4A46C' : colors.inkPrimary}
                />
                <Text style={styles.stitchSaveLoreBtnText}>
                  {hasSavedLore ? 'Збережено в Lore ★' : 'Зберегти в Lore ★'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stitchShareStoryBtn}
                onPress={() => setIsStoryModalVisible(true)}
                activeOpacity={0.88}
              >
                <Feather name="share-2" size={15} color={colors.inkPrimary} />
                <Text style={styles.stitchShareStoryBtnText}>Поділитися</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Панель тестування лише для швидкої зміни станів */}
        {isDemoRoom && (
          <View style={styles.demoSandbox}>
            <Text style={styles.demoSandboxTitle}>
              🧪 ТЕСТОВИЙ ПУЛЬТ (ДЕМО-РЕЖИМ)
            </Text>
            <View style={styles.demoBtnRow}>
              {myCard?.has_answered && (
                <TouchableOpacity
                  style={styles.demoChip}
                  onPress={() => resetDemoMyResponse(activeRoom.id)}
                >
                  <Text style={styles.demoChipText}>🔄 Скинути мій хід (Відкрити екран вибору)</Text>
                </TouchableOpacity>
              )}
              {hasWaitingFriends && (
                <TouchableOpacity
                  style={styles.demoChip}
                  onPress={() => simulateDemoFriendMove(activeRoom.id)}
                >
                  <Text style={styles.demoChipText}>⚡ Хід друга</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Кнопка виходу з кімнати */}
        <View style={styles.leaveWrap}>
          <TouchableOpacity
            onPress={async () => {
              await leaveRoom(activeRoom.id);
              router.replace('/');
            }}
          >
            <Text style={styles.leaveText}>Покинути кімнату</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ===================================================================== */}
      {/* ЕКРАН 3 МАКЕТУ: «ВІДКРИТА ВІДПОВІДЬ» (Біла Polaroid-картка у модалі) */}
      {/* ===================================================================== */}
      <Modal
        visible={Boolean(selectedCard && selectedCard.is_revealed)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCardId(null)}
      >
        <View style={styles.modalBackdrop}>
          {selectedCard && (
            <View style={styles.polaroidSheet}>
              {/* Шапка білої картки: портретний аватар + ім'я + час + кнопка закриття */}
              <View style={styles.polaroidHeader}>
                <View style={styles.polaroidAuthorRow}>
                  <Image
                    source={{
                      uri: getAvatarPhotoUri(
                        selectedCard.avatar_emoji,
                        Math.max(0, selectedCardIndex)
                      ),
                    }}
                    style={styles.polaroidAvatar}
                  />
                  <View>
                    <Text style={styles.polaroidAuthorName}>
                      {selectedCard.display_name}
                    </Text>
                    <Text style={styles.polaroidTimestamp}>
                      {formatRelativeOrTime(selectedCard.answered_at)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.polaroidCloseBtn}
                  onPress={() => setSelectedCardId(null)}
                >
                  <Text style={styles.polaroidCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Головне фото або цитата/голос */}
              {selectedCard.media_path ? (
                <View style={styles.polaroidImageFrame}>
                  <Image
                    source={{ uri: selectedCard.media_path }}
                    style={styles.polaroidImage}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View style={styles.polaroidEditorialCanvas}>
                  <Text style={styles.polaroidPromptContext}>
                    {todayRound.question_text}
                  </Text>
                  {selectedCard.voted_for_name && (
                    <View style={styles.polaroidVotePill}>
                      <Text style={styles.polaroidVotePillText}>
                        🗳️ Вибір: {selectedCard.voted_for_name}
                      </Text>
                    </View>
                  )}
                  {selectedCard.text_content && (
                    <Text style={styles.polaroidBigQuote}>
                      «{selectedCard.text_content}»
                    </Text>
                  )}
                </View>
              )}

              {/* Підпис під фото (якщо є і фото, і текст) */}
              {selectedCard.media_path && selectedCard.text_content ? (
                <Text style={styles.polaroidCaptionText}>
                  {selectedCard.text_content}
                </Text>
              ) : null}

              {/* Рядок швидких реакцій (як на Екрані 3: 😂 🔥 ❤️ 💀) */}
              {selectedCard.response_id && (
                <View style={styles.polaroidReactionsRow}>
                  {QUICK_REACTIONS.map((emoji) => {
                    const users = selectedCard.reactions?.[emoji] || [];
                    const count = users.length;
                    const isMine = users.includes(userId);
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.polaroidReactionPill,
                          isMine && styles.polaroidReactionPillActive,
                        ]}
                        onPress={() =>
                          selectedCard.response_id &&
                          toggleCardReaction(
                            activeRoom.id,
                            todayRound.round_id,
                            selectedCard.response_id,
                            emoji
                          )
                        }
                      >
                        <Text style={styles.polaroidReactionEmoji}>{emoji}</Text>
                        {count > 0 && (
                          <Text
                            style={[
                              styles.polaroidReactionCount,
                              isMine && { color: editorial.coralAccent },
                            ]}
                          >
                            {count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Дві фірмові кнопки з Екрану 3: "☆ У золотий фонд" + "Поділитися" */}
              <View style={styles.polaroidButtonsRow}>
                {selectedCard.response_id && (
                  <TouchableOpacity
                    style={[
                      styles.goldenFundBtn,
                      selectedCard.is_pinned_to_lore && styles.goldenFundBtnActive,
                    ]}
                    onPress={() =>
                      togglePinToLore(activeRoom.id, todayRound.round_id, selectedCard)
                    }
                  >
                    <Text style={styles.goldenFundBtnText}>
                      {selectedCard.is_pinned_to_lore
                        ? '⭐ В Lore'
                        : '☆ В Lore'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.sharePolaroidBtn}
                  onPress={() => {
                    setSelectedCardId(null);
                    setIsStoryModalVisible(true);
                  }}
                >
                  <Text style={styles.sharePolaroidBtnText}>Поділитися</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* МОДАЛЬНЕ ВІКНО ДОДАВАННЯ ВЛАСНОЇ ВІДПОВІДІ (Фото / Голос / Текст)     */}
      {/* ===================================================================== */}
      <Modal
        visible={isComposerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsComposerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.composerSheet}>
            <View style={styles.polaroidHeader}>
              <View>
                <Text style={styles.composerBadge}>{formatLabel}</Text>
                <Text style={styles.composerTitle}>Твоя відповідь у капсулу</Text>
              </View>
              <TouchableOpacity
                style={styles.polaroidCloseBtn}
                onPress={() => setIsComposerOpen(false)}
              >
                <Text style={styles.polaroidCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.composerQuestion}>{todayRound.question_text}</Text>

            {/* 1. Формат ГОЛОСУВАННЯ */}
            {todayRound.prompt_format === 'vote' && (
              <View style={styles.voteOptionsGrid}>
                {cards.map((member) => {
                  const isSelected = selectedVoteUserId === member.user_id;
                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      style={[
                        styles.voteOptionItem,
                        isSelected && styles.voteOptionItemSelected,
                      ]}
                      onPress={() => {
                        setValidationError(null);
                        setSelectedVoteUserId(member.user_id);
                      }}
                    >
                      <Text style={styles.voteOptionEmoji}>
                        {member.avatar_emoji}
                      </Text>
                      <Text
                        style={[
                          styles.voteOptionName,
                          isSelected && styles.voteOptionNameSelected,
                        ]}
                      >
                        {member.display_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 2. Формат ФОТО-МОМЕНТ */}
            {todayRound.prompt_format === 'show' && (
              <View style={styles.photoPickerSection}>
                {mediaUri ? (
                  <View style={styles.composerPreviewWrap}>
                    <Image
                      source={{ uri: mediaUri }}
                      style={styles.composerPreviewImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.retakePill}
                      onPress={() => setMediaUri(null)}
                    >
                      <Text style={styles.retakePillText}>🔄 Інше фото</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <View style={styles.pickerActionRow}>
                      <TouchableOpacity
                        style={styles.pickerPrimaryBtn}
                        onPress={() => handlePickImage(true)}
                      >
                        <Text style={styles.pickerPrimaryEmoji}>📸</Text>
                        <Text style={styles.pickerPrimaryLabel}>Камера</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.pickerSecondaryBtn}
                        onPress={() => handlePickImage(false)}
                      >
                        <Text style={styles.pickerPrimaryEmoji}>🖼️</Text>
                        <Text style={styles.pickerSecondaryLabel}>Галерея</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.samplePhotosRow}>
                      {DEMO_SAMPLE_PHOTOS.map((preset) => (
                        <TouchableOpacity
                          key={preset.label}
                          style={styles.samplePhotoChip}
                          onPress={() => {
                            setValidationError(null);
                            setMediaUri(preset.url);
                          }}
                        >
                          <Text style={styles.samplePhotoChipText}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Поле коментаря / текстової відповіді */}
            <TextInput
              style={[
                styles.composerInput,
                todayRound.prompt_format === 'answer' && { minHeight: 96 },
              ]}
              placeholder={
                todayRound.prompt_format === 'answer'
                  ? 'Напиши свою чесну відповідь...'
                  : 'Коментар (необов’язково)...'
              }
              placeholderTextColor={editorial.inkMuted}
              value={textContent}
              onChangeText={(val) => {
                setValidationError(null);
                setTextContent(val);
              }}
              maxLength={280}
              multiline
            />

            {validationError ? (
              <Text style={styles.validationErrText}>⚠️ {validationError}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.composerSubmitBtn}
              onPress={handleComposerSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.composerSubmitBtnText}>
                  Запечатати та відкрити раунд →
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальне вікно генерації Story */}
      <ShareStoryModal
        visible={isStoryModalVisible}
        onClose={() => setIsStoryModalVisible(false)}
        room={activeRoom}
        round={todayRound}
        cards={cards}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paperBg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 42,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.inkPrimary,
    fontSize: 15,
    fontFamily: fonts.sans,
  },

  // ГОЛОВНА HERO-КАРТКА РАУНДУ (Чистий Editorial стиль, піщаний колір #EFE8DC)
  roundHeroCard: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: '#EFE8DC',
    padding: 20,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2D9CB',
    shadowColor: '#1A1816',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  roundHeroBgImage: {
    display: 'none',
  },
  roundHeroGradient: {
    display: 'none',
  },
  heroTopSection: {
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroRoomTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '64%',
  },
  heroCloseIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D9CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRoomName: {
    color: colors.inkPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  heroRoomSub: {
    color: colors.inkSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  timerGlassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2D9CB',
  },
  timerGlassText: {
    color: colors.inkPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inviteGlassChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2D9CB',
  },
  inviteGlassChipCopied: {
    borderColor: colors.success,
    backgroundColor: 'rgba(47, 179, 128, 0.12)',
  },
  inviteGlassChipText: {
    color: colors.inkPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  loreGlassChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2D9CB',
  },
  loreGlassChipText: {
    color: colors.inkPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  heroBottomCentered: {
    alignItems: 'center',
    paddingTop: 16,
  },
  heroFormatPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroFormatCreamPill: {
    backgroundColor: 'rgba(255, 111, 97, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroFormatCreamText: {
    color: colors.coralAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  rerollMiniPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D9CB',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rerollMiniText: {
    color: colors.inkPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  questionHeroText: {
    fontFamily: fonts.serif,
    color: colors.inkPrimary,
    fontSize: 25,
    fontWeight: '600',
    lineHeight: 33,
    textAlign: 'center',
    marginVertical: 14,
    paddingHorizontal: 6,
  },
  deckRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  deckChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2D9CB',
  },
  deckChipActive: {
    backgroundColor: colors.inkPrimary,
    borderColor: colors.inkPrimary,
  },
  deckChipText: {
    color: colors.inkSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  deckChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heroCenteredAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  heroCenterAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: colors.paperElevated,
  },
  heroCenterAvatarImg: {
    width: '100%',
    height: '100%',
  },
  heroExtraCountPill: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D9CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroExtraCountText: {
    color: colors.inkPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroDarkActionPill: {
    width: '100%',
    backgroundColor: colors.inkPrimary,
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1A1816',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  heroDarkActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  answeredActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  viewMyCardBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D9CB',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMyCardBtnText: {
    color: colors.inkPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  shareStoryBtn: {
    flex: 1,
    backgroundColor: colors.coralAccent,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareStoryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // БЛОК «ХТО ВЖЕ ВІДПОВІВ (3 з 5)» З ВЕЛИКИМИ КРУГЛИМИ ПОРТРЕТАМИ В КІЛЬЦЯХ
  whoAnsweredSection: {
    marginTop: 22,
    gap: 12,
  },
  whoAnsweredHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  whoAnsweredTitle: {
    color: colors.inkPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  whoAnsweredCount: {
    color: colors.inkSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  whoAnsweredRingsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  whoRingItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  whoRingCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperElevated,
    borderWidth: 2.5,
    padding: 2,
  },
  whoRingCircleAnswered: {
    borderColor: '#2FB380',
  },
  whoRingCircleWaiting: {
    borderColor: colors.paperBorder,
  },
  whoRingName: {
    color: colors.inkPrimary,
    fontSize: 11,
    fontWeight: '600',
  },

  // СІТКА КАРТОК ВІДПОВІДЕЙ УЧАСНИКІВ
  portraitGridHeader: {
    marginTop: 22,
    marginBottom: 10,
  },
  portraitGridTitle: {
    color: colors.inkSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  portraitCardsRow: {
    gap: 12,
    paddingBottom: 8,
  },
  portraitCardWaiting: {
    width: 152,
    height: 218,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    padding: 12,
    justifyContent: 'space-between',
  },
  portraitCardSealed: {
    width: 152,
    height: 218,
    borderRadius: 20,
    backgroundColor: '#F7F3EB',
    borderWidth: 1,
    borderColor: '#E2D9CB',
    padding: 12,
    justifyContent: 'space-between',
  },
  portraitCardRevealed: {
    width: 152,
    height: 218,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.paperBorder,
    position: 'relative',
    shadowColor: '#1A1816',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  portraitCardPinned: {
    borderColor: '#C4A46C',
    borderWidth: 2,
  },
  portraitPhotoBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  portraitTextBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2C2520',
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 46,
    justifyContent: 'center',
  },
  portraitVoteBox: {
    backgroundColor: 'rgba(255, 107, 74, 0.18)',
    borderRadius: 10,
    padding: 6,
    marginBottom: 6,
  },
  portraitVoteLabel: {
    color: '#E5DEC9',
    fontSize: 10,
  },
  portraitVoteTarget: {
    color: '#FF8566',
    fontSize: 12,
    fontWeight: '800',
  },
  portraitQuotePreview: {
    fontFamily: fonts.serif,
    color: '#F8F6F1',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  portraitPhotoScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  portraitTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  portraitAuthorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18, 16, 14, 0.72)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: 104,
  },
  portraitMiniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  portraitAuthorName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  greenTickCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2FB380',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenTickIcon: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  portraitSilhouetteCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  silhouetteCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  silentTitle: {
    color: '#C7BFB5',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  nudgePillBtn: {
    backgroundColor: colors.paperElevated,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
  },
  nudgePillBtnDone: {
    backgroundColor: 'rgba(47, 179, 128, 0.15)',
  },
  nudgePillText: {
    color: colors.inkPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  myTurnMiniPill: {
    backgroundColor: editorial.coralAccent,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
  },
  myTurnMiniText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sealedVaultBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  sealedLockCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 111, 97, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sealedVaultLabel: {
    color: colors.inkPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  sealedVaultHint: {
    color: colors.inkSecondary,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  portraitBottomGlass: {
    zIndex: 2,
    backgroundColor: 'rgba(18, 16, 14, 0.78)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portraitBottomTime: {
    color: '#E5DEC9',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  portraitBottomBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  portraitReactionCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  demoSandbox: {
    marginTop: 26,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  demoSandboxTitle: {
    color: colors.inkSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  demoBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  demoChip: {
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  demoChipActive: {
    backgroundColor: editorial.coralAccent,
  },
  demoChipText: {
    color: colors.inkPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  leaveWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  leaveText: {
    color: colors.inkMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  errorBanner: {
    backgroundColor: 'rgba(217, 79, 79, 0.2)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#FFB4B4',
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: editorial.coralAccent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backPill: {
    paddingVertical: 10,
  },
  backPillText: {
    color: '#D6CFC7',
    fontSize: 14,
  },

  // ЕКРАН 3: Біла Polaroid-картка («Відкрита відповідь»)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 13, 11, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  polaroidSheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  polaroidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  polaroidAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  polaroidAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroidAvatarEmoji: {
    fontSize: 20,
  },
  polaroidAuthorName: {
    color: '#1A1A1A',
    fontSize: 17,
    fontWeight: '800',
  },
  polaroidTimestamp: {
    color: '#7A746E',
    fontSize: 12,
  },
  polaroidCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroidCloseText: {
    color: '#4A4540',
    fontSize: 15,
    fontWeight: '700',
  },
  polaroidImageFrame: {
    width: '100%',
    height: 290,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#EAE4DC',
    marginBottom: 14,
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  polaroidEditorialCanvas: {
    width: '100%',
    minHeight: 200,
    borderRadius: 20,
    backgroundColor: '#F8F6F1',
    padding: 20,
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  polaroidPromptContext: {
    color: '#7A746E',
    fontSize: 12,
    marginBottom: 10,
  },
  polaroidVotePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  polaroidVotePillText: {
    color: editorial.coralAccent,
    fontSize: 14,
    fontWeight: '800',
  },
  polaroidBigQuote: {
    fontFamily: fonts.serif,
    color: '#1A1A1A',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  polaroidCaptionText: {
    color: '#1A1A1A',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 14,
    fontWeight: '500',
  },
  polaroidReactionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  polaroidReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F2EC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E6E0D6',
  },
  polaroidReactionPillActive: {
    backgroundColor: '#FFF0EC',
    borderColor: editorial.coralAccent,
  },
  polaroidReactionEmoji: {
    fontSize: 16,
  },
  polaroidReactionCount: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '700',
  },
  polaroidButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  goldenFundBtn: {
    flex: 1,
    backgroundColor: '#F5E8C7',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldenFundBtnActive: {
    backgroundColor: '#EBD49E',
  },
  goldenFundBtnText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '700',
  },
  sharePolaroidBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharePolaroidBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // COMPOSER MODAL
  composerSheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#F8F6F1',
    borderRadius: 28,
    padding: 20,
  },
  composerBadge: {
    color: editorial.coralAccent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  composerTitle: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '800',
  },
  composerQuestion: {
    fontFamily: fonts.serif,
    color: '#1A1A1A',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 14,
  },
  voteOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  voteOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E4DFD7',
  },
  voteOptionItemSelected: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  voteOptionEmoji: {
    fontSize: 16,
  },
  voteOptionName: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
  },
  voteOptionNameSelected: {
    color: '#FFFFFF',
  },
  photoPickerSection: {
    marginBottom: 12,
  },
  pickerActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  pickerPrimaryBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    gap: 4,
  },
  pickerSecondaryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E4DFD7',
  },
  pickerPrimaryEmoji: {
    fontSize: 20,
  },
  pickerPrimaryLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerSecondaryLabel: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '700',
  },
  samplePhotosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  samplePhotoChip: {
    backgroundColor: '#EFECE6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  samplePhotoChipText: {
    color: '#4A4540',
    fontSize: 11,
    fontWeight: '600',
  },
  composerPreviewWrap: {
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  composerPreviewImage: {
    width: '100%',
    height: '100%',
  },
  retakePill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(26,26,26,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retakePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  composerInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1A1A1A',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E4DFD7',
    marginBottom: 12,
  },
  validationErrText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
  },
  composerSubmitBtn: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: 'center',
  },
  composerSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // =========================================================================
  // GOOGLE STITCH ROOM SCREEN (SCREEN 1 & SCREEN 5) STYLES
  // =========================================================================
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
  stitchBackBtn: {
    padding: 6,
    borderRadius: 8,
  },
  stitchRoomMetaCenter: {
    alignItems: 'center',
    gap: 3,
  },
  stitchRoomContextTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stitchRoomPill: {
    backgroundColor: colors.paperContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchRoomPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.terracotta,
  },
  stitchLoreStarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  stitchLoreStarText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkPrimary,
  },

  // SCREEN 1 (VOTING)
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

  // SCREEN 5 (REVEALED)
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
});
