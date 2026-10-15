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
  Share,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fonts, stitch } from '@/constants/colors';

const PHOTO_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuClOsMNo6jk_IiAq6vOc8riOrtjmUEotQ7dTNGt3lo0WtXpLf_QCt3AHwVS-STUSfuyiQYEaOvfbHTQOiZBiNCOUoJGXDp1EAVqJYQomUu0X5yEhwNnHRVGK9gDk207oGqgQ_ikTX-bV1RKM80XzfiOPo6IO2_liRLtfgKWr5xEumAz3g-axDArAPX88tNc4d5jhFynhJNxJtPT6Q_91sbIvrtGuWBtYKOSdWLaZmeMhKDZvfFZhm4Y-g';

const AUTHOR_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuApLDjw3cp3YAGjp2qIY4TJYIXGWN1ivGi6z2Dk-ZB6jYqgfrOaDenKhVmuOHkVueXbKQ44tu-zPokV2Ha-s1Rwj34MA6Y9IrVl-1mbS49yxDdov21j9Z3VIovnYjiN-8Vt_itap9c9k7uaTNo0S4cxiuLpVt5WAO14CjN4e23ez_bkMOJNaAB73A8HTQivP2Cf0KTDmfTYDGxxBGrYaaul-lR-eQO1Zauig72tAhwQDdCWI-a2UMZQ0w';

interface CommentItem {
  id: string;
  author: string;
  initial: string;
  time: string;
  text: string;
}

const INITIAL_COMMENTS: CommentItem[] = [
  {
    id: 'c1',
    author: 'Макс',
    initial: 'М',
    time: '14 лист., 22:04',
    text: "Я досі пам'ятаю ту піцу, вона була найсмачнішою в житті 😂",
  },
  {
    id: 'c2',
    author: 'Діма',
    initial: 'Д',
    time: '15 лист., 00:12',
    text: 'А кеди мої сохли ще три дні на батареї',
  },
];

const WAVE_BARS = [12, 20, 28, 16, 24, 32, 12, 20, 28, 16, 24, 20, 8, 24, 32, 16, 12, 20, 8, 16];

