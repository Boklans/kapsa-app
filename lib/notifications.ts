import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Налаштування поведінки сповіщень у передньому плані
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const ANDROID_CHANNEL_ID = 'kapsa-daily-rounds';

/**
 * Реєстрація пристрою для отримання push-сповіщень
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Щоденні раунди KAPSA',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#AB3425',
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    return tokenData?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Планування щоденного нагадування о 21:00 про розкриття раунду
 */
export async function scheduleDailyCapsuleNotification(
  hour: number = 21,
  minute: number = 0
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    // Скасовуємо попередні щоденні нагадування, щоб не спамити
    await cancelAllDailyNotifications();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Сургуч розкрито! ✨',
        body: 'Відповіді твого простору в KAPSA відкрилися. Зазирни дізнатися результати!',
        sound: 'default',
        badge: 1,
        data: { screen: 'today', stage: 'revealed' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    return id;
  } catch {
    return null;
  }
}

/**
 * Скасування всіх запланованих сповіщень
 */
export async function cancelAllDailyNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}

/**
 * Тестове локальне сповіщення (для перевірки наживо з налаштувань)
 */
export async function sendTestLocalNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'KAPSA • Тестове сповіщення 💌',
        body: 'Капсула дня надійно захищена. Сповіщення налаштовано успішно!',
        sound: 'default',
        badge: 1,
      },
      trigger: null, // негайно
    });
  } catch {
    // ignore
  }
}
