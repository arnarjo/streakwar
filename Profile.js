// StreakWar — Connect Devices, Weekly Recap, Upgrade, Comments
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Icon from '../components/Icon';
import { Screen, Header, Btn, IconBtn, Avatar, Tag, Sheet, Modal, SLabel, Grad } from '../components/ui';
import PostCard from '../components/PostCard';
import { C, a, f } from '../theme';
import { DB } from '../data';

function ProviderRow({ p, onToggle, onSamsung }) {
  return (
    <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: p.connected ? a(C.green, 0.3) : C.line, borderRadius: 16, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={p.icon} size={26} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={f('ui', 700, 15, { color: C.text })}>{p.label}</Text>
            {p.connected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, backgroundColor: a(C.green, 0.16) }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
                <Text style={f('ui', 700, 10, { color: C.green })}>Connected</Text>
              </View>
            ) : null}
          </View>
          <Text style={f('ui', 500, 12, { color: C.text2, marginTop: 3, lineHeight: 17 })}>{p.desc}</Text>
          {p.connected && p.lastSync ? <Text style={f('ui', 600, 11, { color: C.green, marginTop: 5 })}>{'Last synced ' + p.lastSync}</Text> : null}
        </View>
      </View>
      <Btn full size="sm" variant={p.connected ? 'danger' : 'primary'} onPress={p.provider === 'samsung' && !p.connected ? onSamsung : () => onToggle(p.provider)} style={{ marginTop: 12 }}>
        {p.connected ? 'Disconnect' : 'Connect'}
      </Btn>
    </View>
  );
}

export function ConnectDevices({ back }) {
  const [conns, setConns] = useState(DB.connections);
  const [samsung, setSamsung] = useState(false);
  const [showData, setShowData] = useState(false);
  function toggle(prov) { setConns((cs) => cs.map((c) => (c.provider === prov ? { ...c, connected: !c.connected, lastSync: !c.connected ? 'just now' : undefined } : c))); }
  const connected = conns.filter((c) => c.connected).length;
  const data = [['run', 'Workouts & activities'], ['footsteps', 'Steps'], ['ruler', 'Distance'], ['flame', 'Active energy'], ['stopwatch', 'Exercise minutes']];
  return (
    <View style={{ flex: 1 }}>
      <Header title="Connect devices" onBack={back} />
      <Screen contentStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 22 }}>
          <Grad colors={[a(C.primary, 0.2), a(C.primary, 0.05)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 64, height: 64, borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: a(C.primary, 0.3), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bolt" size={32} color={C.primary} stroke={1.8} />
          </Grad>
          <Text style={f('disp', 700, 22, { color: C.text, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' })}>Auto-sync your workouts</Text>
          <Text style={f('ui', 400, 13.5, { color: C.text2, lineHeight: 20, maxWidth: 300, textAlign: 'center', marginTop: 12 })}>Connect your health apps and StreakWar credits new workouts automatically — even when the app is closed.</Text>
        </View>
        {connected > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 20, borderRadius: 13, backgroundColor: a(C.green, 0.1), borderWidth: 1, borderColor: a(C.green, 0.3) }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} />
            <Text style={f('ui', 600, 13, { flex: 1, color: C.green })}>{connected + ' source' + (connected !== 1 ? 's' : '') + ' connected · auto-syncing'}</Text>
            <TouchableOpacity activeOpacity={0.7}><Text style={f('ui', 700, 12.5, { color: C.primary })}>Sync now</Text></TouchableOpacity>
          </View>
        ) : null}
        <SLabel style={{ marginBottom: 10 }}>Health platform</SLabel>
        <ProviderRow p={conns[0]} onToggle={toggle} />
        <SLabel style={{ marginTop: 10, marginBottom: 10 }}>Apps & devices</SLabel>
        <ProviderRow p={conns[1]} onToggle={toggle} />
        <ProviderRow p={conns[2]} onToggle={toggle} onSamsung={() => setSamsung(true)} />
        <TouchableOpacity activeOpacity={0.85} onPress={() => setShowData(!showData)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, marginTop: 6, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
          <Icon name="shield" size={18} color={C.text2} stroke={2} />
          <Text style={f('ui', 700, 13.5, { flex: 1, color: C.text })}>What data we sync</Text>
          <Icon name={showData ? 'chevU' : 'chevD'} size={17} color={C.text3} />
        </TouchableOpacity>
        {showData ? (
          <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderTopWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingBottom: 14, marginTop: -2 }}>
            <Text style={f('ui', 400, 12, { color: C.text2, lineHeight: 18, marginVertical: 12 })}>We only read these activity types. We never read location traces, heart rate or sleep. You can disconnect anytime.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.map(([ic, l]) => <Tag key={l} icon={ic} color={C.text2}>{l}</Tag>)}
            </View>
          </View>
        ) : null}
        <Text style={f('ui', 400, 11.5, { color: C.text3, lineHeight: 18, textAlign: 'center', marginTop: 22 })}>Background sync runs every 15 minutes. Strava activities arrive within 60 seconds via webhook.</Text>
      </Screen>
      <Sheet open={samsung} onClose={() => setSamsung(false)} title="Connect Samsung Health">
        <Text style={f('ui', 400, 14, { color: C.text2, marginBottom: 18 })}>Samsung Health syncs through Health Connect. Three quick steps:</Text>
        {[['Open Samsung Health', 'Settings → Health Connect → turn on sharing'], ['Allow activity data', 'Enable Steps, Exercise & Distance'], ['Connect Health Connect', 'Come back and connect Health Connect above']].map(([t, d], i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 13, marginBottom: 14 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: a(C.primary, 0.16), borderWidth: 1, borderColor: a(C.primary, 0.4), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={f('disp', 700, 14, { color: C.primary })}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f('ui', 700, 14, { color: C.text })}>{t}</Text>
              <Text style={f('ui', 500, 12.5, { color: C.text2, marginTop: 2, lineHeight: 17 })}>{d}</Text>
            </View>
          </View>
        ))}
        <Btn full size="lg" icon="link" onPress={() => setSamsung(false)} style={{ marginTop: 6 }}>Open Samsung Health</Btn>
      </Sheet>
    </View>
  );
}

