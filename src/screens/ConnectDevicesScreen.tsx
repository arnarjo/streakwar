import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Platform, AppState, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../hooks/useAuth';
import { useHealthSync, PROVIDER_META } from '../hooks/useHealthSync';
import type { ProviderKey } from '../hooks/useHealthSync';
import { openHealthConnectPermissions, getLastHCDebug } from '../lib/healthConnect';
import { formatDistanceToNow } from 'date-fns';
import {
  formatSyncSuccess, formatSyncError, STALE_SYNC_ALERT, STALE_SYNC_ROW, LAST_FULL_SYNC_LABEL,
} from '../lib/healthSyncFeedback';

import { C } from '../theme';
import PrivateActivitySummaryCard from '../components/PrivateActivitySummaryCard';
import type { RootStackNavigationProp } from '../navigation/types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const OAUTH_PROVIDERS: ProviderKey[] = ['strava'];
const COMING_SOON_PROVIDERS: ProviderKey[] = [];


export default function ConnectDevicesScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<RootStackNavigationProp>();
  const {
    connections, syncing, isConnected, connectNative,
    confirmHealthConnectConnection, syncNow, disconnect,
    nativeProvider, showBatteryWarning, backgroundSyncUnavailable, backgroundAccess,
    enableBackgroundSync, permissionNotice, refresh: fetchConnections
  } = useHealthSync(profile?.id ?? '');

  const [connecting, setConnecting] = useState<ProviderKey | null>(null);
  // Account generation for manual-sync Alerts: bumped synchronously (layout
  // effect) on account change and on unmount, so a result that resolves after
  // A -> B, A -> B -> A or unmount is never shown. Captured per invocation.
  const syncGeneration = useRef(0);
  useLayoutEffect(() => {
    syncGeneration.current += 1;
    return () => { syncGeneration.current += 1; };
  }, [profile?.id]);

  const awaitingHCReturn = useRef(false);
  const mounted = useRef(true);

  const nativeMeta = PROVIDER_META[nativeProvider];

  useEffect(() => {
    return () => {
      mounted.current = false;
      awaitingHCReturn.current = false;
    };
  }, []);

  // When user returns from Health Connect settings, re-check if permissions were granted
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      console.log('[ConnectDevices] AppState changed to:', state, 'Awaiting HC:', awaitingHCReturn.current);
      if (state === 'active' && awaitingHCReturn.current) {
        awaitingHCReturn.current = false;
        try {
          const confirmed = await confirmHealthConnectConnection();
          if (!mounted.current) return;
          if (confirmed) {
            Alert.alert('Connected!', 'Health Connect permissions granted. Check the last full sync time, or tap Sync now to retry.');
          } else {
            Alert.alert('Not connected', 'Permissions were not granted in Health Connect.');
          }
        } catch {
          if (mounted.current) Alert.alert('Connection check failed', 'Please try connecting again.');
        } finally {
          if (mounted.current) setConnecting(null);
        }
      }
    });
    return () => sub.remove();
  }, [confirmHealthConnectConnection]);



  async function handleNativeConnect() {
    setConnecting(nativeProvider);
    try {
      if (Platform.OS === 'android') {
        // Try requestPermission first (works when installed via Play Store)
        const { success, message } = await connectNative();
        if (success) {
          setConnecting(null);
          Alert.alert('Connected!', message);
          return;
        }
        // Show debug info so we can diagnose why requestPermission() failed
        if (__DEV__) Alert.alert('HC Debug (temp)', getLastHCDebug() || 'no debug info');

        // Permissions not granted via dialog — open HC permissions page directly.
        // AppState listener will detect when user returns and check if granted.
        awaitingHCReturn.current = true;
        const opened = await openHealthConnectPermissions();
        if (!opened) {
          awaitingHCReturn.current = false;
          setConnecting(null);
          Alert.alert('Could not open Health Connect', 'Please open Health Connect manually and grant permissions to StreakWar.');
        }
        // Keep connecting spinner active while user is in HC — cleared by AppState listener
        return;
      }

      const { success, message } = await connectNative();
      setConnecting(null);
      Alert.alert(success ? 'Connected!' : 'Could not connect', message);
    } catch {
      setConnecting(null);
      Alert.alert('Could not connect', 'Please check your connection and try again.');
    }
  }

  async function handleOAuthConnect(provider: ProviderKey) {
    if (!profile?.id) return;
    setConnecting(provider);
    const url = `${SUPABASE_URL}/functions/v1/oauth-init?provider=${provider}&user_id=${profile.id}`;
    try {
      // openAuthSessionAsync closes the custom tab when it detects the streakwar:// redirect
      const result = await WebBrowser.openAuthSessionAsync(url, 'streakwar://');
      if (result.type === 'success' && result.url?.includes('oauth-success')) {
        const parsedProvider = new URL(result.url).searchParams.get('provider') as ProviderKey | null;
        await fetchConnections();
        Alert.alert('Connected!', `${parsedProvider ? PROVIDER_META[parsedProvider]?.label : 'Provider'} connected successfully.`);
      } else if (result.type === 'success' && result.url?.includes('oauth-error')) {
        Alert.alert('Connection failed', 'Could not connect. Please try again.');
      }
      // cancel/dismiss = user closed browser — no error to show
    } catch {
      Alert.alert('Connection failed', 'Could not open browser. Please try again.');
    }
    setConnecting(null);
  }

  async function handleDisconnect(provider: ProviderKey) {
    Alert.alert(
      `Disconnect ${PROVIDER_META[provider].label}`,
      'Future workouts will no longer be synced automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: async () => {
          try {
            await disconnect(provider);
          } catch {
            Alert.alert('Disconnect failed', 'Please check your connection and try again.');
          }
        } },
      ]
    );
  }

  async function handleSyncNow() {
    const generation = syncGeneration.current;
    try {
      const count = await syncNow();
      if (generation !== syncGeneration.current) return;
      const feedback = formatSyncSuccess(count);
      Alert.alert(feedback.title, feedback.message);
    } catch (error) {
      if (generation !== syncGeneration.current) return;
      const feedback = formatSyncError(error);
      Alert.alert(feedback.title, feedback.message);
    }
  }

  const connectedCount = connections.filter(c => c.is_active).length;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Connect Devices</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Explainer */}
        <View style={s.explainer}>
          <Text style={s.explainerEmoji}>⚡</Text>
          <Text style={s.explainerTitle}>Auto-sync your workouts</Text>
          <Text style={s.explainerText}>
            Connect your health apps and devices to import workouts. On supported Android devices, you can allow background reads. Android controls when background sync runs; you can also use Sync now.
          </Text>
        </View>

        {/* Status */}
        {Platform.OS === 'android' && (
          <PrivateActivitySummaryCard userId={profile?.id ?? ''} refreshToken={syncing} />
        )}
        {permissionNotice && (
          <View style={s.warningRow} accessibilityRole="alert">
            <Text style={s.warningSub}>{permissionNotice}</Text>
          </View>
        )}
        {Platform.OS === 'android' && isConnected('health_connect') && (
          <View style={s.warningRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.warningTitle}>Health Connect background access</Text>
              <Text style={s.warningSub}>{
                backgroundAccess === 'checking' ? 'Checking this device…' :
                backgroundAccess === 'granted' ? 'Background read permission is enabled. Delivery is not yet verified; Android controls timing.' :
                backgroundAccess === 'unsupported' ? 'Background reads are not supported by Health Connect on this device. Use Sync now while the app is open.' :
                backgroundAccess === 'unavailable' ? 'Background support cannot be checked in this build or Health Connect is unavailable. Use a supported native build and Sync now.' :
                backgroundAccess === 'foreground_permission_required' ? 'Enable workout read access in Health Connect first. Background access is separate.' :
                backgroundAccess === 'error' ? 'Could not check background access. Retry or use Sync now while the app is open.' :
                'Optional: allow workout and step imports while StreakWar is in the background. Sync now remains available if you decline.'
              }</Text>
              {['permission_required', 'granted', 'error'].includes(backgroundAccess) && (
                <TouchableOpacity accessibilityRole="button" disabled={syncing}
                  style={s.syncNowBtn} onPress={async () => {
                    try { await enableBackgroundSync(); }
                    catch { if (mounted.current) Alert.alert('Background setup failed', 'Please retry. Manual sync is still available.'); }
                  }}>
                  <Text style={s.syncNowText}>{syncing ? 'Please wait…' : backgroundAccess === 'permission_required' ? 'Enable background sync' : 'Retry background setup'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {backgroundSyncUnavailable && (Platform.OS !== 'android' || backgroundAccess === 'granted') && (
          <View style={s.warningRow} accessibilityRole="alert">
            <Text style={s.warningEmoji}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.warningTitle}>Background sync could not be enabled</Text>
              <Text style={s.warningSub}>Use Sync now while the app is open. Check system background restrictions, then reconnect to retry.</Text>
            </View>
          </View>
        )}
        {showBatteryWarning && (
          <TouchableOpacity
            style={s.warningRow}
            onPress={() => {
              Alert.alert(
                STALE_SYNC_ALERT.title,
                STALE_SYNC_ALERT.message,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() }
                ]
              );
            }}
          >
            <Text style={s.warningEmoji}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.warningTitle}>{STALE_SYNC_ROW.title}</Text>
              <Text style={s.warningSub}>{STALE_SYNC_ROW.subtitle}</Text>
            </View>
          </TouchableOpacity>
        )}

        {connectedCount > 0 && (
          <View style={s.statusRow}>
            <View style={s.statusDot} />
            <Text style={s.statusText}>{connectedCount} source{connectedCount !== 1 ? 's' : ''} connected</Text>
            <TouchableOpacity onPress={handleSyncNow} disabled={syncing} style={s.syncNowBtn}>
              {syncing
                ? <ActivityIndicator color={C.primary} size="small" />
                : <Text style={s.syncNowText}>Sync now</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Native health platform */}
        <Text style={s.sectionLabel}>
          {Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE'} HEALTH
        </Text>
        <ProviderRow
          icon={nativeMeta.icon}
          label={nativeMeta.label}
          description={
            Platform.OS === 'ios'
              ? 'Syncs workouts from Apple Watch, iPhone, and any app that writes to Health.'
              : 'Syncs workouts from Wear OS, Samsung, and any app that writes to Health Connect.'
          }
          connected={isConnected(nativeProvider)}
          loading={connecting === nativeProvider}
          onConnect={handleNativeConnect}
          onDisconnect={() => handleDisconnect(nativeProvider)}
          lastSynced={connections.find(c => c.provider === nativeProvider)?.last_synced_at ?? null}
          lastSyncedLabel={Platform.OS === 'android' ? LAST_FULL_SYNC_LABEL : undefined}
        />

        {/* OAuth providers */}
        <Text style={s.sectionLabel}>THIRD-PARTY APPS</Text>
        {([...OAUTH_PROVIDERS, ...COMING_SOON_PROVIDERS] as ProviderKey[]).map(provider => {
          const meta = PROVIDER_META[provider];
          const conn = connections.find(c => c.provider === provider);
          const comingSoon = COMING_SOON_PROVIDERS.includes(provider);
          return (
            <ProviderRow
              key={provider}
              icon={meta.icon}
              label={meta.label}
              description="Every Strava activity is pushed to StreakWar via webhook within 60 seconds of completion."
              connected={isConnected(provider)}
              loading={connecting === provider}
              comingSoon={comingSoon}
              onConnect={() => handleOAuthConnect(provider)}
              onDisconnect={() => handleDisconnect(provider)}
              lastSynced={conn?.last_synced_at ?? null}
            />
          );
        })}

        {/* Samsung Health (Android only) */}
        {Platform.OS === 'android' && (
          <>
            <ProviderRow
              icon={PROVIDER_META.samsung_health.icon}
              label="Samsung Health"
              description="Syncs via Health Connect if you have the Samsung Health–Health Connect bridge enabled."
              connected={isConnected('samsung_health')}
              loading={connecting === 'samsung_health'}
              onConnect={() => {
                Alert.alert(
                  'Samsung Health',
                  'Enable the "Samsung Health → Health Connect" bridge in your Samsung Health settings, then connect Health Connect above.',
                  [{ text: 'OK' }]
                );
              }}
              onDisconnect={() => handleDisconnect('samsung_health')}
              lastSynced={null}
            />
          </>
        )}

        <View style={s.footnote}>
          <Text style={s.footnoteText}>
            Background sync runs every 15 minutes. On iOS, Apple Watch workouts are pushed instantly via HealthKit observers. Strava and Fitbit workouts arrive within 60 seconds via server-side webhooks.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderRow({
  icon, label, description, connected, loading, comingSoon,
  onConnect, onDisconnect, lastSynced, lastSyncedLabel = 'Last synced',
}: {
  icon: string;
  label: string;
  description: string;
  connected: boolean;
  loading: boolean;
  comingSoon?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  lastSynced: string | null;
  /** Wording is per provider: only Android native health records a full-sync time. */
  lastSyncedLabel?: string;
}) {
  const timeAgo = lastSynced
    ? formatDistanceToNow(new Date(lastSynced), { addSuffix: true })
    : null;

  return (
    <View style={[r.card, connected && r.cardConnected]}>
      <View style={r.left}>
        <Text style={r.icon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <View style={r.labelRow}>
            <Text style={r.label}>{label}</Text>
            {connected && (
              <View style={r.connectedBadge}>
                <Text style={r.connectedText}>● Connected</Text>
              </View>
            )}
          </View>
          <Text style={r.desc}>{description}</Text>
          {connected && timeAgo && (
            <Text style={r.lastSync}>{lastSyncedLabel} {timeAgo}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[r.btn, connected ? r.btnDisconnect : r.btnConnect, (loading || comingSoon) && { opacity: 0.5 }]}
        onPress={connected ? onDisconnect : onConnect}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={connected ? C.error : '#000'} size="small" />
          : <Text style={[r.btnText, connected && { color: C.error }]}>
              {connected ? 'Disconnect' : comingSoon ? 'Soon' : 'Connect'}
            </Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  scroll: { padding: 20, paddingBottom: 60, gap: 0 },

  explainer: {
    backgroundColor: C.primary + '12',
    borderWidth: 1,
    borderColor: C.primary + '30',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  explainerEmoji: { fontSize: 32 },
  explainerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  explainerText: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.green + '12',
    borderWidth: 1,
    borderColor: C.green + '30',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  statusText: { flex: 1, fontSize: 13, color: C.green, fontWeight: '600' },

  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.error + '12',
    borderWidth: 1,
    borderColor: C.error + '30',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  warningEmoji: { fontSize: 24 },
  warningTitle: { fontSize: 14, fontWeight: '800', color: C.error },
  warningSub: { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: '600' },

  syncNowBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  syncNowText: { color: C.primary, fontSize: 13, fontWeight: '700' },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  footnote: { marginTop: 20 },
  footnoteText: { fontSize: 11, color: C.muted, lineHeight: 17, textAlign: 'center' },
});

const r = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardConnected: { borderColor: C.green + '30' },
  left: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { fontSize: 24, marginTop: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  label: { fontSize: 15, fontWeight: '700', color: C.text },
  connectedBadge: {
    backgroundColor: C.green + '20',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  connectedText: { fontSize: 10, color: C.green, fontWeight: '700' },
  desc: { fontSize: 12, color: C.muted, lineHeight: 17 },
  lastSync: { fontSize: 11, color: C.green, marginTop: 3, fontWeight: '600' },
  btn: {
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 2,
  },
  btnConnect: { backgroundColor: C.primary },
  btnDisconnect: {
    borderWidth: 1,
    borderColor: C.error + '40',
    backgroundColor: 'transparent',
  },
  btnText: { fontSize: 13, fontWeight: '800', color: '#000' },
});
