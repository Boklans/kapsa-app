import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, DECK_THEMES } from '@/constants/colors';
import { PromptFormat, RoomType, RoundCard, TodayRound } from '@/types/kapsa';

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

interface PromptCardProps {
  round: TodayRound;
  roomType: RoomType;
  members: RoundCard[];
  myCard?: RoundCard;
  isSubmitting: boolean;
  onSubmit: (payload: {
    textContent?: string;
    mediaPath?: string | null;
    votedForUserId?: string | null;
  }) => void;
}

const FORMAT_META: Record<PromptFormat, { badge: string; hint: string }> = {
  vote: {
    badge: '🗳️ ГОЛОСУВАННЯ «ХТО З НАС?»',
    hint: 'Обери одного учасника та додай коментар, щоб відкрити чужі голоси',
  },
  show: {
    badge: '📸 ПОКАЖИ МОМЕНТ',
    hint: 'Зроби фото «тут і зараз» та додай короткий підпис',
  },
  answer: {
    badge: '💬 ПИТАННЯ ДНЯ',
    hint: 'Напиши коротку відповідь (до 280 символів), щоб відкрити капсулу',
  },
};

export const PromptCard: React.FC<PromptCardProps> = ({
  round,
  roomType,
  members,
  myCard,
  isSubmitting,
  onSubmit,
}) => {
  const [selectedVoteUserId, setSelectedVoteUserId] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(() =>
    formatCountdown(round.reveal_at)
  );

  useEffect(() => {
    setCountdown(formatCountdown(round.reveal_at));
    if (round.is_fully_revealed) return;

    const timer = setInterval(() => {
      setCountdown(formatCountdown(round.reveal_at));
    }, 1000);

    return () => clearInterval(timer);
  }, [round.reveal_at, round.is_fully_revealed]);

  const deckKey = round.deck_tag || 'core';
  const deckTheme = DECK_THEMES[deckKey] || DECK_THEMES.core;
  const accentColor =
    deckKey !== 'core'
      ? deckTheme.accent
      : roomType === 'couple'
      ? colors.coupleAccent
      : colors.primary;
  const meta = FORMAT_META[round.prompt_format];
  const hasAnswered = Boolean(myCard?.has_answered);

  const handlePickImage = async (useCamera: boolean) => {
    setValidationError(null);
    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]?.uri) {
        setMediaUri(result.assets[0].uri);
      }
    } catch {
      // Fallback для емулятора або веб-середовища без камери
      setMediaUri(
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'
      );
    }
  };

  const handleSubmit = () => {
    setValidationError(null);

    if (round.prompt_format === 'vote' && !selectedVoteUserId) {
      setValidationError('Обери учасника, за якого віддаєш голос');
      return;
    }

    if (round.prompt_format === 'show' && !mediaUri) {
      setValidationError('Додай фото моменту перед відправкою');
      return;
    }

    if (round.prompt_format === 'answer' && !textContent.trim()) {
      setValidationError('Напиши свою відповідь');
      return;
    }

    onSubmit({
      textContent: textContent.trim() || undefined,
      mediaPath: mediaUri,
      votedForUserId: selectedVoteUserId,
    });
  };

  const totalMembers = Math.max(members.length, 1);
  const answeredCount = members.filter((m) => m.has_answered).length;
  const remainingMoves = Math.max(members.length - answeredCount, 0);
  const isRevealedOrExpired = round.is_fully_revealed || !countdown;
  const progressPercent = Math.min(100, Math.round((answeredCount / totalMembers) * 100));

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: accentColor + '66',
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={[styles.topRibbon, { backgroundColor: accentColor }]} />

      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          <View style={[styles.badge, { backgroundColor: accentColor + '22' }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{meta.badge}</Text>
          </View>
          <View style={[styles.deckTagPill, { borderColor: accentColor + '44' }]}>
            <Text style={[styles.deckTagText, { color: accentColor }]}>
              {deckTheme.badgeLabel}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.counterPill,
            isRevealedOrExpired && styles.counterPillRevealed,
          ]}
        >
          <Text
            style={[
              styles.counterText,
              isRevealedOrExpired && { color: colors.success, fontWeight: '800' },
            ]}
          >
            {isRevealedOrExpired
              ? '🔓 Капсулу відкрито'
              : `⏱️ До 21:00: ${countdown}`}
          </Text>
        </View>
      </View>

      <Text style={styles.questionText}>{round.question_text}</Text>

      {/* Візуальний прогрес-бар кворуму */}
      <View style={styles.quorumBox}>
        <View style={styles.quorumTopRow}>
          <Text style={styles.quorumStatusText}>
            {isRevealedOrExpired
              ? `🔥 Кворум зібрано (${answeredCount}/${members.length}) — усі картки відкриті`
              : members.length < 2
              ? '👥 Запроси друзів за кодом кімнати зверху, щоб відкривати капсулу разом'
              : `🔒 У капсулі: ${answeredCount} з ${members.length} — ще ${remainingMoves} ${
                  remainingMoves === 1 ? 'хід' : 'ходи'
                } для дострокового відкриття`}
          </Text>
          <Text style={[styles.quorumPercent, { color: accentColor }]}>
            {progressPercent}%
          </Text>
        </View>

        <View style={styles.quorumTrack}>
          <View
            style={[
              styles.quorumFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: isRevealedOrExpired ? colors.success : accentColor,
              },
            ]}
          />
        </View>

        <View style={styles.quorumAvatarsRow}>
          {members.map((m) => (
            <View
              key={m.user_id}
              style={[
                styles.quorumAvatarChip,
                m.has_answered && {
                  borderColor: colors.success,
                  backgroundColor: 'rgba(46, 196, 182, 0.14)',
                },
              ]}
            >
              <Text style={styles.quorumAvatarEmoji}>{m.avatar_emoji}</Text>
              <Text
                style={[
                  styles.quorumAvatarName,
                  m.has_answered && { color: colors.textPrimary, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {m.display_name}
              </Text>
              <Text style={styles.quorumAvatarCheck}>
                {m.has_answered ? '✓' : '•'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {hasAnswered ? (
        <View style={styles.doneBanner}>
          <Text style={styles.doneEmoji}>✨</Text>
          <View style={styles.doneTextWrap}>
            <Text style={styles.doneTitle}>Твій хід у капсулі!</Text>
            <Text style={styles.doneSubtitle}>
              Усі відповіді учасників, які вже походили, тепер відкриті для тебе нижче.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.formSection}>
          <Text style={styles.hintText}>{meta.hint}</Text>

          {/* Формат 1: ГОЛОСУВАННЯ */}
          {round.prompt_format === 'vote' && (
            <View style={styles.voteGrid}>
              {members.map((member) => {
                const isSelected = selectedVoteUserId === member.user_id;
                return (
                  <TouchableOpacity
                    key={member.user_id}
                    style={[
                      styles.voteOption,
                      isSelected && {
                        borderColor: accentColor,
                        backgroundColor: accentColor + '24',
                      },
                    ]}
                    onPress={() => {
                      setSelectedVoteUserId(member.user_id);
                      setValidationError(null);
                    }}
                  >
                    <Text style={styles.voteAvatar}>{member.avatar_emoji}</Text>
                    <Text
                      style={[
                        styles.voteName,
                        isSelected && { color: colors.textPrimary, fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {member.display_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Формат 2: ПОКАЖИ МОМЕНТ (ФОТО) */}
          {round.prompt_format === 'show' && (
            <View style={styles.photoSection}>
              {mediaUri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: mediaUri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.changePhotoBtn}
                    onPress={() => setMediaUri(null)}
                  >
                    <Text style={styles.changePhotoText}>Змінити фото ✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={[styles.photoPickerBtn, { borderColor: accentColor }]}
                    onPress={() => handlePickImage(true)}
                  >
                    <Text style={styles.photoPickerEmoji}>📸</Text>
                    <Text style={styles.photoPickerLabel}>Зробити фото</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={() => handlePickImage(false)}
                  >
                    <Text style={styles.photoPickerEmoji}>🖼️</Text>
                    <Text style={styles.photoPickerLabel}>З галереї</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={() =>
                      setMediaUri(
                        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'
                      )
                    }
                  >
                    <Text style={styles.photoPickerEmoji}>⚡</Text>
                    <Text style={styles.photoPickerLabel}>Демо-кадр</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Текстове поле: коментар до голосу, підпис до фото або відповідь дня */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.textInput,
                round.prompt_format === 'answer' && styles.textInputMultiline,
              ]}
              placeholder={
                round.prompt_format === 'vote'
                  ? 'Чому саме він/вона? Додай жарт або аргумент...'
                  : round.prompt_format === 'show'
                  ? 'Короткий підпис до моменту...'
                  : 'Твоя історія або відповідь...'
              }
              placeholderTextColor={colors.textMuted}
              multiline={round.prompt_format === 'answer'}
              maxLength={280}
              value={textContent}
              onChangeText={(val) => {
                setTextContent(val);
                if (validationError) setValidationError(null);
              }}
            />
            <Text style={styles.charCount}>{textContent.length}/280</Text>
          </View>

          {validationError ? (
            <Text style={styles.errorText}>⚠️ {validationError}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: accentColor }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                Відповісти та відкрити капсулу 🔓
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    gap: 14,
    overflow: 'hidden',
  },
  topRibbon: {
    height: 4,
    borderRadius: 2,
    marginBottom: 2,
    opacity: 0.9,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  deckTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
  },
  deckTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  counterPill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  counterPillRevealed: {
    backgroundColor: 'rgba(46, 196, 182, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(46, 196, 182, 0.4)',
  },
  counterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
  },
  quorumBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quorumTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  quorumStatusText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  quorumPercent: {
    fontSize: 12,
    fontWeight: '800',
  },
  quorumTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  quorumFill: {
    height: '100%',
    borderRadius: 4,
  },
  quorumAvatarsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  quorumAvatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quorumAvatarEmoji: {
    fontSize: 13,
  },
  quorumAvatarName: {
    color: colors.textMuted,
    fontSize: 11,
    maxWidth: 90,
  },
  quorumAvatarCheck: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  formSection: {
    gap: 12,
    marginTop: 4,
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  voteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  voteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: '46%',
    flexGrow: 1,
  },
  voteAvatar: {
    fontSize: 20,
  },
  voteName: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  photoSection: {
    marginVertical: 2,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPickerBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPickerEmoji: {
    fontSize: 22,
  },
  photoPickerLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
  },
  changePhotoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(10, 10, 15, 0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changePhotoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 26,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textInputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    right: 12,
    bottom: 7,
    fontSize: 11,
    color: colors.textMuted,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(46, 196, 182, 0.12)',
    borderColor: 'rgba(46, 196, 182, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  doneEmoji: {
    fontSize: 22,
  },
  doneTextWrap: {
    flex: 1,
    gap: 2,
  },
  doneTitle: {
    color: colors.success,
    fontWeight: '800',
    fontSize: 14,
  },
  doneSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

