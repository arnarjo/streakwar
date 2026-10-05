import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { usePrivateActivitySummary } from '../hooks/usePrivateActivitySummary';
import { C } from '../theme';

export const PRIVATE_ACTIVITY_TITLE = 'Private Health Connect activity';
export const PRIVATE_ACTIVITY_NOTICE = 'Only you can see this. Not included in challenges, leaderboards or streaks yet.';
export const PRIVATE_ACTIVITY_REFRESH_LABEL = 'Refresh private Health Connect activity';
export const PRIVATE_ACTIVITY_RETRY_LABEL = 'Retry loading private Health Connect activity';

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
            style={s.button}
            onPress={refresh}
            accessibilityRole="button"
            accessibilityLabel={PRIVATE_ACTIVITY_RETRY_LABEL}
          >
            <Text style={s.buttonText}>Retry</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'ready' && summary && summary.activityCount === 0 && (
        <Text style={s.muted}>Nothing imported yet. Connect Health Connect to see your private activity here.</Text>
      )}

      {status === 'ready' && summary && summary.activityCount > 0 && (
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.value}>{fmt(summary.personalPoints)}</Text>
            <Text style={s.label}>Personal points</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.value}>{fmt(summary.activityCount)}</Text>
            <Text style={s.label}>Imported records</Text>
          </View>
        </View>
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
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 8, marginBottom: 16 },
  title: { fontSize: 13, fontWeight: '800', color: C.text },
  notice: { fontSize: 12, color: C.silver, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: C.dimmed, borderRadius: 10, padding: 10, gap: 2 },
  value: { fontSize: 20, fontWeight: '800', color: C.text },
  label: { fontSize: 12, color: C.silver },
  muted: { fontSize: 12, color: C.silver, lineHeight: 17 },
  error: { fontSize: 12, color: C.error, lineHeight: 17 },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 12, fontWeight: '700', color: C.primary },
});
