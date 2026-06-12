import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { scheduleStreakReminder } from '../lib/streakNotification';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // non-critical
}

export function usePushNotifications(
  userId: string,
  navigationRef: NavigationContainerRef<RootStackParamList>
) {
  const notificationListener = useRef<Notifications.EventSubscription>(undefined);
  const responseListener = useRef<Notifications.EventSubscription>(undefined);

  const refreshReminders = useCallback(async () => {
    if (!userId) return;
    const [{ data: streakData }, { data: profile }] = await Promise.all([
      supabase
        .from('user_streaks')
        .select('current_streak, last_active_date')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', userId)
        .single()
    ]);

    const firstName = profile?.full_name?.split(' ')[0] ?? profile?.username;

    await scheduleStreakReminder(
      streakData?.current_streak ?? 0,
      streakData?.last_active_date,
      firstName
    ).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    registerForPushNotifications(userId, refreshReminders).catch((e) =>
      console.warn('[PushNotifications] registration failed:', e)
    );

    // Re-schedule reminders each time the app comes to the foreground so
    // the streak count stays current and the repeating triggers are re-created
    // if they were ever cleared (e.g. OS notification reset).
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshReminders();
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // foreground notification received
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationResponse(response, navigationRef);
    });

    // Handle cold start: app was closed and user tapped a notification to open it.
    // addNotificationResponseReceivedListener fires too early in this case —
    // getLastNotificationResponseAsync catches it once navigation is ready.
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const waitForNav = (attempts = 0) => {
        if (navigationRef.isReady()) {
          handleNotificationResponse(response, navigationRef);
        } else if (attempts < 20) {
          setTimeout(() => waitForNav(attempts + 1), 100);
        }
      };
      waitForNav();
    });

    return () => {
      appStateSub.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId, refreshReminders]);
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  navigationRef: NavigationContainerRef<RootStackParamList>,
) {
  if (!navigationRef.isReady()) return;
  const data = response.notification.request.content.data as any;
  if (data?.screen === 'LogWorkout') {
    navigationRef.navigate('LogWorkout');
    return;
  }
  if (data?.screen === 'WeeklyRecap') {
    navigationRef.navigate('WeeklyRecap');
  } else if (data?.challenge_id) {
    navigationRef.navigate('ChallengeDetail', { challengeId: String(data.challenge_id) });
  }
}

async function registerForPushNotifications(
  userId: string,
  refreshReminders: () => Promise<void>,
) {
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;

    // Permissions just granted — schedule reminders immediately
    if (finalStatus === 'granted') {
      await refreshReminders();
    }
  }
  if (finalStatus !== 'granted') {
    console.warn('[PushNotifications] permission denied');
    return;
  }

  // Schedule reminders with actual streak count now that permissions are confirmed
  await refreshReminders();

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[PushNotifications] no projectId found in config');
    return;
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    console.warn('[PushNotifications] getExpoPushTokenAsync failed:', e);
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) console.warn('[PushNotifications] failed to save token:', error);
}
