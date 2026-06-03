# StreakWar Bug-Fix Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all definite bugs, race conditions, translation issues, and UX missing-states identified by the 4-agent code review.

**Architecture:** 4 parallel fix groups with no file overlap. Each agent owns its files exclusively. Fixes are targeted — no refactors, no new features beyond what fixes the identified bugs.

**Tech Stack:** React Native (Expo), TypeScript, Supabase, expo-notifications, react-native-health, react-native-health-connect

---

## Group 1 — Health Connect / HealthKit / BackgroundSync

**Files:**
- `src/lib/healthConnect.ts`
- `src/lib/healthKit.ts`
- `src/lib/backgroundSync.ts`
- `src/hooks/useHealthSync.ts`

### Fix 1a: healthConnect.ts — Defensive readRecords API shape guard (line 191, 244)
Some HC versions return array directly, not `{ records }`. Guard both calls:
```ts
const rawSessions = await readRecords('ExerciseSession', { timeRangeFilter: ... });
const sessionList = Array.isArray(rawSessions) ? rawSessions : (rawSessions?.records ?? []);

const rawSteps = await readRecords('Steps', { timeRangeFilter: ... });
const stepRecords = Array.isArray(rawSteps) ? rawSteps : (rawSteps?.records ?? []);
```

### Fix 1b: healthConnect.ts — Add poll mutex to prevent concurrent syncs
Add module-level flag before `pollHealthConnect`:
```ts
let _pollInFlight = false;
export async function pollHealthConnect(userId: string): Promise<number> {
  if (_pollInFlight) return 0;
  _pollInFlight = true;
  try {
    // ... existing body ...
  } finally {
    _pollInFlight = false;
  }
}
```

### Fix 1c: healthKit.ts — Stale userId guard in observeWorkouts callback (line 79-82)
```ts
AppleHealthKit.observeWorkouts({}, async (_err: any, results: any[]) => {
  if (_err || !results?.length) return;
  if (_initializedUserId !== userId) return;  // ADD THIS
  await syncNewWorkouts(userId, results);
});
```

### Fix 1d: healthKit.ts — Prevent double-init race (line 65-87)
Add `_initInProgress` flag:
```ts
let _initInProgress = false;
export async function initHealthKit(userId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return false;
  if (_initializedUserId === userId) return true;
  if (_initInProgress) return false;   // ADD THIS
  _initInProgress = true;
  return new Promise(resolve => {
    AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (err: any) => {
      _initInProgress = false;          // ADD THIS
      if (err) { ... resolve(false); return; }
      ...
    });
  });
}
// Also reset on teardown:
export function teardownHealthKit() {
  _initializedUserId = null;
  _initInProgress = false;
}
```

### Fix 1e: healthKit.ts — Rename misleading variable (line 98)
```ts
// Before:
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 7);
// After:
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
// Update usage in getSamples call: startDate: sevenDaysAgo.toISOString()
```

### Fix 1f: backgroundSync.ts — Return Failed (not NoData) on auth failure (line 48)
```ts
if (!session) return BackgroundFetch.BackgroundFetchResult.Failed;  // was NoData
```

### Fix 1g: backgroundSync.ts — Only update last_synced_at when synced > 0 (line 63-68)
```ts
if (synced > 0) {
  await supabase
    .from('device_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('provider', Platform.OS === 'ios' ? ['apple_health'] : ['health_connect']);
}
```

### Fix 1h: useHealthSync.ts — disconnect() must clean up background state (line 154-161)
Import `clearUserId` and `unregisterBackgroundSync` and call them on disconnect:
```ts
import { persistUserId, clearUserId, unregisterBackgroundSync } from '../lib/backgroundSync';
// ...
const disconnect = useCallback(async (provider: ProviderKey): Promise<void> => {
  await supabase
    .from('device_connections')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('provider', provider);

  // If no native provider remains active, stop background sync
  const nativeProv: ProviderKey = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
  if (provider === nativeProv) {
    await clearUserId();
    await unregisterBackgroundSync();
  }

  await fetchConnections();
}, [userId, fetchConnections]);
```

