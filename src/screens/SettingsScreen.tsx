import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { C, S, R, F } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { signOut } = useAuth();

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
          <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={s.rowLabel}>Sign out</Text>
            <Text style={s.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <Text style={s.sectionTitle}>NOTIFICATIONS</Text>
        <View style={s.section}>
          <View style={s.row}>
            <View style={s.rowTextGroup}>
              <Text style={s.rowLabel}>Push notifications</Text>
              <Text style={s.rowNote}>Manage in device settings</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <Text style={s.sectionTitle}>ABOUT</Text>
        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.rowLabel}>App version</Text>
            <Text style={s.rowValue}>StreakWar v1.0</Text>
          </View>
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
  rowTextGroup: { flex: 1 },
  rowLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  rowNote: { fontSize: 12, color: C.muted, marginTop: 2 },
  rowValue: { fontSize: 14, color: C.muted },
  rowChevron: { fontSize: 20, color: C.muted, lineHeight: 22 },
});
