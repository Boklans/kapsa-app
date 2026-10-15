import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, editorial, fonts, getAvatarPhotoUri } from '@/constants/colors';
import { MemberResponseCard } from '@/components/MemberResponseCard';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { LoreItem } from '@/types/kapsa';

type LoreViewMode = 'lore' | 'history';
type LoreFilter = 'all' | 'photo' | 'vote' | 'quote';

interface BentoShowcaseItem extends LoreItem {
  room_badge?: string;
  custom_date?: string;
  card_height?: number;
  poll_bars?: { name: string; pct: number }[];
}

// 6 фірмових карток із Екрана 3 шаблону Макета №2 (забезпечують асиметричну Masonry-сітку)
const TEMPLATE_SHOWCASE_LORE: BentoShowcaseItem[] = [
  {
    id: 'showcase-1',
    room_id: 'showcase',
    round_id: 'r1',
    response_id: 'resp1',
    pinned_by: 'u1',
    created_at: '2025-05-12T21:00:00Z',
    custom_date: '12 травня 2025',
    room_badge: 'Банда з КПІ 🔥',
    author_name: 'Макс',
    author_emoji: '😎',
    question_text: 'Покажи атмосферу цього вечора одним кадром',
    text_content: 'Вечір на даху',
    media_path:
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80',
    card_height: 224,
  },
  {
    id: 'showcase-2',
    room_id: 'showcase',
    round_id: 'r2',
    response_id: 'resp2',
    pinned_by: 'u1',
    created_at: '2025-05-08T21:00:00Z',
    custom_date: '8 травня 2025',
    room_badge: 'Пара ❤️',
    author_name: 'Маша',
    author_emoji: '❤️',
    question_text: 'Опиши нас однією фразою',
    text_content: 'Ти — моя улюблена катастрофа.',
    media_path: null,
    card_height: 176,
  },
  {
    id: 'showcase-3',
    room_id: 'showcase',
    round_id: 'r3',
    response_id: 'resp3',
    pinned_by: 'u1',
    created_at: '2025-04-27T21:00:00Z',
    custom_date: '27 квітня 2025',
    room_badge: 'Банда з КПІ 🔥',
    author_name: 'Діма',
    author_emoji: '🔥',
    question_text: 'Найкращий кадр нашого виїзду',
    text_content: 'Найкращий виїзд',
    media_path:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80',
    card_height: 238,
  },
  {
    id: 'showcase-4',
    room_id: 'showcase',
    round_id: 'r4',
    response_id: 'resp4',
    pinned_by: 'u1',
    created_at: '2025-04-15T21:00:00Z',
    custom_date: '15 квітня 2025',
    room_badge: 'Банда з КПІ 🔥',
    author_name: 'Оля',
    author_emoji: '🍕',
    question_text: 'Хто з нас найбільше витрачає гроші на їжу?',
    voted_for_name: 'Діма',
    text_content: null,
    media_path: null,
    card_height: 248,
    poll_bars: [
      { name: 'Діма', pct: 42 },
      { name: 'Оля', pct: 28 },
      { name: 'Макс', pct: 12 },
    ],
  },
  {
    id: 'showcase-5',
    room_id: 'showcase',
    round_id: 'r5',
    response_id: 'resp5',
    pinned_by: 'u1',
    created_at: '2025-04-03T21:00:00Z',
    custom_date: '3 квітня 2025',
    room_badge: 'Пара ❤️',
    author_name: 'Алекс',
    author_emoji: '❤️',
    question_text: 'За що ти вдячний(на) сьогодні?',
    text_content: 'Дякую, що ти завжди обираєш мене.',
    media_path: null,
    card_height: 174,
  },
  {
    id: 'showcase-6',
    room_id: 'showcase',
    round_id: 'r6',
    response_id: 'resp6',
    pinned_by: 'u1',
    created_at: '2025-03-21T21:00:00Z',
    custom_date: '21 березня 2025',
    room_badge: 'Банда з КПІ 🔥',
    author_name: 'Оля',
    author_emoji: '🐱',
    question_text: 'Головний герой сьогоднішнього дня',
    text_content: 'Кіт на тусі',
    media_path:
      'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600&q=80',
    card_height: 204,
  },
];

