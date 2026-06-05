# StreakWar 10/10 — Phase 3+4+5+6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix all audit findings from 4-agent review to bring app from 6.75/10 to 10/10.

**Architecture:** Systematic fixes across security, UI/design tokens, UX/accessibility, and code quality.

**Tech Stack:** React Native / Expo 51, TypeScript, Supabase, react-native-safe-area-context

---

## Phase 3 — Critical Fixes (Launch Blockers)

### Task 3.1: Fix RootNavigator duplicate type declarations ✅ DONE

Already fixed — removed lines 45-63 (duplicate `RootStackParamList` + `MainTabParamList`).

### Task 3.2: Fix `use_streak_freeze` IDOR security vulnerability

**Files:**
- Modify: `supabase/migrations/022_fix_streak_freeze_idor.sql` (create new)

The `use_streak_freeze` RPC in `013_pro_features.sql` accepts `p_user_id` as a parameter and calls `security definer`, but never verifies `auth.uid() = p_user_id`. Any authenticated user can burn another user's freeze credits by passing their UUID.

- [ ] **Step 1: Create migration to patch the RPC**

```sql
-- supabase/migrations/022_fix_streak_freeze_idor.sql
-- Fix: use_streak_freeze must verify caller owns the account

CREATE OR REPLACE FUNCTION use_streak_freeze(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits integer;
BEGIN
  -- SECURITY: verify the caller is the user being acted on
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT streak_freeze_credits INTO v_credits
  FROM profiles
  WHERE id = p_user_id AND is_pro = true;

  IF v_credits IS NULL OR v_credits <= 0 THEN
    RETURN false;
  END IF;

  -- Deduct the credit
  UPDATE profiles
  SET streak_freeze_credits = streak_freeze_credits - 1
  WHERE id = p_user_id;

  -- Record usage
  INSERT INTO streak_freeze_uses (user_id, freeze_date)
  VALUES (p_user_id, current_date)
  ON CONFLICT (user_id, freeze_date) DO NOTHING;

  RETURN true;
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/022_fix_streak_freeze_idor.sql
git commit -m "fix(security): add auth.uid() check to use_streak_freeze RPC to prevent IDOR"
```

### Task 3.3: Fix ChallengeDetailScreen infinite spinner

**Files:**
- Modify: `src/screens/ChallengeDetailScreen.tsx`

When `loadChallenge` receives a Supabase error, `challenge` stays `null` and `loading` goes to `false` — but the screen shows a spinner indefinitely because the condition is `!challenge`. Need an `error` state with a "Go back" button.

- [ ] **Step 1: Read the file**

Read `src/screens/ChallengeDetailScreen.tsx` lines 1-60 to understand the loading/error pattern.

- [ ] **Step 2: Add error state**

Add `const [loadError, setLoadError] = useState(false);` to state declarations.

In `loadChallenge`, after the Supabase call:
```ts
const { data, error } = await supabase.from('fitness_challenges')...
if (error || !data) { setLoadError(true); setLoading(false); return; }
setChallenge(data);
setLoading(false);
```

- [ ] **Step 3: Add error UI**

Before the `!challenge` loading check, add:
```tsx
if (loadError) return (
  <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <Text style={{ color: C.muted, fontSize: 16 }}>Could not load challenge.</Text>
    <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
      <Text style={{ color: '#000', fontWeight: '700' }}>Go back</Text>
    </TouchableOpacity>
  </SafeAreaView>
);
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/ChallengeDetailScreen.tsx
git commit -m "fix: add error state to ChallengeDetailScreen — prevents infinite spinner on load failure"
```

### Task 3.4: Fix useWorkoutFeed silent failures

**Files:**
- Modify: `src/hooks/useWorkoutFeed.ts`

Two issues:
1. `fetchFeed` catch block only `console.warn` — HomeScreen shows "empty feed" instead of error
2. `toggleReaction` optimistic update has no rollback on DB failure

- [ ] **Step 1: Read the hook**

Read `src/hooks/useWorkoutFeed.ts` lines 70-160.

- [ ] **Step 2: Add error state to hook**

Add `const [feedError, setFeedError] = useState<string | null>(null);` to the hook's state.

In `fetchFeed` catch block:
```ts
catch (e) {
  setFeedError('Could not load feed. Pull to refresh.');
  setLoading(false);
}
```

