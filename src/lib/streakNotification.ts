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
const EVENING_ID = 'streakwar-evening-reminder';

/** Schedule (or refresh) both daily reminders. Safe to call repeatedly. */
export async function scheduleStreakReminder(currentStreak: number): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const streakLine = currentStreak > 0
      ? `${currentStreak}-day streak — keep it going! 🔥`
      : 'Start your streak today 🔥';

    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: {
        title: 'StreakWar — Good morning! 🌅',
        body: currentStreak > 0 ? 'Keep your streak going — log a workout today! 🔥' : 'Start your streak today 🔥',
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'default' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });

    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_ID,
      content: {
        title: 'StreakWar — Don\'t break your streak!',
        body: currentStreak > 0 ? 'Log your workout before midnight to keep your streak alive 🔥' : 'Log a workout and start your streak 🔥',
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'default' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
  } catch {
    // non-critical
  }
}

/** Cancel all streak reminders (e.g. on logout). */
export async function cancelStreakReminders(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});
  } catch {
    // non-critical
  }
}

/** @deprecated Use cancelStreakReminders(). Kept so LogWorkoutScreen compiles. */
export async function cancelTodayStreakReminder(): Promise<void> {
  // Repeating triggers cannot be paused for a single day.
  // The evening reminder will still fire; users can dismiss it.
}