### Fix 1i: useHealthSync.ts — Add syncNow mutex to prevent double-tap race
```ts
const syncNow = useCallback(async (): Promise<number> => {
  if (!userId || syncing) return 0;  // Guard with existing syncing state
  ...
}, [userId, fetchConnections, syncing]);
```

---

## Group 2 — Notifications / Streaks

**Files:**
- `src/lib/streakNotification.ts`
- `src/hooks/useStreaks.ts`
- `src/hooks/usePushNotifications.ts`

### Fix 2a: streakNotification.ts — Fix date mutation bug in evening loop (line 68-99)
Create a fresh Date object per iteration so mutations don't bleed across iterations:
```ts
for (let i = 0; i < 7; i++) {
  const date = new Date();            // fresh Date each iteration
  date.setDate(date.getDate() + i);
  const dateStr = toLocalDate(date);
  // Skip today if already logged
  if (hasStreak && i === 0 && lastLoggedDate === todayStr) continue;
  date.setHours(20, 0, 0, 0);
  if (date.getTime() < Date.now()) continue;
  // ... schedule notification
}
```

### Fix 2b: streakNotification.ts — Add deep-link data payload to notifications
Add `data` field so notification taps can route to LogWorkout:
```ts
// Morning notification content:
content: {
  title: morningTitle,
  body: morningBody,
  sound: true,
  data: { screen: 'LogWorkout' },
  ...(Platform.OS === 'android' && { channelId: 'default' }),
},
// Evening notification content:
content: {
  title,
  body,
  sound: true,
  data: { screen: 'LogWorkout' },
  ...(Platform.OS === 'android' && { channelId: 'default' }),
},
```

### Fix 2c: useStreaks.ts — Fix UTC vs local date in applyStreakDecay (line 14-15)
```ts
// Before:
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
// After (use toLocalDate which is already imported via dateUtils):
import { toLocalDate } from '../lib/dateUtils';
// ...
const today = toLocalDate(new Date());
const yesterday = toLocalDate(new Date(Date.now() - 86_400_000));
```

Also fix line 50 in fetchFreezeState which has the same pattern:
```ts
const today = toLocalDate(new Date());
```

### Fix 2d: usePushNotifications.ts — Handle LogWorkout deep link in notification handler
In `handleNotificationResponse`, add routing for `data.screen === 'LogWorkout'`:
```ts
function handleNotificationResponse(response, navigationRef) {
  const data = response.notification.request.content.data as any;
  if (data?.screen === 'LogWorkout') {
    navigationRef.navigate('LogWorkout');
    return;
  }
  if (data?.screen === 'WeeklyRecap') { ... }
  if (data?.challenge_id) { ... }
}
```

---

## Group 3 — Main Screens

**Files:**
- `src/screens/ChallengeDetailScreen.tsx`
- `src/screens/WeeklyRecapScreen.tsx`
- `src/screens/LogWorkoutScreen.tsx`
- `src/screens/LeaderboardScreen.tsx`
- `src/screens/CreateChallengeScreen.tsx`
- `src/screens/ConnectDevicesScreen.tsx`
- `src/screens/ProfileScreen.tsx`
- `src/screens/DiscoverScreen.tsx`

### Fix 3a: ChallengeDetailScreen.tsx — Loading spinner instead of blank screen
Replace `return <View style={{ flex: 1, backgroundColor: C.bg }} />;` with:
```tsx
return (
  <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={C.green} size="large" />
  </View>
);
```
Import ActivityIndicator from react-native.

### Fix 3b: ChallengeDetailScreen.tsx — Translate Icelandic strings
Find and translate all Icelandic UI strings in this file (invite text, share dialog title, etc.)

### Fix 3c: WeeklyRecapScreen.tsx — Add error handling
Add `error` state, catch Supabase errors in `load()`, show retry UI on error.