Clear error on successful fetch: `setFeedError(null);` before `setFeed(mapped)`.

In `toggleReaction`:
```ts
// save previous state for rollback
const prevFeed = feed;
// optimistic update ...
const { error } = await supabase.rpc(...);
if (error) {
  setFeed(prevFeed); // rollback
}
```

- [ ] **Step 3: Return feedError from hook and use in HomeScreen**

Return `feedError` from `useWorkoutFeed`. In `HomeScreen`, show error in `ListEmptyComponent` when `feedError` is set.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWorkoutFeed.ts src/screens/HomeScreen.tsx
git commit -m "fix: surface feed fetch errors to user + rollback optimistic reaction on DB failure"
```

---

## Phase 4 — UI/Design Polish

### Task 4.1: WorkoutPostCard + ErrorBoundary — use C.* theme tokens

**Files:**
- Modify: `src/components/WorkoutPostCard.tsx`
- Modify: `src/components/ErrorBoundary.tsx` (if exists)

`WorkoutPostCard` defines its own local `C` object (lines 11-19) instead of importing from `src/theme`. Replace with `import { C } from '../theme';` and remove local object.

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Replace local C in WorkoutPostCard with theme import**

Remove lines 11-19 (local C declaration). Add `import { C } from '../theme';` to imports. Replace each hardcoded hex with the matching `C.*` token:
- `#0C1117` → `C.bg`
- `#151C24` → `C.card`
- `#637C8F` → `C.muted`
- `#F97316` → `C.primary`
- `#FBBF24` → `C.gold`

- [ ] **Step 3: Fix ErrorBoundary — add theme import, replace hardcoded values**
- [ ] **Step 4: Commit**

```bash
git add src/components/WorkoutPostCard.tsx src/components/ErrorBoundary.tsx
git commit -m "fix(ui): replace local C objects with shared theme tokens in WorkoutPostCard + ErrorBoundary"
```

### Task 4.2: RootNavigator tab bar — use C.* tokens

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

Lines 116-126: hardcoded `'#0C1117'`, `'#F97316'`, `'#4A6070'`. Replace with `C.bg`, `C.primary`, `C.muted`. Also fix loading splash at line 143.

- [ ] **Step 1: Add theme import to RootNavigator**
- [ ] **Step 2: Replace all hardcoded colors with C.* tokens**
- [ ] **Step 3: Commit**

### Task 4.3: Fix tap targets below 44pt

**Files:**
- Modify: `src/screens/HomeScreen.tsx` — `streakShareBtn`
- Modify: `src/screens/LeaderboardScreen.tsx` — `shareBtn`  
- Modify: `src/screens/ChallengeDetailScreen.tsx` — `backBtn`
- Modify: `src/screens/ConnectDevicesScreen.tsx` — `syncNowBtn`

Add `minHeight: 44` to each affected style.

- [ ] **Step 1: Read each file's StyleSheet**
- [ ] **Step 2: Add minHeight: 44 to each button style**
- [ ] **Step 3: Commit**

### Task 4.4: Apply fontFamily tokens across all screens

**Files:**
- Modify all screens that use `fontWeight: '800'` or `fontWeight: '700'` without `fontFamily`

Read `src/theme.ts` to find the `F.*` font family tokens. Then systematically apply `fontFamily: F.bold` to headings and `fontFamily: F.reg` to body text across all screens that currently only use `fontWeight`.

---

## Phase 5 — UX + Accessibility

### Task 5.1: Fix Onboarding "Skip" destination

**Files:**
- Modify: `src/screens/auth/OnboardingScreen.tsx`

The "Skip" button navigates to `Login` instead of `Signup`. New users who skip onboarding should land on Signup.

- [ ] **Step 1: Read file, find navigation.navigate('Login') in Skip handler**
- [ ] **Step 2: Change to navigation.navigate('Signup')**
- [ ] **Step 3: Commit**

### Task 5.2: ProfileScreen — replace "coming soon" alerts

**Files:**
- Modify: `src/screens/ProfileScreen.tsx` lines 249, 270

The "Edit profile" and "Edit photo" buttons show `Alert.alert('coming soon')`. Either remove the buttons entirely or implement basic edit functionality (display name + avatar initial).

