// StreakWar — app shell: custom stack navigation + bottom tab bar
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { Grad } from '../components/ui';
import { C, a, f } from '../theme';
import { DB } from '../data';

import { Onboarding, Login, Signup, Reset } from '../screens/Auth';
import Home from '../screens/Home';
import { Challenges, ChallengeDetail, CreateChallenge } from '../screens/Challenges';
import LogWorkout from '../screens/Log';
import Leaderboard from '../screens/Leaderboard';
import { Profile, EditProfile, UserProfile } from '../screens/Profile';
import { ConnectDevices, WeeklyRecap, Upgrade, Comments } from '../screens/Devices';

const SCREENS = {
  onboarding: Onboarding, login: Login, signup: Signup, reset: Reset,
  home: Home, challenges: Challenges, leaderboard: Leaderboard, profile: Profile,
  log: LogWorkout, challengeDetail: ChallengeDetail, create: CreateChallenge,
  devices: ConnectDevices, recap: WeeklyRecap, editProfile: EditProfile,
  userProfile: UserProfile, comments: Comments,
};

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'challenges', label: 'Challenges', icon: 'trophy' },
  { key: 'leaderboard', label: 'Ranks', icon: 'podium' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];
const TAB_KEYS = TABS.map((t) => t.key);
const AUTH = ['onboarding', 'login', 'signup', 'reset'];

function NavItem({ t, on, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4, minWidth: 54 }}>
      <Icon name={t.icon} size={23} color={on ? C.primary : C.text3} stroke={on ? 2.2 : 2} />
      <Text style={f('ui', 700, 10, { color: on ? C.primary : C.text3, letterSpacing: 0.2 })}>{t.label}</Text>
    </TouchableOpacity>
  );
}

function BottomNav({ active, onTab, onLog }) {
  return (
    <View style={{
      backgroundColor: a(C.bg, 0.96), borderTopWidth: 1, borderTopColor: C.line,
      paddingTop: 9, paddingBottom: 7, paddingHorizontal: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {TABS.slice(0, 2).map((t) => <NavItem key={t.key} t={t} on={active === t.key} onPress={() => onTab(t.key)} />)}
      <TouchableOpacity activeOpacity={0.9} onPress={onLog} style={{ marginTop: -24 }}>
        <Grad colors={[C.primaryBri, C.primary]} style={{
          width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
          borderWidth: 4, borderColor: C.bg,
          shadowColor: C.primary, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
        }}>
          <Icon name="plus" size={28} color={C.onPrimary} stroke={2.6} />
        </Grad>
      </TouchableOpacity>
      {TABS.slice(2).map((t) => <NavItem key={t.key} t={t} on={active === t.key} onPress={() => onTab(t.key)} />)}
    </View>
  );
}

export default function AppNavigator() {
  const [stack, setStack] = useState([{ screen: 'onboarding', params: {} }]);
  const [upgrade, setUpgrade] = useState(false);
  const top = stack[stack.length - 1];
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [stack.length, top.screen]);

  function nav(screen, params = {}) {
    if (TAB_KEYS.includes(screen)) { setStack([{ screen, params }]); return; }
    setStack((s) => [...s, { screen, params }]);
  }
  function back() { setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)); }
  function tab(key) { setStack([{ screen: key, params: {} }]); }
  function signIn() { setStack([{ screen: 'home', params: {} }]); }
  function openProfile(id) { nav('userProfile', { id }); }

  const Comp = SCREENS[top.screen];
  const props = { nav, back, tab, params: top.params, signIn, openProfile, openUpgrade: () => setUpgrade(true) };
  const isAuth = AUTH.includes(top.screen);
  const showNav = !isAuth && top.screen !== 'log' && TAB_KEYS.includes(top.screen);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <Comp {...props} />
      </Animated.View>
      {showNav ? <BottomNav active={top.screen} onTab={tab} onLog={() => nav('log')} /> : null}
      <Upgrade open={upgrade} onClose={() => setUpgrade(false)} />
    </SafeAreaView>
  );
}
