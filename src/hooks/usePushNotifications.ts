import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { scheduleStreakReminder } from '../lib/streakNotification';
import type { NavigationContainerRef } from '@react-navigation/native';

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
  navigationRef: NavigationContainerRef<any>
) {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!userId) return;

    registerForPushNotifications(userId).catch((e) =>
      console.warn('[PushNotifications] registration failed:', e)
    );

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // foreground notification received
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.challenge_id && navigationRef.isReady()) {
        navigationRef.navigate('ChallengeDetail' as never, { challengeId: data.challenge_id } as never);
      }
      if (data?.screen === 'WeeklyRecap') {
        navigationRef.current?.navigate('WeeklyRecap' as never);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);
}

async function registerForPushNotifications(userId: string) {
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
  }
  if (finalStatus !== 'granted') {
    console.warn('[PushNotifications] permission denied');
    return;
  }

  // Schedule the streak reminder now that we know permissions are granted
  await scheduleStreakReminder(0).catch(() => {});

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[PushNotifications] no projectId found in config');
    return;
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('[PushNotifications] token:', token);
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