Simplest fix: hide both buttons until feature is implemented (remove from JSX).

### Task 5.3: Add accessibilityLabel to all interactive elements

**Files:**
- Modify: `src/screens/HomeScreen.tsx`, `ChallengesScreen.tsx`, `ChallengeDetailScreen.tsx`
- Modify: `src/components/ChallengeCard.tsx`, `WorkoutPostCard.tsx`
- Modify: `src/navigation/RootNavigator.tsx` — add `tabBarAccessibilityLabel` to each Tab.Screen

Add `accessibilityLabel` and `accessibilityRole` to every `TouchableOpacity` and `Switch`.

### Task 5.4: Fix ActivityHeatmap fake data

**Files:**
- Modify: `src/screens/ProfileScreen.tsx` lines 71-76

Replace random-seeded fake data with an empty skeleton (uniform grey squares) while `heatmapData` is loading.

---

## Phase 6 — Code Quality

### Task 6.1: getInitials() shared utility

**Files:**
- Create: `src/lib/utils.ts`
- Modify: `src/screens/HomeScreen.tsx`, `LeaderboardScreen.tsx`, `ProfileScreen.tsx`, `ChallengeDetailScreen.tsx`
- Modify: `src/components/LeagueTab.tsx`, `RankingsTab.tsx`

Extract the repeated pattern into:
```ts
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0] ?? '').filter(Boolean).join('').slice(0, 2).toUpperCase();
}
```

### Task 6.2: Fix useNavigation<any>() in 6 screens

**Files:**
- Modify: `src/screens/ChallengesScreen.tsx`, `ProfileScreen.tsx`, `DiscoverScreen.tsx`
- Modify: `src/screens/ChallengeDetailScreen.tsx`, `LogWorkoutScreen.tsx`, `CreateChallengeScreen.tsx`

Each screen needs a typed nav prop like HomeScreen's `HomeNavProp`:
```ts
type ChallengesNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Challenges'>,
  NativeStackNavigationProp<RootStackParamList>
>;
```

### Task 6.3: Fix LeaderboardScreen useEffect dep array

**Files:**
- Modify: `src/screens/LeaderboardScreen.tsx` line 41

```ts
// Before
useEffect(() => { fetchWeekly(); fetchGlobal(); fetchFriends(); }, []);

// After  
useEffect(() => { fetchWeekly(); fetchGlobal(); fetchFriends(); }, [fetchWeekly, fetchGlobal, fetchFriends]);
```

### Task 6.4: fetchMilestones — parallel queries with Promise.all

**Files:**
- Modify: `src/screens/HomeScreen.tsx` lines 66-113

Replace 4 sequential awaits with Promise.all for the two independent queries (`streak_milestones` + `milestone_reactions`).

### Task 6.5: handleShare → useCallback in HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx` lines 115-122

Wrap `handleShare` in `useCallback` with proper dependencies so `listHeader`'s `useMemo` actually caches.

### Task 6.6: Remove console.log health data

**Files:**
- Modify: `src/lib/healthConnect.ts` lines 147, 150, 157
- Modify: `src/hooks/useHealthSync.ts` lines 105, 107

Remove or replace with `__DEV__ && console.log(...)` guards.

### Task 6.7: EmptyState shared component

**Files:**
- Create: `src/components/EmptyState.tsx`

```tsx
interface Props { emoji: string; title: string; subtitle?: string; ctaLabel?: string; onCta?: () => void; }
export function EmptyState({ emoji, title, subtitle, ctaLabel, onCta }: Props) { ... }
```

Replace the 5 duplicated empty-state blocks across screens.

### Task 6.8: ProBadge shared component

**Files:**
- Create: `src/components/ProBadge.tsx`
- Modify: `src/screens/CreateChallengeScreen.tsx` — replace 3 copy-pasted PRO badge blocks

---

## Checklist after all tasks

- [ ] `npm test` — all tests pass
- [ ] No TypeScript errors
- [ ] `grep -r "as any" src/` returns only the necessary RN FormData cast
- [ ] `grep -r "useNavigation<any>" src/` returns empty
- [ ] All screens use `C.*` tokens (no raw hex in StyleSheet)
- [ ] `grep -r "console.log\|console.warn" src/lib/healthConnect` returns empty
