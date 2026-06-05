import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, StatusBar, Switch, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../hooks/useAuth';
import { C, S, R, F } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

const PUSH_KEY = 'push_notifications_enabled';

const DEFAULT_HANDLER: Notifications.NotificationHandler = {
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
};

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(PUSH_KEY).then(val => {
      if (val === 'false') setPushEnabled(false);
    });
  }, []);

  async function handleTogglePush(value: boolean) {
    setPushEnabled(value);
    await SecureStore.setItemAsync(PUSH_KEY, String(value));
    if (!value) {
      Notifications.setNotificationHandler(null);
    } else {
      Notifications.setNotificationHandler(DEFAULT_HANDLER);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await signOut();
          if (error) {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          } else {
            navigation.replace('Onboarding');
          }
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Contact support', 'Please contact support@streakwar.com to delete your account.');
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Account */}
        <Text style={s.sectionTitle}>ACCOUNT</Text>
        <View style={s.section}>
          <TouchableOpacity
            style={s.row}
            onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon')}
            activeOpacity={0.7}
          >
            <Text style={s.rowLabel}>Edit Profile</Text>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.row, s.rowLast]} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={s.rowLabel}>Sign out</Text>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <Text style={s.sectionTitle}>NOTIFICATIONS</Text>
        <View style={s.section}>
          <View style={[s.row, s.rowNoChevron]}>
            <Text style={s.rowLabel}>Push notifications</Text>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
          <TouchableOpacity
            style={[s.row, s.rowLast]}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.7}
          >
            <Text style={s.rowLabel}>Open notification settings</Text>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy */}
        <Text style={s.sectionTitle}>PRIVACY</Text>
        <View style={s.section}>
          <TouchableOpacity style={[s.row, s.rowLast]} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <Text style={[s.rowLabel, { color: C.error }]}>Delete account</Text>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={s.sectionTitle}>ABOUT</Text>
        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Version</Text>
            <Text style={s.rowValue}>1.0.0</Text>
          </View>
          <TouchableOpacity
            style={s.row}
            onPress={() => Alert.alert('Terms of Service', 'Coming soon')}
            activeOpacity={0.7}
          >
            <Text style={s.rowLabel}>Terms of Service</Text>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.row, s.rowLast]}
            onPress={() => Alert.alert('Privacy Policy', 'Coming soon')}
            activeOpacity={0.7}
          >
            <Text style={s.rowLabel}>Privacy Policy</Text>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S[4],
    paddingVertical: S[3],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  headerRight: { width: 60 },
  scroll: { paddingHorizontal: S[4], paddingTop: S[6], paddingBottom: 48 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.2,
    marginBottom: S[2],
    marginTop: S[4],
  },
  section: {
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S[4],
    paddingVertical: S[4],
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowNoChevron: {},
  rowTextGroup: { flex: 1 },
  rowLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  rowNote: { fontSize: 12, color: C.muted, marginTop: 2 },
  rowValue: { fontSize: 14, color: C.muted },
  rowChevron: { fontSize: 20, color: C.muted, lineHeight: 22 },
});
