import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts } from '@/constants/colors';
import { Room, RoundCard, TodayRound } from '@/types/kapsa';

const STORY_DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80';

interface ShareStoryModalProps {
  visible: boolean;
  onClose: () => void;
  room: Room;
  round: TodayRound;
  cards: RoundCard[];
}

export const ShareStoryModal: React.FC<ShareStoryModalProps> = ({
  visible,
  onClose,
  room,
  round,
  cards,
}) => {
  const [includeQuote, setIncludeQuote] = useState(false);

  useEffect(() => {
    if (visible) {
      setIncludeQuote(false);
    }
  }, [visible]);

  const revealedCards = cards.filter((c) => c.is_revealed);
  const topQuoteCard =
    revealedCards.find((c) => Boolean(c.text_content)) || revealedCards[0];
  const topPhotoCard = revealedCards.find((c) => Boolean(c.media_path));
  const heroPhotoUri = topPhotoCard?.media_path || STORY_DEFAULT_PHOTO;

  // Підрахунок голосів для графіка результатів (як на Екрані 4 Макета №2)
  const tally = new Map<
    string,
    { name: string; emoji: string; count: number }
  >();
  let totalVotes = 0;

  for (const c of revealedCards) {
    if (c.voted_for_user_id && c.voted_for_name) {
      totalVotes += 1;
      const targetMember = cards.find((m) => m.user_id === c.voted_for_user_id);
      const prev = tally.get(c.voted_for_user_id);
      tally.set(c.voted_for_user_id, {
        name: c.voted_for_name,
        emoji: targetMember?.avatar_emoji || '😎',
        count: (prev?.count || 0) + 1,
      });
    }
  }

  const voteRows = Array.from(tally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((item) => ({
      ...item,
      pct: totalVotes > 0 ? Math.round((item.count / totalVotes) * 100) : 0,
    }));

  // Якщо в раунді ще мало голосів, формуємо красивий прев'ю-список учасників
  const displayPollRows =
    voteRows.length > 0
      ? voteRows
      : cards.slice(0, 4).map((m, idx) => ({
          name: m.display_name,
          emoji: m.avatar_emoji,
          count: 1,
          pct: [42, 28, 18, 12][idx] || 15,
        }));

  const leader = displayPollRows[0];

  const todayFormatted = new Date().toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
  });

  const handleShareExternal = async () => {
    const verdictLine =
      round.prompt_format === 'vote' && leader
        ? `\n🏆 Результаты голосування: ${leader.name} (${leader.pct}%)`
        : '';
    const quoteLine =
      includeQuote && topQuoteCard?.text_content
        ? `\n💬 ${topQuoteCard.avatar_emoji} ${topQuoteCard.display_name}: «${topQuoteCard.text_content}»`
        : '';

    const message =
      `✨ KAPSA • Капсула дня «${room.name}»\n\n` +
      `❓ ${round.question_text}` +
      verdictLine +
      quoteLine +
      `\n\nПриєднуйся за кодом: #${room.invite_code}`;

    try {
      await Share.share({ message });
    } catch {
      // ignore
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollWrap}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalContainer}>
            {/* Верхній рядок закриття */}
            <View style={styles.topBar}>
              <Text style={styles.screenHeaderTitle}>Поділитись</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeCircle}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* SCRAPBOOK КАРТКА STORY (Екран 4 Макета №2) */}
            <View style={styles.scrapbookCard}>
              {/* Полароїдне фото зверху з приклеєним стікером "Капсула дня ☆" */}
              <View style={styles.polaroidPhotoBox}>
                <Image
                  source={{ uri: heroPhotoUri }}
                  style={styles.polaroidPhoto}
                  resizeMode="cover"
                />

                {/* Приклеєний паперовий стікер зверху зліва */}
                <View style={styles.tapedSticker}>
                  <View style={styles.stickerTape} />
                  <Text style={styles.tapedStickerText}>
                    {'* Капсула\n   дня ☆'}
                  </Text>
                </View>

                <Text style={styles.handwrittenSignature}>-KAPSA-</Text>
              </View>

              {/* Тіло надірваної паперової картки */}
              <View style={styles.paperBody}>
                <Text style={styles.questionSerif}>{round.question_text}</Text>

                {/* Результати голосування або головна відповідь */}
                <Text style={styles.resultsSubheading}>
                  {round.prompt_format === 'vote'
                    ? 'Результати голосування'
                    : 'Момент капсули'}
                </Text>

                <View style={styles.pollList}>
                  {displayPollRows.map((row, idx) => (
                    <View key={idx} style={styles.pollRow}>
                      <View style={styles.pollAvatarBox}>
                        <Text style={styles.pollAvatarEmoji}>{row.emoji}</Text>
                      </View>

                      <View style={styles.pollBarCol}>
                        <View style={styles.pollNameLine}>
                          <Text style={styles.pollNameText} numberOfLines={1}>
                            {row.name}
                          </Text>
                          <Text style={styles.pollPctText}>{row.pct}%</Text>
                        </View>
                        <View style={styles.pollTrack}>
                          <View
                            style={[
                              styles.pollFill,
                              {
                                width: `${row.pct}%`,
                                backgroundColor:
                                  idx === 0 ? '#222222' : '#9A9287',
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Блок цитати друга (якщо увімкнено перемикач) */}
                {includeQuote && topQuoteCard?.text_content && (
                  <View style={styles.friendQuoteBox}>
                    <Text style={styles.friendQuoteText}>
                      “{topQuoteCard.text_content}”
                    </Text>
                    <Text style={styles.friendQuoteAuthor}>
                      — {topQuoteCard.avatar_emoji} {topQuoteCard.display_name}
                    </Text>
                  </View>
                )}

                {/* Футер картки */}
                <Text style={styles.cardFooterMeta}>
                  🔥 {room.name} • {todayFormatted}
                </Text>
              </View>
            </View>

            {/* Перемикач "Додати цитату друга" як на Екрані 4 Макета №2 */}
            {topQuoteCard?.text_content && (
              <TouchableOpacity
                style={styles.quoteToggleRow}
                activeOpacity={0.85}
                onPress={() => setIncludeQuote((prev) => !prev)}
              >
                <View
                  style={[
                    styles.switchTrack,
                    includeQuote && styles.switchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      includeQuote && styles.switchThumbActive,
                    ]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quoteToggleTitle}>
                    Додати цитату друга
                  </Text>
                  <Text style={styles.quoteToggleSub}>
                    Показати, що сказав(ла) {topQuoteCard.display_name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Головна світла кнопка "Поділитися в сторіс" */}
            <TouchableOpacity
              style={styles.shareCreamBtn}
              onPress={handleShareExternal}
              activeOpacity={0.9}
            >
              <Text style={styles.shareCreamBtnIcon}>📤</Text>
              <Text style={styles.shareCreamBtnText}>Поділитися в сторіс</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 14, 12, 0.92)',
  },
  scrollWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenHeaderTitle: {
    fontFamily: fonts.serif,
    color: '#F6F3EC',
    fontSize: 20,
    fontWeight: '700',
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#F6F3EC',
    fontSize: 14,
    fontWeight: '700',
  },
  scrapbookCard: {
    backgroundColor: '#F6F3EC',
    borderRadius: 24,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  polaroidPhotoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    paddingBottom: 26,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 14,
  },
  polaroidPhoto: {
    width: '100%',
    height: 185,
    borderRadius: 10,
  },
  tapedSticker: {
    position: 'absolute',
    top: -6,
    left: 12,
    backgroundColor: '#F6F3EC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DFD7C8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  stickerTape: {
    position: 'absolute',
    top: -6,
    left: 18,
    width: 36,
    height: 11,
    backgroundColor: 'rgba(232, 222, 198, 0.9)',
    borderRadius: 2,
  },
  tapedStickerText: {
    fontFamily: fonts.handwritten,
    fontSize: 16,
    color: '#222222',
    lineHeight: 18,
    fontWeight: '700',
  },
  handwrittenSignature: {
    position: 'absolute',
    bottom: 4,
    right: 14,
    fontFamily: fonts.handwritten,
    fontSize: 17,
    color: '#4A4540',
    fontWeight: '700',
  },
  paperBody: {
    paddingHorizontal: 6,
    gap: 10,
  },
  questionSerif: {
    fontFamily: fonts.serif,
    color: '#222222',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
  },
  resultsSubheading: {
    color: '#6E675F',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  pollList: {
    gap: 8,
  },
  pollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pollAvatarBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E8E1D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollAvatarEmoji: {
    fontSize: 14,
  },
  pollBarCol: {
    flex: 1,
    gap: 3,
  },
  pollNameLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pollNameText: {
    color: '#222222',
    fontSize: 12,
    fontWeight: '700',
  },
  pollPctText: {
    color: '#6E675F',
    fontSize: 11,
    fontWeight: '700',
  },
  pollTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2DACB',
    overflow: 'hidden',
  },
  pollFill: {
    height: '100%',
    borderRadius: 2,
  },
  friendQuoteBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2DACB',
    marginTop: 2,
  },
  friendQuoteText: {
    fontFamily: fonts.serif,
    color: '#222222',
    fontSize: 13,
    fontStyle: 'italic',
  },
  friendQuoteAuthor: {
    color: '#6E675F',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  cardFooterMeta: {
    color: '#8C8275',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  quoteToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: colors.coralAccent,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F6F3EC',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  quoteToggleTitle: {
    color: '#F6F3EC',
    fontSize: 14,
    fontWeight: '700',
  },
  quoteToggleSub: {
    color: '#9A9287',
    fontSize: 12,
  },
  shareCreamBtn: {
    backgroundColor: '#F6F3EC',
    borderRadius: 999,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareCreamBtnIcon: {
    fontSize: 16,
  },
  shareCreamBtnText: {
    color: '#222222',
    fontSize: 15,
    fontWeight: '800',
  },
});
