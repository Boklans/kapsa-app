import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { colors } from '@/constants/colors';
import { PromptFormat, RoomType, RoundCard } from '@/types/kapsa';

const QUICK_REACTIONS = ['😂', '🔥', '💀', '❤️', '🧢'];

const formatAnsweredTime = (iso: string | null): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

interface MemberResponseCardProps {
  card: RoundCard;
  promptFormat: PromptFormat;
  roomType: RoomType;
  currentUserId: string;
  onTogglePin: (card: RoundCard) => void;
  onToggleReaction?: (responseId: string, emoji: string) => void;
  onNudge?: (targetUserId: string) => void;
}

export const MemberResponseCard: React.FC<MemberResponseCardProps> = ({
  card,
  promptFormat,
  roomType,
  currentUserId,
  onTogglePin,
  onToggleReaction,
  onNudge,
}) => {
  const isCurrentUser = card.user_id === currentUserId;
  const accentColor = roomType === 'couple' ? colors.coupleAccent : colors.primary;

  const revealAnim = useRef(new Animated.Value(card.is_revealed ? 1 : 0.96)).current;

  useEffect(() => {
    if (card.is_revealed) {
      Animated.spring(revealAnim, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }).start();
    }
  }, [card.is_revealed, revealAnim]);

  const reactionEntries = Object.entries(card.reactions || {});
  const totalReactions = reactionEntries.reduce(
    (acc, [, users]) => acc + users.length,
    0
  );
  const timeStr = formatAnsweredTime(card.answered_at);

  return (
    <Animated.View
      style={[
        styles.card,
        card.is_revealed && styles.cardRevealed,
        card.is_pinned_to_lore && styles.cardPinned,
        { transform: [{ scale: revealAnim }] },
      ]}
    >
      {/* Шапка картки учасника */}
      <View style={styles.headerRow}>
        <View style={styles.authorWrap}>
          <View
            style={[
              styles.avatarCircle,
              card.has_answered && {
                borderColor: card.is_revealed ? colors.success : colors.gold,
              },
            ]}
          >
            <Text style={styles.avatarEmoji}>{card.avatar_emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {card.display_name}
              </Text>
              {isCurrentUser && (
                <View style={[styles.youBadge, { borderColor: accentColor + '66' }]}>
                  <Text style={[styles.youBadgeText, { color: accentColor }]}>ТИ</Text>
                </View>
              )}
            </View>
            <Text style={styles.statusSubtext}>
              {!card.has_answered
                ? 'Ще не зробив(ла) хід'
                : card.is_revealed
                ? timeStr
                  ? `🔓 Відкрито • хід о ${timeStr}`
                  : '🔓 Відповідь відкрито'
                : timeStr
                ? `🔒 У капсулі з ${timeStr}`
                : '🔒 Відповідь приховано до твого ходу'}
            </Text>
          </View>
        </View>

        {/* Кнопка Pin to Lore ⭐ або статус */}
        {card.is_revealed && card.response_id ? (
          <TouchableOpacity
            style={[
              styles.loreBtn,
              card.is_pinned_to_lore && styles.loreBtnActive,
            ]}
            onPress={() => onTogglePin(card)}
          >
            <Text
              style={[
                styles.loreBtnText,
                card.is_pinned_to_lore && styles.loreBtnTextActive,
              ]}
            >
              {card.is_pinned_to_lore ? '⭐ В Lore' : '☆ В Lore'}
            </Text>
          </TouchableOpacity>
        ) : !card.has_answered && !isCurrentUser && onNudge ? (
          <TouchableOpacity
            style={[
              styles.nudgeBtn,
              card.is_nudged && styles.nudgeBtnDone,
            ]}
            onPress={() => !card.is_nudged && onNudge(card.user_id)}
            disabled={card.is_nudged}
          >
            <Text
              style={[
                styles.nudgeBtnText,
                card.is_nudged && styles.nudgeBtnTextDone,
              ]}
            >
              {card.is_nudged ? '⚡ Штурхнули!' : '👆 Штурхнути'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.statusPill,
              card.has_answered ? styles.statusPillReady : styles.statusPillWaiting,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                card.has_answered
                  ? { color: colors.gold }
                  : { color: colors.textMuted },
              ]}
            >
              {card.has_answered ? '🔒 В капсулі' : '⏳ Чекаємо'}
            </Text>
          </View>
        )}
      </View>

      {/* Тіло картки залежно від стану */}
      {!card.has_answered ? (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>
            {card.is_nudged
              ? '⚡ Ми надіслали штурхан! Очікуємо на хід учасника...'
              : '⏳ Учасник ще думає над сьогоднішнім питанням...'}
          </Text>
        </View>
      ) : !card.is_revealed ? (
        /* Візуальний сейф "Запечатана капсула" (0 байтів витоку з сервера) */
        <View style={styles.lockedVault}>
          <View style={styles.vaultSealBadge}>
            <Text style={styles.vaultSealText}>
              {card.has_media
                ? '📸 ФОТО-МОМЕНТ ЗАПЕЧАТАНО В КАПСУЛІ'
                : promptFormat === 'vote'
                ? '🗳️ ГОЛОС ЗАПЕЧАТАНО В КАПСУЛІ'
                : '💬 ВІДПОВІДЬ ЗАПЕЧАТАНО В КАПСУЛІ'}
            </Text>
          </View>

          {/* Силует засекреченого тексту (декоративний skeleton без реальних даних) */}
          <View style={styles.redactedBlock}>
            <View style={[styles.redactedBar, { width: '78%' }]} />
            <View style={[styles.redactedBar, { width: '54%' }]} />
          </View>

          <Text style={styles.lockedSubtitle}>
            Зроби свій хід у картці зверху, щоб миттєво зняти печатку з цієї відповіді 🔓
          </Text>
        </View>
      ) : (
        <View style={styles.revealedContent}>
          {/* Якщо формат Голосування — показуємо, за кого проголосував учасник */}
          {promptFormat === 'vote' && card.voted_for_name && (
            <View
              style={[
                styles.voteTargetBox,
                {
                  borderColor: accentColor + '55',
                  backgroundColor: accentColor + '16',
                },
              ]}
            >
              <Text style={styles.voteTargetLabel}>Віддав(ла) голос за:</Text>
              <Text style={[styles.voteTargetName, { color: accentColor }]}>
                👉 {card.voted_for_name}
              </Text>
            </View>
          )}

          {/* Якщо формат Фото — показуємо знімок у фоторамці */}
          {promptFormat === 'show' && card.media_path && (
            <View style={styles.photoFrame}>
              <Image
                source={{ uri: card.media_path }}
                style={styles.responseImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Текстовий коментар або відповідь */}
          {card.text_content ? (
            <View style={[styles.quoteBox, { borderLeftColor: accentColor }]}>
              <Text style={styles.responseText}>«{card.text_content}»</Text>
            </View>
          ) : null}

          {/* Живі емодзі-реакції */}
          {card.response_id && onToggleReaction && (
            <View style={styles.reactionsBar}>
              {QUICK_REACTIONS.map((emoji) => {
                const users = card.reactions?.[emoji] || [];
                const count = users.length;
                const isMine = users.includes(currentUserId);
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.reactionChip,
                      count > 0 && styles.reactionChipWithCount,
                      isMine && {
                        borderColor: accentColor,
                        backgroundColor: accentColor + '22',
                      },
                    ]}
                    onPress={() => onToggleReaction(card.response_id!, emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    {count > 0 && (
                      <Text
                        style={[
                          styles.reactionCount,
                          isMine && { color: colors.textPrimary, fontWeight: '800' },
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

          {/* Підказка автоматичного збереження в Золотий фонд при 2+ реакціях */}
          {totalReactions >= 2 && !card.is_pinned_to_lore && (
            <TouchableOpacity
              style={styles.loreSuggestBanner}
              onPress={() => onTogglePin(card)}
            >
              <Text style={styles.loreSuggestText}>
                🔥 Ця відповідь зібрала {totalReactions} реакції! Зберегти в Lore ⭐
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardRevealed: {
    borderColor: '#303550',
  },
  cardPinned: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 209, 102, 0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  authorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  youBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusPillReady: {
    backgroundColor: 'rgba(255, 209, 102, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.35)',
  },
  statusPillWaiting: {
    backgroundColor: colors.surfaceElevated,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  nudgeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 94, 58, 0.16)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  nudgeBtnDone: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  nudgeBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  nudgeBtnTextDone: {
    color: colors.textSecondary,
  },
  loreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loreBtnActive: {
    backgroundColor: 'rgba(255, 209, 102, 0.2)',
    borderColor: colors.gold,
  },
  loreBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  loreBtnTextActive: {
    color: colors.gold,
    fontWeight: '800',
  },
  waitingBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
  },
  waitingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  lockedVault: {
    backgroundColor: '#161826',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.28)',
  },
  vaultSealBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 209, 102, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vaultSealText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  redactedBlock: {
    gap: 6,
    paddingVertical: 4,
  },
  redactedBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  lockedSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  revealedContent: {
    gap: 10,
  },
  voteTargetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  voteTargetLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  voteTargetName: {
    fontSize: 15,
    fontWeight: '800',
  },
  photoFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  responseImage: {
    width: '100%',
    height: 240,
    backgroundColor: colors.surfaceElevated,
  },
  quoteBox: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 2,
  },
  responseText: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  reactionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionChipWithCount: {
    borderColor: '#3D4260',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  loreSuggestBanner: {
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
    borderColor: 'rgba(255, 209, 102, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loreSuggestText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
});