export default function RoomLoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId, isInitialized } = useAuthStore();
  const {
    activeRoom,
    loreItems,
    roundHistory,
    selectedHistoryRoundId,
    historyRoundCards,
    isLoadingHistoryCards,
    loadRoomLore,
    loadRoomRoundHistory,
    loadHistoryRoundCards,
    togglePinToLore,
    toggleCardReaction,
  } = useRoomStore();

  const [viewMode, setViewMode] = useState<LoreViewMode>('lore');
  const [filter, setFilter] = useState<LoreFilter>('all');
  const [selectedLoreItem, setSelectedLoreItem] =
    useState<BentoShowcaseItem | null>(null);

  useEffect(() => {
    if (id && isInitialized) {
      loadRoomLore(id);
      loadRoomRoundHistory(id);
    }
  }, [id, isInitialized, loadRoomLore, loadRoomRoundHistory]);

  const formatDate = (iso: string, custom?: string) => {
    if (custom) return custom;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return iso.slice(0, 10);
    }
  };

  const roomType = activeRoom?.type || 'friends';
  const defaultRoomBadge = activeRoom
    ? `${activeRoom.name} ${activeRoom.type === 'couple' ? '❤️' : '🔥'}`
    : 'Банда з КПІ 🔥';

  // Об'єднуємо реальні збережені спогади кімнати з вітриною шаблону, щоб сітка завжди виглядала наповненою
  const combinedItems: BentoShowcaseItem[] = [
    ...loreItems.map((item) => ({
      ...item,
      room_badge: defaultRoomBadge,
    })),
    ...TEMPLATE_SHOWCASE_LORE,
  ];

  const filteredItems = combinedItems.filter((item) => {
    if (filter === 'photo') return Boolean(item.media_path);
    if (filter === 'vote') return Boolean(item.voted_for_name);
    if (filter === 'quote')
      return Boolean(item.text_content && !item.media_path && !item.voted_for_name);
    return true;
  });

  // Розподіляємо картки на Лівий та Правий стовпчики для справжньої асиметричної Masonry-сітки (як на шаблоні)
  const leftColumnItems = filteredItems.filter((_, idx) => idx % 2 === 0);
  const rightColumnItems = filteredItems.filter((_, idx) => idx % 2 === 1);

  const renderBentoCard = (item: BentoShowcaseItem) => {
    const isPhotoCard = Boolean(item.media_path);
    const isVoteCard = Boolean(item.voted_for_name && !item.media_path);
    const badgeLabel = item.room_badge || defaultRoomBadge;
    const dateLabel = formatDate(item.created_at, item.custom_date);

    // 1. ФОТО-КАРТКА (Повноекранне фото + кімната + підпис + дата + золотий ★)
    if (isPhotoCard && item.media_path) {
      return (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.bentoPhotoCard,
            { height: item.card_height || 226 },
          ]}
          activeOpacity={0.9}
          onPress={() => setSelectedLoreItem(item)}
        >
          <Image
            source={{ uri: item.media_path }}
            style={styles.bentoBgImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[
              'rgba(18, 15, 12, 0.05)',
              'rgba(18, 15, 12, 0.45)',
              'rgba(12, 10, 8, 0.90)',
            ]}
            locations={[0, 0.48, 1]}
            style={styles.bentoPhotoScrim}
          />

          <View style={styles.bentoPhotoBottom}>
            <Text style={styles.bentoPhotoRoom} numberOfLines={1}>
              {badgeLabel}
            </Text>
            <Text style={styles.bentoPhotoCaption} numberOfLines={2}>
              {item.text_content || item.question_text}
            </Text>
            <View style={styles.bentoFooterRow}>
              <Text style={styles.bentoDateText}>{dateLabel}</Text>
              <Ionicons name="star" size={11} color="#C4A46C" />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // 2. КАРТКА-ГОЛОСУВАННЯ (Темно-графітова з чіткою інфографікою % та лідером)
    if (isVoteCard) {
      const pollBars = item.poll_bars || [
        { name: item.voted_for_name || 'Діма', pct: 42 },
        { name: item.author_name || 'Оля', pct: 28 },
        { name: 'Макс', pct: 12 },
      ];

      return (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.bentoVoteCard,
            { minHeight: item.card_height || 244 },
          ]}
          activeOpacity={0.9}
          onPress={() => setSelectedLoreItem(item)}
        >
          <View>
            <View style={styles.bentoVoteHeaderRow}>
              <Text style={styles.bentoVoteLabel}>Голосування</Text>
              <Ionicons name="stats-chart" size={11} color="#9E968B" />
            </View>

            <Text style={styles.bentoVoteQuestion} numberOfLines={3}>
              {item.question_text}
            </Text>

            <View style={styles.miniPollBarsWrap}>
              {pollBars.map((row, rIdx) => {
                const isLeader = rIdx === 0;
                return (
                  <View key={rIdx} style={styles.miniPollItem}>
                    <View style={styles.miniPollTextRow}>
                      <Text
                        style={[
                          styles.miniPollName,
                          isLeader && styles.miniPollNameLeader,
                        ]}
                        numberOfLines={1}
                      >
                        {isLeader ? `👑 ${row.name}` : row.name}
                      </Text>
                      <Text
                        style={[
                          styles.miniPollPct,
                          isLeader && styles.miniPollPctLeader,
                        ]}
                      >
                        {row.pct}%
                      </Text>
                    </View>
                    <View style={styles.miniPollTrack}>
                      <View
                        style={[
                          styles.miniPollFill,
                          {
                            width: `${row.pct}%`,
                            backgroundColor: isLeader ? '#FFFFFF' : '#6A635B',
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.bentoFooterRow}>
            <Text style={styles.bentoDateText}>{badgeLabel} • {dateLabel}</Text>
            <Ionicons name="star" size={11} color="#C4A46C" />
          </View>
        </TouchableOpacity>
      );
    }

    // 3. КАРТКА-ЦИТАТА (Світлий крафтовий папір, вишукані лапки, засічковий Playfair Display)
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.bentoPaperQuoteCard,
          { minHeight: item.card_height || 176 },
        ]}
        activeOpacity={0.9}
        onPress={() => setSelectedLoreItem(item)}
      >
        <View>
          <Text style={styles.bentoQuoteMark}>“</Text>
          <Text style={styles.bentoQuoteSerif} numberOfLines={4}>
            {item.text_content || item.question_text}
          </Text>

          {item.author_name ? (
            <View style={styles.bentoQuoteAuthorRow}>
              <Image
                source={{ uri: getAvatarPhotoUri(item.author_emoji) }}
                style={styles.bentoQuoteAuthorAvatar}
              />
              <Text style={styles.bentoQuoteAuthorName}>
                {item.author_name}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bentoQuoteFooterRow}>
          <Text style={styles.bentoQuoteFooterMeta} numberOfLines={1}>
            {badgeLabel} • {dateLabel}
          </Text>
          <Ionicons name="star" size={11} color="#C4A46C" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Шапка Екрана 3 («Lore») */}
        <View style={styles.topHeaderRow}>
          <Text style={styles.loreHeading}>Lore</Text>

          <View style={styles.topRightRow}>
            <TouchableOpacity
              style={[
                styles.archiveSwitchPill,
                viewMode === 'history' && styles.archiveSwitchPillActive,
              ]}
              onPress={() =>
                setViewMode((prev) => (prev === 'lore' ? 'history' : 'lore'))
              }
            >
              <Feather
                name="calendar"
                size={12}
                color={viewMode === 'history' ? '#FFFFFF' : colors.inkPrimary}
              />
              <Text
                style={[
                  styles.archiveSwitchText,
                  viewMode === 'history' && styles.archiveSwitchTextActive,
                ]}
              >
                {viewMode === 'lore'
                  ? `Архів (${roundHistory.length})`
                  : 'До Lore'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToRoundPill}
              onPress={() => (id ? router.push(`/room/${id}`) : router.push('/'))}
            >
              <Feather name="arrow-left" size={13} color={colors.inkPrimary} />
              <Text style={styles.backToRoundText}>Раунд</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Сегментована панель фільтрів на пісочній плашці: Усі (24) | Фото (12) | Цитати (8) | Голоси (4) */}
        {viewMode === 'lore' && (
          <View style={styles.segmentedBar}>
            {(
              [
                { key: 'all', label: `Усі (${combinedItems.length})` },
                {
                  key: 'photo',
                  label: `Фото (${
                    combinedItems.filter((i) => Boolean(i.media_path)).length
                  })`,
                },
                {
                  key: 'quote',
                  label: `Цитати (${
                    combinedItems.filter(
                      (i) =>
                        Boolean(i.text_content && !i.media_path && !i.voted_for_name)
                    ).length
                  })`,
                },
                {
                  key: 'vote',
                  label: `Голоси (${
                    combinedItems.filter((i) => Boolean(i.voted_for_name)).length
                  })`,
                },
              ] as { key: LoreFilter; label: string }[]
            ).map((tab) => {
              const active = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.segmentedTab,
                    active && styles.segmentedTabActive,
                  ]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text
                    style={[
                      styles.segmentedTabText,
                      active && styles.segmentedTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* РЕЖИМ 1: 2-КОЛОНКОВА АСИМЕТРИЧНА MASONRY/BENTO-СІТКА (Екран 3 шаблону) */}
        {viewMode === 'lore' ? (
          <View style={styles.masonryColumnsRow}>
            <View style={styles.masonryColumn}>
              {leftColumnItems.map(renderBentoCard)}
            </View>
            <View style={styles.masonryColumn}>
              {rightColumnItems.map(renderBentoCard)}
            </View>
          </View>
        ) : (
          /* РЕЖИМ 2: ХРОНОЛОГІЧНИЙ АРХІВ РАУНДІВ */
          <View style={styles.historyList}>
            {roundHistory.length === 0 ? (
              <View style={styles.emptyPaperBox}>
                <Text style={styles.emptyTitle}>Архів раундів поки порожній</Text>
              </View>
            ) : (
              roundHistory.map((round) => {
                const isExpanded = selectedHistoryRoundId === round.round_id;
                const formatBadge =
                  round.prompt_format === 'vote'
                    ? 'Голосування'
                    : round.prompt_format === 'show'
                    ? 'Фото-момент'
                    : 'Питання дня';

                return (
                  <View key={round.round_id} style={styles.historyPaperCard}>
                    <TouchableOpacity
                      style={styles.historyHeaderTouch}
                      onPress={() => id && loadHistoryRoundCards(id, round.round_id)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.historyTopMeta}>
                        <View style={styles.historyDateBadge}>
                          <Text style={styles.historyDateText}>
                            {formatDate(round.round_date)}
                          </Text>
                        </View>
                        <Text style={styles.historyFormatLabel}>{formatBadge}</Text>
                      </View>

                      <Text style={styles.historyQuestionSerif}>
                        {round.question_text}
                      </Text>

                      <View style={styles.historyFooterRow}>
                        <Text style={styles.historyStatText}>
                          {round.is_revealed ? 'Капсулу відкрито' : 'Раунд триває'}
                        </Text>
                        <Text style={styles.historyExpandAction}>
                          {isExpanded ? 'Згорнути ▲' : 'Відкрити відповіді ▼'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.historyExpandedContainer}>
                        {isLoadingHistoryCards ? (
                          <ActivityIndicator
                            color={editorial.coralAccent}
                            style={{ marginVertical: 14 }}
                          />
                        ) : (
                          historyRoundCards.map((card) => (
                            <MemberResponseCard
                              key={card.user_id}
                              card={card}
                              promptFormat={round.prompt_format}
                              roomType={roomType}
                              currentUserId={userId}
                              onTogglePin={(c) =>
                                id && togglePinToLore(id, round.round_id, c)
                              }
                              onToggleReaction={(respId, emoji) =>
                                id &&
                                toggleCardReaction(id, round.round_id, respId, emoji)
                              }
                            />
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Нижній таб-бар із тонкими векторними іконками (як у Бренд-кіті Макета №2) */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/?tab=home')}
        >
          <Ionicons name="home-outline" size={20} color={colors.inkSecondary} />
          <Text style={styles.tabLabel}>Головна</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/?tab=rooms')}
        >
          <Ionicons
            name="people-outline"
            size={21}
            color={colors.inkSecondary}
          />
          <Text style={styles.tabLabel}>Кімнати</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.centerPlusFab}
          onPress={() => router.push('/?tab=create')}
          activeOpacity={0.9}
        >
          <Feather name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="star" size={20} color={colors.inkPrimary} />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Lore</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/?tab=profile')}
        >
          <Ionicons
            name="person-outline"
            size={20}
            color={colors.inkSecondary}
          />
          <Text style={styles.tabLabel}>Профіль</Text>
        </TouchableOpacity>
      </View>

      {/* Модальне вікно перегляду спогаду з Золотого фонду */}
      <Modal
        visible={Boolean(selectedLoreItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedLoreItem(null)}
      >
        <View style={styles.modalBackdrop}>
          {selectedLoreItem && (
            <View style={styles.polaroidModalCard}>
              <View style={styles.polaroidTopRow}>
                <View>
                  <Text style={styles.polaroidName}>
                    {selectedLoreItem.room_badge || defaultRoomBadge}
                  </Text>
                  <Text style={styles.polaroidDate}>
                    {formatDate(
                      selectedLoreItem.created_at,
                      selectedLoreItem.custom_date
                    )}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.polaroidCloseBtn}
                  onPress={() => setSelectedLoreItem(null)}
                >
                  <Feather name="x" size={16} color={colors.inkPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.polaroidQuestionLabel}>
                {selectedLoreItem.question_text}
              </Text>

              {selectedLoreItem.media_path ? (
                <Image
                  source={{ uri: selectedLoreItem.media_path }}
                  style={styles.polaroidBigPhoto}
                  resizeMode="cover"
                />
              ) : null}

              {selectedLoreItem.voted_for_name ? (
                <View style={styles.polaroidVoteBox}>
                  <Text style={styles.polaroidVoteText}>
                    Лідер голосування: {selectedLoreItem.voted_for_name}
                  </Text>
                </View>
              ) : null}

              {selectedLoreItem.text_content ? (
                <Text style={styles.polaroidQuoteSerif}>
                  “{selectedLoreItem.text_content}”
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.closeBottomBtn}
                onPress={() => setSelectedLoreItem(null)}
              >
                <Text style={styles.closeBottomBtnText}>Закрити</Text>
              </TouchableOpacity>
            </View>
          )}
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
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  loreHeading: {
    fontFamily: fonts.serif,
    fontSize: 38,
    fontWeight: '500',
    color: colors.inkPrimary,
    letterSpacing: 0.2,
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archiveSwitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  archiveSwitchPillActive: {
    backgroundColor: colors.inkPrimary,
  },
  archiveSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  archiveSwitchTextActive: {
    color: '#FFFFFF',
  },
  backToRoundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  backToRoundText: {
    color: colors.inkPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: colors.paperElevated,
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentedTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inkSecondary,
  },
  segmentedTabTextActive: {
    color: colors.inkPrimary,
    fontWeight: '700',
  },
  masonryColumnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  masonryColumn: {
    width: '48.4%',
    gap: 12,
  },
  bentoPhotoCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#222222',
    overflow: 'hidden',
    padding: 13,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bentoBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bentoPhotoScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bentoPhotoBottom: {
    zIndex: 2,
    gap: 3,
  },
  bentoPhotoRoom: {
    color: '#EAE2D6',
    fontSize: 11,
    fontWeight: '500',
  },
  bentoPhotoCaption: {
    fontFamily: fonts.serif,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 19,
  },
  bentoPaperQuoteCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE7DA',
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#1A1816',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bentoQuoteMark: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 28,
    color: colors.coralAccent,
    marginBottom: -4,
  },
  bentoQuoteSerif: {
    fontFamily: fonts.serif,
    color: colors.inkPrimary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  bentoQuoteAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  bentoQuoteAuthorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.paperElevated,
  },
  bentoQuoteAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  bentoQuoteFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5EFEB',
  },
  bentoQuoteFooterMeta: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '500',
    maxWidth: '82%',
  },
  bentoVoteCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#23201D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    justifyContent: 'space-between',
  },
  bentoVoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bentoVoteLabel: {
    color: '#D4CBBF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bentoVoteQuestion: {
    fontFamily: fonts.serif,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 12,
  },
  miniPollBarsWrap: {
    gap: 8,
  },
  miniPollItem: {
    gap: 3,
  },
  miniPollTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniPollName: {
    color: '#B5ADA2',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: '72%',
  },
  miniPollNameLeader: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  miniPollPct: {
    color: '#8E877F',
    fontSize: 10,
    fontWeight: '600',
  },
  miniPollPctLeader: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  miniPollTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  miniPollFill: {
    height: '100%',
    borderRadius: 2,
  },
  bentoFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  bentoDateText: {
    color: '#A8A096',
    fontSize: 10,
    maxWidth: '82%',
  },
  emptyPaperBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.paperBorder,
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    color: colors.inkPrimary,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  historyList: {
    gap: 12,
  },
  historyPaperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    overflow: 'hidden',
  },
  historyHeaderTouch: {
    padding: 16,
    gap: 8,
  },
  historyTopMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDateBadge: {
    backgroundColor: colors.paperBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  historyDateText: {
    color: colors.inkPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  historyFormatLabel: {
    color: colors.coralAccent,
    fontSize: 12,
    fontWeight: '600',
  },
  historyQuestionSerif: {
    fontFamily: fonts.serif,
    color: colors.inkPrimary,
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 24,
  },
  historyFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  historyStatText: {
    color: colors.inkSecondary,
    fontSize: 12,
  },
  historyExpandAction: {
    color: colors.inkPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  historyExpandedContainer: {
    backgroundColor: '#181512',
    padding: 14,
    gap: 10,
  },
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
    color: colors.inkSecondary,
    fontSize: 10,
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 13, 11, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  polaroidModalCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
  },
  polaroidTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  polaroidName: {
    color: colors.inkPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  polaroidDate: {
    color: colors.inkSecondary,
    fontSize: 12,
  },
  polaroidCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paperBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroidQuestionLabel: {
    color: colors.inkSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  polaroidBigPhoto: {
    width: '100%',
    height: 260,
    borderRadius: 18,
    marginBottom: 12,
  },
  polaroidVoteBox: {
    backgroundColor: '#FFF0EC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  polaroidVoteText: {
    color: colors.coralAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  polaroidQuoteSerif: {
    fontFamily: fonts.serif,
    color: colors.inkPrimary,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
    marginBottom: 16,
  },
  closeBottomBtn: {
    backgroundColor: colors.inkPrimary,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
  },
  closeBottomBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
