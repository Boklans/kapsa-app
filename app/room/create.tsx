import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fonts, stitch } from '@/constants/colors';
import { useRoomStore } from '@/store/roomStore';
import { DeckTag } from '@/types/kapsa';

interface DeckOptionItem {
  id: DeckTag;
  title: string;
  emoji: string;
  description: string;
}

const DECK_OPTIONS: DeckOptionItem[] = [
  {
    id: 'core',
    title: 'База',
    emoji: '⚡',
    description: 'Перевірені щоденні питання про характер, звички та кумедні ситуації.',
  },
  {
    id: 'nostalgia',
    title: 'Теплі спогади',
    emoji: '☕',
    description: 'Питання про дитинство, перші враження та незабутні спільні поїздки.',
  },
  {
    id: 'spicy',
    title: 'Гострі жарти',
    emoji: '🔥',
    description: 'Для тих, хто давно разом і не боїться чесної правди чи суперечок.',
  },
];

const REVEAL_TIMES = [
  '20:00 (за Києвом)',
  '21:00 (за Києвом)',
  '22:00 (за Києвом)',
  '23:00 (за Києвом)',
];

export default function CreateRoomScreen() {
  const router = useRouter();
  const { createRoom, rerollTodayQuestion } = useRoomStore();

  const [roomType, setRoomType] = useState<'couple' | 'friends'>('couple');
  const [roomName, setRoomName] = useState('');
  const [selectedTimeIdx, setSelectedTimeIdx] = useState(1); // 21:00 default
  const [selectedDeck, setSelectedDeck] = useState<DeckTag>('core');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async () => {
    setFormError(null);
    if (!roomName.trim()) {
      setFormError('Введи назву для нової кімнати');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await createRoom(roomName.trim(), roomType);
      if (selectedDeck !== 'core') {
        await rerollTodayQuestion(created.id, selectedDeck);
      }
      // Navigate to Screen 7 (Join / Invite screen) with the new room invite code
      const inviteCode = created.invite_code || 'KAPS26';
      router.push(`/join/${inviteCode}`);
    } catch (err: any) {
      setFormError(err?.message || 'Помилка створення кімнати');
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Editorial Header (Task-oriented navigation) */}
      <View style={styles.topNavBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={18} color={stitch.onSurfaceVariant} />
          <Text style={styles.navBackText}>До кімнат</Text>
        </TouchableOpacity>

        <Text style={styles.navTitleCenter}>Новий простір</Text>

        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Крок 1 з 2</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollCanvas}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Page Heading */}
        <View style={styles.pageHeadingSection}>
          <Text style={styles.headlineHeroTitle}>Створи власну капсулу</Text>
          <Text style={styles.headlineHeroDesc}>
            Тихий куточок для двох або затишна кімната для близьких друзів до 8 людей.
          </Text>
        </View>

        {/* Section: Room Type Selector */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionOverlineLabel}>ФОРМАТ ПРОСТОРУ</Text>

          <View style={styles.typeGrid}>
            {/* Card A: Пара (Selected by default) */}
            <TouchableOpacity
              style={[
                styles.typeCard,
                roomType === 'couple' ? styles.typeCardActive : styles.typeCardInactive,
              ]}
              onPress={() => setRoomType('couple')}
              activeOpacity={0.88}
            >
              <View style={styles.typeCardTopRow}>
                <View style={styles.typeTitleRow}>
                  <Text style={styles.typeTitleText}>Пара</Text>
                  <Text style={{ fontSize: 13 }}>❤️</Text>
                </View>
                <View style={styles.typePillPair}>
                  <Text style={styles.typePillPairText}>ДЛЯ ДВОХ</Text>
                </View>
              </View>

              <Text style={styles.typeDescText}>
                Тільки ви вдвох. Питання про стосунки, спільні жарти та щоденні фото-моменти.
              </Text>

              <View style={styles.typeCheckBadgeWrap}>
                <Ionicons
                  name={roomType === 'couple' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={18}
                  color={roomType === 'couple' ? stitch.secondary : 'transparent'}
                />
              </View>
            </TouchableOpacity>

            {/* Card B: Банда */}
            <TouchableOpacity
              style={[
                styles.typeCard,
                roomType === 'friends' ? styles.typeCardActive : styles.typeCardInactive,
              ]}
              onPress={() => setRoomType('friends')}
              activeOpacity={0.88}
            >
              <View style={styles.typeCardTopRow}>
                <View style={styles.typeTitleRow}>
                  <Text style={styles.typeTitleText}>Банда</Text>
                  <Text style={{ fontSize: 13 }}>🔥</Text>
                </View>
                <View style={styles.typePillCrew}>
                  <Text style={styles.typePillCrewText}>3–8 ЛЮДЕЙ</Text>
                </View>
              </View>

              <Text style={styles.typeDescText}>
                Голосування, безглузді спогади, спільний літопис і жодного спаму.
              </Text>

              <View style={styles.typeCheckBadgeWrap}>
                <Ionicons
                  name={roomType === 'friends' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={18}
                  color={roomType === 'friends' ? stitch.secondary : 'transparent'}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Configuration Fields */}
        <View style={styles.fieldsSection}>
          {/* Field 1: Room Name */}
          <View style={styles.fieldBlock}>
            <Text style={styles.sectionOverlineLabel}>НАЗВА КІМНАТИ</Text>
            <TextInput
              style={styles.textInputBox}
              placeholder={roomType === 'couple' ? 'Наприклад: ЧСМ' : 'Наприклад: Банда з КПІ'}
              placeholderTextColor={stitch.outlineVariant}
              value={roomName}
              onChangeText={(t) => {
                setRoomName(t);
                if (formError) setFormError(null);
              }}
            />
          </View>

          {/* Field 2: Daily Reveal Time */}
          <View style={styles.fieldBlock}>
            <View style={styles.revealTimeHeaderRow}>
              <Text style={styles.sectionOverlineLabel}>
                ЧАС ЩОДЕННОГО РОЗПЕЧАТУВАННЯ (REVEAL TIME)
              </Text>
              <Text style={styles.syncBadgeLabel}>СИНХРОННО</Text>
            </View>

            <View style={styles.timePillsRow}>
              {REVEAL_TIMES.map((timeLabel, idx) => {
                const isSelected = selectedTimeIdx === idx;
                return (
                  <TouchableOpacity
                    key={timeLabel}
                    style={[
                      styles.timePillBtn,
                      isSelected && styles.timePillBtnSelected,
                    ]}
                    onPress={() => setSelectedTimeIdx(idx)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.timePillBtnText,
                        isSelected && styles.timePillBtnTextSelected,
                      ]}
                    >
                      {timeLabel.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.infoNoteRow}>
              <Feather name="info" size={14} color={stitch.outline} style={{ marginTop: 2 }} />
              <Text style={styles.infoNoteText}>
                О цій годині запечатані відповіді відкриваються одночасно для всіх. Якщо всі відповідять раніше — капсула відкриється достроково.
              </Text>
            </View>
          </View>

          {/* Field 3: Question Deck Selector */}
          <View style={styles.fieldBlock}>
            <Text style={styles.sectionOverlineLabel}>КОЛОДА ЗАПИТАНЬ</Text>

            <View style={styles.deckListWrap}>
              {DECK_OPTIONS.map((deck) => {
                const isChosen = selectedDeck === deck.id;
                return (
                  <TouchableOpacity
                    key={deck.id}
                    style={[
                      styles.deckOptionCard,
                      isChosen && styles.deckOptionCardSelected,
                    ]}
                    onPress={() => setSelectedDeck(deck.id)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.deckMetaLeft}>
                      <View style={styles.deckTitleRow}>
                        <Text style={styles.deckTitleText}>{deck.title}</Text>
                        <Text style={{ fontSize: 13 }}>{deck.emoji}</Text>
                        {isChosen && (
                          <View style={styles.deckChosenBadge}>
                            <Text style={styles.deckChosenBadgeText}>ОБРАНО</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.deckDescText}>{deck.description}</Text>
                    </View>

                    <View style={styles.deckRadioWrap}>
                      <Ionicons
                        name={isChosen ? 'radio-button-on' : 'radio-button-off'}
                        size={19}
                        color={isChosen ? stitch.primary : stitch.outlineVariant}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {formError ? <Text style={styles.errorAlertText}>⚠️ {formError}</Text> : null}

        {/* Bottom Primary Action & Disclaimer */}
        <View style={styles.actionFooter}>
          <TouchableOpacity
            style={styles.primaryCtaBtn}
            onPress={handleCreate}
            disabled={isSubmitting}
            activeOpacity={0.88}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.primaryCtaBtnText}>
                  Створити кімнату та покликати своїх
                </Text>
                <Feather name="arrow-right" size={17} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.disclaimerNote}>
            Після створення ви отримаєте приватний інвайт-код та посилання для швидкого входу.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: stitch.background,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBackText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  navTitleCenter: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '500',
    color: stitch.primary,
  },
  stepBadge: {
    backgroundColor: stitch.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  scrollCanvas: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 24,
  },
  pageHeadingSection: {
    gap: 6,
  },
  headlineHeroTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: -0.8,
    color: stitch.primary,
  },
  headlineHeroDesc: {
    fontSize: 14,
    color: stitch.onSurfaceVariant,
    lineHeight: 20,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionOverlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    position: 'relative',
    padding: 16,
    borderRadius: 6,
    gap: 8,
  },
  typeCardActive: {
    backgroundColor: stitch.surface,
    borderWidth: 2,
    borderColor: stitch.secondary,
  },
  typeCardInactive: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  typeCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 24,
  },
  typeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeTitleText: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '500',
    color: stitch.primary,
  },
  typePillPair: {
    backgroundColor: stitch.secondaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typePillPairText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.secondary,
  },
  typePillCrew: {
    backgroundColor: stitch.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typePillCrewText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.onSurfaceVariant,
  },
  typeDescText: {
    fontSize: 13,
    color: stitch.onSurfaceVariant,
    lineHeight: 18,
  },
  typeCheckBadgeWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  fieldsSection: {
    gap: 20,
  },
  fieldBlock: {
    gap: 8,
  },
  textInputBox: {
    width: '100%',
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: stitch.onSurface,
  },
  revealTimeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  syncBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.secondary,
  },
  timePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timePillBtn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePillBtnSelected: {
    backgroundColor: stitch.surface,
    borderColor: stitch.primary,
    borderWidth: 1.5,
  },
  timePillBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  timePillBtnTextSelected: {
    color: stitch.primary,
    fontWeight: '700',
  },
  infoNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 4,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    lineHeight: 17,
  },
  deckListWrap: {
    gap: 10,
  },
  deckOptionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 6,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    gap: 10,
  },
  deckOptionCardSelected: {
    backgroundColor: stitch.surface,
    borderColor: stitch.primary,
    borderWidth: 2,
  },
  deckMetaLeft: {
    flex: 1,
    gap: 4,
  },
  deckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deckTitleText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '500',
    color: stitch.primary,
  },
  deckChosenBadge: {
    backgroundColor: stitch.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  deckChosenBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.surface,
    textTransform: 'uppercase',
  },
  deckDescText: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    lineHeight: 17,
  },
  deckRadioWrap: {
    paddingTop: 2,
  },
  errorAlertText: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.error,
    paddingHorizontal: 4,
  },
  actionFooter: {
    paddingTop: 8,
    gap: 12,
  },
  primaryCtaBtn: {
    width: '100%',
    backgroundColor: stitch.secondary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: stitch.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryCtaBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  disclaimerNote: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 12,
  },
});

