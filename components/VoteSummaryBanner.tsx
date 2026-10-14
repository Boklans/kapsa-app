import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { RoomType, RoundCard } from '@/types/kapsa';

interface VoteSummaryBannerProps {
  cards: RoundCard[];
  roomType: RoomType;
  isFullyRevealed: boolean;
}

export const VoteSummaryBanner: React.FC<VoteSummaryBannerProps> = ({
  cards,
  roomType,
  isFullyRevealed,
}) => {
  const revealedVotes = cards.filter(
    (c) => c.is_revealed && c.voted_for_user_id && c.voted_for_name
  );

  if (revealedVotes.length === 0) {
    return null;
  }

  // Режим "Пара ❤️": перевіряємо збіг думок (Match)
  if (roomType === 'couple') {
    const bothVoted = revealedVotes.length >= 2;
    const isMatch =
      bothVoted &&
      revealedVotes[0].voted_for_user_id === revealedVotes[1].voted_for_user_id;

    return (
      <View
        style={[
          styles.banner,
          {
            borderColor: isMatch ? colors.coupleAccent : colors.border,
            backgroundColor: isMatch
              ? 'rgba(255, 59, 127, 0.14)'
              : colors.surface,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.emoji}>{isMatch ? '💘' : '⚡'}</Text>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>
              {!bothVoted
                ? 'Проміжний результат пари'
                : isMatch
                ? `Ідеальний Match! Ви обоє обрали: ${revealedVotes[0].voted_for_name}`
                : 'Думки розділилися! Кожен має свою версію 😄'}
            </Text>
            <Text style={styles.subtitle}>
              {!bothVoted
                ? 'Чекаємо на другий голос для фінального вердикту'
                : isMatch
                ? 'Ваша синхронізація сьогодні на 100%'
                : `${revealedVotes[0].display_name} → ${revealedVotes[0].voted_for_name}  •  ${revealedVotes[1].display_name} → ${revealedVotes[1].voted_for_name}`}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Режим "Банда 🔥": підраховуємо лідера голосування
  const tallyMap = new Map<
    string,
    { userId: string; name: string; emoji: string; count: number }
  >();

  for (const vote of revealedVotes) {
    const targetId = vote.voted_for_user_id!;
    const targetMember = cards.find((c) => c.user_id === targetId);
    const existing = tallyMap.get(targetId);
    if (existing) {
      existing.count += 1;
    } else {
      tallyMap.set(targetId, {
        userId: targetId,
        name: vote.voted_for_name || 'Учасник',
        emoji: targetMember?.avatar_emoji || '🔥',
        count: 1,
      });
    }
  }

  const sorted = Array.from(tallyMap.values()).sort((a, b) => b.count - a.count);
  const leader = sorted[0];
  const totalVotes = revealedVotes.length;

  return (
    <View style={[styles.banner, { borderColor: colors.primary + '66' }]}>
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>🏆</Text>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>
            {isFullyRevealed ? 'Підсумок голосування дня' : 'Поточний лідер голосування'}
          </Text>
          <Text style={styles.subtitle}>
            {leader.emoji} {leader.name} — {leader.count} із {totalVotes}{' '}
            {totalVotes === 1 ? 'відкритого голосу' : 'відкритих голосів'}
          </Text>
        </View>
      </View>

      <View style={styles.barsContainer}>
        {sorted.map((item) => {
          const pct = Math.round((item.count / totalVotes) * 100);
          return (
            <View key={item.userId} style={styles.barRow}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barName}>
                  {item.emoji} {item.name}
                </Text>
                <Text style={styles.barCount}>
                  {item.count} гол. ({pct}%)
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  barsContainer: {
    gap: 8,
    marginTop: 2,
  },
  barRow: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  barCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    height: 7,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});

