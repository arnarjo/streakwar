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

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', dimmed: '#1E2A35', primary: '#F97316',
};

type Tab = 'active' | 'upcoming' | 'completed' | 'discover';
const TAB_LABELS: Record<Tab, string> = { active: 'Active', upcoming: 'Upcoming', completed: 'Done', discover: '🔍' };

export default function ChallengesScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
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
      Alert.alert('Joined! 💪', `You're now in "${challenge?.name}"`);
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
      message: `Join my 7-day workout challenge on StreakWar! 💪\nUse invite code: ${quickInviteCode}`,
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
        <Text style={s.title}>Challenges</Text>
        <View style={s.headerBtns}>
          <TouchableOpacity style={s.joinBtn} onPress={() => setJoinModalOpen(true)}>
            <Text style={s.joinBtnText}>Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.createBtn} onPress={handleNewChallenge}>
            <Text style={s.createBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={s.quickBanner} onPress={handleQuickBanner} activeOpacity={0.8}>
        <Text style={s.quickBannerEmoji}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.quickBannerTitle}>Challenge a friend</Text>
          <Text style={s.quickBannerSub}>Create a private 7-day 1v1 in seconds</Text>
        </View>
        <Text style={s.quickBannerArrow}>→</Text>
      </TouchableOpacity>

      <View style={s.tabs}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            accessibilityRole="button"
            {...(t === 'discover' ? { accessibilityLabel: 'Discover challenges' } : {})}
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
                <Text style={s.emptyEmoji}>{tab === 'active' ? '💪' : tab === 'upcoming' ? '📅' : '🏆'}</Text>
                <Text style={s.emptyTitle}>
                  {tab === 'active' ? 'No active challenges' : tab === 'upcoming' ? 'No upcoming challenges' : 'No completed challenges'}
                </Text>
                {tab === 'active' && (
                  <TouchableOpacity style={s.emptyBtn} onPress={handleNewChallenge}>
                    <Text style={s.emptyBtnText}>Create a challenge</Text>
                  </TouchableOpacity>
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
                  <Text style={s.modalTitle}>Challenge created! 🎉</Text>
                  <Text style={s.modalSub}>Share this code with your friend</Text>
                  <View style={s.inviteCodeBox}>
                    <Text style={s.inviteCode}>{quickInviteCode}</Text>
                  </View>
                  <TouchableOpacity style={s.joinConfirmBtn} onPress={handleShareCode}>
                    <Text style={s.joinConfirmBtnText}>📤 Share invite code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeQuickModal}>
                    <Text style={s.cancelBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.modalTitle}>⚡ Quick 1v1</Text>
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
                    <Text style={s.joinConfirmBtnText}>{quickCreating ? 'Creating...' : 'Create & get invite code 🚀'}</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  joinBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  joinBtnText: { color: C.text, fontWeight: '700', fontSize: 13 },
  createBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive: { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40' },
  tabText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  tabTextActive: { color: C.primary },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.muted },
  emptyBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  modalSub: { fontSize: 14, color: C.muted },
  codeInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  joinConfirmBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  joinConfirmBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 4 },
  cancelBtnText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  quickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.primary + '12',
    borderWidth: 1,
    borderColor: C.primary + '30',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  quickBannerEmoji: { fontSize: 24 },
  quickBannerTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  quickBannerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  quickBannerArrow: { fontSize: 18, color: C.primary, fontWeight: '700' },
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
