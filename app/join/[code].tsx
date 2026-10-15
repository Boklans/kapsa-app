import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fonts, getAvatarPhotoUri, stitch } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';

// Members in the room for the invite preview
const PREVIEW_MEMBERS = [
  {
    name: 'Макс',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDIez8apnp5ZP3znV4zotkbUbD7-neCXnD6AiNw4Q4R_p7TziS5rlMdd-erj5xxBQ26O7BrkrfSbhj0rmDL1LuWS3MueHx6d3w12sDY6AoqpUHZ1lsK_TnqYil1hSYJxftdV-lJqEhYl6KCejJJDNI02HItDGQQsA3ugm97sBt8L7s-YofXqt7Znak0QBx8iwnrU9uBkxvSqOMvSnq4AXd-sGMdLPhGGZxHdmf3Yxa_3WrkqCuzZnLNHA',
    isYou: false,
  },
  {
    name: 'Оля',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAFvgto_olB10HSZBD0Nin9PbxcWm7xyZwTQdaalpxajSIGKJs_mAR3hrR3rgx3JJw7E0O0kbjr4GjiS45HXKCUCPVQzdfxjm-zmMieakjU9GEN2IObOaj7VtqJEn-iW47vTGUDPERl9jXqQHo5GVmW6QlieZJYk45dbok3kiZJ10ICTbgGavHFwr8m5xWRLYqX7fDds3V0Dqoif4ltr3Q0IQoFMiVkmgkPqZLOr26hDBb2lodENYYmyg',
    isYou: false,
  },
  {
    name: 'Діма',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDFiLWXraHPFlJ54p_KSsgb5ji1u2GSX2lEojm8nEKWyf3DR-CGwLW6VWKnXN1iJBJwpvtw05whmXO_dBvVf-FRkBhGmvrQPPpdnDcEUlB44r1GEK30GF4eKZUABy_nEhygSBPnvTbZsu4PANVfWizAq9w0YJQqHztvkDz7GUgMSrdskBjEix5Tm7GldIw4pkLQuFD_vybVsvlOnIS3d-W6qTlt5M9947vUXU9UyFT1PnC377MDYADmpg',
    isYou: false,
  },
  {
    name: 'Ти',
    photo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCbOldG68MAg5SloUR_c6PDkBDKjvDKtzN6kqbBampp3_cragViQeOtwzR0ucpWYV74zjEFbpoPEjVWu9jXFSkiQocp1WLvjZ4H8t7Kiyg38BKLLGBIax_fUBRWMku05Hpu-Rzf7o_D-Dq6o5gDCZH_1zRDwfg5CVXfqzCRUMtLarN9LNj0a4Ep0IWvcjLO4vCvyKt4fMrOtvRsIk7v7QwsupphoitNhypHfQYcY7Q4rPS-nvL3xWX0zg',
    isYou: true,
  },
];

const INVITER_PHOTO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAkm5i1g6cDds5h1rb9AHzCYFDLqxdvBdGbNvyK4ZouJPxCMBEhrIuttQ8_JE9cBvcLroJAbbpc4AZQXY3Og12fcoyG9waK1e92yIp4wLzqTH1pOkjIsr0jGrnle85-uqOS1Kfk92ZMja80nfvPA_aKDPlwkRQdDrx7fPdmF3Y-bAGHNHrlNDuuSPd5AEIWXRLvF2N6axdMYpJ5V9k6FGm57-NDk4yPM7vv9zpI4G9IPENRRFtSmza9ww';

