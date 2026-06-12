// StreakWar — Home feed
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from '../components/Icon';
import { Screen, Header, Avatar, IconBtn, Card, Bar, Skel, SLabel, Grad } from '../components/ui';
import PostCard from '../components/PostCard';
import ChallengeRow from '../components/ChallengeRow';
import { C, a, f, nfmt } from '../theme';
import { DB } from '../data';

function StreakHero({ streak, best, onShare }) {
  const toNext = 10 - (streak % 10 || 0) || 10;
  const milestone = Math.ceil((streak + 1) / 10) * 10;
  const prog = (streak % 10) / 10;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onShare} style={{ marginBottom: 14 }}>
      <Grad colors={[a(C.primary, 0.20), a(C.primaryDeep, 0.10), C.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{
        borderRadius: 22, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18,
        borderWidth: 1, borderColor: a(C.primary, 0.3), overflow: 'hidden',
      }}>
        <View style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: a(C.primary, 0.10) }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Text style={f('disp', 800, 64, { color: C.primary, letterSpacing: -2, lineHeight: 60, textShadowColor: a(C.primary, 0.5), textShadowRadius: 20, textShadowOffset: { width: 0, height: 4 } })}>{streak}</Text>
              <Icon name="flame" size={30} color={C.primaryBri} stroke={1.8} />
            </View>
            <Text style={f('ui', 700, 17, { color: C.text, marginTop: 2 })}>day streak</Text>
            <Text style={f('ui', 500, 12.5, { color: C.text2, marginTop: 2 })}>
              Personal best · <Text style={f('ui', 700, 12.5, { color: C.amber })}>{best + ' days'}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 11, backgroundColor: a(C.bg, 0.4), borderWidth: 1, borderColor: C.line }}>
            <Icon name="share" size={14} color={C.text} stroke={2} />
            <Text style={f('ui', 700, 12.5, { color: C.text })}>Share</Text>
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
          <Bar value={prog} color={C.primary} h={7} glow />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={f('ui', 500, 12, { color: C.text2 })}>
              <Text style={f('ui', 700, 12, { color: C.text })}>{toNext + ' days'}</Text> to {milestone}-day milestone
            </Text>
            <Text style={f('ui', 700, 12, { color: C.primary })}>{milestone}</Text>
          </View>
        </View>
      </Grad>
    </TouchableOpacity>
  );
}

function Banner({ icon, iconColor, title, sub, onPress, accent }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15,
      marginBottom: 10, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: a(accent || iconColor, 0.28),
    }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: a(iconColor, 0.14), borderWidth: 1, borderColor: a(iconColor, 0.3), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={iconColor} stroke={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={f('ui', 700, 14.5, { color: C.text })}>{title}</Text>
        <Text style={f('ui', 500, 12.5, { color: C.text2, marginTop: 1 })}>{sub}</Text>
      </View>
      <Icon name="chevR" size={18} color={C.text3} />
    </TouchableOpacity>
  );
}