export default function LoreDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [isBookmarked, setIsBookmarked] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [reactions, setReactions] = useState<{ [emoji: string]: number }>({
    '😂': 6,
    '❤️': 8,
    '🍕': 4,
  });
  const [userReacted, setUserReacted] = useState<{ [emoji: string]: boolean }>({
    '❤️': true,
  });

  const [comments, setComments] = useState<CommentItem[]>(INITIAL_COMMENTS);
  const [newComment, setNewComment] = useState('');
  const [showPhotobookBanner, setShowPhotobookBanner] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const toggleReaction = (emoji: string) => {
    setUserReacted((prev) => {
      const active = prev[emoji];
      setReactions((r) => ({
        ...r,
        [emoji]: active ? Math.max(0, (r[emoji] || 1) - 1) : (r[emoji] || 0) + 1,
      }));
      return { ...prev, [emoji]: !active };
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const item: CommentItem = {
      id: `c-${Date.now()}`,
      author: 'Ти',
      initial: 'Т',
      time: 'Щойно',
      text: newComment.trim(),
    };
    setComments((prev) => [...prev, item]);
    setNewComment('');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: '«Той вечір у Львові: піца під дощем» • Спогад із капсули KAPSA 🔒',
      });
    } catch {
      // Ignore
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Context Header Bar */}
      <View style={styles.universalTopNavBar}>
        <View style={styles.navSlotLeft}>
          <TouchableOpacity
            accessibilityLabel="Назад"
            style={styles.navSlotIconBtn}
            onPress={() => router.back()}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={20} color={stitch.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <View style={styles.universalHeaderCenter} pointerEvents="none">
          <Text style={styles.universalBrandTitle}>KAPSA</Text>
        </View>

        {/* Actions / Overflow */}
        <View style={styles.navSlotRight}>
          <TouchableOpacity
            accessibilityLabel="Закладка"
            style={styles.navSlotIconBtn}
            onPress={() => setIsBookmarked((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isBookmarked ? stitch.secondary : stitch.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollCanvas}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Editorial Header & Curatorial Context */}
        <View style={styles.editorialHeaderSection}>
          <View style={styles.curatorialRow}>
            <Text style={styles.curatorialMetaText}>
              ФОТОКАРТКА • РАУНД #142 • 14 ЛИСТОПАДА 2023
            </Text>
            <View style={styles.goldenRecordBadge}>
              <Ionicons name="star" size={11} color={stitch.secondary} />
              <Text style={styles.goldenRecordText}>У Золотому фонді</Text>
            </View>
          </View>

          <View style={styles.roomTagRow}>
            <View style={styles.roomPill}>
              <Feather name="lock" size={11} color={stitch.onSurfaceVariant} />
              <Text style={styles.roomPillText}>Банда з КПІ 🔥</Text>
            </View>
          </View>

          <Text style={styles.headlineTitle}>
            «Той вечір у Львові: піца під дощем»
          </Text>

          <Text style={styles.pinnedByText}>
            Закріплено до Lore учасником{' '}
            <Text style={styles.pinnedAuthorUnderline}>Макс</Text>
          </Text>
        </View>

        {/* 2. Photographic Keepsake Frame (Matte Art Print Style) */}
        <View style={styles.keepsakePhotoMatting}>
          <View style={styles.photoContainer}>
            <Image source={{ uri: PHOTO_URI }} style={styles.photoImage} />
            {/* 35mm Analog Badge */}
            <View style={styles.analogFilmBadge}>
              <Feather name="camera" size={11} color="#FFFFFF" />
              <Text style={styles.analogFilmBadgeText}>35MM FILM • АРХІВ #49</Text>
            </View>
          </View>

          <View style={styles.figcaptionRow}>
            <Text style={styles.figcaptionLeft}>ЛЬВІВ • ВУЛ. СТАРОЄВРЕЙСЬКА</Text>
            <Text style={styles.figcaptionRight}>КАДР 24/36</Text>
          </View>
        </View>

        {/* 3. Prompt Capsule (The spark of the memory) */}
        <View style={styles.promptCapsuleCard}>
          <View style={styles.promptCapsuleHeader}>
            <Feather name="help-circle" size={15} color={stitch.secondary} />
            <Text style={styles.promptCapsuleTag}>ДЕННЕ ЗАПИТАННЯ РАУНДУ</Text>
          </View>
          <Text style={styles.promptCapsuleQuestion}>
            «Який наш спільний спогад миттєво піднімає тобі настрій? ✨»
          </Text>
        </View>

        {/* 4. Story & Author's Reflection */}
        <View style={styles.reflectionCard}>
          <View style={styles.authorHeaderRow}>
            <View style={styles.authorAvatarFrame}>
              <Image source={{ uri: AUTHOR_AVATAR }} style={styles.authorAvatarImg} />
            </View>
            <View>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorNameText}>Катерина</Text>
                <View style={styles.authorRoleBadge}>
                  <Text style={styles.authorRoleText}>Автор спогаду</Text>
                </View>
              </View>
              <Text style={styles.reflectionDateText}>14 листопада 2023, 21:40</Text>
            </View>
          </View>

          <Text style={styles.reflectionBodyText}>
            Забігли в найближчу браму біля площі Ринок, коли раптово полив дощ. Ділили одну салямі на чотирьох, промокли до нитки, але сміялися так, що чуло все місто. Той момент, коли все пішло не за планом, але стало найкращим спогадом осені.
          </Text>
        </View>

        {/* 5. Audio Lore Artifact (Voice Memo Keepsake) */}
        <View style={styles.voiceArtifactCard}>
          <View style={styles.voiceHeaderRow}>
            <View style={styles.voiceTitleLeft}>
              <Feather name="mic" size={15} color={stitch.secondary} />
              <Text style={styles.voiceTitleText}>
                Аудіозапис до моменту (Макс • 0:18)
              </Text>
            </View>
            <Text style={styles.voiceLiveTag}>LIVE RECORDING</Text>
          </View>

          {/* Waveform Interface Component */}
          <View style={styles.waveformRow}>
            <TouchableOpacity
              style={styles.playAudioBtn}
              onPress={() => setIsPlayingAudio((prev) => !prev)}
              activeOpacity={0.88}
            >
              <Ionicons
                name={isPlayingAudio ? 'pause' : 'play'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <View style={styles.waveformTrackBox}>
              {WAVE_BARS.map((height, i) => {
                const isPlayed = isPlayingAudio ? i < 10 : i < 6;
                return (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height,
                        backgroundColor: isPlayed ? stitch.secondary : stitch.outlineVariant,
                      },
                    ]}
                  />
                );
              })}
            </View>

            <Text style={styles.audioDurationText}>0:18</Text>
          </View>
        </View>

        {/* 6. Reaction Pills */}
        <View style={styles.reactionsSection}>
          <View style={styles.reactionPillsWrap}>
            {Object.entries(reactions).map(([emoji, count]) => {
              const active = userReacted[emoji];
              return (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.reactionPill,
                    active && styles.reactionPillActive,
                  ]}
                  onPress={() => toggleReaction(emoji)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14 }}>{emoji}</Text>
                  <Text
                    style={[
                      styles.reactionPillCount,
                      active && styles.reactionPillCountActive,
                    ]}
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.addReactionBtn}
              onPress={() => setShowEmojiPicker((prev) => !prev)}
              activeOpacity={0.85}
            >
              <Feather name="smile" size={14} color={stitch.onSurfaceVariant} />
              <Text style={styles.addReactionBtnText}>
                {showEmojiPicker ? 'Сховати' : '+ Додати емоцію'}
              </Text>
            </TouchableOpacity>
          </View>

          {showEmojiPicker && (
            <View style={styles.quickEmojiBar}>
              {['🔥', '🥺', '✨', '🎉', '☕', '👏'].map((em) => (
                <TouchableOpacity
                  key={em}
                  style={styles.quickEmojiItemBtn}
                  onPress={() => {
                    toggleReaction(em);
                    setShowEmojiPicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 18 }}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 7. Inside Jokes & Intimate Comments Thread */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeaderRow}>
            <Text style={styles.commentsHeaderTitle}>
              ВНУТРІШНІ ЖАРТИ ТА РЕПЛІКИ ({comments.length})
            </Text>
            <Text style={styles.onlyCircleBadge}>ТІЛЬКИ ДЛЯ КОЛА</Text>
          </View>

          <View style={styles.commentsListWrap}>
            {comments.map((c) => (
              <View key={c.id} style={styles.commentItemCard}>
                <View style={styles.commentInitialAvatar}>
                  <Text style={styles.commentInitialText}>{c.initial}</Text>
                </View>
                <View style={styles.commentItemContent}>
                  <View style={styles.commentMetaRow}>
                    <Text style={styles.commentAuthorName}>{c.author}</Text>
                    <Text style={styles.commentTimestampText}>{c.time}</Text>
                  </View>
                  <Text style={styles.commentItemText}>{c.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Add mini inline response */}
          <View style={styles.addCommentInputWrap}>
            <TextInput
              style={styles.addCommentTextInput}
              placeholder="Написати теплу відповідь колу..."
              placeholderTextColor={stitch.outlineVariant}
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity
              style={styles.sendCommentBtn}
              onPress={handleAddComment}
              activeOpacity={0.85}
            >
              <Text style={styles.sendCommentBtnText}>Надіслати</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 8. Keepsake Primary Actions (Group CTAs) */}
        <View style={styles.groupCtasSection}>
          <TouchableOpacity
            style={styles.photobookCtaBtn}
            onPress={() => {
              setShowPhotobookBanner(true);
              Alert.alert('Фотокнига', 'Цей спогад додано на сторінку 14 вашої фотокниги Lore 📖');
            }}
            activeOpacity={0.88}
          >
            <Feather name="book-open" size={17} color={stitch.surface} />
            <Text style={styles.photobookCtaBtnText}>Додати до книги спогадів</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareCardBtn}
            onPress={handleShare}
            activeOpacity={0.88}
          >
            <Feather name="share" size={16} color={stitch.primary} />
            <Text style={styles.shareCardBtnText}>
              Поділитися карткою (Тільки для кімнати)
            </Text>
          </TouchableOpacity>
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
  universalTopNavBar: {
    position: 'relative',
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
    zIndex: 20,
  },
  navSlotLeft: {
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navSlotRight: {
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navSlotIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  universalHeaderCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  universalBrandTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    letterSpacing: 4.5,
    fontWeight: '600',
    color: stitch.primary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  brandTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    letterSpacing: 4.5,
    fontWeight: '600',
    color: stitch.primary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  topContextBar: {
    position: 'relative',
    height: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  navLeftWrap: {
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    display: 'none',
  },
  headerCenterBrand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: stitch.surfaceContainer,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roomPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.primary,
  },
  navActionsRow: {
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navIconBtn: {
    padding: 4,
  },
  scrollCanvas: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 20,
  },
  editorialHeaderSection: {
    gap: 6,
  },
  curatorialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204, 197, 189, 0.4)',
    paddingBottom: 8,
  },
  curatorialMetaText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  goldenRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: stitch.secondaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  goldenRecordText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.secondary,
  },
  headlineTitle: {
    fontFamily: fonts.serif,
    fontSize: 26,
    fontWeight: '500',
    color: stitch.primary,
    letterSpacing: -0.4,
    lineHeight: 32,
    marginTop: 4,
  },
  pinnedByText: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
  },
  pinnedAuthorUnderline: {
    fontWeight: '600',
    color: stitch.primary,
    textDecorationLine: 'underline',
  },
  keepsakePhotoMatting: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  photoContainer: {
    position: 'relative',
    width: '100%',
    height: 250,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: stitch.surfaceContainerHigh,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  analogFilmBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  analogFilmBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  figcaptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  figcaptionLeft: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: stitch.onSurfaceVariant,
  },
  figcaptionRight: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    color: stitch.onSurfaceVariant,
  },
  promptCapsuleCard: {
    backgroundColor: stitch.surfaceContainer,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 14,
    gap: 6,
  },
  promptCapsuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promptCapsuleTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.secondary,
  },
  promptCapsuleQuestion: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontStyle: 'italic',
    color: stitch.primary,
    lineHeight: 22,
  },
  reflectionCard: {
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.7)',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  authorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatarFrame: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    backgroundColor: stitch.surfaceContainer,
  },
  authorAvatarImg: {
    width: '100%',
    height: '100%',
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: stitch.primary,
  },
  authorRoleBadge: {
    backgroundColor: stitch.surfaceContainer,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  authorRoleText: {
    fontSize: 9,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
  },
  reflectionDateText: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
    marginTop: 1,
  },
  reflectionBodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: stitch.onSurface,
  },
  voiceArtifactCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  voiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voiceTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceTitleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  voiceLiveTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: stitch.onSurfaceVariant,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playAudioBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: stitch.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: stitch.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  waveformTrackBox: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: stitch.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.6)',
    paddingHorizontal: 8,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: stitch.onSurfaceVariant,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  reactionsSection: {
    gap: 8,
  },
  reactionPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: stitch.surface,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reactionPillActive: {
    backgroundColor: stitch.secondaryFixed,
    borderColor: stitch.secondary,
  },
  reactionPillCount: {
    fontSize: 12,
    fontWeight: '700',
    color: stitch.primary,
  },
  reactionPillCountActive: {
    color: stitch.secondary,
  },
  addReactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: stitch.surfaceContainer,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: stitch.outline,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addReactionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.onSurfaceVariant,
  },
  quickEmojiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  quickEmojiItemBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: stitch.surface,
  },
  commentsSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.6)',
    paddingTop: 16,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentsHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  onlyCircleBadge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
  },
  commentsListWrap: {
    gap: 10,
  },
  commentItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.6)',
    borderRadius: 6,
    padding: 12,
  },
  commentInitialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: stitch.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitialText: {
    fontSize: 11,
    fontWeight: '700',
    color: stitch.primary,
  },
  commentItemContent: {
    flex: 1,
    gap: 3,
  },
  commentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  commentAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: stitch.primary,
  },
  commentTimestampText: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  commentItemText: {
    fontSize: 13,
    color: stitch.onSurface,
    lineHeight: 18,
  },
  addCommentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addCommentTextInput: {
    flex: 1,
    fontSize: 13,
    color: stitch.onSurface,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  sendCommentBtn: {
    backgroundColor: stitch.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
  },
  sendCommentBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.primary,
    textTransform: 'uppercase',
  },
  groupCtasSection: {
    gap: 10,
    paddingTop: 8,
  },
  photobookCtaBtn: {
    width: '100%',
    backgroundColor: stitch.primary,
    paddingVertical: 14,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photobookCtaBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.surface,
  },
  shareCardBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareCardBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.onSurface,
  },
});

