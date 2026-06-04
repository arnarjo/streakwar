// StreakWar — Challenges, Discover, Detail, Create
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import Icon from '../components/Icon';
import {
  Screen, Header, Btn, IconBtn, Card, Avatar, Tag, SegTabs, ChipRow, Bar, Sheet, Field, Empty, SLabel, SettingRow, Grad,
} from '../components/ui';
import ChallengeRow, { statusMeta } from '../components/ChallengeRow';
import { C, a, f } from '../theme';
import { DB } from '../data';

function DiscoverCard({ d, onJoin }) {
  const si = DB.SCORING_ICON[d.scoring[0]];
  return (
    <Card pad={15} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: a(C.primary, 0.13), borderWidth: 1, borderColor: a(C.primary, 0.26), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={si} size={23} color={C.primary} stroke={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={f('ui', 700, 16, { color: C.text, flexShrink: 1 })}>{d.name}</Text>
            <Tag color={C.primary} bg={a(C.primary, 0.13)}>{d.tag}</Tag>
          </View>
          <Text style={f('ui', 400, 13, { color: C.text2, lineHeight: 19, marginTop: 6 })}>{d.desc}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="users" size={14} color={C.text2} stroke={2} />
          <Text style={f('ui', 500, 12.5, { color: C.text2 })}>{d.members.toLocaleString() + ' competing'}</Text>
        </View>
        <Btn size="sm" onPress={() => onJoin(d)}>Join</Btn>
      </View>
    </Card>
  );
}

function QuickSheet({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('7-Day Showdown');
  const close = () => { onClose(); setTimeout(() => setStep(0), 250); };
  return (
    <Sheet open={open} onClose={close} title={step === 0 ? 'Quick 1v1' : 'Challenge ready'}>
      {step === 0 ? (
        <View>
          <Text style={f('ui', 400, 14, { color: C.text2, marginBottom: 16 })}>Private 7-day workout duel. First to log most wins.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {['7 days', 'Workouts', 'Private'].map((t) => <Tag key={t} color={C.primary} bg={a(C.primary, 0.13)}>{t}</Tag>)}
          </View>
          <Field label="Challenge name" value={name} onChange={setName} icon="flame" style={{ marginBottom: 18 }} />
          <Btn full size="lg" icon="bolt" onPress={() => setStep(1)}>Create & get code</Btn>
        </View>
      ) : (
        <View>
          <Text style={f('ui', 400, 14, { color: C.text2, marginBottom: 14 })}>Share this code with your friend to start the duel.</Text>
          <Text style={f('disp', 800, 38, { color: C.primary, letterSpacing: 10, textAlign: 'center', backgroundColor: C.surface2, borderWidth: 1.5, borderColor: a(C.primary, 0.45), borderRadius: 16, paddingVertical: 22, marginBottom: 16 })}>XK29PD</Text>
          <Btn full size="lg" icon="share" onPress={close}>Share invite code</Btn>
          <Btn full variant="ghost" onPress={close} style={{ marginTop: 8 }}>Done</Btn>
        </View>
      )}
    </Sheet>
  );
}

export function Challenges({ nav }) {
  const [tab, setTab] = useState('active');
  const [join, setJoin] = useState(false);
  const [quick, setQuick] = useState(false);
  const [code, setCode] = useState('');
  const list = DB.challenges.filter((c) => c.status === tab);
  const tabs = [
    { key: 'active', label: 'Active' }, { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Done' }, { key: 'discover', label: 'Discover', icon: 'search' },
  ];
  return (
    <View style={{ flex: 1 }}>
      <Header big title="Challenges" right={[
        <IconBtn key={1} name="key" onPress={() => setJoin(true)} />,
        <Btn key={2} size="sm" icon="plus" onPress={() => nav('create')}>New</Btn>,
      ]} />
      <Screen contentStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setQuick(true)} style={{ marginBottom: 16 }}>
          <Grad colors={[a(C.primary, 0.16), C.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{
            flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 16,
            borderWidth: 1, borderColor: a(C.primary, 0.3),
          }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: a(C.primary, 0.18), borderWidth: 1, borderColor: a(C.primary, 0.34), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bolt" size={22} color={C.primary} stroke={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f('ui', 700, 15, { color: C.text })}>Challenge a friend</Text>
              <Text style={f('ui', 500, 12.5, { color: C.text2, marginTop: 1 })}>Private 7-day 1v1 in seconds</Text>
            </View>
            <Icon name="chevR" size={18} color={C.primary} />
          </Grad>
        </TouchableOpacity>
        <SegTabs tabs={tabs} value={tab} onChange={setTab} style={{ marginBottom: 16 }} />
        {tab === 'discover'
          ? DB.discover.map((d) => <DiscoverCard key={d.id} d={d} onJoin={() => nav('challengeDetail', { id: DB.challenges[0].id })} />)
          : list.length
            ? list.map((c) => <ChallengeRow key={c.id} c={c} onPress={() => nav('challengeDetail', { id: c.id })} />)
            : <Empty
                icon={tab === 'upcoming' ? 'calendar' : 'trophy'}
                title={`No ${tab} challenges`}
                sub={tab === 'active' ? 'Start one and invite your crew.' : 'Nothing here yet.'}
                cta={tab === 'active' ? <Btn onPress={() => nav('create')}>Create a challenge</Btn> : null}
              />}
      </Screen>
      <Sheet open={join} onClose={() => setJoin(false)} title="Join with a code">
        <Text style={f('ui', 400, 14, { color: C.text2, marginBottom: 16 })}>Enter the invite code a friend shared with you.</Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().slice(0, 8))}
          placeholder="AB12CD34"
          placeholderTextColor={C.text3}
          autoCapitalize="characters"
          style={f('disp', 800, 30, { textAlign: 'center', letterSpacing: 10, color: C.primary, backgroundColor: C.surface2, borderWidth: 1.5, borderColor: a(C.primary, 0.4), borderRadius: 14, paddingVertical: 16, marginBottom: 16 })}
        />
        <Btn full size="lg" disabled={code.length < 4} onPress={() => { setJoin(false); setCode(''); nav('challengeDetail', { id: DB.challenges[0].id }); }}>Join challenge</Btn>
      </Sheet>
      <QuickSheet open={quick} onClose={() => setQuick(false)} />
    </View>
  );
}

// ── Challenge Detail ──
export function ChallengeDetail({ nav, back, params }) {
  const c = DB.challenges.find((x) => x.id === params.id) || DB.challenges[0];
  const host = DB.U[c.host];
  const si = DB.SCORING_ICON[c.scoring[0]];
  const board = c.board.length ? c.board : [{ u: 'u_kata', s: 0 }, { u: 'u_me', s: 0 }];
  const max = Math.max(...board.map((b) => b.s), 1);
  const stats = [
    ['Members', c.members, 'users'],
    ['Your rank', c.myRank ? '#' + c.myRank : '—', 'medal'],
    [c.status === 'completed' ? 'Ended' : 'Days left', c.status === 'completed' ? '—' : c.daysLeft, 'calendar'],
  ];
  return (
    <View style={{ flex: 1 }}>
      <Header title={c.name} onBack={back} right={<IconBtn name="share" onPress={() => {}} />} />
      <Screen contentStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 }}>
        <Grad colors={[a(C.primary, 0.18), C.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: a(C.primary, 0.26) }}>
          <View style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
            <View style={{ width: 54, height: 54, borderRadius: 15, backgroundColor: a(C.primary, 0.2), borderWidth: 1, borderColor: a(C.primary, 0.35), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={si} size={28} color={C.primary} stroke={2} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 7 }}>
                <Tag icon="flame" color={C.green} bg={a(C.green, 0.13)}>{statusMeta[c.status].label}</Tag>
                <Tag icon={c.isPublic ? 'globe' : 'lock'} color={C.text2}>{c.isPublic ? 'Public' : 'Private'}</Tag>
              </View>
              <Text style={f('ui', 400, 14, { color: C.text, lineHeight: 20 })}>{c.desc}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line }}>
            {stats.map(([l, v, ic], k) => (
              <View key={k} style={{ flex: 1, alignItems: 'center', borderLeftWidth: k ? 1 : 0, borderLeftColor: C.line }}>
                <Text style={f('disp', 700, 24, { color: C.text })}>{String(v)}</Text>
                <Text style={f('ui', 600, 11, { color: C.text2, marginTop: 2 })}>{l}</Text>
              </View>
            ))}
          </View>
        </Grad>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Avatar user={host} size={34} onPress={() => nav('userProfile', { id: c.host })} />
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Text style={f('ui', 500, 12.5, { color: C.text2 })}>Hosted by </Text>
            <Text style={f('ui', 700, 13, { color: C.text })}>{host.full_name}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line }}>
            <Text style={f('ui', 600, 11, { color: C.text2, letterSpacing: 1 })}>{c.code}</Text>
            <Icon name="link" size={14} color={C.primary} stroke={2} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginHorizontal: 2 }}>
          <SLabel>Standings</SLabel>
          <Text style={f('ui', 600, 12, { color: C.text2 })}>{DB.SCORING_LABEL[c.scoring[0]] + ' scoring'}</Text>
        </View>
        {board.map((b, i) => {
          const u = DB.U[b.u]; const me = b.u === 'u_me'; const rank = i + 1;
          const medal = rank <= 3;
          const mc = rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : C.text2;
          return (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 13, marginBottom: 7, borderRadius: 14,
              backgroundColor: me ? a(C.primary, 0.1) : C.surface, borderWidth: 1, borderColor: me ? a(C.primary, 0.4) : C.line,
            }}>
              <View style={{ width: 26, alignItems: 'center' }}>
                {medal ? <Icon name={rank === 1 ? 'trophy' : 'medal'} size={20} color={mc} stroke={2} /> : <Text style={f('disp', 700, 16, { color: mc })}>{'#' + rank}</Text>}
              </View>
              <Avatar user={u} size={38} onPress={() => nav('userProfile', { id: b.u })} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={f('ui', 700, 14, { color: C.text })}>{u.full_name}{me ? <Text style={f('ui', 600, 14, { color: C.primary })}>  you</Text> : null}</Text>
                <Bar value={b.s / max} color={me ? C.primary : C.text3} h={4} style={{ marginTop: 6, maxWidth: 150 }} />
              </View>
              <Text style={f('disp', 700, 18, { color: me ? C.primary : C.text })}>{b.s}</Text>
            </View>
          );
        })}
      </Screen>
      {c.status !== 'completed' ? (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, backgroundColor: C.bg }}>
          <Btn full size="lg" icon="plus" onPress={() => nav('log', { challengeId: c.id })}>Log a workout</Btn>
        </View>
      ) : null}
    </View>
  );
}