function MilestoneCard({ m, onReact, openProfile }) {
  const u = DB.U[m.user];
  return (
    <Card pad={14} style={{ marginBottom: 10, borderColor: a(C.amber, 0.25), backgroundColor: C.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View>
          <Avatar user={u} size={44} onPress={() => openProfile(m.user)} />
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.surface }}>
            <Icon name="flame" size={12} color={C.onPrimary} stroke={2.4} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={f('ui', 700, 14, { color: C.text })}>
            {u.full_name} hit a <Text style={{ color: C.amber }}>{m.streak + '-day'}</Text> streak
          </Text>
          <Text style={f('ui', 500, 12, { color: C.text2, marginTop: 1 })}>{m.ago} ago · send some hype</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 7, marginTop: 12 }}>
        {DB.reactionsList.map((r) => {
          const on = m.myReaction === r;
          return (
            <TouchableOpacity key={r} activeOpacity={0.7} onPress={() => onReact(m.id, r)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, minHeight: 36,
              backgroundColor: on ? a(C.amber, 0.18) : C.surface2, borderWidth: 1, borderColor: on ? a(C.amber, 0.45) : C.line,
            }}>
              <Icon name={DB.REACTION_ICON[r]} size={14} color={on ? C.amber : C.text2} stroke={2} />
              {m.reactions[r] ? <Text style={f('ui', 700, 12, { color: on ? C.amber : C.text2 })}>{m.reactions[r]}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

const reactReducer = (id, r) => (arr) => arr.map((p) => {
  if (p.id !== id) return p;
  const rc = { ...p.reactions }; const prev = p.myReaction;
  if (prev) rc[prev] = (rc[prev] || 1) - 1;
  if (prev === r) return { ...p, myReaction: null, reactions: rc };
  rc[r] = (rc[r] || 0) + 1; return { ...p, myReaction: r, reactions: rc };
});

export default function Home({ nav, openProfile }) {
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState(DB.feed);
  const [ms, setMs] = useState(DB.milestones);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 950); return () => clearTimeout(t); }, []);

  const me = DB.me;
  const active = DB.challenges.filter((c) => c.status === 'active').slice(0, 2);
  const tier = DB.TIER[me.tier];

  return (
    <View style={{ flex: 1 }}>
      <Header
        big
        title={`Hæ, ${me.full_name.split(' ')[0]}`}
        subtitle="Ready to move today?"
        left={<Avatar user={me} size={42} onPress={() => nav('profile')} />}
        right={[
          <TouchableOpacity key="p" activeOpacity={0.7} onPress={() => nav('leaderboard')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
            <Icon name="star" size={14} color={C.primary} stroke={2} />
            <Text style={f('disp', 700, 14, { color: C.text, letterSpacing: 0.3 })}>{nfmt(me.total_points)}</Text>
          </TouchableOpacity>,
          <IconBtn key="b" name="bell" onPress={() => nav('profile')} />,
        ]}
      />
      <Screen contentStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 }}>
        {loading ? (
          <View>
            <Skel h={150} r={22} style={{ marginBottom: 14 }} />
            <Skel h={64} r={16} style={{ marginBottom: 10 }} />
            <Skel h={64} r={16} style={{ marginBottom: 18 }} />
            {[0, 1].map((k) => (
              <View key={k} style={{ marginBottom: 12, padding: 15, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18 }}>
                <View style={{ flexDirection: 'row', gap: 11, alignItems: 'center' }}>
                  <Skel w={42} h={42} r={21} />
                  <View style={{ flex: 1 }}>
                    <Skel w="55%" h={13} style={{ marginBottom: 7 }} />
                    <Skel w="35%" h={11} />
                  </View>
                  <Skel w={40} h={40} r={13} />
                </View>
                <Skel h={13} style={{ marginTop: 14 }} />
                <Skel w="80%" h={13} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        ) : (
          <View>
            <StreakHero streak={me.current_streak} best={me.longest_streak} onShare={() => nav('recap')} />
            <Banner icon={tier.icon} iconColor={tier.color} accent={tier.color} title={`#5 in ${tier.label} League`} sub="3 days left · top 5 promote" onPress={() => nav('leaderboard')} />
            <Banner icon="target" iconColor={C.primary} title="Katrín is 162 pts ahead of you" sub="Your rival this week · catch up" onPress={() => nav('leaderboard')} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 12, marginHorizontal: 2 }}>
              <SLabel>Active challenges</SLabel>
              <TouchableOpacity activeOpacity={0.7} onPress={() => nav('challenges')}>
                <Text style={f('ui', 700, 12.5, { color: C.primary })}>See all</Text>
              </TouchableOpacity>
            </View>
            {active.map((c) => <ChallengeRow key={c.id} c={c} onPress={() => nav('challengeDetail', { id: c.id })} />)}
            <View style={{ marginTop: 20, marginBottom: 12, marginHorizontal: 2 }}><SLabel>Streak milestones</SLabel></View>
            {ms.map((m) => <MilestoneCard key={m.id} m={m} onReact={(id, r) => setMs(reactReducer(id, r))} openProfile={openProfile} />)}
            <View style={{ marginTop: 20, marginBottom: 12, marginHorizontal: 2 }}><SLabel>Friends feed</SLabel></View>
            {feed.map((p) => <PostCard key={p.id} post={p} onReact={(id, r) => setFeed(reactReducer(id, r))} openProfile={openProfile} onOpenSheet={(post) => nav('comments', { post })} />)}
          </View>
        )}
      </Screen>
    </View>
  );
}
