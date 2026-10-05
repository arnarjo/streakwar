import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { usePrivateActivitySummary } from '../hooks/usePrivateActivitySummary';
import { C, HIT, R } from '../theme';

export const PRIVATE_ACTIVITY_TITLE = 'Private Health Connect activity';
export const PRIVATE_ACTIVITY_NOTICE = 'Only you can see this. Not included in challenges, leaderboards or streaks yet.';
export const PRIVATE_ACTIVITY_REFRESH_LABEL = 'Refresh private Health Connect activity';
export const PRIVATE_ACTIVITY_RETRY_LABEL = 'Retry loading private Health Connect activity';
export const PRIVATE_ACTIVITY_SCOPE = 'Totals cover everything imported from Health Connect so far, not just today or this week. Records include daily step snapshots.';

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Owner-only summary of privately imported Health Connect data. Display only:
 * it never navigates, shares, or feeds public profile/feed/leaderboard data.
 * The record count includes daily Steps snapshots, so it is not "workouts".
 */
export default function PrivateActivitySummaryCard({
  userId,
  refreshToken,
}: {
  userId: string;
  refreshToken?: string | number | boolean;
}) {
  const { status, summary, refreshing, refresh } = usePrivateActivitySummary(userId, refreshToken);
  if (status === 'idle') return null;

  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>Private</Text>
      <Text style={s.title}>{PRIVATE_ACTIVITY_TITLE}</Text>
      <Text style={s.notice}>{PRIVATE_ACTIVITY_NOTICE}</Text>

      {status === 'loading' && (
        <View style={s.row}>
          <ActivityIndicator size="small" color={C.primary} />
          <Text style={s.muted}>Loading private activity…</Text>
        </View>
      )}

      {status === 'error' && (
        <>
          <Text style={s.error}>Could not load your private activity.</Text>
          <TouchableOpacity
            style={[s.button, s.buttonPrimary]}
            onPress={refresh}
            accessibilityRole="button"
            accessibilityLabel={PRIVATE_ACTIVITY_RETRY_LABEL}
          >
            <Text style={s.buttonPrimaryText}>Retry</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'ready' && summary && summary.activityCount === 0 && (
        <Text style={s.muted}>Nothing imported yet. Connect Health Connect to see your private activity here.</Text>
      )}

      {status === 'ready' && summary && summary.activityCount > 0 && (
        <>
          <View style={s.hero}>
            <Text style={s.points} accessibilityLabel={`${fmt(summary.personalPoints)} personal points`}>
              {fmt(summary.personalPoints)}
            </Text>
            <Text style={s.pointsLabel}>Personal points</Text>
          </View>
          <View style={s.secondary}>
            <Text style={s.secondaryValue}>{fmt(summary.activityCount)}</Text>
            <Text style={s.secondaryLabel}>Imported records</Text>
          </View>
          <Text style={s.scope}>{PRIVATE_ACTIVITY_SCOPE}</Text>
        </>
      )}

      {status === 'ready' && summary && (
        <TouchableOpacity
          style={[s.button, refreshing && s.buttonDisabled]}
          onPress={refresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel={PRIVATE_ACTIVITY_REFRESH_LABEL}
          accessibilityState={{ disabled: refreshing, busy: refreshing }}
        >
          <Text style={s.buttonText}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 16, gap: 8, marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '700', color: C.text },
  notice: { fontSize: 12, color: C.muted, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { marginTop: 8, gap: 2 },
  points: { fontSize: 44, fontWeight: '800', color: C.text, letterSpacing: -1, lineHeight: 48 },
  pointsLabel: { fontSize: 13, fontWeight: '600', color: C.muted },
  secondary: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  secondaryValue: { fontSize: 18, fontWeight: '700', color: C.text },
  secondaryLabel: { fontSize: 13, color: C.muted },
  scope: { fontSize: 12, color: C.muted, lineHeight: 17 },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18, flexShrink: 1 },
  error: { fontSize: 13, color: C.error, lineHeight: 18 },
  button: { alignSelf: 'flex-start', minHeight: HIT, justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 16, marginTop: 4 },
  buttonPrimary: { backgroundColor: C.primary, borderColor: C.primary },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 13, fontWeight: '700', color: C.text },
  buttonPrimaryText: { fontSize: 13, fontWeight: '800', color: C.onPrimary },
});
