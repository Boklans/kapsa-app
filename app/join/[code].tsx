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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, editorial, fonts, getAvatarPhotoUri } from '@/constants/colors';
import { AVATAR_EMOJIS, useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';

export default function JoinByCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const { displayName, avatarEmoji } = useAuthStore();
  const { joinRoomByCode, isLoading } = useRoomStore();

  const [inviteCode, setInviteCode] = useState((code || '').toUpperCase());
  const [name, setName] = useState(displayName === 'Ти' ? '' : displayName);
  const [selectedEmoji, setSelectedEmoji] = useState(avatarEmoji || '😎');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleJoin = async () => {
    setErrorMsg(null);
    if (!inviteCode.trim()) {
      setErrorMsg('Введіть 6-значний код запрошення');
      return;
    }

    try {
      const roomId = await joinRoomByCode(
        inviteCode,
        name.trim() || displayName,
        selectedEmoji
      );
      router.replace(`/room/${roomId}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не вдалося приєднатися до кімнати');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.logoText}>KAPSA</Text>
            <Text style={styles.handwrittenSub}>
              Запрошення у приватну капсулу ☆
            </Text>
          </View>
          <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
            <Text style={styles.backPillText}>← На головну</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Приєднатися до кімнати</Text>
          <Text style={styles.subtitle}>
            Обери своє ім’я та аватар, які бачитимуть друзі або партнер у щоденних раундах.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Код кімнати</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              placeholder="KAPS26"
              placeholderTextColor={editorial.inkMuted}
              autoCapitalize="characters"
              maxLength={6}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Твоє ім’я або нікнейм</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Наприклад: Макс"
              placeholderTextColor={editorial.inkMuted}
              maxLength={32}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Твій портретний аватар</Text>
            <View style={styles.emojiGrid}>
              {AVATAR_EMOJIS.map((emoji) => {
                const active = selectedEmoji === emoji;
                const photoUri = getAvatarPhotoUri(emoji);
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.emojiOption, active && styles.emojiOptionActive]}
                    onPress={() => setSelectedEmoji(emoji)}
                  >
                    <Image source={{ uri: photoUri }} style={styles.portraitOptionImg} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {errorMsg ? <Text style={styles.errorText}>⚠️ {errorMsg}</Text> : null}

          <TouchableOpacity
            style={styles.joinBtn}
            onPress={handleJoin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.joinBtnText}>Увійти в капсулу →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: editorial.paperBg,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoText: {
    fontFamily: fonts.serif,
    fontSize: 30,
    fontWeight: '800',
    color: editorial.inkPrimary,
  },
  handwrittenSub: {
    fontFamily: fonts.handwritten,
    fontSize: 20,
    color: editorial.inkSecondary,
    marginTop: -2,
  },
  backPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: editorial.paperBorder,
  },
  backPillText: {
    color: editorial.inkPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: editorial.paperBorder,
    gap: 16,
  },
  title: {
    fontFamily: fonts.serif,
    color: editorial.inkPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: editorial.inkSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: editorial.inkPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: editorial.paperBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: editorial.inkPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: editorial.paperBorder,
  },
  codeInput: {
    letterSpacing: 4,
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 22,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: editorial.paperBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: editorial.paperBorder,
    overflow: 'hidden',
  },
  emojiOptionActive: {
    borderColor: editorial.coralAccent,
  },
  portraitOptionImg: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  joinBtn: {
    backgroundColor: editorial.inkPrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