// ── Create challenge ──
export function CreateChallenge({ back }) {
  const [name, setName] = useState('');
  const [scoring, setScoring] = useState('workouts');
  const [pub, setPub] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [len, setLen] = useState('7');
  const scoringOpts = Object.keys(DB.SCORING_LABEL).filter((k) => k !== 'custom');
  return (
    <View style={{ flex: 1 }}>
      <Header title="New challenge" onBack={back} />
      <Screen contentStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 }}>
        <Field label="Challenge name" value={name} onChange={setName} icon="trophy" placeholder="e.g. June Burn" style={{ marginBottom: 20 }} />
        <SLabel style={{ marginBottom: 10 }}>Scoring</SLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {scoringOpts.map((k) => {
            const on = scoring === k;
            return (
              <TouchableOpacity key={k} activeOpacity={0.85} onPress={() => setScoring(k)} style={{
                width: '48%', flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 13,
                backgroundColor: on ? a(C.primary, 0.14) : C.surface, borderWidth: 1.5, borderColor: on ? a(C.primary, 0.5) : C.line,
              }}>
                <Icon name={DB.SCORING_ICON[k]} size={18} color={on ? C.primary : C.text2} stroke={2} />
                <Text style={f('ui', 600, 13.5, { color: on ? C.text : C.text2 })}>{DB.SCORING_LABEL[k]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <SLabel style={{ marginBottom: 10 }}>Length</SLabel>
        <ChipRow items={[{ key: '7', label: '7 days' }, { key: '14', label: '14 days' }, { key: '30', label: '30 days' }, { key: 'custom', label: 'Custom' }]} value={len} onChange={setLen} style={{ marginBottom: 20 }} />
        <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <SettingRow icon="globe" title="Public challenge" sub="Anyone can discover & join" on={pub} set={setPub} />
          <View style={{ height: 1, backgroundColor: C.line2, marginHorizontal: 14 }} />
          <SettingRow icon="camera" title="Require photo proof" sub="Members must attach a photo" on={photo} set={setPhoto} />
        </View>
      </Screen>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, backgroundColor: C.bg }}>
        <Btn full size="lg" disabled={!name.trim()} icon="check" onPress={back}>Create challenge</Btn>
      </View>
    </View>
  );
}
