import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../hooks/useAuth';
import { useHealthSync, PROVIDER_META } from '../hooks/useHealthSync';
import type { ProviderKey } from '../hooks/useHealthSync';
import { formatDistanceToNow } from 'date-fns';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const C = {
  bg: '#0C1117',
  card: '#151C24',
  border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8',
  muted: '#4A6070',
  primary: '#F97316',
  green: '#22C55E',
  error: '#EF4444',
};

const OAUTH_PROVIDERS: ProviderKey[] = ['strava', 'fitbit'];
const COMING_SOON_PROVIDERS: ProviderKey[] = ['garmin'];


export default function ConnectDevicesScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const { connections, syncing, isConnected, connectNative, confirmHealthConnectConnection, syncNow, disconnect, nativeProvider, refresh: fetchConnections } = useHealthSync(profile?.id ?? '');

  const [connecting, setConnecting] = useState<ProviderKey | null>(null);

  const nativeMeta = PROVIDER_META[nativeProvider];

  // Listen for deep link callbacks from OAuth providers
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('oauth-success')) {
        const provider = new URL(url).searchParams.get('provider') as ProviderKey | null;
        setConnecting(null);
        fetchConnections();
        Alert.alert('Connected!', `${provider ? PROVIDER_META[provider]?.label : 'Provider'} connected successfully.`);
      } else if (url.includes('oauth-error')) {
        setConnecting(null);
        Alert.alert('Connection failed', 'Could not connect. Please try again.');
      }
    });
    return () => sub.remove();
  }, [fetchConnections]);


  async function handleNativeConnect() {
    setConnecting(nativeProvider);
    const { success, message } = await connectNative();
    setConnecting(null);
    if (!success && Platform.OS === 'android') {
      Alert.alert(
        'Grant permissions in Health Connect',
        'A Health Connect dialog opened. Please allow StreakWar to read Exercise sessions, Steps, Distance and Calories — then tap Connect again.',
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(success ? 'Connected!' : 'Could not connect', message);
  }

  async function handleOAuthConnect(provider: ProviderKey) {
    if (COMING_SOON_PROVIDERS.includes(provider)) {
      Alert.alert(`${PROVIDER_META[provider].label} — Coming soon`, 'Garmin integration is coming soon. Use Health Connect to sync workouts for now.');
      return;
    }
    if (!profile?.id) return;
    setConnecting(provider);
    const url = `${SUPABASE_URL}/functions/v1/oauth-init?provider=${provider}&user_id=${profile.id}`;
    await WebBrowser.openBrowserAsync(url);
    // Deep link listener handles the result; clear loading if browser was dismissed manually
    setConnecting(null);
  }

  async function handleDisconnect(provider: ProviderKey) {
    Alert.alert(
      `Disconnect ${PROVIDER_META[provider].label}`,
      'Future workouts will no longer be synced automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => disconnect(provider) },
      ]
    );
  }

  async function handleSyncNow() {
    const count = await syncNow();
    Alert.alert(
      count > 0 ? 'Sync complete' : 'Nothing new',
      count > 0 ? `${count} new workout${count === 1 ? '' : 's'} imported.` : 'No new activities found.'
    );
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
            Connect your health apps and devices. StreakWar will automatically detect new workouts and award points — even when the app is closed.
          </Text>
        </View>

        {/* Status */}
        {connectedCount > 0 && (
          <View style={s.statusRow}>
            <View style={s.statusDot} />
            <Text style={s.statusText}>{connectedCount} source{connectedCount !== 1 ? 's' : ''} connected · auto-syncing</Text>
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
              description={
                provider === 'strava'
                  ? 'Every Strava activity is pushed to StreakWar via webhook within 60 seconds of completion.'
                  : provider === 'garmin'
                  ? 'Coming soon — Garmin Connect integration is in development.'
                  : 'Fitbit activities are pushed automatically via the Fitbit Subscription API.'
              }
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
  onConnect, onDisconnect, lastSynced,
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
            <Text style={r.lastSync}>Last synced {timeAgo}</Text>
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
