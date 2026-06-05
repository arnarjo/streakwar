# StreakWar: Perfect App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring StreakWar from 7.35/10 to 10/10 across UI/Design, Code Quality, Architecture, and Health Connect before closed beta testing.

**Architecture:** Phase 0 (security) must complete first. Then three independent tracks (1A Architecture, 1B UI/Design, 1C Health Connect) run in parallel. Phase 2 (quality) runs after all three tracks complete.

**Tech Stack:** React Native (Expo), TypeScript, Supabase (PostgreSQL + Edge Functions), react-native-health-connect v3.5.0, expo-background-fetch, RevenueCat, Reanimated 2, Inter font via @expo-google-fonts

---

## ⚠️ REQUIRED ORDER
```
Phase 0 (security) → [Phase 1A + 1B + 1C in parallel] → Phase 2 (quality)
```

---

## Phase 0: Security Sprint (~30 min, must complete first)

### Task 0.1: Remove hardcoded credentials from Auth.js

**Files:**
- Modify: `Auth.js`

- [ ] Read `Auth.js` lines 90-110 to confirm credential locations

- [ ] Replace hardcoded initial state:
```js
// Auth.js — find and replace:
// BEFORE:
const [email, setEmail] = useState('arnar@streakwar.app');
const [pw, setPw] = useState('streakwar1');

// AFTER:
const [email, setEmail] = useState('');
const [pw, setPw] = useState('');
```

- [ ] Verify no other files have hardcoded passwords:
```bash
grep -rn "streakwar1\|arnar@streakwar" --include="*.js" --include="*.ts" --include="*.tsx" .
```
Expected: Zero matches outside prototype/ directory

- [ ] Commit:
```bash
git add Auth.js
git commit -m "security: remove hardcoded test credentials from Auth.js"
```

---

### Task 0.2: Fix package.json — declare all missing dependencies

**Files:**
- Modify: `package.json`

- [ ] Get installed versions of all missing packages:
```bash
node -e "
const pkgs = [
  'react-native-health-connect','expo-background-fetch','expo-task-manager',
  '@react-native-async-storage/async-storage','react-native-health','date-fns',
  'expo-web-browser','@react-navigation/native','@react-navigation/bottom-tabs',
  '@react-navigation/native-stack','react-native-purchases','expo-haptics',
  '@react-native-community/datetimepicker','react-native-reanimated',
  '@supabase/supabase-js','expo-secure-store','expo-image-picker',
  'react-native-purchases'
];
pkgs.forEach(p => {
  try { console.log(p + ': ' + require('./node_modules/' + p + '/package.json').version); }
  catch(e) { console.log(p + ': NOT IN node_modules'); }
});"
```

- [ ] Add each found package to `package.json` under `dependencies` with its exact version:
```json
"dependencies": {
  "react-native-health-connect": "^3.5.0",
  "expo-background-fetch": "^12.0.1",
  "expo-task-manager": "^11.8.2",
  "@react-native-async-storage/async-storage": "^1.23.1",
  "react-native-health": "^1.19.0",
  "date-fns": "^3.6.0",
  "expo-web-browser": "^13.0.3",
  "@react-navigation/native": "^6.1.18",
  "@react-navigation/bottom-tabs": "^6.6.1",
  "@react-navigation/native-stack": "^6.11.0",
  "react-native-purchases": "^8.2.1",
  "expo-haptics": "^13.0.1",
  "@react-native-community/datetimepicker": "^8.2.0",
  "react-native-reanimated": "^3.16.7"
}
```
Replace version numbers with what the node command above reports.

- [ ] Verify install is clean:
```bash
npm install
```
Expected: No new packages downloaded, no errors

- [ ] Commit:
```bash
git add package.json
git commit -m "fix: declare all src/ dependencies in package.json — fresh npm install now works"
```

---

### Task 0.3: Resolve entry point and move prototype files

**Files:**
- Modify: `app.json` (if needed)
- Move: all root `.js` prototype files to `prototype/`

- [ ] Check what Expo uses as entry:
```bash
node -e "const a=require('./app.json'); console.log('main:', a.expo?.entryPoint || a.main || '(not set — defaults to App.js)');"
node -e "const p=require('./package.json'); console.log('main:', p.main || '(not set)');"
```

- [ ] Read first 10 lines of `App.js` to see what it imports:
```bash
head -15 App.js
```

- [ ] Read first 10 lines of `App.tsx` to see which is the real entry:
```bash
head -15 App.tsx
```

- [ ] If `App.tsx` is the real app (imports RootNavigator from src/) and `App.js` is prototype, move prototype files:
```bash
mkdir -p prototype
git mv App.js prototype/App.js
git mv Auth.js prototype/Auth.js
git mv AppNavigator.js prototype/AppNavigator.js
git mv Log.js prototype/Log.js
git mv Profile.js prototype/Profile.js
git mv Leaderboard.js prototype/Leaderboard.js
git mv PostCard.js prototype/PostCard.js
git mv Devices.js prototype/Devices.js
git mv data.js prototype/data.js
git mv download prototype/download 2>/dev/null || true
```

