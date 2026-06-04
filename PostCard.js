// StreakWar — ChallengeRow (shared across Home, Challenges, Profile)
import React from 'react';
import { View, Text } from 'react-native';
import Icon from './Icon';
import { Card, Bar, Tag } from './ui';
import { C, a, f } from '../theme';
import { DB } from '../data';

export const statusMeta = {
  active: { label: 'Active', color: C.green },
  upcoming: { label: 'Upcoming', color: C.blue },
  completed: { label: 'Completed', color: C.text3 },
};

const Dot = () => <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.text3 }} />;

export default function ChallengeRow({ c, onPress }) {
  const sc = DB.SCORING_LABEL[c.scoring[0]];
  const si = DB.SCORING_ICON[c.scoring[0]];
  const st = statusMeta[c.status];
  const win = c.status === 'completed' && c.myRank === 1;
  return (
    <Card onPress={onPress} pad={15} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: a(C.primary, 0.13), borderWidth: 1, borderColor: a(C.primary, 0.26), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={si} size={23} color={C.primary} stroke={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={f('ui', 700, 16, { color: C.text, flexShrink: 1 })}>{c.name}</Text>
            {!c.isPublic ? <Icon name="lock" size={13} color={C.text3} stroke={2} /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: st.color }} />
              <Text style={f('ui', 600, 12, { color: st.color })}>{st.label}</Text>
            </View>
            <Dot />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="users" size={13} color={C.text2} stroke={2} />
              <Text style={f('ui', 500, 12, { color: C.text2 })}>{c.members}</Text>
            </View>
            <Dot />
            <Text style={f('ui', 500, 12, { color: C.text2 })}>{sc}</Text>
          </View>
        </View>
        {c.myRank ? (
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
              {win ? <Icon name="trophy" size={14} color={C.gold} stroke={2} /> : null}
              <Text style={f('disp', 700, 20, { color: win ? C.gold : C.text })}>{'#' + c.myRank}</Text>
            </View>
            <Text style={f('ui', 600, 11, { color: C.text2 })}>{c.myScore + ' pts'}</Text>
          </View>
        ) : null}
      </View>
      {c.status === 'active' ? (
        <View style={{ marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Bar value={1 - c.daysLeft / 30} color={C.primary} h={5} style={{ flex: 1 }} />
          <Text style={f('ui', 600, 11.5, { color: C.text2 })}>{c.daysLeft + 'd left'}</Text>
        </View>
      ) : null}
    </Card>
  );
}