// ── Weekly Recap ──
export function WeeklyRecap({ back }) {
  return (
    <View style={{ flex: 1 }}>
      <Header title="Weekly recap" onBack={back} right={<IconBtn name="share" onPress={() => {}} />} />
      <Screen contentStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 }}>
        <Grad colors={[a(C.primary, 0.22), a(C.primaryDeep, 0.12), C.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, paddingVertical: 24, paddingHorizontal: 22, borderWidth: 1, borderColor: a(C.primary, 0.3), overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: a(C.primary, 0.12) }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={f('ui', 700, 12, { letterSpacing: 1.4, color: C.primary, textTransform: 'uppercase' })}>Week 23 · 2026</Text>
              <View style={{ marginTop: 6 }}>
                <Text style={f('disp', 800, 28, { color: C.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 29 })}>Your week</Text>
                <Text style={f('disp', 800, 28, { color: C.text, textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 29 })}>in StreakWar</Text>
              </View>
            </View>
            <Icon name="flame" size={44} color={C.primaryBri} stroke={1.7} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: a(C.primary, 0.25) }}>
            {[['318', 'points'], ['7', 'workouts'], ['+2', 'rank ↑']].map(([v, l], k) => (
              <View key={k} style={{ flex: 1, alignItems: 'center', borderLeftWidth: k ? 1 : 0, borderLeftColor: a(C.primary, 0.2) }}>
                <Text style={f('disp', 800, 34, { color: C.primary, lineHeight: 34 })}>{v}</Text>
                <Text style={f('ui', 600, 11, { color: C.text2, marginTop: 3 })}>{l}</Text>
              </View>
            ))}
          </View>
        </Grad>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          {[['Top activity', 'Running', 'run', C.primary], ['Best day', 'Saturday', 'calendar', C.amber], ['Active days', '6 / 7', 'checkCircle', C.green], ['Longest workout', '88 min', 'stopwatch', C.blue]].map(([l, v, ic, col]) => (
            <View key={l} style={{ width: '47%', flexGrow: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={ic} size={16} color={col} stroke={2} /><Text style={f('ui', 600, 11, { color: C.text2 })}>{l}</Text></View>
              <Text style={f('disp', 700, 22, { color: C.text, marginTop: 7 })}>{v}</Text>
            </View>
          ))}
        </View>
        <Grad colors={[a(C.gold, 0.1), C.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: a(C.gold, 0.3) }}>
          <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: a(C.gold, 0.16), borderWidth: 1, borderColor: a(C.gold, 0.4), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trophy" size={24} color={C.gold} stroke={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={f('ui', 700, 14.5, { color: C.text })}>You held your Gold spot</Text>
            <Text style={f('ui', 500, 12.5, { color: C.text2, marginTop: 1 })}>2 spots from promotion to Platinum</Text>
          </View>
        </Grad>
        <Btn full size="lg" icon="share" onPress={back} style={{ marginTop: 18 }}>Share my week</Btn>
      </Screen>
    </View>
  );
}