- [ ] Write prototype README:
```bash
cat > prototype/README.md << 'EOF'
# Prototype Files

These are early-stage mock-data prototype files. NOT used in production.
The real app lives in `src/` and is launched from `App.tsx`.
EOF
```

- [ ] If `App.json` has no explicit `entryPoint`, Expo defaults to `App.js` then `App.tsx`. Since we moved `App.js`, confirm `App.tsx` is the new default:
```bash
npx expo export --platform android --dry-run 2>&1 | head -5
```
Expected: Resolves `App.tsx` without error

- [ ] Commit:
```bash
git add -A
git commit -m "chore: move prototype .js files to prototype/, App.tsx is now unambiguous entry point"
```

---

### Task 0.4: Encrypt OAuth tokens in device_connections

**Files:**
- Create: `supabase/migrations/019_encrypt_oauth_tokens.sql`

**Prerequisites:** Before running this migration, create the encryption key in Supabase Dashboard → Vault:
```sql
SELECT vault.create_secret('oauth_key', '<generate-32-char-random-key>');
```

- [ ] Create migration file:
```sql
-- supabase/migrations/019_encrypt_oauth_tokens.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted columns
ALTER TABLE device_connections
  ADD COLUMN IF NOT EXISTS access_token_enc BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_enc BYTEA;

-- Migrate existing plaintext tokens
DO $$
DECLARE enc_key TEXT;
BEGIN
  SELECT decrypted_secret INTO enc_key
  FROM vault.decrypted_secrets WHERE name = 'oauth_key' LIMIT 1;

  IF enc_key IS NULL THEN
    RAISE EXCEPTION 'oauth_key not found in Vault. Run: SELECT vault.create_secret(''oauth_key'', ''<32-char-key>'') first.';
  END IF;

  UPDATE device_connections
  SET
    access_token_enc  = pgp_sym_encrypt(access_token, enc_key),
    refresh_token_enc = pgp_sym_encrypt(refresh_token, enc_key)
  WHERE access_token IS NOT NULL;
END $$;

-- Drop plaintext, rename encrypted
ALTER TABLE device_connections DROP COLUMN IF EXISTS access_token;
ALTER TABLE device_connections DROP COLUMN IF EXISTS refresh_token;
ALTER TABLE device_connections RENAME COLUMN access_token_enc TO access_token;
ALTER TABLE device_connections RENAME COLUMN refresh_token_enc TO refresh_token;

COMMENT ON COLUMN device_connections.access_token  IS 'pgcrypto-encrypted OAuth access token';
COMMENT ON COLUMN device_connections.refresh_token IS 'pgcrypto-encrypted OAuth refresh token';
```

- [ ] Create decryption RPC for edge functions:
```sql
-- supabase/migrations/019b_device_token_rpc.sql
CREATE OR REPLACE FUNCTION get_device_token(p_device_id UUID, p_user_id UUID)
RETURNS TABLE(access_token TEXT, refresh_token TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE enc_key TEXT;
BEGIN
  SELECT decrypted_secret INTO enc_key
  FROM vault.decrypted_secrets WHERE name = 'oauth_key' LIMIT 1;

  RETURN QUERY
  SELECT
    pgp_sym_decrypt(dc.access_token, enc_key)::TEXT,
    pgp_sym_decrypt(dc.refresh_token, enc_key)::TEXT
  FROM device_connections dc
  WHERE dc.id = p_device_id AND dc.user_id = p_user_id;
END $$;
```

- [ ] Update any edge function that reads `access_token` directly to use this RPC instead:
```bash
grep -rn "access_token\|refresh_token" supabase/functions/ --include="*.ts"
```
For each hit, replace direct column access with `supabase.rpc('get_device_token', { p_device_id: id, p_user_id: uid })`

- [ ] Commit:
```bash
git add supabase/migrations/019_encrypt_oauth_tokens.sql supabase/migrations/019b_device_token_rpc.sql supabase/functions/
git commit -m "security: encrypt OAuth tokens at rest with pgcrypto, add get_device_token RPC"
```

---

## Phase 1A: Architecture Track (parallel with 1B and 1C)

### Task 1A.1: Create src/theme.ts — centralized design tokens

**Files:**
- Create: `src/theme.ts`

- [ ] Create the file:
```ts
// src/theme.ts
export const C = {
  bg:         '#0C1117',
  card:       '#151C24',
  cardAlt:    '#1A2332',
  surface:    '#1E2A3A',
  border:     'rgba(255,255,255,0.07)',
  text:       '#FFFFFF',
  text2:      'rgba(255,255,255,0.55)',
  muted:      'rgba(255,255,255,0.35)',
  primary:    '#F97316',
  primaryDark:'#EA580C',
  success:    '#22C55E',
  error:      '#EF4444',
  warning:    '#F59E0B',
  info:       '#3B82F6',
} as const;

/** Hex color to rgba with alpha */
export const a = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const F = {
  disp:   'Inter_800ExtraBold',
  bold:   'Inter_700Bold',
  medium: 'Inter_500Medium',
  ui:     'Inter_400Regular',
} as const;

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;
```

