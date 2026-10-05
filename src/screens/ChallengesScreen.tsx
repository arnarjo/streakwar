import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  StatusBar, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format, addDays } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { usePremium } from '../hooks/usePremium';
import ChallengeCard from '../components/ChallengeCard';
import DiscoverChallengesScreen from './DiscoverChallengesScreen';
import UpgradeModal from '../components/UpgradeModal';
import InterfaceIcon from '../components/InterfaceIcon';
import { C, HIT, R } from '../theme';
import type { AppNavigationProp } from '../navigation/types';

type Tab = 'active' | 'upcoming' | 'completed' | 'discover';
const TAB_LABELS: Record<Tab, string> = { active: 'Active', upcoming: 'Upcoming', completed: 'Completed', discover: 'Discover' };

export default function ChallengesScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const { myChallenges, loading, refresh, joinByCode, joinPublic, createChallenge } = useFitnessChallenges(profile?.id ?? '');
  const { isPro, offering, purchase, restore, FREE_MAX_CHALLENGES } = usePremium(profile?.id ?? '');
  const [tab, setTab] = useState<Tab>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [upgradeVisible, setUpgradeVisible] = useState(false);

  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickName, setQuickName] = useState('7-Day Challenge');
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickInviteCode, setQuickInviteCode] = useState<string | null>(null);

  const activeCount = myChallenges.filter(c => c.status === 'active' || c.status === 'upcoming').length;
  const atLimit = !isPro && activeCount >= FREE_MAX_CHALLENGES;

  function handleNewChallenge() {
    if (atLimit) { setUpgradeVisible(true); return; }
    navigation.navigate('CreateChallenge');
  }

  function handleQuickBanner() {
    if (atLimit) { setUpgradeVisible(true); return; }
    setQuickModalOpen(true);
  }

  const filtered = tab === 'discover' ? [] : myChallenges.filter(c => c.status === tab);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function handleJoinByCode() {
    if (!code.trim()) return;
    setJoiningCode(true);
    const { error, challenge } = await joinByCode(code.trim());
    setJoiningCode(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setJoinModalOpen(false);
      setCode('');
      Alert.alert('Joined', `You're now in "${challenge?.name}"`);
    }
  }

  async function handleQuickCreate() {
    if (!quickName.trim()) return;
    setQuickCreating(true);
    const today = new Date();
    const { error, challenge } = await createChallenge({
      name: quickName.trim(),
      description: '1v1 challenge — may the best win! 💪',
      start_date: format(today, 'yyyy-MM-dd'),
      end_date: format(addDays(today, 7), 'yyyy-MM-dd'),
      scoring_modes: ['workouts'],
      points_per_workout: 1,
      points_per_1000_steps: 1,
      points_per_km: 1,
      points_per_30min: 1,
      custom_scoring: null,
      backlog_days_allowed: 7,
      require_photo_proof: false,
      is_teams_mode: false,
      tie_break_rule: 'most_recent_activity',
      is_public: false,
    });
    setQuickCreating(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setQuickInviteCode(challenge?.invite_code ?? null);
    }
  }

  async function handleShareCode() {
    if (!quickInviteCode) return;
    await Share.share({
      message: `Join my 7-day workout challenge on StreakWar.\nUse invite code: ${quickInviteCode}`,
    });
  }

  function closeQuickModal() {
    setQuickModalOpen(false);
    setQuickName('7-Day Challenge');
    setQuickInviteCode(null);
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">Challenges</Text>
        <View style={s.headerBtns}>
          <TouchableOpacity
            style={s.joinBtn}
            onPress={() => setJoinModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Join with a code"
          >
            <Text style={s.joinBtnText}>Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.createBtn}
            onPress={handleNewChallenge}
            accessibilityRole="button"
            accessibilityLabel="Create a new challenge"
          >
            <InterfaceIcon name="add" size={18} color={C.onPrimary} />
            <Text style={s.createBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab !== 'discover' && (
        <View style={s.startCard}>
          <Text style={s.startTitle}>Find an open challenge</Text>
          <Text style={s.startSub}>Browse public challenges you can join.</Text>
          <View style={s.startActions}>
            <TouchableOpacity
              style={s.browseBtn}
              onPress={() => setTab('discover')}
              accessibilityRole="button"
              accessibilityLabel="Browse open challenges"
            >
              <Text style={s.browseBtnText}>Browse challenges</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.friendBtn}
              onPress={handleQuickBanner}
              accessibilityRole="button"
              accessibilityLabel="Challenge a friend"
              accessibilityHint="Creates a private 7-day challenge with an invite code"
            >
              <Text style={s.friendBtnText}>Challenge a friend</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={s.tabs} accessibilityRole="tablist">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            accessibilityLabel={t === 'discover' ? 'Discover challenges' : TAB_LABELS[t]}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{TAB_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab !== 'discover' ? (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          renderItem={({ item }) => (
            <ChallengeCard
              challenge={item}
              onPress={() => navigation.navigate('ChallengeDetail', { challengeId: item.id })}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>
                  {tab === 'active' ? 'No active challenges' : tab === 'upcoming' ? 'No upcoming challenges' : 'No completed challenges'}
                </Text>
                <Text style={s.emptyText}>
                  {tab === 'active'
                    ? 'Join a public challenge or start your own.'
                    : tab === 'upcoming'
                    ? "Challenges you've joined that haven't started yet appear here."
                    : 'Challenges you took part in that have finished appear here.'}
                </Text>
                {tab === 'active' && (
                  <View style={s.emptyActions}>
                    <TouchableOpacity
                      style={s.browseBtn}
                      onPress={() => setTab('discover')}
                      accessibilityRole="button"
                      accessibilityLabel="Browse open challenges"
                    >
                      <Text style={s.browseBtnText}>Browse open challenges</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.friendBtn}
                      onPress={handleNewChallenge}
                      accessibilityRole="button"
                      accessibilityLabel="Create a challenge"
                    >
                      <Text style={s.friendBtnText}>Create a challenge</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <ActivityIndicator style={{ marginTop: 64 }} color={C.primary} />
            )
          }
        />
      ) : (
        <DiscoverChallengesScreen
          myChallenges={myChallenges}
          joinPublic={joinPublic}
          onRefreshMyChallenges={refresh}
        />
      )}

      {/* Quick 1v1 Challenge Modal */}
      <Modal visible={quickModalOpen} animationType="slide" presentationStyle="pageSheet" transparent>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              {quickInviteCode ? (
                <>
                  <Text style={s.modalTitle}>Challenge created</Text>
                  <Text style={s.modalSub}>Share this code with your friend</Text>
                  <View style={s.inviteCodeBox}>
                    <Text style={s.inviteCode}>{quickInviteCode}</Text>
                  </View>
                  <TouchableOpacity style={s.joinConfirmBtn} onPress={handleShareCode}>
                    <Text style={s.joinConfirmBtnText}>Share invite code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeQuickModal}>
                    <Text style={s.cancelBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.modalTitle}>Challenge a friend</Text>
                  <Text style={s.modalSub}>Private 7-day workout challenge</Text>
                  <View style={s.quickInfoRow}>
                    {['7 days', 'Workouts', 'Private'].map(tag => (
                      <View key={tag} style={s.quickTag}>
                        <Text style={s.quickTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <TextInput
                    style={s.nameInput}
                    placeholder="Challenge name"
                    placeholderTextColor={C.dimmed}
                    value={quickName}
                    onChangeText={setQuickName}
                    autoCorrect={false}
                    maxLength={60}
                  />
                  <TouchableOpacity
                    style={[s.joinConfirmBtn, (!quickName.trim() || quickCreating) && { opacity: 0.5 }]}
                    onPress={handleQuickCreate}
                    disabled={!quickName.trim() || quickCreating}
                  >
                    <Text style={s.joinConfirmBtnText}>{quickCreating ? 'Creating...' : 'Create and get invite code'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeQuickModal}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <UpgradeModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        offering={offering}
        onPurchase={purchase}
        onRestore={restore}
        reason={`Free plan allows ${FREE_MAX_CHALLENGES} active challenges. Upgrade to Pro for unlimited.`}
      />

      <Modal visible={joinModalOpen} animationType="slide" presentationStyle="pageSheet" transparent>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Join with a code</Text>
              <Text style={s.modalSub}>Enter the invite code you received</Text>
              <TextInput
                style={s.codeInput}
                placeholder="AB12CD34"
                placeholderTextColor={C.dimmed}
                value={code}
                onChangeText={t => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
              <TouchableOpacity
                style={[s.joinConfirmBtn, (!code.trim() || joiningCode) && { opacity: 0.5 }]}
                onPress={handleJoinByCode}
                disabled={!code.trim() || joiningCode}
              >
                <Text style={s.joinConfirmBtnText}>{joiningCode ? 'Joining...' : 'Join challenge'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setJoinModalOpen(false); setCode(''); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  joinBtn: { minHeight: HIT, justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 16 },
  joinBtnText: { color: C.text, fontWeight: '700', fontSize: 13 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: HIT, justifyContent: 'center', backgroundColor: C.primary, borderRadius: R.sm, paddingHorizontal: 14 },
  createBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 13 },
  startCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 16, gap: 6, marginHorizontal: 16, marginBottom: 12 },
  startTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  startSub: { fontSize: 13, color: C.muted, lineHeight: 18 },
  startActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  browseBtn: { minHeight: HIT, justifyContent: 'center', backgroundColor: C.primary, borderRadius: R.sm, paddingHorizontal: 16 },
  browseBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 14 },
  friendBtn: { minHeight: HIT, justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 16 },
  friendBtnText: { color: C.text, fontWeight: '700', fontSize: 13 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 6 },
  tab: { flex: 1, minHeight: HIT, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, borderRadius: R.sm, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tabActive: { backgroundColor: C.dimmed, borderColor: C.primary },
  tabText: { fontSize: 13, color: C.muted, fontWeight: '600', textAlign: 'center' },
  tabTextActive: { color: C.text, fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { paddingTop: 32, paddingHorizontal: 4, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptyText: { fontSize: 13, color: C.muted, lineHeight: 18 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  modalSub: { fontSize: 14, color: C.muted },
  codeInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  joinConfirmBtn: { backgroundColor: C.primary, borderRadius: R.md, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  joinConfirmBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', minHeight: HIT },
  cancelBtnText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  quickInfoRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  quickTag: {
    backgroundColor: C.primary + '20',
    borderWidth: 1,
    borderColor: C.primary + '40',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quickTagText: { color: C.primary, fontSize: 12, fontWeight: '700' },
  nameInput: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
  inviteCodeBox: {
    backgroundColor: C.bg,
    borderWidth: 2,
    borderColor: C.primary + '50',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  inviteCode: {
    fontSize: 32,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: 6,
  },
});