export default function JoinByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const { displayName, avatarEmoji, updateProfile } = useAuthStore();
  const { joinRoomByCode, isLoading } = useRoomStore();

  const inviteCode = (code || 'KAPS-8492').toUpperCase();
  const [name, setName] = useState(displayName === 'Ти' ? 'Катерина' : displayName);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userPhotoUri = customAvatar || getAvatarPhotoUri(avatarEmoji, 0);

  const handlePickPhoto = async () => {
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
        const uri = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        if (uri) {
          setCustomAvatar(uri);
          await updateProfile(name, uri);
        }
      }
    } catch {
      // Ignore cancel
    }
  };

  const handleJoin = async () => {
    setErrorMsg(null);
    try {
      await updateProfile(name.trim() || 'Катерина', customAvatar || avatarEmoji);
      const roomId = await joinRoomByCode(
        inviteCode,
        name.trim() || 'Катерина',
        customAvatar || avatarEmoji
      );
      router.replace(`/room/${roomId}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не вдалося приєднатися до кімнати');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Header */}
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

        <View style={styles.navSlotRight}>
          <TouchableOpacity
            accessibilityLabel="Закрити"
            style={styles.navSlotIconBtn}
            onPress={() => router.replace('/')}
            activeOpacity={0.75}
          >
            <Feather name="x" size={20} color={stitch.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollCanvas}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary Title & Epigraph */}
        <View style={styles.headerSection}>
          <View style={styles.tagLineRow}>
            <Text style={styles.inviteTagText}>ЗАПРОШЕННЯ</Text>
            <View style={styles.dotDivider} />
            <Text style={styles.codeSnippetTag}>
              {inviteCode.length > 7 ? inviteCode.slice(0, 8) : `#${inviteCode}`}
            </Text>
          </View>

          <Text style={styles.heroHeadlineTitle}>Тебе запросили до капсули</Text>
          <Text style={styles.heroHeadlineDesc}>
            Приватний щоденний простір для своїх. Без шуму, алгоритмів та публічних стрічок.
          </Text>
        </View>

        {/* Room Identity Card (Editorial Book Specimen) */}
        <View style={styles.roomIdentityCard}>
          {/* Inviter Banner Pill */}
          <View style={styles.inviterBannerRow}>
            <View style={styles.inviterMetaLeft}>
              <View style={styles.inviterAvatarFrame}>
                <Image source={{ uri: INVITER_PHOTO }} style={styles.inviterAvatarImg} />
              </View>
              <View>
                <Text style={styles.inviterOverline}>ЗАПРОШУЄ</Text>
                <Text style={styles.inviterName}>Макс Коваленко</Text>
              </View>
            </View>

            <View style={styles.activeRoomBadge}>
              <Text style={styles.activeRoomBadgeText}>АКТИВНА КІМНАТА</Text>
            </View>
          </View>

          {/* Room Headline & Meta Info */}
          <View style={styles.roomMetaBlock}>
            <Text style={styles.roomHeadlineTitle}>Банда з КПІ 🔥</Text>
            <View style={styles.roomDetailsRow}>
              <Text style={styles.roomDetailTag}>КОМПАНІЯ</Text>
              <Text style={styles.roomBulletDot}>•</Text>
              <Text style={styles.roomDetailTag}>5 З 8 УЧАСНИКІВ</Text>
            </View>
            <Text style={styles.roomScheduleText}>
              Щоденний раунд о 21:00 <Text style={{ color: stitch.outlineVariant }}>•</Text> Стартова колода: База ⚡
            </Text>
          </View>

          {/* Existing Members Avatar Row with Free Spot */}
          <View style={styles.membersStripSection}>
            <View style={styles.membersStripHeaderRow}>
              <Text style={styles.membersStripTitle}>УЧАСНИКИ КОЛА</Text>
              <Text style={styles.freeSpotsBadge}>+3 МІСЦЯ ВІЛЬНО</Text>
            </View>

            <View style={styles.membersRow}>
              {PREVIEW_MEMBERS.map((m, idx) => (
                <View key={idx} style={styles.memberCol}>
                  <View
                    style={[
                      styles.memberAvatarWrap,
                      m.isYou && styles.memberAvatarWrapYou,
                    ]}
                  >
                    <Image
                      source={{ uri: m.isYou ? userPhotoUri : m.photo }}
                      style={styles.memberAvatarImg}
                    />
                  </View>
                  <Text
                    style={[
                      styles.memberNameText,
                      m.isYou && styles.memberNameTextYou,
                    ]}
                  >
                    {m.isYou ? 'Ти' : m.name}
                  </Text>
                </View>
              ))}

              {/* Empty Reserved Spot Badge */}
              <View style={styles.memberCol}>
                <View style={styles.emptySpotWrap}>
                  <Feather name="plus" size={17} color={stitch.onSurfaceVariant} />
                </View>
                <Text style={styles.emptySpotText}>Вільне</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Today's Locked Prompt Preview (Reciprocal Teaser) */}
        <View style={styles.lockedPromptCard}>
          <View style={styles.lockedIconBox}>
            <Feather name="lock" size={16} color={stitch.secondary} />
          </View>
          <View style={styles.lockedPromptBody}>
            <View style={styles.lockedPromptTagRow}>
              <Text style={styles.lockedPromptTimeTag}>РИТУАЛ ДНЯ • 21:00</Text>
              <Text style={styles.lockedPromptBadge}>ЗАБЛОКОВАНО</Text>
            </View>
            <Text style={styles.lockedPromptQuestion}>
              «Хто з нас найімовірніше...»
            </Text>
            <Text style={styles.lockedPromptDesc}>
              Сьогоднішнє питання дня вже чекає. Воно відкриється для тебе одразу після приєднання та першого спільного ходу.
            </Text>
          </View>
        </View>

        {/* Onboarding Profile Setup Card */}
        <View style={styles.profileSetupSection}>
          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileSectionTitle}>ТВІЙ ПРОФІЛЬ У ЦІЙ КІМНАТІ</Text>
            <Text style={styles.profileSectionStep}>КРОК 1 З 1</Text>
          </View>

          <View style={styles.profileSetupCard}>
            {/* Avatar picker row */}
            <View style={styles.avatarPickerRow}>
              <View style={styles.avatarPickerLeft}>
                <View style={styles.userPhotoFrame}>
                  <Image source={{ uri: userPhotoUri }} style={styles.userPhotoImg} />
                </View>
                <View>
                  <Text style={styles.userPhotoTitle}>Фотокартка</Text>
                  <Text style={styles.userPhotoScope}>Видно тільки в «Банді з КПІ»</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={handlePickPhoto}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={13} color={stitch.primary} />
                <Text style={styles.changePhotoBtnText}>ЗМІНИТИ ФОТО</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileDividerHairline} />

            {/* Pre-filled Name Input */}
            <View style={styles.nameFieldGroup}>
              <Text style={styles.nameFieldLabel}>ЯК ТЕБЕ НАЗИВАТИ ДРУЗЯМ</Text>
              <View style={styles.nameInputWrap}>
                <TextInput
                  style={styles.nameInputBox}
                  value={name}
                  onChangeText={setName}
                  placeholder="Введи своє ім'я"
                  placeholderTextColor={stitch.outlineVariant}
                  maxLength={30}
                />
                <View style={styles.editIconBadge}>
                  <Feather name="edit-2" size={15} color={stitch.onSurfaceVariant} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Privacy & Trust Reassurance */}
        <View style={styles.privacyReassuranceRow}>
          <Feather name="shield" size={16} color={stitch.secondary} style={{ marginTop: 2 }} />
          <Text style={styles.privacyReassuranceText}>
            <Text style={styles.privacyBold}>100% приватність: </Text>
            Твої щоденні відповіді та картки бачать виключно 8 учасників цієї кімнати. Жодних відкритих профілів чи пошукових індексів.
          </Text>
        </View>

        {errorMsg ? <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text> : null}

        {/* Bottom Actions & Final CTA */}
        <View style={styles.ctaFooterSection}>
          <TouchableOpacity
            style={styles.primaryJoinBtn}
            onPress={handleJoin}
            disabled={isLoading}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.primaryJoinBtnText}>Приєднатися до Банди з КПІ</Text>
                <Feather name="arrow-right" size={17} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryLinksRow}>
            <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.8}>
              <Text style={styles.accountExistsLink}>У мене вже є акаунт</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.declineInviteLink}>Відхилити запрошення</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerColophonText}>
            KAPSA JOURNAL • ISSUE 04 • SECURE ENCLAVE
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
  topNavBar: {
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
  navBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBackText: {
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
  navRightWrap: {
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    opacity: 0.8,
  },
  monogramText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: stitch.onSurfaceVariant,
  },
  navCloseBtn: {
    padding: 4,
  },
  scrollCanvas: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 20,
  },
  headerSection: {
    gap: 6,
  },
  tagLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteTagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: stitch.secondary,
  },
  dotDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: stitch.outlineVariant,
  },
  codeSnippetTag: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  heroHeadlineTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -0.5,
    color: stitch.primary,
    lineHeight: 34,
  },
  heroHeadlineDesc: {
    fontSize: 14,
    color: stitch.onSurfaceVariant,
    lineHeight: 20,
  },
  roomIdentityCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 16,
    gap: 16,
  },
  inviterBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: stitch.outlineVariant,
    paddingBottom: 14,
  },
  inviterMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviterAvatarFrame: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  inviterAvatarImg: {
    width: '100%',
    height: '100%',
  },
  inviterOverline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurfaceVariant,
  },
  inviterName: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.primary,
  },
  activeRoomBadge: {
    backgroundColor: stitch.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  activeRoomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: stitch.secondary,
  },
  roomMetaBlock: {
    gap: 4,
  },
  roomHeadlineTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '500',
    color: stitch.primary,
    letterSpacing: -0.2,
  },
  roomDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomDetailTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
  },
  roomBulletDot: {
    fontSize: 10,
    color: stitch.outlineVariant,
  },
  roomScheduleText: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    marginTop: 2,
  },
  membersStripSection: {
    gap: 10,
  },
  membersStripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  membersStripTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  freeSpotsBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.secondary,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberCol: {
    alignItems: 'center',
    gap: 4,
  },
  memberAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  memberAvatarWrapYou: {
    borderWidth: 2,
    borderColor: stitch.secondary,
  },
  memberAvatarImg: {
    width: '100%',
    height: '100%',
  },
  memberNameText: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  memberNameTextYou: {
    fontSize: 10,
    fontWeight: '700',
    color: stitch.secondary,
  },
  emptySpotWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: stitch.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 249, 246, 0.5)',
  },
  emptySpotText: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  lockedPromptCard: {
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 14,
    backgroundColor: stitch.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  lockedIconBox: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: stitch.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
  },
  lockedPromptBody: {
    flex: 1,
    gap: 4,
  },
  lockedPromptTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedPromptTimeTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  lockedPromptBadge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: stitch.secondary,
  },
  lockedPromptQuestion: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontStyle: 'italic',
    color: stitch.primary,
  },
  lockedPromptDesc: {
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    lineHeight: 17,
  },
  profileSetupSection: {
    gap: 8,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: stitch.onSurface,
  },
  profileSectionStep: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  profileSetupCard: {
    backgroundColor: stitch.surfaceContainerLow,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  avatarPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userPhotoFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
  },
  userPhotoImg: {
    width: '100%',
    height: '100%',
  },
  userPhotoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.primary,
  },
  userPhotoScope: {
    fontSize: 10,
    color: stitch.onSurfaceVariant,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    backgroundColor: stitch.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  changePhotoBtnText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.primary,
  },
  profileDividerHairline: {
    height: 1,
    backgroundColor: stitch.outlineVariant,
    width: '100%',
  },
  nameFieldGroup: {
    gap: 6,
  },
  nameFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: stitch.onSurfaceVariant,
  },
  nameInputWrap: {
    position: 'relative',
  },
  nameInputBox: {
    width: '100%',
    backgroundColor: stitch.surface,
    borderWidth: 1,
    borderColor: stitch.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: stitch.primary,
  },
  editIconBadge: {
    position: 'absolute',
    right: 12,
    top: 11,
  },
  privacyReassuranceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  privacyReassuranceText: {
    flex: 1,
    fontSize: 12,
    color: stitch.onSurfaceVariant,
    lineHeight: 17,
  },
  privacyBold: {
    fontWeight: '600',
    color: stitch.primary,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: stitch.error,
    paddingHorizontal: 4,
  },
  ctaFooterSection: {
    paddingTop: 8,
    gap: 12,
  },
  primaryJoinBtn: {
    width: '100%',
    backgroundColor: stitch.secondary,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
  primaryJoinBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  secondaryLinksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  accountExistsLink: {
    fontSize: 11,
    color: stitch.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
  declineInviteLink: {
    fontSize: 11,
    color: stitch.outline,
  },
  footerColophonText: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: stitch.outlineVariant,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