- [ ] Find every screen with a local `const C = {...}` and replace with import:
```bash
grep -rn "const C = {" src/screens/ --include="*.tsx"
```

For each file found:
```ts
// REMOVE the local const C = { ... } block
// ADD at top of imports:
import { C } from '../theme';
```

- [ ] TypeScript check:
```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```
Expected: No new errors from theme import

- [ ] Commit:
```bash
git add src/theme.ts src/screens/
git commit -m "refactor: centralize all color/font tokens in src/theme.ts, remove per-screen duplication"
```

---

### Task 1A.2: Consolidate auth to single subscription

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] Read both files fully

- [ ] Ensure `useAuth.ts` returns `profileExists` and `loading`:
```ts
// useAuth.ts — verify the return object includes:
return {
  user,
  session,
  loading,
  profileExists,  // boolean: user has a profiles row
  signOut,
};
```

If `profileExists` is missing, add it:
```ts
const [profileExists, setProfileExists] = useState(false);

// In SIGNED_IN handler, after fetching profile:
setProfileExists(!!profileData);
```

- [ ] In `RootNavigator.tsx`, remove the duplicate `onAuthStateChange` subscription and local state. Replace with `useAuth()`:
```tsx
// REMOVE these lines:
// const [session, setSession] = useState(null);
// const [loading, setLoading] = useState(true);
// const [profileExists, setProfileExists] = useState(false);
// useEffect(() => { supabase.auth.onAuthStateChange(...) }, []);

// ADD:
import { useAuth } from '../hooks/useAuth';
const { session, loading, profileExists } = useAuth();
```

- [ ] Ensure `configurePurchases()` (RevenueCat init) only exists in `useAuth.ts`, not in `RootNavigator.tsx`

- [ ] TypeScript check:
```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

- [ ] Commit:
```bash
git add src/hooks/useAuth.ts src/navigation/RootNavigator.tsx
git commit -m "fix: single Supabase auth subscription via useAuth hook, remove duplicate in RootNavigator"
```

---

### Task 1A.3: Fix streak decay — check freeze before reset

**Files:**
- Modify: `src/hooks/useStreaks.ts`

- [ ] Read `useStreaks.ts` fully, find the `applyStreakDecay` function (or equivalent)

- [ ] Replace with freeze-aware version:
```ts
const applyStreakDecay = async (userId: string): Promise<void> => {
  const { data, error } = await supabase
    .from('user_streaks')
    .select('current_streak, last_active_date, streak_freeze_uses, freeze_used_today')
    .eq('user_id', userId)
    .single();

  if (error || !data) return;

  const lastActive = new Date(data.last_active_date);
  const today = new Date();
  // Compare date-only (strip time)
  lastActive.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const daysSince = Math.round((today.getTime() - lastActive.getTime()) / 86_400_000);

  if (daysSince <= 1) return; // logged yesterday or today — no decay

  // Consume a freeze if available
  if (data.streak_freeze_uses > 0 && !data.freeze_used_today) {
    await supabase
      .from('user_streaks')
      .update({
        streak_freeze_uses: data.streak_freeze_uses - 1,
        freeze_used_today: true,
        last_active_date: today.toISOString().split('T')[0],
      })
      .eq('user_id', userId);
    return; // streak preserved by freeze
  }

  // No freeze — reset streak
  await supabase
    .from('user_streaks')
    .update({ current_streak: 0 })
    .eq('user_id', userId);
};
```

- [ ] Commit:
```bash
git add src/hooks/useStreaks.ts
git commit -m "fix: streak decay now consumes freeze use instead of resetting Pro users' streaks"
```

---

### Task 1A.4: Batch weekly-league-reset push notifications

**Files:**
- Modify: `supabase/functions/weekly-league-reset/index.ts`

- [ ] Read the full edge function

- [ ] Find the push notification for-loop and replace with batched fetch:
```ts
// Add helper at top of file:
const chunkArray = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

// Replace the notification loop:
// BEFORE:
for (const n of notifications) {
  await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', body: JSON.stringify(n) });
}

// AFTER:
await Promise.all(
  chunkArray(notifications, 100).map(batch =>
    fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
  )
);
```

- [ ] Find the per-user rank upsert loop and replace with single bulk upsert:
```ts
// BEFORE:
for (const user of rankedUsers) {
  await supabase.from('league_members').upsert({ user_id: user.id, rank: user.rank, ... });
}

// AFTER:
await supabase
  .from('league_members')
  .upsert(
    rankedUsers.map(u => ({
      user_id: u.id,
      rank: u.rank,
      tier: u.tier,
      points: u.points,
      league_id: u.leagueId,
    })),
    { onConflict: 'user_id,league_id' }
  );
