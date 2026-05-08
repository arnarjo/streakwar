/**
 * Schedules two daily repeating reminders:
 *  - 8am: motivational morning nudge
 *  - 8pm: streak-at-risk reminder
 *
 * Call scheduleStreakReminder() on login and whenever the streak changes.
 * Call cancelStreakReminders() on logout.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const MORNING_ID = 'streakwar-morning-reminder';
const EVENING_BASE_ID = 'streakwar-evening-reminder-';

/**
 * Schedule (or refresh) daily reminders.
 * Morning: 8am daily nudge.
 * Evening: 8pm streak-at-risk reminder (only if streak > 0).
 */
export async function scheduleStreakReminder(
  currentStreak: number,
  lastLoggedDate?: string | null
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // 1. Morning Reminder (Always daily)
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: {
        title: 'StreakWar — Good morning! 🌅',
        body: currentStreak > 0
          ? `Keep your ${currentStreak}-day streak going — log a workout today! 🔥`
          : 'Start your streak today 🔥',
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'default' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });

    // 2. Evening Reminders (One-time triggers for the next 7 days)
    // First, clear existing evening reminders to avoid duplicates
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(EVENING_BASE_ID)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    if (currentStreak === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Skip today if already logged
      if (i === 0 && lastLoggedDate === todayStr) continue;

      // Set to 8:00 PM
      date.setHours(20, 0, 0, 0);

      // If 8 PM today has already passed, skip today
      if (date.getTime() < Date.now()) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `${EVENING_BASE_ID}${dateStr}`,
        content: {
          title: "StreakWar — Don't break your streak!",
          body: `Log your workout before midnight to keep your ${currentStreak}-day streak alive 🔥`,
          sound: true,
          ...(Platform.OS === 'android' && { channelId: 'default' }),
        },
        trigger: date,
      });
    }
  } catch (e) {
    console.warn('[StreakNotification] schedule failed:', e);
  }
}

/** Cancel all streak reminders (e.g. on logout). */
export async function cancelStreakReminders(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(EVENING_BASE_ID)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // non-critical
  }
}

/** Cancels today's 8pm reminder (e.g. after logging a workout). */
export async function cancelTodayStreakReminder(): Promise<void> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    await Notifications.cancelScheduledNotificationAsync(`${EVENING_BASE_ID}${todayStr}`);
  } catch {
    // non-critical
  }
}
