import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
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
  // non-critical — notifications may not show in foreground
}

export function usePushNotifications(
  userId: string,
  navigationRef: NavigationContainerRef<any>
) {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!userId) return;

    registerForPushNotifications(userId).catch(() => {});

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

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return;
  }

  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
}