```

- [ ] Commit:
```bash
git add supabase/functions/weekly-league-reset/index.ts
git commit -m "perf: batch push notifications (100/request) + bulk upsert ranks in weekly-league-reset"
```

---

### Task 1A.5: Add realtime subscription to workout feed

**Files:**
- Modify: `src/hooks/useWorkoutFeed.ts`

- [ ] Read `useWorkoutFeed.ts` fully

- [ ] After initial `fetchFeed()` call, add a Supabase Realtime channel:
```ts
// Add near the top of the hook, after activeChallengeIds are known:
useEffect(() => {
  if (!userId || activeChallengeIds.length === 0) return;

  const channel = supabase
    .channel(`workout-feed-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workout_posts',
      },
      (payload) => {
        // Only refresh if this post is in one of our active challenges
        if (activeChallengeIds.includes(payload.new.challenge_id)) {
          fetchFeed();
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [userId, activeChallengeIds.join(',')]);
```

Where `activeChallengeIds` is the array of challenge IDs the user is currently enrolled in. If this isn't currently tracked in the hook, add:
```ts
const [activeChallengeIds, setActiveChallengeIds] = useState<string[]>([]);

// In fetchFeed, after fetching posts, extract challenge IDs:
const ids = posts.map(p => p.challenge_id).filter(Boolean);
setActiveChallengeIds([...new Set(ids)]);
```

- [ ] Commit:
```bash
git add src/hooks/useWorkoutFeed.ts
git commit -m "feat: realtime Supabase subscription refreshes workout feed on new posts"
```

---

## Phase 1B: UI/Design Track (parallel with 1A and 1C)

### Task 1B.1: Add Inter font via expo-google-fonts

**Files:**
- Modify: `App.tsx`
- Modify: `package.json`

- [ ] Install packages:
```bash
npx expo install @expo-google-fonts/inter expo-font expo-splash-screen
```

- [ ] Update `App.tsx`:
```tsx
import { useCallback } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import RootNavigator from './src/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded || fontError) await SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <RootNavigator />
    </View>
  );
}
```

- [ ] In `HomeScreen.tsx`, find the large streak number StyleSheet and update fontFamily:
```ts
// Find: fontWeight: '800', fontSize: 64
// Change to:
fontFamily: F.disp,
fontSize: 64,
letterSpacing: -2,
lineHeight: 60,
```
Import `F` from theme: `import { C, F } from '../theme';`

- [ ] Apply `F.ui` to all body text and `F.bold` to headings across all screens

- [ ] Verify build:
```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

- [ ] Commit:
```bash
git add App.tsx src/screens/ package.json
git commit -m "feat: load Inter font family, apply F.disp/F.bold/F.ui to all screens"
```

---

### Task 1B.2: Replace emoji tab bar with SVG Icon component

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] Read `RootNavigator.tsx` and `Icon.js` (or wherever the Icon component is exported) to understand Icon's props

- [ ] Replace the `TAB_ICONS` emoji dict and `<Text>` rendering:
```tsx
// Add import at top (adjust path to where Icon lives):
import Icon from '../../Icon'; // or from '../components/Icon'
import { C, F } from '../theme';

// In Tab.Navigator screenOptions:
screenOptions={({ route }) => ({
  tabBarIcon: ({ focused, color }) => {
    const iconNames: Record<string, string> = {
      Home:         'home',
      Log:          'plus-circle',
      Leaderboard:  'trophy',
      Profile:      'user',
    };
    return (
      <Icon
        name={iconNames[route.name] ?? 'circle'}
        size={22}
        color={color}
      />
    );
  },
  tabBarActiveTintColor:   C.primary,
  tabBarInactiveTintColor: C.muted,
  tabBarStyle: {
    backgroundColor: C.card,
    borderTopColor:  C.border,
    height:  82,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabBarLabelStyle: {
    fontFamily: F.ui,
    fontSize: 10,
    marginTop: 2,
  },
})}
```

Note: Check `Icon.js` to see what icon names are available and adjust the `iconNames` map to match actual exported names.

- [ ] Commit:
```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat: replace emoji tab bar icons with custom SVG Icon component"
```

---

### Task 1B.3: Add shimmer animation to Skel component

**Files:**
- Modify: `ui.js` (find the Skel export)

- [ ] Read `ui.js`, find the `Skel` component definition

- [ ] Replace static Skel with animated shimmer:
```js
// Add Easing to the Animated import:
// import { ..., Animated, Easing } from 'react-native';

export const Skel = ({ w, h, r = 8, style }) => {
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1, duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(shimmer, {
          toValue: 0, duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.18],
  });

  return (
    <Animated.View
      style={[{
        width: w, height: h,
        borderRadius: r,
        backgroundColor: '#FFFFFF',
        opacity,
      }, style]}
      accessibilityLabel="Loading"
      accessibilityElementsHidden={true}
      importantForAccessibility="no"
    />
  );
};
```

- [ ] Commit:
```bash
git add ui.js
git commit -m "feat: Skel loading placeholder now has shimmer pulse animation"
```

---

### Task 1B.4: Fix accessibility — Toggle, touch targets, contrast

**Files:**
- Modify: `ui.js`

- [ ] Read `ui.js`, find the `Toggle` component

- [ ] Add accessibility props to Toggle:
```js
// Toggle component's TouchableOpacity:
<TouchableOpacity
  onPress={() => onChange(!value)}
  accessibilityRole="switch"
  accessibilityState={{ checked: !!value }}
  accessibilityLabel={label ?? 'Toggle'}
  activeOpacity={0.7}
  ...
>
```

- [ ] Find reaction buttons (look for paddingVertical: 6) and ensure 44pt minimum:
```js
// Reaction button touchable:
paddingVertical: 10,   // was 6
paddingHorizontal: 12, // was 10
minHeight: 44,
```

- [ ] Find small muted text (fontSize < 13, color muted) and bump to text2 for contrast compliance:
```bash
# Search for small muted text patterns in ui.js:
grep -n "fontSize: 1[012]\|C\.muted\|0\.35" ui.js | head -20
```
For any `fontSize <= 12` with `color: a('#FFFFFF', 0.35)`, change the alpha to `0.55` (text2) to meet WCAG AA 4.5:1.

- [ ] Commit:
```bash
git add ui.js
git commit -m "a11y: Toggle accessibilityRole/State, 44pt reaction touch targets, text contrast fixes"
```

---

### Task 1B.5: Extract IIFEs from JSX, memoize ListHeaderComponent

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/LeaderboardScreen.tsx`

- [ ] In `HomeScreen.tsx`, search for IIFE patterns in JSX:
```bash
grep -n "(() =>" src/screens/HomeScreen.tsx
```

For each IIFE, extract to a variable before the return:
```tsx
// BEFORE (inside JSX return):
{(() => {
  const dayOfWeek = new Date().getDay();
  return <DayIndicator day={dayOfWeek} />;
})()}

// AFTER (before return statement):
const dayOfWeek = new Date().getDay();
// In JSX:
<DayIndicator day={dayOfWeek} />
```

- [ ] Wrap `ListHeaderComponent` in `useMemo` to prevent re-render on unrelated state changes:
```tsx
import { useMemo } from 'react';

const listHeader = useMemo(() => (
  <View>
    {/* streak number, day row, milestone cards */}
  </View>
), [profile?.current_streak, profile?.id, milestones]);

// In FlatList:
<FlatList
  ListHeaderComponent={listHeader}
  ...
/>
```

- [ ] Same in `LeaderboardScreen.tsx` — extract any IIFE patterns

- [ ] Commit:
```bash
git add src/screens/HomeScreen.tsx src/screens/LeaderboardScreen.tsx
git commit -m "perf: extract IIFE blocks from JSX, memoize ListHeaderComponent"
```

---

## Phase 1C: Health Connect Track (parallel with 1A and 1B)

### Task 1C.1: Implement distance and calories reading

**Files:**
- Modify: `src/lib/healthConnect.ts`

- [ ] Read `src/lib/healthConnect.ts` fully, understand `pollHealthConnect` structure

- [ ] Ensure `Distance` and `ActiveCaloriesBurned` are in the record types list:
```ts
const HC_RECORD_TYPES = [
  'ExerciseSession',
  'Steps',
  'Distance',
  'ActiveCaloriesBurned',
] as const;
```

- [ ] In the session processing loop, fetch and sum distance/calories per session:
```ts
for (const session of sessions) {
  // Distance
  const { records: distRecs } = await getRecordsBetween(
    'Distance', session.startTime, session.endTime
  );
  const distanceKm = (distRecs as DistanceRecord[])
    .reduce((sum, r) => sum + (r.distance?.inMeters ?? 0), 0) / 1000;

  // Calories
  const { records: calRecs } = await getRecordsBetween(
    'ActiveCaloriesBurned', session.startTime, session.endTime
  );
  const calories = Math.round(
    (calRecs as ActiveCaloriesBurnedRecord[])
      .reduce((sum, r) => sum + (r.energy?.inKilocalories ?? 0), 0)
  );

  workoutData.push({
    ...existingSessionFields,
    distance_km: distanceKm > 0 ? distanceKm : null,
    calories: calories > 0 ? calories : null,
  });
}
```

- [ ] Import the needed types from react-native-health-connect if not already imported:
```ts
import type {
  ExerciseSessionRecord,
  DistanceRecord,
  ActiveCaloriesBurnedRecord,
  StepsRecord,
} from 'react-native-health-connect';
```

- [ ] Commit:
```bash
git add src/lib/healthConnect.ts
git commit -m "feat: read distance_km and calories from Health Connect, store in workout_posts"
```

---

### Task 1C.2: Multi-challenge attribution via DB trigger

**Files:**
- Create: `supabase/migrations/020_multi_challenge_workout_fan_out.sql`

- [ ] Create migration:
```sql
-- supabase/migrations/020_multi_challenge_workout_fan_out.sql
-- Fan-out auto-synced workouts to ALL active challenges the user is enrolled in.
-- Manual logs (external_activity_id IS NULL) are untouched.

CREATE OR REPLACE FUNCTION fan_out_workout_to_challenges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.external_activity_id IS NULL THEN
    RETURN NEW;  -- manual log — user already chose the challenge
  END IF;

  INSERT INTO workout_posts (
    user_id, challenge_id, activity_type, duration_minutes,
    distance_km, calories, steps, notes, photo_url,
    logged_at, source, external_activity_id, points_awarded
  )
  SELECT
    NEW.user_id,
    cp.challenge_id,
    NEW.activity_type, NEW.duration_minutes,
    NEW.distance_km, NEW.calories, NEW.steps,
    NEW.notes, NEW.photo_url,
    NEW.logged_at, NEW.source, NEW.external_activity_id,
    0  -- award_points_on_workout trigger sets the real value
  FROM challenge_participants cp
  JOIN fitness_challenges fc ON fc.id = cp.challenge_id
  WHERE cp.user_id = NEW.user_id
    AND cp.challenge_id != NEW.challenge_id
    AND fc.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM workout_posts wp2
      WHERE wp2.user_id = NEW.user_id
        AND wp2.challenge_id = cp.challenge_id
        AND wp2.external_activity_id = NEW.external_activity_id
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_sync_workout_fan_out
AFTER INSERT ON workout_posts
FOR EACH ROW
EXECUTE FUNCTION fan_out_workout_to_challenges();

COMMENT ON TRIGGER auto_sync_workout_fan_out ON workout_posts IS
  'Fans out auto-synced workouts to all active challenges. Manual logs unaffected.';
```

- [ ] Commit:
```bash
git add supabase/migrations/020_multi_challenge_workout_fan_out.sql
git commit -m "feat: DB trigger fans out auto-synced workouts to all active challenges"
```

---

### Task 1C.3: Add heart rate support

**Files:**
- Create: `supabase/migrations/021_heart_rate_columns.sql`
- Modify: `src/lib/healthConnect.ts`
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] Create migration:
```sql
-- supabase/migrations/021_heart_rate_columns.sql
ALTER TABLE workout_posts
  ADD COLUMN IF NOT EXISTS heart_rate_avg INTEGER,
  ADD COLUMN IF NOT EXISTS heart_rate_max INTEGER;

COMMENT ON COLUMN workout_posts.heart_rate_avg IS 'Average BPM during workout (Health Connect/HealthKit)';
COMMENT ON COLUMN workout_posts.heart_rate_max IS 'Maximum BPM during workout';
```

- [ ] Add HeartRate permission to AndroidManifest.xml alongside existing HC permissions:
```xml
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.health.connect.permission.READ_HEART_RATE" />
```

- [ ] In `healthConnect.ts`, add HeartRate to record types and processing:
```ts
// Add to HC_RECORD_TYPES:
'HeartRate',

// In session processing loop:
const { records: hrRecs } = await getRecordsBetween(
  'HeartRate', session.startTime, session.endTime
);
const bpmValues = (hrRecs as HeartRateRecord[])
  .flatMap(r => r.samples?.map(s => s.beatsPerMinute) ?? []);

const heartRateAvg = bpmValues.length > 0
  ? Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length)
  : null;
const heartRateMax = bpmValues.length > 0 ? Math.max(...bpmValues) : null;

// Add to workoutData push:
heart_rate_avg: heartRateAvg,
heart_rate_max: heartRateMax,
```

- [ ] Import `HeartRateRecord` type from react-native-health-connect

- [ ] Commit:
```bash
git add supabase/migrations/021_heart_rate_columns.sql src/lib/healthConnect.ts android/app/src/main/AndroidManifest.xml
git commit -m "feat: add heart rate (avg/max BPM) from Health Connect"
```

---

### Task 1C.4: Replace debug Alert with logger utility

**Files:**
- Create: `src/lib/logger.ts`
- Modify: `src/screens/ConnectDevicesScreen.tsx`

- [ ] Create logger:
```ts
// src/lib/logger.ts
export const logger = {
  debug: (msg: string, data?: unknown): void => {
    if (__DEV__) console.debug(`[DEBUG] ${msg}`, data ?? '');
  },
  warn: (msg: string, data?: unknown): void => {
    if (__DEV__) console.warn(`[WARN] ${msg}`, data ?? '');
  },
  error: (msg: string, data?: unknown): void => {
    console.error(`[ERROR] ${msg}`, data ?? '');
  },
};
```

- [ ] In `ConnectDevicesScreen.tsx` ~line 88, replace debug Alert:
```tsx
// BEFORE:
if (__DEV__) Alert.alert('HC Debug', getLastHCDebug());

// AFTER:
import { logger } from '../lib/logger';
logger.debug('Health Connect permission request failed', getLastHCDebug());
```

- [ ] Search for any other debug-only Alerts in the codebase:
```bash
grep -rn "__DEV__.*Alert\|Alert.*__DEV__" src/ --include="*.tsx" --include="*.ts"
```
Replace each with `logger.debug(...)` or `logger.warn(...)`

- [ ] Commit:
```bash
git add src/lib/logger.ts src/screens/ConnectDevicesScreen.tsx
git commit -m "fix: replace __DEV__ Alert with logger utility in ConnectDevicesScreen"
```

---

## Phase 2: Quality Layer (after all Phase 1 tracks complete)

### Task 2.1: Fix TypeScript navigation types (remove `as never`)

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/LeaderboardScreen.tsx`
- Modify: `src/screens/LogWorkoutScreen.tsx`
- Modify: `src/screens/ProfileScreen.tsx`

- [ ] In `RootNavigator.tsx`, export the param list:
```ts
export type RootStackParamList = {
  Home:           undefined;
  Log:            undefined;
  Leaderboard:    undefined;
  Profile:        undefined;
  ConnectDevices: undefined;
  // Add any other routes from your actual navigator
};
```

- [ ] Find all `navigate('X' as never)` usages:
```bash
grep -rn "as never" src/screens/ --include="*.tsx"
```

- [ ] For each screen, replace with typed navigation:
```tsx
// Add at top of each screen file:
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useNavigation } from '@react-navigation/native';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
const navigation = useNavigation<NavProp>();

// Now replace:
// navigation.navigate('ConnectDevices' as never)
// with:
navigation.navigate('ConnectDevices');  // type-safe, no cast needed
```

- [ ] TypeScript check — expect zero navigation errors:
```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

- [ ] Commit:
```bash
git add src/navigation/RootNavigator.tsx src/screens/
git commit -m "fix: typed navigation with RootStackParamList, remove all 'as never' casts"
```

---

### Task 2.2: Remove `any` casts from hooks

**Files:**
- Modify: `src/hooks/useWorkoutFeed.ts`
- Modify: `src/lib/db.ts` (if exists)

- [ ] Find all `any` casts:
```bash
grep -rn ": any\|as any\|(p: any)\|(data: any)" src/hooks/ src/lib/
```

- [ ] For each hit, import the correct type from `src/types/database.ts` and use it:
```ts
// BEFORE:
data.map((post: any) => post.id)

// AFTER:
import type { WorkoutPost } from '../types/database';
(data as WorkoutPost[]).map(post => post.id)
```

Common types to use from database.ts:
- `WorkoutPost` for workout_posts rows
- `FitnessChallenge` for fitness_challenges rows  
- `UserProfile` for profiles rows
- `LeagueMember` for league_members rows

- [ ] TypeScript check:
```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```
Expected: No remaining `any` in src/hooks/ or src/lib/

- [ ] Commit:
```bash
git add src/hooks/ src/lib/
git commit -m "fix: replace any casts in hooks with proper types from database.ts"
```

---

### Task 2.3: Split LeaderboardScreen into focused sub-components

**Files:**
- Modify: `src/screens/LeaderboardScreen.tsx`
- Create: `src/components/LeagueTab.tsx`
- Create: `src/components/RankingsTab.tsx`

- [ ] Read `LeaderboardScreen.tsx` fully (486 lines)

- [ ] Identify which JSX belongs to league view vs global rankings view

- [ ] Create `src/components/LeagueTab.tsx`:
```tsx
import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { C, F } from '../theme';
import type { LeagueMember } from '../types/database';

interface Props {
  members: LeagueMember[];
  currentUserId: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export const LeagueTab: React.FC<Props> = ({
  members, currentUserId, refreshing, onRefresh
}) => {
  const renderItem = ({ item, index }: { item: LeagueMember; index: number }) => (
    // Move league row JSX here from LeaderboardScreen
  );

  return (
    <FlatList
      data={members}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
};
```

- [ ] Create `src/components/RankingsTab.tsx` similarly for the global rankings FlatList

- [ ] Update `LeaderboardScreen.tsx` to import and use both components:
```tsx
import { LeagueTab } from '../components/LeagueTab';
import { RankingsTab } from '../components/RankingsTab';

// LeaderboardScreen becomes a thin coordinator:
return (
  <Screen>
    <SegTabs tabs={['League', 'Rankings']} value={tab} onChange={setTab} />
    {tab === 'League'
      ? <LeagueTab members={leagueMembers} currentUserId={userId} ... />
      : <RankingsTab entries={rankings} currentUserId={userId} ... />
    }
  </Screen>
);
```

- [ ] Verify screen is now under 200 lines:
```bash
wc -l src/screens/LeaderboardScreen.tsx
```

- [ ] TypeScript check:
```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

- [ ] Commit:
```bash
git add src/screens/LeaderboardScreen.tsx src/components/LeagueTab.tsx src/components/RankingsTab.tsx
git commit -m "refactor: split LeaderboardScreen into LeagueTab + RankingsTab components (<200 lines each)"
```

---

### Task 2.4: Add Jest test setup

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `src/__tests__/setup.ts`

- [ ] Install test dependencies:
```bash
npx expo install jest-expo @testing-library/react-native @testing-library/jest-native
npm install --save-dev @types/jest
```

- [ ] Create `jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|react-native-purchases)',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};
```

- [ ] Add test script to `package.json`:
```json
"scripts": {
  "test": "jest --passWithNoTests",
  "test:watch": "jest --watch"
}
```

- [ ] Verify Jest works:
```bash
npm test
```
Expected: "Test Suites: 0 skipped, 0 passed" (no tests yet, passWithNoTests prevents failure)

- [ ] Commit:
```bash
git add jest.config.js package.json
git commit -m "test: add Jest + jest-expo + testing-library test infrastructure"
```

---

### Task 2.5: Write tests for critical hooks

**Files:**
- Create: `src/__tests__/streakDecay.test.ts`
- Create: `src/__tests__/workoutFanOut.test.ts`

- [ ] Create `src/__tests__/streakDecay.test.ts`:
```ts
// Tests for streak decay freeze protection logic

