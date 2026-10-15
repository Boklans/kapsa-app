import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
  Switch,
  Share,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { fonts, getAvatarPhotoUri, PORTRAIT_AVATARS, stitch } from '@/constants/colors';
import { AVATAR_EMOJIS, useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { displayName, avatarEmoji, updateProfile } = useAuthStore();
  const { rooms, loreItems } = useRoomStore();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState(
    displayName === 'Ти' ? 'Катерина' : displayName
  );
  const [isCopiedProfileCode, setIsCopiedProfileCode] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [friendMoveNotificationEnabled, setFriendMoveNotificationEnabled] = useState(true);

  const friendlyName = displayName === 'Ти' ? 'Катерина' : displayName;
  const userPortraitUri = getAvatarPhotoUri(avatarEmoji, 0);
  const isCustomPhotoAvatar =
    avatarEmoji.startsWith('http') || avatarEmoji.startsWith('data:image');

  const handleCopyProfileInviteCode = async () => {
    setIsCopiedProfileCode(true);
    setTimeout(() => setIsCopiedProfileCode(false), 2500);
    try {
      await Share.share({
        message: 'Приєднуйся до моєї приватної капсули в KAPSA! Мій інвайт-код: #KAPS-8492',
      });
    } catch {
      // Ignore
    }
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
          await updateProfile(profileNameInput.trim() || friendlyName, customUri);
        }
      }
    } catch {
      // Ignore
    }
  };

  const handleSaveProfile = async (emoji?: string) => {
    await updateProfile(profileNameInput.trim() || friendlyName, emoji || avatarEmoji);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.topNavBar}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={18} color={stitch.onSurfaceVariant} />
          <Text style={styles.navBackText}>На головну</Text>
        </TouchableOpacity>

        <View style={styles.headerCenterBrand} pointerEvents="none">
          <Text style={styles.brandTitle}>KAPSA</Text>
        </View>

        <View style={styles.navRightWrap}>
          <TouchableOpacity
            accessibilityLabel="Поділитися"
            style={styles.navShareBtn}
            onPress={handleCopyProfileInviteCode}
            activeOpacity={0.8}
          >
            <Feather name="share-2" size={17} color={stitch.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollCanvas}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.screenTitle}>Профіль</Text>
          <Text style={styles.sectionTagSecondary}>ОСОБИСТИЙ ПРОСТІР</Text>
        </View>

        {/* Editorial User Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarFrameWrap}>
            <TouchableOpacity
              style={styles.avatarFrame}
              onPress={handlePickCustomAvatar}
              activeOpacity={0.85}
            >
              <Image source={{ uri: userPortraitUri }} style={styles.avatarImg} />
              <View style={styles.cameraBadge}>
                <Feather name="camera" size={13} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.identityName}>{friendlyName}</Text>
          <Text style={styles.identityQuote}>
            «Твоя щоденна капсула спогадів з тими, хто поруч ♡»
          </Text>

          {/* Key Shared Stats Trio */}
          <View style={styles.statsTrio}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{rooms.length || 2}</Text>
              <Text style={styles.statLabel}>Кімнати</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statNum, { color: stitch.secondary }]}>14</Text>
              <Text style={styles.statLabel}>Днів у синку</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{loreItems.length || 32}</Text>
              <Text style={styles.statLabel}>У Lore ★</Text>
            </View>
          </View>

          {/* Quick Action: Edit Profile */}
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => setIsEditingProfile((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Feather name="edit-3" size={15} color={stitch.primary} />
            <Text style={styles.editProfileBtnText}>
              {isEditingProfile ? 'Сховати редагування' : 'Редагувати профіль'}
            </Text>
          </TouchableOpacity>

          {isEditingProfile && (
            <View style={styles.editPanel}>
              <Text style={styles.panelSubhead}>Обери свій портрет</Text>
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
                  <Feather name="camera" size={16} color={stitch.primary} />
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

              <Text style={[styles.panelSubhead, { marginTop: 12 }]}>
                Твоє ім’я у кімнатах
              </Text>
              <View style={styles.profileInputRow}>
                <TextInput
                  style={styles.nameTextInput}
                  value={profileNameInput}
                  onChangeText={setProfileNameInput}
                  placeholder="Наприклад: Маша"
                  placeholderTextColor={stitch.outlineVariant}
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
        <View style={styles.inviteCodeCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderLabel}>ТВІЙ ПЕРСОНАЛЬНИЙ ІНВАЙТ-КОД</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>АКТИВНИЙ</Text>
            </View>
          </View>

          <View style={styles.codeBoxRow}>
            <View style={styles.codeLeftPart}>
              <Feather name="key" size={17} color={stitch.secondary} />
              <Text style={styles.codeText}>#KAPS-8492</Text>
            </View>

            <View style={styles.codeActionsRow}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopyProfileInviteCode}
                activeOpacity={0.8}
              >
                <Feather
                  name={isCopiedProfileCode ? 'check' : 'copy'}
                  size={13}
                  color={stitch.primary}
                />
                <Text style={styles.copyBtnText}>
                  {isCopiedProfileCode ? 'Скопійовано' : 'Скопіювати'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareIconBtn}
                onPress={handleCopyProfileInviteCode}
                activeOpacity={0.8}
              >
                <Feather name="share-2" size={16} color={stitch.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.inviteDesc}>
            За цим кодом близькі друзі або партнер можуть приєднатися до твоєї закритої капсули без зайвих анкет.
          </Text>
        </View>

        {/* Capsule & Rhythm Preferences */}
        <View style={styles.preferencesSection}>
          <View style={styles.prefHeaderRow}>
            <Text style={styles.prefHeaderTitle}>РИТМ КАПСУЛИ</Text>
            <Text style={styles.sectionTagSecondary}>ЩОДЕННИЙ РИТУАЛ</Text>
          </View>

          <View style={styles.prefList}>
            {/* Item 1: Reveal Time */}
            <View style={styles.prefItem}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.prefItemTitleRow}>
                  <Feather name="clock" size={15} color={stitch.primary} />
                  <Text style={styles.prefItemTitle}>Час розкриття відповідей</Text>
                </View>
                <Text style={styles.prefItemSub}>
                  Капсула відкривається одночасно для всіх учасників
                </Text>
              </View>
              <View style={styles.timeTag}>
                <Text style={styles.timeTagText}>21:00 (Київ)</Text>
              </View>
            </View>

            {/* Item 2: Reminder Toggle */}
            <View style={styles.prefItem}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.prefItemTitleRow}>
                  <Feather name="bell" size={15} color={stitch.primary} />
                  <Text style={styles.prefItemTitle}>Щоденне нагадування</Text>
                </View>
                <Text style={styles.prefItemSub}>
                  М'який пуш о 19:30, якщо хід ще не запечатано
                </Text>
              </View>
              <Switch
                value={dailyReminderEnabled}
                onValueChange={setDailyReminderEnabled}
                trackColor={{ false: stitch.outlineVariant, true: stitch.secondary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Item 3: Move Notification */}
            <View style={styles.prefItem}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.prefItemTitleRow}>
                  <Feather name="activity" size={15} color={stitch.primary} />
                  <Text style={styles.prefItemTitle}>Сповіщення про хід друзів</Text>
                </View>
                <Text style={styles.prefItemSub}>
                  Коли партнер або друзі запечатують відповідь
                </Text>
              </View>
              <Switch
                value={friendMoveNotificationEnabled}
                onValueChange={setFriendMoveNotificationEnabled}
                trackColor={{ false: stitch.outlineVariant, true: stitch.secondary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Digital Archive & Lore Export */}
        <View style={styles.loreExportCard}>
          <View style={styles.loreExportTop}>
            <View style={styles.loreExportIconWrap}>
              <Feather name="book-open" size={18} color={stitch.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loreExportTitle}>Створити PDF-книгу Lore</Text>
              <Text style={styles.loreExportSub}>
                Згенерувати персональний альбом із фотографіями, цитатами та раундами за весь час.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.loreExportBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/?tab=fond')}
          >
            <Text style={styles.loreExportBtnText}>Експортувати цифровий архів</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Stamp Banner */}
        <View style={styles.privacyBanner}>
          <Feather name="shield" size={16} color={stitch.secondary} />
          <Text style={styles.privacyBannerText}>
            <Text style={{ fontWeight: '700', color: stitch.primary }}>100% ПРИВАТНІСТЬ: </Text>
            Твої відповіді зашифровані та ніколи не потраплять у відкриті стрічки чи пошукові системи.
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
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  navBackBtn: {
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  navBackText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
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
  brandTitle: {
    fontFamily: fonts.serif,
    fontSize: 27,
    letterSpacing: 4.5,
    fontWeight: '600',
    color: stitch.primary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  navRightWrap: {
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navShareBtn: {
    padding: 4,
  },
  navTitleCenter: {
    fontFamily: fonts.serif,
    fontSize: 27,
    letterSpacing: 4.5,
    fontWeight: '600',
    color: stitch.primary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  secureBadge: {
    padding: 4,
  },
  scrollCanvas: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  screenTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    fontWeight: '400',
    color: stitch.primary,
    letterSpacing: -0.8,
  },
  sectionTagSecondary: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: stitch.secondary,
    textTransform: 'uppercase',
  },
  identityCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  avatarFrameWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  avatarFrame: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: stitch.surface,
    backgroundColor: stitch.surfaceContainerHigh,
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: stitch.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: stitch.surface,
  },
  identityName: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '600',
    color: stitch.primary,
  },
  identityQuote: {
    fontSize: 13,
    color: stitch.onSurfaceVariant,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  statsTrio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.5)',
    marginVertical: 4,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: stitch.primary,
  },
  statLabel: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(204, 197, 189, 0.6)',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.primary,
  },
  editPanel: {
    width: '100%',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(204, 197, 189, 0.5)',
    gap: 8,
  },
  panelSubhead: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  portraitsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  uploadPortraitBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: stitch.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stitch.surfaceContainer,
    gap: 2,
  },
  uploadPortraitBtnText: {
    fontSize: 8,
    fontWeight: '700',
    color: stitch.primary,
  },
  portraitOptionWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  portraitOptionWrapActive: {
    borderColor: stitch.secondary,
    borderWidth: 2,
  },
  portraitOptionImg: {
    width: '100%',
    height: '100%',
  },
  profileInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  nameTextInput: {
    flex: 1,
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: stitch.primary,
  },
  saveProfileBtn: {
    backgroundColor: stitch.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
  },
  saveProfileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.surface,
  },
  inviteCodeCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  activeBadge: {
    backgroundColor: stitch.secondaryFixed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.secondary,
  },
  codeBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: stitch.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeLeftPart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
    color: stitch.primary,
  },
  codeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    backgroundColor: stitch.surfaceContainerLow,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: stitch.primary,
  },
  shareIconBtn: {
    padding: 5,
  },
  inviteDesc: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    lineHeight: 17,
  },
  preferencesSection: {
    gap: 10,
  },
  prefHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  prefHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  prefList: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    overflow: 'hidden',
  },
  prefItem: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204, 197, 189, 0.4)',
  },
  prefItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  prefItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: stitch.primary,
  },
  prefItemSub: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
  },
  timeTag: {
    backgroundColor: stitch.surface,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  timeTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: stitch.primary,
  },
  loreExportCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 16,
    gap: 14,
  },
  loreExportTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  loreExportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: stitch.secondaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loreExportTitle: {
    fontFamily: fonts.serif,
    fontSize: 17,
    fontWeight: '600',
    color: stitch.primary,
  },
  loreExportSub: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    lineHeight: 17,
    marginTop: 2,
  },
  loreExportBtn: {
    backgroundColor: stitch.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  loreExportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.surface,
    textTransform: 'uppercase',
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(204, 197, 189, 0.6)',
    borderRadius: 6,
    padding: 12,
  },
  privacyBannerText: {
    flex: 1,
    fontSize: 11,
    color: stitch.onSurfaceVariant,
    lineHeight: 16,
  },
});