// ── Upgrade modal ──
export function Upgrade({ open, onClose }) {
  const feats = [['trophy', 'Unlimited challenges', 'Free plan caps at 3 active'], ['shield', 'Streak freezes', 'Protect your streak on rest days'], ['gem', 'Pro badge & themes', 'Stand out on every leaderboard'], ['podium', 'Advanced stats', 'Deep trends & weekly recaps']];
  return (
    <Modal open={open} onClose={onClose} w={340}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Grad colors={[C.amber, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bolt" size={21} color="#1A0E04" stroke={2.2} />
          </Grad>
          <Text style={f('disp', 800, 24, { color: C.text, letterSpacing: 0.5 })}>STREAKWAR <Text style={{ color: C.amber }}>PRO</Text></Text>
        </View>
        <IconBtn name="x" size={34} ic={16} onPress={onClose} bg="transparent" />
      </View>
      <Text style={f('ui', 400, 13.5, { color: C.text2, marginTop: 4, marginBottom: 18 })}>Go all-in on the competition.</Text>
      <View style={{ gap: 13, marginBottom: 20 }}>
        {feats.map(([ic, t, d]) => (
          <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: a(C.amber, 0.14), borderWidth: 1, borderColor: a(C.amber, 0.3), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ic} size={19} color={C.amber} stroke={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f('ui', 700, 14, { color: C.text })}>{t}</Text>
              <Text style={f('ui', 500, 12, { color: C.text2, marginTop: 1 })}>{d}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
        <Text style={f('disp', 800, 36, { color: C.text })}>$4.99</Text>
        <Text style={f('ui', 500, 13, { color: C.text2 })}>/ month</Text>
      </View>
      <TouchableOpacity activeOpacity={0.9} onPress={onClose}>
        <Grad colors={[C.amber, C.primary]} style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={f('ui', 700, 17, { color: C.onPrimary })}>Start 7-day free trial</Text>
        </Grad>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ marginTop: 10, padding: 6 }}>
        <Text style={f('ui', 500, 13, { color: C.text2, textAlign: 'center' })}>Restore purchase</Text>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Comments ──
export function Comments({ back, params }) {
  const post = params.post;
  const [list, setList] = useState([
    { user: 'u_dagur', text: 'Beast mode. That pace is unreal.', ago: '1h' },
    { user: 'u_lena', text: 'Inspiring! Joining you next time.', ago: '42m' },
    { user: 'u_me', text: 'Let’s gooo 🔥 — keep it up.', ago: '12m' },
  ]);
  const [txt, setTxt] = useState('');
  function send() { if (!txt.trim()) return; setList((l) => [...l, { user: 'u_me', text: txt.trim(), ago: 'now' }]); setTxt(''); }
  return (
    <View style={{ flex: 1 }}>
      <Header title="Comments" onBack={back} />
      <Screen contentStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 }}>
        <PostCard post={post} onReact={() => {}} openProfile={() => {}} onOpenSheet={() => {}} />
        <View style={{ marginTop: 8, marginBottom: 14, marginHorizontal: 2 }}><SLabel>{list.length + ' comments'}</SLabel></View>
        {list.map((c, i) => {
          const cu = DB.U[c.user]; const me = c.user === 'u_me';
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 11, marginBottom: 16 }}>
              <Avatar user={cu} size={36} />
              <View style={{ flex: 1 }}>
                <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, borderTopLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 13 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={f('ui', 700, 13, { color: me ? C.primary : C.text })}>{cu.full_name}</Text>
                    <Text style={f('ui', 500, 11, { color: C.text3 })}>{c.ago}</Text>
                  </View>
                  <Text style={f('ui', 400, 13.5, { color: C.text, lineHeight: 19 })}>{c.text}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </Screen>
      <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg }}>
        <Avatar user={DB.me} size={36} />
        <TextInput
          value={txt}
          onChangeText={setTxt}
          placeholder="Add a comment…"
          placeholderTextColor={C.text3}
          onSubmitEditing={send}
          style={f('ui', 500, 14, { flex: 1, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, color: C.text })}
        />
        <IconBtn name="arrowR" size={42} ic={19} onPress={send} bg={C.primary} color={C.onPrimary} style={{ borderWidth: 0 }} />
      </View>
    </View>
  );
}