const mockUpdate = jest.fn().mockResolvedValue({ error: null });
const mockSingle = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn(() => ({ eq: mockUpdate })),
      eq: jest.fn(() => ({ single: mockSingle })),
    })),
  },
}));

describe('streak decay freeze protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set today to a fixed date
    jest.useFakeTimers().setSystemTime(new Date('2026-06-04'));
  });

  afterEach(() => jest.useRealTimers());

  it('consumes a freeze when available instead of resetting streak', async () => {
    mockSingle.mockResolvedValue({
      data: {
        current_streak: 15,
        last_active_date: '2026-06-01', // 3 days ago
        streak_freeze_uses: 2,
        freeze_used_today: false,
      },
      error: null,
    });

    const { applyStreakDecay } = require('../hooks/useStreaks');
    await applyStreakDecay('user-123');

    // Should decrement freeze, not reset streak
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        streak_freeze_uses: 1,
        freeze_used_today: true,
      })
    );
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ current_streak: 0 })
    );
  });

  it('resets streak when no freezes remain', async () => {
    mockSingle.mockResolvedValue({
      data: {
        current_streak: 7,
        last_active_date: '2026-06-01',
        streak_freeze_uses: 0,
        freeze_used_today: false,
      },
      error: null,
    });

    const { applyStreakDecay } = require('../hooks/useStreaks');
    await applyStreakDecay('user-123');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ current_streak: 0 })
    );
  });

  it('does nothing when user was active yesterday', async () => {
    mockSingle.mockResolvedValue({
      data: {
        current_streak: 5,
        last_active_date: '2026-06-03', // yesterday
        streak_freeze_uses: 0,
        freeze_used_today: false,
      },
      error: null,
    });

    const { applyStreakDecay } = require('../hooks/useStreaks');
    await applyStreakDecay('user-123');

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

Note: For these tests to work, `applyStreakDecay` must be exported from `useStreaks.ts`. If it's an internal function, export it: `export const applyStreakDecay = async (...) => {...}`

- [ ] Run tests:
```bash
npm test src/__tests__/streakDecay.test.ts
```
Expected: 3 tests pass

- [ ] Commit:
```bash
git add src/__tests__/
git commit -m "test: streak decay freeze protection unit tests (3 cases)"
```

---

## Completion Checklist

After all tasks complete, run this full verification:

```bash
# 1. TypeScript — zero errors
npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -c "error" || echo "✅ No TS errors"

# 2. All tests pass
npm test 2>&1 | tail -5

# 3. No remaining any-casts in production hooks
grep -rn ": any\|as any" src/hooks/ src/lib/ | grep -v ".test." || echo "✅ No any casts"

# 4. No hardcoded credentials
grep -rn "streakwar1\|arnar@streakwar" --include="*.ts" --include="*.tsx" src/ || echo "✅ No hardcoded creds"

# 5. No emoji in navigation
grep -rn "🏠\|💪\|🏆\|👤" src/ || echo "✅ No emoji in nav"

# 6. Package.json has all deps
node -e "const p=require('./package.json'); console.log('deps:', Object.keys(p.dependencies).length)"

# 7. Theme imports (no local C definitions in screens)
grep -rn "^const C = {" src/screens/ || echo "✅ All screens use theme.ts"
```

Expected: All checks pass with ✅

---

## Summary of Changes by Review Dimension

| Dimension | Before | After | Key Changes |
|-----------|--------|-------|-------------|
| Architecture | 8.0 | 10.0 | Single auth subscription, streak-freeze fix, batched league reset, realtime feed, encrypted OAuth tokens |
| Health Connect | 7.5 | 10.0 | Distance/calories implemented, heart rate added, multi-challenge fan-out, logger replaces Alert |
| UI/Design | 7.4 | 10.0 | Inter font loaded, SVG tab icons, shimmer Skel, a11y fixes |
| Code Quality | 6.5 | 10.0 | package.json fixed, theme.ts, no any-casts, typed nav, tests, split components, no hardcoded creds |