### Fix 3d: LogWorkoutScreen.tsx — Fix duration=0 bug
```ts
// Before:
const durationVal = duration ? parseFloat(duration) : null;
// After:
const durationVal = duration !== '' ? parseFloat(duration) : null;
// Also add range validation:
if (durationVal !== null && durationVal <= 0) {
  Alert.alert('Invalid Duration', 'Duration must be greater than 0.');
  return;
}
```

### Fix 3e: LogWorkoutScreen.tsx — Add cancel confirmation when form has data
Before navigating back on cancel, check if any form fields have data and show confirmation Alert.

### Fix 3f: LeaderboardScreen.tsx — Fix dual FlatList rendering
Gate the league FlatList so only one list renders at a time:
```tsx
{tab === 'league' && <FlatList ... />}
{tab !== 'league' && <FlatList ... />}
```

### Fix 3g: LeaderboardScreen.tsx — Translate Icelandic rate-limit alert
Find "Þegar sent" and other Icelandic strings, translate to English.

### Fix 3h: CreateChallengeScreen.tsx — Add Step 3 validation
Add `validateStep3()` function that checks `backlogDays` is a positive integer and scoring values are positive numbers. Call before advancing from step 3.

### Fix 3i: CreateChallengeScreen.tsx — Translate Icelandic labels
Translate: template labels ('30 dagar', 'Skref', 'Hlaupavik', etc.), duration labels ('1 vika', '2 vikur', etc.), renewal options ('Nei', 'Vikulegt', 'Mánaðarlegt'), section labels ('SNÖGG UPPSETNING', 'LENGD', 'ENDURNÝJAST SJÁLFKRAFA?').

### Fix 3j: ConnectDevicesScreen.tsx — Guard HC debug alert with __DEV__
```ts
// Before:
Alert.alert('HC Debug (temp)', getLastHCDebug() || 'no debug info');
// After:
if (__DEV__) Alert.alert('HC Debug (temp)', getLastHCDebug() || 'no debug info');
```

### Fix 3k: ConnectDevicesScreen.tsx — Translate Icelandic alert text
Find and translate any Icelandic alerts/strings in this file.

### Fix 3l: ProfileScreen.tsx — Remove duplicate sign-out button
Remove the header sign-out text link (keep only the bottom button).

### Fix 3m: ProfileScreen.tsx — Add empty states
- Streak card: show "Start your streak today! Log your first workout." when `!streak`
- Heatmap: show placeholder text when no heatmap data
- Achievements: show "Complete workouts to earn achievements!" when empty

### Fix 3n: DiscoverScreen.tsx — Add error handling
Check `.error` on Supabase responses, set error state, show error message.

---

## Group 4 — Components + HomeScreen

**Files:**
- `src/components/ErrorBoundary.tsx`
- `src/components/NetworkError.tsx`
- `src/components/ShareCard.tsx`
- `src/components/WorkoutPostCard.tsx`
- `src/screens/HomeScreen.tsx`

### Fix 4a: ErrorBoundary.tsx — Translate to English
Replace all Icelandic text with English equivalents.

### Fix 4b: NetworkError.tsx — Translate to English
Replace all Icelandic text with English equivalents.

### Fix 4c: ShareCard.tsx — Translate labels to English
Replace: 'VIKU'→'WEEKS', 'MÁNAÐAR'→'MONTHS', 'SÆTI'→'RANK', 'STIG'→'PTS', 'NOTANDI'→'USER', 'Kóði:'→'Code:', footer text, etc.

### Fix 4d: WorkoutPostCard.tsx — Add commentsLoading state
Add `commentsLoading` state in the component. Set true before `onFetchComments`, false after. Show `ActivityIndicator` inside the modal while loading instead of the empty state.

### Fix 4e: WorkoutPostCard.tsx — Truncate long captions
Add `numberOfLines={3}` to caption Text and optionally a "Read more" expand toggle.

### Fix 4f: HomeScreen.tsx — Translate Icelandic rival banner
Find `er {rivalDiff} {rivalDiff === 1 ? 'stigi' : 'stigum'} á undan þér` and `Sjá leaderboard →` and translate to English: `is {rivalDiff} {rivalDiff === 1 ? 'point' : 'points'} ahead of you` and `See leaderboard →`.
