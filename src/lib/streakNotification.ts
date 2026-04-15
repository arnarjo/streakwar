/**
 * Schedules a daily 8pm reminder if the user hasn't logged a workout yet today.
 * Call scheduleStreakReminder() on login and after each successful workout log.
 * The notification is rescheduled for tomorrow each time so it fires every evening
 * until the user logs. If they log before 8pm the reminder is cancelled for that day.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const IDENTIFIER = 'streakwar-streak-reminder';

function tonightAt8pm(): Date {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  // If it's already past 8pm, schedule for tomorrow
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Schedule (or reschedule) the streak-at-risk reminder for 8pm tonight. */
export async function scheduleStreakReminder(currentStreak: number): Promise<void> {
  // Background-fetch and task-manager environments may not have notification
  // permissions yet — swallow any errors silently.
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel any previously scheduled instance before replacing it
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => {});

    const streakMsg = currentStreak > 0
      ? `Haltu ${currentStreak}-daga streaknum lifandi! 🔥`
      : 'Skráðu workout og byrjaðu streakinn þinn 🔥';

    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER,
      content: {
        title: 'StreakWar — Streakur þinn er í hættu!',
        body: streakMsg,
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'default' }),
      },
      trigger: { date: tonightAt8pm() },
    });
  } catch {
    // Silently ignore — push notifications are non-critical
  }
}

/** Cancel the reminder — call this immediately after a workout is successfully logged. */
export async function cancelTodayStreakReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
    // Reschedule for tomorrow so the habit loop continues
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER,
      content: {
        title: 'StreakWar — Haltu streaknum gangandi!',
        body: 'Dagurinn er næstum liðinn — skráðu workout til að halda streaknum 🔥',
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'default' }),
      },
      trigger: { date: tonightAt8pm() },
    });
  } catch {
    // Silently ignore
  }
}
