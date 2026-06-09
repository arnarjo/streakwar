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
import { toLocalDate } from './dateUtils';
import { logger } from './logger';

const MORNING_ID = 'streakwar-morning-reminder';
const EVENING_BASE_ID = 'streakwar-evening-reminder-';

/**
 * Schedule (or refresh) daily reminders.
 * Morning: 8am daily nudge.
 * Evening: 8pm streak-at-risk reminder (only if streak > 0).
 */
export async function scheduleStreakReminder(
  currentStreak: number,
  lastLoggedDate?: string | null,
  userName?: string | null
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const morningTitle = currentStreak >= 7
      ? `${currentStreak} days strong${userName ? `, ${userName}` : ''}! 🔥`
      : `Rise and grind${userName ? `, ${userName}` : ''}! 💪`;

    const morningBody = currentStreak > 0
      ? `Day ${currentStreak + 1} won't log itself — any workout counts.`
      : 'Day 1 starts now. Log a workout and build your streak!';

    // 1. Morning Reminder (Always daily) — cancel first to prevent Android duplicate triggers
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: {
        title: morningTitle,
        body: morningBody,
        sound: true,
        data: { screen: 'LogWorkout' },
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

    const todayStr = toLocalDate(new Date());
    const hasStreak = currentStreak > 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = toLocalDate(date);

      // Skip today if already logged (only relevant when streak is active)
      if (hasStreak && i === 0 && lastLoggedDate === todayStr) continue;

      // Set to 8:00 PM
      date.setHours(20, 0, 0, 0);

      // If 8 PM today has already passed, skip today
      if (date.getTime() < Date.now()) continue;

      const title = hasStreak
        ? (userName ? `${userName}, clock's ticking! ⏰` : "StreakWar — Clock's ticking! ⏰")
        : (userName ? `${userName}, start tonight! 💪` : 'StreakWar — Start your streak tonight! 💪');

      const body = hasStreak
        ? `${currentStreak}-day streak expires at midnight — any workout saves it 🔥`
        : 'Log one workout tonight and day 1 is done. Streaks start somewhere!';

      await Notifications.scheduleNotificationAsync({
        identifier: `${EVENING_BASE_ID}${dateStr}`,
        content: {
          title,
          body,
          sound: true,
          data: { screen: 'LogWorkout' },
          ...(Platform.OS === 'android' && { channelId: 'default' }),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
  } catch (e) {
    logger.warn('[StreakNotification] schedule failed', e);
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
    await Notifications.cancelScheduledNotificationAsync(`${EVENING_BASE_ID}${toLocalDate(new Date())}`);
  } catch {
    // non-critical
  }
}
